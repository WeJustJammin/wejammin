-- Slice 10 semantic validation refusals carry bounded, safe violation pointers (Codex
-- write-path audit "Standardize semantic validation errors so SQL can return bounded
-- safe violation pointers instead of bare VALIDATION_FAILED"; P2-S10-AC-011/AC-023/
-- AC-034/AC-062; BE03b Pointers, "Error details use BE00 allowlists: 400/422 may carry at
-- most 50 JSON-pointer violations").
--
-- Convention (lane H, agreed with the Worker lane in NOTES): the reason token stays the
-- whole P0001 message (VALIDATION_FAILED or one of the lowercase reasons) and the
-- machine DETAIL is a JSON array of RFC 6901 pointers -- `/fields/{stableFieldId}` for a
-- refused field value, `/changedPaths/{i}` and `/choices/{i}` for the offending entry,
-- or the request member (`/locale`, `/baseRevision`, `/values`, ...) -- exactly what
-- the Worker's violationsFromDetailText accepts.  Only validated UUIDs and integer
-- indexes are interpolated: no caller value is ever echoed, which the last assertions
-- check on every captured detail.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_value_source/000-gallery-fixture.sqlinc
\ir phase_02_slice_10_relation_authoring/000-relation-fixture.sqlinc
\ir phase_02_slice_10_rpc/009-restore-policy-binding.sqlinc

select pg_temp.s10_rpc_as(
  (select value::uuid from s10_ids where key = 'creatorAuth'),
  (select value::uuid from s10_ids where key = 'organization'));

create temp table s10v_calls(label text primary key, state text, message text, detail text, response jsonb)
  on commit drop;
create or replace function pg_temp.s10v_call(p_label text, p_sql text)
returns void
language plpgsql
as $body$
declare
  result jsonb;
  error_detail text;
begin
  begin
    execute p_sql into result;
    insert into s10v_calls values (p_label, '00000', null, null, result);
  exception when others then
    get stacked diagnostics error_detail = pg_exception_detail;
    insert into s10v_calls values (p_label, sqlstate, sqlerrm, error_detail, null);
  end;
end;
$body$;
-- token + detail of one captured call
create or replace function pg_temp.s10v_out(p_label text)
returns text
language sql
stable
as $body$
  select coalesce((select coalesce(message, 'OK') || ' ' || coalesce(detail, '-') from s10v_calls where label = p_label), 'MISSING')
$body$;

-- ---- request builders (gallery type: rich_text/object; relation type: relations) --------
create or replace function pg_temp.s10v_gc(p_values jsonb, p_key text, p_patch jsonb default '{}'::jsonb)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_create_entry(' || quote_literal(
    (pg_temp.s10g_create_request(p_values, p_key) || p_patch)::text) || '::jsonb)'
$body$;
create or replace function pg_temp.s10v_rc(p_values jsonb, p_key text, p_patch jsonb default '{}'::jsonb)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_create_entry(' || quote_literal(
    (pg_temp.s10r_create_request(p_values, p_key) || p_patch)::text) || '::jsonb)'
$body$;
create or replace function pg_temp.s10v_ra(p_entry text, p_values jsonb, p_base text, p_expected text, p_key text, p_patch jsonb default '{}'::jsonb)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_create_revision(' || quote_literal(
    (pg_temp.s10r_revision_request(p_entry, p_values, p_base, p_expected, p_key) || p_patch)::text) || '::jsonb)'
$body$;

-- ---------------------------------------------------------------------- CMS-03B-10 ----
select pg_temp.s10v_call('c-type-id', pg_temp.s10v_rc('{"title":"x"}', 's10-ptr-c-0001', '{"contentTypeId":"nope"}'));
select is(pg_temp.s10v_out('c-type-id'), 'VALIDATION_FAILED ["/contentTypeId"]', 'create: a malformed contentTypeId is pointed at /contentTypeId');
select pg_temp.s10v_call('c-version-id', pg_temp.s10v_rc('{"title":"x"}', 's10-ptr-c-0002', '{"contentTypeVersionId":"nope"}'));
select is(pg_temp.s10v_out('c-version-id'), 'VALIDATION_FAILED ["/contentTypeVersionId"]', 'create: a malformed contentTypeVersionId is pointed at /contentTypeVersionId');
select pg_temp.s10v_call('c-locale', pg_temp.s10v_rc('{"title":"x"}', 's10-ptr-c-0003', '{"locale":"en_US"}'));
select is(pg_temp.s10v_out('c-locale'), 'VALIDATION_FAILED ["/locale"]', 'create: a malformed locale is pointed at /locale');
select pg_temp.s10v_call('c-locale-unsupported', pg_temp.s10v_rc('{"title":"x"}', 's10-ptr-c-0004', '{"locale":"ja-JP"}'));
select is(pg_temp.s10v_out('c-locale-unsupported'), 'VALIDATION_FAILED ["/locale"]', 'create: a locale outside the active schema locale set is pointed at /locale');
select pg_temp.s10v_call('c-artifact', pg_temp.s10v_rc('{"title":"x"}', 's10-ptr-c-0005',
  jsonb_build_object('schemaArtifact', (pg_temp.s10r_create_request('{"title":"x"}', 'k')->'schemaArtifact') || jsonb_build_object('artifactHash', repeat('0', 64)))));
select is(pg_temp.s10v_out('c-artifact'), 'VALIDATION_FAILED ["/schemaArtifact"]', 'create: a mismatching schema artifact is pointed at /schemaArtifact');
select pg_temp.s10v_call('c-paths-empty', pg_temp.s10v_rc('{"title":"x"}', 's10-ptr-c-0006', '{"changedPaths":[]}'));
select is(pg_temp.s10v_out('c-paths-empty'), 'VALIDATION_FAILED ["/changedPaths"]', 'create: an empty changedPaths is pointed at /changedPaths');
select pg_temp.s10v_call('c-paths-dup', pg_temp.s10v_rc('{"title":"x"}', 's10-ptr-c-0007',
  jsonb_build_object('changedPaths', jsonb_build_array('/fields/' || pg_temp.s10r_fid('title'), '/fields/' || pg_temp.s10r_fid('title')))));
select is(pg_temp.s10v_out('c-paths-dup'), 'VALIDATION_FAILED ["/changedPaths"]', 'create: duplicate changed paths are pointed at /changedPaths');
select pg_temp.s10v_call('c-paths-bad', pg_temp.s10v_rc('{"title":"x"}', 's10-ptr-c-0008',
  jsonb_build_object('changedPaths', jsonb_build_array('/fields/' || pg_temp.s10r_fid('title'), '/blocks/0'))));
select is(pg_temp.s10v_out('c-paths-bad'), 'VALIDATION_FAILED ["/changedPaths/1"]', 'create: a changed path outside the pointer grammar is pointed at its own index');
select pg_temp.s10v_call('c-paths-unknown', pg_temp.s10v_rc('{"title":"x"}', 's10-ptr-c-0009',
  jsonb_build_object('changedPaths', jsonb_build_array('/fields/a9100000-0000-4000-8000-0000000fffff'))));
select is(pg_temp.s10v_out('c-paths-unknown'), 'VALIDATION_FAILED ["/changedPaths/0"]', 'create: a changed path naming no field of the version is pointed at its index');
select pg_temp.s10v_call('c-values-type', pg_temp.s10v_rc('{"title":"x"}', 's10-ptr-c-0010', '{"values":[1]}'));
select is(pg_temp.s10v_out('c-values-type'), 'VALIDATION_FAILED ["/values"]', 'create: a non-object values member is pointed at /values');
select pg_temp.s10v_call('c-values-unknown', pg_temp.s10v_rc('{"title":"x"}', 's10-ptr-c-0011',
  jsonb_build_object('values', jsonb_build_object('a9100000-0000-4000-8000-0000000fffff', 'x'))));
select is(pg_temp.s10v_out('c-values-unknown'), 'VALIDATION_FAILED ["/fields/a9100000-0000-4000-8000-0000000fffff"]', 'create: a value keyed by a UUID that is no field of the version is pointed at that field pointer');
select pg_temp.s10v_call('c-values-key', pg_temp.s10v_rc('{"title":"x"}', 's10-ptr-c-0012', '{"values":{"not a uuid":"x"}}'));
select is(pg_temp.s10v_out('c-values-key'), 'VALIDATION_FAILED ["/values"]', 'create: a value key that is not a UUID is pointed at /values and never echoed');
select pg_temp.s10v_call('c-refs', pg_temp.s10v_rc('{"title":"x"}', 's10-ptr-c-0013', '{"validatorRefs":{}}'));
select is(pg_temp.s10v_out('c-refs'), 'VALIDATION_FAILED ["/validatorRefs"]', 'create: malformed validatorRefs are pointed at /validatorRefs');
select pg_temp.s10v_call('c-evidence', pg_temp.s10v_rc('{"title":"x"}', 's10-ptr-c-0014', '{"activationEvidence":{"key":"forged"}}'));
select is(pg_temp.s10v_out('c-evidence'), 'VALIDATION_FAILED ["/activationEvidence"]', 'create: forged activation evidence is pointed at /activationEvidence');
select pg_temp.s10v_call('c-richtext', pg_temp.s10v_gc(jsonb_build_object('body', 'raw text'), 's10-ptr-c-0015'));
select is(pg_temp.s10v_out('c-richtext'), 'rich_text_not_canonical ["/fields/' || pg_temp.s10g_fid('body') || '"]', 'create: a non-canonical rich_text value keeps its typed reason and names its field');
select pg_temp.s10v_call('c-object', pg_temp.s10v_gc(jsonb_build_object('meta', jsonb_build_object('unknown', 1)), 's10-ptr-c-0016'));
select is(pg_temp.s10v_out('c-object'), 'object_property_invalid ["/fields/' || pg_temp.s10g_fid('meta') || '"]', 'create: an invalid object value keeps its typed reason and names its field');
select pg_temp.s10v_call('c-taxonomy', pg_temp.s10v_gc(jsonb_build_object('tags', jsonb_build_object('termIds', jsonb_build_array(extensions.gen_random_uuid()))), 's10-ptr-c-0017'));
select is(pg_temp.s10v_out('c-taxonomy'), 'taxonomy_source_unavailable ["/fields/' || pg_temp.s10g_fid('tags') || '"]', 'create: an unavailable taxonomy source keeps its typed reason and names its field');
select pg_temp.s10v_call('c-domain', pg_temp.s10v_rc(jsonb_build_object('people', pg_temp.s10r_rel(extensions.gen_random_uuid()::text)), 's10-ptr-c-0018'));
select is(pg_temp.s10v_out('c-domain'), 'relation_target_unavailable ["/fields/' || pg_temp.s10r_fid('people') || '"]', 'create: a non-empty domain relation is relation_target_unavailable at its field');
select pg_temp.s10v_call('c-hidden', pg_temp.s10v_rc(jsonb_build_object('related', pg_temp.s10r_rel('a9100000-0000-4000-8000-000000000331')), 's10-ptr-c-0019'));
select is(pg_temp.s10v_out('c-hidden'), 'VALIDATION_FAILED ["/fields/' || pg_temp.s10r_fid('related') || '"]', 'create: an unreadable relation target is the uniform VALIDATION_FAILED at its field');

-- ---------------------------------------------------------------------- CMS-03B-01 ----
select pg_temp.s10v_call('seed', pg_temp.s10r_create_sql('{"title":"seed"}', 's10-ptr-seed-0001'));
create temp table s10v_entry on commit drop as select response->'entry'->>'id' as entry_id from s10v_calls where label = 'seed';
select pg_temp.s10v_call('a-base', pg_temp.s10v_ra((select entry_id from s10v_entry), '{"title":"y"}', '1', '1', 's10-ptr-a-0001', '{"baseRevision":"abc"}'));
select is(pg_temp.s10v_out('a-base'), 'VALIDATION_FAILED ["/baseRevision"]', 'append: a malformed baseRevision is pointed at /baseRevision');
select pg_temp.s10v_call('a-expected', pg_temp.s10v_ra((select entry_id from s10v_entry), '{"title":"y"}', '1', '1', 's10-ptr-a-0002', '{"expectedVersion":"0"}'));
select is(pg_temp.s10v_out('a-expected'), 'VALIDATION_FAILED ["/expectedVersion"]', 'append: a malformed expectedVersion is pointed at /expectedVersion');
select pg_temp.s10v_call('a-ifmatch', pg_temp.s10v_ra((select entry_id from s10v_entry), '{"title":"y"}', '1', '1', 's10-ptr-a-0003', '{"ifMatch":"abc"}'));
select is(pg_temp.s10v_out('a-ifmatch'), 'VALIDATION_FAILED ["/ifMatch"]', 'append: a malformed ifMatch is pointed at /ifMatch');
select pg_temp.s10v_call('a-locale', pg_temp.s10v_ra((select entry_id from s10v_entry), '{"title":"y"}', '1', '1', 's10-ptr-a-0004', '{"locale":"en_US"}'));
select is(pg_temp.s10v_out('a-locale'), 'VALIDATION_FAILED ["/locale"]', 'append: a malformed locale is pointed at /locale');
select pg_temp.s10v_call('a-values-count', pg_temp.s10v_ra((select entry_id from s10v_entry), '{"title":"y"}', '1', '1', 's10-ptr-a-0005',
  jsonb_build_object('values', jsonb_build_object(pg_temp.s10r_fid('title'), 'y', pg_temp.s10r_fid('related'), pg_temp.s10r_rel()))));
select is(pg_temp.s10v_out('a-values-count'), 'VALIDATION_FAILED ["/values"]', 'append: values that do not match the changed paths are pointed at /values');
select pg_temp.s10v_call('a-path', pg_temp.s10v_ra((select entry_id from s10v_entry), '{"title":"y"}', '1', '1', 's10-ptr-a-0006', '{"changedPaths":["/blocks/0"]}'));
select is(pg_temp.s10v_out('a-path'), 'VALIDATION_FAILED ["/changedPaths/0"]', 'append: a changed path outside the grammar is pointed at its index');
select pg_temp.s10v_call('a-field', pg_temp.s10v_ra((select entry_id from s10v_entry), '{"title":"y"}', '1', '1', 's10-ptr-a-0007',
  jsonb_build_object('changedPaths', jsonb_build_array('/fields/a9100000-0000-4000-8000-0000000fffff'),
    'values', jsonb_build_object('a9100000-0000-4000-8000-0000000fffff', 'y'))));
select is(pg_temp.s10v_out('a-field'), 'VALIDATION_FAILED ["/changedPaths/0"]', 'append: a changed path naming no active field is pointed at its index');
select pg_temp.s10v_call('a-relation', pg_temp.s10v_ra((select entry_id from s10v_entry), jsonb_build_object('related', pg_temp.s10r_rel('a9100000-0000-4000-8000-000000000331')), '1', '1', 's10-ptr-a-0008'));
select is(pg_temp.s10v_out('a-relation'), 'VALIDATION_FAILED ["/fields/' || pg_temp.s10r_fid('related') || '"]', 'append: an unreadable relation target is pointed at its field');

-- ---------------------------------------------------------------------- CMS-03B-02 ----
select pg_temp.s10v_call('conflict-theirs', pg_temp.s10v_ra((select entry_id from s10v_entry), '{"title":"theirs"}', '1', '1', 's10-ptr-conf-0001'));
select pg_temp.s10v_call('conflict-yours', pg_temp.s10v_ra((select entry_id from s10v_entry), '{"title":"yours"}', '1', '2', 's10-ptr-conf-0002'));
create temp table s10v_conflict on commit drop as
select id as conflict_id from platform_private.cms_conflict_records
 where entry_id = (select entry_id::uuid from s10v_entry) and state = 'open';
create or replace function pg_temp.s10v_resolve(p_choices jsonb, p_key text, p_patch jsonb default '{}'::jsonb)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_resolve_conflict(' || quote_literal((jsonb_build_object(
    'entryId', (select entry_id from s10v_entry), 'conflictId', (select conflict_id from s10v_conflict),
    'baseRevision', '1', 'choices', p_choices, 'expectedVersion', '2', 'ifMatch', '2', 'idempotencyKey', p_key,
    'context', jsonb_build_object('actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094', 'correlationId', 'a9100000-0000-4000-8000-000000000095')) || p_patch)::text) || '::jsonb)'
