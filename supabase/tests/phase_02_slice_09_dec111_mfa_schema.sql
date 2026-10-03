commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-111 QA-RED (BE01a "Database Schema, Support Records, and
-- Grants", AUTH-API-16..21): identity.mfa_factor_registry,
-- identity.step_up_challenges, identity.auth_user_bindings.mfa_version, their
-- forced RLS, absent client grants, state machines and the named
-- service-role-only RPC surface.  The DB records protected registry and
-- challenge state only; it never stores a TOTP secret, URI or code.

\ir phase_02_slice_09_dec111/00-support.sqlinc

select has_type('identity', 'mfa_factor_state', 'identity.mfa_factor_state exists');
select has_type('identity', 'step_up_challenge_state', 'identity.step_up_challenge_state exists');
select is((select array_agg(enumlabel::text order by enumsortorder) from pg_enum
            where enumtypid = to_regtype('identity.mfa_factor_state')),
  array['pending', 'verified', 'reconciling', 'removed', 'expired'],
  'factor states are exactly pending, verified, reconciling, removed, expired');
select is((select array_agg(enumlabel::text order by enumsortorder) from pg_enum
            where enumtypid = to_regtype('identity.step_up_challenge_state')),
  array['pending', 'consumed', 'failed', 'expired'],
  'challenge states are exactly pending, consumed, failed, expired');

select has_table('identity', t, 'identity.' || t || ' exists')
from unnest(array['mfa_factor_registry', 'step_up_challenges']) t;
select ok(pg_temp.m_rls(t), t || ' has ENABLE and FORCE row level security')
from unnest(array['mfa_factor_registry', 'step_up_challenges']) t;
select ok(pg_temp.m_no_grants(t), t || ' has no table grant for anon, authenticated or service_role')
from unnest(array['mfa_factor_registry', 'step_up_challenges']) t;

select ok((select count(*) = 1 from information_schema.columns
            where table_schema = 'identity' and table_name = 'auth_user_bindings'
              and column_name = 'mfa_version' and data_type = 'bigint' and is_nullable = 'NO'
              and column_default = '1'),
  'auth_user_bindings.mfa_version is bigint NOT NULL DEFAULT 1 [P2-S09-AC-902]');
select ok(exists (select 1 from pg_constraint where conrelid = to_regclass('identity.auth_user_bindings')
            and contype = 'c' and pg_get_constraintdef(oid) like '%mfa_version%> 0%'),
  'mfa_version is CHECK > 0 [P2-S09-AC-902]');

select is((select array_agg(column_name::text order by ordinal_position) from information_schema.columns
            where table_schema = 'identity' and table_name = 'mfa_factor_registry'),
  array['id', 'auth_user_id', 'method', 'provider_factor_id', 'friendly_name', 'state',
        'pending_expires_at', 'verified_at', 'last_used_at', 'removed_at', 'version',
        'created_at', 'updated_at'],
  'mfa_factor_registry carries exactly the ledger columns (no secret, URI or code column) [P2-S09-AC-898]');
select is((select array_agg(column_name::text order by ordinal_position) from information_schema.columns
            where table_schema = 'identity' and table_name = 'step_up_challenges'),
  array['id', 'auth_user_id', 'session_id', 'factor_id', 'provider_challenge_id', 'state',
        'expires_at', 'failed_attempt_count', 'consumed_at', 'failed_at', 'version',
        'created_at', 'updated_at'],
  'step_up_challenges carries exactly the ledger columns (no code, no token) [P2-S09-AC-900]');
select ok(not exists (select 1 from information_schema.columns
            where table_schema = 'identity' and table_name in ('mfa_factor_registry', 'step_up_challenges')
              and column_name ~* '(secret|otpauth|uri|code$|totp|token|key_material)'),
  'neither table has a secret, URI, code or token column [P2-S09-AC-899] [P2-S09-AC-901]');

-- Constraints and indexes the ledger names.
select ok(exists (select 1 from pg_constraint where conrelid = to_regclass('identity.mfa_factor_registry')
            and contype = 'u' and pg_get_constraintdef(oid) like '%provider_factor_id%'),
  'provider_factor_id is UNIQUE [P2-S09-AC-898]');
select ok(exists (select 1 from pg_constraint where conrelid = to_regclass('identity.mfa_factor_registry')
            and contype = 'f' and pg_get_constraintdef(oid) like '%auth.users%'
            and pg_get_constraintdef(oid) like '%RESTRICT%'),
  'auth_user_id REFERENCES auth.users ON DELETE RESTRICT');
select ok(exists (select 1 from pg_indexes where schemaname = 'identity' and tablename = 'mfa_factor_registry'
            and indexdef ilike '%unique%(auth_user_id)%state = ''pending''%'),
  'one pending factor per user (partial unique index) [P2-S09-AC-899]');
select ok(exists (select 1 from pg_indexes where schemaname = 'identity' and tablename = 'mfa_factor_registry'
            and indexdef ilike '%unique%lower(friendly_name)%pending%verified%reconciling%'),
  'live friendly name unique per user case-insensitively (partial unique index) [P2-S09-AC-736]');
select ok(exists (select 1 from pg_indexes where schemaname = 'identity' and tablename = 'mfa_factor_registry'
            and indexdef ilike '%(auth_user_id, state)%'), 'index on (auth_user_id, state)');
select ok(exists (select 1 from pg_indexes where schemaname = 'identity' and tablename = 'mfa_factor_registry'
            and indexdef ilike '%(state, pending_expires_at)%'), 'index on (state, pending_expires_at)');
select ok(exists (select 1 from pg_indexes where schemaname = 'identity' and tablename = 'step_up_challenges'
            and indexdef ilike '%unique%(session_id, factor_id)%state = ''pending''%'),
  'one pending challenge per (session, factor) (partial unique index) [P2-S09-AC-901]');
select ok(exists (select 1 from pg_indexes where schemaname = 'identity' and tablename = 'step_up_challenges'
            and indexdef ilike '%(auth_user_id, state)%'), 'challenge index on (auth_user_id, state)');
select ok(exists (select 1 from pg_indexes where schemaname = 'identity' and tablename = 'step_up_challenges'
            and indexdef ilike '%(state, expires_at)%'), 'challenge index on (state, expires_at)');
select ok(exists (select 1 from pg_constraint where conrelid = to_regclass('identity.step_up_challenges')
            and contype = 'f' and pg_get_constraintdef(oid) like '%auth_session_index%'),
  'challenge session_id REFERENCES identity.auth_session_index [P2-S09-AC-900]');
select ok(exists (select 1 from pg_constraint where conrelid = to_regclass('identity.step_up_challenges')
            and contype = 'f' and pg_get_constraintdef(oid) like '%mfa_factor_registry%'),
  'challenge factor_id REFERENCES identity.mfa_factor_registry');
select ok(exists (select 1 from pg_constraint where conrelid = to_regclass('identity.step_up_challenges')
            and contype = 'c' and pg_get_constraintdef(oid) like '%00:10:00%'),
  'challenge expires_at <= created_at + 10 minutes [P2-S09-AC-900]');

-- Row-level behavior, exercised with real rows made by the RPCs.
select pg_temp.m_user(1);
select pg_temp.m_user(2);
select pg_temp.m_enroll(1, 'Phone');
select is(pg_temp.m_out('en:s'), 'OK', 'fixture: a real enrollment reaches verified');
select ok(not pg_temp.m_try($$insert into identity.mfa_factor_registry(auth_user_id, method, provider_factor_id, friendly_name, state, pending_expires_at)
  values ('b1110000-0000-4000-8000-000000000002', 'sms', extensions.gen_random_uuid(), 'x', 'pending', clock_timestamp() + interval '5 minutes')$$),
  'a non-totp method is refused [P2-S09-AC-898]');
select ok(not pg_temp.m_try($$insert into identity.mfa_factor_registry(auth_user_id, method, provider_factor_id, friendly_name, state, pending_expires_at)
  values ('b1110000-0000-4000-8000-000000000002', 'totp', extensions.gen_random_uuid(), repeat('x', 81), 'pending', clock_timestamp() + interval '5 minutes')$$),
  'an 81-character friendly name is refused [P2-S09-AC-898]');
select ok(not pg_temp.m_try($$insert into identity.mfa_factor_registry(auth_user_id, method, provider_factor_id, friendly_name, state, pending_expires_at)
  values ('b1110000-0000-4000-8000-000000000002', 'totp', extensions.gen_random_uuid(), '', 'pending', clock_timestamp() + interval '5 minutes')$$),
  'an empty friendly name is refused [P2-S09-AC-898]');
select ok(not pg_temp.m_try($$insert into identity.mfa_factor_registry(auth_user_id, method, provider_factor_id, friendly_name, state, pending_expires_at)
  values ('b1110000-0000-4000-8000-000000000002', 'totp', extensions.gen_random_uuid(), 'x', 'pending', clock_timestamp() + interval '11 minutes')$$),
  'a pending window longer than 10 minutes is refused [P2-S09-AC-898]');
select ok(not pg_temp.m_try($$insert into identity.mfa_factor_registry(auth_user_id, method, provider_factor_id, friendly_name, state)
  values ('b1110000-0000-4000-8000-000000000002', 'totp', extensions.gen_random_uuid(), 'x', 'pending')$$),
  'a pending row without pending_expires_at is refused [P2-S09-AC-898]');
select ok(not pg_temp.m_try($$insert into identity.mfa_factor_registry(auth_user_id, method, provider_factor_id, friendly_name, state)
  values ('b1110000-0000-4000-8000-000000000002', 'totp', extensions.gen_random_uuid(), 'x', 'verified')$$),
  'a verified row without verified_at is refused [P2-S09-AC-898]');
select ok(pg_temp.m_try($$insert into identity.mfa_factor_registry(auth_user_id, method, provider_factor_id, friendly_name, state, pending_expires_at)
  values ('b1110000-0000-4000-8000-000000000002', 'totp', extensions.gen_random_uuid(), 'ok one', 'pending', clock_timestamp() + interval '5 minutes')$$),
  'a well-formed pending row is accepted (precondition for the uniqueness checks)');
select ok(not pg_temp.m_try($$insert into identity.mfa_factor_registry(auth_user_id, method, provider_factor_id, friendly_name, state, pending_expires_at)
  values ('b1110000-0000-4000-8000-000000000002', 'totp', extensions.gen_random_uuid(), 'ok two', 'pending', clock_timestamp() + interval '5 minutes')$$),
  'a second pending row for the same user is refused [P2-S09-AC-899]');
select ok(not pg_temp.m_try($$insert into identity.mfa_factor_registry(auth_user_id, method, provider_factor_id, friendly_name, state, verified_at)
  values ('b1110000-0000-4000-8000-000000000002', 'totp', extensions.gen_random_uuid(), 'OK ONE', 'verified', clock_timestamp())$$),
  'a live friendly name collides case-insensitively [P2-S09-AC-736]');
select ok(not pg_temp.m_try(format($$insert into identity.mfa_factor_registry(auth_user_id, method, provider_factor_id, friendly_name, state, verified_at)
  values ('b1110000-0000-4000-8000-000000000002', 'totp', %L, 'dup provider', 'verified', clock_timestamp())$$,
  pg_temp.m_pfid(1))),
  'a duplicate provider_factor_id is refused');

-- State machine and immutability guards.
select ok(not pg_temp.m_try(format($$update identity.mfa_factor_registry set provider_factor_id = extensions.gen_random_uuid(), version = version + 1 where id = %L$$,
  pg_temp.m_fid(1))),
  'provider_factor_id is immutable');
select ok(not pg_temp.m_try(format($$update identity.mfa_factor_registry set friendly_name = 'renamed', version = version + 1 where id = %L$$,
  pg_temp.m_fid(1))),
  'friendly_name is immutable');
select ok(not pg_temp.m_try(format($$update identity.mfa_factor_registry set state = 'pending', pending_expires_at = clock_timestamp() + interval '1 minute', verified_at = null, version = version + 1 where id = %L$$,
  pg_temp.m_fid(1))),
  'verified -> pending is not a transition [P2-S09-AC-904]');
select ok(not pg_temp.m_try(format($$update identity.mfa_factor_registry set state = 'removed', removed_at = clock_timestamp(), version = version + 1 where id = %L$$,
  pg_temp.m_fid(1))),
  'verified -> removed must go through reconciling [P2-S09-AC-904]');
select ok(not pg_temp.m_try(format($$update identity.mfa_factor_registry set last_used_at = clock_timestamp() where id = %L$$,
  pg_temp.m_fid(1))),
  'an update that does not advance the row version is refused');
select ok(pg_temp.m_try(format($$update identity.mfa_factor_registry set state = 'reconciling', version = version + 1 where id = %L$$,
  pg_temp.m_fid(1))),
  'verified -> reconciling is a transition [P2-S09-AC-904]');
select ok(pg_temp.m_try(format($$update identity.mfa_factor_registry set state = 'removed', removed_at = clock_timestamp(), version = version + 1 where id = %L$$,
  pg_temp.m_fid(1))),
  'reconciling -> removed is a transition [P2-S09-AC-904]');
select ok(not pg_temp.m_try(format($$update identity.mfa_factor_registry set state = 'verified', verified_at = clock_timestamp(), removed_at = null, version = version + 1 where id = %L$$,
  pg_temp.m_fid(1))),
  'removed is terminal [P2-S09-AC-904]');
select ok(not pg_temp.m_try(format($$delete from identity.mfa_factor_registry where id = %L$$,
  pg_temp.m_fid(1))),
  'a registry row cannot be deleted outside the retention sweep');

-- Challenges: a real challenge for user 2's factor (needs a verified factor).
select pg_temp.m_enroll(2, 'Laptop');
select pg_temp.m('ch:b', 'auth_step_up_challenge_begin', jsonb_build_object(
  'p_auth_user_id', pg_temp.m_uid(2), 'p_session_id', pg_temp.m_sid(2), 'p_method', 'totp', 'p_factor_id', null));
select pg_temp.m('ch:f', 'auth_step_up_challenge_finish', jsonb_build_object(
  'p_auth_user_id', pg_temp.m_uid(2), 'p_session_id', pg_temp.m_sid(2),
  'p_factor_id', pg_temp.m_one(format($q$select id::text from identity.mfa_factor_registry where auth_user_id = %L and friendly_name = 'Laptop'$q$, pg_temp.m_uid(2)))::uuid,
  'p_provider_challenge_id', extensions.gen_random_uuid(),
  'p_expires_at', clock_timestamp() + interval '5 minutes'));
select is(pg_temp.m_out('ch:f'), 'OK', 'fixture: a real challenge is created');
select ok(not pg_temp.m_try(format($$insert into identity.step_up_challenges(auth_user_id, session_id, factor_id, provider_challenge_id, state, expires_at)
  values (%L, %L, %L, extensions.gen_random_uuid(), 'pending', clock_timestamp() + interval '5 minutes')$$,
  pg_temp.m_uid(2), pg_temp.m_sid(2), pg_temp.m_one(format($q$select id::text from identity.mfa_factor_registry where auth_user_id = %L and friendly_name = 'Laptop'$q$, pg_temp.m_uid(2)))::uuid)),
  'a second pending challenge for the same session and factor is refused [P2-S09-AC-901]');
select ok(not pg_temp.m_try(format($$insert into identity.step_up_challenges(auth_user_id, session_id, factor_id, provider_challenge_id, state, expires_at)
  values (%L, %L, %L, extensions.gen_random_uuid(), 'expired', clock_timestamp() + interval '11 minutes')$$,
  pg_temp.m_uid(2), pg_temp.m_sid(2), pg_temp.m_one(format($q$select id::text from identity.mfa_factor_registry where auth_user_id = %L and friendly_name = 'Laptop'$q$, pg_temp.m_uid(2)))::uuid)),
  'a challenge window longer than 10 minutes is refused [P2-S09-AC-900]');
select ok(not pg_temp.m_try(format($$update identity.step_up_challenges set session_id = %L, version = version + 1$$, pg_temp.m_sid(1))),
  'challenge session binding is immutable [P2-S09-AC-900]');
select ok(not pg_temp.m_try($$update identity.step_up_challenges set provider_challenge_id = extensions.gen_random_uuid(), version = version + 1$$),
  'provider_challenge_id is immutable');
select ok(pg_temp.m_try($$update identity.step_up_challenges set failed_attempt_count = failed_attempt_count + 1, version = version + 1$$),
  'a wrong code may increment failed_attempt_count while pending');
select ok(not pg_temp.m_try($$update identity.step_up_challenges set failed_attempt_count = -1, version = version + 1$$),
  'failed_attempt_count cannot go negative [P2-S09-AC-900]');
select ok(pg_temp.m_try($$update identity.step_up_challenges set state = 'consumed', consumed_at = clock_timestamp(), version = version + 1$$),
  'pending -> consumed is a transition [P2-S09-AC-905]');
select ok(not pg_temp.m_try($$update identity.step_up_challenges set state = 'pending', consumed_at = null, version = version + 1$$),
  'consumed is terminal [P2-S09-AC-905]');
select ok(not pg_temp.m_try($$delete from identity.step_up_challenges$$),
  'a challenge row cannot be deleted outside the retention sweep');

-- Named RPC surface: service-role only, pinned search_path, security definer.
select ok(pg_temp.m_service_only(f), f || ' is executable by service_role only')
from unnest(array[
  'platform_api.auth_mfa_factors_read(uuid, uuid, uuid)',
  'platform_api.auth_mfa_enrollment_begin(uuid, text, text, uuid, uuid)',
  'platform_api.auth_mfa_enrollment_finish(uuid, uuid, text, text, uuid, uuid, uuid)',
  'platform_api.auth_mfa_enrollment_verify_prepare(uuid, uuid, text, uuid, uuid)',
  'platform_api.auth_mfa_enrollment_verify_settle(uuid, uuid, text, uuid, uuid, timestamptz, uuid, uuid)',
  'platform_api.auth_mfa_factor_mark_reconciling(uuid, uuid, uuid, uuid)',
  'platform_api.auth_mfa_factor_reconcile(uuid, uuid, text, bigint, uuid, uuid)',
  'platform_api.auth_mfa_removal_begin(uuid, uuid, text, text, uuid, bytea, bytea, uuid, uuid)',
  'platform_api.auth_mfa_removal_finish(uuid, uuid, text, uuid, bytea, uuid, uuid)',
  'platform_api.auth_step_up_challenge_begin(uuid, uuid, text, uuid, uuid, uuid)',
  'platform_api.auth_step_up_challenge_finish(uuid, uuid, uuid, uuid, timestamptz, uuid, uuid)',
  'platform_api.auth_step_up_challenge_verify_prepare(uuid, uuid, uuid, uuid, uuid)',
  'platform_api.auth_step_up_challenge_failure_record(uuid, uuid, uuid, text, uuid, uuid)',
  'platform_api.auth_step_up_challenge_verify_settle(uuid, uuid, uuid, uuid, timestamptz, uuid, uuid)',
  'platform_api.auth_mfa_registry_sweep(integer)',
  'platform_api.admin_mfa_factor_reset(jsonb)',
  'platform_api.admin_mfa_factor_reset_settle(jsonb)']) f;
select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_api'
      and (p.proname like 'auth\_mfa\_%' or p.proname like 'auth\_step\_up\_%' or p.proname like 'admin\_mfa\_%')),
  'every MFA/step-up platform_api function is SECURITY DEFINER with a pinned empty search_path');
