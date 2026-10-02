# Content Schema Registry — Backend Specification

> IA Source: [Shard 03 — CMS content modeling and authoring](../ia/03-cms-content-modeling.md)
> Deep Dives: [Shard 03 CMS content modeling and authoring deep dive](../ia/deep-dives/03-cms-content-modeling.md)
> Foundation: [BE00 — Cross-cutting platform foundation](00-infrastructure.md)
> Status: Complete — reconciled to the authorized IA-first Slice 09 contract package

## Split Group

This is the first of three backend specifications derived from IA Shard 03:

| BE spec                                  | Owned IA interactions                                                | Boundary                                                                                                                              |
| ---------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 03a-content-schema-registry.md           | CMS-01, CMS-02, CMS-03, CMS-04, CMS-10 plus protected registry reads | Definition control plane: content-type and field schemas, allowlisted domain bindings, migrations, and code-owned block registration. |
| 03b-editorial-workflow-publication.md    | CMS-05, CMS-06, CMS-07, CMS-08, CMS-09, CMS-13                       | Entry revisions, editorial review, schedules, preview, and publication.                                                               |
| 03c-composition-taxonomy-localization.md | CMS-11, CMS-12, CMS-14, CMS-15, CMS-16                               | Templates, patterns, composition, taxonomies, locale variants, and related-content rules.                                             |

The split is independently implementable. 03a owns definition state, protected registry reads, and activation authority. Entry content, template composition, taxonomy assignment, locale variants, and public projection remain consumer concerns. BlockDefinitionVersion is registered here as a code-owned capability; 03c consumes its immutable versions when it specifies templates and composition. No route in this document duplicates a BE00 platform endpoint, and no protected control-plane route is public delivery.

## Classification

- Type: domain-command and control-plane registry.
- IA source: 03-cms-content-modeling.md, including its one required deep dive.
- Classification: three-way split by aggregate authority, with CMS-10 co-located with the registry because a block renderer/schema is a code-owned definition and activation compatibility input.
- Inclusion: CMS-01 create content type draft; CMS-02 change field schema; CMS-03 bind domain record; CMS-04 activate schema version; CMS-10 register block version.
- Exclusion: entry/revision/review/publication mutation is 03b; template/pattern/taxonomy/locale/related-content mutation is 03c; public route/cache/search projection is Shard 04; route, job, audit, idempotency, error, request-id, session, CORS, and common event-envelope primitives are BE00.
- Authority boundary: this spec stores versioned definitions and migration evidence. It never copies authority, ownership, money, rights, identity, entitlements, or canonical domain state into a CMS record.
- Decision status: IA-first Slice 09 reconciliation is applied. DEC-100 is inherited: cross-shard references are bounded, allowlisted projections and do not permit request-time upward reads or authority laundering.

## Referenced Material Inventory

| Material                | Sections / lines consumed                                                                                                                                                                                        | Use in this specification                                                                                                                                                                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IA Shard 03             | Overview lines 9–22; Features lines 24–29; Acceptance Criteria lines 31–49                                                                                                                                       | Scope, acceptance, feature boundary, and non-negotiable behavior.                                                                                                                                                                                    |
| IA Shard 03             | Interactions lines 50–69, especially CMS-01 through CMS-04 and CMS-10                                                                                                                                            | Operation registry, request semantics, refusals, and recovery behavior.                                                                                                                                                                              |
| IA Shard 03 (DEC-108)   | Schema Activation Producers; deep-dive Schema Compilation and Compatibility and Reachable Activation Producer Chain (DEC-108)                                                                                     | Successor, actual dry-run, frozen CMS review, bounded assignment, independent decisions, and the reachable activation chain; private CMS review records.                                                                                              |
| IA Shard 03             | Contracts                                                                                                                                                                                                        | Built-in/reserved types, field kinds, immutable versions, migration, block registry, protected registry reads, and storage rules.                                                                                                                    |
| IA Shard 03             | Data Models and Common Model Envelope and Exceptions                                                                                                                                                             | ContentType, ContentTypeVersion, ContentTypeTemplateBinding, ContentTypeCapabilityBinding, FieldDefinitionVersion, RelationDefinition, SchemaMigrationPlan, SchemaArtifact, BlockDefinitionVersion, and explicit envelope ownership/exception rules. |
| IA Shard 03             | Access Control lines 220–245; Accessibility lines 246–255                                                                                                                                                        | Capability, ownership, protected approval, disclosure, and accessible validation handoff.                                                                                                                                                            |
| IA Shard 03             | Event Schemas lines 256–273                                                                                                                                                                                      | cms.schema.activated.v1 and cms.template.activated.v1 payload and consumer contracts.                                                                                                                                                                |
| IA Shard 03             | Edge Cases lines 275–298; Cross-Shard Dependencies lines 326–329                                                                                                                                                 | Negative paths, migration/activation races, and Shard 00/01/04/05/16 boundaries.                                                                                                                                                                     |
| IA Shard 03             | Deep Dives Needed lines 331–342                                                                                                                                                                                  | Required deep-dive coverage and cross-shard contract map.                                                                                                                                                                                            |
| IA Shard 03 deep dive   | Scope lines 7–9; Deepening Record lines 11–18; Resolved Architecture Choices lines 20–36                                                                                                                         | Locked implementation constraints and resolved ambiguity.                                                                                                                                                                                            |
| IA Shard 03 deep dive   | Canonical Field Contracts; Common Model Envelope and Exceptions; State Machines                                                                                                                                  | Exact field, artifact, envelope, and lifecycle semantics.                                                                                                                                                                                            |
| IA Shard 03 deep dive   | Schema Compilation and Compatibility lines 142–150; Migration Algorithm lines 172–179                                                                                                                            | Deterministic compiler, compatibility classes, dry-run, cursor, and activation gates.                                                                                                                                                                |
| IA Shard 03 deep dive   | Composition and Preview Validation lines 204–233; Abuse and Recovery Verification lines 244–257                                                                                                                  | Block manifest security and impact checks relevant to CMS-10 and activation.                                                                                                                                                                         |
| IA Shard 03 deep dive   | Cross-Shard Contracts lines 259–273; Implementation Envelope lines 275–281                                                                                                                                       | Ownership, event handoff, Hono/Zod, PostgreSQL/RLS, Queue, and provider boundary.                                                                                                                                                                    |
| BE00                    | Contracts lines 84–165; middleware/auth lines 253–297; protected transaction/event/error lines 298–451; observability/tests lines 452–503                                                                        | Mandatory inherited wire, security, transaction, retry, and operational contract.                                                                                                                                                                    |
| BE01a–01d               | BE01a Shared Contract Inheritance 73–97 and API 98–192; BE01b Contract Conventions 88–137 and API 138–305; BE01c API 90–304 and schema 294–304; BE01d Inherited BE00 Protocol 87–109 and route semantics 424–502 | Principal resolution, acting context, party, capability, governance, and disclosure; no CMS-owned identity data.                                                                                                                                     |
| BE02a–02c               | BE02a Shared Contract Inheritance 85–98 and schema 427–498; BE02b source contracts 102–227, schema 429–652, middleware 652–700; BE02c request/response 90–258, schema 305–339, middleware 340–369                | Reserved canonical concepts and fixed-profile/provenance compatibility checks; no CMS ownership of profile, credential, or trader state.                                                                                                             |
| Architecture Design     | Tech Stack/hosting 143–196; persistence/feature-query map 198–266; auth boundary 267–283; API design 343–376; security/rate 535–668 and 770–797; integration/observability 916–995                               | Hono on Cloudflare Workers, Supabase PostgreSQL/Auth/RLS, SLO classes, and no raw provider data.                                                                                                                                                     |
| Data Placement Strategy | N-Tier responsibilities 5–17; placement map 19–40; security boundaries 42–55; storage/isolation 86–93; lifecycle 95–114; tenancy/sync 116–148                                                                    | Data minimization and database placement; definitions contain no private content or PII.                                                                                                                                                             |
| Engineering Standards   | Test coverage 27–44; performance 53–121; async/recovery 122–138; accessibility 140–148; security 149–165; migration/CI 185–207                                                                                   | Contract-first, security, performance, accessibility, migration, and CI gates.                                                                                                                                                                       |

## IA Source Map

| BE section                                 | Source of truth                               | Exact section / lines                                                                                           |
| ------------------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Boundary and classification                | IA Shard 03 plus decomposition                | Overview 9–22; Features 24–29; Cross-Shard Dependencies 326–329                                                 |
| Route registry and endpoint reconciliation | IA Shard 03                                   | Interactions 50–69; Acceptance Criteria 31–49; Surface Applicability 299–324                                    |
| Content-type and field contracts           | IA Shard 03                                   | Contracts 79–129; Data Models 130–159; typed registry 190–218                                                   |
| Block registry                             | IA Shard 03                                   | CMS-10 at interaction line 63; Templates, Blocks, Taxonomy, and Locale 111–128; BlockDefinitionVersion line 149 |
| Zod request and response contracts         | IA Shard 03 plus BE00                         | Contracts 79–129; deep dive Canonical Field Contracts 78–127; BE00 Contracts                                    |
| Browser projection ownership and states    | IA Shard 03 deep dive plus BE03a SQL matrix   | Common Model Envelope and Exceptions 48–76; State Machines 129–140; canonical records and fields 996–1006       |
| Persistence and RLS                        | IA Shard 03 plus placement strategy           | Data Models 142–179; Access Control 220–245; Data Placement Strategy canonical-store and access sections        |
| Compilation and migrations                 | IA Shard 03 deep dive                         | Schema Compilation and Compatibility 142–150; Migration Algorithm 172–179                                       |
| Middleware, authorization, and disclosure  | IA Shard 03 plus BE00/BE01                    | Access Control 220–245; Cross-Shard Dependencies 326–329; BE00 middleware/auth/error contracts                  |
| Events and async consumers                 | IA Shard 03 plus BE00                         | Event Schemas 256–273; deep dive Cross-Shard Contracts 259–273; BE00 queue/outbox contract                      |
| Tests and ambiguity                        | IA Shard 03, deep dive, engineering standards | Edge Cases 275–298; Abuse and Recovery Verification 244–257; Engineering Standards test gates                   |

## Feature Ledger Coverage

| Ledger ID | Feature                              | BE ownership | Coverage evidence                                                                                                                                                                                   |
| --------- | ------------------------------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25.01.01  | Content Type Definitions             | CMS-03A-01   | ContentType and ContentTypeVersion tables, draft route, reserved-key checks, Zod contract, RLS, and create/replay tests.                                                                            |
| 25.01.02  | Field Schemas, Validation & Defaults | CMS-03A-02   | FieldDefinitionVersion table, all 14 field kinds, strict constraints/default/localization semantics, compatibility classification, and field-contract tests.                                        |
| 25.01.03  | Relations & Domain Record Bindings   | CMS-03A-03   | RelationDefinition table, allowlisted target/projection/cardinality/onUnavailable contract, target-authority boundary, and binding tests.                                                           |
| 25.01.04  | Schema Versioning & Migration        | CMS-03A-04, CMS-03A-09..14 | SchemaMigrationPlan table, deterministic compiler/dry-run, successor clone, actual dry-run report/plan/job, private CMS review freeze (cms_schema_reviews), bounded assignment (cms_schema_review_assignments), append-only independent decisions (cms_schema_review_decisions), safe review read, state machine, CAS activation, worker retry/DLQ, and the reachable producer → activation plus migration recovery tests. |
| 25.03.01  | Approved Block Registry              | CMS-03A-05   | BlockDefinitionVersion table, signed release registration, strict props/renderer/data/a11y manifest, immutable retirement/lifecycle events, durable nonce replay receipts, and release-spoof tests. |

25.02.01–25.02.04 and 25.03.02–25.03.04 are explicitly owned by 03b/03c. 25.05.* is also owned by 03c. This document supplies only the schema/block compatibility inputs those consumers are allowed to reference.

## Endpoint Completeness Reconciliation

The IA interaction table contains six mutation flows owned by this file, plus
the protected list/detail query boundary required to serve the schema-registry
workbench: the original eight HTTP operations. The DEC-108 activation producer amendment
adds the reachable command chain that makes CMS-04 truthful rather than
dependent on hand-inserted approved rows: successor, dry-run, review
submission, review decision, review detail, and review assignment —
CMS-03A-09 through CMS-03A-14. This boundary therefore owns exactly fourteen
HTTP operations, each with exactly one route registry entry and one operation
contract. Existing operation IDs CMS-03A-01 through CMS-03A-08 are unchanged
and never renumbered. CMS-04 may enqueue migration work, but migration worker
execution is an internal consumer, not a second HTTP endpoint. CMS-10 is
admitted only from a trusted code-release registration path; an administrator
cannot upload executable assets.

| IA interaction                   | Operation ID | Concrete endpoint / trigger                                                   | Reconciliation                                                                                                                        |
| -------------------------------- | ------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| CMS-01 Create content type draft | CMS-03A-01   | POST /api/v1/cms/content-types                                                | One command creates private ContentType plus version 1 draft in one transaction.                                                      |
| CMS-02 Change field schema       | CMS-03A-02   | POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/fields    | One command appends a field definition to an unactivated draft and records compatibility impact.                                      |
| CMS-03 Bind domain record        | CMS-03A-03   | POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/relations | One command appends a read-only allowlisted RelationDefinition; it never grants target authority.                                     |
| CMS-04 Activate schema version   | CMS-03A-04   | POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/activate  | One protected command freezes, verifies, switches active version, and writes an outbox work item atomically.                          |
| CMS-10 Register block version    | CMS-03A-05   | POST /api/v1/cms/blocks/versions, trusted release principal only              | One code-release registration creates immutable BlockDefinitionVersion. No public/admin upload route exists.                          |
| CMS-10 Advance block lifecycle   | CMS-03A-08   | POST /api/v1/cms/blocks/versions/{blockDefinitionVersionId}/lifecycle         | One signed release command appends an immutable lifecycle event for an existing key/version; the version row is never updated.        |
| Protected registry list          | CMS-03A-06   | GET /api/v1/cms/content-types                                                 | Capability-scoped, no-store page of discriminated content-type registry records with bounded cursor pagination.                       |
| Protected registry detail        | CMS-03A-07   | GET /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}            | Capability-scoped, no-store discriminated version detail with nested field/relation metadata and immutable schema-artifact reference. |
| CMS-04 Successor schema draft    | CMS-03A-09   | POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/successors | One command clones an immutable source into a fresh draft with new definition row IDs, preserved stable field identities/keys, remapped local references, and an incremented version number. |
| CMS-04 Start schema dry-run      | CMS-03A-10   | POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/dry-runs  | One command derives source/target/classification/compiler/transform evidence, binds a new immutable dry-run report to the still-draft candidate under CAS, and atomically creates report, plan, and BE00 job. |
| CMS-04 Submit schema review      | CMS-03A-11   | POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/reviews   | One command freezes the candidate definition/artifact/compiler/dependency/dry-run/policy evidence and moves draft → review atomically. |
| CMS-04 Record review decision    | CMS-03A-12   | POST /api/v1/cms/schema-reviews/{reviewId}/decisions                          | One command appends an immutable decision by an independently authenticated assigned reviewer, rejecting the submitter and repeated humans. |
| CMS-04 Read schema review        | CMS-03A-13   | GET /api/v1/cms/schema-reviews/{reviewId}                                     | Capability-scoped, no-store review detail with frozen evidence summary, required/recorded decision counts, decision references, and permitted next actions. |
| CMS-04 Assign review capability  | CMS-03A-14   | POST /api/v1/cms/schema-reviews/{reviewId}/assignments                        | One command creates or revokes a bounded owner/review-scoped assignment of only read/decide on one frozen review, expiring within seven days and no later than the grantor's authority. |

BE00 endpoints are inherited, not repeated: GET /api/v1/jobs/{jobId} observes migration status when a job exists; this file does not redefine JobStatus. CMS-03A-06 and CMS-03A-07 are protected control-plane reads, never public delivery endpoints. No INF-01, INF-03, INF-04, INF-10, or INF-08 duplicate is introduced.

## Shared Contract Inheritance

All operations use the BE00 API base /api/v1, request ID, exact four-field error envelope, rate-limit headers, and response normalization. Mutations additionally use the applicable JSON media, ETag, idempotency, audit, and transactional-outbox rules; protected GETs have no body, Idempotency-Key, If-Match, mutation audit, or outbox effect.

```ts
import { z } from 'zod';

const UUID = z.string().uuid();
const Version = z.string().regex(/^[1-9][0-9]*$/);
const ApiError = z.strictObject({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
  message: z.string().min(1).max(500),
  requestId: UUID,
  details: z.record(z.string(), z.json()),
});
```

ApiError is exactly { code, message, requestId, details }. details is capped by BE00 at 16 keys, four nesting levels, and 8 KiB serialized. HTTP status is on the response line, never a top-level error field. Every operation below cites this envelope and returns Content-Type application/json, X-Request-Id, Cache-Control no-store for authenticated/control-plane responses.

- Authentication is verified Supabase Auth session/JWT followed by server-resolved acting context; caller-supplied actor, party, capability, or owner fields are ignored.
- Mutations require Idempotency-Key of 8–128 printable ASCII bytes and exact strong If-Match for a mutable parent; same bound request replays the original response, a mismatched body/actor/path/version returns 409 CONFLICT.
- Hono middleware order is request-id → raw-size/media guard → JSON parse → Zod validation → session/JWT → acting-context/capability → CSRF → configured CORS allowlist → rate limiter → handler/RPC → response/error normalization.
- CORS is explicit per-operation: production allows configured first-party origins only, credentials only for those origins, never wildcard credentials. CMS-03A-05 accepts the configured release-worker origin and signed release principal, not browser origins.
- PostgreSQL RPC rechecks authority, state, version, idempotency, uniqueness, and allowlist under RLS. Domain mutation, idempotency record, audit row, and outbox row commit or roll back together.
- Queue messages carry IDs, versions, correlation/causation IDs, and no content payload. Consumers use at-least-once delivery, leases, CAS, maximum three retries at 15s/60s/300s, and DLQ for terminal or unknown-version failures.

## API Endpoints

### Route Registry

This table is the single authoritative route registry for 03a. CI must compare discovered Hono routes and generated OpenAPI to every row and fail on a missing/extra route, duplicate method/path, missing operation ID, or stale schema. Every downstream contract, error, authorization, idempotency, rate, observability, and test row keys to the operation ID.

