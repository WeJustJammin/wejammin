\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 G1 SQL boundary (BE01a MFA reconciliation / gauge / security notification,
-- BE03a capability grant read, BE00 consumer dead letters, outbox relay widening).
-- The Worker event consumers are typed against these exact platform_api names and
-- parameters; every row they read is produced by a named producer RPC.

\ir phase_02_slice_09_dec111/00-support.sqlinc
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec119/00-support.sqlinc

-- ---- surface: service-role only, definer, pinned search_path ---------------------
select ok(to_regprocedure(sig) is not null
    and has_function_privilege('service_role', to_regprocedure(sig), 'execute')
    and not has_function_privilege('anon', to_regprocedure(sig), 'execute')
    and not has_function_privilege('authenticated', to_regprocedure(sig), 'execute')
    and (select p.prosecdef and p.proconfig @> array['search_path=""'] from pg_proc p where p.oid = to_regprocedure(sig)),
  sig || ' is a service-role-only security definer with a pinned empty search_path [P2-S09-AC-913]')
from unnest(array[
  'platform_api.auth_mfa_factor_reconcile_read(uuid)', 'platform_api.auth_mfa_reconciling_age()',
  'platform_api.identity_security_notification_read(uuid)', 'platform_api.cms_capability_grant_read_current(uuid)',
  'platform_api.consumer_dead_letter_event(jsonb)']) sig;

-- ---- fixtures through producers --------------------------------------------------
select pg_temp.m_user(1);
select pg_temp.m_enroll(1, 'Phone');
select pg_temp.m_enroll(1, 'Spare');
select is(pg_temp.m_one($q$select count(*)::text from identity.mfa_factor_registry where state = 'verified'$q$)::integer, 2,
  'fixture: two verified factors through the enrollment producers');

-- ---- AC-913: reconcile_read -------------------------------------------------------
select is(platform_api.auth_mfa_factor_reconcile_read(pg_temp.m_fid(1))::text,
  (select jsonb_build_object('found', true, 'state', f.state::text, 'authUserId', f.auth_user_id,
      'providerFactorId', f.provider_factor_id, 'version', f.version::text)::text
     from identity.mfa_factor_registry f where f.id = pg_temp.m_fid(1)),
  'reconcile_read returns exactly {found, state, authUserId, providerFactorId, version} for a factor [P2-S09-AC-913]');
select is(platform_api.auth_mfa_factor_reconcile_read(extensions.gen_random_uuid()), '{"found": false}'::jsonb,
  'an unknown factor id is exactly {"found": false} [P2-S09-AC-913]');
select is(platform_api.auth_mfa_factor_reconcile_read(null), '{"found": false}'::jsonb, 'a null factor id is {"found": false} [P2-S09-AC-913]');

-- ---- AC-908: reconciling age ------------------------------------------------------
select is(platform_api.auth_mfa_reconciling_age(), '{"count": 0, "oldestAgeSeconds": null}'::jsonb,
  'no reconciling factor: count 0 and oldestAgeSeconds null [P2-S09-AC-908]');
select pg_temp.m('mr1', 'auth_mfa_factor_mark_reconciling', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(1),
  'p_factor_id', pg_temp.m_fid(1)));
select is(pg_temp.m_out('mr1'), 'OK', 'fixture: one factor moved to reconciling by the producer');
select pg_temp.m_warp('identity.mfa_factor_registry', $$updated_at = clock_timestamp() - interval '90 seconds'$$,
  format('id = %L', pg_temp.m_fid(1)));
select ok((platform_api.auth_mfa_reconciling_age()->>'count')::integer = 1
    and (platform_api.auth_mfa_reconciling_age()->>'oldestAgeSeconds')::numeric between 89 and 200
    and (select count(*) from jsonb_object_keys(platform_api.auth_mfa_reconciling_age())) = 2,
  'one reconciling factor: count 1 and oldestAgeSeconds about its age, exactly two keys [P2-S09-AC-908]');
select is(platform_api.auth_mfa_factor_reconcile_read(pg_temp.m_fid(1))->>'state', 'reconciling',
  'reconcile_read reports the reconciling state [P2-S09-AC-913]');

-- ---- AC-916: security notification read ------------------------------------------
select ok((select jsonb_typeof(platform_api.identity_security_notification_read(e.id)->'reasonCode') is not null
    and (platform_api.identity_security_notification_read(e.id)->>'found')::boolean
    and platform_api.identity_security_notification_read(e.id)->>'requestId' = e.request_id::text
    and (select count(*) from jsonb_object_keys(platform_api.identity_security_notification_read(e.id))) = 3
    from identity.security_events e where e.action = 'mfa.enroll.verified' order by e.created_at limit 1),
  'a mfa.enroll.verified event reads back exactly {found, reasonCode, requestId} [P2-S09-AC-916]');