$body$;
select pg_temp.s10v_call('r-choices-type', pg_temp.s10v_resolve('{}'::jsonb, 's10-ptr-r-0001'));
select is(pg_temp.s10v_out('r-choices-type'), 'VALIDATION_FAILED ["/choices"]', 'resolve: a non-array choices member is pointed at /choices');
select pg_temp.s10v_call('r-choices-empty', pg_temp.s10v_resolve('[]'::jsonb, 's10-ptr-r-0002'));
select is(pg_temp.s10v_out('r-choices-empty'), 'VALIDATION_FAILED ["/choices"]', 'resolve: an empty choices array is pointed at /choices');
select pg_temp.s10v_call('r-choices-missing', pg_temp.s10v_resolve(jsonb_build_array(jsonb_build_object('path', '/fields/' || pg_temp.s10r_fid('related'), 'choice', 'theirs')), 's10-ptr-r-0003'));
select is(pg_temp.s10v_out('r-choices-missing'), 'VALIDATION_FAILED ["/fields/' || pg_temp.s10r_fid('title') || '"]', 'resolve: a conflicting field with no explicit choice is pointed at that field');
select pg_temp.s10v_call('r-choices-foreign', pg_temp.s10v_resolve(jsonb_build_array(
  jsonb_build_object('path', '/fields/' || pg_temp.s10r_fid('title'), 'choice', 'theirs'),
  jsonb_build_object('path', '/fields/' || pg_temp.s10r_fid('related'), 'choice', 'theirs')), 's10-ptr-r-0003b'));
