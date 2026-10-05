# BE 05a — Settings, flags and runtime governance

## Split Group

This companion is the backend contract for Shard 05 settings and runtime governance.
It owns CFG-01 through CFG-07 and the 25.07 feature family:

- 25.07.01 Settings Definition Registry
- 25.07.02 Scope, Inheritance & Effective Values
- 25.07.03 Change Approval, Versioning & Rollback
- 25.07.04 Feature Flags, Experiments & Kill Switches
- 25.07.05 Secrets & Runtime Configuration Boundary

CFG-08 through CFG-12 are owned by 05b. CFG-13 and CFG-14 are owned by 05c.
Shard 03 and Shard 04 remain canonical owners of CMS content and delivery
records; this file provides typed configuration inputs and never promotes a
setting, flag, experiment or switch into content, authorization, rights,
financial, legal, evidence or transactional truth.

## Settings editor authority projection (2026-10-02)

The authority to edit a setting is the immutable `ownerCapability` of its
definition version (Cfg05a01). CFG-05A-03 requires the acting party to hold
exactly that capability, and the database re-checks it inside the proposal
transaction. Approval, release and rollback (CFG-05A-04) are authorized by the
named capabilities `settings.approve`, `settings.release` and
`settings.rollback`. No capability alias, role label or response header carries
any of this authority.

- **Projection.** CFG-05A-02 returns the definition version's `ownerCapability`
  in `Cfg05a02EffectiveValueResponse`. It is a capability name only, safe to
  disclose to any caller that can already read the definition.
- **Client derivation.** The web tier decides the edit affordance server-side:
  the actor may edit the definition when `ownerCapability` is in the actor's
  CFG-05B-07 capability snapshot (the `admin.*` and `settings.*` projection in
  05b). The approve, release and rollback affordances are enabled by
  `settings.approve`, `settings.release` and `settings.rollback` in that same
  snapshot. An owner capability outside the `admin.*` and `settings.*`
  namespaces cannot appear in the snapshot, so the edit affordance stays
  read-only; that is a fail-closed rendering choice, never a grant.
- **Enforcement.** The affordance only selects what the UI renders. The Worker
  and the database enforce `ownerCapability` (propose) and the named
  `settings.*` capability (action) on every write regardless of what any client
  rendered or sent. A forged or stale affordance yields 403 `FORBIDDEN`.
- **Unavailable projection.** When the capability snapshot or the effective
  read is unavailable, no editor, approver, release or rollback affordance
  renders.

## Classification

| IA interaction | Operation ID | Backend classification | Authority and completion |
|---|---|---|---|
| CFG-01 Register setting definition | CFG-05A-01 | Protected command plus immutable registry write | Code or contract release principal creates a never-reused definition; an admin session cannot mint a key. |
| CFG-02 Resolve effective value | CFG-05A-02 | Bounded authenticated query with deterministic resolver | PostgreSQL definition and value versions are authoritative; response includes safe provenance and evaluator version. |
| CFG-03 Propose setting change | CFG-05A-03 | Protected draft command | A named settings editor creates a validated, no-effect candidate with a frozen impact preview. |
| CFG-04 Approve, schedule, activate or rollback | CFG-05A-04 | Protected state-transition command and outbox transaction | Distinct approval, MFA, current context and optimistic version are checked in one commit; rollback is a new version. |
| CFG-05 Manage release flag | CFG-05A-05 | Protected versioned release-control command | Release availability only; fallback and expiry are mandatory and authorization is evaluated first. |
| CFG-06 Run experiment | CFG-05A-06 | Protected versioned allocation command and assignment query | Allowlisted non-protected dimensions, consent, deterministic sticky assignment and stop rules are required. |
| CFG-07 Activate kill switch | CFG-05A-07 | Emergency protected command plus signed runtime snapshot | Named switch, declared scope, step-up, reason and impact confirmation activate only a precompiled safe fallback. |

## Referenced Material Inventory

| Source | Sections and exact lines | Use in this companion |
|---|---|---|
| .memory/wiki/specs/ia/05-platform-configuration-admin.md | title, links and scope lines 1-22 | Confirms the parent boundary, three-way split and approved source. |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md | Features and acceptance criteria lines 24-45 | Binds feature IDs 25.07.01 through 25.07.05 and failure-safe behavior for CFG-01 through CFG-07. |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md | Interactions and global rules lines 47-71 | Supplies the exact interaction identifiers, protected-setting boundary and deferred enterprise administration. |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md | Contracts lines 73-106 | Supplies value kinds, scope and merge rules, risk classes, approval, flag, experiment, switch and secrets exclusions. |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md | Data Models and typed registry lines 108-152 | Supplies the six assigned canonical model names and field typing rules. |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md | Access Control and escalation lines 154-187 | Supplies actor capabilities, commit-time rechecks and no-override escalation. |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md | Event Schemas lines 199-211 | Supplies the three assigned event identifiers and identifier-only payloads. |
| .memory/wiki/specs/ia/05-platform-configuration-admin.md | Edge cases and matrix lines 213-258 | Supplies rejection, outage, stale-owner, cohort and version-mismatch recovery tests. |
| .memory/wiki/specs/ia/deep-dives/05-platform-configuration-admin.md | scope and deepening record lines 1-18 | Confirms the converged boundary and adversarial decisions. |
| .memory/wiki/specs/ia/deep-dives/05-platform-configuration-admin.md | canonical settings models lines 20-33 | Expands definition, value, review, approval, flag, experiment and switch fields. |
| .memory/wiki/specs/ia/deep-dives/05-platform-configuration-admin.md | state machines and effective resolution lines 57-79 | Locks transitions, precedence, compatibility fallback and diagnostic behavior. |
| .memory/wiki/specs/ia/deep-dives/05-platform-configuration-admin.md | activation, flags and experiments lines 81-96 | Locks approval hashes, signed snapshots, deterministic assignment and safe fallback. |
| .memory/wiki/specs/ia/deep-dives/05-platform-configuration-admin.md | cross-shard and implementation envelope lines 147-162 | Locks PostgreSQL RLS, Hono/Zod, outbox and queue boundaries. |
| .memory/wiki/specs/feature-ledger.md | Shard 05 rows lines 771-775 | Reconciles every assigned feature ledger row to an operation and test surface. |
| .memory/wiki/specs/be/00-infrastructure.md | inventory, ApiError and contracts lines 22-41 and 112-138 | Inherits the BE00 request context, strict Zod 4 and exact ApiError wire contract. |
| .memory/wiki/specs/be/00-infrastructure.md | database, middleware, jobs and provider boundaries lines 202-365 | Inherits private schema, RLS, middleware order, idempotency, queue retry and provider circuit rules. |
| .memory/wiki/specs/be/00-infrastructure.md | errors, observability, tests and ambiguity lines 416-534 | Inherits status mapping, scrubbed telemetry, recovery tests and quality gates. |
| .memory/wiki/specs/2026-08-02-architecture-design.md | stack and security decisions lines 157-167, 296-316 and 348-370 | Confirms Hono on Workers, Supabase PostgreSQL, signed runtime boundary, structured logs and server-derived authorization. |
| .memory/wiki/specs/2026-08-02-architecture-design.md | integration and API security lines 495-502 and 707-765 | Confirms typed provider seams, no caller tenant authority, secrets exclusion and Zod/allowlist requirements. |
| .memory/wiki/specs/data-placement-strategy.md | placement and isolation lines 13-16, 23-32, 42-52 and 120-130 | Confirms PostgreSQL authority, Auth credential separation, Storage boundary and RLS-derived acting context. |
| .memory/wiki/specs/ENGINEERING-STANDARDS.md | contract, bound, security and migration lines 35-50, 92-101, 149-188 | Sets strict validation, 256 KiB body, 50-row list, endpoint-test and RLS-test floors. |

## IA Source Map

