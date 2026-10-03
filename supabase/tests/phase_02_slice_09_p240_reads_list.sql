\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

-- Slice 09 pre-amendment criteria, database half (lane p240-db): the protected registry
-- list CMS-03A-06.  A real owner organization holds types, fields, relations, artifacts
-- and signed blocks; a second organization holds one type; one human reads with
-- cms.schema_registry.read only and one holds no CMS capability.  Every read is
-- compared with a fingerprint of every table a read must not touch.

\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_p240/00-a01.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc

create or replace function pg_temp.p_fp() returns text language sql as $body$
  select md5(concat_ws('|', pg_temp.s09d_fingerprint(true),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_field_definition_versions t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_relation_definitions t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_schema_artifacts t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_content_types t),
    (select coalesce(string_agg(t::text, ',' order by t.id), '') from platform_private.cms_block_definition_versions t),
    (select count(*) from platform_private.cms_block_definition_lifecycle_events), (select count(*) from platform_private.cms_release_nonce_receipts),
    (select count(*) from platform_private.jobs)))
$body$;
create or replace function pg_temp.p_list(p_label text, p_actor text, p_req jsonb) returns text language plpgsql as $body$
begin
  perform pg_temp.s09d_rpc(p_label, 'platform_api.cms_list_content_types', p_actor, p_req);
  return pg_temp.s09d_outcome(p_label);
end;
$body$;
-- one list call that must leave every table untouched; returns the outcome token
create or replace function pg_temp.p_read(p_label text, p_actor text, p_req jsonb) returns text language plpgsql as $body$
declare before_fp text := pg_temp.p_fp(); outcome text;
begin
  outcome := pg_temp.p_list(p_label, p_actor, p_req);
  return case when before_fp = pg_temp.p_fp() then outcome else 'MUTATED:' || outcome end;
end;
$body$;
create or replace function pg_temp.p_items(p_label text) returns jsonb language sql stable as $body$ select coalesce(pg_temp.s09d_resp(p_label)->'items', '[]'::jsonb) $body$;

-- fixtures ----------------------------------------------------------------------
select pg_temp.s09d_grant_specialist('designer2', 'cms.schema_registry.read');
select pg_temp.s09d_revoke_via_rpc('designer2', 'cms.schema_designer');
select pg_temp.s09d_rpc('fx:a', 'platform_api.cms_create_type_draft', 'owner', pg_temp.p_base('rd_alpha', jsonb_build_object('fields',
  (select jsonb_agg(pg_temp.p_field('f' || lpad(g::text, 3, '0'), 'short_text')) from generate_series(1, 40) g))));
select pg_temp.s09d_rpc('fx:b', 'platform_api.cms_create_type_draft', 'owner', pg_temp.p_base('rd_beta', jsonb_build_object(
  'fields', jsonb_build_array(pg_temp.p_field('title', 'short_text'), pg_temp.p_field('related', 'relation', '{"stableFieldId":"a9d10000-0000-4000-8000-0000000f0aaa"}')),
  'relations', jsonb_build_array(jsonb_build_object('fieldId', 'a9d10000-0000-4000-8000-0000000f0aaa', 'targetKind', 'domain', 'targetType', 'profile', 'projectionKey', 'profile.summary',
    'cardinality', 'many', 'min', 0, 'max', 3, 'ordered', false, 'onUnavailable', 'omit')))));
