# Native QA amendment — completed first-empty replay version

Parent pushed/verified052db0bf. Independent6.1/ultra read-only review found one
P2 assertion gap in the frozen new unit: the three completed replay fixtures inherit
plan.version7 equal to job.expectedVersion7. Actual completion advances version;
BE03a DEC-162 requires completed read-only replay without reacquiring/mutating.
Production's generic completed exception is currently correct. This is a test
strengthening, not a new production defect or acceptance proof.

Root ONLY `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`.
Author native gpt-6-astra/high. Edit ONLY
`apps/worker/src/content-schema-registry/migration-worker-first-empty-baseline.test.ts`:
set plan version to `'8'` in all three completed actual-worker replay variants;
retain original job expectedVersion `'7'`, exact readPlan operand/call history,
full completed outcome and no-other-RPC assertions. Preserve all65 cases/titles
and parser/negative/successor controls. No additional source/support/test edits.

PURE ctx JavaScript fs/path reads and native apply_patch writes. NO commands,
exec/write_stdin/shell/child_process/scripts/tests/DB/network/format/lint/TSC/git/
packages/commits/nested agents. Parent alone executes and witnesses frozen RED
again before parser GREEN author starts. SQL helper author has a disjoint active
forward-migration claim; never touch or stage its unfinished source.
Read actual completion SQL348–350, Worker admission365 and BE03a DEC-162 before
edit. Author results UNRUN. Freeze file immediately and report exact amendment.
