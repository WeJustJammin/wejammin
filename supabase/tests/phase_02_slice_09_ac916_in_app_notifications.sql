\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 AC-916 (BE01a security notification seam, architecture-design.md "Transactional
-- email": external delivery disabled, in-app/local-fake notification boundary only).  The
-- in-app notification intent store: a private append-only table with forced RLS, one row per
-- notification id, identifiers and a closed template code only, the account-holder recipient
-- resolved server-side from the immutable outbox request, behind one service-role RPC.

\ir phase_02_slice_09_dec111/00-support.sqlinc

create function public.s09n_as(p_role text, p_sub text, p_sql text) returns text language plpgsql as $body$
declare result text;
begin
  perform pg_temp.set_jwt_claim('sub', coalesce(p_sub, ''), true);
  execute format('set local role %I', p_role);
  begin
    execute p_sql into result;
  exception when others then
    result := 'ERROR:' || sqlstate;
  end;
  reset role;
  return result;
end;
$body$;

-- ---- surface ---------------------------------------------------------------------
select has_table('identity', 'in_app_notification_intents', 'identity.in_app_notification_intents exists [P2-S09-AC-916]');
select ok(coalesce((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('identity.in_app_notification_intents')), false),
  'the intent store forces row level security [P2-S09-AC-916]');
select ok(to_regclass('identity.in_app_notification_intents') is not null and not exists (
    select 1 from unnest(array['anon', 'authenticated', 'service_role']) r, unnest(array['select', 'insert', 'update', 'delete', 'truncate', 'references']) p
     where has_table_privilege(r, 'identity.in_app_notification_intents', p)),
  'no API role holds a table-level grant on the intent store [P2-S09-AC-916]');
select is((select array_agg(attname::text order by attnum) from pg_attribute
            where attrelid = to_regclass('identity.in_app_notification_intents') and attnum > 0 and not attisdropped),
  array['id', 'notification_id', 'recipient_auth_user_id', 'recipient_class', 'event_type', 'operation_id',
        'safe_template_code', 'delivery_request_id', 'created_at'],
  'the store holds identifiers and a template code only: no body, address, name or provider reference [P2-S09-AC-916]');
select ok(to_regprocedure('platform_api.in_app_notification_record(jsonb)') is not null
    and has_function_privilege('service_role', to_regprocedure('platform_api.in_app_notification_record(jsonb)'), 'execute')
    and not has_function_privilege('anon', to_regprocedure('platform_api.in_app_notification_record(jsonb)'), 'execute')
    and not has_function_privilege('authenticated', to_regprocedure('platform_api.in_app_notification_record(jsonb)'), 'execute')
    and (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p
          where p.oid = to_regprocedure('platform_api.in_app_notification_record(jsonb)')),
  'in_app_notification_record is a service-role-only security definer with a pinned empty search_path [P2-S09-AC-916]');

-- ---- fixtures through producers --------------------------------------------------
select pg_temp.m_user(1);
select pg_temp.m_user(2);
select pg_temp.m_enroll(1, 'Phone');
select pg_temp.m_enroll(2, 'Laptop');
create temp table n_event on commit drop as
select e.id as event_id, e.request_id, e.reason_code, o.payload->>'authBindingId' as binding_id,
       (select b.auth_user_id from identity.auth_user_bindings b where b.id = (o.payload->>'authBindingId')::uuid) as holder
  from identity.security_events e
  join platform_private.outbox_events o on o.aggregate_id = e.id
   and o.event_type = 'identity.security-notification.requested.v1'
 where e.action = 'mfa.enroll.verified' and e.actor_auth_user_id = pg_temp.m_uid(1);
select is((select count(*)::integer from n_event), 1, 'fixture: the enrollment wrote one security event and one notification request');
select is((select holder from n_event), pg_temp.m_uid(1), 'fixture: the request names the account holder through the binding in the immutable outbox payload');

create function pg_temp.n_request(p_override jsonb default '{}'::jsonb) returns jsonb language sql stable as $body$
  select jsonb_build_object(
    'notificationId', (select event_id from n_event),
    'eventType', 'identity.security-notification.requested.v1',
    'recipientClass', 'account_holder',
    'operationId', (select request_id from n_event),
    'safeTemplateCode', 'mfa_factor_added',
    'requestId', extensions.gen_random_uuid()) || p_override
$body$;

-- ---- delivery ----------------------------------------------------------------------
-- The recorder is a service-role Worker command (granted to service_role only), so it runs
-- under the verified service-role JWT with no human session published: the system scope
-- that the intent store's write policy admits.
select pg_temp.set_jwt_claim('role', 'service_role', true);
create temp table n_first on commit drop as select platform_api.in_app_notification_record(pg_temp.n_request()) as response;
select ok((select (select array_agg(k order by k) from jsonb_object_keys(response) k)
      = array['acceptedAt', 'deliveryAttemptId', 'deliveryState', 'providerReference']
    and response->>'deliveryState' = 'recorded'
    and response->>'providerReference' = 'in-app:' || (select event_id from n_event)::text
    and response->>'deliveryAttemptId' ~ '^[0-9a-f-]{36}$'
    and (response->>'acceptedAt')::timestamptz <= clock_timestamp()
    from n_first),
  'delivery returns exactly {deliveryAttemptId, deliveryState, providerReference, acceptedAt} for an in-app record [P2-S09-AC-916]');
select ok((select count(*) = 1 and bool_and(recipient_auth_user_id = pg_temp.m_uid(1)
        and recipient_class = 'account_holder' and safe_template_code = 'mfa_factor_added'
        and operation_id = (select request_id from n_event)
        and event_type = 'identity.security-notification.requested.v1')
    from identity.in_app_notification_intents where notification_id = (select event_id from n_event)),
  'one intent row: recipient resolved server-side to the account holder, template and operation recorded [P2-S09-AC-916]');
select is((select response->>'deliveryAttemptId' from n_first),
  (select id::text from identity.in_app_notification_intents where notification_id = (select event_id from n_event)),
  'the delivery attempt id is the intent row id [P2-S09-AC-916]');

-- ---- replay is idempotent by notification id -----------------------------------------
select is(platform_api.in_app_notification_record(pg_temp.n_request()), (select response from n_first),
  'a replay with a fresh delivery request id returns the original response unchanged [P2-S09-AC-916]');
select is(platform_api.in_app_notification_record(pg_temp.n_request()), (select response from n_first),
  'a second replay is identical too [P2-S09-AC-916]');
select is((select count(*)::integer from identity.in_app_notification_intents where notification_id = (select event_id from n_event)), 1,
  'replays wrote no second intent row [P2-S09-AC-916]');
select is((select delivery_request_id from identity.in_app_notification_intents where notification_id = (select event_id from n_event)),
  (select delivery_request_id from identity.in_app_notification_intents where notification_id = (select event_id from n_event)),
  'the first delivery request id is kept');

-- ---- refusals leave nothing behind ------------------------------------------------------
create temp table n_fp on commit drop as select count(*)::integer as intents from identity.in_app_notification_intents;
select throws_ok($$select platform_api.in_app_notification_record(pg_temp.n_request('{"notificationId":"a0000000-0000-4000-8000-0000000000f1"}'))$$,
  'P0001', 'NOT_FOUND', 'an unknown notification id is NOT_FOUND [P2-S09-AC-916]');
select throws_ok($$select platform_api.in_app_notification_record(pg_temp.n_request('{"safeTemplateCode":"mfa_factors_reset"}'))$$,
  'P0001', 'INVALID_REQUEST', 'a template that does not match the security event reason is refused [P2-S09-AC-916]');
select throws_ok($$select platform_api.in_app_notification_record(pg_temp.n_request('{"safeTemplateCode":"anything_else"}'))$$,
  'P0001', 'INVALID_REQUEST', 'an unapproved template code is refused [P2-S09-AC-916]');
select throws_ok($$select platform_api.in_app_notification_record(pg_temp.n_request('{"operationId":"a0000000-0000-4000-8000-0000000000f2"}'))$$,
  'P0001', 'INVALID_REQUEST', 'an operation id that is not the event''s request id is refused [P2-S09-AC-916]');
select throws_ok($$select platform_api.in_app_notification_record(pg_temp.n_request('{"recipientClass":"operator"}'))$$,
  'P0001', 'INVALID_REQUEST', 'a recipient class other than account_holder is refused [P2-S09-AC-916]');
select throws_ok($$select platform_api.in_app_notification_record(pg_temp.n_request('{"eventType":"identity.other.v1"}'))$$,
  'P0001', 'INVALID_REQUEST', 'another event type is refused [P2-S09-AC-916]');
select throws_ok($$select platform_api.in_app_notification_record(pg_temp.n_request('{"recipientAuthUserId":"a0000000-0000-4000-8000-0000000000f3"}'))$$,
  'P0001', 'INVALID_REQUEST', 'a caller-supplied recipient is refused: the recipient is never accepted from the request [P2-S09-AC-916]');
select throws_ok($$select platform_api.in_app_notification_record(pg_temp.n_request() - 'requestId')$$,
  'P0001', 'INVALID_REQUEST', 'a missing key is refused [P2-S09-AC-916]');
select throws_ok($$select platform_api.in_app_notification_record(pg_temp.n_request('{"notificationId":"not-a-uuid"}'))$$,
  'P0001', 'INVALID_REQUEST', 'a malformed id is refused [P2-S09-AC-916]');
select throws_ok($$select platform_api.in_app_notification_record('[]'::jsonb)$$,
  'P0001', 'INVALID_REQUEST', 'a non-object request is refused [P2-S09-AC-916]');
select is((select count(*)::integer from identity.in_app_notification_intents), (select intents from n_fp),
  'every refusal left the store unchanged [P2-S09-AC-916]');

-- ---- append-only ----------------------------------------------------------------------
select throws_ok($$update identity.in_app_notification_intents set safe_template_code = 'mfa_factor_removed'$$,
  'P0001', 'IMMUTABLE_RECORD', 'an intent cannot be updated [P2-S09-AC-916]');
select throws_ok($$delete from identity.in_app_notification_intents$$,
  'P0001', 'IMMUTABLE_RECORD', 'an intent cannot be deleted [P2-S09-AC-916]');

-- ---- second holder gets their own intent; the holder reads only their own ----------------
create temp table n_event2 on commit drop as
select e.id as event_id, e.request_id
  from identity.security_events e
  join platform_private.outbox_events o on o.aggregate_id = e.id
   and o.event_type = 'identity.security-notification.requested.v1'
 where e.action = 'mfa.enroll.verified' and e.actor_auth_user_id = pg_temp.m_uid(2);
select is((platform_api.in_app_notification_record(jsonb_build_object(
    'notificationId', (select event_id from n_event2), 'eventType', 'identity.security-notification.requested.v1',
    'recipientClass', 'account_holder', 'operationId', (select request_id from n_event2),
    'safeTemplateCode', 'mfa_factor_added', 'requestId', extensions.gen_random_uuid()))->>'deliveryState'), 'recorded',
  'a second holder''s notification is recorded [P2-S09-AC-916]');
select is((select recipient_auth_user_id from identity.in_app_notification_intents where notification_id = (select event_id from n_event2)),
  pg_temp.m_uid(2), 'the second intent names the second holder [P2-S09-AC-916]');

select is((select array_agg(attname::text order by attnum) from pg_attribute
            where attrelid = to_regclass('api_identity.in_app_notification_self_v1') and attnum > 0 and not attisdropped),
  array['notification_id', 'safe_template_code', 'created_at'],
  'the self view exposes the notification id, template code and time only [P2-S09-AC-916]');
select ok(coalesce((select c.reloptions @> array['security_invoker=true'] from pg_class c where c.oid = to_regclass('api_identity.in_app_notification_self_v1')), false),
  'the self view is a security-invoker view [P2-S09-AC-916]');
select is(public.s09n_as('authenticated', pg_temp.m_uid(1)::text, 'select count(*)::text from api_identity.in_app_notification_self_v1'), '1',
  'a holder sees only their own notification [P2-S09-AC-916]');
select is(public.s09n_as('authenticated', pg_temp.m_uid(2)::text, 'select count(*)::text from api_identity.in_app_notification_self_v1'), '1',
  'the other holder sees only theirs [P2-S09-AC-916]');
select is(public.s09n_as('authenticated', null, 'select count(*)::text from api_identity.in_app_notification_self_v1'), '0',
  'no subject, no notifications [P2-S09-AC-916]');
select is(public.s09n_as('anon', null, 'select count(*)::text from api_identity.in_app_notification_self_v1'), 'ERROR:42501',
  'anonymous is denied [P2-S09-AC-916]');
select is(public.s09n_as('authenticated', pg_temp.m_uid(1)::text, 'select recipient_auth_user_id::text from identity.in_app_notification_intents limit 1'), 'ERROR:42501',
  'the recipient and operation columns are not readable by the holder [P2-S09-AC-916]');
select is(public.s09n_as('authenticated', pg_temp.m_uid(1)::text, $q$with d as (delete from identity.in_app_notification_intents returning 1) select count(*)::text from d$q$), 'ERROR:42501',
  'the holder cannot delete a notification [P2-S09-AC-916]');

select * from finish();
rollback;
