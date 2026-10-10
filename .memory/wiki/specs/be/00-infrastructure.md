# Cross-cutting Platform Foundation — Backend Specification

> **IA Source**: [Shard 00 — Cross-cutting platform foundation](../ia/00-infrastructure.md)
> **Deep Dives**: None required by the IA source
> **Status**: Complete

## Classification

- **Type**: cross-cutting
- **IA Source**: `00-infrastructure.md`
- **BE Spec(s) to produce**: `00-infrastructure.md`
- **Split boundary**: none — runtime, request, persistence, async-effect, provider, observability, release, and recovery rules form one mandatory platform chain
- **Classification approval**: accepted by the user on 2026-08-28
- **DEC-104 free-tier binding**: Supabase Free remains the PostgreSQL/Auth/Storage/Realtime provider. It provides no PITR and no uptime SLA; no paid upgrade, overage, or add-on is authorized. Recovery evidence is synthetic/local only until production-verified recovery evidence is separately demonstrated, and protected money, rights, and publication writes remain closed without it. Cloudflare Workers Paid is the sole paid-service exception under a soft `$10/month` ceiling.

## IA Feature Coverage

The six bullets in IA Shard 00 `§ Features` (lines 32–39) are each reconciled below. Platform features without an application route are covered by the named operational sections and are not silently deferred.

| IA feature (exact source title)            | Backend coverage                                            | Evidence / disposition                                                                                                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Runtime and immutable deployment**       | Promotion, migration, and recovery gates                    | `## Release, Migration, and Recovery` defines immutable preview → staging → production promotion, rollback fencing, recovery verification, and the protected-write fence; complete, no endpoint required.                            |
| **Identity and security boundaries**       | Request middleware and authorization                        | `## Middleware & Policies` defines Supabase verification, server-derived acting context, capability/mandate checks, step-up, CSRF, and disclosure-safe denials; complete.                                                            |
| **API and error contracts**                | INF-API-01–04 and inherited route archetypes                | `## API Endpoints` and `## Request/Response Contracts` define `/api/v1`, strict Zod 4, OpenAPI-compatible schemas, cursor/idempotency/CAS/rate metadata, and the global error contract; complete.                                    |
| **Data, storage and migration foundation** | Platform tables, Storage intents, RLS, and migration fence  | `## Database Schema`, `### Upload Lifecycle`, and `### Recovery Fence` define PostgreSQL authority, governed bytes, Realtime refetch hints, RLS/grants, and forward-only migration checks; complete.                                 |
| **Async and provider effects**             | INF-API-02–04, jobs, queues, webhooks, and outbox consumers | `### Protected Command Transaction`, `### Webhook and Provider Effect`, and `## Event and Consumer Contracts` define atomic intent/outbox, at-least-once jobs, provider reconciliation, and recovery; complete.                      |
| **Observability and release assurance**    | Request telemetry, SLOs, CI/release gates, and runbooks     | `## Observability` plus `## Release, Migration, and Recovery` define structured traces/provider-native diagnostics, SLO registration, protected releases, runbooks, synthetic/local recovery evidence, and restore drills; complete. |

## Referenced Material Inventory

| Material                                                                             | Sections / lines consumed                              | Purpose                                                                                                       |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| [Wiki index](../../index.md)                                                         | lines 19–48                                            | Architecture, engineering standards, BE hub, data-placement, and IA registry entries                          |
| [Specification index](../index.md)                                                   | lines 1–5                                              | Canonical specification-layer hubs                                                                            |
| [IA index](../ia/index.md)                                                           | lines 1–66; Shard 00 row at line 15                    | IA completion status, surface, type, and authoring conventions                                                |
| [Data Placement Strategy](../data-placement-strategy.md)                             | lines 1–162                                            | Canonical stores, PII boundaries, retention, access, and placement constraints                                |
| [Shard 00 — Cross-cutting platform foundation](../ia/00-infrastructure.md)           | lines 1–425                                            | Primary contracts, acceptance criteria, data models, access controls, events, edge cases, and assurance rules |
| [IA Decomposition Plan](../ia/decomposition-plan.md)                                 | lines 40–50 and 104–110                                | Shard boundary, cross-cutting classification, and architecture-sourced rationale                              |
| [Architecture Design](../2026-08-02-architecture-design.md)                          | lines 180–188, 259–376, 440–652, 707–910, and 938–1006 | Runtime, API, data, auth, security, error, observability, and contract decisions                              |
| [Engineering Standards](../ENGINEERING-STANDARDS.md)                                 | lines 27–44, 53–65, 96–121, 140–165, and 185–207       | Contract tests, performance budgets, accessibility, security, migrations, and CI gates                        |
| [Shard 01 — Identity authority and party governance](../ia/01-identity-authority.md) | Contracts lines 85–120; Event Schemas lines 206–220    | Acting-context and identity contracts consumed by the platform boundary                                       |
| [Operations Runbooks](../../operations/runbooks/README.md)                           | lines 1–19                                             | Recovery, incident, and operational ownership boundary                                                        |
| Completed cross-cutting BE specifications                                            | none present                                           | Shard 00 establishes the backend foundation inherited by later BE specifications                              |

## IA Source Map

| BE Spec Section                   | IA / architecture source                                                                                                                                  | Section / lines                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Classification and boundary       | [Shard 00](../ia/00-infrastructure.md); [decomposition plan](../ia/decomposition-plan.md)                                                                 | Shard 00 lines 1–40 and 375–387; decomposition lines 40–50 and 104–110                               |
| Endpoint reconciliation           | [Shard 00](../ia/00-infrastructure.md)                                                                                                                    | Acceptance Criteria lines 41–55; Interactions lines 56–81; Surface Applicability lines 352–357       |
| HTTP endpoints and route registry | [Shard 00](../ia/00-infrastructure.md); [Architecture Design](../2026-08-02-architecture-design.md)                                                       | Contracts lines 84–165; architecture API Design lines 359–376 and Rate Limits lines 770–789          |
| Request/response contracts        | [Shard 00](../ia/00-infrastructure.md); [Architecture Design](../2026-08-02-architecture-design.md)                                                       | HTTP Shapes lines 97–145; Command Guarantees lines 147–157; Global Error Envelope lines 578–608      |
| Database schema and permissions   | [Shard 00](../ia/00-infrastructure.md); [Data Placement Strategy](../data-placement-strategy.md)                                                          | Data Models lines 166–233; placement lines 5–56, 95–124, and 138–148                                 |
| Middleware and authorization      | [Shard 00](../ia/00-infrastructure.md); [Shard 01](../ia/01-identity-authority.md)                                                                        | Access Control lines 234–263; Shard 01 Contracts lines 85–120 and Event Schemas lines 206–220        |
| Async/event/provider boundaries   | [Shard 00](../ia/00-infrastructure.md)                                                                                                                    | Event Schemas lines 274–310; Edge Cases lines 312–342                                                |
| Accessibility contract handoff    | [Shard 00](../ia/00-infrastructure.md); [Engineering Standards](../ENGINEERING-STANDARDS.md)                                                              | Accessibility lines 264–272; standards lines 140–148                                                 |
| Observability and SLOs            | [Shard 00](../ia/00-infrastructure.md); [Architecture Design](../2026-08-02-architecture-design.md); [Engineering Standards](../ENGINEERING-STANDARDS.md) | Assurance lines 343–350; architecture lines 938–976; standards lines 53–138                          |
| Tests and ambiguity gates         | [Shard 00](../ia/00-infrastructure.md); [Engineering Standards](../ENGINEERING-STANDARDS.md)                                                              | Acceptance Criteria lines 41–55; Edge-Case Coverage lines 358–373; standards lines 27–44 and 185–207 |

## Endpoint Completeness Reconciliation

Shard 00 defines four concrete platform-owned HTTP endpoints and the mandatory behavior inherited by every later domain endpoint. It does not invent public, authenticated, administrative, or domain-command resources that the locked IA does not own. Later BE specs must register their concrete routes against the archetypes below and cite this specification.

| IA flow                        | Concrete endpoint authored here                                                        | Reconciliation decision                                                                                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INF-01 Public read             | none                                                                                   | Inherited endpoint archetype. The owning domain defines the resource path, public projection, cache allowlist, schemas, and BOLA-safe absence behavior.                 |
| INF-02 Authenticated read      | `GET /api/v1/jobs/{jobId}`                                                             | Job status is the only platform-owned authenticated resource. Other authenticated reads are owned by domain specs.                                                      |
| INF-03 Protected command       | none                                                                                   | Inherited command archetype. Every retryable create/effect must register idempotency, concurrency, audit, outbox, errors, rate class, and SLO cells.                    |
| INF-04 High-risk/admin command | none                                                                                   | Inherited command archetype. Owning specs add step-up, named capability, reason, denial audit, and explicit 403/404 disclosure policy.                                  |
| INF-05 Long-running job        | `GET /api/v1/jobs/{jobId}`                                                             | Initiating domain commands remain in their owning specs; they return the shared `JobStatus` contract and `Location` header.                                             |
| INF-06 Object upload           | `POST /api/v1/upload-intents`; `POST /api/v1/upload-intents/{uploadIntentId}/complete` | Shard 00 owns authorization, signed-transfer admission, completion, and verification admission. Domain specs register allowed target/purpose/media policies.            |
| INF-07 Offline intent          | none                                                                                   | Reuses the owning INF-03/05 endpoint after reconnect. Local intent is not a server endpoint or canonical resource.                                                      |
| INF-08 Realtime hint           | none                                                                                   | Supabase Realtime carries a non-authoritative ID/version hint; canonical state is read through the owning GET endpoint.                                                 |
| INF-09 Inbound webhook         | `POST /api/v1/webhooks/{provider}`                                                     | `{provider}` is a build-time registered route literal, not a caller-selected adapter. Each integration supplies its signed headers and post-signature Zod event schema. |
| INF-10 Provider effect         | none                                                                                   | Internal registered consumer; no synchronous public/provider-effect endpoint is admitted here.                                                                          |
| INF-11 Release promotion       | none                                                                                   | Protected CI/deployment workflow, not an application API.                                                                                                               |
| INF-12 Maintenance/recovery    | none                                                                                   | Runbook-controlled operational workflow, not an application API.                                                                                                        |

No endpoint is deferred from Shard 00: all platform-owned endpoints are specified below, and every other flow is explicitly assigned to an owning downstream spec or non-HTTP boundary.

## API Endpoints

### Route Registry

Every Hono route is a compile-time registry entry with method, exact path template, auth class, cache class, timeout class, rate class, SLO tier, criticality, owning shard, operation ID, request schema, success schema, error schemas, BOLA test declaration, and deprecation state. CI fails on discovered-but-unregistered, registered-but-missing, duplicate method/path, stale schema, or missing owner/runbook entries.

