\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-111 QA-RED (BE05b CFG-05B-06 / BE01a "Administrative factor
-- reset"), the reservation transaction (grant, membership and no-live-reset predicate, then identity.rpc_admin_reset_mfa_factors), idempotency and the live-reset guard.
-- Split by concern from one 430-line file so no test file
-- exceeds the 400-line depth-audit limit: the shared fixture is
-- phase_02_slice_09_dec111/01-admin-reset-fixture.sqlinc; the sibling suites are
-- phase_02_slice_09_dec111_admin_mfa_reset{,_reservation,_settlement}.sql.

\ir phase_02_slice_09_dec111/00-support.sqlinc
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec111/01-admin-reset-fixture.sqlinc

-- ---- reservation ------------------------------------------------------------------
-- The target also holds a step-up capability: the reset is not subject to last_factor_required.
select is(pg_temp.s09d_grant_via_rpc('rev1', 'cms.schema_designer', 3), 'OK',
  'fixture: the target holds cms.schema_designer through the real owner grant command (CMS-03A-15)');
-- AC896 baseline: the target's linked email login method and a second linked
-- provider (provisioning fixture rows of the login-methods domain, not S09
-- producer rows), plus every session and proof-bearing column, are snapshotted
-- so the reset can be shown to change none of them.
insert into identity.login_identity_registry(auth_user_id, provider, provider_subject_digest, state, label, verified_at, linked_at)
values (pg_temp.m_uid(13), 'email', decode(repeat('d1', 32), 'hex'), 'linked', 'Email', clock_timestamp(), clock_timestamp()),
       (pg_temp.m_uid(13), 'google', decode(repeat('d2', 32), 'hex'), 'linked', 'Google', clock_timestamp(), clock_timestamp());
create temp table m_login_before on commit drop as
select (select md5(coalesce(string_agg(t::text, ',' order by id), '')) from identity.login_identity_registry t where auth_user_id = pg_temp.m_uid(13)) as methods,
       platform_private.auth_login_methods_projection(pg_temp.m_uid(13)) as projection,
       (select md5(coalesce(string_agg(t::text, ',' order by session_id), '')) from identity.auth_session_index t where auth_user_id = pg_temp.m_uid(13)) as sessions,
       (select md5(to_jsonb(b)::text) from (select id, auth_user_id, person_id, state, created_at from identity.auth_user_bindings where auth_user_id = pg_temp.m_uid(13)) b) as binding,
       (select md5(coalesce(string_agg(t::text, ',' order by id), '')) from platform_private.acting_context_binding t
         where person_id = pg_temp.m_person(13)) as acting_bindings;
select is((select projection->>'recoveryBaselinePresent' from m_login_before), 'true', 'fixture: the target has a recovery baseline (a linked, verified email method) before the reset [P2-S09-AC-896]');
select pg_temp.m_reset('r:ok', 'designer2', 'rev1', 'reset-key-ac945-0100', 'lost every verified factor');
select is(pg_temp.m_out('r:ok'), 'OK', 'the reset is reserved');
select is(pg_temp.m_resp('r:ok')->>'state', 'reconciling', 'with live factors the reset is reconciling until the provider confirms');
select is(pg_temp.m_resp('r:ok')->>'removedFactorCount', '0', 'nothing is confirmed removed yet');
select is(pg_temp.m_resp('r:ok')->>'targetPersonId', pg_temp.s09d_actor_id('rev1', 'person'), 'the response names the target person');
select is(pg_temp.m_resp('r:ok')->>'targetAuthUserId', pg_temp.m_uid(13)::text, 'and the Worker-only target Auth UUID');
select is((select array_agg(x order by x) from jsonb_array_elements_text(pg_temp.m_resp('r:ok')->'pendingProviderFactorIds') x),
  (select array_agg(p::text order by p::text) from (values (pg_temp.m_pid_named(13, 'V1')), (pg_temp.m_pid_named(13, 'V2')),
    (pg_temp.m_pid_named(13, 'Gone')), (pg_temp.m_pid_named(13, 'Pend'))) v(p)),
  'exactly the four live factors (verified, verified, reconciling, pending) await provider removal');
select ok(pg_temp.m_resp('r:ok')->>'resetId' ~ '^[0-9a-f-]{36}$' and pg_temp.m_resp('r:ok')->>'outboxEventId' ~ '^[0-9a-f-]{36}$'
    and pg_temp.m_resp('r:ok')->>'mfaVersion' = pg_temp.m_ver(13), 'the response carries resetId, outboxEventId and the current mfaVersion');
select is(pg_temp.m_ver(13)::bigint, (select v13 + 1 from m_pre), 'mfa_version advances once in the reservation transaction [P2-S09-AC-893]');
select is(pg_temp.m_one(format($q$select count(*)::text from identity.mfa_factor_registry where auth_user_id = %L and state = 'reconciling'$q$, pg_temp.m_uid(13)))::integer, 4,
  'every live factor is now reconciling [P2-S09-AC-893]');
select is(pg_temp.m_fstate(pg_temp.m_fid_named(13, 'Old')), 'removed', 'an already removed factor is untouched [P2-S09-AC-893]');
select is(pg_temp.m_fstate(pg_temp.m_fid_named(13, 'Stale')), 'expired', 'an already expired factor is untouched [P2-S09-AC-893]');
select is(pg_temp.m_one(format($q$select count(*)::text from identity.step_up_challenges where auth_user_id = %L and state = 'pending'$q$, pg_temp.m_uid(13)))::integer, 0,
  'the target''s pending step-up challenges are expired [P2-S09-AC-893]');
select is((select state::text from identity.auth_session_index where session_id = pg_temp.m_sid(13)), 'active', 'the reset changes no session [P2-S09-AC-896]');
select is(pg_temp.m_one(format($q$select count(*)::text from platform_private.admin_mfa_factor_resets where state = 'reconciling' and completed_at is null and grant_id = %L and operator_person_id = %L and target_person_id = %L$q$,
  pg_temp.s09d_id('opGrant'), pg_temp.s09d_actor_id('designer2', 'person'), pg_temp.s09d_actor_id('rev1', 'person')))::integer, 1,
  'one reconciling reset row names the operator, target and the grant it relied on [P2-S09-AC-931]');
select is(pg_temp.m_events(13, 'mfa.factors.reset'), 1, 'one security event on the target''s account [P2-S09-AC-893]');
select is(pg_temp.m_one(format($q$select reason_code from identity.security_events where action = 'mfa.factors.reset' and actor_auth_user_id = %L$q$, pg_temp.m_uid(13))), 'MFA_FACTORS_RESET',
  'with the generic factors-reset reason (the safe notification template) [P2-S09-AC-895]');
select is(pg_temp.m_one(format($q$select count(*)::text from audit_private.audit_events where action = 'identity.mfa.factors.reset' and actor_id = %L$q$, pg_temp.m_uid(12)))::integer, 1,
  'one BE00 audit row attributed to the operator [P2-S09-AC-931]');
select is((select count(distinct c)::integer from (
    select correlation_id c from audit_private.audit_events where action = 'identity.mfa.factors.reset' and actor_id = pg_temp.m_uid(12)
    union all select correlation_id from identity.security_events where action = 'mfa.factors.reset' and actor_auth_user_id = pg_temp.m_uid(13)
    union all select correlation_id from platform_private.outbox_events where id = (pg_temp.m_resp('r:ok')->>'outboxEventId')::uuid) t), 1,
  'the audit row, the security evidence and the reset event share one correlation id [P2-S09-AC-931]');
select is((select count(*)::integer from platform_private.outbox_events where event_type = 'admin.mfa-factor.reset.v1'
            and id = (pg_temp.m_resp('r:ok')->>'outboxEventId')::uuid and payload = jsonb_build_object(
              'resetId', pg_temp.m_resp('r:ok')->>'resetId', 'targetPersonId', pg_temp.s09d_actor_id('rev1', 'person'))), 1,
  'the outbox row carries resetId and targetPersonId only [P2-S09-AC-931] [P2-S09-AC-947]');
select is((select count(*)::integer from platform_private.outbox_events where event_type = 'identity.security-notification.requested.v1'
            and payload->>'securityEventId' in (select id::text from identity.security_events where action = 'mfa.factors.reset')), 1,
  'the target''s security-notification request references the security event only [P2-S09-AC-895] [P2-S09-AC-931]');
-- AC895 "safeTemplateCode mfa_factors_reset": the notifier's delivery command maps the reset's generic reason to exactly that
-- template.  The in-app recorder is the database half of that mapping: for the target's real factors-reset security event it
-- accepts the code mfa_factors_reset, records it against the account holder, and refuses the other two codes for that event.
create temp table m_reset_notice on commit drop as
select e.id as event_id, e.request_id
  from identity.security_events e
 where e.action = 'mfa.factors.reset' and e.actor_auth_user_id = pg_temp.m_uid(13);
create function pg_temp.m_reset_notice_request(p_code text) returns jsonb language sql stable as $body$
  select jsonb_build_object('notificationId', (select event_id from m_reset_notice),
    'eventType', 'identity.security-notification.requested.v1', 'recipientClass', 'account_holder',
    'operationId', (select request_id from m_reset_notice), 'safeTemplateCode', p_code, 'requestId', extensions.gen_random_uuid())
$body$;
select is(platform_api.in_app_notification_record(pg_temp.m_reset_notice_request('mfa_factors_reset'))->>'deliveryState', 'recorded',
  'the target''s factors-reset security event is delivered with the safe template code mfa_factors_reset [P2-S09-AC-895]');
select is((select safe_template_code || '|' || recipient_class || '|' || (recipient_auth_user_id = pg_temp.m_uid(13))::text
             from identity.in_app_notification_intents where notification_id = (select event_id from m_reset_notice)),
  'mfa_factors_reset|account_holder|true', 'the recorded template is mfa_factors_reset and the recipient is the target account holder [P2-S09-AC-895]');
select throws_ok($$select platform_api.in_app_notification_record(pg_temp.m_reset_notice_request('mfa_factor_added'))$$,
  'P0001', 'INVALID_REQUEST', 'the factor-added template is refused for a factors-reset event: the template follows the event reason [P2-S09-AC-895]');
select throws_ok($$select platform_api.in_app_notification_record(pg_temp.m_reset_notice_request('mfa_factor_removed'))$$,
  'P0001', 'INVALID_REQUEST', 'and so is the factor-removed template [P2-S09-AC-895]');
select ok(not exists (select 1 from platform_private.outbox_events where event_type like 'admin.mfa-factor.reset%' and payload::text ~* '(factor|provider|secret|reason|code)Id?'
    and payload::text !~ '^\{"resetId"'), 'no event carries a factor identifier [P2-S09-AC-947]');
select ok((select state::text from identity.auth_user_bindings where auth_user_id = pg_temp.m_uid(13)) = 'active', 'the account state is unchanged [P2-S09-AC-896]');
select is((select md5(coalesce(string_agg(t::text, ',' order by id), '')) from identity.login_identity_registry t where auth_user_id = pg_temp.m_uid(13)),
  (select methods from m_login_before), 'the reset changed no login method row [P2-S09-AC-896]');
select is(platform_private.auth_login_methods_projection(pg_temp.m_uid(13)) - 'version', (select projection - 'version' from m_login_before),
  'the login-methods projection, recoveryBaselinePresent and removable included, is unchanged by the reset [P2-S09-AC-896]');
select is((select md5(coalesce(string_agg(t::text, ',' order by session_id), '')) from identity.auth_session_index t where auth_user_id = pg_temp.m_uid(13)),
  (select sessions from m_login_before), 'every session row of the target is byte-identical after the reset [P2-S09-AC-896]');
select is((select md5(to_jsonb(b)::text) from (select id, auth_user_id, person_id, state, created_at from identity.auth_user_bindings where auth_user_id = pg_temp.m_uid(13)) b),
  (select binding from m_login_before), 'the account binding changed nothing but mfa_version [P2-S09-AC-896]');
select is((select md5(coalesce(string_agg(t::text, ',' order by id), '')) from platform_private.acting_context_binding t where person_id = pg_temp.m_person(13)),
  (select acting_bindings from m_login_before),
  'the target''s acting-context bindings, which carry the recorded MFA instants whose own freshness window governs every existing proof, are untouched, so existing proofs lapse at their own freshUntil [P2-S09-AC-896]');

-- idempotency and the live-reset guard
select pg_temp.m_reset('r:replay', 'designer2', 'rev1', 'reset-key-ac945-0100', 'lost every verified factor');
select is(pg_temp.m_out('r:replay'), 'OK', 'the same key and request replays [P2-S09-AC-930]');
select is(pg_temp.m_resp('r:replay')->>'resetId', pg_temp.m_resp('r:ok')->>'resetId', 'to the same reset');
select is(pg_temp.m_resp('r:replay') - 'pendingProviderFactorIds', pg_temp.m_resp('r:ok') - 'pendingProviderFactorIds' - 'targetAuthUserId',
  'the replay returns the first response: the same reset view member for member (only the Worker-internal hand-off members, the provider ids to remove and the target auth user, are not repeated) [P2-S09-AC-930]');
select is((select string_agg(k, ',' order by k) from jsonb_object_keys(pg_temp.m_resp('r:replay') - 'pendingProviderFactorIds') k),
  'mfaVersion,outboxEventId,removedFactorCount,resetId,state,targetPersonId',
  'and the replayed view carries exactly the six public members, no factor or provider identifier [P2-S09-AC-930]');
select is(jsonb_array_length(pg_temp.m_resp('r:replay')->'pendingProviderFactorIds'), 0, 'a replay never asks the Worker to resend a provider removal');
select is(pg_temp.m_one('select count(*)::text from platform_private.admin_mfa_factor_resets')::integer, 1, 'and creates no second row');
select pg_temp.m_reset('r:conflict', 'designer2', 'rev1', 'reset-key-ac945-0100', 'a different reason');
select is(pg_temp.m_out('r:conflict'), 'IDEMPOTENCY_CONFLICT', 'the same key with a changed body is IDEMPOTENCY_CONFLICT [P2-S09-AC-930] [P2-S09-AC-940]');
select pg_temp.m_reset('r:inflight', 'designer2', 'rev1', 'reset-key-ac945-0101');
select is(pg_temp.m_out('r:inflight'), 'MFA_RESET_IN_PROGRESS', 'a second reset for a target with a reconciling reset is 409 MFA_RESET_IN_PROGRESS [P2-S09-AC-929] [P2-S09-AC-941]');

select * from finish();

rollback;
