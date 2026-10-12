# B-08 (tracked boundary #128): production trigger of the claimed CMS schema-migration preparation entry

Status: design document, read-only research lane. Nothing but this file was written. No test, build, database or Git write was run. All
statements about behaviour are from reading the code and specs at HEAD `4a97ee4d` of branch `claude/phase2-slice12`
(worktree `/home/rob/.codex/worktrees/phase2-slice12/WeJammin`). Where a claim is a reading rather than a verified fact it says so. BE00 and
BE03a are unchanged against HEAD, so their line numbers are stable. FE03 has an unrelated uncommitted edit (hunks at lines 885, 1110, 1789,
2824) that does not touch any FE03 line cited here.

Citation key. `BE00` = `.memory/wiki/specs/be/00-infrastructure.md`; `BE03a` = `.memory/wiki/specs/be/03a-content-schema-registry.md`;
`FE03` = `.memory/wiki/specs/fe/03-cms-content-modeling.md`; `IA00` = `.memory/wiki/specs/ia/00-infrastructure.md`;
`RUNBOOK` = `docs/runbooks/platform/jobs-outbox-reconciliation.md`; `WORKER` = `apps/worker/src`; `APP-JOBS` =
`packages/application/src/infrastructure/jobs`; `REG` = `apps/worker/src/content-schema-registry`; `SQL` = `supabase/migrations`.
`file:N` is a line number in that file.

## 0. Summary

| Gap | Classification (decision-classification.md) | Recommendation in one line |
| --- | --- | --- |
| 1 Result map | ARCHITECTURE (owner picks). Rows 2, 3, 5, 6, 7, 10, 11 and 12 of the map are fixed by BE00/FE03/DB constraints (rows 1, 4, 8, 9, 13, 14 and the code names are proposals); one real owner question remains (a sealed failing scan: Job `failed` or `succeeded`), plus Job-state semantics are irreversible once terminal. | Total, fail-closed map: `completed` -> `succeeded` + `{cms_schema_dry_run_report, reportId}`; `progress`/`retry`/`failed_retryable` -> `queued`; `blocked`/`failed_terminal`/`invalid_*` -> `failed`; never `pending_manual_review` or `cancelled`. Full table in section 3. |
| 2 Stage fence | IMPLEMENTATION (orchestrator decides) for the recommended option; it becomes ARCHITECTURE only if the owner wants a BE00 lease check inside the locked worker RPC contracts. | Worker-side `control.checkpoint()` before each of eight state-advancing worker RPCs, through one guarded `RpcCaller`; authority stays with plan-lease CAS and the BE00 outcome CAS; no SQL change. |
| 3 Attempt and budget | ARCHITECTURE for the capacity/exhaustion policy (it is a product-visible ceiling on preparable plan size); IMPLEMENTATION for the attempt source, backoff and deadline plumbing. | Attempt = `Math.max(1, message.attempts)` threaded to the callback; final delivery (4) converts any would-be `queued` into a terminal plan rollback + Job `failed` `MIGRATION_RETRIES_EXHAUSTED`; apply the BE00 15/60/300 s backoff on the Job path; per-invocation budget `min(240000, lease remaining - 60000)` ms; state the capacity as `256 x maxBatchesPerInvocation` source rows. |
| 4 Environment binding | IMPLEMENTATION (orchestrator decides). | A per-message closure in `orchestrateQueueMessage` carries `{env, signal, deliveryAttempt}` to the dispatcher; the production entrypoint memoizes one claimed-preparation callback per `env` object in a `WeakMap` (the existing event-path pattern). No change to `packages/application`. |

Two things the original B-08 write-up did not say, both verified by reading and both load-bearing:

1. Today every production CMS dry-run Job that reaches the effect ends stuck `running` with its queue message acknowledged
   (section 2, F5). The boundary refusal is not harmless: it parks the Job, it does not return it to `queued`.
2. Under the BE00 budget (4 deliveries, one batch of 128 rows per invocation by default) a preparation can only complete when the
   plan has at most 256 source rows (section 2, F8). That is a design fact the owner must see before ratifying anything.

## 1. Method and limits

Read: the three named review documents, the BOUNDARY comment and sentinel test, the Codex QA-gate knowledge note, BE00 and BE03a at the cited lines
plus the whole worker-RPC protocol of BE03a, FE03 dry-run state rows, IA00 JobStatus, the jobs runbook, `cms-lease-control.ts`, `consumer.ts`,
`runtime-types.ts`, `execution.ts`, `transition.ts`, `async-runtime.ts`, `async-entrypoint.ts`, `production-async-entrypoint.ts`,
`production-worker-runtime-cms.ts`, the claimed entry and every stage module it calls, the job SQL authority migrations, the claim resolver SQL,
the plan-lease SQL, and `.memory/wiki/decisions.md` DEC-105..DEC-182 (no decision there defines a Job-state map, a stage fence, an attempt
source or a preparation callback; DEC-108 creates the Job, DEC-127 lets rollback fail a `dry_running` plan, DEC-162 is the first-empty baseline,
DEC-166 is the dependency-recheck continuation precedent). Not run: anything. Section 8 lists what I could not determine.

## 2. Facts established by reading (shared ground truth)

F1. The effect receives `JobEffectInput = {job (pre-claim canonical), envelope (original 8-field), leaseToken, claimedLease?}` and an optional
`CmsLeaseControl`; it receives no `env`, no `AbortSignal` and no attempt number (`APP-JOBS/runtime-types.ts:124-165`). The entry needs all three
of `env` (to build a transport), `signal` and `attempt` (`REG/claimed-schema-migration-preparation.ts:40-44`).

F2. `ClaimedSchemaMigrationPreparationResult` has four variants (`REG/claimed-schema-migration-preparation.ts:17-30`): `invalid_claim`,
`resolution_failed{failure:{code,retryable}}`, `invalid_resolution`, `processed{claimRequest, reportId, result: MigrationWorkerResult}`. Only
`processed` carries `reportId` (= `resolved.report.id` = the dry-run id the browser sees as `dryRunRef.id`, FE03:958) and the nine-value
`MigrationWorkerResult.outcome` (`REG/migration-worker-types.ts:36-45`). The result does not carry the final plan record (version, cursor, lease
token) and does not say whether the report is sealed.

F3. Reachability on the claimed path (event is always `null`, purpose is `dry_run`). Verified by reading; pin each with a test or mutation when implementing.

| `MigrationWorkerResult.outcome` | Reachable for a claimed Job? | Producer (reading) |
| --- | --- | --- |
| `completed` | yes | plan already `completed` (`REG/migration-worker-resolved-admission.ts:89`); sealed all-zero `ready` shortcut (`REG/migration-worker-execution.ts:82-96`); verify+complete under purpose `dry_run` (`REG/migration-worker-verification.ts:103-114`). `activationSwitched` is always false. |
| `progress` | yes | batch loop ended with `done:false` (`REG/migration-worker-dry-run.ts:60`, `REG/migration-worker-backfill.ts:121`). |
| `retry` | yes | plan lease unavailable, heartbeat/read/batch retryable failure, `UNEXPECTED_MIGRATION_STATE` (`REG/migration-worker-execution.ts:130-139`). |
| `blocked` | yes | plan `blocked` after finalize or on arrival (`REG/migration-worker-execution.ts:70-79`, `REG/migration-worker-resolved-admission.ts:161`), reason `MIGRATION_BLOCKED`. |
| `failed_terminal` | yes | `failAndRollback(...,false,...)` (`REG/migration-worker-results.ts:366-372`), non-retryable `failureResult` (`:289`), plan already `failed_terminal` (`REG/migration-worker-resolved-admission.ts:132`). |
| `failed_retryable` | no (today) | only `failAndRollback(...,retryable=true)`; every call passes `false` (`REG/migration-worker-dry-run.ts:51`, `-backfill.ts:112`, `-verification.ts:60`, `-activation.ts:187`) or runs only under purpose `activation` (`-activation.ts:158-170`; `verification.ts:103-114` returns before it for `dry_run`). |
| `stale` | no | `resolved-admission.ts:27-33,59` compare the job payload to the plan, but the payload is derived from that same plan (`REG/claimed-schema-migration-preparation.ts:62-68`); the other producer is the legacy event-claim admission (`REG/migration-worker-admission.ts:106`). |
| `duplicate` | no | only legacy event-claim admission (`REG/migration-worker-admission.ts:98-99`). |
| `dead_letter` | no | every producer needs `event !== null` (`REG/migration-worker-results.ts:275,374`; engine/activation are not on this path). |