| ID         | Method and path                                         | Auth and ownership                                                                                                                                                                                               | Success                                                                                           | Idempotency / concurrency                                                                                                            | Rate, timeout, cache, SLO                                                                                                                              |
| ---------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| INF-API-01 | `GET /api/v1/jobs/{jobId}`                              | Verified session; allow when `actor_id = userId`, or `acting_party_id` is the resolved party with `jobs.read`, or step-up operator has `jobs.read:any` plus reason. Existence-sensitive denials collapse to 404. | `200 JobStatus`; `ETag: "<version>"`                                                              | Safe read; no `Idempotency-Key` or `If-Match` requirement. Supplied values never confer authority.                                   | Authenticated-read limit 300/min/user and 600/min/party; exact 8s deadline; `no-store`; Tier 1 p95 <750ms                                              |
| INF-API-02 | `POST /api/v1/upload-intents`                           | Verified session and server-resolved acting party; owning domain policy must allow upload to the target and purpose. Operator path additionally requires step-up and named target capability.                    | `201 UploadIntentResource`; `Location` for the intent; object `ETag`                              | `Idempotency-Key` required. `If-Match` required when the target registry marks the target mutable; database validates it atomically. | 20/hour/user, max 3 concurrent uploads; exact 15s command deadline and response target <2s; `no-store`; Tier 2 p95 <1,200ms                            |
| INF-API-03 | `POST /api/v1/upload-intents/{uploadIntentId}/complete` | Same actor/party that owns the live intent and remains authorized for its target. Operator override is not automatically granted and must be registered by the owning domain.                                    | `202 JobStatus` for verification; `Location` for job; object `ETag`                               | `Idempotency-Key` and exact object `If-Match` required. Same binding replays the same job; mismatched body/version returns 409.      | Ordinary mutation 60/min/user and 120/min/party, plus max 3 concurrent uploads; exact 15s command deadline and response target <2s; `no-store`; Tier 2 |
| INF-API-04 | `POST /api/v1/webhooks/{provider}`                      | Registered provider principal only. Verify signature and replay timestamp over untouched raw bytes before parsing; no browser session, acting context, CSRF token, or human escalation.                          | `202 WebhookAcknowledgement` for accepted and verified duplicate receipts; identical public shape | No `Idempotency-Key`/`If-Match`; dedupe is unique `(provider, external_event_id)` plus payload digest.                               | 300/min/provider endpoint; acknowledgement p95 <=1,000ms and p99 <2,000ms; `no-store`; provider/webhook SLO                                            |

### Endpoint Field Validation Matrix

| Endpoint   | Location and field       | Constraint                                                                                                                                              | Failure                                                                                        |
| ---------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| INF-API-01 | path `jobId`             | UUID; exactly one canonical job ID                                                                                                                      | 400 `INVALID_REQUEST` with `/path/jobId` violation                                             |
| INF-API-02 | header `Idempotency-Key` | 8–128 printable ASCII; trimmed value must remain byte-identical; stored only as a digest                                                                | 400 `INVALID_REQUEST`                                                                          |
| INF-API-02 | header `If-Match`        | Exact quoted positive bigint when target registry says mutable; absent only for explicitly immutable/new targets                                        | 400 `INVALID_REQUEST`; stale value is 409 `CONFLICT`                                           |
| INF-API-02 | body `targetType`        | Registered closed enum; 1–64 lowercase ASCII/dot characters                                                                                             | 422 `VALIDATION_FAILED`                                                                        |
| INF-API-02 | body `targetId`          | UUID; existence and ownership evaluated after structural validation                                                                                     | 422 `VALIDATION_FAILED`, then policy-safe 404/403                                              |
| INF-API-02 | body `purpose`           | Closed enum owned by target registry; unknown keys rejected                                                                                             | 422 `VALIDATION_FAILED`                                                                        |
| INF-API-02 | body `mediaType`         | Lowercase normalized MIME type in target allowlist                                                                                                      | 422 `VALIDATION_FAILED`                                                                        |
| INF-API-02 | body `byteSize`          | Safe integer `1..target.maxBytes`; declared value is not proof of received size                                                                         | 422 `VALIDATION_FAILED` or 413 `PAYLOAD_TOO_LARGE` when route ceiling is exceeded              |
| INF-API-02 | body `checksum`          | `{ algorithm: 'sha256', value: 64 lowercase hex }`; algorithm registry may only tighten by versioned contract                                           | 422 `VALIDATION_FAILED`                                                                        |
| INF-API-03 | path `uploadIntentId`    | UUID                                                                                                                                                    | 400 `INVALID_REQUEST`                                                                          |
| INF-API-03 | headers                  | Same idempotency rule as INF-API-02; `If-Match` is exact current `ObjectRecord.version`                                                                 | 400 or 409 `CONFLICT`                                                                          |
| INF-API-03 | body `byteSize`          | Safe positive integer, `<= intent.maxBytes`, and equals provider-observed bytes                                                                         | 422 `VALIDATION_FAILED`; mismatch later yields terminal `OBJECT_VERIFICATION_FAILED` job error |
| INF-API-03 | body `mediaType`         | Normalized type in intent allowlist and equal to verified provider metadata                                                                             | 422 or terminal verification failure                                                           |
| INF-API-03 | body `checksum`          | SHA-256 lowercase hex and equal to verified bytes before `ready`                                                                                        | 422 or terminal verification failure                                                           |
| INF-API-04 | route provider           | Compile-time literal in provider registry; an arbitrary runtime provider name never selects credentials or an adapter                                   | 404 for unregistered route                                                                     |
| INF-API-04 | raw body                 | Provider-specific configured maximum, never above the global webhook body ceiling; retain untouched bytes only through verification/receipt transaction | 413 `PAYLOAD_TOO_LARGE`                                                                        |
| INF-API-04 | signature/timestamp      | Provider-specific required headers; constant-time verification; timestamp inside registered replay window                                               | 401 `WEBHOOK_REJECTED` with identical safe details for all failures                            |
| INF-API-04 | parsed event             | Strict provider Zod schema after signature; non-empty external event ID; payload digest fixed-length                                                    | 400 `INVALID_REQUEST`; no trusted work on failure                                              |

### Endpoint Response and Error Reconciliation

| Endpoint   | Success schema                                                             | Declared error responses                                                                                                                                                                                                                                              |
| ---------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INF-API-01 | `200 JobStatus`; 304 only when authorized request supplies a matching ETag | 400 `INVALID_REQUEST`; 401 `UNAUTHENTICATED`; 404 `NOT_FOUND` (absent and concealed denial); 429 `RATE_LIMITED`; 503 `DEPENDENCY_UNAVAILABLE`; 500 `INTERNAL_ERROR`                                                                                                   |
| INF-API-02 | `201 UploadIntentResource` plus `Location` and object ETag                 | 400 `INVALID_REQUEST`; 401 `UNAUTHENTICATED`; 403 `FORBIDDEN`; 404 `NOT_FOUND`; 409 `CONFLICT`; 413 `PAYLOAD_TOO_LARGE`; 415 `UNSUPPORTED_MEDIA_TYPE`; 422 `VALIDATION_FAILED`; 429 `RATE_LIMITED`; 503 `DEPENDENCY_UNAVAILABLE`; 500 `INTERNAL_ERROR`                |
| INF-API-03 | `202 JobStatus` plus `Location` and object ETag                            | 400 `INVALID_REQUEST`; 401 `UNAUTHENTICATED`; 403 `FORBIDDEN`; 404 `NOT_FOUND`; 409 `CONFLICT`; 415 `UNSUPPORTED_MEDIA_TYPE`; 422 `VALIDATION_FAILED`; 429 `RATE_LIMITED`; 503 `DEPENDENCY_UNAVAILABLE`; 500 `INTERNAL_ERROR`                                         |
| INF-API-04 | `202 WebhookAcknowledgement`; duplicate uses same status/body              | 400 `INVALID_REQUEST`; 401 `WEBHOOK_REJECTED`; 413 `PAYLOAD_TOO_LARGE`; 415 `UNSUPPORTED_MEDIA_TYPE`; 429 `RATE_LIMITED`; 503 `DEPENDENCY_UNAVAILABLE`; 500 `INTERNAL_ERROR`. No response distinguishes bad secret, stale timestamp, unknown key, or digest mismatch. |

## Request/Response Contracts (Zod 4 schemas)

Runtime Zod 4 schemas are the source for TypeScript types, Hono validation, OpenAPI, tests, event validation, and database JSON validation. All objects are strict; unknown keys fail unless a named provider contract explicitly preserves an opaque signed subobject after verification. Database/provider/generated types are parsed and mapped rather than asserted.

### Common Wire Types

```ts
type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

type ApiError = {
  code: string; // ^[A-Z][A-Z0-9_]{0,63}$
  message: string; // 1..500 safe, localizable Unicode characters
  requestId: string; // UUID
  details: Readonly<Record<string, JsonValue>>; // always present
};

type FieldViolation = {
  path: string; // JSON Pointer, 1..256 characters
  code: string; // stable lowercase constraint code, 1..64 characters
  message: string; // safe/localizable, 1..300 characters
};
```

The locked four-field `ApiError` wire contract takes precedence over a generic RFC 9457 envelope: top-level `type`, `title`, `status`, `detail`, `instance`, `error`, and `timestamp` are prohibited. `details` permits at most 16 keys, four levels, and 8 KiB serialized. HTTP status remains on the response line. Every failure returns `Content-Type: application/json`, `X-Request-Id`, `Cache-Control: no-store`, and the endpoint's rate headers when limited.

### Error Detail Schemas

| Code                     |        HTTP | Exact `details` schema and disclosure                                                                                                                                                                                                                                          |
| ------------------------ | ----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `INVALID_REQUEST`        |         400 | `{ violations?: FieldViolation[] }`; maximum 50; malformed JSON may use `{}` because no safe field path exists                                                                                                                                                                 |
| `UNAUTHENTICATED`        |         401 | `{ recoveryAction: 'reauthenticate' }`; no session/provider detail                                                                                                                                                                                                             |
| `STEP_UP_REQUIRED`       |         401 | `{ recoveryAction: 'step_up', allowedMethods: string[] }`; `allowedMethods` is the configured allowlisted MFA method ids (the BE01a method registry, launch value `['totp']`), never derived from the caller's enrolment; no factor, provider, or policy detail; routing below |
| `FORBIDDEN`              |         403 | `{ reasonCode: string, recoveryAction?: string }`; no capability graph, resource existence, or policy predicate                                                                                                                                                                |
| `NOT_FOUND`              |         404 | `{}` unless a public resource type is safe; concealed authorization denial is indistinguishable from absence                                                                                                                                                                   |
| `CONFLICT`               |         409 | `{ conflict: 'VERSION_MISMATCH'                                                                                                                                                                                                                                                | 'IDEMPOTENCY_MISMATCH' | 'INVALID_TRANSITION', expectedVersion?: string, currentVersion?: string, recoveryAction: string }`; versions only when disclosure is authorized |
| `PAYLOAD_TOO_LARGE`      |         413 | `{ maxBytes: number }` only when the maximum is safe for the caller and route                                                                                                                                                                                                  |
| `UNSUPPORTED_MEDIA_TYPE` |         415 | `{ allowedMediaTypes: string[] }`; only the route allowlist                                                                                                                                                                                                                    |
| `VALIDATION_FAILED`      |         422 | `{ violations: FieldViolation[] }`; one row per `(field x constraint)` failure                                                                                                                                                                                                 |
| `RATE_LIMITED`           |         429 | `{ retryAfterSeconds: number, limit: number, resetAt: string }`; matches `Retry-After` and `RateLimit-*` headers                                                                                                                                                               |
| `WEBHOOK_REJECTED`       |         401 | `{}`; one response for missing/unknown/bad/stale signature states                                                                                                                                                                                                              |
| `DEPENDENCY_UNAVAILABLE` | 502/503/504 | `{ dependencyClass: string, retryable: true, retryAfterSeconds?: number }`; no provider name/payload unless public contract admits it                                                                                                                                          |
| `INTERNAL_ERROR`         |         500 | `{}` only                                                                                                                                                                                                                                                                      |

