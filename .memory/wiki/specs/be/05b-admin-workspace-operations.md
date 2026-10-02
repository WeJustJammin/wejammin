# BE 05b — Admin workspace and operations

## CMS schema-review assignment reciprocity (DEC-108, 2026-10-02)

BE03a owns the newly approved owner-only `cms.schema_review.assign` command
authority and private schema-review assignment ledger. It is not a generic
CFG-11 grant, a settings review or additional admin/design authority. Only
read/decide for one frozen owner-scoped CMS review may be assigned to an existing
eligible human, for at most seven days and no later than the grantor's current
authority; current verified binding and MFA remain required. CFG operations do
not manufacture CMS review decisions or treat a CMS version as `setting_value`.

The singleton operator-only initial-owner operation below still initializes
exactly its four original capabilities. The amendment does not authorize another
initialization, real grant/account mutation, or wider operator/delegation scope.
BE03a's approved private contract supplies the separate assignment authority.

## Operator-only initial-owner setup (2026-09-10)

The owner-approved empty-installation exception is
`platform_private.initialize_cms_owner(uuid, uuid, text, timestamptz, uuid, boolean)`:
verified Auth ID, pinned person ID, expected email, grant end, authorization
reference and preview flag. Only the `postgres` operator may execute it; PUBLIC,
anon, authenticated and service_role have no execution or receipt-table grants.
It is SECURITY INVOKER with fixed empty search path and UTC timezone, not an HTTP
endpoint. The email is compared but never retained in its receipt/audit payload.

It serializes the empty-authority and singleton checks, locks the confirmed,
nondeleted, nonbanned active/claimed owner identity, and refuses any existing CMS
or admin grant. It creates a private-linked WeBeJammin alias and self-member
organization through canonical identity operations. Only four organization
capabilities are initialized: `cms.schema_registry.read`, `cms.schema_designer`,
`admin.inbox.read`, `admin.audit.read`. The two admin capabilities receive named
organization-scoped `read` rows, with no delegation or purpose grant. End time is
bounded to seven days and date-only grants round down to avoid overrun.

`cms_owner_initialization` is a forced-RLS singleton receipt recording immutable
Auth/person/alias/organization IDs, authorization reference, operator role and
term. The explicit `operator.cms_owner.initialize` audit records operator setup;
it must not be described as user login or MFA. Failure rolls back all identity,
membership, capability, audit and receipt effects. Actor settings are restored
after success. Typed refusals are `BOOTSTRAP_OPERATOR_REQUIRED`,
`BOOTSTRAP_INVALID`, `BOOTSTRAP_ALREADY_INITIALIZED`,
`BOOTSTRAP_IDENTITY_MISMATCH`, `BOOTSTRAP_AUTHORITY_EXISTS` and
`BOOTSTRAP_HANDLE_UNAVAILABLE`; canonical identity failures also roll back.
Preview returns proposed person, handle, capabilities and term without mutation.

Operator setup must not reuse a browser-selected acting context. Its canonical
self-person operation context leaves all existing browser bindings unchanged,
including expired ones; both acting-party and acting-context caller settings
are restored afterward. No session is renewed or reauthenticated by setup.

This is the sole initial-installation exception to the grant-RPC-only insertion
rule below. Ordinary grantor-subset, step-up, distinct-approver and revocation
requirements are unchanged. Hosted tests must separately prove real access.

## Split Group

This companion is the backend contract for Shard 05 administration and
quality-control-plane operations. It owns CFG-08 through CFG-12 and the
25.08 feature family:

- 25.08.01 Admin Home & Task Inbox
- 25.08.02 Global Search, Filtering & Bulk Actions
- 25.08.03 Admin Capabilities, Delegation & Step-Up
- 25.08.04 Activity Audit & Security Notifications
- 25.08.05 Site Health & Configuration Diagnostics

05a owns settings, flags, experiments and kill-switch runtime truth. 05c owns
portability, quality gates and data lifecycle requests. Content, media,
navigation, safety cases, evidence, rights, financial state and legal
decisions remain owned by their respective shards.

## Classification

| IA interaction                       | Operation ID | Backend classification                                      | Authority and completion                                                                                                                             |
| ------------------------------------ | ------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| CFG-08 Work admin inbox              | CFG-05B-01   | Capability-filtered bounded projection query                | Task cards are derived, freshness-labelled projections; the source domain rechecks any completion.                                                   |
| CFG-09 Search/filter control plane   | CFG-05B-02   | Allowlisted metadata search query                           | Search schema and per-item plus aggregate authorization run before response composition; counts never disclose protected existence.                  |
| CFG-10 Preview/run bulk action       | CFG-05B-03   | Dry-run manifest command and bounded asynchronous job       | Exact command, target IDs and versions are frozen; ordinary guarded commands process each item and preserve partial evidence.                        |
| CFG-11 Grant/revoke admin capability | CFG-05B-04   | Protected capability grant state-transition command         | Named actions, resource, scope, term, reason, step-up and distinct approval are required; revocation is immediate.                                   |
| CFG-12 Inspect audit/diagnostics     | CFG-05B-05   | Minimal audit-link query plus registered diagnostic command | Links expose IDs and versions, not protected payload; diagnostics return healthy, stale, unknown or failed evidence without becoming a second truth. |

## Referenced Material Inventory

| Source                                                              | Sections and exact lines                                                 | Use in this companion                                                                                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md            | title, links and scope lines 1-22                                        | Confirms the parent boundary, approved three-way split and deferred enterprise administration.                                    |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md            | Features and acceptance criteria lines 24-45                             | Binds feature IDs 25.08.01 through 25.08.05 and required partial, capability and diagnostic behavior.                             |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md            | Interactions and global rules lines 47-71                                | Supplies exact CFG-08 through CFG-12 identifiers and no-false-zero or no-auth-by-setting rules.                                   |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md            | Contracts lines 86-96                                                    | Supplies task, search, bulk, capability, audit and diagnostic safety contracts.                                                   |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md            | Data Models and typed registry lines 108-152                             | Supplies AdminTaskProjection, AdminCapabilityGrant, BulkOperation, AdminAuditLink, DiagnosticDefinitionVersion and DiagnosticRun. |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md            | Access Control and escalation lines 154-187                              | Supplies admin/operator/support roles, immediate revoke, purpose grants and no-override escalation.                               |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md            | Accessibility lines 189-197                                              | Supplies loading, stale, partial, unknown, per-item bulk and checker/audit presentation requirements.                             |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md            | Event Schemas lines 199-211                                              | Supplies admin.capability.changed.v1, admin.bulk.changed.v1 and quality.diagnostic.changed.v1.                                    |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md            | Edge cases and matrix lines 213-258                                      | Supplies dependency lag, count leakage, target drift, mid-job revoke and diagnostic-unavailable recovery.                         |
| .memory/wiki/specs/ia/deep-dives/05-platform-configuration-admin.md | scope and deepening record lines 1-18                                    | Confirms adversarial rejection of mass mutation, count leakage and break-glass permanence.                                        |
| .memory/wiki/specs/ia/deep-dives/05-platform-configuration-admin.md | admin model contracts lines 35-55                                        | Expands task, grant, bulk item, audit, diagnostic and result fields.                                                              |
| .memory/wiki/specs/ia/deep-dives/05-platform-configuration-admin.md | state machine and admin algorithms lines 57-69 and 98-104                | Locks grant, bulk, projection, search, lease, cancellation and diagnostic transitions.                                            |
| .memory/wiki/specs/ia/deep-dives/05-platform-configuration-admin.md | abuse/recovery and cross-shard lines 132-162                             | Locks proof for grant abuse, search/count leaks, mass overreach and diagnostic false health.                                      |
| .memory/wiki/specs/feature-ledger.md                                | Shard 05 rows lines 776-780                                              | Reconciles every assigned 25.08 feature row to an operation and test surface.                                                     |
| .memory/wiki/specs/be/00-infrastructure.md                          | inventory, ApiError and contracts lines 22-41 and 112-138                | Inherits RequestContext, strict Zod 4 and exact ApiError { code, message, requestId, details }.                                   |
| .memory/wiki/specs/be/00-infrastructure.md                          | database, middleware, jobs and provider boundaries lines 202-365         | Inherits private schema, RLS, middleware order, idempotency, queue retry and provider circuit rules.                              |
| .memory/wiki/specs/be/00-infrastructure.md                          | errors, observability, tests and ambiguity lines 416-534                 | Inherits typed errors, scrubbed telemetry, recovery proof and ambiguity gates.                                                    |
| .memory/wiki/specs/2026-08-02-architecture-design.md                | stack, access and integration lines 157-167, 348-370 and 495-502         | Confirms Hono/Zod/Workers, server-derived authorization, PostgreSQL RPC and replaceable provider seams.                           |
| .memory/wiki/specs/2026-08-02-architecture-design.md                | API security lines 707-765 and 900-907                                   | Confirms BOLA/BOPLA protection, allowlisted filters, explicit CORS and safe errors.                                               |
| .memory/wiki/specs/data-placement-strategy.md                       | placement and isolation lines 13-16, 23-32, 42-52 and 120-130            | Confirms PostgreSQL authority, protected schemas, object boundary and acting-context/RLS enforcement.                             |
| .memory/wiki/specs/ENGINEERING-STANDARDS.md                         | contract, bounds, security and migration lines 35-50, 92-101 and 149-188 | Sets strict validation, 256 KiB bodies, 50-row list limit, endpoint tests and RLS/grant tests.                                    |

