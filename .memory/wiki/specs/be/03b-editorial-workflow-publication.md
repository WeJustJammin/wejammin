# Editorial Workflow and Publication — Backend Specification

> IA Source: [Shard 03 — CMS content modeling and authoring](../ia/03-cms-content-modeling.md)
> Deep Dives: [Shard 03 CMS content modeling and authoring deep dive](../ia/deep-dives/03-cms-content-modeling.md)
> Foundation: [BE00 — Cross-cutting platform foundation](00-infrastructure.md)
> Registry dependency: [03a — Content schema registry](03a-content-schema-registry.md)
> Status: Complete

## Split Group

This is the editorial and publication member of the three-way Shard 03 backend split:

| BE spec                                  | Owned IA interactions                          | Boundary                                                                                                                      |
| ---------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 03a-content-schema-registry.md           | CMS-01, CMS-02, CMS-03, CMS-04, CMS-10         | Immutable content schemas, allowlisted relations, migrations, and code-owned block registration.                              |
| 03b-editorial-workflow-publication.md    | CMS-05, CMS-06, CMS-07, CMS-08, CMS-09, CMS-13 | Entry drafts/revisions, conflict resolution, revision history/restore, review/approval, scheduling, preview, and publication. |
| 03c-composition-taxonomy-localization.md | CMS-11, CMS-12, CMS-14, CMS-15, CMS-16         | Templates, patterns, composition, taxonomies, locale variants, and related-content rules.                                     |

03b owns mutable editorial workflow and the publication control plane. 03a remains the source of schema/field/relation compatibility. 03c supplies template, pattern, taxonomy, and locale inputs that this file freezes and revalidates at review/publish. Shard 04 owns public route/render/search/cache projections after the committed publication event. No route here duplicates a BE00 endpoint or a 03a schema-registry route. CMS-03B-10 initial entry create is not a special case of CMS-03B-01: CMS-03B-01 keeps its requirement for an existing active entry plus a positive readable base revision, while CMS-03B-10 is the only route that may create the entry aggregate itself.

## Classification

- Type: domain command/query and protected publication control plane.
- IA source: 03-cms-content-modeling.md and its required deep dive.
- Included: CMS-05 create/edit entry; CMS-06 resolve concurrent edit; CMS-07 compare/restore revision; CMS-08 submit/review/approve; CMS-09 schedule publish/expire; CMS-13 preview/diff/publish.
- Split decisions: CMS-07, CMS-08, and CMS-13 each have separate read/command or preview/publication routes so safe reads, review decisions, and public effects have independent auth, rate, cache, and audit cells.
- Excluded: definitions/activation and block registration are 03a; template/pattern/taxonomy/locale/related-content definition and assignment are 03c; public delivery projection is Shard 04; identity, acting context, error envelope, jobs, idempotency, audit, outbox, queues, and provider primitives are BE00; the registry-backed capability keys (cms.author, cms.editor) and their entry-assignment records are BE01/migration-owned and are never accepted from caller metadata.
- Authority boundary: ContentEntry and its revisions are editorial records. They cannot manufacture canonical identity, party, authority, rights, money, entitlement, credential, evidence, or domain-record state.
- Decision status: no new decision. DEC-100 is inherited: references use bounded allowlisted projections and never perform request-time upward reads or copy producer authority.

## Referenced Material Inventory

| Material                                 | Sections / lines consumed                                                                                                                   | Use in this specification                                                                                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IA Shard 03                              | Overview 9–22; Features 24–29; Acceptance Criteria 31–49                                                                                    | Scope, acceptance, and feature boundaries.                                                                                                                                                                    |
| IA Shard 03                              | Interactions 50–69, especially CMS-05 through CMS-09 and CMS-13                                                                             | Route operations, preconditions, completion, refusal, and recovery rules.                                                                                                                                     |
| IA Shard 03                              | Contracts 79–128                                                                                                                            | Revision/autosave/presence, risk review, schedule, preview, and publication contracts.                                                                                                                        |
| IA Shard 03                              | Data Models 130–156; Common Model Envelope and Exceptions 160–188                                                                           | ContentEntry, EntryRevision, EntryFieldValue, EntryRelation, EditorialReview, EditorialDecision, PublicationSchedule, and related model fields.                                                               |
| IA Shard 03                              | Access Control 220–244; Accessibility 246–254                                                                                               | Author/editor/publisher/reviewer roles, assignment, MFA, disclosure, and status/error accessibility.                                                                                                          |
| IA Shard 03                              | Event Schemas 256–273                                                                                                                       | cms.entry.revision-created.v1, cms.entry.review-changed.v1, cms.publication.changed.v1, and cms.localization.changed.v1.                                                                                      |
| IA Shard 03                              | Edge Cases 275–298; Cross-Shard Dependencies 326–341                                                                                        | Conflict, authority, DST, preview, publication race, outage, and downstream projection behavior.                                                                                                              |
| IA Shard 03                              | Deep Dives Needed 331–333 and Changelog 343–354                                                                                             | Required deepening, cross-shard map, and source corrections.                                                                                                                                                  |
| IA Shard 03 deep dive                    | Canonical Field Contracts 78–127; State Machines 129–140                                                                                    | Exact revision/review/schedule/publication fields and transitions.                                                                                                                                            |
| IA Shard 03 deep dive                    | Entry Validation and Revision Merge 152–160                                                                                                 | Assignment recheck, normalization, changed paths, conflicts, relation checks, and restore migration.                                                                                                          |
| IA Shard 03 deep dive                    | Review and Publication Algorithm 162–170                                                                                                    | Frozen dependency set, preflights, distinct decisions, publication transaction, and projection handoff.                                                                                                       |
| IA Shard 03 deep dive                    | Migration Algorithm 172–179; Composition and Preview Validation 204–233                                                                     | Restore migration, exact version set, preview binding, and fail-closed checks.                                                                                                                                |
| IA Shard 03 deep dive                    | Taxonomy, Localization, and Relationship Rules 235–242; Abuse and Recovery Verification 244–257                                             | Locale staleness, relationship authorization, and hostile/failure-path tests.                                                                                                                                 |
| IA Shard 03 deep dive                    | Cross-Shard Contracts 259–273; Implementation Envelope 275–281                                                                              | 03a/03c/04/05/01 handoffs and PostgreSQL/RLS/Hono/Queue boundaries.                                                                                                                                           |
| BE00                                     | Contracts 84–165; middleware/auth 253–297; transactions/events/errors 298–451; observability/tests 452–503                                  | Inherited wire shape, ApiError, ETag/idempotency, principal pipeline, queue, audit/outbox, SLO, and test floor.                                                                                               |
| 03a-content-schema-registry.md           | Shared Contract Inheritance 104–128; route registry 132–145; Zod contracts 196–959; database/Middleware & Policies 976–1068                 | Exact active schema and SchemaArtifact identity, protected validator/workflow-policy evidence, field UUID, immutable relation allowlist, migration status, and BlockDefinitionVersion/lifecycle-event inputs. |
| 03c-composition-taxonomy-localization.md | Templates/patterns/taxonomies/locales and their route/contracts                                                                             | Frozen template/taxonomy/locale dependency set; this file rechecks current versions at review and publish.                                                                                                    |
| BE01a–01d                                | BE01a Shared Contract Inheritance 73–97; BE01b Contract Conventions 88–137; BE01c schema/access 294–395; BE01d disclosure semantics 424–502 | Verified human, person, party, acting context, mandate, capability, and MFA facts.                                                                                                                            |
| BE02a–02c                                | BE02a Shared Contract Inheritance 85–98; BE02b source contracts 102–227 and schema 429–652; BE02c schema 305–369                            | Fixed profile/provenance restrictions and canonical-record non-smuggling.                                                                                                                                     |
| Architecture Design                      | Tech Stack/hosting 143–196; persistence 198–266; API 343–376; security/rate 535–668 and 770–797; observability 916–995                      | Hono/Cloudflare Workers, Supabase PostgreSQL/Auth/RLS, limits, and diagnostics.                                                                                                                               |
| Data Placement Strategy                  | N-Tier 5–17; placement 19–40; security 42–55; storage/isolation 86–93; lifecycle 95–114; tenancy/sync 116–148                               | Canonical store, PII minimization, retention, RLS, and synchronization.                                                                                                                                       |
| Engineering Standards                    | Tests 27–44; performance 53–121; async/recovery 122–138; accessibility 140–148; security 149–165; migration/CI 185–207                      | Quality, accessibility, security, recovery, and release gates.                                                                                                                                                |

## IA Source Map

| BE section                              | Source of truth                             | Exact section / lines                                                                                               |
| --------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Classification and split                | IA Shard 03                                 | Overview 9–22; Features 24–29; Interactions 50–69                                                                   |
| Routes and endpoint reconciliation      | IA Shard 03                                 | Acceptance Criteria 31–49; Interactions 58–66; Surface Applicability 299–304                                        |
| Revision and conflict contracts         | IA Shard 03 plus deep dive                  | Contracts 97–109; Data Models 130–156; Entry Validation and Revision Merge 152–160                                  |
| Review and approval                     | IA Shard 03 plus deep dive                  | Contracts 99–109; Access Control 220–244; Review and Publication Algorithm 162–170                                  |
| Schedule and publication                | IA Shard 03 plus deep dive                  | Contracts 103–109; CMS-09/CMS-13 at Interactions 62 and 66; Review and Publication Algorithm 162–170                |
| Preview and dependency freeze           | IA Shard 03 plus deep dive                  | Contracts 111–128; Composition and Preview Validation 204–233                                                       |
| Activation and dependency evidence      | IA Shard 03 plus deep dive                  | Contracts 89–99 and 113–128; Schema Compilation and Compatibility 142–150; Review and Publication Algorithm 162–170 |
| Browser projection ownership and states | IA Shard 03 deep dive plus BE03b SQL matrix | Common Model Envelope and Exceptions 48–76; State Machines 129–140; canonical records and fields 690–704            |
| Persisted envelope and exceptions       | IA Shard 03 plus deep dive                  | Data Models 130–188; Common Model Envelope and Exceptions 160–188; deep dive envelope 48–76 and fields 91–113       |
| Relations and privacy fallback          | IA Shard 03 plus deep dive                  | Contracts 91 and 115; Composition and Preview Validation 204–233; Entry Validation and Revision Merge 152–160       |
| Persistence, RLS, and grants            | IA Shard 03, BE00, placement                | Data Models 130–156; Access Control 220–244; BE00 schema/grants 202–251; placement 19–55 and 86–114                 |
| Events and async                        | IA Shard 03 plus BE00                       | Event Schemas 256–273; deep dive Cross-Shard Contracts 259–273; BE00 event/queue 274–451                            |
| Tests and ambiguity                     | IA Shard 03, deep dive, standards           | Edge Cases 275–298; Abuse and Recovery Verification 244–257; standards 27–44 and 185–207                            |

## Feature Ledger Coverage

| Ledger ID | Feature                                | BE ownership                       | Coverage evidence                                                                                                                                                                      |
| --------- | -------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25.02.01  | Entry Authoring, Autosave & Locking    | CMS-03B-01, CMS-03B-10, CMS-03B-11 | ContentEntry, EntryRevision, EntryFieldValue, EntryRelation, presence lease, autosave cadence, assignment/RLS, protected entry bootstrap, authorized draft detail, and conflict tests. |
| 25.02.02  | Revision History, Compare & Restore    | CMS-03B-03, CMS-03B-04             | Append-only revision history, schema-aware comparison, migration-chain restore, and no obsolete-schema activation.                                                                     |
| 25.02.03  | Review, Approval & Editorial Ownership | CMS-03B-05, CMS-03B-06             | EditorialReview/EditorialDecision, frozen dependency manifest, distinct reviewer/MFA gates, invalidation, and decision tests.                                                          |
| 25.02.04  | Scheduling, Expiry & Archive           | CMS-03B-07                         | IANA/tzdb schedule, DST disambiguation, exact-version worker CAS, late-run evidence, and blocked recovery.                                                                             |
| 25.03.04  | Preview, Diff & Safe Publish           | CMS-03B-08, CMS-03B-09             | Audience-bound preview token, exact version set, preflight, publication_version, atomic outbox, and projection convergence.                                                            |

25.01.* and 25.03.01 are owned by 03a. 25.03.02–25.03.03 and 25.05.* are owned by 03c. 03b consumes those versions only through immutable IDs/hashes and revalidates them at submit, schedule, preview-open, and publish.

## Endpoint Completeness Reconciliation

The IA flows owned here reconcile to eleven concrete operation IDs. CMS-05 is owned by two operations: CMS-03B-01 appends a revision to an existing active entry, and CMS-03B-10 bootstraps a new active entry together with its first draft. CMS-07, CMS-08, and CMS-13 are intentionally split into read/restore, submission/decision, and preview/publication operations. There are no unregistered background HTTP endpoints; schedule, projection, review invalidation, and migration effects use BE00 jobs/outbox consumers.

| IA interaction                  | Operation ID(s)        | Concrete route(s)                                                                                              | Reconciliation                                                                  |
| ------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| CMS-05 Create/edit entry        | CMS-03B-01             | POST /api/v1/cms/entries/{entryId}/revisions                                                                   | Creates an immutable revision/autosave; it never publishes.                     |
| CMS-05 Create/edit entry        | CMS-03B-10             | POST /api/v1/cms/entries                                                                                       | Creates the active entry and its first draft revision; never publishes.         |
| CMS-05 Create/edit entry        | CMS-03B-11             | GET /api/v1/cms/entries/{entryId}                                                                              | Safe authorized draft detail for the editor; read-only, bounded.                |
| CMS-06 Resolve concurrent edit  | CMS-03B-02             | POST /api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve                                              | Explicitly chooses same-field values and creates a two-parent revision.         |
| CMS-07 Compare/restore revision | CMS-03B-03, CMS-03B-04 | GET /api/v1/cms/entries/{entryId}/revisions; POST /api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore | Safe history/compare query is separate from edit-authorized restore.            |
| CMS-08 Submit/review/approve    | CMS-03B-05, CMS-03B-06 | POST /api/v1/cms/entries/{entryId}/reviews; POST /api/v1/cms/reviews/{reviewId}/decision                       | Submission freezes the candidate; decisions are append-only and distinct.       |
| CMS-09 Schedule publish/expire  | CMS-03B-07             | POST /api/v1/cms/publication-schedules                                                                         | Stores local and resolved times; worker executes exact version once.            |
| CMS-13 Preview/diff/publish     | CMS-03B-08, CMS-03B-09 | POST /api/v1/cms/previews; POST /api/v1/cms/publications                                                       | Preview is revocable/read-only; publication is publisher-authorized and atomic. |

BE00 GET /api/v1/jobs/{jobId} remains the only job-status route and is inherited. The 03a schema/block-definition routes are CMS-03A-01 through CMS-03A-14. Shard 04 owns delivery reads and never receives a draft through a public route. CMS-03B-10 POST /api/v1/cms/entries and CMS-03B-11 GET /api/v1/cms/entries/{entryId} are the only entry-aggregate routes; the detail read returns only authorized, schema-typed draft values and never untyped or private content.

## Shared Contract Inheritance

All operations use BE00 /api/v1, request ID, strict Zod 4, exact ApiError, strong quoted decimal ETag, Idempotency-Key, authenticated no-store responses, CORS allowlists, rate headers, audit, and outbox contracts.