select is(platform_api.identity_security_notification_read(extensions.gen_random_uuid()), '{"found": false}'::jsonb,
  'an unknown security event id is {"found": false} [P2-S09-AC-916]');
select is((select count(*)::integer from identity.security_events e where e.action not in
      ('mfa.enroll.verified', 'mfa.factor.removed', 'mfa.factors.reset')
      and (platform_api.identity_security_notification_read(e.id)->>'found')::boolean), 0,
  'an event outside the three notifiable actions is never readable as a notification [P2-S09-AC-916]');
select ok((select count(*) from identity.security_events e where e.action not in
      ('mfa.enroll.verified', 'mfa.factor.removed', 'mfa.factors.reset')) > 0,
  'precondition: the fixture holds at least one non-notifiable security event, so the negative is not vacuous [P2-S09-AC-916]');

-- ---- AC-689: capability grant read -------------------------------------------------
select pg_temp.s09g_grant('g:active', 'owner', 'owner', 'cms.author', pg_temp.s09g_day(5));
select is(pg_temp.s09d_outcome('g:active'), 'OK', 'fixture: a real active grant through CMS-03A-15');
select is(platform_api.cms_capability_grant_read_current(pg_temp.s09g_grant_id(pg_temp.s09d_resp('g:active'))),
  (select jsonb_build_object('found', true, 'grantId', g.id, 'subjectPersonId', g.subject_person_ref,
      'version', g.version::text, 'state', 'active', 'capabilityCode', g.capability_code)
     from platform_private.cms_capability_grants g where g.id = pg_temp.s09g_grant_id(pg_temp.s09d_resp('g:active'))),
  'an active grant reads back exactly {found, grantId, subjectPersonId, version, state, capabilityCode} [P2-S09-AC-689]');
select pg_temp.s09g_revoke('g:revoke', 'owner', pg_temp.s09g_grant_id(pg_temp.s09d_resp('g:active')),
  (select version::text from platform_private.cms_capability_grants where id = pg_temp.s09g_grant_id(pg_temp.s09d_resp('g:active'))));
select is(pg_temp.s09d_outcome('g:revoke'), 'OK', 'fixture: the grant is revoked through CMS-03A-17');
select is(platform_api.cms_capability_grant_read_current(pg_temp.s09g_grant_id(pg_temp.s09d_resp('g:active')))->>'state', 'revoked',
  'a revoked grant reads state revoked and its new version [P2-S09-AC-689]');
select is(platform_api.cms_capability_grant_read_current(pg_temp.s09g_grant_id(pg_temp.s09d_resp('g:active')))->>'version',
  (select version::text from platform_private.cms_capability_grants where id = pg_temp.s09g_grant_id(pg_temp.s09d_resp('g:active'))),
  'the read carries the current aggregate version [P2-S09-AC-689]');
select pg_temp.s09g_member('designer2');
select pg_temp.s09g_grant('g:lapse', 'owner', 'designer2', 'cms.author', pg_temp.s09g_day(2));
select is(pg_temp.s09d_outcome('g:lapse'), 'OK', 'fixture: a second real grant');
select pg_temp.s09g_warp('designer2', 'cms.author', -5, -1);
select is(platform_api.cms_capability_grant_read_current(pg_temp.s09g_grant_id(pg_temp.s09d_resp('g:lapse')))->>'state', 'lapsed',
  'a grant whose validThrough is before the current UTC date reads state lapsed [P2-S09-AC-689]');
select is(platform_api.cms_capability_grant_read_current(extensions.gen_random_uuid()), '{"found": false}'::jsonb,
  'an unknown grant id is {"found": false} [P2-S09-AC-689]');

-- ---- consumer dead letters ----------------------------------------------------------
select ok(coalesce((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('platform_private.consumer_dead_letters')), false)
    and not exists (select 1 from unnest(array['anon', 'authenticated', 'service_role']) r, unnest(array['select', 'insert', 'update', 'delete']) p
      where has_table_privilege(r, 'platform_private.consumer_dead_letters', p)),
  'consumer_dead_letters forces RLS and grants no API role any privilege [P2-S09-AC-689]');
select is(platform_api.consumer_dead_letter_event(jsonb_build_object('consumer', 'identity.security-notifier',
    'eventId', '11111111-1111-4111-8111-111111111111', 'eventType', 'identity.security-notification.requested.v1',
    'schemaVersion', 1, 'aggregateType', 'security_event', 'aggregateId', '22222222-2222-4222-8222-222222222222',
    'aggregateVersion', '1', 'reasonCode', 'SOURCE_RECORD_NOT_FOUND')), '{"accepted": true}'::jsonb,
  'a dead letter is recorded and acknowledged with exactly {accepted: true} [P2-S09-AC-689]');