## IA Source Map

| Exact source item                    | 05b ownership                     | Backend realization                                                                            |
| ------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------- |
| CFG-08 Work admin inbox              | Owned                             | CFG-05B-01 and admin_task_projections with freshness and partial state.                        |
| CFG-09 Search/filter control plane   | Owned                             | CFG-05B-02 and registered metadata schema with per-result and aggregate policy.                |
| CFG-10 Preview/run bulk action       | Owned                             | CFG-05B-03, admin_bulk_operations, admin_bulk_item_results and exact target manifest.          |
| CFG-11 Grant/revoke admin capability | Owned                             | CFG-05B-04 and admin_capability_grants with named action, scope and expiry.                    |
| CFG-12 Inspect audit/diagnostics     | Owned                             | CFG-05B-05, admin_audit_links, admin_diagnostic_definition_versions and admin_diagnostic_runs. |
| AdminTaskProjection                  | Owned                             | Derived task projection; owning domain remains source of truth.                                |
| AdminCapabilityGrant                 | Owned                             | Current grant and append-only transition evidence.                                             |
| BulkOperation                        | Owned                             | Frozen command, manifest, cursor and counts.                                                   |
| AdminAuditLink                       | Owned                             | Identifier/version link to immutable audit and security evidence.                              |
| DiagnosticDefinitionVersion          | Owned                             | Code-owned definition, bounded input and evidence schema.                                      |
| DiagnosticRun                        | Owned                             | Evidence-backed diagnostic result with freshness and state.                                    |
| BulkItemResult                       | Supporting deep-dive model, owned | One guarded outcome per operation and exact target version.                                    |
| admin.capability.changed.v1          | Owned event                       | Identifier-only event after grant or revocation commit.                                        |
| admin.bulk.changed.v1                | Owned event                       | Identifier-only event after bulk state or item-result summary change.                          |
| quality.diagnostic.changed.v1        | Owned event                       | Identifier-only event after diagnostic run state changes.                                      |
| CFG-01 through CFG-07                | Excluded                          | 05a owns settings, flags, experiments and switch runtime.                                      |
| CFG-13 through CFG-14                | Excluded                          | 05c owns import/export/restore, quality and lifecycle.                                         |

## Feature Ledger Coverage

| Feature ledger ID | Feature                                  | Operation coverage        | Acceptance evidence                                                                            |
| ----------------- | ---------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| 25.08.01          | Admin Home & Task Inbox                  | CFG-05B-01                | Capability-filtered cards, source version, freshness, partial and unknown-state tests.         |
| 25.08.02          | Global Search, Filtering & Bulk Actions  | CFG-05B-02 and CFG-05B-03 | Schema allowlist, count policy, exact manifest, item outcomes and query-drift tests.           |
| 25.08.03          | Admin Capabilities, Delegation & Step-Up | CFG-05B-04                | Named actions/resources, no wildcard, MFA, distinct approver, term and immediate revoke tests. |
| 25.08.04          | Activity Audit & Security Notifications  | CFG-05B-04 and CFG-05B-05 | Minimal audit links, immutable IDs, notification intents and no protected payload leakage.     |
| 25.08.05          | Site Health & Configuration Diagnostics  | CFG-05B-01 and CFG-05B-05 | Registered definitions, freshness, unknown-on-timeout and no automatic high-risk repair.       |

## Endpoint Completeness Reconciliation

The five assigned interactions each have exactly one route registry entry, one
strict request and success contract, one status/error row, one authorization
row, one idempotency/rate/observability row and one test row below. Search is a
single query route; it does not expose unrestricted SQL or a second entity
endpoint. Bulk preview and run are one manifest command route with an action
discriminant. Audit read and diagnostic run share one route but have separate
strict action branches and evidence semantics.

Task cards and diagnostic definitions are projections. Completion, capability
grant, bulk item mutation and source audit remain transaction-owned by their
respective RPCs. No authentication, generic upload, webhook, object, setting
or BE00 job route is duplicated.

## Shared Contract Inheritance

BE00 supplies request ID, transport guard, exact CORS, body/query ceilings,
Supabase session verification, acting-party resolution, CSRF for cookie
mutations, strict Zod validation, capability/RLS checks, idempotency,
transactional outbox, queue retry and ApiError normalization. The exact wire
envelope is ApiError { code, message, requestId, details }; details is limited
to 16 keys, four nesting levels and 8 KiB.

Every admin route derives actor, party and target scope on the server. Caller
fields named actor, tenant, capability, authorization or RLS policy are
unknown-key failures. Authenticated users receive only named projections.
Service principals may run registered projections or workers but cannot
impersonate a human or grant themselves capability.

## API Endpoints

### Route Registry