### STEP_UP_REQUIRED Recovery Routing

DEC-111 makes this response the only trigger for the step-up page, for every shard.

- **Wire shape**: always HTTP 401 with `recoveryAction: 'step_up'` and `allowedMethods` equal to the configured allowlisted method ids. A missing, stale, future-dated, or non-`aal2` proof is never 403. The check runs at middleware step 7, before idempotency reservation, so the response creates no idempotency, audit, or domain state.
- **Browser routing**: the first-party browser navigates to `/step-up?returnTo=<current relative path>`, where the value is the page path plus query on which the command was attempted. It must satisfy the same relative first-party rule as every auth `returnTo` (1–512 characters, no scheme, authority, backslash, control character, or ambiguous encoding) and must not point at `/step-up` or an `/auth/` route; a value that fails the rule, or exceeds 512 characters with its query, falls back to the path without query, then to `/app`.
- **Completion**: BE01a AUTH-API-20/21 verify the factor server-side and rotate the first-party session to `aal2`; the browser then returns to the validated `returnTo`. The interrupted command is never replayed automatically: the originating form restores its scoped draft and the human re-confirms, and because the 401 reserved nothing the draft may reuse its original `Idempotency-Key`.
- **Freshness**: the window is defined once in BE01a (`STEP_UP_FRESHNESS_SECONDS = 600`); this document defines no second value.

### Resource Schemas

```ts
type JobStatus = {
  id: string; // UUID
  type: string;
  state: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  progress: { completed: number; total: number; unit: string } | null;
  resultRef: { type: string; id: string } | null;
  error: { code: string; retryable: boolean } | null;
  createdAt: string; // RFC 3339 UTC
  updatedAt: string; // RFC 3339 UTC
};

type CreateUploadIntentRequest = {
  targetType: string;
  targetId: string;
  purpose: string;
  mediaType: string;
  byteSize: number;
  checksum: { algorithm: 'sha256'; value: string };
};

type UploadIntentResource = {
  id: string;
  object: {
    id: string;
    objectKey: string;
    state: 'pending_upload';
    version: string;
  };
  upload: {
    method: 'PUT';
    signedUrl: string;
    expiresAt: string;
    maxBytes: number;
    allowedMediaTypes: readonly string[];
  };
};

type CompleteUploadIntentRequest = {
  byteSize: number;
  mediaType: string;
  checksum: { algorithm: 'sha256'; value: string };
};

type WebhookAcknowledgement = { received: true };
```

`signedUrl` is returned only once to the authorized caller, never logged, never cached, and never exposed through list/detail reads. `JobStatus.error` never contains provider text, stack, SQL, evidence, media metadata, or private content. A terminal `failed` job uses an owning-domain or platform registered error code; `retryable` describes safe replay, not permission to bypass current authorization.

### Normative Zod 4 wire schemas

The TypeScript shapes above are paired with these runtime schemas; the named schemas are the response contracts used by the route registry. They are strict, reject unknown keys, and normalize only through the documented request canonicalizer.

```ts
const Uuid = z.string().uuid();
const PositiveVersion = z
  .string()
  .regex(/^[1-9][0-9]{0,18}$/)
  .refine(
    (value) => BigInt(value) <= 9223372036854775807n,
    'version_out_of_range',
  );
const Code = z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/);
const JsonValue = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(JsonValue),
    z.record(z.string(), JsonValue),
  ]),
);
const ApiErrorSchema = z.strictObject({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
  message: z.string().min(1).max(500),
  requestId: Uuid,
  details: z.record(z.string(), JsonValue),
});
const JobStatus = z.strictObject({
  id: Uuid,
  type: Code,
  state: z.enum(['queued', 'running', 'succeeded', 'failed', 'cancelled']),
  progress: z
    .strictObject({
      completed: z.number().int().nonnegative().safe(),
      total: z.number().int().positive().safe(),
      unit: Code,
    })
    .nullable(),
  resultRef: z.strictObject({ type: Code, id: Uuid }).nullable(),
  error: z
    .strictObject({
      code: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
      retryable: z.boolean(),
    })
    .nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
const CreateUploadIntentRequest = z.strictObject({
  targetType: Code,
  targetId: Uuid,
  purpose: Code,
  mediaType: z.string().regex(/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/),
  byteSize: z.number().int().nonnegative().safe(),
  checksum: z.strictObject({
    algorithm: z.literal('sha256'),
    value: z.string().regex(/^[a-f0-9]{64}$/),
  }),
});
const UploadIntentResource = z.strictObject({
  id: Uuid,
  object: z.strictObject({
    id: Uuid,
    objectKey: z.string().min(1).max(1024),
    state: z.literal('pending_upload'),
    version: PositiveVersion,
  }),
  upload: z.strictObject({
    method: z.literal('PUT'),
    signedUrl: z.url(),
    expiresAt: z.iso.datetime({ offset: true }),
    maxBytes: z.number().int().positive().safe(),
    allowedMediaTypes: z.array(z.string().min(1).max(128)).min(1).max(64),
  }),
});
const CompleteUploadIntentRequest = z.strictObject({
  byteSize: z.number().int().nonnegative().safe(),
  mediaType: z.string().regex(/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/),
  checksum: z.strictObject({
    algorithm: z.literal('sha256'),
    value: z.string().regex(/^[a-f0-9]{64}$/),
  }),
});
const WebhookAcknowledgement = z.strictObject({ received: z.literal(true) });
```

## Database Schema

### Schema and Access Boundary

All eight records live in a non-exposed `platform_private` PostgreSQL schema; `AuditEvent` may be physically separated into `audit_private` without changing this contract. Neither schema is added to Supabase Data API exposed schemas. Browser roles receive no table grants. Hono uses narrowly granted, migration-owned `security invoker` RPCs and purpose-built `security_invoker` views in an allowlisted API schema. Any exceptional `security definer` function lives outside exposed schemas, uses an empty fixed `search_path`, fully qualifies every object, revokes `PUBLIC` execution, grants only named roles, validates current identity/acting context itself, and has positive and negative authorization tests.

RLS is enabled and forced on every mutable/private table even when it is not exposed. `anon` has no privileges. `authenticated` may access only named views/RPCs whose policies repeat the ownership predicate. The server/service credential is not treated as authorization: Hono resolves identity, acting party, and capabilities first, and RPCs revalidate them. Direct service-role maintenance is limited to named runbooks and emits append-only audit evidence.

### Complete Table Definitions

| Table / model                                                | Columns and exact database constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | State and immutability                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `platform_private.idempotency_records` / `IdempotencyRecord` | `id uuid PK default gen_random_uuid()`; `actor_id uuid not null`; `operation text not null check length 1..128`; `key_hash bytea not null check octet_length=32`; `request_hash bytea not null check octet_length=32`; `state idempotency_state not null`; `response_ref jsonb null` validated as `{status, resourceRef?, jobRef?, safeHeaders?}`; `created_at timestamptz not null default now()`; `expires_at timestamptz not null check expires_at > created_at`; unique `(actor_id, operation, key_hash)`                                                                                                                                                                                                                                                    | `reserved -> completed` or `reserved -> failed_retryable`. `request_hash` never changes. `completed` stores the replayable authoritative result, including registered 4xx outcomes; ordinary expiry is 30 days.                                                                                                                                  |
| `platform_private.outbox_events` / `OutboxEvent`             | IA fields: `id uuid PK`; `event_type text not null`; `schema_version integer not null check >0`; `aggregate_type text not null`; `aggregate_id uuid not null`; `aggregate_version bigint not null check >0`; `correlation_id uuid not null`; `causation_id uuid null`; `payload jsonb not null`; `occurred_at timestamptz not null default now()`; `dispatched_at timestamptz null`. Transport metadata required by the architecture lease: `dispatch_attempt_count integer not null default 0 check >=0`; `dispatch_lease_token uuid null`; `dispatch_lease_until timestamptz null`; `last_dispatch_error_code text null`                                                                                                                                       | Event identity/type/version/aggregate/payload is immutable. Claim RPC CAS-sets lease token/expiry and increments attempts; finalization may set `dispatched_at` once only when token matches. A crash expires the lease. These columns are transport metadata on the same IA record, not a ninth entity. Retention cannot rewrite event content. |
| `platform_private.jobs` / `Job`                              | IA fields plus lossless correlation/evidence: `id uuid PK`; `job_type text not null`; `actor_id uuid not null`; `acting_party_id uuid not null`; `state job_state not null`; `progress jsonb null` matching `completed >=0`, `total >0`, `completed <= total`, non-empty unit; `attempt_count integer not null default 0 check >=0`; `lease_until timestamptz null`; `result_ref jsonb null`; `error_code text null`; `created_at timestamptz not null default now()`; `updated_at timestamptz not null default now()`; `version bigint not null default 1 check >0`; `correlation_id uuid not null`; `causation_id uuid null`; `originating_event_id uuid not null`; `attempts jsonb not null default '[]'` validated as at most 32 sanitized attempt summaries | `queued -> running -> succeeded                                                                                                                                                                                                                                                                                                                  | failed    | cancelled`; a registered retryable failure returns `running -> queued`; terminal states cannot reopen. Lease acquisition/renewal/completion is CAS on version. Terminal result/error is immutable. Attempt summaries contain attempt number/timestamps/outcome/error code only—no payload/PII. |
| `platform_private.webhook_receipts` / `WebhookReceipt`       | `id uuid PK`; `provider text not null`; `external_event_id text not null`; `payload_digest bytea not null check octet_length=32`; `signature_verified_at timestamptz null`; `received_at timestamptz not null default now()`; `state webhook_receipt_state not null`; `operation_id uuid null FK provider_operations(id)`; `attempts jsonb not null default '[]'` with at most 32 sanitized summaries; unique `(provider, external_event_id)`                                                                                                                                                                                                                                                                                                                    | Raw protected payload is not stored here or in Queue. `received -> accepted                                                                                                                                                                                                                                                                      | duplicate | rejected`; only `accepted -> processed                                                                                                                                                                                                                                                         | failed`. Signature verification is required for accepted; duplicate/rejected are terminal. Same provider/event ID with a different digest is rejected, raises a security signal, and enters manual integration review without work.              |
| `platform_private.provider_operations` / `ProviderOperation` | `id uuid PK`; `provider text not null`; `operation_type text not null`; `actor_id uuid not null`; `state provider_operation_state not null`; `intent_hash bytea not null check octet_length=32`; `provider_ref text null`; `last_attempt_at timestamptz null`; `reconciliation_at timestamptz null`; `version bigint not null default 1 check >0`; `created_at timestamptz not null default now()`; `correlation_id uuid not null`; `causation_id uuid null`; `provider_idempotency_key_hash bytea not null check octet_length=32`; `attempts jsonb not null default '[]'` with at most 32 sanitized summaries                                                                                                                                                   | `planned -> pending -> confirmed                                                                                                                                                                                                                                                                                                                 | failed    | manual_review`. Intent/idempotency hashes are immutable. State changes CAS version. Ambiguous send remains pending; reconciliation resolves once. Provider reference is evidence, never canonical identity.                                                                                    |
| `platform_private.object_records` / `ObjectRecord`           | `id uuid PK`; `bucket text not null`; `object_key text not null`; `owner_party_id uuid not null`; `purpose text not null`; `media_type text not null`; `byte_size bigint not null check >=0`; `checksum bytea not null check octet_length=32`; `state object_state not null`; `retention_class text not null`; `version bigint not null default 1 check >0`; `created_at timestamptz not null default now()` as the required creation timestamp; unique `(bucket, object_key)`                                                                                                                                                                                                                                                                                   | `pending_upload -> uploaded -> verifying -> ready                                                                                                                                                                                                                                                                                                | rejected  | quarantined`; only `ready` is consumable. Key, owner, purpose, and intended checksum are immutable after signing. State/version uses compare-and-swap.                                                                                                                                         |
| `platform_private.upload_intents` / `UploadIntent`           | `id uuid PK`; `object_id uuid not null FK object_records(id)`; `actor_id uuid not null`; `max_bytes bigint not null check >0`; `allowed_media_types text[] not null check cardinality >0`; `expires_at timestamptz not null`; `state upload_intent_state not null`; a creation RPC rejects `expires_at > transaction_timestamp() + interval '15 minutes'`                                                                                                                                                                                                                                                                                                                                                                                                        | `issued -> consumed                                                                                                                                                                                                                                                                                                                              | expired   | cancelled`; all three terminal. At most one live `issued`intent per object.`expires_at` is the IA-declared timestamp and cannot authorize at or after expiry.                                                                                                                                  |
| `audit_private.audit_events` / `AuditEvent`                  | `id uuid PK`; `action text not null`; `actor_id uuid null`; `acting_party_id uuid not null`; `target_type text not null`; `target_id uuid not null`; `decision audit_decision not null`; `reason_code text not null`; `correlation_id uuid not null`; `occurred_at timestamptz not null default now()`                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Append-only. `decision` is `allowed                                                                                                                                                                                                                                                                                                              | denied    | completed                                                                                                                                                                                                                                                                                      | failed`. `actor_id`may be null only for a registered system principal represented by`acting_party_id`. `UPDATE`and`DELETE` are revoked from application and maintenance roles; retention/disposition requires a separately audited legal policy. |

