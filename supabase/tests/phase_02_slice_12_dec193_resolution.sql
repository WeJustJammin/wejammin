-- DEC-193 each-choice resolution contract. TEST ONLY; author execution UNRUN.
-- Stage the pattern-updates WIPs and the DEC-193 snapshot foundation first.
-- Expected snapshots are independent literals, not typed-diff or resolver output.
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
\ir phase_02_slice_12_dec193_resolution/000-fixture.sqlinc
\ir phase_02_slice_12_dec193_resolution/010-pure-resolver.sqlinc
\ir phase_02_slice_12_dec193_resolution/020-accept-results.sqlinc
\ir phase_02_slice_12_dec193_resolution/030-inconsistent.sqlinc
\ir phase_02_slice_12_dec193_resolution/040-digests.sqlinc
select finish();
rollback;