| Operation ID | IA interaction                       | Method and path                              | Auth and capability                                                                            | Request contract                | Success contract                            | Error contract                                                                         | Idempotency and rate                                                                                                                                                                                                                                                | CORS and middleware                                                                                                                |
| ------------ | ------------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| CFG-05B-01   | CFG-08 Work admin inbox              | GET /api/v1/admin/inbox                      | Authenticated admin operator with at least one current named task capability                   | Cfg05b01InboxQuery              | Cfg05b01InboxResponse 200                   | ApiError { code, message, requestId, details }; 401 or 403 or 503                      | No mutation key; signed keyset cursor over `(dueAt ASC NULLS LAST, taskId ASC)`; default limit 25, max 50; stable sort `dueAt ASC NULLS LAST, taskId ASC`; filter allowlist `taskClasses`, `states`, `staleAfter` only; 120/min user and 240/min party; 8s deadline | CORS first-party admin read allowlist; BE00 request-id, strict query, session/context, capability, rate and ApiError normalization |
| CFG-05B-02   | CFG-09 Search/filter control plane   | POST /api/v1/admin/search                    | Authenticated admin operator with entity-specific read capability                              | Cfg05b02SearchRequest           | Cfg05b02SearchResponse 200                  | ApiError { code, message, requestId, details }; 400 or 403 or 422 or 429               | Idempotency-Key required for stable replay; 60/min user and 120/min party; 8s deadline                                                                                                                                                                              | CORS first-party admin allowlist; BE00 session, CSRF, strict Zod, schema policy, rate and ApiError normalization                   |
| CFG-05B-03   | CFG-10 Preview/run bulk action       | POST /api/v1/admin/bulk-operations           | Admin operator with command capability for every target; step-up for protected command         | Cfg05b03BulkActionRequest       | Cfg05b03BulkActionResponse 200 or 202       | ApiError { code, message, requestId, details }; 401 or 403 or 404 or 409 or 422 or 503 | Idempotency-Key required; 10/min user and 20/min party; 15s route deadline and queue lease                                                                                                                                                                          | CORS first-party admin allowlist; BE00 session, CSRF, strict Zod, step-up, capability, rate, RPC and ApiError normalization        |
| CFG-05B-04   | CFG-11 Grant/revoke admin capability | POST /api/v1/admin/capability-grants/actions | Grantor with every named action/resource; MFA and distinct approver for elevated/purpose grant | Cfg05b04CapabilityActionRequest | Cfg05b04CapabilityActionResponse 200 or 201 | ApiError { code, message, requestId, details }; 401 or 403 or 404 or 409 or 422        | Idempotency-Key required; 20/min user and 40/min party; 15s deadline                                                                                                                                                                                                | CORS first-party admin allowlist; BE00 session, CSRF, strict Zod, step-up, capability, rate, RPC and ApiError normalization        |
| CFG-05B-05   | CFG-12 Inspect audit/diagnostics     | POST /api/v1/admin/audit-diagnostics/actions | Admin audit capability or diagnostic capability for exact scope and definition                 | Cfg05b05AuditDiagnosticRequest  | Cfg05b05AuditDiagnosticResponse 200 or 202  | ApiError { code, message, requestId, details }; 401 or 403 or 404 or 409 or 503        | Read action 120/min; run action Idempotency-Key and 30/min; 8s read or 15s queued                                                                                                                                                                                   | CORS first-party admin allowlist; BE00 session, CSRF, strict Zod, capability, rate and ApiError normalization                      |

### Registry invariants

- Route paths and methods are the only public admin surface for this split and
  are generated into OpenAPI from this registry.
- Search entity types, fields, filters, sorts, snippets and minimum-count
  policy come from a build-time registry. Callers cannot submit SQL, columns,
  functions, expressions or arbitrary joins.
- Bulk execution uses only a dry-run manifest with exact target ID and
  expected version. A broad query is never rerun at execution time.
- Capability grants never contain wildcard actions or resources, never exceed
  the grantor's own authority, always have an end time, and are rechecked at
  commit and at each bulk lease.
- Audit links contain IDs, versions, hashes and safe labels only. Diagnostic
  definitions and runbooks are code-owned and a diagnostic result cannot
  trigger a high-risk repair.
- 403 means a visible target or schema exists but the named action is outside
  the current grant. 404 is used when target visibility itself is denied and
  for a hidden audit or grant, preventing existence disclosure.

### Operation contract and error matrix

| Operation ID | Request and success                                                                    | Error codes and status                                                                                                           | 403 versus 404                                                                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CFG-05B-01   | InboxQuery to InboxResponse with task source, state and freshness                      | UNAUTHENTICATED 401; FORBIDDEN 403; TASK_SOURCE_UNAVAILABLE 503; RATE_LIMITED 429                                                | Empty capability scope is 403 only after the admin shell is authorized; inaccessible task sources are omitted as disclosure-safe 404 at source lookup and aggregate remains partial or unknown. |
| CFG-05B-02   | SearchRequest to SearchResponse with bounded results, facets and count state           | INVALID_REQUEST 400; FORBIDDEN 403; SEARCH_FIELD_NOT_ALLOWED 422; COUNT_SUPPRESSED 422; RATE_LIMITED 429; SEARCH_UNAVAILABLE 503 | Entity family outside capability is 403 only when schema visibility is granted; protected target/result is omitted and never disclosed by 404, facet or count.                                  |
| CFG-05B-03   | BulkActionRequest to BulkActionResponse with manifest and per-item summary             | UNAUTHENTICATED 401; FORBIDDEN 403; TARGET_NOT_FOUND 404; MANIFEST_CONFLICT 409; COMMAND_NOT_ALLOWED 422; BULK_UNAVAILABLE 503   | A target absent from the actor's source projection is 404; visible target with missing command capability is 403; changed version is a per-item 409.                                            |
| CFG-05B-04   | CapabilityActionRequest to CapabilityActionResponse with current grant state           | UNAUTHENTICATED 401; FORBIDDEN 403; GRANT_NOT_FOUND 404; GRANT_VERSION_CONFLICT 409; GRANT_INVALID 422                           | Hidden grant or subject is 404; visible resource outside grantor authority is 403; no grant payload is exposed on denial.                                                                       |
| CFG-05B-05   | AuditDiagnosticRequest to AuditDiagnosticResponse with minimal links or evidence state | UNAUTHENTICATED 401; FORBIDDEN 403; AUDIT_TARGET_NOT_FOUND 404; DIAGNOSTIC_VERSION_CONFLICT 409; DIAGNOSTIC_UNAVAILABLE 503      | Hidden audit target and diagnostic definition are 404; visible target outside audit or diagnostic capability is 403; timeout is 503 unknown, never healthy.                                     |

## Request/Response Contracts (Zod 4 schemas)

All wire objects are Zod 4 strictObject schemas. Unknown keys fail, list
limits are bounded, IDs are UUIDs, timestamps have offsets and all response
payloads are safe projections. The route adapter validates path, query,
headers and JSON separately before authorization.