| Operation ID | IA                        | Method and path                                                               | Request → success                                                  | Auth / 403 versus 404                                                                                                                                                  | Middleware incl. CORS                                                                                                                                     | Idempotency / concurrency                                                                                                                                                                                          | Rate / timeout / cache / SLO                                                                     | Error envelope                                      | Event                                                                    |
| ------------ | ------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------ |
| CMS-03A-01   | CMS-01                    | POST /api/v1/cms/content-types                                                | ContentTypeDraftRequest → 201 ContentTypeVersionResource           | schema_designer for the caller's permitted registry scope; invalid target scope is 404, authenticated but insufficient capability is 403                               | canonical BE00 order; CORS cms-console allowlist; CSRF; JSON 256 KiB; rate cms-definition-write                                                           | key required; parent absent create is bound to typeKey; serial unique key lock; no If-Match for new type; type/version/fields/relations/templates/capabilities/artifact reservation commits or rolls back together | 30/min/user, 60/min/party; 15,000ms deadline, response target <2s; no-store; Tier 2 p95 <1,200ms | BE00 ApiError { code, message, requestId, details } | cms.schema.activated.v1 only on later activation                         |
| CMS-03A-02   | CMS-02                    | POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/fields    | FieldSchemaChangeRequest → 201 FieldDefinitionVersionResource      | schema_designer on draft; unknown/unreadable type/version is 404; known resource lacking capability is 403                                                             | canonical order; CORS cms-console allowlist; CSRF; strict JSON; rate cms-definition-write                                                                 | key and If-Match required; CAS on version; stable field UUID/key cannot be reused                                                                                                                                  | 60/min/user, 120/min/party; 15,000ms; no-store; Tier 2                                           | BE00 ApiError { code, message, requestId, details } | none                                                                     |
| CMS-03A-03   | CMS-03                    | POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/relations | RelationBindingRequest → 201 RelationDefinitionResource            | schema_designer on draft and relation allowlist; unreadable type/version is 404; capability denial is 403                                                              | canonical order; CORS cms-console allowlist; CSRF; strict JSON; rate cms-definition-write                                                                 | key and If-Match required; CAS and unique field/version binding                                                                                                                                                    | 60/min/user, 120/min/party; 15,000ms; no-store; Tier 2                                           | BE00 ApiError { code, message, requestId, details } | none                                                                     |
| CMS-03A-04   | CMS-04                    | POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/activate  | SchemaActivationRequest → 202 SchemaActivationResource             | schema_designer plus the workflow/risk-policy-required distinct approvals; unreadable candidate is 404; missing capability/evidence is 403 or 409 per state disclosure | canonical order; CORS cms-console allowlist; CSRF; step-up MFA; strict JSON; rate cms-activation                                                          | key and If-Match required; one activation CAS; repeated key replays same switch/job; policy snapshot and schema-artifact hash are exact                                                                            | 10/min/user, 20/min/party; 15,000ms acceptance deadline; no-store; Tier 2                        | BE00 ApiError { code, message, requestId, details } | cms.schema.activated.v1 after committed switch                           |
| CMS-03A-05   | CMS-10                    | POST /api/v1/cms/blocks/versions                                              | BlockRegistrationRequest → 201 BlockDefinitionVersionResource      | signed release-worker principal with block_registry:write; unknown release target is 404; human/admin or invalid capability is 403                                     | canonical order; release-worker CORS only; no browser CSRF; raw `X-WeJammin-Release-*` signature guard before JSON; rate release-registry-write           | key required; release digest + BlockKey/version unique; immutable once committed; props ref/hash/snapshot hash/nested Ed25519 attestation must agree                                                               | 20/min/release; 15,000ms, response target <2s; no-store; Tier 2                                  | BE00 ApiError { code, message, requestId, details } | none; template activation is the only cms.template.activated.v1 producer |
| CMS-03A-08   | CMS-10                    | POST /api/v1/cms/blocks/versions/{blockDefinitionVersionId}/lifecycle         | BlockLifecycleAdvanceRequest → 201 BlockLifecycleEventResource     | signed release-worker principal with block_registry:write; unknown/unreadable version is 404; human/admin or invalid capability is 403                                 | canonical order; release-worker CORS only; no browser CSRF; exact raw `X-WeJammin-Release-*` signature guard before JSON; rate release-registry-lifecycle | existing key/version; expected current lifecycle and monotonic next lifecycle are checked under lock; append-only event and nonce receipt commit atomically                                                        | 20/min/release; 15,000ms, response target <2s; no-store; Tier 2                                  | BE00 ApiError { code, message, requestId, details } | cms.block.lifecycle.changed.v1 after commit                              |
| CMS-03A-06   | Protected registry list   | GET /api/v1/cms/content-types                                                 | ContentSchemaRegistryListQuery → 200 ContentSchemaRegistryListPage | authenticated caller with schema-registry read scope; insufficient scope is 403; inaccessible tenant/owner scope is 404-equivalent page omission                       | canonical BE00 order; CORS cms-console allowlist; no request body; no CSRF mutation check; strict query; rate cms-definition-read                         | no Idempotency-Key or If-Match; opaque cursor binds query/filter/sort and acting scope; deterministic ID tie-breaker                                                                                               | 120/min/user, 240/min/party; 15,000ms; `Cache-Control: no-store`; Tier 2 protected-read SLO      | BE00 ApiError { code, message, requestId, details } | none                                                                     |
| CMS-03A-07   | Protected registry detail | GET /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}            | path UUIDs → 200 ContentSchemaRegistryDetail                       | authenticated caller with schema-registry read scope; unreadable owner/version is 404; known readable resource lacking a required capability is 403                    | canonical BE00 order; CORS cms-console allowlist; no request body; strict path/query; rate cms-definition-read                                            | no Idempotency-Key or If-Match; exact immutable IDs/version; no public cache                                                                                                                                       | 120/min/user, 240/min/party; 15,000ms; `Cache-Control: no-store`; Tier 2 protected-read SLO      | BE00 ApiError { code, message, requestId, details } | none                                                                     |
| CMS-03A-09   | CMS-04                    | POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/successors | SchemaSuccessorRequest → 201 ContentTypeVersionResource            | schema_designer on the readable immutable source; hidden/absent source is 404; insufficient capability is 403                                                          | canonical order; CORS cms-console allowlist; CSRF; strict JSON; rate cms-definition-write                                                                | key and exact source If-Match required; clone commits new draft definition row IDs with remapped local references and stable field identities/keys; source rows never mutated; repeated key replays same draft                                                              | 30/min/user, 60/min/party; 15,000ms; no-store; Tier 2                                            | BE00 ApiError { code, message, requestId, details } | none                                                                     |
| CMS-03A-10   | CMS-04                    | POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/dry-runs  | SchemaDryRunRequest → 202 SchemaDryRunResource                     | schema_designer on the draft; hidden/absent candidate is 404; capability denial is 403                                                                                | canonical order; CORS cms-console allowlist; CSRF; strict JSON; rate cms-definition-write                                                                | key and If-Match required; server derives source/target/compiler/classification; binds immutable report + plan + BE00 job under CAS in one transaction; same-key retry reuses, changed evidence starts a new run | 30/min/user, 60/min/party; 15,000ms acceptance deadline; no-store; Tier 2                        | BE00 ApiError { code, message, requestId, details } | none                                                                     |
| CMS-03A-11   | CMS-04                    | POST /api/v1/cms/content-types/{contentTypeId}/versions/{versionId}/reviews   | SchemaReviewSubmissionRequest → 201 SchemaReviewResource           | schema_designer on a draft with a passed persisted dry run; hidden/absent candidate is 404; capability denial is 403                                                  | canonical order; CORS cms-console allowlist; CSRF; strict JSON; rate cms-definition-write                                                                | key and If-Match required; freezes definition/artifact/compiler/dependency/dry-run/policy evidence; draft → review atomic; one live review per exact candidate evidence  | 30/min/user, 60/min/party; 15,000ms; no-store; Tier 2                                            | BE00 ApiError { code, message, requestId, details } | none                                                                     |
| CMS-03A-12   | CMS-04                    | POST /api/v1/cms/schema-reviews/{reviewId}/decisions                          | SchemaReviewDecisionRequest → 201 SchemaReviewDecisionResource     | assigned cms.schema_review human with recent binding-bound MFA; concealed review is 404; missing assignment/capability is 403                                         | canonical order; CORS cms-console allowlist; CSRF; step-up MFA; strict JSON; rate cms-activation                                                          | key and If-Match required; append one decision; reject submitter/repeated human; recheck frozen evidence and current authority at decision; count resolved from code-owned policy | 30/min/user, 60/min/party; 15,000ms; no-store; Tier 2                                            | BE00 ApiError { code, message, requestId, details } | none                                                                     |
| CMS-03A-13   | CMS-04                    | GET /api/v1/cms/schema-reviews/{reviewId}                                     | path UUID → 200 SchemaReviewResource                               | submitter/schema-designer scope or assigned review-only scope; concealed review is 404; insufficient capability is 403                                               | canonical BE00 order; CORS cms-console allowlist; no request body; strict path; rate cms-definition-read                                                 | no Idempotency-Key or If-Match; exact frozen review version; no public cache; always returns only the capability-safe review projection                              | 120/min/user, 240/min/party; 15,000ms; `Cache-Control: no-store`; Tier 2 protected-read SLO      | BE00 ApiError { code, message, requestId, details } | none                                                                     |
| CMS-03A-14   | CMS-04                    | POST /api/v1/cms/schema-reviews/{reviewId}/assignments                        | SchemaReviewAssignmentRequest → 201/200 SchemaReviewAssignmentResource | existing owner with cms.schema_review.assign derived from the immutable owner initialization receipt; concealed/cross-owner review is 404; capability denial is 403    | canonical order; CORS cms-console allowlist; CSRF; step-up MFA; strict JSON; rate cms-activation                                                          | key and exact review If-Match required; create or revoke only read/decide on one frozen review; expires within seven days and no later than grantor authority; creates no identity; audit atomic | 10/min/user, 20/min/party; 15,000ms; no-store; Tier 2                                            | BE00 ApiError { code, message, requestId, details } | none                                                                     |

### Registry invariants

- Paths use UUID path parameters and are never inferred from labels. ContentType keys and field keys are lowercase ASCII with underscores permitted, stable, never reused, and distinct from labels; block keys use the separate code-owned BlockKey grammar.
- All successful mutation responses include ETag: "<positive decimal version>", Location where a new resource exists, X-Request-Id, and no-store.
- Every row's failure response is ApiError { code, message, requestId, details }; the operation-specific error matrix below is exhaustive.
- CMS-03A-01 through CMS-03A-04 are first-party human console commands. CMS-03A-05 and CMS-03A-08 are signed release commands and cannot be reached with a human session or uploaded JS/CSS/template/expression. CMS-03A-06 and CMS-03A-07 are authenticated no-store reads and never public delivery.
- Browser/protected response envelopes contain no ownership identifiers or release-principal/verification evidence; authorization context stays server-side. Every concrete resource declares the closed state or lifecycle enum mapped to the IA and SQL matrices, and CMS-03A-07 nests only safe registry projections.
- Activation never mutates a previously active version. A prior active version remains readable and serveable until the atomic switch commits.

### Route field validation matrix

| Operation                                    | Field                                                                  | Zod and semantic constraint                                                                                                                                                                                                                                                                                                                                                                          | Failure                                    |
| -------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| CMS-03A-01                                   | typeKey                                                                | string, regex /^[a-z][a-z0-9_]{1,63}$/, not built-in duplicate, retired, reserved canonical concept, or existing key                                                                                                                                                                                                                                                                                 | 422 VALIDATION_FAILED or 409 CONFLICT      |
| CMS-03A-01                                   | label                                                                  | string 2–120 Unicode characters, normalized NFC                                                                                                                                                                                                                                                                                                                                                      | 422 VALIDATION_FAILED                      |
| CMS-03A-01                                   | ownerCapability                                                        | string 1–128, protected capability registry member                                                                                                                                                                                                                                                                                                                                                   | 422 VALIDATION_FAILED                      |
| CMS-03A-01                                   | sourceLocale / defaultLocale                                           | BCP 47 string; source locale is required canonical authoring input; default locale is the governed delivery fallback root                                                                                                                                                                                                                                                                            | 422 VALIDATION_FAILED                      |
| CMS-03A-01                                   | workflowKey / workflowVersion                                          | protected workflow/risk registry key plus positive decimal version; policy snapshot determines review and approval requirements                                                                                                                                                                                                                                                                      | 422 VALIDATION_FAILED or 409 CONFLICT      |
| CMS-03A-01                                   | defaultTemplateVersionId                                               | UUID or null; if present, immutable template version is readable and compatible with the type                                                                                                                                                                                                                                                                                                        | 404 NOT_FOUND or 409 CONFLICT              |
| CMS-03A-01                                   | fields                                                                 | array 0–128; each required stableFieldId UUID, FieldKey, kind closed registry, protected validator ref, default mode/value, localization mode, and strict editor config                                                                                                                                                                                                                              | 422; no partial insert                     |
| CMS-03A-01                                   | relations / templates / capabilityBindings                             | bounded arrays of complete allowlisted relation, immutable template-version, and protected capability references; each is committed in the same aggregate transaction                                                                                                                                                                                                                                | 422/404/409; no partial insert             |
| CMS-03A-02                                   | path IDs                                                               | contentTypeId and versionId UUID; version must belong to type                                                                                                                                                                                                                                                                                                                                        | 400 INVALID_REQUEST or 404 NOT_FOUND       |
| CMS-03A-02                                   | stableFieldId                                                          | UUID; existing field UUID for change/deprecation or omitted only for a new field                                                                                                                                                                                                                                                                                                                     | 422 VALIDATION_FAILED                      |
| CMS-03A-02                                   | key / kind                                                             | key regex /^[a-z][a-z0-9_]{1,63}$/; kind enum short_text, long_text, rich_text, boolean, integer, decimal, date, datetime, enum, taxonomy, relation, media, object, list                                                                                                                                                                                                                             | 422; key/kind change is 409 when immutable |
| CMS-03A-02                                   | constraints / validator                                                | strict kind-specific object, max 64 keys, depth 4, 8 KiB; validator key/version is protected and free-form pattern/expression/code is rejected                                                                                                                                                                                                                                                       | 422 VALIDATION_FAILED                      |
| CMS-03A-02                                   | required/default/localization                                          | required boolean, default mode/value with missing/null distinction, and localization mode `none\|localized\|no_fallback`; required cannot be added over populated data without proven migration                                                                                                                                                                                                      | 422 or 409 CONFLICT                        |
| CMS-03A-02                                   | migrationPlanId                                                        | UUID or null; required for conditional/breaking compatibility                                                                                                                                                                                                                                                                                                                                        | 422 or 409 CONFLICT                        |
| CMS-03A-03                                   | fieldId                                                                | UUID of a relation-kind FieldDefinitionVersion in this type version                                                                                                                                                                                                                                                                                                                                  | 422/409                                    |
| CMS-03A-03                                   | targetKind / targetType / projectionKey                                | target kind enum `content\|domain`, allowlisted target type 1–96 and named projection key 1–128; no arbitrary SQL/table                                                                                                                                                                                                                                                                              | 422 VALIDATION_FAILED                      |
| CMS-03A-03                                   | cardinality / min / max                                                | cardinality `one\|many`; min is integer 0..128; max is finite non-null integer 1..128; min≤max; one requires min 0 \| 1 and max=1; many uses explicit finite bounds                                                                                                                                                                                                                                  | 422                                        |
| CMS-03A-03                                   | ordered / onUnavailable                                                | ordered boolean; `onUnavailable` enum `omit\|block\|placeholder`; absence is never silently treated as omit                                                                                                                                                                                                                                                                                          | 422; no mutation                           |
| CMS-03A-04                                   | expectedVersion                                                        | positive decimal string; exact strong If-Match must match candidate version                                                                                                                                                                                                                                                                                                                          | 400 or 409 CONFLICT                        |
| CMS-03A-04                                   | dryRunId                                                               | UUID for an immutable report containing counts, hashes, compiler version, and result                                                                                                                                                                                                                                                                                                                 | 422/409                                    |
| CMS-03A-04                                   | approvalIds                                                            | bounded UUID array; IDs are request references only; the server resolves distinct humans, capabilities, and recent MFA against immutable activation evidence; count is 1..8 and protected policy requires at least 2                                                                                                                                                                                 | 422/403                                    |
| CMS-03A-04                                   | migrationPlanId                                                        | UUID or null; null only for additive/no-data migration                                                                                                                                                                                                                                                                                                                                               | 422/409                                    |
| CMS-03A-04                                   | expectedActivationEvidenceHash                                         | optional lowercase 64-hex equality expectation for the server-resolved frozen evidence; mismatch never changes policy or evidence and returns typed conflict                                                                                                                                                                                                                                         | 409/422                                    |
| CMS-03A-05                                   | blockKey / blockVersion                                                | canonical BlockKey /^[a-z][a-z0-9._-]{0,95}$/; blockVersion positive safe integer; pair never reused                                                                                                                                                                                                                                                                                                 | 422/409                                    |
| CMS-03A-05                                   | lifecycle                                                              | registration accepts only literal `supported`; later `deprecated`/`withdrawn` values are derived exclusively from CMS-03A-08 lifecycle events                                                                                                                                                                                                                                                        | 422                                        |
| CMS-03A-05                                   | propsSchemaRef / propsSchemaHash                                       | protected reference plus lowercase 64-hex hash of the normalized props schema; identity cannot be replaced by an inline body                                                                                                                                                                                                                                                                         | 422/409                                    |
| CMS-03A-05                                   | propsSchemaSnapshot / attestation / releaseDigest                      | strict normalized snapshot, nested Ed25519 attestation, and lowercase 64-hex release digest; outer Ed25519 signature is carried by the signed release envelope and binds keyId, issuedAt, nonce, and sha256(raw body)                                                                                                                                                                                | 401/422/409                                |
| CMS-03A-05                                   | rendererRef                                                            | registered code manifest reference 1–160 characters; no URL, source text, or uploaded module                                                                                                                                                                                                                                                                                                         | 422                                        |
| CMS-03A-05                                   | children/slot/data rules                                               | strict arrays/objects max 32 children and protected depth/count; data source names allowlisted projection contracts                                                                                                                                                                                                                                                                                  | 422                                        |
| CMS-03A-05                                   | accessibility                                                          | strict contract names required labels, heading behavior, keyboard/focus and status output; no arbitrary HTML                                                                                                                                                                                                                                                                                         | 422                                        |
| CMS-03A-08                                   | blockDefinitionVersionId / lifecycle / expectedVersion / releaseDigest | existing UUID, expected current lifecycle, only supported→deprecated or deprecated→withdrawn, positive decimal expectedVersion, and lowercase 64-hex release digest; no new key/version or mutable version-row write                                                                                                                                                                                 | 400/409/422                                |
| CMS-03A-06                                   | query                                                                  | strict query: `resourceKind` optional allowlisted discriminator, `keyPrefix?`, lifecycle union restricted to lifecycle-bearing kinds (`content_type`, `field_definition_version`, `block_definition_registry_record`), `state?` for state-only kinds, `limit` 1–100, opaque `cursor?`, `sort`, and `direction`; Zod rejects `state` for lifecycle-bearing kinds and `lifecycle` for state-only kinds | 400/422 VALIDATION_FAILED                  |
| CMS-03A-07                                   | path                                                                   | `contentTypeId` and `versionId` UUIDs belonging to one type; no query or body; the response always includes the capability-safe artifact identity/hash                                                                                                                                                                                                                                               | 400 INVALID_REQUEST or 404 NOT_FOUND       |
| CMS-03A-01 through CMS-03A-05 and CMS-03A-08 | mutation headers                                                       | Idempotency-Key 8–128 printable ASCII; If-Match exact quoted positive decimal where required; Content-Type application/json                                                                                                                                                                                                                                                                          | 400 INVALID_REQUEST                        |
| CMS-03A-05 and CMS-03A-08                    | release headers                                                        | exact HTTP names `X-WeJammin-Release-Key-Id`, `X-WeJammin-Release-Issued-At`, `X-WeJammin-Release-Nonce`, and `X-WeJammin-Release-Signature` map to internal `keyId`, `issuedAt`, `nonce`, and `signature`; aliases and JSON copies are rejected                                                                                                                                                     | 400/401                                    |
| CMS-03A-06 and CMS-03A-07                    | read headers                                                           | Idempotency-Key and If-Match must be absent; no Content-Type is required because no body exists                                                                                                                                                                                                                                                                                                      | 400 INVALID_REQUEST                        |
| CMS-03A-06 and CMS-03A-07                    | browser response state/ownership                                       | ResourceMeta contains only id, version, contentHash where applicable, and timestamps; concrete resources use exact per-resource state/lifecycle enums and compiled/active literals; ownership and release evidence are absent                                                                                                                                                                        | 422 response-contract failure              |
| CMS-03A-09                                   | expectedVersion / source If-Match                                      | positive decimal string; exact strong If-Match must match the immutable source version; clone preserves stable field IDs/keys and remaps local references without mutating the source                                                                                                                                                                                                                 | 400 or 409 CONFLICT                        |
| CMS-03A-10                                   | expectedVersion / transformKey / transformVersion                      | draft CAS version; the transform pair is both-null or both-present; the server derives source/target/compiler/classification and refuses caller-supplied counts, hashes, classification, or report; a transform pair present for additive or absent for conditional/breaking is 422                                                                                                                    | 422 or 409 CONFLICT                        |
| CMS-03A-11                                   | expectedVersion / dryRunId                                             | draft CAS version; dryRunId must reference a persisted passed immutable dry run for the same candidate/evidence                                                                                                                                                                                                                                                                                      | 422 or 409 CONFLICT                        |
| CMS-03A-12                                   | expectedVersion / decision                                             | exact review CAS version; decision is approve or reject; the reviewer is server-resolved, must be currently assigned and capable, cannot be the submitter, and cannot repeat a human                                                                                                                                                                                                                 | 422 or 409 CONFLICT                        |
| CMS-03A-13                                   | review-detail response                                                 | returns only the capability-safe review projection: frozen evidence summaries, required/recorded counts, decision references, and permitted next actions; no actor/person/party/private-binding identifiers and no caller-authoritative policy fields                                                                                                                                                   | 422 response-contract failure              |
| CMS-03A-14                                   | action / reviewerPersonId / expiresAt / assignmentId                   | discriminated create/revoke with expectedVersion; create references an authorized eligible existing human and a finite expiresAt no later than seven days from now and no later than the grantor's own authority; revoke references an existing assignment; broad scopes and delegation are rejected                                                                                                  | 422 or 409 CONFLICT                        |
| CMS-03A-09 through CMS-03A-12 and CMS-03A-14 | mutation headers                                                       | Idempotency-Key 8-128 printable ASCII; If-Match exact quoted positive decimal where required; Content-Type application/json                                                                                                                                                                                                                                                                          | 400 INVALID_REQUEST                        |
| CMS-03A-06, CMS-03A-07, and CMS-03A-13      | read headers                                                           | Idempotency-Key and If-Match must be absent; no Content-Type is required because no body exists                                                                                                                                                                                                                                                                                                      | 400 INVALID_REQUEST                        |
| CMS-03A-09 through CMS-03A-14               | browser response state/ownership                                       | ResourceMeta contains only id, version, contentHash where applicable, and timestamps; concrete resources use exact per-resource state enums; actor, person, party, private-binding, ownership, and release evidence are absent                                                                                                                                                                        | 422 response-contract failure              |

