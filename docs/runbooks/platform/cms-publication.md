# CMS editorial publication runbook

Operational reference for the Slice 11 review, scheduling, preview and publication
operations of Shard 03b (`docs/runbooks/platform/cms-editorial.md` covers entry
authoring, CMS-03B-01 to -04 and -10 to -14). Every row below is read from the
contracts package (`packages/contracts/src/cms-editorial`) and the BE03b
specification; the registry rows, the generated OpenAPI document
(`docs/openapi/openapi.json`) and the Worker routes must agree with it.

Release state: Slice 11 is on disk on branch `claude/phase2-slice11` and is not
promoted. Local verification is not hosted acceptance, and no hosted or
production result is claimed here. The tracker
`.memory/pipeline/progress/slices/phase-02-slice-11.md` records acceptance.
Beyond the nine browser routes and the two internal operations, this runbook
covers the schedule executor (stale proofs, cancellation), the dependency
recheck job, the outbox relay's poison rows, sealed history cursors, the
takedown RPC, the projection state, the reviewer-queue plan guard, job lease
control and the shape of a dependency failure.

## Operations

Browser operations share the BE00 envelope: the first-party browser audience
with the `cms-console` CORS class, no-store responses, `X-Request-Id` and the
BE00 middleware order. What each operation takes on the wire depends on its
class: six mutations and three safe reads.

### Mutation operations

CMS-03B-05, CMS-03B-06, CMS-03B-07, CMS-03B-08, CMS-03B-09 and CMS-03B-18 are
`POST` commands. Each takes strict
JSON (`Content-Type: application/json`, unknown keys refused), an
`Idempotency-Key` (8 to 128 printable ASCII characters), an exact strong
`If-Match` (`"<positive decimal>"`) and a CSRF token. The `If-Match` operand is
the entry `version` for CMS-03B-05 and CMS-03B-08 (E5), the review `version` for
CMS-03B-06 and CMS-03B-18, and the approved review `version` for CMS-03B-07 and
CMS-03B-09. Wherever the body carries `expectedVersion` (CMS-03B-06, CMS-03B-07,
CMS-03B-09, CMS-03B-18) the `If-Match` operand must equal it, otherwise the
request is `400 INVALID_REQUEST`.

CMS-03B-06, CMS-03B-07, CMS-03B-09 and CMS-03B-18 additionally require recent
binding-bound MFA (E6): a missing or stale proof is `401 STEP_UP_REQUIRED`
before any idempotency reservation or domain read, and changes nothing.
CMS-03B-05 and CMS-03B-08 require no step-up.

### Safe reads

CMS-03B-15, CMS-03B-16 and CMS-03B-17 are `GET` reads. They have no request body and accept
neither `Idempotency-Key` nor `If-Match`; they need no CSRF token and no step-up,
and emit no event. The query is strict (CMS-03B-15 takes only `revisionId`,
CMS-03B-16 takes none, CMS-03B-17 takes only `cursor`, `limit`, `scope` and
`state`). Each answers a strong `ETag` (CMS-03B-16 is `"{review.version}"`), and
the preparation read CMS-03B-15 is recomputed on every request and never stored.

### Routes

| Operation    | Route                                             | Success                                                          | Limit (user / party per minute)   | Deadline | Tier | Event                         |
| ------------ | ------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------- | -------- | ---- | ----------------------------- |
| `CMS-03B-05` | `POST /api/v1/cms/entries/{entryId}/reviews`      | `201 EditorialReviewResource`                                    | 30 / 60 (`cms-review-write`)      | 15 s     | 2    | `cms.entry.review-changed.v1` |
| `CMS-03B-06` | `POST /api/v1/cms/reviews/{reviewId}/decision`    | `200 EditorialReviewResource`                                    | 30 / 60 (`cms-review-write`)      | 15 s     | 2    | `cms.entry.review-changed.v1` |
| `CMS-03B-07` | `POST /api/v1/cms/publication-schedules`          | `202 PublicationScheduleResource`                                | 20 / 40 (`cms-schedule-write`)    | 15 s     | 2    | none until execution          |
| `CMS-03B-08` | `POST /api/v1/cms/previews`                       | `201 PreviewTokenResource`                                       | 60 / 120 (`cms-preview-write`)    | 8 s      | 1    | none                          |
| `CMS-03B-09` | `POST /api/v1/cms/publications`                   | `202 PublicationResource`                                        | 20 / 40 (`cms-publish-write`)     | 15 s     | 2    | `cms.publication.changed.v1`  |
| `CMS-03B-15` | `GET /api/v1/cms/entries/{entryId}/workflow`      | `200 EntryWorkflowResource`                                      | 300 / 600 (`cms-entry-read`)      | 8 s      | 2    | none                          |
| `CMS-03B-16` | `GET /api/v1/cms/reviews/{reviewId}`              | `200 EditorialReviewDetailResource`                              | 300 / 600 (`cms-entry-read`)      | 8 s      | 1    | none                          |
| `CMS-03B-17` | `GET /api/v1/cms/reviews`                         | `200 ReviewQueuePage`                                            | 300 / 600 (`cms-entry-read`)      | 8 s      | 1    | none                          |
| `CMS-03B-18` | `POST /api/v1/cms/reviews/{reviewId}/assignments` | `201` created, `200` revoked `EditorialReviewAssignmentResource` | 10 / 20 (`cms-review-assignment`) | 15 s     | 2    | `cms.entry.review-changed.v1` |

