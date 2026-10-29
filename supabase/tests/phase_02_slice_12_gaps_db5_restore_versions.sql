-- Slice 12 gap lane claude_s12_gaps_db5, DEC-240 (root 2026-10-29; BE03c "Receiving obligations from Slice 10 (DEC-141)" item 3,
-- AC-244 and AC-246): cms_restore_revision records, in the restored revision's taxonomy_version_ids, exactly ONE current `active`
-- version id per vocabulary that has a carried assignment (the rule every revision writer applies, ascending bytewise).  A
-- source-recorded taxonomy version whose vocabulary has no carried assignment is NOT carried.
-- Source shape: a revision recorded before the writers applied AC-246 (or whose assignments have all stopped being active) can
-- record a version of a vocabulary it holds no assignment for; no current writer produces that, so the fixture sets the recorded
-- ids of a source revision the way phase_02_slice_12_taxonomy_integrity/050-restore.sqlinc does (the labelled h11_raw_exec fixture
-- write on the source revision row only; every restore, assignment and activation below goes through the real commands).
-- RED before 20261029130000_cms_restore_records_carried_vocabularies.sql: the plan appends the recorded id of the uncarried vocabulary.
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

\ir phase_02_slice_10_rpc/000-helpers.sqlinc
\ir phase_02_slice_10_rpc/001-fixtures.sqlinc
\ir phase_02_slice_10_value_source/000-gallery-fixture.sqlinc
\ir phase_02_slice_11_helpers/000-helpers.sqlinc
\ir phase_02_slice_12_taxonomy_integrity/000-world.sqlinc
\ir phase_02_slice_12_taxonomy_integrity/005-gallery-vocab.sqlinc

create or replace function pg_temp.db5_entry(p_label text) returns text language sql stable as $body$
  select response->'entry'->>'id' from ti_calls where label = p_label $body$;
create or replace function pg_temp.db5_rev(p_label text) returns uuid language sql stable as $body$
  select coalesce((response->'revision'->>'id'), (response->>'id'))::uuid from ti_calls where label = p_label $body$;
create or replace function pg_temp.db5_sorted(p_tags text[]) returns jsonb language sql stable as $body$
  select coalesce(jsonb_agg(x order by x::text collate "C"), '[]'::jsonb) from unnest(p_tags) t(x) $body$;
create or replace function pg_temp.db5_restore(p_label text, p_entry text, p_revision uuid) returns void language sql as $body$
  select pg_temp.ti_call(p_label, 'select platform_api.cms_restore_revision(' || quote_literal(jsonb_build_object(
    'entryId', p_entry, 'revisionId', p_revision::text,
    'migrationChainId', platform_private.cms_restore_chain_manifest_id(
      platform_private.cms_restore_chain_derive(
        (select value::uuid from s10g_ids where key = 'typeId'),
        (select value::uuid from s10g_ids where key = 'versionId'),
        (select value::uuid from s10g_ids where key = 'versionId'))->>'hash'),
    'expectedVersion', (select version::text from platform_private.cms_content_entries where id = p_entry::uuid),
    'idempotencyKey', 's12db5-restore-' || p_label,
    'context', jsonb_build_object(
      'actingPartyId', (select value from s10_ids where key = 'organization'),
      'actingContextId', 'a9100000-0000-4000-8000-000000000094',
      'correlationId', 'a9100000-0000-4000-8000-000000000095'))::text) || '::jsonb)') $body$;
-- Source = a created revision plus a newer draft; the source's recorded ids are then set (labelled legacy-shape fixture).
create or replace function pg_temp.db5_source(p_label text, p_tags text[], p_recorded jsonb) returns void language plpgsql as $body$
begin
  perform pg_temp.ti_create(p_label, jsonb_build_object('title', p_label) || case when cardinality(p_tags) = 0 then '{}'::jsonb else jsonb_build_object('tags', pg_temp.ti_terms(p_tags)) end);
  perform pg_temp.ti_append(p_label || '_a', pg_temp.db5_entry(p_label), jsonb_build_object('title', p_label || ' b'), '1', '1');
  perform pg_temp.h11_raw_exec('platform_private.cms_entry_revisions',
    format('update platform_private.cms_entry_revisions set taxonomy_version_ids = %L::jsonb where id = %L::uuid',
      p_recorded, pg_temp.db5_rev(p_label)));