## Request/Response Contracts (Zod 4 schemas)

The following are the normative runtime schemas. Zod 4 strict objects generate TypeScript and OpenAPI types; parsing occurs before authorization. The examples omit no required operation field.

```ts
const Json = z.json();
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const TypeKey = z.string().regex(/^[a-z][a-z0-9_]{1,63}$/);
const FieldKey = z.string().regex(/^[a-z][a-z0-9_]{1,63}$/);
const BlockKey = z.string().regex(/^[a-z][a-z0-9._-]{0,95}$/);
const CapabilityKey = z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/);
const ProjectionKey = z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/);
const Locale = z.string().regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/);
const ValidatorKey = z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/);
const ArtifactRef = z
  .string()
  .regex(/^[a-z][a-z0-9._/-]{0,255}$/)
  .refine(
    (value) => !value.includes('..') && !value.includes('//'),
    'artifact reference cannot traverse or contain a URL',
  );
const PropsSchemaSnapshot = z.strictObject({
  schemaVersion: z.string().min(1).max(32),
  fields: z
    .array(
      z.strictObject({
        name: FieldKey,
        kind: z.string().min(1).max(64),
        required: z.boolean(),
        constraints: z.record(z.string(), Json).optional(),
      }),
    )
    .max(128),
  additionalProperties: z.literal(false),
});
const ReleaseKeyId = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/);
const PropsSnapshotAttestation = z.strictObject({
  algorithm: z.literal('Ed25519'),
  keyId: ReleaseKeyId,
  signature: z.string().regex(/^[A-Za-z0-9+/]{86}==$/),
});
const FieldKind = z.enum([
  'short_text',
  'long_text',
  'rich_text',
  'boolean',
  'integer',
  'decimal',
  'date',
  'datetime',
  'enum',
  'taxonomy',
  'relation',
  'media',
  'object',
  'list',
]);
const Constraints = z
  .strictObject({
    minLength: z.number().int().nonnegative().max(100000).optional(),
    maxLength: z.number().int().nonnegative().max(100000).optional(),
    minimum: z.number().finite().optional(),
    maximum: z.number().finite().optional(),
    enumValues: z.array(z.string().max(160)).max(256).optional(),
    itemKind: FieldKind.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.minLength !== undefined &&
      value.maxLength !== undefined &&
      value.minLength > value.maxLength
    ) {
      ctx.addIssue({ code: 'custom', message: 'minLength exceeds maxLength' });
    }
  });
const EditorConfig = z.strictObject({
  label: z.string().min(1).max(120),
  helpText: z.string().max(500).optional(),
  order: z.number().int().nonnegative().max(10000),
});
const FieldDefinitionShape = {
  stableFieldId: UUID,
  key: FieldKey,
  kind: FieldKind,
  constraints: Constraints,
  required: z.boolean(),
  validatorKey: ValidatorKey.nullable(),
  validatorVersion: Version.nullable(),
  defaultMode: z.enum(['none', 'literal', 'inherited']),
  defaultValue: Json.nullable().optional(),
  localizationMode: z.enum(['none', 'localized', 'no_fallback']),
  editorConfig: EditorConfig,
  lifecycle: z.enum(['active', 'deprecated', 'retired']),
};
const validateFieldDefinition = (value, ctx) => {
  if ((value.validatorKey === null) !== (value.validatorVersion === null)) {
    ctx.addIssue({
      code: 'custom',
      path: ['validatorVersion'],
      message: 'validator key and version must be both null or both present',
    });
  }
  const hasDefault = value.defaultValue !== undefined;
  if (value.defaultMode === 'literal' && !hasDefault) {
    ctx.addIssue({
      code: 'custom',
      path: ['defaultValue'],
      message: 'literal default requires defaultValue',
    });
  }
  if (
    (value.defaultMode === 'none' || value.defaultMode === 'inherited') &&
    hasDefault
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['defaultValue'],
      message: `${value.defaultMode} default cannot include defaultValue`,
    });
  }
};
const FieldDefinitionInput = z
  .strictObject(FieldDefinitionShape)
  .superRefine(validateFieldDefinition);
const RelationBindingInput = z
  .strictObject({
    fieldId: UUID,
    targetKind: z.enum(['content', 'domain']),
    targetType: z.string().regex(/^[a-z][a-z0-9._-]{0,95}$/),
    projectionKey: ProjectionKey,
    cardinality: z.enum(['one', 'many']),
    min: z.number().finite().int().min(0).max(128),
    max: z.number().finite().int().min(1).max(128),
    ordered: z.boolean(),
    onUnavailable: z.enum(['omit', 'block', 'placeholder']),
  })
  .superRefine((value, ctx) => {
    if (value.min > value.max) {
      ctx.addIssue({
        code: 'custom',
        path: ['min'],
        message: 'min exceeds max',
      });
    }
    if (value.cardinality === 'one' && value.max !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['max'],
        message: 'one cardinality requires max=1',
      });
    }
    if (value.cardinality === 'one' && ![0, 1].includes(value.min)) {
      ctx.addIssue({
        code: 'custom',
        path: ['min'],
        message: 'one cardinality requires min=0 or min=1',
      });
    }
  });
const OpaqueRelationPlaceholder = z.strictObject({
  status: z.literal('unavailable'),
  reason: z.literal('unavailable'),
});
const TemplateBindingInput = z.strictObject({ templateVersionId: UUID });
const CapabilityBindingInput = z.strictObject({
  capabilityKey: CapabilityKey,
  capabilityVersion: Version,
});
const ContentTypeDraftRequest = z.strictObject({
  typeKey: TypeKey,
  label: z.string().min(2).max(120),
  ownerCapability: z.string().min(1).max(128),
  sourceLocale: Locale,
  defaultLocale: Locale,
  workflowKey: z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/),
  workflowVersion: Version,
  defaultTemplateVersionId: UUID.nullable(),
  fields: z.array(FieldDefinitionInput).max(128),
  relations: z.array(RelationBindingInput).max(128),
  templateBindings: z.array(TemplateBindingInput).max(32),
  capabilityBindings: z.array(CapabilityBindingInput).max(32),
});
const FieldSchemaChangeRequest = z
  .strictObject({
    stableFieldId: UUID.optional(),
    key: FieldKey,
    kind: FieldKind,
    constraints: Constraints,
    required: z.boolean(),
    validatorKey: ValidatorKey.nullable(),
    validatorVersion: Version.nullable(),
    defaultMode: z.enum(['none', 'literal', 'inherited']),
    defaultValue: Json.nullable().optional(),
    localizationMode: z.enum(['none', 'localized', 'no_fallback']),
    editorConfig: EditorConfig,
    lifecycle: z.enum(['active', 'deprecated', 'retired']),
    migrationPlanId: UUID.nullable(),
  })
  .superRefine(validateFieldDefinition);
const RelationBindingRequest = z
  .strictObject({
    fieldId: UUID,
    targetKind: z.enum(['content', 'domain']),
    targetType: z.string().regex(/^[a-z][a-z0-9._-]{0,95}$/),
    projectionKey: ProjectionKey,
    cardinality: z.enum(['one', 'many']),
    min: z.number().finite().int().min(0).max(128),
    max: z.number().finite().int().min(1).max(128),
    ordered: z.boolean(),
    onUnavailable: z.enum(['omit', 'block', 'placeholder']),
  })
  .superRefine((value, ctx) => {
    if (value.min > value.max) {
      ctx.addIssue({
        code: 'custom',
        path: ['min'],
        message: 'min exceeds max',
      });
    }
    if (value.cardinality === 'one' && value.max !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['max'],
        message: 'one cardinality requires max=1',
      });
    }
    if (value.cardinality === 'one' && ![0, 1].includes(value.min)) {
      ctx.addIssue({
        code: 'custom',
        path: ['min'],
        message: 'one cardinality requires min=0 or min=1',
      });
    }
  });
const WorkflowPolicyEvidence = z
  .strictObject({
    key: z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/),
    version: Version,
    policyHash: Hash,
    riskClass: z.enum(['ordinary', 'protected']),
    requiredDecisionCount: z.number().int().min(1).max(8),
    requiredCapabilities: z.array(CapabilityKey).max(16),
    approvalEvidenceHash: Hash,
  })
  .superRefine((value, ctx) => {
    if (
      value.riskClass === 'protected' &&
      value.requiredCapabilities.length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['requiredCapabilities'],
        message: 'protected policy requires a named capability',
      });
    }
    if (value.riskClass === 'protected' && value.requiredDecisionCount < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['requiredDecisionCount'],
        message: 'protected policy requires at least two decisions',
      });
    }
  });
const SchemaActivationRequest = z
  .strictObject({
    expectedVersion: Version,
    dryRunId: UUID,
    approvalIds: z.array(UUID).min(1).max(8),
    migrationPlanId: UUID.nullable(),
    expectedActivationEvidenceHash: Hash.optional(),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.approvalIds).size !== value.approvalIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['approvalIds'],
        message: 'approval IDs must be distinct',
      });
    }
  });
const SchemaSuccessorRequest = z.strictObject({
  expectedVersion: Version,
});
const SchemaDryRunRequest = z
  .strictObject({
    expectedVersion: Version,
    transformKey: ValidatorKey.nullable(),
    transformVersion: Version.nullable(),
  })
  .superRefine((value, ctx) => {
    if ((value.transformKey === null) !== (value.transformVersion === null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['transformVersion'],
        message: 'transform key and version must be both null or both present',
      });
    }
  });
const SchemaReviewSubmissionRequest = z.strictObject({
  expectedVersion: Version,
  dryRunId: UUID,
});
const SchemaReviewDecisionRequest = z.strictObject({
  expectedVersion: Version,
  decision: z.enum(['approve', 'reject']),
});
const SchemaReviewAssignmentRequest = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('create'),
    expectedVersion: Version,
    reviewerPersonId: UUID,
    expiresAt: z.string().datetime({ offset: true }),
    reason: z.string().min(1).max(256).optional(),
  }),
  z.strictObject({
    action: z.literal('revoke'),
    expectedVersion: Version,
    assignmentId: UUID,
    reason: z.string().min(1).max(256).optional(),
  }),
]);
const BlockRegistrationRequest = z.strictObject({
  blockKey: BlockKey,
  blockVersion: z.number().int().positive().max(2147483647),
  propsSchemaRef: ArtifactRef,
  propsSchemaHash: z.string().regex(/^[a-f0-9]{64}$/),
  propsSchemaSnapshot: PropsSchemaSnapshot,
  propsSnapshotHash: Hash,
  propsSnapshotAttestation: PropsSnapshotAttestation,
  rendererRef: z.string().regex(/^[a-z][a-z0-9._/-]{0,159}$/),
  allowedChildren: z.array(BlockKey).max(32),
  slotRules: z.strictObject({
    maxDepth: z.number().int().min(1).max(16),
    maxNodes: z.number().int().min(1).max(512),
  }),
  dataSourcePermissions: z
    .array(z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/))
    .max(32),
  accessibility: z.strictObject({
    nameRequired: z.boolean(),
    keyboard: z.literal(true),
    focusOrder: z.enum(['document', 'managed']),
    statusAnnouncement: z.boolean(),
  }),
  compatibility: z.strictObject({
    minSchemaCompiler: z.string().min(1).max(32),
    maxSchemaCompiler: z.string().min(1).max(32),
  }),
  lifecycle: z.literal('supported'),
  releaseDigest: z.string().regex(/^[a-f0-9]{64}$/),
});
const BlockLifecycleAdvanceRequest = z
  .strictObject({
    fromLifecycle: z.enum(['supported', 'deprecated']),
    toLifecycle: z.enum(['deprecated', 'withdrawn']),
    expectedVersion: Version,
    releaseDigest: Hash,
  })
  .superRefine((value, ctx) => {
    if (!(
      (value.fromLifecycle === 'supported' &&
        value.toLifecycle === 'deprecated') ||
      (value.fromLifecycle === 'deprecated' &&
        value.toLifecycle === 'withdrawn')
    )) {
      ctx.addIssue({
        code: 'custom',
        path: ['toLifecycle'],
        message: 'lifecycle can advance only supported→deprecated→withdrawn',
      });
    }
  });
const ReleaseEnvelopeHeaders = z.strictObject({
  keyId: ReleaseKeyId,
  issuedAt: z.string().datetime({ offset: true }),
  nonce: UUID,
  signature: z.string().regex(/^[A-Za-z0-9+/]{86}==$/),
});

const internalReleaseHeaders = ReleaseEnvelopeHeaders.parse({
  keyId: request.headers.get('X-WeJammin-Release-Key-Id'),
  issuedAt: request.headers.get('X-WeJammin-Release-Issued-At'),
  nonce: request.headers.get('X-WeJammin-Release-Nonce'),
  signature: request.headers.get('X-WeJammin-Release-Signature'),
});
```

CMS-03A-05 and CMS-03A-08 require `ReleaseEnvelopeHeaders` before JSON parsing. The Ed25519
HTTP wire header names are exactly `X-WeJammin-Release-Key-Id`,
`X-WeJammin-Release-Issued-At`, `X-WeJammin-Release-Nonce`, and
`X-WeJammin-Release-Signature`; they map to the internal `keyId`, `issuedAt`,
`nonce`, and `signature` fields shown above. Other header spellings (including
bare internal field names), aliases, or a JSON copy of these headers are
rejected. `signature` is canonical padded base64 for the 64-byte Ed25519
signature. The signing input is
the exact UTF-8 bytes of the newline-delimited string
`WEJAMMIN-${operationId}-RELEASE-V1\n${keyId}\n${issuedAt}\n${nonce}\n${sha256(rawBody)}`;
the domain separator, exact received header values, hash encoding, and field
order are versioned and immutable. `sha256(rawBody)` is lowercase 64-hex over
the untouched request bytes. The server accepts only a `keyId` whose public key
is valid and not revoked in the protected trust registry, permits at most five
minutes of clock skew, and rejects a nonce seen in the replay store for at
least ten minutes. Key rotation requires an overlap window in which both old
and new keys are valid. After successful verification the server persists
immutable `releaseKeyId`, `releaseRawBodyHash`, `releaseSignatureHash`,
`releaseNonceHash`, and `releaseVerifiedAt` evidence with the block row or
lifecycle event; these fields are never caller-authoritative. A durable
`cms_release_nonce_receipts` row is inserted/claimed by `(keyId, nonceHash)`
before either operation is accepted, records issuedAt, expiresAt, consumedAt,
operationId, rawBodyHash, signatureHash, and verification outcome, and retains
the receipt for at least ten minutes. A duplicate key/nonce is rejected before
mutation and cannot be made valid by idempotency replay. The caller-supplied
`expectedActivationEvidenceHash` is an equality expectation only; policy,
approvals, capabilities, distinct humans, and MFA are resolved server-side.

`propsSchemaSnapshot` is normalized before hashing. `propsSnapshotHash` is the
lowercase SHA-256 of the exact RFC 8785 JSON Canonicalization Scheme (JCS)
UTF-8 bytes of that normalized snapshot. `propsSnapshotAttestation` is an
Ed25519 signature over the exact UTF-8 bytes of
`WEJAMMIN-CMS-03A-05-PROPS-V1\n${blockKey}\n${blockVersion}\n${propsSchemaRef}\n${propsSchemaHash}\n${propsSnapshotHash}\n${releaseDigest}`.
The attestation `keyId` and literal `algorithm: 'Ed25519'` must resolve to a
currently trusted, non-revoked release-trust public key; verification occurs
after JCS normalization and before persistence. The block row persists the
attestation key ID, signature hash, normalized snapshot hash, and verification
timestamp as immutable evidence. Any mismatch between snapshot, hash, block
key/version, or release digest is rejected.

Success resources are strict and expose no private definition payload beyond the authorized caller's registry scope:

