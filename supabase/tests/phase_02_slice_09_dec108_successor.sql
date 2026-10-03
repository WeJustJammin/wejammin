commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 DEC-108 QA-RED: CMS-03A-09 successor schema draft (BE03a route row,
-- field matrix, "DEC-108 activation producer flow", error matrix).  The source
-- is an immutable ACTIVE version reached only through the real producer chain.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc

select pg_temp.s09d_create_type('a', 'dec108succ');
select pg_temp.s09d_add_relation('a');
select pg_temp.s09d_to_active('a');
select is(pg_temp.s09d_scalar(format('select state from platform_private.cms_content_type_versions where id = %L',
    pg_temp.s09d_id('a:version'))), 'active', 'fixture: the source version is active via real producers');

create temp table s09d_source_snapshot on commit drop as
select pg_temp.s09d_scalar(format($q$select md5(
    (select row_to_json(v)::text from platform_private.cms_content_type_versions v where v.id = %1$L)
    || (select coalesce(string_agg(f::text, ',' order by f.id), '') from platform_private.cms_field_definition_versions f where f.content_type_version_id = %1$L)
    || (select coalesce(string_agg(a::text, ',' order by a.id), '') from platform_private.cms_schema_artifacts a where a.content_type_version_id = %1$L))$q$,
  pg_temp.s09d_id('a:version'))) as digest,
  pg_temp.s09d_fingerprint() as fingerprint;

select pg_temp.s09d_successor('b', 'a', 'owner', 's09d-successor-replay-0001');
select is(pg_temp.s09d_outcome('b:successor'), 'OK', 'CMS-03A-09 clones an immutable source into a successor draft [P2-S09-AC-294] [P2-S09-AC-298]');
select ok((select r->>'resourceKind' = 'content_type_version' and r->>'state' = 'draft'
    and r->>'typeKey' = 'dec108succ' and r->>'id' <> pg_temp.s09d_id('a:version')::text
    and r->>'contentTypeId' = pg_temp.s09d_id('a:type')::text
    and (r->>'fieldCount')::int = 2 and (r->>'relationCount')::int = 1
    from (select pg_temp.s09d_resp('b:successor') r) s),
  'the 201 ContentTypeVersionResource is a draft of the same type with the cloned field and relation counts [P2-S09-AC-294]');
select is(pg_temp.s09d_scalar(format('select version_no::text from platform_private.cms_content_type_versions where id = %L',
    pg_temp.s09d_id('b:version'))), '2', 'the successor carries the incremented version number [P2-S09-AC-294]');
select ok(coalesce(pg_temp.s09d_scalar(format($q$select (
    (select count(*) from platform_private.cms_field_definition_versions c
       join platform_private.cms_field_definition_versions s
         on s.content_type_version_id = %1$L and s.stable_field_id = c.stable_field_id
        and s.field_key = c.field_key and s.id <> c.id
      where c.content_type_version_id = %2$L) = 2
    and (select count(*) from platform_private.cms_field_definition_versions
         where content_type_version_id = %2$L) = 2)::text$q$,
  pg_temp.s09d_id('a:version'), pg_temp.s09d_id('b:version')))::boolean, false),
  'every cloned field gets a NEW row id while keeping its stable field id and immutable key [P2-S09-AC-295]');
select ok(coalesce(pg_temp.s09d_scalar(format($q$select (
    (select count(*) from platform_private.cms_relation_definitions r
       join platform_private.cms_field_definition_versions f on f.id = r.field_definition_id
      where f.content_type_version_id = %2$L) = 1
    and (select count(*) from platform_private.cms_relation_definitions r
       join platform_private.cms_field_definition_versions f on f.id = r.field_definition_id
      where f.content_type_version_id = %1$L) = 1)::text$q$,
  pg_temp.s09d_id('a:version'), pg_temp.s09d_id('b:version')))::boolean, false),
  'the cloned relation points at the successor''s own field row while the source keeps its own (local reference remapped) [P2-S09-AC-295]');
