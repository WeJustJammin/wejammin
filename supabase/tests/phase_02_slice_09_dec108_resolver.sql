commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 QA-RED: platform_api.cms_resolve_template_compatibility
-- (BE03c "Named template compatibility resolver", G19).  Service-role only,
-- non-mutating, concealment as NOT_FOUND, typed failures INCOMPATIBLE,
-- WITHDRAWN and VERSION_MISMATCH, and a success that is the literal
-- invariant compatible:true / withdrawn:false.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

-- Test-human provisioning (D3): the owner grants itself template design through CMS-03A-15.
select pg_temp.s09d_grant_specialist('owner', 'cms.template_designer');

create or replace function pg_temp.s09d_template(p_tag text, p_key text, p_type_tag text) returns jsonb
language plpgsql as $body$
declare resource jsonb;
begin
  resource := pg_temp.s09d_rpc(p_tag || ':template', 'platform_api.cms_define_template', 'owner',
    jsonb_build_object('templateKey', p_key, 'compatibleTypeIds', jsonb_build_array(pg_temp.s09d_id(p_type_tag || ':type')),
      'slots', '[]'::jsonb, 'reservedRegions', jsonb_build_array('header', 'now', 'record', 'detail', 'provenance'),
      'bindings', '{}'::jsonb, 'locale', 'en-US', 'audience', 'public', 'expectedVersion', null,
      'idempotencyKey', pg_temp.s09d_idem(p_tag, 'template')));
  if resource is not null then perform pg_temp.s09d_remember(p_tag || ':templateVersion', (resource->>'id')::uuid); end if;
  return resource;
end;
$body$;
create or replace function pg_temp.s09d_resolve(
  p_label text, p_template uuid, p_type uuid, p_version uuid, p_actor text default 'owner',
  p_extra jsonb default '{}'::jsonb
) returns jsonb language plpgsql as $body$
begin
  perform pg_temp.s09d_session(p_actor);
  return pg_temp.s09d_call(p_label, 'platform_api.cms_resolve_template_compatibility',
    jsonb_build_object('templateVersionId', p_template, 'contentTypeId', p_type, 'contentTypeVersionId', p_version,
      'context', pg_temp.s09d_context(p_actor)) || p_extra);
end;
$body$;

select pg_temp.s09d_create_type('a', 'dec108res');
select pg_temp.s09d_to_active('a');
select pg_temp.s09d_successor('b', 'a');
select pg_temp.s09d_create_type('x', 'dec108resother');
select pg_temp.s09d_to_active('x');
select pg_temp.s09d_template('t', 's09d-compatible-template', 'a');
select pg_temp.s09d_template('i', 's09d-incompatible-template', 'x');
select is(pg_temp.s09d_outcome('t:template'), 'OK', 'fixture: a draft template compatible with the type exists (real CMS-03C-01 command)');
create temp table s09d_baseline on commit drop as select pg_temp.s09d_fingerprint() as fingerprint;

select pg_temp.s09d_resolve('t:ok', pg_temp.s09d_id('t:templateVersion'), pg_temp.s09d_id('a:type'), pg_temp.s09d_id('b:version'));
select is(pg_temp.s09d_outcome('t:ok'), 'OK', 'a compatible template resolves for the exact candidate version');
select ok((select (select count(*) from jsonb_object_keys(r)) = 9
    and r ?& array['templateVersionId','templateKey','templateVersionNo','state','compatible','withdrawn',
      'templateDigest','contentTypeId','contentTypeVersionId']
    and r->>'templateVersionId' = pg_temp.s09d_id('t:templateVersion')::text
    and r->>'templateKey' = 's09d-compatible-template' and r->>'templateVersionNo' = '1'
    and r->>'state' = 'draft' and r->>'templateDigest' ~ '^[a-f0-9]{64}$'
    and r->>'contentTypeId' = pg_temp.s09d_id('a:type')::text
    and r->>'contentTypeVersionId' = pg_temp.s09d_id('b:version')::text
    from (select pg_temp.s09d_resp('t:ok') r) s),
  'the safe projection has exactly the nine BE03c fields and echoes the verified candidate version [P2-S09-AC-702]');
select ok((select r->'compatible' = 'true'::jsonb and r->'withdrawn' = 'false'::jsonb
    from (select pg_temp.s09d_resp('t:ok') r) s),
  'success is the literal invariant compatible:true, withdrawn:false (never a soft compatible:false body)');
select ok(coalesce((select bool_and(position(needle in r::text) = 0)
    from (select pg_temp.s09d_resp('t:ok') r) s, (values (pg_temp.s09d_id('ownerOrg')::text),
      (pg_temp.s09d_actor_id('owner', 'auth')), (pg_temp.s09d_actor_id('owner', 'person')),
      (pg_temp.s09d_actor_id('owner', 'binding'))) n(needle)
    where r is not null), false)
  and not coalesce((select r ?| array['ownerId', 'owner_id', 'bindings', 'slots', 'rendererRef'] from (select pg_temp.s09d_resp('t:ok') r) s), true),
  'the projection exposes no owner id, binding manifest, slot internals or renderer ref');
select pg_temp.s09d_resolve('t:version1', pg_temp.s09d_id('t:templateVersion'), pg_temp.s09d_id('a:type'),
  pg_temp.s09d_id('b:version'), 'owner', jsonb_build_object('expectedTemplateVersionNo', '1'));