end;
$body$;
create or replace function pg_temp.db5_restored(p_label text) returns uuid language sql stable as $body$
  select (response->'resource'->>'id')::uuid from ti_calls where label = p_label $body$;
create or replace function pg_temp.db5_ids(p_label text) returns jsonb language sql stable as $body$
  select taxonomy_version_ids from platform_private.cms_entry_revisions where id = pg_temp.db5_restored(p_label) $body$;

-- ---- 1. vocabulary B is recorded with no assignment: it is not carried; A's id is -------------------------------------------
select pg_temp.ti_version('wa1', pg_temp.ti_org(), 'db5-a', 1, 'active', '["s10gallery"]'::jsonb, '["tags"]'::jsonb);
select pg_temp.ti_version('wb1', pg_temp.ti_org(), 'db5-b', 1, 'active', '["s10gallery"]'::jsonb, '["tags"]'::jsonb);
select pg_temp.ti_term('wta', pg_temp.ti_org(), 'wa1', 'wa1', 'wta');
select pg_temp.db5_source('d1', array['wta'], pg_temp.db5_sorted(array[pg_temp.ti_uuid('wa1')::text, pg_temp.ti_uuid('wb1')::text]));
select is(pg_temp.ti_revision_ids(pg_temp.db5_rev('d1')), pg_temp.db5_sorted(array[pg_temp.ti_uuid('wa1')::text, pg_temp.ti_uuid('wb1')::text]),
  'fixture: the source records the versions of vocabulary A (assigned) and vocabulary B (no assignment) [P2-S12-AC-244]');
select is(pg_temp.ti_assignments(pg_temp.db5_rev('d1')), 'wta:active:1:0', 'fixture: the source holds one active assignment, in vocabulary A [P2-S12-AC-244]');
select pg_temp.db5_restore('d1_r', pg_temp.db5_entry('d1'), pg_temp.db5_rev('d1'));
select is(pg_temp.ti_out('d1_r'), '00000:', 'the restore of that source succeeds [P2-S12-AC-244]');
select is(pg_temp.db5_ids('d1_r'), jsonb_build_array(pg_temp.ti_uuid('wa1')),
  'the restored revision records only vocabulary A''s current active id: the uncarried vocabulary B''s recorded id is not carried (DEC-240) [P2-S12-AC-244]');
select is(response->'resource'->'taxonomyVersionIds', jsonb_build_array(pg_temp.ti_uuid('wa1')),
  'and the restore response reports exactly the stored ids (DEC-240) [P2-S12-AC-244]') from ti_calls where label = 'd1_r';
select is(pg_temp.ti_assignments(pg_temp.db5_restored('d1_r')), 'wta:active:1:0',
  'nothing else in the restore changes: the carried assignment is unchanged [P2-S12-AC-244]');
select is((select value from platform_private.cms_entry_field_values
            where revision_id = pg_temp.db5_restored('d1_r') and field_id = pg_temp.s10g_fid('tags')::uuid),
  pg_temp.ti_terms(array['wta']), 'and the restored tags value names the carried term [P2-S12-AC-244]');
select is(pg_temp.ti_revision_ids(pg_temp.db5_rev('d1')),
  pg_temp.db5_sorted(array[pg_temp.ti_uuid('wa1')::text, pg_temp.ti_uuid('wb1')::text]),
  'the source revision is unchanged (immutable history) [P2-S12-AC-244]');

-- ---- 2. A's recorded id is superseded: the CURRENT active id is recorded, B (retired) is not ----------------------------------
select pg_temp.ti_version('wc1', pg_temp.ti_org(), 'db5-c', 1, 'active', '["s10gallery"]'::jsonb, '["tags"]'::jsonb);
select pg_temp.ti_version('wd1', pg_temp.ti_org(), 'db5-d', 1, 'retired', '["s10gallery"]'::jsonb, '["tags"]'::jsonb);
select pg_temp.ti_term('wtc', pg_temp.ti_org(), 'wc1', 'wc1', 'wtc');
select pg_temp.db5_source('d2', array['wtc'], pg_temp.db5_sorted(array[pg_temp.ti_uuid('wc1')::text, pg_temp.ti_uuid('wd1')::text]));
select pg_temp.ti_version_to('wc1', 'superseded');
select pg_temp.ti_version('wc2', pg_temp.ti_org(), 'db5-c', 2, 'active', '["s10gallery"]'::jsonb, '["tags"]'::jsonb, 'wc1', 'wc1');
select pg_temp.db5_restore('d2_r', pg_temp.db5_entry('d2'), pg_temp.db5_rev('d2'));
select is(pg_temp.ti_out('d2_r') || '/' || pg_temp.db5_ids('d2_r')::text,
  '00000:/' || jsonb_build_array(pg_temp.ti_uuid('wc2'))::text,
  'after A''s successor activation the restore records A''s CURRENT active id, and not the retired uncarried B nor A''s recorded superseded id (DEC-240) [P2-S12-AC-244]');
