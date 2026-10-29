-- Slice 12 gap lane claude_s12_gaps_api5: P2-S12-AC-238 clause "and satisfy the existing graph compatibility rule (DEC-199)."
-- BE03c "Preflight providers registered by Slice 12" (line 1585): DEC-199 rechecks every pinned nested version reached through a live
-- use for active state AND the existing same-owner / all-parent-compatible-types graph rule; a missing, inactive or incompatible nested
-- version fails the pattern category with `nested_pattern_not_active`.  The inactive half is proved by phase_02_slice_12_dec193_pattern_currentness
-- (PC-N03..PC-N06); the dec193_pattern_currentness README states the incompatible half "is not runtime-proven" because no producer can
-- store the state.  This suite reaches it the way phase_02_slice_12_gaps_pattern_governed (AC-200 (2b)) reaches a stored state the honest
-- producers cannot: a DRAFT pattern row copied directly in the RPC context with one patched member (compatible_type_ids), then taken
-- through the REAL governed chain (CMS-03C-06 submit, 08 assign, 07 decide, 09 activate) and placed through the REAL CMS-03C-02.  The
-- submit gate checks only that the nested version is active and the bound content types are active (cms_submit_governed_review: "by
-- construction, compatible"), so the chain accepts the copy; no trigger is disabled, no active row is inserted, no approval is forged.
-- The provider then runs through the actual manifest builder, frozen-status wrapper and evaluator (s12pc_check).
--   control          the honest parent (types = child types) and a copied-then-governed parent with the true type set pass in the submit and publish phases
--   direct edge      a parent listing {type1, type2} over a child listing {type1} fails nested_pattern_not_active, status stale, count 1
--   recursive edge   an honest top pattern over that parent: the mismatching edge is the SECOND level and still fails (every recursive edge)
\set ON_ERROR_STOP on
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
\ir phase_02_slice_12_pattern_updates_common/000-helpers.sqlinc
-- The manifest builder needs the consumer fixture's publication-settings snapshot lookup and its JCS({}) payload-hash entry
-- bootstrap (it replaces s12pl_entry); the currentness driver includes it for the same reason.
\ir phase_02_slice_12_dec193_consumers/000-fixture.sqlinc
\ir phase_02_slice_12_gaps_pattern/005-helpers.sqlinc
\ir phase_02_slice_12_dec193_pattern_currentness/000-fixture.sqlinc

-- A copied draft taken through the real governed chain: the pseudo response row is what g2p_cmd and the placement helpers read.
create or replace function pg_temp.a238_adopt(p_source text, p_label text, p_types jsonb) returns setof text
language plpgsql as $body$
begin
  perform pg_temp.g2p_raw_copy(p_source, p_label, jsonb_build_object('compatible_type_ids', p_types));
  insert into s12pd_out(label, response)
    select p_label, jsonb_build_object('id', id, 'contentHash', content_hash::text, 'patternId', pattern_id, 'patternVersion', version)
      from platform_private.cms_pattern_versions where pattern_key = p_label;
  perform pg_temp.g2p_step(p_label, 'activate');
  return next extensions.is(pg_temp.g2p_pattern_state(p_label), 'active',
    'setup: ' || p_label || ' (a copied draft with the patched type set) is active through the real submit, assign, decide and activate chain');
  if pg_temp.g2p_pattern_state(p_label) <> 'active' then
    return next extensions.diag(coalesce((select label || ' ' || coalesce(message, '') || ' ' || coalesce(detail, '')
      from s12pd_out where label like p_label || ':%' and state <> '00000' order by label limit 1), 'no failing step recorded'));
  end if;
end;
$body$;

create temp table a238_types on commit drop as
  select ordinal, id from s12pd_types where ordinal in (1, 2);

-- ---- the nested child (type 1 only) and an honest parent over it (type 1 only): the control
select * from pg_temp.s12pl_pattern('a238-child', 'a238-child', jsonb_build_array(pg_temp.s12pd_block('leaf')));
select * from pg_temp.s12pl_pattern('a238-ok', 'a238-ok', jsonb_build_array(pg_temp.s12pd_block('wrap'), jsonb_build_object(
  'kind', 'pattern', 'key', 'inner', 'patternId', pg_temp.s12pd_body('a238-child')->'patternId',
  'patternVersion', pg_temp.s12pd_body('a238-child')->'patternVersion')));

-- ---- the mismatching parent: produced as an honest DRAFT (type 1), copied with {type1, type2}, taken through the governed chain
select * from pg_temp.s12pl_pattern('a238-src', 'a238-src', jsonb_build_array(pg_temp.s12pd_block('wrap'), jsonb_build_object(
  'kind', 'pattern', 'key', 'inner', 'patternId', pg_temp.s12pd_body('a238-child')->'patternId',
  'patternVersion', pg_temp.s12pd_body('a238-child')->'patternVersion')), null, false);
select * from pg_temp.a238_adopt('a238-src', 'a238-bad',
  (select jsonb_agg(id order by ordinal) from a238_types));
-- Raw-copy control: the same copy path with the type set UNCHANGED, so the failures below are the type rule and not the copy.
select * from pg_temp.a238_adopt('a238-src', 'a238-rawok', (select jsonb_agg(id) from a238_types where ordinal = 1));
select is((select compatible_type_ids from platform_private.cms_pattern_versions where id = (pg_temp.s12pd_body('a238-bad')->>'id')::uuid),
  (select jsonb_agg(id order by ordinal) from a238_types),
  'premise: the pinned parent lists both content types [P2-S12-AC-238]');
select is((select compatible_type_ids from platform_private.cms_pattern_versions where id = (pg_temp.s12pd_body('a238-child')->>'id')::uuid),
  (select jsonb_agg(id) from a238_types where ordinal = 1),
  'premise: the nested child lists only the first content type, so the parent-to-child containment rule is violated [P2-S12-AC-238]');
select is((select state from platform_private.cms_pattern_versions where id = (pg_temp.s12pd_body('a238-child')->>'id')::uuid), 'active',
  'premise: the nested child is still active, so only the compatibility rule can fail the pin [P2-S12-AC-238]');
select is((select owner_id from platform_private.cms_pattern_versions where id = (pg_temp.s12pd_body('a238-bad')->>'id')::uuid),
  (select owner_id from platform_private.cms_pattern_versions where id = (pg_temp.s12pd_body('a238-child')->>'id')::uuid),
  'premise: parent and child have the same owner, so the owner rule is satisfied and the type rule alone differs [P2-S12-AC-238]');

-- ---- the recursive case: an honest top pattern (type 1) over the mismatching parent; the bad edge is its SECOND level
select * from pg_temp.s12pl_pattern('a238-top', 'a238-top', jsonb_build_array(jsonb_build_object(
  'kind', 'pattern', 'key', 'mid', 'patternId', pg_temp.s12pd_body('a238-bad')->'patternId',
  'patternVersion', pg_temp.s12pd_body('a238-bad')->'patternVersion')));

-- ---- real placements on type-1 entries through CMS-03C-02
select * from pg_temp.s12pu_place('a238-ok-e', 'a238-ok');
select * from pg_temp.s12pu_place('a238-rawok-e', 'a238-rawok');
select * from pg_temp.s12pu_place('a238-bad-e', 'a238-bad');
select * from pg_temp.s12pu_place('a238-top-e', 'a238-top');

-- ---- control: compatible nested version passes in both phases
select checked.* from unnest(array['submit', 'publish']) phases(phase)
  cross join lateral pg_temp.s12pc_check('A238-control-' || phases.phase || ' [P2-S12-AC-238]', 'a238-ok-e', null, true,
    array['a238-ok'], '[["s12pd.block",1]]', phases.phase) checked;

-- ---- raw-copy control: a copied-then-governed parent with the true type set passes, so the copy technique itself is clean
select checked.* from unnest(array['submit', 'publish']) phases(phase)
  cross join lateral pg_temp.s12pc_check('A238-rawcopy-control-' || phases.phase || ' [P2-S12-AC-238]', 'a238-rawok-e', null, true,
    array['a238-rawok'], '[["s12pd.block",1]]', phases.phase) checked;

-- ---- direct edge: the nested version is active and in the same owner scope but does not list every parent type
select checked.* from unnest(array['submit', 'publish']) phases(phase)
  cross join lateral pg_temp.s12pc_check('A238-direct-' || phases.phase || ' [P2-S12-AC-238]', 'a238-bad-e', 'nested_pattern_not_active', false,
    array['a238-bad'], '[["s12pd.block",1]]', phases.phase) checked;

-- ---- recursive edge: the top pattern and its direct child are compatible; the child-to-grandchild edge is not
select checked.* from unnest(array['submit', 'publish']) phases(phase)
  cross join lateral pg_temp.s12pc_check('A238-recursive-' || phases.phase || ' [P2-S12-AC-238]', 'a238-top-e', 'nested_pattern_not_active', false,
    array['a238-top'], '[["s12pd.block",1]]', phases.phase) checked;

select finish();
rollback;