`created_at` on `ProviderOperation` and `ObjectRecord` is the creation timestamp required by the IA typed-field registry; it does not add a lifecycle transition or mutable business field. `UploadIntent.expires_at`, `WebhookReceipt.received_at`, and `AuditEvent.occurred_at` are their declared occurrence timestamps.

### Index Inventory

| Table                 | Required indexes beyond the primary key                                                                                                                         | Purpose                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `idempotency_records` | unique `(actor_id, operation, key_hash)`; `(expires_at)`; partial `(state, expires_at) where state <> 'completed'`                                              | Atomic reservation/replay, retention, stuck reservations             |
| `outbox_events`       | partial `(dispatch_lease_until, occurred_at, id) where dispatched_at is null`; `(aggregate_type, aggregate_id, aggregate_version)`; `(correlation_id)`          | Expired/unclaimed lease sweep, aggregate dedupe, trace lookup        |
| `jobs`                | `(actor_id, created_at desc, id)`; `(acting_party_id, created_at desc, id)`; partial `(lease_until, id) where state='running'`; `(job_type, state, created_at)` | Authorized status reads, expired lease recovery, operations queues   |
| `webhook_receipts`    | unique `(provider, external_event_id)`; `(operation_id, received_at)`; `(provider, state, received_at)`                                                         | Dedupe, reconciliation evidence, failed receipt work                 |
| `provider_operations` | unique `(provider, operation_type, provider_ref) where provider_ref is not null`; `(state, last_attempt_at)`; `(actor_id, created_at desc)`                     | Reconciliation, due work, actor evidence                             |
| `object_records`      | unique `(bucket, object_key)`; `(owner_party_id, purpose, state)`; `(retention_class, state)`; `(checksum) where state in ('uploaded','verifying','ready')`     | Ownership/RLS, lifecycle reconciliation, retention, integrity lookup |
| `upload_intents`      | partial unique `(object_id) where state='issued'`; `(actor_id, expires_at)`; `(expires_at) where state='issued'`                                                | Single live authorization, actor quota, expiry sweep                 |
| `audit_events`        | `(target_type, target_id, occurred_at desc, id)`; `(actor_id, occurred_at desc, id)`; `(acting_party_id, occurred_at desc, id)`; `(correlation_id)`             | Evidence reconstruction without mutable secondary truth              |

### Permission and RLS Matrix

| Model              | Anonymous                                                                         | Authenticated/acting party                                                                      | Operator                                                                       | Queue/schedule                                                                                     | Webhook handler                                          | Maintenance/service path                       |
| ------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| Idempotency        | deny                                                                              | no direct table; command RPC may reserve/read its own actor+operation binding                   | same RPC under explicit operation capability                                   | named consumer may read binding for its event/job only                                             | deny                                                     | expiry job deletes only eligible rows; audited |
| Outbox             | deny                                                                              | no direct read/write; domain transaction RPC inserts                                            | no general access                                                              | dispatcher leases undispatched rows and sets `dispatched_at` once; consumer cannot rewrite payload | accepted webhook transaction may insert its event        | retention/sweep RPC only                       |
| Job                | deny                                                                              | security-invoker status projection where actor matches or resolved party owns job               | `jobs.read:any` after step-up/reason; mutations still via registered RPC       | lease/update only named job type with expected version                                             | deny                                                     | runbook repair/replay through named RPC        |
| Webhook receipt    | deny                                                                              | deny                                                                                            | protected integration evidence read with explicit capability/reason            | named webhook consumer updates accepted receipt to processed/failed                                | insert/dedupe after valid signature; no broad SELECT     | runbook reconciliation only                    |
| Provider operation | deny                                                                              | owning domain projection only; no provider secrets/raw payload                                  | protected integration capability and reason                                    | named provider consumer/reconciler CAS-updates registered operation types                          | may attach a verified receipt through reconciliation RPC | runbook reconciliation only                    |
| Object record      | public access only through separately approved public projection; base table deny | metadata projection if current actor/party may access target; bytes authorized separately       | explicit object capability, step-up for protected destructive actions          | verifier/reconciler updates state/version only                                                     | deny                                                     | quarantine/retention runbook only              |
| Upload intent      | deny                                                                              | create/read only through API RPC for same actor and authorized target; signed URL returned once | no blanket override                                                            | expiry/reconciliation consumer changes terminal state                                              | deny                                                     | cancel/expire runbook RPC only                 |
| Audit event        | deny                                                                              | no ordinary access                                                                              | explicit evidence capability, purpose/reason, bounded projection, audited read | append named attempt/decision events only                                                          | append verified receipt decision only                    | append allowed; update/delete always denied    |

Policy tests cover anonymous, correct owner, wrong valid user, wrong party, forged party ID, revoked mandate, expired session, stale version, step-up absent/expired, service credential misuse, and over-disclosure. Views use `security_invoker = true`. Exposed-schema grants and RLS are both required; one never substitutes for the other.

## Middleware & Policies

### Hono Middleware Order

The order is executable contract, outermost to innermost:

1. **Route inventory and request context:** match the registered route; accept a valid UUID `X-Request-Id` or replace it; start correlation/trace context; never trust client correlation as authority.
2. **Security/transport:** TLS edge, exact method, CORS allowlist, security headers, body/URL/header size ceilings, content type, and request deadline. Cookie-authenticated mutations enforce same-origin plus session-bound CSRF. `OPTIONS` exposes only registered methods/headers.
3. **Webhook raw branch:** INF-API-04 rate/size gates, raw-byte signature and replay-window validation occur before JSON parsing, session middleware, or trusted receipt creation.
4. **Authentication:** verify Supabase session server-side. User ID/request actor fields are ignored and rejected where schemas do not declare them. Auth ambiguity fails closed.
5. **Acting-context resolution:** consume the Shard 01 identity contract; derive eligible acting party and current authority server-side. User-editable JWT metadata never grants capability.
6. **Boundary validation:** strict Zod validation of path/query/headers/body and normalized field values. This occurs before resource authorization so handlers never receive malformed input.
7. **Authorization:** evaluate route capability, ownership/relationship/mandate/NDA/visibility, step-up freshness, target policy, and domain quota; then rely on matching RLS/RPC checks as defense in depth.
8. **Concurrency and idempotency:** parse exact quoted `If-Match`; hash normalized request and idempotency key; reserve/replay atomically with the domain mutation. No application-side multi-call transaction approximation.
9. **Use case / transaction:** domain service invokes a single transaction/RPC for canonical state, audit, idempotency result, job, and outbox. Provider calls and object transfer never occur inside this transaction.
10. **Response normalization:** validate success output, apply ETag/Location/cache/rate headers, map typed errors to the exact four-field envelope, and suppress internals.
11. **Observability completion:** outer boundary records one sanitized completion/failure event and closes spans. It does not double-log a failure already owned by an adapter/consumer boundary.

### Principal Authorization Matrix

`Allow` still requires the predicate shown; `Deny` is tested and contains no automatic escalation.