select is((select taxonomy_version_id from platform_private.cms_term_assignments where revision_id = pg_temp.db5_restored('d2_r')),
  pg_temp.ti_uuid('wc1'), 'while the carried assignment row still names the term''s write-version (DEC-229) [P2-S12-AC-244]');

-- ---- 3. assignments in both vocabularies record both (writers'' order), and an uncarried third is dropped -----------------------
select pg_temp.ti_version('we1', pg_temp.ti_org(), 'db5-e', 1, 'active', '["s10gallery"]'::jsonb, '["tags"]'::jsonb);
select pg_temp.ti_version('wf1', pg_temp.ti_org(), 'db5-f', 1, 'active', '["s10gallery"]'::jsonb, '["tags"]'::jsonb);
select pg_temp.ti_version('wg1', pg_temp.ti_org(), 'db5-g', 1, 'active', '["s10gallery"]'::jsonb, '["tags"]'::jsonb);
select pg_temp.ti_term('wte', pg_temp.ti_org(), 'we1', 'we1', 'wte');
select pg_temp.ti_term('wtf', pg_temp.ti_org(), 'wf1', 'wf1', 'wtf');
-- the term of the byte-greater version id comes first, so the plan order is the REVERSE of the sorted order
create temp table db5_two on commit drop as
select case when pg_temp.ti_uuid('we1')::text collate "C" > pg_temp.ti_uuid('wf1')::text collate "C" then array['wte', 'wtf'] else array['wtf', 'wte'] end as tags;
select pg_temp.db5_source('d3', (select tags from db5_two),
  pg_temp.db5_sorted(array[pg_temp.ti_uuid('we1')::text, pg_temp.ti_uuid('wf1')::text, pg_temp.ti_uuid('wg1')::text]));
select pg_temp.db5_restore('d3_r', pg_temp.db5_entry('d3'), pg_temp.db5_rev('d3'));
select is(pg_temp.ti_out('d3_r') || '/' || pg_temp.db5_ids('d3_r')::text,
  '00000:/' || pg_temp.db5_sorted(array[pg_temp.ti_uuid('we1')::text, pg_temp.ti_uuid('wf1')::text])::text,
  'a source with assignments in vocabularies E and F (and a recorded uncarried G) records the ids of E and F once each, ascending bytewise, and not G''s [P2-S12-AC-244]');
select is((select count(*)::integer from platform_private.cms_term_assignments where revision_id = pg_temp.db5_restored('d3_r')), 2,
  'and carries both assignments [P2-S12-AC-244]');

-- ---- 4. no assignment at all: every recorded id is uncarried, so none is recorded ------------------------------------------------
select pg_temp.db5_source('d4', array[]::text[], pg_temp.db5_sorted(array[pg_temp.ti_uuid('wa1')::text]));
select pg_temp.db5_restore('d4_r', pg_temp.db5_entry('d4'), pg_temp.db5_rev('d4'));
select is(pg_temp.ti_out('d4_r') || '/' || pg_temp.ti_assignments(pg_temp.db5_restored('d4_r')) || '/' || pg_temp.db5_ids('d4_r')::text,
  '00000://[]', 'a source with a recorded version and no assignment restores to a revision recording none (DEC-240) [P2-S12-AC-244]');

-- ---- 5. a recorded version that no longer resolves in the owner scope still fails the restore -------------------------------
select pg_temp.db5_source('d5', array['wta'], jsonb_build_array(pg_temp.ti_uuid('wa1'), pg_temp.ti_uuid('nobody')));
select pg_temp.db5_restore('d5_r', pg_temp.db5_entry('d5'), pg_temp.db5_rev('d5'));
select is(pg_temp.ti_out('d5_r'), 'P0001:migration_chain_incomplete',
  'an unresolvable recorded version still fails the restore migration_chain_incomplete: DEC-240 drops only resolvable uncarried versions [P2-S12-AC-244]');

select * from finish();
rollback;
