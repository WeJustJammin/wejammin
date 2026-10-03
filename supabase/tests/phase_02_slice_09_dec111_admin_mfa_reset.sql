commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-111 QA-RED (BE05b CFG-05B-06 / BE01a "Administrative factor
-- reset"): platform_private.admin_mfa_factor_resets, the reservation
-- transaction (grant, membership and no-live-reset predicate, then
-- identity.rpc_admin_reset_mfa_factors) and the settlement transaction that
-- records the operator-only provider adapter outcomes.

\ir phase_02_slice_09_dec111/00-support.sqlinc
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc

-- Aliases: 11 owner, 12 designer2 (operator), 13 rev1 (target), 14 rev2
-- (second target), 15 rev3 (non-member), 16 other.
insert into m_alias values
  (11, pg_temp.s09d_actor_id('owner', 'auth')::uuid), (12, pg_temp.s09d_actor_id('designer2', 'auth')::uuid),
  (13, pg_temp.s09d_actor_id('rev1', 'auth')::uuid), (14, pg_temp.s09d_actor_id('rev2', 'auth')::uuid),
  (15, pg_temp.s09d_actor_id('rev3', 'auth')::uuid), (16, pg_temp.s09d_actor_id('other', 'auth')::uuid);
select pg_temp.m_session(n) from generate_series(11, 16) n;

create or replace function pg_temp.m_member(p_actor text) returns void language plpgsql as $body$
begin
  insert into identity_private.membership_tenure(organization_id, person_id, state, provenance, governance_mode,
    starts_on, accepted_at, actor_id, version)
  select pg_temp.s09d_id('ownerOrg'), member.person_id, 'confirmed', 'invitation', 'ungoverned', current_date,
         clock_timestamp(), owner.person_id, 1
  from s09d_actor member, s09d_actor owner where member.key = p_actor and owner.key = 'owner';
end;
$body$;
select pg_temp.m_member('rev1');
select pg_temp.m_member('rev2');

-- The operator's CFG-11 grant: named capability, action reset, on the organization.
create or replace function pg_temp.m_grant(p_actor text, p_org uuid, p_actions text[] default array['reset'],
  p_state text default 'active', p_ends interval default interval '1 day') returns uuid language plpgsql as $body$
declare gid uuid := extensions.gen_random_uuid();
begin
  insert into platform_private.admin_capability_grants(id, subject_person_id, capability_key, resource_type, resource_id,
    scope, actions, starts_at, ends_at, grantor_person_id, reason, purpose_grant, state, version_no)
  values (gid, pg_temp.s09d_actor_id(p_actor, 'person')::uuid, 'admin.identity.mfa_reset', 'organization', p_org,
    jsonb_build_object('actingPartyId', p_org), p_actions, clock_timestamp() - interval '2 hours',
    clock_timestamp() + p_ends, pg_temp.s09d_actor_id('owner', 'person')::uuid, 'dec111 test', false, p_state, 1);
  return gid;
end;
$body$;
select pg_temp.s09d_remember('opGrant', pg_temp.m_grant('designer2', pg_temp.s09d_id('ownerOrg')));

-- Calls through the DEC-108 service-role envelope, then mirrors the probe row
-- into m_probe so the m_out/m_resp assertions read it.
create or replace function pg_temp.m_sync(p_label text) returns void language sql as $body$
  insert into m_probe select label, state, message, response from s09d_probe where label = p_label
  on conflict (label) do update
    set state = excluded.state, message = excluded.message, response = excluded.response $body$;
create or replace function pg_temp.m_reset(p_label text, p_actor text, p_target text, p_key text default 'reset-key-ac945-0001',
  p_reason text default 'lost every factor', p_override jsonb default '{}'::jsonb, p_extra jsonb default '{}'::jsonb)
returns jsonb language plpgsql as $body$
declare result jsonb;
begin
  result := pg_temp.s09d_rpc(p_label, 'platform_api.admin_mfa_factor_reset', p_actor,
    jsonb_build_object('targetPersonId', coalesce(pg_temp.s09d_actor_id(p_target, 'person'), p_target),
      'reason', p_reason, 'idempotencyKey', p_key) || p_extra, true, p_override);
  perform pg_temp.m_sync(p_label);
  return result;
end;
$body$;
create or replace function pg_temp.m_settle_reset(p_label text, p_actor text, p_reset text, p_outcomes jsonb,
  p_override jsonb default '{}'::jsonb) returns jsonb language plpgsql as $body$
declare result jsonb;
begin
  result := pg_temp.s09d_rpc(p_label, 'platform_api.admin_mfa_factor_reset_settle', p_actor,
    jsonb_build_object('resetId', p_reset, 'outcomes', p_outcomes), true, p_override);
  perform pg_temp.m_sync(p_label);
  return result;
end;
$body$;
create or replace function pg_temp.m_fid_named(p_n integer, p_name text) returns uuid language sql as $body$
  select pg_temp.m_one(format('select id::text from identity.mfa_factor_registry where auth_user_id = %L and friendly_name = %L', pg_temp.m_uid(p_n), p_name))::uuid $body$;
create or replace function pg_temp.m_pid_named(p_n integer, p_name text) returns uuid language sql as $body$
  select pg_temp.m_one(format('select provider_factor_id::text from identity.mfa_factor_registry where auth_user_id = %L and friendly_name = %L', pg_temp.m_uid(p_n), p_name))::uuid $body$;

-- Target fixture (rev1): two verified, one reconciling, one pending, plus an
-- expired and a removed factor that must stay untouched.
select pg_temp.m_enroll(13, 'V1');
select pg_temp.m_enroll(13, 'V2');
select pg_temp.m_enroll(13, 'Old');
select pg_temp.m('fx:rmb', 'auth_mfa_removal_begin', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(13),
  'p_factor_id', pg_temp.m_fid_named(13, 'Old'), 'p_reason', 'user_request', 'p_expected_version', pg_temp.m_ver(13),
  'p_session_id', pg_temp.m_sid(13), 'p_key_hash', '\x' || repeat('c1', 32), 'p_request_hash', '\x' || repeat('c2', 32)));
