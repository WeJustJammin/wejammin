-- Slice 12 lane claude_s12_nestable_read: cmsPatternNestableRead (DEC-196, root cascade DEC-232), GET /api/v1/cms/patterns/nestable ->
-- platform_api.cms_list_pattern_nestable -> platform_private.cms_list_pattern_nestable_signed -> cms_list_pattern_nestable.
-- Normative: BE03c route row 184, validation row 413, schema PatternNestableQuery 1194, error row 1427, CMS-03C-13 paragraph 1528,
-- authority row 1665, RPC inventory 1633; criteria P2-S12-AC-105 (nested pattern nodes from the picker over this read), AC-275 (registry
-- parity), AC-261 (RPC inventory).  Every pattern is a REAL active pattern (CMS-03C-12 + the governed chain); the signing key is a
-- transaction-only Vault secret.  Stage lane `nestable-read`.

\ir support/jwt-claims.sqlinc
commit;
create extension if not exists pgtap with schema extensions;
commit;

begin;
select no_plan();

select set_config('s12pd.type_count', '3', true);
\ir phase_02_slice_09_dec108/00-helpers.sqlinc
\ir phase_02_slice_09_dec108/01-actors.sqlinc
\ir phase_02_slice_09_dec108/02-chain.sqlinc
\ir phase_02_slice_09_p240/01-block.sqlinc
\ir phase_02_slice_12_pattern_definition/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_definition/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_placement/000-fixtures.sqlinc
\ir phase_02_slice_12_pattern_placement/010-oracles.sqlinc
\ir phase_02_slice_12_pattern_updates_common/000-helpers.sqlinc
\ir phase_02_slice_12_nestable_read/000-helpers.sqlinc
\ir phase_02_slice_12_nestable_read/001-world.sqlinc
\ir phase_02_slice_12_nestable_read/010-lists.sqlinc
\ir phase_02_slice_12_nestable_read/020-paging.sqlinc
\ir phase_02_slice_12_nestable_read/030-grammar.sqlinc
\ir phase_02_slice_12_nestable_read/040-authority.sqlinc
\ir phase_02_slice_12_nestable_read/050-follows-data.sqlinc
\ir phase_02_slice_12_nestable_read/060-reserved-key.sqlinc

select finish();
rollback;
