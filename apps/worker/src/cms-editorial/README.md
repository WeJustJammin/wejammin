# CMS editorial Worker routes

## Contents

`routes.ts` registers the protected CMS-03B-01 revision command,
`conflict-routes.ts` the CMS-03B-02 resolver, `create-routes.ts` the
CMS-03B-10 initial-entry create, `history-routes.ts` the CMS-03B-03 safe
revision-history read, `restore-routes.ts` the CMS-03B-04 new-draft restore,
and `detail-routes.ts` the CMS-03B-11 draft-detail read. The
admission helpers enforce bounded JSON, strong validators, browser origin and
CSRF rules for mutations, capability checks, dual rate buckets, dependency
deadlines, and canonical responses. `route-execution.ts` contains the rate and
redacted telemetry seams; `types.ts` defines the injected rate, persistence,
and dependency ports and `port-inputs.ts` the trusted session and the typed
per-operation port inputs. `route-errors.ts` owns the common no-store headers,
the safe-read error boundary, and the single `ApiError` response builder every
route uses; `route-error-details.ts` owns the allowlisted detail projection
behind it, and `routes.ts` re-exports `commonHeaders`, `errorResponse`, and
`sanitizeReadError` so route modules keep one import. Co-located tests cover
those boundaries.

Slice 10 adds three safe reads: `conflict-detail-routes.ts` registers the
CMS-03B-12 three-way conflict detail, `list-routes.ts` the CMS-03B-13
assigned-entry keyset list, and `authoring-context-routes.ts` the CMS-03B-14
authoring-context preparation read. All three share the empty-media read
admission, the numbered path/header/body/query refusal, the closed capability
and rate gates, and the strong no-store ETag. Their read-error envelope
(`sanitizeReadError`) replaces every dependency message with the canonical
route text, conceals an absent or hidden target as an empty-detail 404, and
keeps a visible-but-unassigned target a bounded 403.

The CMS-03B-14 authoring-context ETag is a strong representation validator:
`"sha256:<lowercase hexadecimal SHA-256 of the exact UTF-8 JSON response
bytes>"`. The response bytes are `JSON.stringify` of the strict parsed
resource, with no actor or acting-party preimage, so a first-party proxy can
recompute the validator from the body without private scope inputs.

## Slice 11: review, schedule, preview and publication

Slice 11 adds nine browser operations, all driven by one admission kit instead of
nine copies. `workflow-command.ts` is the shared pipeline of a command (BE00
order: origin, media and size, CSRF, body, session, strict query/path/body,
capability gate, step-up, quota, Idempotency-Key and strong If-Match, optional
pre-RPC stage, port, response invariants) and `workflow-read.ts` that of a safe
read. Every operation module supplies only what differs and takes its method,
path, statuses, rate class, deadline, tier, validators and step-up from the
registry row (`policyFor`), never from a literal:

| Operation                  | Module                        | Port                      | Pre-RPC stage                                      |
| -------------------------- | ----------------------------- | ------------------------- | -------------------------------------------------- |
| CMS-03B-05 submit review   | `review-submit-routes.ts`     | `submitReview`            | accessibility proof (submit)                       |
| CMS-03B-06 record decision | `review-decision-routes.ts`   | `recordDecision`          | none; step-up                                      |
| CMS-03B-07 schedule        | `schedule-routes.ts`          | `schedulePublication`     | time authority (E8) then proof (schedule); step-up |
| CMS-03B-08 mint preview    | `preview-routes.ts`           | `mintPreview`             | none                                               |
| CMS-03B-09 publish         | `publication-routes.ts`       | `publishRevision`         | accessibility proof (publish); step-up             |
| CMS-03B-15 workflow read   | `workflow-read-routes.ts`     | `getEntryWorkflow`        | accessibility proof (workflow_read)                |
| CMS-03B-16 review detail   | `review-detail-routes.ts`     | `getEditorialReview`      | none                                               |
| CMS-03B-17 reviewer queue  | `review-queue-routes.ts`      | `listEditorialReviews`    | none                                               |
| CMS-03B-18 assign / revoke | `review-assignment-routes.ts` | `assignEditorialReviewer` | none; step-up                                      |

Rules a new Slice 11 operation follows:

- A `gate: 'capability'` row gets the coarse capability check (403
  `capability_missing`); an `rpc_scope` row has none because the RPC resolves
  the full scope and answers 403/404 itself. A `stepUp: 'required'` row answers a
  stale MFA proof 401 `STEP_UP_REQUIRED` before the quota, the idempotency
  reservation and any domain read.
- `workflow-errors.ts` is the only error boundary of these rows: a status the row
  does not declare is a scrubbed 500, a reason token must be in the row's
  `reasonCodes` with its status, and structured detail members (preflight
  entries, alternatives, dependency hash, safe versions) are rebuilt from the
  contract's strict detail schemas. CORS and CSRF refusals are middleware and
  publish the BE00 403 on every row.