select pg_temp.m('fx:rmf', 'auth_mfa_removal_finish', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(13),
  'p_factor_id', pg_temp.m_fid_named(13, 'Old'), 'p_reason', 'user_request', 'p_session_id', pg_temp.m_sid(13),
  'p_key_hash', '\x' || repeat('c1', 32)));
select pg_temp.m_pending(13, 'Gone');
select pg_temp.m('fx:gone', 'auth_mfa_factor_mark_reconciling', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(13),
  'p_factor_id', pg_temp.m_fid_named(13, 'Gone')));
select pg_temp.m_pending(13, 'Stale');
select pg_temp.m_begin('fx:supersede', 13, 'Pend');
select pg_temp.m_finish('fx:pend', 13, 'Pend', pg_temp.m_resp('fx:supersede')->>'version');
select pg_temp.m('fx:cb', 'auth_step_up_challenge_begin', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(13),
  'p_session_id', pg_temp.m_sid(13), 'p_method', 'totp', 'p_factor_id', pg_temp.m_fid_named(13, 'V1')));
select pg_temp.m('fx:cf', 'auth_step_up_challenge_finish', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(13),
  'p_session_id', pg_temp.m_sid(13), 'p_factor_id', pg_temp.m_fid_named(13, 'V1'),
  'p_provider_challenge_id', extensions.gen_random_uuid(), 'p_expires_at', clock_timestamp() + interval '5 minutes'));
select is(pg_temp.m_out('fx:cf'), 'OK', 'fixture: a live step-up challenge exists for the target');
select pg_temp.m_enroll(14, 'Z1');
create temp table m_pre on commit drop as select pg_temp.m_ver(13)::bigint v13, pg_temp.m_ver(14)::bigint v14;