| Exact source item | 05a ownership | Backend realization |
|---|---|---|
| CFG-01 Register setting definition | Owned | CFG-05A-01, cfg_setting_definition_versions and the immutable-key RPC. |
| CFG-02 Resolve effective value | Owned | CFG-05A-02, explicit scope candidates, precedence, merge and provenance resolver. |
| CFG-03 Propose setting change | Owned | CFG-05A-03, cfg_setting_value_versions and cfg_config_change_reviews in draft state. |
| CFG-04 Approve/schedule/activate/rollback | Owned | CFG-05A-04, cfg_config_approvals, CAS transition, outbox and snapshot intent. |
| CFG-05 Manage release flag | Owned | CFG-05A-05 and cfg_feature_flag_versions. |
| CFG-06 Run experiment | Owned | CFG-05A-06 and cfg_experiment_versions with sticky assignment policy. |
| CFG-07 Activate kill switch | Owned | CFG-05A-07, cfg_kill_switch_versions and cfg_kill_switch_activations. |
| SettingDefinitionVersion | Owned | One immutable version row per definition release. |
| SettingValueVersion | Owned | One typed value version per permitted scope and interval. |
| ConfigChangeReview | Owned | Frozen candidate and impact manifest review aggregate. |
| FeatureFlagVersion | Owned | Release availability version and fallback. |
| ExperimentVersion | Owned | Consent-bound experiment version and allocation. |
| KillSwitchVersion | Owned | Predeclared runtime-safe switch version. |
| ConfigApproval | Supporting deep-dive model, owned | Review approval evidence; persisted in cfg_config_approvals. |
| KillSwitchActivation | Supporting deep-dive model, owned | Emergency activation evidence; persisted in cfg_kill_switch_activations. |
| config.setting.activated.v1 | Owned event | Identifier-only outbox event after activation commit. |
| config.flag.changed.v1 | Owned event | Identifier-only outbox event after flag version transition. |
| config.kill-switch.changed.v1 | Owned event | Identifier-only outbox event after activation or resolution. |
| CFG-08 through CFG-12 | Excluded | 05b owns admin tasks, search, bulk, capability, audit and diagnostics. |
| CFG-13 through CFG-14 | Excluded | 05c owns portability, quality and lifecycle actions. |

## Feature Ledger Coverage

| Feature ledger ID | Feature | Operation coverage | Acceptance evidence |
|---|---|---|---|
| 25.07.01 | Settings Definition Registry | CFG-05A-01 | Definition schema, immutable key rule, protected exclusions, registry/RLS tests. |
| 25.07.02 | Scope, Inheritance & Effective Values | CFG-05A-02 and CFG-05A-03 | Explicit scopes, precedence, merge, provenance, fallback and no ambient hierarchy tests. |
| 25.07.03 | Change Approval, Versioning & Rollback | CFG-05A-03 and CFG-05A-04 | Frozen hash, distinct approvers, MFA, CAS, atomic activation, forward-only rollback tests. |
| 25.07.04 | Feature Flags, Experiments & Kill Switches | CFG-05A-05 through CFG-05A-07 | Safe fallback, protected-dimension denial, deterministic assignment and signed snapshot tests. |
| 25.07.05 | Secrets & Runtime Configuration Boundary | CFG-05A-01, CFG-05A-04 and CFG-05A-07 | Secret-like values and security controls reject; snapshots contain no secrets; outage fallback reconciles. |

## Endpoint Completeness Reconciliation

The seven assigned IA interactions each have exactly one route registry entry,
one request schema, one success schema, one error row, one authorization row,
one idempotency/rate/telemetry row and one test row below. CFG-05A-04 is one
command route with an action discriminant so approval, scheduling, activation
and rollback share the same review CAS boundary. Resolution is a read route;
it does not accept caller-supplied schema, precedence or scope policy.

No BE00 upload, webhook, generic job or authentication route is duplicated.
The snapshot compiler and runtime reader are provider seams behind CFG-05A-04
and CFG-05A-07, not public endpoints. Flags never participate in endpoint
authorization or RLS.

## Shared Contract Inheritance

Every route inherits BE00:

1. request ID is generated at the edge and carried in RequestContext;
2. transport guard, exact first-party CORS, body and URL ceilings run before auth;
3. strict Zod 4 path, query, header and body parsing precedes resource lookup;
4. Supabase Auth session and server-derived acting party are required where the
   route is human-authenticated; release and runtime principals use mTLS or a
   Worker service binding with an allowlisted key ID;
5. capability, ownership, scope, MFA and target-version policy is evaluated
   before the handler and repeated by a transaction-owned RPC;
6. idempotency is stored in BE00's private idempotency record for mutations;
7. normalized failures use exactly ApiError { code, message, requestId, details };
8. no settings value, flag cohort, experiment dimension or runtime snapshot
   may contain credentials, secrets, tokens, private evidence, executable code
   or HTML.

The common BE00 envelope is a strict four-field wire object. details is
bounded to 16 keys, four nesting levels and 8 KiB; safe validation locations
only are exposed.

## API Endpoints

### Route Registry

| Operation ID | IA interaction | Method and path | Auth and capability | Request contract | Success contract | Error contract | Idempotency and rate | CORS and middleware |
|---|---|---|---|---|---|---|---|---|
| CFG-05A-01 | CFG-01 Register setting definition | POST /api/v1/internal/config/definitions | Release service principal; no browser session; registry-release scope | Cfg05a01RegisterDefinitionRequest | Cfg05a01DefinitionResponse 201 | ApiError { code, message, requestId, details }; 400 or 409 or 422 | Idempotency-Key required; 30/min per release principal; 15s deadline | CORS non-browser service allowlist; BE00 request-id, raw guard, strict Zod, principal, rate and ApiError normalization |
| CFG-05A-02 | CFG-02 Resolve effective value | GET /api/v1/config/{key}/effective | Authenticated consumer or approved Worker consumer; definition-read scope | Cfg05a02EffectiveValueQuery plus key path | Cfg05a02EffectiveValueResponse 200; pagination N/A because this is one effective-value/provenance projection with no top-level collection; typedValue nested JSON is bounded at depth 8, 64 array items per array, 64 object keys per object and 65,536 serialized bytes | ApiError { code, message, requestId, details }; 401 or 404 or 422 or 503 | No mutation key; 300/min user and 600/min party; 8s deadline | CORS first-party read allowlist; BE00 request-id, strict query, session/context, capability, read rate and ApiError normalization |
| CFG-05A-03 | CFG-03 Propose setting change | POST /api/v1/admin/settings/{definitionId}/changes | Settings editor on definition scope; step-up for high or emergency | Cfg05a03ProposeChangeRequest | Cfg05a03ChangeResponse 201 | ApiError { code, message, requestId, details }; 403 or 404 or 409 or 422 | Idempotency-Key required; 60/min user and 120/min party; 15s deadline | CORS first-party admin allowlist; BE00 session, context, CSRF, strict Zod, capability, rate, transaction and ApiError normalization |
| CFG-05A-04 | CFG-04 Approve/schedule/activate/rollback | POST /api/v1/admin/settings/changes/{reviewId}/actions | Configuration approver, release manager or rollback authority by action; distinct actor and fresh MFA | Cfg05a04ChangeActionRequest | Cfg05a04ChangeActionResponse 200 or 202 | ApiError { code, message, requestId, details }; 403 or 404 or 409 or 422 or 503 | Idempotency-Key required; 30/min user and 60/min party; 15s route deadline, queued snapshot | CORS first-party admin allowlist; BE00 session, CSRF, strict Zod, step-up, capability, rate, RPC and ApiError normalization |
| CFG-05A-05 | CFG-05 Manage release flag | POST /api/v1/admin/flags/{flagId}/actions | Release manager for every named environment | Cfg05a05FlagActionRequest | Cfg05a05FlagActionResponse 200 or 201 | ApiError { code, message, requestId, details }; 403 or 404 or 409 or 422 | Idempotency-Key required; 60/min user and 120/min party; 15s deadline | CORS first-party admin allowlist; BE00 session, CSRF, strict Zod, capability, rate and ApiError normalization |
| CFG-05A-06 | CFG-06 Run experiment | POST /api/v1/admin/experiments/{experimentId}/actions | Experiment operator for the experiment owner scope | Cfg05a06ExperimentActionRequest | Cfg05a06ExperimentActionResponse 200 or 201 | ApiError { code, message, requestId, details }; 403 or 404 or 409 or 422 | Idempotency-Key required; 30/min user and 60/min party; 15s deadline | CORS first-party admin allowlist; BE00 session, CSRF, strict Zod, capability, rate and ApiError normalization |
| CFG-05A-07 | CFG-07 Activate kill switch | POST /api/v1/admin/kill-switches/{switchId}/activate | Incident operator for that predeclared switch; fresh MFA and step-up | Cfg05a07KillSwitchActivationRequest | Cfg05a07KillSwitchActivationResponse 200 or 202 | ApiError { code, message, requestId, details }; 401 or 403 or 404 or 409 or 422 or 503 | Idempotency-Key required; 10/min user and 20/min party; 15s route deadline, local fallback path | CORS first-party admin allowlist; BE00 session, CSRF, strict Zod, step-up, capability, rate and ApiError normalization |

