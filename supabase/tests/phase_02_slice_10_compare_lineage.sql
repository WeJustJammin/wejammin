-- Slice 10 round 3 (lane H, evidence gaps EA-AC002 / EB-AC056; DEC-141 / gap-resolution D-3):
-- CMS-03B-03 comparison resolves the recorded template and taxonomy versions of BOTH sides.
--
-- IA03 "Comparison" / CMS-07: an unresolvable recorded schema, template or taxonomy version is
-- a non-disclosing refusal.  cms_compare_revision_resolvable resolved the schema version and
-- the block registry only, so a revision pinning a taxonomy version that resolves nowhere (or a
-- template whose registry row is gone) was compared as if it were fine (200).
--   * taxonomy: Slice 10 has no taxonomy-version authority a comparison could resolve against, so
--     a NON-EMPTY recorded taxonomy-version list on either revision fails closed with the typed
--     422 comparison_unavailable whatever the list holds (absent, another tenant's, malformed or
--     even a version that exists); the refusal never echoes an id.
--   * template: the recorded template version is re-resolved against the template registry; a
--     pin whose row is gone is comparison_unavailable on either side.
-- A comparison of revisions that record neither is unchanged, and the history list (no
-- comparison) never needs the lineage.
--
-- Fixtures: a real entry with two real revisions written through the Slice 10 commands; a
-- recorded pin that cannot be produced by a command (an unresolvable taxonomy version, a
-- template row that vanished) is written with row triggers skipped.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_relation_authoring/000-relation-fixture.sqlinc
\ir phase_02_slice_10_signed_read/002-compare-helpers.sqlinc

select vault.create_secret(
  repeat('a1', 32),
  'cms_editorial_history_cursor_active',
  'pgTAP transaction-only CMS-03B-03 test key'
);

select pg_temp.s10_rpc_as(
  'a9100000-0000-4000-8000-000000000001'::uuid,
  (select value::uuid from s10_ids where key = 'organization')
);

-- A taxonomy version row of the given owner (the Slice 12 persistence foundation).
create or replace function pg_temp.s10t_taxonomy(p_id uuid, p_owner uuid, p_key text)
returns void
language plpgsql
as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_taxonomy_versions(
    id, owner_id, version, taxonomy_key, owner_capability, shape,
    allowlisted_type_keys, allowlisted_field_keys, content_hash, created_by
  ) values (
    p_id, p_owner, 1, p_key, 'cms.taxonomy_curator', 'flat',
    '[]'::jsonb, '[]'::jsonb, repeat('a', 64),
    (select value::uuid from s10_ids where key = 'creatorAuth')
  );
end;
$body$;

-- Pins taxonomy versions on one revision (row triggers skipped, as the lineage suites do).
create or replace function pg_temp.s10t_pin(p_revision uuid, p_pins jsonb)
returns text
language sql
as $body$
  select pg_temp.s10_sql_replica(format(
    $s$update platform_private.cms_entry_revisions set taxonomy_version_ids = %L::jsonb where id = %L::uuid;$s$,
    p_pins::text, p_revision::text))
$body$;

-- The comparison read of an entry against one of its revisions.
create or replace function pg_temp.s10t_compare_sql(p_entry uuid, p_compare uuid)
returns text
language sql
as $body$
  select 'select platform_api.cms_list_revisions(' || quote_literal(jsonb_build_object(
    'entryId', p_entry, 'compareRevisionId', p_compare)::text) || '::jsonb)'
$body$;

-- ---- an entry with two revisions (the compared side and the newest side) ----
create temp table s10t_calls(label text primary key, state text, message text, detail text, response jsonb)
  on commit drop;
create or replace function pg_temp.s10t_call(p_label text, p_sql text)
returns void
language plpgsql
as $body$
declare result jsonb; d text;
begin
  begin
    execute p_sql into result;
    insert into s10t_calls values (p_label, '00000', null, null, result)
    on conflict (label) do update set state = excluded.state, message = null, detail = null, response = excluded.response;
  exception when others then
    get stacked diagnostics d = pg_exception_detail;
    insert into s10t_calls values (p_label, sqlstate, sqlerrm, d, null)
    on conflict (label) do update set state = excluded.state, message = excluded.message, detail = excluded.detail, response = null;
  end;
