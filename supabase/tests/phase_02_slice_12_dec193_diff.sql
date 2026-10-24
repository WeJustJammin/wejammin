-- DEC-193 CMS-03C-14 diff contract. TEST ONLY; author execution UNRUN.
-- Stage the existing ten pattern-updates WIPs and DEC-193 snapshot foundation first.
-- Expected node values are independent literals/builders, never resolver output.
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
\ir phase_02_slice_12_dec193_diff/000-fixture.sqlinc
\ir phase_02_slice_12_dec193_diff/010-node-values.sqlinc
\ir phase_02_slice_12_dec193_diff/020-diff.sqlinc
select finish();
rollback;
