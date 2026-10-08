-- Slice 10 CMS-03B-10 / CMS-03B-01 on a SUCCESSOR schema version (Codex adversarial
-- review, write-path audit P2-S10-AC-061/AC-066): cms_create_entry stored every
-- scalar value with field_definition_id = the STABLE field id.  On the first version
-- of a type the stable id and the definition row id coincide, so nothing showed; on a
-- successor version the definition rows are new rows, the value pointed at the
-- superseded version's row, and the draft was unusable: every later append failed
-- DEPENDENCY_UNAVAILABLE (the old-value gate finds no definition of the active
-- version) and the draft read could not resolve the field.  The create must resolve
-- each stable field id to the ACTIVE version's definition row, exactly as the relation
-- branch already does.
--
-- The successor is produced only through the real Slice 09 producers (successor draft,
-- dry run, review, decision, worker backfill, activation); the entry is then created
-- through the real CMS-03B-10 command ON THE SUCCESSOR VERSION.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_remaining_schema/000-helpers.sqlinc
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_dec108/03-support.sqlinc
\ir phase_02_slice_09_dec108/04-worker.sqlinc

select pg_temp.s09d_grant_via_rpc('owner', 'cms.author', 1);
select pg_temp.s09d_guc_save();
select pg_temp.s09d_create_type('s10src', 'articlesrc');
select pg_temp.s09d_to_active('s10src', array['rev1']);
select pg_temp.s09d_grant_via_rpc('owner', 'cms.author', 1);
select pg_temp.s09d_successor('s10mid', 's10src');
select pg_temp.s09d_dry_run('s10mid');
select pg_temp.s09w_dry_run('s10mid');
select pg_temp.s09d_submit('s10mid');
select pg_temp.s09d_assign('s10mid', 'rev2');
select pg_temp.s09d_decide('s10mid', 'rev2');
select pg_temp.s09w_backfill('s10mid');
select pg_temp.s09d_activate('s10mid');

select is(
  (select state::text from platform_private.cms_content_type_versions
    where id = pg_temp.s09d_id('s10mid:version')), 'active',
  'the successor version is active (real Slice 09 producers)');
select isnt(
  (select definition.id from platform_private.cms_field_definition_versions definition
    where definition.content_type_version_id = pg_temp.s09d_id('s10mid:version') and definition.field_key = 'title'),
  (select definition.id from platform_private.cms_field_definition_versions definition
    where definition.content_type_version_id = pg_temp.s09d_id('s10src:version') and definition.field_key = 'title'),
  'the successor version has its own definition row for the title field (the fixture distinguishes the two versions)');

-- ---------------------------------------------------------------- create ----
select pg_temp.s09w_entry('s10n', 's10mid', 'Successor title');
select is(pg_temp.s09d_outcome('s10n'), 'OK', 'an entry is created on the successor version');
create temp table s10s_entry on commit drop as
select pg_temp.s09d_resp('s10n')->'entry'->>'id' as entry_id,
       pg_temp.s09d_resp('s10n')->'revision'->>'id' as revision_id;

select is(
  (select definition.content_type_version_id
     from platform_private.cms_entry_field_values value_row
     join platform_private.cms_field_definition_versions definition
       on definition.id = value_row.field_definition_id
    where value_row.revision_id = (select revision_id::uuid from s10s_entry)
      and value_row.field_id = definition.stable_field_id),
  pg_temp.s09d_id('s10mid:version'),
  'the stored scalar value is bound to the ACTIVE (successor) version''s definition row, not the superseded version''s [P2-S10-AC-061]');
select is(
  (select count(*)::integer
     from platform_private.cms_entry_field_values value_row
    where value_row.revision_id = (select revision_id::uuid from s10s_entry)
      and not exists (
        select 1 from platform_private.cms_field_definition_versions definition
         where definition.id = value_row.field_definition_id
           and definition.stable_field_id = value_row.field_id
           and definition.content_type_version_id = pg_temp.s09d_id('s10mid:version'))),
  0,
  'no value of the new draft points at a definition row outside the entry''s own schema version');

-- ---------------------------------------------------------------- append ----
create or replace function pg_temp.s10s_append_request(p_key text, p_title text, p_expected text, p_base text)
returns jsonb
language sql
stable
as $body$
  select jsonb_build_object(
    'entryId', (select entry_id from s10s_entry),
    'baseRevision', p_base,
    'changedPaths', jsonb_build_array('/fields/' || field.stable_field_id),
    'values', jsonb_build_object(field.stable_field_id::text, p_title),
    'locale', 'en-US', 'expectedVersion', p_expected, 'ifMatch', p_expected,
    'idempotencyKey', p_key)
  from platform_private.cms_field_definition_versions field
  where field.content_type_version_id = pg_temp.s09d_id('s10mid:version') and field.field_key = 'title'
$body$;
select pg_temp.s09d_rpc('s10n-append', 'platform_api.cms_create_revision', 'owner',
  pg_temp.s10s_append_request('s10-successor-append-0001', 'Second title', '1', '1'));
select is(pg_temp.s09d_outcome('s10n-append'), 'OK',
  'an append succeeds on the entry created on the successor version (it was DEPENDENCY_UNAVAILABLE before) [P2-S10-AC-061]');
select is(
  (select value_row.value #>> '{}'
     from platform_private.cms_entry_field_values value_row
     join platform_private.cms_entry_revisions revision on revision.id = value_row.revision_id
    where revision.entry_id = (select entry_id::uuid from s10s_entry) and revision.revision_number = 2),
  'Second title', 'the appended draft holds the new title');

-- A second append after the first proves the carried values keep the right binding.
select pg_temp.s09d_rpc('s10n-append-2', 'platform_api.cms_create_revision', 'owner',
  pg_temp.s10s_append_request('s10-successor-append-0002', 'Third title', '2', '2'));
select is(pg_temp.s09d_outcome('s10n-append-2'), 'OK', 'a second append on the successor entry also succeeds');

select * from finish();
rollback;