end;
$body$;

select pg_temp.s10t_call('create', pg_temp.s10r_create_sql(
  jsonb_build_object('title', 'A'), 's10-h3-taxonomy-create-0001'));
create temp table s10t_entry on commit drop as
select response->'entry'->>'id' as entry_id, response->'revision'->>'id' as first_revision
  from s10t_calls where label = 'create';
select pg_temp.s10t_call('append', pg_temp.s10r_revision_sql(
  (select entry_id from s10t_entry), jsonb_build_object('title', 'B'), '1', '1', 's10-h3-taxonomy-append-0001'));
create temp table s10t_second on commit drop as
select response->>'id' as second_revision from s10t_calls where label = 'append';
select ok(
  (select state = '00000' from s10t_calls where label = 'create')
    and (select state = '00000' from s10t_calls where label = 'append')
    and (select second_revision is not null from s10t_second),
  'fixture: an entry with two real revisions exists');

-- ---- a clean comparison (no taxonomy pin) is 200 -----------------------------------------------
select pg_temp.s10t_call('clean', pg_temp.s10t_compare_sql(
  (select entry_id::uuid from s10t_entry), (select first_revision::uuid from s10t_entry)));
select is((select state from s10t_calls where label = 'clean'), '00000',
  'a comparison of revisions that record no taxonomy version succeeds');

-- ---- an unresolvable pin on the COMPARED side ------------------------------------------------------
select pg_temp.s10t_call('unresolvable-compared', pg_temp.s10t_pin(
  (select first_revision::uuid from s10t_entry), '["a9140000-0000-4000-8000-0000000000f5"]'::jsonb)
  || pg_temp.s10t_compare_sql((select entry_id::uuid from s10t_entry), (select first_revision::uuid from s10t_entry)));
select is(
  (select state || ':' || message from s10t_calls where label = 'unresolvable-compared'),
  'P0001:comparison_unavailable',
  'a compared revision pinning a taxonomy version that resolves nowhere is comparison_unavailable [DEC-141]');
select ok(
  (select coalesce(detail, '') not like '%f5%' and message not like '%f5%' from s10t_calls where label = 'unresolvable-compared'),
  'the refusal never names the recorded taxonomy version (non-disclosing)');

-- ---- an unresolvable pin on the NEWEST side ---------------------------------------------------------
select pg_temp.s10t_call('unresolvable-newest', pg_temp.s10t_pin(
  (select first_revision::uuid from s10t_entry), '[]'::jsonb)
  || pg_temp.s10t_pin((select second_revision::uuid from s10t_second), '["a9140000-0000-4000-8000-0000000000f5"]'::jsonb)
  || pg_temp.s10t_compare_sql((select entry_id::uuid from s10t_entry), (select first_revision::uuid from s10t_entry)));
select is(
  (select state || ':' || message from s10t_calls where label = 'unresolvable-newest'),
  'P0001:comparison_unavailable',
  'a newest revision pinning an unresolvable taxonomy version is comparison_unavailable too');

-- ---- another tenant's taxonomy version never satisfies the comparison ---------------------------
select pg_temp.s10t_taxonomy('a9140000-0000-4000-8000-0000000000a1',
  (select value::uuid from s10_ids where key = 'strangerPerson'), 'foreign');
select pg_temp.s10t_call('foreign-owner', pg_temp.s10t_pin(
  (select second_revision::uuid from s10t_second), '["a9140000-0000-4000-8000-0000000000a1"]'::jsonb)
  || pg_temp.s10t_compare_sql((select entry_id::uuid from s10t_entry), (select first_revision::uuid from s10t_entry)));
select is(
  (select state || ':' || message from s10t_calls where label = 'foreign-owner'),
  'P0001:comparison_unavailable',
  'a recorded taxonomy version owned by another tenant is comparison_unavailable (never disclosed as existing)');

-- ---- a recorded value that is not a UUID is unresolvable, never a cast error -----------------------
select pg_temp.s10t_call('not-a-uuid', pg_temp.s10t_pin(
  (select second_revision::uuid from s10t_second), '["not-a-uuid"]'::jsonb)
  || pg_temp.s10t_compare_sql((select entry_id::uuid from s10t_entry), (select first_revision::uuid from s10t_entry)));
