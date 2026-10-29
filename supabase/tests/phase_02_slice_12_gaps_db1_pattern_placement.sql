-- Slice 12 gap lane claude_s12_gaps_db1: CMS-03C-02 pattern ownership (P2-S12-AC-026 clause 2 and 3, AC-043 clause 2).
-- BE03c 382 and 1401/1638: `patternId` is a lineage id of the caller's owner scope; a pattern of ANOTHER owner party is
-- concealed exactly like an absent one (NOT_FOUND), while the caller's own non-active pattern is not.  The owner party
-- here is the CALLER (it edits its own readable current draft revision), so the pattern-owner axis is isolated: the
-- hidden-owner case of 050-refusals hides the revision and the pattern together.
--
-- The foreign pattern is a DRAFT version row of another organization (the only state a raw insert may take; the
-- lifecycle guard refuses anything else): no active row is inserted and no trigger is disabled.  The paired control is
-- the same row owned by the caller, which must answer pattern_version_not_active, so the NOT_FOUND below is owner-specific.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

select set_config('s12pd.type_count', '2', true);
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_definition/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_placement/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_placement/010-oracles.sqlinc

select * from pg_temp.s12pl_pattern('pa', 's12pl-pa', jsonb_build_array(
  pg_temp.s12pd_block('hero', jsonb_build_array(pg_temp.s12pd_block('title'))), pg_temp.s12pd_block('cta')));

-- A draft clone of the active pattern 'pa' version row under another owner and key; the lifecycle guard assigns
-- the new lineage (a first version is its own lineage).
create or replace function pg_temp.gp_clone_pattern(p_owner uuid, p_key text) returns uuid
language plpgsql as $body$
declare
  source_row platform_private.cms_pattern_versions%rowtype;
  new_id uuid := extensions.gen_random_uuid();
  stamp timestamptz := clock_timestamp();
begin
  perform set_config('app.cms_rpc', 'true', true);
  select * into source_row from platform_private.cms_pattern_versions
   where pattern_id = (pg_temp.s12pd_body('pa')->>'patternId')::uuid order by version limit 1;
  insert into platform_private.cms_pattern_versions
  select (jsonb_populate_record(null::platform_private.cms_pattern_versions, to_jsonb(source_row)
    || jsonb_build_object('id', new_id, 'owner_id', p_owner, 'state', 'draft', 'version', 1, 'pattern_key', p_key,
         'pattern_id', null, 'supersedes_id', null, 'created_at', stamp, 'updated_at', stamp,
         'lifecycle_version', 1, 'activated_at', null, 'retired_at', null))).*;
  return (select pattern_id from platform_private.cms_pattern_versions where id = new_id);
end;
$body$;

create temp table gp_ids(key text primary key, value text not null) on commit drop;
insert into gp_ids
select 'foreignLineage', pg_temp.gp_clone_pattern(pg_temp.s09d_id('otherOrg'), 'gap-foreign-pattern')::text
union all
select 'ownLineage', pg_temp.gp_clone_pattern(pg_temp.s09d_id('ownerOrg'), 'gap-own-draft-pattern')::text;

select ok(
  (select owner_id = pg_temp.s09d_id('otherOrg') and state = 'draft' and version = 1
     from platform_private.cms_pattern_versions where pattern_id = (select value::uuid from gp_ids where key = 'foreignLineage'))
  and (select owner_id = pg_temp.s09d_id('ownerOrg') and state = 'draft' and version = 1
     from platform_private.cms_pattern_versions where pattern_id = (select value::uuid from gp_ids where key = 'ownLineage'))
  and (select count(distinct pattern_id) = 2 from platform_private.cms_pattern_versions
        where pattern_id in ((select value::uuid from gp_ids where key = 'foreignLineage'),
                             (select value::uuid from gp_ids where key = 'ownLineage'))),
  'control: the foreign and own draft clones are distinct one-version lineages of the two organizations [P2-S12-AC-026]');

select pg_temp.s12pl_entry('fo');
select ok(
  (select owner_party_id = pg_temp.s09d_id('ownerOrg') and lifecycle = 'active'
      and current_draft_revision_id = pg_temp.s12pl_rev('fo')
     from platform_private.cms_content_entries where id = pg_temp.s12pl_entry_id('fo')),
  'control: the entry and its current draft revision belong to the caller''s own organization [P2-S12-AC-026]');

-- The caller''s own readable draft revision, a pattern lineage of the SAME owner that is not active: the lookup finds
-- the row, so the refusal is the typed state refusal, not concealment.
select * from pg_temp.s12pl_refused('own-draft-lineage',
  pg_temp.s12pl_request('fo', 'pa', '/', '{}'::jsonb, 'gap-pl-own-0001')
    || jsonb_build_object('patternId', (select value from gp_ids where key = 'ownLineage'), 'patternVersion', 1),
  'pattern_version_not_active', '["/patternVersion"]'::jsonb);

-- The same shape with the lineage owned by ANOTHER organization is concealed as an absent pattern.
select * from pg_temp.s12pl_refused('foreign-lineage',
  pg_temp.s12pl_request('fo', 'pa', '/', '{}'::jsonb, 'gap-pl-foreign-0001')
    || jsonb_build_object('patternId', (select value from gp_ids where key = 'foreignLineage'), 'patternVersion', 1),
  'NOT_FOUND');
select is(coalesce((select detail from s12pl_out where label = 'foreign-lineage'), ''), '',
  'the concealed foreign-lineage refusal carries no DETAIL that could reveal the pattern [P2-S12-AC-026]');
select * from pg_temp.s12pl_refused('foreign-lineage-absent-version',
  pg_temp.s12pl_request('fo', 'pa', '/', '{}'::jsonb, 'gap-pl-foreign-0002')
    || jsonb_build_object('patternId', (select value from gp_ids where key = 'foreignLineage'), 'patternVersion', 99),
  'NOT_FOUND');
select is(
  (select message from s12pl_out where label = 'foreign-lineage-absent-version'),
  (select message from s12pl_out where label = 'foreign-lineage'),
  'a foreign lineage answers the same token for an existing and an absent version: nothing about it is disclosed [P2-S12-AC-043]');
select * from pg_temp.s12pl_refused('absent-lineage',
  pg_temp.s12pl_request('fo', 'pa', '/', '{}'::jsonb, 'gap-pl-absent-0001')
    || jsonb_build_object('patternId', 'a9120000-0000-4000-8000-0000000000fd', 'patternVersion', 1),
  'NOT_FOUND');
select is(
  (select message || coalesce(detail, '') from s12pl_out where label = 'absent-lineage'),
  (select message || coalesce(detail, '') from s12pl_out where label = 'foreign-lineage'),
  'a foreign lineage is indistinguishable from an absent one [P2-S12-AC-043]');

-- Positive control: the same entry places the caller''s active pattern, so the refusals were pattern-specific.
select pg_temp.s12pl_run('own-active', pg_temp.s12pl_request('fo', 'pa', '/', '{}'::jsonb, 'gap-pl-ok-0001'));
select is(pg_temp.s12pl_state('own-active'), '00000',
  'control: the caller''s own active pattern places on the same revision [P2-S12-AC-043]');
select is(
  (select count(*)::integer from platform_private.cms_composition_instances
    where revision_id = pg_temp.s12pl_rev('fo') and pattern_id = (pg_temp.s12pd_body('pa')->>'patternId')::uuid),
  2, 'control: only the two rows of the owned pattern exist; no row names a foreign or draft lineage [P2-S12-AC-043]');

select finish();
rollback;