select is(pg_temp.s10v_out('r-choices-foreign'), 'VALIDATION_FAILED ["/choices/1"]', 'resolve: a choice for a path the conflict does not carry is pointed at its index');
select pg_temp.s10v_call('r-choice-shape', pg_temp.s10v_resolve(jsonb_build_array(
  jsonb_build_object('path', '/fields/' || pg_temp.s10r_fid('title'), 'choice', 'theirs'), jsonb_build_object('path', 'x')), 's10-ptr-r-0004'));
select is(pg_temp.s10v_out('r-choice-shape'), 'VALIDATION_FAILED ["/choices/1"]', 'resolve: a malformed choice entry is pointed at its own index');
select pg_temp.s10v_call('r-choice-kind', pg_temp.s10v_resolve(jsonb_build_array(
  jsonb_build_object('path', '/fields/' || pg_temp.s10r_fid('title'), 'choice', 'inferred')), 's10-ptr-r-0005'));
select is(pg_temp.s10v_out('r-choice-kind'), 'VALIDATION_FAILED ["/choices/0"]', 'resolve: an unknown choice kind is pointed at its index');
select pg_temp.s10v_call('r-choice-overlap', pg_temp.s10v_resolve(jsonb_build_array(
  jsonb_build_object('path', '/fields/' || pg_temp.s10r_fid('title'), 'choice', 'explicit', 'value', 'both'),
  jsonb_build_object('path', '/fields/' || pg_temp.s10r_fid('title'), 'choice', 'theirs')), 's10-ptr-r-0006'));