### Registry invariants

- Path literals are build-time registered and OpenAPI-generated from this table.
- Human mutations require same-origin and CSRF checks; service principal
  registration requires a Worker service binding and key ID allowlist.
- A route never accepts caller-provided actor, tenant, party, precedence,
  authorization, RLS, legal, money or rights truth.
- Every response is a named projection. Internal schema, hashes, private
  cohorts and signed snapshot bytes are not returned.
- 404 is disclosure-safe for an inaccessible target. 403 is returned only
  after the server has established that the target is visible but the actor
  lacks the required action, or when policy explicitly allows a non-disclosing
  capability failure. The operation matrix below fixes the choice per route.

### Operation contract and error matrix

| Operation ID | Request and success | Error codes and status | 403 versus 404 |
|---|---|---|---|
| CFG-05A-01 | RegisterDefinitionRequest to DefinitionResponse; key, value kind, schema and policy are strict | INVALID_REQUEST 400; DEFINITION_KEY_REUSED 409; PROTECTED_SETTING 422; INVALID_DEFINITION 422; RATE_LIMITED 429; INTERNAL_ERROR 500 | Service principal is authenticated; malformed or forbidden registry class is 422, never a resource lookup. |
| CFG-05A-02 | EffectiveValueQuery to EffectiveValueResponse with one typed value, the definition's `ownerCapability` and provenance projection; pagination is N/A; typedValue permits nested arrays of at most 64 items, objects of at most 64 keys, maximum depth 8 and 65,536 serialized bytes | UNAUTHENTICATED 401; DEFINITION_NOT_FOUND 404; DISALLOWED_CONTEXT 422; VALUE_UNAVAILABLE 503; RATE_LIMITED 429 | Unknown or inaccessible key is 404; known key with a consumer that lacks read capability is 403 only when disclosure is already permitted, otherwise 404. |
| CFG-05A-03 | ProposeChangeRequest to ChangeResponse in draft state | UNAUTHENTICATED 401; FORBIDDEN 403; DEFINITION_NOT_FOUND 404; STALE_DEFINITION 409; VALUE_INVALID 422; RATE_LIMITED 429 | Definition hidden by scope is 404; visible definition outside grant is 403. |
| CFG-05A-04 | ChangeActionRequest to ChangeActionResponse; active transition may be 202 while snapshot work is queued | UNAUTHENTICATED 401; FORBIDDEN 403; REVIEW_NOT_FOUND 404; VERSION_CONFLICT 409; APPROVAL_INVALID 422; SNAPSHOT_UNAVAILABLE 503 | Hidden review is 404; visible review with insufficient action, stale MFA or missing authority is 403. |
| CFG-05A-05 | FlagActionRequest to FlagActionResponse with version and fallback | UNAUTHENTICATED 401; FORBIDDEN 403; FLAG_NOT_FOUND 404; VERSION_CONFLICT 409; FLAG_INVALID 422; RATE_LIMITED 429 | Hidden flag is 404; visible flag outside named environment or capability is 403. |
| CFG-05A-06 | ExperimentActionRequest to ExperimentActionResponse with version and assignment policy | UNAUTHENTICATED 401; FORBIDDEN 403; EXPERIMENT_NOT_FOUND 404; VERSION_CONFLICT 409; PROTECTED_DIMENSION 422; CONSENT_REQUIRED 422 | Hidden experiment is 404; visible experiment outside owner scope is 403. |
| CFG-05A-07 | KillSwitchActivationRequest to KillSwitchActivationResponse; local safe fallback may be active before reconciliation | UNAUTHENTICATED 401; FORBIDDEN 403; SWITCH_NOT_FOUND 404; VERSION_CONFLICT 409; STEP_UP_REQUIRED 401; SWITCH_INVALID 422; CONTROL_PLANE_UNAVAILABLE 503 | Hidden switch is 404; visible switch without incident authority is 403. |

## Request/Response Contracts (Zod 4 schemas)

The following schemas are the exact wire contracts for the seven operation
IDs. All objects use Zod 4 strictObject. Unknown keys fail. The API adapter
parses path, query, headers and JSON independently and returns only the
success projection. All timestamps carry offsets and are normalized to UTC.

~~~ts
import { z } from "zod";

const Uuid = z.uuid();
const IsoTime = z.string().datetime({ offset: true });
const Version = z.string().regex(/^[1-9][0-9]{0,17}$/);
const Key = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+){0,15}$/).max(128);
const Capability = z.string().regex(/^[a-z][a-z0-9._-]{1,95}$/);
const NonEmptyText = z.string().trim().min(1).max(512);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const ScopeType = z.enum(["platform", "environment", "party", "site", "route", "feature", "user"]);
const ValueKind = z.enum(["boolean", "integer", "decimal", "short_text", "enum", "duration", "timestamp", "json_object", "string_list", "percentage"]);
const RiskClass = z.enum(["low", "medium", "high", "emergency"]);
const MergeMode = z.enum(["replace", "append_unique", "object_merge_allowlist"]);
const DefinitionLifecycle = z.enum(["draft", "active", "deprecated", "retired"]);
const ChangeState = z.enum(["draft", "review", "approved", "scheduled", "active", "superseded", "rolled_back"]);
const FlagState = z.enum(["draft", "active", "paused", "expired", "retired"]);
const ExperimentState = z.enum(["draft", "approved", "running", "paused", "stopped", "completed"]);
const KillState = z.enum(["requested", "active", "resolving", "ended"]);
type JsonValueNode = string | number | boolean | null | JsonValueNode[] | { [key: string]: JsonValueNode };
const JsonValue = z.json().superRefine((value, ctx) => {
  const encoded = JSON.stringify(value);
  if (encoded === undefined || new TextEncoder().encode(encoded).length > 65536) ctx.addIssue({ code: "custom", message: "JSON value exceeds 65536 serialized bytes" });
  const walk = (node: JsonValueNode, depth: number, path: (string | number)[]) => {
    if (depth > 8) {
      ctx.addIssue({ code: "custom", path, message: "JSON nesting exceeds depth 8" });
      return;
    }
    if (Array.isArray(node)) {
      if (node.length > 64) ctx.addIssue({ code: "custom", path, message: "JSON array exceeds 64 items" });
      node.forEach((item, index) => walk(item, depth + 1, [...path, index]));
      return;
    }
    if (node !== null && typeof node === "object") {
      const keys = Object.keys(node);
      if (keys.length > 64) ctx.addIssue({ code: "custom", path, message: "JSON object exceeds 64 keys" });
      keys.forEach(key => walk(node[key], depth + 1, [...path, key]));
    }
  };
  walk(value as JsonValueNode, 0, []);
}, "JSON value exceeds configured collection bounds");
const JsonObject = z.record(z.string().max(128), JsonValue).superRefine((value, ctx) => {
  if (Object.keys(value).length > 64) ctx.addIssue({ code: "custom", message: "object has too many keys" });
});
const Interval = z.strictObject({
  effectiveFrom: IsoTime,
  effectiveTo: IsoTime.nullable()
}).refine(v => v.effectiveTo === null || v.effectiveTo > v.effectiveFrom, "invalid interval");
const ApiError = z.strictObject({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/),
  message: z.string().min(1).max(256),
  requestId: Uuid,
   details: z.record(z.string().max(64), JsonValue).superRefine((v, c) => {
    if (Object.keys(v).length > 16) c.addIssue({ code: "custom", message: "too many details" });
  })
});

