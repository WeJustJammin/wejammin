-- DEC-193 receiving consumers. TEST ONLY; author execution UNRUN.
\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;
begin;
select no_plan();
select set_config('s12pd.type_count','1',true);
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_definition/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_placement/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_placement/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_updates_common/000-helpers.sqlinc
\ir phase_02_slice_12_dec193_consumers/000-fixture.sqlinc
\ir phase_02_slice_12_dec193_consumers/010-comparison.sqlinc
\ir phase_02_slice_12_dec193_consumers/020-manifest-render.sqlinc
\ir phase_02_slice_12_dec193_consumers/025-boundary-fixture.sqlinc
\ir phase_02_slice_12_dec193_consumers/030-effective-boundaries.sqlinc
\ir phase_02_slice_12_dec193_consumers/040-checker-boundaries.sqlinc
select finish();
rollback;