```ts
import { z } from 'zod';

const Uuid = z.uuid();
const IsoTime = z.string().datetime({ offset: true });
const Version = z.string().regex(/^[1-9][0-9]{0,17}$/);
const NonEmptyText = z.string().trim().min(1).max(512);
const Key = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+){0,15}$/)
  .max(128);
const Cursor = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,256}$/)
  .nullable();
const JsonObject = z
  .record(z.string().max(128), z.json())
  .superRefine((v, c) => {
    if (Object.keys(v).length > 64)
      c.addIssue({ code: 'custom', message: 'too many keys' });
    if (JSON.stringify(v).length > 65536)
      c.addIssue({ code: 'custom', message: 'object exceeds 64 KiB' });
  });
const Freshness = z.enum(['healthy', 'stale', 'partial', 'unknown', 'failed']);
const ApiError = z.strictObject({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/),
  message: z.string().min(1).max(256),
  requestId: Uuid,
  details: z.record(z.string().max(64), z.json()).superRefine((v, c) => {
    if (Object.keys(v).length > 16)
      c.addIssue({ code: 'custom', message: 'too many details' });
  }),
});

const TaskClass = z.enum([
  'approval',
  'failed_job',
  'schedule',
  'expiring_right',
  'expiring_flag',
  'hold',
  'diagnostic',
  'incident',
]);
const TaskState = z.enum([
  'open',
  'assigned',
  'blocked',
  'completed',
  'unknown',
]);
export const Cfg05b01InboxQuery = z.strictObject({
  cursor: Cursor.optional(),
  limit: z.number().int().min(1).max(50).default(25),
  taskClasses: z.array(TaskClass).max(8).optional(),
  states: z.array(TaskState).max(5).optional(),
  staleAfter: IsoTime.optional(),
});
export const Cfg05b01InboxResponse = z.strictObject({
  items: z
    .array(
      z.strictObject({
        taskId: Uuid,
        sourceType: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/),
        sourceId: Uuid,
        sourceVersion: Version,
        taskClass: TaskClass,
        requiredCapability: Key,
        assigneePersonId: Uuid.nullable(),
        dueAt: IsoTime.nullable(),
        severity: z.enum(['info', 'warning', 'high', 'critical']),
        freshnessAt: IsoTime,
        freshness: Freshness,
        state: TaskState,
        sourceStatus: z.string().max(64),
        canAct: z.boolean(),
      }),
    )
    .max(50),
  nextCursor: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,256}$/)
    .nullable(),
  aggregateFreshness: Freshness,
  partialSources: z.array(z.string().max(64)).max(16),
  generatedAt: IsoTime,
});

const SearchEntity = z.enum([
  'content',
  'media',
  'navigation',
  'setting',
  'job',
  'audit_ref',
  'diagnostic',
  'capability',
]);
const SearchFilter = z.strictObject({
  field: z.string().regex(/^[a-z][a-z0-9_.-]{1,63}$/),
  operator: z.enum(['equals', 'prefix', 'contains', 'before', 'after', 'in']),
  value: z.union([z.string().max(256), z.array(z.string().max(256)).max(32)]),
});
export const Cfg05b02SearchRequest = z.strictObject({
  entityType: SearchEntity,
  fields: z
    .array(z.string().regex(/^[a-z][a-z0-9_.-]{1,63}$/))
    .min(1)
    .max(24),
  filters: z.array(SearchFilter).max(16),
  sort: z
    .array(
      z.strictObject({
        field: z.string().regex(/^[a-z][a-z0-9_.-]{1,63}$/),
        direction: z.enum(['asc', 'desc']),
      }),
    )
    .max(4),
  snippet: z.boolean().default(false),
  minCount: z.number().int().min(0).max(20).default(0),
  cursor: Cursor.optional(),
  limit: z.number().int().min(1).max(50).default(25),
});
export const Cfg05b02SearchResponse = z.strictObject({
  entityType: SearchEntity,
  results: z
    .array(
      z.strictObject({
        entityId: Uuid,
        entityVersion: Version,
        fields: z.record(
          z.string().max(64),
          z.union([z.string().max(512), z.number(), z.boolean(), z.null()]),
        ),
        snippet: z.string().max(512).nullable(),
        authorized: z.literal(true),
      }),
    )
    .max(50),
  count: z.number().int().min(0).max(1000000).nullable(),
  countState: z.enum(['exact', 'suppressed', 'unknown']),
  nextCursor: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,256}$/)
    .nullable(),
  freshnessAt: IsoTime,
  freshness: Freshness,
});

const Target = z.strictObject({
  targetType: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/),
  targetId: Uuid,
  expectedVersion: Version,
});
const BulkAction = z.enum(['preview', 'run', 'cancel']);
export const Cfg05b03BulkActionRequest = z
  .strictObject({
    action: BulkAction,
    commandKey: Key,
    commandVersion: Version,
    targets: z.array(Target).min(1).max(500),
    manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
    dryRunId: Uuid.nullable(),
    reason: NonEmptyText,
    stepUpToken: z.string().min(20).max(4096).optional(),
  })
  .superRefine((v, c) => {
    if (
      new Set(v.targets.map((t) => t.targetType + ':' + t.targetId)).size !==
      v.targets.length
    )
      c.addIssue({
        code: 'custom',
        path: ['targets'],
        message: 'duplicate target',
      });
    if (v.action === 'run' && v.dryRunId === null)
      c.addIssue({
        code: 'custom',
        path: ['dryRunId'],
        message: 'run requires dry run',
      });
    if (v.action === 'preview' && v.dryRunId !== null)
      c.addIssue({
        code: 'custom',
        path: ['dryRunId'],
        message: 'preview cannot reference dry run',
      });
  });
export const Cfg05b03BulkActionResponse = z.strictObject({
  bulkOperationId: Uuid,
  commandKey: Key,
  commandVersion: Version,
  manifestHash: z.string().regex(/^[a-f0-9]{64}$/),
  state: z.enum([
    'draft',
    'dry_run',
    'approved',
    'running',
    'completed',
    'partial',
    'failed',
    'cancelled',
  ]),
  targetCount: z.number().int().min(1).max(500),
  successCount: z.number().int().min(0).max(500),
  failureCount: z.number().int().min(0).max(500),
  skippedCount: z.number().int().min(0).max(500),
  cursor: z.number().int().min(0).max(500),
  itemResults: z
    .array(
      z.strictObject({
        targetId: Uuid,
        targetType: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/),
        expectedVersion: Version,
        state: z.enum([
          'pending',
          'succeeded',
          'failed',
          'skipped',
          'cancelled',
        ]),
        attemptCount: z.number().int().min(0).max(3),
        errorCode: z
          .string()
          .regex(/^[A-Z][A-Z0-9_]{2,63}$/)
          .nullable(),
      }),
    )
    .max(500),
  outboxEventId: Uuid.nullable(),
});

const GrantAction = z.enum(['create', 'revoke']);
const GrantScope = z.record(
  z.string().regex(/^[a-z][a-z0-9_.-]{1,63}$/),
  z.union([
    z.string().max(256),
    z.boolean(),
    z.array(z.string().max(128)).max(32),
  ]),
);
export const Cfg05b04CapabilityActionRequest = z
  .strictObject({
    action: GrantAction,
    grantId: Uuid.nullable(),
    expectedVersion: Version.nullable(),
    subjectPersonId: Uuid,
    capabilityKey: Key,
    resourceType: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/),
    resourceId: Uuid,
    scope: GrantScope,
    actions: z.array(Key).min(1).max(16),
    startsAt: IsoTime,
    endsAt: IsoTime,
    reason: NonEmptyText,
    approverPersonId: Uuid.nullable(),
    purposeGrant: z.boolean(),
    stepUpToken: z.string().min(20).max(4096).optional(),
  })
  .superRefine((v, c) => {
    if (v.endsAt <= v.startsAt)
      c.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'end must follow start',
      });
    if (v.actions.some((a) => a === '*' || a.includes('*')))
      c.addIssue({
        code: 'custom',
        path: ['actions'],
        message: 'wildcard action prohibited',
      });
    if (v.action === 'revoke' && v.grantId === null)
      c.addIssue({
        code: 'custom',
        path: ['grantId'],
        message: 'revoke requires grant',
      });
    if (
      v.purposeGrant &&
      v.actions.some((a) => a === 'grant' || a === 'revoke')
    )
      c.addIssue({
        code: 'custom',
        path: ['actions'],
        message: 'purpose grant cannot grant or revoke',
      });
  });
export const Cfg05b04CapabilityActionResponse = z.strictObject({
  grantId: Uuid,
  subjectPersonId: Uuid,
  capabilityKey: Key,
  resourceType: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/),
  resourceId: Uuid,
  state: z.enum(['pending', 'active', 'expired', 'revoked']),
  startsAt: IsoTime,
  endsAt: IsoTime,
  version: Version,
  notificationTaskId: Uuid.nullable(),
  outboxEventId: Uuid,
});

const DiagnosticAction = z.enum(['read_audit', 'run_diagnostic']);
export const Cfg05b05AuditDiagnosticRequest = z
  .strictObject({
    action: DiagnosticAction,
    targetType: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/),
    targetId: Uuid,
    targetVersion: Version.nullable(),
    auditLinkId: Uuid.nullable(),
    diagnosticDefinitionKey: Key.nullable(),
    diagnosticDefinitionVersion: Version.nullable(),
    input: JsonObject.nullable(),
    expectedFreshnessAt: IsoTime.nullable(),
    reason: NonEmptyText,
  })
  .superRefine((v, c) => {
    if (v.action === 'read_audit' && v.auditLinkId === null)
      c.addIssue({
        code: 'custom',
        path: ['auditLinkId'],
        message: 'audit link required',
      });
    if (
      v.action === 'run_diagnostic' &&
      (v.diagnosticDefinitionKey === null ||
        v.diagnosticDefinitionVersion === null)
    )
      c.addIssue({
        code: 'custom',
        path: ['diagnosticDefinitionKey'],
        message: 'diagnostic definition required',
      });
  });
export const Cfg05b05AuditDiagnosticResponse = z.strictObject({
  action: DiagnosticAction,
  auditLinkId: Uuid.nullable(),
  diagnosticRunId: Uuid.nullable(),
  targetType: z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/),
  targetId: Uuid,
  targetVersion: Version.nullable(),
  state: z.enum(['unknown', 'running', 'healthy', 'stale', 'failed']),
  freshnessAt: IsoTime.nullable(),
  evidenceRef: z.string().max(256).nullable(),
  resultCodes: z.array(z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/)).max(32),
  outboxEventId: Uuid.nullable(),
});

export type Cfg05bApiError = z.infer<typeof ApiError>;
```