export const Cfg05a01RegisterDefinitionRequest = z.strictObject({
  key: Key,
  valueKind: ValueKind,
  schema: JsonObject,
  ownerCapability: Capability,
  allowedScopes: z.array(ScopeType).min(1).max(7).refine(v => new Set(v).size === v.length, "duplicate scope"),
  precedence: z.array(ScopeType).min(1).max(7).refine(v => new Set(v).size === v.length, "duplicate precedence"),
  mergeMode: MergeMode,
  defaultSource: z.enum(["contract", "literal", "required"]),
  defaultValue: JsonValue.optional(),
  riskClass: RiskClass,
  approverPolicy: z.strictObject({
    minimumDistinct: z.number().int().min(1).max(5),
    requiresMfa: z.boolean(),
    requiresCanary: z.boolean(),
    notifyCapabilities: z.array(Capability).max(16)
  }),
  consumerKeys: z.array(Key).max(64),
  contractRelease: z.string().trim().min(1).max(128),
  sensitivity: z.enum(["public", "internal", "restricted"]),
  deprecationAt: IsoTime.nullable().optional(),
  reason: NonEmptyText
}).superRefine((v, c) => {
  if (v.precedence.some(scope => !v.allowedScopes.includes(scope))) c.addIssue({ code: "custom", path: ["precedence"], message: "precedence contains disallowed scope" });
  if (v.defaultSource === "literal" && v.defaultValue === undefined) c.addIssue({ code: "custom", path: ["defaultValue"], message: "literal default required" });
  if (v.defaultSource === "required" && v.defaultValue !== undefined) c.addIssue({ code: "custom", path: ["defaultValue"], message: "required default cannot have literal" });
  if (v.valueKind === "json_object" && v.mergeMode === "object_merge_allowlist" && v.schema === null) c.addIssue({ code: "custom", message: "merge schema required" });
});

export const Cfg05a01DefinitionResponse = z.strictObject({
  definitionId: Uuid,
  definitionVersionId: Uuid,
  key: Key,
  version: Version,
  valueKind: ValueKind,
  allowedScopes: z.array(ScopeType),
  precedence: z.array(ScopeType),
  mergeMode: MergeMode,
  riskClass: RiskClass,
  lifecycle: DefinitionLifecycle,
  schemaHash: Hash,
  contractRelease: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
  synchronized: z.boolean(),
  createdAt: IsoTime
});

export const Cfg05a02EffectiveValueQuery = z.strictObject({
  key: Key,
  environment: z.string().trim().min(1).max(64).optional(),
  partyId: Uuid.optional(),
  siteId: Uuid.optional(),
  route: z.string().regex(/^\/[A-Za-z0-9/_-]{0,255}$/).optional(),
  feature: Key.optional(),
  userId: Uuid.optional(),
  consumerKey: Key,
  supportedDefinitionVersions: z.array(Version).min(1).max(8),
  at: IsoTime.optional()
});

export const Cfg05a02EffectiveValueResponse = z.strictObject({
  definitionId: Uuid,
  definitionVersionId: Uuid,
  key: Key,
  valueKind: ValueKind,
  ownerCapability: Capability,
  typedValue: JsonValue,
  sourceScope: ScopeType,
  sourceSubjectId: Uuid.nullable(),
  sourceValueVersionId: Uuid.nullable(),
  isDefault: z.boolean(),
  effectiveFrom: IsoTime.nullable(),
  effectiveTo: IsoTime.nullable(),
  evaluatedAt: IsoTime,
  evaluatorVersion: Version,
  correlationId: Uuid,
  compatibility: z.enum(["exact", "last_compatible", "contract_fallback"])
});

export const Cfg05a03ProposeChangeRequest = z.strictObject({
  scopeType: ScopeType,
  scopeId: Uuid.nullable(),
  environment: z.string().trim().min(1).max(64).nullable(),
  typedValue: JsonValue,
  interval: Interval,
  expectedDefinitionVersion: Version,
  impactManifest: JsonObject,
  rollbackCandidate: JsonValue.nullable(),
  reason: NonEmptyText,
  consumerKeys: z.array(Key).min(1).max(64)
});

export const Cfg05a03ChangeResponse = z.strictObject({
  reviewId: Uuid,
  candidateValueVersionId: Uuid,
  definitionId: Uuid,
  definitionVersion: Version,
  state: z.literal("draft"),
  valueHash: Hash,
  impactManifestHash: Hash,
  effectivePreview: JsonValue,
  rollbackAvailable: z.boolean(),
  submittedAt: IsoTime
});

const ChangeAction = z.enum(["approve", "schedule", "activate", "rollback"]);
export const Cfg05a04ChangeActionRequest = z.strictObject({
  action: ChangeAction,
  expectedReviewVersion: Version,
  candidateHash: Hash,
  approvalReason: NonEmptyText,
  stepUpToken: z.string().min(20).max(4096).optional(),
  scheduledFor: IsoTime.nullable().optional(),
  rollbackValue: JsonValue.optional(),
  canaryPercent: z.number().min(0).max(100).optional()
}).superRefine((v, c) => {
  if (v.action === "schedule" && v.scheduledFor === undefined) c.addIssue({ code: "custom", path: ["scheduledFor"], message: "schedule time required" });
  if (v.action === "rollback" && v.rollbackValue === undefined) c.addIssue({ code: "custom", path: ["rollbackValue"], message: "rollback value required" });
});

export const Cfg05a04ChangeActionResponse = z.strictObject({
  reviewId: Uuid,
  resultingValueVersionId: Uuid,
  resultingState: ChangeState,
  resultingVersion: Version,
  candidateHash: Hash,
  approvalCount: z.number().int().min(0).max(5),
  snapshotIntentId: Uuid.nullable(),
  outboxEventId: Uuid,
  effectiveAt: IsoTime.nullable()
});

const FlagAction = z.enum(["create", "update", "pause", "retire"]);
export const Cfg05a05FlagActionRequest = z.strictObject({
  action: FlagAction,
  expectedVersion: Version.nullable(),
  key: Key,
  ownerPersonId: Uuid,
  purpose: z.literal("release_availability"),
  environments: z.array(z.string().trim().min(1).max(64)).min(1).max(16),
  eligibilityRuleKey: Key,
  eligibilityRuleVersion: Version,
  allocation: JsonObject,
  fallback: JsonValue,
  dependencies: z.array(Key).max(32),
  startsAt: IsoTime,
  endsAt: IsoTime,
  expiresAt: IsoTime,
  reason: NonEmptyText
}).refine(v => v.endsAt > v.startsAt && v.expiresAt >= v.endsAt, "invalid flag interval");

export const Cfg05a05FlagActionResponse = z.strictObject({
  flagId: Uuid,
  flagVersionId: Uuid,
  key: Key,
  version: Version,
  state: FlagState,
  fallback: JsonValue,
  expiresAt: IsoTime,
  cleanupTaskId: Uuid,
  outboxEventId: Uuid.nullable()
});

const ExperimentAction = z.enum(["create", "start", "pause", "stop", "complete"]);
export const Cfg05a06ExperimentActionRequest = z.strictObject({
  action: ExperimentAction,
  expectedVersion: Version.nullable(),
  key: Key,
  ownerPersonId: Uuid,
  hypothesis: NonEmptyText,
  eligibilityDimensions: z.array(Key).min(1).max(16),
  variants: z.array(z.strictObject({ key: Key, allocationBps: z.number().int().min(1).max(10000) })).min(2).max(16),
  metrics: z.array(Key).min(1).max(16),
  consentRef: z.string().trim().min(1).max(256),
  stopRule: JsonObject,
  startsAt: IsoTime,
  endsAt: IsoTime,
  reason: NonEmptyText
}).superRefine((v, c) => {
  if (v.endsAt <= v.startsAt) c.addIssue({ code: "custom", path: ["endsAt"], message: "end must follow start" });
  if (v.variants.reduce((sum, item) => sum + item.allocationBps, 0) !== 10000) c.addIssue({ code: "custom", path: ["variants"], message: "allocations must total 10000 basis points" });
});

export const Cfg05a06ExperimentActionResponse = z.strictObject({
  experimentId: Uuid,
  experimentVersionId: Uuid,
  key: Key,
  version: Version,
  state: ExperimentState,
  assignmentPolicyVersion: Version,
  consentRef: z.string().trim().min(1).max(256),
  outboxEventId: Uuid.nullable()
});

export const Cfg05a07KillSwitchActivationRequest = z.strictObject({
  switchId: Uuid,
  expectedSwitchVersion: Version,
  scopeType: ScopeType,
  scopeId: Uuid.nullable(),
  reason: NonEmptyText,
  impactConfirmation: z.literal(true),
  stepUpToken: z.string().min(20).max(4096),
  incidentRef: z.string().trim().min(1).max(128),
  requestedEndsAt: IsoTime.nullable()
});

export const Cfg05a07KillSwitchActivationResponse = z.strictObject({
  activationId: Uuid,
  switchId: Uuid,
  switchVersionId: Uuid,
  state: KillState,
  fallbackMode: z.string().min(1).max(128),
  runtimeSnapshotHash: Hash,
  localFallbackApplied: z.boolean(),
  outboxEventId: Uuid.nullable(),
  startedAt: IsoTime
});