- `workflow-time-authority.ts` verifies the committed tz snapshot at module load;
  a failed check answers every schedule command 503. `a11y-structural/` is the
  pure accessibility checker (Slice 16 reuses it unchanged); the route layer only
  asks the injected `qualityGate` for a `PreflightEvidence | null`.
- CMS-03B-19 (preview verifier) and CMS-03B-20 (schedule sweep) are internal RPCs
  and have no route here: see `cms-editorial-production-preview-verifier.ts` and
  `cms-publication-schedule-sweep.ts`; `cms-editorial-principals.test.ts` pins
  who may import them.
- Tests: `workflow-command-admission.test.ts` and `workflow-read-routes.test.ts`
  drive every operation through the whole admission order from the fixtures in
  `workflow-fixtures.test-support.ts` and `workflow-harness.test-support.ts`; add
  a `commandCases` / `readCases` row for a new operation.

## Ownership

This directory owns HTTP admission and response policy only. The production
adapter in `apps/worker/src/cms-editorial-production*.ts` owns authentication,
rate-limit transport, and service-role RPC calls. The database owns durable
idempotency, entry assignment, immutable revisions, and conflict persistence.
An in-isolate replay cache must never bypass those database checks.

## Extension

Add each new BE03b operation by first extending the strict contracts and RED
route tests, then injecting a named port and registering the route here. Keep
new operations fail-closed until their production adapter, RPC, and policy
source are available. All nine operations have a protected route and a named
production RPC adapter. CMS-03B-10, -01, -02 and -04 re-fetch the editorial
workflow-policy evidence, the activation evidence, the compiled artifact and the
frozen protected `rich_text.v1` validator in the database; when any is absent or
stale the RPC answers a typed 503 and writes nothing. CMS-03B-03 history and
CMS-03B-13 list bind to signed service-role wrappers. Without an
owner-provisioned, per-environment Vault key (`cms_editorial_history_cursor_active`)
their first page is a typed 503 and no data; the local fixed test key is not an
operational secret. The private database readers stay unsigned internally; only
the service-role API wrappers sign outward cursors. Their read routes reject
body/media claims before session lookup; a structurally malformed cursor, limit,
comparison ID or locale is a 400 with safe violation pointers, and an expired,
tampered or foreign-bound cursor is a restartable 409 (DEC-140). CMS-03B-11 draft
detail verifies the active schema fields and returns only authorized,
schema-typed values and bounded relations; an unavailable relation target
follows its RelationDefinition (`omit` disappears, `placeholder` is opaque,
`block` refuses). CMS-03B-04 restore binds the protected migration-chain RPC
(`cms-editorial-production-restore-port.ts`) and answers
`{ resource, restoreVerification }`; a 65-version chain is accepted and a
66-version evidence list is refused as an invalid response. Hosted composition,
key rotation and drills are not yet verified; this local wiring is not hosted
acceptance. The operator procedure is `docs/runbooks/platform/cms-editorial.md`.

## Errors, deadlines and telemetry (Slice 10)

- `error-vocabulary.ts` is the closed set of typed `reasonCode` tokens, recovery
  actions and conflict kinds a 409/422 may publish, plus the safe JSON-pointer
  grammar of `details.violations`. A new typed reason is added there, in
  `apps/worker/src/cms-editorial-production-error-tokens.ts` (the whole-token
  RPC table) and in BE03b together; nothing outside the sets reaches a client.
- `createRouteDeadline` (admission-deadline.ts) gives every route one cumulative
  budget clamped to the operation's declared timeout, with `request.signal` as
  the parent of every dependency call.
- `route-stages.ts` wraps the injected seams once so telemetry reports only the
  stages (authority, rate limit, RPC) a request really entered.
  `route-telemetry.ts` builds the single redacted event per request: the BE03b
  `cms_*` metrics with closed labels, safe counts, retryability derived from the
  published ApiError, and a hash of the entry id. No identifier, value or
  credential is ever added; extend `RouteFacts`, not the event, for new counts.
- A command answered from its stored idempotent outcome may carry the private
  `x-cms-idempotent-replay: true` response header from the database; it only
  affects telemetry and is never forwarded.
- The Worker's in-isolate counter of three concurrent CMS-03B-01 writes per actor
  (`cms-editorial-production.ts`) is only a cheap pre-filter; the authority is
  the database's three per-actor transaction slots, which answer `RATE_LIMITED`
  (429) across isolates before any insert.
- Edit-presence expiry is not an HTTP route: it is the scheduled
  `apps/worker/src/production-cms-edit-presence-sweep.ts`, which logs the
  `cms_presence_active` gauge.

## Conventions

Only allowlisted browser origins receive CORS headers. Never trust caller
authority metadata, echo SQL errors, or include entry/field values in
telemetry. Return `Cache-Control: no-store` for protected editorial responses.
Keep source and test files within the project 400-line limit.

## Related links

See the locked BE03b editorial specification, the CMS editorial contracts
README, `apps/web/src/server/README.md` for the browser proxy boundary, and
`docs/runbooks/platform/cms-editorial.md` for operations.