### Contract and policy rules

- Inbox list size is at most 50 and every item includes source ID, source
  version, capability, freshness and state. A lagging dependency marks its
  card partial or unknown; no missing card implies no work.
- Search filters and sorts are validated against the entity registry before
  any query. Fields are projected explicitly. Per-result authorization runs
  before snippets and aggregate-count policy runs before count serialization.
- Bulk targets are an ordered, unique, exact manifest. The manifest hash,
  command version and expected target versions are required for run. A command
  registry, not a user string, selects the handler.
- Capability action requests have an explicit resource UUID, actions, scope,
  start and end. Wildcard action/resource, grantor overreach, missing
  approver, missing MFA or an invalid purpose grant fails before persistence.
- Audit read returns minimal links to content revision, change, security or
  financial audit IDs. It never copies immutable protected payload.
- Diagnostics execute only a code-owned definition version with bounded input,
  timeout and freshness policy. Timeout, unavailable dependency or stale
  input is unknown or stale, never healthy and never an automatic repair.

## Database Schema

All tables are in private schema platform_private, RLS-enabled and forced.
Every field below includes SQL type, nullability and constraint. Polymorphic
source and target IDs have no generic foreign key by design: the registry
RPC validates the source type against an owning projection before write.
Defaults are revoked from public, anon and authenticated; only named Worker
RPCs have grants.

### Canonical records and fields

| Table                                                 | Fields with SQL type, nullability and constraints                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Foreign keys                                                                                                                                                                                                                                                    | Query indexes and uniqueness                                                                                                                                                                                                                  | RLS and grants                                                                                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| platform_private.admin_task_projections               | id uuid NOT NULL PRIMARY KEY; source_type text NOT NULL CHECK registry type; source_id uuid NOT NULL; source_version bigint NOT NULL CHECK >0; task_class text NOT NULL CHECK bounded enum; required_capability text NOT NULL; assignee_person_id uuid NULL; due_at timestamptz NULL; severity text NOT NULL CHECK info or warning or high or critical; freshness_at timestamptz NOT NULL; freshness_state text NOT NULL CHECK healthy or stale or partial or unknown or failed; state text NOT NULL CHECK open or assigned or blocked or completed or unknown; source_status text NOT NULL; last_error_code text NULL CHECK uppercase code <=64; created_at timestamptz NOT NULL; updated_at timestamptz NOT NULL                                                                                                                                                              | assignee_person_id references auth.users(id); source_type and source_id validated against producer projection and cannot use a generic FK                                                                                                                       | UNIQUE source_type, source_id, source_version, task_class; INDEX assignee_person_id, state, due_at; INDEX required_capability, freshness_state; INDEX source_type, source_id, source_version DESC                                             | RLS forced; source projection worker writes through admin_task_upsert RPC; admin inbox RPC returns only capability-filtered rows; no table grant to authenticated              |
| platform_private.admin_capability_grants              | id uuid NOT NULL PRIMARY KEY; subject_person_id uuid NOT NULL; capability_key text NOT NULL CHECK registered key; resource_type text NOT NULL CHECK registered type; resource_id uuid NOT NULL; scope jsonb NOT NULL; actions text[] NOT NULL CHECK cardinality 1..16; starts_at timestamptz NOT NULL; ends_at timestamptz NOT NULL; grantor_person_id uuid NOT NULL; approver_person_id uuid NULL; reason text NOT NULL CHECK length 1..512; purpose_grant boolean NOT NULL; state text NOT NULL CHECK pending or active or expired or revoked; version_no bigint NOT NULL CHECK >0; created_at timestamptz NOT NULL; revoked_at timestamptz NULL; revoked_by uuid NULL; UNIQUE id and version_no                                                                                                                                                                              | subject_person_id, grantor_person_id, approver_person_id and revoked_by reference auth.users(id); capability/resource/scope validated by grant RPC; no wildcard values                                                                                          | INDEX subject_person_id, state, ends_at; INDEX grantor_person_id, created_at DESC; INDEX capability_key, resource_type, resource_id, state; partial UNIQUE subject_person_id, capability_key, resource_type, resource_id WHERE state = active | RLS forced; only grant/revoke RPC can insert or transition; current grant predicate checks subject, acting party, scope, action and term; authenticated has no direct DML      |
| platform_private.admin_bulk_operations                | id uuid NOT NULL PRIMARY KEY; command_key text NOT NULL CHECK registered command; command_version bigint NOT NULL CHECK >0; query_spec jsonb NULL; target_manifest_object_id uuid NOT NULL; target_manifest_hash text NOT NULL CHECK 64 lowercase hex; target_count integer NOT NULL CHECK 1..500; dry_run_report jsonb NULL; state text NOT NULL CHECK draft or dry_run or approved or running or completed or partial or failed or cancelled; cursor integer NOT NULL CHECK 0..500; success_count integer NOT NULL CHECK 0..500; failure_count integer NOT NULL CHECK 0..500; skipped_count integer NOT NULL CHECK 0..500; actor_person_id uuid NOT NULL; acting_party_id uuid NULL; idempotency_key text NOT NULL CHECK length 16..128; version_no bigint NOT NULL CHECK >0; created_at timestamptz NOT NULL; updated_at timestamptz NOT NULL; cancelled_at timestamptz NULL | target_manifest_object_id references platform_private.object_records(id); actor_person_id references auth.users(id); acting_party_id references platform_private.party(id)                                                                                      | UNIQUE actor_person_id, idempotency_key; INDEX state, updated_at; INDEX command_key, command_version, state; INDEX target_manifest_hash; INDEX acting_party_id, created_at DESC                                                               | RLS forced; create/run/cancel RPC checks command registry, exact target and actor grant; worker lease RPC rechecks grant and row version; authenticated sees only safe summary |
| platform_private.admin_bulk_item_results              | id uuid NOT NULL PRIMARY KEY; operation_id uuid NOT NULL; target_type text NOT NULL CHECK registry type; target_id uuid NOT NULL; expected_version bigint NOT NULL CHECK >0; state text NOT NULL CHECK pending or succeeded or failed or skipped or cancelled; attempt_count integer NOT NULL CHECK 0..3; result_code text NULL CHECK uppercase code <=64; result_summary jsonb NULL; completed_at timestamptz NULL; version_no bigint NOT NULL CHECK >0; UNIQUE operation_id, target_type, target_id                                                                                                                                                                                                                                                                                                                                                                           | operation_id references admin_bulk_operations(id); target_type and target_id validated by ordinary command registry; no generic target FK                                                                                                                       | UNIQUE operation_id, target_type, target_id; INDEX operation_id, state; INDEX target_type, target_id; INDEX result_code                                                                                                                       | RLS forced; worker and command RPC only; item projection redacts result_summary unless actor retains current target capability; no authenticated table grant                   |
| platform_private.admin_audit_links                    | id uuid NOT NULL PRIMARY KEY; source_type text NOT NULL; source_id uuid NOT NULL; source_version bigint NOT NULL CHECK >0; content_revision_id uuid NULL; change_id uuid NULL; audit_event_id uuid NULL; security_event_id uuid NULL; financial_audit_id uuid NULL; safe_label text NOT NULL CHECK length 1..128; created_at timestamptz NOT NULL                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | content_revision_id and change_id reference owning CMS/config tables where available; audit_event_id, security_event_id and financial_audit_id reference protected audit registries; nullable references permit one link class but RPC requires at least one ID | INDEX source_type, source_id, source_version; INDEX content_revision_id; INDEX change_id; INDEX audit_event_id; INDEX security_event_id; UNIQUE source_type, source_id, source_version, safe_label                                            | RLS forced; append-only audit-link RPC; read RPC applies audit capability and field projection; protected payload remains in owner table; no direct table grant                |
| platform_private.admin_diagnostic_definition_versions | id uuid NOT NULL PRIMARY KEY; key text NOT NULL CHECK registered key; version_no bigint NOT NULL CHECK >0; owner_capability text NOT NULL; input_schema jsonb NOT NULL; timeout_ms integer NOT NULL CHECK 100..2000; freshness_seconds integer NOT NULL CHECK 1..604800; evidence_schema jsonb NOT NULL; severity_mapping jsonb NOT NULL; runbook_ref text NOT NULL CHECK length 1..256; lifecycle text NOT NULL CHECK draft or active or deprecated or retired; hash text NOT NULL CHECK 64 lowercase hex; created_at timestamptz NOT NULL; UNIQUE key, version_no                                                                                                                                                                                                                                                                                                             | owner_capability and runbook_ref are code-owned registry references validated by release RPC; no caller-controlled FK                                                                                                                                           | INDEX key, lifecycle; INDEX owner_capability; UNIQUE key, version_no; partial INDEX active key WHERE lifecycle = active                                                                                                                       | RLS forced; release worker registry RPC inserts immutable definitions; diagnostic run RPC reads active version; admin cannot edit definition or runbook                        |
| platform_private.admin_diagnostic_runs                | id uuid NOT NULL PRIMARY KEY; definition_id uuid NOT NULL; definition_version bigint NOT NULL CHECK >0; target_type text NOT NULL; target_id uuid NOT NULL; target_version bigint NULL; state text NOT NULL CHECK unknown or running or healthy or stale or failed; started_at timestamptz NOT NULL; completed_at timestamptz NULL; evidence_ref text NULL; result_codes text[] NOT NULL; freshness_at timestamptz NULL; actor_person_id uuid NULL; job_id uuid NULL; version_no bigint NOT NULL CHECK >0; created_at timestamptz NOT NULL                                                                                                                                                                                                                                                                                                                                      | definition_id references admin_diagnostic_definition_versions(id); actor_person_id references auth.users(id); job_id references platform_private.jobs(id); target type/id validated against owning projection; no generic FK                                    | INDEX target_type, target_id, target_version; INDEX definition_id, definition_version, created_at DESC; INDEX state, freshness_at; UNIQUE definition_id, definition_version, target_type, target_id, started_at                               | RLS forced; diagnostic RPC and worker only; read projection requires diagnostic capability; result evidence is reference-only and never a secret or payload copy               |