export type Cfg05aApiError = z.infer<typeof ApiError>;
~~~

### Contract and error rules

- Cfg05a01 rejects any secret-like key, credential, token, binary, code,
  HTML, auth/RLS rule, security limit, legal floor, money, rights, evidence,
  migration or transactional-state subject before a registry transaction.
- Cfg05a02 returns `ownerCapability` from the immutable definition version so the
  client can derive the edit affordance; it is never accepted from the request.
  Cfg05a02 accepts only request context and a consumer compatibility range.
  It never accepts a schema, precedence, arbitrary scope or caller-supplied
  acting party as authoritative.
- Cfg05a03 validates typedValue against the immutable definition schema and
  computes impact and rollback before inserting the draft.
- Cfg05a04 binds candidateHash and impactManifestHash to the review row.
  Approval, schedule and activation cannot mutate a candidate in place.
- Cfg05a05 has purpose release_availability only; its evaluator runs after
  endpoint authentication and authorization and cannot change RLS or business
  truth.
- Cfg05a06 rejects protected, special-category, private-content and inferred
  vulnerability dimensions. Assignment is derived from a stable
  experiment-version and subject/cohort hash and is never a permission claim.
- Cfg05a07 accepts only a predeclared switch version and allowed scope. It
  writes incident evidence even when the control plane is unreachable and
  never bypasses authorization or creates a second canonical business state.

## Database Schema

All tables below reside in private schema platform_private. SQL types,
nullability, constraints, foreign keys, indexes, RLS predicates and grants are
explicit. JSON fields are bounded by RPC checks: maximum 64 KiB per value,
four nesting levels, no executable or HTML values, and only allowlisted keys.
The API never grants direct table access to anon or authenticated.

### Canonical records and fields

| Table | Fields with SQL type, nullability and constraints | Foreign keys | Query indexes and uniqueness | RLS and grants |
|---|---|---|---|---|
| platform_private.cfg_setting_definition_versions | id uuid NOT NULL PRIMARY KEY; definition_id uuid NOT NULL; key text NOT NULL CHECK lowercase regex and length <=128; version_no bigint NOT NULL CHECK version_no >0; value_kind text NOT NULL CHECK bounded enum; schema jsonb NOT NULL; owner_capability text NOT NULL; allowed_scopes text[] NOT NULL CHECK cardinality 1..7; precedence text[] NOT NULL; merge_mode text NOT NULL CHECK bounded enum; default_source text NOT NULL CHECK contract or literal or required; default_value jsonb NULL; risk_class text NOT NULL CHECK low or medium or high or emergency; approver_policy jsonb NOT NULL; consumer_keys text[] NOT NULL; sensitivity text NOT NULL CHECK public or internal or restricted; contract_release text NOT NULL; lifecycle text NOT NULL CHECK draft or active or deprecated or retired; hash text NOT NULL CHECK 64 lowercase hex; created_by uuid NOT NULL; created_at timestamptz NOT NULL; deprecated_at timestamptz NULL | created_by REFERENCES auth.users(id); definition_id has no direct FK because it is the immutable registry family key and is validated with key/history by cfg_register_definition RPC; key is registry-scoped and cannot reuse a retired key | UNIQUE definition_id and version_no; INDEX key and version_no DESC; INDEX lifecycle and risk_class; INDEX owner_capability; no unique key alone because versions repeat a key and RPC prevents key reuse | RLS enabled and forced; authenticated has no table grant; app_worker uses named RPC only; security-definer RPC checks release principal and registry history; audit trigger rejects UPDATE and DELETE |
| platform_private.cfg_setting_value_versions | id uuid NOT NULL PRIMARY KEY; definition_id uuid NOT NULL; definition_version_id uuid NOT NULL; scope_type text NOT NULL CHECK bounded scope enum; scope_id uuid NULL; environment text NULL; typed_value jsonb NOT NULL; effective_from timestamptz NOT NULL; effective_to timestamptz NULL; state text NOT NULL CHECK draft or review or approved or scheduled or active or superseded or rolled_back; author_person_id uuid NOT NULL; acting_party_id uuid NULL; supersedes_id uuid NULL; value_hash text NOT NULL CHECK 64 lowercase hex; version_no bigint NOT NULL CHECK >0; created_at timestamptz NOT NULL; updated_at timestamptz NOT NULL | definition_version_id REFERENCES cfg_setting_definition_versions(id); definition_id has no direct FK because it identifies a version family and is validated with the definition_version_id tuple by the registry RPC; author_person_id REFERENCES auth.users(id); acting_party_id REFERENCES platform_private.party(id); supersedes_id self-REFERENCES id | UNIQUE definition_id, scope_type, scope_id, environment, version_no; partial UNIQUE active definition_id, scope_type, scope_id, environment WHERE state = active; INDEX scope_type, scope_id, environment, effective_from; INDEX value_hash; INDEX state and effective_from | RLS forced; worker RPC requires actor grant and scope; authenticated has no table grant; read is through effective-value RPC with field projection; commit rechecks acting party and current grant |
| platform_private.cfg_config_change_reviews | id uuid NOT NULL PRIMARY KEY; candidate_type text NOT NULL CHECK setting_value or feature_flag or experiment or kill_switch; candidate_id uuid NOT NULL; candidate_version bigint NOT NULL CHECK >0; frozen_hash text NOT NULL CHECK 64 lowercase hex; impact_manifest jsonb NOT NULL; impact_manifest_hash text NOT NULL CHECK 64 lowercase hex; risk_class text NOT NULL CHECK bounded enum; required_approvals integer NOT NULL CHECK 1..5; state text NOT NULL CHECK draft or review or approved or scheduled or active or superseded or rolled_back; submitted_by uuid NOT NULL; submitted_at timestamptz NOT NULL; version_no bigint NOT NULL CHECK >0; created_at timestamptz NOT NULL; updated_at timestamptz NOT NULL | candidate_id has no generic FK because its target table is selected by candidate_type; typed polymorphic integrity is validated against the candidate row by RPC; submitted_by REFERENCES auth.users(id) | UNIQUE candidate_id, candidate_version; INDEX state and risk_class; INDEX submitted_by and submitted_at DESC; INDEX frozen_hash | RLS forced; only owning settings RPC can insert or transition; admin projections receive IDs only; app_worker has EXECUTE on RPC not table DML |
| platform_private.cfg_config_approvals | review_id uuid NOT NULL; reviewer_person_id uuid NOT NULL; acting_party_id uuid NULL; capability text NOT NULL; decision text NOT NULL CHECK approve or reject; reason text NOT NULL CHECK length 1..512; reviewed_hash text NOT NULL CHECK 64 lowercase hex; decided_at timestamptz NOT NULL; review_version bigint NOT NULL CHECK >0; PRIMARY KEY review_id and reviewer_person_id | review_id references cfg_config_change_reviews(id); reviewer_person_id references auth.users(id); acting_party_id references platform_private.party(id) | INDEX review_id and decided_at; INDEX reviewer_person_id and decided_at; UNIQUE review_id and reviewer_person_id | RLS forced; RPC verifies reviewer distinct from proposer, current capability, MFA and hash; no direct authenticated grant; append-only trigger |
| platform_private.cfg_feature_flag_versions | id uuid NOT NULL PRIMARY KEY; key text NOT NULL CHECK lowercase regex and length <=128; owner_person_id uuid NOT NULL; purpose text NOT NULL CHECK release_availability; environments text[] NOT NULL CHECK cardinality 1..16; eligibility_rule_key text NOT NULL; eligibility_rule_version bigint NOT NULL CHECK >0; allocation jsonb NOT NULL; fallback jsonb NOT NULL; dependencies text[] NOT NULL; starts_at timestamptz NOT NULL; ends_at timestamptz NOT NULL; expires_at timestamptz NOT NULL; state text NOT NULL CHECK draft or active or paused or expired or retired; version_no bigint NOT NULL CHECK >0; created_by uuid NOT NULL; created_at timestamptz NOT NULL; UNIQUE key and version_no | owner_person_id and created_by reference auth.users(id); eligibility rule is a code-owned registry reference validated by RPC; no caller-owned FK | INDEX key and state; INDEX owner_person_id and expires_at; INDEX environments using GIN; UNIQUE key and version_no; active interval overlap denied by RPC | RLS forced; release-manager RPC checks every environment and owner; public evaluator sees only approved projection; authenticated cannot read raw allocation or dependencies outside projection |
| platform_private.cfg_experiment_versions | id uuid NOT NULL PRIMARY KEY; key text NOT NULL CHECK lowercase regex and length <=128; owner_person_id uuid NOT NULL; hypothesis text NOT NULL CHECK length 1..1024; eligibility_dimensions text[] NOT NULL CHECK cardinality 1..16; variants jsonb NOT NULL; allocation jsonb NOT NULL; metrics text[] NOT NULL CHECK cardinality 1..16; consent_ref text NULL; stop_rule jsonb NOT NULL; starts_at timestamptz NOT NULL; ends_at timestamptz NOT NULL; state text NOT NULL CHECK draft or approved or running or paused or stopped or completed; version_no bigint NOT NULL CHECK >0; created_by uuid NOT NULL; created_at timestamptz NOT NULL; UNIQUE key and version_no | owner_person_id and created_by reference auth.users(id); dimensions, metrics and consent reference are code and contract registry identifiers validated by RPC; no generic trait FK | INDEX key and state; INDEX owner_person_id and starts_at; GIN eligibility_dimensions; UNIQUE key and version_no | RLS forced; experiment RPC rejects protected dimensions and requires consent; assignment projection exposes only version and pseudonymous assignment; no raw traits in logs |
| platform_private.cfg_kill_switch_versions | id uuid NOT NULL PRIMARY KEY; key text NOT NULL CHECK lowercase regex and length <=128; owner_person_id uuid NOT NULL; allowed_scopes jsonb NOT NULL; fallback_mode text NOT NULL CHECK length 1..128; runtime_contract_version bigint NOT NULL CHECK >0; state text NOT NULL CHECK draft or active or retired; version_no bigint NOT NULL CHECK >0; created_at timestamptz NOT NULL; UNIQUE key and version_no | owner_person_id references auth.users(id); runtime contract and allowed scope are release registry references validated by snapshot compiler; no generic scope FK | INDEX key and state; INDEX owner_person_id; UNIQUE key and version_no; partial INDEX active key WHERE state = active | RLS forced; incident RPC checks predeclared owner, scope and signed runtime contract; raw switch internals unavailable to authenticated; app_worker has named RPC execute only |
| platform_private.cfg_kill_switch_activations | id uuid NOT NULL PRIMARY KEY; switch_id uuid NOT NULL; switch_version_id uuid NOT NULL; scope_type text NOT NULL CHECK bounded scope enum; scope_id uuid NULL; actor_person_id uuid NOT NULL; acting_party_id uuid NULL; reason text NOT NULL CHECK length 1..512; started_at timestamptz NOT NULL; ends_at timestamptz NULL; canonical_state text NOT NULL CHECK requested or active or resolving or ended; runtime_snapshot_hash text NOT NULL CHECK 64 lowercase hex; incident_ref text NOT NULL CHECK length 1..128; version_no bigint NOT NULL CHECK >0; created_at timestamptz NOT NULL; resolved_at timestamptz NULL | switch_id and switch_version_id reference cfg_kill_switch_versions; actor_person_id references auth.users(id); acting_party_id references platform_private.party(id) | INDEX switch_id, canonical_state and started_at DESC; INDEX incident_ref; partial UNIQUE switch_id, scope_type, scope_id WHERE canonical_state IN active or resolving; INDEX runtime_snapshot_hash | RLS forced; incident RPC checks MFA and capability for exact switch and scope; read projection redacts reason where caller lacks audit scope; append-only except transition RPC |

