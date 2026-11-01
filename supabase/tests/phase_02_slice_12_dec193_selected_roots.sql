-- DEC-193 CMS-03C-02 selected roots and newest-retired path reuse.
-- Author UNRUN. Real public writers and signed/governed pattern prerequisites.
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
\ir phase_02_slice_12_pattern_placement/030-patterns.sqlinc
\ir phase_02_slice_12_dec193_selected_roots/000-fixture.sqlinc
\ir phase_02_slice_12_dec193_selected_roots/010-request.sqlinc
\ir phase_02_slice_12_dec193_selected_roots/020-selection.sqlinc
\ir phase_02_slice_12_dec193_selected_roots/030-retired-reuse.sqlinc
\ir phase_02_slice_12_dec193_selected_roots/040-atomic-security.sqlinc
select ok(exists(select 1 from s12pl_out where label like 'sr-%'
  and requested_role='service_role') and not exists(select 1 from s12pl_out
  where call_role is distinct from requested_role or role_restored is not true),
  'SR-ROLE: every actual placement used its recorded SQL role and restored the caller');
select finish();
rollback;