select is(
  (select state || ':' || message from s10t_calls where label = 'not-a-uuid'),
  'P0001:comparison_unavailable',
  'a recorded taxonomy reference that is not a UUID is comparison_unavailable, not an internal error');

-- ---- one resolvable and one unresolvable pin -----------------------------------------------------------
select pg_temp.s10t_taxonomy('a9140000-0000-4000-8000-0000000000a2',
  (select value::uuid from s10_ids where key = 'organization'), 'owned');
select pg_temp.s10t_call('mixed', pg_temp.s10t_pin(
  (select second_revision::uuid from s10t_second),
  '["a9140000-0000-4000-8000-0000000000a2", "a9140000-0000-4000-8000-0000000000f5"]'::jsonb)
  || pg_temp.s10t_compare_sql((select entry_id::uuid from s10t_entry), (select first_revision::uuid from s10t_entry)));
select is(
  (select state || ':' || message from s10t_calls where label = 'mixed'),
  'P0001:comparison_unavailable',
  'every recorded taxonomy version must resolve: one resolvable plus one unresolvable pin is comparison_unavailable');

-- ---- even a taxonomy version that exists is not resolved by a comparison (DEC-141) ----------------
select pg_temp.s10t_call('exists-still-unavailable', pg_temp.s10t_pin(
  (select second_revision::uuid from s10t_second), '["a9140000-0000-4000-8000-0000000000a2"]'::jsonb)
  || pg_temp.s10t_pin((select first_revision::uuid from s10t_entry), '[]'::jsonb)
  || pg_temp.s10t_compare_sql((select entry_id::uuid from s10t_entry), (select first_revision::uuid from s10t_entry)));
select is(
  (select state || ':' || message from s10t_calls where label = 'exists-still-unavailable'),
  'P0001:comparison_unavailable',
  'a non-empty recorded taxonomy list fails closed even when the version exists: no Slice 10 authority resolves it (DEC-141)');

-- ---- an empty recorded list compares normally ---------------------------------------------------------
select pg_temp.s10t_call('empty-lists', pg_temp.s10t_pin(
  (select second_revision::uuid from s10t_second), '[]'::jsonb)
  || pg_temp.s10t_compare_sql((select entry_id::uuid from s10t_entry), (select first_revision::uuid from s10t_entry)));
select is((select state from s10t_calls where label = 'empty-lists'), '00000',
  'revisions recording no taxonomy version compare normally');
select ok(
  (select response ? 'compare' and response->'compare' <> 'null'::jsonb from s10t_calls where label = 'empty-lists'),
  'and the comparison is computed (not a partial answer)');

-- ---- recorded TEMPLATE versions (EB-AC056) -------------------------------------------------------------
-- A template version row of the owner (the manifest shape the real CMS-03C-01 command stores).
create or replace function pg_temp.s10t_template(p_id uuid)
returns void
language plpgsql
as $body$
begin
  perform set_config('app.cms_rpc', 'true', true);
  insert into platform_private.cms_template_versions(
    id, owner_id, state, version, template_key, compatible_type_ids, slots, reserved_regions,
    bindings, locale, audience, content_hash, block_registry_digest, created_by
  ) values (
    p_id, (select value::uuid from s10_ids where key = 'organization'), 'draft', 1, 'h3-template',
    jsonb_build_array((select value from s10_ids where key = 'typeId')), '[]'::jsonb,
    '["header", "now", "record", "detail", "provenance"]'::jsonb, '{}'::jsonb, 'en-US', 'public',
    repeat('b', 64), repeat('c', 64), (select value::uuid from s10_ids where key = 'creatorAuth')
  );
