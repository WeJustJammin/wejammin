# Lane B128 report: production trigger of the claimed CMS schema dry-run preparation (tracked boundary #128, finding B-08)

Worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`, branch `claude/phase2-slice12`, HEAD `c1cca047` when this was
written (nothing of this lane is committed; the tree also holds other lanes' uncommitted work). Binding rulings applied: DEC-183
(Job map), DEC-184 (delivery budget), the orchestrator's stage fence (2C) and environment binding (4A). Design:
`b08-production-trigger-design.md`. Every log named below is in `/tmp/claude-1000/b128/` (scratchpad) unless it is a lane log.

## Result

A production `cms.schema.dry_run` Job delivered through `createProductionAsyncEntrypoint()` now reaches the claimed preparation and
settles in exactly one BE00 state (`queued`, `succeeded`, `failed`), never `pending_manual_review`, never `cancelled`. Proven in
unit composition (over a scripted PostgREST) and on the real stack (Worker + Kong + PostgREST + newest SQL): 8/8 apispec tests pass,
among them one completed dry run (Job `succeeded`, `result_ref {cms_schema_dry_run_report, reportId}`) and one blocked dry run (Job
`failed` `MIGRATION_BLOCKED`). No SQL change was needed (the real `cms_rollback_schema_migration` accepted both the `dry_running` and
the `running` rollback with a lease the Worker found or claimed). No migration written; range 20261013200000-209999 untouched.

## The defect, reproduced first (RED)

`production-async-entrypoint-cms-preparation.test.ts` (new): a first-empty baseline Job through the production entrypoint.
RED log `red-01-composition.log`: `AssertionError: expected [] to deeply equal [ { …(7) } ]` at `expect(world.outcomes)` (lines 27
and 55): no `apply_job_outcome` was ever written. A probe of the pre-change code showed the wire history
`read_canonical_job, cms_get_schema_migration_plan, read_canonical_job, read_restore_fence, read_restore_fence, claim_job`,
`ack` 1, `retry` 0, Job `running`: stuck running with its message acknowledged (design F5). GREEN after the wiring: the Job ends
`succeeded`.

## Changes (source)

| File | Change |
| --- | --- |
| `apps/worker/src/production-job-effect-dispatcher.ts` | `BOUNDARY:` block deleted. CMS family answers only `queued`/`succeeded`/`failed`; absent dependency, throw, malformed or out-of-vocabulary result is `queued DEPENDENCY_UNAVAILABLE` (`failed MIGRATION_RETRIES_EXHAUSTED` from delivery 4, also as a backstop for any `queued`). Forwards `(input, control, context)` to `prepareSchemaDryRun`; verification still gets `(input)` only. |
| `apps/worker/src/async-runtime.ts`, `async-runtime-job-delivery.ts` (new), `async-runtime-job-context.ts` (new), `async-runtime-rpc-types.ts` | Per-message closure `{env, signal, deliveryAttempt}` for `cms.schema.dry_run` only; invocation signal aborts at `min(240000, lease remaining - 60000)` ms (timer never outlives the effect); `deliveryAttempt = max(1, message.attempts)` with a finite-integer guard; `pacedRetry` (15/60/300 s for retry-type outcomes, bare for `progress`). `packages/application` untouched. |
| `apps/worker/src/async-entrypoint.ts`, `async-entrypoint-job-outcome.ts` (new) | `JobQueueMessageOutcome` and `settleJobMessage`: `retry({delaySeconds})` for a positive whole number, else the bare `retry()`. |
| `apps/worker/src/production-schema-migration-preparation-claimed.ts` (new) | Per-environment-object `WeakMap` composition (`createProductionClaimedPreparation`, `createProductionClaimedPreparationEffect`); a failed construction is not cached and becomes row 14; emits the Job-path `cms.registry.queue_attempt` log. |
| `apps/worker/src/production-async-entrypoint.ts` | Wires `prepareSchemaDryRun` (reuses `ProductionSchemaMigrationWorkerOptions`; `maxBatchesPerInvocation` stays default 1). |
| `.../content-schema-registry/claimed-schema-migration-preparation.ts` | `process` takes optional `control`; new `exhaust`; job payload helper extracted. |
| `.../claimed-schema-migration-preparation-job-result.ts` (new) | The total DEC-183 map (14 rows), `MIGRATION_WORKER_OUTCOMES` tuple with a compile-time exhaustiveness check. |
| `.../claimed-schema-migration-preparation-lease-fence.ts` (new) | `withJobLeaseCheckpoints`: one guarded RPC caller, `checkpoint()` before the 8 state-advancing RPCs; the first non-`current` checkpoint latches and every later call of any name is stopped (`JOB_LEASE_LOST`, retryable). |
| `.../claimed-schema-migration-preparation-exhaustion.ts` (new), `-job-effect.ts` (new), `-job-payload.ts` (new) | Last-delivery rollback (Job-fenced re-read of the plan, plan lease used if live else claimed, `failAndRollback` reason `MIGRATION_RETRIES_EXHAUSTED`, own 30,000 ms deadline) and the one-delivery composition. |

Rollback scope, a decision beyond the design text: `dry_running`, `running`, `verifying`, `failed_retryable` are rolled back; `draft`
and `ready` plans are left to supersession by the next CMS-03A-10 attempt (the SQL supersedes them); a `verifying` plan whose 30 s
plan lease lapsed cannot be re-leased and is reported `unavailable` (residual below).

## Evidence per requirement (RED log -> GREEN)

| Requirement | RED (log, failing assertion) | GREEN |
| --- | --- | --- |
| Defect (above) | `red-01-composition.log`, no outcome write | `production-async-entrypoint-cms-preparation.test.ts` 11 tests |
| DEC-183 map, each row | `red-02-mapper.log`, module absent (`Cannot find module './claimed-schema-migration-preparation-job-result'`) | `...-job-result.test.ts` 31 tests (4 variants x 9 outcomes, grammar boundaries 64/65 chars, SQL invariants, `JobStatusSchema` parse, dispatcher round trip); reachable rows end to end in the composition file; unreachable rows 8, 9, 11, 13 by the pure test and by `...-reachability.test.ts` (1,836 faulted runs from every plan state: only completed/progress/retry/blocked/failed_terminal occur, pinning F3) |
| Dispatcher CMS family | `red-03-dispatcher.log`, 30 failed (`pending_manual_review` where `queued`/`failed` expected) | `production-job-effect-dispatcher-cms-preparation.test.ts` 55 and `-cms-delivery.test.ts` 17 (117 across the 4 dispatcher files) |
| Context, budget, backoff | `red-04-delivery.log`, 12 failed against the HEAD `async-runtime.ts`/`async-entrypoint.ts` (effect had 1-2 args; `retry()` bare) | `async-runtime-job-delivery.test.ts` 20, `async-runtime-job-context.test.ts` 23, `async-entrypoint-paced-retry.test.ts` 11, `production-async-entrypoint-cms-preparation-budget.test.ts` 11 |
| Stage fence (lost lease stops the next RPC) | `red-05-fence.log`, 11 failed (no checkpoints existed) | `...-lease-fence.test.ts` 15 (order of the 8 vs 3 RPCs, lost at k=1..8 ends the history at the k-th checkpoint, latch, throwing checkpoint, legacy history unchanged) |
| Final-delivery exhaustion + rollback | `red-06-exhaustion.log`, 17 failed (`worker.exhaust is not a function`) | `...-exhaustion.test.ts` 20, `...-job-effect.test.ts` 16 (plan state by state, lapsed lease claimed first, refused rollback/claim/read, lost checkpoint) |
| Capacity 256 x m (F8) | characterization, passes at once | `...-capacity.test.ts` 18 rows: `D(N,m) = 2 x ceil(ceil(N/128)/m) - 1` holds for N = 0..8,193, m = 1..32; within 4 deliveries exactly when `N <= 256 x m` |
| Environment binding | `red-08-factory.log`, module absent | `production-schema-migration-preparation-claimed.test.ts` 11 (two env objects, own base URLs, reuse, no shared effect state, invalid env / transport limit not cached, options, logger failure) |
| Context + job-effect modules | `red-07-context.log`, `red-09-job-effect.log`, modules absent | as above |

Mutation checks (production code mutated, named tests must fail, then restored; logs `mut-*.log`): no rollback call (7 fail), no pacing
(9), budget cap 100 ms (4), fence guard off (14), `blocked` mapped to `queued` (3), deadline x3 (2), manual review allowed (1),
final-delivery backstop off (2), no WeakMap memo (1).

### Real stack (`bash docs/handoffs/2026-10-08-phase2-codex-handoff/lanes/lane-api.sh <worktree> tests/postgrest/phase-02-b08-*.apispec.ts`)

Final run: `exit=0`, 2 files, 8 tests, log `.lane-logs/api-003159.log` (copy `api-run-3.full.log`). Run 1 and 2 found two fixture facts, not
product defects: an existing field's constraints cannot be tightened without a ready plan (so the failing scan uses a new required field), and a
completed preparation closes the candidate (a second attempt is 409 `INVALID_TRANSITION` until the draft is edited).

`phase-02-b08-preparation-job-disposition.apispec.ts`: first-empty baseline -> Job `succeeded`, `result_ref` exact, report `completed`/`pass`/sealed,
plan `ready`, one processed marker, ack once, `read_authorized_job` + production `parseProjection` accept it; redelivery of a settled message acks and
changes nothing; populated type with a new required field -> sealed failing report (`fail`, 5 of 5 rows in error), plan `blocked`, Job `failed`
`MIGRATION_BLOCKED`, `result_ref` null.
`phase-02-b08-preparation-budget.apispec.ts` (5 rows, 1 row per page): m=1 -> deliveries 1-3 `queued` (no error code, bare retry, no marker), delivery 4
rolls the `dry_running` plan to `blocked`, report `failed` with `failure_code MIGRATION_RETRIES_EXHAUSTED`, Job `failed`, ack, marker, and a new
CMS-03A-10 attempt is admitted (not 409); m=2 -> delivery 4 stops mid-backfill, plan `failed_terminal`; m=5 -> `succeeded` in 1 delivery; m=3 -> `succeeded`
in exactly 3 deliveries, `attempt_count` 3; Job lease expired in SQL after the first scan batch -> that delivery sends no second batch/finalize/outcome, Job
stays `running`, `retry({delaySeconds:15})`, the redelivery resumes at cursor 1 and finishes `succeeded` with one evidence row per source row.
Not run on the real stack: the 240 s invocation deadline (covered with fake timers in `production-async-entrypoint-cms-preparation-budget.test.ts`), and a
real-stack RED of the original defect (the pre-change behaviour is shown at composition level; running it for real would have meant breaking shared wiring
while other lanes run).

### Gates on my surface

`vitest run apps/worker/src/async apps/worker/src/production apps/worker/src/content-schema-registry apps/worker/src/index apps/worker/src/boundary
apps/worker/src/import-graph packages/application`: 251 files, 4,245 tests pass. All 24 measured sources (`async-entrypoint*`, `async-runtime*`, the
dispatcher, the factory, every `claimed-schema-migration-preparation*` module) have 100% lines and branches (lcov). Full `apps/worker` + `packages/application`:
9,557 pass; the 12 failures are all `cms-composition*` (other lanes' work in progress). eslint `--max-warnings=0`, prettier and `tsc --build apps/worker`
are clean for my files (tsc still reports `cms-composition` errors that are not mine).

## Existing tests changed (old -> new)

`production-job-effect-dispatcher-cms-preparation.test.ts` (the locked spec now forbids a manual-review answer from the CMS family):

| Old title / expectation | New |
| --- | --- |
| `CMS with only object verification configured is unavailable without invoking it` (the BOUNDARY sentinel; expected `pending_manual_review`) | `CMS with only object verification configured is a queued unavailable Job, never manual review, and does not invoke verification [P2-S12-AC-050]` |
| `%s reports an absent dependency container as unavailable` for 3 types | same title for the 2 verification types; new `CMS reports an absent dependency container as a queued unavailable Job, never manual review [P2-S12-AC-050]` |
| `CMS preserves the validated $state result without claiming extra success` for 5 states | same title for `queued`, `succeeded`, `failed`; `cancelled` and `pending_manual_review` moved to new `CMS refuses a $state result outside the BE00 preparation disposition as a queued unavailable Job [P2-S12-AC-050]` |
| `CMS rejects a non-callable $label preparation dependency`; `%s retains fail-closed thrown-dependency handling` (CMS case); `$type rejects $label through the existing result validation boundary` (CMS cases) | titles unchanged; CMS expectation `pending_manual_review` -> `queued DEPENDENCY_UNAVAILABLE` |

Effect arity and pacing (the effect of a verified CMS delivery now gets `(input, control, context)`; retry-type CMS dispositions are paced):
`async-runtime-cms-lease-control.test.ts` `renews through the protected heartbeat RPC and finalizes at the renewed version`: arity 2 -> 3 plus the context
asserted. `async-entrypoint-queued-continuation-test-support.ts` (all of `async-entrypoint-queued-continuation.test.ts`): effect arity `[2]` -> `[3]` with the
context keys/env/delivery asserted; `retry` for queued-with-code `[[]]` -> `[[{delaySeconds:15}]]`, history `['retry']` -> `['retry', {delaySeconds:15}]`.
`async-entrypoint-cms-origin-admission-test-support.ts`: arity 2 -> 3 with context, retry arguments derived from the expected history;
`async-entrypoint-cms-origin-admission.test.ts` `retains restore fencing after a true immutable origin`: `['retry']` -> `['retry', {delaySeconds:15}]`.
No assertion was weakened; each only gained the context or the BE00 delay.

New tests carry `[P2-S12-AC-050]` (no unresolved implementation boundary): a marker is not proof, the assertions above are.

## Docs

BE03a (`.memory/wiki/specs/be/03a-content-schema-registry.md`): new "Job lease checkpoints" paragraph (design 4(5)), "Preparation Job disposition (DEC-183)"
and "Preparation delivery budget (DEC-184)" subsections (design 3(5), 5(5) and the 4(5) environment sentence, plus the rollback scope, the `queued` /
`errorCode` null-versus-code reading, and the dead-letter residual), three changelog rows dated 2026-10-13. Runbooks: `docs/runbooks/platform/cms-publication.md`
(section "Job lease control" now holds "Preparation Job trigger": map, 256 x m ceiling table, exhaustion signal `MIGRATION_RETRIES_EXHAUSTED` and triage) and
`jobs-outbox-reconciliation.md` (item 6). READMEs: `apps/worker/src/README.md` (replaces the boundary paragraph), `content-schema-registry/README.md`,
`tests/postgrest/README.md`, `tests/postgrest/support/README.md`.

## Needs another owner (I did not touch these)

1. **`tests/contracts/phase-02-slice-11-closeout.test-support.ts` and `.test.ts` now fail** (1 test, `boundaries: the only BOUNDARY: markers ... are the two
   tracked ones`): they pin the #128 BOUNDARY marker and the old sentinel title. Patch: delete the `issue: 128` entry of `TRACKED_BOUNDARIES` (lines 113-120 of the
   support), change `.toEqual([127, 128])` to `[127]` and the title/comment "two" to "one" (test lines 41-45, 395-398). Its other pins hold (the runbook section still
   contains `#128`; line 176 pins `#128` in the feature-ledger note, so the ledger wording and this pin change together).