`blocked` is ambiguous at the Worker: the plan state `blocked` is produced both by a sealed FAILING scan (row errors; report `completed`, result
fail, BE03a:2227-2230) and by an unsealed rollback of a `dry_running` plan (report `failed`, BE03a:2231, DEC-127), and a redelivery sees `blocked`
in both cases. The result cannot distinguish them (F2).

F4. Database constraints on a Job outcome (these are hard limits on any map). `SQL/20260830100000_persistence_authority.sql:177-178`:
`succeeded` requires a non-null `result_ref` and null `error_code`; `failed`/`cancelled` require a non-null `error_code` and null `result_ref`.
`SQL/20260830120000_persistence_runtime_authority.sql:229-316`: `queued` only with `retryable`; error code grammar `^[A-Z][A-Z0-9_.-]{0,63}$`;
the token-aware CAS needs `state='running'`, matching `lease_token`, `lease_until > now()` and the expected version; terminal states never
reopen; `claim_job` (`:198-227`) increments `attempt_count`, appends an `attempts` entry and refuses once 32 entries exist. The status read parses
`resultRef` with a strict `{type, id: canonical UUID}` schema (`packages/contracts/src/job-status.ts:39-43`) and projects every non-null
`error_code` as `{code, retryable:false}` (`WORKER/jobs/job-status-production-parsers.ts:54-60`). Consequences: a non-UUID `resultRef.id` makes the
Job unreadable by the status route; a `queued` Job that carries an error code is displayed as an error with `retryable:false`. The Job `progress`
column cannot be written by the outcome RPC (no parameter), so migration progress (0..1) stays on the plan.

F5. Consumer dispositions (`APP-JOBS/consumer.ts`, `WORKER/async-runtime.ts`). `pending_manual_review` (or a thrown effect) writes nothing and
returns `manual_review` (`consumer.ts:195-197`), which `queueOutcome` acknowledges (`async-runtime.ts:38-54`). `queued` writes the outcome CAS with
`retryable:true`, records no processed marker (`consumer.ts:211-218`) and so becomes `message.retry()` with no delay. Terminal outcomes record the
processed marker and then acknowledge. Therefore the shipped boundary (`production-job-effect-dispatcher.ts:101-103`, answering
`pending_manual_review`/`DEPENDENCY_UNAVAILABLE`) leaves the claimed Job `running` and the message acknowledged: nothing re-delivers it, and I found no
reaper (grep for requeue/reap patterns in `SQL` and `WORKER`; BE00:440 names only the outbox sweep as a scheduled driver). This is the behaviour of every production CMS dry run today. (Reading, not run.)

F6. Queue budget. `apps/worker/wrangler.jsonc:28-33` sets `max_retries: 3` and the DLQ; BE00:548/552 and RUNBOOK:20 call that "four deliveries
including the initial". BE00:548 also fixes retry delays 15 s, 60 s, 300 s with bounded jitter. The event-consumer path applies them
(`WORKER/event-consumers/retry-schedule.ts:11-18`, attempt = `Math.max(1, message.attempts)`); the Job path cannot: `orchestrateQueueMessage` returns
only `'ack' | 'retry'` and the entrypoint calls `message.retry()` bare (`WORKER/async-entrypoint.ts:140-142,262-266`). Cloudflare `attempts` being
1-based and `max_retries=3` meaning four deliveries is what BE00 states; I did not verify it against Cloudflare documentation (no network).

F7. Two different leases. The BE00 Job lease (token + version + `lease_until`, 300 s default, `async-runtime.ts:78`) and the migration PLAN lease
(owner + token in `dry_run_report->lease`, 30 s default, renewed per batch; `REG/migration-worker-constants.ts:5`,
`SQL/20261002149000_cms_schema_migration_plan_source_count.sql:254-370`). The claimed read is fenced on the Job at read time only: it requires
Job `running`, matching version, matching token and unexpired lease (`SQL/20261005018400_cms_claim_resolver_snapshot.sql:63-66`) and its own header
says it "is a read, not a plan lease or a sealed scan". Every later stage RPC is CAS-checked on plan version, cursor and plan lease
(BE03a:2313-2315) and none accepts a BE00 token. The plan-lease owner is the worker id, `cms-schema-migration-${APP_ENVIRONMENT}-${APP_RELEASE}`
(`WORKER/production-worker-runtime-cms.ts:153-154`), and the same owner may re-acquire a live lease (`SQL/...plan_source_count.sql:322-329`);
exclusion between two concurrent deliveries therefore rests on the plan version CAS, not on lease ownership.

F8. Work per delivery and the delivery arithmetic (derived by reading `migration-worker-batches.ts:47-58`, `-execution.ts:47-139`,
`-dry-run.ts`, `-backfill.ts`; not executed). Page limit 128 rows (`REG/migration-worker-constants.ts:4`, BE03a:2192-2193,2357-2365),
`maxBatchesPerInvocation` default 1, validated 1..32 (`REG/migration-worker-runtime.ts`), per-RPC deadline 15,000 ms
(`WORKER/async-runtime-rpc-types.ts:65`). Scan and backfill each need B = ceil(N/128) batches (+-1 for the final empty page); verification,
completion and the next stage start in the same delivery that finishes the previous stage. With m = `maxBatchesPerInvocation`, deliveries
D(N, m) = 2 x ceil(B/m) - 1. D <= 4 holds iff B <= 2m, i.e. N <= 256 x m (and D = 1 for the first-empty case, N = 0). BE03a states no maximum
source-row count anywhere (searched BE03a, IA03 and the cms migrations): I could not find one.

| m | max N in 4 deliveries | D for N = 300 | D for N = 1,000 |
| --- | --- | --- | --- |
| 1 (default) | 256 | 5 (exhausted) | 15 (exhausted) |
| 2 | 512 | 3 | 7 (exhausted) |
| 4 | 1,024 | 1 | 3 |
| 8 | 2,048 | 1 | 1 |
| 32 | 8,192 | 1 | 1 |

F9. Composition. `createProductionAsyncEntrypoint(fetchImpl, verification?, migrationOptions?, eventConsumerOptions?)` builds the dispatcher from
`verification` alone (`WORKER/production-async-entrypoint.ts:34,41`); `prepareSchemaDryRun` has no producer anywhere (grep finds it only in the
dispatcher type, the dispatcher and tests). The legacy event path shows the pattern for env-bound objects: one `WeakMap<env, worker>`
(`:61-67,115-125`) because bindings arrive per invocation. `createProductionSchemaMigrationPreparationWorker`
(`production-worker-runtime-cms.ts:220`) is the LEGACY worker with purpose `dry_run`, used only by a real-stack test helper
(`tests/postgrest/support/phase-02-slice-11-schema-lifecycle.ts:101`); there is no production factory for the claimed entry.

F10. Deadline precedents: `runWithDeadline` (`WORKER/event-consumers/deadline.ts`, default 15,000 ms); the CMS-03B-20 sweep's single 15,000 ms job
deadline (BE03b:179); the origin verifier is given an `AbortController` that is never aborted (`async-runtime.ts:118-130`).

F11. Resulting-reference precedent. The only production `resultRef` type token is `object_record` (`SQL/20260830160000_upload_completion_authority.sql:484`),
the singular of the table `object_records`. IA00:143 leaves `type` an open string.

## 3. Gap 1: result map (ClaimedSchemaMigrationPreparationResult / MigrationWorkerResult -> JobEffectResult)

### (1) What the locked specs already fix

- BE00:552 (`platform.job.execute`): "success writes one immutable result; retryable pre-effect failure returns job to queued; exhausted/non-retryable
  -> failed; cancelled/terminal/stale -> no-op ack".
