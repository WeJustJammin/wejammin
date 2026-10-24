# Worker composition

`index.ts` composes versioned routes, middleware, Queue consumers, and scheduled handlers. Transport modules validate contracts and call application use cases; they do not own SQL, business invariants, or provider-shaped canonical data.

Middleware order is correlation, security headers, body and size limits, authentication, acting context, authorization, validation, idempotency, and observability. Public readiness responses remain sanitized.

## Contents

The composition root and its colocated transport tests live here. New
consumers, schedules, and routes should remain small modules with one
responsibility.

`production-worker-runtime-cms.ts` constructs protected schema migration
workers. The legacy factory binds activation; the named preparation factory
binds private `dry_run` purpose without exposing a caller option. Both facades
re-export the same functions. `production-job-effect-dispatcher.ts` selects
only exact internal object-verification aliases or `cms.schema.dry_run`;
provider and lookalike families never select a dependency. The private CMS lease
control the consumer supplies for a verified origin reaches only the preparation
callback, and only when present; every other callback keeps one argument. These
construction seams do not themselves supply claimed-job resolution or persistent
job fences. The production preparation callback is composed per Worker
environment. `orchestrateQueueMessage` hands the dispatcher the delivery's `env`,
an abort signal bounded by the invocation budget `min(240000, lease remaining -
60000)` ms and the delivery number (`max(1, message.attempts)`) as a third,
Worker-layer argument, only for `cms.schema.dry_run`; the production entrypoint
builds one claimed-preparation object per `env` object (a `WeakMap`, like the legacy
worker) from that environment's validated service credentials and never from module
state (`production-schema-migration-preparation-claimed.ts`). The callback maps every
preparation result to a BE00 Job disposition (BE03a "Preparation Job disposition",
`content-schema-registry/claimed-schema-migration-preparation-job-result.ts`), never
throws, and never answers `pending_manual_review`; the dispatcher refuses any other
CMS answer as a queued unavailable Job (failed `MIGRATION_RETRIES_EXHAUSTED` on the
fourth delivery). Retry-type dispositions are redelivered after 15, 60 and 300
seconds. The claimed entry awaits one lease checkpoint before each of eight
state-advancing worker RPCs (`claimed-schema-migration-preparation-lease-fence.ts`)
and, on the last delivery, rolls an in-flight plan back
(`claimed-schema-migration-preparation-exhaustion.ts`). A preparation completes inside
the four deliveries for at most `256 x maxBatchesPerInvocation` source rows.

`cms.taxonomy.merge_converge` (BE03c 1334) is the second family whose callback gets the delivery context
(`async-runtime-job-delivery.ts` `CONTEXT_JOB_TYPES`), but no lease control. Its effect
(`cms-taxonomy-merge-converge-effect.ts`, names in `cms-taxonomy-merge-converge-names.ts`, the one RPC door in
`cms-taxonomy-merge-converge-rpc.ts`) fences on the claim receipt (`claimedLease.version`, the lease token), calls
`platform_api.cms_run_taxonomy_merge_converge` without `batch`, and settles the job `succeeded` (the database refuses a
succeeded outcome without a result reference, so it names the continuation job the SQL already requested, else the job
itself) or `failed`. It never answers `queued` or manual review: the redelivered envelope carries the creation version,
which the generic dispatch skips as stale once the claim advanced the job, so a re-queued job would be parked. A
transient fault is retried inside the invocation (three attempts, 15 s then 60 s pauses of the BE00 retry schedule, each
plus 0-10 % bounded jitter from an injectable random seam, worst case 127.5 s of the 240 s budget), a refusal that cannot
change fails the job at once. The dispatcher (`convergeTaxonomyMerge`) settles any other answer as
`MERGE_CONVERGE_OUTCOME_UNMAPPED`. Every delivery logs one event: the dispatcher guard (effect not wired, threw, or
answered outside the closed set) logs the same failed event and metric as the effect's own failures.
The registered error codes, the alert and the recovery of a failed job are in the runbook
`docs/runbooks/platform/cms-taxonomy-merge-converge.md`.

`cms-taxonomy-merge-reconcile-sweep.ts` is that recovery (owner decision DEC-194, BE03c "Merge convergence recovery"):
one scheduled tick makes one `platform_api.cms_reconcile_taxonomy_merge_converge()` call (no argument, `service_role`
only) and parses the answer `{ requested }` strictly (an integer count, no ids). The database owns every rule (a failed
job, remaining work, no live job, a key derived from the failed job's id, 15 minutes, 3 consecutive failed
generations); the Worker never retries inside the tick and logs the count only. It is registered in `index.ts` beside
the other CMS sweeps and the import-graph test pins the entrypoint as its only importer.

