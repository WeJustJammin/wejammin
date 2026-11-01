# claude_s12_gaps_db2 pattern fragments

Fragments of `../phase_02_slice_12_gaps_pattern_governed.sql` (gap tests for pattern-version clauses; brief
`docs/handoffs/2026-10-22-claude-s12/briefs/gap-tests.md`). The entrypoint includes the S09 DEC-108 fragments, the p240 signed-block
fixtures and `../phase_02_slice_12_pattern_definition/000-fixtures.sqlinc` + `010-oracles.sqlinc` (two real active content types), then:

- `005-helpers.sqlinc` - governed-step helpers (submit, assign, approve, activate or schedule a defined pattern) and probes.
- `010-storage-and-registry.sqlinc` - AC-189 reserved raw keys, AC-194 registry untouched, AC-195 lifecycle columns.
- `020-cross-owner.sqlinc` - AC-190 with a second real owner.
- `030-submit-gates.sqlinc` - AC-198 pattern basis and AC-200 submit gates and frozen dependencies.
- `040-activation-recheck.sqlinc` - AC-209 and AC-193 clause 7.

Add a case by defining the pattern with `pg_temp.s12pd_run` and driving it with `pg_temp.g2p_step`. Related: `../phase_02_slice_12_pattern_definition/`,
`../phase_02_slice_12_governed_recheck_pattern/`, `../phase_02_slice_12_gaps_governed/`.