select ok(
  (select count(*) = 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('platform_private', 'identity')
      and (p.proname like 'mfa\_%' or p.proname like 'step\_up\_%' or p.proname like 'rpc\_admin\_reset\_mfa%')
      and (has_function_privilege('service_role', p.oid, 'execute')
        or has_function_privilege('authenticated', p.oid, 'execute')
        or has_function_privilege('anon', p.oid, 'execute'))),
  'no private MFA/step-up helper is executable by any API role');
select ok(to_regprocedure('identity.rpc_admin_reset_mfa_factors(uuid, uuid, uuid)') is not null,
  'identity.rpc_admin_reset_mfa_factors(reset_id, target_person_id, operator_person_id) exists [P2-S09-AC-892]');
select ok(has_function_privilege('postgres', to_regprocedure('identity.rpc_admin_reset_mfa_factors(uuid, uuid, uuid)'), 'execute')
  and not has_function_privilege('service_role', to_regprocedure('identity.rpc_admin_reset_mfa_factors(uuid, uuid, uuid)'), 'execute'),
  'the identity reset RPC is reachable only through the admin wrapper, never by a client role directly [P2-S09-AC-892]');

-- AC904 negative matrix: only the BE01a transitions exist, with the exact guard error.
create or replace function pg_temp.m_err(p_sql text) returns text language plpgsql as $body$
begin
  execute p_sql;
  return 'OK';
