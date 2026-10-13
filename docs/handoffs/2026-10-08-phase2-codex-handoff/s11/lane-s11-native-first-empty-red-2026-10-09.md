# Native QA-RED — DEC-162 first-empty plan contract

## Authority and checkpoint

Owner approved both recommended policies ("approve all"); DEC-162/163 are
canonical. Main/review model gpt-6.1-sol/ultra. Native author gpt-6-astra/high.
Only active root `/home/rob/.codex/worktrees/phase2-slice11/WeJammin` is in scope.
Parent checkpoints/pushes this claim and live handoff before dispatch.

## Exact write scope

Create ONLY:
`apps/worker/src/content-schema-registry/migration-worker-first-empty-baseline.test.ts`.
Maximum400 lines, prefer250. Do not edit production, support, old tests, shared
README, progress, contracts, SQL, packages/config/lock/environment or other files.
If another file is essential, request exact scope BEFORE touching it.

## Mandatory source-only constraints

Read relevant AGENTS/rules/skills and cited BE03a DEC-162 source before edits.
Use pure context-mode JavaScript fs/path reads and native apply_patch writes.
NO commands/exec_command/write_stdin/shell/child_process, scripts, tests, DB,
network, formatting/lint/TSC/git/commits, package work or nested agents.
Parent alone executes. Report all authored cases as UNRUN, never RED/GREEN.

## Required tests

Use actual exported MigrationPlanRecordSchema and actual Worker process for the
completed replay, existing basePlan/event/job support and explicitly controlled
RPC test transport. No any or casts bypassing validation. No authority claims
from unit stubs. Exact keys, unknown fields, UUID/counter/hash validation remain.

- Accept genuine pending additive first-baseline shape: source/active null,
  sourceHash zero64, transform pair null, source/target/error/migrated/failed
  counters and cursor canonical zero. Assert parsed own properties preserve null.
- Noncompleted first-null source requires null active; a non-null current active
  UUID is accepted for completed replay only. Completed-but-awaiting-public-
  activation retains null active. Eligibility is still proved by the protected
  producer, not by this shape alone.
- Reject null-source plans with non-additive classification, transform pair,
  nonzero source hash or any nonzero counter/cursor; malformed/undefined IDs and
  target UUID; null active on ordinary non-null-source successor; source=target;
  unknown keys. Do not weaken existing regular successor acceptance.
- Accept completed first-null source with target-active or later scoped active
  UUID; actual process returns completed and only reads plan (no claim/scan/seal/
  backfill/verify/activate/rollback). Completed pre-reviewed-activation may still
  have null active: do not invent a state rejection from current stage defect.
- Provisional zeros are NOT verified emptiness. Do not assert this unit proves
  candidate version1/type/owner/scanner/sealing SQL authority. That producer guard
  remains a separate API/SQL RED lane; no fabricated baseline ID or row evidence.

Read current contract test/support/Worker APIs. Keep old titles untouched; use
literal descriptive DEC-162 titles. Return exact paths, case/table-row count,
scope compliance and missing dependencies. Freeze source after final report.
