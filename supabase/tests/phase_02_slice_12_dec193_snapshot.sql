-- DEC-193 detached-tree storage contract. TEST-ONLY; author execution UNRUN.
-- BE03c 1487/1563: snapshot grammar, exact effective values, no whole-tree JSON cap.
-- Reuse real registration, governed patterns and placement; do not stage pattern-updates WIP.
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
\ir phase_02_slice_12_dec193_snapshot/000-fixture.sqlinc
\ir phase_02_slice_12_dec193_snapshot/010-storage.sqlinc
select finish();
rollback;
