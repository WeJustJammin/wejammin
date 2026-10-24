-- Slice 12 lane pattern-updates (claude_s12_pattern_updates_sql), CMS-03C-14 GET /api/v1/cms/compositions/instances/{instanceId}/update-diff
-- -> platform_api.cms_get_instance_update_diff -> platform_private.cms_get_instance_update_diff.
-- Normative: BE03c route row 176, validation 399, typed refusals 1267, authorization 1475, "Pattern versions and linked updates (D9, OD-2)" 1367;
-- contract packages/contracts/src/cms-composition/pattern-update.ts (CompositionUpdateDiffResource); tracker P2-S12-AC-112 .. AC-117, AC-258.
-- Rows are written by the real CMS-03C-02 producer; successors by CMS-03C-12 and the governed chain.  The fixture writes are the
-- pending_diff row a linked-update scan would append (the scan job is a separate lane) and ONE labelled direct insert of a `retired` row
-- (020-states.sqlinc, "LABELLED FIXTURE"), both guarded inserts under app.cms_rpc.  Stage lane `pattern-updates`.

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
\ir phase_02_slice_12_pattern_update_diff/000-schema.sqlinc
\ir phase_02_slice_12_pattern_update_diff/010-diff.sqlinc
\ir phase_02_slice_12_pattern_update_diff/020-states.sqlinc
\ir phase_02_slice_12_pattern_update_diff/030-bounds.sqlinc
\ir phase_02_slice_12_pattern_update_diff/040-authority.sqlinc

select finish();
rollback;
