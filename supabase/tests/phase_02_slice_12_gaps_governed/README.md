# claude_s12_gaps_db2 governed fragments

Shared fragments of the `phase_02_slice_12_gaps_governed_*.sql` entrypoints (gap tests for the Slice 12 ledger clauses that no
earlier suite proved; brief `docs/handoffs/2026-10-22-claude-s12/briefs/gap-tests.md`).

- `005-helpers.sqlinc` - `g2_try` (a rolled-back direct-statement probe returning `sqlstate:message`), review-copy and decision-insert
  statement builders, and the three-role denial probe.
- `010-setup.sqlinc` - the real CMS-03A-15 grants the governed worlds need.
- `015-taxonomy-helpers.sqlinc` - real taxonomy subjects (create, submit, approve) and the expected-basis builders.
- `020-persistence-probes.sqlinc`, `030-reject-audit.sqlinc` - AC-251 .. AC-255 behaviour and the AC-197 rejection audit
  (entrypoint `phase_02_slice_12_gaps_governed_persist.sql`).
- `040-lifecycle.sqlinc`, `050-policy-basis.sqlinc`, `060-taxonomy-gates.sqlinc`, `070-canonical-recheck.sqlinc` - AC-195, AC-198, AC-201,
  AC-202 (entrypoint `phase_02_slice_12_gaps_governed_basis.sql`).
- `080-template-gates.sqlinc`, `090-template-activation-recheck.sqlinc` - AC-199 and AC-208 (entrypoint `phase_02_slice_12_gaps_governed_gates.sql`).

Add a family by writing a new numbered fragment and including it from the entrypoint whose world it needs; every title carries the
criterion marker `[P2-S12-AC-NNN]` and is unique in its entrypoint. Entrypoints include the S09 head first
(`phase_02_slice_09_dec108/00-helpers`, `01-actors`, `02-chain`, `phase_02_slice_09_dec119/00-support`), then the governed-submit
fixtures and the governed-assignment, governed-activation and governed-recheck worlds, then `005-helpers` and `010-setup`.
Related: `../phase_02_slice_12_governed_submit/`, `../phase_02_slice_12_governed_activation/`, `../phase_02_slice_12_governed_recheck/`.