select is(pg_temp.s09d_outcome('t:version1'), 'OK', 'a matching expectedTemplateVersionNo only asserts and succeeds [P2-S09-AC-706]');

-- Typed failures, all with zero side effects.
select pg_temp.s09d_resolve('t:mismatch', pg_temp.s09d_id('t:templateVersion'), pg_temp.s09d_id('a:type'),
  pg_temp.s09d_id('b:version'), 'owner', jsonb_build_object('expectedTemplateVersionNo', '2'));
select is(pg_temp.s09d_outcome('t:mismatch'), 'VERSION_MISMATCH', 'an expectedTemplateVersionNo mismatch is the typed failure VERSION_MISMATCH [P2-S09-AC-706]');
select pg_temp.s09d_resolve('t:incompat', pg_temp.s09d_id('i:templateVersion'), pg_temp.s09d_id('a:type'), pg_temp.s09d_id('b:version'));
select ok(pg_temp.s09d_id('i:templateVersion') is not null and pg_temp.s09d_outcome('t:incompat') = 'INCOMPATIBLE',
  'a template whose compatible types exclude the content type is the typed failure INCOMPATIBLE [P2-S09-AC-704]');
select pg_temp.s09d_resolve('t:notemplate', extensions.gen_random_uuid(), pg_temp.s09d_id('a:type'), pg_temp.s09d_id('b:version'));
select is(pg_temp.s09d_outcome('t:notemplate'), 'NOT_FOUND', 'an absent template version is NOT_FOUND [P2-S09-AC-703]');
select pg_temp.s09d_resolve('t:noversion', pg_temp.s09d_id('t:templateVersion'), pg_temp.s09d_id('a:type'), extensions.gen_random_uuid());
select is(pg_temp.s09d_outcome('t:noversion'), 'NOT_FOUND', 'an absent candidate version is NOT_FOUND [P2-S09-AC-703]');
select pg_temp.s09d_resolve('t:crosstype', pg_temp.s09d_id('t:templateVersion'), pg_temp.s09d_id('x:type'), pg_temp.s09d_id('b:version'));
select is(pg_temp.s09d_outcome('t:crosstype'), 'NOT_FOUND',
  'a candidate version that does not belong to the named content type is NOT_FOUND (never resolved implicitly) [P2-S09-AC-699]');
select pg_temp.s09d_resolve('t:hidden', pg_temp.s09d_id('t:templateVersion'), pg_temp.s09d_id('a:type'), pg_temp.s09d_id('b:version'), 'other');
select is(pg_temp.s09d_outcome('t:hidden'), 'NOT_FOUND', 'a cross-owner template/type/version is concealed as NOT_FOUND [P2-S09-AC-699] [P2-S09-AC-709]');
select pg_temp.s09d_resolve('t:implicit', pg_temp.s09d_id('t:templateVersion'), pg_temp.s09d_id('a:type'), pg_temp.s09d_id('b:version'),
  'owner', jsonb_build_object('latest', true));
select is(pg_temp.s09d_outcome('t:implicit'), 'INVALID_REQUEST', 'an implicit current/latest selector is an unknown key (400) [P2-S09-AC-699]');
select pg_temp.s09d_session('owner');
select pg_temp.s09d_call('t:nover', 'platform_api.cms_resolve_template_compatibility', jsonb_build_object(
  'templateVersionId', pg_temp.s09d_id('t:templateVersion'), 'contentTypeId', pg_temp.s09d_id('a:type'),
  'context', pg_temp.s09d_context('owner')));
select is(pg_temp.s09d_outcome('t:nover'), 'INVALID_REQUEST', 'the exact candidate contentTypeVersionId is required (400) [P2-S09-AC-699]');
select ok(pg_temp.s09d_outcome('t:ok') = 'OK' and pg_temp.s09d_fingerprint() = (select fingerprint from s09d_baseline),
  'success and every typed failure leave definitions, reviews, plans, idempotency, audit and outbox unchanged [P2-S09-AC-707]');

-- A withdrawn template (state shifted on the real draft row, never forged).
select pg_temp.s09d_template('w', 's09d-withdrawn-template', 'a');
select pg_temp.s09d_timewarp('cms_template_versions', format($q$update platform_private.cms_template_versions
   set state = 'retired' where id = %L$q$, pg_temp.s09d_id('w:templateVersion')));
select pg_temp.s09d_resolve('t:withdrawn', pg_temp.s09d_id('w:templateVersion'), pg_temp.s09d_id('a:type'), pg_temp.s09d_id('b:version'));
select ok(pg_temp.s09d_outcome('w:template') = 'OK' and pg_temp.s09d_outcome('t:withdrawn') = 'WITHDRAWN',
  'a withdrawn template definition is the typed failure WITHDRAWN [P2-S09-AC-705]');

select ok(to_regprocedure('platform_api.cms_resolve_template_compatibility(jsonb)') is not null
    and not has_function_privilege('service_role', to_regprocedure('platform_api.cms_resolve_template_compatibility(jsonb)'), 'execute')
    and not has_function_privilege('authenticated', to_regprocedure('platform_api.cms_resolve_template_compatibility(jsonb)'), 'execute')
    and not has_function_privilege('anon', to_regprocedure('platform_api.cms_resolve_template_compatibility(jsonb)'), 'execute'),
  'the resolver is DB-internal: no API role can execute it, the activation preflight calls the platform_private resolver [P2-S09-AC-708] [P2-S09-AC-180]');

select * from finish();
rollback;