```ts
const ContentTypeVersionState = z.enum([
  'draft',
  'review',
  'approved',
  'scheduled',
  'active',
  'superseded',
  'retired',
  'blocked',
]);
const RelationDefinitionState = z.enum([
  'draft',
  'review',
  'approved',
  'scheduled',
  'active',
  'superseded',
  'retired',
  'blocked',
]);
const TemplateBindingState = z.enum([
  'draft',
  'review',
  'approved',
  'scheduled',
  'active',
  'superseded',
  'retired',
  'blocked',
]);
const CapabilityBindingState = z.enum([
  'draft',
  'review',
  'approved',
  'scheduled',
  'active',
  'superseded',
  'retired',
  'blocked',
]);
const ResourceMeta = z.strictObject({
  id: UUID,
  version: Version,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
const LifecycleResourceMeta = z.strictObject({
  id: UUID,
  version: Version,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
const ContentTypeVersionResource = ResourceMeta.extend({
  resourceKind: z.literal('content_type_version'),
  state: ContentTypeVersionState,
  contentTypeId: UUID,
  typeKey: TypeKey,
  label: z.string().trim().min(2).max(120),
  ownerCapability: z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/),
  sourceLocale: Locale,
  defaultLocale: Locale,
  workflowKey: z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/),
  workflowVersion: Version,
  defaultTemplateVersionId: UUID.nullable(),
  schemaArtifactId: UUID,
  fieldCount: z.number().int().nonnegative(),
  relationCount: z.number().int().nonnegative(),
  capabilityBindingCount: z.number().int().nonnegative(),
  compatibility: z.enum(['additive', 'conditional', 'breaking', 'unknown']),
  dryRunId: UUID.nullable(),
  activationEvidence: WorkflowPolicyEvidence.nullable(),
}).superRefine((value, ctx) => {
  if (
    ['active', 'superseded', 'retired'].includes(value.state) &&
    value.activationEvidence === null
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['activationEvidence'],
      message: 'activated versions require frozen policy and approval evidence',
    });
  }
});
const ContentTypeResource = z.strictObject({
  resourceKind: z.literal('content_type'),
  id: UUID,
  version: Version,
  typeKey: TypeKey,
  builtIn: z.boolean(),
  lifecycle: z.enum(['active', 'retired']),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
const FieldDefinitionVersionResource = LifecycleResourceMeta.extend({
  resourceKind: z.literal('field_definition_version'),
  contentTypeVersionId: UUID,
  stableFieldId: UUID,
  key: FieldKey,
  kind: FieldKind,
  required: z.boolean(),
  validatorKey: ValidatorKey.nullable(),
  validatorVersion: Version.nullable(),
  defaultMode: z.enum(['none', 'literal', 'inherited']),
  localizationMode: z.enum(['none', 'localized', 'no_fallback']),
  lifecycle: z.enum(['active', 'deprecated', 'retired']),
  migrationPlanId: UUID.nullable(),
});
const RelationDefinitionResource = ResourceMeta.extend({
  resourceKind: z.literal('relation_definition'),
  state: RelationDefinitionState,
  contentTypeVersionId: UUID,
  fieldId: UUID,
  targetKind: z.enum(['content', 'domain']),
  targetType: z.string().regex(/^[a-z][a-z0-9._-]{0,95}$/),
  projectionKey: ProjectionKey,
  cardinality: z.enum(['one', 'many']),
  min: z.number().finite().int().nonnegative().max(128),
  max: z.number().finite().int().min(1).max(128),
  ordered: z.boolean(),
  onUnavailable: z.enum(['omit', 'block', 'placeholder']),
});
const SchemaArtifactResource = z.strictObject({
  resourceKind: z.literal('schema_artifact'),
  id: UUID,
  version: Version,
  state: z.literal('compiled'),
  contentTypeVersionId: UUID,
  compilerVersion: z.string().min(1).max(32),
  zodContractRef: z.string().min(1).max(256),
  artifactHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  compiledAt: z.string().datetime({ offset: true }),
});
const SchemaActivationResource = ResourceMeta.extend({
  state: z.literal('active'),
  contentTypeVersionId: UUID,
  activatedAt: z.string().datetime({ offset: true }).nullable(),
  migrationPlanId: UUID.nullable(),
  activationEvidence: WorkflowPolicyEvidence,
  jobId: UUID.nullable(),
  eventType: z.literal('cms.schema.activated.v1'),
});
const SchemaDryRunState = z.enum(['queued', 'running', 'completed', 'failed']);
const SchemaDryRunResource = ResourceMeta
  .extend({
    resourceKind: z.literal('schema_dry_run'),
    state: SchemaDryRunState,
    contentTypeVersionId: UUID,
    // Derived server-side at creation; never caller-supplied.
    classification: z.enum(['additive', 'conditional', 'breaking', 'unknown']),
    attemptId: UUID,
    jobId: UUID,
    migrationPlanId: UUID,
    compilerVersion: z.string().min(1).max(32),
    transformKey: ValidatorKey.nullable(),
    transformVersion: Version.nullable(),
    // Final evidence is null until the actual scan seals the report.
    result: z.enum(['passed', 'failed']).nullable(),
    failureCode: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/).nullable(),
    sourceCount: z.number().int().nonnegative().nullable(),
    targetCount: z.number().int().nonnegative().nullable(),
    rowErrorCount: z.number().int().nonnegative().nullable(),
    sourceHash: Hash.nullable(),
    targetHash: Hash.nullable(),
    reportHash: Hash.nullable(),
  })
  .superRefine((value, ctx) => {
    const sealed = value.state === 'completed';
    const sealedFields = [
      value.result,
      value.sourceCount,
      value.targetCount,
      value.rowErrorCount,
      value.sourceHash,
      value.targetHash,
      value.reportHash,
    ];
    if (sealed && sealedFields.some((field) => field === null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['state'],
        message: 'a completed dry-run must expose sealed report evidence',
      });
    }
    if (!sealed && sealedFields.some((field) => field !== null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['state'],
        message: 'an unsealed dry-run cannot carry final report evidence',
      });
    }
    // A sealed pass is only valid with a proven zero row-error scan; a sealed
    // fail must carry the actual sealed scan errors. Infrastructure failure is
    // the separate unsealed 'failed' state, distinguished by its failure code.
    if (sealed && value.result === 'passed' && value.rowErrorCount !== 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['rowErrorCount'],
        message: 'a passed dry-run requires zero row errors',
      });
    }
    if (sealed && value.result === 'failed' && value.rowErrorCount === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['rowErrorCount'],
        message: 'a sealed failing scan must carry the actual scan errors',
      });
    }
    if (value.state === 'failed' && value.failureCode === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['failureCode'],
        message: 'an unsealed failed dry-run requires a safe failure code',
      });
    }
    if (value.state !== 'failed' && value.failureCode !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['failureCode'],
        message: 'only a failed dry-run carries a failure code',
      });
    }
  });
const SchemaReviewState = z.enum(['open', 'approved', 'rejected', 'invalidated']);
const SchemaReviewNextAction = z.enum([
  'create_successor',
  'start_dry_run',
  'submit_review',
  'assign_reviewer',
  'record_decision',
  'activate',
]);
const SchemaReviewDecisionOutcome = z.enum(['approve', 'reject']);
const SchemaReviewFrozenEvidence = z.strictObject({
  contentTypeVersionId: UUID,
  contentTypeVersionNo: Version,
  definitionHash: Hash,
  schemaArtifact: z.strictObject({
    id: UUID,
    state: z.literal('compiled'),
    compilerVersion: z.string().min(1).max(32),
    zodContractRef: z.string().min(1).max(256),
    artifactHash: Hash,
  }),
  dependencyManifestHash: Hash,
  dryRun: z.strictObject({
    id: UUID,
    state: SchemaDryRunState,
    result: z.enum(['passed', 'failed']).nullable(),
    reportHash: Hash.nullable(),
  }),
});
const SchemaReviewResource = ResourceMeta.extend({
  resourceKind: z.literal('schema_review'),
  state: SchemaReviewState,
  contentTypeId: UUID,
  contentTypeVersionId: UUID,
  contentTypeVersionNo: Version,
  riskClass: z.enum(['ordinary', 'protected']),
  requiredDecisionCount: z.number().int().min(1).max(8),
  requiredCapabilities: z.array(CapabilityKey).min(1).max(16),
  distinctApprovalCount: z.number().int().nonnegative(),
  recordedDecisionCount: z.number().int().nonnegative(),
  frozenEvidence: SchemaReviewFrozenEvidence,
  dryRunId: UUID,
  policyKey: z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/),
  policyVersion: Version,
  policyHash: Hash,
  approvalEvidenceHash: Hash.nullable(),
  submittedAt: z.string().datetime({ offset: true }),
  decidedAt: z.string().datetime({ offset: true }).nullable(),
  decisions: z
    .array(
      z.strictObject({
        id: UUID,
        decision: SchemaReviewDecisionOutcome,
        capability: CapabilityKey,
        decidedAt: z.string().datetime({ offset: true }),
      }),
    )
    .max(8),
  permittedNextActions: z.array(SchemaReviewNextAction).max(6),
}).superRefine((value, ctx) => {
  const approves = value.decisions.filter(
    (decision) => decision.decision === 'approve',
  ).length;
  const decisionIds = new Set(value.decisions.map((decision) => decision.id));
  if (decisionIds.size !== value.decisions.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['decisions'],
      message: 'decision references must be unique',
    });
  }
  if (value.recordedDecisionCount !== value.decisions.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['recordedDecisionCount'],
      message: 'recorded decision count must equal the decision references',
    });
  }
  // recordedDecisionCount is the immutable append-only history (<= 8), while
  // distinctApprovalCount is the number of distinct humans still qualifying
  // after the current authority/MFA recheck; a revoked or ineligible human is
  // no longer counted as an approver even though their recorded decision stays.
  if (value.distinctApprovalCount > approves) {
    ctx.addIssue({
      code: 'custom',
      path: ['distinctApprovalCount'],
      message: 'distinct qualifying approvers cannot exceed recorded approvals',
    });
  }
  if (
    value.state === 'approved' &&
    value.distinctApprovalCount !== value.requiredDecisionCount
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['state'],
      message: 'an approved review requires exactly the policy decision count',
    });
  }
  if (value.decisions.some((decision) => decision.decision === 'reject')) {
    if (value.state === 'approved') {
      ctx.addIssue({
        code: 'custom',
        path: ['state'],
        message: 'a review with a rejection cannot be approved',
      });
    }
  }
});
const SchemaReviewDecisionResource = ResourceMeta.extend({
  resourceKind: z.literal('schema_review_decision'),
  reviewId: UUID,
  decision: SchemaReviewDecisionOutcome,
  capability: CapabilityKey,
  decidedAt: z.string().datetime({ offset: true }),
});
const SchemaReviewAssignmentResource = ResourceMeta.extend({
  resourceKind: z.literal('schema_review_assignment'),
  reviewId: UUID,
  state: z.enum(['active', 'revoked']),
  capability: z.literal('cms.schema_review'),
  actions: z.tuple([z.literal('read'), z.literal('decide')]),
  startsAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  reason: z.string().min(1).max(256).nullable(),
});
const SchemaActivationPreparation = z.strictObject({
  dryRunRef: z
    .strictObject({
      id: UUID,
      state: SchemaDryRunState,
      result: z.enum(['passed', 'failed']).nullable(),
      jobId: UUID.nullable(),
    })
    .nullable(),
  jobRef: z
    .strictObject({
      id: UUID,
      state: z.enum([
        'queued',
        'running',
        'retrying',
        'completed',
        'failed_retryable',
        'failed_terminal',
      ]),
    })
    .nullable(),
  reviewRef: z
    .strictObject({
      id: UUID,
      state: SchemaReviewState,
    })
    .nullable(),
  permittedNextActions: z.array(SchemaReviewNextAction).max(6),
});
const BlockDefinitionVersionResource = LifecycleResourceMeta.extend({
  resourceKind: z.literal('block_definition_version'),
  blockKey: BlockKey,
  blockVersion: z.number().int().positive(),
  propsSchemaRef: ArtifactRef,
  propsSchemaHash: z.string().regex(/^[a-f0-9]{64}$/),
  propsSchemaSnapshot: PropsSchemaSnapshot,
  propsSnapshotHash: Hash,
  propsSnapshotAttestation: PropsSnapshotAttestation,
  rendererRef: z.string().regex(/^[a-z][a-z0-9._/-]{0,159}$/),
  releaseDigest: z.string().regex(/^[a-f0-9]{64}$/),
  releaseKeyId: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/),
  releaseRawBodyHash: Hash,
  releaseSignatureHash: Hash,
  releaseNonceHash: Hash,
  releaseVerifiedAt: z.string().datetime({ offset: true }),
  lifecycle: z.enum(['supported', 'deprecated', 'withdrawn']),
});
const BlockDefinitionRegistryRecord = z.strictObject({
  resourceKind: z.literal('block_definition_registry_record'),
  id: UUID,
  version: Version,
  blockKey: BlockKey,
  blockVersion: z.number().int().positive(),
  propsSchemaRef: ArtifactRef,
  propsSchemaHash: Hash,
  rendererRef: z.string().regex(/^[a-z][a-z0-9._/-]{0,159}$/),
  releaseDigest: Hash,
  lifecycle: z.enum(['supported', 'deprecated', 'withdrawn']),
});
const BlockLifecycleEventResource = z.strictObject({
  resourceKind: z.literal('block_definition_lifecycle_event'),
  id: UUID,
  version: Version,
  blockDefinitionVersionId: UUID,
  blockKey: BlockKey,
  blockVersion: z.number().int().positive(),
  fromLifecycle: z.enum(['supported', 'deprecated']),
  toLifecycle: z.enum(['deprecated', 'withdrawn']),
  lifecycle: z.enum(['deprecated', 'withdrawn']),
  releaseDigest: Hash,
  releaseKeyId: ReleaseKeyId,
  releaseNonceHash: Hash,
  releaseVerifiedAt: z.string().datetime({ offset: true }),
  eventType: z.literal('cms.block.lifecycle.changed.v1'),
  createdAt: z.string().datetime({ offset: true }),
});
const TemplateBindingResource = z.strictObject({
  resourceKind: z.literal('template_binding'),
  id: UUID,
  contentTypeVersionId: UUID,
  templateVersionId: UUID,
  position: z.number().int().nonnegative(),
  version: Version,
  state: TemplateBindingState,
});
const CapabilityBindingResource = z.strictObject({
  resourceKind: z.literal('capability_binding'),
  id: UUID,
  contentTypeVersionId: UUID,
  capabilityKey: CapabilityKey,
  capabilityVersion: Version,
  version: Version,
  state: CapabilityBindingState,
});
const RegistryResourceKind = z.enum([
  'content_type',
  'content_type_version',
  'field_definition_version',
  'relation_definition',
  'schema_artifact',
  'block_definition_registry_record',
  'template_binding',
  'capability_binding',
]);
const ResourceKindLifecycle = z.discriminatedUnion('resourceKind', [
  z.strictObject({
    resourceKind: z.literal('content_type'),
    lifecycle: z.enum(['active', 'retired']),
  }),
  z.strictObject({
    resourceKind: z.literal('field_definition_version'),
    lifecycle: z.enum(['active', 'deprecated', 'retired']),
  }),
  z.strictObject({
    resourceKind: z.literal('block_definition_registry_record'),
    lifecycle: z.enum(['supported', 'deprecated', 'withdrawn']),
  }),
]);
const RegistryLifecycleByResourceKind: Partial<
  Record<z.infer<typeof RegistryResourceKind>, readonly string[]>
> = {
  content_type: ['active', 'retired'],
  field_definition_version: ['active', 'deprecated', 'retired'],
  block_definition_registry_record: ['supported', 'deprecated', 'withdrawn'],
};
const LifecycleResourceKinds = new Set([
  'content_type',
  'field_definition_version',
  'block_definition_registry_record',
]);
const StateResourceKinds = new Set([
  'content_type_version',
  'relation_definition',
  'schema_artifact',
  'template_binding',
  'capability_binding',
]);
const ContentSchemaRegistryRecord = z.discriminatedUnion('resourceKind', [
  ContentTypeResource,
  ContentTypeVersionResource,
  FieldDefinitionVersionResource,
  RelationDefinitionResource,
  SchemaArtifactResource,
  BlockDefinitionRegistryRecord,
  TemplateBindingResource,
  CapabilityBindingResource,
]);
const ContentSchemaRegistryListQuery = z
  .strictObject({
    resourceKind: RegistryResourceKind.optional(),
    keyPrefix: z
      .string()
      .regex(/^[a-z][a-z0-9._-]{0,63}$/)
      .optional(),
    lifecycle: z
      .enum(['active', 'retired', 'deprecated', 'supported', 'withdrawn'])
      .optional(),
    state: z
      .enum([
        'draft',
        'review',
        'approved',
        'scheduled',
        'active',
        'superseded',
        'retired',
        'blocked',
        'compiled',
      ])
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().min(1).max(512).optional(),
    sort: z.enum(['key', 'createdAt', 'updatedAt', 'version']).default('key'),
    direction: z.enum(['asc', 'desc']).default('asc'),
  })
  .superRefine((value, ctx) => {
    if (
      value.resourceKind &&
      value.lifecycle &&
      (!RegistryLifecycleByResourceKind[value.resourceKind] ||
        !RegistryLifecycleByResourceKind[value.resourceKind].includes(
          value.lifecycle,
        ))
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['lifecycle'],
        message: 'lifecycle is incompatible with resourceKind',
      });
    }
    if (
      value.resourceKind &&
      value.state &&
      LifecycleResourceKinds.has(value.resourceKind)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['state'],
        message: 'state is rejected for lifecycle-bearing resourceKind',
      });
    }
    if (
      value.resourceKind &&
      value.lifecycle &&
      StateResourceKinds.has(value.resourceKind)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['lifecycle'],
        message: 'lifecycle is rejected for state-only resourceKind',
      });
    }
  });
const ContentSchemaRegistryListPage = z.strictObject({
  items: z.array(ContentSchemaRegistryRecord).max(100),
  nextCursor: z.string().min(1).max(512).nullable(),
});
const ContentSchemaRegistryDetail = z.strictObject({
  resourceKind: z.literal('content_type_version'),
  resource: ContentTypeVersionResource,
  fields: z.array(FieldDefinitionVersionResource).max(128),
  relations: z.array(RelationDefinitionResource).max(128),
  schemaArtifact: SchemaArtifactResource,
  templateBindings: z.array(TemplateBindingResource).max(32),
  capabilityBindings: z.array(CapabilityBindingResource).max(32),
  blockDefinitions: z.array(BlockDefinitionRegistryRecord).max(128),
  activationPreparation: SchemaActivationPreparation,
});
```

`BlockDefinitionVersionResource` is the full CMS-03A-05 release-worker
response. Protected CMS-03A-06/07 projections and the `ContentSchemaRegistryRecord`
union use only `BlockDefinitionRegistryRecord`; it contains registry identity,
the literal `resourceKind: 'block_definition_registry_record'`, lifecycle,
release digest, props reference/hash, and safe renderer identity. It never
contains `propsSchemaSnapshot`, propsSnapshotAttestation, release key/body/
nonce hashes, verification timestamps, source, or executable evidence. Frontend
consumers use this safe record only.

For every relation with `onUnavailable: 'placeholder'`, the only fallback
payload is `OpaqueRelationPlaceholder` — exactly
`{ status: 'unavailable', reason: 'unavailable' }`. It carries no target
identifier, type, key, title, data, or existence distinction.

There is no optional artifact query flag. CMS-03A-07 always returns the
capability-safe artifact identity/hash required by its detail contract, while
release verification evidence remains worker-only.

The DEC-108 activation producers return their own safe discriminated resources:
CMS-03A-09 returns ContentTypeVersionResource, CMS-03A-10 returns
SchemaDryRunResource, CMS-03A-11 and CMS-03A-13 return SchemaReviewResource,
CMS-03A-12 returns SchemaReviewDecisionResource, and CMS-03A-14 returns
SchemaReviewAssignmentResource. None of these responses contains an actor,
person, party, or private acting-context binding identifier. The
SchemaReviewAssignmentResource exposes only the safe assignment projection
(review, state, the fixed capability, the read/decide actions, start/expiry, and
an optional reason); the owner-supplied `reviewerPersonId` is a request
reference, never echoed back, and the resolved reviewer/grantor person and
binding identities remain server-side. The
`ContentSchemaRegistryDetail.activationPreparation` projection carries only
dry-run/job/review references, the resolved next actions, and the server-derived
readiness — never actor ownership identifiers, the private binding id, raw
content, or caller-authoritative policy fields.

The stable private actor/person/party/binding projection hash is computed
server-side only and is never exposed to the browser as a context evidence
field or correlation token; the confirmation and review UI receive only these
safe resources, the server-verified human-readable acting-context label, and the
expiring MFA disclosure. The public lowercase 64-hex approval-evidence digest is
the only review evidence serialized, and no separate actor-scope correlation
token is required.

On a SchemaReviewResource, `recordedDecisionCount` and `decisions` are the
immutable append-only decision history (at most eight, unique per human, the
submitter and repeated humans excluded), while `distinctApprovalCount` is the
number of distinct humans who still qualify after the current authority/MFA
recheck — a revoked or since-ineligible human stops counting as an approver
without erasing their recorded decision. An `approved` review requires
`distinctApprovalCount` to equal the policy `requiredDecisionCount` exactly,
and a review holding any rejection cannot be approved. In the
`activationPreparation.dryRunRef`, `result` stays `null` until the actual scan
seals the report: a `queued`/`running` reference must never report `passed`,
and only a `completed` passed report with zero row errors is a satisfiable
readiness input.

The `lifecycle` filter is a closed union with this compatibility matrix:

| resourceKind                       | Accepted lifecycle values              |
| ---------------------------------- | -------------------------------------- |
| `content_type`                     | `active`, `retired`                    |
| `field_definition_version`         | `active`, `deprecated`, `retired`      |
| `block_definition_registry_record` | `supported`, `deprecated`, `withdrawn` |

When `resourceKind` is omitted, the server applies the requested lifecycle to
all three lifecycle-bearing resource kinds for which that value is compatible;
state-only resources are not matched. When `resourceKind` names a state-only
resource, any lifecycle filter is rejected as incompatible rather than treated
as an unfiltered query. `ResourceKindLifecycle` and the query refinement reject
an incompatible pair before authorization or database access. State-only
resources use the separate `state` filter and state is never interpreted as a
lifecycle value.