select pg_temp.s09d_rpc('fx:c', 'platform_api.cms_create_type_draft', 'owner', pg_temp.p_base('rd_gamma', '{"capabilityBindings":[{"capabilityKey":"cms.editor","capabilityVersion":"1"}]}'));
select pg_temp.s09d_rpc('fx:o', 'platform_api.cms_create_type_draft', 'other', pg_temp.p_base('rd_other'));
select pg_temp.s09d_remember('rd:alpha:type', (pg_temp.s09d_resp('fx:a')->>'contentTypeId')::uuid);
select pg_temp.s09d_remember('rd:alpha:version', (pg_temp.s09d_resp('fx:a')->>'id')::uuid);
select pg_temp.s09d_remember('rd:other:type', (pg_temp.s09d_resp('fx:o')->>'contentTypeId')::uuid);
select pg_temp.s09d_remember('rd:other:version', (pg_temp.s09d_resp('fx:o')->>'id')::uuid);
select pg_temp.p_register('fx:blk1', pg_temp.p_block_request('rdhero', 1));
select pg_temp.p_register('fx:blk2', pg_temp.p_block_request('rdhero', 2));
select pg_temp.p_advance('fx:blk2d', pg_temp.p_lifecycle_request((pg_temp.s09d_resp('fx:blk2')->>'id')::uuid, 'supported', 'deprecated'));
select is(pg_temp.s09d_outcome('fx:a') || pg_temp.s09d_outcome('fx:b') || pg_temp.s09d_outcome('fx:c') || pg_temp.s09d_outcome('fx:o') || pg_temp.s09d_outcome('fx:blk1') || pg_temp.s09d_outcome('fx:blk2') || pg_temp.s09d_outcome('fx:blk2d'),
  'OKOKOKOKOKOKOK', 'fixture: four type drafts, two signed blocks and one deprecation exist through the named RPCs');

-- ===================================== AC124 strict query before authorization ====
select is(pg_temp.p_read('q:unknown', 'owner', '{"bogus":"x"}'), 'INVALID_REQUEST', 'an unknown query key is 400 INVALID_REQUEST and nothing is touched [P2-S09-AC-124]');
select set_config('app.actor_auth_user_id', '', true), set_config('app.auth_user_id', '', true), set_config('app.actor_person_id', '', true), pg_temp.set_jwt_claim('sub', '', true);
select pg_temp.s09d_call('q:unknown:anon', 'platform_api.cms_list_content_types', '{"bogus":"x"}');
select is(pg_temp.s09d_outcome('q:unknown:anon'), 'INVALID_REQUEST', 'the unknown key is refused before authorization: an unauthenticated caller gets the structural error, not 401 [P2-S09-AC-124]');
select pg_temp.s09d_call('q:valid:anon', 'platform_api.cms_list_content_types', '{}');
select is(pg_temp.s09d_outcome('q:valid:anon'), 'UNAUTHENTICATED', 'while a well-formed query without a verified actor is 401 [P2-S09-AC-124]');
select is(pg_temp.p_read('q:idem', 'owner', '{"idempotencyKey":"p240-list-idem-0001"}'), 'INVALID_REQUEST', 'an Idempotency-Key member is refused [P2-S09-AC-138]');
select is(pg_temp.p_read('q:ifmatch', 'owner', '{"ifMatch":"1"}'), 'INVALID_REQUEST', 'an If-Match member is refused [P2-S09-AC-138]');
select is(pg_temp.p_read('q:body', 'owner', '{"body":{"x":1}}'), 'INVALID_REQUEST', 'a request body member is refused [P2-S09-AC-138]');
select is(pg_temp.p_read('q:ok', 'owner', '{}'), 'OK', 'control: the plain query succeeds and mutates nothing: no row, idempotency record, audit, outbox, lease or job changes [P2-S09-AC-138]');
select is(pg_temp.p_read('q:ok2', 'owner', '{"resourceKind":"content_type","limit":2,"sort":"updatedAt","direction":"desc"}'), 'OK', 'a filtered, sorted, paged query mutates nothing either [P2-S09-AC-138]');
select is(pg_temp.p_read('q:denied', 'rev2', '{}'), 'FORBIDDEN', 'a refused read mutates nothing [P2-S09-AC-138]');