`202` on CMS-03B-07 means scheduled, never published. `202` with
`projectionState` `pending` on CMS-03B-09 means the lineage row is committed
canonically; it is not proof of public visibility.

### Database RPCs

The Worker binds each browser operation to one service-role `platform_api`
function (`CMS_EDITORIAL_RPC`, `apps/worker/src/cms-editorial-production-types.ts`);
the browser never selects one. Each wrapper delegates to a `platform_private`
definer function of the same name.

| Operation    | RPC                                          |
| ------------ | -------------------------------------------- |
| `CMS-03B-05` | `platform_api.cms_submit_review`             |
| `CMS-03B-06` | `platform_api.cms_record_review_decision`    |
| `CMS-03B-07` | `platform_api.cms_schedule_publication`      |
| `CMS-03B-08` | `platform_api.cms_mint_preview`              |
| `CMS-03B-09` | `platform_api.cms_publish_revision`          |
| `CMS-03B-15` | `platform_api.cms_get_entry_workflow`        |
| `CMS-03B-16` | `platform_api.cms_get_editorial_review`      |
| `CMS-03B-17` | `platform_api.cms_list_editorial_reviews`    |
| `CMS-03B-18` | `platform_api.cms_assign_editorial_reviewer` |

## Internal operations (not browser routes)

CMS-03B-19 and CMS-03B-20 are named database RPCs, absent from the browser route
inventory and the OpenAPI document. They return typed results instead of
`ApiError`.

| Operation    | RPC                                                                                                         | Caller                                            | Notes                                                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `CMS-03B-19` | `platform_api.cms_verify_preview_token`                                                                     | Shard 04 delivery principal                       | Read-safe, 500 ms deadline, retries at 75 ms and 150 ms, circuit open 30 s; every denial is byte-identical except the bound owner's `revoked`. |
| `CMS-03B-20` | `platform_private.cms_claim_due_publication_schedules`, `platform_private.cms_execute_publication_schedule` | Worker `scheduled` sweep (every minute, batch 25) | `FOR UPDATE SKIP LOCKED` claim, five-minute lease, 15 s deadline, retries at 15 s, 60 s and 300 s then `blocked` `retries_exhausted`.          |

## Typed refusals

A Slice 11 refusal carries one lowercase `details.reasonCode` from the closed
catalog exported as `CMS_SLICE_11_OPERATION_REASONS`. A stale CAS operand is
`409 CONFLICT` with `details.conflict` `VERSION_MISMATCH`.

| Status | Tokens                                                                                                                                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 403    | `capability_missing`, `separation_of_duties`                                                                                                                                                                                                                                                                       |
| 409    | `revision_not_submittable`, `dependency_changed`, `version_set_stale`, `review_not_open`, `duplicate_decision`, `specialist_slot_unsatisfiable`, `reviewer_not_eligible`, `assignment_exists`, `assignment_limit`, `publication_conflict`, `publication_not_active`, `preview_expired`, `preflight_evidence_stale` |
| 422    | `preflight_failed`, `dependency_manifest_too_large`, `unknown_timezone`, `tzdb_version_mismatch`, `nonexistent_local_time`, `ambiguous_local_time`, `disambiguation_not_applicable`, `resolved_utc_mismatch`, `schedule_out_of_horizon`, `authority_ends_before_schedule`, `expiry_out_of_bounds`                  |
| 503    | an unavailable preflight provider: `dependencyClass` `preflight`, `retryable` true; nothing commits and no success idempotency record is kept.                                                                                                                                                                     |