-- ---- table surface -------------------------------------------------------------
select has_table('platform_private', 'admin_mfa_factor_resets', 'platform_private.admin_mfa_factor_resets exists');
select ok(coalesce((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('platform_private.admin_mfa_factor_resets')), false),
  'the reset record forces row level security [P2-S09-AC-946]');
select ok(to_regclass('platform_private.admin_mfa_factor_resets') is not null and not exists (
    select 1 from unnest(array['anon', 'authenticated', 'service_role']) r, unnest(array['select', 'insert', 'update', 'delete']) p
     where has_table_privilege(r, 'platform_private.admin_mfa_factor_resets', p)),
  'the reset record has no direct grant for any API role [P2-S09-AC-946]');
select ok(exists (select 1 from pg_constraint where conrelid = to_regclass('platform_private.admin_mfa_factor_resets')
    and contype = 'c' and pg_get_constraintdef(oid) like '%operator_person_id%<>%target_person_id%'), 'operator_person_id <> target_person_id');
select ok(exists (select 1 from pg_constraint where conrelid = to_regclass('platform_private.admin_mfa_factor_resets')
    and contype = 'f' and pg_get_constraintdef(oid) like '%admin_capability_grants%'), 'grant_id references the capability grant');
select ok(exists (select 1 from pg_indexes where schemaname = 'platform_private' and tablename = 'admin_mfa_factor_resets'
    and indexdef ilike '%unique%(target_person_id)%reconciling%'), 'one live reconciling reset per target (partial unique index) [P2-S09-AC-929]');
select ok(exists (select 1 from pg_constraint where conrelid = to_regclass('platform_private.admin_mfa_factor_resets')
    and contype = 'u' and pg_get_constraintdef(oid) like '%operator_person_id%idempotency_key%'), 'UNIQUE(operator_person_id, idempotency_key) [P2-S09-AC-930]');

-- ---- request validation and authority ------------------------------------------
select pg_temp.m_reset('r:key', 'designer2', 'rev1', 'reset-key-ac945-0001', 'x', '{}', jsonb_build_object('unknown', true));
select is(pg_temp.m_out('r:key'), 'INVALID_REQUEST', 'an unknown request key is INVALID_REQUEST [P2-S09-AC-935] [P2-S09-AC-942]');
-- CFG-05B-06 without any verified actor session is 401 UNAUTHENTICATED (no session GUC, no envelope).
select set_config(k, '', true) from unnest(array['app.auth_user_id', 'app.actor_auth_user_id', 'app.actor_person_id', 'app.acting_party_id', 'app.acting_context_id', 'request.jwt.claim.sub']) k;
select pg_temp.s09d_call('r:unauth', 'platform_api.admin_mfa_factor_reset',
  jsonb_build_object('targetPersonId', pg_temp.s09d_actor_id('rev1', 'person'), 'reason', 'lost every factor',
    'idempotencyKey', 'reset-key-ac936-0001', 'context', '{}'::jsonb));