| Principal                    | Job status                                                       | Create upload intent                                                              | Complete upload                                                      | Provider webhook                                                                                    | Internal consumer/RPC                                                                                    |
| ---------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Anonymous browser            | Deny; 401 before lookup                                          | Deny; 401                                                                         | Deny; 401                                                            | Deny as human; only signed provider branch                                                          | Deny                                                                                                     |
| Authenticated user           | Allow only `job.actor_id = userId`; otherwise concealed 404      | Allow only target policy owned/eligible for user and resolved party               | Allow only same live intent actor plus current target authority      | Deny                                                                                                | Deny                                                                                                     |
| Acting-party principal       | Allow when `job.acting_party_id = actingPartyId` and `jobs.read` | Allow when target belongs/is delegated to party and purpose capability is current | Same party, intent, target, capability, and exact object version     | Deny                                                                                                | Deny                                                                                                     |
| Internal capability operator | Allow with recent step-up, `jobs.read:any`, reason, and audit    | Only a separately registered target capability; no general upload bypass          | Only separately registered capability; no automatic ownership bypass | Deny                                                                                                | Only named operational RPC/consumer capability                                                           |
| Queue/schedule principal     | No HTTP read                                                     | Deny                                                                              | Deny                                                                 | Deny                                                                                                | Allow only registered event/job type, least-privilege credential, lease, current canonical state/version |
| Provider webhook principal   | Deny                                                             | Deny                                                                              | Deny                                                                 | Allow only registered endpoint, valid raw signature, in-window timestamp, and post-signature schema | May create accepted receipt/outbox through one narrow transaction; no other RPC                          |
| Deployment principal         | Deny                                                             | Deny                                                                              | Deny                                                                 | Deny                                                                                                | Migrations/config/promotion only; cannot mutate business data outside migration/runbook contracts        |
| Service/maintenance role     | No ordinary endpoint                                             | No ordinary endpoint                                                              | No ordinary endpoint                                                 | Deny                                                                                                | Named runbook/RPC only; isolated, logged, reviewed, BOLA-tested; never browser-exposed                   |

### Route Archetype Inheritance

Every downstream route cites exactly one archetype and fills every registration cell:

- **Public read:** public projection only, allowlist cache, public-read rate 120/min/IP with burst 30/10s, Tier 1 or explicitly registered public tier, no authority from session headers.
- **Authenticated read:** session plus current acting context/RLS, `no-store`, 300/min/user and 600/min/party, exact 8s deadline.
- **Ordinary command:** boundary validation, capability/RLS, idempotency where retryable, exact version for mutable targets, 60/min/user and 120/min/party, exact 15s deadline, atomic audit/outbox.
- **High-risk/admin command:** ordinary command plus recent step-up, named capability, 10/min/user (admin command 10/min/user), reason and allow/deny audit, explicit disclosure policy.
- **Async acceptance:** ordinary command plus registered job/event/consumer/runbook; commit and return resource/status within 2s; never keep the request open for provider or long work.

Domain specs may tighten rate, timeout, disclosure, or authority. They may not weaken these defaults without changing the originating architecture decision.

### Per-operation middleware, error envelope, limits, telemetry, and test matrix

Every row below is keyed to the authoritative operation ID. Route Registry cells remain the single source for exact route-specific auth, rate, idempotency, and success/error status values; this matrix adds the boundary execution policy and makes each operation explicit.

| Operation ID | Auth and ownership                                                                                                                                                                                                     | Rate limit                                                                                                                                                                           | Input validation                                                                                                                                                                                                                                             | CORS policy                                                                                                                  | Global error envelope                                                                                                                                   | Error and retry guidance                                                                                                                                                                                                                                                                                          | Pagination and limits                                                                                                                       | Idempotency and concurrency                                                                                                                                                                           | Observability                                                                                                                                                              | Test oracle                                                                                                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INF-API-01   | The authoritative Route Registry INF-API-01 auth and ownership predicate applies; actor and acting party are server-derived; known visible target without capability is 403 and concealed or unreadable target is 404. | The authoritative Route Registry INF-API-01 bucket applies; emit RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset and Retry-After on 429; caller input cannot widen the bucket. | Strict Zod 4 request schema for INF-API-01 runs at the Hono boundary before authorization and RPC; unknown keys, malformed path, query, header or body are rejected; signed raw bytes are verified before parsing where this operation has a webhook branch. | CORS policy first-party-auth allowlist; credentials only for same-site; wildcard and reflected origins denied; Vary: Origin. | BE00 ApiError { code, message, requestId, details }; code is the application enum, message is safe and localizable, and details is a bounded allowlist. | Operation-declared HTTP statuses and application codes remain authoritative; 4xx is not auto-retried, 429 honors Retry-After, and 502/503/504 retry at most twice after 250 ms and 750 ms with the same idempotency binding after status reconciliation; unknown mutation outcome stays pending or manual review. | Not a list endpoint; pagination parameters are rejected and the operation returns one bounded resource, job, redirect, or fixed projection. | The authoritative Route Registry INF-API-01 idempotency and CAS rule applies; mutation replay requires the same normalized request and expected version, while reads perform no mutation reservation. | Emit requestId, operationId, status, duration, rate, authorization, conflict, idempotency and retry outcomes; retain IDs or hashes only and never request payloads or PII. | Contract, authz, RLS, 403/404, rate, replay, conflict, timeout and redaction tests are required for INF-API-01; assert exact ApiError envelope and no unauthorized side effect. |
| INF-API-02   | The authoritative Route Registry INF-API-02 auth and ownership predicate applies; actor and acting party are server-derived; known visible target without capability is 403 and concealed or unreadable target is 404. | The authoritative Route Registry INF-API-02 bucket applies; emit RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset and Retry-After on 429; caller input cannot widen the bucket. | Strict Zod 4 request schema for INF-API-02 runs at the Hono boundary before authorization and RPC; unknown keys, malformed path, query, header or body are rejected; signed raw bytes are verified before parsing where this operation has a webhook branch. | CORS policy first-party-auth allowlist; credentials only for same-site; wildcard and reflected origins denied; Vary: Origin. | BE00 ApiError { code, message, requestId, details }; code is the application enum, message is safe and localizable, and details is a bounded allowlist. | Operation-declared HTTP statuses and application codes remain authoritative; 4xx is not auto-retried, 429 honors Retry-After, and 502/503/504 retry at most twice after 250 ms and 750 ms with the same idempotency binding after status reconciliation; unknown mutation outcome stays pending or manual review. | Not a list endpoint; pagination parameters are rejected and the operation returns one bounded resource, job, redirect, or fixed projection. | The authoritative Route Registry INF-API-02 idempotency and CAS rule applies; mutation replay requires the same normalized request and expected version, while reads perform no mutation reservation. | Emit requestId, operationId, status, duration, rate, authorization, conflict, idempotency and retry outcomes; retain IDs or hashes only and never request payloads or PII. | Contract, authz, RLS, 403/404, rate, replay, conflict, timeout and redaction tests are required for INF-API-02; assert exact ApiError envelope and no unauthorized side effect. |
| INF-API-03   | The authoritative Route Registry INF-API-03 auth and ownership predicate applies; actor and acting party are server-derived; known visible target without capability is 403 and concealed or unreadable target is 404. | The authoritative Route Registry INF-API-03 bucket applies; emit RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset and Retry-After on 429; caller input cannot widen the bucket. | Strict Zod 4 request schema for INF-API-03 runs at the Hono boundary before authorization and RPC; unknown keys, malformed path, query, header or body are rejected; signed raw bytes are verified before parsing where this operation has a webhook branch. | CORS policy first-party-auth allowlist; credentials only for same-site; wildcard and reflected origins denied; Vary: Origin. | BE00 ApiError { code, message, requestId, details }; code is the application enum, message is safe and localizable, and details is a bounded allowlist. | Operation-declared HTTP statuses and application codes remain authoritative; 4xx is not auto-retried, 429 honors Retry-After, and 502/503/504 retry at most twice after 250 ms and 750 ms with the same idempotency binding after status reconciliation; unknown mutation outcome stays pending or manual review. | Not a list endpoint; pagination parameters are rejected and the operation returns one bounded resource, job, redirect, or fixed projection. | The authoritative Route Registry INF-API-03 idempotency and CAS rule applies; mutation replay requires the same normalized request and expected version, while reads perform no mutation reservation. | Emit requestId, operationId, status, duration, rate, authorization, conflict, idempotency and retry outcomes; retain IDs or hashes only and never request payloads or PII. | Contract, authz, RLS, 403/404, rate, replay, conflict, timeout and redaction tests are required for INF-API-03; assert exact ApiError envelope and no unauthorized side effect. |
| INF-API-04   | The authoritative Route Registry INF-API-04 auth and ownership predicate applies; actor and acting party are server-derived; known visible target without capability is 403 and concealed or unreadable target is 404. | The authoritative Route Registry INF-API-04 bucket applies; emit RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset and Retry-After on 429; caller input cannot widen the bucket. | Strict Zod 4 request schema for INF-API-04 runs at the Hono boundary before authorization and RPC; unknown keys, malformed path, query, header or body are rejected; signed raw bytes are verified before parsing where this operation has a webhook branch. | CORS policy non-browser service; browser origins denied; signed provider principal only.                                     | BE00 ApiError { code, message, requestId, details }; code is the application enum, message is safe and localizable, and details is a bounded allowlist. | Operation-declared HTTP statuses and application codes remain authoritative; 4xx is not auto-retried, 429 honors Retry-After, and 502/503/504 retry at most twice after 250 ms and 750 ms with the same idempotency binding after status reconciliation; unknown mutation outcome stays pending or manual review. | Not a list endpoint; pagination parameters are rejected and the operation returns one bounded resource, job, redirect, or fixed projection. | The authoritative Route Registry INF-API-04 idempotency and CAS rule applies; mutation replay requires the same normalized request and expected version, while reads perform no mutation reservation. | Emit requestId, operationId, status, duration, rate, authorization, conflict, idempotency and retry outcomes; retain IDs or hashes only and never request payloads or PII. | Contract, authz, RLS, 403/404, rate, replay, conflict, timeout and redaction tests are required for INF-API-04; assert exact ApiError envelope and no unauthorized side effect. |

## Data Flow

### Protected Command Transaction

1. Middleware produces validated input and server-derived `RequestContext`.
2. One PostgreSQL RPC revalidates identity/acting context, target authority, current version, and idempotency binding.
3. A new binding reserves `IdempotencyRecord`; a matching completed binding returns its original safe status/resource/job; a different request hash returns 409 without mutation.
4. The same transaction writes canonical domain state, one or more `AuditEvent` rows, zero/one `Job`, one or more immutable `OutboxEvent` rows, and the idempotency result.
5. Commit failure returns no success and produces no provider/object effect. Commit success returns the authoritative resource or job status.
6. The Worker immediately attempts to dispatch returned outbox IDs through the Queue binding; failure leaves them undispatched. A scheduled sweeper leases and retries undispatched rows, preventing a request/Queue dual-write gap.
7. Queue consumers validate the minimal envelope, acquire their registered lease/idempotency boundary, re-read canonical state/version, and then execute. Queue acknowledgement removes transport only; canonical job/outbox/audit evidence remains.

### Upload Lifecycle

