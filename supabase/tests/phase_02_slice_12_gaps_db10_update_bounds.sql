-- Slice 12 gap lane claude_s12_db10, sweep round (DEC-247, P2-S12-AC-211 "again before publish"): every OTHER expander of a stored pattern forest
-- (the update expander behind CMS-03C-14 diff, CMS-03C-15 accept and detach, the render plan and checker, the restore) re-proves the CMS-03C-12 bounds.
-- Written RED against the migrations promoted before supabase/migrations-wip/db10/20261031110400 (those expanders answered for an ACTIVE legacy forest
-- over the bound, built as db9b built them); green once the update expander re-proves the bounds.
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
\ir phase_02_slice_12_gaps_db10_update_bounds/000-world.sqlinc
\ir phase_02_slice_12_gaps_db10_update_bounds/010-oracles.sqlinc

select finish();
rollback;