```ts
import { z } from 'zod';

const UUID = z.string().uuid();
const Version = z.string().regex(/^[1-9][0-9]*$/);
const Json = z.json();
const jsonDepth = (value: unknown): number => {
  if (Array.isArray(value)) {
    return 1 + Math.max(0, ...value.map(jsonDepth));
  }
  if (value !== null && typeof value === 'object') {
    return 1 + Math.max(0, ...Object.values(value).map(jsonDepth));
  }
  return 0;
};
const ApiError = z.strictObject({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
  message: z.string().min(1).max(500),
  requestId: UUID,
  details: z.record(z.string(), z.json()),
});
```

ApiError is exactly { code, message, requestId, details }. details is capped at 16 keys, four levels, and 8 KiB serialized. Every failure below cites this envelope and returns JSON, X-Request-Id, and Cache-Control no-store. 429 and retryable 503 include Retry-After and RateLimit headers.

- Authentication is Supabase Auth session/JWT followed by server-resolved person, acting party, assignment, capability, and RLS checks. Caller-supplied actor, owner, reviewer, party, or version fields do not confer authority.
- Mutations require Idempotency-Key 8–128 printable ASCII. Mutable parent commands require exact If-Match: "<positive decimal version>". Same binding replays the original result; mismatch returns 409. CMS-03B-10 is the documented exception: an initial create has no prior resource or version, so it requires Idempotency-Key with a server-derived initial version instead of If-Match.
- Middleware order is request-id → raw-size/media guard → JSON parse → Zod validation → session/JWT → acting-context/capability/assignment → CSRF → configured first-party CORS → rate limiter → handler/RPC → response/error normalization.
- CORS is explicit per route below. Browser session routes allow configured CMS-console origins only with credentials; preview and publication never use wildcard credentials. Worker/scheduler routes use registered non-browser principals.
- PostgreSQL RPC rechecks ownership, assignment, workflow state and frozen workflow-policy evidence, current version, SchemaArtifact id/hash/compiler, protected validator refs, dependency versions, idempotency, and target disclosure under RLS. Mutation, audit, idempotency, and outbox are atomic.
- Queue messages carry IDs, versions, hashes, correlation/causation IDs, and no private content, comments, field values, or tokens. At-least-once consumers re-read canonical state under a lease.

## API Endpoints

### Route Registry

This is the single authoritative 03b route registry. Generated OpenAPI and discovered Hono routes must match each method/path, operation ID, request/success/error schema, auth, CORS, rate, timeout, cache, SLO, idempotency, and BOLA declaration.

| Operation ID | IA     | Method and path                                                   | Request → success                                            | Auth / ownership / 403 versus 404                                                                                 | Middleware incl. CORS                                                       | Idempotency / concurrency                                                                                                                                                                                                                               | Rate / timeout / cache / SLO                                                     | Error envelope                                      | Event                                           |
| ------------ | ------ | ----------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| CMS-03B-01   | CMS-05 | POST /api/v1/cms/entries/{entryId}/revisions                      | EntryRevisionRequest → 201 EntryRevisionResource             | CMS author/editor with assignment to readable entry; hidden entry is 404; known entry without assignment is 403   | BE00 order; CORS cms-console; CSRF; JSON 256 KiB; schema registry read      | key + If-Match; CAS entry version; changed paths/base revision                                                                                                                                                                                          | 120/min/user, 240/min/party; 15,000ms, target <2s; no-store; Tier 2 p95 <1,200ms | BE00 ApiError { code, message, requestId, details } | cms.entry.revision-created.v1                   |
| CMS-03B-02   | CMS-06 | POST /api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve | ConflictResolutionRequest → 201 EntryRevisionResource        | assigned editor/author may resolve; hidden entry/conflict is 404; visible conflict without edit capability is 403 | BE00 order; CORS cms-console; CSRF; strict JSON; conflict rate class        | key + If-Match; CAS conflict base and entry version; no inferred choice                                                                                                                                                                                 | 60/min/user, 120/min/party; 15,000ms; no-store; Tier 2                           | BE00 ApiError { code, message, requestId, details } | cms.entry.revision-created.v1                   |
| CMS-03B-03   | CMS-07 | GET /api/v1/cms/entries/{entryId}/revisions                       | RevisionHistoryQuery → 200 RevisionHistoryPage               | assignment/read capability; hidden entry is 404; known entry without read scope is 403                            | BE00 order; CORS cms-console; no CSRF mutation; cursor/context binding      | safe read; no Idempotency-Key/If-Match; signed keyset cursor over `(revisionNumber DESC, revisionId DESC)`; default limit 25, max 50; stable sort `revisionNumber DESC, revisionId DESC`; filter allowlist `state`, `locale` only; ETag on page version | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 1 p95 <750ms                | BE00 ApiError { code, message, requestId, details } | none                                            |
| CMS-03B-04   | CMS-07 | POST /api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore | RevisionRestoreRequest → 201 EntryRevisionResource           | edit capability + readable source revision; hidden entry/revision is 404; readable but no edit is 403             | BE00 order; CORS cms-console; CSRF; migration-chain recheck; strict JSON    | key + If-Match; CAS current entry; migration chain immutable                                                                                                                                                                                            | 30/min/user, 60/min/party; 15,000ms; no-store; Tier 2                            | BE00 ApiError { code, message, requestId, details } | cms.entry.revision-created.v1                   |
| CMS-03B-05   | CMS-08 | POST /api/v1/cms/entries/{entryId}/reviews                        | ReviewSubmissionRequest → 201 EditorialReviewResource        | submit capability/assignment; hidden entry/revision is 404; visible non-submitter is 403                          | BE00 order; CORS cms-console; CSRF; dependency preflight; strict JSON       | key + If-Match; one open review per revision via unique lock                                                                                                                                                                                            | 30/min/user, 60/min/party; 15,000ms; no-store; Tier 2                            | BE00 ApiError { code, message, requestId, details } | cms.entry.review-changed.v1                     |
| CMS-03B-06   | CMS-08 | POST /api/v1/cms/reviews/{reviewId}/decision                      | EditorialDecisionRequest → 200 EditorialReviewResource       | reviewer capability and assigned review; hidden review is 404; eligible review without required capability is 403 | BE00 order; CORS cms-console; CSRF; step-up MFA for protected; strict JSON  | key + If-Match; unique reviewer/review and review CAS                                                                                                                                                                                                   | 30/min/user, 60/min/party; 15,000ms; no-store; Tier 2                            | BE00 ApiError { code, message, requestId, details } | cms.entry.review-changed.v1                     |
| CMS-03B-07   | CMS-09 | POST /api/v1/cms/publication-schedules                            | PublicationScheduleRequest → 202 PublicationScheduleResource | CMS publisher with entry/revision visibility; hidden target is 404; visible target without publisher is 403       | BE00 order; CORS cms-console; CSRF; step-up MFA; strict JSON                | key + If-Match; exact action/version unique; worker CAS                                                                                                                                                                                                 | 20/min/user, 40/min/party; 15,000ms acceptance; no-store; Tier 2                 | BE00 ApiError { code, message, requestId, details } | cms.publication.changed.v1 only after execution |
| CMS-03B-08   | CMS-13 | POST /api/v1/cms/previews                                         | PreviewRequest → 201 PreviewTokenResource                    | preview capability on entry/revision; hidden target is 404; visible target without preview scope is 403           | BE00 order; CORS cms-console; CSRF; no public cache; strict JSON            | key required; revision/version-set CAS; same binding replays the same token metadata without revealing token hash                                                                                                                                       | 60/min/user, 120/min/party; 8,000ms; no-store; Tier 1                            | BE00 ApiError { code, message, requestId, details } | none                                            |
| CMS-03B-09   | CMS-13 | POST /api/v1/cms/publications                                     | PublicationRequest → 202 PublicationResource                 | CMS publisher plus frozen approval/dependency set; hidden target is 404; visible target without publisher is 403  | BE00 order; CORS cms-console; CSRF; step-up MFA where required; strict JSON | key + If-Match; CAS expected version set; exact publication unique                                                                                                                                                                                      | 20/min/user, 40/min/party; 15,000ms acceptance; no-store; Tier 2                 | BE00 ApiError { code, message, requestId, details } | cms.publication.changed.v1                      |
| CMS-03B-10   | CMS-05 | POST /api/v1/cms/entries                                          | EntryCreateRequest → 201 EntryCreateResource                 | cms.author/cms.editor capability; hidden target is 404; visible target without create capability is 403           | BE00 order; CORS cms-console; CSRF; JSON 256 KiB; schema registry read      | key required; no If-Match because no prior version exists; server-derived entry version 1; unique owner/contentType/idempotency binding prevents a duplicate entry or revision                                                                          | 120/min/user, 240/min/party; 15,000ms, target <2s; no-store; Tier 2 p95 <1,200ms | BE00 ApiError { code, message, requestId, details } | cms.entry.revision-created.v1                   |
| CMS-03B-11   | CMS-05 | GET /api/v1/cms/entries/{entryId}                                 | EntryDraftDetailQuery → 200 EntryDraftDetailResource         | assignment/read capability; hidden/absent entry is 404; visible entry without read scope is 403                   | BE00 order; CORS cms-console; no CSRF mutation; no-store detail read        | safe read; no Idempotency-Key or If-Match; ETag binds entry plus draft revision versions; no fallback to untyped or cross-tenant values                                                                                                                 | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 1 p95 <750ms                | BE00 ApiError { code, message, requestId, details } | none                                            |

### Registry invariants

- Route path IDs are UUIDs. A route never accepts owner, reviewer, publisher, acting party, or current version as an authority assertion.
- CMS-03B-01, CMS-03B-02, CMS-03B-04, CMS-03B-05, CMS-03B-06, CMS-03B-07, and CMS-03B-09 return strong ETag and Location where a new resource is created. CMS-03B-03 returns an authenticated page ETag. CMS-03B-08 returns a short-lived token and no public ETag. CMS-03B-10 returns a strong ETag with a Location header for the created entry. CMS-03B-11 returns a strong no-store ETag binding the entry and current draft revision versions.
- CMS-03B-10 is the only route that creates the entry aggregate, so it is the single documented exception to the mutation precondition: it requires Idempotency-Key and derives the initial entry version server-side instead of requiring If-Match. Every other mutation route keeps the exact strong If-Match requirement. CMS-03B-11 is a safe read and accepts neither Idempotency-Key nor If-Match.
- Every row returns BE00 ApiError { code, message, requestId, details } for failures. No row exposes draft existence, private field values, review comments, token material, or capability graphs to an unauthorized caller.
- CMS-03B-07 schedule acceptance does not claim publication success. CMS-03B-09 returns pending/queued when downstream projection has not converged; canonical publication state is authoritative.
- CMS-03B-08 preview tokens are audience-bound and revocable. They cannot be exchanged for a publication command or reused after expiry.
- Browser/protected response envelopes contain no ownership identifiers or reviewer/publisher authority fields; authorization context stays server-side. Entry revisions, reviews, schedules, publications, and revision summaries expose only their exact closed state enums.

DEC-108 prerequisite attribution: three CMS-05 boundaries are the minimum
source-row authority that Slice 09 moves forward so schema activation can be
exercised against real persisted rows — the CMS-03B-10 entry bootstrap
(CMS-05 create) and the CMS-03B-11 protected draft-detail read, together with
the CMS-03B-01 revision append they depend on. They remain owned by this 03b
shard; Slice 09 consumes their authority and does not redefine them. The
fail-closed `platform_private.cms_editorial_workflow_policy_evidence` projection
is the single seam that resolves editorial workflow-policy evidence; it is not
part of the DEC-108 CMS schema-review authority. Editorial workflow policies come
from a code-owned, versioned policy registry that shares the shape of 03a's
DEC-108 schema-review registry (`key`, `version`, `policyHash`, `riskClass`,
`requiredDecisionCount` `1..8`, `requiredCapabilities`). A forward-only migration
seeds immutable policy rows from that registry, and each content-type version
binds exactly one editorial policy key/version at activation. The projection
resolves the bound immutable row and returns NULL on absence, ambiguity or a
malformed row, in which case `cms_create_entry` raises `DEPENDENCY_UNAVAILABLE`
rather than trusting a caller hash. Policy changes ship only as code plus a
forward migration, and a caller-supplied policy is never authority. This
specification applies the members that 03a's Workflow policy registry enumerates
(DEC-110; 03a holds the single authoritative table). The ordinary members
`editorial`, `editorial.default`, `cms.content.workflow` and `cms.standard`
(version 1) each require one independent decision under `cms.reviewer`. The
protected members `cms.disclosure.policy`, `cms.disclosure.legal`,
`cms.disclosure.security` and `cms.disclosure.financial` (version 1) each require
two distinct humans, at least one of whom holds the class specialist capability
`cms.reviewer.policy`, `cms.reviewer.legal`, `cms.reviewer.security` or
`cms.reviewer.financial` respectively. `requiredCapabilities` is
`["cms.reviewer"]` for an ordinary member and `["cms.reviewer",
"cms.reviewer.<class>"]` for a protected one, read as ordered reviewer slots, and
`policyHash` is the JCS canonical SHA-256 of the member defined in 03a. For
editorial use the policy is the member bound to the entry's content-type version
through its `workflow_key`/`workflow_version`; an editorial review freezes that
member's evidence, counts only decisions whose humans currently qualify, and is
approved when the transactional count of distinct qualifying approvers reaches
`requiredDecisionCount` and every specialist slot is held by a counted approver.
An approve decision is refused with 409 `CONFLICT` when the decisions that would
remain unrecorded after it are fewer than the specialist slots no counted
approver holds, because `recordedDecisionCount` never exceeds
`requiredDecisionCount`; a reject decision is never refused on this ground.
Reviewer and specialist grants are provisioned by the owner CMS capability grant
command (03a CMS-03A-15). The DEC-108
`cms_schema_reviews`/`cms_schema_review_decisions`/`cms_schema_review_assignments`
records and CMS-03A-09…14 commands are a distinct CMS-registry-surface
authority under 03a, not this shard's editorial review (`editorial_review` /
`editorial_decision`) flow.

### Route field validation matrix

