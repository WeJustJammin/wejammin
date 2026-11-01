-- Slice 12 lane placement (claude_s12_placement_sql), CMS-03C-02 POST /api/v1/cms/compositions/pattern-instances ->
-- platform_api.cms_insert_pattern_instance -> platform_private.cms_insert_pattern_instance (BE03c route row 160,
-- "Pattern versions and linked updates (D9, OD-2)" 1365, "Slice 12 lock order" 1336-1357, validation 375-378,
-- catalog 1289 and typed refusals 1304, Canonical records 1426, DEC-175/176/181/185/186/188/189; FE03 885, 1050;
-- tracker P2-S12-AC-010..015, AC-218, AC-219, AC-258).
--
-- This replaces the Codex setup-blocked skeleton.  Every pattern a test places is a REAL active pattern: created
-- by CMS-03C-12 and activated through the governed chain (CMS-03C-06/08/07/09); no trigger is disabled and no
-- active row is inserted.  The staged runner must stage the governed activation WIP:  lane `governed-b,placement`.
--
-- Not provable in this single-session suite (the race modules are root's): the concurrent forms of the
-- revision/slot lock (two simultaneous placements) and the lock-order deadlock conversion.

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
\ir phase_02_slice_12_pattern_placement/020-schema.sqlinc
\ir phase_02_slice_12_pattern_placement/030-patterns.sqlinc
\ir phase_02_slice_12_pattern_placement/040-positive.sqlinc
\ir phase_02_slice_12_pattern_placement/050-refusals.sqlinc
\ir phase_02_slice_12_pattern_placement/060-big.sqlinc
\ir phase_02_slice_12_pattern_placement/065-defensive.sqlinc
\ir phase_02_slice_12_pattern_placement/070-supersede.sqlinc

select ok(exists (select 1 from s12pl_out where requested_role = 'service_role')
  and not exists (select 1 from s12pl_out where call_role is distinct from requested_role),
  'every placement command ran under its recorded effective database role');
select ok(exists (select 1 from s12pl_out) and not exists (select 1 from s12pl_out where role_restored is not true),
  'every placement command restored both the prior role setting and the effective harness user');

select finish();
rollback;