The declared HTTP responses are 201 for draft/field/relation/block creation
and lifecycle-advance event append, plus successor-draft, review-submission,
review-decision, and assignment-create (201); 202 for activation and dry-run
acceptance when migration/projection work is queued; 200 for a completed
synchronous activation, an assignment revocation, or either protected registry
read. CMS-03A-04 always returns SchemaActivationResource with a jobId when work
remains. CMS-03A-06 returns ContentSchemaRegistryListPage, CMS-03A-07 returns
ContentSchemaRegistryDetail, CMS-03A-13 returns SchemaReviewResource, and
CMS-03A-14 returns SchemaReviewAssignmentResource on both create and revoke.
Every operation returns ApiError { code, message, requestId, details } on failure.

### Contract and error matrix

| Operation ID | 400                                            | 401                                    | 403                                   | 404                                                                   | 409                                                                    | 415                     | 422                                             | 429                              | 502/503/504                          | 500                     |
| ------------ | ---------------------------------------------- | -------------------------------------- | ------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------- | ----------------------------------------------- | -------------------------------- | ------------------------------------ | ----------------------- |
| CMS-03A-01   | malformed JSON/path/header, missing key        | missing/expired session                | capability/scope denied               | concealed target scope or absent key only after structural validation | type key collision or idempotency mismatch                             | non-JSON                | field/registry/quota schema failure             | cms-definition-write limit       | RPC unavailable/deadline             | scrubbed internal error |
| CMS-03A-02   | malformed path/header/body                     | missing/expired session                | draft capability denied               | type/version hidden or absent                                         | stale ETag, immutable field/key, idempotency mismatch                  | non-JSON                | kind/constraint/migration schema failure        | cms-definition-write limit       | RPC unavailable/deadline             | scrubbed internal error |
| CMS-03A-03   | malformed path/header/body                     | missing/expired session                | draft capability denied               | type/version hidden or absent                                         | stale ETag, duplicate field binding, idempotency mismatch              | non-JSON                | target/projection/cardinality allowlist failure | cms-definition-write limit       | RPC unavailable/deadline             | scrubbed internal error |
| CMS-03A-04   | malformed path/header/body                     | missing/expired or missing step-up MFA | capability/approval evidence denied   | candidate hidden or absent                                            | stale ETag, invalid state, dry-run/hash mismatch, idempotency mismatch | non-JSON                | approval/migration schema failure               | cms-activation limit             | compiler/RPC/deadline; Retry-After   | scrubbed internal error |
| CMS-03A-05   | malformed signature/header/body                | no valid release principal/signature   | human, wrong release, or scope denied | unknown release registration target                                   | key/version/digest collision, idempotency mismatch                     | unsupported media       | manifest/renderer/accessibility failure         | release-registry-write limit     | registry/RPC/deadline                | scrubbed internal error |
| CMS-03A-08   | malformed signature/header/body/path           | no valid release principal/signature   | human, wrong release, or scope denied | unknown/unreadable block version                                      | stale lifecycle/version, invalid advance, duplicate nonce/idempotency  | unsupported media       | lifecycle/release-digest schema failure         | release-registry-lifecycle limit | registry/RPC/deadline                | scrubbed internal error |
| CMS-03A-06   | malformed query/cursor or mutation-only header | missing/expired session                | registry-read capability denied       | not emitted for concealed rows; rows are omitted                      | not emitted                                                            | not applicable; no body | filter/sort/page validation failure             | cms-definition-read limit        | projection/RPC/deadline; Retry-After | scrubbed internal error |
| CMS-03A-07   | malformed UUID or mutation-only header         | missing/expired session                | detail capability denied              | concealed, absent, or mismatched type/version                         | not emitted                                                            | not applicable; no body | not emitted; path-only request                  | cms-definition-read limit        | projection/RPC/deadline; Retry-After | scrubbed internal error |
| CMS-03A-09   | malformed path/header/body                     | missing/expired session                | source capability denied              | source hidden or absent                                               | stale source If-Match or idempotency mismatch; source already active  | non-JSON                | clone/definition schema failure                 | cms-definition-write limit       | RPC unavailable/deadline             | scrubbed internal error |
| CMS-03A-10   | malformed path/header/body                     | missing/expired session                | draft capability denied               | candidate hidden or absent                                            | stale version, invalid classification/transform pairing, idempotency mismatch | non-JSON                | transform/registry/count-input schema failure   | cms-definition-write limit       | queue/RPC/deadline; Retry-After      | scrubbed internal error |
| CMS-03A-11   | malformed path/header/body                     | missing/expired session                | draft capability denied               | candidate hidden or absent                                            | stale version, dry-run not passed, existing live review, idempotency mismatch | non-JSON                | review-freeze schema failure                    | cms-definition-write limit       | RPC unavailable/deadline             | scrubbed internal error |
| CMS-03A-12   | malformed path/header/body                     | missing/expired session or missing step-up MFA | assignment/capability denied    | review hidden or absent; concealed review is indistinguishable        | stale review version, submitter/self or repeated human, frozen-evidence drift, idempotency mismatch | non-JSON                | decision schema failure                         | cms-activation limit             | RPC unavailable/deadline; Retry-After | scrubbed internal error |
| CMS-03A-13   | malformed UUID or mutation-only header         | missing/expired session                | review-detail capability denied       | concealed, absent, or out-of-scope review                            | not emitted                                                            | not applicable; no body | not emitted; path-only request                  | cms-definition-read limit        | projection/RPC/deadline; Retry-After | scrubbed internal error |
| CMS-03A-14   | malformed path/header/body                     | missing/expired session or missing step-up MFA | owner assignment capability denied; cross-owner concealed | review hidden, absent, or cross-owner                       | stale review version, invalid expiry, unknown/ineligible human, broad scope/delegation, self/submitter target, revoke of a non-existent assignment, idempotency mismatch | non-JSON                | assignment schema failure                       | cms-activation limit             | RPC unavailable/deadline; Retry-After | scrubbed internal error |

Error details are BE00 allowlists only: 400/422 may include at most 50 JSON-pointer violations; 401 has recoveryAction; 403 has reasonCode without policy predicates; 404 is empty; 409 may include expectedVersion/currentVersion only when the caller may read the candidate; 429 includes retryAfterSeconds, limit, resetAt; 502/503/504 includes dependencyClass, retryable, and optional retryAfterSeconds; 500 is empty. No error distinguishes a hidden resource from absence.

## Database Schema

All tables live in a private Supabase PostgreSQL schema exposed only through schema-qualified RPCs. RLS is enabled and forced on every table. Direct client table grants are revoked. Service-role use is limited to named migration/worker functions with an empty search_path, and those functions recheck acting context, capability, expected version, and idempotency.

### Canonical records and fields

This boundary owns twelve storage tables: `cms_content_types`,
`cms_content_type_versions`, `cms_content_type_template_bindings`,
`cms_content_type_capability_bindings`, `cms_field_definition_versions`,
`cms_relation_definitions`, `cms_schema_migration_plans`,
`cms_schema_artifacts`, `cms_schema_dry_run_reports`,
`cms_block_definition_versions`, `cms_release_nonce_receipts`, and
`cms_block_definition_lifecycle_events`, plus the three DEC-108 private
CMS-owned review records `cms_schema_reviews`,
`cms_schema_review_decisions`, and `cms_schema_review_assignments`. The HTTP
surface is fourteen operations (eleven first-party mutations and three
protected reads: CMS-03A-06, CMS-03A-07, and CMS-03A-13); the migration plan and its
immutable dry-run report are internal activation/worker records, not extra
endpoints.

The model names below are literal IA names. Every field includes SQL type, nullability, constraint, and relationship. JSONB is structured data validated by the compiled schema, not an EAV escape hatch.

| Model / table                                                         | Typed fields, constraints, and foreign keys                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Query indexes and write rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ContentType / cms_content_types                                       | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state IN ('active','retired'); version bigint NOT NULL CHECK version > 0; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); type_key text NOT NULL CHECK type_key ~ '^[a-z][a-z0-9_]{1,63}$' UNIQUE (never reused); owner_capability text NOT NULL CHECK octet_length(owner_capability) BETWEEN 1 AND 128; built_in boolean NOT NULL DEFAULT false; created_by uuid NOT NULL REFERENCES auth.users(id).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | UNIQUE(type_key); INDEX(owner_capability,state); INDEX(owner_id,updated_at DESC). RLS SELECT requires schema-registry read scope or schema_designer scope; INSERT/UPDATE only named RPC; type_key, built_in, created_by immutable; DELETE revoked. API lifecycle is derived from the single physical state column; it never duplicates storage or carries draft/review workflow state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ContentTypeVersion / cms_content_type_versions                        | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state cms_definition_state NOT NULL; version bigint NOT NULL CHECK version > 0; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); content_type_id uuid NOT NULL REFERENCES cms_content_types(id); version_no integer NOT NULL CHECK version_no > 0; labels jsonb NOT NULL CHECK jsonb_typeof(labels)='object'; workflow_key text NOT NULL CHECK workflow_key ~ '^[a-z][a-z0-9._-]{0,127}$'; workflow_version bigint NOT NULL CHECK workflow_version > 0; source_locale text NOT NULL CHECK source_locale ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'; default_locale text NOT NULL CHECK default_locale ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'; default_template_version_id uuid NULL; schema_artifact_id uuid NOT NULL; FOREIGN KEY (schema_artifact_id,id) REFERENCES cms_schema_artifacts(id,content_type_version_id) DEFERRABLE INITIALLY DEFERRED; definition_hash char(64) NOT NULL CHECK definition_hash ~ '^[a-f0-9]{64}$'; compatibility text NOT NULL CHECK compatibility IN ('additive','conditional','breaking','unknown'); supersedes_id uuid NULL REFERENCES cms_content_type_versions(id); dry_run_id uuid NULL; created_by uuid NOT NULL REFERENCES auth.users(id); approved_at timestamptz NULL; activation_workflow_policy_key text NULL CHECK (activation_workflow_policy_key IS NULL OR activation_workflow_policy_key ~ '^[a-z][a-z0-9._-]{0,127}$'); activation_workflow_policy_version bigint NULL CHECK (activation_workflow_policy_version IS NULL OR activation_workflow_policy_version > 0); activation_workflow_policy_hash char(64) NULL CHECK (activation_workflow_policy_hash IS NULL OR activation_workflow_policy_hash ~ '^[a-f0-9]{64}$'); activation_required_decision_count smallint NULL CHECK (activation_required_decision_count IS NULL OR activation_required_decision_count BETWEEN 1 AND 8); activation_required_capabilities jsonb NULL CHECK (activation_required_capabilities IS NULL OR (jsonb_typeof(activation_required_capabilities)='array' AND jsonb_array_length(activation_required_capabilities) BETWEEN 1 AND 16)); activation_approval_evidence_hash char(64) NULL CHECK (activation_approval_evidence_hash IS NULL OR activation_approval_evidence_hash ~ '^[a-f0-9]{64}$'); CHECK ((activation_workflow_policy_key IS NULL) = (activation_workflow_policy_version IS NULL) AND (activation_workflow_policy_key IS NULL) = (activation_workflow_policy_hash IS NULL) AND (activation_workflow_policy_key IS NULL) = (activation_required_decision_count IS NULL) AND (activation_workflow_policy_key IS NULL) = (activation_required_capabilities IS NULL) AND (activation_workflow_policy_key IS NULL) = (activation_approval_evidence_hash IS NULL)); | UNIQUE(content_type_id,version_no); UNIQUE(content_type_id) WHERE state='active'; INDEX(content_type_id,state,version_no DESC); INDEX(owner_id,updated_at). Template/artifact references are resolved by named cross-shard/artifact RPCs before activation; the named draft RPC inserts the version and its SchemaArtifact in one deferred-FK transaction and the composite FK proves the artifact belongs to this version; append-only except state transition through RPC; activation evidence fields are written only by the server-side activation RPC and become immutable with the activated version.                                                                                                                                                                                                                                                                                                                          |
| ContentTypeTemplateBinding / cms_content_type_template_bindings       | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state cms_definition_state NOT NULL; version bigint NOT NULL CHECK version > 0; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); content_type_version_id uuid NOT NULL REFERENCES cms_content_type_versions(id); template_version_id uuid NOT NULL; position integer NOT NULL CHECK position >= 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | UNIQUE(content_type_version_id,template_version_id); INDEX(content_type_version_id,position). Template version is owned by 03c; binding is immutable after the parent version is activated and resolved through the named compatibility RPC.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ContentTypeCapabilityBinding / cms_content_type_capability_bindings   | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state cms_definition_state NOT NULL; version bigint NOT NULL CHECK version > 0; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); content_type_version_id uuid NOT NULL REFERENCES cms_content_type_versions(id); capability_key text NOT NULL CHECK capability_key ~ '^[a-z][a-z0-9._-]{0,127}$'; capability_version bigint NOT NULL CHECK capability_version > 0.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | UNIQUE(content_type_version_id,capability_key,capability_version); INDEX(capability_key,capability_version). Capability key/version resolves against the protected registry; it is a binding, never an authority grant by itself.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| FieldDefinitionVersion / cms_field_definition_versions                | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state IN ('active','deprecated','retired'); version bigint NOT NULL CHECK version > 0; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); content_type_version_id uuid NOT NULL REFERENCES cms_content_type_versions(id); stable_field_id uuid NOT NULL; field_key text NOT NULL CHECK field_key ~ '^[a-z][a-z0-9_]{1,63}$'; kind text NOT NULL CHECK kind IN ('short_text','long_text','rich_text','boolean','integer','decimal','date','datetime','enum','taxonomy','relation','media','object','list'); constraints jsonb NOT NULL CHECK jsonb_typeof(constraints)='object'; validator_key text NULL CHECK validator_key IS NULL OR validator_key ~ '^[a-z][a-z0-9._-]{0,127}$'; validator_version bigint NULL CHECK validator_version IS NULL OR validator_version > 0; required boolean NOT NULL; default_mode text NOT NULL CHECK default_mode IN ('none','literal','inherited'); default_value jsonb NULL; localization_mode text NOT NULL CHECK localization_mode IN ('none','localized','no_fallback'); editor_config jsonb NOT NULL CHECK jsonb_typeof(editor_config)='object'; created_by uuid NOT NULL REFERENCES auth.users(id).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | UNIQUE(content_type_version_id,stable_field_id); UNIQUE(content_type_version_id,field_key); INDEX(content_type_version_id,state); INDEX(stable_field_id). No physical deletion; API lifecycle is derived from the single physical state column, and deprecation is the only removal before retention eligibility. RelationDefinition FK references this table only for kind=relation. Validator key/version is verified against the protected registry; free-form patterns are rejected.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| RelationDefinition / cms_relation_definitions                         | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state cms_definition_state NOT NULL; version bigint NOT NULL CHECK version > 0; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); field_definition_id uuid NOT NULL REFERENCES cms_field_definition_versions(id); target_kind text NOT NULL CHECK target_kind IN ('content','domain'); target_type text NOT NULL CHECK target_type ~ '^[a-z][a-z0-9._-]{0,95}$'; projection_key text NOT NULL CHECK projection_key ~ '^[a-z][a-z0-9._-]{0,127}$'; cardinality text NOT NULL CHECK cardinality IN ('one','many'); min_count integer NOT NULL CHECK min_count BETWEEN 0 AND 128; max_count integer NOT NULL CHECK max_count BETWEEN 1 AND 128 AND max_count >= min_count; ordered boolean NOT NULL; on_unavailable text NOT NULL CHECK on_unavailable IN ('omit','block','placeholder'); created_by uuid NOT NULL REFERENCES auth.users(id).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | UNIQUE(field_definition_id); INDEX(target_kind,target_type,projection_key); INDEX(field_definition_id,version DESC). RPC verifies target type/projection against a code-owned allowlist and target authorization is deferred to each consumer read. For `cardinality='one'`, max_count must equal 1 and min_count must be 0 or 1; `many` always has finite explicit bounds. Placeholder resolution is exactly {status:'unavailable', reason:'unavailable'} with no target identifier or data.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| SchemaMigrationPlan / cms_schema_migration_plans                      | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state IN ('draft','dry_running','ready','blocked','running','verifying','completed','failed_retryable','failed_terminal'); version bigint NOT NULL CHECK version > 0; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); content_type_id uuid NOT NULL REFERENCES cms_content_types(id); from_version_id uuid NOT NULL REFERENCES cms_content_type_versions(id); to_version_id uuid NOT NULL REFERENCES cms_content_type_versions(id); classification text NOT NULL CHECK classification IN ('additive','conditional','breaking'); transform_key text NULL CHECK transform_key IS NULL OR transform_key ~ '^[a-z][a-z0-9._-]{0,127}$'; transform_version bigint NULL CHECK transform_version IS NULL OR transform_version > 0; dry_run_report jsonb NOT NULL CHECK jsonb_typeof(dry_run_report)='object'; cursor bigint NOT NULL DEFAULT 0 CHECK cursor >= 0; progress numeric(9,6) NOT NULL DEFAULT 0 CHECK progress BETWEEN 0 AND 1; source_count bigint NOT NULL DEFAULT 0 CHECK source_count >= 0; target_count bigint NOT NULL DEFAULT 0 CHECK target_count >= 0; row_error_count bigint NOT NULL DEFAULT 0 CHECK row_error_count >= 0; migrated_count bigint NOT NULL DEFAULT 0 CHECK migrated_count >= 0; failed_count bigint NOT NULL DEFAULT 0 CHECK failed_count >= 0; created_by uuid NOT NULL REFERENCES auth.users(id); started_at timestamptz NULL; completed_at timestamptz NULL; CHECK(from_version_id <> to_version_id); CHECK((classification='additive' AND transform_key IS NULL) OR (classification IN ('conditional','breaking') AND transform_key IS NOT NULL)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | UNIQUE(from_version_id,to_version_id); INDEX(content_type_id,state,updated_at); INDEX(state,updated_at) for worker leases. Direct progress updates revoked; worker RPC uses CAS on state, cursor, and version. A failed row remains readable under its old schema.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| SchemaArtifact / cms_schema_artifacts                                 | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state = 'compiled'; version bigint NOT NULL CHECK version > 0; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); content_type_version_id uuid NOT NULL REFERENCES cms_content_type_versions(id); compiler_version text NOT NULL CHECK octet_length(compiler_version) BETWEEN 1 AND 32; zod_contract_ref text NOT NULL CHECK octet_length(zod_contract_ref) BETWEEN 1 AND 256; editor_manifest jsonb NOT NULL CHECK jsonb_typeof(editor_manifest)='object'; renderer_manifest jsonb NOT NULL CHECK jsonb_typeof(renderer_manifest)='object'; artifact_hash char(64) NOT NULL CHECK artifact_hash ~ '^[a-f0-9]{64}$'; compiled_at timestamptz NOT NULL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | UNIQUE(content_type_version_id); UNIQUE(id,content_type_version_id); UNIQUE(artifact_hash); INDEX(owner_id,created_at DESC). Immutable after compile; updated_at=created_at and any update is rejected; only the owning version may reference the artifact and activation refuses a missing/hash-mismatched artifact; the deferred composite FK and atomic draft RPC prevent a version from becoming visible without its matching artifact. Supersession is represented by the owning version, never by mutating artifact state.                                                                                                                                                                                                                                                                                                                                                                                                     |
| BlockDefinitionVersion / cms_block_definition_versions                | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state = 'registered'; version bigint NOT NULL CHECK version > 0; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); block_key text NOT NULL CHECK block_key ~ '^[a-z][a-z0-9._-]{0,95}$'; block_version integer NOT NULL CHECK block_version > 0; props_schema_ref text NOT NULL CHECK octet_length(props_schema_ref) BETWEEN 1 AND 256 AND position('..' in props_schema_ref)=0 AND position('//' in props_schema_ref)=0; props_schema_hash char(64) NOT NULL CHECK props_schema_hash ~ '^[a-f0-9]{64}$'; props_schema_snapshot jsonb NOT NULL CHECK jsonb_typeof(props_schema_snapshot)='object'; props_snapshot_hash char(64) NOT NULL CHECK props_snapshot_hash ~ '^[a-f0-9]{64}$'; props_snapshot_attestation jsonb NOT NULL CHECK jsonb_typeof(props_snapshot_attestation)='object'; props_attestation_key_id text NOT NULL CHECK octet_length(props_attestation_key_id) BETWEEN 1 AND 128; props_attestation_signature_hash char(64) NOT NULL CHECK props_attestation_signature_hash ~ '^[a-f0-9]{64}$'; props_attestation_verified_at timestamptz NOT NULL; renderer_ref text NOT NULL CHECK octet_length(renderer_ref) BETWEEN 1 AND 160; allowed_children jsonb NOT NULL CHECK jsonb_typeof(allowed_children)='array'; slot_rules jsonb NOT NULL CHECK jsonb_typeof(slot_rules)='object'; data_source_permissions jsonb NOT NULL CHECK jsonb_typeof(data_source_permissions)='array'; accessibility_contract jsonb NOT NULL CHECK jsonb_typeof(accessibility_contract)='object'; compatibility_range jsonb NOT NULL CHECK jsonb_typeof(compatibility_range)='object'; release_digest char(64) NOT NULL CHECK release_digest ~ '^[a-f0-9]{64}$'; release_principal_id uuid NOT NULL; release_key_id text NOT NULL CHECK octet_length(release_key_id) BETWEEN 1 AND 128; release_raw_body_hash char(64) NOT NULL CHECK release_raw_body_hash ~ '^[a-f0-9]{64}$'; release_signature_hash char(64) NOT NULL CHECK release_signature_hash ~ '^[a-f0-9]{64}$'; release_nonce_hash char(64) NOT NULL CHECK release_nonce_hash ~ '^[a-f0-9]{64}$'; release_verified_at timestamptz NOT NULL;                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | UNIQUE(block_key,block_version); INDEX(block_key,state,block_version DESC); INDEX(release_digest). INSERT only signed release RPC; props/renderer/compatibility fields are immutable after insert and the nested Ed25519 props attestation binds the RFC 8785/JCS normalized snapshot hash, ref/hash, key/version, and release digest; props attestation key/algorithm trust and verification evidence are persisted immutably. The outer Ed25519 envelope evidence binds keyId, raw body hash, nonce hash, signature hash, and verification time. Effective API lifecycle is derived from immutable lifecycle-event history; CMS-03A-08 appends only supported → deprecated → withdrawn events and never updates this version row; owner_id and release_principal_id identify the signed release, not a human auth user. No table column stores uploaded script, CSS, template, expression, dynamic import, secret, or source body. |
| ReleaseNonceReceipt / cms_release_nonce_receipts                      | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; release_key_id text NOT NULL CHECK octet_length(release_key_id) BETWEEN 1 AND 128; nonce_hash char(64) NOT NULL CHECK nonce_hash ~ '^[a-f0-9]{64}$'; operation_id text NOT NULL CHECK operation_id IN ('CMS-03A-05','CMS-03A-08'); issued_at timestamptz NOT NULL; expires_at timestamptz NOT NULL; consumed_at timestamptz NULL; raw_body_hash char(64) NOT NULL CHECK raw_body_hash ~ '^[a-f0-9]{64}$'; signature_hash char(64) NOT NULL CHECK signature_hash ~ '^[a-f0-9]{64}$'; verified_at timestamptz NOT NULL; outcome text NOT NULL CHECK outcome IN ('claimed','consumed','rejected'); created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(expires_at >= issued_at + interval '10 minutes');                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | UNIQUE(release_key_id,nonce_hash); INDEX(expires_at); INSERT/claim occurs before either signed operation is accepted; unique key+nonce admission is atomic with the mutation, consumed evidence is immutable after success, and retention is never shorter than ten minutes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| BlockDefinitionLifecycleEvent / cms_block_definition_lifecycle_events | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state = 'recorded'; version bigint NOT NULL CHECK version > 0; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); block_definition_version_id uuid NOT NULL REFERENCES cms_block_definition_versions(id); block_key text NOT NULL CHECK block_key ~ '^[a-z][a-z0-9._-]{0,95}$'; block_version integer NOT NULL CHECK block_version > 0; from_lifecycle text NOT NULL CHECK from_lifecycle IN ('supported','deprecated'); to_lifecycle text NOT NULL CHECK to_lifecycle IN ('deprecated','withdrawn'); release_digest char(64) NOT NULL CHECK release_digest ~ '^[a-f0-9]{64}$'; release_principal_id uuid NOT NULL; release_key_id text NOT NULL CHECK octet_length(release_key_id) BETWEEN 1 AND 128; release_raw_body_hash char(64) NOT NULL CHECK release_raw_body_hash ~ '^[a-f0-9]{64}$'; release_signature_hash char(64) NOT NULL CHECK release_signature_hash ~ '^[a-f0-9]{64}$'; release_nonce_hash char(64) NOT NULL CHECK release_nonce_hash ~ '^[a-f0-9]{64}$'; release_verified_at timestamptz NOT NULL; CHECK((from_lifecycle='supported' AND to_lifecycle='deprecated') OR (from_lifecycle='deprecated' AND to_lifecycle='withdrawn')); CHECK(updated_at = created_at);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | UNIQUE(block_definition_version_id,to_lifecycle); UNIQUE(block_key,block_version,to_lifecycle); INDEX(block_definition_version_id,created_at DESC); append-only immutable evidence; CMS-03A-08 inserts the event and nonce receipt in one transaction, and effective lifecycle is the latest ordered event or initial supported registration. UPDATE/DELETE are rejected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

