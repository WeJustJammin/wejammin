# Lane reviewB-2 report (2026-10-11)

Worktree `/home/rob/.codex/worktrees/phase2-slice11/WeJammin`, branch `claude/phase2-slice11`. Started at HEAD `89f30363`;
HEAD at the time of writing `dd1ee1ce`. I committed, staged, stashed and reset nothing. The previous reviewB-2 agent left no edit
in the working tree (its snapshot `refs/backup/s11-claude-wip-3` holds none of this lane's files), so all of this was done from the
three findings of `review-b-code.md`: B-02, B-06, B-08. Raw logs: `lane-reviewB-2-logs/` (README inside).

## Result in one table

| Finding | Outcome |
| --- | --- |
| B-02 | FIXED. On the database's `preflight_evidence_stale` the sweep recomputes the proof and executes the same claim again under the same lease, at most twice more, never after the 15,000 ms job deadline. Unit + real-stack proof. |
| B-06 | PROVED. One real-stack apispec pages a state-filtered history through the production Worker route with the sealed cursor: 16 cases, all green on the first run. |
| B-08 | (a) Production trigger: NOT defined by the locked specs; exact gaps below, no wiring, boundary documented in code. (b) Session-open-after-claim lease handling FIXED per BE00. |

## Files changed

Production:

| File | Change |
| --- | --- |
| `apps/worker/src/async-runtime-rpc-errors.ts` | NEW `AsyncRpcRefusalError extends AsyncRpcDependencyError` (`refusal: string`; still `http_error`, retryable, `dependency_unavailable`). |
| `apps/worker/src/async-runtime-rpc-response.ts` | NEW `httpFailure()`: a 4xx whose bounded (4 KiB) body is exactly `{code:'P0001', message:<identifier token, 1-64 chars>}` becomes the typed refusal; every other non-2xx stays the opaque `http_error`. The body is never retained. |
| `apps/worker/src/async-runtime-rpc-transport.ts` | `!response.ok` now `throw await httpFailure(response, controller.signal)` (one line). SHARED transport: every other caller behaves as before (same class family, reason, disposition, message). |
| `apps/worker/src/cms-publication-schedule-sweep-evidence.ts` (NEW, 139 lines) | `proofFor` (moved from the sweep, now takes the job signal), `executeWithFreshEvidence`, `isStaleEvidenceRefusal`, `EVIDENCE_REEXECUTIONS_MAX = 2`. Does not import the CMS-03B-20 port (the import-graph test pins the sweep as its only importer). |
| `apps/worker/src/cms-publication-schedule-sweep.ts` (285 lines) | Uses the module above; ONE tick is one 15,000 ms job (`CMS_SCHEDULE_DEADLINE_MS`) shared by the claim and every execute (job `AbortController`, `clearTimeout` in `finally`); no schedule starts after it, `deadline_exceeded` logs the unstarted count; new `evidence_stale` warn event; `execute_failed` now carries `errorCode: preflight_evidence_stale` when the bound is spent. |
| `apps/worker/src/production-job-effect-dispatcher.ts` | `BOUNDARY:` comment (B-08 gap) at the absent-`prepareSchemaDryRun` refusal. No behaviour change. |
| `packages/application/src/infrastructure/jobs/cms-lease-control.ts` | NEW export `isAttributableClaim` (receipt identity and version checks factored out of `openCmsLeaseSession`, which uses it). |
| `packages/application/src/infrastructure/jobs/consumer.ts` (233 lines) | `session === null` after a successful claim now calls `releaseUnopenedClaim`: outcome CAS `running -> queued` (`retryable`, `LEASE_CONTROL_UNAVAILABLE`) at the claim's version and token when the receipt is attributable; otherwise (or on CAS failure) the plain `retry/lease_conflict`. |
| `apps/worker/src/README.md`, `packages/application/src/infrastructure/jobs/README.md` | Document the above. |

New tests: `apps/worker/src/async-runtime-rpc-refusal.test.ts`, `apps/worker/src/cms-publication-schedule-sweep-stale-evidence.test.ts`,
`apps/worker/src/cms-publication-schedule-sweep-evidence.test.ts`,
`packages/application/src/infrastructure/jobs/consumer-cms-session-release.test.ts`,
`tests/postgrest/phase-02-slice-11-sweep-stale-evidence.apispec.ts`, `tests/postgrest/phase-02-slice-11-history-sealed-cursor.apispec.ts`.
Edited existing tests: see "Changed titles". `cms-publication-schedule-sweep-deadline.test.ts` was NOT touched (see "Coordination").

No SQL, migration or contract file changed.

## B-02: a stale proof must not cost a retry

Spec: BE03b:1819 (stale proof is 409 `preflight_evidence_stale`, "retry the command"); DEC-169 ("propagates its conflict without
consuming retries"); BE03b:1887 Schedule execution (the claim's expired-lease step spends `attempt_count` + 1); BE03b:179 (CMS-03B-20
runs "under the 15,000 ms job deadline").

Root cause confirmed: `AsyncRpcDependencyError('http_error')` hid the body of every non-2xx, so the sweep could not tell the
rolled-back stale refusal from an unknown outcome, and the sweep never executed twice (lease expiry then spent the retry).

RED (before any production edit):
- `lane-reviewB-2-logs/red-worker.out`: 18 failed / 5 passed. Right reasons: `The instanceof assertion needs a constructor but undefined was given`
  (no typed refusal), and the sweep test `expected [ ...(3) ] to deeply equal [ ...(5) ]` (claim, load, execute and then nothing; the second
  load and execute never happen).
- `lane-reviewB-2-logs/baseline-worker.out`: the two AC-082 job-deadline cases of `cms-publication-schedule-sweep-deadline.test.ts` already failed
  at HEAD (the sweep had no job-level deadline).
- Real stack, `red-api-stale-evidence-mutant.log`: the apispec against the pre-fix behaviour (a vitest alias replaces ONLY the evidence module by a
  copy with `EVIDENCE_REEXECUTIONS_MAX = 0`, in `.lane-logs/reviewb2/`; no shared source was mutated): `AssertionError: expected 1 to be 2`
  at `phase-02-slice-11-sweep-stale-evidence.apispec.ts:168` (`expect(executions).toBe(2)`): the database refused the first execution as stale and the
  sweep stopped. The clean control tick passed in the same run, and the 16 history cases passed.

Fix: as in the file table. The cause is injected honestly: the Worker clock reads two minutes behind until the first execute leaves for the real
PostgREST stack (the 60 s window exists for exactly a Worker/database clock disagreement); the claim, load, both executes and verdicts are the real
RPCs through the production sweep module.

GREEN:
- Unit: `green-worker-b02.out` (24 files / 267 tests), final `green-final-neighbours.out` (38 files / 477 tests, includes the AC-082 deadline file, now
  6/6, and the import-graph and principal tests). Changed production files: 100% statements, branches, functions, lines (`coverage.out`: 362/362, 247/247,
  56/56, 330/330). `tsc --build` clean for every file of this lane (`tsc-build.out`: the only errors are 6 in another lane's untracked
  `apps/web/.../cms-workflow-input-retention.test.tsx`).
- Real stack: `green-api-stale-evidence-and-history.log`: 2 files, 18 tests, exit 0. The stale case asserts, between the refused and the accepted execute,
  that the schedule row is still `executing/<claim version>/0/-` with the claim's lease live; then two proofs and two executes with identical
  claim operands, the first answered 400 / P0001 / `preflight_evidence_stale`, the second `completed`; the accepted proof is fresh (within 60 s of now, about 120 s newer
  than the refused one, same binding and input hash); final row `completed/<v>/0/-` (attempt_count still 0); durable effects equal the clean control tick's (entry
  effects, one publication, one accessibility evidence row keyed to the accepted proof, identical audit trail by correlation id).