### Permission, RLS and grants

The Worker receives EXECUTE only on admin_inbox, admin_search,
admin_bulk_action, admin_capability_action and admin_audit_diagnostic RPCs.
Security-definer functions set an empty fixed search path, qualify every
object and derive RequestContext from verified session or service binding.

Inbox RLS filters source rows by current capability, resource scope, grant
term and freshness. Search RLS filters entity types and fields before query
planning and rechecks each result before serialization. Bulk RLS checks the
actor capability for each manifest item; a revoked grant blocks new leases.
Grant RLS ensures a grantor's action/resource set is a subset of its own
current grant and that elevated/purpose grants have MFA, distinct approval
and notification evidence. Audit and diagnostic RLS check exact target scope
and never widen access because a link exists.

## Middleware & Policies

### Hono middleware order

Every route runs request-id, TLS/method/CORS/security headers, size and content
guards, session or service principal, acting-party context, CSRF for cookie
mutations, strict Zod validation, capability/schema authorization, rate
limiting, idempotency lookup for mutations, handler/RPC, transaction/outbox
and ApiError normalization. Search policy runs before SQL construction.
Bulk item policy runs again inside each lease transaction.

### Per-operation authorization matrix

| Operation ID | Principal and capability                                                                 | Ownership and scope predicate                                                                 | Commit or response recheck                                                              | Denial result                                                                               |
| ------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| CFG-05B-01   | Admin operator with one or more current named task capabilities                          | Task source, class, assignee and acting party are within grant scope                          | Re-read source version/freshness before action affordance; inbox never completes source | No current capability 403; hidden source is omitted and aggregate marked partial or unknown |
| CFG-05B-02   | Admin operator with entity-specific read capability                                      | Entity type, requested fields, filters, sort and snippet policy are all registered and scoped | Recheck authorization per result and count policy before serialization                  | Schema outside grant 403 or 422; protected result/count suppressed without leak             |
| CFG-05B-03   | Admin operator with command capability per target and step-up if required                | Frozen target ID/version and command registry scope match actor grants                        | Lock operation; recheck manifest hash and grant before every item lease                 | Hidden target 404; visible target without command 403; target version 409                   |
| CFG-05B-04   | Grantor capable of all requested actions/resources; distinct approver for elevated grant | Named subject, resource UUID, scope, term and purpose are within grantor authority            | Lock grant; recheck grantor, approver, MFA and target before insert/revoke              | Hidden grant 404; overreach, wildcard or stale grant 403/422                                |
| CFG-05B-05   | Audit operator or diagnostic operator for exact target/definition                        | Audit link or diagnostic version and target are in capability scope                           | Recheck link owner and definition version; dependency freshness before healthy result   | Hidden target/definition 404; visible but unauthorized 403; unavailable 503 unknown         |

### Security and abuse controls

- Inbox source failures never become a zero count. The response carries
  freshness, partialSources and generatedAt, and the UI can distinguish
  loading, stale, partial, unknown, healthy, empty and failed.
- Search is a registered projection query. It allows no caller column, table,
  SQL, expression, function, snippet source or unrestricted text search.
  Minimum-count policy and per-result authorization execute before a count,
  facet, snippet or total is returned.
- Bulk manifests are stored as protected objects and hash-bound to command,
  version and exact target rows. Execution cannot broaden the target set.
  Capability revocation stops new items; completed items remain audited.
- Grants use least privilege, explicit resource UUID, named action, finite
  term, separate approver for elevated actions, fresh MFA and notification.
  Purpose grants name one mechanical recovery object and cannot grant or
  revoke capabilities.
- Audit links are identifiers only. Search, inbox and diagnostics do not
  copy private payload, evidence, credentials, secrets or financial details.
- Diagnostic definitions are code-owned, input and output schemas are bounded,
  and stale/unavailable dependencies produce unknown. A result cannot
  authorize a repair or change business truth.
- Rate counters are keyed by verified user and acting party, not caller
  fields. Trace/log fields are IDs, versions and codes only.

## Data Flow

### Transaction and external seams

