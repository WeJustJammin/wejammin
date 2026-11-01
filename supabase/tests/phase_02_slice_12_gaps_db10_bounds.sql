-- Slice 12 gap lane claude_s12_db10 (DEC-247, P2-S12-AC-211 "again before publish"): the BOUNDARY and AGGREGATION side of the re-proved CMS-03C-12 bounds.
-- db9b's RED suite (phase_02_slice_12_gaps_db9b_legacy_forest_bounds.sql) proves the over-bound shapes are refused; this file proves the re-check does not over-refuse
-- (a pattern exactly at both bounds still places and still publishes) and that the provider aggregates the two new reasons (precedence, one unit per pin).
\set ON_ERROR_STOP on
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

select set_config('s12pd.type_count', '1', true);
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_definition/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_placement/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_placement/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_updates_common/000-helpers.sqlinc
\ir phase_02_slice_12_dec193_pattern_currentness/000-fixture.sqlinc
\ir phase_02_slice_12_gaps_db9b_legacy_forest/000-world.sqlinc
\ir phase_02_slice_12_gaps_db10_bounds/010-boundary.sqlinc

select finish();
rollback;