A `429` and a retryable `503` carry `Retry-After` and the `RateLimit-Limit`,
`RateLimit-Remaining` and `RateLimit-Reset` headers; the generated OpenAPI
publishes them on every Slice 11 operation. A `500` and a `502` carry none of
them. The `502` is the invalid-answer form of `DEPENDENCY_UNAVAILABLE`, see
Dependency failures below.

Two refusals of the commands that schedule and publish are committed
refusals: the database answers them after it has changed review state, so a
refusal is not always a no-op. `409 version_set_stale` (CMS-03B-07 and -09)
commits a `dependency_changed` invalidation of the review; CMS-03B-05 and
CMS-03B-06 answer `dependency_changed` instead of `version_set_stale`. A lazily
detected approval lapse (`reviewer_authority_changed`) commits the review
invalidation and cancels its pending schedules, and answers 422 with the reason
`preflight_failed` and the seventeen preflight entries. In both cases the
idempotency record completes with that status and a replay of the same request
returns the same refusal without a further effect. A stale accessibility proof is
the separate `409 preflight_evidence_stale`: the refused execution rolls back and
changes nothing, so it consumes no retry.

An unavailable preflight category reports one of two reasons. Every database
or reference-gate category reports `provider_unavailable`; the accessibility
category reports only `checker_failed`, including for a provider version or
worker key the database does not implement (DEC-160). No other unavailable
token exists.

## Time authority

Schedule times are resolved over one pinned IANA tz snapshot (BE03b E8). The
release tag is `CMS_TZDB_VERSION` and the snapshot's SHA-256 is
`CMS_TZDB_SHA256`; both are exported by the contracts package and recorded in
DEC-153. A hash mismatch at module load answers every schedule command
`503 DEPENDENCY_UNAVAILABLE`. Advancing the pin is code plus a forward migration
(`platform_private.cms_tzdb_version()` must return the same tag).

A schedule instant keeps up to nine fractional-second digits (BE03b:266). The
database stores the part below a microsecond in private remainder columns
(`20261010150000`-`20261010154000`); the due order, the schedule identity key
(DEC-171) and the half-even rounding of the deviation over exact nanoseconds
all use it. A tenth fraction digit is `422 VALIDATION_FAILED` at its RFC 6901
pointer. Those migrations were written to apply to a populated table without a
reset; the storage migration aborts with `55000` if a catalog or row-image
check differs, which means stop and escalate, not retry.

## Schedule execution

The Worker `scheduled` sweep (`apps/worker/src/cms-publication-schedule-sweep.ts`,
event prefix `cms_publication_schedule_sweep`) claims due schedules and executes
each one through CMS-03B-20. One tick is one job under a single 15,000 ms
deadline (`CMS_SCHEDULE_DEADLINE_MS`) shared by the claim and every execute; an
execute gets only the time that is left, and no further schedule starts once the
deadline has passed. A `.deadline_exceeded` error event (`JOB_DEADLINE_EXCEEDED`,
`attributes.unstarted`) names the schedules left unstarted; their leases and the
database retry ladder own them. A claim failure asks the platform to retry the
tick; a failure to execute one schedule is logged as `.execute_failed` and never
stops the rest of the batch.

An execution has five outcomes (`ScheduleExecutionResult`): `completed`,
`already_completed`, `failed_retryable`, `blocked` and `cancelled`.

- `blocked` carries a closed reason: `approval_invalidated`, `preflight_failed`,
  `publisher_authority_ended`, `publication_not_active` or `retries_exhausted`.
  A superseded revision, a stale manifest or a lapsed approver of an active
  entry still blocks an executing schedule `approval_invalidated`. Only a
  `blocked` outcome increments `cms_schedule_blocked_total{reason}`.
- `cancelled` carries exactly `entry_unavailable` (DEC-173, DEC-177). When the
  entry is no longer `active` at execution (archived or held after the claim) the
  executor cancels the schedule in its own transaction, before it re-reads the
  review: the schedule version advances, the lease is released, the attempt count
  is unchanged, one audit record `cms.publication.schedule.cancel` is written,
  and no publication, lineage row, outbox event or accessibility summary is
  created. It counts as `cms_schedule_attempt_total{outcome="cancelled"}`, never
  as a block, so it raises no blocked-schedule alert. The executor reads the
  entry under a `FOR SHARE` lock, so an archive waits for an execution that is
  already publishing and an execution that starts after an uncommitted archive
  waits for it, then cancels.

