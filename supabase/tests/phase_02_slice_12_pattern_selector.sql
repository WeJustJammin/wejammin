-- Slice 12 lane pattern-updates (claude_s12_pattern_updates_sql), CMS-03C-13 GET /api/v1/cms/patterns/selector ->
-- platform_api.cms_list_pattern_selector -> platform_private.cms_list_pattern_selector_signed -> cms_list_pattern_selector.
-- Normative: BE03c route row 175, validation 398, typed refusals 1266, authorization 1474, "Pattern versions and linked updates" 1363;
-- contract packages/contracts/src/cms-composition/pattern-selector.ts; tracker P2-S12-AC-106 .. AC-111, AC-261.
-- Every pattern is a REAL active pattern (CMS-03C-12 + the governed chain); the signing key is a transaction-only Vault secret.
-- Stage lane `pattern-updates` (placement, pattern definition and governed activation are promoted).

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
\ir phase_02_slice_12_pattern_updates_common/010-world.sqlinc
\ir phase_02_slice_12_pattern_selector/000-selector.sqlinc
\ir phase_02_slice_12_pattern_selector/010-paging.sqlinc
\ir phase_02_slice_12_pattern_selector/020-authority.sqlinc
\ir phase_02_slice_12_pattern_selector/030-retirement.sqlinc

select finish();
rollback;