| Operation ID | Canonical transaction                                                                                                                                             | External seam request and response                                                                                                                                               | Timeout, retries and circuit breaker                                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CFG-05B-01   | Read capability-filtered task projection with freshness; annotate partial dependencies; no source mutation                                                        | Task projection adapter request: capability scope, classes, cursor and at time. Response: task IDs, source IDs/versions, status and freshness.                                   | 2,000 ms per provider, 1 retry at 250 ms for safe read; circuit after 5 consecutive failures for 60 s; route deadline 8,000 ms. Failed source yields partial or unknown.     |
| CFG-05B-02   | Validate search registry and policy; query indexed projection; authorize results and aggregate before response                                                    | Search adapter request: registered entity type, field list, normalized filters, sort and cursor. Response: safe IDs/versions/fields and count state.                             | 2,000 ms, 1 retry at 250 ms for read-only query; circuit 5/60 s; route deadline 8,000 ms; no fallback count on timeout.                                                      |
| CFG-05B-03   | Preview stores exact manifest and dry-run report; run locks operation, leases one item, executes ordinary command, records item result and cursor; outbox summary | Command adapter request: command key/version, target type/id/expected version, item idempotency and correlation. Response: succeeded or typed failure with resulting version.    | Worker attempt timeout 2,000 ms; 3 retries at 15/60/300 s only for retryable command; circuit 5/60 s per adapter; three attempts then DLQ and partial state.                 |
| CFG-05B-04   | Lock grant or target grant; validate subset authority, MFA, approval and term; append grant/revoke, notification intent, audit and outbox                         | Notification adapter request: grant ID, subject and event type with no capability payload. Response: notification receipt or accepted queue ID.                                  | 2,000 ms, 3 retries at 15/60/300 s; circuit 5/60 s; grant commit does not roll back on notification ambiguity, task remains pending.                                         |
| CFG-05B-05   | Audit read selects minimal link projection; diagnostic run locks definition, records run and leases provider; result stores evidence reference and freshness      | Diagnostic adapter request: definition key/version, bounded input, target type/id/version and correlation. Response: state, result codes, evidence reference and completed time. | Definition timeout is 100..2,000 ms from stored contract; one provider attempt, no retry for non-idempotent checks; circuit 5/60 s; route deadline 15,000 ms for queued run. |

All queue and provider deliveries are at-least-once and carry operation
idempotency. Unknown provider outcome remains pending or unknown. A worker
crash after an item commit is reconciled by the item idempotency key and
cannot repeat a non-idempotent command.

### State machine and concurrency

| Aggregate             | Allowed transitions and guards                                                           | Concurrent or failure behavior                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin task projection | open to assigned to blocked or completed; any state may become unknown on source failure | Source version and capability recheck on action; projection lag marks stale/partial and source remains authoritative.                          |
| Capability grant      | pending to active to expired or revoked                                                  | Grant and revoke use row lock and CAS; revoke is immediate, cached sessions and in-flight commits recheck; no restoration without a new grant. |
| Bulk operation        | draft to dry_run to approved to running to completed or partial or failed or cancelled   | Exact ordered manifest and cursor are immutable. Lease claim is CAS; revoked grant stops future leases; cancel preserves completed items.      |
| Bulk item result      | pending to succeeded or failed or skipped or cancelled                                   | Unique operation/target prevents duplicate command. Version mismatch skips or fails only that item; retry count max three.                     |
| Diagnostic run        | unknown to running to healthy or stale or failed                                         | Timeout/unavailable becomes unknown; stale target/checker becomes stale; duplicate run returns existing idempotent run.                        |

Bulk preview returns a dry-run ID, manifest hash, eligibility and bounded
impact report. Run accepts only that dry-run ID and exact hash. Each item calls
the ordinary guarded command with operation correlation; a broad search never
repopulates targets. Grant revocation is checked at lease acquisition and
commit. Completed authorized effects remain and require an explicit
compensating command.

## Event Schemas

Each event uses the BE00 identifier-only envelope: eventId uuid, eventType
literal, occurredAt timestamptz, requestId uuid, correlationId uuid,
actorRef uuid nullable, aggregateId uuid, aggregateVersion bigint and the
strict payload below. No grant actions, audit payload, target data or diagnostic
evidence is emitted.

```ts
export const AdminCapabilityChangedV1 = z.strictObject({
  grantId: z.uuid(),
  subjectPersonId: z.uuid(),
});

export const AdminBulkChangedV1 = z.strictObject({
  bulkOperationId: z.uuid(),
});

export const QualityDiagnosticChangedV1 = z.strictObject({
  diagnosticRunId: z.uuid(),
});
```

| Event type                    | Producer operation | Payload and consumer rule                                                                                             |
| ----------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| admin.capability.changed.v1   | CFG-05B-04         | grantId and subjectPersonId; authorization consumers refetch current grant and never treat event as permission proof. |
| admin.bulk.changed.v1         | CFG-05B-03         | bulkOperationId; admin projections refetch summary and item states by authorized route.                               |
| quality.diagnostic.changed.v1 | CFG-05B-05         | diagnosticRunId; health projections refetch state and freshness; unknown remains unknown until evidence is available. |

## Error Handling

### Boundary mapping

| Boundary             | Typed internal failure                                                            | HTTP and ApiError code                                                                          | State guarantee                                                                     |
| -------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Query/body schema    | Unknown entity field, filter, sort, action or key                                 | 400 INVALID_REQUEST or 422 SEARCH_FIELD_NOT_ALLOWED                                             | No query, grant or mutation begins.                                                 |
| Auth/session         | Missing, expired or invalid session                                               | 401 UNAUTHENTICATED                                                                             | No projection or target existence is exposed.                                       |
| Capability/scope/MFA | Visible target outside action grant, expired grant or missing step-up             | 403 FORBIDDEN or 401 STEP_UP_REQUIRED                                                           | No mutation or item lease.                                                          |
| Target visibility    | Source, grant, audit or diagnostic target hidden                                  | 404 NOT_FOUND                                                                                   | No existence, count, snippet or payload leakage.                                    |
| Version/idempotency  | Manifest, grant, definition or target changed                                     | 409 VERSION_CONFLICT, MANIFEST_CONFLICT or IDEMPOTENCY_CONFLICT                                 | Transaction rolls back; completed prior items remain separately evidenced.          |
| Domain safety        | Wildcard, overreach, non-registered command, protected count or purpose violation | 422 COMMAND_NOT_ALLOWED, COUNT_SUPPRESSED or GRANT_INVALID                                      | No grant, query response or bulk execution.                                         |
| Provider/worker      | Timeout, unavailable source or diagnostic                                         | 503 TASK_SOURCE_UNAVAILABLE, SEARCH_UNAVAILABLE or DIAGNOSTIC_UNAVAILABLE; 504 UPSTREAM_TIMEOUT | Projection is partial/unknown; diagnostic is unknown; bulk remains pending/partial. |
| Unexpected           | Unclassified exception                                                            | 500 INTERNAL_ERROR                                                                              | No partial transaction; request ID and safe operation code logged.                  |

### Operation error coverage

| Operation ID | Required edge cases and recovery                                                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CFG-05B-01   | Failed or lagging dependency, stale task, source version disagreement and absent capability; card/aggregate is partial or unknown and source refreshes.                                                     |
| CFG-05B-02   | Off-schema field/filter/sort, unauthorized result, protected snippet, count side channel, cursor exhaustion and search outage; reject or suppress safely.                                                   |
| CFG-05B-03   | Raw SQL/expression/unregistered command, changed target, duplicate target, manifest drift, revoked capability, worker crash and cancel; exact item failure, stop new leases and preserve completed results. |
| CFG-05B-04   | Wildcard action/resource, missing end, grantor overreach, self approval, stale MFA, purpose grant with grant/revoke action and immediate revoke; no grant or session continuation.                          |
| CFG-05B-05   | Missing link, unavailable diagnostic dependency, timeout, stale input, unknown definition version and false healthy result; 404/503 or unknown/stale evidence, never automatic repair.                      |

## Observability