| Operation             | Field                                  | Exact constraint                                                                                                                                                                                                                                                                                                                 | Failure                       |
| --------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| CMS-03B-01            | entryId                                | UUID path; must resolve to active ContentEntry after structural validation                                                                                                                                                                                                                                                       | 400 or policy-safe 404        |
| CMS-03B-01            | baseRevision                           | positive bigint decimal string; revision must be readable                                                                                                                                                                                                                                                                        | 422 or 409 VERSION_MISMATCH   |
| CMS-03B-01            | changedPaths                           | 1–128 unique JSON Pointers, each 1–256 chars, bound to stable field/block/relation IDs                                                                                                                                                                                                                                           | 422                           |
| CMS-03B-01            | values                                 | strict object keyed by stable field IDs; max 128 keys/8 levels/256 KiB; rich text is structured AST                                                                                                                                                                                                                              | 422                           |
| CMS-03B-01            | locale / expectedVersion               | BCP 47 2–35 chars; positive decimal entry version                                                                                                                                                                                                                                                                                | 422 or 409                    |
| CMS-03B-02            | conflictId                             | UUID; the single durable open conflict record on the same entry                                                                                                                                                                                                                                                                  | 400/404/409                   |
| CMS-03B-02            | choices                                | 1–128 strict { path, choice: base, theirs, yours, or explicit, value? } with unique paths; explicit value must validate current schema, while a named choice (base/theirs/yours) must omit value rather than smuggle an ignored replacement                                                                                      | 422                           |
| CMS-03B-02            | ConflictRecord invariant (server)      | server-loaded ConflictRecord, not a request field (request is { entryId, conflictId, baseRevision, choices, expectedVersion }); `revision` requires a stored yoursRevisionId and `proposed` requires bounded proposedValues (≤128 keys/≤8 levels/≤256 KiB) plus a 64-hex hash                                                    | not a 422; server 500         |
| CMS-03B-03            | cursor/limit                           | signed context-bound cursor ≤512 chars; limit integer 1–50 default 25; cursor expires ≤24h                                                                                                                                                                                                                                       | 400                           |
| CMS-03B-03            | compareRevisionId/locale               | UUID optional; BCP 47 optional; both revisions must be readable                                                                                                                                                                                                                                                                  | 400/404                       |
| CMS-03B-04            | revisionId/migrationChainId            | UUIDs; source revision immutable and chain covers source schema to current active schema                                                                                                                                                                                                                                         | 422/409                       |
| CMS-03B-05            | frozenHash                             | exactly 64 lowercase hex; must equal normalized revision hash                                                                                                                                                                                                                                                                    | 422/409                       |
| CMS-03B-05            | dependencyManifest                     | strict IDs/hashes for schema/template/blocks/patterns/terms/locale/settings/relations/checkers; schema includes active 03a content-type-version id/hash, SchemaArtifact id/hash/compiler/contract, non-null activation evidence, protected validator refs, and frozen editorial workflow-policy evidence; max 256 entries/32 KiB | 422                           |
| CMS-03B-05            | riskClass                              | derived from the frozen workflow-policy evidence; protected requires its policy-defined two-person workflow                                                                                                                                                                                                                      | 422                           |
| CMS-03B-06            | decision/reason                        | approve or reject; reason 1–2000 safe Unicode chars                                                                                                                                                                                                                                                                              | 422                           |
| CMS-03B-06            | stepUpAt/capability                    | ISO timestamp within configured MFA freshness; named reviewer capability, never caller-selected authority                                                                                                                                                                                                                        | 401/403/422                   |
| CMS-03B-07            | localDateTime/timezone                 | local ISO datetime without offset plus IANA timezone 1–64 chars                                                                                                                                                                                                                                                                  | 422                           |
| CMS-03B-07            | resolvedUtc/tzdbVersion/disambiguation | offset ISO instant, tzdb 1–32 chars, disambiguation earlier/later/none; nonexistent local time rejected                                                                                                                                                                                                                          | 422                           |
| CMS-03B-07            | action                                 | publish, unpublish, expire, or archive                                                                                                                                                                                                                                                                                           | 422                           |
| CMS-03B-08            | versionSet                             | strict exact schema/template/taxonomy/settings/blocks/patterns IDs and hashes; schema includes active 03a content-type-version id/hash, SchemaArtifact id/hash/compiler, non-null activation evidence, protected validator refs, and editorial workflow-policy evidence                                                          | 422; stale set 409            |
| CMS-03B-08            | audience/route                         | audience 1–64 safe chars; route 1–2048 normalized path; no external URL                                                                                                                                                                                                                                                          | 422                           |
| CMS-03B-09            | frozenHash/expectedVersionSet          | 64 lowercase hex and strict version/hash set equal to approved candidate                                                                                                                                                                                                                                                         | 422/409                       |
| CMS-03B-10            | contentTypeId/contentTypeVersionId     | UUIDs resolving to the same active compiled 03a schema with non-null activation evidence, exact SchemaArtifact id/hash/compiler, and protected validator refs; stale or off-registry identity rejects before mutation                                                                                                            | 422/404/403                   |
| CMS-03B-10            | changedPaths/values                    | 1–128 unique JSON Pointers bound to stable field/block/relation IDs; strict object keyed by stable field UUIDs, max 128 keys/8 levels/256 KiB; rich text is structured AST and no executable content                                                                                                                             | 422                           |
| CMS-03B-10            | locale                                 | BCP 47 2–35 chars validated against the active schema locale set                                                                                                                                                                                                                                                                 | 422                           |
| CMS-03B-10            | owner/assignee/authority               | rejected: caller must not supply owner, assignee, author, acting party, capability, or authority; the server derives every one of them                                                                                                                                                                                           | 422                           |
| CMS-03B-10            | headers                                | Idempotency-Key 8–128 printable ASCII; no If-Match for initial create; Content-Type application/json                                                                                                                                                                                                                             | 400 INVALID_REQUEST           |
| CMS-03B-11            | entryId                                | UUID path; must resolve to a readable active ContentEntry and its current readable immutable draft revision                                                                                                                                                                                                                      | 400 or policy-safe 404        |
| All mutation routes   | headers                                | Idempotency-Key 8–128 printable ASCII; exact strong If-Match; Content-Type application/json; CMS-03B-10 is the exception and requires Idempotency-Key without If-Match                                                                                                                                                           | 400 INVALID_REQUEST           |
| All browser responses | state/ownership envelope               | ResourceMeta contains only id, version, and timestamps; EntryRevision, EditorialReview, PublicationSchedule, Publication, and RevisionSummary use their exact closed state enums; ownership and approval authority evidence is absent                                                                                            | 422 response-contract failure |

## Request/Response Contracts (Zod 4 schemas)

Runtime Zod 4 schemas are the source for TypeScript, Hono validation, OpenAPI, tests, and JSONB checks. All objects are strict; unknown keys reject. Values are parsed against the active schema from 03a and are never accepted as untyped pass-through content.

```ts
const Bcp47 = z.string().regex(/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/);
const JsonPointer = z.string().regex(/^\/[^\u0000-\u001f]{0,255}$/);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const SafeText = z
  .string()
  .max(2000)
  .refine((v) => !/[<>{}]/.test(v));
const SchemaArtifactEvidence = z.strictObject({
  id: UUID,
  contentTypeVersionId: UUID,
  artifactHash: Hash,
  compilerVersion: z.string().min(1).max(32),
  zodContractRef: z.string().min(1).max(256),
});
const ValidatorEvidence = z.strictObject({
  key: z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/),
  version: Version,
});
const CapabilityKey = z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/);
const WorkflowPolicyEvidence = z
  .strictObject({
    key: z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/),
    version: Version,
    policyHash: Hash,
    riskClass: z.enum(['ordinary', 'protected']),
    requiredDecisionCount: z.number().int().min(1).max(8),
    requiredCapabilities: z.array(CapabilityKey).max(16),
    // Decision-independent approval-basis digest (see approvalEvidenceHash).
    approvalEvidenceHash: Hash,
  })
  .superRefine((value, ctx) => {
    if (
      value.riskClass === 'protected' &&
      value.requiredCapabilities.length < 1
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_small,
        minimum: 1,
        inclusive: true,
        origin: 'array',
        path: ['requiredCapabilities'],
        message: 'Protected workflow policy requires nonempty capabilities',
      });
    }
    if (value.riskClass === 'protected' && value.requiredDecisionCount < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_small,
        minimum: 2,
        inclusive: true,
        origin: 'number',
        path: ['requiredDecisionCount'],
        message: 'Protected workflow policy requires at least two decisions',
      });
    }
  });
const ChangedPaths = z
  .array(JsonPointer)
  .min(1)
  .max(128)
  .superRefine((paths, ctx) => {
    if (new Set(paths).size !== paths.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'changedPaths must contain unique JSON Pointers',
      });
    }
  });
const BoundedEntryValues = z
  .record(z.string().uuid(), Json)
  .superRefine((value, ctx) => {
    if (Object.keys(value).length > 128) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 128,
        inclusive: true,
        origin: 'record',
        message: 'values permits at most 128 keys',
      });
    }
    if (jsonDepth(value) > 8) {
      ctx.addIssue({
        code: 'custom',
        message: 'values JSON depth must be at most 8',
      });
    }
  });
const VersionSet = z.strictObject({
  schemaVersionId: UUID,
  schemaHash: Hash,
  schemaArtifact: SchemaArtifactEvidence,
  validatorRefs: z.array(ValidatorEvidence).max(128),
  workflowPolicy: WorkflowPolicyEvidence,
  activationEvidence: WorkflowPolicyEvidence,
  templateVersionId: UUID.nullable(),
  templateHash: Hash.nullable(),
  taxonomyVersionIds: z.array(UUID).max(64),
  blockVersionIds: z.array(UUID).max(128),
  patternVersionIds: z.array(UUID).max(128),
  settingsVersion: Version,
  compilerVersion: z.string().min(1).max(32),
});
const DependencyManifest = z.strictObject({
  schema: z.strictObject({
    id: UUID,
    hash: Hash,
    schemaArtifact: SchemaArtifactEvidence,
    validatorRefs: z.array(ValidatorEvidence).max(128),
    workflowPolicy: WorkflowPolicyEvidence,
    activationEvidence: WorkflowPolicyEvidence,
  }),
  template: z.strictObject({ id: UUID, hash: Hash }).nullable(),
  blocks: z.array(z.strictObject({ id: UUID, hash: Hash })).max(128),
  patterns: z.array(z.strictObject({ id: UUID, hash: Hash })).max(128),
  terms: z.array(z.strictObject({ id: UUID, hash: Hash })).max(256),
  localeSources: z
    .array(z.strictObject({ locale: Bcp47, revisionId: UUID, hash: Hash }))
    .max(32),
  settings: z.strictObject({ version: Version, hash: Hash }),
  relations: z
    .array(
      z.strictObject({ fieldId: UUID, targetId: UUID, targetVersion: Version }),
    )
    .max(128),
  checker: z.strictObject({ key: z.string().min(1).max(64), version: Version }),
});
const EntryRevisionRequest = z.strictObject({
  entryId: UUID,
  baseRevision: Version,
  changedPaths: ChangedPaths,
  values: BoundedEntryValues,
  locale: Bcp47,
  expectedVersion: Version,
});
const ConflictChoice = z
  .strictObject({
    path: JsonPointer,
    choice: z.enum(['base', 'theirs', 'yours', 'explicit']),
    value: Json.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.choice === 'explicit' && v.value === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'explicit choice requires value',
      });
    }
    if (v.choice !== 'explicit' && v.value !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'named choice forbids value',
      });
    }
  });
const ConflictResolutionRequest = z.strictObject({
  entryId: UUID,
  conflictId: UUID,
  baseRevision: Version,
  choices: z.array(ConflictChoice).min(1).max(128),
  expectedVersion: Version,
});
const RevisionHistoryQuery = z.strictObject({
  entryId: UUID,
  cursor: z.string().max(512).nullable().optional(),
  limit: z.number().int().min(1).max(50).default(25),
  state: z
    .enum([
      'draft',
      'submitted',
      'approved',
      'rejected',
      'scheduled',
      'published',
    ])
    .optional(),
  compareRevisionId: UUID.optional(),
  locale: Bcp47.optional(),
});
const RevisionRestoreRequest = z.strictObject({
  entryId: UUID,
  revisionId: UUID,
  migrationChainId: UUID,
  expectedVersion: Version,
});
const ReviewSubmissionRequest = z.strictObject({
  entryId: UUID,
  revisionId: UUID,
  frozenHash: Hash,
  dependencyManifest: DependencyManifest,
});
const EditorialDecisionRequest = z.strictObject({
  reviewId: UUID,
  decision: z.enum(['approve', 'reject']),
  reason: SafeText.min(1),
  capability: z.string().min(1).max(128),
  expectedVersion: Version,
  stepUpAt: z.string().datetime({ offset: true }).nullable(),
});
const PublicationScheduleRequest = z.strictObject({
  revisionId: UUID,
  action: z.enum(['publish', 'unpublish', 'expire', 'archive']),
  localDateTime: z.string().datetime({ offset: false }),
  timezone: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_+.-]+\/[A-Za-z0-9_+.-]+$/),
  resolvedUtc: z.string().datetime({ offset: true }),
  tzdbVersion: z.string().min(1).max(32),
  disambiguation: z.enum(['none', 'earlier', 'later']),
  expectedVersion: Version,
});
const PreviewRequest = z.strictObject({
  entryId: UUID,
  revisionId: UUID,
  locale: Bcp47,
  audience: z.string().min(1).max(64),
  route: z.string().regex(/^\/[^\u0000-\u001f]{0,2047}$/),
  versionSet: VersionSet,
});
const PublicationRequest = z.strictObject({
  entryId: UUID,
  revisionId: UUID,
  frozenHash: Hash,
  expectedVersionSet: VersionSet,
  expectedVersion: Version,
});
```

`DependencyManifest.relations` is evidence, not caller authority. Each entry is
resolved by 03a's immutable `RelationDefinition` for the field and schema
version; 03b re-reads its `targetKind`, `targetType`, `projectionKey`,
`cardinality`, `min`, `max`, `ordered`, and `onUnavailable` (`omit`, `block`, or
`placeholder`) before review, restore, preview, and publication. Caller-supplied
relation metadata cannot override the registry definition.

When `onUnavailable` is `placeholder`, every deleted, private, embargoed, or
concealed target resolves to the same fixed opaque object
`{status:'unavailable',reason:'unavailable'}`. It contains no target ID,
type, key, title, data, or existence distinction. This fallback is applied
server-side for every authoring, history, restore, review, preview, schedule,
publication, and downstream relation projection and never varies by target
state, caller, or endpoint. `omit` and `block` use the same target-concealing
policy: omit has no target-dependent response detail, and block returns only a
generic unavailable outcome. The registry's immutable `onUnavailable` value is
the sole behavior selector; request metadata cannot select a target or fallback.

`schemaHash` identifies the normalized content-type definition; `schemaArtifact`
identifies the immutable compiled artifact. Its `compilerVersion` MUST equal the
`VersionSet.compilerVersion`, and its `contentTypeVersionId` MUST equal the
`VersionSet.schemaVersionId`. `DependencyManifest.schema.id` is the same active
03a `ContentTypeVersion.id` as `VersionSet.schemaVersionId`, and
`DependencyManifest.schema.hash` is the same normalized definition hash as
`VersionSet.schemaHash`. `activationEvidence` is the non-null server result from
03a `ContentTypeVersionResource.activationEvidence`; every key, version,
`policyHash`, `requiredCapabilities`, decision count, risk class, and
`approvalEvidenceHash` is re-fetched and compared before save, review, restore,
preview, schedule execution, and publication. The artifact hash, activation
evidence, protected validator references, and editorial workflow-policy snapshot
are all included in the frozen dependency hash.

The editorial workflow policy evidence includes its immutable `key`, `version`,
`policyHash`, `requiredDecisionCount` (1–8), `requiredCapabilities`, and
server-computed `approvalEvidenceHash`; approval IDs remain request references
only. The server resolves distinct humans, capabilities, and recent MFA and
binds that evidence atomically to the review/decision. A protected workflow
requires at least two recorded decisions; caller-supplied owner, capability,
approval, activation, or other authority metadata is never trusted.

`approvalEvidenceHash` on the editorial `WorkflowPolicyEvidence` is a
decision-independent approval-basis digest, so it exists and is identical from
entry bootstrap onward, when no editorial decision can yet exist. It is the
lowercase SHA-256 hex of the RFC 8785/JCS canonical JSON of
`{ "activationApprovalEvidenceHash": <the bound content-type version's frozen
03a activation approval evidence hash>, "policyHash": <the bound policy member's
policyHash>, "schemaVersionId": <the entry's active ContentTypeVersion id> }`.
It binds the editorial rule set to the exact schema approval that activated the
version and contains no editorial decision, assignment, entry, revision,
reviewer or caller input, so it is the same for every entry and revision of that
content-type version. `cms_create_entry` and CMS-03B-01 compare the request's
`workflowPolicy`, including this hash, to the server value and refuse a
mismatch. CMS-03B-05 freezes the value as
`cms_editorial_reviews.approval_evidence_hash`, and each decision is bound to the
review's exact policy, this hash and its `reviewed_hash`. Approval progress is
carried only by `recordedDecisionCount` and the append-only decision rows, never
by this hash, and the hash is not an assertion that any editorial approval has
occurred. It is distinct from 03a `SchemaReviewResource.approvalEvidenceHash`, a
digest of the approved schema review's sorted decisions that is the
`activationEvidence.approvalEvidenceHash` consumed above.

