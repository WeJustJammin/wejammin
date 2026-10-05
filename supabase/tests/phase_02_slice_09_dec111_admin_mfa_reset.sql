\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-111 QA-RED (BE05b CFG-05B-06 / BE01a "Administrative factor
-- reset"), table surface, request validation and authority.
-- Split by concern from one 430-line file so no test file
-- exceeds the 400-line depth-audit limit: the shared fixture is
-- phase_02_slice_09_dec111/01-admin-reset-fixture.sqlinc; the sibling suites are
-- phase_02_slice_09_dec111_admin_mfa_reset{,_reservation,_settlement}.sql.

\ir phase_02_slice_09_dec111/00-support.sqlinc
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec111/01-admin-reset-fixture.sqlinc

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

select has_table('platform_private', 'admin_mfa_factor_reset_settlements', 'the settlement receipt table exists [P2-S09-AC-933]');
select ok(coalesce((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('platform_private.admin_mfa_factor_reset_settlements')), false),
  'the settlement receipt forces row level security [P2-S09-AC-933]');
select ok(to_regclass('platform_private.admin_mfa_factor_reset_settlements') is not null and not exists (
    select 1 from unnest(array['anon', 'authenticated', 'service_role']) r, unnest(array['select', 'insert', 'update', 'delete']) p
     where has_table_privilege(r, 'platform_private.admin_mfa_factor_reset_settlements', p)),
  'the settlement receipt has no direct grant for any API role [P2-S09-AC-933]');
select ok(exists (select 1 from pg_constraint where conrelid = to_regclass('platform_private.admin_mfa_factor_reset_settlements')
    and contype = 'p' and pg_get_constraintdef(oid) = 'PRIMARY KEY (reset_id, factor_id, outcome, factor_version)'),
  'a receipt is keyed by reset, factor, outcome and factor version [P2-S09-AC-933]');
select ok(exists (select 1 from pg_constraint where conrelid = to_regclass('platform_private.admin_mfa_factor_reset_settlements')
    and contype = 'f' and pg_get_constraintdef(oid) like '%admin_mfa_factor_resets%')
  and not exists (select 1 from pg_constraint where conrelid = to_regclass('platform_private.admin_mfa_factor_reset_settlements')
    and contype = 'f' and pg_get_constraintdef(oid) like '%mfa_factor_registry%'),
  'a receipt references its reset and deliberately not the factor row the 30-day sweep purges [P2-S09-AC-933]');

-- ---- request validation and authority ------------------------------------------
select pg_temp.m_reset('r:key', 'designer2', 'rev1', 'reset-key-ac945-0001', 'x', '{}', jsonb_build_object('unknown', true));
select is(pg_temp.m_out('r:key'), 'INVALID_REQUEST', 'an unknown request key is INVALID_REQUEST [P2-S09-AC-935] [P2-S09-AC-942]');
-- CFG-05B-06 without any verified actor session is 401 UNAUTHENTICATED (no session GUC, no envelope).
select set_config(k, '', true) from unnest(array['app.auth_user_id', 'app.actor_auth_user_id', 'app.actor_person_id', 'app.acting_party_id', 'app.acting_context_id']) k;
select pg_temp.set_jwt_claim('sub', '');
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
-- TIME-WARP: shifts a membership window to reach a time-dependent branch.
update identity_private.membership_tenure set starts_on = current_date - 10, ends_on = current_date - 1
 where person_id = pg_temp.s09d_actor_id('rev1', 'person')::uuid and organization_id = pg_temp.s09d_id('ownerOrg');
select pg_temp.m_reset('r:ended', 'designer2', 'rev1', 'reset-key-ac945-0016');
select is(pg_temp.m_out('r:ended'), 'TARGET_NOT_FOUND', 'an ended membership is the same 404 [P2-S09-AC-927]');
update identity_private.membership_tenure set ends_on = null
 where person_id = pg_temp.s09d_actor_id('rev1', 'person')::uuid and organization_id = pg_temp.s09d_id('ownerOrg');
select is(pg_temp.m_one('select count(*)::text from platform_private.admin_mfa_factor_resets')::integer, 0, 'every refusal wrote no reset record');
select is(pg_temp.m_ver(13)::bigint, (select v13 from m_pre), 'and changed no MFA version');

select * from finish();

rollback;