select is((select digest from s09d_source_snapshot),
  case when pg_temp.s09d_outcome('b:successor') <> 'OK' then 'no successor was produced' else pg_temp.s09d_scalar(format($q$select md5(
    (select row_to_json(v)::text from platform_private.cms_content_type_versions v where v.id = %1$L)
    || (select coalesce(string_agg(f::text, ',' order by f.id), '') from platform_private.cms_field_definition_versions f where f.content_type_version_id = %1$L)
    || (select coalesce(string_agg(a::text, ',' order by a.id), '') from platform_private.cms_schema_artifacts a where a.content_type_version_id = %1$L))$q$,
  pg_temp.s09d_id('a:version'))) end,
  'the immutable source row, fields and artifact are byte-for-byte untouched [P2-S09-AC-296]');
select is(pg_temp.s09d_scalar(format('select count(*)::text from platform_private.cms_content_type_versions where content_type_id = %L',
    pg_temp.s09d_id('a:type'))), '2', 'exactly one successor row was committed beside the source');
select ok(pg_temp.s09d_id('b:version') is not null and coalesce(pg_temp.s09d_scalar(format($q$select (
    (select count(*) from platform_private.cms_schema_dry_run_reports where target_version_id = %1$L) = 0
    and (select count(*) from platform_private.cms_schema_migration_plans where to_version_id = %1$L) = 0)::text$q$,
  pg_temp.s09d_id('b:version')))::boolean, false),
  'a successor never fabricates a dry-run report or plan (CMS-03A-10 owns them) [P2-S09-AC-099]');

-- Idempotent replay: the same key and body return the exact original resource.
select ok(pg_temp.s09d_outcome('b:successor') = 'OK'
  and pg_temp.s09d_rpc('b:replay', 'platform_api.cms_create_schema_successor', 'owner',
    jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
      'expectedVersion', pg_temp.s09d_version('a'), 'supportedLocales', null, 'fallbackChains', null,
      'idempotencyKey', 's09d-successor-replay-0001'))
    = pg_temp.s09d_resp('b:successor'),
  'a same-key replay returns the exact original successor resource [P2-S09-AC-300]');
select is(pg_temp.s09d_scalar(format('select count(*)::text from platform_private.cms_content_type_versions where content_type_id = %L',
    pg_temp.s09d_id('a:type'))), '2', 'the same-key replay does not clone a second time');

-- Refusals are atomic: capture the state after the committed clone.
create temp table s09d_refusal_baseline on commit drop as select pg_temp.s09d_fingerprint(false) as fingerprint;
select pg_temp.s09d_rpc('b:live', 'platform_api.cms_create_schema_successor', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'idempotencyKey', 's09d-successor-live-0001'));
select is(pg_temp.s09d_outcome('b:live'), 'CONFLICT',
  'a second successor while a live successor draft already exists for that source is a 409 CONFLICT (G12) [P2-S09-AC-301]');
select pg_temp.s09d_rpc('b:stale', 'platform_api.cms_create_schema_successor', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', '999', 'idempotencyKey', 's09d-successor-stale-0001'));
select is(pg_temp.s09d_outcome('b:stale'), 'VERSION_MISMATCH', 'a stale source If-Match (expectedVersion) is a 409 VERSION_MISMATCH');
select pg_temp.s09d_rpc('b:mismatch', 'platform_api.cms_create_schema_successor', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', '999', 'idempotencyKey', 's09d-successor-replay-0001'));
select is(pg_temp.s09d_outcome('b:mismatch'), 'CONFLICT', 'the same Idempotency-Key with a changed body is a 409 CONFLICT [P2-S09-AC-300]');
select pg_temp.s09d_rpc('b:pathkey', 'platform_api.cms_create_schema_successor', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', extensions.gen_random_uuid(),
    'expectedVersion', pg_temp.s09d_version('a'), 'idempotencyKey', 's09d-successor-replay-0001'));
select is(pg_temp.s09d_outcome('b:pathkey'), 'CONFLICT',
  'the same actor reusing the Idempotency-Key with a changed source version path is a 409 CONFLICT (BE00 request binding) [P2-S09-AC-300]');
select pg_temp.s09d_rpc('b:pathtype', 'platform_api.cms_create_schema_successor', 'owner',
  jsonb_build_object('contentTypeId', extensions.gen_random_uuid(), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'idempotencyKey', 's09d-successor-replay-0001'));
select is(pg_temp.s09d_outcome('b:pathtype'), 'CONFLICT',
  'the same actor reusing the Idempotency-Key with a changed content type path is a 409 CONFLICT [P2-S09-AC-300]');
select pg_temp.s09d_rpc('b:actorkey', 'platform_api.cms_create_schema_successor', 'other',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'idempotencyKey', 's09d-successor-replay-0001'));
select ok(pg_temp.s09d_outcome('b:actorkey') = 'NOT_FOUND' and pg_temp.s09d_resp('b:actorkey') is distinct from pg_temp.s09d_resp('b:successor'),
  'another actor with the same key is a distinct BE00 binding: evaluated freshly, never a replay of the first actor''s response [P2-S09-AC-300]');