Success resources are strict, hash/version aware, and expose only data authorized for the caller:

```ts
const EntryRevisionState = z.enum([
  'draft',
  'submitted',
  'approved',
  'rejected',
  'scheduled',
  'published',
]);
const EditorialReviewState = z.enum([
  'open',
  'approved',
  'rejected',
  'invalidated',
]);
const PublicationScheduleState = z.enum([
  'pending',
  'executing',
  'completed',
  'failed_retryable',
  'blocked',
  'cancelled',
]);
const PublicationState = z.enum(['active', 'superseded', 'revoked', 'pending']);
const ResourceMeta = z.strictObject({
  id: UUID,
  version: Version,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
const EntryRevisionResource = ResourceMeta.extend({
  state: EntryRevisionState,
  entryId: UUID,
  revisionNumber: Version,
  schemaVersionId: UUID,
  templateVersionId: UUID.nullable(),
  taxonomyVersionIds: z.array(UUID).max(64),
  locale: Bcp47,
  contentHash: Hash,
  parentRevisionIds: z.array(UUID).max(2),
  validationState: z.enum(['valid', 'invalid', 'unknown']),
  conflictId: UUID.nullable(),
});
const ConflictRecordState = z.enum(['open', 'resolved', 'superseded']);
const ConflictYoursSource = z.enum(['revision', 'proposed']);
const jsonBytes = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).length;
const BoundedProposedValues = z
  .record(z.string(), Json)
  .superRefine((value, ctx) => {
    if (Object.keys(value).length > 128) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 128,
        inclusive: true,
        origin: 'object',
        path: [],
        message: 'proposedValues exceeds 128 top-level keys',
      });
    }
    if (jsonDepth(value) > 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 8,
        inclusive: true,
        origin: 'object',
        path: [],
        message: 'proposedValues exceeds 8 levels',
      });
    }
    if (jsonBytes(value) > 262144) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 262144,
        inclusive: true,
        origin: 'string',
        path: [],
        message: 'proposedValues exceeds 256 KiB',
      });
    }
  });
const ConflictRecordResource = ResourceMeta.extend({
  state: ConflictRecordState,
  entryId: UUID,
  baseRevisionId: UUID,
  theirsRevisionId: UUID,
  yoursRevisionId: UUID.nullable(),
  yoursSource: ConflictYoursSource,
  proposedValues: BoundedProposedValues.nullable(),
  proposedValuesHash: Hash.nullable(),
  changedPaths: z.array(JsonPointer).min(1).max(128),
  baseHash: Hash,
  theirsHash: Hash,
  yoursHash: Hash,
  conflictHash: Hash,
  resolvedRevisionId: UUID.nullable(),
  resolvedByPersonId: UUID.nullable(),
  resolvedAt: z.string().datetime({ offset: true }).nullable(),
}).superRefine((value, ctx) => {
  const revisionBound =
    value.yoursSource === 'revision' &&
    value.yoursRevisionId !== null &&
    value.proposedValues === null &&
    value.proposedValuesHash === null;
  const proposedBound =
    value.yoursSource === 'proposed' &&
    value.yoursRevisionId === null &&
    value.proposedValues !== null &&
    value.proposedValuesHash !== null;
  if (!revisionBound && !proposedBound) {
    ctx.addIssue({
      code: 'custom',
      path: ['yoursSource'],
      message:
        'yoursSource must bind to exactly one of yoursRevisionId or bounded proposedValues/hash',
    });
  }
  const resolvedNull =
    value.resolvedRevisionId === null &&
    value.resolvedByPersonId === null &&
    value.resolvedAt === null;
  const resolvedBound =
    value.resolvedRevisionId !== null &&
    value.resolvedByPersonId !== null &&
    value.resolvedAt !== null;
  if (value.state === 'resolved' ? !resolvedBound : !resolvedNull) {
    ctx.addIssue({
      code: 'custom',
      path: ['state'],
      message:
        'resolved requires resolvedRevisionId/resolvedByPersonId/resolvedAt; open/superseded require all null',
    });
  }
});
const EditorialReviewResource = ResourceMeta.extend({
  state: EditorialReviewState,
  revisionId: UUID,
  riskClass: z.enum(['ordinary', 'protected']),
  workflowPolicy: WorkflowPolicyEvidence,
  activationEvidence: WorkflowPolicyEvidence,
  frozenHash: Hash,
  requiredDecisionCount: z.number().int().min(1).max(8),
  recordedDecisionCount: z.number().int().min(0).max(8),
  dependencyHash: Hash,
  invalidatedReason: z.string().max(128).nullable(),
}).superRefine((value, ctx) => {
  if (value.recordedDecisionCount > value.requiredDecisionCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_big,
      maximum: value.requiredDecisionCount,
      inclusive: true,
      origin: 'number',
      path: ['recordedDecisionCount'],
      message: 'Recorded decisions cannot exceed required decisions',
    });
  }
  if (value.riskClass === 'protected' && value.requiredDecisionCount < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.too_small,
      minimum: 2,
      inclusive: true,
      origin: 'number',
      path: ['requiredDecisionCount'],
      message: 'Protected review requires at least two decisions',
    });
  }
  if (
    value.requiredDecisionCount !== value.workflowPolicy.requiredDecisionCount
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['requiredDecisionCount'],
      message: 'Review count must equal the frozen workflow policy count',
    });
  }
  if (value.riskClass !== value.workflowPolicy.riskClass) {
    ctx.addIssue({
      code: 'custom',
      path: ['riskClass'],
      message: 'Review risk class must equal the frozen workflow policy class',
    });
  }
});
const PublicationScheduleResource = ResourceMeta.extend({
  state: PublicationScheduleState,
  entryId: UUID,
  revisionId: UUID,
  action: z.enum(['publish', 'unpublish', 'expire', 'archive']),
  localDateTime: z.string().datetime({ offset: false }),
  timezone: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_+.-]+\/[A-Za-z0-9_+.-]+$/),
  resolvedUtc: z.string().datetime({ offset: true }),
  tzdbVersion: z.string().regex(/^[A-Za-z0-9._-]{1,32}$/),
  jobId: UUID.nullable(),
  actualUtc: z.string().datetime({ offset: true }).nullable(),
  deviationSeconds: z.number().int().nullable(),
});
const PreviewTokenResource = z.strictObject({
  token: z.string().min(43).max(512),
  expiresAt: z.string().datetime({ offset: true }),
  entryId: UUID,
  revisionId: UUID,
  locale: Bcp47,
  audience: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9._-]{0,63}$/),
  route: z.string().regex(/^\/[^\u0000-\u001f]{0,2047}$/),
  versionSet: VersionSet,
  revoked: z.boolean(),
});
const PublicationResource = ResourceMeta.extend({
  state: PublicationState,
  publicationVersionId: UUID,
  entryId: UUID,
  revisionId: UUID,
  locale: Bcp47,
  audience: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9._-]{0,63}$/),
  publicationHash: Hash,
  projectionState: z.enum(['pending', 'converged', 'degraded']),
  eventType: z.literal('cms.publication.changed.v1'),
});
const RevisionSummary = z.strictObject({
  id: UUID,
  revisionNumber: Version,
  locale: Bcp47,
  state: EntryRevisionState,
  contentHash: Hash,
  createdAt: z.string().datetime({ offset: true }),
  authorClass: z.string().min(1).max(64),
});
const RevisionHistoryPage = z.strictObject({
  items: z.array(RevisionSummary).max(50),
  nextCursor: z.string().max(512).nullable(),
  pageVersion: Version,
  compare: z
    .strictObject({
      leftRevisionId: UUID,
      rightRevisionId: UUID,
      changes: z
        .array(
          z.strictObject({
            path: JsonPointer,
            kind: z.enum(['added', 'removed', 'changed', 'unchanged']),
            leftHash: Hash.nullable(),
            rightHash: Hash.nullable(),
          }),
        )
        .max(512),
    })
    .nullable(),
});
const EntryCreateRequest = z.strictObject({
  contentTypeId: UUID,
  contentTypeVersionId: UUID,
  locale: Bcp47,
  changedPaths: ChangedPaths,
  values: BoundedEntryValues,
  schemaArtifact: SchemaArtifactEvidence,
  validatorRefs: z.array(ValidatorEvidence).max(128),
  workflowPolicy: WorkflowPolicyEvidence,
  activationEvidence: WorkflowPolicyEvidence,
});
const EntryCreateResource = z.strictObject({
  entry: ResourceMeta,
  revision: ResourceMeta,
  revisionNumber: Version,
  lifecycle: z.enum(['active', 'archived', 'deletion_pending', 'held']),
  state: EntryRevisionState,
  locale: Bcp47,
  contentHash: Hash,
  validationState: z.enum(['valid', 'invalid', 'unknown']),
});
const EntryDraftDetailQuery = z.strictObject({
  entryId: UUID,
  locale: Bcp47.optional(),
});
const EntryDraftFieldValue = z.strictObject({
  fieldId: UUID,
  fieldDefinitionId: UUID,
  locale: Bcp47,
  value: Json.nullable(),
  provenance: z.enum([
    'authored',
    'default',
    'inherited',
    'localized_fallback',
    'explicit_null',
    'missing',
  ]),
  valueHash: Hash.nullable(),
});
const EntryDraftRelation = z.strictObject({
  fieldId: UUID,
  fieldDefinitionId: UUID,
  targetKind: z.string().regex(/^[a-z][a-z0-9._-]{0,95}$/),
  targetId: UUID,
  expectedTargetVersion: Version.nullable(),
  position: z.number().int().min(0).max(511),
  onUnavailable: z.enum(['omit', 'block', 'placeholder']),
  unavailable: z
    .strictObject({
      status: z.literal('unavailable'),
      reason: z.literal('unavailable'),
    })
    .nullable(),
});
const EntryDraftDetailResource = z.strictObject({
  entry: ResourceMeta,
  revision: ResourceMeta,
  lifecycle: z.enum(['active', 'archived', 'deletion_pending', 'held']),
  state: EntryRevisionState,
  locale: Bcp47,
  contentHash: Hash,
  validationState: z.enum(['valid', 'invalid', 'unknown']),
  fields: z.array(EntryDraftFieldValue).max(128),
  relations: z.array(EntryDraftRelation).max(512),
});
```

### Contract and error matrix

| Operation ID | 400                             | 401                            | 403                        | 404                          | 409                                                         | 415                       | 422                            | 429                  | 502/503/504              | 500               |
| ------------ | ------------------------------- | ------------------------------ | -------------------------- | ---------------------------- | ----------------------------------------------------------- | ------------------------- | ------------------------------ | -------------------- | ------------------------ | ----------------- |
| CMS-03B-01   | malformed path/header/body      | missing/expired session        | assignment/edit capability | hidden/absent entry          | stale base/version, conflict, idempotency                   | non-JSON                  | field/schema/value failure     | author-write limit   | schema/RPC deadline      | scrubbed internal |
| CMS-03B-02   | malformed IDs/header/body       | missing/expired session        | resolve capability         | hidden/absent conflict       | base moved, invalid choice, idempotency                     | non-JSON                  | choice/value schema            | conflict-write limit | RPC deadline             | scrubbed internal |
| CMS-03B-03   | malformed path/query/cursor     | missing/expired session        | read scope                 | hidden/absent entry/revision | cursor/context mismatch                                     | unsupported media if sent | query bounds                   | read limit           | read dependency/deadline | scrubbed internal |
| CMS-03B-04   | malformed IDs/header/body       | missing/expired session        | edit capability            | hidden/absent revision       | stale version, migration mismatch, idempotency              | non-JSON                  | restore schema                 | restore limit        | migration/RPC deadline   | scrubbed internal |
| CMS-03B-05   | malformed IDs/header/body       | missing/expired session        | submit/assignment          | hidden/absent entry/revision | open review, hash/dependency changed, idempotency           | non-JSON                  | manifest/risk failure          | review-write limit   | preflight/RPC deadline   | scrubbed internal |
| CMS-03B-06   | malformed ID/header/body        | missing/expired or step-up MFA | reviewer/capability        | hidden/absent review         | stale review, duplicate decision, hash invalid, idempotency | non-JSON                  | decision/reason failure        | decision limit       | RPC deadline             | scrubbed internal |
| CMS-03B-07   | malformed IDs/header/body       | missing/expired or step-up MFA | publisher                  | hidden/absent target         | schedule collision/stale version/idempotency                | non-JSON                  | time/tzdb/action failure       | schedule limit       | preflight/RPC deadline   | scrubbed internal |
| CMS-03B-08   | malformed body/path/version set | missing/expired session        | preview capability         | hidden/absent target         | stale version set/idempotency                               | non-JSON                  | route/audience/version failure | preview limit        | schema/RPC deadline      | scrubbed internal |
| CMS-03B-09   | malformed IDs/header/body       | missing/expired or step-up MFA | publisher/review gate      | hidden/absent target         | stale set/hash, invalid state, idempotency                  | non-JSON                  | publication contract           | publish limit        | projection/RPC deadline  | scrubbed internal |
| CMS-03B-10   | malformed header/body           | missing/expired session        | no create capability       | hidden/absent target         | duplicate key, off-registry schema, idempotency             | non-JSON                  | field/schema/value failure     | author-write limit   | schema/RPC deadline      | scrubbed internal |
| CMS-03B-11   | malformed path/query            | missing/expired session        | read scope/assignment      | hidden/absent entry          | not applicable to bounded read                              | unsupported media if sent | response/field bounds          | read limit           | read dependency/deadline | scrubbed internal |

Error details use BE00 allowlists: 400/422 may carry at most 50 JSON-pointer violations; 401 carries only recoveryAction; 403 reasonCode without policy predicates; 404 is empty; 409 may include authorized expected/current version and safe conflict hashes; 429 carries retryAfterSeconds, limit, resetAt; 502/503/504 carries dependencyClass, retryable, and optional retryAfterSeconds; 500 is empty. A denied entry/review/revision cannot be distinguished from absence when the caller lacks read authority.

### Persisted model envelope and exceptions

Every persisted 03b model carries the IA envelope `id: uuid`, `owner_id: uuid`,
`state: closed enum`, `version: bigint`, `created_at: timestamptz`, and
`updated_at: timestamptz`. `owner_id` is the server-resolved owning party or
parent aggregate; it is an ownership reference, never an authority grant, and
is never accepted from caller metadata. Child rows copy the parent-derived
`owner_id` even when a more specific foreign key is present. The physical
`state` column is a closed model-specific union; no free-form status is
permitted.

The only atomically-created aggregate is CMS-03B-10: one transaction inserts the server-derived `ContentEntry` (lifecycle `active`, server-derived version 1, server-derived owner and creator), its first immutable `EntryRevision` draft with normalized values/relations, and the creator's scoped `cms_entry_assignments` row; any failure rolls back all three. The only IA naming exception in this boundary is `ContentEntry.lifecycle`,
which is the physical closed envelope state (`active | archived |
deletion_pending | held`) and is not duplicated by a second mutable state
column. The only timestamp-renewal exception is advisory `EditPresence`: its
named lease renewal RPC may update `lease_until`, `last_seen_at`, its monotonic
`version`, and `updated_at`; renewal never grants write authority. All other
updates use the named state-transition RPCs below. Immutable or append-only
rows set `updated_at = created_at`, reject UPDATE and DELETE, and represent
later changes with a new row/version or an append-only transition record.