1. INF-API-02 authorizes target/purpose, enforces actor/party quota and version, creates one `ObjectRecord(pending_upload)` plus `UploadIntent(issued)`, and returns a single 15-minute signed URL.
2. Client uploads directly to the one server-generated normalized Storage key. A 30-second no-byte interval aborts client transfer; any byte resets the inactivity timer. Transfer progress is not canonical completion.
3. INF-API-03 revalidates actor/party/target/intent/expiry/version, records provider-observed metadata, advances object to `uploaded`, consumes intent, creates verification job/outbox, and returns 202.
4. Verifier re-reads metadata and bytes, checks size, MIME allowlist, SHA-256, scan/target policy, and expected version; it advances `uploaded -> verifying -> ready|rejected|quarantined` with CAS.
5. Only `ready` may be referenced or signed for consumption. Orphan/mismatched bytes are quarantined or removed under retention. Incomplete uploads expire after 24 hours unless an active job/intent governs them.

### Webhook and Provider Effect

| Seam ID                                 | Exact request contract                                                                                                                                                                                          | Exact response contract                                                                                                                                                                                        |                                               Timeout | Retry / backoff                                                                                                                                        | Circuit breaker and open-state recovery                                                                                                                                                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PLAT-SEAM-01` provider adapter effect  | `{ operationId: uuid, provider: registered_provider, idempotencyKey: string(8..128), payloadDigest: sha256, payload: ProviderEffectPayload }`; payload contains only the provider allowlist and is never logged | `{ providerOperationId: string, accepted: boolean, status: 'accepted'                                                                                                                                          |                                            'rejected' | 'pending', externalEventId: string                                                                                                                     | null }`                                                                                                                                                                                                                                     | 15,000 ms | At most 2 retries at 250 ms and 750 ms, only before evidence of provider acceptance and always with the same provider idempotency key; an ambiguous send remains `pending` and is reconciled, never blindly retried | Five consecutive retryable adapter failures open the provider circuit for 60,000 ms; open calls return typed `DEPENDENCY_UNAVAILABLE`, half-open permits one probe, and a successful probe closes the circuit while an ambiguous probe keeps it open. |
| `PLAT-SEAM-02` signed webhook processor | `{ provider: registered_provider, rawBody: bytes, signature: string, timestamp: int, contentType: 'application/json' }`; raw bytes are verified before parsing and bounded by the provider registry             | `{ receiptId: uuid, accepted: boolean, duplicate: boolean, eventType: string, schemaVersion: positive_int }`; the HTTP acknowledgement is always the same safe shape for a verified first receipt or duplicate | 2,000 ms acknowledgement; 15,000 ms processor attempt | No HTTP replay after a response; queue processing uses 3 retries at 15,000 ms, 60,000 ms, and 300,000 ms with a receipt lease and DLQ after exhaustion | Five retryable processor failures open the adapter circuit for 60,000 ms; open processing retains the accepted receipt and retries through the sweeper, half-open allows one receipt probe, and invalid signatures never enter the circuit. |

1. INF-API-04 applies provider rate/size gates and verifies timestamp/signature over untouched bytes before parse.
2. After verification, the provider Zod schema extracts external event ID and computes the digest. One transaction deduplicates receipt, stores safe evidence, and emits `webhook.accepted`; invalid signatures create neither trusted receipt nor work.
3. A verified duplicate returns the same 202 acknowledgement and never repeats the effect. Valid but out-of-window signatures receive the same safe rejection as other signature failures.
4. The consumer re-reads the receipt and matching current `ProviderOperation`, validates version, and applies the domain reconciliation exactly once.
5. Outbound provider work begins only after local `ProviderOperation(planned)`, idempotency, audit, and outbox commit. Adapter sends the minimum contract with provider idempotency. Timeout/ambiguous response remains `pending`; only provider idempotency evidence, signed webhook, or bounded poll may confirm it. Five consecutive retryable adapter failures open the provider circuit for 60 seconds.

### Realtime and Offline

Realtime contains only authorized entity/event ID and version hints. It never carries authority, protected payload truth, durable history, or mutation success. Client refetches the canonical endpoint; missed/duplicate/reordered hints are harmless. Offline intents retain only approved temporary input; reconnect sequence is reauthenticate -> resolve acting context -> refresh contract/settings -> submit with idempotency/expected version -> authorize -> commit or explicit conflict. No local intent becomes canonical silently.

## Deterministic Protocol Rules

### Idempotency Canonicalization

- The route registry `operationId`, verified `actor_id`, resolved `acting_party_id`, exact method/path parameters, normalized typed query/body, expected version, target identity, and contract major version form the request-hash input.
- Zod output—not raw JSON—is canonicalized: object keys sort lexicographically; absent optional keys remain absent; strings normalize to Unicode NFC; dates use RFC 3339 UTC; UUIDs lowercase; integers use canonical decimal; non-finite numbers and negative zero are rejected. SHA-256 produces the 32-byte request digest.
- `Idempotency-Key` is the HTTP field value after standard optional-whitespace removal. It must be 8–128 bytes of printable ASCII, is compared byte-for-byte, is never case-folded, and is persisted only as SHA-256. An empty/all-space value is invalid.
- `(actor_id, operation, key_hash)` is the unique serialization point. The row is inserted `reserved`, compared, and completed inside the same PostgreSQL transaction as state/audit/outbox; `reserved` is never committed alone. Concurrent duplicates wait on the unique row and then replay the committed safe response. Transaction rollback leaves no reservation.
- Same key and identical hash returns the original status, resource/job reference, safe headers, and no new effect. Same key and different hash returns 409 `IDEMPOTENCY_MISMATCH`. Ordinary completed bindings retain 30 days; reuse after verified TTL deletion is a new request. Domain specs may require longer retention.
- Only explicitly registered pre-commit transient failures may commit `failed_retryable`; such a row contains no canonical mutation and may be retried with the same key. A provider-ambiguous post-send state is never `failed_retryable`; it returns/replays the pending operation or job.

### Version and ETag Grammar

- PostgreSQL versions are positive `bigint`. HTTP emits a strong ETag containing its lossless decimal value: `ETag: "123"`.
- Required `If-Match` accepts exactly one strong quoted decimal tag in `1..9223372036854775807`. Weak tags, `*`, lists, whitespace inside quotes, signs, leading zeros except `"0"` (which is invalid), overflow, and malformed quotes return 400 `INVALID_REQUEST`.
- A missing required `If-Match` also returns 400 `INVALID_REQUEST`; this project does not add an unapproved 428 code. A well-formed stale tag returns 409 `VERSION_MISMATCH` after the authorized resource is resolved. CAS is executed in the same RPC transaction as mutation/audit/outbox.
- `JobStatus` retains the IA-defined body exactly; the Job database version is carried by ETag, not an added body field. Event versions serialize as decimal strings on JSON boundaries to avoid bigint precision loss.

### Global Input and Collection Limits

- Ordinary JSON request and response bodies are at most 256 KiB each. Synchronous export is prohibited. Provider webhooks may only tighten this ceiling in their registry entry.
- JSON maximum nesting is 16, object keys 256 per object, arrays 1,000 elements, and strings 64 KiB before endpoint-specific limits. Numbers must be finite safe integers unless a schema uses a decimal string. Unknown keys fail.
- Request target is at most 8 KiB; decoded path segment 256 characters; query has at most 50 keys and 100 total values; aggregate request headers are at most 32 KiB. Control characters, invalid UTF-8, and ambiguous Unicode in identifiers are rejected.
- Unbounded collections use opaque authenticated cursors at most 512 characters and `limit` 1–50/default 25. Cursor expires within 24 hours and binds route, normalized filters, sort, deterministic unique tie-breaker, audience, user/acting context, and contract version. Tamper or cross-context reuse returns 400 without disclosing cursor internals.

## Event and Consumer Contracts

### Lossless Event Envelopes

```ts
type PlatformEvent<T extends JsonValue> = {
  eventId: string;
  eventType: string;
  schemaVersion: number;
  occurredAt: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: string; // positive bigint decimal
  correlationId: string;
  causationId: string | null;
  actorId: string | null;
  actingPartyId: string | null;
  payload: T;
};