select pg_temp.s09d_rpc('b:hidden', 'platform_api.cms_create_schema_successor', 'other',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'idempotencyKey', 's09d-successor-hidden-0001'));
select is(pg_temp.s09d_outcome('b:hidden'), 'NOT_FOUND', 'another organization''s designer sees the source as absent (404, not 403) [P2-S09-AC-298]');
select pg_temp.s09d_rpc('b:absent', 'platform_api.cms_create_schema_successor', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', extensions.gen_random_uuid(),
    'expectedVersion', '1', 'idempotencyKey', 's09d-successor-absent-0001'));
select is(pg_temp.s09d_outcome('b:absent'), 'NOT_FOUND', 'an absent source version is a 404 NOT_FOUND');
select pg_temp.s09d_rpc('b:denied', 'platform_api.cms_create_schema_successor', 'rev1',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'idempotencyKey', 's09d-successor-denied-0001'),
  false, jsonb_build_object('actingPartyId', pg_temp.s09d_id('ownerOrg')));
select is(pg_temp.s09d_outcome('b:denied'), 'FORBIDDEN',
  'a human without cms.schema_designer in the owner organization is a 403 FORBIDDEN [P2-S09-AC-298]');
select pg_temp.s09d_rpc('b:unknown', 'platform_api.cms_create_schema_successor', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'idempotencyKey', 's09d-successor-unknown-0001', 'extra', 'x'));
select is(pg_temp.s09d_outcome('b:unknown'), 'INVALID_REQUEST', 'an unknown top-level key is a 400 INVALID_REQUEST');
select pg_temp.s09d_rpc('b:nokey', 'platform_api.cms_create_schema_successor', 'owner',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a')));
select is(pg_temp.s09d_outcome('b:nokey'), 'INVALID_REQUEST', 'a missing Idempotency-Key is a 400 INVALID_REQUEST');
select set_config('request.jwt.claim.role', 'service_role', true);
select set_config('app.auth_user_id', '', true);
select set_config('app.actor_auth_user_id', '', true);
select pg_temp.s09d_call('b:anon', 'platform_api.cms_create_schema_successor',
  jsonb_build_object('contentTypeId', pg_temp.s09d_id('a:type'), 'versionId', pg_temp.s09d_id('a:version'),
    'expectedVersion', pg_temp.s09d_version('a'), 'idempotencyKey', 's09d-successor-anon-0001'));
select is(pg_temp.s09d_outcome('b:anon'), 'UNAUTHENTICATED', 'a request without a verified actor is a 401 UNAUTHENTICATED');
select ok(pg_temp.s09d_outcome('b:successor') = 'OK'
  and pg_temp.s09d_fingerprint(false) = (select fingerprint from s09d_refusal_baseline),
  'every refusal leaves definitions, reviews, plans, idempotency and outbox unchanged');

select ok(pg_temp.s09d_service_only('platform_api.cms_create_schema_successor(jsonb)')
  and to_regprocedure('platform_private.cms_create_schema_successor(jsonb)') is not null
  and not coalesce(has_function_privilege('authenticated', to_regprocedure('platform_private.cms_create_schema_successor(jsonb)'), 'execute'), true),
  'the successor RPC is service-role only; the private implementation is not browser-executable');

select * from finish();
rollback;