- BE00:569 (Job-State Reconciliation): "a block discovered after acceptance becomes `failed` with a registered non-retryable safe error code and domain
  recovery reference, or remains `queued` only when the registry declares a bounded automatic recovery. Domain specs that require a durable `blocked`
  state must evolve the originating IA contract first."
- RUNBOOK:27-29: "A retryable pre-effect failure returns the job to `queued`; a non-retryable or exhausted failure records a sanitized terminal error.
  Terminal states never reopen."
- BE03a:2549-2552: "Queued continuation retries without a processed-event marker or terminal ACK; terminal outcome CAS precedes processed-event recording and ACK."
- BE03a:2153-2154: the report's `job_id` is "the BE00 job, whose own state uses the BE00 `JobStateSchema` vocabulary"; BE03a:2177-2178: the sealed report "is
  the only authority for the result, counts, hashes and row errors"; BE03a:2451: "Migration state is separate and cannot be inferred from job state."
- FE03:952: "A job state of `succeeded` alone never renders a passed result: `result` comes only from the sealed report, and a job state of `failed` or
  `cancelled` without a sealed report renders the unsealed failure copy and keeps submit-review disabled." FE03:959: `jobRef` is "Polite job status line ...
  never a result".
- IA00:143 `resultRef: { type: string; id: string } | null`; IA00:156 "a sanitized terminal error reference".
- DB hard constraints (F4). The consumer's behaviour per state (F5).

### (2) What is genuinely undecided (specs silent)

a. The `resultRef.type` token (IA00:143 leaves it open). The only precedent is `object_record`; the fixture token `cms_schema_migration` in
   `production-job-effect-dispatcher-cms-preparation.test.ts:64` is a dummy with a dummy id.
b. The "registered non-retryable safe error code" set for this Job type (BE00:569 requires one). No registry of Job error codes exists in spec or
   code; the worker's own reason codes (`MIGRATION_BLOCKED`, `MIGRATION_TERMINAL`, `TRANSFORM_*`, `MIGRATION_*`, DB rollback reasons) are the only vocabulary.
c. Whether a sealed FAILING scan (the designer-useful verdict) is Job `failed` (BE00:569 read literally, `blocked` -> `failed`) or Job `succeeded`
   with the report as `resultRef` ("the job did its work"). FE03:952 is satisfied either way because the UI takes pass/fail from the report only.
d. The three non-`processed` variants (no text at all) and the four unreachable outcomes (what a fail-closed answer is).
e. What a thrown exception or an environment that fails validation maps to.
f. Code pass-through of worker `reasonCode` versus a closed set.

### (3) Options