select is(platform_api.consumer_dead_letter_event(jsonb_build_object('consumer', 'identity.security-notifier',
    'eventId', '11111111-1111-4111-8111-111111111111', 'eventType', 'identity.security-notification.requested.v1',
    'schemaVersion', 1, 'aggregateType', 'security_event', 'aggregateId', '22222222-2222-4222-8222-222222222222',
    'aggregateVersion', '1', 'reasonCode', 'SOURCE_RECORD_NOT_FOUND')), '{"accepted": true}'::jsonb,
  'replaying the same (consumer, eventId) is accepted again [P2-S09-AC-689]');
select is((select count(*)::integer from platform_private.consumer_dead_letters
            where consumer = 'identity.security-notifier' and event_id = '11111111-1111-4111-8111-111111111111'), 1,
  'the replay wrote no second row (idempotent per consumer and event) [P2-S09-AC-689]');
select is(platform_api.consumer_dead_letter_event(jsonb_build_object('consumer', 'identity.auth-state-reconciler',
    'eventId', '11111111-1111-4111-8111-111111111111', 'eventType', null, 'schemaVersion', null,
    'aggregateType', null, 'aggregateId', null, 'aggregateVersion', null, 'reasonCode', 'INVALID_QUEUE_PAYLOAD')),
  '{"accepted": true}'::jsonb, 'another consumer with the same event id is its own row [P2-S09-AC-689]');
select is((select count(*)::integer from platform_private.consumer_dead_letters
            where event_id = '11111111-1111-4111-8111-111111111111'), 2, 'two consumers, two rows [P2-S09-AC-689]');
select is(platform_api.consumer_dead_letter_event(jsonb_build_object('consumer', 'identity.auth-state-reconciler',
    'eventId', null, 'eventType', null, 'schemaVersion', null, 'aggregateType', null, 'aggregateId', null,
    'aggregateVersion', null, 'reasonCode', 'INVALID_QUEUE_PAYLOAD')), '{"accepted": true}'::jsonb,
  'an unidentifiable payload (null event identity) is still recorded [P2-S09-AC-689]');
select is(platform_api.consumer_dead_letter_event(jsonb_build_object('consumer', 'identity.auth-state-reconciler',
    'eventId', null, 'eventType', null, 'schemaVersion', null, 'aggregateType', null, 'aggregateId', null,
    'aggregateVersion', null, 'reasonCode', 'INVALID_QUEUE_PAYLOAD')), '{"accepted": true}'::jsonb,
  'two null-identity records are both accepted: the unique index applies only to identified events [P2-S09-AC-689]');
select is((select count(*)::integer from platform_private.consumer_dead_letters where event_id is null), 2,
  'null-identity records are not collapsed [P2-S09-AC-689]');
select throws_ok($$select platform_api.consumer_dead_letter_event(jsonb_build_object('consumer', 'x',
    'eventId', null, 'eventType', null, 'schemaVersion', null, 'aggregateType', null, 'aggregateId', null,
    'aggregateVersion', null, 'reasonCode', 'NOT_A_REASON'))$$, 'P0001', null,
  'an unknown reason code is refused [P2-S09-AC-689]');
select throws_ok($$select platform_api.consumer_dead_letter_event(jsonb_build_object('consumer', 'Bad Consumer',
    'eventId', null, 'eventType', null, 'schemaVersion', null, 'aggregateType', null, 'aggregateId', null,
    'aggregateVersion', null, 'reasonCode', 'INVALID_QUEUE_PAYLOAD'))$$, 'P0001', null,
  'a malformed consumer name is refused [P2-S09-AC-689]');
select throws_ok($$select platform_api.consumer_dead_letter_event(jsonb_build_object('consumer', 'identity.x',
    'eventId', null, 'eventType', null, 'schemaVersion', null, 'aggregateType', null, 'aggregateId', null,
    'aggregateVersion', null, 'reasonCode', 'INVALID_QUEUE_PAYLOAD', 'body', '{"pii":1}'))$$, 'P0001', null,
  'an extra key (a queue body) is refused: only the closed identifier set is stored [P2-S09-AC-689]');
select throws_ok($$select platform_api.consumer_dead_letter_event(jsonb_build_object('consumer', 'identity.x',
    'eventId', null, 'reasonCode', 'INVALID_QUEUE_PAYLOAD'))$$, 'P0001', null,
  'a missing key is refused: the request is exactly the eight named keys [P2-S09-AC-689]');