select is(pg_temp.s10v_out('r-choice-overlap'), 'VALIDATION_FAILED ["/choices/1"]', 'resolve: a path decided twice is pointed at the repeated choice');

-- ---------------------------------------------------------------------- CMS-03B-04 ----
create or replace function pg_temp.s10v_restore(p_patch jsonb, p_key text)
returns text
language sql
stable
as $body$
  select 'select platform_api.cms_restore_revision(' || quote_literal((jsonb_build_object(
    'entryId', (select entry_id from s10v_entry),
    'revisionId', (select id from platform_private.cms_entry_revisions where entry_id = (select entry_id::uuid from s10v_entry) and revision_number = 1),
    'migrationChainId', platform_private.cms_restore_chain_manifest_id(platform_private.cms_restore_chain_derive(
      (select value::uuid from s10r_ids where key = 'typeId'), (select value::uuid from s10r_ids where key = 'versionId'),
      (select value::uuid from s10r_ids where key = 'versionId'))->>'hash'),
    'expectedVersion', '2', 'idempotencyKey', p_key,
    'context', jsonb_build_object('actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094', 'correlationId', 'a9100000-0000-4000-8000-000000000095')) || p_patch)::text) || '::jsonb)'
$body$;
select pg_temp.s10v_call('s-entry', pg_temp.s10v_restore('{"entryId":"nope"}', 's10-ptr-s-0001'));
select is(pg_temp.s10v_out('s-entry'), 'VALIDATION_FAILED ["/entryId"]', 'restore: a malformed entryId is pointed at /entryId');
select pg_temp.s10v_call('s-revision', pg_temp.s10v_restore('{"revisionId":"nope"}', 's10-ptr-s-0002'));
select is(pg_temp.s10v_out('s-revision'), 'VALIDATION_FAILED ["/revisionId"]', 'restore: a malformed revisionId is pointed at /revisionId');
select pg_temp.s10v_call('s-chain-shape', pg_temp.s10v_restore('{"migrationChainId":"nope"}', 's10-ptr-s-0003'));
select is(pg_temp.s10v_out('s-chain-shape'), 'VALIDATION_FAILED ["/migrationChainId"]', 'restore: a malformed migrationChainId is pointed at /migrationChainId');
select pg_temp.s10v_call('s-version', pg_temp.s10v_restore('{"expectedVersion":"0"}', 's10-ptr-s-0004'));
select is(pg_temp.s10v_out('s-version'), 'VALIDATION_FAILED ["/expectedVersion"]', 'restore: a malformed expectedVersion is pointed at /expectedVersion');
select pg_temp.s10v_call('s-chain', pg_temp.s10v_restore(jsonb_build_object('migrationChainId', extensions.gen_random_uuid()), 's10-ptr-s-0005'));
select is(pg_temp.s10v_out('s-chain'), 'migration_chain_mismatch ["/migrationChainId"]', 'restore: a chain id that is not the re-derived chain is migration_chain_mismatch at /migrationChainId');

-- ----------------------------------------------------------------- hygiene ----
select is(
  (select string_agg(label, ',' order by label) from s10v_calls
    where detail is not null
      and detail !~ '^\["(/[A-Za-z0-9_.~-]+)+"(,"(/[A-Za-z0-9_.~-]+)+")*\]$'),
  null, 'every captured detail is a JSON array of safe RFC 6901 pointers and echoes no caller value');
select is(
  (select count(*)::integer from s10v_calls where detail like '%not a uuid%' or detail like '%raw text%' or detail like '%forged%' or detail like '%inferred%'),
  0, 'no detail carries a caller-supplied string');

select * from finish();
rollback;
