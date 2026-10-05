\ir support/jwt-claims.sqlinc
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

-- SEC-1 guard. PostgREST publishes the verified token as the single JSON
-- setting request.jwt.claims and never the pre-v10 per-claim settings, so every
-- authority gate must read claims through platform_private.request_jwt_claim.
-- This file pins that source of truth on the live catalog and exercises each
-- gate with the real setting. The real Kong -> PostgREST proof of the same
-- contract is tests/postgrest (pnpm db:api-test).

-- ---------------------------------------------------------------- catalog guard
select is(
  (select coalesce(string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname, p.proname), '')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname not in ('auth', 'realtime', 'pg_catalog', 'information_schema')
      and p.prosrc ~ 'request\.jwt\.claim([^s]|$)'),
  '',
  'no function outside the vendor auth/realtime schemas reads a pre-v10 per-claim JWT setting'
);
select is(
  (select count(*)::integer from pg_policies
    where coalesce(qual, '') || coalesce(with_check, '') ~ 'request\.jwt\.claim([^s]|$)'),
  0,
  'no RLS policy reads a pre-v10 per-claim JWT setting'
);
select is(
  (select count(*)::integer from (
     select definition from pg_views where definition ~ 'request\.jwt\.claim([^s]|$)'
     union all select definition from pg_matviews where definition ~ 'request\.jwt\.claim([^s]|$)'
     union all select pg_get_expr(d.adbin, d.adrelid) from pg_attrdef d where pg_get_expr(d.adbin, d.adrelid) ~ 'request\.jwt\.claim([^s]|$)'
     union all select pg_get_constraintdef(c.oid) from pg_constraint c where pg_get_constraintdef(c.oid) ~ 'request\.jwt\.claim([^s]|$)'
     union all select pg_get_triggerdef(t.oid) from pg_trigger t where not t.tgisinternal and pg_get_triggerdef(t.oid) ~ 'request\.jwt\.claim([^s]|$)'
   ) x),
  0,
  'no view, default, constraint or trigger reads a pre-v10 per-claim JWT setting'
);
select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'platform_private' and p.proname = 'request_jwt_claim' and not p.prosecdef
      and p.proconfig @> array['search_path=""']),
  1,
  'request_jwt_claim is one SECURITY INVOKER function with a pinned empty search_path'
);
select is(
  (select bool_or(has_function_privilege(r, 'platform_private.request_jwt_claim(text)', 'execute'))
     from unnest(array['anon', 'authenticated', 'service_role']) r),
  false,
  'no API role can execute request_jwt_claim directly'
);

-- ------------------------------------------------------------- the one reader
create function pg_temp.sec1_err(p_sql text) returns text language plpgsql as $body$
begin
  execute p_sql;
  return 'OK';
exception when others then
  return sqlerrm;
end;
$body$;
create function pg_temp.sec1_claims(p_claims text) returns void language sql as $body$
  select set_config('request.jwt.claims', p_claims, true) $body$;
create function pg_temp.sec1_legacy(p_name text, p_value text) returns void language sql as $body$
  select set_config('request.jwt.claim.' || p_name, p_value, true) $body$;

select pg_temp.sec1_claims('{"role":"service_role","sub":"11111111-1111-4111-8111-111111111111","aal":"aal2"}');
select is(platform_private.request_jwt_claim('role'), 'service_role', 'reads the role claim from request.jwt.claims');
select is(platform_private.request_jwt_claim('sub'), '11111111-1111-4111-8111-111111111111', 'reads the sub claim from request.jwt.claims');
select is(platform_private.request_jwt_claim('aal'), 'aal2', 'reads the aal claim from request.jwt.claims');
select is(platform_private.request_jwt_claim('missing'), null, 'an absent claim is NULL');
select is(platform_private.request_jwt_claim(null), null, 'a NULL claim name is NULL');
select pg_temp.sec1_claims('{"role":""}');
select is(platform_private.request_jwt_claim('role'), null, 'an empty claim is NULL');
select pg_temp.sec1_claims('');
select is(platform_private.request_jwt_claim('role'), null, 'an empty setting yields no identity');
select pg_temp.sec1_claims('{not json');
select is(platform_private.request_jwt_claim('role'), null, 'a malformed setting yields no identity, never an error');
select pg_temp.sec1_claims('["service_role"]');
select is(platform_private.request_jwt_claim('role'), null, 'a non-object setting yields no identity');
select pg_temp.sec1_claims('');
select pg_temp.sec1_legacy('role', 'service_role');
select pg_temp.sec1_legacy('sub', '11111111-1111-4111-8111-111111111111');
select is(platform_private.request_jwt_claim('role'), null, 'a pre-v10 per-claim role setting is ignored: one source only');
select is(platform_private.request_jwt_claim('sub'), null, 'a pre-v10 per-claim sub setting is ignored: one source only');