select pg_temp.m_sync('r:unauth');
select is(pg_temp.m_out('r:unauth'), 'UNAUTHENTICATED', 'a request without a verified actor session is 401 UNAUTHENTICATED [P2-S09-AC-936]');
select pg_temp.m_reset('r:reason0', 'designer2', 'rev1', 'reset-key-ac945-0002', '   ');
select is(pg_temp.m_out('r:reason0'), 'INVALID_REQUEST', 'a blank reason is INVALID_REQUEST [P2-S09-AC-935] [P2-S09-AC-942]');
select pg_temp.m_reset('r:reason513', 'designer2', 'rev1', 'reset-key-ac945-0003', repeat('x', 513));
select is(pg_temp.m_out('r:reason513'), 'INVALID_REQUEST', 'a 513-character reason is INVALID_REQUEST [P2-S09-AC-935] [P2-S09-AC-942]');
select pg_temp.m_reset('r:uuid', 'designer2', 'not-a-uuid', 'reset-key-ac945-0004');
select is(pg_temp.m_out('r:uuid'), 'INVALID_REQUEST', 'a malformed target is INVALID_REQUEST [P2-S09-AC-935] [P2-S09-AC-942]');
select pg_temp.m_reset('r:idem', 'designer2', 'rev1', 'short');
select is(pg_temp.m_out('r:idem'), 'INVALID_REQUEST', 'a short idempotency key is INVALID_REQUEST [P2-S09-AC-935] [P2-S09-AC-942]');
select pg_temp.m_reset('r:stepup', 'designer2', 'rev1', 'reset-key-ac945-0005', 'lost', jsonb_build_object('stepUpAt', clock_timestamp() - interval '11 minutes'));
select is(pg_temp.m_out('r:stepup'), 'STEP_UP_REQUIRED', 'a stale step-up is 401 STEP_UP_REQUIRED [P2-S09-AC-937]');
select pg_temp.m_reset('r:nostepup', 'designer2', 'rev1', 'reset-key-ac945-0006', 'lost', jsonb_build_object('stepUpVerified', false));
select is(pg_temp.m_out('r:nostepup'), 'STEP_UP_REQUIRED', 'an absent step-up is 401 STEP_UP_REQUIRED [P2-S09-AC-937]');
select pg_temp.m_reset('r:nocap', 'owner', 'rev1', 'reset-key-ac945-0007');
select is(pg_temp.m_out('r:nocap'), 'FORBIDDEN', 'an operator without the named capability is 403 [P2-S09-AC-938] [P2-S09-AC-926]');
select pg_temp.s09d_remember('otherGrant', pg_temp.m_grant('other', pg_temp.s09d_id('otherOrg')));
select pg_temp.m_reset('r:othercap', 'other', 'rev1', 'reset-key-ac945-0008');
select is(pg_temp.m_out('r:othercap'), 'TARGET_NOT_FOUND', 'an operator of another organization cannot see the target (404) [P2-S09-AC-927] [P2-S09-AC-939]');
select pg_temp.m_reset('r:self', 'designer2', 'designer2', 'reset-key-ac945-0009');
select is(pg_temp.m_out('r:self'), 'MFA_RESET_INVALID', 'self-target is 422 MFA_RESET_INVALID [P2-S09-AC-897] [P2-S09-AC-942]');
select pg_temp.m_reset('r:nonmember', 'designer2', 'rev3', 'reset-key-ac945-0010');
select is(pg_temp.m_out('r:nonmember'), 'TARGET_NOT_FOUND', 'a person outside the organization is an indistinguishable 404 [P2-S09-AC-927] [P2-S09-AC-939]');
select pg_temp.m_reset('r:unknown', 'designer2', extensions.gen_random_uuid()::text, 'reset-key-ac945-0011');
select is(pg_temp.m_out('r:unknown'), 'TARGET_NOT_FOUND', 'an unknown person is the same 404 [P2-S09-AC-939]');
select pg_temp.m_warp('platform_private.admin_capability_grants', $$actions = array['read']$$, format('id = %L', pg_temp.s09d_id('opGrant')));
select pg_temp.m_reset('r:action', 'designer2', 'rev1', 'reset-key-ac945-0012');
select is(pg_temp.m_out('r:action'), 'FORBIDDEN', 'a grant without the reset action is 403 [P2-S09-AC-946] [P2-S09-AC-938] [P2-S09-AC-926]');
select pg_temp.m_warp('platform_private.admin_capability_grants',
  format($$actions = array['reset'], state = 'revoked', revoked_at = clock_timestamp(), revoked_by = %L$$, pg_temp.s09d_actor_id('owner', 'person')),
  format('id = %L', pg_temp.s09d_id('opGrant')));
