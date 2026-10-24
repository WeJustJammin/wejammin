# CMS taxonomy merge convergence job runbook

Job-type runbook (BE00 `platform.job.execute`: "job-type runbook required") for the BE00 job
`cms.taxonomy.merge_converge` of Shard 03c (BE03c 1334, 1351, 1377). Trigger it when a
`cms_taxonomy_merge_converge.settled` log event has `outcome = failure`, when
`cms_taxonomy_merge_total{outcome="failed"}` increments, or when an editor reports that a merged term's
assignments still show the retired term after a large merge. A failed job is re-requested automatically by the
bounded recovery sweep (see "Recovery: the bounded sweep"); the alert fires for every failed generation.

Release state: Slice 12 is on disk on branch `claude/phase2-slice12` and is not promoted. Local verification is
not hosted acceptance; no hosted or production result is claimed here.

## What the job does

A CMS-03C-03 `merge` re-points up to 5,000 active term assignments of the retired term in its own transaction. A
larger set continues through one BE00 job per retired term, bound to the merge command's actor and acting party.
Each delivery calls `platform_api.cms_run_taxonomy_merge_converge` with the claimed job (`jobId`, `version`,
`leaseToken`; never `batch`). The answer is `{ converged, remaining, continuationJobId }`; when work remains the
database has already requested the next job, so the Worker records the current job `succeeded` and never
re-queues it. The retired term resolves to the survivor throughout, so a page reads the merged term correctly
whether or not its assignments have converged.

| Item          | Value                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| Consumer      | `platform.job.execute`, event `job.requested/1`, queue `platform-jobs`, lease 300 s, at most 4 deliveries     |
| Worker effect | `apps/worker/src/cms-taxonomy-merge-converge-effect.ts` (names in `...-names.ts`)                             |
| In-delivery   | 3 attempts, 15 s then 60 s pauses (each plus 0-10 % jitter), budget `min(240 s, lease - 60 s)`, worst 127.5 s |
| Log event     | `cms_taxonomy_merge_converge.settled` (job id, correlation id, delivery number, counts, error code)           |
| Metric        | `cms_taxonomy_merge_total{outcome=converged\|continued\|failed}`                                              |
| Alert route   | `platform.on_call`; alert on any `outcome="failed"` increment                                                 |
| Status read   | `GET /api/v1/jobs/{jobId}`: a failed job shows `error { code, retryable: false }`, no `resultRef`             |

Every failed delivery logs the event and the metric, including the dispatcher-guard failures (no effect wired, the
effect threw, an answer outside the closed set), so the alert above sees them all.

The repository deploys no alert rule for this metric. Confirm a provider-side rule exists before treating
silence as health.

## Registered error codes

The registry of these codes is the BE03c section "Merge convergence Job disposition"
(`.memory/wiki/specs/be/03c-composition-taxonomy-localization.md`; BE00 233: an owning-domain registered code);
this table repeats it for operators and a test keeps the BE03c table, this table and the Worker constants identical.
A terminal `failed` job carries one of exactly these codes (BE00 233, 554, 571; the grammar is
`^[A-Z][A-Z0-9_]{0,63}$`). A code never contains a value, row, label or term id. The job is never answered
`queued` and never `cancelled` or manual review: a re-queued ordinary job is skipped as stale after its claim
advanced the version, so a retry that would not complete inside the delivery fails the job instead.

| Delivery result                                                                | Job state   | errorCode                                         |
| ------------------------------------------------------------------------------ | ----------- | ------------------------------------------------- |
| the claim receipt is refused before any call (type, token or version mismatch) | `failed`    | `MERGE_CONVERGE_CLAIM_INVALID`                    |
| the job actor lost `cms.taxonomy_curator` (`capability_missing`)               | `failed`    | `CAPABILITY_MISSING`                              |
| no such job, or a job of another type (`NOT_FOUND`)                            | `failed`    | `MERGE_CONVERGE_JOB_UNKNOWN`                      |
| the request is invalid (`INVALID_REQUEST`)                                     | `failed`    | `MERGE_CONVERGE_REQUEST_INVALID`                  |
| a lock or lease conflict on all three attempts                                 | `failed`    | `MERGE_CONVERGE_CONFLICT`                         |
| a timeout, provider fault or unknown token on all attempts, or no budget left  | `failed`    | `DEPENDENCY_UNAVAILABLE`                          |
| no Worker context or no effect wired, or the effect threw (dispatcher guard)   | `failed`    | `DEPENDENCY_UNAVAILABLE`                          |
| the effect answered outside its closed disposition set (dispatcher guard)      | `failed`    | `MERGE_CONVERGE_OUTCOME_UNMAPPED`                 |
| the answer broke its contract on all three attempts                            | `failed`    | `DEPENDENCY_INVALID_RESPONSE`                     |
| the batch converged (a continuation job, when named, is already requested)     | `succeeded` | null (`resultRef` is the next job, else this job) |