A stale accessibility proof is not a failed attempt. The database refuses an
execution whose proof is older than 60 seconds or bound to other rows with the
typed conflict `preflight_evidence_stale` (HTTP 400, `P0001` at the RPC
transport), rolls back, and leaves the claim
exactly as it was (state `executing`, lease live, `attempt_count` unchanged). The
sweep recomputes the proof and executes the same claim again under the same
lease, at most twice more (three proofs in all) and never after the job
deadline; each recomputation logs `.evidence_stale` (warn, `attempt` is the
re-execution number). A checker that cannot produce a proof on the re-run sends
none, which is the database's own unavailable-checker ladder. If the refusal
survives the bound, the sweep logs `.execute_failed` with `errorCode`
`preflight_evidence_stale` and leaves the schedule to its five-minute lease. Any
other failure of an execute is an unknown outcome and is never retried in the
tick. Triage a repeated `.evidence_stale` followed by that `.execute_failed`:
the checker version the Worker reports differs from the database registry's, or
the Worker and database clocks disagree by more than the 60-second window.
Escalate; never edit the schedule row.

## Preview verification and takedown

`platform_api.cms_verify_preview_token` (CMS-03B-19) is read-safe and
total: every denial is byte-identical except `revoked`, which is true only for
the token's own bound actor. A token lives exactly 900 seconds, the plaintext is
derived and never stored, and a minted token's `capability_snapshot_hash` is the
BE04c acting-context version.

Tokens are revoked by the database when the minting person loses capability or
membership and when the entry leaves `active`; a movement of the version set
revokes nothing. A takedown has its own service-role RPC,
`platform_api.cms_takedown_preview_tokens(jsonb)`, executable by `service_role`
only (anonymous and authenticated callers get `42501`). The request is closed:
`{ reasonCode: "takedown", correlationId, entryId?, personId? }` with at least
one target (both means AND); `authority_lost` and `entry_unavailable` belong to
the database producers and are `INVALID_REQUEST` here. It answers
`{ revokedTokens }`, is idempotent, and writes no audit or outbox row of its own:
the caller owns the audit of the cause. The Worker port is
`apps/worker/src/cms-editorial-production-preview-takedown.ts`; it throws on every
failure (only `unavailable` is retryable) and no Worker module imports it yet,
because its caller belongs to Shard 16. Until that caller exists nothing in the
repository invokes the RPC, and because the RPC writes no audit row a manual call
would leave no record of its cause. A preview token is never directly selectable
by any session.

## Dependency recheck

A dependency that moves under a live review invalidates it (`dependency_changed`,
BE03b "Review invalidation"). The chain is: the outbox relay places the
identifier-only envelope of one of six events (`cms.schema.activated.v1`,
`cms.template.activated.v1`, `cms.pattern.activated.v1`, `cms.taxonomy.changed.v1`,
`cms.localization.changed.v1`, `cms.block.lifecycle.changed.v1`) on the platform
jobs queue; one source consumer per event rereads the committed event through
`platform_api.cms_dependency_recheck_resolve_event` and enqueues the typed job
message `cms.review.dependency_recheck` `{ eventId, kind, refId }`; the job calls
`platform_api.cms_dependency_recheck_run`. The job is a typed queue message, not a
`platform_private.jobs` row (DEC-166).

- One run handles at most 500 live reviews, selected through the dependency
  index by `(kind, ref_id)`. A run that leaves reviews behind returns a cursor and
  the job enqueues the continuation message before it acknowledges, so a
  message is acknowledged only after its successor is queued.
- A versioned kind stands for its lineage (every version of the content type,
  template, pattern or taxonomy), and `cms.localization.changed.v1` resolves to the
  source revision of the latest locale variant. A frozen locale source is current
  only while that source revision still serves the frozen hash and no variant
  sourced from it is `stale` (DEC-170).
- The database invalidates a review only when its rebuilt manifest differs or a
  frozen identity is no longer current; the job never invalidates on the strength
  of an event. Delivery is at least once and idempotent: a repeated run or a
  duplicate continuation invalidates nothing twice.