select pg_temp.m_reset('r:revoked', 'designer2', 'rev1', 'reset-key-ac945-0013');
select is(pg_temp.m_out('r:revoked'), 'FORBIDDEN', 'a revoked grant is 403 [P2-S09-AC-946] [P2-S09-AC-938] [P2-S09-AC-926]');
select pg_temp.m_warp('platform_private.admin_capability_grants',
  $$state = 'active', revoked_at = null, revoked_by = null, ends_at = clock_timestamp() - interval '1 minute'$$,
  format('id = %L', pg_temp.s09d_id('opGrant')));
select pg_temp.m_reset('r:expired', 'designer2', 'rev1', 'reset-key-ac945-0014');
select is(pg_temp.m_out('r:expired'), 'FORBIDDEN', 'an expired grant is 403 [P2-S09-AC-946] [P2-S09-AC-938] [P2-S09-AC-926]');
select pg_temp.m_warp('platform_private.admin_capability_grants', $$ends_at = clock_timestamp() + interval '1 day'$$, format('id = %L', pg_temp.s09d_id('opGrant')));
update auth.users set banned_until = clock_timestamp() + interval '1 year' where id = pg_temp.m_uid(13);
select pg_temp.m_reset('r:banned', 'designer2', 'rev1', 'reset-key-ac945-0015');
select is(pg_temp.m_out('r:banned'), 'TARGET_NOT_FOUND', 'a banned target is the same 404 [P2-S09-AC-927]');
update auth.users set banned_until = null where id = pg_temp.m_uid(13);
update identity_private.membership_tenure set starts_on = current_date - 10, ends_on = current_date - 1
 where person_id = pg_temp.s09d_actor_id('rev1', 'person')::uuid and organization_id = pg_temp.s09d_id('ownerOrg');
select pg_temp.m_reset('r:ended', 'designer2', 'rev1', 'reset-key-ac945-0016');
select is(pg_temp.m_out('r:ended'), 'TARGET_NOT_FOUND', 'an ended membership is the same 404 [P2-S09-AC-927]');
update identity_private.membership_tenure set ends_on = null
 where person_id = pg_temp.s09d_actor_id('rev1', 'person')::uuid and organization_id = pg_temp.s09d_id('ownerOrg');
select is(pg_temp.m_one('select count(*)::text from platform_private.admin_mfa_factor_resets')::integer, 0, 'every refusal wrote no reset record');
select is(pg_temp.m_ver(13)::bigint, (select v13 from m_pre), 'and changed no MFA version');

-- ---- reservation ------------------------------------------------------------------
-- The target also holds a step-up capability: the reset is not subject to last_factor_required.
insert into identity_private.organization_actor_grant(organization_id, person_id, capability_code, valid_from, valid_through, active)
values (pg_temp.s09d_id('ownerOrg'), pg_temp.s09d_actor_id('rev1', 'person')::uuid, 'cms.schema_designer', current_date, current_date + 3, true);
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
select is(jsonb_array_length(pg_temp.m_resp('r:replay')->'pendingProviderFactorIds'), 0, 'a replay never asks the Worker to resend a provider removal');
select is(pg_temp.m_one('select count(*)::text from platform_private.admin_mfa_factor_resets')::integer, 1, 'and creates no second row');
select pg_temp.m_reset('r:conflict', 'designer2', 'rev1', 'reset-key-ac945-0100', 'a different reason');
select is(pg_temp.m_out('r:conflict'), 'IDEMPOTENCY_CONFLICT', 'the same key with a changed body is IDEMPOTENCY_CONFLICT [P2-S09-AC-930] [P2-S09-AC-940]');
select pg_temp.m_reset('r:inflight', 'designer2', 'rev1', 'reset-key-ac945-0101');
select is(pg_temp.m_out('r:inflight'), 'MFA_RESET_IN_PROGRESS', 'a second reset for a target with a reconciling reset is 409 MFA_RESET_IN_PROGRESS [P2-S09-AC-929] [P2-S09-AC-941]');