`cms-publication-schedule-sweep.ts` runs the CMS-03B-20 tick under one 15,000 ms
job deadline shared by the claim and every execute; no schedule is started after
it. `cms-publication-schedule-sweep-evidence.ts` computes each claim's
accessibility proof and, only when the database refuses a proof as the typed
`preflight_evidence_stale` conflict (a rolled-back execution that consumed
nothing), recomputes it and executes the same claim again under the same lease,
at most twice more. The sweep learns of that refusal from the RPC transport's
typed `AsyncRpcRefusalError` (a 4xx `P0001` identifier-shaped token; no other
part of an error body ever crosses).

`cms-governed-activation-sweep.ts` runs the CMS-03C-19 tick (BE00 job type
`cms.governed_activation.execute`) the same way: one 15,000 ms job deadline, a claim
of at most 25, then each execute with the schedule id, the immutable REVIEW version
of the claim (not the advancing schedule version) and the lease. It computes no
evidence; the database rechecks the review, dependencies and canonical sources and
blocks a schedule it cannot activate with a closed reason. `cms-governed-activation-rpc.ts`
is its only door to the two RPCs; `cms-schedule-sweep-support.ts` holds the log
helpers (hashes, retry, manual review) a schedule sweep shares.

## Ownership

This directory owns Worker entry-point composition and transport orchestration;
it does not own domain policy, SQL, provider payloads, or browser UI.

The request boundary is split by responsibility: `request-boundary.ts` is the
stable public barrel; `request-boundary-types.ts` owns shared result/error
types and limits; `request-boundary-support.ts` owns bounded IDs, query values,
issue mapping, and transport helpers; `request-boundary-reads.ts` owns public
and authenticated read parsing; `request-boundary-command.ts` owns protected
JSON command parsing; and `request-boundary-response.ts` owns no-store and
safe error responses. `browser-security.ts` remains the origin/CSRF boundary.

`upload-completion/` owns the thin `POST
/api/v1/upload-intents/:uploadIntentId/complete` transport. It enforces the
bounded JSON request, authentication, rate/deadline limits, conditional
version, and idempotency headers before calling the shared application port.
The default production composition has no provider registry and returns a
sanitized `503` until an explicit server-side adapter is injected; local tests
use fake storage and queue ports. Responses contain only the shared JobStatus
representation and safe transport metadata, never signed URLs or object keys.

## Extension

Add a module beside the composition root when a new transport seam is needed,
then register it from `index.ts` and add a focused test beside the module.
Keep request-boundary modules under 300 lines and route new exports through
`request-boundary.ts`.

A module that may be reached by exactly one other module (a service-role RPC
port, an RPC-name table, a composition) is pinned by a principal-boundary test,
not by prose. `import-graph.test-support.ts` derives the static import graph of
the shipped sources with the TypeScript parser (value and type-only `import`,
`export ... from`, `require`, dynamic `import()`; comments and strings are never
edges) and `importersOfModule(root, module)` returns the runtime and type-only
importers. `import-graph.test.ts` proves the helper on a throwaway tree;
`cms-publication-schedule-import-graph.test.ts` pins CMS-03B-20 (the sweep port,
the sweep and its RPC-name constants), `cms-governed-activation-import-graph.test.ts`
pins CMS-03C-19 the same way and `cms-editorial-principals*.test.ts`
pin the recheck and takedown seams from the allow-lists in
`cms-editorial-principal-boundaries.test-support.ts`. To protect a new port, add
its allow-list there and assert it with `importersOfModule`; do not grep for
the import line.

## Conventions

Preserve middleware order, import contracts from `@wejammin/contracts`, derive
security context server-side, and keep public health/readiness responses
disclosure-safe. Post-route middleware must set only the security headers it
owns; never round-trip the complete response header set because repeated
`Set-Cookie` fields must remain independent.

`GET /api/v1/ready` is fail-closed. A composition without the explicit,
server-only `checkReadiness` dependency returns a sanitized `503 not_ready`;
only a checker result of `true` (or `{ ready: true }`) can return `200 ready`.
The production entry point intentionally supplies no checker until canonical
recovery evidence and the restore-fence checks have been verified. Supabase
Free has no hosted PITR, so missing, synthetic-only, stale, or failed
integrity/RLS/RPC evidence keeps readiness and protected writes closed. The
route never enables a provider, paid add-on, or pay-as-you-go service.

## Related links

- [Worker boundary](../README.md)
- [Shared contracts](../../../packages/contracts/README.md)
- [Application modules](../../../packages/application/README.md)