-- ============================ AC125 / AC126 / AC127 / AC128 / AC129 / AC130 filters ====
select is(pg_temp.p_read('k:' || k, 'owner', jsonb_build_object('resourceKind', k, 'limit', 100)), 'OK', 'resourceKind ' || k || ' is a declared discriminator [P2-S09-AC-125]')
from unnest(array['content_type', 'content_type_version', 'field_definition_version', 'relation_definition', 'schema_artifact', 'block_definition_registry_record', 'template_binding', 'capability_binding']) k;
select is(pg_temp.p_read('k:bad:' || c.n, 'owner', jsonb_build_object('resourceKind', c.v)), 'VALIDATION_FAILED', 'resourceKind ' || c.n || ' is refused [P2-S09-AC-125]')
from (values ('outside the eight', 'table'), ('uppercase', 'CONTENT_TYPE'), ('plural', 'content_types'), ('empty-looking padded', ' content_type')) c(n, v);
select is((select count(distinct i->>'resourceKind')::integer from jsonb_array_elements(pg_temp.s09d_resp('k:content_type')->'items') i), 1, 'each page carries one discriminator [P2-S09-AC-125]');
select is(pg_temp.p_read('p:ok', 'owner', '{"keyPrefix":"rd_"}'), 'OK', 'control: a lowercase allowlisted keyPrefix is accepted [P2-S09-AC-126]');
select is((select string_agg(distinct i->>'typeKey', ',') from jsonb_array_elements(pg_temp.p_items('p:ok')) i where i->>'resourceKind' = 'content_type'), 'rd_alpha,rd_beta,rd_gamma', 'the prefix filter returns the matching keys of the acting scope only [P2-S09-AC-126]');
select is(pg_temp.p_read('p:bad:' || c.n, 'owner', jsonb_build_object('keyPrefix', c.v)), 'VALIDATION_FAILED', 'keyPrefix ' || c.n || ' is refused [P2-S09-AC-126]')
from (values ('with an uppercase letter', 'Rd_'), ('with a leading digit', '1rd'), ('with a wildcard', 'rd%'), ('with a space', 'rd x'), ('of 65 characters', 'a' || repeat('b', 64)), ('that is empty-quoted', '''')) c(n, v);
select is(pg_temp.p_read('p:max', 'owner', jsonb_build_object('keyPrefix', 'a' || repeat('b', 63))), 'OK', 'a 64-character prefix is accepted [P2-S09-AC-126]');
select is(pg_temp.p_read('l:' || c.k || ':' || c.l, 'owner', jsonb_build_object('resourceKind', c.k, 'lifecycle', c.l)), 'OK', 'lifecycle ' || c.l || ' is accepted for ' || c.k || ' [P2-S09-AC-127]')
from (values ('content_type', 'active'), ('content_type', 'retired'), ('field_definition_version', 'active'), ('field_definition_version', 'deprecated'), ('field_definition_version', 'retired'),
  ('block_definition_registry_record', 'supported'), ('block_definition_registry_record', 'deprecated'), ('block_definition_registry_record', 'withdrawn')) c(k, l);
select is(pg_temp.p_read('l:bad:' || c.k || ':' || c.l, 'owner', jsonb_build_object('resourceKind', c.k, 'lifecycle', c.l)), 'VALIDATION_FAILED', 'lifecycle ' || c.l || ' is refused for ' || c.k || ': the value is not one of that kind''s lifecycles [P2-S09-AC-127]')
from (values ('content_type', 'withdrawn'), ('content_type', 'supported'), ('content_type', 'deprecated'), ('field_definition_version', 'withdrawn'), ('field_definition_version', 'supported'),
  ('block_definition_registry_record', 'active'), ('block_definition_registry_record', 'retired')) c(k, l);
select is(pg_temp.p_read('l:union:' || l, 'owner', jsonb_build_object('lifecycle', l)), 'OK', 'lifecycle ' || l || ' without a kind is accepted as a closed-union member [P2-S09-AC-127]') from unnest(array['active', 'retired', 'deprecated', 'supported', 'withdrawn']) l;
select is(pg_temp.p_read('l:union:bad', 'owner', '{"lifecycle":"draft"}'), 'VALIDATION_FAILED', 'a state value is not a lifecycle value [P2-S09-AC-127]');
select is(pg_temp.p_read('s:' || c.k || ':' || c.s, 'owner', jsonb_build_object('resourceKind', c.k, 'state', c.s)), 'OK', 'state ' || c.s || ' is accepted for the state-only kind ' || c.k || ' [P2-S09-AC-128]')
from (values ('content_type_version', 'draft'), ('content_type_version', 'active'), ('relation_definition', 'draft'), ('schema_artifact', 'compiled'), ('template_binding', 'draft'), ('capability_binding', 'draft')) c(k, s);
select is(pg_temp.p_read('s:bad:' || c.k || ':' || c.s, 'owner', jsonb_build_object('resourceKind', c.k, 'state', c.s)), 'VALIDATION_FAILED', 'state ' || c.s || ' is refused for ' || c.k || ' [P2-S09-AC-128]')
from (values ('schema_artifact', 'draft'), ('schema_artifact', 'active'), ('content_type_version', 'compiled'), ('content_type_version', 'withdrawn'), ('relation_definition', 'compiled'), ('capability_binding', 'supported')) c(k, s);
select is(pg_temp.p_read('s:never-lifecycle', 'owner', '{"resourceKind":"content_type_version","state":"active"}'), 'OK', 'a state value on a state-only kind is read as a state, never as a lifecycle [P2-S09-AC-128]');
select is((select count(*)::integer from jsonb_array_elements(pg_temp.p_items('s:never-lifecycle')) i where i->>'state' is distinct from 'active' and i->>'state' is not null), 0, 'every returned version row carries the requested state [P2-S09-AC-128]');
select is(pg_temp.p_read('x:' || c.k, 'owner', jsonb_build_object('resourceKind', c.k, 'lifecycle', 'active')), 'VALIDATION_FAILED', 'lifecycle on the state-only kind ' || c.k || ' is refused [P2-S09-AC-129]')
from unnest(array['content_type_version', 'relation_definition', 'schema_artifact', 'template_binding', 'capability_binding']) c(k);
select is(pg_temp.p_read('x:' || c.k, 'owner', jsonb_build_object('resourceKind', c.k, 'state', 'draft')), 'VALIDATION_FAILED', 'state on the lifecycle-bearing kind ' || c.k || ' is refused [P2-S09-AC-129]')
from unnest(array['content_type', 'field_definition_version', 'block_definition_registry_record']) c(k);
select is(pg_temp.p_read('x:both', 'owner', '{"lifecycle":"active","state":"draft"}'), 'VALIDATION_FAILED', 'lifecycle and state together are refused [P2-S09-AC-129]');
select is(pg_temp.p_read('o:active', 'owner', '{"lifecycle":"active","limit":100}'), 'OK', 'an omitted resourceKind with a lifecycle filter is accepted [P2-S09-AC-130]');
select is((select string_agg(distinct i->>'resourceKind', ',' order by i->>'resourceKind') from jsonb_array_elements(pg_temp.p_items('o:active')) i), 'field_definition_version',
  'the filter applied only to lifecycle-bearing kinds whose lifecycle can be active: no state-only kind appears, and the supported blocks and retired-state types do not match [P2-S09-AC-130]');
select is(pg_temp.p_read('o:withdrawn', 'owner', '{"lifecycle":"withdrawn"}'), 'OK', 'a lifecycle no row has returns an empty page, not an error [P2-S09-AC-130]');
select is(jsonb_array_length(pg_temp.p_items('o:withdrawn')), 0, 'and no state-only match [P2-S09-AC-130]');

-- ======================================== AC131 limit, AC132 cursor, AC133 sort ====
select is(pg_temp.p_read('lim:default', 'owner', '{"resourceKind":"field_definition_version"}'), 'OK', 'control: the default limit query succeeds [P2-S09-AC-131]');
select is(jsonb_array_length(pg_temp.p_items('lim:default')), 25, 'the limit defaults to 25 over 43 field rows [P2-S09-AC-131]');
select ok(pg_temp.s09d_resp('lim:default')->>'nextCursor' is not null, 'and a next cursor is issued [P2-S09-AC-131]');
select is(pg_temp.p_read('lim:100', 'owner', '{"resourceKind":"field_definition_version","limit":100}'), 'OK', 'limit 100 is the largest accepted [P2-S09-AC-131]');
select is(jsonb_array_length(pg_temp.p_items('lim:100')), 43, 'all 43 field rows fit under 100 and the cursor is null [P2-S09-AC-131]');
select is(pg_temp.s09d_resp('lim:100')->'nextCursor', 'null'::jsonb, 'nextCursor is a nullable member: null on the last page [P2-S09-AC-134]');
select is(pg_temp.p_read('lim:1', 'owner', '{"limit":1}'), 'OK', 'limit 1 is the smallest accepted [P2-S09-AC-131]');
select is(jsonb_array_length(pg_temp.p_items('lim:1')), 1, 'it returns exactly one item [P2-S09-AC-131]');
select is(pg_temp.p_read('lim:bad:' || l, 'owner', jsonb_build_object('limit', l)), 'VALIDATION_FAILED', 'limit ' || l || ' is refused [P2-S09-AC-131]') from unnest(array[0, 101, -1, 1000]) l;
select is(pg_temp.p_read('lim:text', 'owner', '{"limit":"many"}'), 'INVALID_REQUEST', 'a non-numeric limit is a malformed query [P2-S09-AC-131]');
select pg_temp.p_list('pg:1', 'owner', '{"resourceKind":"field_definition_version","limit":10,"sort":"key","direction":"asc"}');
create temp table p_pages on commit drop as select 1 as n, pg_temp.s09d_outcome('pg:1') as outcome, pg_temp.s09d_resp('pg:1')->>'nextCursor' as cursor;
select is(pg_temp.p_read('cur:ok', 'owner', jsonb_build_object('resourceKind', 'field_definition_version', 'limit', 10, 'sort', 'key', 'direction', 'asc', 'cursor', (select cursor from p_pages))), 'OK',
  'control: the issued cursor resumes the same query [P2-S09-AC-132]');
select is(pg_temp.p_read('cur:' || c.n, 'owner', c.req || jsonb_build_object('cursor', (select cursor from p_pages))), 'INVALID_REQUEST', 'the cursor is bound to the query: ' || c.n || ' makes it invalid [P2-S09-AC-132]')
from (values ('another resourceKind', '{"resourceKind":"relation_definition","limit":10,"sort":"key","direction":"asc"}'::jsonb), ('another sort', '{"resourceKind":"field_definition_version","limit":10,"sort":"version","direction":"asc"}'),
  ('another direction', '{"resourceKind":"field_definition_version","limit":10,"sort":"key","direction":"desc"}'), ('another limit', '{"resourceKind":"field_definition_version","limit":11,"sort":"key","direction":"asc"}'),
  ('another keyPrefix', '{"resourceKind":"field_definition_version","limit":10,"sort":"key","direction":"asc","keyPrefix":"f"}'), ('another lifecycle', '{"resourceKind":"field_definition_version","limit":10,"sort":"key","direction":"asc","lifecycle":"active"}')) c(n, req);
select is(pg_temp.p_read('cur:actor', 'designer2', jsonb_build_object('resourceKind', 'field_definition_version', 'limit', 10, 'sort', 'key', 'direction', 'asc', 'cursor', (select cursor from p_pages))), 'INVALID_REQUEST',
  'the cursor is bound to the acting scope and actor: another human cannot use it [P2-S09-AC-132]');
select is(pg_temp.p_read('cur:other', 'other', jsonb_build_object('resourceKind', 'field_definition_version', 'limit', 10, 'sort', 'key', 'direction', 'asc', 'cursor', (select cursor from p_pages))), 'INVALID_REQUEST',
  'nor another organization [P2-S09-AC-132]');
select is(pg_temp.p_read('cur:garbage', 'owner', '{"cursor":"%%%not-base64%%%"}'), 'INVALID_REQUEST', 'a cursor that does not decode is refused [P2-S09-AC-132]');
select is(pg_temp.p_read('cur:json', 'owner', jsonb_build_object('cursor', replace(encode(convert_to('{"queryHash":"x"}', 'utf8'), 'base64'), E'\n', ''))), 'INVALID_REQUEST', 'a cursor without the bound members is refused [P2-S09-AC-132]');
select is(pg_temp.p_read('cur:long', 'owner', jsonb_build_object('cursor', repeat('A', 513))), 'VALIDATION_FAILED', 'a cursor of 513 characters is refused [P2-S09-AC-132]');
select is(pg_temp.p_read('cur:empty', 'owner', '{"cursor":""}'), 'OK', 'an empty cursor is no cursor [P2-S09-AC-132]');
select ok(length((select cursor from p_pages)) between 1 and 512 and (select cursor from p_pages) ~ '^[A-Za-z0-9+/=]+$', 'an issued cursor is opaque base64 of at most 512 characters [P2-S09-AC-132]');
create or replace function pg_temp.p_walk(p_req jsonb) returns text language plpgsql as $body$
declare cursor_value text; page jsonb; ids text := ''; guard integer := 0;
begin
  loop
    page := platform_api.cms_list_content_types(p_req || case when cursor_value is null then '{}'::jsonb else jsonb_build_object('cursor', cursor_value) end);
    ids := ids || coalesce((select string_agg(i->>'id', ',' order by ord) from jsonb_array_elements(page->'items') with ordinality t(i, ord)), '') || ',';
    cursor_value := page->>'nextCursor';
    guard := guard + 1;
    exit when cursor_value is null or guard > 200;
  end loop;
  return ids;
end;
$body$;
select pg_temp.s09d_session('owner', 'authenticated');
select is(pg_temp.p_walk('{"limit":7,"sort":"key","direction":"asc"}'), pg_temp.p_walk('{"limit":100,"sort":"key","direction":"asc"}'),
  'walking every page of seven in key order visits the same items in the same order as one page of one hundred [P2-S09-AC-133]');
select is(pg_temp.p_walk('{"limit":5,"sort":"createdAt","direction":"desc"}'), pg_temp.p_walk('{"limit":100,"sort":"createdAt","direction":"desc"}'),
  'creation order paging is stable even where rows share one timestamp: the immutable id breaks ties [P2-S09-AC-133]');
select is(pg_temp.p_walk('{"limit":9,"sort":"updatedAt","direction":"asc"}'), pg_temp.p_walk('{"limit":100,"sort":"updatedAt","direction":"asc"}'), 'updatedAt order pages without a gap or a repeat [P2-S09-AC-133]');
select is(pg_temp.p_walk('{"limit":6,"sort":"version","direction":"desc"}'), pg_temp.p_walk('{"limit":100,"sort":"version","direction":"desc"}'), 'version order pages without a gap or a repeat [P2-S09-AC-133]');
select is((select count(*) = count(distinct x) from unnest(string_to_array(trim(both ',' from pg_temp.p_walk('{"limit":4,"sort":"key","direction":"asc"}')), ',')) x where x <> ''), true, 'no item appears twice across pages [P2-S09-AC-133]');
select is((select string_agg(i->>'typeKey', ',' order by ord) from jsonb_array_elements(platform_api.cms_list_content_types('{"resourceKind":"content_type","sort":"key","direction":"asc"}')->'items') with ordinality t(i, ord)), 'rd_alpha,rd_beta,rd_gamma', 'key ascending is byte-wise key order [P2-S09-AC-133]');
select is((select string_agg(i->>'typeKey', ',' order by ord) from jsonb_array_elements(platform_api.cms_list_content_types('{"resourceKind":"content_type","sort":"key","direction":"desc"}')->'items') with ordinality t(i, ord)), 'rd_gamma,rd_beta,rd_alpha', 'key descending reverses it [P2-S09-AC-133]');
select is(pg_temp.p_list('so:bad1', 'owner', '{"sort":"title"}'), 'VALIDATION_FAILED', 'a sort outside key, createdAt, updatedAt and version is refused [P2-S09-AC-133]');
select is(pg_temp.p_list('so:bad2', 'owner', '{"direction":"up"}'), 'VALIDATION_FAILED', 'a direction other than asc or desc is refused [P2-S09-AC-133]');

-- ====================================== AC134 / AC135 / AC145 / AC137 / AC146 safe projections ====
select is(pg_temp.p_read('r:all', 'owner', '{"limit":100}'), 'OK', 'control: the unfiltered list succeeds [P2-S09-AC-134]');
select ok(pg_temp.s09d_resp('r:all') ?& array['items', 'nextCursor'] and jsonb_typeof(pg_temp.s09d_resp('r:all')->'items') = 'array', 'the page is { items, nextCursor } [P2-S09-AC-134]');
select is((select string_agg(distinct i->>'resourceKind', ',' order by i->>'resourceKind') from jsonb_array_elements(pg_temp.p_items('r:all')) i),
  'block_definition_registry_record,capability_binding,content_type,content_type_version,field_definition_version,relation_definition,schema_artifact',
  'items are discriminated by resourceKind and include the block registry records of the registered blocks [P2-S09-AC-134]');
select is((select count(*)::integer from jsonb_array_elements(pg_temp.p_items('r:all')) i where i->>'resourceKind' = 'block_definition_registry_record'), 2, 'both registered blocks are listed to the authorized reader [P2-S09-AC-135]');
select is((select string_agg(k, ',' order by k) from (select distinct jsonb_object_keys(i) k from jsonb_array_elements(pg_temp.p_items('r:all')) i where i->>'resourceKind' = 'block_definition_registry_record') x),
  'blockKey,blockVersion,id,lifecycle,propsSchemaHash,propsSchemaRef,releaseDigest,rendererRef,resourceKind,version',
  'a block row is the safe BlockDefinitionRegistryRecord: registry identity, lifecycle, release digest, props reference and hash and renderer identity only [P2-S09-AC-135]');
select is((select count(*)::integer from jsonb_array_elements(pg_temp.p_items('r:all')) i, jsonb_object_keys(i) k
    where i->>'resourceKind' = 'block_definition_registry_record' and k = any(array['propsSchemaSnapshot', 'propsSnapshotAttestation', 'propsSnapshotHash', 'releaseKeyId', 'releaseRawBodyHash', 'releaseNonceHash',
      'releaseSignatureHash', 'releaseVerifiedAt', 'releasePrincipalId', 'source', 'executableEvidence', 'ownerId', 'allowedChildren', 'slotRules', 'dataSourcePermissions'])), 0,
  'no block row carries the snapshot, attestation, release key, body or nonce hash, verification time, source or owner [P2-S09-AC-135]');
select is((select string_agg(i->>'blockVersion' || ':' || (i->>'lifecycle'), ',' order by i->>'blockVersion') from jsonb_array_elements(pg_temp.p_items('r:all')) i where i->>'resourceKind' = 'block_definition_registry_record'), '1:supported,2:deprecated',
  'a block row carries the lifecycle derived from its events [P2-S09-AC-135]');
select is(pg_temp.p_read('r:blk:dep', 'owner', '{"resourceKind":"block_definition_registry_record","lifecycle":"deprecated"}'), 'OK', 'a block lifecycle filter selects by the derived lifecycle [P2-S09-AC-135]');
select is((select string_agg(i->>'blockVersion', ',') from jsonb_array_elements(pg_temp.p_items('r:blk:dep')) i), '2', 'only the deprecated block matches [P2-S09-AC-135]');
select is((select count(*)::integer from jsonb_array_elements(pg_temp.p_items('r:all')) i, jsonb_object_keys(i) k where k ~* '(ownerid|owner_id|created_?by|actor|person|party|binding_?hash|private)'), 0,
  'no list item of any kind carries an ownership, actor, party or private binding member [P2-S09-AC-135]');
select is((select count(*)::integer from jsonb_array_elements(pg_temp.p_items('r:all')) i where i::text ~* '(propsSchemaSnapshot|propsSnapshotAttestation|releaseRawBodyHash|releaseNonceHash|releaseSignatureHash|approvalEvidenceHash)'), 0,
  'worker-only evidence and frozen approval hashes never enter a list payload [P2-S09-AC-137]');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'platform_private' and p.proname = 'cms_list_content_types'
    and (case when p.prokind = 'f' then pg_get_functiondef(p.oid) end) ~* '(cms_publication_versions|cms_composition_instances|cms_publication_schedules|public_api\.|cms_entry_revisions|cms_locale_variants)'), 0,
  'the list function reads no public delivery, publication, entry or revision table [P2-S09-AC-137]');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'platform_private' and p.proname in ('cms_list_content_types', 'cms_get_content_type_version')
    and (case when p.prokind = 'f' then pg_get_functiondef(p.oid) end) ~* '(cms_publication_versions|cms_composition_instances|cms_publication_schedules|public_api\.|cms_entry_revisions|cms_locale_variants|cms_content_entries)'), 0,
  'neither registry projection selects public delivery or entry tables: they stay inside Shard 03 [P2-S09-AC-013]');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public_api' and (case when p.prokind = 'f' then pg_get_functiondef(p.oid) end) ~* 'platform_private\.cms_(content_types|content_type_versions|field_definition_versions|relation_definitions|schema_artifacts|schema_migration_plans|schema_reviews|block_definition_versions)'), 0,
  'no public_api function selects a draft or control-plane registry table: public routes cannot reach them [P2-S09-AC-014]');
select is((select count(*)::integer from information_schema.role_table_grants g where g.grantee in ('anon', 'authenticated', 'public') and g.table_schema = 'platform_private' and g.table_name like 'cms\_%'), 0,
  'no browser or public role holds a privilege on any cms_ table, so no public path can select a registry or delivery draft directly [P2-S09-AC-014]');

-- ===================================== AC136 capability scope and concealed rows ====
select is(pg_temp.p_read('c:owner', 'owner', '{"resourceKind":"content_type"}'), 'OK', 'a schema designer reads the registry [P2-S09-AC-136]');
select is(pg_temp.p_read('c:reader', 'designer2', '{"resourceKind":"content_type"}'), 'OK', 'a human whose only capability is cms.schema_registry.read (designer2, whose designer grant was revoked) reads it as well [P2-S09-AC-136]');
select is(pg_temp.p_read('c:none', 'rev2', '{"resourceKind":"content_type"}'), 'FORBIDDEN', 'an authenticated human with no CMS capability is 403 FORBIDDEN [P2-S09-AC-136]');
select is(pg_temp.p_read('c:person', 'rev3', '{}'), 'FORBIDDEN', 'a second capability-less human is 403 as well [P2-S09-AC-136]');
select is((select string_agg(i->>'typeKey', ',' order by i->>'typeKey') from jsonb_array_elements(pg_temp.p_items('c:reader')) i), 'rd_alpha,rd_beta,rd_gamma', 'the reader sees exactly the owner organization''s types [P2-S09-AC-136]');
select is(pg_temp.p_read('c:other', 'other', '{"resourceKind":"content_type"}'), 'OK', 'the other organization''s designer reads its own scope [P2-S09-AC-136]');
select is((select string_agg(i->>'typeKey', ',') from jsonb_array_elements(pg_temp.p_items('c:other')) i), 'rd_other', 'and sees only its own type: the owner organization''s rows are omitted, not 403 [P2-S09-AC-136]');
select is(pg_temp.p_read('c:other:fields', 'other', '{"resourceKind":"field_definition_version","limit":100}'), 'OK', 'child rows are scoped the same way [P2-S09-AC-136]');
select is(jsonb_array_length(pg_temp.p_items('c:other:fields')), 1, 'the other organization sees one field, not the owner''s 43 [P2-S09-AC-136]');
select pg_temp.s09d_rpc('c:ctx', 'platform_api.cms_list_content_types', 'owner', '{}', false, jsonb_build_object('actingPartyId', pg_temp.s09d_id('otherOrg')));
select ok(pg_temp.s09d_outcome('c:ctx') in ('FORBIDDEN', 'NOT_FOUND'), 'an acting context the human is not bound to is refused, never widened [P2-S09-AC-136]');
select is((select count(*)::integer from jsonb_array_elements(pg_temp.p_items('c:ctx'))), 0, 'and returns no rows [P2-S09-AC-136]');

-- ================================================== AC198 A06 failure mapping ====
select is(pg_temp.p_read('e:cursor', 'owner', '{"cursor":"bm90LWEtY3Vyc29y"}'), 'INVALID_REQUEST', 'a malformed cursor is 400 INVALID_REQUEST and mutates nothing [P2-S09-AC-198]');
select set_config('app.actor_auth_user_id', '', true), set_config('app.auth_user_id', '', true), set_config('app.actor_person_id', '', true), pg_temp.set_jwt_claim('sub', '', true);
select pg_temp.s09d_call('e:anon', 'platform_api.cms_list_content_types', '{}');
select is(pg_temp.s09d_outcome('e:anon'), 'UNAUTHENTICATED', 'no verified actor is 401 UNAUTHENTICATED [P2-S09-AC-198]');
select is(pg_temp.p_read('e:forbid', 'rev2', '{}'), 'FORBIDDEN', 'a missing capability is 403 FORBIDDEN [P2-S09-AC-198]');
select is(pg_temp.p_read('e:valid', 'owner', '{"resourceKind":"content_type","lifecycle":"supported"}'), 'VALIDATION_FAILED', 'an incompatible filter is 422 VALIDATION_FAILED [P2-S09-AC-198]');
select is(pg_temp.p_read('e:ok', 'owner', '{}'), 'OK', 'control: the plain query succeeds after every failure [P2-S09-AC-198]');

select * from finish();
rollback;