-- ---- settlement ---------------------------------------------------------------------
create temp table m_reset_id on commit drop as select pg_temp.m_resp('r:ok')->>'resetId' id;
select pg_temp.m_settle_reset('s:op', 'owner', (select id from m_reset_id), '[]'::jsonb);
select is(pg_temp.m_out('s:op'), 'FORBIDDEN', 'only the operator who reserved the reset may settle it');
select pg_temp.m_settle_reset('s:unknown', 'designer2', extensions.gen_random_uuid()::text, '[]'::jsonb);
select is(pg_temp.m_out('s:unknown'), 'TARGET_NOT_FOUND', 'an unknown reset id is 404');
select pg_temp.m_settle_reset('s:badprov', 'designer2', (select id from m_reset_id),
  jsonb_build_array(jsonb_build_object('providerFactorId', extensions.gen_random_uuid(), 'outcome', 'removed')));
select is(pg_temp.m_out('s:badprov'), 'INVALID_REQUEST', 'an outcome for a provider factor the reset did not move is INVALID_REQUEST');
select pg_temp.m_settle_reset('s:badout', 'designer2', (select id from m_reset_id),
  jsonb_build_array(jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'V1'), 'outcome', 'maybe')));
select is(pg_temp.m_out('s:badout'), 'INVALID_REQUEST', 'an unknown outcome value is INVALID_REQUEST');
create temp table m_v_res on commit drop as select pg_temp.m_ver(13)::bigint v;
create temp table m_ev_before on commit drop as
  select pg_temp.m_outbox('identity.mfa-factor.changed.v1', pg_temp.m_fid_named(13, 'Pend')) as pend,
         pg_temp.m_outbox('identity.mfa-factor.changed.v1', pg_temp.m_fid_named(13, 'V1')) as removed;
select pg_temp.m_settle_reset('s:partial', 'designer2', (select id from m_reset_id), jsonb_build_array(
  jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'V1'), 'outcome', 'removed'),
  jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'V2'), 'outcome', 'absent'),
  jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'Gone'), 'outcome', 'removed'),
  jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'Pend'), 'outcome', 'failed')));
select is(pg_temp.m_out('s:partial'), 'OK', 'a partial provider result settles [P2-S09-AC-933]');
select is(pg_temp.m_resp('s:partial')->>'state', 'reconciling', 'any failed factor leaves the reset reconciling (202) and never rolls back the committed first transaction [P2-S09-AC-933]');
select is(pg_temp.m_resp('s:partial')->>'removedFactorCount', '3', 'removed and absent factors count as removed');
select is(pg_temp.m_fstate(pg_temp.m_fid_named(13, 'V1')) || pg_temp.m_fstate(pg_temp.m_fid_named(13, 'V2')) || pg_temp.m_fstate(pg_temp.m_fid_named(13, 'Gone')),
  'removedremovedremoved', 'confirmed factors are removed in the committed first transaction [P2-S09-AC-933]');
select is(pg_temp.m_fstate(pg_temp.m_fid_named(13, 'Pend')), 'reconciling', 'a failed factor stays reconciling for the reconciler (no rollback, no blind resend) [P2-S09-AC-933]');
select is(pg_temp.m_outbox('identity.mfa-factor.changed.v1', pg_temp.m_fid_named(13, 'Pend')),
  (select pend + 1 from m_ev_before),
  'the settlement emits exactly one identity.mfa-factor.changed.v1 for the factor it leaves reconciling, which wakes auth-state-reconciler [P2-S09-AC-933]');
select is((select payload from platform_private.outbox_events
            where event_type = 'identity.mfa-factor.changed.v1' and aggregate_id = pg_temp.m_fid_named(13, 'Pend')
            order by occurred_at desc, id desc limit 1),
  jsonb_build_object('mfaFactorId', pg_temp.m_fid_named(13, 'Pend'),
    'authBindingId', (select id from identity.auth_user_bindings where auth_user_id = pg_temp.m_uid(13))),
  'that event carries exactly the mfaFactorId and authBindingId payload and no provider factor id [P2-S09-AC-933]');