| Operation ID | Required structured event and metrics                                                                                                                          | Trace and redaction                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| CFG-05B-01   | admin.inbox.read with actor hash, task count state, partial source count, freshness and outcome; stale/unknown source and latency metrics                      | Trace source adapters and RLS; no task payload, protected title or hidden count                            |
| CFG-05B-02   | admin.search.completed with entity type, result count state, field count, filter count and outcome; rejected schema, suppressed-count and latency metrics      | Trace registry, query and per-item policy; no query values, snippets, private IDs or protected facets      |
| CFG-05B-03   | admin.bulk.changed with bulk ID, command key/version, state, manifest hash, counts and outcome; item retry, mismatch, revoke-stop and DLQ metrics              | Trace lease and command adapter; target IDs may be salted/hashed, no raw command args or content           |
| CFG-05B-04   | admin.capability.changed with grant ID, subject hash, capability key hash, resource type, term and state; grant/revoke, denial and expiry metrics              | Trace grant policy and notification; no scope payload, reason text, token or grant secret                  |
| CFG-05B-05   | quality.diagnostic.changed with run ID, definition key/version, target type, state, freshness and result-code count; unknown/stale/healthy and timeout metrics | Trace definition lookup and provider; evidence bytes, target payload and private audit fields are excluded |

Logs use BE00 severity, environment, release, service, operation, outcome,
latency, requestId and correlationId. provider-native diagnostic sinks receive scrubbed exception
metadata. Health metrics distinguish healthy, stale, partial, unknown, failed
and empty; no absent card or missing provider is silently counted as healthy.

## Testing Strategy

### Contract and route tests

| Operation ID | Contract and route acceptance tests                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CFG-05B-01   | Validate cursor, 1..50 page, task enums and freshness; assert capability-filtered source/version rows, partial/unknown states, explicit CORS and ApiError envelope.       |
| CFG-05B-02   | Reject unknown fields, filters, sorts and oversized values; assert per-result auth before snippets, minimum-count suppression, cursor bounds and no search SQL injection. |
| CFG-05B-03   | Assert unique exact manifest, command registry, dry-run hash binding, 500-target cap, action requirements, 202 queue response, per-item states and idempotent replay.     |
| CFG-05B-04   | Assert no wildcard, finite term, subset authority, distinct approver, purpose grant restrictions, MFA and 403/404 hiding; replay create/revoke safely.                    |
| CFG-05B-05   | Assert read-audit and run-diagnostic branch requirements, definition/version binding, evidence reference projection, timeout unknown and stale semantics.                 |

### Authorization, persistence and concurrency tests

- For every operation test anonymous, wrong valid user, wrong party, forged
  resource, expired/revoked grant, missing/stale MFA, hidden target and stale
  target version. Match the exact 401, 403, 404, 409 and 422 matrix.
- Verify direct table access is denied to anon and authenticated. Positive and
  negative RLS/RPC tests cover admin operator, support operator, privacy/legal
  operator, release/diagnostic operator and service principal boundaries.
- Run concurrent grant create/revoke and assert one current state, immediate
  revocation and no cached commit. Run two identical bulk requests and assert
  one operation, one item command and identical replay response.
- Change a target after dry run and assert only that item fails with version
  mismatch. Revoke capability while leases are in flight and assert no new
  item starts while completed items retain audit evidence.
- Make an inbox source lag, search provider fail and diagnostic dependency
  timeout. Assert partial, unknown or stale state rather than zero or healthy.

### Security, performance and recovery tests

- Fuzz search filters, sort keys, snippets, JSON scopes, grant action names,
  command keys and diagnostic inputs. Confirm parameterized queries, bounded
  payloads, no code/SQL/expression injection and no secret in logs or events.
- Prove a wrong capability cannot infer protected existence through count,
  facet, result order, snippet, task absence or audit link.
- Measure bounded read p95 below BE00 read limits and command route deadline.
  Assert per-user and per-party rate buckets, 500 target cap and three worker
  attempts with 15/60/300 second backoff before DLQ.
- Simulate provider timeout, duplicate event, worker crash after commit,
  queue redelivery, notification ambiguity and circuit open. Assert idempotent
  recovery and truthful pending/unknown/partial state.
- Verify cancellation stops future bulk leases, completed effects persist,
  compensation is explicit, diagnostic stale evidence expires and no
  diagnostic result invokes high-risk repair.

### Accessibility handoff tests

The FE companion must render the response freshness/state vocabulary as text
and semantic status: loading, stale, partial, unknown, healthy, empty and
failed. Inbox cards expose required capability and due/severity text. Search
results and suppressed counts do not rely on color. Bulk UI provides dry-run
summary, per-item state/error/retryability and downloadable accessible report.
Grant UI announces expiry/timezone and step-up context. Diagnostic UI names
exact checker, target, version, finding severity and runbook/manual fallback.

## Deepening Passes

| Pass                   | Resulting hardening                                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Micro contract pass    | Added strict action branches, bounded cursor/list/input values, finite grant terms, duplicate-target detection and aggregate count state.     |
| Boundary pass          | Separated derived task/search/audit projections from owning domain truth and kept command execution behind registered RPCs.                   |
| Authorization pass     | Added per-result/count policy, exact resource UUID, grantor subset check, distinct approval, MFA and immediate revocation.                    |
| Failure/recovery pass  | Added partial/unknown/stale states, exact manifest/cursor, item idempotency, queue retry/DLQ and diagnostic false-health prevention.          |
| Data pass              | Typed every field, constraint, FK or polymorphic registry rationale, index, RLS predicate and named grant.                                    |
| Macro consistency pass | Reconciled five 25.08 features, five interactions, seven models including BulkItemResult and three exact event types with 05a/05c boundaries. |

## Ambiguity Gate

PASS. Evidence:

- Micro: CFG-05B-01 through CFG-05B-05 each has strict request and success
  schemas, exact ApiError/status mapping, 403/404 rule, rate limit,
  idempotency and operation-keyed tests.
- Macro: all five 25.08 ledger rows, five interactions, six canonical model
  names, one supporting BulkItemResult and three event types map once; 05a
  and 05c ownership is explicit.
- External seams: inbox, search, command, notification and diagnostic
  adapters specify exact request/response, timeout, retry/backoff and circuit
  behavior. Unknown outcomes remain typed pending, partial or unknown.
- Persistence: every table field has SQL type, nullability, constraint,
  foreign key or registry validation, index, forced RLS and grant boundary.
- Transport: every registry row names CORS and exact BE00
  ApiError { code, message, requestId, details }.
- Tables: Markdown table widths were checked after authoring; cells contain
  no unescaped pipe separators.
- No unresolved gap, hidden authorization rule or undecided choice
  remains in this split.

## Open Questions

None.

## Changelog

| Date       | Change                                                                                                              | Workflow             | Sections affected                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------- |
| 2026-08-28 | Authored 05b backend contracts from approved Shard 05 IA and deep dive; reconciled 25.08.01 through 25.08.05        | /write-be-spec       | All                                      |
| 2026-08-28 | Added strict admin projections, manifest-bound bulk, least-privilege grants, diagnostic evidence and recovery tests | /write-be-spec-write | API, database, middleware, events, tests |

## Dependency References

- BE00 Cross-cutting platform foundation: ApiError, RequestContext,
  idempotency, jobs, outbox, logging, SLOs and recovery.
- Shard 01 Identity authority and party governance: session, acting-party,
  capability context and MFA freshness.
- Shard 03 CMS content modeling and authoring: content source projections,
  revision IDs and ordinary guarded commands.
- Shard 04 CMS navigation, media and delivery: navigation/media projections,
  version checks and delivery diagnostics.
- Shard 05a settings, flags and runtime: configuration task and diagnostic
  producers; settings remain outside admin search truth.
- Shard 06 Trust and safety: security audit, cases, evidence and legal
  restrictions; this split stores links, not protected source payload.
