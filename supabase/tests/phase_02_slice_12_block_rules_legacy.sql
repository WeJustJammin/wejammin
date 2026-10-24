-- DEC-210 block composition rules, legacy-state side: CMS-03C-02 placement, CMS-03C-15 accept/detach and the
-- cms.pattern.active_digest publication provider over trees saved before the rule (a state the real producers write while
-- one DEC-210 enforcement function is replaced inside this rolled-back transaction, then restored and asserted identical).
-- The definition-side suites are phase_02_slice_12_block_rules.sql.
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
\ir phase_02_slice_12_dec193_pattern_currentness/000-fixture.sqlinc
\ir phase_02_slice_12_block_rules/040-legacy-setup.sqlinc
\ir phase_02_slice_12_block_rules/050-placement.sqlinc
\ir phase_02_slice_12_block_rules/060-updates.sqlinc
\ir phase_02_slice_12_block_rules/070-provider.sqlinc
select finish();
rollback;