### Permission, RLS and grants

The private tables are not exposed through the Supabase Data API. Defaults are
revoked from public, anon and authenticated. The Worker role receives EXECUTE
on cfg_register_definition, cfg_resolve_effective_value,
cfg_propose_change, cfg_change_action, cfg_flag_action,
cfg_experiment_action and cfg_activate_kill_switch. Those security-definer
functions use an empty fixed search path, fully qualified names, and set the
acting-party context only from the verified RequestContext.

RLS predicates require the authenticated subject to match the current
RequestContext, the acting party to be an allowed relationship, the named
capability to cover the exact definition, environment or switch scope, the
grant term to be current and the target version to match the request. Service
principals pass an equivalent release registry predicate and cannot impersonate
a human. No policy treats a flag or setting as authorization. Approval rows
are visible only to the reviewer, proposer with review capability, or
audited release projection; value payloads are hidden from audit projections.

## Middleware & Policies

### Hono middleware order

BE00 order is request ID, transport and CORS, raw/body guard, content type,
session or service principal, acting context, CSRF for cookie mutations,
boundary Zod validation, capability and ownership policy, rate limit,
idempotency lookup, handler/RPC, transaction/outbox, response projection and
error normalization. API schemas reject caller actor and tenant fields.

### Per-operation authorization matrix

| Operation ID | Principal and capability | Ownership and scope predicate | Commit-time recheck | Denial result |
|---|---|---|---|---|
| CFG-05A-01 | mTLS Worker release principal with registry-release scope | Contract release is allowlisted and key has no historical definition | Re-read registry key, contract release and protected-category classifier under lock | Invalid source 422; service credential mismatch 401; no browser access |
| CFG-05A-02 | Authenticated consumer with definition-read or registered service consumer | Key, consumer key and context scopes are allowed by immutable definition | Re-read definition version and active interval before response | Hidden key 404; visible policy denial 403; missing default 503 |
| CFG-05A-03 | Settings editor grant for definition and selected scope | Acting party and grant cover exact scope type, subject and environment | Re-read grant, definition version, scope parent and value schema in transaction | Hidden definition 404; out-of-grant visible definition 403 |
| CFG-05A-04 | Approver, release manager or rollback authority matching action | Distinct from proposer; risk policy, MFA, canary and target scope all satisfy | Lock review and candidate; recheck hashes, approvals, current context and grant immediately before transition | Hidden review 404; stale or insufficient authority 403/409 |
| CFG-05A-05 | Release manager for every environment in the proposed version | Owner, dependencies, environment and action fall within current grant | Lock flag key/version; recheck owner, expiry, dependencies and release policy | Hidden flag 404; environment or action not granted 403 |
| CFG-05A-06 | Experiment operator for owner scope | Consent contract and dimensions are allowlisted non-protected product context | Lock experiment version; recheck consent, stop rule and allocation sum | Hidden experiment 404; owner scope denial 403; protected dimension 422 |
| CFG-05A-07 | Incident operator for exact switch, current acting party, fresh MFA | Switch version predeclares scope and fallback; actor cannot select another switch | Lock switch version; recheck step-up, scope, incident and signed snapshot before activation | Hidden switch 404; wrong operator 403; stale step-up 401 |

### Security and abuse controls

- Definition registration rejects secret-like names and values, executable
  code, HTML, binary payloads and any protected category before persistence.
  Registry release is the only authority for owner, type, meaning, sensitivity,
  schema, default and deprecation. The admin API cannot mint a key.
- Allowed scopes are an enum and precedence is definition-owned. A vanished
  parent is a typed missing candidate; the resolver tries the next explicit
  candidate, never an ambient hierarchy.
- JSON schema and values have bounded bytes, depth, array length, string
  length and object keys. Dynamic columns, SQL, expressions and provider
  configuration are not accepted.
- Activation binds candidate and impact hashes, distinct approvers, fresh MFA,
  policy-derived canary and preflight result to one RPC. All updates are
  append-only; rollback creates a forward version.
- Flag evaluation runs only after auth/RLS decisions. Experiment dimensions
  cannot include special-category, private, inferred vulnerability or
  protected traits. Consent reference, deterministic sticky assignment and
  cleanup task are mandatory.
- Kill switch activation requires impactConfirmation true, reason, incident
  reference, exact predeclared scope, step-up and a signed runtime contract.
  Local runtime fallback is bounded and cannot modify auth, RLS, legal, rights
  or financial truth.
- Logs and traces carry IDs, versions, risk, state and outcome, never typed
  values, cohort traits, schema contents, secrets, tokens or reason text when
  it could expose an incident.

## Data Flow

### Transaction and external seams