select is(pg_temp.m_outbox('identity.mfa-factor.changed.v1', pg_temp.m_fid_named(13, 'V1')),
  (select removed + 1 from m_ev_before),
  'a factor the settlement confirms removed emits one change event (the removal) and the failed-factor event adds none to it [P2-S09-AC-933]');
select ok(pg_temp.m_one(format($q$select (completed_at is null and state = 'reconciling')::text from platform_private.admin_mfa_factor_resets where id = %L$q$, (select id from m_reset_id))) = 'true',
  'the reset row stays reconciling with no completed_at [P2-S09-AC-933]');
select is(pg_temp.m_ver(13)::bigint, (select v + 1 from m_v_res), 'the settlement transaction bumps mfa_version once');
select ok(not (pg_temp.m_resp('s:partial')::text ~ ('(' || pg_temp.m_pid_named(13, 'V1')::text || '|' || pg_temp.m_uid(13)::text || ')')),
  'the settle response carries no provider factor id and no Auth UUID');
select pg_temp.m_settle_reset('s:final', 'designer2', (select id from m_reset_id), jsonb_build_array(
  jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'Pend'), 'outcome', 'removed')));
select is(pg_temp.m_resp('s:final')->>'state', 'completed', 'the last confirmation completes the reset');
select is(pg_temp.m_resp('s:final')->>'removedFactorCount', '4', 'with all four factors removed');
select ok(pg_temp.m_one(format($q$select (completed_at is not null)::text from platform_private.admin_mfa_factor_resets where id = %L$q$, (select id from m_reset_id))) = 'true', 'completed_at is recorded');
create temp table m_v_fin on commit drop as select pg_temp.m_ver(13)::bigint v;
select pg_temp.m_settle_reset('s:again', 'designer2', (select id from m_reset_id), jsonb_build_array(
  jsonb_build_object('providerFactorId', pg_temp.m_pid_named(13, 'Pend'), 'outcome', 'removed')));
select is(pg_temp.m_resp('s:again')->>'state', 'completed', 'settling again is idempotent');
select is(pg_temp.m_ver(13)::bigint, (select v from m_v_fin), 'and bumps nothing');
select pg_temp.m_reset('r:replay2', 'designer2', 'rev1', 'reset-key-ac945-0100', 'lost every verified factor');
select is(pg_temp.m_resp('r:replay2')->>'state', 'completed', 'a replay after completion reports completed');

-- A target with no live factor: completes immediately, still audited and notified.
select pg_temp.m_reset('r:empty', 'designer2', 'rev1', 'reset-key-ac945-0200');
select is(pg_temp.m_resp('r:empty')->>'state', 'completed', 'a reset with nothing to remove completes in the reservation transaction');
select is(jsonb_array_length(pg_temp.m_resp('r:empty')->'pendingProviderFactorIds'), 0, 'and asks the Worker to remove nothing');
select is(pg_temp.m_events(13, 'mfa.factors.reset'), 2, 'it is still recorded as security evidence');
-- The reset leaves the account able to enroll again under the first-factor rule.
select pg_temp.m_begin('after:begin', 13, 'Fresh');
select is(pg_temp.m_out('after:begin'), 'OK', 'after a reset the target can start a new enrollment');

-- A second target is unaffected, and a concurrent live reset is per target.
select is(pg_temp.m_fstate(pg_temp.m_fid(14)), 'verified', 'another person''s factors are untouched');
select pg_temp.m_reset('r:two', 'designer2', 'rev2', 'reset-key-ac945-0300');
select is(pg_temp.m_out('r:two'), 'OK', 'a reset of a different target is independent');

select * from finish();

rollback;