exception when others then
  return sqlerrm;
end;
$body$;
select ok(pg_temp.m_try($$insert into identity.mfa_factor_registry(auth_user_id, method, provider_factor_id, friendly_name, state, pending_expires_at)
  values ('b1110000-0000-4000-8000-000000000002', 'totp', extensions.gen_random_uuid(), 'transition probe', 'pending', clock_timestamp() + interval '5 minutes')$$),
  'precondition: a live pending probe row exists for the transition matrix');
select is(pg_temp.m_err(format($$update identity.mfa_factor_registry set state = 'removed', removed_at = clock_timestamp(), pending_expires_at = null, version = version + 1
  where auth_user_id = %L and friendly_name = 'transition probe'$$, pg_temp.m_uid(2))), 'MFA_FACTOR_TRANSITION',
  'pending -> removed is refused with MFA_FACTOR_TRANSITION [P2-S09-AC-904]');
select is(pg_temp.m_err(format($$update identity.mfa_factor_registry set state = 'expired', version = version + 1
  where auth_user_id = %L and friendly_name = 'Laptop'$$, pg_temp.m_uid(2))), 'MFA_FACTOR_TRANSITION',
  'verified -> expired is refused with MFA_FACTOR_TRANSITION [P2-S09-AC-904]');
select is(pg_temp.m_err(format($$update identity.mfa_factor_registry set state = 'reconciling', version = version + 1
  where auth_user_id = %L and friendly_name = 'Laptop'$$, pg_temp.m_uid(2))), 'OK',
  'verified -> reconciling is a transition [P2-S09-AC-904]');
select is(pg_temp.m_err(format($$update identity.mfa_factor_registry set state = 'expired', version = version + 1
  where auth_user_id = %L and friendly_name = 'Laptop'$$, pg_temp.m_uid(2))), 'MFA_FACTOR_TRANSITION',
  'reconciling -> expired is refused with MFA_FACTOR_TRANSITION [P2-S09-AC-904]');
select is(pg_temp.m_err(format($$update identity.mfa_factor_registry set state = 'verified', version = version + 1
  where auth_user_id = %L and friendly_name = 'Laptop'$$, pg_temp.m_uid(2))), 'OK',
  'reconciling -> verified is a transition [P2-S09-AC-904]');
select is(pg_temp.m_err(format($$update identity.mfa_factor_registry set state = 'expired', pending_expires_at = null, version = version + 1
  where auth_user_id = %L and friendly_name = 'transition probe'$$, pg_temp.m_uid(2))), 'OK',
  'pending -> expired is a transition [P2-S09-AC-904]');

select * from finish();

rollback;