The dry-run report record, `cms_schema_dry_run_reports`, is immutable compiler
evidence rather than a caller-facing resource. It stores the target and
optional source version, additive/conditional/breaking classification, the
required transform pair for conditional or breaking changes, source/target/
compiler hashes and version, non-negative source/target/error/migrated/failed
counts, and an object report whose dry-run ID, result, and counts must match the
typed columns. The target version and content type are foreign keys; the
all-zero source hash represents first activation. Its report is bounded by the
same JSONB safety rules, keyed by target and creation time, inserted only by
the named dry-run RPC, and rejected on update or delete.

The report distinguishes the sealed scan from the infrastructure failure. A
`completed` report is immutable and carries a sealed `result`; a sealed pass
requires `row_error_count = 0` and a sealed fail requires `row_error_count > 0`
with the actual bounded per-row error evidence. An unsealed `failed` report
(the job could not seal a scan) carries a safe `failureCode` and no sealed
counts or hashes. No counter arithmetic or manually inserted report substitutes
for the sealed scan, and the resource never reports a queued/running attempt as
`passed`.

The artifact compiler uses the actual versioned contract reference
`cms/content-type/{typeKey}/v{versionNo}` rather than a fixed `/v1`, so a
successor version's immutable artifact is addressed by its own version. The
deterministic artifact hash composes that versioned `zodContractRef`, the
`compilerVersion`, and the compiled editor/renderer manifests; it uses no
random salt and never mutates the source artifact. Successor drafts therefore
carry new definition row IDs but preserve stable field IDs and keys, and two
unchanged clones of different versions coexist under distinct version-addressed
artifact references without claiming identical versioned artifacts. Tests cover
both the second and third version.

The three DEC-108 private review records are CMS-owned, never CFG
setting-value candidates, and are the only authority for schema-review evidence.

| Model / table                                                         | Typed fields, constraints, and foreign keys                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Query indexes and write rules                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SchemaReview / cms_schema_reviews                                     | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state IN ('open','approved','rejected','invalidated'); version bigint NOT NULL CHECK version > 0; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); content_type_id uuid NOT NULL REFERENCES cms_content_types(id); content_type_version_id uuid NOT NULL REFERENCES cms_content_type_versions(id); candidate_version_no integer NOT NULL CHECK candidate_version_no > 0; definition_hash char(64) NOT NULL CHECK definition_hash ~ '^[a-f0-9]{64}$'; schema_artifact_id uuid NOT NULL; compiler_version text NOT NULL CHECK octet_length(compiler_version) BETWEEN 1 AND 32; dependency_manifest_hash char(64) NOT NULL CHECK dependency_manifest_hash ~ '^[a-f0-9]{64}$'; dry_run_id uuid NOT NULL; dry_run_report_hash char(64) NOT NULL CHECK dry_run_report_hash ~ '^[a-f0-9]{64}$'; policy_key text NOT NULL CHECK policy_key ~ '^[a-z][a-z0-9._-]{0,127}$'; policy_version bigint NOT NULL CHECK policy_version > 0; policy_hash char(64) NOT NULL CHECK policy_hash ~ '^[a-f0-9]{64}$'; risk_class text NOT NULL CHECK risk_class IN ('ordinary','protected'); required_decision_count smallint NOT NULL CHECK required_decision_count BETWEEN 1 AND 8; required_capabilities jsonb NOT NULL CHECK jsonb_typeof(required_capabilities)='array' AND jsonb_array_length(required_capabilities) BETWEEN 1 AND 16; context_hash char(64) NOT NULL CHECK context_hash ~ '^[a-f0-9]{64}$'; submitter_person_ref uuid NOT NULL; submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(); decided_at timestamptz NULL; approval_evidence_hash char(64) NULL CHECK approval_evidence_hash IS NULL OR approval_evidence_hash ~ '^[a-f0-9]{64}$'; CHECK ((state IN ('approved')) = (approval_evidence_hash IS NOT NULL)); CHECK (decided_at IS NULL OR decided_at >= submitted_at); CHECK ((state = 'approved') = (decided_at IS NOT NULL)) | UNIQUE(content_type_version_id, definition_hash, dry_run_id) WHERE state = 'open' (one live review per exact frozen candidate/evidence); INDEX(owner_id, state, submitted_at DESC); INDEX(content_type_version_id, state). INSERT through the review-submission RPC only; frozen evidence columns, submitter_person_ref, submitted_at, and context_hash are immutable after insert; state only moves open → approved, rejected, or invalidated. UPDATE/DELETE and direct browser/service-role table grants are revoked. |
| SchemaReviewDecision / cms_schema_review_decisions                    | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; review_id uuid NOT NULL REFERENCES cms_schema_reviews(id); reviewer_person_ref uuid NOT NULL; binding_context_hash char(64) NOT NULL CHECK binding_context_hash ~ '^[a-f0-9]{64}$'; capability_key text NOT NULL CHECK capability_key ~ '^[a-z][a-z0-9._-]{0,127}$ AND capability_key = 'cms.schema_review''; decision text NOT NULL CHECK decision IN ('approve','reject'); decided_at timestamptz NOT NULL DEFAULT clock_timestamp(); reviewed_hash char(64) NOT NULL CHECK reviewed_hash ~ '^[a-f0-9]{64}$'; mfa_verified_at timestamptz NOT NULL; UNIQUE(review_id, reviewer_person_ref) | Append-only; only the review-decision RPC inserts. UNIQUE(review_id, reviewer_person_ref) prevents repeated humans; a CHECK and the RPC together forbid reviewer_person_ref = the review submitter. UPDATE/DELETE and direct grants are revoked and forced RLS applies. |
| SchemaReviewAssignment / cms_schema_review_assignments                | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; review_id uuid NOT NULL REFERENCES cms_schema_reviews(id); reviewer_person_ref uuid NOT NULL; grantor_person_ref uuid NOT NULL; capability_key text NOT NULL CHECK capability_key = 'cms.schema_review'; actions text[] NOT NULL CHECK actions = ARRAY['read','decide']::text[]; state text NOT NULL CHECK state IN ('active','revoked'); starts_at timestamptz NOT NULL; ends_at timestamptz NOT NULL; reason text NULL CHECK reason IS NULL OR octet_length(reason) BETWEEN 1 AND 256; created_at timestamptz NOT NULL DEFAULT clock_timestamp(); updated_at timestamptz NOT NULL DEFAULT clock_timestamp(); version bigint NOT NULL DEFAULT 1 CHECK version > 0; CHECK (ends_at > starts_at); CHECK (ends_at <= starts_at + interval '7 days') | INDEX(review_id, reviewer_person_ref, state); INDEX(owner_id, state, ends_at). Only the named assignment RPC creates/revokes; effective authority requires starts_at <= now < ends_at and rechecks current binding/capability at decision and activation, so no expiry sweep is required. Assignment never stores an owner acting context and cannot be delegated or broadened. UPDATE/DELETE and direct grants are revoked; forced RLS applies. |

Every review, decision, and assignment row carries the IA envelope
(`owner_id`, closed `state` where applicable, `version`, timestamps),
ENABLE/FORCE RLS, revoked direct browser/service-role table grants, and
pinned-search-path named private RPCs as the only command authority. Review
identity hashes use a versioned private actor/person/party/binding projection
that excludes request/correlation and transport timestamps; the resolved
private matching UUIDs are never serialized into any resource, prop, public
evidence resource, or log. Candidate definition, artifact, compiler,
dependency, dry-run, policy, or relevant-authority drift invalidates the open
or approved review; rejection returns the candidate to an editable draft
through an audited transition and a resubmission freezes new evidence.

The activation RPC enforces that every version in `active`, `superseded`, or
`retired` state has all six immutable activation-evidence values populated:
policy key, policy version, policy hash, required decision count, required
capabilities, and approval-evidence hash. Draft/review candidates cannot be
activated without this complete frozen snapshot; evidence is resolved from the
protected workflow/risk registry and approval records, never accepted as
caller-authoritative fields.

### Database invariants and grants

- cms_definition_state is a private enum with draft, review, approved, scheduled, active, superseded, retired, blocked for versioned definitions. ContentType has one physical `state` column (`active|retired`); API `lifecycle` is its derived external name. BlockDefinitionVersion has one physical registration `state` column and its API lifecycle is derived from append-only lifecycle events, never a duplicate column or mutable version-row field. Definition workflow state must not be inferred from root lifecycle, and active records are immutable. Blocked may return to draft only through an audited transition. Migration state is separate and cannot be inferred from job state.
- Every bigint crosses the API as a decimal string. Every UUID FK is checked inside the same transaction. Caller-controlled JSONB cells are capped at 8 KiB, nesting 8, object keys 128, and array length 128 unless the field contract gives a lower bound; the server-generated compiled editor and renderer manifest aggregates use the immutable `cms_compiled_manifest_bounded` helper with a 512 KiB aggregate ceiling while retaining nesting 8, object keys 128, and array length 128. All persisted rows carry the IA envelope (`owner_id`, closed `state`, `version`, timestamps); immutable rows pin `updated_at = created_at`.
- Fields without a relational FK are intentional: owner_capability, workflow_key/version, validator_key/version, target_type, projection_key, transform_key, renderer_ref, and manifest JSONB values resolve against protected registries; dry_run_id identifies an immutable compiler report. `schema_artifact_id` is a deferred composite FK to the matching immutable artifact and the draft RPC inserts both rows atomically. No caller-selected table, SQL expression, free-form validator, or arbitrary URL is a permitted substitute for those registries.
- The SQL API exposes only cms_create_type_draft, cms_add_field_definition, cms_bind_relation, cms_activate_schema, cms_register_block, cms_advance_block_lifecycle, cms_list_content_types, cms_get_content_type_version, cms_create_schema_successor, cms_start_schema_dry_run, cms_submit_schema_review, cms_decide_schema_review, cms_get_schema_review, and cms_assign_schema_review RPCs to named capability grants. anon and authenticated roles have no direct INSERT/UPDATE/DELETE grants on these tables.
- RLS policies call a schema-qualified immutable helper that resolves the verified session and acting context. SELECT policy permits only the caller's schema-design scope or an explicitly authorized code-release principal; WITH CHECK requires the same scope, registry allowlist, and current state. A SECURITY DEFINER RPC sets search_path to pg_catalog, public, and the private CMS schema, then rechecks all predicates.
- Audit and outbox rows are BE00-owned and written atomically; this spec does not add shadow audit tables. A failed audit/outbox insert rolls back the definition mutation.
- CMS-03A-06, CMS-03A-07, and CMS-03A-13 execute projection-only RPCs: they perform no INSERT, UPDATE, DELETE, idempotency reservation, mutation audit, outbox write, migration lease, or definition-state transition on success or failure. Rate/telemetry counters are the only permitted side effects.
- Retention keeps active/superseded definitions and migration evidence for the configured legal/audit retention. Retirement is a new state, not deletion; key uniqueness prevents reuse forever. A legal hold or incident fence prevents purge.

### Permission, RLS and grants

| Table                                 | Read predicate                                                                                                                               | Write predicate                                                                                                                                     | Grants                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| cms_content_types                     | caller has schema-registry read scope or schema_designer scope for the owning capability; concealed scope is omitted/404                     | create RPC with schema_designer; lifecycle transition RPC with policy-derived approvals where required                                              | authenticated: none direct; named RPC EXECUTE only; cms_worker: no direct table       |
| cms_content_type_versions             | caller may read parent ContentType and version scope; concealed versions return 404                                                          | add/version-state RPC, expected version, immutable artifact/hash                                                                                    | same; migration worker may update only migration state through named function         |
| cms_content_type_template_bindings    | caller may read an authorized parent version and compatible template metadata                                                                | atomic draft-aggregate RPC only; no client update/delete after activation                                                                           | same; 03c owns template rows                                                          |
| cms_content_type_capability_bindings  | caller may read an authorized parent version and protected capability metadata                                                               | atomic draft-aggregate RPC only; no client update/delete                                                                                            | same; binding does not grant authority                                                |
| cms_field_definition_versions         | caller may read parent version                                                                                                               | field RPC on unactivated draft; no update/delete                                                                                                    | same                                                                                  |
| cms_relation_definitions              | caller may read parent version and allowlisted projection                                                                                    | relation RPC with code allowlist and bounds                                                                                                         | same                                                                                  |
| cms_schema_artifacts                  | caller may read artifact only through an authorized parent version/detail projection                                                         | compiler RPC creates one immutable artifact; no client update/delete                                                                                | named compiler/activation RPC; no direct table grants                                 |
| cms_schema_migration_plans            | schema designer sees own scope; worker sees ID/version/counters only                                                                         | activation RPC creates; worker CAS updates progress/counters; no client delete                                                                      | named worker RPC; no client table grants                                              |
| cms_block_definition_versions         | authorized template/schema consumer sees safe metadata, props ref/hash, and release digest; withdrawn details follow the fixed safe-use rule | signed registration RPC inserts once; CMS-03A-08 appends lifecycle evidence only and never updates this version row                                 | release principal EXECUTE on named registration/lifecycle RPCs; no human table writes |
| cms_release_nonce_receipts            | release audit service sees key/nonce hashes and verification outcome only; no caller reads raw headers or body                               | signed admission RPC inserts/claims `(release_key_id,nonce_hash)` before acceptance; expiry cleanup is fenced and cannot shorten the ten-minute TTL | release verifier and audit worker RPCs only; no browser or human table writes         |
| cms_block_definition_lifecycle_events | authorized registry consumers see safe lifecycle event metadata and release digest; hidden owner scope is omitted/404                        | CMS-03A-08 append-only RPC with signed release principal, expected lifecycle/version, unique transition, and nonce receipt in one transaction       | release principal lifecycle RPC and read projection RPC only; UPDATE/DELETE revoked   |
| cms_schema_reviews                    | schema designer on the candidate scope or an assigned review-only scope; concealed reviews are omitted/404                                    | review-submission RPC inserts once and freezes evidence; state transitions only through decision/invalidation; frozen columns immutable                | private command RPCs only; direct browser and service-role table grants revoked       |
| cms_schema_review_decisions           | readable only through the authorized review projection; reviewer identity is not exposed                                                     | review-decision RPC append-only insert; unique per review/human; no submitter or repeated human; UPDATE/DELETE revoked                              | private review-decision RPC only; no direct browser or service-role table grants      |
| cms_schema_review_assignments         | readable only through the authorized review projection; no reviewer/grantor matching identifiers are exposed                                  | assignment create/revoke RPC only; fixed read/decide scope; expires <=7 days and <= grantor authority; audit atomic; no delegation                      | private owner-assignment RPC only; no direct browser or service-role table grants     |

## Middleware & Policies

### Per-operation authorization matrix

