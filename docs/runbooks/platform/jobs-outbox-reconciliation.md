# Jobs and outbox reconciliation

Trigger this runbook when a committed job or outbox event is not progressing, a
queue delivery expires, or a restore requires work to be fenced and reconciled.

## Safety boundary

The database is canonical. Queue messages and Realtime notifications are
transport hints only. Do not edit a job, outbox payload, attempt summary, or
terminal result directly, and do not replay a message without preserving its
original event identity and idempotency binding.

## Bounded reconciliation

1. Record the UTC time, request ID, correlation ID, job ID, event ID, and current
   restore epoch. Exclude payloads, credentials, private content, and provider
   details from notes and logs.
2. Confirm the registered consumer is `platform.job.execute`, the event pair is
   `job.requested/1`, the queue is `platform-jobs`, the lease is 300 seconds,
   and the delivery ceiling is four attempts including the initial delivery.
3. Read undispatched outbox rows through the named lease/reconciliation path.
   Claim with a compare-and-swap lease token, dispatch once, and finalize only
   when that token still matches. An expired lease may be claimed by a later
   attempt; duplicate delivery must remain idempotent.
4. For each job delivery, re-read the canonical job, aggregate, authorization
   context, and version before execution. A stale, cancelled, or terminal job
   is acknowledged as a no-op. A retryable pre-effect failure returns the job
   to `queued`; a non-retryable or exhausted failure records a sanitized
   terminal error. Terminal states never reopen.
5. Unknown event pairs or schema versions are acknowledged only through the
   dead-letter/manual-review path; they must not execute.
6. A `cms.schema.dry_run` job follows BE03a "Preparation Job disposition" and
   "Preparation delivery budget": it settles `succeeded` (with the dry-run report
   reference), `failed` `MIGRATION_BLOCKED` (a sealed failing scan) or `failed`
   `MIGRATION_RETRIES_EXHAUSTED`, never `pending_manual_review`. Retry-type results
   are redelivered after 15, 60 and 300 seconds. A preparation completes inside the
   four deliveries only for at most `256 x maxBatchesPerInvocation` source rows (256
   at the default); a larger type ends `MIGRATION_RETRIES_EXHAUSTED` on delivery 4
   with its plan rolled back. Triage and the plan states are in the CMS publication
   runbook, "Preparation Job trigger".
7. A `cms.taxonomy.merge_converge` job (a large CMS-03C-03 term merge) records `succeeded`
   after each fenced batch (the database has already requested any continuation) or `failed`
   with one registered code, never `queued`: a re-queued ordinary job is skipped as stale once
   its claim advanced the version. Triage, the code table, the metric and the DEC-194 recovery
   sweep (a bounded scheduled re-request of a failed job) are in [CMS taxonomy merge convergence job](./cms-taxonomy-merge-converge.md).

## Restore fence and recovery

After a restore, keep queue consumers and external effects fenced until the
restore epoch, outbox dispatch evidence, job leases, and canonical versions
have been reconciled. Resume only after integrity, authorization, and
idempotency checks pass. If a dependency remains unavailable, leave work
retryable and escalate through `platform.on_call` with identifiers only.

Realtime loss, duplication, or reordering is harmless: refetch the authorized
canonical job status. Do not infer state, authority, or completion from a
notification.