- Events: `cms.review_recheck_source` (consumer) and `cms.review_dependency_recheck`
  (job, consumer `cms.review-dependency-recheck`). Metrics:
  `cms.review_recheck.enqueue.total`, `cms.review_recheck.run.total`,
  `cms.review_recheck.examined.total` and
  `cms_review_invalidated_total{reason="dependency_changed"}`. Retries follow the
  platform ladder (15, 60, 300 seconds). A source event the database cannot
  resolve is dead-lettered `SOURCE_RECORD_NOT_FOUND`; an unknown version is
  dead-lettered `UNKNOWN_EVENT_VERSION`; a message that is not exactly a recheck
  message is never acknowledged and moves to the platform dead-letter queue.
- Slice 12 owns the producers of the template, pattern and taxonomy events, so
  those three kinds select nothing until it ships. After the first sweep that
  follows the deploy, every historical undispatched schema, block and
  localization event is relayed once, 25 per tick; each becomes one idempotent
  recheck, a one-time burst.

## Outbox relay poison rows

The scheduled outbox sweep (`platform.outbox.sweep`) claims rows and places their
envelopes on the queue. A claimed row the Worker cannot turn into its envelope (a
historical row whose correlation id is not an RFC UUID, for example) is poison.
The sweep records it in `consumer_dead_letters` (consumer `platform.outbox.sweep`,
reason `INVALID_QUEUE_PAYLOAD`, identifiers in their stored shape or null, no
payload), completes its outbox claim and continues with the rows behind it, so a
poison row no longer starves the other families. The outbox row itself is never
deleted or rewritten, and its `dispatched_at` ends set; the dead-letter row is the
evidence. A dead letter that cannot be written, an unacknowledged dead letter, a
claim that cannot be completed, a row that is not addressable and a row leased to
another sweep all still make the sweep ask for a retry, so nothing is dropped.
Any `consumer_dead_letters` row with this consumer is an alert: find the event
type and aggregate from its identifiers and escalate to the producing shard; do
not requeue it by hand.

## History cursors

CMS-03B-03 with a `state` filter scans at most 1,000 keyset candidates, concealed
ones included, and its cursor can sit after a revision the caller may not know
exists. That cursor is sealed (DEC-168), not just signed: `0x01 || keyId(16) ||
nonce(16) || ciphertext(208) || tag(32)`, a fixed 273 bytes and 364 base64
characters whatever it encodes, AES-256-CBC under a fresh nonce (so one position
never seals to the same bytes twice) with an HMAC-SHA-256 tag verified in constant
time before anything is decrypted. Both keys are independent derivations of the
existing Vault secret `cms_editorial_history_cursor_active` (and a retired secret
for the 24-hour grace), so the provisioning and rotation steps in
[CMS editorial entry authoring](./cms-editorial.md) are unchanged. An unfiltered
history request and the CMS-03B-13 list keep the signed envelope. A sealed cursor
that is structurally malformed (wrong length) is `400 INVALID_REQUEST`; a wrong
key, tag, domain, payload or expiry, or a valid cursor replayed with another
state, limit or locale, is a restartable `409 CONFLICT` (`recoveryAction`
`refresh`). Every refusal writes nothing. A burst of `409` on history means an
expired or rotated key window; clients restart from page 1.

## Projection state