| Operation ID | Canonical transaction | External seam request and response | Timeout, retries and circuit breaker |
|---|---|---|---|
| CFG-05A-01 | Lock registry key; validate contract release; insert immutable definition; insert idempotency result and audit link; commit | Release registry input: key, contract release and schema hash. Response: allowlisted release receipt with definition ID and version. | PostgreSQL RPC deadline 2,000 ms; no retry after unknown commit, replay idempotency; release registry adapter 2,000 ms, 3 retries at 15/60/300 s, open after 5 consecutive failures for 60 s. |
| CFG-05A-02 | Read definition and eligible value versions under read-only snapshot; resolve and return projection | Consumer compatibility request: definition ID, supported versions and evaluator version. Response: compatible version or safe fallback directive. | Database route 8,000 ms; consumer adapter 500 ms, no retry for request path; circuit after 5 failures for 60 s and use last compatible or contract fallback. |
| CFG-05A-03 | Lock definition version; validate typed value; compute impact; insert value draft, review and idempotency record; commit | Impact planner request: definition version, candidate hash and consumer keys. Response: bounded impact manifest and rollback candidate hash. | Planner 2,000 ms, 3 retries at 15/60/300 s for safe idempotent reads; circuit 5/60 s. Planner failure leaves no draft. |
| CFG-05A-04 | Lock review and candidate; append approval or transition; atomically write active value, audit, idempotency, outbox and snapshot-build intent | Snapshot compiler request: approved definition/value IDs, manifest hash, environment and contract versions. Response: signed snapshot ID, hash and schema version. | Compiler 2,000 ms, 3 retries at 15/60/300 s; circuit 5 failures/60 s. Activation remains canonical and snapshot intent is pending on unknown result. |
| CFG-05A-05 | Lock flag key/version; validate release-only policy; insert version and cleanup task intent; append event in same transaction | Release evaluator request: flag version, environment and stable cohort hash. Response: enabled boolean, fallback and evaluator version; no auth decision. | Evaluator 500 ms, no retry on user request; circuit 5/60 s; absent, expired or unavailable returns declared fallback. |
| CFG-05A-06 | Lock experiment version; validate consent and dimensions; append version and assignment-policy evidence | Consent registry request: consent contract ref and version. Response: active consent contract status and expiry. | 2,000 ms, 1 retry after 250 ms for read-only status; circuit 5/60 s; unavailable prevents start and never fabricates consent. |
| CFG-05A-07 | Lock switch version; append requested/active activation, idempotency, audit and outbox; runtime path applies signed snapshot | Runtime snapshot request: switch ID/version, scope, fallback and activation ID. Response: applied state, snapshot hash and applied-at. | Local signed snapshot verification <=100 ms with no network retry; control-plane compiler 2,000 ms, 3 retries at 15/60/300 s, circuit 5/60 s. On outage use precompiled fallback and reconcile later. |

All asynchronous work uses BE00 at-least-once jobs, a stable idempotency key
and a dead-letter record after the inherited three attempts. An unknown
provider result remains pending or unknown; it is never converted to success.

### State machine and concurrency

| Aggregate | Allowed transitions and guards | Concurrent or failure behavior |
|---|---|---|
| Definition | draft to active to deprecated to retired | Key and immutable fields cannot be changed. Retirement is terminal for the key; release RPC rejects reuse. |
| Setting value and review | draft to review to approved to scheduled or active to superseded or rolled_back | Candidate or effective-context hash change returns to review. SELECT FOR UPDATE and version CAS prevent two activations. |
| Flag | draft to active to paused or expired or retired | Expired or missing evaluates fallback. Owner departure creates stale task; a new version, not mutation, repairs it. |
| Experiment | draft to approved to running to paused or stopped or completed | Assignment is sticky per experiment version. Allocation change creates a new version; cohort drift freezes or stops by stop rule. |
| Kill activation | requested to active to resolving to ended | Local signed fallback can become active before DB reconciliation. Duplicate incident requests return the original idempotent activation. |

Activation order is candidate validation, impact preflight, approval and MFA
verification, current-context recheck, single PostgreSQL transaction, outbox
append, then snapshot compilation. Consumers accept only newer valid signed
snapshots. A consumer that cannot recognize a version keeps its last
compatible value or contract fallback and emits a diagnostic.

## Event Schemas

Events use the BE00 identifier-only envelope: eventId uuid, eventType literal,
occurredAt timestamptz, requestId uuid, correlationId uuid, actorRef uuid
nullable, aggregateId uuid, aggregateVersion bigint, and payload with no
secrets or private values. The outbox row is committed with the domain change.

~~~ts
export const ConfigSettingActivatedV1 = z.strictObject({
  definitionId: z.uuid(),
  valueVersionId: z.uuid(),
  scopeType: z.enum(["platform", "environment", "party", "site", "route", "feature", "user"]),
  scopeId: z.uuid().nullable()
});

export const ConfigFlagChangedV1 = z.strictObject({
  flagId: z.uuid(),
  flagVersionId: z.uuid()
});

export const ConfigKillSwitchChangedV1 = z.strictObject({
  switchId: z.uuid(),
  switchVersionId: z.uuid(),
  activationId: z.uuid()
});
~~~

| Event type | Producer operation | Payload and consumer rule |
|---|---|---|
| config.setting.activated.v1 | CFG-05A-04 | definitionId, valueVersionId, scopeType and scopeId nullable; consumers refetch effective value and do not treat event as value truth. |
| config.flag.changed.v1 | CFG-05A-05 | flagId and flagVersionId; release projections refetch fallback and expiry; event cannot grant access. |
| config.kill-switch.changed.v1 | CFG-05A-07 | switchId, switchVersionId and activationId; runtime and incident projections reconcile by version and hash. |

## Error Handling

### Boundary mapping

| Boundary | Typed internal failure | HTTP and ApiError code | State guarantee |
|---|---|---|---|
| Zod path, query, header or body | Invalid request shape or unknown key | 400 INVALID_REQUEST | No auth lookup or mutation. |
| Auth or service principal | Missing, expired or invalid credential | 401 UNAUTHENTICATED | No domain read or write. |
| Capability or MFA | Known target but actor lacks current action, scope or step-up | 403 FORBIDDEN or 401 STEP_UP_REQUIRED | No mutation; safe denial telemetry only. |
| Resource visibility | Target not visible under current context | 404 NOT_FOUND | No existence or payload disclosure. |
| CAS, duplicate or changed context | Version, hash or idempotency mismatch | 409 VERSION_CONFLICT or IDEMPOTENCY_CONFLICT | Transaction rolls back; prior active version remains. |
| Domain contract | Protected category, invalid value, missing default or cohort dimension | 422 PROTECTED_SETTING, VALUE_INVALID, MISSING_DEFAULT or PROTECTED_DIMENSION | No draft, activation or assignment. |
| Queue or provider | Timeout, unavailable compiler or unknown runtime result | 502 UPSTREAM_FAILURE, 503 VALUE_UNAVAILABLE or 504 UPSTREAM_TIMEOUT | Canonical state remains pending/unknown; safe fallback applies. |
| Unexpected | Unclassified exception | 500 INTERNAL_ERROR | Rollback; request ID logged without sensitive payload. |

### Operation error coverage

| Operation ID | Required edge cases and recovery |
|---|---|
| CFG-05A-01 | Unknown or retired key, admin-minted key, secret/binary/code/HTML/protected value kind, disallowed scope, invalid merge or default; prior definition remains active. |
| CFG-05A-02 | Disallowed scope, vanished parent, conflicting values, missing required default, unknown consumer version and evaluator outage; next explicit source, diagnostic or contract fallback. |
| CFG-05A-03 | Undefined key, scope broader than grant, invalid schema, lowered risk class, changed definition and non-computable rollback; no draft and active value unchanged. |
| CFG-05A-04 | Self approval, duplicate approver, stale MFA, changed candidate/effective context, snapshot outage and unrecognized consumer version; review invalidates, fallback serves, history remains. |
| CFG-05A-05 | Missing owner, dependency, fallback or expiry, owner departure and expiry; safe fallback, cleanup task and stale diagnostic. |
| CFG-05A-06 | Protected/private/inferred-vulnerability dimension, missing consent, cohort drift and allocation change; reject or stop/freeze, never rebalance historical assignment. |
| CFG-05A-07 | Unassigned switch, undeclared scope, stale step-up, missing reason, control outage and reconciliation; deny or local precompiled fallback with canonical incident evidence. |

## Observability

