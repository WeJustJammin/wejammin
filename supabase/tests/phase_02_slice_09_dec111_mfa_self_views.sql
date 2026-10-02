commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-111 (BE01a "Index, RLS, and retention inventory", P2-S09-AC-903):
-- the MFA registry and step-up challenge tables stay anonymous-deny with forced
-- RLS; a signed-in human reads only a safe projection of their OWN rows through
-- security-invoker views backed by a self-read policy and column-level grants;
-- no secret/provider column is reachable; mutations stay named RPCs only; no
-- operator, support or service role holds any privilege on either table.

\ir phase_02_slice_09_dec111/00-support.sqlinc

-- Runs one statement as the authenticated role with the given JWT subject and
-- returns its scalar text result, or 'ERROR:<sqlstate>' when the role is refused.
create function public.s09v_as(p_role text, p_sub text, p_sql text) returns text language plpgsql as $body$
declare result text;
begin
  perform pg_catalog.set_config('request.jwt.claim.sub', coalesce(p_sub, ''), true);
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

select pg_temp.m_user(1);
select pg_temp.m_user(2);
select pg_temp.m_enroll(1, 'Phone');
select pg_temp.m_enroll(1, 'Spare');
select pg_temp.m_enroll(2, 'Laptop');
select pg_temp.m('cb1', 'auth_step_up_challenge_begin', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(1),
  'p_session_id', pg_temp.m_sid(1), 'p_method', 'totp', 'p_factor_id', pg_temp.m_fid(1)));
select pg_temp.m('cf1', 'auth_step_up_challenge_finish', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(1),
  'p_session_id', pg_temp.m_sid(1), 'p_factor_id', pg_temp.m_fid(1),
  'p_provider_challenge_id', extensions.gen_random_uuid(), 'p_expires_at', clock_timestamp() + interval '5 minutes'));
select pg_temp.m('cb2', 'auth_step_up_challenge_begin', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(2),
  'p_session_id', pg_temp.m_sid(2), 'p_method', 'totp', 'p_factor_id', pg_temp.m_fid(2)));
select pg_temp.m('cf2', 'auth_step_up_challenge_finish', jsonb_build_object('p_auth_user_id', pg_temp.m_uid(2),
  'p_session_id', pg_temp.m_sid(2), 'p_factor_id', pg_temp.m_fid(2),
  'p_provider_challenge_id', extensions.gen_random_uuid(), 'p_expires_at', clock_timestamp() + interval '5 minutes'));
select is(pg_temp.m_out('cf1') || '/' || pg_temp.m_out('cf2'), 'OK/OK', 'fixture: each human has a live step-up challenge');

-- ---- the views: invoker, safe columns only -------------------------------------
select ok(coalesce((select c.reloptions @> array['security_invoker=true'] from pg_class c
                     where c.oid = to_regclass('api_identity.mfa_factor_self_v1')), false),
  'api_identity.mfa_factor_self_v1 is a security-invoker view [P2-S09-AC-903]');
select ok(coalesce((select c.reloptions @> array['security_invoker=true'] from pg_class c
                     where c.oid = to_regclass('api_identity.step_up_challenge_self_v1')), false),
  'api_identity.step_up_challenge_self_v1 is a security-invoker view [P2-S09-AC-903]');
select is((select array_agg(attname::text order by attnum) from pg_attribute
            where attrelid = to_regclass('api_identity.mfa_factor_self_v1') and attnum > 0 and not attisdropped),
  array['id', 'method', 'friendly_name', 'state', 'pending_expires_at', 'verified_at', 'last_used_at',
        'removed_at', 'version', 'created_at', 'updated_at'],
  'the factor projection exposes exactly the safe columns: no auth user id, no provider factor id [P2-S09-AC-903]');
select is((select array_agg(attname::text order by attnum) from pg_attribute
            where attrelid = to_regclass('api_identity.step_up_challenge_self_v1') and attnum > 0 and not attisdropped),
  array['id', 'factor_id', 'state', 'expires_at', 'failed_attempt_count', 'consumed_at', 'failed_at', 'version', 'created_at'],
  'the challenge projection exposes exactly the safe columns: no auth user, session or provider challenge id [P2-S09-AC-903]');