| Operation ID | Principal and capability                                                                                                   | Ownership / state predicate                                                                                                                       | 403 rule                                                     | 404 rule                                                            | Extra gate                                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| CMS-03A-01   | verified human with cms.schema_designer                                                                                    | typeKey unused and non-reserved; acting party has registry scope                                                                                  | authenticated actor lacks capability or scope                | concealed owner scope and already-retired key                       | no browser-supplied owner                                                                                                                      |
| CMS-03A-02   | verified human with cms.schema_designer                                                                                    | parent ContentTypeVersion belongs to caller scope and state=draft                                                                                 | known draft but capability missing                           | hidden/absent parent                                                | stable field identity and migration classification                                                                                             |
| CMS-03A-03   | verified human with cms.schema_designer                                                                                    | parent draft and target projection in code allowlist                                                                                              | capability/registry scope failure                            | hidden/absent parent                                                | target never grants authority                                                                                                                  |
| CMS-03A-04   | verified human with cms.schema_designer plus exactly the approver capabilities required by the frozen workflow/risk policy | candidate approved, dry-run exact, immutable artifact present, no unresolved ref, active compatibility                                            | missing capability, policy-required approval, or recent MFA  | hidden/absent candidate                                             | protected classes require two distinct humans; ordinary workflows use policy count; step-up MFA; atomic switch                                 |
| CMS-03A-05   | signed release worker with release.block_registry.write                                                                    | release digest verified; key/version pair unused                                                                                                  | browser/human/wrong release principal                        | unregistered release target                                         | signature over untouched body, replay window, no CSRF                                                                                          |
| CMS-03A-06   | verified human with cms.schema_registry.read or schema_designer read scope                                                 | query is valid and every returned resource is within acting-party/tenant scope                                                                    | authenticated caller lacks read capability                   | concealed scope is omitted; unknown/retired parent is not disclosed | no-store; bounded cursor is bound to query and acting scope; public delivery is forbidden                                                      |
| CMS-03A-07   | verified human with cms.schema_registry.read or schema_designer read scope                                                 | type/version IDs belong together and detail projection is permitted                                                                               | known readable parent but required detail capability missing | hidden/absent type/version                                          | no-store; RLS recheck; always return only the capability-safe artifact identity/hash and allowed manifests                                     |
| CMS-03A-08   | signed release worker with release.block_registry.write                                                                    | existing version is readable; expected lifecycle/version and release digest match; transition is supported → deprecated or deprecated → withdrawn | browser/human/wrong release principal                        | hidden/absent block version                                         | stale version/lifecycle, duplicate transition/nonce/idempotency; signature and nonce receipt are verified before append; no version-row update |
| CMS-03A-09   | verified human with cms.schema_designer                                     | immutable source version is readable in caller scope and in an activatable state; acting party holds the registry scope                            | known source but capability missing                          | hidden/absent source                                                | exact source If-Match; clone preserves stable field IDs/keys, remaps local references, and never mutates the source                           |
| CMS-03A-10   | verified human with cms.schema_designer                                     | candidate belongs to caller scope and state=draft; server derives source/target/compiler/classification                                           | known draft but capability missing                           | hidden/absent candidate                                             | transform pair both-null or both-present; caller cannot supply counts, hashes, classification, or report; report+plan+job commit atomically  |
| CMS-03A-11   | verified human with cms.schema_designer                                     | candidate in caller scope is draft with a persisted passed dry run for the same evidence                                                          | known draft but capability missing                           | hidden/absent candidate                                             | freezes definition/artifact/compiler/dependency/dry-run/policy evidence; draft → review atomic; one live review per exact evidence           |
| CMS-03A-12   | independently authenticated human with an active assignment for cms.schema_review on that frozen review | review is open and readable to the caller; assignment interval and capability are current | missing/expired assignment or capability, or the decision requires current MFA | concealed review is 404; a caller without assignment cannot distinguish it | reviewer is server-resolved; submitter and repeated humans are refused; frozen evidence is rechecked |
| CMS-03A-13   | verified human with cms.schema_registry.read or schema_designer scope, or an assigned review-only scope | review is readable in the caller's submitter/designer or assigned review scope                                      | known readable review but required capability missing        | concealed, absent, or out-of-scope review is 404                    | no-store; returns only the safe review projection; no body, Idempotency-Key, or If-Match                                                     |
| CMS-03A-14   | verified human derived as the owner: immutable cms_owner_initialization receipt identity AND current effective owner authority with cms.schema_review.assign; recent binding-bound MFA | review is owned by the same organization; the assignment subject is an existing eligible human | known review but the caller is not the derived owner, or lacks the assign capability | concealed/cross-owner review is 404                                 | create references an eligible existing human and a finite expiry <= 7 days and <= grantor authority; only read/decide on one frozen review; no identity is created; audit atomic |

A known resource is not disguised as 404 when policy permits existence disclosure: a valid caller with insufficient capability receives 403. A caller who cannot read the parent, a retired key lookup, or an invalid target scope receives indistinguishable 404. Structural malformed IDs are 400 before existence checks.

### Security and abuse controls

- Raw body ceiling is 256 KiB; JSON nesting is at most 8, keys 128, arrays 128, and strings are bounded by the field matrix. Unknown keys reject. No HTML, CSS, JavaScript, template source, SQL, regular-expression backtracking bombs, expressions, URLs selecting code, or dynamic imports are accepted.
- CMS-03A-05 and CMS-03A-08 verify the exact release signature and timestamp over untouched bytes before parsing. Only a missing or invalid release principal, or signature verification failure, returns exactly 401 `WEBHOOK_REJECTED`; malformed signature/header/body/path returns 400. For CMS-03A-05, key/version/digest collision or idempotency mismatch returns 409 and manifest/renderer/accessibility validation failure returns 422. For CMS-03A-08, stale lifecycle/version, invalid advance, duplicate nonce/replay, or idempotency conflict returns 409 and lifecycle/release-digest/evidence/schema validation failure returns 422. Dependency failures use 502/503/504 and unexpected failures return scrubbed 500, per the operation matrix. The verifier inserts/claims the durable nonce receipt before acceptance. A valid duplicate digest is idempotent; a conflicting digest creates a severity-1 security signal and no second registration or lifecycle append. Every rejection fails closed with no registration or lifecycle mutation.
- CSRF is required for browser cookie/session mutations after origin check. Release-worker requests use a non-browser principal and signed body; they do not receive browser authority from CORS.
- Step-up MFA is recent and bound to acting context for activation, review decision, and assignment. Approval IDs and the assignment `reviewerPersonId` cannot identify the acting submitter; decisions cannot repeat a human and are invalidated if the candidate hash, compiler version, dependency set, dry-run evidence, policy, or reviewer authority changes. Missing or stale MFA on CMS-03A-04, CMS-03A-12, or CMS-03A-14 returns exactly 401 `STEP_UP_REQUIRED` with `{ recoveryAction: 'step_up', allowedMethods: [] }` (only configured allowlisted method identifiers), never collapsed to 400 or replaced with `reauthenticate`.
- The owner-only `cms.schema_review.assign` authority is server-derived: the caller must be the immutable `cms_owner_initialization` receipt identity (its `auth_user_id`/`person_id`/`organization_id`) and must hold current effective owner authority. No party is ever re-bootstrapped, the four-capability initialization list is not widened or re-run, and CFG grant delegation is not used. The owner approves schema reviews as an approver only by holding a bounded assignment; owner status alone does not skip the assignment, decision-count, or MFA gates.
- The assigned-reviewer path is deliberately not the owner-authority predicate. A reviewer independently authenticates its own session and acting-context binding; the frozen review's `owner_id` need not equal the reviewer's acting party, and the decision RPC must not reuse an owner-only authorization helper that requires the owner's acting context. The assignment binds the frozen review's owner scope to the reviewer's own person, and grants no part of the owner's acting context, session, or capability set. Eligibility and decision checks require only a real, active/claimed, non-banned existing human with a current binding; they never require `cms.schema_review` before assignment, `cms.schema_designer`, admin, or any pre-existing review capability. The owner's assign authority derives from the immutable initialization identity plus the current live scoped authority and is not transferable or broadenable through ordinary capability grants.
- Rate limits use BE00 token buckets keyed by actor, acting party, and release principal. Concurrent definition commands are capped at 3 per actor; activation, review decision, and assignment are separately capped, and assignment is bounded to the owner alone.
- Definitions and manifests are safe to log only as IDs, hashes, operation, outcome, and size. No field labels, help text, renderer source, schema values, capability graph, or private projection is sent to logs or provider-native diagnostics.

## Data Flow

### Transaction and external seams

Human command flow: raw request → request ID/media guard → strict Zod parse → session and acting context → capability/resource check → idempotency reservation → one schema-qualified RPC → version/allowlist/constraint checks → definition mutation + audit + idempotency completion + outbox in one transaction → normalized response. CMS-03A-01 validates and persists the type, version, fields, relations, template bindings, capability bindings, locale/workflow references, and compiled artifact reference as one aggregate transaction; no child is committed or exposed on its own. Idempotency reservation is rolled back when validation, auth, or mutation fails; a committed result is replayable.

Protected registry read flow: raw request → request ID/media/query guard → strict query/path parse → session and acting context → `cms.schema_registry.read` or schema-designer scope → RLS-backed named projection → discriminated page/detail response with `Cache-Control: no-store`. Reads never select public delivery tables, never return concealed rows, and never use Idempotency-Key or If-Match.

CMS-03A-04 flow: RPC verifies the exact dryRunId/hash/compiler version, schema artifact, workflow/risk-policy snapshot, and approval set, locks candidate and current active row, rechecks all referenced fields/relations/template/block compatibility, creates or advances SchemaMigrationPlan, switches active state only when all gates pass, records `cms.schema.activated.v1` with the immutable activation-evidence snapshot in the BE00 outbox, and returns the committed resource/job. A worker receives only `schemaVersionId`, migrationPlanId, expected version, correlation ID, and causation ID.

DEC-108 activation producer flow: CMS-03A-09 locks the readable immutable source,
clones the definition aggregate into a fresh draft with new row IDs, preserved
stable field identities and keys, remapped local references, and an incremented
version number, leaving the source untouched. CMS-03A-10 derives
source/target/classification/compiler/transform evidence server-side, creates a
dedicated migration plan identity and report under CAS on the still-draft
candidate, and enqueues one BE00 job in the same idempotent transaction; a
same-key retry returns the same attempt, while changed candidate or transform
evidence starts a new attempt and preserves earlier immutable attempts.
CMS-03A-11 accepts only a persisted passed dry run, freezes the
candidate/artifact/compiler/dependency/dry-run/policy evidence and the stable
context hash, and transitions draft → review atomically. CMS-03A-14 lets only
the server-derived owner create or revoke a bounded read/decide assignment on
that one frozen review. CMS-03A-12 appends an independent decision, rechecking
the current assignment, capability, and recent binding-bound MFA. CMS-03A-13
serves the authorized safe review projection. The CMS-03A-04 activation then
rechecks current assignment/capability, frozen evidence, and the activator's
current binding/MFA — it does not re-require MFA freshness for a reviewer's
earlier decision, so a valid decision is not expired solely because ten minutes
elapsed.

CMS-03A-05/08 signed flow: the raw body and exact four release headers are
verified against the trusted Ed25519 key before JSON parsing; the verifier
inserts/claims `(releaseKeyId, sha256(nonce))` in
`cms_release_nonce_receipts` with issued/expiry/consumed evidence, then the
registration RPC atomically persists the immutable block row or CMS-03A-08
locks the existing key/version, checks expected version and the only legal
lifecycle successor, appends `cms_block_definition_lifecycle_events`, and
writes audit/outbox evidence. No version row is updated and a failed event or
outbox write rolls back the nonce claim and lifecycle append.

External seam policy: the canonical definition compiler and protected registries run in-process. If deployment chooses a remote registry service, the only admitted seam is an allowlisted HTTPS adapter with request/response Zod schemas, 2,000ms RPC timeout, application route deadline 15,000ms, at most three pre-effect retries at 15s/60s/300s with jitter, and a circuit opening after five consecutive retryable failures for 60s. Invalid responses map to 502, unavailable/open circuit to 503, deadline to 504. No mutation occurs until the remote result is validated; an ambiguous post-effect response is reconciled by the idempotency key/status RPC before retry.

### State machine and concurrency

Definition state is draft → review → approved → scheduled or active → superseded or retired; blocked may return to draft. Active ContentTypeVersion, FieldDefinitionVersion, RelationDefinition, SchemaMigrationPlan definitions after completion, and BlockDefinitionVersion rows are immutable. A block row starts with physical state `registered` and derived API lifecycle `supported`; later lifecycle values exist only as ordered immutable lifecycle events. CMS-03A-02, CMS-03A-03, and CMS-03A-08 use SELECT FOR UPDATE plus expected version; two writers cannot append the same stable field, relation, or lifecycle successor.

Migration state is draft → dry_running → ready or blocked → running → verifying → completed, failed_retryable, or failed_terminal. The cursor, row counts, compiler hash, transform version, and source/target hashes are durable. Worker lease expiry is recoverable; each retry rechecks state and cursor. A failed migration leaves old active schema serving, never deletes rows, and cannot silently retry a changed transform.

Schema review state is open → approved | rejected | invalidated. There is at most
one live (open) review per exact frozen candidate/evidence identity, enforced by
a partial unique index. A candidate changes when its definition, artifact,
compiler version, dependency manifest, dry-run evidence, workflow policy, or a
relevant reviewer-authority fact changes; any such drift invalidates the open or
approved review and its decisions, and a resubmission freezes new evidence
rather than reusing old decisions. Each human records at most one decision per
review, the submitter never counts, and the required count (1 for ordinary, 2..8
for protected) is resolved from the code-owned workflow registry, never from the
request. A rejection returns the candidate to an editable draft through an
audited transition. Effective assignment authority requires
`starts_at <= now < ends_at` and a current eligible binding, so no expiry sweep
is required to revoke it.

Activation is a compare-and-swap against candidate version and current active version. Approval, reference, compiler, allowlist, and migration evidence changes invalidate the candidate and force review again. A duplicate event or worker delivery is harmless because consumers apply exact version monotonicity and dedupe by event identity.

### Event schemas

All events use the BE00 identifier-only envelope: eventId UUID, eventType,
schemaVersion, occurredAt, producer, correlationId, causationId, aggregateType,
aggregateId, aggregateVersion as lossless decimal string, and payload IDs plus
the immutable activation-evidence snapshot where required by the event
contract. No payload contains field values, private content, or authority.

| Event type                     | Exact payload                                                                                                                                                                                                                                             | Producer / consumer rule                                                                                                                                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cms.schema.activated.v1        | { contentTypeId: UUID, schemaVersionId: UUID, migrationPlanId: UUID or null, activationEvidence: { key, version, policyHash, riskClass, requiredDecisionCount, requiredCapabilities, approvalEvidenceHash } }                                                        | CMS registry emits after active switch and outbox commit; migration, editor, and projection consumers refetch exact version and verify immutable activation evidence under their own capability. Unknown event version goes to DLQ. |
| cms.template.activated.v1      | { templateId: UUID, templateVersionId: UUID }                                                                                                                                                                                                             | 03c template control plane emits only after a committed template activation; 03a activation/preflight consumers refetch the exact block/template version. This file never emits a template event for a bare block insert.           |
| cms.block.lifecycle.changed.v1 | { blockDefinitionVersionId: UUID, blockKey: BlockKey, blockVersion: positive integer, fromLifecycle: `supported\|deprecated`, toLifecycle: `deprecated\|withdrawn`, releaseDigest: lowercase SHA-256, releaseKeyId, releaseNonceHash, releaseVerifiedAt } | CMS-03A-08 emits only after the immutable lifecycle event, nonce receipt, audit, and outbox commit; 03b/03c consumers refetch the safe registry record and apply monotonic lifecycle ordering.                                      |

The activation event payload is validated as a strict object before the outbox
write, preserving the always-present nullable migration reference and the
server-frozen evidence:

```ts
const SchemaActivatedEventPayload = z.strictObject({
  contentTypeId: UUID,
  schemaVersionId: UUID,
  migrationPlanId: UUID.nullable(),
  activationEvidence: WorkflowPolicyEvidence,
});
const BlockLifecycleChangedEventPayload = z.strictObject({
  blockDefinitionVersionId: UUID,
  blockKey: BlockKey,
  blockVersion: z.number().int().positive(),
  fromLifecycle: z.enum(['supported', 'deprecated']),
  toLifecycle: z.enum(['deprecated', 'withdrawn']),
  releaseDigest: Hash,
  releaseKeyId: ReleaseKeyId,
  releaseNonceHash: Hash,
  releaseVerifiedAt: z.string().datetime({ offset: true }),
});
```

Event consumers never receive field values, renderer code, secrets, user IDs beyond BE00-approved envelope identifiers, or target-domain authority. Retry max is three at 15s/60s/300s, then DLQ and alert. Out-of-order events cannot regress a higher observed version.

### Cross-shard direction

- From BE00: inherit ApiError, request IDs, job observation, queue envelope, rate, CORS, and SLOs for all routes; mutations additionally inherit Idempotency-Key, applicable If-Match, CSRF, audit, and outbox rules, while protected reads explicitly omit mutation-only headers/effects.
- From BE01: resolve verified human, party, acting context, capability, recent MFA, and authorization facts. Never copy identity state into CMS definitions.
- To 03b: publish exact active schema version/hash, field stable IDs, relation definitions, and cms.schema.activated.v1. Entry revisions must snapshot schema version and reject stale definitions.
- To 03c: expose immutable BlockDefinitionVersion metadata and compatibility ranges. Template and pattern commands cannot register or mutate blocks. DEC-108 activation preflight consumes 03c's non-mutating service-only `platform_api.cms_resolve_template_compatibility` resolver (reads only; never a mutating GET) to prove an exact immutable compatible template-version reference under the verified actor/owner scope. The resolver request is `{ templateVersionId, contentTypeId, contentTypeVersionId, expectedTemplateVersionNo? }`: the exact candidate content-type version is required and verified to belong to `contentTypeId` under the same owner, no "current" version is resolved implicitly, and a success projection is the literal invariant `compatible: true` / `withdrawn: false` (incompatible, withdrawn, or version-mismatched references are typed failures). Public template activation remains a separate 03c contract gap and is not an AC169 prerequisite for a draft-binding reference.
- To Shard 04: provide exact active schema/block version IDs for delivery preflight. Shard 04 owns public route/cache/search projections.
- To Shard 05: consume governed settings only where explicitly allowlisted; settings cannot override reserved concepts, lifecycle, security, or migration invariants.
- To Shard 16: reserved concepts prevent CMS types/templates from impersonating credentials, entitlements, credits, EvidenceState, or InstitutionGate. No upward request-time reads.

## Error Handling

### Operation error coverage

The route registry is authoritative; each row below is keyed to every operation ID and uses the same ApiError { code, message, requestId, details } envelope.