## Safe checks

1. Record the UTC time, `jobId`, `correlationId` and the delivery number from the event. Nothing else.
2. Read the job status. `succeeded` needs no action. A `failed` job names its code above; if work remains the
   sweep requests the next generation at least 15 minutes after the party's last job activity, so do not
   re-request by hand.
3. `MERGE_CONVERGE_CONFLICT`, `DEPENDENCY_UNAVAILABLE`: a transient fault outlasted about two minutes. Check the
   database and Worker health first (see [Jobs and outbox reconciliation](./jobs-outbox-reconciliation.md)).
   The batch may have committed before the response was lost: the status is then a false negative and the data
   is correct. Do not infer convergence from the status.
4. `DEPENDENCY_INVALID_RESPONSE`: a contract drift between the SQL answer and the Worker. Escalate, never retry
   in a loop.
5. `CAPABILITY_MISSING`, `MERGE_CONVERGE_JOB_UNKNOWN`, `MERGE_CONVERGE_REQUEST_INVALID`,
   `MERGE_CONVERGE_CLAIM_INVALID`, `MERGE_CONVERGE_OUTCOME_UNMAPPED`: deterministic. Retrying cannot change the result.

## Recovery: the bounded sweep

Owner decision DEC-194 (BE03c "Merge convergence recovery"; BE00 571 domain recovery reference). A failed job is
not left to a later merge: a scheduled sweep requests a fresh convergence job for it.

| Item        | Value                                                                                                                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Tick        | `apps/worker/src/cms-taxonomy-merge-reconcile-sweep.ts`, once per scheduled tick beside the other CMS sweeps                 |
| RPC         | `platform_api.cms_reconcile_taxonomy_merge_converge()`: no argument, `service_role` only, answer `{ requested }` (a count)   |
| Qualifies   | an acting party with a `failed` job of the type, remaining merged-term work, and no `queued` or `running` job of the type    |
| Request     | one fresh job bound to the failed job's actor, acting party and correlation id, under a key derived from the failed job's id |
| Spacing     | at most one job per acting party per 15 minutes, measured from the party's last job activity of the type                     |
| Stop        | none after 3 consecutive failed generations for the party (a succeeded or cancelled job ends the run)                        |
| Log event   | `cms_taxonomy_merge_reconcile_sweep.completed` (count only); `.failed` asks the platform to retry the tick                   |
| Metric      | `cms_taxonomy_merge_reconcile_requested_total` (jobs requested by the tick)                                                  |
| Alert route | `platform.on_call`, on the job's own `cms_taxonomy_merge_total{outcome="failed"}`; the sweep adds no separate alert          |

A replayed tick requests nothing twice: the new job is live, and the key of a failed job names its first request for
good, so each failed job is reconciled at most once: the sweep records the pair (failed job, requested job) in
`platform_private.taxonomy_merge_recoveries`, which outlives the request's idempotency receipt and is removed with the
failed job row. The sweep writes nothing else and answers a count, never an identifier. It serializes with merge
requests and continuations on a per-party merge-enqueue mutex, so check for lock waits on that mutex if ticks slow down. The repository deploys no alert rule for the metric; confirm a provider-side rule exists.

## Mitigation

The unconverged assignments stay readable through the retired term's redirect (BE03c 1377), so a failed job
loses no data. Only the append-only supersession rows are late; until the next successful generation they keep
resolving to the survivor. A merge requests a job only for its own term and only when more than 5,000 assignments
remain; the sweep is the recovery for a job that then fails.

After the third consecutive failed generation the sweep stops by design and the alert on the last failed job is the
signal. Escalate to `platform.on_call` with the identifiers above and the error codes of the three jobs: a
deterministic code (`CAPABILITY_MISSING`, for example, when the acting curator lost the capability) will not clear
by waiting. Never edit a job, term, assignment, outbox row or idempotency record by hand, never forge a lease, and
never replay an unknown-outcome request under a new `Idempotency-Key`. A new successful generation (for example a
later merge of the same acting party) ends the run and the sweep resumes for any later failure.