-- ---- RLS stays forced, policies are self-read only -----------------------------
select ok(pg_temp.m_rls(t), t || ' keeps ENABLE and FORCE row level security [P2-S09-AC-903]')
from unnest(array['mfa_factor_registry', 'step_up_challenges']) t;
select ok(pg_temp.m_no_grants(t), t || ' still has no table-level grant for anon, authenticated or service_role [P2-S09-AC-903]')
from unnest(array['mfa_factor_registry', 'step_up_challenges']) t;
select is((select array_agg(policyname::text order by policyname) from pg_policies
            where schemaname = 'identity' and tablename = 'mfa_factor_registry'),
  array['mfa_factor_self_read'], 'the factor registry has exactly one policy: the self read [P2-S09-AC-903]');
select is((select array_agg(policyname::text order by policyname) from pg_policies
            where schemaname = 'identity' and tablename = 'step_up_challenges'),
  array['step_up_challenge_self_read'], 'the challenge table has exactly one policy: the self read [P2-S09-AC-903]');
select is((select string_agg(distinct cmd || ':' || roles::text, ',') from pg_policies
            where schemaname = 'identity' and tablename in ('mfa_factor_registry', 'step_up_challenges')),
  'SELECT:{authenticated}', 'both policies are SELECT-only for authenticated [P2-S09-AC-903]');

-- ---- who holds any privilege ----------------------------------------------------
select is((select coalesce(string_agg(distinct r.rolname, ',' order by r.rolname), '') from pg_attribute a
             join pg_class c on c.oid = a.attrelid and c.relnamespace = 'identity'::regnamespace
             and c.relname in ('mfa_factor_registry', 'step_up_challenges')
             cross join lateral aclexplode(a.attacl) x
             join pg_roles r on r.oid = x.grantee
            where a.attacl is not null and x.privilege_type <> 'SELECT'), '',
  'no role holds any column privilege other than SELECT [P2-S09-AC-903]');
select is((select coalesce(string_agg(distinct r.rolname, ',' order by r.rolname), '') from pg_attribute a
             join pg_class c on c.oid = a.attrelid and c.relnamespace = 'identity'::regnamespace
             and c.relname in ('mfa_factor_registry', 'step_up_challenges')
             cross join lateral aclexplode(a.attacl) x
             join pg_roles r on r.oid = x.grantee
            where a.attacl is not null), 'authenticated',
  'authenticated is the only role with a column privilege (support, identity operators, anon and service_role hold none) [P2-S09-AC-903]');
select ok(not has_any_column_privilege('anon', 'identity.mfa_factor_registry', 'select')
      and not has_any_column_privilege('anon', 'identity.step_up_challenges', 'select')
      and not has_any_column_privilege('service_role', 'identity.mfa_factor_registry', 'select')
      and not has_any_column_privilege('service_role', 'identity.step_up_challenges', 'select'),
  'anon and service_role hold no column privilege on either table [P2-S09-AC-903]');
select ok(not has_table_privilege('anon', 'api_identity.mfa_factor_self_v1', 'select')
      and not has_table_privilege('anon', 'api_identity.step_up_challenge_self_v1', 'select')
      and not has_table_privilege('service_role', 'api_identity.mfa_factor_self_v1', 'select')
      and has_table_privilege('authenticated', 'api_identity.mfa_factor_self_v1', 'select')
      and has_table_privilege('authenticated', 'api_identity.step_up_challenge_self_v1', 'select'),
  'only authenticated may select the self views; anon and service_role may not [P2-S09-AC-903]');

-- ---- behavior under each role ---------------------------------------------------
select is(public.s09v_as('anon', null, 'select count(*)::text from api_identity.mfa_factor_self_v1'), 'ERROR:42501',
  'anonymous reading the factor view is permission denied [P2-S09-AC-903]');
select is(public.s09v_as('anon', null, 'select count(*)::text from api_identity.step_up_challenge_self_v1'), 'ERROR:42501',
  'anonymous reading the challenge view is permission denied [P2-S09-AC-903]');