2. `docs/ARCHITECTURE.md` (lines 1276, 1845) and `.memory/wiki/specs/feature-ledger.md` (line 13) still call #128 an open boundary; BE00:546 needs the one sentence from
   design 3(5) ("The `cms.schema.dry_run` effect's disposition vocabulary, error codes and `resultRef` type are defined in BE03a 'Preparation Job disposition'.").
3. `production-worker-runtime-cms.ts` is not in my file list: the release-level worker id `cms-schema-migration-${env}-${release}` is duplicated in
   `production-schema-migration-preparation-claimed.ts` (asserted equal by a test). Exporting `productionMigrationWorkerId` there and importing it removes the duplicate.
4. DEC for the stage fence (2C) was not recorded (the design says record one only if the owner picks 2B); BE03a cites the design and says "orchestrator decision,
   owner may override". Close #128 with the real-stack evidence above.
5. Owed by DEC-184: measure one 128-row batch against `limits.cpu_ms` 50 before raising `maxBatchesPerInvocation`; then the early-cap decision.

## Residuals (stated in BE03a and the runbook)

- A consumer retry decided before any effect (`lease_conflict`, `canonical_unavailable`, restore fence, an unopened session) on the last delivery still dead-letters
  with the Job `queued`/`running`; paced like every retry, the `DLQ > 0` alert is the net. A lease lost during the last delivery's own rollback is the same case.
- A `verifying` plan whose 30 s plan lease lapsed cannot be re-leased (the SQL claims no lease in that state), so its exhaustion rollback is refused: Job `failed`, plan
  left `verifying` and blocking new attempts with 409. Pre-existing hazard; fix would be SQL (not done: no test required it for the shipped scope).
- The Job status read shows any stored `error_code` as `error {code, retryable:false}`, so a retrying Job polls `queued` with an error (documented, DEC-183 default).
- `deliveryAttempt` and the pacing apply to the CMS dry-run Job path only; other Job types keep the bare `retry()`.

## Pattern candidates

A manual-review answer on the Job path acknowledges the message and leaves the Job `running` (F5). `resultRef.id` must be a UUID or the status route cannot read the
Job. Retry on the Job path had no backoff. `str.replace('', x)` in a scripted edit inserts between every character (my own slip; restored from backup). zsh does not
word-split an unquoted variable, so multi-file test lists in helper functions need bash.

The 14 new/changed focused files above total 260 tests, all passing.