| Option | Description | Pros | Cons |
| --- | --- | --- | --- |
| 1A (recommended) | Total map in the table below. `blocked`/`failed_terminal`/`invalid_*` -> `failed`; `progress`/`retry`/`failed_retryable` -> `queued`; `completed` -> `succeeded` + report ref; grammar pass-through of sanitized reason codes; fixed codes for the rest; never `pending_manual_review`, never `cancelled`. | Follows BE00:552/569 and RUNBOOK:27-29 literally. Needs no new read: every input is already in the entry result. Matches the existing `releaseUnopenedClaim` precedent for retryable pre-effect failure (`consumer.ts:39,65`, code `LEASE_CONTROL_UNAVAILABLE`, state `queued`). Job `failed` code can equal the report `failure_code` (BE03a:2231), one vocabulary end to end. | A sealed failing scan shows as Job `failed`/`MIGRATION_BLOCKED` while the dry-run resource is `completed` + result `failed`; the designer must read the report (which FE03:952 already tells the UI to do). The Job row cannot hold a recovery reference (DB forces `result_ref` null on `failed`), so the "domain recovery reference" of BE00:569 is the existing `activationPreparation.dryRunRef` link (FE03:958), not a Job field. |
| 1B | As 1A, but a sealed failing scan -> `succeeded` + report ref; only unsealed failures -> `failed`. | The Job poll says "the job ran to a verdict"; Job `failed` always means infrastructure failure, matching the sense of BE03a:2231. | Not implementable from the entry result (F3: `blocked` is ambiguous), so it needs either a new post-run report read or an extra field on `processed`, plus a read RPC or resolver change; contradicts BE00:569 read literally; Job `succeeded` for a failing scan invites FE code that trusts it (FE03:952 already warns). |
| 1C | Terminal outcomes -> `pending_manual_review`, only `completed` -> `succeeded`, retry-like -> `queued` (reuse the dispatcher's existing manual-review type). | No new Job-state semantics; smallest diff. | `pending_manual_review` writes nothing and acknowledges (F5): every blocked/failed dry run would leave the Job `running` forever, contradicting BE00:552 "non-retryable -> failed" and RUNBOOK:28. Rejected. |

### (4) Recommendation: 1A

Reasoning: it is the only option fully determined by locked text plus data the entry already returns; 1B needs new reads and contradicts BE00:569
literally; 1C reproduces today's stuck-`running` defect (F5). `resultRef.type = cms_schema_dry_run_report`: derived by the one rule the repo has
(singular of the owning table: `object_records` -> `object_record`, F11), so the token is not a free invention; `id = reportId`, always a UUID, so the
status route can parse it (F4).

Full mapping (this is the table to ratify). "reason" means: the worker `reasonCode` (or `failure.code`) when it matches `^[A-Z][A-Z0-9_]{0,63}$`,
otherwise the named fallback. `R` = `{type:'cms_schema_dry_run_report', id: reportId}`.

| # | Entry result | Reachable (F3) | Job status | errorCode | resultRef | Basis |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `invalid_claim` | yes (defensive; the consumer already validates receipt identity, so only an envelope-shape defect reaches it) | `failed` | `PREPARATION_CLAIM_INVALID` (new) | null | deterministic from the same inputs, no RPC made; BE00:552 non-retryable -> failed |
| 2 | `resolution_failed`, `failure.retryable = true` | yes | `queued` | reason, fallback `DEPENDENCY_UNAVAILABLE` | null | BE00:552 retryable pre-effect; read only, no state touched |
| 3 | `resolution_failed`, `failure.retryable = false` | yes | `failed` | reason, fallback `DEPENDENCY_UNAVAILABLE` | null | BE00:552 |
| 4 | `invalid_resolution` | yes | `failed` | `DEPENDENCY_INVALID_RESPONSE` (existing worker token) | null | legacy treats an invalid response as non-retryable (`REG/migration-worker-validation.ts:62,97,106`) |
| 5 | `processed` + `completed` | yes | `succeeded` | null | `R` | BE00:552; a `completed` result implies a sealed passed report (BE03a:2159-2167: a `completed` report is exactly a sealed one; `REG/migration-worker-execution.ts:80`: "READY is the sealed boundary") - assert in the real-stack test, do not trust the inference |
| 6 | `processed` + `progress` | yes | `queued` | null | null | BE03a:2549; healthy continuation, no error shown |
| 7 | `processed` + `retry` | yes | `queued` | reason, fallback `DEPENDENCY_UNAVAILABLE` | null | BE00:552; precedent `consumer.ts:65` |
| 8 | `processed` + `duplicate` | no | `failed` | `PREPARATION_OUTCOME_UNMAPPED` (new) | null | fail closed on an impossible value; log high-risk |
| 9 | `processed` + `stale` | no | `failed` | `PREPARATION_OUTCOME_UNMAPPED` | null | same |
| 10 | `processed` + `blocked` | yes | `failed` | `MIGRATION_BLOCKED` (existing worker token) | null | BE00:569 literal; recovery reference = `dryRunRef` + new CMS-03A-10 attempt (BE03a:2231) |
| 11 | `processed` + `failed_retryable` | no | `queued` | reason, fallback `MIGRATION_FAILED` | null | keeps its BE00:552 meaning if a producer is ever added |
| 12 | `processed` + `failed_terminal` | yes | `failed` | reason, fallback `MIGRATION_FAILED` (existing token, `REG/migration-worker-backfill.ts:111`) | null | BE00:552; equals report `failure_code` when the rollback RPC failed the report |
| 13 | `processed` + `dead_letter` | no | `failed` | `PREPARATION_OUTCOME_UNMAPPED` | null | needs an event; fail closed |
| 14 | callback threw / environment failed validation / transport misconfigured | n/a | `queued` | `DEPENDENCY_UNAVAILABLE` | null | pre-effect or resumable (BE03a:2583 "each retry rechecks state and cursor"); never `pending_manual_review` (F5) |

Gap 3 overrides rows 2, 6, 7, 11 and 14 on the final delivery (`queued` -> `failed` `MIGRATION_RETRIES_EXHAUSTED`).

Consequence to ratify with the table: rows 2, 7, 11 and 14 put an error code on a `queued` Job, and the status projection shows any non-null `error_code` as
`error{code, retryable:false}` (F4), so a retrying Job polls as `queued` with an `error`. The alternative is `errorCode = null` on every `queued` row, which loses
the reason from the Job row (the attempt summary still records it, BE00:338,559). Default in this design: keep the code (diagnosability; precedent `consumer.ts:65`);
the owner may flip it, which changes four table cells and no code path.

Owner question (single, ready to relay; the rest of the table is an implementation consequence):

**When a dry run finishes with a sealed FAILING verdict (row errors), what should the Job status poll show?**

| Option | Pros | Cons |
| --- | --- | --- |
| A. `failed`, code `MIGRATION_BLOCKED` (BE00:569 literal) | Fully determined, no new reads, one failure vocabulary; the report stays the only verdict authority (FE03:952) | The poll says `failed` for a completed scan |
| B. `succeeded` with the report as `resultRef` | The poll says "ran to a verdict" | Needs a post-run report read or entry change; contradicts BE00:569 literal; risks UI trusting the Job for pass/fail |

Recommendation: A.

### (5) Exact spec text if 1A is adopted

File `BE03a`, new subsection inserted between line 2422 ("No document logging") and line 2424 ("### Workflow policy registry"); plus one changelog row at the
end of the BE03a Changelog table (after line 2830); plus one sentence appended to BE00:531-546 (Registered immutable-origin Job distinction).

```markdown
### Preparation Job disposition (DEC-183)

The `cms.schema.dry_run` Job effect reports exactly one BE00 disposition per delivery: `queued`, `succeeded` or `failed`. It never reports
`cancelled` or `pending_manual_review`. A `succeeded` Job carries `resultRef = { "type": "cms_schema_dry_run_report", "id": <dryRunId> }` and
`errorCode = null`, where `<dryRunId>` is the report id that `activationPreparation.dryRunRef.id` shows. A `queued` or `failed` Job carries
`resultRef = null`. A `failed` Job carries a code of the `^[A-Z][A-Z0-9_]{0,63}$` grammar; when the attempt rolled its report to `failed`, that
code equals the report's `failure_code`. "Reason code" below is the worker reason code when it matches that grammar, otherwise the named fallback.

| Preparation result | Job state | errorCode |
| --- | --- | --- |
| claim binding refused before any RPC | `failed` | `PREPARATION_CLAIM_INVALID` |
| claimed-job resolution failed, retryable | `queued` | reason code, fallback `DEPENDENCY_UNAVAILABLE` |
| claimed-job resolution failed, not retryable | `failed` | reason code, fallback `DEPENDENCY_UNAVAILABLE` |
| claimed-job resolution response refused | `failed` | `DEPENDENCY_INVALID_RESPONSE` |
| worker `completed` | `succeeded` | null |
| worker `progress` | `queued` | null |
| worker `retry` | `queued` | reason code, fallback `DEPENDENCY_UNAVAILABLE` |
| worker `failed_retryable` | `queued` | reason code, fallback `MIGRATION_FAILED` |
| worker `blocked` | `failed` | `MIGRATION_BLOCKED` |
| worker `failed_terminal` | `failed` | reason code, fallback `MIGRATION_FAILED` |
| worker `stale`, `duplicate`, `dead_letter` (cannot occur for a claimed Job) | `failed` | `PREPARATION_OUTCOME_UNMAPPED` |
| exception, or an environment that fails validation | `queued` | `DEPENDENCY_UNAVAILABLE` |

1. A `succeeded` Job means the attempt's report is sealed `completed` with a sealed pass and its plan is `ready` or `completed`. A sealed failing
   report, an unsealed report and a blocked plan are `failed` Jobs. The Job never states a pass or a count: the browser reads the result, counts and
   hashes only from the sealed report (FE03 DEC-108 dry-run states).
2. `blocked` is the BE00 "block discovered after acceptance": `failed` with a registered non-retryable safe code. The domain recovery reference is the
   dry-run resource (`activationPreparation.dryRunRef`), and recovery is a new CMS-03A-10 attempt.
3. A Job error code is limited to the grammar above and never contains a document, row or field value.
4. A `queued` disposition after the final delivery is replaced by the exhaustion rule of "Preparation delivery budget".
```

BE00:546 append: "The `cms.schema.dry_run` effect's disposition vocabulary, error codes and `resultRef` type are defined in BE03a 'Preparation Job disposition'."

Changelog row: `| 2026-10-DD | DEC-183 (owner): defined the preparation Job disposition (worker-outcome to BE00 Job-state map, safe error codes, resultRef type). | /propagate-decision | Migration scan protocol, BE00 Consumer Registry |`.

Also on adoption: shorten the BOUNDARY comment at `production-job-effect-dispatcher.ts:93-100` (the map is now stated; section 6 removes it entirely) and replace
`apps/worker/src/README.md:21-25` per section 6.

### (6) Tests (real composition, no stubbed ports)

Pure (no port exists to stub): `claimed-schema-migration-preparation-job-result.test.ts`.
- Exhaustive over 4 variants x 9 outcomes. Export a `MIGRATION_WORKER_OUTCOMES` const tuple typed `satisfies readonly MigrationWorkerResult['outcome'][]` with a
  type-level equality check against the union, so adding an outcome fails compilation; the test iterates the tuple and asserts one row per value.
- Every output passes the dispatcher `validResult` AND the Job SQL invariants offline: `succeeded` => resultRef non-null, errorCode null;
  `failed` => errorCode matches `^[A-Z][A-Z0-9_]{0,63}$`, resultRef null; `queued` => retryable. `JobStatusSchema.parse` of `{state, resultRef: R}` succeeds
  (UUID id, token regex). `reasonCode` boundary cases: null, lowercase, 64 and 65 characters, a code containing a field value shape.

Real stack (`tests/postgrest/phase-02-b08-preparation-job-disposition.apispec.ts`; fixtures `prepareClaimAttempt` and the claimed-preparation fixture; production
`createProductionAsyncEntrypoint(globalThis.fetch)`; `queue({queue:'platform-jobs', messages:[original envelope]}, env, ctx)`; real PostgREST; run after
`db:reset`, on a quiet host, serialized behind the shared Supabase lock):
- first-empty baseline -> Job `succeeded`, `result_ref = {cms_schema_dry_run_report, report.id}`, report row `completed` + `sealed_at` set + result pass,
  one processed-event row, message acked once, `GET /api/v1/jobs/{id}` through the production route returns a `JobStatusSchema`-valid body.
- populated type with violating rows -> sealed failing report, plan `blocked`, Job `failed` `MIGRATION_BLOCKED`, `result_ref` null, message acked, report readable.
- nonzero source with `maxBatchesPerInvocation = 1` -> after delivery 1 Job `queued`, `error_code` null, no processed row, `message.retry` called, plan cursor advanced; the
  following deliveries end `succeeded`; `attempt_count` equals the number of claims.
- forced terminal rollback of a `dry_running` plan -> report `failed`, `failure_code = X`, Job `failed` with `error_code = X`.
- transport fault injected by a `fetch` wrapper that delegates to the real fetch except for one scripted 503 on one stage RPC -> Job `queued`, then recovers.
- `invalid_claim`, rows 8, 9, 11, 13: unreachable through the real composition by construction (F3); covered by the pure test only, and by a mutation run
  (temporarily make the producer reachable, expect the test to fail) when implementing.

## 4. Gap 2: stage fence

### (1) What the locked specs already fix

- BE03a:2544-2548: "reread and actual claim/heartbeat receipt supply execution CAS versions. Neither event version nor origin verdict grants current-stage authority."
- BE03a:2551-2552: "Private stage fences, report/plan bindings and pre-review preparation guards remain mandatory; direct activation-purpose preparation is not this Job lifecycle."
- BE03a:2312-2315: every worker RPC is service-role only, "runs under the plan's lease; each is CAS-checked against the plan version and cursor and refuses without side effect
  when the plan state, lease or transform pair is not the one it expects."
- BE00:531-546 (immutable-origin path): "Current canonical Job reread, restore fence, lease claim and outcome CAS remain mandatory and use actual server versions/receipts; the origin
  verdict grants no current-stage authority." BE00:552: "heartbeat before one-third lease remains; CAS `Job.version`".
- BE03a:2583: "Worker lease expiry is recoverable; each retry rechecks state and cursor."
- Shipped SQL: the claimed read fences on Job state/version/token/unexpired lease (F7); the Job outcome CAS fences on token, version and `lease_until > now()` (F4). The shipped
  `openCmsLeaseSession` returns "candidate operational facts only. ... a current snapshot never proves ownership; enduring stage authority stays with the atomic database checks"
  (`APP-JOBS/cms-lease-control.ts` header of `openCmsLeaseSession`, lines 96-99).

### (2) What is genuinely undecided

a. Whether any worker stage RPC must verify the BE00 Job lease. BE03a:2551 names "private stage fences" without defining them. My reading (not a fact) is that they are the plan-lease/version/cursor CAS of
   BE03a:2313-2315, in which case the spec requires nothing more. The review note (B-08 gap 2) and the Codex note ("atomic current Job token/version/native expiry/origin/restore/fresh post-lock SQL stage
   fence ... unselected and unproven") read it as a requirement for a BE00-lease binding. The text does not settle it.
b. Where `control.checkpoint()` is called relative to the stage RPCs (no text; lane-reviewB-2-report.md:107 says the lease foundation "does not thread checkpoints into CMS stage execution", and a grep of `apps` and `packages` finds no production caller of `.checkpoint()`).
c. What the entry does when a checkpoint is `lost`.
d. Whether the plan-lease owner should be bound to the Job claim (F7: today it is per release, not per claim).

### (3) Options

| Option | Description | Pros | Cons |
| --- | --- | --- | --- |
| 2A | Checkpoint only at entry boundaries: the consumer's existing `settle()` after the effect (`consumer.ts:187-193`). | No new code. | A 32-batch invocation (`m` up to 32) can run minutes after the Job lease is lost; `settle()` only compares a tracked expiry with the clock, no reread. |
| 2B | SQL fence: add an optional `claimedJob{jobId, leaseToken}` operand to the eight state-advancing worker RPCs and verify it under the plan row lock exactly as the claim snapshot does (`SQL/20261005018400...:63-66`), without the version (a heartbeat renewal bumps the Job version, `cms-lease-control.ts:134-149`). | Atomic, enduring authority; closes the interval between checkpoint and RPC. | Changes ~8 locked worker-RPC request contracts (BE03a:2357-2365 key lists are exact: `cms_worker_require_request`), forward migration + SQL API tests + TS schema/test churn, and the legacy event/activation path uses the same RPCs without a Job, so the operand must be optional and conditionally enforced. An architecture-level change to locked BE03a contracts. |
| 2C (recommended) | Worker-side checkpoints at stage boundaries through one guarded RPC caller; plan CAS and the Job outcome CAS stay the authority. Add the 8 RPCs below to a checkpoint list. | No SQL or contract change; uses the shipped lease-control; bounded cost; early stop on lease loss; reversible. | Liveness/early-stop only: a `current` checkpoint is not ownership, there is an unavoidable interval between checkpoint and RPC. Correctness then relies on plan CAS + deterministic evidence + the Job outcome CAS, which BE03a:2313-2315 already provide. |

### (4) Recommendation: 2C

Reasoning: BE03a already makes every plan write a CAS on plan version, cursor and plan lease and makes the BE00 outcome CAS token-fenced, so a delivery whose Job lease has
lapsed cannot corrupt state (it can only duplicate deterministic, uniquely keyed evidence which the DB recomputes and refuses to double-insert, BE03a:2362-2372,2190-2191). What
2C adds is the BE00 requirement that a delivery stop when it no longer holds the Job lease (BE00:552 heartbeat rule), at the points where continuing would be expensive or
state-advancing. 2B is the only option that makes the BE00 lease an SQL authority for plan writes; it is an owner call (architecture) and I would not recommend it unless the owner wants
that stronger property, because it rewrites locked contracts to guard an interval the plan CAS already guards.

Placement (state-advancing RPCs get a checkpoint immediately before the call; reads and lease renewals do not):

| Checkpointed (8) | Not checkpointed (3) |
| --- | --- |
| `cms_claim_schema_migration_lease`, `cms_process_schema_migration_dry_run_batch`, `cms_finalize_schema_migration_dry_run`, `cms_process_schema_migration_batch`, `cms_begin_schema_migration_verification`, `cms_verify_schema_migration` (it can record a drift verdict), `cms_complete_schema_migration`, `cms_rollback_schema_migration` | `cms_get_schema_migration_plan` (claimed read, SQL-fenced on the Job at read time), `cms_heartbeat_schema_migration_lease` (renews the plan lease), `cms_read_schema_migration_source_rows` (read) |

Mechanism: `process(input, options)` gains an optional `control` and builds a per-invocation runtime `{...runtime, call: guardedCall}` (the same wrapping technique as
`scopeMigrationWorkerRuntime`, `REG/migration-worker-runtime.ts` end of file). `guardedCall` awaits `control.checkpoint()` first for the eight names; on `lost` it returns
`{ok:false, failure:{code:'JOB_LEASE_LOST', retryable:true}}` and makes no RPC. Because a `lost` checkpoint latches `lease.lost`, `settle()` returns `lost` and the consumer discards the effect result and returns
`retry/lease_conflict` with no Job write and no processed marker (`consumer.ts:187-193`); the entry's own result is irrelevant in that case, so no extra map row is needed. Cost: a
checkpoint is the restore-fence read plus the canonical read, plus a heartbeat when at most one third of the lease remains (`cms-lease-control.ts:151-183`): 2-3 RPCs per checkpoint. A first-empty invocation makes 6 worker RPCs, 3 of them state-advancing, so it gains 6-9 RPCs (about 12-15 in all); a one-batch delivery gains 2-3 RPCs per state-advancing call.

Sub-decisions (implementation): keep the release-level worker id (`production-worker-runtime-cms.ts:153`). Binding the id to the claim token would turn a crash redelivery into
`LEASE_UNAVAILABLE` until the 30 s plan lease lapses, and with an immediate retry (F6) that burns deliveries. Record it as a rejected alternative.

### (5) Exact spec text if 2C is adopted

File `BE03a`, new paragraph inserted after line 2315 (end of the first paragraph of "Migration scan protocol"):

```markdown
**Job lease checkpoints (cms.schema.dry_run Job only).** The preparation effect receives the private BE00 lease control of the verified immutable-origin
delivery and awaits one `checkpoint()` immediately before each of these worker RPCs: `cms_claim_schema_migration_lease`,
`cms_process_schema_migration_dry_run_batch`, `cms_finalize_schema_migration_dry_run`, `cms_process_schema_migration_batch`,
`cms_begin_schema_migration_verification`, `cms_verify_schema_migration`, `cms_complete_schema_migration` and `cms_rollback_schema_migration`. It makes no
checkpoint before `cms_get_schema_migration_plan` (the claimed-job resolution is fenced in SQL on the Job's state, token, version and unexpired lease),
`cms_heartbeat_schema_migration_lease` or `cms_read_schema_migration_source_rows`. A `lost` checkpoint stops the invocation before that RPC with no further
worker RPC; the consumer then settles the lost lease as a retry with no Job write and no processed-event marker (BE00 immutable-origin path). A `current`
checkpoint is a candidate operational fact, not ownership: authority for every plan write remains the plan lease, plan version and cursor CAS above, and
authority for the Job outcome remains the BE00 outcome CAS on token, version and unexpired lease. No worker RPC accepts or verifies a BE00 lease token.
```

Changelog row: `| 2026-10-DD | Preparation Job lease checkpoints placed before the eight state-advancing worker RPCs; BE00 lease stays out of the worker RPC contracts. | /propagate-decision | Migration scan protocol |`.
Record DEC-184 only if the owner instead chooses 2B.

### (6) Tests

- Unit with the real `openCmsLeaseSession` and the real entry (`createClaimedSchemaMigrationPreparation`) over the existing controlled RPC port used by
  `claimed-schema-migration-preparation-stages.test.ts`: ordered call history shows `checkpoint` immediately before each of the eight names and none before the three reads; a `lost` at the k-th checkpoint
  (k = 1..N) leaves the call history ending at k-1 RPCs; `consumer` outcome is `retry/lease_conflict`, `applyJobOutcome` and `recordProcessedEvent` never called. A mutation (remove the guard) must fail the test.
- Real stack interleave (`tests/postgrest/phase-02-b08-preparation-lease-loss.apispec.ts`): delivery A claims and completes scan batch 1; the fixture expires the Job lease in SQL; A's next checkpoint is
  `lost`, A issues no further stage RPC (assert PostgREST request log through the recording `fetch`); delivery B claims a new token and resumes from the plan cursor; final state: one sealed report, evidence rows unique, counts equal
  a clean control run, Job `succeeded`. Negative control: with the guard removed A's late batch is refused or ignored only by plan CAS and the test records which (documents the residual interval honestly).

## 5. Gap 3: attempt and budget

### (1) What the locked specs already fix

- BE00:548: `max_retries = 3`, delays 15 s / 60 s / 300 s with bounded jitter, "a consumer may suppress retry after a deterministic/stale result", "Each attempt first persists its sanitized summary and
  CAS-acquires the canonical lease. It acknowledges only after a durable terminal/next state".
- BE00:552: lease "default 5m, maximum 14m"; "max 4 deliveries including initial"; "exhausted/non-retryable -> failed". RUNBOOK:20: "the lease is 300 seconds, and the delivery ceiling is four attempts including
  the initial delivery"; RUNBOOK:27-29: "exhausted failure records a sanitized terminal error".
- BE00:338: Job `attempt_count`, `attempts` (<= 32 sanitized summaries). BE03a:2357-2365: batch of <= 128 rows. BE03a:2583: "each retry rechecks state and cursor". BE03a:2724: alert thresholds "migration retry >3 ... DLQ >0".
- Code precedents: attempt = `Math.max(1, message.attempts)` in every other consumer (`WORKER/event-consumers/*`, `WORKER/cms-editorial/review-recheck/job.ts:73`); `retryAfterAttempt` (1-based);
  `runWithDeadline` (F10).

### (2) What is genuinely undecided

a. The attempt source on the Job path: `JobEffectInput` carries none, `parseLease` discards the SQL `attempt_count` (`WORKER/async-runtime-parsing.ts` `parseLease`), and `executeJobDispatch` does not receive
   `message.attempts`. The entry's own use of `attempt` is only `retryAfter(attempt)` (a clamped 0-based index into [15 s, 60 s, 300 s], `REG/migration-worker-validation.ts:178-181`) and telemetry; the legacy
   caller passes the 1-based value, so its first retry hint is 60 s (harmless today because no caller consumes `retryAfterMs`).
b. A per-invocation budget: BE00 gives a lease, not an invocation deadline; no number exists for this Job type. The queue-consumer `AbortController` in `async-runtime.ts:118` is never aborted.
c. What exhaustion does to the PLAN. BE00/RUNBOOK say the Job becomes `failed`, but a Job `failed` while the plan is `running` or `verifying` leaves a plan that blocks every new dry run for the version pair with 409
   (`SQL/20261002177000_cms_dry_run_in_flight_plan_conflict.sql:1-6`: 409 while an earlier plan is `running`, `verifying` or `failed_retryable`), whereas a `dry_running` plan is superseded by the next attempt.
d. The capacity ceiling (F8: 256 x m source rows) and what happens above it. No spec states a maximum source-row count.
e. The backoff on the Job path (BE00:548 states it; F6 shows it is not applied).
f. The CPU cost of one 128-row batch against `wrangler.jsonc` `limits.cpu_ms: 50`. I found no measurement. Not determinable by reading.

### (3) Options

| Option | Description | Pros | Cons |
| --- | --- | --- | --- |
| 3A (recommended) | Keep queue retry as the continuation mechanism (BE03a:2549). Thread `deliveryAttempt = Math.max(1, message.attempts)`; final delivery (4) turns any would-be `queued` into terminal plan rollback + Job `failed` `MIGRATION_RETRIES_EXHAUSTED`; apply 15/60/300 s backoff to retry-type outcomes (not to `progress`); per-invocation budget; state the capacity formula. | Matches BE00:548/552 and RUNBOOK:27-29; smallest structural change; no new messages or queues. | A plan above the ceiling burns four deliveries and fails late (still deterministic and safe); at the default `m = 1` the ceiling is 256 rows; needs new entry plumbing (final plan record for the rollback). |
| 3B | 3A plus an admission-time refusal in CMS-03A-10 (422) when the scanned source count exceeds a configured cap, so oversized plans never become Jobs. | Fails early with a clear message; no wasted deliveries. | Edits a locked route's validation matrix (BE03a:243,2085, FE03:1083 error row) and `cms_start_schema_dry_run` SQL; needs an owner-chosen cap number; CPU unknown so the cap cannot yet be set honestly. |
| 3C | Continuation by a fresh queue message (ack the current one, enqueue a copy of the original envelope) so every continuation gets a new delivery budget. | Unbounded plan size. | Contradicts BE03a:2549 ("Queued continuation retries"); a Queue send outside the outbox reopens the request/Queue dual-write gap BE00 closes with the outbox (BE00:440); needs a spec amendment of an owner-ratified flow (DEC-108). Heavy. |
| attempt source a | `message.attempts` (delivery count; BE00's unit is deliveries). | Spec unit; repo precedent; no SQL change. | Needs plumbing through `orchestrateQueueMessage` (done by closure, section 6). |
| attempt source b | Job `attempt_count` from the claim. | Durable, survives message loss. | Counts claims not deliveries (a fenced redelivery that never claims does not count); needs `parseLease` + RPC mapping change; not the BE00 unit. |

### (4) Recommendation: 3A, attempt source a

Reasoning: BE00's budget is expressed in deliveries and Cloudflare's `attempts` is exactly that; every other consumer already uses it. 3C is the only way to lift the ceiling and it
contradicts a ratified flow; 3B is a sound follow-up but the cap number is a product decision I cannot make without the CPU measurement and the real content-type sizes. So implement 3A, state the ceiling honestly,
and put 3B in front of the owner as a follow-up question once the ceiling is measured.

Concrete rules (all numbers are proposals; none exists in the specs):
- `deliveryAttempt = Math.max(1, message.attempts)`; `MAX_DELIVERIES = 4` (BE00:552).
- Budget per invocation: `min(240000, claimedLease.leaseUntilMs - nowMs - 60000)` ms via `runWithDeadline`; 60 s remains for `settle()`, the outcome CAS (<= 15,000 ms RPC deadline) and the processed write.
  Abort -> the existing `runtime.call` short-circuit returns retryable `DEPENDENCY_DEADLINE_EXCEEDED` (`REG/migration-worker-runtime.ts` `call`) -> row 7 -> `queued`.
- `maxBatchesPerInvocation` is a configuration of the preparation worker (the existing `ProductionSchemaMigrationWorkerOptions`); default stays 1 until the CPU of one batch is measured. The owner-visible ceiling is `256 x m` source rows.
- Final delivery (`deliveryAttempt >= 4`): if the result would be `queued` (rows 2, 6, 7, 11, 14), then (i) if the plan is `dry_running`, `running`, `verifying` or `failed_retryable`, call the terminal rollback
  (`cms_rollback_schema_migration`, `retryable:false`, reason `MIGRATION_RETRIES_EXHAUSTED`) so the version pair is recoverable by a new CMS-03A-10 attempt (`dry_running` -> report `failed` + plan `blocked`, DEC-127 / BE03a:2231;
  `running`/`verifying` -> `failed_terminal`, `REG/migration-worker-constants.ts:28-38`); (ii) report Job `failed` `MIGRATION_RETRIES_EXHAUSTED`. A rollback that itself fails retryably on the last delivery still yields Job `failed` (the status
  surface must not stay `queued` behind a dead-lettered message); the plan is then left in its last state and the existing `migration retry >3` / `DLQ >0` alerts (BE03a:2724) are the operator signal.
- The rollback needs the plan's current version, cursor and lease token; the entry's result does not carry them (F2). Required plumbing: an additive `plan` field on `processed` (final `MigrationPlanRecord`) produced by the stages.
  This is the largest implementation item in this document. Whether the claimed read exposes the plan lease token was not established.
- Backoff on the Job path: `orchestrateQueueMessage` returns `{outcome:'retry', delaySeconds}`; delays `retryAfterAttempt(deliveryAttempt)` for rows 2, 7, 11, 14 and the lease-loss retry; `progress` (row 6) retries with no delay. The entrypoint
  uses `message.retry({delaySeconds})` as the event path does. Without it, four immediate redeliveries (including crash recovery while the 300 s Job lease is live) exhaust the budget in seconds.
- Residual, stated: pre-effect consumer retries (`lease_conflict`, `canonical_unavailable`, an unopened session) are decided inside `executeJobDispatch` before any effect; on the final delivery they still end as a DLQ message with the Job `queued`/`running`.
  The orchestrator cannot fail a Job it does not hold. The `DLQ >0` alert is the safety net; this is not fixed here.

Owner question (single, ready to relay):

**What is the Phase 2 ceiling for the source rows one schema preparation may process, and what happens above it?**

| Option | Pros | Cons |
| --- | --- | --- |
| A. Accept the BE00 four-delivery budget as the ceiling (`256 x maxBatchesPerInvocation`, 256 by default), fail late with `MIGRATION_RETRIES_EXHAUSTED` and a recoverable plan | No spec change to locked routes; ships the trigger now | Oversized types fail after four deliveries; the user can never prepare that type until the ceiling is raised |
| B. A plus an early 422 at CMS-03A-10 above an owner-set cap | Clear early message, no wasted deliveries | Amends a locked route and SQL; cap number needs real sizes and a CPU measurement first |
| C. Re-enqueue continuations as fresh messages | No ceiling | Contradicts BE03a:2549/DEC-108; reopens the dual-write gap |

Recommendation: A now, B as a follow-up once measured.

### (5) Exact spec text if 3A is adopted

File `BE03a`, new subsection after "Preparation Job disposition" (section 3):

```markdown
### Preparation delivery budget (DEC-184)

The `cms.schema.dry_run` Job runs on the BE00 `platform.job.execute` budget: at most four deliveries including the initial one. The delivery number is
`max(1, queue message attempts)`. A `queued` continuation (a worker `progress`) and every retryable disposition each cost one delivery. Retry-type
dispositions (not `progress`) are redelivered after 15 s, 60 s and 300 s for delivery numbers 1, 2 and 3.

One invocation is bounded by a deadline of `min(240000, remaining Job lease - 60000)` milliseconds and by `maxBatchesPerInvocation` batches of at most
128 rows per stage. For N source rows and m batches per invocation the number of deliveries is `2 x ceil(ceil(N / 128) / m) - 1` (1 for N = 0); a
preparation completes within the budget only when `N <= 256 x m`.

On the fourth delivery, a disposition that would be `queued` instead (a) rolls an in-flight plan (`dry_running`, `running`, `verifying`,
`failed_retryable`) to its terminal failure through the terminal rollback with reason `MIGRATION_RETRIES_EXHAUSTED`, so a new CMS-03A-10 attempt is
admitted, and (b) reports the Job `failed` with `errorCode = MIGRATION_RETRIES_EXHAUSTED` and `resultRef = null`. The sealed report, when it exists,
stays the only authority for counts and row errors.
```

Changelog row: `| 2026-10-DD | DEC-184 (owner): preparation delivery budget, exhaustion rollback and source-row ceiling. | /propagate-decision | Migration scan protocol, BE00 Consumer Registry |`.
Add to BE00:552 "Success / retry / terminal failure" cell nothing; BE00 already states the budget. If Option B is chosen, add the 422 to BE03a:243 and 2085 and FE03:1083.

### (6) Tests

- Pure: delivery-number normalization (0, 1, 4, `NaN`, negative; note `Math.max(1, NaN)` is `NaN`, so the helper needs an explicit finite-integer guard), budget arithmetic (`240000` cap, lease remaining 100 s -> 40000, remaining < 60 s -> immediate abort), deliveries formula D(N, m) over a table
  including N = 0, 128, 129, 256, 257, 8,192, 8,193 and m = 1, 2, 32 (state the +-1 batch assumption for exact multiples).
- Composition (production entrypoint over the real Worker queue handler): `message.attempts = 1..4` reaches the callback unchanged; retry-type outcomes call `message.retry({delaySeconds: 15 | 60 | 300})` for deliveries 1-3; `progress` calls `message.retry()` with no delay.
- Real stack (`tests/postgrest/phase-02-b08-preparation-budget.apispec.ts`): (i) N = 300 rows with `m = 1` -> deliveries 1-4 end with plan rolled back (`failed_terminal` or `blocked` per state), Job `failed`
  `MIGRATION_RETRIES_EXHAUSTED`, message acked, and a new CMS-03A-10 attempt for the same pair is admitted (not 409); (ii) the same 300 rows with `m = 4` -> Job `succeeded` in 1 delivery, and a 1,000-row type with `m = 4` -> `succeeded` in 3 deliveries with `attempt_count = 3`;
  (iii) deadline: a `fetch` wrapper that hangs one RPC past the budget -> `DEPENDENCY_DEADLINE_EXCEEDED` -> `queued`, no outcome write after lease expiry; (iv) the final-delivery rollback failing retryably still yields Job `failed`.
- Mutation: drop the final-delivery override and expect (i) to fail; drop the delay and expect the delay test to fail.

## 6. Gap 4: environment binding

### (1) What the locked specs already fix

- IA00:164: "Environment configuration is schema-validated at startup/deploy; secrets exist only in provider/deployment secret stores, never settings tables or source control."
- BE03a:2312: every worker RPC is `platform_api`, service-role only, "never reachable from a browser route". `.claude/rules/security-first.md`: secrets only via environment variables in server-side code.
- BE03a:2724 and the existing telemetry constants (`production-worker-runtime-cms.ts:95-151`): metric names, `slo.tier`, alert class `content.schema.migration.tier2`, service `wejammin-cms-migration-worker`.

### (2) What is genuinely undecided

How `env` reaches a callback invoked as `effect.execute(input, control)` (F1); who owns the callback's lifetime (per message, per env, per isolate); which transport options and worker identity it uses; which log/telemetry stream records Job-path attempts
(`logSchemaMigrationQueueAttempt` is called only by the legacy event branch); the factory itself does not exist (F9).

### (3) Options

| Option | Description | Pros | Cons |
| --- | --- | --- | --- |
| 4A (recommended) | `orchestrateQueueMessage` already has `env`, `message` and builds `{execute: dependencies.effect}` per message (`async-runtime.ts:138`); replace it with a per-message closure `execute = (input, control) => dependencies.effect(input, control, {env, signal, deliveryAttempt})` (a Worker-layer third argument). The dispatcher forwards the context to `prepareSchemaDryRun`; `createProductionAsyncEntrypoint` supplies a callback that fetches a memoized claimed-preparation object per `env` from a `WeakMap`. | No change to `packages/application` (the consumer still calls `execute(input, control)`); same per-env memoization as the legacy worker (`:61-67`); env never enters the generic application types; a single place to also create the per-delivery deadline signal. | Widens the Worker-layer `effect` signature and the dispatcher dependency type; two layers must agree on the context shape. |
| 4B | Add `env` (and `signal`, `attempt`) to `JobEffectInput`. | One argument. | Puts Worker bindings, including `SUPABASE_SECRET_KEY`, into a generic application type that is passed to every effect (verification, lookalike families); violates the "only the CMS callback sees lease control" isolation the dispatcher documents. Rejected. |
| 4C | Module-level singleton that captures `env` on first use. | Trivial. | Isolate-global mutable state keyed to nothing; staging and production bindings could cross; contradicts the WeakMap precedent. Rejected. |

### (4) Recommendation: 4A

Details (all implementation):
- New factory `createProductionClaimedPreparation(env, fetchImpl, options)` next to `buildProductionSchemaMigrationWorker` in `production-worker-runtime-cms.ts`: `parseServerEnvironment(env)`, `createSupabaseRpc(fetchImpl, {deadlineMs, maxResponseBytes})`,
  `port.call = (op, req, signal) => rpc(validatedEnv, op, {p_request: req}, signal)`, `logger` and `productionMigrationTelemetry(logger)` reused, then `createClaimedSchemaMigrationPreparation({port, workerId, now, leaseDurationMs, maxBatchRows, maxBatchesPerInvocation, telemetry})`.
  Reuse `ProductionSchemaMigrationWorkerOptions`; add a separate `preparation` slice if the owner wants `maxBatchesPerInvocation` to differ from the activation worker.
- Memoize per `env` object in a `WeakMap` created in `createProductionAsyncEntrypoint`; do not cache a failed construction (validation errors rethrow each delivery and become row 14).
- The callback never throws: it converts every exception to row 14. The dispatcher's existing catch-all (`production-job-effect-dispatcher.ts:117-119`) remains as a backstop for verification, but for the CMS family it must not return `pending_manual_review` (F5).
- Replace the dispatcher's absent-dependency branch for the CMS family: `{state:'queued', errorCode:'DEPENDENCY_UNAVAILABLE', resultRef:null}` and apply the final-delivery override there as a backstop (nothing started, so no rollback).
- Worker id stays the release-level id (section 4, sub-decision). A Job-path log event `cms.registry.queue_attempt` (the existing legacy helper) is emitted with the delivery number so the `retry.alert.after: 3` / `DLQ >0` alerts see Job-path retries.
- `createProductionAsyncEntrypoint` keeps its current optional parameters; the prepared callback needs no new required argument (a test-only override argument for the factory is acceptable).

### (5) Exact text if 4A is adopted

File `apps/worker/src/README.md`, replace the sentence at lines 21-25 ("The production preparation callback itself is a boundary: ... attempt and budget source (see the `BOUNDARY:` comment in the dispatcher).") with:

```markdown
The production preparation callback is composed per Worker environment. `orchestrateQueueMessage` hands the dispatcher the delivery's `env`, an abort signal
bounded by the invocation budget and the delivery number (`max(1, message.attempts)`) as a third, Worker-layer argument; the production entrypoint builds
one claimed-preparation object per `env` object (a `WeakMap`, like the legacy worker) from that environment's validated service credentials and never from
module state. The callback maps every preparation result to a BE00 Job disposition (BE03a "Preparation Job disposition"), never throws, and never answers
`pending_manual_review`.
```

File `BE03a`, append to the new "Preparation delivery budget" subsection one sentence: "The preparation effect is composed per Worker environment from that environment's validated service credentials; no credential, transport or worker identity is shared across environments or read from module state."

File `apps/worker/src/production-job-effect-dispatcher.ts`: delete the `BOUNDARY:` block (lines 93-100) and the sentinel's "BOUNDARY sentinel" header comment; replace the sentinel test
`CMS with only object verification configured is unavailable without invoking it` with the behavioural tests below (boundary-not-placeholder: the stub's sentinel is replaced when the real implementation lands). Close issue #128.

### (6) Tests

- Composition, no database needed (real code path end to end): `createProductionAsyncEntrypoint(globalThis.fetch)` with an `env` whose `SUPABASE_URL` is empty -> the real transport throws `Supabase RPC configuration unavailable`
  (`async-runtime-rpc-transport.ts:56-60`) -> Job `queued` `DEPENDENCY_UNAVAILABLE`, message retried (not acked), no throw out of `queue()`; at `message.attempts = 4` -> Job `failed` `MIGRATION_RETRIES_EXHAUSTED` (recorded through a recording `fetch` wrapper
  that delegates to the real fetch for the Job RPCs).
- Per-env isolation: two distinct `env` objects (different `SUPABASE_URL`) delivered concurrently -> each RPC targets its own base URL (assert from the recording wrapper), two constructions, and a second delivery with the same `env` reuses its object (a counting factory option).
- Startup composition: with `createProductionAsyncEntrypoint(fetch)` and no options a verified CMS dry-run message reaches the claimed entry (the real-stack suite of section 3), i.e. it is no longer answered `DEPENDENCY_UNAVAILABLE`.
- Isolation of the three seams: verification Jobs still call the effect with exactly `(input)`/no context leak (extends `production-job-effect-dispatcher-cms-lease-control.test.ts`).

## 7. Build order (each step test-first, RED proof before production edit)

1. Pure result mapper + exhaustiveness tuple + pure tests (section 3 pure tier). No ports.
2. Context plumbing: per-message closure, `deliveryAttempt`, per-delivery deadline signal, backoff return type (sections 5-6). Dispatcher: CMS family never `pending_manual_review`; final-delivery override backstop.
3. Production factory + `WeakMap` memoization; wire `prepareSchemaDryRun`; remove BOUNDARY comment, replace sentinel.
4. Guarded RPC caller + `control` option on `process` (section 4).
5. Final plan record on `processed` and the exhaustion rollback (section 5), then real-stack suites for sections 3-5.
6. Documentation: BE03a subsections + changelog rows, BE00:546 sentence, `apps/worker/src/README.md`, `APP-JOBS/README.md`, runbook one-liner in `docs/runbooks/platform/cms-publication.md` (one tick/one delivery budget), ledger wording.

Steps 1, 2, 3 can be implemented before the owner answers anything, because rows are fixed by BE00/FE03/DB constraints except the Gap 1 owner question (sealed failing scan) and the Gap 3 owner question (ceiling), which change only table cells and one constant.

## 8. What I could not determine

1. Whether Cloudflare `attempts` is 1-based and `max_retries = 3` means exactly four deliveries: taken from BE00:548/552 and RUNBOOK:20, not verified against Cloudflare documentation.
2. CPU cost of a 128-row batch (JCS + SHA-256 per row) against `limits.cpu_ms: 50` in `apps/worker/wrangler.jsonc`; whether `maxBatchesPerInvocation > 1` is feasible. Needs measurement. If one batch exceeds 50 ms the effective ceiling is lower than 256 rows or the limit must change.
3. Any specified maximum number of source rows (entry revisions + publication versions + locale variants) for a type. None found.
4. Whether `cms_rollback_schema_migration` accepts every plan state listed for the exhaustion rollback (`running`, `verifying`, `failed_retryable`, `ready`). The transition table (`REG/migration-worker-constants.ts:28-38`) and DEC-127 cover `dry_running` and the `running`/`verifying` -> `failed_terminal` edges; I did not read the RPC body in full. Prove RED-first against the real RPC.
5. Whether the claimed read exposes the plan lease token to the entry for a post-run rollback (section 5); the stage helpers hold the current plan internally and `processed` does not return it.
6. Whether `completed` always implies a sealed passed report (inferred from BE03a:2159-2167 and the stage order, not asserted by the entry result). The real-stack test asserts it.
7. Whether the reaper-less `running`/`queued` residual after DLQ is acceptable to the owner (section 5, residual). No spec text covers a job whose message is dead-lettered.
8. Reachability claims in F3 are by reading; a mutation or instrumented run must pin them.

## 9. Records to write when this is adopted (not written here)

- DEC-183 (Gap 1 map; owner-ratified) and DEC-184 (Gap 3 budget and ceiling; owner-ratified). Next free numbers: DEC-182 is the ratified Slice 12 wording batch (`.memory/raw/events/2026-10-12.jsonl`). Write through `flushEntry()` then `node .memory/pipeline/compile.mjs`; never edit `decisions.md` directly (memory-capture rule).
- Pattern candidates: "A manual-review disposition on the Job path acknowledges the message and leaves the Job `running`" (F5); "`resultRef.id` must be a UUID or the Job becomes unreadable by the status route" (F4); "retry on the Job path had no backoff" (F6).
- Close tracked boundary #128 with the evidence of the real-stack suites; update the ledger wording from "forwarding only, no consumer" to the shipped state.