-- ---- relay widening: the four tuples the Worker now accepts ----------------------------
-- Real producers emitted: mfa factor changed (enrollment), security notification requested
-- (enrollment verified), cms capability grant changed (grants).  Negative controls are forged
-- outbox rows with the right event type and a wrong aggregate type, or an unlisted event.
insert into platform_private.outbox_events(id, event_type, schema_version, aggregate_type, aggregate_id, aggregate_version,
  correlation_id, payload)
values ('a0000000-0000-4000-8000-000000000001', 'job.requested', 1, 'job', 'a0000000-0000-4000-8000-0000000000a1', 1,
         'a0000000-0000-4000-8000-0000000000c1',
         '{"jobId":"a0000000-0000-4000-8000-0000000000a1","jobType":"platform.job.execute"}'::jsonb),
       ('a0000000-0000-4000-8000-000000000002', 'identity.mfa-factor.changed.v1', 1, 'wrong_aggregate', 'a0000000-0000-4000-8000-0000000000a2', 1,
         'a0000000-0000-4000-8000-0000000000c1', '{}'::jsonb),
       ('a0000000-0000-4000-8000-000000000003', 'identity.mfa-factor.changed.v1', 2, 'mfa_factor', 'a0000000-0000-4000-8000-0000000000a3', 1,
         'a0000000-0000-4000-8000-0000000000c1', '{}'::jsonb),
       ('a0000000-0000-4000-8000-000000000004', 'cms.schema.activated.v1', 1, 'cms_schema', 'a0000000-0000-4000-8000-0000000000a4', 1,
         'a0000000-0000-4000-8000-0000000000c1', '{}'::jsonb);
create temp table g1_claim on commit drop as
select * from platform_api.claim_outbox_batch('b0000000-0000-4000-8000-000000000001', 60, 100);
select ok((select count(*) from g1_claim where event_type = 'job.requested' and aggregate_type = 'job') = 1,
  'the job.requested job tuple is still claimed [P2-S09-AC-913]');
select ok((select count(*) from g1_claim where event_type = 'identity.mfa-factor.changed.v1' and aggregate_type = 'mfa_factor' and schema_version = 1) > 0,
  'identity.mfa-factor.changed.v1 on a mfa_factor aggregate is claimed [P2-S09-AC-913]');
select ok((select count(*) from g1_claim where event_type = 'identity.security-notification.requested.v1' and aggregate_type = 'security_event' and schema_version = 1) > 0,
  'identity.security-notification.requested.v1 on a security_event aggregate is claimed [P2-S09-AC-916]');
select ok((select count(*) from g1_claim where event_type = 'cms.capability.grant.changed.v1' and aggregate_type = 'cms_capability_grant' and schema_version = 1) > 0,
  'cms.capability.grant.changed.v1 on a cms_capability_grant aggregate is claimed [P2-S09-AC-689]');
select is((select count(*)::integer from g1_claim where event_id in ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003',
      'a0000000-0000-4000-8000-000000000004')), 0,
  'a wrong aggregate type, a wrong schema version and an unlisted event are never claimed [P2-S09-AC-913]');
select is((select string_agg(distinct column_name, ',' order by column_name) from information_schema.columns
            where table_schema = 'platform_api' and table_name = 'claim_outbox_batch'), null,
  'precondition: claim_outbox_batch is a function, not a relation');
select is((select array_agg(a order by a) from (select unnest(proargnames) a from pg_proc where oid = 'platform_private.claim_outbox_batch(uuid,integer,integer)'::regprocedure) x where a is not null and a not like 'p\_%'),
  array['aggregate_id', 'aggregate_type', 'aggregate_version', 'causation_id', 'correlation_id', 'dispatch_attempt_count', 'event_id', 'event_type', 'lease_token', 'occurred_at', 'producer', 'schema_version'],
  'the returned column list is the identifier columns plus occurred_at and the registered producer (AC190) [P2-S09-AC-913]');
select is((select string_agg(distinct event_type || '=' || coalesce(producer, 'NULL'), ',' order by event_type || '=' || coalesce(producer, 'NULL'))
             from g1_claim where event_type <> 'job.requested'),
  'cms.capability.grant.changed.v1=cms.schema_registry,identity.mfa-factor.changed.v1=identity.authority,identity.security-notification.requested.v1=identity.authority',
  'each claimed consumer event carries its registered producer [P2-S09-AC-190]');
select is((select count(*)::integer from g1_claim where producer is null or occurred_at is null), 0,
  'every claimed row carries a producer and the outbox occurred_at [P2-S09-AC-190]');
select is((select count(*)::integer from g1_claim c join platform_private.outbox_events e on e.id = c.event_id where c.occurred_at is distinct from e.occurred_at), 0,
  'the claimed occurred_at is the outbox row instant, not the claim time [P2-S09-AC-190]');

select * from finish();
rollback;