`projectionState` on a publication (`pending`, `converged` or `degraded`) is
derived, never stored, by `platform_private.cms_publication_projection_state` from
the newest row of each of the eight registered consumers in
`platform_private.projection_consumer_state` (BE04c; DEC-167). It is `degraded`
when a consumer's newest row is `blocked`, `converged` when all eight newest rows
are `active`, `superseded` or `revoked`, and `pending` otherwise (none reported,
or one still building, ready, retrying or missing). The lineage append and the
CMS-03B-15 workflow read both call it; it is a read and never touches canonical
state. Only the Shard 04 delivery RPCs (Slice 15) write the table, so until they
ship no consumer reports and the state is `pending` for every publication; that
is not a fault, and the 2-minute projection-lag alert has no signal yet. The table's
`projection_id` carries no foreign key until `publication_projection` exists
(tracked boundary, issue #127, Slice 13 P2-S13-AC-164).

## Reviewer queue read plan

CMS-03B-17 (`platform_private.cms_list_editorial_reviews`) is linear in the
caller's assignment count whatever the planner believes. The canonical database
gate once sat 63 minutes in one queue-page statement: after autovacuum left
`relpages > 0, reltuples = 0` behind a run of rolled-back fixtures the planner
estimated one row per table and joined review(503) x assignment(201) x review(503),
27 million tuples and 65 seconds per call. Migration
`20261010171000_cms_list_editorial_reviews_bounded_plan.sql` reads the caller's
active assignment ids into one array first, probes the reviews once by id, and
applies the keyset order and `LIMIT` before the four decoration joins. The guard
`supabase/tests/phase_02_slice_11_reads_plan_stability.sql` reproduces the bad
statistics and fails, instead of hanging, if the plan regresses. If queue reads
approach the 8-second deadline (`504 GATEWAY_TIMEOUT`), capture the statement's
plan and the tables' `pg_class` `relpages` and `reltuples` and escalate; the
guard shows the shape to expect (the assignment ids read first, no join between
the two large tables). The relationship row policies are not the cause: dropping
them changed the bad plan from 65.0 to 62.6 seconds.

## Row-level reads

A session reading a Slice 11 table directly sees exactly the rows the read RPCs
would show it (DEC-174): the five review scopes for reviews, decisions and
dependency rows, the CMS-03B-15 workflow scopes for schedules, publications and
accessibility summaries, the owner or the assignee's own active assignment for
assignments, workflow participants for settings snapshots, and nobody for preview
tokens. The restrictive `<table>_session_relationship` policies bind every role
except `wejammin_cms_definer`, whose function bodies decide the 404 versus 403
split and run the recount, invalidation and sweep cascades under any session.
A transaction with no published session (a service path) keeps the RPC-context
gate and tenant check, except for tokens.

## Job lease control

A delivery of a job from the verified immutable CMS schema dry-run origin runs
under a lease session (`packages/application/src/infrastructure/jobs/cms-lease-control.ts`;
every other job gets exactly the argument list it had before): a
serialized checkpoint renews the heartbeat before one-third of the lease remains and loses it
on any false, throwing or non-Boolean answer, and a lost or expired lease
overrides success, manual review and a throw. When the session cannot open after a
successful claim (no trusted clock, no heartbeat port, an unattributable or
expired receipt) the job is returned to `queued` by the ordinary outcome CAS at
the claim version, `retryable`, errorCode `LEASE_CONTROL_UNAVAILABLE`, with no
effect and no acknowledgement; a receipt that cannot be attributed to the claim
writes nothing and is a plain retry. A job found `running` for good under a lease
nobody renews is a defect: escalate with the job id hash.

### Preparation Job trigger (boundary #128, DEC-183, DEC-184)

A verified `cms.schema.dry_run` delivery reaches the claimed preparation through the
production async entrypoint: the callback is composed once per Worker environment object
(`apps/worker/src/production-schema-migration-preparation-claimed.ts`), receives the
delivery context (environment, an invocation abort signal, the delivery number) and answers
exactly one of `queued`, `succeeded` or `failed`. It never answers `pending_manual_review`, so
a Job is never parked `running` with its message acknowledged. The map is BE03a "Preparation
Job disposition":

- completed: `succeeded`, `resultRef { cms_schema_dry_run_report, <dryRunId> }`.
- sealed failing scan or blocked plan: `failed` `MIGRATION_BLOCKED`, no `resultRef`; the sealed
  report remains the only pass/fail authority and a new CMS-03A-10 attempt is the recovery.
- progress (batch limit reached): `queued`, no error code, redelivered at once. Retry-type
  results (`LEASE_UNAVAILABLE`, `DEPENDENCY_UNAVAILABLE`, `JOB_LEASE_LOST`, a refused or
  unreadable stage RPC, an environment that fails validation): `queued` with the reason, redelivered
  after 15, 60 and 300 seconds for deliveries 1, 2 and 3. The status read shows that stored code as
  `error { code, retryable: false }` while the Job polls `queued`.
- terminal worker failure: `failed` with the worker reason (`MIGRATION_FAILED` when it is not a safe
  token).

Capacity. One invocation scans or backfills at most `maxBatchesPerInvocation` (m, default 1,
1 to 32) batches of at most 128 rows and is bounded by `min(240000, Job lease remaining - 60000)` ms.
A preparation of N source rows needs `2 x ceil(ceil(N / 128) / m) - 1` deliveries (1 when N = 0), so it
completes inside the four BE00 deliveries only when `N <= 256 x m`: 256 source rows at the default,
512 at m = 2, 8,192 at m = 32. A type above that ceiling cannot be prepared until m is raised
(measure the CPU of one batch against `limits.cpu_ms` first) or the owner decides an early cap.

Exhaustion signal. A preparation that would continue after the fourth delivery fails the Job
`failed` `MIGRATION_RETRIES_EXHAUSTED` (status read `error.code`), with the plan rolled back through
the terminal rollback: a `dry_running` plan becomes `blocked` with its report `failed`
(`failure_code` `MIGRATION_RETRIES_EXHAUSTED`), a `running`, `verifying` or `failed_retryable` plan becomes
`failed_terminal`, so the next CMS-03A-10 attempt is admitted instead of answering 409. Triage:
the queue-attempt log events (`cms.registry.queue_attempt`, attempt 4, outcome failure) and the
`migration retry >3` alert name the occurrence; read the plan state and the report. If the plan is
still `running`, `verifying` or `failed_retryable` after the Job failed, the rollback could not be
made (an unreadable plan, or a `verifying` plan whose 30 s plan lease lapsed): escalate with the
plan id hash. Never edit the plan, report or Job directly. A message that the queue dead-letters
before the effect runs leaves its Job `queued` or `running` and raises the `DLQ > 0` alert: escalate
with the job id hash.

Stage fence. Each of the eight state-advancing worker RPCs is preceded by one lease checkpoint
(BE03a "Job lease checkpoints"); a lost lease stops the delivery with no further worker RPC and no
Job write, and the Job is redelivered on the schedule above. The plan lease, plan version and
cursor CAS and the BE00 outcome CAS remain the authority.

## Dependency failures

Every CMS editorial 502 is `DEPENDENCY_UNAVAILABLE` (BE00), never a separate bad
gateway code: a contacted dependency answered with something that fails the strict
response contract. The body is `details { dependencyClass: "cms_editorial",
retryable: true }`, a fixed message and no `Retry-After`; the Worker's
`x-cms-editorial-retryable` header and its telemetry `retryable` stay `false`
because a contract drift is not retried automatically. A `503` is the unavailable
form (missing key, evidence or artifact; `Retry-After` 5 s) and a `504`
`GATEWAY_TIMEOUT` is a passed deadline. Treat a 502 burst as a contract drift
between the SQL answer and the registered resource: escalate, do not retry in a
loop. Each route declares `DEPENDENCY_UNAVAILABLE` for both 502 and 503.

## Observability

Metrics (labels never carry an id, hash, reason text or person):
`cms_review_submitted_total{risk_class,outcome}`, `cms_review_decision_total{decision,outcome}`,
`cms_review_assignment_total{action,outcome}`, `cms_review_invalidated_total{reason}`,
`cms_preflight_result_total{category,outcome,phase}`, `cms_preflight_latency_ms{category}`,
`cms_a11y_checker_duration_ms`, `cms_schedule_blocked_total{reason}`,
`cms_schedule_attempt_total{outcome}`, `cms_schedule_claim_batch_size`,
`cms_preview_verify_total{valid}`, `cms_publication_lineage_conflict_total`,
`cms_settings_snapshot_ordinal`, `cms_separation_of_duties_refusal_total{operation}`,
`cms_schedule_deviation_seconds`, `cms.review_recheck.enqueue.total`,
`cms.review_recheck.run.total` and `cms.review_recheck.examined.total`. A
cancelled schedule is `cms_schedule_attempt_total{outcome="cancelled"}` with the
closed reason as a log attribute; BE03b lists no separate cancellation metric.

Alert when review invalidation spikes above 5% in 5 minutes, a schedule stays
blocked for more than 15 minutes, publication projection lag exceeds 2 minutes, the
DLQ is non-empty, outbox age exceeds 2 minutes, preview denial anomalies indicate
token forwarding, any `cms_schedule_blocked_total{reason="retries_exhausted"}`
increment occurs, the accessibility checker exceeds 2,000 ms,
`cms_publication_lineage_conflict_total` rises above background, a
`cms_publication_schedule_sweep.deadline_exceeded` event appears, a
`.evidence_stale` event is followed by `.execute_failed` with `errorCode`
`preflight_evidence_stale`, a `consumer_dead_letters` row names consumer
`platform.outbox.sweep`, or `cms.review_dependency_recheck` retries repeat for one
event.