Design notes: the recomputation is bounded at 2 more executions (3 proofs in all) because a stale cause that survives a fresh proof (a different checker version
than the database registry's) is persistent and belongs to the lease; a proof the checker cannot produce on the re-run is sent as `null`, which is the database's
own unavailable-checker ladder (faster than waiting out the lease and the same attempt cost); any other failure keeps the old rule (unknown outcome, never retried).

## B-06: sealed-cursor paging through the Worker route

`tests/postgrest/phase-02-slice-11-history-sealed-cursor.apispec.ts` (16 cases; the Slice 11 production Worker app -> RPC adapter -> Kong -> PostgREST -> SQL).
Fixture through the production routes: one entry, revision 1 published, revisions 2-7 draft, revision 8 submitted. Proven: a `draft` filter pages [7,6], [5,4], [3,2] with
two cursors and none on the last page (resumption exactly after the last scanned candidate, no duplicate or gap, both excluded ends absent); a filter whose only match is the
oldest or newest revision ends without a cursor; each cursor is the fixed 273-byte / 364-character envelope with first byte 0x01, canonical standard base64 carrying `+` or `/`
(so the percent-encoded query string is exercised), discloses neither the entry nor any revision id nor member name; the Worker passes the RPC the exact cursor string and returns the
RPC's `nextCursor` byte for byte; two identical first-page reads give different cursors (fresh nonce) that resume to the same page; an unfiltered request keeps the six-member
signed envelope; a flipped bit in the key id, nonce, ciphertext or tag is the typed 409 `CONFLICT` (`recoveryAction: refresh`); a valid cursor replayed with another state, limit,
no state or a locale is 409; a sealed envelope one byte short or long is 400 `INVALID_REQUEST`; every refusal writes nothing (14-group `snapshotDigest` unchanged).
RED: not applicable. B-06 is a coverage gap, not a defect, and the spec passed 16/16 on its first real-stack run (`red-api-stale-evidence-mutant.log` and the GREEN log), so it found no
production bug. I did not manufacture a mutation of the SQL wrapper; the 409 cases fail if the tag, key or context check is removed, but that was not run.

## B-08

### (a) Is a production trigger for the claimed CMS preparation entry (`prepareSchemaDryRun`) defined? No. I wired nothing.

Defined and already wired: the producer (CMS-03A-10 enqueues `job.requested`, BE03a:2536-2543), the immutable-origin verification and claim/heartbeat/CAS path
(BE00:531-546, BE03a:2544-2554; `production-async-entrypoint.ts` passes `verifyCmsSchemaDryRunOrigin`, `async-runtime.ts` passes `leaseNow`), and the entry itself
(`createClaimedSchemaMigrationPreparation(...).process(input, {signal, attempt})`, source-only). What no locked spec states, and what a production callback must decide:

1. Result map. `ClaimedSchemaMigrationPreparationResult` (`invalid_claim`, `resolution_failed`, `invalid_resolution`, `processed{MigrationWorkerResult}`; nine worker outcomes:
   completed, progress, retry, duplicate, stale, blocked, failed_retryable, failed_terminal, dead_letter) has to become a `JobEffectResult` (`queued | succeeded | failed | cancelled |
   pending_manual_review`, `errorCode`, `resultRef {type, id}`). BE00:552 says only "success writes one immutable result"; BE03a:2544-2554 says the sealed report row is the sole result authority and
   that queued continuation retries without a processed marker, but not which outcomes are continuation, terminal or manual review, nor the `resultRef.type` token (the only occurrence, `cms_schema_migration`,
   is a test fixture in `production-job-effect-dispatcher-cms-preparation.test.ts:64` with a dummy id). `migrationQueueOutcome` (`production-worker-runtime-cms.ts:73`) is the ack/retry map of the legacy EVENT path, not a Job-state map.
   The Codex QA gate (`.memory/wiki/knowledge/2026-10-10-slice-11-unwired-claimed-entry-contract-qa-gate.md`) records the same: "No queued/ACK policy inferred".
2. Stage fence. BE03a:2551 ("private stage fences ... remain mandatory") has no DDL/RPC contract tying the BE00 lease token and version to the migration stage RPCs, and nothing says where
   `control.checkpoint()` must be called relative to them. The lease foundation (`cms-lease-control.ts`) explicitly "does not thread checkpoints into CMS stage execution".
3. Attempt and budget. The entry requires `{signal, attempt}`; `JobEffectInput` carries neither, and no spec names the source of the attempt number (queue message attempts vs the Job's attempt evidence)
   or the per-invocation budget (BE00:552 gives lease 5 m default / 14 m max, max 4 deliveries, no per-invocation deadline).
4. Environment binding. `production-async-entrypoint.ts` composes the dispatcher from verification dependencies only; the worker identity, port and telemetry of a preparation callback are outside any spec.

Inferring these would be inventing behaviour (and `.claude/rules/decision-classification.md` makes the Job-state semantics an architecture decision). Per
`.claude/rules/boundary-not-placeholder.md` the existing typed refusal (`pending_manual_review` / `DEPENDENCY_UNAVAILABLE` when the callback is absent) stays the boundary; it now has the `BOUNDARY:`
comment naming the four gaps, and its sentinel test is `production-job-effect-dispatcher-cms-preparation.test.ts`, "CMS with only object verification configured is unavailable without invoking it". `TRACKING:` is
stated as not yet opened: issue creation still awaits the owner's permission (STATE.md open question). Tracker/ledger wording: "forwarding only, no consumer; production preparation callback is an explicit open item" (as B-08 asked).
Owner question to close it: ratify the result map (which of the nine outcomes are `queued`, `succeeded`, `failed`, manual review; the `resultRef` type token), the stage-fence checkpoint contract, and the attempt/budget source.

### (b) Session cannot open after a successful claim: FIXED per BE00

BE00:552 "retryable pre-effect failure returns job to queued"; BE00:548 "acknowledges only after a durable terminal/next state". The old path returned `retry/lease_conflict` while the Job stayed `running`
under a lease nobody renews (the next deliveries hit the live lease; after four deliveries the Job sat `running` for good). Now the unopened claim is handed back to `queued` by the ordinary outcome CAS at the
claim version, only when the receipt is attributable to this claim (same job, original token, expected version equal to the pre-claim version, a positive decimal version that advances it). An unattributable receipt
proves nothing about the row: no write, plain retry. CAS conflict or failure stays the plain retry. No effect, no processed marker, no acknowledgement.

RED `red-b08-release.out`: 7 failed / 7 passed; `AssertionError: expected false to be true` at `same(await f.run(), queuedDecision())` (the old code answered `retry/lease_conflict` with no write); the 6 unattributable-receipt cases and the
ordinary-path case already passed (they pin the unchanged behaviour). GREEN: `green-b08.out` 21 files / 283 tests (jobs, dispatcher, receiving composition, async entrypoint), `green-final-neighbours.out` 38 files / 477 tests.

## Changed titles (evidence ledgers cite titles)

`apps/worker/src/production-job-effect-dispatcher-cms-lease-control.test.ts`
- OLD `refuses unusable capability or initial receipt %# before dispatcher effects`, 11 cases 0-10 = `{clock:false}`, `{hb:false}`, `{now:NaN}`, `{now:301_000}`, foreign job id, foreign token, `expectedVersion:'8'`, `version:'7'`,
  `version:'1e3'`, `leaseUntilMs:NaN`, `version:'6'`; every case expected `retry`, calls equal to the claim prefix, no write.
- NEW same title, 6 cases 0-5 = foreign job id, foreign token, `expectedVersion:'8'`, `version:'7'`, `version:'1e3'`, `version:'6'`; same expectations (the receipts are unattributable).
- NEW `returns an unopened claim to queued for an unusable capability or receipt expiry %# before dispatcher effects`, 5 cases 0-4 = `{clock:false}`, `{hb:false}`, `{now:NaN}`, `{now:301_000}`, `{leaseUntilMs:NaN}`; expects
  `completed` / `applied` / `queued` / `nextVersion "20"` / `processed: null`, calls = claim prefix + exactly one `apply` (`currentState running`, `"19"`, `nextState queued`, `retryable true`, `errorCode LEASE_CONTROL_UNAVAILABLE`), no effect, no processed.

`apps/worker/src/async-runtime-cms-lease-control.test.ts`, `asks the trusted clock afresh instead of reusing the frozen request time` (title unchanged)
- OLD calls `[read, read, restore, restore, claim]`, retry once. NEW the same plus `apply_job_outcome` (`p_expected_version '19'`, `p_next_state queued`, `p_error_code LEASE_CONTROL_UNAVAILABLE`, `p_retryable true`), retry once, and `ack` never called.

Titles added (none replaces an existing one): `async-runtime-rpc-refusal.test.ts` "a database refusal token through the RPC transport" (surfaces a P0001 token as a typed refusal ...; accepts %s x2; keeps %s an opaque
http_error without leaking the body x9; keeps an oversized error body ...; keeps a 5xx with a token body a plain http_error ...; does not read the body of a successful response differently ...);
`cms-publication-schedule-sweep-stale-evidence.test.ts` "a stale accessibility proof at execution" (recomputes fresh checker evidence and executes the same claim again under the same lease; re-executes at most twice more, then leaves the
schedule to its lease and carries on with the batch; sends no proof on the re-execution when the checker cannot produce one ...; does not re-execute after %s x4; never recomputes past the 15,000 ms job deadline ...; never reuses the
stale evidence object ...); `cms-publication-schedule-sweep-evidence.test.ts` "executeWithFreshEvidence" (9); `consumer-cms-session-release.test.ts` "a claimed CMS delivery whose lease session cannot open" (returns the job to queued at the
claim version when there is no %s x5; makes no write for a receipt it cannot attribute to the claim (%s) x6; stays a retry with no processed marker when the release CAS finds the lease already gone; stays the plain lease-conflict retry when the
release CAS itself fails; leaves ordinary and unverified deliveries untouched ...); apispecs `[CMS-03B-20] a clean tick completes the control publication ...`, `[CMS-03B-20] a proof the database refuses as stale is recomputed and the same claim completes under
the same lease with the attempt count unchanged`, and 16 `[CMS-03B-03] ...` titles in `phase-02-slice-11-history-sealed-cursor.apispec.ts`.

## Coordination (AC-082 deadline file)

`apps/worker/src/cms-publication-schedule-sweep-deadline.test.ts` (modified in the working tree by another lane before I started) was failing 2 of 6 at HEAD because the sweep had no job-level deadline
(`baseline-worker.out`). B-02 needs "within the 15,000 ms deadline", so my sweep change implements the whole-job budget that file specifies. I did not edit the file: all 6 cases now pass unchanged (final neighbour run). If the e2e or
reviewA-2 lane also edits `cms-publication-schedule-sweep.ts` for the same deadline, they must reconcile with this version (a job `AbortController` created at tick start, signal threaded to `claimDueSchedules`,
`executeClaimedSchedule` and `proofFor`; `deadline_exceeded` with `unstarted`).

## Open items for the orchestrator

- B-08(a): the four spec gaps above need an owner/spec decision before any production preparation callback; tracker/ledger should say "forwarding only, no consumer". Boundary tracking issue still unopened (owner permission).
- Ledger/AC citations: AC-082 clause 3 (job deadline) is now satisfied by the production sweep and its test file; B-02 / DEC-169 "without consuming retries" is now true end to end (cite the stale-evidence unit file and the apispec); AC-086 gains the
  history apispec. `docs/runbooks/platform/cms-publication.md:71` could add "one tick is one 15 s job; a stale proof is recomputed in-tick".
- The `AsyncRpcRefusalError` seam is generic (a 4xx P0001 identifier token); other Worker RPC callers may use it later but none does today.
- The real-stack stale case injects a Worker clock offset (`vi.spyOn(Date, 'now')` until the first execute); it assumes no other due schedule is claimed in the same tick (it filters on its own schedule id, but others would see the same skew). The specs run after `db:reset` like their siblings.
- Persistent staleness (a checker version the registry rejects) is covered by the unit bound only; a real-stack version would leave an `executing` row for five minutes, so I did not add one.
