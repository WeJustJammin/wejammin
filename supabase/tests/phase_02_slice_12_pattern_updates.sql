-- Slice 12 lane pattern-updates (claude_s12_pattern_updates_sql), CMS-03C-15 POST /api/v1/cms/compositions/pattern-updates ->
-- platform_api.cms_apply_pattern_update -> platform_private.cms_apply_pattern_update.
-- Normative: BE03c route row 177, validation 400, typed refusals 1268, authorization 1476, lock order 1342, "Pattern versions and linked
-- updates (D9, OD-2)" 1359-1367 (accept, detach, successive requests of at most 32 rows, DEC-181, DEC-185 position unchanged);
-- contract packages/contracts/src/cms-composition/pattern-update.ts; tracker P2-S12-AC-118 .. AC-123, AC-219, AC-258, AC-261.
-- Every row and every pattern is written by a real producer (CMS-03C-02, CMS-03C-12, the governed chain); the only fixture writes are the
-- pending_diff rows a linked-update scan would append (the scan is a separate lane), the two labelled draft-state heads of
-- 020-world-adoption.sqlinc, direct archival of one entry (as the placement suite does) and the constructed live review of AC-219.
-- Stage lane `pattern-updates`.

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
\ir phase_02_slice_12_pattern_updates_common/020-world-adoption.sqlinc
\ir phase_02_slice_12_pattern_updates/000-oracles.sqlinc
\ir phase_02_slice_12_pattern_updates/005-schema.sqlinc
\ir phase_02_slice_12_pattern_updates/010-accept.sqlinc
\ir phase_02_slice_12_pattern_updates/020-detach.sqlinc
\ir phase_02_slice_12_pattern_updates/030-envelope.sqlinc
\ir phase_02_slice_12_pattern_updates/040-refusals.sqlinc
\ir phase_02_slice_12_pattern_updates/050-bulk.sqlinc
\ir phase_02_slice_12_pattern_updates/060-effects.sqlinc
\ir phase_02_slice_12_pattern_updates/070-adoption.sqlinc
\ir phase_02_slice_12_pattern_updates/075-eligibility.sqlinc
\ir phase_02_slice_12_pattern_updates/080-lock-order.sqlinc
\ir phase_02_slice_12_pattern_updates/085-rpc-context.sqlinc

select finish();
rollback;