| Operation ID | Required structured event and metrics | Trace and redaction |
|---|---|---|
| CFG-05A-01 | cfg.definition.registered with outcome, definitionId, version, key hash, risk, release ID; count rejected protected definitions and latency | requestId, correlationId and release principal; never key schema, default value or secret-like input |
| CFG-05A-02 | cfg.value.resolved with definitionId, version, sourceScope, isDefault, compatibility and outcome; resolver latency, fallback count and unknown count | Trace DB query and evaluator; redact typedValue, subject IDs and cohort traits |
| CFG-05A-03 | cfg.change.proposed with reviewId, candidate ID/version, risk and outcome; draft latency and schema rejection count | Trace validation and impact planner; redact value and manifest payload |
| CFG-05A-04 | cfg.change.transitioned with reviewId, action, resulting version, approval count, snapshot intent and outcome; activation latency, conflict and pending counts | Trace RPC, outbox and compiler; log hashes only, never candidate or rollback values |
| CFG-05A-05 | cfg.flag.changed with flagId/version, state, environment count, expiry and outcome; fallback and stale-owner counts | Trace policy and evaluator; no cohort key values or authorization claims |
| CFG-05A-06 | cfg.experiment.changed with experimentId/version, state, dimension count, consent status and outcome; protected-dimension rejects and assignment determinism failures | Trace consent registry; no traits, private content or individual assignment in logs |
| CFG-05A-07 | cfg.kill_switch.changed with switchId/version, activationId, scope type, runtime hash, state and outcome; activation latency, fallback and reconciliation lag | Trace step-up, RPC and runtime verification; reason text, token and snapshot bytes are scrubbed |

diagnostic captures exception type, release and scrubbed IDs. Structured logs use
the BE00 severity, environment, release, service, operation, outcome,
latency, request and correlation fields. Metrics distinguish active,
fallback, stale, pending, unknown and failed; no absence is interpreted as
healthy or zero.

## Testing Strategy

### Contract and route tests

| Operation ID | Contract and route acceptance tests |
|---|---|
| CFG-05A-01 | Parse valid bounded kinds and every invalid key, scope, precedence, protected class, secret-like value, missing literal default and unknown key; assert 201 projection, 400/409/422 envelope, service-only CORS and no browser credential path. |
| CFG-05A-02 | Resolve each allowed scope and precedence/merge mode; assert complete provenance, default, compatibility fallback and unknown consumer handling; test query bounds, 404 disclosure and read rate headers. |
| CFG-05A-03 | Validate typed value against immutable schema, impact and rollback preview; assert draft has no runtime effect, strict unknown-key rejection, exact 403/404 and idempotent replay. |
| CFG-05A-04 | Exercise distinct approvals, hash freeze, schedule, activate, rollback and current-context preflight; assert 409 CAS, fresh MFA, 202 pending snapshot and one event/outbox row. |
| CFG-05A-05 | Create/update/pause/retire only release availability flags; assert required owner/fallback/dependency/expiry, evaluator-after-auth invariant and fallback on expiry. |
| CFG-05A-06 | Validate consent, allowed dimensions, allocation sum, sticky assignment and stop rules; assert protected/private/inferred dimension denial and new version on allocation change. |
| CFG-05A-07 | Assert exact switch/scope, impact confirmation, reason, step-up and signed fallback; test local activation during DB outage, later reconciliation and no auth bypass. |

### Authorization, persistence and concurrency tests

- For each operation test anonymous, wrong valid user, wrong party, forged
  party ID, expired grant, revoked grant, missing or stale step-up and stale
  target version. Assert 401, 403 or disclosure-safe 404 per the matrix.
- Apply RLS/RPC tests for release principal, settings editor, approver,
  release manager, experiment operator, incident operator and service
  consumer. Assert direct table access is denied to anon and authenticated.
- Assert definition key never reuses after retirement, immutable fields cannot
  update, typed values require a known definition version, active-scope
  uniqueness holds and approval reviewer cannot equal proposer.
- Run two concurrent activation transactions and two kill activations with the
  same idempotency key. Assert one state transition, one event and identical
  replay response. A changed hash returns 409 without partial writes.
- Assert an owner departure, flag expiry, experiment cohort drift and consumer
  incompatible version generate cleanup or diagnostic evidence and preserve
  the prior safe value.

### Security, performance and recovery tests

- Fuzz JSON depth, bytes, keys, arrays, Unicode and unknown properties;
  confirm no SQL, template, expression, HTML, executable or secret reaches
  PostgreSQL, queues, logs or snapshots.
- Verify endpoint authorization and RLS decisions are identical across all
  flag variants. A flag cannot enable a forbidden endpoint or alter a legal,
  rights, money, entitlement, consent or evidence floor.
- Measure bounded read p95 against BE00 Tier 1 limits and command p95 against
  the 15-second route deadline. Assert rate limits are per user, party and
  service principal and do not share counters across tenants.
- Simulate compiler timeout, three retries, open circuit, duplicate delivery,
  worker crash after commit and runtime snapshot replay. Assert pending/unknown
  status, no duplicate side effect, signed newer-only acceptance and DLQ.
- Assert snapshots contain only approved definitions, no secrets or private
  content, and kill fallback remains available during database and queue
  outage.

### Accessibility handoff tests

05a returns machine-readable state, risk, source, version, fallback, interval
and validation fields required by the admin FE companion. The FE tests must
render effective source and default, risk and rollback, ordered precedence,
expiry timezone, step-up expiry and stale/unknown states as text and semantic
status. No color-only flag or diagnostic state is permitted.

## Deepening Passes

| Pass | Resulting hardening |
|---|---|
| Micro contract pass | Added strict discriminants, bounded JSON, timestamp offsets, allocation sum, interval and literal-default refinements. |
| Boundary pass | Separated registry release, human admin, consumer resolution and local runtime fallback; removed generic upload, auth and job endpoints. |
| Adversarial pass | Rejected secrets, auth-by-flag, protected experiment traits, ambient scope inheritance, self-approval, key reuse, stale MFA and snapshot downgrade. |
| Failure/recovery pass | Added explicit pending/unknown states, idempotent retries, signed newer-only snapshots, local kill fallback and reconciliation evidence. |
| Data pass | Typed every persistence field, key constraint, FK rationale, index, RLS predicate and grant without creating a second source of truth. |
| Macro consistency pass | Reconciled all five feature ledger rows, seven interactions, eight support/primary models and three event types with 05b/05c ownership. |

## Ambiguity Gate

PASS. Evidence:

- Micro: every CFG-05A-01 through CFG-05A-07 row has one strict request,
  success and ApiError contract, numeric limits, ownership result and
  operation-keyed tests.
- Macro: the seven assigned interactions, five 25.07 feature rows, six
  canonical model names, two supporting deep-dive records and three events
  map once; admin, portability and lifecycle routes are explicitly excluded.
- External seams: each adapter has exact request, response, timeout, retry
  count/backoff and circuit behavior; local kill fallback has a bounded
  no-network path.
- Persistence: every table field has SQL type, nullability, constraint, FK or
  registry rationale, index, RLS and grant; no direct authenticated table
  surface exists.
- Transport: every operation registry row names CORS and the exact BE00
  ApiError { code, message, requestId, details } envelope.
- Tables: all Markdown tables were width-checked after authoring; no row has
  a pipe inside a cell.
- No unresolved gap, hidden authorization rule or undecided choice
  remains in this split.

## Open Questions

None.

## Changelog

| Date | Change | Workflow | Sections affected |
|---|---|---|---|
| 2026-08-28 | Authored 05a backend contracts from approved Shard 05 IA and deep dive; reconciled 25.07.01 through 25.07.05 | /write-be-spec | All |
| 2026-08-28 | Added strict Zod 4 contracts, typed persistence, signed runtime fallback, event and recovery tests | /write-be-spec-write | API, database, middleware, events, tests |
| 2026-10-02 | FX-E: CFG-05A-02 returns the definition `ownerCapability`; documented how settings editor authority is projected (owner capability in the CFG-05B-07 snapshot, named `settings.approve`, `settings.release` and `settings.rollback` for actions), with Worker and database enforcement on every write | /propagate-decision | Settings editor authority projection, Operation contract, Contracts, Contract and error rules |

## Dependency References

- BE00 Cross-cutting platform foundation: ApiError, RequestContext,
  idempotency, jobs, outbox, logging, SLOs and recovery.
- Shard 01 Identity authority and party governance: Supabase session,
  acting-party and MFA context consumed before settings authorization.
- Shard 03 CMS content modeling and authoring: typed consumer definitions,
  content quality/checker references and immutable CMS version consumers.
- Shard 04 CMS navigation, media and delivery: delivery consumer versions,
  fallback and cache/projection impact manifest.
- Shard 06 Trust and safety: audit, incident, evidence and legal-floor
  consumers; this split never owns those truths.