end;
$body$;
select pg_temp.s10t_template('a9140000-0000-4000-8000-0000000000b1');
select pg_temp.s10t_call('template-ok', pg_temp.s10t_pin((select second_revision::uuid from s10t_second), '[]'::jsonb)
  || pg_temp.s10_sql_replica(format(
       $s$update platform_private.cms_entry_revisions set template_version_id = %L::uuid where id in (%L::uuid, %L::uuid);$s$,
       'a9140000-0000-4000-8000-0000000000b1', (select first_revision from s10t_entry), (select second_revision from s10t_second)))
  || pg_temp.s10t_compare_sql((select entry_id::uuid from s10t_entry), (select first_revision::uuid from s10t_entry)));
select is((select state from s10t_calls where label = 'template-ok'), '00000',
  'EB-AC056: revisions recording a template version that resolves compare normally');

-- the template row vanishes (row triggers skipped: a template version is immutable and undeletable
-- through any command), leaving the recorded pin dangling on BOTH revisions
select pg_temp.s10t_call('template-vanished-both', pg_temp.s10_sql_replica(
  $s$delete from platform_private.cms_template_versions where id = 'a9140000-0000-4000-8000-0000000000b1';$s$)
  || pg_temp.s10t_compare_sql((select entry_id::uuid from s10t_entry), (select first_revision::uuid from s10t_entry)));
select is(
  (select state || ':' || message from s10t_calls where label = 'template-vanished-both'),
  'P0001:comparison_unavailable',
  'EB-AC056: a recorded template version that no longer resolves is comparison_unavailable');
select ok(
  (select coalesce(detail, '') not like '%b1%' and message not like '%b1%' from s10t_calls where label = 'template-vanished-both'),
  'EB-AC056: the template refusal never names the recorded template version');

-- only the compared (older) side pins the vanished template
select pg_temp.s10t_call('template-vanished-compared', pg_temp.s10_sql_replica(format(
    $s$update platform_private.cms_entry_revisions set template_version_id = null where id = %L::uuid;
       delete from platform_private.cms_template_versions where id = 'a9140000-0000-4000-8000-0000000000b1';$s$,
    (select second_revision from s10t_second)))
  || pg_temp.s10t_compare_sql((select entry_id::uuid from s10t_entry), (select first_revision::uuid from s10t_entry)));
select is(
  (select state || ':' || message from s10t_calls where label = 'template-vanished-compared'),
  'P0001:comparison_unavailable',
  'EB-AC056: the unresolvable template on the compared side alone is comparison_unavailable');
-- only the newest side pins it
select pg_temp.s10t_call('template-vanished-newest', pg_temp.s10_sql_replica(format(
    $s$update platform_private.cms_entry_revisions set template_version_id = null where id = %L::uuid;
       delete from platform_private.cms_template_versions where id = 'a9140000-0000-4000-8000-0000000000b1';$s$,
    (select first_revision from s10t_entry)))
  || pg_temp.s10t_compare_sql((select entry_id::uuid from s10t_entry), (select first_revision::uuid from s10t_entry)));
select is(
  (select state || ':' || message from s10t_calls where label = 'template-vanished-newest'),
  'P0001:comparison_unavailable',
  'EB-AC056: the unresolvable template on the newest side alone is comparison_unavailable');
-- a revision recording no template is unaffected
select pg_temp.s10t_call('template-none', pg_temp.s10_sql_replica(format(
    $s$update platform_private.cms_entry_revisions set template_version_id = null where id in (%L::uuid, %L::uuid);$s$,
    (select first_revision from s10t_entry), (select second_revision from s10t_second)))
  || pg_temp.s10t_compare_sql((select entry_id::uuid from s10t_entry), (select first_revision::uuid from s10t_entry)));
select is((select state from s10t_calls where label = 'template-none'), '00000',
  'revisions recording no template version compare normally');

-- ---- the history list (no compare) is unaffected by an unresolvable pin ----------------------------
select pg_temp.s10t_call('list-only', pg_temp.s10t_pin(
  (select second_revision::uuid from s10t_second), '["a9140000-0000-4000-8000-0000000000f5"]'::jsonb)
  || 'select platform_api.cms_list_revisions(' || quote_literal(jsonb_build_object(
       'entryId', (select entry_id from s10t_entry))::text) || '::jsonb)');
select is((select state from s10t_calls where label = 'list-only'), '00000',
  'the history list (no comparison) still answers: only a computed comparison needs the lineage resolved');

select * from finish();
rollback;