select is(public.s09v_as('authenticated', pg_temp.m_uid(1)::text, 'select count(*)::text from api_identity.mfa_factor_self_v1'), '2',
  'a human sees exactly their own two verified factors, never the other human''s [P2-S09-AC-903]');
select is(public.s09v_as('authenticated', pg_temp.m_uid(2)::text, 'select count(*)::text from api_identity.mfa_factor_self_v1'), '1',
  'the other human sees exactly their own one factor [P2-S09-AC-903]');
select is(public.s09v_as('authenticated', pg_temp.m_uid(1)::text,
    format('select count(*)::text from api_identity.mfa_factor_self_v1 where id = %L', pg_temp.m_fid(2))), '0',
  'a forged read of another human''s factor id returns no row [P2-S09-AC-903]');
select is(public.s09v_as('authenticated', pg_temp.m_uid(1)::text, 'select count(*)::text from api_identity.step_up_challenge_self_v1'), '1',
  'a human sees only their own step-up challenge [P2-S09-AC-903]');
select is(public.s09v_as('authenticated', null, 'select count(*)::text from api_identity.mfa_factor_self_v1'), '0',
  'an authenticated role with no subject sees no factor [P2-S09-AC-903]');
select is(public.s09v_as('authenticated', 'not-a-uuid', 'select count(*)::text from api_identity.mfa_factor_self_v1'), 'ERROR:22P02',
  'a malformed subject fails closed [P2-S09-AC-903]');
select is(public.s09v_as('authenticated', pg_temp.m_uid(1)::text, 'select provider_factor_id::text from identity.mfa_factor_registry limit 1'), 'ERROR:42501',
  'the provider factor id column is not readable by the signed-in human [P2-S09-AC-903]');
select is(public.s09v_as('authenticated', pg_temp.m_uid(1)::text, 'select count(*)::text from (select * from identity.mfa_factor_registry) q'), 'ERROR:42501',
  'selecting every base-table column is denied [P2-S09-AC-903]');
select is(public.s09v_as('authenticated', pg_temp.m_uid(1)::text, 'select provider_challenge_id::text from identity.step_up_challenges limit 1'), 'ERROR:42501',
  'the provider challenge id column is not readable by the signed-in human [P2-S09-AC-903]');
select is(public.s09v_as('authenticated', pg_temp.m_uid(1)::text, 'select auth_user_id::text from identity.step_up_challenges limit 1'), 'ERROR:42501',
  'the auth user column is not readable by the signed-in human [P2-S09-AC-903]');
select is(public.s09v_as('authenticated', pg_temp.m_uid(1)::text,
    $q$with u as (update identity.mfa_factor_registry set friendly_name = 'x' returning 1) select count(*)::text from u$q$), 'ERROR:42501',
  'a signed-in human cannot update the registry [P2-S09-AC-903]');
select is(public.s09v_as('authenticated', pg_temp.m_uid(1)::text,
    $q$with d as (delete from identity.mfa_factor_registry returning 1) select count(*)::text from d$q$), 'ERROR:42501',
  'a signed-in human cannot delete a factor [P2-S09-AC-903]');
select is(public.s09v_as('authenticated', pg_temp.m_uid(1)::text,
    $q$with d as (update identity.step_up_challenges set state = 'consumed' returning 1) select count(*)::text from d$q$), 'ERROR:42501',
  'a signed-in human cannot consume a challenge [P2-S09-AC-903]');
select is(public.s09v_as('authenticated', pg_temp.m_uid(1)::text,
    $q$with d as (update api_identity.mfa_factor_self_v1 set friendly_name = 'x' returning 1) select count(*)::text from d$q$), 'ERROR:42501',
  'the factor view accepts no write [P2-S09-AC-903]');
select ok(not exists (select 1 from information_schema.routines r
    where r.routine_schema = 'api_identity' and r.routine_name like '%mfa%'),
  'no function is added to the api_identity surface: mutations stay named platform_api RPCs [P2-S09-AC-903]');

select * from finish();
rollback;