-- ------------------------------------------------------------------ the gates
select is(pg_temp.sec1_err('select platform_private.cms_require_release_worker()'), 'UNAUTHENTICATED',
  'the release-worker gate refuses a caller that only set the pre-v10 role setting');
select pg_temp.sec1_claims('{"role":"service_role"}');
select is(pg_temp.sec1_err('select platform_private.cms_require_release_worker()'), 'OK',
  'the release-worker gate admits the real service_role claim');
select pg_temp.sec1_claims('{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}');
select is(pg_temp.sec1_err('select platform_private.cms_require_release_worker()'), 'UNAUTHENTICATED',
  'the release-worker gate refuses the authenticated role even when the pre-v10 setting says service_role');
select is(platform_private.cms_session_system_scope(), false,
  'the session system scope is not granted to an authenticated claim or a pre-v10 service_role setting');
select pg_temp.sec1_claims('{"role":"service_role"}');
select pg_temp.sec1_legacy('role', '');
select is(platform_private.cms_session_system_scope(), true,
  'the session system scope is granted by the real service_role claim');

insert into auth.users(id) values
  ('a1111111-1111-4111-8111-111111111111'), ('b2222222-2222-4222-8222-222222222222');
select pg_temp.sec1_claims('{"role":"authenticated","sub":"a1111111-1111-4111-8111-111111111111"}');
select is(platform_private.cfg_actor('{"context":{"authUserId":"a1111111-1111-4111-8111-111111111111"}}'::jsonb),
  'a1111111-1111-4111-8111-111111111111'::uuid, 'cfg_actor binds an authenticated caller to the token subject');
select is(platform_private.cfg_actor('{"context":{}}'::jsonb),
  'a1111111-1111-4111-8111-111111111111'::uuid, 'cfg_actor needs no context for an authenticated caller');
select is(pg_temp.sec1_err($$select platform_private.cfg_actor('{"context":{"authUserId":"b2222222-2222-4222-8222-222222222222"}}'::jsonb)$$),
  'UNAUTHENTICATED', 'cfg_actor refuses an authenticated caller naming another real user');
select is(pg_temp.sec1_err($$select platform_private.cfg_actor('{"context":{"actorPersonId":"b2222222-2222-4222-8222-222222222222"}}'::jsonb)$$),
  'UNAUTHENTICATED', 'cfg_actor refuses an authenticated caller naming another real actor person');
select pg_temp.sec1_claims('{"role":"authenticated","sub":"c3333333-3333-4333-8333-333333333333"}');
select is(pg_temp.sec1_err($$select platform_private.cfg_actor('{"context":{}}'::jsonb)$$),
  'UNAUTHENTICATED', 'cfg_actor refuses a token subject that is not a real auth user');
select pg_temp.sec1_claims('');
select pg_temp.sec1_legacy('role', 'authenticated');
select pg_temp.sec1_legacy('sub', 'a1111111-1111-4111-8111-111111111111');
select is(platform_private.cfg_actor('{"context":{"authUserId":"b2222222-2222-4222-8222-222222222222"}}'::jsonb),
  'b2222222-2222-4222-8222-222222222222'::uuid,
  'pre-v10 role/sub settings do not bind cfg_actor: without the real claim the verified Worker context is used');
select pg_temp.sec1_legacy('role', '');
select pg_temp.sec1_legacy('sub', '');

