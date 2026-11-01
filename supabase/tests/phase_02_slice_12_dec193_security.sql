-- DEC-193 effective-content security. TEST ONLY; author UNRUN.
-- Existing detector policy only; no invented JSON-key or SQL lexical policy.
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
-- Real signed blocks, governed patterns and old-pin placements; no assertion
-- fragments from the resolution suite are executed or changed.
\ir phase_02_slice_12_dec193_resolution/000-fixture.sqlinc
\ir phase_02_slice_12_dec193_security/010-effective-content.sqlinc
\ir phase_02_slice_12_dec193_security/020-preflight-heads.sqlinc
select finish();
rollback;