| Operation ID | Before mutation                                                                                                 | During transaction                                                                                          | After commit / async                                                                    | Recovery                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| CMS-03A-01   | INVALID_REQUEST, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, UNSUPPORTED_MEDIA_TYPE, VALIDATION_FAILED, RATE_LIMITED | CONFLICT for key/idempotency/unique; DEPENDENCY_UNAVAILABLE on RPC/compiler timeout                         | no async effect; audit is committed with complete draft or transaction is absent        | correct registry input, use fresh key, replay exact idempotency key                                                 |
| CMS-03A-02   | same transport/auth errors plus reserved/key/kind/validator/lifecycle validation                                | CONFLICT for stale version, immutable identity, missing migration plan                                      | no event; prior draft remains                                                           | refetch draft, create valid migration plan, retry with new version                                                  |
| CMS-03A-03   | same transport/auth errors plus projection/cardinality/bounds validation                                        | CONFLICT for stale version/duplicate relation                                                               | no event; prior schema remains                                                          | choose allowlisted projection and bounds, refetch, retry                                                            |
| CMS-03A-04   | transport/auth/step-up/policy-approval/artifact/compatibility errors                                            | CONFLICT for stale candidate, invalid transition, idempotency; DEPENDENCY_UNAVAILABLE for compiler/RPC      | committed switch remains; queued migration is observed through BE00 JobStatus           | reconcile by idempotency/status; worker resumes cursor or enters failed_terminal; prior active remains until switch |
| CMS-03A-05   | signature, principal, manifest, props-ref/hash/snapshot, media, registry validation errors                      | CONFLICT for key/version/digest/idempotency; DEPENDENCY_UNAVAILABLE for registry/RPC                        | committed block is immutable; downstream template preflight may block                   | replay exact digest; conflicting digest goes manual review; withdrawn version blocks new use                        |
| CMS-03A-08   | signature, principal, path, lifecycle, and digest validation errors                                             | CONFLICT for stale version/lifecycle, duplicate nonce, idempotency; DEPENDENCY_UNAVAILABLE for registry/RPC | immutable lifecycle event/outbox remains committed; consumers refetch derived lifecycle | reconcile by idempotency/status; never update the version row; retry only with a fresh nonce                        |
| CMS-03A-06   | INVALID_REQUEST, UNAUTHENTICATED, FORBIDDEN, VALIDATION_FAILED, RATE_LIMITED                                    | DEPENDENCY_UNAVAILABLE for projection/RPC timeout                                                           | no mutation or async effect; no-store response                                          | correct query, restart without cursor, or retry 503/504                                                             |
| CMS-03A-07   | INVALID_REQUEST, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, RATE_LIMITED                                            | DEPENDENCY_UNAVAILABLE for projection/RPC timeout                                                           | no mutation or async effect; no-store response                                          | correct UUIDs, refetch authorized parent, or retry 503/504                                                          |
| CMS-03A-09   | INVALID_REQUEST, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, VALIDATION_FAILED, RATE_LIMITED                         | CONFLICT for stale source If-Match, already-active source, or idempotency; DEPENDENCY_UNAVAILABLE for RPC   | new draft is committed and the source is unchanged; audit/outbox atomic with the clone  | refetch source, correct version, or replay the exact idempotency key                                                 |
| CMS-03A-10   | INVALID_REQUEST, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, VALIDATION_FAILED, RATE_LIMITED                         | CONFLICT for stale version or idempotency; DEPENDENCY_UNAVAILABLE for queue/RPC                             | report+plan+job commit together; queued work is observed through BE00 JobStatus          | retry with the same key reuses the run; changed evidence starts a new attempt                                        |
| CMS-03A-11   | INVALID_REQUEST, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, CONFLICT, VALIDATION_FAILED, RATE_LIMITED               | CONFLICT for stale version, a non-passed dry run, an existing live review, or idempotency                   | frozen review committed atomically with draft → review; no partial freeze                | refetch candidate/evidence, resubmit with new evidence, or replay the exact key                                      |
| CMS-03A-12   | INVALID_REQUEST, UNAUTHENTICATED, STEP_UP_REQUIRED, FORBIDDEN, CONFLICT, VALIDATION_FAILED, RATE_LIMITED        | CONFLICT for stale review version, submitter/self, repeated human, frozen-evidence or authority drift       | append-only decision committed with atomic audit/outbox; rejected review returns to draft | refetch review, satisfy assignment/MFA, or resubmit after invalidation                                               |
| CMS-03A-13   | INVALID_REQUEST, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, RATE_LIMITED                                            | DEPENDENCY_UNAVAILABLE for projection/RPC timeout                                                           | no mutation or async effect; no-store response                                          | correct UUIDs, refetch authorized review, or retry 503/504                                                           |
| CMS-03A-14   | INVALID_REQUEST, UNAUTHENTICATED, STEP_UP_REQUIRED, FORBIDDEN, NOT_FOUND, CONFLICT, VALIDATION_FAILED, RATE_LIMITED | CONFLICT for stale review version, invalid expiry, unknown/ineligible human, or idempotency                 | assignment create/revoke commits with atomic audit/outbox; no identity is created        | correct the eligible-human reference or expiry, refetch review, or replay the exact key                              |

Retry rule: mutation clients may retry a 503/504 only with the same idempotency key after checking status; they must not blind-retry a possibly committed command. Protected reads retry the same canonical query/path without adding mutation-only headers. 502 invalid upstream data is not retried until the adapter or registry version changes. 429 honors Retry-After. Unknown state is surfaced as pending/degraded, never guessed as active.

## Observability

Each route emits structured, scrubbed logs keyed by operation ID, requestId, traceId, correlationId, actor class, acting-context class, safe aggregate ID/hash, expected/current version where authorized, outcome, error code, duration, dependency class, and retryability. Logs never contain request bodies, field values, capability graphs, labels/help text, renderer references, release signatures, tokens, or private domain data.

Metrics are emitted per operation: cms_definition_request_total{operation,outcome}, cms_definition_latency_ms, cms_definition_error_total{operation,code}, cms_definition_rate_limited_total, cms_definition_conflict_total{operation,reason}, cms_registry_allowlist_reject_total, cms_migration_progress, cms_migration_blocked_total, cms_activation_age, cms_schema_review_age, cms_schema_review_pending_total{riskClass}, cms_schema_review_decision_total{decision}, cms_schema_review_assignment_total{action,outcome}, cms_schema_dry_run_total{state,classification}, cms_block_registration_total, cms_block_lifecycle_advance_total, cms_release_nonce_claim_total{outcome}, cms_outbox_lag, cms_queue_retry_total, and cms_queue_dlq_total. Alert thresholds: activation blocked >15m, migration retry >3, a review open past its expected window, a decision or assignment denial spike, nonce-receipt rejection spike, DLQ >0, outbox age >2m, conflict spike >5%/5m, or unknown event version. Logs and metrics never include reviewer/grantor or reviewerPersonId identifiers.

Traces cover validation → session/acting-context → capability → idempotency → RPC/SQL → audit/outbox → worker/refetch. Structured diagnostics record unexpected errors and high-risk command failures with allowlisted fields only; audit remains PostgreSQL authority. Telemetry loss does not roll back a committed definition, but audit failure does.

SLOs: Tier 2 command p95 <1,200ms, protected RPC p95 <300ms, acceptance p99 <1,000ms, queue first attempt p95 <60s, DLQ <0.1% daily. All dashboards split human console and release-worker traffic.

## Testing Strategy

### Contract and route tests

- Generated OpenAPI, Hono route registry, and every Route Registry row match method/path, operation ID, request, success, error, CORS, auth, rate, timeout, cache, and SLO.
- CMS-03A-01 tests every ContentTypeDraftRequest field, built-in/reserved/retired/colliding key, 0/128/129 fields, stable UUID, labels, workflow, and exact ContentTypeVersionResource.
- CMS-03A-02 tests new/add/deprecate/change, all 14 FieldKind values, constraints, unknown keys, required populated data, default/null distinction, migrationPlanId, stale If-Match, and exact FieldDefinitionVersionResource.
- CMS-03A-03 tests field kind, all cardinalities and onUnavailable values, allowlisted/non-allowlisted targetKind/projection, duplicate relation, target authority non-escalation, and exact RelationDefinitionResource.
- CMS-03A-04 tests approval distinctness, recent MFA, dry-run/hash/compiler match, optional expectedActivationEvidenceHash equality and mismatch, additive/conditional/breaking gates, unresolved references, active immutability, queued 202, exact SchemaActivationResource, and cms.schema.activated.v1 payload.
- CMS-03A-05 tests exact X-WeJammin-Release-* header mapping, rejection of aliases/JSON copies, signed raw-body verification, durable key+nonce receipt claim/replay window/ten-minute TTL, release principal, digest duplicate/conflict, block props/renderer/children/slot/data/a11y constraints, normalized RFC 8785/JCS props snapshot hash, trusted Ed25519 nested attestation bound to key/version/ref/hash/releaseDigest, withdrawn behavior, and exact BlockDefinitionVersionResource.
- CMS-03A-08 tests existing key/version lookup, exact signed wire envelope and trusted key, durable nonce claim before acceptance, expected-version CAS, supported→deprecated→withdrawn-only transitions, duplicate/conflicting digest and nonce replay, immutable lifecycle-event row, no mutable version-row write, exact cms.block.lifecycle.changed.v1 outbox payload, and safe-consumer refetch.
- CMS-03A-06 tests every list filter/sort/direction/default/bound, opaque cursor query/scope binding, deterministic ID tie-break, discriminated records with `resourceKind: 'block_definition_registry_record'`, lifecycle filtering only for `content_type`, `field_definition_version`, and `block_definition_registry_record`, rejection of state filters on lifecycle-bearing resources and lifecycle filters on state-only resources, concealed-row omission, no-store response, and rejection of mutation-only headers.
- CMS-03A-07 tests strict path-only UUIDs, type/version membership, capability-safe nested fields/relations/bindings/artifact identity, exact 403/404 disclosure, no-store response, and rejection of mutation-only headers.
- CMS-03A-06 and CMS-03A-07 include zero-side-effect assertions: successful and rejected GETs leave definition, migration, idempotency, audit, and outbox rows byte-for-byte unchanged, reserve no idempotency key, emit no mutation audit/event, and return only the projection plus permitted request/observability counters.
- Browser-envelope tests reject ownership identifiers, release-principal/signature/snapshot/verification fields, and unknown state values; CMS-03A-07 accepts only its safe nested registry resources and strict discriminator, never the worker-only block response.
- Every operation tests 400, 401, 403, 404, 409, 415, 422, 429, 502, 503, 504, and 500 where applicable, with exact ApiError shape, safe details, Content-Type, X-Request-Id, Cache-Control, Retry-After, and RateLimit headers.
- CMS-03A-09 tests stable-field-ID/key preservation, new row IDs, local-reference remapping, version increment, source immutability, and exact source If-Match; CMS-03A-10 tests server-derived classification, the both-null/both-present transform rule, refusal of caller counts/hashes/classification/report, atomic report+plan+job, same-key reuse, and new-attempt-on-changed-evidence, including the unsealed (queued/running) resource that exposes no final counts/hashes; CMS-03A-11 tests draft → review atomicity, one live review per exact evidence, and rejection of a non-passed dry run.
- CMS-03A-12 tests that only an independently authenticated assigned reviewer can decide, that the submitter and repeated humans are refused, that recent binding-bound MFA is required and recorded at decision time, and that frozen-evidence or authority drift invalidates; CMS-03A-13 tests the safe projection with no actor/person/party/private-binding identifiers and a zero-side-effect read; CMS-03A-14 tests the server-derived owner, eligible-existing-human and finite-expiry rules, the fixed read/decide tuple, refusal of the submitter, unknown/ineligible humans, cross-owner reviews, broad scopes, and delegation, and atomic audit with no identity creation.
- DEC-108 integration tests exercise the real non-fixture producer path create → actual dry-run → submit review → independent decisions → activate, then actual source rows → compatible template → successor → nonzero dry-run/backfill/verify → independent review → second atomic switch. Directly inserting review, decision, dry-run, approved-state, or completed-plan rows cannot satisfy this path, and the test-human authority commands are the only permitted provisioning.

### Authorization, persistence, and concurrency tests

- Anonymous, expired session, wrong actor, wrong acting party, missing/revoked capability, stale MFA, wrong registry scope, human using release route, forged JWT metadata, and service-role misuse are tested for every operation.
- Wrong readable resource returns 403; concealed owner/version/retired key returns 404; malformed UUID is 400. Tests assert no existence or capability leakage.
- Migrations test every SQL field type/nullability/check, FK, unique/partial index, enum transition, immutable field, state terminal transition, version CAS, RLS enabled/forced, direct grant revocation, and named RPC grant.
- Concurrent same-key requests produce one row and exact replay; same Idempotency-Key with changed body/actor/path/version returns 409; signed release admission claims one durable key+nonce receipt before acceptance; failed transaction leaves no reservation/nonce claim/audit/outbox/definition/event.
- Concurrent field/relation writes, activation versus edit, approval invalidation, migration lease expiry, duplicate/out-of-order events, unknown event version, worker crash, retry/DLQ, and restore-epoch fencing are covered.

### Security, performance, and recovery tests

- Fuzz JSON depth/keys/arrays, Unicode normalization, regex limits, unknown Zod keys, raw script/CSS/template/expression payloads, SQL-like strings, signature bytes, and oversized bodies.
- Contract tests assert no uploaded executable content, arbitrary data-source/projection, target authority, or PII reaches persistence, events, logs, public responses, or cache.
- Remote compiler adapter tests assert exact 2,000ms timeout, 15s/60s/300s retry schedule, five-failure/60s circuit, 502/503/504 mapping, and ambiguous-response idempotency reconciliation.
- Benchmark representative definitions and 128-field schemas at Tier 2 p95 <1,200ms and RPC p95 <300ms; migration worker reports truthful cursor/progress.
- Recovery drill proves failed migration keeps old active schema, activation rollback before switch, resumed cursor after worker loss, DLQ replay after fix, and no duplicate active switch.

### Accessibility handoff tests

Validation failures preserve stable JSON Pointer paths and safe messages for frontend error summaries. BlockDefinitionVersion accessibility manifest requires name, keyboard, focus, and status semantics. Registry responses never require private content or raw source to render an error. Representative CMS console flows pass keyboard and screen-reader contract tests; backend emits no inaccessible opaque error.

## Deepening Passes

| Pass | Focus                                | Evidence                                                                                                                                                                                                                                                                                                                                               | Result |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 1    | Source and split completeness        | The owned IA mutation flows, twelve canonical definition tables plus three private CMS review records (nonce receipts, lifecycle events, template and capability bindings, immutable dry-run reports, and the review/decision/assignment tables), fourteen operation contracts, owned activation/lifecycle events plus the consumed template event, contracts, access, edge cases, and deep-dive headings are mapped above. | PASS   |
| 2    | Endpoint and contract reconciliation | One authoritative registry row per CMS-01/02/03/04/10/lifecycle command, the six DEC-108 producer commands, and three protected reads; request/success/error schema and operation matrices key to all fourteen IDs.                                                                                                                                       | PASS   |
| 3    | Persistence hard floor               | Twelve storage tables list SQL type, nullability, checks, FKs, indexes, RLS predicates, grants, immutability, and retention.                                                                                                                                                                                                                           | PASS   |
| 4    | State/concurrency/failure            | CAS, immutable versions, migration cursor/lease, idempotency, outbox atomicity, old-active fallback, and DLQ behavior are explicit.                                                                                                                                                                                                                    | PASS   |
| 5    | Security and disclosure              | CORS is named per operation; CSRF, step-up, trusted Ed25519 release and nested props attestations, nonce receipts, allowlists, 403/404, no executable content, and no PII logging are explicit.                                                                                                                                                        | PASS   |
| 6    | External seams and operations        | Remote adapter timeout/retry/backoff/circuit and 502/503/504 mapping are exact; metrics, traces, SLOs, and alert thresholds are per operation.                                                                                                                                                                                                         | PASS   |
| 7    | Testability                          | Every operation has field, error, auth, RLS, idempotency, concurrency, event, performance, recovery, and accessibility tests.                                                                                                                                                                                                                          | PASS   |
| 8    | Cross-shard contracts                | BE00/BE01/03b/03c/04/05/16 producer-consumer ownership, identifier-only events, and DEC-100 bounded references are explicit.                                                                                                                                                                                                                           | PASS   |
| 9    | Two-implementer convergence          | Two implementers using only this document choose the same routes, schemas, states, transaction boundaries, and denial behavior.                                                                                                                                                                                                                        | PASS   |
| 10   | Adversarial review                   | Reserved concepts, key reuse, active mutation, stale approvals, unauthorized projections, release spoofing, duplicate effects, and existence leakage have deterministic refusals.                                                                                                                                                                      | PASS   |

## Ambiguity Gate

- Micro ambiguity PASS: every request/query/path field has a type, bound, null/default rule, unknown-key policy, and failure; every state transition names its guard and recovery; every operation has auth, CORS, rate, error, observability, and test rows, while mutation-only idempotency/If-Match and read-only absence rules are explicit.
- Macro ambiguity PASS: create → draft → field/relation changes → successor/dry-run → frozen CMS review with bounded assignment and independent decisions → workflow/risk-policy-derived activation → migration worker → downstream refetch is a single deterministic flow with no hidden endpoint or ownership handoff.
- Two-implementer PASS: independent implementers can derive the same twelve definition tables plus three private CMS review records (including nonce receipts, lifecycle events, template/capability bindings, immutable dry-run reports, and the review/decision/assignment tables), fourteen operation IDs, Zod schemas, event payloads, RPC transaction boundaries, protected-read behavior, and 403/404 policy.
- Devil's-advocate PASS: hostile admin upload, reserved key reuse, relation-to-private-domain target, approval race, submitter/self or repeated-human decision, assignment broadening or delegation, a decision replayed after evidence drift, stale compiler, duplicate release digest/nonce, forged nested Ed25519 attestation, illegal lifecycle advance, worker crash, and telemetry outage produce safe typed outcomes.
- No unresolved product, architecture, security, or implementation ambiguity remains in this boundary.

## Open Questions

None.

## Changelog

| Date       | Change                                                                                                                                                                                                                                                                                                                         | Workflow                | Sections affected                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | --------------------------------------------------------------------------- |
| 2026-08-28 | Classified IA Shard 03 into registry, editorial/publication, and composition/taxonomy/localization backend boundaries.                                                                                                                                                                                                         | /write-be-spec-classify | Split Group, Classification                                                 |
| 2026-08-28 | Authored complete content schema registry backend contract for CMS-01, CMS-02, CMS-03, CMS-04, and CMS-10.                                                                                                                                                                                                                     | /write-be-spec-write    | All                                                                         |
| 2026-09-02 | Applied authorized IA-first Slice 09 reconciliation: atomic aggregate, full field/relation grammar, policy-derived approvals, immutable artifacts, signed block identity, protected list/detail reads, and eight-operation closure.                                                                                            | /propagate-decision     | All                                                                         |
| 2026-09-02 | Added CMS-03A-08 signed lifecycle advance with immutable lifecycle-event evidence, durable ten-minute nonce receipts, single physical state/derived lifecycle semantics, safe registry discriminator, strict state/lifecycle filter rejection, artifact FK atomicity, and RFC 8785/JCS-bound nested Ed25519 props attestation. | /implement-slice        | Contracts, Database Schema, Middleware & Policies, Data Flow, Events, Tests |
| 2026-09-02 | Closed browser response state/lifecycle enums against the IA and SQL matrices, removed ownership identifiers from browser envelopes, and documented safe A07 nested projections versus worker-only release evidence.                                                                                                           | /implement-slice        | Source Map, Route Registry, Contracts, Testing Strategy                     |
| 2026-10-02 | DEC-108: added CMS-03A-09…14 reachable activation producers (successor, actual dry-run, review submit/detail/decision, bounded assignment) with private CMS-owned review/decision/assignment records, approval-only `cms.schema_review` and server-derived owner-only `cms.schema_review.assign`, frozen safe evidence summaries, version-addressed artifact references, recent-MFA-at-decision with no ten-minute decision-age expiry, exact 401 `STEP_UP_REQUIRED` recovery, and the safe `activationPreparation` projection. | /propagate-decision     | Route Registry, Contracts, Database Schema, Middleware, Data Flow, Error Handling, Observability, Testing, Deepening, Changelog |

## Dependency References

- [IA Shard 03 — CMS content modeling and authoring](../ia/03-cms-content-modeling.md)
- [IA Shard 03 deep dive — CMS content modeling and authoring](../ia/deep-dives/03-cms-content-modeling.md)
- [BE00 — Cross-cutting platform foundation](00-infrastructure.md)
- [BE01 — Identity authority and party governance](01a-auth-account-linking.md)
- [BE02 — Shadow/profile/credentials boundaries](02a-shadow-claim-ownership.md)
- [Architecture Design](../2026-08-02-architecture-design.md)
- [Data Placement Strategy](../data-placement-strategy.md)
- [DEC-100 — bounded allowlisted cross-shard projections](../../decisions.md#dec-100-shard-02-accepts-bounded-inbound-evidence-and-policy-commands-without-upward-store-reads-2026-08-28)
