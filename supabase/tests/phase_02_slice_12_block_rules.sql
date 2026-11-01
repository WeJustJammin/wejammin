-- DEC-210 block composition rules, definition side: the pure rule check, the registry rules map, the CMS-03C-12 pattern
-- version save and the nested-reference expansion.  Real signed block registration and governed pattern activation;
-- nothing is inserted into a registry or a pattern store.  The legacy-state suites (placement, accept/detach, the
-- publication provider) are phase_02_slice_12_block_rules_legacy.sql.
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
\ir phase_02_slice_12_block_rules/000-fixture.sqlinc
\ir phase_02_slice_12_block_rules/010-pure.sqlinc
\ir phase_02_slice_12_block_rules/020-save.sqlinc
\ir phase_02_slice_12_block_rules/030-nested.sqlinc
select finish();
rollback;