type QueueEnvelope = {
  eventId: string;
  eventType: string;
  schemaVersion: number;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: string; // required for stale/out-of-order checks
  causationId: string | null;
  correlationId: string;
};
```

`aggregateVersion` is added to the transient envelope because the locked architecture requires the expected entity version and the IA requires stale/out-of-order rejection. The decimal string preserves the IA/PostgreSQL bigint without JavaScript precision loss. Queue envelopes are strict, no more than 8 KiB, and contain no raw PII, request body, object bytes/URLs, provider payload, secret, payment/evidence data, or authority claim.

The authoritative dispatch key is the exact `(eventType, schemaVersion)` pair. Base pairs are `job.requested/1`, `object.uploaded/1`, `provider.operation.requested/1`, and `webhook.accepted/1`; their outbox payloads are respectively `{ jobType, jobId }`, `{ objectId }`, `{ operationId }`, and `{ receiptId }`. An event-type suffix such as a downstream `identity.*.v1` is part of that owning shard's literal name but never substitutes for `schemaVersion`.

### Consumer Registry

Registered immutable-origin Job distinction (`cms.schema.dry_run` only):
the exact original `job.requested/1` envelope identifies the accepted intent,
not current execution CAS. Its `aggregateVersion` stays byte-for-byte unchanged
across queued continuations and expired-lease reclaim. Before a nonterminal
CMS Job enters execution, a protected server reader must verify the whole
original envelope against the genuine stored Job/outbox identity. Only that
verified identity may bypass comparison of origin event version with current
Job version. Current canonical Job reread, restore fence, lease claim and
outcome CAS remain mandatory and use actual server versions/receipts; the
origin verdict grants no current-stage authority. An unverified/refuted origin
creates no claim/effect/outcome/processed write; refutation is effect-free ACK,
while missing/failed/malformed reader or cancellation is retry. Already
terminal Jobs keep effect-free terminal ACK. Other registered Job types retain
existing stale/future event-version rules. This reconciles INF-05 canonical-
state retry with immutable accepted intent; it does not permit replay of stale
commands or mutable entity writes.

All Queue consumers use Cloudflare at-least-once delivery, `max_retries = 3`, explicit per-message acknowledgement, and a configured DLQ. Retry delays are 15s, 60s, and 300s with bounded jitter; a consumer may suppress retry after a deterministic/stale result. Each attempt first persists its sanitized summary and CAS-acquires the canonical lease. It acknowledges only after a durable terminal/next state; unknown schema versions exhaust directly to DLQ/manual review without execution.

| Consumer                    | Event pair / queue                                            | Lease and attempt contract                                                                                                                       | Success / retry / terminal failure                                                                                                                                                                 | SLO, owner, runbook                                                              |
| --------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `platform.job.execute`      | `job.requested/1`; `platform-jobs` -> `platform-jobs-dlq`     | Per-job registry value, default 5m, maximum 14m; heartbeat before one-third lease remains; CAS `Job.version`; max 4 deliveries including initial | Re-read job/aggregate/authority; success writes one immutable result; retryable pre-effect failure returns job to queued; exhausted/non-retryable -> failed; cancelled/terminal/stale -> no-op ack | first attempt p95 <=60s; owner `platform`; job-type runbook required             |
| `platform.object.verify`    | `object.uploaded/1`; `platform-objects` -> DLQ                | 2m lease; CAS object version; bounded byte/metadata verification; no unregistered transform                                                      | ready on exact size/type/checksum/scan; policy failure rejected/quarantined; retry Storage dependency only; never expose before ready                                                              | admission state visible <=60s; owner `platform`; upload-reconciliation runbook   |
| `platform.provider.execute` | `provider.operation.requested/1`; `platform-providers` -> DLQ | 60s lease; provider-specific request deadline <=15s; CAS operation; provider token bucket and circuit                                            | Retry only when adapter proves no effect was accepted; ambiguous send remains pending and is acknowledged for reconciliation; exhausted known failure -> failed/manual_review                      | provider latency/error/circuit SLO; owner integration registry; provider runbook |
| `platform.webhook.process`  | `webhook.accepted/1`; `platform-webhooks` -> DLQ              | 60s lease represented in receipt attempts; dedupe receipt ID and current operation version                                                       | Loads normalized provider-domain record, processes once, accepted -> processed; transient dependency retry; invalid/current-state conflict -> failed/manual review; duplicate/rejected never enter | acknowledgement is HTTP SLO; processing/dead-letter SLO; provider owner/runbook  |

The dispatcher is not a ninth consumer entity. A successful command returns committed outbox IDs and makes an immediate best-effort dispatch. `platform.outbox.sweep` runs on the shortest verified schedule available at setup, claims rows through the lease fields, sends them, and finalizes `dispatched_at` by matching lease token. Duplicate sends remain correct. The normal immediate path enforces outbox undispatched p95 <=2s; oldest age alerts at 2m. Setup must prove the configured schedule plus immediate path; schedule-only operation cannot claim the p95 target.

Terminal attempt summaries retain 30 days in the owning `Job`, `ProviderOperation`, or `WebhookReceipt` JSON field; outbox dispatch evidence remains on `OutboxEvent`. Each summary is strict `{ attempt, startedAt, endedAt, outcome, errorCode, retryable }`, maximum 32 entries. Replay preserves original event/business idempotency and appends a new attempt summary. No attempt detail becomes a ninth canonical entity.

### Webhook Payload Recovery Contract

The generic receipt intentionally stores only dedupe/signature evidence. Before returning 202, every enabled provider adapter must, in the same transaction as `WebhookReceipt(accepted)` and `webhook.accepted`, write a strict, minimal normalized provider event into the owning integration/domain table keyed by `receipt_id`. The raw body exists only in bounded Worker memory through signature verification and normalization, then is discarded. `platform.webhook.process` resolves the adapter by the compile-time provider registry and loads that normalized record by receipt ID. A provider integration cannot be enabled until its normalized-record schema, retention, RLS/grants, signature algorithm/key rotation, replay window/clock skew, byte limit, event-ID extraction, and redaction tests exist. Queue/log storage of raw payload is prohibited.

If the same `(provider, external_event_id)` arrives with a different digest, the endpoint returns the ordinary safe acknowledgement only after valid signature verification, creates no second business effect, emits a Severity-1 security/integration signal, and routes the existing receipt to manual review. Invalid signatures or out-of-window timestamps create no trusted receipt/normalized record/work and return indistinguishable 401 `WEBHOOK_REJECTED`.

### Job-State Reconciliation

The Shard 00 IA enum `queued|running|succeeded|failed|cancelled` is authoritative for the shared wire/database contract. The architecture's broader narrative term `blocked` is not added silently. A block discovered before acceptance returns a domain typed error and creates no job; a block discovered after acceptance becomes `failed` with a registered non-retryable safe error code and domain recovery reference, or remains `queued` only when the registry declares a bounded automatic recovery. Domain specs that require a durable `blocked` state must evolve the originating IA contract first.

## Error Handling

### Boundary Mapping

| Failure boundary                     | Mapping                                                                                     | Retry and partial-state rule                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Hono parse/transport                 | 400 malformed/path/header, 413 body ceiling, 415 media type, 422 semantic validation        | Never enters use case or creates idempotency/audit/domain state except sanitized security telemetry               |
| Supabase Auth/session                | 401 `UNAUTHENTICATED`; step-up 401 `STEP_UP_REQUIRED`                                       | Fail closed before mutation; preserve only safe local input client-side                                           |
| Capability/RLS                       | 403 `FORBIDDEN` or disclosure-safe 404 `NOT_FOUND`                                          | Server and RLS must agree; no partial state; wrong-resource attempt emits sanitized signal                        |
| Unique/version/state/idempotency     | 409 `CONFLICT` with allowlisted safe recovery metadata                                      | Transaction rolls back except same-key replay, which returns original committed outcome                           |
| Rate/quota                           | 429 with matching `Retry-After` and `RateLimit-*`                                           | No command reservation/mutation when rejected at rate boundary                                                    |
| PostgreSQL/Data API/RPC              | 503 `DEPENDENCY_UNAVAILABLE`, or 504 when exact application deadline expires                | Never assert success; ambiguous response after command RPC is reconciled through idempotency/status before retry  |
| Storage                              | 503/504 before accepted completion; after job acceptance, terminal/retryable safe Job error | Object remains non-ready; quarantine/remove mismatch; no signed read                                              |
| Queue/outbox                         | HTTP success remains committed; async status shows queued/running/failed                    | Durable outbox/job retains intent; bounded retry/DLQ; never roll back committed business state                    |
| Provider adapter                     | 502 invalid upstream response; 503 circuit/unavailable; 504 deadline                        | Pre-send safe retry only; ambiguous post-send remains pending and reconciles; never blind resend                  |
| provider-native diagnostics/log sink | No user-visible failure when domain audit is intact                                         | Drop/redact forbidden field; emit independent blind-spot signal where available; business truth remains canonical |
| Audit write                          | Owning command transaction fails and returns typed 500/503                                  | Audit-required command cannot commit canonical mutation without its append-only audit row                         |
| Unknown exception                    | 500 `INTERNAL_ERROR` and `{}` details                                                       | One scrubbed owning-boundary error event; no stack/SQL/provider/policy disclosure                                 |

`DEPENDENCY_UNAVAILABLE` uses 502 when a contacted dependency returns an invalid response, 503 when unavailable/circuit-open/maintenance, and 504 when the registered application deadline is exceeded. Only 429 and retryable 503 include `Retry-After`. Automatic client retry is limited to safe reads and explicitly retryable idempotent work with jitter; an ambiguous mutation first reconciles by idempotency key or job/operation status.

### Failure Cascade and Compensation Matrix

| Dependency/effect       | Failure before commit                                           | Failure after commit                                  | Rollback / compensate / queue / surface                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL transaction  | No state committed                                              | Client may lose response after commit                 | No synthetic rollback; same idempotency key returns result; surface typed dependency/error with request ID                                                                       |
| Outbox -> Queue         | Domain commit remains authoritative                             | Send duplicate or dispatcher crash                    | Lease/sweep and idempotent consumer; duplicate safe; DLQ visible; never delete durable intent to hide failure                                                                    |
| Queue consumer          | No provider/domain effect before lease/current-state validation | Crash after canonical transition                      | CAS/idempotency detects terminal state on replay; retry from canonical state; no state regression                                                                                |
| Supabase Storage        | No intent means no authorized object                            | Bytes may exist without verified metadata             | Object remains unusable; reconcile/quarantine/remove; new signed intent after current authorization                                                                              |
| Provider API            | Local planned intent already exists                             | Timeout may hide accepted provider effect             | Keep pending; reconcile by provider idempotency/webhook/poll; cancel/compensate only through explicit domain command                                                             |
| Webhook                 | Invalid request produces no trusted record                      | Duplicate/conflicting delivery after verified receipt | Dedupe; identical duplicate no effect; different digest security/manual review; domain normalized record is canonical input                                                      |
| Realtime                | No canonical impact                                             | Hint lost/duplicated/out of order                     | Authorized refetch; never compensate from hint                                                                                                                                   |
| Cache/public projection | Canonical state still controls                                  | Stale projection after change                         | Versioned outbox convergence; last-known-good unless security/rights/privacy/takedown requires fail-closed purge                                                                 |
| Migration/deploy        | Gate stops before promotion                                     | Expansion applied but artifact promotion fails        | Old-compatible code remains; forward fix/compensating migration; artifact/config rollback never erases business effects                                                          |
| Recovery evidence       | Writes fenced before unsafe restore                             | Restored DB may precede provider/Queue effects        | Synthetic/local evidence is insufficient for protected production writes; production verification and a new restore epoch fence consumers/provider sends before reopening writes |

## Observability

`@wejammin/observability` is the only application logging port. It emits one NDJSON object with allowlisted fields: timestamp, severity, environment, release, service, route template or consumer, operation, request/correlation/causation/trace IDs, job ID/attempt, actor class, acting-context class, safe entity type/version, outcome, error code, duration, dependency class, and retryability. Direct identifiers are hashed or omitted unless an approved operational purpose exists. Caller-supplied fields cannot replace reserved context.

Forbidden fields are auth/cookie headers, tokens/secrets, raw request/response bodies, emails/phones/addresses, unrestricted IP/user agent, messages/search text, object/media URLs or content, payment/KYC data, legal/safety evidence, private content, and raw provider payload. Structured encoding defeats newline/log-field injection. Redaction tests fail CI when a forbidden sentinel survives.

Structured diagnostics record 100% of unexpected errors and scrubbed high-risk command/job failures; native traces retain 100% high-risk, 10% ordinary authenticated success, and 1% public/cache success. Third-party PII collection and session replay are absent; release/environment fields are immutable; source maps remain private build artifacts and are never uploaded to a monitoring vendor. Provider-native telemetry is diagnostic only and never substitutes for PostgreSQL audit. A telemetry sink failure cannot roll back committed business truth, but an audit append failure must roll back the command.

Per endpoint/consumer, registry-generated metrics cover request/attempt count, duration, outcome/error, rate rejection, DB/RPC timing/conflict, outbox age, Queue depth/age/retry/DLQ, job state/lease, upload bytes/verification, webhook acknowledgement, provider latency/circuit/reconciliation, restore fence, and cost/quota. Critical route SLOs remain visible individually, not only in aggregates.

## Release, Migration, and Recovery

### Promotion Contract

One content-addressed artifact progresses `built -> preview_verified -> staging_verified -> production_approved -> production`. A failed gate transitions the candidate to `rejected`; it is never promoted by relabeling. Environment-scoped deployment identity, artifact digest, contract/OpenAPI diff, tests, security/accessibility scans, build, migration compatibility, registry completeness, SLO/runbook presence, and infrastructure verification are required. Production additionally requires protected human approval of the same digest.

Migrations follow `expand -> backfill -> switch -> contract`, are forward-only, acquire a bounded advisory lock, and remain compatible with the currently deployed artifact until switch is verified. Failure after expansion stops promotion; no destructive rollback migration runs. Artifact/config rollback target is <=30m and cannot erase committed business effects. Exact Cloudflare/Supabase bindings, schedules, limits, buckets, policies, and provider credentials are pinned and exercised during `/setup-workspace` and `/verify-infrastructure`, not assumed by this specification.

### Recovery Fence

Supabase Free provides no PITR and no uptime SLA. Synthetic/local recovery evidence is the only available evidence until production-verified recovery evidence is separately demonstrated. A missing or unverified production recovery record sets the protected-write safety gate closed for money, rights, and publication writes. Restore creates a new environment `restoreEpoch`; Queue consumers, outbox dispatcher, scheduled tasks, and provider adapters refuse external effects until integrity, migration version, RLS policies, RPC grants/functions, idempotency/outbox/job invariants, object metadata, and provider reconciliation checks pass for that epoch.

Reopening order is database integrity -> RLS/RPC negative tests -> idempotency/outbox/job consistency -> object reconciliation -> provider/webhook reconciliation -> cache/public projection checks -> production recovery verification -> protected writes -> async/provider effects. Replay uses current authority/state/version and original event identity. Scheduled maintenance is announced >=48h with truthful scope/status; unplanned downtime counts against the internal 99.9% objective, and no provider uptime SLA is assumed. Required environment-specific runbooks remain a setup/verification gate; absence disables the dependent production capability and does not create an implementation contract in this shard.

## Testing Strategy

### Contract and Handler Tests

- Generated OpenAPI and runtime route registry contain exactly the same method/path, operation ID, request, success, error, auth, rate, cache, timeout, and SLO declarations.
- Every endpoint has success plus every declared 4xx/5xx test through Hono `app.request()` in a Worker-compatible Vitest project. Tests validate status, four-field error schema, exact details allowlist, content/cache/rate/request-ID headers, and absence of forbidden internals.
- Field tests cover every `(field x constraint)` row, unknown keys, malformed JSON, 256 KiB boundary, nesting/key/array/string limits, invalid UTF-8/control characters, UUID, finite number, media type, checksum, and cursor/context tamper cases.
- Idempotency tests prove concurrent same-key/same-body one effect and exact replay, same-key/different-body 409, rollback leaves no reservation, committed-disconnected replay, TTL behavior, and provider-ambiguous no-resend.
- ETag tests cover exact strong tag, missing, weak, wildcard, list, whitespace, leading zero, overflow, stale, concurrent writers, and lossless bigint behavior.

### Authorization and Database Tests

- Each endpoint/table/view/RPC tests anonymous, correct actor, wrong valid actor, correct/wrong acting party, wrong resource, revoked/expired mandate, forged party/JWT metadata, missing/expired step-up, operator reason/capability, machine-principal scope, service-role misuse, and over-disclosure.
- Migrations test every column constraint, enum transition, unique/partial index, FK, CAS/version rule, immutable field, terminal-state prohibition, retention eligibility, audit update/delete revocation, exposed-schema grants, RLS enabled/forced, and security-invoker behavior.
- Every exceptional security-definer function is schema-qualified with empty search path, default execution revoked, named grants only, and positive/negative abuse tests.
- Protected transaction tests prove domain mutation, idempotency, audit, job, and outbox are all-or-nothing; audit failure prevents mutation; outbox repeat is safe.

### Async, Storage, Provider, and Recovery Tests

- Consumer contract tests validate strict envelope/version, bigint string, unknown-version DLQ, stale/out-of-order no regression, duplicate delivery, lease expiry/heartbeat/CAS, retry schedule/max, poison event, terminal no-reopen, attempt retention, and replay identity.
- Upload tests cover target authority, quotas/concurrency, exact signed expiry, generated normalized key, traversal/control filename resistance, no-byte timeout, mid-transfer expiry, size/MIME/magic/checksum mismatch, duplicate completion, verifier replay, quarantine/orphan/24h sweep, ready-only reads, and hold-aware removal.
- Webhook/provider tests use raw fixtures for valid/bad/unknown/rotating keys, replay boundary/clock skew, content limits, constant-time verification wrapper, duplicate identical digest, duplicate conflicting digest, fast acknowledgement, normalized-record persistence, consumer retry, ambiguous send, circuit 5/60s, poll/webhook reconcile, and manual review.
- Performance gates use representative deterministic data: Tier 1 API p95 <750ms and DB point query p95 <50ms; Tier 2/API p95 <1,200ms and protected RPC p95 <300ms; job acceptance p95 <=500ms/p99 <=1,000ms; webhook ack p95 <=1,000ms/p99 <2,000ms; outbox p95 <=2s; Queue first attempt p95 <=60s; dead letters <0.1% daily.
- Recovery drills use synthetic/local fixtures until production verification is available; the production gate then proves restore integrity, RLS/RPC checks, restore-epoch fencing, outbox/job/provider reconciliation, same-artifact rollback, and no external-effect replay before protected-write or fence release. No PITR, provider uptime SLA, or paid recovery add-on is assumed.

### Accessibility Contract Tests

Backend validation issues retain stable JSON Pointer paths and safe messages so frontend error summaries can link controls. Job/upload status distinguishes determinate from unknown progress and exposes truthful state/retryability; session expiry and conflict details provide safe recovery actions. Representative routes must support WCAG 2.2 AA frontend behavior, zero axe Critical/Serious findings, Lighthouse accessibility 100, and manual keyboard/screen-reader checks; BE contract tests ensure required status/error metadata is present without forcing UI wording.

## Deepening and Ambiguity Gate

### Deepening Pass Record

| Pass | Review focus                    | Locked result                                                                                                                                                                                                                                                                            | Outcome |
| ---- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1    | Cross-endpoint consistency      | The route, field, response/error, authorization, rate, SLO, and observability registries describe the same four platform-owned endpoints. Domain reads and commands inherit route archetypes and remain owned by their later shards.                                                     | PASS    |
| 2    | Concurrency and sequencing      | Protected commands reserve idempotency before mutation, use exact strong ETags and transactional CAS, commit audit/idempotency/outbox atomically, and make async consumers re-read canonical state/version under a lease.                                                                | PASS    |
| 3    | Failure cascades                | Disconnects, duplicate dispatch, stale events, worker death, ambiguous provider sends, invalid uploads, failed promotion, failed restore, and telemetry loss each have a deterministic no-partial-truth outcome.                                                                         | PASS    |
| 4    | Authorization                   | Human, anonymous, webhook, queue/schedule, deployment, internal-operator, and service-role principals use separate pipelines; every record and operation has least-privilege predicates plus wrong-user, wrong-party, wrong-resource, stale-authority, and over-disclosure tests.        | PASS    |
| 5    | Observability                   | Safe identifiers, outcome, duration, sampling, alert thresholds, redaction, diagnostic grouping, and audit boundaries are explicit for HTTP, SQL/RPC, Queue, Storage, provider, migration, and recovery paths.                                                                           | PASS    |
| 6    | Rate and abuse resistance       | Body/collection limits, signature replay windows, route-specific rate classes, concurrency caps, provider circuit breaking, polling discipline, and retry ceilings are deterministic.                                                                                                    | PASS    |
| 7    | Partial-state hygiene           | Canonical state remains authoritative; every asynchronous or external effect has idempotency, reconciliation, retention, and terminal/manual-review behavior without exposing unverified bytes or raw provider payloads.                                                                 | PASS    |
| 8    | Source-contradiction resolution | The IA remains limited to eight records; attempt evidence is embedded, transport leases stay on `OutboxEvent`, `aggregateVersion` is lossless on the Queue envelope, accepted webhook data is normalized before acknowledgement, and `blocked` is not added to the locked Job wire enum. | PASS    |
| 9    | Two-implementer convergence     | Independent implementations using only this document select identical routes, schemas, state transitions, middleware order, transaction boundaries, RLS outcomes, error mappings, retry/DLQ policies, and verification cases. No implementation-dependent product behavior remains.      | PASS    |
| 10   | Final adversarial scan          | Micro field/state checks, macro end-to-end flow checks, a hostile-principal review, and a devil's-advocate failure review produced no new material contract after Pass 9.                                                                                                                | PASS    |

### Quality-Gate Checklist

- Classification is one cross-cutting BE specification; the IA requires no split or deep dive.
- Every platform-owned endpoint has method/path, operation ID, auth, cache, timeout, rate, SLO, request, response, error, and BOLA behavior.
- Every request, response, header, path, event, and error detail is strict and field-reconciled.
- All eight canonical records have fields, constraints, indexes, retention, grants, RLS predicates, and transaction ownership without adding a ninth record.
- Middleware order, principal pipelines, capability/resource predicates, idempotency, ETag/CAS, and partial-state behavior are executable.
- Consumers, leases, retries, DLQ behavior, webhook recovery, upload verification, provider reconciliation, release, and recovery fencing are explicit.
- Contract, handler, authorization, database, asynchronous, storage, provider, recovery, observability, and accessibility tests cover success and refusal paths.
- OpenAPI-visible errors preserve the locked four-field envelope and expose only allowlisted details.
- Open Questions contains no unresolved product or architecture decision; downstream configuration is represented as an explicit dependency gate.

## Ambiguity Gate

**PASS.** Implementer simulation and devil's-advocate review covered INF-API-01 through INF-API-04, strict request and success schemas, per-operation middleware and CORS, BE00 ApiError envelopes, authorization concealment, idempotency and concurrency, typed persistence, state recovery, integration boundaries, observability, tests, and source reconciliation. No unresolved implementation ambiguity remains; open questions are none.

## Open Questions

None. Backend-level underspecification has been resolved above without changing locked product scope: Shard 00 remains eight canonical infrastructure records and four platform HTTP endpoints; attempt evidence is embedded in those records, Queue transport is disposable, provider-normalized webhook data belongs to the owning integration/domain record, and `blocked` is not added to the shared Job enum.

Provider integrations and domain routes remain disabled until their owning specs supply exact capability names, payload schemas, signature/replay configuration, limits, retention, route/consumer entries, and runbooks. This is a dependency gate, not an unresolved Shard 00 decision.

## Changelog

| Date       | Change                                                                                                                                                                                                                             | Workflow              | Sections Affected    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------- |
| 2026-08-28 | Initial complete cross-cutting backend foundation authored from ambiguity-passed IA                                                                                                                                                | `/write-be-spec`      | All                  |
| 2026-10-02 | DEC-111: `STEP_UP_REQUIRED` recovery routing — `recoveryAction: 'step_up'` routes the browser to `/step-up?returnTo=<current relative path>`; `allowedMethods` is the configured allowlisted method ids; shortfalls are always 401 | `/propagate-decision` | Error Detail Schemas |

<!-- spec-graph: auto-generated -->

## Related Specs

### Derives from

- [[specs/ia/00-infrastructure|Shard 00 — Cross-cutting platform foundation]]

### References

- [[specs/ia/00-infrastructure|Shard 00 — Cross-cutting platform foundation]]