select pg_temp.sec1_claims('{"role":"authenticated","sub":"a1111111-1111-4111-8111-111111111111"}');
select is(platform_private.identity_auth_user(), 'a1111111-1111-4111-8111-111111111111'::uuid,
  'identity_auth_user resolves the authenticated token subject');
select pg_temp.sec1_claims('');
select pg_temp.sec1_legacy('sub', 'a1111111-1111-4111-8111-111111111111');
select is(pg_temp.sec1_err('select platform_private.identity_auth_user()'), 'UNAUTHENTICATED',
  'identity_auth_user ignores a pre-v10 per-claim subject setting');
select pg_temp.sec1_legacy('sub', '');

-- ------------------------------------------- profile claim conversion step-up
-- A missing step-up proof must refuse (it used to evaluate NULL NOT IN (...) and pass).
create function pg_temp.sec1_convert(p_claims text) returns text language plpgsql as $body$
begin
  perform set_config('request.jwt.claims', p_claims, true);
  perform set_config('app.step_up_verified', '', true);
  begin
    perform platform_api.rpc_convert_claim(jsonb_build_object(
      'context', jsonb_build_object('actorPersonId', 'a1111111-1111-4111-8111-111111111111',
        'actingPartyId', 'a1111111-1111-4111-8111-111111111111'),
      'claimId', '33333333-3333-4333-8333-333333333333',
      'headers', jsonb_build_object('idempotencyKey', 'sec1-step-up-key', 'ifMatch', '"1"'),
      'body', jsonb_build_object('reasonCode', 'claim_conversion')));
    return 'OK';
  exception when others then
    return sqlerrm;
  end;
end;
$body$;
select is(pg_temp.sec1_convert('{"role":"service_role"}'), 'STEP_UP_REQUIRED',
  'claim conversion with neither a step-up flag nor an aal claim is refused');
select is(pg_temp.sec1_convert('{"role":"service_role","aal":"aal1"}'), 'STEP_UP_REQUIRED',
  'claim conversion with an aal1 token is refused');
select isnt(pg_temp.sec1_convert('{"role":"service_role","aal":"aal2"}'), 'STEP_UP_REQUIRED',
  'claim conversion with an aal2 token passes the step-up gate');
select isnt(pg_temp.sec1_convert('{"role":"service_role","aal":"aal2"}'), 'OK',
  'an aal2 token still needs a real claim: the unknown claim is refused after the gate');

-- ------------------------------------------------ operator-only owner bootstrap
select is(
  (select p.prosecdef from pg_proc p where p.oid = 'platform_private.initialize_cms_owner(uuid,uuid,text,timestamptz,uuid,boolean)'::regprocedure),
  false, 'initialize_cms_owner is SECURITY INVOKER, so it can never elevate its caller');
select is(
  (select bool_or(has_function_privilege(r, 'platform_private.initialize_cms_owner(uuid,uuid,text,timestamptz,uuid,boolean)', 'execute'))
     from unnest(array['anon', 'authenticated', 'service_role']) r),
  false, 'no API role can execute initialize_cms_owner');
select is(
  (select prosrc ~ 'request\.jwt\.claims' and prosrc !~ 'request\.jwt\.claim([^s]|$)'
     from pg_proc where oid = 'platform_private.initialize_cms_owner(uuid,uuid,text,timestamptz,uuid,boolean)'::regprocedure),
  true, 'initialize_cms_owner establishes its actor context through request.jwt.claims only');
select is(
  (select prosrc ~ 'current_user <> ''postgres''' from pg_proc
    where oid = 'platform_private.initialize_cms_owner(uuid,uuid,text,timestamptz,uuid,boolean)'::regprocedure),
  true, 'initialize_cms_owner still refuses every caller but the postgres operator');
set local role service_role;
select throws_ok($$select platform_private.initialize_cms_owner(gen_random_uuid(), gen_random_uuid(), 'x@example.test', now() + interval '1 day', gen_random_uuid(), true)$$,
  '42501', null, 'a service_role caller cannot run the owner bootstrap');
reset role;

select * from finish();
rollback;