| 03b model / table                                 | Closed envelope state and ownership                                                                                                                                                                            | Mutability and exception                                                                                                                                                                                                                                                  |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ContentEntry / cms_content_entries`              | Envelope fields are `id`, `owner_id`, physical `lifecycle` state (`active`, `archived`, `deletion_pending`, `held`), `version`, `created_at`, and `updated_at`; `owner_id` is the resolved entry owner.        | Current-draft pointer, lifecycle, and aggregate `version` change only through an authorized CAS RPC; caller owner fields are ignored.                                                                                                                                     |
| `EntryRevision / cms_entry_revisions`             | Envelope fields are `id`, `owner_id`, `state` (`draft`, `submitted`, `approved`, `rejected`, `scheduled`, `published`), `version`, `created_at`, and `updated_at`; `owner_id` copies the entry owner.          | Immutable snapshot after save; `updated_at = created_at`; workflow transitions are append-only evidence/pointers, never row UPDATE/DELETE.                                                                                                                                |
| `EntryFieldValue / cms_entry_field_values`        | Envelope fields are `id`, `owner_id`, `state` (`active`), `version`, `created_at`, and `updated_at`; `owner_id` copies the revision/entry owner.                                                               | Immutable normalized value snapshot; `version = 1` for the row; `updated_at = created_at`; no UPDATE/DELETE.                                                                                                                                                              |
| `EntryRelation / cms_entry_relations`             | Envelope fields are `id`, `owner_id`, `state` (`active`), `version`, `created_at`, and `updated_at`; `owner_id` copies the revision/entry owner.                                                               | Immutable relation evidence; `version = 1` for the row; `updated_at = created_at`; no UPDATE/DELETE. The registry, not caller metadata, supplies relation behavior.                                                                                                       |
| `EditPresence / cms_edit_presence`                | Envelope fields are `id`, `owner_id`, `state` (`active`, `expired`, `revoked`), `version`, `created_at`, and `updated_at`; `owner_id` copies the entry owner.                                                  | Advisory lease renewal is the sole timestamp/version update exception; it is CAS-guarded and never substitutes for assignment/capability.                                                                                                                                 |
| `EditorialReview / cms_editorial_reviews`         | Envelope fields are `id`, `owner_id`, `state` (`open`, `approved`, `rejected`, `invalidated`), `version`, `created_at`, and `updated_at`; `owner_id` copies the entry owner.                                   | Frozen revision/dependency/policy evidence is immutable. State/count invalidation uses the named review CAS RPC and increments `version`/`updated_at`; no caller authority is copied.                                                                                     |
| `EditorialDecision / cms_editorial_decisions`     | Envelope fields are `id`, `owner_id`, `state` (`recorded`), `version`, `created_at`, and `updated_at`; `owner_id` copies the review/entry owner.                                                               | Append-only decision evidence; `version = 1`, `updated_at = created_at`; no UPDATE/DELETE. Reviewer, capability, acting context, and MFA are server-resolved.                                                                                                             |
| `PublicationSchedule / cms_publication_schedules` | Envelope fields are `id`, `owner_id`, `state` (`pending`, `executing`, `completed`, `failed_retryable`, `blocked`, `cancelled`), `version`, `created_at`, and `updated_at`; `owner_id` copies the entry owner. | Worker/command CAS may advance state and version; schedule identity/evidence is not replaced and caller metadata cannot select the owner.                                                                                                                                 |
| `PublicationVersion / cms_publication_versions`   | Envelope fields are `id`, `owner_id`, `state` (`active`, `superseded`, `revoked`, `pending`), `version`, `created_at`, and `updated_at`; `owner_id` copies the entry owner.                                    | Append-only publication evidence; `version = 1`, `updated_at = created_at`; supersession/revocation is a new state/version or tombstone, never UPDATE/DELETE of prior evidence.                                                                                           |
| `PreviewToken / cms_preview_tokens`               | Envelope fields are `id`, `owner_id`, `state` (`active`, `expired`, `revoked`), `version`, `created_at`, and `updated_at`; `owner_id` copies the entry owner.                                                  | Token hash and binding evidence are immutable; expiry is derived, and revocation is a named CAS transition that cannot reveal token material.                                                                                                                             |
| `EntryAssignment / cms_entry_assignments`         | Envelope fields are `id`, `owner_id`, `state` (`active`, `revoked`), `version`, `created_at`, and `updated_at`; `owner_id` copies the entry owner, and the assignee/capability are server-derived.             | Mutable CAS envelope; assignment authority stays BE01-owned and caller-supplied owner/assignee/authority is never trusted; state and `version` advance only through the named assignment RPC, so there is no blanket `updated_at = created_at`.                           |
| `ConflictRecord / cms_conflict_records`           | Envelope fields are `id`, `owner_id`, `state` (`open`, `resolved`, `superseded`), `version`, `created_at`, and `updated_at`; `owner_id` copies the entry owner.                                                | Mutable CAS envelope written only through `cms_create_revision`/`cms_resolve_conflict`; `cms_resolve_conflict` CAS-closes the open record and increments `version`/`updated_at`, so there is no blanket `updated_at = created_at` (that holds only while `state='open'`). |

## Database Schema

Canonical editorial records live in private Supabase PostgreSQL schemas. Every table below has RLS enabled and forced, direct browser grants revoked, and named RPC access only. Fields intentionally without FKs are code registries, opaque hashes, version snapshots, or JSON manifests; their values are checked against the producer contract and cannot select arbitrary tables or authority.

### Canonical records and fields

| Model / table                                   | Typed fields, nullability, constraints, and FKs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Query indexes and write rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ContentEntry / cms_content_entries              | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; content_type_id uuid NOT NULL REFERENCES cms_content_types(id); owner_party_id uuid NULL REFERENCES platform_private.party(id); lifecycle text NOT NULL CHECK lifecycle IN ('active','archived','deletion_pending','held'); current_draft_revision_id uuid NULL; version bigint NOT NULL CHECK version > 0; created_by uuid NOT NULL REFERENCES auth.users(id); created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(lifecycle IN ('active','archived','deletion_pending','held'));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | INDEX(owner_id,updated_at DESC); INDEX(owner_party_id,lifecycle,updated_at DESC); INDEX(content_type_id,lifecycle); UNIQUE(id,version). `lifecycle` is the physical closed envelope state per the IA exception; current_draft_revision_id is FK to cms_entry_revisions(id) added after table creation. Named RPC/CAS only; owner_id/created_by are server-derived and caller metadata is ignored.                                                                                                                                                                         |
| EntryRevision / cms_entry_revisions             | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; entry_id uuid NOT NULL REFERENCES cms_content_entries(id); revision_number bigint NOT NULL CHECK revision_number > 0; schema_version_id uuid NOT NULL REFERENCES cms_content_type_versions(id); template_version_id uuid NULL CHECK (template_version_id IS NULL OR platform_private.cms_template_registry_valid(template_version_id)); taxonomy_version_ids jsonb NOT NULL CHECK jsonb_typeof(taxonomy_version_ids)='array'; parent_revision_ids jsonb NOT NULL CHECK jsonb_typeof(parent_revision_ids)='array' AND jsonb_array_length(parent_revision_ids) <= 2; locale text NOT NULL CHECK locale ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'; payload_hash char(64) NOT NULL CHECK payload_hash ~ '^[a-f0-9]{64}$'; author_person_id uuid NOT NULL REFERENCES platform_private.person_party(party_id); acting_party_id uuid NULL REFERENCES platform_private.party(id); state text NOT NULL CHECK state IN ('draft','submitted','approved','rejected','scheduled','published'); version bigint NOT NULL CHECK version > 0; validation_state text NOT NULL CHECK validation_state IN ('valid','invalid','unknown'); validation_report jsonb NOT NULL CHECK jsonb_typeof(validation_report)='object'; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(updated_at = created_at);                                                                                                                                                                                                                                                                                                                                                                                                                                                | UNIQUE(entry_id,revision_number,locale); INDEX(owner_id,updated_at DESC); INDEX(entry_id,locale,revision_number DESC); INDEX(entry_id,state,updated_at DESC); INDEX(schema_version_id); immutable append-only snapshot after save; `updated_at = created_at`; UPDATE/DELETE rejected; workflow transitions are append-only evidence/pointers.                                                                                                                                                                                                                             |
| EntryFieldValue / cms_entry_field_values        | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state IN ('active'); version bigint NOT NULL DEFAULT 1 CHECK version > 0; revision_id uuid NOT NULL REFERENCES cms_entry_revisions(id); field_id uuid NOT NULL; field_definition_id uuid NOT NULL REFERENCES cms_field_definition_versions(id); locale text NOT NULL CHECK locale ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'; value jsonb NULL; provenance text NOT NULL CHECK provenance IN ('authored','default','inherited','localized_fallback','explicit_null','missing'); value_hash char(64) NULL CHECK value_hash IS NULL OR value_hash ~ '^[a-f0-9]{64}$'; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(updated_at = created_at); UNIQUE(revision_id,field_id,locale); UNIQUE(revision_id,field_definition_id,locale).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | INDEX(owner_id,updated_at DESC); INDEX(revision_id,locale); INDEX(field_id,locale); owner_id is copied from the revision/entry; field_id is the stable UUID and field_definition_id is the versioned FK; immutable normalized snapshot, `updated_at = created_at`, UPDATE/DELETE rejected; value is validated by schema version and may be null only with explicit_null/missing provenance.                                                                                                                                                                               |
| EntryRelation / cms_entry_relations             | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state IN ('active'); version bigint NOT NULL DEFAULT 1 CHECK version > 0; revision_id uuid NOT NULL REFERENCES cms_entry_revisions(id); field_id uuid NOT NULL; field_definition_id uuid NOT NULL REFERENCES cms_field_definition_versions(id); target_kind text NOT NULL CHECK target_kind ~ '^[a-z][a-z0-9._-]{0,95}$'; target_id uuid NOT NULL; expected_target_version bigint NULL CHECK expected_target_version > 0; position integer NOT NULL CHECK position >= 0 AND position < 512; on_unavailable text NOT NULL CHECK on_unavailable IN ('omit','block','placeholder'); created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(updated_at = created_at);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | UNIQUE(revision_id,field_id,target_kind,target_id); INDEX(owner_id,updated_at DESC); INDEX(revision_id,field_id,position); INDEX(target_kind,target_id); owner_id is copied from the revision/entry; immutable relation evidence, `updated_at = created_at`, UPDATE/DELETE rejected; target_id has no cross-domain FK by design; immutable 03a RelationDefinition resolves target type/projection, cardinality, min/max, ordered, and unavailable behavior (including placeholder) before this row is accepted or projected; caller relation metadata cannot override it. |
| EditorialReview / cms_editorial_reviews         | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; revision_id uuid NOT NULL REFERENCES cms_entry_revisions(id); state text NOT NULL CHECK state IN ('open','approved','rejected','invalidated'); version bigint NOT NULL CHECK version > 0; risk_class text NOT NULL CHECK risk_class IN ('ordinary','protected'); frozen_hash char(64) NOT NULL CHECK frozen_hash ~ '^[a-f0-9]{64}$'; dependency_manifest jsonb NOT NULL CHECK jsonb_typeof(dependency_manifest)='object'; dependency_hash char(64) NOT NULL CHECK dependency_hash ~ '^[a-f0-9]{64}$'; activation_evidence jsonb NOT NULL CHECK jsonb_typeof(activation_evidence)='object'; workflow_policy_key text NOT NULL CHECK workflow_policy_key ~ '^[a-z][a-z0-9._-]{0,127}$'; workflow_policy_version bigint NOT NULL CHECK workflow_policy_version > 0; workflow_policy_hash char(64) NOT NULL CHECK workflow_policy_hash ~ '^[a-f0-9]{64}$'; required_capabilities jsonb NOT NULL CHECK jsonb_typeof(required_capabilities)='array' AND jsonb_array_length(required_capabilities) BETWEEN 1 AND 16; required_decision_count smallint NOT NULL CHECK required_decision_count BETWEEN 1 AND 8; recorded_decision_count smallint NOT NULL DEFAULT 0 CHECK recorded_decision_count BETWEEN 0 AND 8 AND recorded_decision_count <= required_decision_count; approval_evidence_hash char(64) NOT NULL CHECK approval_evidence_hash ~ '^[a-f0-9]{64}$'; submitted_by uuid NOT NULL REFERENCES platform_private.person_party(party_id); submitted_at timestamptz NOT NULL DEFAULT now(); invalidated_reason text NULL; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK((risk_class <> 'protected') OR required_decision_count >= 2); CHECK((risk_class <> 'protected') OR jsonb_array_length(required_capabilities) >= 1); | UNIQUE(revision_id) WHERE state IN ('open','approved'); INDEX(owner_id,state,updated_at DESC); INDEX(revision_id,state); Frozen revision, dependency, activation, and workflow-policy evidence is immutable; only named review CAS RPC may advance state/count/version and updated_at; server resolves policy/capabilities/distinct humans/MFA and rejects caller authority.                                                                                                                                                                                              |
| EditorialDecision / cms_editorial_decisions     | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state IN ('recorded'); version bigint NOT NULL DEFAULT 1 CHECK version > 0; review_id uuid NOT NULL REFERENCES cms_editorial_reviews(id); reviewer_person_id uuid NOT NULL REFERENCES platform_private.person_party(party_id); acting_party_id uuid NULL REFERENCES platform_private.party(id); capability text NOT NULL CHECK octet_length(capability) BETWEEN 1 AND 128; decision text NOT NULL CHECK decision IN ('approve','reject'); reason text NOT NULL CHECK octet_length(reason) BETWEEN 1 AND 2000; comment_hash char(64) NULL CHECK comment_hash IS NULL OR comment_hash ~ '^[a-f0-9]{64}$'; reviewed_hash char(64) NOT NULL CHECK reviewed_hash ~ '^[a-f0-9]{64}$'; step_up_at timestamptz NULL; decided_at timestamptz NOT NULL DEFAULT now(); created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(updated_at = created_at);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | UNIQUE(review_id,reviewer_person_id); INDEX(owner_id,updated_at DESC); INDEX(review_id,decided_at); INDEX(reviewer_person_id,decided_at DESC). Append-only decision evidence; `updated_at = created_at`; UPDATE/DELETE rejected; server verifies reviewer distinctness, capability, acting context, MFA freshness, and binding to the review's exact policy/approval evidence.                                                                                                                                                                                            |
| PublicationSchedule / cms_publication_schedules | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; entry_id uuid NOT NULL REFERENCES cms_content_entries(id); revision_id uuid NOT NULL REFERENCES cms_entry_revisions(id); dependency_hash char(64) NOT NULL CHECK dependency_hash ~ '^[a-f0-9]{64}$'; activation_evidence_hash char(64) NOT NULL CHECK activation_evidence_hash ~ '^[a-f0-9]{64}$'; action text NOT NULL CHECK action IN ('publish','unpublish','expire','archive'); local_datetime timestamp NOT NULL; timezone text NOT NULL CHECK octet_length(timezone) BETWEEN 1 AND 64; resolved_at_utc timestamptz NOT NULL; tzdb_version text NOT NULL CHECK octet_length(tzdb_version) BETWEEN 1 AND 32; disambiguation text NOT NULL CHECK disambiguation IN ('none','earlier','later'); state text NOT NULL CHECK state IN ('pending','executing','completed','failed_retryable','blocked','cancelled'); job_id uuid NULL; expected_version bigint NOT NULL CHECK expected_version > 0; actual_at_utc timestamptz NULL; deviation_seconds bigint NULL; version bigint NOT NULL CHECK version > 0; created_by uuid NOT NULL REFERENCES platform_private.person_party(party_id); created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now();                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | UNIQUE(entry_id,revision_id,action,local_datetime,timezone); INDEX(owner_id,state,updated_at DESC); INDEX(state,resolved_at_utc); INDEX(entry_id,state,resolved_at_utc); worker/command CAS on state/version; owner_id/created_by are server-derived; exact approved revision, activation/dependency evidence, and relation visibility rechecked at execution.                                                                                                                                                                                                            |

### Support records required by the IA algorithms

| Support record / table                        | Typed fields, nullability, constraints, and FKs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Query indexes and write rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PublicationVersion / cms_publication_versions | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state IN ('active','superseded','revoked','pending'); version bigint NOT NULL DEFAULT 1 CHECK version > 0; entry_id uuid NOT NULL REFERENCES cms_content_entries(id); revision_id uuid NOT NULL REFERENCES cms_entry_revisions(id); dependency_hash char(64) NOT NULL CHECK dependency_hash ~ '^[a-f0-9]{64}$'; activation_evidence_hash char(64) NOT NULL CHECK activation_evidence_hash ~ '^[a-f0-9]{64}$'; schema_artifact_id uuid NOT NULL; schema_artifact_hash char(64) NOT NULL CHECK schema_artifact_hash ~ '^[a-f0-9]{64}$'; version_set jsonb NOT NULL CHECK jsonb_typeof(version_set)='object'; schema_version_id uuid NOT NULL REFERENCES cms_content_type_versions(id); template_version_id uuid NULL CHECK (template_version_id IS NULL OR platform_private.cms_template_registry_valid(template_version_id)); taxonomy_version_ids jsonb NOT NULL CHECK jsonb_typeof(taxonomy_version_ids)='array'; settings_version bigint NOT NULL CHECK settings_version > 0; locale text NOT NULL CHECK locale ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'; audience text NOT NULL CHECK octet_length(audience) BETWEEN 1 AND 64; publication_hash char(64) NOT NULL CHECK publication_hash ~ '^[a-f0-9]{64}$'; activated_at timestamptz NULL; revoked_at timestamptz NULL; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(updated_at = created_at);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | UNIQUE(entry_id,locale,audience) WHERE state='active'; INDEX(owner_id,updated_at DESC); INDEX(entry_id,locale,audience,state); INDEX(revision_id); append-only publication evidence; `updated_at = created_at`; UPDATE/DELETE rejected; supersession/revocation is represented by a new immutable state/version or tombstone and writes cms.publication.changed.v1 atomically.                                                                                                                                                                                                                                                                                                                       |
| PreviewToken / cms_preview_tokens             | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state IN ('active','expired','revoked'); version bigint NOT NULL DEFAULT 1 CHECK version > 0; token_hash char(64) NOT NULL UNIQUE CHECK token_hash ~ '^[a-f0-9]{64}$'; entry_id uuid NOT NULL REFERENCES cms_content_entries(id); revision_id uuid NOT NULL REFERENCES cms_entry_revisions(id); user_id uuid NOT NULL REFERENCES auth.users(id); acting_party_id uuid NULL REFERENCES platform_private.party(id); capability_snapshot_hash char(64) NOT NULL CHECK capability_snapshot_hash ~ '^[a-f0-9]{64}$'; version_set jsonb NOT NULL CHECK jsonb_typeof(version_set)='object'; locale text NOT NULL CHECK locale ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'; audience text NOT NULL CHECK octet_length(audience) BETWEEN 1 AND 64; route text NOT NULL CHECK route ~ '^/[^\u0000-\u001f]{0,2047}$'; expires_at timestamptz NOT NULL; nonce uuid NOT NULL; revoked_at timestamptz NULL; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now();                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | INDEX(owner_id,updated_at DESC); INDEX(entry_id,revision_id,expires_at); INDEX(user_id,expires_at); INDEX(expires_at) WHERE revoked_at IS NULL. Token plaintext never persists; token/binding evidence is immutable; expiry is derived, and named CAS revocation may advance state/version/updated_at without exposing token material; caller owner/acting metadata is ignored.                                                                                                                                                                                                                                                                                                                      |
| EditPresence / cms_edit_presence              | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state IN ('active','expired','revoked'); version bigint NOT NULL CHECK version > 0; entry_id uuid NOT NULL REFERENCES cms_content_entries(id); person_id uuid NOT NULL REFERENCES platform_private.person_party(party_id); acting_party_id uuid NULL REFERENCES platform_private.party(id); lease_until timestamptz NOT NULL; last_seen_at timestamptz NOT NULL; current_field_id uuid NULL; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); UNIQUE(entry_id,person_id).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | INDEX(owner_id,state,updated_at DESC); INDEX(entry_id,lease_until); INDEX(person_id,lease_until); current_field_id is a stable field UUID revalidated against the active schema; owner_id is copied from the entry; advisory only; lease is 2 minutes, renewed every 30 seconds, expires without blocking another editor, and never grants write authority. Renewal is the sole permitted timestamp/version update exception and is CAS-guarded.                                                                                                                                                                                                                                                     |
| EntryAssignment / cms_entry_assignments       | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; entry_id uuid NOT NULL REFERENCES cms_content_entries(id); assignee_person_id uuid NOT NULL REFERENCES platform_private.person_party(party_id); capability_key text NOT NULL CHECK capability_key ~ '^[a-z][a-z0-9._-]{0,127}$'; state text NOT NULL CHECK state IN ('active','revoked'); version bigint NOT NULL DEFAULT 1 CHECK version > 0; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); UNIQUE(entry_id,assignee_person_id,capability_key).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | INDEX(entry_id,state); INDEX(assignee_person_id,state); DEC-106 foundation: CMS-03B-10 persists the creator scoped assignment atomically with the entry and first revision. assignee_person_id is the canonical derived person platform_private.person_party(party_id) and assignment is person-scoped, never keyed by an acting-party/org alias platform_private.party(id) that instead supplies acting context. Assignment authority stays BE01-owned and server-derived; the capability_key must resolve to a registry-backed cms.author or cms.editor key, and caller-supplied owner/assignee/authority is never trusted. State/version advance only through the named assignment RPC under CAS. |
| ConflictRecord / cms_conflict_records         | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; entry_id uuid NOT NULL REFERENCES cms_content_entries(id); base_revision_id uuid NOT NULL REFERENCES cms_entry_revisions(id); theirs_revision_id uuid NOT NULL REFERENCES cms_entry_revisions(id); yours_revision_id uuid NULL REFERENCES cms_entry_revisions(id); yours_source text NOT NULL CHECK yours_source IN ('revision','proposed'); proposed_values jsonb NULL; proposed_values_hash char(64) NULL CHECK proposed_values_hash IS NULL OR proposed_values_hash ~ '^[a-f0-9]{64}$'; changed_paths jsonb NOT NULL CHECK jsonb_typeof(changed_paths)='array' AND jsonb_array_length(changed_paths) BETWEEN 1 AND 128; base_hash char(64) NOT NULL CHECK base_hash ~ '^[a-f0-9]{64}$'; theirs_hash char(64) NOT NULL CHECK theirs_hash ~ '^[a-f0-9]{64}$'; yours_hash char(64) NOT NULL CHECK yours_hash ~ '^[a-f0-9]{64}$'; conflict_hash char(64) NOT NULL UNIQUE CHECK conflict_hash ~ '^[a-f0-9]{64}$'; state text NOT NULL CHECK state IN ('open','resolved','superseded'); version bigint NOT NULL DEFAULT 1 CHECK version > 0; resolved_revision_id uuid NULL REFERENCES cms_entry_revisions(id); resolved_by_person_id uuid NULL REFERENCES platform_private.person_party(party_id); resolved_acting_party_id uuid NULL REFERENCES platform_private.party(id); resolved_at timestamptz NULL; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK yours_source='revision' AND yours_revision_id IS NOT NULL AND proposed_values IS NULL AND proposed_values_hash IS NULL OR yours_source='proposed' AND yours_revision_id IS NULL AND proposed_values IS NOT NULL AND proposed_values_hash IS NOT NULL; CHECK proposed_values IS NULL OR jsonb_typeof(proposed_values)='object' AND platform_private.cms_json_bounded(proposed_values,262144,8,128,128); CHECK (state IN ('open','superseded') AND resolved_revision_id IS NULL AND resolved_by_person_id IS NULL AND resolved_acting_party_id IS NULL AND resolved_at IS NULL) OR (state='resolved' AND resolved_revision_id IS NOT NULL AND resolved_by_person_id IS NOT NULL AND resolved_at IS NOT NULL); | UNIQUE(conflict_hash); UNIQUE INDEX cms_conflict_records_one_open_per_entry ON (entry_id) WHERE state='open'; INDEX(owner_id,state,updated_at DESC); INDEX(entry_id,state,updated_at DESC); INDEX(entry_id,conflict_hash); INDEX(base_revision_id); INDEX(theirs_revision_id); INDEX(yours_revision_id); private platform_private schema, RLS ENABLED+FORCED, revoke all from public/anon/authenticated/service_role, single cms_conflict_records_rpc_policy gated by platform_private.cms_rpc_context_valid(); cms_conflict_records_write_guard BEFORE INSERT/UPDATE/DELETE calls platform_private.cms_write_guard().                                                                               |

### Permission, RLS and grants

- All twelve tables are in private CMS schemas with RLS enabled and forced. authenticated and anon have no direct INSERT/UPDATE/DELETE grants. Named RPCs are cms_create_revision, cms_resolve_conflict, cms_list_revisions, cms_restore_revision, cms_submit_review, cms_record_review_decision, cms_schedule_publication, cms_mint_preview, cms_publish_revision, cms_create_entry, cms_get_entry_draft. cms_conflict_records is written only through those named RPCs: cms_create_revision records exactly one open conflict on same-field divergence, and cms_resolve_conflict CAS-closes it; there is no browser or direct-insert write path.
- ContentEntry SELECT requires derived person/acting-party assignment or an approved public-control projection; owner_party_id is resolved server-side. EntryRevision/EntryFieldValue/EntryRelation inherit the parent entry predicate and additionally require locale/audience disclosure.
- EditorialReview SELECT requires reviewer/submitter assignment and risk capability; EditorialDecision SELECT returns only safe decision metadata to eligible participants and never exposes another reviewer's private comment.
- PublicationSchedule SELECT/write requires publisher scope on the entry. PublicationVersion is public only through Shard 04's authorized projection; control-plane reads are no-store. PreviewToken is never directly selectable; open is a SECURITY INVOKER RPC that hashes the token and rechecks all bindings.
- platform_private.person_party(party_id) and platform_private.party(id) are the canonical BE01 references; this shard stores IDs only. platform_private.cms_template_registry_valid(uuid) is the registry seam for template_version_id until 03c owns the TemplateVersion relation and a forward migration adds the real FK. Target domain IDs in EntryRelation are intentionally not FKs because target kinds cross producer-owned schemas and are authorized by named projection contracts.
- RLS predicates use verified session, acting party, relationship/assignment, capability, risk, lifecycle, locale, and target authorization. Caller-provided partyId, reviewer ID, author ID, or public flag is never trusted.
- Migration-owned SECURITY DEFINER functions are schema-qualified with empty search_path, PUBLIC execute revoked, named grants only, and positive/negative RLS tests. Audit/idempotency/outbox records remain BE00-owned and commit atomically.

## Middleware & Policies

### Per-operation authorization matrix

| Operation ID | Principal / capability                                          | Ownership and state guard                                                                     | 403 rule                                      | 404 rule                     | Additional gate                                                                   |
| ------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| CMS-03B-01   | verified human with cms.author or cms.editor                    | assigned active entry; active schema; draft/autosave allowed                                  | visible entry, no assignment/edit             | entry hidden/absent          | schema and target relation recheck at save                                        |
| CMS-03B-02   | assigned author/editor with conflict.resolve                    | exactly one durable open conflict record per entry on the assigned entry; base still readable | visible conflict, no resolve capability       | hidden/absent entry/conflict | every same-field choice explicit; cms_resolve_conflict CAS-closes the open record |
| CMS-03B-03   | cms.author/editor/reviewer read scope                           | entry/revisions readable; cursor context matches actor/party                                  | visible entry, no read capability             | hidden/absent entry/revision | safe field diff only                                                              |
| CMS-03B-04   | cms.author/editor edit                                          | source revision readable; migration chain registered; current schema compatible               | source readable, no edit                      | hidden/absent entry/revision | restore creates new draft only                                                    |
| CMS-03B-05   | cms.editor or assigned submit capability                        | revision draft; dependency manifest resolves; submitter assigned                              | visible target, no submit                     | hidden/absent target         | frozen hash and risk class                                                        |
| CMS-03B-06   | eligible reviewer/editor; legal/security reviewer for protected | review open; reviewer distinct; review hash current                                           | visible review, capability/assignment missing | hidden/absent review         | protected requires two humans, specialist capability, recent MFA                  |
| CMS-03B-07   | cms.publisher                                                   | approved revision/frozen set; schedule action allowed                                         | visible target, no publish                    | hidden/absent target         | step-up MFA; local/UTC/DST consistency                                            |
| CMS-03B-08   | preview capability on target                                    | revision/version set readable; token scope bounded                                            | visible target, no preview                    | hidden/absent target         | 15-minute token, noindex/no-store/no public cache                                 |
| CMS-03B-09   | cms.publisher and approved candidate                            | frozen hash/dependencies current; no revocation/blocker                                       | visible target, no publisher                  | hidden/absent target         | preflight rerun and atomic publication/outbox                                     |
| CMS-03B-10   | verified human with registry cms.author or cms.editor           | active compiled schema; no prior entry or base revision required                              | visible target, no create capability          | target hidden/absent         | server-derived owner, assignee, and first revision                                |
| CMS-03B-11   | verified human with cms.author/editor read scope on entry       | readable active entry and current readable draft revision                                     | visible entry, no read capability/assignment  | entry hidden/absent          | no draft fabrication; bounded values only                                         |

Known readable resources with insufficient capability return 403. Resources outside the caller's disclosure scope, absent UUIDs after structural validation, expired/revoked preview tokens, and hidden reviews return indistinguishable 404 or the preview-safe denial. Structural malformed input is always 400 before an existence check.

### Security and abuse controls

- Raw body max 256 KiB; JSON nesting max 8, keys 128, arrays 128; rich text is an approved structured AST. Reject scripts, CSS, HTML event handlers, template expressions, SQL, executable URLs, arbitrary projection names, and hidden field injection.
- CMS-03B-10 create is idempotent and atomic: a duplicate Idempotency-Key with the same body and actor replays the original entry/revision, a key reused with a different body/actor returns 409, and a unique owner/content-type/idempotency binding prevents a duplicate entry or aggregate revision. No caller-supplied owner, assignee, author, acting party, capability, or version is accepted.
- CMS-03B-11 is a bounded no-store read that returns authorized schema-typed draft values only. It never returns untyped or private content, never falls back to a cross-tenant value, and cannot be reached without read capability/assignment.
- Autosave is advisory and bounded: default 3 seconds idle, hard maximum 30 seconds while dirty. Presence is a 2-minute lease renewed every 30 seconds and cannot block another editor. Local unsent values remain client-side when server authority changes.
- Every revision stores normalized hash, schema/template/taxonomy versions, author/acting context, parent IDs, validation result, and timestamp. A changed dependency, authority, or revision invalidates approval.
- Ordinary review requires author not equal to publisher where workflow says review. Protected policy/legal/security/financial disclosure requires two distinct humans, named specialist capability, and recent MFA. Reviewer identity is derived, never submitted as authority.
- Preview token plaintext is returned once, persisted only as a hash, bound to user, acting context, revision, full version set, locale, audience, route, expiry, nonce, and capability snapshot. Public caches/search/sitemaps never admit preview.
- Publication rechecks relation target visibility, privacy, rights/media, route/SEO, locale, migration, accessibility, settings, schema, template, block, pattern, and current revocation state. Last-known-good remains public only when no takedown/privacy/security fail-closed rule applies.
- Rate buckets are keyed by actor and acting party, with separate author/review/schedule/preview/publish classes. Concurrent revision writes cap at three per actor; duplicate exact commands are replayed, not multiplied.

## Data Flow

### Transaction and external seams

CMS-03B-01: parse request → authenticate/resolve acting context → check assignment and the active ContentTypeVersion plus its non-null immutable activationEvidence, SchemaArtifact/compiler, protected validator refs, and editorial workflow-policy evidence → reserve idempotency → lock ContentEntry and base revision → resolve immutable RelationDefinition metadata and validate changed paths/values/relations → insert immutable EntryRevision plus normalized EntryFieldValue/EntryRelation → update current draft pointer/version → append audit and cms.entry.revision-created.v1 outbox row → return 201. No publication or review mutation occurs.

CMS-03B-10: parse request → authenticate/resolve acting context → require a registry-backed cms.author/cms.editor capability → resolve the active ContentTypeVersion plus its non-null activationEvidence, SchemaArtifact/compiler, and protected validator refs → reserve idempotency → insert ContentEntry (lifecycle active, server-derived version 1) and its first immutable EntryRevision draft with normalized EntryFieldValue/EntryRelation rows and the creator scoped cms_entry_assignments row in one transaction → append audit and cms.entry.revision-created.v1 outbox row → return 201 with the created entry/revision envelope. No prior base revision or If-Match is required, and no publication or review mutation occurs.

CMS-03B-11: parse request → authenticate/resolve acting context → require read capability/assignment on the readable active entry → load the current readable immutable draft revision under RLS → return authorized, schema-typed field values and bounded relations with provenance and safe hashes. It writes nothing, emits no event, and never discloses a value the caller cannot read.

CMS-03B-02: load the single durable open conflict record and common base under RLS → validate explicit choices against current schema → lock entry/base → insert revision with both parent IDs → CAS-close the open conflict atomically (state='resolved' with resolved_revision_id/by_person/at) → audit/outbox. Both competing revisions and the common base remain readable. If base moved, return 409 with safe base/theirs/yours hashes/values and preserve both revisions and the open conflict record. On same-field divergence a candidate committed as a revision is stored with yours_source='revision' plus yours_revision_id, while a rejected or late autosave that never became a revision is stored with yours_source='proposed' plus bounded proposed_values (≤128 keys/≤8 levels/≤256 KiB, enforced by both the table CHECK via platform_private.cms_json_bounded and the RPC boundary) and its 64-hex hash, leaving yours_revision_id NULL; a non-null yours_revision_id is never required. At most one open conflict exists per entry; resolution never last-writes-wins.

CMS-03B-03 reads only authorized revision summaries and safe schema-aware hashes. CMS-03B-04 resolves a registered 03a migration chain, translates source content into current schema, validates non-fabricating defaults/relations, and inserts a new draft; it never edits or activates the source revision.

CMS-03B-05 revalidates author/assignment, refetches and freezes the active schema's exact activationEvidence plus artifact/compiler/validator and editorial workflow-policy evidence, freezes normalized content hash and dependency manifest, runs contract/relation/privacy/security/accessibility/rights/media/route/SEO/locale/migration/domain-binding preflights, creates EditorialReview, and writes cms.entry.review-changed.v1. CMS-03B-06 appends EditorialDecision, computes the policy-required count, and invalidates on any hash/dependency/authority change.

CMS-03B-07 stores local datetime, IANA timezone, resolved UTC, tzdb version, and disambiguation. A schedule worker receives only schedule ID, revision ID, expected version, dependency hash, activation evidence hash, and correlation IDs; it re-runs preflight at execution and transitions through CAS. CMS-03B-09 performs the same immediate preflight against the exact activation/dependency evidence, then inserts PublicationVersion, appends supersession/tombstone evidence for prior active publication, records audit/idempotency, and writes exactly one cms.publication.changed.v1 event.

CMS-03B-08 validates exact version set and mints a short token. Every preview open rechecks the token hash, expiry, user/acting context, capability, version set, route, audience, locale, target relation authorization, and revocation. CMS-03B-09 never trusts a preview token as publication authorization.

The canonical compiler, migration transform, and projection consumers are internal. If a remote checker/registry adapter is enabled, its exact seam is: Zod request/response envelope, 2,000ms RPC timeout, application route deadline 15,000ms, at most three pre-effect retries at 15s/60s/300s with jitter, circuit opens after five consecutive retryable failures for 60s. Invalid upstream response maps 502, unavailable/open circuit 503, deadline 504. No publication commits on an unresolved preflight. An ambiguous post-effect response reconciles by idempotency/publication status before retry; no blind duplicate publish.

### State machine and concurrency

- EntryRevision: draft → submitted → approved or rejected → scheduled → published. CMS-03B-10 creates the first draft revision in the same transaction as the entry aggregate and its assignment; a retried create with the same idempotency binding returns that same first revision and never appends a second one. Any changed draft creates a new immutable revision and invalidates affected review. A rejected revision remains immutable and readable to authorized actors; field-value and relation snapshots are `active`, version 1, and append-only.
- EditorialReview: open → approved, rejected, or invalidated. Approval count and distinct people/capabilities are computed transactionally from the frozen policy evidence (`1..8`, with recorded never exceeding required); protected review requires two distinct humans and specialist/MFA evidence.
- EditorialDecision: `recorded` only; each decision is an immutable append-only evidence row bound to the review's exact policy and approval-evidence hash.
- PublicationSchedule: pending → executing → completed, failed_retryable, blocked, or cancelled. Exact action/revision/version is idempotent. Late/repeated workers record actual time/deviation and cannot duplicate a PublicationVersion.
- PublicationVersion: active → superseded or revoked at the aggregate level. Unpublish/expire/archive creates a new immutable state/version or tombstone; it never updates or deletes prior evidence. PreviewToken is `active → expired|revoked`, with token identity/binding immutable and revocation CAS-only.
- Revision write uses SELECT FOR UPDATE and exact base/entry version. Same-field divergence never last-writes-wins; non-overlapping paths may merge with both parents. A lost response is resolved by the same idempotency key.
- Presence lease does not lock content. Worker/schedule leases use BE00 job semantics and CAS. Failed rows remain on old readable schema; a projection or provider outage cannot roll back committed publication state.

### Event schemas

All events use the BE00 identifier-only envelope: eventId UUID, eventType, schemaVersion, occurredAt, producer, correlationId, causationId, aggregateType, aggregateId, aggregateVersion as a lossless decimal string, and payload IDs only.

| Event type                    | Exact payload                                      | Producer / consumer rule                                                                                                                                                                  |
| ----------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cms.entry.revision-created.v1 | { entryId: UUID, revisionId: UUID }                | CMS-03B-01, CMS-03B-02, CMS-03B-04, and CMS-03B-10 emit after commit; CMS-03B-10 emits exactly one for the initial revision; review/search-draft/task consumers refetch under capability. |
| cms.entry.review-changed.v1   | { reviewId: UUID, revisionId: UUID }               | CMS-03B-05/06 emit after review or decision commit; task/notification consumers refetch frozen state.                                                                                     |
| cms.publication.changed.v1    | { entryId: UUID, publicationVersionId: UUID }      | CMS-03B-09 and schedule worker emit after publication transaction; Shard 04 route/render/search/sitemap/cache consumers converge exact ID/version.                                        |
| cms.localization.changed.v1   | { entryId: UUID, locale: BCP47, revisionId: UUID } | 03c emits locale changes; 03b invalidates affected review/publication dependencies and refetches exact locale revision.                                                                   |

Consumers are at-least-once, deduplicated by event identity, and monotonic by aggregate version. Unknown event versions go directly to DLQ. Retries are max three at 15s/60s/300s; terminal failure is visible as degraded/pending and never guessed as success. Events contain no content values, review comments, token, PII, or target-domain authority.

### Cross-shard direction

- BE00 provides ApiError, request IDs, ETags, idempotency, audit/outbox, jobs, queue envelope, CORS/CSRF, rate, SLO, and recovery fencing.
- BE01 provides verified person/party/acting context, assignment, mandate, capability, and MFA facts. 03b stores only canonical IDs and rechecks at commit. DEC-106 requires BE01/migration ownership of the cms.author and cms.editor capability-registry keys and of the platform_private.cms_entry_assignments rows that CMS-03B-10/-11 authorize against; this shard only reads them and never mints assignment or capability authority.
- 03a provides active ContentTypeVersion, FieldDefinitionVersion, immutable RelationDefinition, SchemaArtifact, migration-chain, and BlockDefinitionVersion IDs/hashes. EntryRevision stores the exact schema version; its frozen review/publication VersionSet and DependencyManifest capture the active ContentTypeVersion id/hash, non-null server activationEvidence, SchemaArtifact id/hash/compiler, protected validator refs, and editorial workflow-policy evidence, and stale schema, activation evidence, or artifact rejects. 03b never treats an activation or approval ID supplied by a caller as authority.
- 03c provides TemplateVersion, PatternVersion, TaxonomyVersion/Term, LocaleVariant, and related-content dependencies. 03b freezes hashes and invalidates on source/dependency change; 03c does not receive authority through a revision.
- Shard 04 consumes cms.publication.changed.v1 and refetches exact PublicationVersion under its own public projection/auth/cache policy. It owns route/render/search/sitemap convergence and tombstone handling.
- Shard 05 supplies governed settings/checker/risk definitions only through versioned allowlists; it cannot bypass editorial or legal/security gates.
- Domain shards supply named read-only projections for relations. A private/embargoed/deleted target is omitted or blocks per RelationDefinition; no stale target field is copied.
- Shard 16 canonical credential/entitlement/credit/EvidenceState/InstitutionGate records remain outside CMS; reserved-concept checks prevent entries or publications from impersonating them.

## Error Handling

### Operation error coverage

The route registry and contract matrix are exhaustive for all eleven operation IDs. Every failure uses BE00 ApiError { code, message, requestId, details } and no command reports success before its canonical transaction outcome is known.

| Operation ID | Before mutation                               | Transaction / race                                                                           | After commit / recovery                                                                                                |
| ------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| CMS-03B-01   | transport/auth/assignment/schema/value errors | 409 base/version/conflict/idempotency; rollback leaves no revision                           | committed revision event retries idempotently; local unsent value retained on denial                                   |
| CMS-03B-02   | transport/auth/conflict-choice errors         | 409 base moved or invalid transition; open conflict record preserved; both parents preserved | new two-parent revision; conflict CAS-closed atomically; no inferred choice                                            |
| CMS-03B-03   | transport/auth/cursor errors                  | safe read never mutates                                                                      | projection lag does not change history; refetch cursor on expiry                                                       |
| CMS-03B-04   | transport/auth/migration errors               | 409 stale version/chain/hash; source remains unchanged                                       | new draft only; migration failure resumes or remains blocked                                                           |
| CMS-03B-05   | transport/auth/preflight errors               | 409 open review/hash/dependency; no review on failure                                        | review event retries; later dependency change invalidates review                                                       |
| CMS-03B-06   | transport/auth/MFA errors                     | 409 stale review/duplicate decision/hash; append-only decision                               | review event retries; approval cannot survive changed dependency                                                       |
| CMS-03B-07   | transport/auth/time errors                    | 409 exact schedule collision/version; no job effect                                          | worker CAS, retry/DLQ; prior publication intact on blocked execution                                                   |
| CMS-03B-08   | transport/auth/version errors                 | 409 stale version set; no token mint                                                         | revocation/expiry causes 404-safe preview denial; no cache/search trace                                                |
| CMS-03B-09   | transport/auth/preflight errors               | 409 frozen hash/set/version/state; no partial publication                                    | committed PublicationVersion remains canonical; Shard 04 retries projection; privacy/security/takedown may fail closed |
| CMS-03B-10   | transport/auth/assignment/schema/value errors | 409 duplicate key/schema/idempotency; rollback leaves nothing                                | committed entry and first revision event retries idempotently; replay returns the original resource                    |
| CMS-03B-11   | transport/auth/capability/query errors        | safe read never mutates                                                                      | no audit/outbox effect; concealment stays 404 on refetch                                                               |

Failure cascade rules: a PostgreSQL disconnect before commit leaves no revision/review/schedule/publication; a lost response after commit is reconciled by idempotency/status. Queue/outbox failure does not roll back canonical state. Worker crash resumes by lease/CAS. Projection failure leaves pending/degraded status and last-known-good. Audit failure blocks the command. Unknown exception is 500 with empty details and scrubbed telemetry.

## Observability

Each operation emits structured scrubbed logs keyed by operation ID, requestId, traceId, correlationId, actor class, acting-context class, safe aggregate ID/hash, revision/version, outcome, error code, duration, dependency class, and retryability. No content values, review comments, token, email, party name, capability graph, raw target projection, or request body enters logs/provider-native diagnostics.

Per-operation metrics:

- cms_editorial_request_total{operation,outcome}, cms_editorial_latency_ms, cms_editorial_error_total{operation,code}, cms_editorial_rate_limited_total, cms_editorial_conflict_total{operation,reason}
- cms_revision_created_total, cms_revision_validation_failed_total, cms_conflict_open_total, cms_conflict_closed_total, cms_conflict_one_open_violation_total, cms_conflict_records_created_total, cms_presence_active, cms_review_open_age, cms_review_invalidated_total
- cms_entry_create_total{outcome}, cms_entry_create_replayed_total, cms_entry_create_conflict_total, cms_entry_draft_detail_total{outcome}, cms_entry_draft_detail_denied_total
- cms_schedule_state_total, cms_schedule_lateness_seconds, cms_preview_minted_total, cms_preview_denied_total, cms_publication_state_total, cms_publication_projection_lag, cms_outbox_age, cms_queue_retry_total, cms_queue_dlq_total

Traces cover validation → principal/assignment → schema/dependency refetch → idempotency → RPC/SQL → audit/outbox → worker → Shard 04 refetch. Alert when review invalidation spikes >5%/5m, schedule blocked >15m, publication projection lag >2m, DLQ >0, outbox age >2m, or preview denial anomaly indicates forwarding/abuse. SLOs: Tier 1 p95 <750ms; Tier 2 p95 <1,200ms; protected RPC <300ms; job acceptance p95 ≤500ms/p99 ≤1,000ms; Queue first attempt p95 ≤60s; DLQ <0.1% daily.

## Testing Strategy

### Contract and route tests

- Generated OpenAPI, Hono routes, and registry rows match all eleven operation IDs, method/path, request/success/error, auth, CORS, rate, timeout, cache, idempotency, ETag, and SLO fields.
- CMS-03B-01 tests every EntryRevisionRequest field, unique changedPaths, values max 128 UUID keys and JSON depth 8, autosave 3s/30s, all field kinds through 03a, structured rich text, missing/null/empty/default/inherited provenance, relation allowlist, assignment denial, base conflict, and cms.entry.revision-created.v1.
- CMS-03B-02 tests base/theirs/yours conflict payloads, each explicit choice with a schema-validated value, a named choice (base/theirs/yours) that carries a value rejected symmetrically rather than silently ignored, duplicate-path choices rejected, cross-field merge, same-field choice, no-answer preservation, moved-base 409, and two-parent revision. It also covers durable conflict-record create/load/close, the one-open-per-entry partial unique, the yours_source revision/proposed coupling (including the nullable yours_revision_id path where a candidate never became a revision), the bounded proposed_values CHECK plus RPC-boundary revalidation, and the resolved-envelope CHECK.
- CMS-03B-03 tests pagination limit 1/50, cursor signing/expiry/context binding, hidden revisions, compare hashes and safe field paths, no mutation, and no private content disclosure.
- CMS-03B-04 tests registered migration chain, missing step, non-fabricating transform, source immutability, current-schema draft, stale ETag, worker failure, and replay.
- CMS-03B-05 tests frozen content/dependency hashes, all preflight categories, ordinary/protected risk, one open review, duplicate submission, and review event.
- CMS-03B-06 tests author/reviewer distinctness, duplicate reviewer, policy counts 1 and 8, recorded counts 0 and 8, `recordedDecisionCount <= requiredDecisionCount`, protected `requiredDecisionCount >= 2` and nonempty `requiredCapabilities`, specialist/MFA freshness, stale hash, reject path, invalidation, exact workflow-policy key/version/hash/capabilities/approval-evidence bindings, and append-only decisions.
- CMS-03B-07 tests IANA timezone, tzdb snapshot, earlier/later DST, nonexistent time, all actions, exact-version schedule, duplicate/late worker, blocked/retryable/cancelled states, and actual deviation.
- CMS-03B-08 tests token entropy/one-time persistence, 15-minute max, user/acting/audience/locale/route/version-set binding, expiry/revocation/forwarding, no-store/noindex, and open-time reauthorization.
- CMS-03B-09 tests publisher/approval gates, all dependency rechecks, expected-version-set race, atomic PublicationVersion + outbox, prior active supersession, projection pending/degraded, and publication event.
- CMS-03B-10 tests atomic entry + first revision + normalized values/relations + creator assignment in one transaction, Idempotency-Key replay of the identical resource, key reuse with a changed body/actor returning 409, unique owner/content-type binding, off-registry schema/artifact/validator rejection, rejection of caller-supplied owner/assignee/author/acting-party/capability/version, the absent If-Match requirement, and exactly one cms.entry.revision-created.v1.
- CMS-03B-11 tests read-capability/assignment authorization, indistinguishable 404 concealment for hidden/absent entries, the 128-field and 512-relation bounds, schema-typed draft values with exact provenance and safe hashes, no untyped or cross-tenant fallback, locale selection, and the no-store ETag binding entry plus draft revision versions.
- Every operation tests status 400, 401, 403, 404, 409, 415, 422, 429, 502, 503, 504, and 500 where applicable; exact ApiError shape/details and required response headers are asserted.
- Browser-envelope tests reject ownership identifiers and unknown state values across list/detail/history responses; contract fixtures assert the exact EntryRevisionState, EditorialReviewState, PublicationScheduleState, PublicationState, and RevisionSummary state mappings.

### Authorization, persistence, and concurrency tests

- Anonymous, expired session, wrong person, wrong acting party, unassigned editor, revoked mandate/capability, stale MFA, reviewer self-approval, hidden entry/review/revision, forged JWT metadata, service-role misuse, and over-disclosure tests cover every route.
- Every table tests SQL types/nullability/checks, FK targets, unique/partial indexes, enum transitions, append-only behavior, immutable hashes, RLS enabled/forced, direct grant revocation, named RPC grants, and target projection reauthorization.
- A schema-contract test enumerates every persisted 03b table and asserts `id`, server-derived `owner_id`, a closed `state` (or the explicit IA `ContentEntry.lifecycle` physical-state exception), positive bigint `version`, `created_at`, and `updated_at`; immutable/append-only rows assert `updated_at = created_at` plus rejected UPDATE/DELETE, while mutable-envelope rows refresh `version`/`updated_at` only through their named CAS RPCs. cms_conflict_records is a mutable-envelope CAS table: it asserts no blanket `updated_at = created_at` (that would hold only while `state='open'`), a nullable `yours_revision_id` not coupled to `state`, and the resolved-envelope CHECK (open/superseded ⇒ resolved_* NULL; resolved ⇒ resolved_revision_id/resolved_by_person_id/resolved_at NOT NULL).
- Evidence-binding tests assert active 03a `ContentTypeVersion.id/hash`, non-null `activationEvidence`, `SchemaArtifact` id/hash/compiler, protected validator key/version pairs, and editorial workflow-policy key/version/`policyHash`/`requiredCapabilities`/`approvalEvidenceHash` are re-fetched and equal at save, review, restore, preview, schedule execution, and publication; caller owner/approval/capability metadata never supplies authority.
- Relation privacy tests assert `omit`, `block`, and `placeholder` produce no target-dependent disclosure and that every unavailable placeholder is exactly `{status:'unavailable', reason:'unavailable'}` with no target identity or data across authoring, preview, and publication projections.
- Concurrent same-key/same-body commands produce one effect and exact replay; same key with body/actor/path/version mismatch returns 409; changedPaths duplicates and values over 128 keys/depth 8 are rejected before RPC; failed transaction leaves no idempotency/audit/outbox/revision/review/schedule/publication; a failed initial create leaves no entry, revision, assignment, or event.
- Concurrent autosaves, presence expiry, conflict resolution, review decisions, invalidation, schedule execution, publish race, preview revocation, duplicate/out-of-order events, worker lease expiry, restore migration, and restore epoch fencing are covered.

### Security, performance, and recovery tests

- Fuzz JSON nesting/keys/arrays, JSON Pointer, Unicode/control characters, rich-text AST, HTML/script/CSS/template/expression injection, route traversal, timezone/DST, cursor tampering, token forwarding, and oversized requests.
- Prove no draft/control/preview data reaches public cache/search/sitemap; private target relation cannot leak existence or stale fields; recommendation/preview/publication never grants target authority.
- Remote checker tests assert Zod response validation, exact 2,000ms timeout, 15s/60s/300s retries, five-failure/60s circuit, 502/503/504 mapping, and ambiguous outcome reconciliation.
- Performance tests use representative 128-field revisions and 50-page history: Tier 1 p95 <750ms, Tier 2 p95 <1,200ms, protected RPC <300ms, job acceptance p95 ≤500ms, projection event lag within SLO.
- Recovery drills prove old active publication survives blocked schedule, migration/restore failure creates no obsolete-schema publish, duplicate schedule/publish is harmless, DLQ replay converges, and privacy/takedown fail-closed removal supersedes last-known-good.

### Accessibility handoff tests

Validation errors preserve stable JSON Pointer paths and safe messages for focusable summaries. Autosave, connection, presence, conflict, review, schedule, preview, migration, and publication states expose truthful determinate/unknown/retryable status. Compare responses contain a semantic linear change list; no backend error requires color, drag, or inaccessible private content.

## Deepening Passes

| Pass | Focus                                  | Evidence                                                                                                                                                                                                                   | Result |
| ---- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1    | Source and split completeness          | CMS-05–09 and CMS-13 mapped to eleven routes; seven IA canonical models plus publication/preview/presence/assignment/conflict support records covered; four owned event types retained exactly.                            | PASS   |
| 2    | Endpoint and contract reconciliation   | Registry, field matrix, Zod schemas, error matrix, authorization, rate, CORS, observability, and tests key to every operation ID; frozen schema dependencies include artifact, validator, and workflow-policy evidence.    | PASS   |
| 3    | Persistence hard floor                 | Every canonical/support table lists SQL types, nullability/checks, FK target or intentional code-registry boundary, indexes, RLS, and grants; revision relations resolve immutable 03a definitions before use.             | PASS   |
| 4    | Revision/review/publication sequencing | Immutable revisions, explicit conflicts, frozen hashes, distinct decisions, exact schedules, token rechecks, publication CAS, and outbox atomicity are deterministic.                                                      | PASS   |
| 5    | Security and disclosure                | Assignment/RLS, 403 versus 404, CSRF/CORS, MFA, no executable content, preview binding, target reauthorization, and fail-closed policy are explicit.                                                                       | PASS   |
| 6    | Failure and external seam              | RPC/remote checker timeout, retries, circuit, ambiguous outcomes, worker lease/DLQ, projection lag, and audit failure have typed recovery.                                                                                 | PASS   |
| 7    | Testability and accessibility          | All operation success/refusal paths, data constraints, status headers, JSON pointers, and accessible status semantics have tests.                                                                                          | PASS   |
| 8    | Cross-shard ownership                  | 03a schema/artifact/validator/workflow evidence, 03c composition/taxonomy/locale, BE01 authority, BE00 foundation, Shard 04 projection, and DEC-100 direction are explicit.                                                | PASS   |
| 9    | Two-implementer convergence            | Independent implementers derive the same eleven routes, state machines, artifact/validator/workflow evidence, immutable relation resolution, version checks, transaction boundaries, error disclosure, and event payloads. | PASS   |
| 10   | Adversarial review                     | Stale autosave, hidden target, self-approval, token forwarding, DST ambiguity, duplicate schedule, publication race, projection outage, and takedown all have deterministic outcomes.                                      | PASS   |

## Ambiguity Gate

- Micro ambiguity PASS: each operation has exact path, field types/bounds, success/error schema, auth/assignment, 403/404 disclosure, CORS, rate, timeout, idempotency, concurrency, observability, and tests; frozen schema dependencies identify the immutable artifact, compiler, protected validators, workflow policy, and relation definitions.
- Create-precondition carve-out PASS: CMS-03B-10 is the single deliberate deviation from the uniform mutation If-Match rule, and it is fully specified (Idempotency-Key required, server-derived initial version, atomic entry + first revision + assignment); every other route remains uniformly preconditioned by exact strong If-Match.
- Macro ambiguity PASS: edit → revision → explicit conflict resolution → frozen review → distinct approval → schedule/preview → exact publication → outbox/projection is one complete flow; no hidden mutation or unowned handoff remains.
- Two-implementer PASS: two implementers using only this file and inherited 03a/BE00 contracts select identical routes, state transitions, RLS outcomes, event IDs, retry/DLQ behavior, and public fail-closed rules.
- Devil's-advocate PASS: hostile editor, reviewer self-approval, private relation target, caller-supplied relation metadata, stale schema/artifact/template/taxonomy, forwarded preview, ambiguous DST, duplicate schedule, worker crash, and Shard 04 outage are explicitly refused, reconciled, or degraded.
- Conflict-record PASS: exactly one durable open conflict per entry (partial unique), the nullable yours_revision_id with yours_source revision/proposed coupling, the bounded proposed_values CHECK plus RPC-boundary revalidation, and the resolved-envelope CHECK are explicit; no impossible revision FK is required and no last-write-wins path exists.
- No unresolved product, architecture, security, or implementation ambiguity remains in this boundary.

## Open Questions

None.

## Changelog

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Workflow                | Sections affected                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------- |
| 2026-09-26 | DEC-107: added the private durable ConflictRecord / cms_conflict_records as the 12th canonical 03b table backing CMS-03B-02 (nullable yours_revision_id, yours_source revision/proposed, bounded proposed_values via platform_private.cms_json_bounded 262144/8/128/128 as both a table CHECK and an RPC-boundary obligation, forced RLS, one open conflict per entry), with field/authorization/error/data-flow/observability/test updates and ConflictRecord Zod contracts. | /propagate-decision     | Database Schema, Contracts, Data Flow, Route Registry, Testing Strategy, Ambiguity Gate           |
| 2026-10-02 | DEC-108: attributed the Slice 09 minimum source-row prerequisite to the CMS-05 entry bootstrap (CMS-03B-10) and draft-detail read (CMS-03B-11) plus the CMS-03B-01 revision append, marked the fail-closed `cms_editorial_workflow_policy_evidence` seam as a forward registry-migration seam, and distinguished the 03a CMS schema-review records from this shard's editorial review flow.                                                                                   | /propagate-decision     | Route Registry invariants                                                                         |
| 2026-09-26 | DEC-106: added CMS-03B-10 protected entry create (atomic server-derived entry + first draft revision + creator assignment, Idempotency-Key without If-Match) and CMS-03B-11 authorized draft-detail read, with registry/field/auth/contract/error rows, Zod contracts, canonical cms_entry_assignments record, template-registry seam, BE01 capability/assignment ownership, and create/detail tests.                                                                         | /propagate-decision     | Route Registry, Contracts, Persisted model envelope, Database Schema, Data Flow, Testing Strategy |
| 2026-09-02 | Reconciled every persisted 03b model to the IA envelope and exceptions, widened policy/review counts to 1–8 with protected/recorded bounds, bound activation/dependency evidence, and fixed uniform opaque relation-unavailable behavior.                                                                                                                                                                                                                                     | /propagate-decision     | IA Source Map, Contracts, Persisted model envelope, Database Schema, Data Flow, Testing Strategy  |
| 2026-09-02 | Reconciled 03a SchemaArtifact identity/compiler, protected validator and workflow-policy evidence, and immutable RelationDefinition resolution for frozen revisions and publications.                                                                                                                                                                                                                                                                                         | /implement-slice        | Request/Response Contracts, Database Schema, Cross-shard direction, Ambiguity Gate                |
| 2026-09-02 | Closed browser response state enums against the IA and SQL matrices and removed ownership identifiers from ResourceMeta/resources while retaining server/DB authorization context.                                                                                                                                                                                                                                                                                            | /implement-slice        | Source Map, Route Registry, Contracts, Testing Strategy                                           |
| 2026-09-02 | Added protected-policy nonempty capability enforcement in Zod and SQL, unique changedPaths, and bounded entry values (128 keys, depth 8) to the normative revision contract.                                                                                                                                                                                                                                                                                                  | /implement-slice        | Contracts, Database Schema, Testing Strategy                                                      |
| 2026-08-28 | Classified IA Shard 03 into registry, editorial/publication, and composition/taxonomy/localization backend boundaries.                                                                                                                                                                                                                                                                                                                                                        | /write-be-spec-classify | Split Group, Classification                                                                       |
| 2026-08-28 | Authored complete editorial workflow and publication backend contract for CMS-05–09 and CMS-13.                                                                                                                                                                                                                                                                                                                                                                               | /write-be-spec-write    | All                                                                                               |
| 2026-10-02 | DEC-108 consistency closure: the 03a schema/block-definition routes are CMS-03A-01 through CMS-03A-14; editorial workflow-policy evidence resolves from a code-owned versioned policy registry seeded by a forward-only migration, with membership left as an open owner decision.                                                                                                                                                                                            |
| 2026-10-02 | DEC-109/DEC-110: applied the 03a workflow policy registry membership (four ordinary and four protected `cms.disclosure.*` members with ordered reviewer slots) to editorial reviews, added the specialist-slot evaluation rule, and defined the editorial `approvalEvidenceHash` as a decision-independent approval-basis digest that exists at entry bootstrap.                                                                                                              | /propagate-decision     | Route Registry invariants, Contracts, Frozen evidence                                             |

## Dependency References

- [IA Shard 03 — CMS content modeling and authoring](../ia/03-cms-content-modeling.md)
- [IA Shard 03 deep dive — CMS content modeling and authoring](../ia/deep-dives/03-cms-content-modeling.md)
- [BE00 — Cross-cutting platform foundation](00-infrastructure.md)
- [03a — Content schema registry](03a-content-schema-registry.md)
- [03c — Composition, taxonomy, and localization](03c-composition-taxonomy-localization.md)
- [BE01 — Identity authority and party governance](01a-auth-account-linking.md)
- [BE02 — Shadow/profile/credentials boundaries](02a-shadow-claim-ownership.md)
- [Architecture Design](../2026-08-02-architecture-design.md)
- [Data Placement Strategy](../data-placement-strategy.md)
- [DEC-100 — bounded allowlisted cross-shard projections](../../decisions.md#dec-100-shard-02-accepts-bounded-inbound-evidence-and-policy-commands-without-upward-store-reads-2026-08-28)
