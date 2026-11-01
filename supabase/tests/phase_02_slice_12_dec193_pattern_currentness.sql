-- DEC-193 / DEC-199 pattern publication/currentness. TEST ONLY; author UNRUN.
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
\ir phase_02_slice_12_dec193_pattern_currentness/000-fixture.sqlinc
\ir phase_02_slice_12_dec193_pattern_currentness/010-provenance-currentness.sqlinc
\ir phase_02_slice_12_dec193_pattern_currentness/030-aggregation-faults.sqlinc
\ir phase_02_slice_12_dec193_pattern_currentness/031-readonly-digest.sqlinc
\ir phase_02_slice_12_dec193_pattern_currentness/020-active-digest-provider.sqlinc
select finish();
rollback;
