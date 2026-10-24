# Slice 12 governed-retire: CMS-03C-09 `retire` on a pattern subject

Entry point: `../phase_02_slice_12_governed_retire_pattern.sql` (no_plan). It reuses the pattern-definition fixtures
(`../phase_02_slice_12_pattern_definition/000-fixtures.sqlinc`, `010-oracles.sqlinc`) and the real nested scenario
(`050-nested.sqlinc`), then `010-retire.sqlinc` retires the active nested parent through the real
`platform_api.cms_activate_governed_subject`. The template and taxonomy kinds are proven in
`../phase_02_slice_12_governed_activation/095-retire.sqlinc`.
