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
- Decision status: no new owner decision. DEC-100 is inherited: references use bounded allowlisted projections and never perform request-time upward reads or copy producer authority. The Slice 11 cascade (2026-10-07) applies the orchestrator resolutions DEC-134 (the D25 code-owned accessibility checker is the first publication preflight provider), DEC-136 (editorial reviewer assignment under the owner-only `cms.editorial_review.assign`) and DEC-145 (contract grammars), together with the Slice 10 resolutions D19, D20, D25 and G3; the owner may override any of them.

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
| 25.02.03  | Review, Approval & Editorial Ownership | CMS-03B-05, CMS-03B-06, CMS-03B-15, CMS-03B-16, CMS-03B-17, CMS-03B-18 | EditorialReview/EditorialDecision, frozen dependency manifest, distinct reviewer/MFA gates, invalidation, and decision tests.                                                          |
| 25.02.04  | Scheduling, Expiry & Archive           | CMS-03B-07, CMS-03B-20             | IANA/tzdb schedule, DST disambiguation, exact-version worker CAS, late-run evidence, and blocked recovery.                                                                             |
| 25.03.04  | Preview, Diff & Safe Publish           | CMS-03B-08, CMS-03B-09, CMS-03B-19 | Audience-bound preview token, exact version set, preflight, publication_version, atomic outbox, and projection convergence.                                                            |

25.01.* and 25.03.01 are owned by 03a. 25.03.02–25.03.03 and 25.05.* are owned by 03c. 03b consumes those versions only through immutable IDs/hashes and revalidates them at submit, schedule, preview-open, and publish.

## Endpoint Completeness Reconciliation

The IA flows owned here reconcile to eighteen browser/protected HTTP operation IDs (CMS-03B-01 through CMS-03B-18) and two internal service operations (CMS-03B-19 and CMS-03B-20). CMS-05 is owned by four operations: CMS-03B-01 appends a revision to an existing active entry, CMS-03B-10 bootstraps a new active entry together with its first draft, CMS-03B-13 lists the caller's assigned entries, and CMS-03B-14 serves the authoring-context preparation read. CMS-06 adds CMS-03B-12, the protected three-way conflict-detail read. CMS-07, CMS-08, and CMS-13 are intentionally split into read/restore, submission/decision/assignment/reads, and preview/publication operations. CMS-08 additionally owns the Slice 11 preparation and review reads: CMS-03B-15 (entry workflow and submission preparation), CMS-03B-16 (review detail) and CMS-03B-17 (reviewer queue), and CMS-03B-18 (editorial reviewer assignment, DEC-136). The reviewer queue is a 03b protected read, not the Shard 08 task inbox: IA03's `cms.entry.review-changed.v1` consumer contract is an identifier-only notification that must refetch frozen state under the consumer's own capability, so a capability-scoped canonical read (CMS-03B-16 and CMS-03B-17) is required whichever surface renders it; the Shard 08 inbox may consume the event and link to CMS-03B-16, but it never lists or caches review content. CMS-03B-19 (preview-token verification for the Shard 04 open route, the BE04c `Shard 03 preview-token verifier` seam) and CMS-03B-20 (publication-schedule claim and execution) are database RPC operations reachable only by registered non-browser principals. The Slice 10 contract phase locks the Slice 11 request contracts that Slice 10 criteria CMS-03B-05…09 validate; Slice 11 owns their runtime, resources, routes, and UI. There are no unregistered background HTTP endpoints; schedule, projection, review invalidation, and migration effects use BE00 jobs/outbox consumers.

| IA interaction                  | Operation ID(s)        | Concrete route(s)                                                                                              | Reconciliation                                                                  |
| ------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| CMS-05 Create/edit entry        | CMS-03B-01             | POST /api/v1/cms/entries/{entryId}/revisions                                                                   | Creates an immutable revision/autosave; it never publishes.                     |
| CMS-05 Create/edit entry        | CMS-03B-10             | POST /api/v1/cms/entries                                                                                       | Creates the active entry and its first draft revision; never publishes.         |
| CMS-05 Create/edit entry        | CMS-03B-11             | GET /api/v1/cms/entries/{entryId}                                                                              | Safe authorized draft detail for the editor; read-only, bounded.                |
| CMS-05 Create/edit entry        | CMS-03B-13             | GET /api/v1/cms/entries                                                                                        | Safe authorized entry list for the caller's assignments; read-only, bounded.    |
| CMS-05 Create/edit entry        | CMS-03B-14             | GET /api/v1/cms/entries/authoring-context                                                                      | Author-safe creatable types and field-definition projection; no schema-registry read. |
| CMS-06 Resolve concurrent edit  | CMS-03B-02             | POST /api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve                                              | Explicitly chooses same-field values and creates a two-parent revision.         |
| CMS-06 Resolve concurrent edit  | CMS-03B-12             | GET /api/v1/cms/entries/{entryId}/conflicts/{conflictId}                                                       | Protected three-way conflict detail; no-store, bounded preimages.               |
| CMS-07 Compare/restore revision | CMS-03B-03, CMS-03B-04 | GET /api/v1/cms/entries/{entryId}/revisions; POST /api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore | Safe history/compare query is separate from edit-authorized restore.            |
| CMS-08 Submit/review/approve    | CMS-03B-05, CMS-03B-06 | POST /api/v1/cms/entries/{entryId}/reviews; POST /api/v1/cms/reviews/{reviewId}/decision                       | Submission freezes the candidate; decisions are append-only and distinct.       |
| CMS-08 Submit/review/approve    | CMS-03B-15, CMS-03B-16, CMS-03B-17, CMS-03B-18 | GET /api/v1/cms/entries/{entryId}/workflow; GET /api/v1/cms/reviews/{reviewId}; GET /api/v1/cms/reviews; POST /api/v1/cms/reviews/{reviewId}/assignments | Preparation, review detail, reviewer queue, and bounded owner reviewer assignment (DEC-136); the workflow read also prepares the CMS-09 and CMS-13 forms. |
| CMS-09 Schedule publish/expire  | CMS-03B-07, CMS-03B-20 | POST /api/v1/cms/publication-schedules; internal schedule claim/execute RPC                                    | Stores local and resolved times; the internal executor (CMS-03B-20) executes the exact version once. |
| CMS-13 Preview/diff/publish     | CMS-03B-08, CMS-03B-09, CMS-03B-19 | POST /api/v1/cms/previews; POST /api/v1/cms/publications; internal preview-token verifier RPC                  | Preview is revocable/read-only and verified for Shard 04 by CMS-03B-19; publication is publisher-authorized and atomic. |

BE00 GET /api/v1/jobs/{jobId} remains the only job-status route and is inherited. The 03a schema/block-definition routes are CMS-03A-01 through CMS-03A-14. Shard 04 owns delivery reads and never receives a draft through a public route. CMS-03B-10 POST /api/v1/cms/entries creates the entry aggregate; CMS-03B-11 GET /api/v1/cms/entries/{entryId} returns its authorized draft detail, CMS-03B-13 GET /api/v1/cms/entries lists the caller's assigned entries, and CMS-03B-14 GET /api/v1/cms/entries/authoring-context serves the author-safe preparation read. Each read returns only authorized, schema-typed values and never untyped or private content. CMS-03B-15, CMS-03B-16 and CMS-03B-17 are the Slice 11 preparation and review reads; CMS-03B-18 is the Slice 11 reviewer assignment command; none of them is Slice 10 acceptance.

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

| Operation ID | IA     | Method and path                                                   | Request → success                                            | Auth / ownership / 403 versus 404                                                                                 | Middleware incl. CORS                                                       | Idempotency / concurrency                                                                                                                                                                                                                                                   | Rate / timeout / cache / SLO                                                     | Error envelope                                      | Event                                           |
| ------------ | ------ | ----------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| CMS-03B-01   | CMS-05 | POST /api/v1/cms/entries/{entryId}/revisions                      | EntryRevisionRequest → 201 EntryRevisionResource             | CMS author/editor with assignment to readable entry; hidden entry is 404; known entry without assignment is 403   | BE00 order; CORS cms-console; CSRF; JSON 256 KiB; schema registry read      | key + If-Match; CAS entry version; changed paths/base revision; takes a `FOR SHARE` lock on the entry's content-type version row (03a Activation transaction rules)                                                                                                         | 120/min/user, 240/min/party; 15,000ms, target <2s; no-store; Tier 2 p95 <1,200ms | BE00 ApiError { code, message, requestId, details } | cms.entry.revision-created.v1                   |
| CMS-03B-02   | CMS-06 | POST /api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve | ConflictResolutionRequest → 201 EntryRevisionResource        | assigned editor/author may resolve; hidden entry/conflict is 404; visible conflict without edit capability is 403 | BE00 order; CORS cms-console; CSRF; strict JSON; conflict rate class        | key + If-Match; CAS conflict base and entry version; no inferred choice                                                                                                                                                                                                     | 60/min/user, 120/min/party; 15,000ms; no-store; Tier 2                           | BE00 ApiError { code, message, requestId, details } | cms.entry.revision-created.v1                   |
| CMS-03B-03   | CMS-07 | GET /api/v1/cms/entries/{entryId}/revisions                       | RevisionHistoryQuery → 200 RevisionHistoryPage               | assignment/read capability; hidden entry is 404; known entry without read scope is 403                            | BE00 order; CORS cms-console; no CSRF mutation; cursor/context binding      | safe read; no Idempotency-Key/If-Match; signed keyset cursor over `(revisionNumber DESC, revisionId DESC)`; default limit 25, max 50; stable sort `revisionNumber DESC, revisionId DESC`; filter allowlist `state`, `locale` only; ETag on page version                     | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 1 p95 <750ms                | BE00 ApiError { code, message, requestId, details } | none                                            |
| CMS-03B-04   | CMS-07 | POST /api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore | RevisionRestoreRequest → 201 EntryRevisionResource           | edit capability + readable source revision; hidden entry/revision is 404; readable but no edit is 403             | BE00 order; CORS cms-console; CSRF; migration-chain recheck; strict JSON    | key + If-Match; CAS current entry; migration chain immutable                                                                                                                                                                                                                | 30/min/user, 60/min/party; 15,000ms; no-store; Tier 2                            | BE00 ApiError { code, message, requestId, details } | cms.entry.revision-created.v1, cms.entry.revision-restored.v1 |
| CMS-03B-05   | CMS-08 | POST /api/v1/cms/entries/{entryId}/reviews                        | ReviewSubmissionRequest → 201 EditorialReviewResource        | submit capability/assignment; hidden entry/revision is 404; visible non-submitter is 403                          | BE00 order; CORS cms-console; CSRF; publication preflight registry (submit phase); strict JSON | key + If-Match (the entry aggregate `version`); one open or approved review per revision via the partial unique lock; frozen hash and dependency manifest recomputed server-side                                                                                                                                                                                                                | 30/min/user, 60/min/party; 15,000ms; no-store; Tier 2                            | BE00 ApiError { code, message, requestId, details } | cms.entry.review-changed.v1                     |
| CMS-03B-06   | CMS-08 | POST /api/v1/cms/reviews/{reviewId}/decision                      | EditorialDecisionRequest → 200 EditorialReviewResource       | assigned reviewer (active `cms.editorial_review` assignment) holding `cms.reviewer` and, for a specialist slot, the specialist capability; a review the caller cannot read is 404; a readable review without an effective assignment or capability is 403 | BE00 order; CORS cms-console; CSRF; step-up MFA (unconditional); strict JSON | key + If-Match (the review `version`); unique reviewer/review and review CAS; the first rejection ends the review                                                                                                                                                                                                                       | 30/min/user, 60/min/party; 15,000ms; no-store; Tier 2                            | BE00 ApiError { code, message, requestId, details } | cms.entry.review-changed.v1                     |
| CMS-03B-07   | CMS-09 | POST /api/v1/cms/publication-schedules                            | PublicationScheduleRequest → 202 PublicationScheduleResource | CMS publisher with entry/revision visibility; hidden target is 404; visible target without publisher is 403       | BE00 order; CORS cms-console; CSRF; step-up MFA (unconditional); pinned-tzdb time authority; strict JSON | key + If-Match (the approved review `version`); unique (entry, revision, action, local time, timezone, audience); executor CAS                                                                                                                                                                                                                     | 20/min/user, 40/min/party; 15,000ms acceptance; no-store; Tier 2                 | BE00 ApiError { code, message, requestId, details } | cms.publication.changed.v1 only after execution |
| CMS-03B-08   | CMS-13 | POST /api/v1/cms/previews                                         | PreviewRequest → 201 PreviewTokenResource                    | preview scope (entry assignee, active reviewer assignee of a review of the revision, or owner-party `cms.publisher`); hidden target is 404; visible target without preview scope is 403           | BE00 order; CORS cms-console; CSRF; no public cache; strict JSON            | key + If-Match (the entry aggregate `version`, E5); version-set CAS; an exact replay re-derives the same token while it is unexpired and never returns or stores the token hash                                                                                                                                                           | 60/min/user, 120/min/party; 8,000ms; no-store; Tier 1                            | BE00 ApiError { code, message, requestId, details } | none                                            |
| CMS-03B-09   | CMS-13 | POST /api/v1/cms/publications                                     | PublicationRequest → 202 PublicationResource                 | CMS publisher plus frozen approval/dependency set; hidden target is 404; visible target without publisher is 403  | BE00 order; CORS cms-console; CSRF; step-up MFA (unconditional); strict JSON | key + If-Match (the approved review `version`); CAS expected version set; unique lineage version (entry, locale, audience, version)                                                                                                                                                                                                          | 20/min/user, 40/min/party; 15,000ms acceptance; no-store; Tier 2                 | BE00 ApiError { code, message, requestId, details } | cms.publication.changed.v1                      |
| CMS-03B-10   | CMS-05 | POST /api/v1/cms/entries                                          | EntryCreateRequest → 201 EntryCreateResource                 | cms.author/cms.editor capability; hidden target is 404; visible target without create capability is 403           | BE00 order; CORS cms-console; CSRF; JSON 256 KiB; schema registry read      | key required; no If-Match because no prior version exists; server-derived entry version 1; unique owner/contentType/idempotency binding prevents a duplicate entry or revision; takes a `FOR SHARE` lock on the content-type version row (03a Activation transaction rules) | 120/min/user, 240/min/party; 15,000ms, target <2s; no-store; Tier 2 p95 <1,200ms | BE00 ApiError { code, message, requestId, details } | cms.entry.revision-created.v1                   |
| CMS-03B-11   | CMS-05 | GET /api/v1/cms/entries/{entryId}                                 | EntryDraftDetailQuery → 200 EntryDraftDetailResource         | assignment/read capability; hidden/absent entry is 404; visible entry without read scope is 403                   | BE00 order; CORS cms-console; no CSRF mutation; no-store detail read        | safe read; no Idempotency-Key or If-Match; ETag binds entry plus draft revision versions; no fallback to untyped or cross-tenant values                                                                                                                                     | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 1 p95 <750ms                | BE00 ApiError { code, message, requestId, details } | none                                            |
| CMS-03B-12   | CMS-06 | GET /api/v1/cms/entries/{entryId}/conflicts/{conflictId}          | ConflictDetailQuery → 200 ConflictDetailResource             | assigned author/editor with entry read; hidden, absent, resolved, or superseded entry or conflict is one identical 404; visible entry without read is 403 | BE00 order; CORS cms-console; no CSRF mutation; no-store detail read        | safe read; no Idempotency-Key or If-Match; strong authenticated ETag binds conflict version plus entry version; only an `open` conflict is readable                                                                                                               | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 1 p95 <750ms                | BE00 ApiError { code, message, requestId, details } | none                                            |
| CMS-03B-13   | CMS-05 | GET /api/v1/cms/entries                                          | EntryListQuery → 200 EntryListPage                           | cms.author/editor read scope; only entries the caller is assigned or owns in the acting context are listed        | BE00 order; CORS cms-console; no CSRF mutation; cursor/context binding      | safe read; no Idempotency-Key or If-Match; signed keyset cursor over `(updatedAt DESC, entryId DESC)`; default limit 25, max 50; filter allowlist `state`, `contentTypeId`; ETag on page version; the cursor also binds the collection epoch (`aheadDigest`), so a collection that changed ahead of the cursor position is 409 `CONFLICT` and the client restarts from the first page (`Entry list keyset, authorization and collection epoch`, DEC-140)                                                                              | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 1 p95 <750ms                | BE00 ApiError { code, message, requestId, details } | none                                            |
| CMS-03B-14   | CMS-05 | GET /api/v1/cms/entries/authoring-context                         | AuthoringContextQuery → 200 AuthoringContextResource        | cms.author/editor scope; never grants cms.schema_registry.read; scoped to the acting context                    | BE00 order; CORS cms-console; no CSRF mutation; no-store preparation read   | safe read; no Idempotency-Key or If-Match; ETag binds the resolved active schema versions; no caller-chosen schema                                                                                                                                                           | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 1 p95 <750ms                | BE00 ApiError { code, message, requestId, details } | none                                            |
| CMS-03B-15   | CMS-08 | GET /api/v1/cms/entries/{entryId}/workflow                        | EntryWorkflowQuery → 200 EntryWorkflowResource               | entry assignee (cms.author/cms.editor), owner-party `cms.publisher`, or active reviewer assignee of a review of the revision; hidden/absent entry or revision is 404; a visible entry without workflow read scope is 403 | BE00 order; CORS cms-console; no CSRF mutation; no-store preparation read | safe read; no Idempotency-Key or If-Match; strong ETag binds the entry, revision, latest review, schedule and publication versions; the preparation is recomputed on every read and never stored | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 2 p95 <1,200ms (includes the 2,000ms accessibility checker budget) | BE00 ApiError { code, message, requestId, details } | none |
| CMS-03B-16   | CMS-08 | GET /api/v1/cms/reviews/{reviewId}                                | path UUID → 200 EditorialReviewDetailResource                | submitter, active reviewer assignee, entry assignee, owner-party `cms.publisher`, or the receipt-derived owner; hidden/absent/cross-owner review is 404; a visible review without read scope is 403 | BE00 order; CORS cms-console; no CSRF mutation; no-store detail read | safe read; no Idempotency-Key or If-Match; strong ETag is `"{review.version}"`; decision rows expose safe metadata only | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 1 p95 <750ms | BE00 ApiError { code, message, requestId, details } | none |
| CMS-03B-17   | CMS-08 | GET /api/v1/cms/reviews                                           | ReviewQueueQuery → 200 ReviewQueuePage                       | verified human; `scope=assigned` lists only reviews the caller holds an assignment on, `scope=submitted` only reviews the caller submitted; a review outside those scopes is never listed | BE00 order; CORS cms-console; no CSRF mutation; cursor/context binding | safe read; no Idempotency-Key or If-Match; signed keyset cursor over `(updatedAt DESC, reviewId DESC)` bound to the complete query and acting scope; default limit 25, max 50; filter allowlist `scope`, `state`; ETag on page version | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 1 p95 <750ms | BE00 ApiError { code, message, requestId, details } | none |
| CMS-03B-18   | CMS-08 | POST /api/v1/cms/reviews/{reviewId}/assignments                   | EditorialReviewAssignmentRequest → 201/200 EditorialReviewAssignmentResource | existing owner holding `cms.editorial_review.assign`, derived from the immutable owner initialization receipt and never grantable; concealed/cross-owner review is 404; capability denial is 403 | BE00 order; CORS cms-console; CSRF; step-up MFA (unconditional); strict JSON | key + exact review If-Match; create or revoke only read/decide on one frozen review; expires within seven days and no later than the grantor authority end; audit atomic | 10/min/user, 20/min/party; 15,000ms; no-store; Tier 2 | BE00 ApiError { code, message, requestId, details } | cms.entry.review-changed.v1 |

### Internal service operations

CMS-03B-19 and CMS-03B-20 are not browser routes and are never listed in the BE00 browser route inventory. Each is a named database RPC reachable only by the one registered non-browser principal named below under the BE00 service-credential pattern: PUBLIC, anon, authenticated and every other role have execute revoked, and the grant is named. Each has exactly one definition in this file.

| Operation ID | Caller principal | RPC | Request → result | Concurrency / idempotency | Deadline, retry and circuit | Event |
| ------------ | ---------------- | --- | ---------------- | ------------------------- | --------------------------- | ----- |
| CMS-03B-19 | Shard 04 delivery principal serving DLV-DEL-API-02 (the BE04c `Shard 03 preview-token verifier` seam) | `platform_api.cms_verify_preview_token` | `PreviewVerificationRequest` → `PreviewVerificationResult` | read-safe: no insert, update, delete, audit row or outbox row; the caller sends the lowercase SHA-256 hex of the presented token's UTF-8 bytes and the plaintext never reaches the RPC | 500 ms RPC timeout, 2 retries at 75 ms and 150 ms, circuit open 30 s (BE04c); an unknown or ambiguous result denies the preview and emits no draft detail | none |
| CMS-03B-20 | Worker `scheduled` sweep running BE00 job type `cms.publication_schedule.execute` | `platform_private.cms_claim_due_publication_schedules(batch)` then `platform_private.cms_execute_publication_schedule(schedule_id, expected_version, lease_id, evidence)` | claim: `batch` integer 1–100 → at most `batch` `ClaimedSchedule` records; execute: the claimed identity plus the verified `PreflightEvidence` → `ScheduleExecutionResult` | claim takes `FOR UPDATE SKIP LOCKED` row locks and CASes each schedule `pending` or `failed_retryable` to `executing` (schedule `version` + 1, new `lease_id`, `lease_until` now + 5 minutes); an `executing` schedule whose lease expired is first returned to `failed_retryable` with `attempt_count` + 1; execute is idempotent per `(schedule_id, expected_version)` and a repeated call on a `completed` schedule returns it unchanged | claim and execute run under the 15,000 ms job deadline; retries are the schedule's own `attempt_count` ladder (15 s, 60 s, 300 s; three attempts, then `blocked`); the lease is the crash-recovery fence | cms.publication.changed.v1 |

CMS-03B-19 request, result and verification rules are in `Preview token verification (CMS-03B-19)`; CMS-03B-20 claim, execution and failure rules are in `Schedule execution (CMS-03B-20)`.

### Registry invariants

- Route path IDs are UUIDs. A route never accepts owner, reviewer, publisher, acting party, or current version as an authority assertion.
- CMS-03B-01, CMS-03B-02, CMS-03B-04, CMS-03B-05, CMS-03B-06, CMS-03B-07, and CMS-03B-09 return strong ETag and Location where a new resource is created. For CMS-03B-01, CMS-03B-02, and CMS-03B-04 the strong ETag is exactly `"{entryVersion}"` of the returned `EntryRevisionResource`: the committed entry aggregate version, which a client sends as the next `expectedVersion`/`If-Match`. The resource's own `version` is the immutable revision snapshot's version (always `1`) and is never a CAS operand, so adopting it would turn every second autosave into a 409. CMS-03B-03 returns an authenticated page ETag. CMS-03B-08 returns a short-lived token and no public ETag. CMS-03B-10 returns a strong ETag with a Location header for the created entry. CMS-03B-11 returns a strong no-store ETag binding the entry and current draft revision versions. CMS-03B-12 returns a strong no-store ETag binding the conflict and entry versions. CMS-03B-13 and CMS-03B-14 return an authenticated no-store page/preparation ETag. CMS-03B-15 returns a strong no-store ETag binding the entry, current revision, latest review, schedule and publication versions; CMS-03B-16 returns the strong ETag `"{review.version}"`; CMS-03B-17 returns an authenticated no-store page ETag; CMS-03B-18 returns a strong ETag and a Location for a created assignment. The strong ETag of CMS-03B-05 and CMS-03B-06 is `"{review.version}"`, that of CMS-03B-07 is `"{schedule.version}"`, and that of CMS-03B-09 is `"{publication.version}"` of the lineage row it appended (E3).
- CMS-03B-10 is the only route that creates the entry aggregate, so it is the single documented exception to the mutation precondition: it requires Idempotency-Key and derives the initial entry version server-side instead of requiring If-Match. Every other mutation route keeps the exact strong If-Match requirement. CMS-03B-11, CMS-03B-12, CMS-03B-13, CMS-03B-14, CMS-03B-15, CMS-03B-16, and CMS-03B-17 are safe reads and accept neither Idempotency-Key nor If-Match.
- The literal authoring-context segment `/api/v1/cms/entries/authoring-context` (CMS-03B-14) is matched before the UUID path parameter of CMS-03B-11, so it is never resolved as an entry ID; any other non-UUID segment under `/api/v1/cms/entries/{entryId}` is a structural 400 before an existence check.
- Every row returns BE00 ApiError { code, message, requestId, details } for failures. No row exposes draft existence, private field values, review comments, token material, or capability graphs to an unauthorized caller.
- CMS-03B-07 schedule acceptance does not claim publication success. CMS-03B-09 commits the canonical PublicationVersion row synchronously and returns it with `projectionState` `pending` until Shard 04 reports convergence (or `degraded` when a consumer has failed terminally); canonical publication state is authoritative and never rolled back by a projection outage.
- CMS-03B-08 preview tokens are audience-bound and revocable. They cannot be exchanged for a publication command or reused after expiry.
- Browser/protected response envelopes contain no ownership identifiers or reviewer/publisher authority fields; authorization context stays server-side. Entry revisions, reviews, schedules, publications, and revision summaries expose only their exact closed state enums.
- **If-Match operands (single definition).** CMS-03B-01, CMS-03B-02 and CMS-03B-04: the entry aggregate `version`, unchanged. CMS-03B-05: the entry aggregate `version` read from CMS-03B-11 or CMS-03B-15 (`entry.version`); its request has no body `expectedVersion`, so the header is the only carrier. CMS-03B-06: the review `version` (`EditorialDecisionRequest.expectedVersion`). CMS-03B-07 and CMS-03B-09: the `version` of the approved review the command relies on (`expectedVersion`); an invalidation advances it, so a command against an invalidated approval is 409 `VERSION_MISMATCH`. CMS-03B-08 (E5): the entry aggregate `version` of the entry that owns the revision, so a preview cannot be minted for a candidate the entry has already moved past; the header member `ifMatch` locked by Slice 10 G3 is therefore required and the registry row and FE03 name it. CMS-03B-18: the review `version`. Wherever a body carries `expectedVersion`, the strong `If-Match` must equal it exactly (a mismatch is 400 `INVALID_REQUEST`) and both name the same operand. CMS-03B-18 create and revoke do not advance the review `version`; a decision serializes with assignment changes by locking the review row.
- **Recent MFA (E6).** CMS-03B-06, CMS-03B-07, CMS-03B-09 and CMS-03B-18 require recent binding-bound MFA unconditionally, for ordinary and protected policies alike (IA03 Recent MFA, FE03 Step-up recovery); there is no "where protected" or "where required" variant. The server derives the MFA instant from the verified session (the DEC-111 freshness window of 600 seconds, with the ±30 second skew tolerance of `stepUpIsFresh`). A missing or stale proof is 401 `STEP_UP_REQUIRED` with `details` `{ recoveryAction: 'step_up', allowedMethods }`, is evaluated before the idempotency reservation and before any domain check that reads the review, reserves no idempotency record, and changes no state. CMS-03B-05 and CMS-03B-08 require no step-up.
- **Separation of duties (E11).** The human who publishes (CMS-03B-09, and the human who schedules a `publish` through CMS-03B-07) is never the `author_person_id` of the revision being published. A reviewer is never the revision author or the review submitter, and one human records at most one decision per review. Every registry workflow member requires at least one `cms.reviewer` decision, so review is always required and the rule is unconditional in Phase 2: an organization whose only human holds every capability needs a second human holding `cms.publisher` to publish content the first human authored. The refusal is 403 `FORBIDDEN` with `details.reasonCode` `separation_of_duties`; a repeated human is 409 `CONFLICT` `duplicate_decision`.
- **Typed state refusals and replay signal (single definition).** A stale entry-version CAS is 409 `VERSION_MISMATCH` for CMS-03B-01, CMS-03B-02 and CMS-03B-04 alike (a restore never surfaces a raw serialization failure). A resolve against a conflict that is no longer `open` (resolved, or superseded by a later append or restore) is 409 `CONFLICT` with `details.conflict` `INVALID_TRANSITION`, changes nothing and preserves both competing revisions; the CMS-03B-12 read of the same conflict is the concealed 404 (DEC-139), so the write names the state and the read does not. The fourth concurrent revision write of one actor is 429 `RATE_LIMITED` before any insert. The database marks an exact-key replay of CMS-03B-01, CMS-03B-02, CMS-03B-04 and CMS-03B-10 with the response header `x-cms-idempotent-replay: true` and an unchanged body; a replay is answered before the concurrent-write cap and is never counted against it. (Lane H round 1 items 5, 6b, 6c and 9.)
- **Lock order and deadlock (single definition).** Every command that locks CMS authority, entries or schema versions follows `Write-path lock order and authority fencing`. A deadlock or lock failure outside that order surfaces as 409 `CONFLICT` with the BE00 state-conflict details (`recoveryAction` `refresh`), commits nothing, and the caller retries with the same `Idempotency-Key`; it is never a 500 and never a silently different outcome. (Lane H round 2 items 1, 2, 4.)


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
| CMS-03B-01            | entryId                                | UUID path; a structurally malformed id is 400 `INVALID_REQUEST` (D-11); a well-formed id that is absent, hidden, cross-owner or names an entry whose lifecycle is not `active` (archived) is the one policy-safe 404 `NOT_FOUND`, so an append never discloses an archived entry or a state the caller could not otherwise see                                                                                                                                                                                                                                                       | 400 (malformed) / 404 (absent, hidden, archived)        |
| CMS-03B-01            | baseRevision                           | positive bigint decimal string naming a revision number of the target entry; a well-formed number that names no revision of the entry is 422 `VALIDATION_FAILED` at `/baseRevision` (every revision of an entry the caller may edit is readable, so "unreadable" and "absent" are one case); `VERSION_MISMATCH` is reserved for the `If-Match`/`expectedVersion` entry-version CAS and is never used for `baseRevision`; an existing earlier revision is the normal divergence path (merge, or a recorded conflict)                                                                                                                                                                                                                                                                        | 422 (names no revision)   |
| CMS-03B-01            | changedPaths                           | 1–128 unique `/fields/{stableFieldId}` pointers (lowercase UUID, 44 chars; every field kind including relation); `/blocks/...` and every other pointer is refused until a composition write path exists | 422                           |
| CMS-03B-01            | values                                 | strict object keyed by stable field IDs; max 128 keys/8 levels/256 KiB; rich text is structured AST                                                                                                                                                                                                                              | 422                           |
| CMS-03B-01            | locale / expectedVersion               | BCP 47 2–35 chars; positive decimal entry version                                                                                                                                                                                                                                                                                | 422 or 409                    |
| CMS-03B-02            | conflictId                             | UUID; the single durable open conflict record on the same entry                                                                                                                                                                                                                                                                  | 400/404/409                   |
| CMS-03B-02            | choices                                | 1–128 strict { path (`/fields/{stableFieldId}`), choice: base, theirs, yours, or explicit, value? } with unique paths; explicit value must validate current schema, while a named choice (base/theirs/yours) must omit value rather than smuggle an ignored replacement                                                                                      | 422                           |
| CMS-03B-02            | ConflictRecord invariant (server)      | server-loaded ConflictRecord, not a request field (request is { entryId, conflictId, baseRevision, choices, expectedVersion }); `revision` requires a stored yoursRevisionId and `proposed` requires bounded proposedValues (≤128 keys/≤8 levels/≤256 KiB) plus a 64-hex hash                                                    | not a 422; server 500         |
| CMS-03B-03            | cursor/limit                           | signed context-bound cursor ≤512 chars; limit integer 1–50 default 25; cursor expires ≤24h                                                                                                                                                                                                                                       | 400                           |
| CMS-03B-03            | compareRevisionId/locale               | UUID optional; BCP 47 optional; both revisions must be readable                                                                                                                                                                                                                                                                  | 400/404                       |
| CMS-03B-04            | revisionId/migrationChainId            | UUIDs; source revision immutable and chain covers source schema to current active schema                                                                                                                                                                                                                                         | 422/409                       |
| CMS-03B-05            | frozenHash                             | exactly 64 lowercase hex; must equal the stored `payload_hash` of the named revision (the JCS SHA-256 of its fields projection, `contentHash`; a mismatch is 422 at `/frozenHash`); `revisionId` must be the entry's current draft revision with effective state `draft` (otherwise 409 `CONFLICT` `revision_not_submittable`: superseded by a newer revision, already under a live review, or not `draft`)                                                                                                                                                                                                                                                                    | 422/409                       |
| CMS-03B-05            | dependencyManifest                     | strict IDs/hashes for schema/template/blocks/patterns/terms/localeSources/settings/relations and a single `checker`; schema includes active 03a content-type-version id/hash, SchemaArtifact id/hash/compiler/contract, non-null activation evidence, protected validator refs (only the registered `rich_text.v1` at version 1, each once), and frozen editorial workflow-policy evidence; every group names each identity once; max 256 entries (every list element plus each present singleton: schema, template, settings, checker)/32 KiB; the server rebuilds the manifest from canonical state (`Frozen dependency manifest build`) and requires JCS equality with the submitted manifest, else 409 `CONFLICT` `dependency_changed` carrying only the current `dependencyHash` | 422                           |
| CMS-03B-05            | riskClass                              | not a request member; derived from the frozen workflow-policy evidence (the strictest of the bound member and the member of the version it supersedes, 03a downgrade guard); protected requires its policy-defined two-person workflow                                                                                                                                                                                                                      | 422                           |
| CMS-03B-06            | decision/reason                        | approve or reject; reason 1–2000 Unicode characters (code points, not UTF-16 units), already NFC (refused, never normalized), no control, line/paragraph-separator, or bidirectional-formatting character, and no `<>{}`                                                                                                                                                                                                                                                                              | 422                           |
| CMS-03B-06            | stepUpAt/capability                    | not request members: a caller `capability` or `stepUpAt` is an unknown key refused by the strict schema (422); the satisfied slot capability and the binding MFA instant are server-derived, and the MFA instant must lie within the freshness window (600 seconds, ±30 seconds skew) else 401 `STEP_UP_REQUIRED`                                                                                                                                                                                                                        | 401/422                       |
| CMS-03B-07            | localDateTime/timezone                 | local ISO datetime without offset whose components are in range (a real calendar day, hour 00–23, minute and second 00–59 with no leap second, at most nine fractional digits) plus an IANA timezone name of 1–64 chars made of one to three `/`-separated segments (`UTC`, `America/New_York`, `America/Argentina/Buenos_Aires`; no `.`/`..` segment); membership in the pinned tzdb is checked by `Time authority (E8)` (422 `unknown_timezone`)                                                                                                                                                                                                                                                                  | 422                           |
| CMS-03B-07            | resolvedUtc/tzdbVersion/disambiguation | offset ISO instant; `tzdbVersion` must equal the server-pinned `CMS_TZDB_VERSION` (422 `tzdb_version_mismatch`, details carry the pinned value); disambiguation earlier/later/none; `Time authority (E8)` defines a nonexistent local time (422 `nonexistent_local_time` with alternatives; seam `nonexistent_local_time_rejected`), an ambiguous local time, a not-applicable disambiguation, the `resolvedUtc` equality rule (422 `resolved_utc_mismatch`; seam `resolved_utc_equals_local_time_timezone_and_disambiguation`) and the horizon (at least 60 seconds and at most 366 days after acceptance)                                                                                                                                                                                                                          | 422                           |
| CMS-03B-07            | action                                 | publish, unpublish, expire, or archive                                                                                                                                                                                                                                                                                           | 422                           |
| CMS-03B-07            | audience/revisionId                    | audience `^[a-z0-9_-]{1,48}$` (BE04c; matched as submitted, never trimmed); `revisionId` is a revision of an entry the caller may schedule whose effective state is `approved`; the target lineage is (the revision's entry, the revision's locale, `audience`) | 422/404/409 |
| CMS-03B-07            | publisher authority                    | the caller's current `cms.publisher` grant (owner-party scope) ends no earlier than `resolvedUtc` (422 `authority_ends_before_schedule`); for action `publish` the caller is not the revision author (403 `separation_of_duties`) | 422/403 |
| CMS-03B-07            | expectedVersion / If-Match             | positive decimal; the approved review's `version`; the strong `If-Match` equals the body value | 400/409 |
| CMS-03B-08            | versionSet                             | strict exact schema/template/taxonomy/settings/blocks/patterns identities (the version set carries IDs plus `schemaHash`, `templateHash`, and `settingsVersion`; the content hashes of blocks, patterns, and terms are carried by the DependencyManifest it was frozen from); each id array names every id once; schema includes active 03a content-type-version id/hash, SchemaArtifact id/hash/compiler, non-null activation evidence, protected validator refs (only `rich_text.v1` at version 1, each once), and editorial workflow-policy evidence; the server recomputes the version set of the named revision (`versionSetOf`, `Frozen dependency manifest build`) and requires equality, else 409 `CONFLICT` `version_set_stale` | 422; stale set 409 |
| CMS-03B-08            | audience/route                         | audience `^[a-z0-9_-]{1,48}$` (BE04c; the same grammar as schedule and publication, matched as submitted and never trimmed); route 1–2048 Unicode characters, a normalized site path: one leading slash and never `//host`, no query, fragment, backslash, C0/DEL/C1 control character, `.` or `..` or empty interior segment, and no percent-encoded dot, slash, or backslash; no external URL                                                                                                                                                                                                                                                          | 422                           |
| CMS-03B-08            | revisionId / If-Match                  | `revisionId` is a revision of an entry the caller holds preview scope on; the strong `If-Match` is the entry aggregate `version` (E5) and a moved entry is 409 `VERSION_MISMATCH`; no body `expectedVersion` exists | 404/403/409 |
| CMS-03B-09            | frozenHash/expectedVersionSet          | `frozenHash` is 64 lowercase hex equal to the approved review's `frozenHash` (a mismatch is 422 at `/frozenHash`); `expectedVersionSet` strictly equals both the version set frozen on the approved review and the version set recomputed from current canonical state, else 409 `CONFLICT` `version_set_stale`                                                                                                                                                                                                                                                         | 422/409                       |
| CMS-03B-09            | audience/revisionId/expectedVersion    | audience `^[a-z0-9_-]{1,48}$`; `revisionId` is the revision of an approved review; `expectedVersion` is the approved review's `version` and the strong `If-Match` equals it; the caller holds `cms.publisher` in the entry's owner party and is not the revision author (403 `separation_of_duties`) | 422/403/404/409 |
| CMS-03B-10            | contentTypeId/contentTypeVersionId     | UUIDs resolving to the same active compiled 03a schema with non-null activation evidence, exact SchemaArtifact id/hash/compiler, and protected validator refs; stale or off-registry identity rejects before mutation                                                                                                            | 422/404/403                   |
| CMS-03B-10            | changedPaths/values                    | 1–128 unique `/fields/{stableFieldId}` pointers (as CMS-03B-01); strict object keyed by stable field UUIDs, max 128 keys/8 levels/256 KiB; rich text is structured AST and no executable content                                                                                                                                | 422                           |
| CMS-03B-10            | locale                                 | BCP 47 2–35 chars validated against the active schema locale set, which is the active ContentTypeVersion's `supportedLocales` (03a Locale configuration (OD-4)); a locale outside it is 422                                                                                                                                      | 422                           |
| CMS-03B-10            | owner/assignee/authority               | rejected: caller must not supply owner, assignee, author, acting party, capability, or authority; the server derives every one of them                                                                                                                                                                                           | 422                           |
| CMS-03B-10            | headers                                | Idempotency-Key 8–128 printable ASCII; no If-Match for initial create; Content-Type application/json                                                                                                                                                                                                                             | 400 INVALID_REQUEST (Idempotency-Key, If-Match); 415 UNSUPPORTED_MEDIA_TYPE (Content-Type, BE00 step 3, before the body is read) |
| CMS-03B-11            | entryId                                | UUID path; must resolve to a readable active ContentEntry and its current readable immutable draft revision                                                                                                                                                                                                                      | 400 or policy-safe 404        |
| CMS-03B-12            | entryId/conflictId                     | UUID paths; the conflict must belong to the resolved readable entry and both must be readable                                                                                                                                                                                                                                    | 400/policy-safe 404           |
| CMS-03B-12            | query                                  | strict: no keys accepted (the resource is addressed entirely by path)                                                                                                                                                                                                                                                           | 400 INVALID_REQUEST           |
| CMS-03B-12            | paths / preimages                      | at most 128 `ConflictDetailPath` entries; each side value bounded to 256 KiB total and schema-typed against its side's `schemaVersionId`; only an `open` conflict is readable (a resolved or superseded conflict is the same 404 as an absent one); no ownership identifier is serialized                                                                                              | 422 response-contract failure |
| CMS-03B-13            | state/contentTypeId                    | `state` closed `EntryRevisionState` optional; `contentTypeId` UUID optional; only the caller's assigned/owned entries are ever listed                                                                                                                                                                                            | 400/422                       |
| CMS-03B-13            | cursor/limit                           | signed context-bound cursor ≤512 chars; limit integer 1–50 default 25; cursor bound to the complete query, the acting read scope and the collection epoch (`aheadDigest`: 32 lowercase hex; a missing or malformed member is 400, a well-formed digest that no longer matches the collection is 409 `CONFLICT`)                                                                                                                                                                                                  | 400                           |
| CMS-03B-14            | contentTypeVersionId                   | optional UUID; when present it must resolve to an active compiled version the caller may author; absent returns the caller's creatable active types                                                                                                                                                                             | 400/policy-safe 404           |
| CMS-03B-15            | entryId/revisionId                     | UUID path; optional `revisionId` UUID query member (default: the entry's current draft revision); strict query with no other key; a `revisionId` of another entry is the same 404 as an absent one | 400/policy-safe 404 |
| CMS-03B-15            | response bounds                        | `preparation` is non-null only when the revision's effective state is `draft` and the caller may submit; at most 17 preflight results, 16 schedules and 64 publications; `dependencyManifest` and `versionSet` satisfy the Slice 10 locked contracts | 422 response-contract failure |
| CMS-03B-16            | reviewId                               | UUID path; strict: no query key | 400/policy-safe 404 |
| CMS-03B-16            | decisions / assignments                | at most 8 decisions and 32 assignments; a decision exposes `id`, `decision`, `capability`, `decidedAt` and `mine`, and `reason` only on the caller's own decision; `assignments` is non-empty only for the receipt-derived owner and carries no person, actor or party identifier | 422 response-contract failure |
| CMS-03B-17            | scope/state                            | `scope` is `assigned` (default) or `submitted`; `state` is the closed `EditorialReviewState`, optional; strict: no other key | 400/422 |
| CMS-03B-17            | cursor/limit                           | signed context-bound cursor ≤512 chars; limit integer 1–50 default 25; the cursor is bound to the complete query and acting scope; fault classes follow DEC-140 (structural fault 400; expired, tampered or foreign-bound 409) | 400/409 |
| CMS-03B-18            | reviewId / action                      | UUID path; discriminated `action` `create` or `revoke`; strict members only | 400/422 |
| CMS-03B-18            | create                                 | `expectedVersion` positive decimal (the review `version`; the strong `If-Match` equals it); `reviewerPersonId` UUID of an existing human with a confirmed unended membership in the owner's organization who currently holds an active `cms.reviewer` grant, is neither the review submitter nor the revision author, and has no active assignment on this review; `expiresAt` an offset ISO instant after now, at most seven days after now, no later than the end of the reviewer's `cms.reviewer` grant day and no later than the grantor authority end (the end of the owner's current `cms.editor` grant day); `reason` optional 1–256 Unicode characters, NFC | 422/409/404 |
| CMS-03B-18            | revoke                                 | `assignmentId` UUID of an assignment on this review; revoking a missing assignment is 404 and an already revoked one is 409 | 404/409/422 |
| CMS-03B-18            | review state                           | the review is `open`; an approved, rejected or invalidated review accepts no assignment change (409 `CONFLICT` `review_not_open`); at most 16 active assignments per review (409 `assignment_limit`) | 409 |
| All mutation routes   | headers                                | Idempotency-Key 8–128 printable ASCII; exact strong If-Match; Content-Type application/json; CMS-03B-10 is the exception and requires Idempotency-Key without If-Match                                                                                                                                                           | 400 INVALID_REQUEST (Idempotency-Key, If-Match); 415 UNSUPPORTED_MEDIA_TYPE (Content-Type, BE00 step 3, before the body is read) |
| All browser responses | state/ownership envelope               | ResourceMeta contains only id, version, and timestamps; EntryRevision, EditorialReview, PublicationSchedule, Publication, and RevisionSummary use their exact closed state enums; ownership and approval authority evidence is absent                                                                                            | 422 response-contract failure |

## Request/Response Contracts (Zod 4 schemas)

Runtime Zod 4 schemas are the source for TypeScript, Hono validation, OpenAPI, tests, and JSONB checks. All objects are strict; unknown keys reject. Values are parsed against the active schema from 03a and are never accepted as untyped pass-through content.

```ts
const Bcp47 = z.string().regex(/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/);
const JsonPointer = z.string().regex(/^\/[^\u0000-\u001f]{0,255}$/);
// Command pointers (CMS-03B-01/02/10) and conflict pointers are fields only:
// `/fields/{stableFieldId}` with a lowercase UUID, exactly as the database accepts.
const FieldPointer = z
  .string()
  .regex(/^\/fields\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
// Decision reason: 1-2000 Unicode characters (code points), NFC, no control,
// U+2028/9 or bidirectional formatting character, no `<>{}`.
const SafeText = z
  .string()
  .max(4000)
  .refine((v) => [...v].length <= 2000)
  .refine((v) => v === v.normalize('NFC'))
  .refine((v) => !/[\p{Cc}  ‎‏؜‪-‮⁦-⁩]/u.test(v))
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
// Manifest and version-set validator refs name only a registered protected
// member (03a registry: `rich_text.v1` version 1), each once.
const ProtectedValidatorEvidence = z
  .strictObject({ key: z.enum(['rich_text.v1']), version: Version })
  .refine((v) => v.version === '1');
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
  validatorRefs: z.array(ProtectedValidatorEvidence).max(128),
  workflowPolicy: WorkflowPolicyEvidence,
  activationEvidence: WorkflowPolicyEvidence,
  templateVersionId: UUID.nullable(),
  templateHash: Hash.nullable(),
  // each id array names every id once
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
    validatorRefs: z.array(ProtectedValidatorEvidence).max(128),
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
  // Also enforced by a refinement: at most 256 entries in total (every list
  // element plus each present singleton: schema, template, settings, checker),
  // each group naming every identity once, and at most 32 KiB serialized.
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
    path: FieldPointer,
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
  expectedVersion: Version,
});
const PublicationScheduleRequest = z.strictObject({
  revisionId: UUID,
  action: z.enum(['publish', 'unpublish', 'expire', 'archive']),
  // Offset-free local ISO datetime with every component in range; the shape is
  // `YYYY-MM-DDTHH:mm[:ss[.f{1,9}]]` (zod's `datetime({ offset: false })` still
  // requires `Z`, so the contract uses a range-checked local pattern instead).
  localDateTime: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/),
  // One to three `/`-separated IANA name segments (UTC, America/New_York,
  // America/Argentina/Buenos_Aires); no `.`/`..` segment; membership in the
  // pinned tz database is checked by the Time authority (E8).
  timezone: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z][A-Za-z0-9_+.-]*(?:\/[A-Za-z0-9_+.-]+){0,2}$/),
  // Server-verified equal to the instant of localDateTime in timezone under
  // disambiguation, at least 60 seconds and at most 366 days after acceptance.
  resolvedUtc: z.string().datetime({ offset: true }),
  // Must equal the server-pinned CMS_TZDB_VERSION (Time authority, E8).
  tzdbVersion: z.string().min(1).max(32),
  disambiguation: z.enum(['none', 'earlier', 'later']),
  audience: z.string().regex(/^[a-z0-9_-]{1,48}$/),
  // The approved review's version; the strong If-Match equals it.
  expectedVersion: Version,
});
const PreviewRequest = z.strictObject({
  entryId: UUID,
  revisionId: UUID,
  locale: Bcp47,
  audience: z.string().regex(/^[a-z0-9_-]{1,48}$/),
  // A normalized site path of at most 2048 Unicode characters: one leading slash
  // (never `//host`), no query, fragment, backslash, C0/DEL/C1 control character,
  // `.`/`..`/empty interior segment, or percent-encoded dot, slash, or backslash.
  route: z.string().max(4096),
  versionSet: VersionSet,
});
const PublicationRequest = z.strictObject({
  entryId: UUID,
  revisionId: UUID,
  frozenHash: Hash,
  expectedVersionSet: VersionSet,
  audience: z.string().regex(/^[a-z0-9_-]{1,48}$/),
  expectedVersion: Version,
});
const ConflictDetailQuery = z.strictObject({});
const EntryListQuery = z.strictObject({
  cursor: z.string().max(512).nullable().optional(),
  limit: z.number().int().min(1).max(50).default(25),
  state: EntryRevisionState.optional(),
  contentTypeId: UUID.optional(),
});
const AuthoringContextQuery = z.strictObject({
  contentTypeVersionId: UUID.optional(),
});
// Slice 11 (CMS-03B-15 .. CMS-03B-19).
const EntryWorkflowQuery = z.strictObject({
  entryId: UUID,
  // Default: the entry's current draft revision.
  revisionId: UUID.optional(),
});
const ReviewQueueScope = z.enum(['assigned', 'submitted']);
const ReviewQueueQuery = z.strictObject({
  cursor: z.string().max(512).nullable().optional(),
  limit: z.number().int().min(1).max(50).default(25),
  scope: ReviewQueueScope.default('assigned'),
  state: EditorialReviewState.optional(),
});
// DEC-136: mirrors 03a SchemaReviewAssignmentRequest (CMS-03A-14).
const EditorialReviewAssignmentRequest = z.discriminatedUnion('action', [
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
// CMS-03B-19, aligned with the BE04c `Shard 03 preview-token verifier` seam.
const PreviewVerificationRequest = z.strictObject({
  // Lowercase SHA-256 hex of the presented token string (UTF-8 bytes).
  tokenHash: Hash,
  actorPersonId: UUID,
  // The token's capability_snapshot_hash the caller resolved for the actor.
  actingContextVersion: Hash,
  route: z.string().max(4096),
  locale: Bcp47,
  audience: z.string().regex(/^[a-z0-9_-]{1,48}$/),
});
// Shared by the schedule time fields (flattened in PublicationScheduleRequest,
// locked by G3) and by 03c governed scheduled activation (OD-6).
const ScheduledInstant = z.strictObject({
  localDateTime: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/),
  timezone: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z][A-Za-z0-9_+.-]*(?:\/[A-Za-z0-9_+.-]+){0,2}$/),
  resolvedUtc: z.string().datetime({ offset: true }),
  tzdbVersion: z.string().regex(/^[A-Za-z0-9._-]{1,32}$/),
  disambiguation: z.enum(['none', 'earlier', 'later']),
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

In the authoring draft read (CMS-03B-11) an unavailable target under the
`placeholder` policy is returned in place of the target as an `EntryDraftRelation`
that carries only `fieldId`, `fieldDefinitionId`, `position`, `onUnavailable:
'placeholder'` and the fixed `unavailable` object, so a deleted, private,
embargoed, concealed, stale or absent target is indistinguishable and no target
ID, kind, version, key, title or data accompanies the fallback; a resolved
relation always carries `unavailable: null`, and a relation can never carry both
a target and the fallback (P2-S09-AC-081, AC203).

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
// E3: physical rows are `active` or `revoked`; `superseded` is derived for an
// `active` row that is no longer the head of its lineage. Projection
// convergence is `projectionState`, never a publication state.
const PublicationState = z.enum(['active', 'superseded', 'revoked']);
const ResourceMeta = z.strictObject({
  id: UUID,
  version: Version,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
// `version` is the immutable revision snapshot's own version (always 1) and is
// never a CAS operand. `entryVersion` is the ContentEntry aggregate version this
// commit produced (the request's expectedVersion plus one): the ONLY valid next
// expectedVersion / strong If-Match, and exactly the strong ETag of the 201.
const EntryRevisionResource = ResourceMeta.extend({
  entryVersion: Version,
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
    value.resolvedRevisionId === null && value.resolvedAt === null;
  const resolvedBound =
    value.resolvedRevisionId !== null && value.resolvedAt !== null;
  if (value.state === 'resolved' ? !resolvedBound : !resolvedNull) {
    ctx.addIssue({
      code: 'custom',
      path: ['state'],
      message:
        'resolved requires resolvedRevisionId/resolvedAt; open/superseded require both null',
    });
  }
});
const EditorialReviewBase = ResourceMeta.extend({
  state: EditorialReviewState,
  entryId: UUID,
  revisionId: UUID,
  riskClass: z.enum(['ordinary', 'protected']),
  workflowPolicy: WorkflowPolicyEvidence,
  activationEvidence: WorkflowPolicyEvidence,
  frozenHash: Hash,
  requiredDecisionCount: z.number().int().min(1).max(8),
  recordedDecisionCount: z.number().int().min(0).max(8),
  dependencyHash: Hash,
  // Closed token set (Review invalidation).
  invalidatedReason: z
    .enum([
      'revision_superseded',
      'dependency_changed',
      'reviewer_authority_changed',
      'entry_unavailable',
    ])
    .nullable(),
  submittedAt: z.string().datetime({ offset: true }),
  // Non-null exactly for approved and rejected reviews.
  decidedAt: z.string().datetime({ offset: true }).nullable(),
});
const checkEditorialReview = (
  value: z.infer<typeof EditorialReviewBase>,
  ctx: z.RefinementCtx,
): void => {
  if ((value.state === 'invalidated') !== (value.invalidatedReason !== null)) {
    ctx.addIssue({
      code: 'custom',
      path: ['invalidatedReason'],
      message: 'invalidatedReason exists exactly when the review is invalidated',
    });
  }
  if (
    (value.state === 'approved' || value.state === 'rejected') !==
    (value.decidedAt !== null)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['decidedAt'],
      message: 'decidedAt exists exactly when the review is approved or rejected',
    });
  }
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
};
const EditorialReviewResource = EditorialReviewBase.superRefine(
  checkEditorialReview,
);
const PublicationScheduleResource = ResourceMeta.extend({
  state: PublicationScheduleState,
  entryId: UUID,
  revisionId: UUID,
  action: z.enum(['publish', 'unpublish', 'expire', 'archive']),
  // Offset-free local ISO datetime with every component in range; the shape is
  // `YYYY-MM-DDTHH:mm[:ss[.f{1,9}]]` (zod's `datetime({ offset: false })` still
  // requires `Z`, so the contract uses a range-checked local pattern instead).
  localDateTime: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/),
  // One to three `/`-separated IANA name segments (UTC, America/New_York,
  // America/Argentina/Buenos_Aires); no `.`/`..` segment; tzdb membership is runtime.
  timezone: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z][A-Za-z0-9_+.-]*(?:\/[A-Za-z0-9_+.-]+){0,2}$/),
  resolvedUtc: z.string().datetime({ offset: true }),
  tzdbVersion: z.string().regex(/^[A-Za-z0-9._-]{1,32}$/),
  disambiguation: z.enum(['none', 'earlier', 'later']),
  // E9: the target lineage is (entry of the revision, revision locale, audience).
  audience: z.string().regex(/^[a-z0-9_-]{1,48}$/),
  jobId: UUID.nullable(),
  actualUtc: z.string().datetime({ offset: true }).nullable(),
  deviationSeconds: z.number().int().nullable(),
  // Non-null exactly when state is blocked or cancelled; a closed token from
  // the reason set of Schedule execution (CMS-03B-20).
  reasonCode: z
    .string()
    .regex(/^[a-z][a-z0-9_]{0,63}$/)
    .nullable(),
  attemptCount: z.number().int().min(0).max(3),
});
const PreviewTokenResource = z.strictObject({
  token: z.string().min(43).max(512),
  expiresAt: z.string().datetime({ offset: true }),
  entryId: UUID,
  revisionId: UUID,
  locale: Bcp47,
  audience: z.string().regex(/^[a-z0-9_-]{1,48}$/),
  route: z.string().max(4096), // normalized site path, as PreviewRequest.route
  versionSet: VersionSet,
  revoked: z.boolean(),
});
// E3: `id` is the stable lineage id (`publication_id`) of (entry, locale,
// audience) and `version` the lineage sequence of the returned row;
// `publicationVersionId` is that row's own id (the event payload id).
const PublicationResource = ResourceMeta.extend({
  state: PublicationState,
  action: z.enum(['publish', 'unpublish', 'expire', 'archive']),
  publicationVersionId: UUID,
  entryId: UUID,
  revisionId: UUID,
  locale: Bcp47,
  audience: z.string().regex(/^[a-z0-9_-]{1,48}$/),
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
      restore: z
        .strictObject({
          migrationChainId: UUID,
          edgeCount: z.number().int().min(0).max(64),
          chainHash: Hash,
          availability: z.enum([
            'available',
            'chain_unavailable',
            'transform_missing',
          ]),
        })
        .nullable(),
      changes: z
        .array(
          z.strictObject({
            domain: z.enum(['field', 'block', 'relation']),
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
const OpaqueUnavailable = z.strictObject({
  status: z.literal('unavailable'),
  reason: z.literal('unavailable'),
});
// A target the recheck found readable: the target binding, with no placeholder.
const ResolvedEntryDraftRelation = z.strictObject({
  fieldId: UUID,
  fieldDefinitionId: UUID,
  targetKind: z.string().regex(/^[a-z][a-z0-9._-]{0,95}$/),
  targetId: UUID,
  expectedTargetVersion: Version.nullable(),
  position: z.number().int().min(0).max(511),
  onUnavailable: z.enum(['omit', 'block', 'placeholder']),
  unavailable: z.null(),
});
// An unavailable target under the `placeholder` policy: nothing of the target
// (no id, kind, version, key, title or data) remains beside the fixed object.
const PlaceholderEntryDraftRelation = z.strictObject({
  fieldId: UUID,
  fieldDefinitionId: UUID,
  position: z.number().int().min(0).max(511),
  onUnavailable: z.literal('placeholder'),
  unavailable: OpaqueUnavailable,
});
const EntryDraftRelation = z.union([
  ResolvedEntryDraftRelation,
  PlaceholderEntryDraftRelation,
]);
const EntryDraftDetailResource = z.strictObject({
  entry: ResourceMeta,
  revision: ResourceMeta,
  revisionNumber: Version,
  schemaVersionId: UUID,
  lifecycle: z.enum(['active', 'archived', 'deletion_pending', 'held']),
  state: EntryRevisionState,
  locale: Bcp47,
  contentHash: Hash,
  validationState: z.enum(['valid', 'invalid', 'unknown']),
  openConflict: z
    .strictObject({
      conflictId: UUID,
      version: Version,
      conflictHash: Hash,
    })
    .nullable(),
  fields: z.array(EntryDraftFieldValue).max(128),
  relations: z.array(EntryDraftRelation).max(512),
});
const ConflictDetailSide = z.strictObject({
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
const ConflictDetailPath = z.strictObject({
  path: JsonPointer,
  base: ConflictDetailSide,
  theirs: ConflictDetailSide,
  yours: ConflictDetailSide,
});
// DEC-139: the server serves a conflict only while it is `open`, so every served
// resource has `conflict.state` `open`, `resolvedRevisionId` null and a non-empty
// `paths`; a resolved or superseded conflict is the same 404 as an absent one. The
// closed enum members remain only because the shared ConflictRecordState
// vocabulary is reused; a response with a closed state is a server contract
// violation, never rendered as metadata.
const ConflictDetailResource = z.strictObject({
  conflict: ResourceMeta.extend({
    state: ConflictRecordState,
    changedPaths: z.array(FieldPointer).min(1).max(128),
    conflictHash: Hash,
  }),
  entry: ResourceMeta,
  base: z.strictObject({
    revisionId: UUID,
    revisionNumber: Version,
    schemaVersionId: UUID,
    contentHash: Hash,
  }),
  theirs: z.strictObject({
    revisionId: UUID,
    revisionNumber: Version,
    schemaVersionId: UUID,
    contentHash: Hash,
  }),
  yours: z.strictObject({
    source: ConflictYoursSource,
    revisionId: UUID.nullable(),
    contentHash: Hash,
  }),
  paths: z.array(ConflictDetailPath).max(128),
  resolvedRevisionId: UUID.nullable(),
});
// DEC-145: a RevisionSummary plus the owning entry, its server-derived lifecycle
// and last-update instant (no owner, assignee, or acting-party identifier).
const EntryListItem = RevisionSummary.extend({
  entryId: UUID,
  entryLifecycle: z.enum(['active', 'archived', 'deletion_pending', 'held']),
  entryUpdatedAt: z.string().datetime({ offset: true }),
});
const EntryListPage = z.strictObject({
  items: z.array(EntryListItem).max(50),
  nextCursor: z.string().max(512).nullable(),
  pageVersion: Version,
});
const AuthoringContextType = z.strictObject({
  contentTypeId: UUID,
  contentTypeVersionId: UUID,
  label: z.string().min(1).max(120),
  sourceLocale: Bcp47,
  defaultLocale: Bcp47,
  supportedLocales: z.array(Bcp47).min(1).max(32),
  schemaArtifact: SchemaArtifactEvidence,
  validatorRefs: z.array(ValidatorEvidence).max(128),
  workflowPolicy: WorkflowPolicyEvidence,
  activationEvidence: WorkflowPolicyEvidence,
});
const AuthoringContextField = z.strictObject({
  stableFieldId: UUID,
  key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  kind: z.enum([
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
  ]),
  constraints: z.record(z.string(), Json),
  required: z.boolean(),
  defaultMode: z.enum(['none', 'literal', 'inherited']),
  defaultValue: Json.nullable().optional(),
  localizationMode: z.enum(['none', 'localized', 'no_fallback']),
  editorConfig: z.strictObject({
    label: z.string().min(1).max(120),
    helpText: z.string().max(500).optional(),
    order: z.number().int().nonnegative().max(10000),
  }),
  relationDefinition: Json.nullable(),
});
const AuthoringContextResource = z.strictObject({
  creatableTypes: z.array(AuthoringContextType).max(32),
  selectedType: AuthoringContextType.nullable(),
  fields: z.array(AuthoringContextField).max(128),
});

// ---- Slice 11 resources (CMS-03B-15 .. CMS-03B-20) ----

// D19: the closed preflight category set of the code-owned registry
// (`Publication preflight registry`), in registry order.
const PreflightCategory = z.enum([
  'contract',
  'schema',
  'template',
  'block',
  'pattern',
  'taxonomy',
  'settings',
  'relation',
  'privacy',
  'security',
  'accessibility',
  'media',
  'route',
  'locale',
  'migration',
  'domain_binding',
  'revocation',
]);
const PreflightOutcome = z.enum(['passed', 'failed', 'unavailable']);
const PreflightResult = z
  .strictObject({
    category: PreflightCategory,
    outcome: PreflightOutcome,
    providerKey: z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/),
    providerVersion: Version,
    // Null exactly when outcome is `passed`; otherwise a closed lowercase token
    // from the provider's registered reason set.
    reasonCode: z
      .string()
      .regex(/^[a-z][a-z0-9_]{0,63}$/)
      .nullable(),
    blockingCount: z.number().int().min(0).max(1000),
  })
  .refine((v) => (v.outcome === 'passed') === (v.reasonCode === null));
const PreflightReport = z
  .strictObject({
    evaluatedAt: z.string().datetime({ offset: true }),
    passed: z.boolean(),
    // Exactly one result per category, in registry order.
    results: z.array(PreflightResult).length(17),
  })
  .refine((v) => v.passed === v.results.every((r) => r.outcome === 'passed'))
  .refine(
    (v) => new Set(v.results.map((r) => r.category)).size === v.results.length,
  );
// Worker-resident providers (the D25 accessibility checker) hand the RPC this
// evidence; it is never a browser contract (`Publication preflight registry`).
const PreflightEvidence = z.strictObject({
  category: z.literal('accessibility'),
  providerKey: z.literal('cms.a11y.structural'),
  providerVersion: Version,
  outcome: PreflightOutcome,
  blockingCount: z.number().int().min(0).max(1000),
  // BE05c inputHash of the exact run.
  inputHash: Hash,
  // SHA-256 of the JCS `{ checkerKey, checkerVersion, revisionId,
  // revisionContentHash, dependencyHash }` the Worker evaluated; the RPC
  // recomputes it from canonical rows and refuses a mismatch.
  bindingHash: Hash,
  evaluatedAt: z.string().datetime({ offset: true }),
});
// What a review freezes and what CMS-03B-07/08/09 must echo. `versionSet` is
// the pure projection `versionSetOf(dependencyManifest, revision)`.
const FrozenCandidate = z.strictObject({
  frozenHash: Hash,
  dependencyHash: Hash,
  versionSet: VersionSet,
});
const WorkflowNextAction = z.enum([
  'submit_review',
  'assign_reviewer',
  'record_decision',
  'schedule',
  'preview',
  'publish',
]);
const EntryWorkflowRevision = z.strictObject({
  id: UUID,
  revisionNumber: Version,
  locale: Bcp47,
  schemaVersionId: UUID,
  // Derived by the one effective-state helper (E2).
  state: EntryRevisionState,
  contentHash: Hash,
  validationState: z.enum(['valid', 'invalid', 'unknown']),
  isCurrentDraft: z.boolean(),
});
const EntryWorkflowPreparation = z.strictObject({
  frozenHash: Hash,
  dependencyManifest: DependencyManifest,
  dependencyHash: Hash,
  versionSet: VersionSet,
  riskClass: z.enum(['ordinary', 'protected']),
  workflowPolicy: WorkflowPolicyEvidence,
  // Non-authoritative read-only evaluation; every command re-runs it.
  preflight: PreflightReport,
});
const EntryWorkflowSchedule = z.strictObject({
  id: UUID,
  version: Version,
  state: PublicationScheduleState,
  action: z.enum(['publish', 'unpublish', 'expire', 'archive']),
  audience: z.string().regex(/^[a-z0-9_-]{1,48}$/),
  resolvedUtc: z.string().datetime({ offset: true }),
  reasonCode: z
    .string()
    .regex(/^[a-z][a-z0-9_]{0,63}$/)
    .nullable(),
});
const EntryWorkflowPublication = z.strictObject({
  publicationId: UUID,
  publicationVersionId: UUID,
  version: Version,
  state: PublicationState,
  action: z.enum(['publish', 'unpublish', 'expire', 'archive']),
  revisionId: UUID,
  locale: Bcp47,
  audience: z.string().regex(/^[a-z0-9_-]{1,48}$/),
  publicationHash: Hash,
  projectionState: z.enum(['pending', 'converged', 'degraded']),
  createdAt: z.string().datetime({ offset: true }),
});
// CMS-03B-15. `entry.version` is the If-Match operand of CMS-03B-05 and
// CMS-03B-08; `review.version` the one of CMS-03B-06/07/09/18.
const EntryWorkflowResource = z.strictObject({
  entry: ResourceMeta,
  revision: EntryWorkflowRevision,
  preparation: EntryWorkflowPreparation.nullable(),
  review: EditorialReviewBase.extend({ frozen: FrozenCandidate })
    .superRefine(checkEditorialReview)
    .nullable(),
  schedules: z.array(EntryWorkflowSchedule).max(16),
  publications: z.array(EntryWorkflowPublication).max(64),
  permittedNextActions: z.array(WorkflowNextAction).max(6),
});
// CMS-03B-16.
const ReviewNextAction = z.enum([
  'record_decision',
  'assign_reviewer',
  'revoke_assignment',
  'schedule',
  'publish',
]);
const EditorialDecisionSummary = z.strictObject({
  id: UUID,
  decision: z.enum(['approve', 'reject']),
  // The satisfied slot capability (server-derived at decision time).
  capability: CapabilityKey,
  decidedAt: z.string().datetime({ offset: true }),
  mine: z.boolean(),
  // Non-null only on the caller's own decision.
  reason: SafeText.nullable(),
});
const EditorialReviewAssignmentSummary = z.strictObject({
  assignmentId: UUID,
  version: Version,
  state: z.enum(['active', 'revoked']),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  // Server-built display label, never an identifier.
  reviewerLabel: z.string().min(1).max(120),
});
const EditorialReviewDetailResource = EditorialReviewBase.extend({
  revisionNumber: Version,
  locale: Bcp47,
  contentTypeLabel: z.string().min(1).max(120),
  frozen: FrozenCandidate,
  // Distinct humans who still qualify (live recount); never above the
  // number of approve decisions.
  distinctApprovalCount: z.number().int().min(0).max(8),
  decisions: z.array(EditorialDecisionSummary).max(8),
  // Owner-only; every other reader receives []. No person, actor or party id.
  assignments: z.array(EditorialReviewAssignmentSummary).max(32).default([]),
  myAssignment: z
    .strictObject({
      assignmentId: UUID,
      endsAt: z.string().datetime({ offset: true }),
    })
    .nullable(),
  permittedNextActions: z.array(ReviewNextAction).max(5),
}).superRefine(checkEditorialReview);
// CMS-03B-17.
const ReviewQueueItem = z.strictObject({
  reviewId: UUID,
  entryId: UUID,
  revisionId: UUID,
  revisionNumber: Version,
  locale: Bcp47,
  contentTypeLabel: z.string().min(1).max(120),
  state: EditorialReviewState,
  riskClass: z.enum(['ordinary', 'protected']),
  requiredDecisionCount: z.number().int().min(1).max(8),
  recordedDecisionCount: z.number().int().min(0).max(8),
  myDecision: z.enum(['none', 'approve', 'reject']),
  // The caller's active assignment end for scope `assigned`, else null.
  assignmentEndsAt: z.string().datetime({ offset: true }).nullable(),
  submittedAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
const ReviewQueuePage = z.strictObject({
  items: z.array(ReviewQueueItem).max(50),
  nextCursor: z.string().max(512).nullable(),
  pageVersion: Version,
});
// CMS-03B-18 (DEC-136), mirroring 03a SchemaReviewAssignmentResource.
const EditorialReviewAssignmentResource = ResourceMeta.extend({
  reviewId: UUID,
  state: z.enum(['active', 'revoked']),
  capability: z.literal('cms.editorial_review'),
  actions: z.tuple([z.literal('read'), z.literal('decide')]),
  startsAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  reason: z.string().min(1).max(256).nullable(),
});
// CMS-03B-19. An invalid result is byte-identical for every denial cause
// except `revoked`, which is true only for the token's own bound actor.
const PreviewVerificationResult = z.discriminatedUnion('valid', [
  z.strictObject({
    valid: z.literal(true),
    userId: UUID,
    entryId: UUID,
    revisionId: UUID,
    exactVersionSet: VersionSet,
    expiresAt: z.string().datetime({ offset: true }),
    revoked: z.literal(false),
  }),
  z.strictObject({
    valid: z.literal(false),
    userId: z.null(),
    entryId: z.null(),
    revisionId: z.null(),
    exactVersionSet: z.null(),
    expiresAt: z.null(),
    revoked: z.boolean(),
  }),
]);
// CMS-03B-20.
const ClaimedSchedule = z.strictObject({
  scheduleId: UUID,
  revisionId: UUID,
  // The schedule row version produced by the claim (the CAS operand).
  scheduleVersion: Version,
  // The approved review version stored at schedule time (`expected_version`).
  expectedVersion: Version,
  leaseId: UUID,
  dependencyHash: Hash,
  activationEvidenceHash: Hash,
  correlationId: UUID,
});
const ScheduleExecutionResult = z.strictObject({
  scheduleId: UUID,
  outcome: z.enum([
    'completed',
    'blocked',
    'failed_retryable',
    'already_completed',
  ]),
  reasonCode: z
    .string()
    .regex(/^[a-z][a-z0-9_]{0,63}$/)
    .nullable(),
  publicationVersionId: UUID.nullable(),
  actualUtc: z.string().datetime({ offset: true }).nullable(),
  deviationSeconds: z.number().int().nullable(),
});
```

### Draft base and schema identity (D3)

`EntryDraftDetailResource` carries the server-derived `revisionNumber` (from `cms_entry_revisions.revision_number`) and `schemaVersionId` (the verified current draft schema), plus `openConflict` (the single durable open conflict, or null) so the editor survives a 409 and a reload. For CMS-03B-01 the request `baseRevision` is this `revisionNumber` and `expectedVersion` is `entry.version`; the composite GET `ETag` is a representation validator only and is never used as the numeric `If-Match`. The editor builds field definitions from the authoring-context read, never from a caller-chosen schema.

### Value encodings by field kind

Values are parsed against the active schema from 03a and are never untyped pass-through. A field whose kind has no available producer refuses at write with a typed reason instead of storing an unvalidated value.

- **rich_text**: a `rich_text.v1` AST (below). The AST is the canonical value; `valueHash` is the JCS SHA-256 of the canonical value.
- **relation**: `{ targets: [{ targetId: UUID, expectedTargetVersion: Version | null }] }`, ordered, with `position` = index. `targetKind`, `projectionKey`, and `onUnavailable` come only from the immutable 03a `RelationDefinition`. The count is bounded by the definition `min`/`max` and by 512. Content targets resolve now; a domain-kind target with no registered projection fails closed with typed 422 reason `relation_target_unavailable`. A relation value is written only to normalized `EntryRelation` rows (never an `EntryFieldValue`, never part of `contentHash`) on create, append, and conflict resolution. A content target must be an active entry of the owning party of the declared active target type over which the caller holds author or editor authority (the draft-read predicate); a duplicate target, an absent, hidden, unassigned, inactive, or wrong-type target, and an `expectedTargetVersion` that does not equal the target's current version are the uniform 422 `VALIDATION_FAILED`, so a write is never an existence oracle. A pin on the entry itself is re-pinned to the entry version being committed. An empty `targets` array clears the relation and a JSON null is refused. A conflict over a relation field is detected, recorded, and resolved in the canonical relation form, where a relation with no rows equals an empty one.
- **list**: an array of `itemKind` values with count ≤ 128. `itemKind` must be a scalar kind or `enum`; a nested `list`/`object`/`relation`/`media`/`rich_text` item is refused at activation by 03a.
- **taxonomy**: `{ termIds: UUID[] ≤ 128 }` persisted as 03c `TermAssignment` rows bound to the active `TaxonomyVersion`. Until Slice 12 registers the taxonomy authority a non-empty value fails closed with typed reason `taxonomy_source_unavailable`. Once registered (03c `Taxonomy versions, canonical projection and term governance`), each `termId` must be an `active` term of a vocabulary whose active version lists the entry's content type key in `allowedTypeKeys` and the field's key in `allowedFieldKeys`; a merged, deprecated-for-assignment, unknown or other-vocabulary term is the uniform 422 `VALIDATION_FAILED` reason `term_unavailable`, and the revision's `taxonomy_version_ids` are the active version ids of the vocabularies of its terms.
- **media**: `{ assetId: UUID, assetVersion: Version }` (or an array per list). A non-empty value fails closed with typed reason `media_source_unavailable` until the media provider exists.
- **object**: the DEC-133 typed depth-1 `properties[]` structure below. A field declared `object` without that structure, or an object value that does not satisfy it, is refused with typed 422 reason `object_kind_unspecified` or `object_property_invalid`; there is no untyped pass-through.
- **Reason tokens**: every typed 422 reason above (`rich_text_not_canonical`, `object_kind_unspecified`, `object_property_invalid`, `relation_target_unavailable`, `taxonomy_source_unavailable`, `term_unavailable` once the taxonomy authority exists, `media_source_unavailable`) is raised by the database as the whole `P0001` exception message (the lowercase token, no prefix or detail) and the Worker maps it to 422 `VALIDATION_FAILED` with that `reasonCode`; every other value failure is the bare `VALIDATION_FAILED`.
- **Pointers**: `/fields/{stableFieldId}` for every field kind. `/blocks/…` is refused by CMS-03B-01 until a composition write path exists (03c owns composition writes); the CMS-07 comparison may still report block-domain changes from stored composition instances (below).

### `object` field structure (DEC-133 / O1 Option A)

The `object` kind declares a typed depth-1 `properties[]` with at most 32 properties. Each property has a stable key, a `scalar`/`enum`/`rich_text` kind, a required flag, and constraints. The structure is compiled into the artifact (03a) and every value is validated against it by this shard at write, restore, preview, and publication.

```ts
const ObjectPropertyKind = z.enum(['scalar', 'enum', 'rich_text']);
// DEC-144: `constraints` is a closed vocabulary per property kind (mirroring the
// 03a field-level members), enforced identically in TypeScript and PostgreSQL.
const ObjectPropertyLength = z.number().int().nonnegative().max(100000);
const ObjectPropertyBase = {
  key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/),
  required: z.boolean(),
};
const ObjectProperty = z.discriminatedUnion('kind', [
  z.strictObject({
    ...ObjectPropertyBase,
    kind: z.literal('scalar'),
    constraints: z.strictObject({
      minLength: ObjectPropertyLength.optional(),
      maxLength: ObjectPropertyLength.optional(),
      minimum: z.number().finite().optional(),
      maximum: z.number().finite().optional(),
    }),
  }),
  z.strictObject({
    ...ObjectPropertyBase,
    kind: z.literal('enum'),
    constraints: z.strictObject({
      enumValues: z.array(z.string().max(160)).min(1).max(256),
      minLength: ObjectPropertyLength.optional(),
      maxLength: ObjectPropertyLength.optional(),
    }),
  }),
  z.strictObject({
    ...ObjectPropertyBase,
    kind: z.literal('rich_text'),
    constraints: z.strictObject({
      minLength: ObjectPropertyLength.optional(),
      maxLength: ObjectPropertyLength.optional(),
    }),
  }),
]);
const ObjectStructure = z
  .strictObject({ properties: z.array(ObjectProperty).max(32) })
  .superRefine((value, ctx) => {
    const keys = value.properties.map((property) => property.key);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['properties'],
        message: 'object properties must have unique stable keys',
      });
    }
    for (const [index, property] of value.properties.entries()) {
      const { minLength, maxLength } = property.constraints;
      if (minLength !== undefined && maxLength !== undefined && minLength > maxLength) {
        ctx.addIssue({
          code: 'custom',
          path: ['properties', index, 'constraints', 'minLength'],
          message: 'minLength exceeds maxLength',
        });
      }
      if (property.kind === 'scalar') {
        const { minimum, maximum } = property.constraints;
        if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
          ctx.addIssue({
            code: 'custom',
            path: ['properties', index, 'constraints', 'minimum'],
            message: 'minimum exceeds maximum',
          });
        }
      }
    }
  });
```

The `object` value is a strict object keyed by the declared property keys. Depth is exactly 1 (a property value is a scalar, an enum member, or a `rich_text.v1` AST, never a nested object or array); an unknown key, a missing required key, a kind mismatch, or a value that violates its property's declared constraints is 422 (DEC-144): a string scalar honours `minLength`/`maxLength` (Unicode characters), a number scalar `minimum`/`maximum`, an enum value its choice set plus `minLength`/`maxLength`, a `rich_text` value `minLength`/`maxLength` over the total NFC text; a boolean is constrained by neither family, and a JSON null is never a scalar value. The `ObjectStructure` is stored inside the 03a `constraints` for the field and is included in the frozen definition hash and compiled artifact.

### `rich_text.v1` value grammar (DEC-112)

```ts
const RichTextMark = z.enum(['bold', 'italic', 'code']);
const RichTextLink = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('https'),
    href: z
      .string()
      .refine((href) => [...href].length <= 2048)
      .regex(/^https:\/\/[^\s@/]+(\/[^\s]*)?$/)
      .refine((href) => !/[\u0000-\u001f\u007f-\u009f]/.test(href)),
  }),
  z.strictObject({
    kind: z.literal('mailto'),
    address: z
      .string()
      .refine((address) => [...address].length >= 3 && [...address].length <= 254)
      .regex(/^[^\s@]+@[^\s@]+$/)
      .refine((address) => !/[\u0000-\u001f\u007f-\u009f]/.test(address)),
  }),
  z.strictObject({
    kind: z.literal('internal'),
    // Absolute normalised path: no protocol-relative prefix, no query,
    // fragment, backslash, C0/DEL/C1 character or `.`/`..` segment, at most
    // 2048 Unicode characters (code points).
    route: z
      .string()
      .regex(/^\/(?!\/)[^\u0000-\u001f\u007f-\u009f?#\\]*$/)
      .refine((route) => !/(^|\/)\.\.?(\/|$)/.test(route))
      .refine((route) => [...route].length <= 2048),
  }),
]);
const RichTextSpan = z.strictObject({
  text: z
    .string()
    .min(1)
    .refine((value) => value === value.normalize('NFC'), 'text must be NFC')
    .refine(
      (value) => !/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/.test(value),
      'text must not contain control characters',
    ),
  marks: z.array(RichTextMark).max(3),
  link: RichTextLink.optional(),
});
const RichTextBlock = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('paragraph'),
    spans: z.array(RichTextSpan).max(128),
  }),
  z.strictObject({
    type: z.literal('heading'),
    level: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    spans: z.array(RichTextSpan).min(1).max(128),
  }),
  z.strictObject({
    type: z.literal('list_item'),
    list: z.enum(['bulleted', 'numbered']),
    depth: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    spans: z.array(RichTextSpan).max(128),
  }),
  z.strictObject({
    type: z.literal('quote'),
    spans: z.array(RichTextSpan).min(1).max(128),
  }),
]);
const RichTextV1 = z.strictObject({
  format: z.literal('rich_text.v1'),
  blocks: z.array(RichTextBlock).min(1).max(128),
});
```

Normative rules. The representation is flat (a list is a maximal run of consecutive `list_item` blocks with the same `list`; `depth` increases by at most 1 from the previous item and the first item is depth 1; a multi-paragraph quote is consecutive `quote` blocks), so the stored container depth is ≤ 7. Only canonical form is accepted: text is NFC, no empty spans, adjacent spans with equal marks and link are merged, `marks` are unique and in enum order, and `link` is absent rather than null. Non-canonical input is refused with 422 reason `rich_text_not_canonical` rather than canonicalized server-side, so client and server `valueHash` stay equal. Bounds use the existing caps (128 blocks, 128 spans per block, 256 KiB per request) plus 03a `minLength`/`maxLength` over the total NFC text length. No inline embeds, images, HTML, CSS, attributes, or unknown keys are admitted; media goes through governed blocks. Link targets are not resolved at save; unsafe schemes (`javascript:`, `data:`, protocol-relative) are refused by the grammar. No link target carries a C0, DEL, or C1 control character; an `internal` route additionally refuses a backslash anywhere (a browser reads `/\host` as `//host`) and any `.`/`..` path segment; `https`/`mailto` targets refuse Unicode whitespace as JavaScript's `\s` defines it (spelled out explicitly in SQL so no database locale changes the class). Every `rich_text.v1` length bound (span text 10000, `https` href 2048, `mailto` address 3..254, `internal` route 2048, and the 03a `minLength`/`maxLength` over the total NFC text) counts Unicode characters (code points; BE03a "Unicode characters"), never UTF-16 code units, identically in TypeScript and `platform_private.cms_rich_text_v1_valid`; the shared corpus is `supabase/tests/phase_02_slice_10_rich_text_link_parity.sql`, parsed by the TypeScript parity test. The validator is code-owned (`CMS_RICH_TEXT_FORMATS = ['rich_text.v1']`, mirrored by `platform_private.cms_rich_text_v1_valid(jsonb)`) and `rich_text.v1` is registered as a protected validator key/version in the 03a validator registry with a canonical immutable grammar descriptor whose JCS SHA-256 and artifact reference `cms/validators/rich_text.v1/v1` are frozen into every compiled artifact that uses the grammar and revalidated before create, append, conflict resolution, and restore (DEC-146); a field-level 03a `validatorKey` stays optional and additive. The typed React/Astro renderer is `<p>`, `<h2-4>`, grouped `<ul>/<ol><li>`, `<blockquote>`, `<strong>/<em>/<code>`, and `<a rel="noopener noreferrer">` for https links, with no `dangerouslySetInnerHTML`.

### Revision comparison domains (D5) and restore chain (D6)

`RevisionHistoryPage.compare.changes` covers the field, block, and relation domains. Pointer grammar is normative: field `/fields/{stableFieldId}`; block `/blocks/{compositionInstancePath}` (the stored `cms_composition_instances.path`); relation `/relations/{stableFieldId}/{targetToken}`, where `targetToken` is the lowercase hex HMAC-SHA-256 over JCS `{entryId, fieldId, targetKind, targetId}` keyed by a server key with domain separator `cms.compare.relation.v1` (the Vault-held history-signing key; no new secret). A keyed token, not a bare hash, stops a reader confirming a guessed hidden target UUID. Relation comparison is keyed by the stable field ID, never by a relation-definition ID (definition IDs change across schema versions); the definition version is recorded inside the side hash. Side hashes are `valueHash` for fields, the JCS hash of `{blockKey, blockVersion, blockRegistryDigest, mode, patternRef, props, bindings}` for blocks, and the JCS hash of `{relationDefinitionVersion, position, expectedTargetVersion}` for relations; hashes never include target IDs. Ordering is by domain (`field`, `block`, `relation`) then path (bytewise UTF-8). More than 512 combined changes is 422 reason `comparison_too_large` (never a truncated 200); an unresolvable recorded schema/template/taxonomy version or block registry digest is a non-disclosing 422 reason `comparison_unavailable`. The right side is the newest readable revision at the requested locale at read time and the response names both IDs; the FE uses `leftRevisionId` for restore.

`compare.restore` carries the deterministic restore chain for `leftRevisionId`: `migrationChainId` (UUID derived from the manifest hash), `edgeCount` (0 for a same-schema restore, up to 64), `chainHash`, and `availability` (`available`, `chain_unavailable`, or `transform_missing`). The chain is composed lazily from the completed 03a migration-plan edges bound to the activation of each successive version: consecutive, `from[i+1] = to[i]`, with the final `to` equal to the version active at restore time. `platform_private.cms_restore_chain_manifests` is a private immutable table keyed by `content_type_id` + `source_schema_version_id` + `target_schema_version_id` holding the ordered `plan_ids` (0..64), `edge_count`, and a `manifest_hash` (JCS SHA-256 of `{contentTypeId, sourceSchemaVersionId, targetSchemaVersionId, planIds}`), with forced RLS and no grants. The restore read derives the path and ID and writes nothing; `cms_restore_revision` re-derives the path and ID and requires equality with the request (409 `migration_chain_mismatch`), inserts the manifest when absent, then translates source content to the current active schema, revalidating every value including `rich_text.v1` and `object` structures. Any field without a registered transform, or a required field without a literal default, is 409 `migration_chain_incomplete`; an incompatible template resolution is 409 `template_incompatible`; nothing is fabricated. The result is a new draft revision with `parentRevisionIds = [currentDraftRevisionId, sourceRevisionId]`; the source is unchanged. In the same transaction the restore writes one `cms.entry.revision-created.v1` outbox event (still exactly `{ entryId, revisionId }`), one audit row `cms.entry.revision.restore.chain` (target type `cms_restore_chain_manifest`, target = the manifest id, reason `CMS_ENTRY_RESTORE_CHAIN_APPLIED`; the audit table has no payload column, so the chain identity is the audit target) and one outbox event `cms.entry.revision-restored.v1` carrying the chain hash and counts (Event schemas). An exact replay and a refused restore (stale `VERSION_MISMATCH`, `migration_chain_mismatch`, `migration_chain_incomplete`, `template_incompatible`) emit neither event and write neither audit row. No payload or audit row carries a field value, secret or target identity.

### Recorded taxonomy and composition references in comparison and restore (DEC-141, D-3, D-4)

Slice 10 has no taxonomy-version or composition authority; Slice 12 receives the resolution obligation (03c `Receiving obligations from Slice 10 (DEC-141)`). Until then the following fail closed and never fabricate. (1) The recorded `taxonomy_version_ids` of a revision are carried and compared by identity only. When either revision of a CMS-03B-03 comparison records a non-empty taxonomy-version reference that the comparison would have to resolve, the comparison answers 422 reason `comparison_unavailable` (non-disclosing: no id, count or version is echoed), exactly as for any other unresolvable recorded version. (2) A restore reinstates the source content under the schema, template and taxonomy versions the source revision recorded; those ids come from the source revision, never from the current draft. (3) A source revision that carries active composition instances or term assignments is refused 409 `migration_chain_incomplete` (nothing fabricated, source unchanged) until Slice 12 authoring of those records lands. A recorded template version cannot dangle (`cms_entry_revisions_template_registry_check`), so it never produces `comparison_unavailable`.

### Conflict detail privacy (D2)

`ConflictDetailResource` omits fields the caller cannot read rather than placeholdering them with data, and it carries no `resolvedByPersonId` or other ownership identifier. For the same reason the browser projection of `ConflictRecordResource` drops `resolvedByPersonId`: resolution authority evidence stays server-side and is represented only by `resolvedRevisionId` and `resolvedAt`. Only an `open` conflict is readable (DEC-139): a resolved or superseded conflict is concealed as the same 404 `NOT_FOUND` as an absent, foreign, or hidden one, so the read never distinguishes a closed conflict and never returns a metadata-only record. The editor treats a 404 after a 409 as "conflict no longer open" and refetches the draft. A relation path carries the canonical relation value of each side (`{ targets: [{ targetId, expectedTargetVersion }] }`) restricted to the content targets the caller may read (a hidden target is omitted, never placeholdered), provenance `authored` (`missing` when the side has no relation rows), and a `valueHash` that is the JCS SHA-256 of the full canonical value.

### Write-path lock order and authority fencing (H1-H3, lane H round 2)

The writers CMS-03B-10 (`cms_create_entry`), CMS-03B-01 (append), CMS-03B-02 (resolve) and CMS-03B-04 (restore), the schema activation commands (CMS-03A-04 and the Worker activation seam), authority revocation (CMS-03A-17 and the membership tenure end) and review invalidation share one global lock order. A command may skip a position but never acquires an earlier position after a later one.

| Position | Rows locked | Mode | Taken by |
| -------- | ----------- | ---- | -------- |
| 0 | the target `ContentEntry` row (the writer's own aggregate; no authority-first command locks entry rows) | `FOR UPDATE` | writers only |
| 1 | the authority rows of the acting person, in this order: acting-context binding, `person_party`, `membership_tenure`, `organization_actor_grant` (`cms.author`/`cms.editor` for writers, `cms.schema_designer` for activation), then the person's `cms_entry_assignments` | `FOR SHARE` for a writer, `FOR UPDATE` for activation (every tenure and actor-grant row of the owner organization) and for the revocation's own UPDATE | writers, activation, revocation |
| 2 | relation targets: every external content target a command creates or carries, in ascending UUID order, the target entry row and then the caller's assignments on it | `FOR SHARE` | writers |
| 3 | the activation candidate version row, then its dependency graph | `FOR UPDATE` | activation, review invalidation (candidate before its reviews) |
| 4 | the target content-type version row (the active version for a writer), rechecked `active` under the lock, else 409 `CONFLICT` | `FOR SHARE` for a writer, `FOR UPDATE` for the activation switch | writers, activation |
| 5 | the review rows, then the review assignments, then the migration plan | `FOR UPDATE` | activation, review commands |

Rules.

1. **Lock before write, capability re-proved under the lock.** A writer takes positions 0, 1 and 4 (and 2 for relations) before it reads anything it will write, then re-proves its `cms.author` or `cms.editor` capability under the position 1 locks. A revocation committed before the writer's lock wins: the writer is 403 `FORBIDDEN` and writes no row. A revocation that arrives later waits for the writer to commit and is not lost.
2. **Relation targets are not a lock lever.** A target not visible to the caller on the unlocked state is refused first with the uniform `VALIDATION_FAILED` pointer `/fields/{stableFieldId}` and no lock is taken on it; only visible targets are locked, and visibility and the pinned `expectedTargetVersion` are decided after the lock, so a target bumped, archived or unassigned between check and use is observed (the writer is refused with the same uniform refusal, or `DEPENDENCY_UNAVAILABLE` on append and resolve, `migration_chain_incomplete` on restore).
3. **Activation locks authority first.** The human activation (CMS-03A-04) and the Worker activation lock the identity rows of position 1 before the candidate row, and only for a candidate of the caller's own organization (so no foreign organization's rows can be locked by a request). Under those locks they prove the activator's `cms.schema_designer` again, and the Worker human-approval check recomputes the live distinct qualifying approvals: a lock failure there is `CONFLICT`, never "not approved". The activation switch holds the position 1 locks to commit, so an activation briefly serializes every authoring write of its organization (a delay, never a lost write, bounded by the caller's RPC deadline). A writer that waited and then finds its version superseded is refused with the existing typed refusals: create `VALIDATION_FAILED` at `/contentTypeVersionId`, append and resolve `DEPENDENCY_UNAVAILABLE`, restore 409 `migration_chain_mismatch`; the Slice 09 insert-time guard `cms_entry_version_lock_guard` remains the backstop and refuses a bare insert with `CONFLICT`.
4. **Revocation versus activation.** If a revocation of a counted approver's or an activator's authority commits first, the activation is refused 409 `VERSION_MISMATCH`, the review becomes `invalidated` and the candidate returns to `draft`; if the activation commits first, the revocation waits and then commits. Neither is aborted by a deadlock.
5. **Invalidation order.** `cms_invalidate_reviews_for_person` and the activation review invalidation lock the candidate before its reviews, the order submit, decide and activation use.
6. **Typed deadlock.** `deadlock_detected` (and a lock-acquisition failure) is converted to 409 `CONFLICT` in the four writers, both activation commands and CMS-03A-17, at the lock steps and at the wrapper, with nothing committed; the retry may reuse the same `Idempotency-Key`. Two writers that reference each other's entries form a real cycle: exactly one commits and the other is `CONFLICT`. The tenure end through the identity command keeps its own error contract.
7. **Stale reviews never activate.** The reviewer-authority invalidation of an open or approved review runs in the revoking transaction and must reach the review rows whichever session performs the revocation (a definer function that is not scoped to the revoker's party), so the review becomes `invalidated` and the candidate returns to `draft` at the revocation. As defense in depth, activation always recomputes the live qualifying approvals under the locks and refuses a short count, so even a stored `approved` state that lags a revocation can never activate a candidate.

### Entry list keyset, authorization and collection epoch (CMS-03B-13, DEC-140)

**Authorized relation, bounded work.** `cms_list_entries` drives each page from the caller's authorized relation, never from the entry table: a materialized set of the resolved person's active assignments in the acting party whose capability (`cms.editor` or `cms.author`) is proven at grant level once per capability, joined to the entry (lifecycle, owner party, content type, keyset columns) and its current draft revision (for the `state` filter), ordered `updated_at DESC, id DESC`, limit + 1 rows. Archived entries and revoked assignments are omitted. Work per page is O(the caller's authorized assignments + the page) and does not depend on the number of entries hidden from the caller. Items are `RevisionSummary` plus `entryId`, `entryLifecycle` and `entryUpdatedAt` (DEC-145).

**Mutable order, therefore an epoch.** The order is the locked contract `(updatedAt DESC, entryId DESC)` and `updatedAt` is mutable (an autosave moves an entry to the front), so a bare keyset cursor could silently skip an unseen entry that moved ahead of the cursor between two pages. The order is not changed; instead the cursor is bound to the *collection epoch* of its position.

- **Cursor payload.** The signed envelope (`keyId`, `signature`) wraps exactly the five unsigned members `{ queryHash, lastUpdatedAt, lastEntryId, aheadDigest, expiresAt }` and the whole cursor stays within 512 characters. `aheadDigest` is 32 lowercase hex characters. A cursor with a missing, extra or malformed member is a structural 400 `INVALID_REQUEST`; a well-formed cursor that is expired, tampered, signed by an unknown or stale key, bound to another query or read scope, or whose `aheadDigest` no longer matches is 409 `CONFLICT` with a restart-from-the-first-page recovery (DEC-140).
- **Epoch definition.** The epoch of a cursor position is the first 128 bits (32 lowercase hex) of SHA-256 over the ASCII string `<count>:<xor>`, where `count` is the number of the caller's authorized entries at or before the position in page order (inclusive) and `xor` is the decimal signed 64-bit bitwise XOR of the PostgreSQL `hashtextextended(entryId::text, 0)` values of those entries (`0` for the empty set). It detects a changed set, not an adversary: the cursor is signed and entry ids are server-generated.
- **One snapshot.** The epoch of the incoming cursor position and the next page are read in one statement, so the check and the page see the same snapshot; the page response carries a fresh `aheadDigest` for its own last row.
- **Behaviors.** An unchanged collection never conflicts. An entry the walk already passed that is updated stays ahead of the position (no conflict, no repeat, no gap). An unseen entry that is updated but still behind the position is listed in its new place on a later page. An unseen entry that moved ahead of the position, an entry created ahead, an entry that left the collection ahead (archived, or its assignment revoked) and a caller whose collection emptied all change the set at or before the position and are 409 `CONFLICT`. An unseen entry that leaves the collection behind the position changes nothing. The rule is conservative by design: it may restart a walk it could have continued, but it never skips or repeats an entry silently.

### Derived revision workflow state (E2)

The persisted `cms_entry_revisions` row is an immutable snapshot (`updated_at = created_at`), so its physical `state` is the constant `draft` for the life of the row (a forward migration narrows the CHECK to `state = 'draft'`; no code path ever writes another value). Every browser-visible `EntryRevisionState` — `EntryRevisionResource`, `RevisionSummary`, `EntryListItem`, `EntryDraftDetailResource`, `EntryWorkflowRevision`, and the `state` filters of CMS-03B-03 and CMS-03B-13 — is **derived** by one SQL helper, `platform_private.cms_revision_effective_state(p_revision_id uuid) returns text` (and its set-oriented form `cms_revision_effective_states(p_revision_ids uuid[])`). No other code computes or stores a revision state. The first matching row wins:

| Order | Effective state | Condition on committed evidence |
| ----- | --------------- | ------------------------------- |
| 1 | `published` | a `cms_publication_versions` row with `action = 'publish'` references the revision; whether that publication is still the live head is carried by the PublicationVersion (E3), never by the revision |
| 2 | `scheduled` | a `cms_publication_schedules` row for the revision has `action = 'publish'` and `state` in `pending`, `executing` or `failed_retryable` |
| 3 | `approved` | the latest review of the revision (greatest `submitted_at`, then `id`) is `approved` |
| 4 | `rejected` | the latest review is `rejected` |
| 5 | `submitted` | the latest review is `open` |
| 6 | `draft` | otherwise, including a revision with no review and one whose latest review is `invalidated` |

Only a revision whose effective state is `draft` may be submitted (CMS-03B-05), so an invalidated review returns its revision to `draft` and it may be resubmitted, while a `rejected` revision is terminal: the author appends a new revision through CMS-03B-01. The helper is `STABLE`, runs only inside the named RPCs, reads only `cms_editorial_reviews(revision_id, submitted_at, id)`, `cms_publication_schedules(revision_id, state)` and `cms_publication_versions(revision_id)` through their indexes, and is the single place a future workflow stage is added. The cursor and sort of CMS-03B-03 and CMS-03B-13 never depend on the derived state: a `state` filter is evaluated over keyset candidates read in batches of 200, the RPC returns up to `limit` matching rows, it scans at most 1,000 candidates per request, and reaching that bound returns the rows found with a cursor positioned after the last scanned candidate (so a filtered page may be shorter than `limit` while `nextCursor` is non-null). The Slice 10 reads (`cms_list_entries`, `cms_list_revisions`, `cms_get_entry_draft`) and the revision write responses adopt the helper in the Slice 11 forward migration.

### Frozen dependency manifest build and version set (E1, E7)

`platform_private.cms_build_dependency_manifest(p_revision_id uuid)` is the only builder of a `DependencyManifest`; it reads canonical state under RLS, accepts no caller value, and its result is canonicalized with RFC 8785/JCS. Every list is sorted ascending by the lowercase UUID string (bytewise), each identity appears once, and the bounds of `DependencyManifest` apply (256 entries in total, 32 KiB serialized; exceeding either is 422 `VALIDATION_FAILED` `dependency_manifest_too_large`). Groups:

| Group | Source and hash |
| ----- | --------------- |
| `schema` | the revision's `schema_version_id`: its id and `definition_hash`, its SchemaArtifact id/hash/compiler/contract ref, the frozen protected `validatorRefs` (DEC-146), the editorial `workflowPolicy` evidence resolved by the strictest-of rule (03a downgrade guard) and the non-null `activationEvidence` |
| `template` | `{ id, hash }` of the revision's `template_version_id` (hash: the TemplateVersion `content_hash`), or `null` |
| `blocks` | every BlockDefinitionVersion reachable from the revision's composition instances and template slots, `{ id, hash }` with hash the registry `releaseDigest` |
| `patterns` | every PatternVersion named by the revision's composition instances, `{ id, hash }` with hash the PatternVersion `content_hash` |
| `terms` | the distinct terms of the revision's `active` TermAssignment rows, `{ id, hash }` with hash the SHA-256 of the JCS `{ id, termKey, lifecycle, version, successorId }` of the term row |
| `localeSources` | one `{ locale, revisionId, hash }` for the revision's LocaleVariant (its recorded source revision and `sourceHash`), empty for a source-locale revision |
| `settings` | `{ version, hash }` from the settings snapshot authority (E7) |
| `relations` | `{ fieldId, targetId, targetVersion }` for each resolved content relation row of the revision (a pinned `expectedTargetVersion`, else the target's current version); a relation whose registry `onUnavailable` is `omit` or `placeholder` and whose target is unavailable is not listed |
| `checker` | `{ key: 'cms.a11y.structural', version }` with `version` the current registry version of the accessibility provider (`Publication preflight registry`) |

`dependencyHash` is the lowercase SHA-256 of the JCS manifest. The `VersionSet` is the pure projection `versionSetOf(manifest, revision)`: `schemaVersionId`, `schemaHash`, `schemaArtifact`, `validatorRefs`, `workflowPolicy` and `activationEvidence` are copied from `manifest.schema`; `templateVersionId` and `templateHash` from `manifest.template` (both `null` when absent); `taxonomyVersionIds` is the revision's `taxonomy_version_ids` sorted bytewise; `blockVersionIds` and `patternVersionIds` are the manifest ids; `settingsVersion` is `manifest.settings.version`; `compilerVersion` is `manifest.schema.schemaArtifact.compilerVersion`. CMS-03B-15 serves both the manifest and the version set so the forms echo them unmodified into CMS-03B-05, CMS-03B-08 and CMS-03B-09; the server never accepts a manifest or version set it cannot rebuild bit-for-bit.

A frozen identity is **current** when its source still serves it: the schema version is the content type's `active` version with an equal artifact hash; the template and each pattern version are `active` with an equal hash; each taxonomy version is `active`; each block is `supported` or `deprecated` (a `withdrawn` block is not current); the settings snapshot equals the frozen one. A command that relies on a frozen set (CMS-03B-07, CMS-03B-09, the executor) requires every identity to be current and the recomputed manifest to equal the frozen one; a non-current identity or a differing hash is 409 `CONFLICT` `version_set_stale` and the review is invalidated `dependency_changed` (`Review invalidation`).

### Publication preflight registry (D19, DEC-134, D25)

Review submission, schedule acceptance, schedule execution and publication evaluate one closed set of seventeen categories (`PreflightCategory`, registry order below) through a code-owned registry, `platform_private.cms_preflight_registry` (`category` text, `registry_version` bigint, `owner_slice` text, `provider_key` text, `provider_version` bigint, `provider_kind` text in `database`, `worker`, `reference_gate`, `reference_kind` text NULL; rows are seeded by forward migration, immutable, never writable by a caller, and the current row of a category is the one with the greatest `registry_version`). CI asserts the registry categories equal `PreflightCategory`. A later slice registers its provider by a forward migration that inserts a newer row for its category; no other change is needed.

D19: a category whose owning domain has no provider yet is served by the generic `preflight.reference_gate` provider (`reference_gate`): it passes only when the revision holds no reference of the category's `reference_kind` (counted by `platform_private.cms_revision_references(p_revision_id, p_kind)`) and otherwise fails closed with reason `provider_unbuilt_reference`. Providers in `database` and `reference_gate` kinds run inside the command transaction; a `worker` provider runs in the Worker immediately before the RPC and its `PreflightEvidence` is verified by the RPC (below).

| # | Category | Owner | Phase 2 provider | Evaluates | Reason codes |
| - | -------- | ----- | ---------------- | --------- | ------------ |
| 1 | `contract` | 03a/03b | `preflight.contract` v1, database | revalidates every stored value against the frozen artifact with the shared validators (`cms_field_kind_value_shape`, `rich_text.v1`, object structure) and the relation write rules | `value_invalid`, `validators_changed` |
| 2 | `schema` | 03a | `preflight.schema` v1, database | the revision's schema version is its content type's active version; artifact id/hash/compiler, protected validator refs, activation evidence and workflow policy equal the manifest | `schema_not_active`, `schema_evidence_changed` |
| 3 | `template` | 03c | `preflight.template` v1, database | with a non-null template: `cms_resolve_template_compatibility` succeeds for (template, content type, schema version), the TemplateVersion is `active` and its digest equals the manifest hash; a revision with no template is unaffected | `template_not_active`, `template_incompatible`, `template_changed` |
| 4 | `block` | 03a/03c | `preflight.block` v1, database | every manifest block record is `supported` or `deprecated` and `blockRegistryDigest` recomputed over the reachable set equals the frozen one | `block_withdrawn`, `block_digest_changed` |
| 5 | `pattern` | 03c | `preflight.reference_gate`, reference kind `pattern` (Slice 12 registers `cms.pattern.active_digest`) | no composition instance references a PatternVersion until Slice 12 provides activation | `provider_unbuilt_reference` |
| 6 | `taxonomy` | 03c | `preflight.reference_gate`, reference kind `taxonomy` (Slice 12 registers `cms.taxonomy.assignment_integrity`) | the revision has no TermAssignment and no taxonomy version id | `provider_unbuilt_reference` |
| 7 | `settings` | 05a | `preflight.settings` v1, database | the recomputed settings snapshot (E7) equals the frozen snapshot | `settings_changed` |
| 8 | `relation` | 03a/03b | `preflight.relation` v1, database | each manifest relation target is still readable by the draft-read predicate at its pinned version and the registry `onUnavailable` policy is honoured (`block` with an unavailable target fails) | `relation_target_unavailable`, `relation_version_changed` |
| 9 | `privacy` | 05/16 | `preflight.reference_gate`, reference kind `privacy` (Slice 16 registers the hold provider) | no legal-hold, erasure or incident-fence reference exists on the entry or its relation targets; none can exist before Slice 16 | `provider_unbuilt_reference` |
| 10 | `security` | 03b | `preflight.security` v1, database | re-runs the write-time executable-content and unsafe-link rules (no script, CSS, HTML event handler, template expression, SQL or unsafe scheme) over the stored values and block props | `unsafe_content` |
| 11 | `accessibility` | 05c (D25) | `cms.a11y.structural` v1, worker | the BE05c structural checker over the `rich_text.v1` values, the template render plan and the block registry; only a `healthy` run passes | `blocking_finding`, `checker_failed` |
| 12 | `media` | 04b | `preflight.reference_gate`, reference kind `media` (Slice 14 registers the media provider) | the revision has no `media` field value and no block media data source; a non-empty media value already fails closed at write (`media_source_unavailable`) | `provider_unbuilt_reference` |
| 13 | `route` | 04a | `preflight.reference_gate`, reference kind `route` (Slice 13 registers the route provider) | the revision has no `internal` rich-text link and no route binding to verify | `provider_unbuilt_reference` |
| 14 | `locale` | 03c (DEC-138) | `preflight.reference_gate`, reference kind `locale` (Slice 12 registers `cms.locale.no_fallback_gate`) | the manifest has no `localeSources` entry and the schema declares no `no_fallback` field | `provider_unbuilt_reference` |
| 15 | `migration` | 03a | `preflight.migration` v1, database | the revision's schema version is not the source or target of a non-terminal migration plan and the entry is not under the version-lock guard | `migration_in_progress` |
| 16 | `domain_binding` | 03a | `preflight.domain_binding` v1, database | each frozen RelationDefinition target kind and projection key is still on the code-owned domain allowlist | `binding_not_allowlisted` |
| 17 | `revocation` | 03b/BE01 | `preflight.revocation` v1, database | the entry lifecycle is `active`; at schedule acceptance, execution and publication every counted approver still holds the standing capability of the slot its decision satisfied and no counted assignment was revoked; the publisher authority rules of the phase hold (below) | `entry_unavailable`, `reviewer_authority_changed`, `publisher_authority_ended` |

A revision whose schema declares a `no_fallback` field is a `locale` reference even when `localeSources` is empty; until Slice 12 registers the locale provider the category therefore fails closed for such a revision. A revision whose rich text carries an `internal` link is a `route` reference; until Slice 13 registers the route provider the category fails closed for it. These are the deliberate fail-closed consequences of D19 and close when the owning slice registers its provider.

Phases: **submit** (CMS-03B-05) evaluates categories 1–16 and, for `revocation`, the entry lifecycle and the submitter's authority; **schedule** (CMS-03B-07) and **publish** (CMS-03B-09) evaluate all seventeen, and `revocation` additionally rechecks the publisher authority at that instant (the caller's current `cms.publisher` grant is unrevoked and ends no earlier than the instant the action takes effect); **execute** (CMS-03B-20) evaluates all seventeen with `revocation` limited to revocation of the schedule creator's `cms.publisher` grant and the grant end before the fire instant (DEC-120; MFA freshness is never rechecked at fire time because the schedule command already required it). CMS-03B-08 runs no registry phase: it checks readability and version-set equality only. CMS-03B-15 evaluates the **submit** phase read-only for `preparation.preflight`.

Aggregation: every category is evaluated (no short circuit) and the report lists all seventeen. If any category is `failed` the command is refused 422 `VALIDATION_FAILED` with `details.reasonCode` `preflight_failed` and `details.preflight` (at most 17 entries of `{ category, outcome, reasonCode }`, no counts or finding text); otherwise, if any category is `unavailable` (a provider dependency failed or timed out), the refusal is 503 `DEPENDENCY_UNAVAILABLE` with `dependencyClass` `preflight` and `retryable` true; in both cases nothing commits and no idempotency record is retained as a success. At execution a `failed` result blocks the schedule (`preflight_failed`) and an `unavailable` result is retried (`failed_retryable`).

**Accessibility provider (DEC-134, D25).** Slice 11 delivers the BE05c `cms.a11y.structural` checker (version 1), its registry row, and the in-process `quality_gate_evaluate` gate call as the first `worker` preflight provider; Slice 16 builds the CFG-05C-02 `quality_check` action, `quality_check_runs` persistence and the CFG-05C-06/07 reads on the same module. Until Slice 16 the gate call persists nothing: its outcome travels as `PreflightEvidence`, and the audit record of the command stores only `{ checkerKey, checkerVersion, outcome, blockingCount, inputHash }`. The checker never receives a media reference in Phase 2 (a media value fails closed at write), so the media rules of BE05c are inert and the structure, heading, link and landmark rules are the Phase 2 surface. The Worker evaluates the checker within its 2,000 ms budget immediately before the RPC; the RPC accepts the evidence only when `providerKey`/`providerVersion` equal the current registry row, `outcome` is `passed` (the command refuses `failed`/`unavailable` evidence itself), `evaluatedAt` is within 60 seconds of the RPC instant (else 409 `CONFLICT` `preflight_evidence_stale`, retry the command), and `bindingHash` equals the SHA-256 of the JCS `{ checkerKey, checkerVersion, revisionId, revisionContentHash, dependencyHash }` the RPC recomputes from canonical rows (else 409 `CONFLICT` `dependency_changed`). The database cannot re-execute the TypeScript checker: the evidence is trusted as first-party Worker output bound to the exact revision and dependency set, and the evidence member is never a browser or PostgREST input (the RPC grant is the Worker role only).

### Settings snapshot authority (E7)

`DependencyManifest.settings` and `VersionSet.settingsVersion` come from one code-owned, versioned registry, `CMS_PUBLICATION_SETTINGS_KEYS` (registry version 1, exported by the contracts package and mirrored by `platform_private.cms_publication_settings_keys()`), listing the Slice 07 setting definition keys (BE05a) whose effective value alters what a publication contains. Adding a key is code plus a forward migration and a registry version bump. Registry version 1 has no members: no Phase 2 setting alters publication content (delivery freshness and cache policy are evaluated by Shard 05 at delivery time, BE04c), so the version 1 snapshot is the empty array.

Evaluation at the command's server instant: for each registered key in ascending order the Slice 07 resolver (`cfg_resolve_effective_value`, consumer key `cms.publication`) yields `{ key, definitionVersionId, sourceValueVersionId, valueHash }` (the last two `null` for a contract default); the snapshot is that array and `settings.hash` is the lowercase SHA-256 of its JCS form (the empty array hashes to `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`). `settings.version` is the **ordinal** of the snapshot in `platform_private.cms_publication_settings_snapshots`: the snapshot is inserted under `INSERT … ON CONFLICT (owner_id, snapshot_hash) DO NOTHING` and its ordinal is read back, where a new snapshot takes the owner's previous maximum ordinal plus one under the owner's advisory lock (the first snapshot is ordinal 1). Ordinals identify exact snapshots and are only ever compared for equality: restoring earlier values reuses the earlier snapshot and ordinal. A forward migration seeds no rows; the first evaluation records ordinal 1 for the empty snapshot.

### Time authority (E8)

Neither PostgreSQL nor the Workers `Intl` API exposes a tz database release, and `Intl` resolves against a host-dependent tzdata, so the schedule time rules are owned by the Worker over **one pinned snapshot** of the IANA tz database: a content-addressed build asset generated by a pinned script from one IANA release tarball, with its release tag exported as the code constant `CMS_TZDB_VERSION` (`^[A-Za-z0-9._-]{1,32}$`, an IANA release tag such as `2025b`) and its SHA-256 as `CMS_TZDB_SHA256`; the Worker verifies the hash at module load and, on a mismatch, answers every schedule command 503 `DEPENDENCY_UNAVAILABLE`. `platform_private.cms_tzdb_version()` returns the same constant (a CI parity test compares the two), and advancing the pin is code plus a forward migration; stored schedules keep the version and instant they were accepted with, so a later pin never alters an existing instant. Resolution of a `PublicationScheduleRequest` (and of governed scheduled activation, 03c OD-6) is, in order:

1. `timezone` must be a canonical or link zone name of the pinned snapshot, else 422 `VALIDATION_FAILED` `unknown_timezone` at `/timezone`.
2. `tzdbVersion` must equal `CMS_TZDB_VERSION`, else 422 `tzdb_version_mismatch` at `/tzdbVersion` with `details.pinnedVersion`.
3. The set U of UTC instants whose wall-clock time in `timezone` equals `localDateTime` (seconds default 0) is computed from the pinned rules; |U| is 0, 1 or 2.
4. |U| = 0 (a gap): 422 `nonexistent_local_time` at `/localDateTime` with `details.alternatives`, two entries `{ localDateTime, resolvedUtc }` — the requested local time shifted earlier and later by the length of the gap. `disambiguation` cannot resolve a gap.
5. |U| = 1: `disambiguation` must be `none`, else 422 `disambiguation_not_applicable` at `/disambiguation`.
6. |U| = 2 (a fold): `none` is 422 `ambiguous_local_time` at `/disambiguation` with `details.alternatives` `[ { disambiguation: 'earlier', resolvedUtc }, { disambiguation: 'later', resolvedUtc } ]`; `earlier` selects the smaller and `later` the larger instant.
7. `resolvedUtc` must equal the selected instant, else 422 `resolved_utc_mismatch` at `/resolvedUtc` with `details.expectedUtc`.
8. `resolvedUtc` must be at least 60 seconds and at most 366 days after the acceptance instant (`CMS_SCHEDULE_MIN_LEAD_SECONDS`, `CMS_SCHEDULE_MAX_HORIZON_DAYS`), else 422 `schedule_out_of_horizon` at `/resolvedUtc` with `details.minUtc` and `details.maxUtc`. The horizon bounds the exposure to a tz rule change after acceptance.

The Worker passes only the verified `localDateTime`, `timezone`, `resolvedUtc`, `tzdbVersion` and `disambiguation` to the RPC, which re-checks what it can without the tz rules: `tzdbVersion = cms_tzdb_version()`, the horizon, and that `localDateTime` read as UTC minus `resolvedUtc` lies within −12 hours and +14 hours (the range of real UTC offsets); a violation is 422 `VALIDATION_FAILED` `resolved_utc_mismatch`. Caller input is therefore never stored as verified time authority.

### Review scopes, reviewer assignment and decision evaluation (DEC-136)

Five scopes gate the Slice 11 operations; each is derived server-side and none is accepted from the caller:

| Scope | Definition |
| ----- | ---------- |
| entry assignee | an active `cms_entry_assignments` row for the entry with a registry `cms.author` or `cms.editor` key |
| owner-party publisher | the caller's acting context is the entry's `owner_party_id` (or a confirmed unended member of it) and the caller holds an active `cms.publisher` grant; a visibility scope for workflow reads and commands, never an edit assignment |
| reviewer assignee | a non-revoked `cms_editorial_review_assignments` row for the review; it **decides** only while `starts_at <= now < ends_at` and the review is `open`, and may **read** the review for as long as it is not revoked |
| submitter | the `submitted_by` person of the review |
| owner | the receipt-derived owner of 03A-14: the immutable owner initialization receipt identity with a live binding |

**Assignment (CMS-03B-18).** The owner creates or revokes a bounded reviewer assignment on one `open` review; it confers only `read` and `decide` on that frozen review, never edit, publish, assign or admin authority, and cannot be delegated. `cms.editorial_review.assign` is owner-only and never grantable (03a closed grantable set), and the assignment capability `cms.editorial_review` is assignment-only and never granted. The assignment is the access window; the qualification to be counted comes from standing grants (`cms.reviewer`, and the specialist capability for a specialist slot), never from an assignment alone. An assignment is refused (typed, no state change) for: an absent, cross-organization, banned or ungranted human, a human holding no active `cms.reviewer` grant, the review submitter and the revision author — one uniform 409 `CONFLICT` `reviewer_not_eligible`, never an existence or role signal —, a duplicate active assignment (409 `assignment_exists`), an `expiresAt` beyond seven days, the reviewer grant end or the grantor authority end (422 `expiry_out_of_bounds`), a non-`open` review (409 `review_not_open`) and more than 16 active assignments (409 `assignment_limit`). The grantor authority end is the end of the owner's current `cms.editor` grant day (the owner may self-grant `cms.editor`, 03a); an owner without a valid `cms.editor` grant is refused 403 `capability_missing`. Create is 201 with `Location`; revoke is 200; both write the audit record and one `cms.entry.review-changed.v1` and take the review row lock. A revoke of an assignment whose human already recorded an approve decision on an `open` review removes that decision from the qualifying count at the next recount.

**Decision (CMS-03B-06).** In order, inside one transaction holding the review row lock: (1) the step-up proof is verified before anything else (`Recent MFA`, E6); (2) the review is resolved and concealed per scope (hidden or absent is 404; a visible review without an effective assignment or the capability below is 403); (3) the review must be `open` (409 `CONFLICT` `review_not_open`) and `If-Match` must equal its `version` (409 `VERSION_MISMATCH`); (4) the dependency manifest is rebuilt and every frozen identity checked current — a mismatch **commits the invalidation** (`Review invalidation`) and the RPC returns the typed outcome `invalidated`, which the Worker answers 409 `CONFLICT` `dependency_changed` (the decision is not recorded); (5) separation: the reviewer is not the submitter or the revision author (403 `separation_of_duties`) and has no earlier decision on this review (409 `duplicate_decision`); (6) the reviewer holds an active `cms.reviewer` grant (403 `capability_missing`); (7) for `approve`, the satisfied slot is derived — the first unfilled specialist slot (in `requiredCapabilities` order) whose capability the reviewer holds, otherwise the base slot `cms.reviewer` — and the approve is refused 409 `CONFLICT` `specialist_slot_unsatisfiable` when the approvals still possible, `requiredDecisionCount` minus the distinct qualifying approvers after this decision, are fewer than the specialist slots no counted approver holds (a `reject` is never refused on this ground); (8) the decision row is appended with the server-derived reviewer, `capability` (the satisfied slot, or the base slot for a reject), `step_up_at` (the verified MFA instant), `reviewed_hash` (the review's frozen hash), `reason` and `comment_hash` (SHA-256 of the reason's UTF-8 bytes); (9) the review advances under CAS (`version` + 1): a `reject` sets state `rejected` immediately and terminally, an `approve` increments `recorded_decision_count` and sets `approved` exactly when the distinct qualifying approvers equal `requiredDecisionCount` and every specialist slot is held by a counted approver; (10) the audit record and one `cms.entry.review-changed.v1` commit atomically. The response is 200 `EditorialReviewResource` (strong ETag `"{review.version}"`).

**Qualifying approvers.** A recorded approve counts while its human holds the standing capability of the slot the decision satisfied and the human's assignment is not revoked; assignment expiry after the decision does not unwind it (the window bounds the act of deciding, not the decision), and lapse of the standing grant (its `valid_through` day passing) or its revocation does. `distinctApprovalCount` is the live recount; `recordedDecisionCount` is the number of decision rows and never exceeds `requiredDecisionCount` because the review leaves `open` at the decision that reaches it.

### Review invalidation

A live review (`open` or `approved`) moves to `invalidated` with exactly one of the closed reasons below, under CAS (`version` + 1), and the same transaction cancels the review's `pending` and `failed_retryable` schedules (`state` `cancelled`, `reasonCode` `approval_invalidated`; `entry_unavailable` when that is the reason) and, for `entry_unavailable`, revokes the entry's unexpired preview tokens:

| Reason | Producer |
| ------ | -------- |
| `revision_superseded` | CMS-03B-01, CMS-03B-02 and CMS-03B-04 append a revision to the entry: in the same transaction every live review of an older revision of that entry is invalidated |
| `dependency_changed` | the dependency recheck job below, or a command that finds the manifest or a frozen identity no longer current |
| `reviewer_authority_changed` | a counted approver's standing capability is revoked (the revoking transaction calls `platform_private.cms_invalidate_reviews_for_person(person_id, capability)`) or lapses (found lazily by the `revocation` preflight), or a counted approver's assignment is revoked while the review is `open` |
| `entry_unavailable` | the entry lifecycle leaves `active` (`archived`, `deletion_pending`, `held`) |

Dependency recheck: `cms_editorial_review_dependencies (review_id, kind, ref_id)` is written at submission from the frozen manifest (kinds `schema`, `template`, `block`, `pattern`, `term`, `taxonomy_version`, `locale_source`, `relation_target`, `settings`). The consumers of `cms.schema.activated.v1`, `cms.template.activated.v1`, `cms.pattern.activated.v1`, `cms.taxonomy.changed.v1`, `cms.localization.changed.v1` and `cms.block.lifecycle.changed.v1` enqueue the BE00 job `cms.review.dependency_recheck` with `{ eventId, kind, refId }`; the job selects live reviews through the dependency index, rebuilds each manifest and invalidates on inequality or a non-current identity. The job is idempotent (a review already `invalidated` is skipped) and bounded to 500 reviews per run with a continuation cursor. Approval can never survive a changed dependency, content or authority.

### Publication lineage (E3)

`PublicationVersion` rows are append-only; a state change is a successor row, never an update. A **lineage** is the sequence of rows for one `(entry_id, locale, audience)` and carries a stable `publication_id` (the `id` of its first row). Each row has a lineage `version` (1, then +1 per successor) and an `action`: `publish` rows are `active` and carry the full evidence (revision, `version_set`, `dependency_hash`, `activation_evidence_hash`, `schema_artifact_*`, `settings_version`, `publication_hash`); `unpublish`, `expire` and `archive` rows are `revoked` tombstones that copy the ended row's revision and evidence. The **head** of a lineage is its row with the greatest `version`, and the lineage state is the head's state. A row's browser `state` is derived: `revoked` for a tombstone, `active` for the head `publish` row, `superseded` for a `publish` row that is not the head. Two commands racing on one lineage compute the same next `version` and collide on `UNIQUE (entry_id, locale, audience, version)`; the loser is 409 `CONFLICT` `publication_conflict` and nothing commits (the RPC also takes an advisory lock on the lineage). `publication_hash` is the lowercase SHA-256 of the JCS `{ action, audience, dependencyHash, entryId, locale, publicationId, revisionId, supersedesId, version, versionSet }`. Publishing writes one new head row (the previous head, if any, becomes `superseded` by derivation and needs no row); an unpublish, expiry or archive requires an `active` head (otherwise 409 `publication_not_active`) and writes one tombstone. Every appended row writes exactly one `cms.publication.changed.v1` with that row's id as `publicationVersionId`, the audit record and the idempotency record in one transaction. `projectionState` is read from Shard 04's `projection_consumer_state` for the row id (BE04c) and is `pending` while no consumer has reported (the only value possible until Shard 04 delivery exists), `converged` when every registered consumer reports the row, and `degraded` when a consumer failed terminally. A privacy, security or takedown rule that must remove last-known-good appends a tombstone with `action` `unpublish` through the service-role takedown RPC owned by Shard 16; it never updates a prior row.

### Preview token and verification (CMS-03B-08, CMS-03B-19)

CMS-03B-08 mints a preview token bound to the person, user, acting context, revision, full `VersionSet`, locale, audience, route, expiry and a nonce. The `expiresAt` is exactly 900 seconds (15 minutes, the IA default and maximum) after creation. The token is **derived, never stored**: `token = base64url(HMAC-SHA-256(key, "cms.preview.token.v1" ‖ JCS{ tokenId, nonce, entryId, revisionId }))` without padding (43 characters), where `key` is the Vault-held history-signing key (no new secret, domain separator `cms.preview.token.v1`); the table stores only `token_hash`, the lowercase SHA-256 of the token string, and the binding evidence. An exact replay (same idempotency key and binding) re-derives the identical token for as long as the token is unexpired and unrevoked, so the plaintext is never persisted and never recoverable from the database; after expiry or revocation a replay is 409 `CONFLICT` `preview_expired` and a new key mints a new token. `capability_snapshot_hash` is the SHA-256 of the JCS `{ actingPartyId, capabilities, personId }` where `capabilities` is the sorted list of the person's active `cms.*` capability keys in the acting context, computed by `platform_private.cms_acting_context_version(person, acting_party)`; the same value is the BE04c `actingContextVersion`. A token is revoked (`revoked_at`, state `revoked`, `version` + 1, CAS) when the minting person loses the capability or membership that granted preview scope (the authority-loss transaction, DEC-143 pattern), when the entry leaves `active`, and by the service-role takedown RPC; a version-set movement does not revoke it because the preview is of that exact set.

CMS-03B-19 `platform_api.cms_verify_preview_token` returns `valid: true` only when all hold: a token row with the presented hash exists, is `active` with `revoked_at` null, and `now() < expires_at`; its `person_id` equals `actorPersonId`; its `capability_snapshot_hash` equals `actingContextVersion`; its `route`, `locale` and `audience` equal the request exactly; its entry lifecycle is `active` and its revision readable; and the minting person's preview scope still holds under the scope definitions above. Any other case is `valid: false` with `userId`, `entryId`, `revisionId`, `exactVersionSet` and `expiresAt` all `null`; `revoked` is `true` only when the row exists, is bound to the supplied `actorPersonId`, and is revoked, and is `false` for every other denial (unknown hash, expiry, a forwarded token, another route, locale, audience or context, lost scope), so the verifier is not an existence oracle and every such denial is byte-identical. A valid result returns the stored `VersionSet` as `exactVersionSet` with the revision and entry ids Shard 04 needs to render. The RPC performs no write; Shard 04 serves the result `no-store` and `noindex`, and an unknown or timed-out verifier result is a preview denial that reveals no draft detail.

### Schedule execution (CMS-03B-20)

The Worker `scheduled` handler runs the sweep every minute: it calls `cms_claim_due_publication_schedules(batch)` with `batch` 25 and then, per claimed record, evaluates the Worker-resident preflight provider and calls `cms_execute_publication_schedule(schedule_id, expected_version, lease_id, evidence)`. A claim moves the schedule to `executing` (`version` + 1, `lease_id`, `lease_until` now + 5 minutes) and returns only `ClaimedSchedule` identifiers; an `executing` schedule whose `lease_until` passed is first returned to `failed_retryable` with `attempt_count` + 1. Execution, in one transaction under the schedule and lineage locks:

1. Idempotency: a schedule already `completed` returns `already_completed` with no effect; a lease that no longer matches is refused (no effect).
2. The approved review is re-read: it must be `approved` with `version` equal to the schedule's stored `expected_version` and the frozen hash and dependency hash must equal the schedule's; otherwise the schedule is `blocked` with `reasonCode` `approval_invalidated`.
3. The preflight registry runs in the **execute** phase with the verified `PreflightEvidence`; a `failed` result blocks the schedule (`reasonCode` `preflight_failed`) with the prior publication intact; an `unavailable` result makes the schedule `failed_retryable` (the retry ladder below; `reasonCode` stays null).
4. Authority (DEC-120): the schedule creator's `cms.publisher` grant must be unrevoked and must not have ended before the fire instant (`reasonCode` `publisher_authority_ended` blocks); MFA freshness is not rechecked.
5. The action is applied under the lineage rules (E3): `publish` appends the `active` head, `unpublish`, `expire` and `archive` append a `revoked` tombstone (an absent `active` head blocks with `publication_not_active`); the schedule becomes `completed` with `actual_at_utc = clock_timestamp()` and `deviation_seconds = round(actual_at_utc − resolved_at_utc)`. A late run executes and records its deviation; it never skips the action.
6. One `cms.publication.changed.v1`, the audit record and the schedule CAS commit atomically.

Retry ladder: a `failed_retryable` outcome sets `attempt_count` + 1 and `next_attempt_at` to now + 15 s, 60 s and 300 s for the first, second and third failure; a fourth consecutive retryable failure blocks the schedule (`reasonCode` `retries_exhausted`) and raises the DLQ alert. Closed `reasonCode` tokens for a `blocked` or `cancelled` schedule: `approval_invalidated`, `preflight_failed`, `publisher_authority_ended`, `publication_not_active`, `retries_exhausted`, `entry_unavailable`. A schedule whose entry is not `active` at execution is `cancelled` with `entry_unavailable`. There is no operator command to cancel a pending schedule: IA03 CMS-09 defines none, so a pending schedule stops only by approval invalidation, an unavailable entry or a terminal block.

### Contract and error matrix

| Operation ID | 400                             | 401                            | 403                        | 404                          | 409                                                         | 415                       | 422                            | 429                  | 502/503/504              | 500               |
| ------------ | ------------------------------- | ------------------------------ | -------------------------- | ---------------------------- | ----------------------------------------------------------- | ------------------------- | ------------------------------ | -------------------- | ------------------------ | ----------------- |
| CMS-03B-01   | malformed path/header/body      | missing/expired session        | assignment/edit capability | hidden/absent/archived entry          | stale base/version, conflict, idempotency, lock-order deadlock (retry)                   | non-JSON                  | field/schema/value failure, `/baseRevision` names no revision     | author-write limit   | schema/RPC deadline      | scrubbed internal |
| CMS-03B-02   | malformed IDs/header/body       | missing/expired session        | resolve capability         | hidden/absent conflict       | base moved, invalid choice, conflict no longer open (`INVALID_TRANSITION`), idempotency, lock-order deadlock (retry)                     | non-JSON                  | choice/value schema            | conflict-write limit | RPC deadline             | scrubbed internal |
| CMS-03B-03   | malformed path/query/cursor     | missing/expired session        | read scope                 | hidden/absent entry/revision | cursor/context mismatch                                     | unsupported media if sent | query bounds                   | read limit           | read dependency/deadline | scrubbed internal |
| CMS-03B-04   | malformed IDs/header/body       | missing/expired session        | edit capability            | hidden/absent revision       | stale version (`VERSION_MISMATCH`), migration mismatch, idempotency, lock-order deadlock (retry)              | non-JSON                  | restore schema                 | restore limit        | migration/RPC deadline   | scrubbed internal |
| CMS-03B-05   | malformed IDs/header/body       | missing/expired session        | submit/assignment, separation_of_duties | hidden/absent entry/revision | revision_not_submittable, dependency_changed, open review, idempotency | non-JSON | manifest/risk/preflight_failed | review-write limit | preflight 503 dependency/RPC deadline | scrubbed internal |
| CMS-03B-06   | malformed ID/header/body        | missing/expired or step-up MFA | assignment/capability_missing/separation_of_duties | hidden/absent review | stale review, review_not_open, duplicate_decision, specialist_slot_unsatisfiable, dependency_changed (committed invalidation), idempotency | non-JSON | decision/reason failure (unknown key) | decision limit | RPC deadline | scrubbed internal |
| CMS-03B-07   | malformed IDs/header/body       | missing/expired or step-up MFA | publisher/separation_of_duties | hidden/absent target | schedule collision, stale approved-review version, version_set_stale, idempotency | non-JSON | time/tzdb/action failure, preflight_failed, authority_ends_before_schedule | schedule limit | preflight 503/RPC deadline | scrubbed internal |
| CMS-03B-08   | malformed body/path/version set | missing/expired session        | preview scope | hidden/absent target | stale entry version, version_set_stale, preview_expired replay, idempotency | non-JSON | route/audience/version failure | preview limit | schema/RPC deadline | scrubbed internal |
| CMS-03B-09   | malformed IDs/header/body       | missing/expired or step-up MFA | publisher/separation_of_duties | hidden/absent target | stale approved-review version, version_set_stale, dependency_changed, publication_conflict, idempotency | non-JSON | publication contract, preflight_failed | publish limit | projection/preflight 503/RPC deadline | scrubbed internal |
| CMS-03B-10   | malformed header/body           | missing/expired session        | no create capability       | hidden/absent target         | duplicate key, off-registry schema, idempotency, lock-order deadlock (retry)             | non-JSON                  | field/schema/value failure     | author-write limit   | schema/RPC deadline      | scrubbed internal |
| CMS-03B-11   | malformed path/query            | missing/expired session        | read scope/assignment      | hidden/absent entry          | not applicable to bounded read                              | unsupported media if sent | response/field bounds          | read limit           | read dependency/deadline | scrubbed internal |
| CMS-03B-12   | malformed path/query            | missing/expired session        | entry read scope           | hidden/absent/closed entry/conflict | not applicable to bounded read                              | unsupported media if sent | response/path bounds           | read limit           | read dependency/deadline | scrubbed internal |
| CMS-03B-13   | malformed path/query/cursor     | missing/expired session        | read scope                 | not applicable to a scoped list | cursor/context mismatch, changed collection (`aheadDigest`)                                 | unsupported media if sent | query bounds                   | read limit           | read dependency/deadline | scrubbed internal |
| CMS-03B-14   | malformed path/query            | missing/expired session        | author/editor scope        | concealed/absent target schema | not applicable to bounded read                            | unsupported media if sent | response/field bounds          | read limit           | read dependency/deadline | scrubbed internal |
| CMS-03B-15   | malformed path/query            | missing/expired session        | workflow read scope | hidden/absent entry/revision | not applicable to bounded read | unsupported media if sent | response bounds | read limit | read dependency/deadline | scrubbed internal |
| CMS-03B-16   | malformed path/query            | missing/expired session        | review read scope | hidden/absent/cross-owner review | not applicable to bounded read | unsupported media if sent | response bounds | read limit | read dependency/deadline | scrubbed internal |
| CMS-03B-17   | malformed query/cursor          | missing/expired session        | not applicable to a scoped list | not applicable to a scoped list | cursor/context mismatch | unsupported media if sent | query bounds | read limit | read dependency/deadline | scrubbed internal |
| CMS-03B-18   | malformed ID/header/body        | missing/expired or step-up MFA | owner capability, capability_missing | hidden/absent/cross-owner review | stale review, reviewer_not_eligible, assignment_exists, assignment_limit, review_not_open, idempotency | non-JSON | assignment contract, expiry_out_of_bounds | assignment limit | RPC deadline | scrubbed internal |

Database refusal convention (lane H item 6e): a semantic refusal raised by a command RPC is the reason token as the whole message of a P0001 exception (`VALIDATION_FAILED` or a lowercase Slice 10/11 reason) and its machine DETAIL is a JSON array of RFC 6901 pointer strings, never an object: `/fields/{stableFieldId}`, `/changedPaths/{index}`, `/choices/{index}`, or the request member (`/locale`, `/baseRevision`, `/expectedVersion`, `/ifMatch`, `/values`, `/schemaArtifact`, `/validatorRefs`, `/activationEvidence`, `/entryId`, `/conflictId`, `/revisionId`, `/migrationChainId`, `/contentTypeId`, `/contentTypeVersionId`). Only validated UUIDs and integer indexes are interpolated and no caller value is echoed; the Worker maps the array to the at most 50 `details.violations`, and drops a DETAIL that is not that array.

Error details use BE00 allowlists: 400/422 may carry at most 50 JSON-pointer violations; 401 carries only recoveryAction; 403 reasonCode without policy predicates; 404 is empty; 409 may include authorized expected/current version and safe conflict hashes; 429 carries retryAfterSeconds, limit, resetAt; 502/503/504 carries dependencyClass, retryable, and optional retryAfterSeconds; 500 is empty. A denied entry/review/revision cannot be distinguished from absence when the caller lacks read authority.

Slice 11 typed refusals carry exactly one lowercase `details.reasonCode` token from this closed catalog, plus only the members named here. 403 `FORBIDDEN`: `capability_missing`, `separation_of_duties`. 409 `CONFLICT`: `revision_not_submittable`, `dependency_changed` (with the current `dependencyHash`), `version_set_stale`, `review_not_open`, `duplicate_decision`, `specialist_slot_unsatisfiable`, `reviewer_not_eligible`, `assignment_exists`, `assignment_limit`, `publication_conflict`, `publication_not_active`, `preview_expired`, `preflight_evidence_stale`; a stale CAS operand is 409 `VERSION_MISMATCH` with the authorized expected/current versions. 422 `VALIDATION_FAILED`: `preflight_failed` (with `details.preflight`, at most 17 entries of `{ category, outcome, reasonCode }`), `dependency_manifest_too_large`, `unknown_timezone`, `tzdb_version_mismatch` (`details.pinnedVersion`), `nonexistent_local_time` and `ambiguous_local_time` (`details.alternatives`, at most two entries of instants and the closed `disambiguation` values), `disambiguation_not_applicable`, `resolved_utc_mismatch` (`details.expectedUtc`), `schedule_out_of_horizon` (`details.minUtc`, `details.maxUtc`), `authority_ends_before_schedule`, `expiry_out_of_bounds`; each pointer is an RFC 6901 pointer into the request body. 503 `DEPENDENCY_UNAVAILABLE` for an unavailable preflight carries `dependencyClass` `preflight` and `retryable` true. The internal operations return typed results instead of ApiError: CMS-03B-19 returns `PreviewVerificationResult` and any transport failure of that RPC is a preview denial in the caller; CMS-03B-20 returns `ScheduleExecutionResult`, and its `blocked` and `cancelled` outcomes carry only the closed schedule `reasonCode`.

### Persisted model envelope and exceptions

Every persisted 03b model carries the IA envelope `id: uuid`, `owner_id: uuid`,
`state: closed enum`, `version: bigint`, `created_at: timestamptz`, and
`updated_at: timestamptz`. `owner_id` is the server-resolved owning party or
parent aggregate; it is an ownership reference, never an authority grant, and
is never accepted from caller metadata. Child rows copy the parent-derived
`owner_id` even when a more specific foreign key is present. The physical
`state` column is a closed model-specific union; no free-form status is
permitted.

Entry and revision writes serialize with schema activation: CMS-03B-10 `cms_create_entry`, the CMS-03B-01 append and every other command that creates an entry or appends a revision take a `FOR SHARE` lock on the target content-type version's row before writing, and the 03a activation switch takes the conflicting lock, so no entry or revision commits unscanned between the final unchanged-source check and the switch (03a Activation transaction rules). The writers also share-lock the acting person's authority rows and the external relation targets they carry, in the global order of `Write-path lock order and authority fencing`, so a committed revocation of the writer's authority wins over a writer held between its check and its first insert.

The only atomically-created aggregate is CMS-03B-10: one transaction inserts the server-derived `ContentEntry` (lifecycle `active`, server-derived version 1, server-derived owner and creator), its first immutable `EntryRevision` draft with normalized values/relations, and the creator's scoped `cms_entry_assignments` row, whose `capability_key` is the capability the creator proved for the create (`cms.author` or `cms.editor`; `cms.author`, the first in the route policy order, when the creator holds both); any failure rolls back all three. Authority on an existing entry needs an active grant and an assignment of the same capability, so an editor-only creator holds exactly the assignment that the CMS-03B-01 append and the CMS-03B-11 draft read require for the entry they just created (EB-AC063; a creator with neither capability is 403 and creates nothing). The only IA naming exception in this boundary is `ContentEntry.lifecycle`,
which is the physical closed envelope state (`active | archived |
deletion_pending | held`) and is not duplicated by a second mutable state
column. The only timestamp-renewal exception is advisory `EditPresence`: its
named lease renewal RPC may update `lease_until`, `last_seen_at`, its monotonic
`version`, and `updated_at`; renewal never grants write authority. Losing
authority (an organization actor grant deactivated, deleted, or lapsed, or the
membership tenure ended) releases the person's active leases (state `revoked`)
and revokes the person's active entry assignments for every capability the
person no longer holds, in the same transaction as the loss (DEC-143);
re-granting a capability never restores an assignment, a fresh assignment is
required. All other
updates use the named state-transition RPCs below. Immutable or append-only
rows set `updated_at = created_at`, reject UPDATE and DELETE, and represent
later changes with a new row/version or an append-only transition record.

| 03b model / table                                 | Closed envelope state and ownership                                                                                                                                                                            | Mutability and exception                                                                                                                                                                                                                                                  |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ContentEntry / cms_content_entries`              | Envelope fields are `id`, `owner_id`, physical `lifecycle` state (`active`, `archived`, `deletion_pending`, `held`), `version`, `created_at`, and `updated_at`; `owner_id` is the resolved entry owner.        | Current-draft pointer, lifecycle, and aggregate `version` change only through an authorized CAS RPC; caller owner fields are ignored.                                                                                                                                     |
| `EntryRevision / cms_entry_revisions`             | Envelope fields are `id`, `owner_id`, physical `state` (the constant `draft`; the browser `EntryRevisionState` `draft`, `submitted`, `approved`, `rejected`, `scheduled`, `published` is **derived** by `cms_revision_effective_state`, E2), `version`, `created_at`, and `updated_at`; `owner_id` copies the entry owner. | Immutable snapshot after save; `updated_at = created_at`; workflow transitions are append-only evidence/pointers, never row UPDATE/DELETE.                                                                                                                                |
| `EntryFieldValue / cms_entry_field_values`        | Envelope fields are `id`, `owner_id`, `state` (`active`), `version`, `created_at`, and `updated_at`; `owner_id` copies the revision/entry owner.                                                               | Immutable normalized value snapshot; `version = 1` for the row; `updated_at = created_at`; no UPDATE/DELETE.                                                                                                                                                              |
| `EntryRelation / cms_entry_relations`             | Envelope fields are `id`, `owner_id`, `state` (`active`), `version`, `created_at`, and `updated_at`; `owner_id` copies the revision/entry owner.                                                               | Immutable relation evidence; `version = 1` for the row; `updated_at = created_at`; no UPDATE/DELETE. The registry, not caller metadata, supplies relation behavior.                                                                                                       |
| `EditPresence / cms_edit_presence`                | Envelope fields are `id`, `owner_id`, `state` (`active`, `expired`, `revoked`), `version`, `created_at`, and `updated_at`; `owner_id` copies the entry owner.                                                  | Advisory lease renewal is the sole timestamp/version update exception; it is CAS-guarded and never substitutes for assignment/capability.                                                                                                                                 |
| `EditorialReview / cms_editorial_reviews`         | Envelope fields are `id`, `owner_id`, `state` (`open`, `approved`, `rejected`, `invalidated`), `version`, `created_at`, and `updated_at`; `owner_id` copies the entry owner.                                   | Frozen revision/dependency/policy evidence is immutable. State/count invalidation uses the named review CAS RPC and increments `version`/`updated_at`; no caller authority is copied. Submission, decision, invalidation and decision-count advance are the only writers; reviewer assignment create/revoke does not advance `version`. |
| `EditorialDecision / cms_editorial_decisions`     | Envelope fields are `id`, `owner_id`, `state` (`recorded`), `version`, `created_at`, and `updated_at`; `owner_id` copies the review/entry owner.                                                               | Append-only decision evidence; `version = 1`, `updated_at = created_at`; no UPDATE/DELETE. Reviewer, capability, acting context, and MFA are server-resolved. The authorizing assignment (`assignment_id`, `assignment_version`) is recorded with the decision. |
| `PublicationSchedule / cms_publication_schedules` | Envelope fields are `id`, `owner_id`, `state` (`pending`, `executing`, `completed`, `failed_retryable`, `blocked`, `cancelled`), `version`, `created_at`, and `updated_at`; `owner_id` copies the entry owner. | Worker/command CAS may advance state and version; schedule identity/evidence is not replaced and caller metadata cannot select the owner. Claim, lease and retry columns advance only through the claim/execute RPCs of CMS-03B-20; `audience` and `review_id` are fixed at acceptance. |
| `PublicationVersion / cms_publication_versions`   | Envelope fields are `id`, `owner_id`, physical `state` (`active` or `revoked`; the browser `superseded` is derived for an `active` row that is no longer its lineage head, E3), `version` (the lineage sequence), `created_at`, and `updated_at`; `owner_id` copies the entry owner. | Append-only successor rows; `updated_at = created_at`; UPDATE/DELETE rejected; supersession is derived and revocation is a new tombstone row, never an update of prior evidence. |
| `PreviewToken / cms_preview_tokens`               | Envelope fields are `id`, `owner_id`, physical `state` (`active` or `revoked`; `expired` is derived from `expires_at`), `version`, `created_at`, and `updated_at`; `owner_id` copies the entry owner. | Token hash and binding evidence are immutable; expiry is derived, and revocation is a named CAS transition that cannot reveal token material.                                                                                                                             |
| `EntryAssignment / cms_entry_assignments`         | Envelope fields are `id`, `owner_id`, `state` (`active`, `revoked`), `version`, `created_at`, and `updated_at`; `owner_id` copies the entry owner, and the assignee/capability are server-derived.             | Mutable CAS envelope; assignment authority stays BE01-owned and caller-supplied owner/assignee/authority is never trusted; state and `version` advance only through the named assignment RPC, so there is no blanket `updated_at = created_at`.                           |
| `ConflictRecord / cms_conflict_records`           | Envelope fields are `id`, `owner_id`, `state` (`open`, `resolved`, `superseded`), `version`, `created_at`, and `updated_at`; `owner_id` copies the entry owner.                                                | Mutable CAS envelope written only through `cms_create_revision`/`cms_resolve_conflict`; `cms_resolve_conflict` CAS-closes the open record and increments `version`/`updated_at`, so there is no blanket `updated_at = created_at` (that holds only while `state='open'`). |
| `EditorialReviewAssignment / cms_editorial_review_assignments` | Envelope fields are `id`, `owner_id`, `state` (`active`, `revoked`), `version`, `created_at`, and `updated_at`; `owner_id` copies the entry owner; reviewer and grantor are server-resolved person references. | Mutable CAS envelope: created and revoked only by `cms_assign_editorial_reviewer`; revocation advances `version`/`updated_at`, so there is no blanket `updated_at = created_at`. |
| `ReviewDependency / cms_editorial_review_dependencies` | Envelope fields are `id`, `owner_id`, `state` (`active`), `version` (always 1), `created_at`, and `updated_at`; `owner_id` copies the review owner. | Immutable index of the frozen manifest identities; `updated_at = created_at`; no UPDATE/DELETE; rows persist after invalidation as history. |
| `SettingsSnapshot / cms_publication_settings_snapshots` | Envelope fields are `id`, `owner_id`, `state` (`active`), `version` (always 1), `created_at`, and `updated_at`; `owner_id` is the owning organization party. | Immutable insert-if-absent evidence; `updated_at = created_at`; no UPDATE/DELETE. |
| `PreflightRegistry / cms_preflight_registry` | Envelope fields are `id`, `owner_id` (the seeding release record), `state` (`seeded`), `version` (the registry version), `created_at`, and `updated_at`. | Code-owned immutable rows seeded by forward migration; `updated_at = created_at`; no UPDATE/DELETE and never writable by a caller. |

## Database Schema

Canonical editorial records live in private Supabase PostgreSQL schemas. Every table below has RLS enabled and forced, direct browser grants revoked, and named RPC access only. Fields intentionally without FKs are code registries, opaque hashes, version snapshots, or JSON manifests; their values are checked against the producer contract and cannot select arbitrary tables or authority.

### Canonical records and fields

| Model / table                                   | Typed fields, nullability, constraints, and FKs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Query indexes and write rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ContentEntry / cms_content_entries              | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; content_type_id uuid NOT NULL REFERENCES cms_content_types(id); owner_party_id uuid NULL REFERENCES platform_private.party(id); lifecycle text NOT NULL CHECK lifecycle IN ('active','archived','deletion_pending','held'); current_draft_revision_id uuid NULL; version bigint NOT NULL CHECK version > 0; created_by uuid NOT NULL REFERENCES auth.users(id); created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(lifecycle IN ('active','archived','deletion_pending','held'));                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | INDEX(owner_id,updated_at DESC); INDEX(owner_party_id,lifecycle,updated_at DESC); INDEX(content_type_id,lifecycle); UNIQUE(id,version). `lifecycle` is the physical closed envelope state per the IA exception; current_draft_revision_id is FK to cms_entry_revisions(id) added after table creation. Named RPC/CAS only; owner_id/created_by are server-derived and caller metadata is ignored.                                                                                                                                                                         |
| EntryRevision / cms_entry_revisions             | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; entry_id uuid NOT NULL REFERENCES cms_content_entries(id); revision_number bigint NOT NULL CHECK revision_number > 0; schema_version_id uuid NOT NULL REFERENCES cms_content_type_versions(id); template_version_id uuid NULL CHECK (template_version_id IS NULL OR platform_private.cms_template_registry_valid(template_version_id)); taxonomy_version_ids jsonb NOT NULL CHECK jsonb_typeof(taxonomy_version_ids)='array'; parent_revision_ids jsonb NOT NULL CHECK jsonb_typeof(parent_revision_ids)='array' AND jsonb_array_length(parent_revision_ids) <= 2; locale text NOT NULL CHECK locale ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'; payload_hash char(64) NOT NULL CHECK payload_hash ~ '^[a-f0-9]{64}$'; author_person_id uuid NOT NULL REFERENCES platform_private.person_party(party_id); acting_party_id uuid NULL REFERENCES platform_private.party(id); state text NOT NULL CHECK state IN ('draft','submitted','approved','rejected','scheduled','published'); version bigint NOT NULL CHECK version > 0; validation_state text NOT NULL CHECK validation_state IN ('valid','invalid','unknown'); validation_report jsonb NOT NULL CHECK jsonb_typeof(validation_report)='object'; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(updated_at = created_at);                                                                                                                                                                                                                                                                                                                                                                                                                                                | UNIQUE(entry_id,revision_number,locale); INDEX(owner_id,updated_at DESC); INDEX(entry_id,locale,revision_number DESC); INDEX(entry_id,state,updated_at DESC); INDEX(schema_version_id); immutable append-only snapshot after save; `updated_at = created_at`; UPDATE/DELETE rejected; workflow transitions are append-only evidence/pointers.                                                                                                                                                                                                                             |
| EntryFieldValue / cms_entry_field_values        | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state IN ('active'); version bigint NOT NULL DEFAULT 1 CHECK version > 0; revision_id uuid NOT NULL REFERENCES cms_entry_revisions(id); field_id uuid NOT NULL; field_definition_id uuid NOT NULL REFERENCES cms_field_definition_versions(id); locale text NOT NULL CHECK locale ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'; value jsonb NULL; provenance text NOT NULL CHECK provenance IN ('authored','default','inherited','localized_fallback','explicit_null','missing'); value_hash char(64) NULL CHECK value_hash IS NULL OR value_hash ~ '^[a-f0-9]{64}$'; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(updated_at = created_at); UNIQUE(revision_id,field_id,locale); UNIQUE(revision_id,field_definition_id,locale).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | INDEX(owner_id,updated_at DESC); INDEX(revision_id,locale); INDEX(field_id,locale); owner_id is copied from the revision/entry; field_id is the stable UUID and field_definition_id is the versioned FK; immutable normalized snapshot, `updated_at = created_at`, UPDATE/DELETE rejected; value is validated by schema version and may be null only with explicit_null/missing provenance.                                                                                                                                                                               |
| EntryRelation / cms_entry_relations             | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state IN ('active'); version bigint NOT NULL DEFAULT 1 CHECK version > 0; revision_id uuid NOT NULL REFERENCES cms_entry_revisions(id); field_id uuid NOT NULL; field_definition_id uuid NOT NULL REFERENCES cms_field_definition_versions(id); target_kind text NOT NULL CHECK target_kind ~ '^[a-z][a-z0-9._-]{0,95}$'; target_id uuid NOT NULL; expected_target_version bigint NULL CHECK expected_target_version > 0; position integer NOT NULL CHECK position >= 0 AND position < 512; on_unavailable text NOT NULL CHECK on_unavailable IN ('omit','block','placeholder'); created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(updated_at = created_at);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | UNIQUE(revision_id,field_id,target_kind,target_id); INDEX(owner_id,updated_at DESC); INDEX(revision_id,field_id,position); INDEX(target_kind,target_id); owner_id is copied from the revision/entry; immutable relation evidence, `updated_at = created_at`, UPDATE/DELETE rejected; target_id has no cross-domain FK by design; immutable 03a RelationDefinition resolves target type/projection, cardinality, min/max, ordered, and unavailable behavior (including placeholder) before this row is accepted or projected; caller relation metadata cannot override it. |
| EditorialReview / cms_editorial_reviews         | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; revision_id uuid NOT NULL REFERENCES cms_entry_revisions(id); state text NOT NULL CHECK state IN ('open','approved','rejected','invalidated'); version bigint NOT NULL CHECK version > 0; risk_class text NOT NULL CHECK risk_class IN ('ordinary','protected'); frozen_hash char(64) NOT NULL CHECK frozen_hash ~ '^[a-f0-9]{64}$'; dependency_manifest jsonb NOT NULL CHECK jsonb_typeof(dependency_manifest)='object'; dependency_hash char(64) NOT NULL CHECK dependency_hash ~ '^[a-f0-9]{64}$'; activation_evidence jsonb NOT NULL CHECK jsonb_typeof(activation_evidence)='object'; workflow_policy_key text NOT NULL CHECK workflow_policy_key ~ '^[a-z][a-z0-9._-]{0,127}$'; workflow_policy_version bigint NOT NULL CHECK workflow_policy_version > 0; workflow_policy_hash char(64) NOT NULL CHECK workflow_policy_hash ~ '^[a-f0-9]{64}$'; required_capabilities jsonb NOT NULL CHECK jsonb_typeof(required_capabilities)='array' AND jsonb_array_length(required_capabilities) BETWEEN 1 AND 16; required_decision_count smallint NOT NULL CHECK required_decision_count BETWEEN 1 AND 8; recorded_decision_count smallint NOT NULL DEFAULT 0 CHECK recorded_decision_count BETWEEN 0 AND 8 AND recorded_decision_count <= required_decision_count; approval_evidence_hash char(64) NOT NULL CHECK approval_evidence_hash ~ '^[a-f0-9]{64}$'; submitted_by uuid NOT NULL REFERENCES platform_private.person_party(party_id); submitted_at timestamptz NOT NULL DEFAULT now(); invalidated_reason text NULL CHECK (invalidated_reason IS NULL OR invalidated_reason IN ('revision_superseded','dependency_changed','reviewer_authority_changed','entry_unavailable')); decided_at timestamptz NULL; entry_id uuid NOT NULL REFERENCES cms_content_entries(id); created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK((risk_class <> 'protected') OR required_decision_count >= 2); CHECK((risk_class <> 'protected') OR jsonb_array_length(required_capabilities) >= 1); CHECK((state = 'invalidated') = (invalidated_reason IS NOT NULL)); CHECK((state IN ('approved','rejected')) = (decided_at IS NOT NULL)); | UNIQUE(revision_id) WHERE state IN ('open','approved'); INDEX(owner_id,state,updated_at DESC); INDEX(revision_id,state); INDEX(revision_id,submitted_at DESC,id DESC); INDEX(entry_id,state); INDEX(submitted_by,updated_at DESC); Frozen revision, dependency, activation, and workflow-policy evidence is immutable; only named review CAS RPC may advance state/count/version and updated_at; server resolves policy/capabilities/distinct humans/MFA and rejects caller authority. |
| EditorialDecision / cms_editorial_decisions     | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state IN ('recorded'); version bigint NOT NULL DEFAULT 1 CHECK version > 0; review_id uuid NOT NULL REFERENCES cms_editorial_reviews(id); reviewer_person_id uuid NOT NULL REFERENCES platform_private.person_party(party_id); acting_party_id uuid NULL REFERENCES platform_private.party(id); capability text NOT NULL CHECK octet_length(capability) BETWEEN 1 AND 128; assignment_id uuid NOT NULL REFERENCES cms_editorial_review_assignments(id); assignment_version bigint NOT NULL CHECK assignment_version > 0; decision text NOT NULL CHECK decision IN ('approve','reject'); reason text NOT NULL CHECK octet_length(reason) BETWEEN 1 AND 2000; comment_hash char(64) NULL CHECK comment_hash IS NULL OR comment_hash ~ '^[a-f0-9]{64}$'; reviewed_hash char(64) NOT NULL CHECK reviewed_hash ~ '^[a-f0-9]{64}$'; step_up_at timestamptz NOT NULL; decided_at timestamptz NOT NULL DEFAULT now(); created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(updated_at = created_at); | UNIQUE(review_id,reviewer_person_id); INDEX(owner_id,updated_at DESC); INDEX(review_id,decided_at); INDEX(reviewer_person_id,decided_at DESC). Append-only decision evidence; `updated_at = created_at`; UPDATE/DELETE rejected; the server derives the reviewer, the satisfied specialist slot capability, and the binding MFA instant (`step_up_at` NOT NULL); caller `capability`/`stepUpAt` are unknown keys and are never trusted; binding to the review's exact policy/approval evidence is rechecked. The forward migration sets `step_up_at NOT NULL` (E10; no rows exist before it) and adds the assignment columns; a BEFORE INSERT trigger forbids `reviewer_person_id` equal to the review's `submitted_by` or the revision's `author_person_id` (a cross-row rule, enforced by trigger and the RPC, never a CHECK); `capability` is the satisfied slot (the base slot `cms.reviewer` for a reject). |
| PublicationSchedule / cms_publication_schedules | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; entry_id uuid NOT NULL REFERENCES cms_content_entries(id); revision_id uuid NOT NULL REFERENCES cms_entry_revisions(id); dependency_hash char(64) NOT NULL CHECK dependency_hash ~ '^[a-f0-9]{64}$'; activation_evidence_hash char(64) NOT NULL CHECK activation_evidence_hash ~ '^[a-f0-9]{64}$'; action text NOT NULL CHECK action IN ('publish','unpublish','expire','archive'); local_datetime timestamp NOT NULL; timezone text NOT NULL CHECK octet_length(timezone) BETWEEN 1 AND 64; resolved_at_utc timestamptz NOT NULL; tzdb_version text NOT NULL CHECK octet_length(tzdb_version) BETWEEN 1 AND 32; disambiguation text NOT NULL CHECK disambiguation IN ('none','earlier','later'); state text NOT NULL CHECK state IN ('pending','executing','completed','failed_retryable','blocked','cancelled'); job_id uuid NULL; review_id uuid NOT NULL REFERENCES cms_editorial_reviews(id); audience text NOT NULL CHECK audience ~ '^[a-z0-9_-]{1,48}$' (E9; the lineage is the revision's entry, the revision's locale and this audience); expected_version bigint NOT NULL CHECK expected_version > 0 (the approved review's version at acceptance); attempt_count smallint NOT NULL DEFAULT 0 CHECK attempt_count BETWEEN 0 AND 3; next_attempt_at timestamptz NULL; lease_id uuid NULL; lease_until timestamptz NULL; reason_code text NULL CHECK (reason_code IS NULL OR reason_code IN ('approval_invalidated','preflight_failed','publisher_authority_ended','publication_not_active','retries_exhausted','entry_unavailable')); CHECK((state IN ('blocked','cancelled')) = (reason_code IS NOT NULL)); actual_at_utc timestamptz NULL; deviation_seconds bigint NULL; version bigint NOT NULL CHECK version > 0; created_by uuid NOT NULL REFERENCES platform_private.person_party(party_id); created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); | UNIQUE(entry_id,revision_id,action,local_datetime,timezone,audience); INDEX(revision_id,state); INDEX(state,next_attempt_at,resolved_at_utc) WHERE state IN ('pending','failed_retryable'); INDEX(review_id); INDEX(owner_id,state,updated_at DESC); INDEX(state,resolved_at_utc); INDEX(entry_id,state,resolved_at_utc); worker/command CAS on state/version; owner_id/created_by are server-derived; exact approved revision, activation/dependency evidence, and relation visibility rechecked at execution. |

### Support records required by the IA algorithms

| Support record / table                        | Typed fields, nullability, constraints, and FKs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Query indexes and write rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PublicationVersion / cms_publication_versions | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; publication_id uuid NOT NULL (the lineage id: the `id` of the lineage's first row); state text NOT NULL CHECK state IN ('active','revoked'); version bigint NOT NULL CHECK version > 0 (the lineage sequence); supersedes_id uuid NULL REFERENCES cms_publication_versions(id) (the previous head row); action text NOT NULL CHECK action IN ('publish','unpublish','expire','archive'); entry_id uuid NOT NULL REFERENCES cms_content_entries(id); revision_id uuid NOT NULL REFERENCES cms_entry_revisions(id); schedule_id uuid NULL REFERENCES cms_publication_schedules(id); publisher_person_id uuid NOT NULL REFERENCES platform_private.person_party(party_id); dependency_hash char(64) NOT NULL CHECK dependency_hash ~ '^[a-f0-9]{64}$'; activation_evidence_hash char(64) NOT NULL CHECK activation_evidence_hash ~ '^[a-f0-9]{64}$'; schema_artifact_id uuid NOT NULL; schema_artifact_hash char(64) NOT NULL CHECK schema_artifact_hash ~ '^[a-f0-9]{64}$'; version_set jsonb NOT NULL CHECK jsonb_typeof(version_set)='object'; schema_version_id uuid NOT NULL REFERENCES cms_content_type_versions(id); template_version_id uuid NULL CHECK (template_version_id IS NULL OR platform_private.cms_template_registry_valid(template_version_id)); taxonomy_version_ids jsonb NOT NULL CHECK jsonb_typeof(taxonomy_version_ids)='array'; settings_version bigint NOT NULL CHECK settings_version > 0; locale text NOT NULL CHECK locale ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'; audience text NOT NULL CHECK audience ~ '^[a-z0-9_-]{1,48}$' (E4); publication_hash char(64) NOT NULL CHECK publication_hash ~ '^[a-f0-9]{64}$'; activated_at timestamptz NULL; revoked_at timestamptz NULL; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(updated_at = created_at); CHECK((action = 'publish') = (state = 'active')); CHECK((state = 'active') = (activated_at IS NOT NULL) AND (state = 'revoked') = (revoked_at IS NOT NULL)); CHECK((version = 1) = (supersedes_id IS NULL)); CHECK(supersedes_id IS NULL OR supersedes_id <> id); | UNIQUE(entry_id,locale,audience,version); UNIQUE(publication_id,version); INDEX(owner_id,updated_at DESC); INDEX(entry_id,locale,audience,version DESC); INDEX(revision_id); INDEX(schedule_id) WHERE schedule_id IS NOT NULL. Append-only successor rows (E3): a BEFORE INSERT trigger verifies lineage consistency (same `publication_id`, `entry_id`, `locale` and `audience` as the `supersedes_id` row, `version` = the previous row's version + 1, and `revoked` only after an `active` head while `publish` may follow `active` or `revoked`); `updated_at = created_at`; UPDATE/DELETE rejected; every insert writes cms.publication.changed.v1 atomically. The former partial unique `WHERE state='active'` is dropped because a prior head stays `active` physically; at most one head per lineage is guaranteed by `UNIQUE(entry_id,locale,audience,version)` plus the lineage advisory lock. |
| PreviewToken / cms_preview_tokens             | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state IN ('active','revoked'); version bigint NOT NULL DEFAULT 1 CHECK version > 0; token_hash char(64) NOT NULL UNIQUE CHECK token_hash ~ '^[a-f0-9]{64}$'; entry_id uuid NOT NULL REFERENCES cms_content_entries(id); revision_id uuid NOT NULL REFERENCES cms_entry_revisions(id); user_id uuid NOT NULL REFERENCES auth.users(id); person_id uuid NOT NULL REFERENCES platform_private.person_party(party_id) (the canonical person: the BE04c `userId`); acting_party_id uuid NULL REFERENCES platform_private.party(id); capability_snapshot_hash char(64) NOT NULL CHECK capability_snapshot_hash ~ '^[a-f0-9]{64}$' (the BE04c `actingContextVersion`); version_set jsonb NOT NULL CHECK jsonb_typeof(version_set)='object'; locale text NOT NULL CHECK locale ~ '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'; audience text NOT NULL CHECK audience ~ '^[a-z0-9_-]{1,48}$' (E4); route text NOT NULL CHECK route ~ '^/[^\u0000-\u001f]{0,2047}$'; expires_at timestamptz NOT NULL CHECK expires_at = created_at + interval '15 minutes'; nonce uuid NOT NULL; revoked_at timestamptz NULL CHECK ((state = 'revoked') = (revoked_at IS NOT NULL)); created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); | INDEX(owner_id,updated_at DESC); INDEX(entry_id,revision_id,expires_at); INDEX(user_id,expires_at); INDEX(person_id,expires_at); INDEX(entry_id,state); INDEX(expires_at) WHERE revoked_at IS NULL. Token plaintext never persists (the token is derived from the row id and nonce by `Preview token and verification`, so an exact replay re-derives it); token/binding evidence is immutable; expiry is derived, and named CAS revocation may advance state/version/updated_at without exposing token material; caller owner/acting metadata is ignored. |
| EditPresence / cms_edit_presence              | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state IN ('active','expired','revoked'); version bigint NOT NULL CHECK version > 0; entry_id uuid NOT NULL REFERENCES cms_content_entries(id); person_id uuid NOT NULL REFERENCES platform_private.person_party(party_id); acting_party_id uuid NULL REFERENCES platform_private.party(id); lease_until timestamptz NOT NULL; last_seen_at timestamptz NOT NULL; current_field_id uuid NULL; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); UNIQUE(entry_id,person_id).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | INDEX(owner_id,state,updated_at DESC); INDEX(entry_id,lease_until); INDEX(person_id,lease_until); current_field_id is a stable field UUID revalidated against the active schema; owner_id is copied from the entry; advisory only; lease is 2 minutes, renewed every 30 seconds, expires without blocking another editor, and never grants write authority. Renewal is the sole permitted timestamp/version update exception and is CAS-guarded.                                                                                                                                                                                                                                                     |
| EntryAssignment / cms_entry_assignments       | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; entry_id uuid NOT NULL REFERENCES cms_content_entries(id); assignee_person_id uuid NOT NULL REFERENCES platform_private.person_party(party_id); capability_key text NOT NULL CHECK capability_key ~ '^[a-z][a-z0-9._-]{0,127}$'; state text NOT NULL CHECK state IN ('active','revoked'); version bigint NOT NULL DEFAULT 1 CHECK version > 0; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); UNIQUE(entry_id,assignee_person_id,capability_key).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | INDEX(entry_id,state); INDEX(assignee_person_id,state); DEC-106 foundation: CMS-03B-10 persists the creator scoped assignment atomically with the entry and first revision. assignee_person_id is the canonical derived person platform_private.person_party(party_id) and assignment is person-scoped, never keyed by an acting-party/org alias platform_private.party(id) that instead supplies acting context. Assignment authority stays BE01-owned and server-derived; the capability_key must resolve to a registry-backed cms.author or cms.editor key, and caller-supplied owner/assignee/authority is never trusted. State/version advance only through the named assignment RPC under CAS. |
| ConflictRecord / cms_conflict_records         | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; entry_id uuid NOT NULL REFERENCES cms_content_entries(id); base_revision_id uuid NOT NULL REFERENCES cms_entry_revisions(id); theirs_revision_id uuid NOT NULL REFERENCES cms_entry_revisions(id); yours_revision_id uuid NULL REFERENCES cms_entry_revisions(id); yours_source text NOT NULL CHECK yours_source IN ('revision','proposed'); proposed_values jsonb NULL; proposed_values_hash char(64) NULL CHECK proposed_values_hash IS NULL OR proposed_values_hash ~ '^[a-f0-9]{64}$'; changed_paths jsonb NOT NULL CHECK jsonb_typeof(changed_paths)='array' AND jsonb_array_length(changed_paths) BETWEEN 1 AND 128; base_hash char(64) NOT NULL CHECK base_hash ~ '^[a-f0-9]{64}$'; theirs_hash char(64) NOT NULL CHECK theirs_hash ~ '^[a-f0-9]{64}$'; yours_hash char(64) NOT NULL CHECK yours_hash ~ '^[a-f0-9]{64}$'; conflict_hash char(64) NOT NULL UNIQUE CHECK conflict_hash ~ '^[a-f0-9]{64}$'; state text NOT NULL CHECK state IN ('open','resolved','superseded'); version bigint NOT NULL DEFAULT 1 CHECK version > 0; resolved_revision_id uuid NULL REFERENCES cms_entry_revisions(id); resolved_by_person_id uuid NULL REFERENCES platform_private.person_party(party_id); resolved_acting_party_id uuid NULL REFERENCES platform_private.party(id); resolved_at timestamptz NULL; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK yours_source='revision' AND yours_revision_id IS NOT NULL AND proposed_values IS NULL AND proposed_values_hash IS NULL OR yours_source='proposed' AND yours_revision_id IS NULL AND proposed_values IS NOT NULL AND proposed_values_hash IS NOT NULL; CHECK proposed_values IS NULL OR jsonb_typeof(proposed_values)='object' AND platform_private.cms_json_bounded(proposed_values,262144,8,128,128); CHECK (state IN ('open','superseded') AND resolved_revision_id IS NULL AND resolved_by_person_id IS NULL AND resolved_acting_party_id IS NULL AND resolved_at IS NULL) OR (state='resolved' AND resolved_revision_id IS NOT NULL AND resolved_by_person_id IS NOT NULL AND resolved_at IS NOT NULL); | UNIQUE(conflict_hash); UNIQUE INDEX cms_conflict_records_one_open_per_entry ON (entry_id) WHERE state='open'; INDEX(owner_id,state,updated_at DESC); INDEX(entry_id,state,updated_at DESC); INDEX(entry_id,conflict_hash); INDEX(base_revision_id); INDEX(theirs_revision_id); INDEX(yours_revision_id); private platform_private schema, RLS ENABLED+FORCED, revoke all from public/anon/authenticated/service_role, single cms_conflict_records_rpc_policy gated by platform_private.cms_rpc_context_valid(); cms_conflict_records_write_guard BEFORE INSERT/UPDATE/DELETE calls platform_private.cms_write_guard().                                                                               |
| RestoreChainManifest / cms_restore_chain_manifests | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state = 'active'; version bigint NOT NULL DEFAULT 1 CHECK version = 1; content_type_id uuid NOT NULL REFERENCES cms_content_types(id); source_schema_version_id uuid NOT NULL REFERENCES cms_content_type_versions(id); target_schema_version_id uuid NOT NULL REFERENCES cms_content_type_versions(id); plan_ids jsonb NOT NULL CHECK jsonb_typeof(plan_ids)='array' AND jsonb_array_length(plan_ids) <= 64; edge_count smallint NOT NULL CHECK edge_count BETWEEN 0 AND 64; manifest_hash char(64) NOT NULL UNIQUE CHECK manifest_hash ~ '^[a-f0-9]{64}$'; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(updated_at = created_at); CHECK(edge_count = jsonb_array_length(plan_ids)); | UNIQUE(manifest_hash); INDEX(content_type_id,source_schema_version_id,target_schema_version_id); private platform_private schema, RLS ENABLED+FORCED, no grants; immutable (UPDATE/DELETE rejected), `updated_at = created_at`; each edge is a completed 03a migration-plan bound to the activation of its `to` version, consecutive (`from[i+1] = to[i]`), with the final `to` equal to the version active at restore time; `manifest_hash` is the JCS SHA-256 of `{contentTypeId, sourceSchemaVersionId, targetSchemaVersionId, planIds}` and `migrationChainId` is the UUID derived from it. |
| EditorialReviewAssignment / cms_editorial_review_assignments | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; review_id uuid NOT NULL REFERENCES cms_editorial_reviews(id); reviewer_person_id uuid NOT NULL REFERENCES platform_private.person_party(party_id); grantor_person_id uuid NOT NULL REFERENCES platform_private.person_party(party_id); capability_key text NOT NULL CHECK capability_key = 'cms.editorial_review'; actions text[] NOT NULL CHECK actions = ARRAY['read','decide']::text[]; state text NOT NULL CHECK state IN ('active','revoked'); starts_at timestamptz NOT NULL; ends_at timestamptz NOT NULL; reason text NULL CHECK reason IS NULL OR octet_length(reason) BETWEEN 1 AND 256; version bigint NOT NULL DEFAULT 1 CHECK version > 0; created_at timestamptz NOT NULL DEFAULT clock_timestamp(); updated_at timestamptz NOT NULL DEFAULT clock_timestamp(); CHECK (ends_at > starts_at); CHECK (ends_at <= starts_at + interval '7 days'); | UNIQUE(review_id,reviewer_person_id) WHERE state='active'; INDEX(review_id,reviewer_person_id,state); INDEX(reviewer_person_id,state,ends_at); INDEX(owner_id,state,ends_at). Created only by `cms_assign_editorial_reviewer` (create) and moved `active` → `revoked` only by its revoke action, which advances `version`/`updated_at`; decide authority requires `starts_at <= now < ends_at` and a non-revoked row, read authority a non-revoked row, and both are rechecked at decision time with the standing capability, so no expiry sweep is required; the row stores no acting context, owner authority or delegation and cannot be broadened; UPDATE/DELETE and direct grants are revoked; forced RLS. |
| ReviewDependency / cms_editorial_review_dependencies | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state = 'active'; version bigint NOT NULL DEFAULT 1 CHECK version = 1; review_id uuid NOT NULL REFERENCES cms_editorial_reviews(id); kind text NOT NULL CHECK kind IN ('schema','template','block','pattern','term','taxonomy_version','locale_source','relation_target','settings'); ref_id uuid NOT NULL; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(updated_at = created_at); UNIQUE(review_id,kind,ref_id); | INDEX(kind,ref_id); INDEX(review_id). Written only by `cms_submit_review` from the frozen manifest (a `settings` row names the snapshot id, a `schema` row the schema version id); immutable, and rows persist after invalidation as history; the dependency recheck job selects live reviews by (kind, ref_id); forced RLS, no grants. |
| SettingsSnapshot / cms_publication_settings_snapshots | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL; state text NOT NULL CHECK state = 'active'; version bigint NOT NULL DEFAULT 1 CHECK version = 1; ordinal bigint NOT NULL CHECK ordinal > 0; registry_version bigint NOT NULL CHECK registry_version > 0; snapshot_hash char(64) NOT NULL CHECK snapshot_hash ~ '^[a-f0-9]{64}$'; effective_values jsonb NOT NULL CHECK jsonb_typeof(effective_values)='array' AND jsonb_array_length(effective_values) <= 64; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(updated_at = created_at); UNIQUE(owner_id,snapshot_hash); UNIQUE(owner_id,ordinal); | Private, forced RLS, no grants; insert-if-absent by the settings snapshot function only, with `ordinal` the owner's previous maximum plus one taken under the owner's advisory lock; immutable (E7). |
| PreflightRegistry / cms_preflight_registry | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_id uuid NOT NULL (the seeding release record); state text NOT NULL CHECK state = 'seeded'; version bigint NOT NULL CHECK version > 0 (the registry version); category text NOT NULL CHECK category IN ('contract','schema','template','block','pattern','taxonomy','settings','relation','privacy','security','accessibility','media','route','locale','migration','domain_binding','revocation'); owner_slice text NOT NULL CHECK owner_slice ~ '^[a-z0-9._-]{1,32}$'; provider_key text NOT NULL CHECK provider_key ~ '^[a-z][a-z0-9._-]{0,127}$'; provider_version bigint NOT NULL CHECK provider_version > 0; provider_kind text NOT NULL CHECK provider_kind IN ('database','worker','reference_gate'); reference_kind text NULL CHECK (reference_kind IS NULL OR reference_kind IN ('pattern','taxonomy','privacy','media','route','locale')) AND ((provider_kind = 'reference_gate') = (reference_kind IS NOT NULL)); created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(updated_at = created_at); UNIQUE(category,version); | Private, forced RLS, no grants; seeded by forward migration only and immutable; the current row of a category is the one with the greatest `version`; a later slice registers its provider by inserting a newer row; CI asserts the categories equal the contracts `PreflightCategory` enum (D19). |

### Permission, RLS and grants

- All seventeen tables (the twelve canonical/support records, `cms_restore_chain_manifests`, and the Slice 11 `cms_editorial_review_assignments`, `cms_editorial_review_dependencies`, `cms_publication_settings_snapshots` and `cms_preflight_registry`) are in private CMS schemas with RLS enabled and forced. authenticated and anon have no direct INSERT/UPDATE/DELETE grants. Named RPCs are cms_create_revision, cms_resolve_conflict, cms_list_revisions, cms_restore_revision, cms_submit_review, cms_record_review_decision, cms_schedule_publication, cms_mint_preview, cms_publish_revision, cms_create_entry, cms_get_entry_draft, and the read RPCs cms_get_conflict_detail, cms_list_entries and cms_get_entry_authoring_context, the Slice 11 reads `cms_get_entry_workflow`, `cms_get_editorial_review` and `cms_list_editorial_reviews`, the Slice 11 command `cms_assign_editorial_reviewer`, the internal service RPCs `cms_verify_preview_token`, `cms_claim_due_publication_schedules` and `cms_execute_publication_schedule` (CMS-03B-19 and CMS-03B-20), the authority-loss cascades `cms_invalidate_reviews_for_person` and `cms_revoke_preview_tokens`, and the dependency job RPC `cms_recheck_review_dependencies(kind, ref_id, batch)`, plus the presence commands (DEC-143): the private lease renewal `cms_touch_edit_presence`, called only from inside the append write after its capability, tenant, lifecycle, CAS, and path gates (never a browser or PostgREST command), and the service-role expiry sweep `cms_expire_edit_presence_leases(batch)`, bounded 1–5000 and idempotent, which marks lapsed leases `expired` and answers `{ expiredLeases, activeLeases }` (`activeLeases` is the remaining unexpired lease count, capped at 10,000,000, and feeds the `cms_presence_active` gauge). cms_conflict_records is written only through those named RPCs: cms_create_revision records exactly one open conflict on same-field divergence, and cms_resolve_conflict CAS-closes it; there is no browser or direct-insert write path. cms_restore_chain_manifests is written only by cms_restore_revision (insert-if-absent then hash verify) and is never updated or deleted.
- ContentEntry SELECT requires derived person/acting-party assignment or an approved public-control projection; owner_party_id is resolved server-side. EntryRevision/EntryFieldValue/EntryRelation inherit the parent entry predicate and additionally require locale/audience disclosure.
- EditorialReview SELECT requires one of the five scopes of `Review scopes, reviewer assignment and decision evaluation`; EditorialDecision SELECT returns only safe decision metadata to eligible participants and exposes a decision's `reason` only to the decider, never another reviewer's private comment; EditorialReviewAssignment SELECT is available only through the review projection, the owner receives the assignment summaries and an assigned reviewer receives only the own assignment's id and end, and no person, actor or party identifier is serialized.
- PublicationSchedule writes require the owner-party publisher scope and are RPC-only; the entry workflow read serves schedule and publication summaries to any workflow read scope. PublicationVersion is public only through Shard 04's authorized projection; control-plane reads are no-store. PreviewToken is never directly selectable; the open recheck is CMS-03B-19, a named read-only RPC granted only to the Shard 04 delivery principal that rechecks every binding from the presented hash.
- platform_private.person_party(party_id) and platform_private.party(id) are the canonical BE01 references; this shard stores IDs only. platform_private.cms_template_registry_valid(uuid) is the registry seam for template_version_id until 03c owns the TemplateVersion relation and a forward migration adds the real FK. Target domain IDs in EntryRelation are intentionally not FKs because target kinds cross producer-owned schemas and are authorized by named projection contracts.
- RLS predicates use verified session, acting party, relationship/assignment, capability, risk, lifecycle, locale, and target authorization. Caller-provided partyId, reviewer ID, author ID, or public flag is never trusted.
- Migration-owned SECURITY DEFINER functions are schema-qualified with empty search_path, PUBLIC execute revoked, named grants only, and positive/negative RLS tests. Audit/idempotency/outbox records remain BE00-owned and commit atomically.

## Middleware & Policies

### Per-operation authorization matrix

| Operation ID | Principal / capability                                          | Ownership and state guard                                                                     | 403 rule                                      | 404 rule                     | Additional gate                                                                   |
| ------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| CMS-03B-01   | verified human with cms.author or cms.editor                    | assigned active entry; active schema; draft/autosave allowed                                  | visible entry, no assignment/edit             | entry hidden/absent          | schema and target relation recheck at save                                        |
| CMS-03B-02   | assigned author/editor with conflict.resolve                    | exactly one durable open conflict record per entry on the assigned entry; base still readable | visible conflict, no resolve capability       | hidden/absent entry/conflict | every same-field choice explicit; cms_resolve_conflict CAS-closes the open record |
| CMS-03B-03   | cms.author/editor/reviewer read scope                           | entry/revisions readable; cursor context matches actor/party                                  | visible entry, no read capability             | hidden/absent entry/revision | safe field, block and relation diff; no target identity in the relation token     |
| CMS-03B-04   | cms.author/editor edit                                          | source revision readable; migration chain registered; current schema compatible               | source readable, no edit                      | hidden/absent entry/revision | restore creates new draft only                                                    |
| CMS-03B-05   | entry assignee (`cms.author` or `cms.editor`) with edit authority on the entry | revision is the entry's current draft with effective state `draft`; no live review; manifest and frozen hash rebuild equal; publication preflight (submit phase) passes | visible target, no submit | hidden/absent target | frozen hash, risk class and workflow-policy evidence frozen server-side; dependency index rows written |
| CMS-03B-06   | assigned reviewer: active `cms.editorial_review` assignment plus a standing `cms.reviewer` grant (and the specialist capability for a specialist slot) | review `open`; frozen identities current; reviewer is neither submitter nor revision author and has not decided; slot derived server-side | readable review without an effective assignment or capability, or a separation-of-duties violation | hidden/absent review | unconditional recent binding MFA; approve refused when a specialist slot becomes unsatisfiable; first rejection ends the review |
| CMS-03B-07   | `cms.publisher` in the entry's owner party | revision effective state `approved` under an `approved` review whose `version` equals `expectedVersion`; frozen identities current; caller is not the revision author for `publish`; the publisher grant ends no earlier than `resolvedUtc` | visible target, no publish | hidden/absent target | unconditional step-up MFA; pinned-tzdb time authority; full preflight (schedule phase) |
| CMS-03B-08   | preview scope: entry assignee, active reviewer assignee of a review of the revision, or owner-party `cms.publisher` | revision readable; entry `active`; entry `version` equals If-Match; recomputed version set equals the request | visible target, no preview | hidden/absent target | 15-minute derived token, noindex/no-store/no public cache; no registry preflight |
| CMS-03B-09   | `cms.publisher` in the entry's owner party and an `approved` review | review `version` equals `expectedVersion`; frozen hash and recomputed manifest equal; every frozen identity current; caller is not the revision author; no lineage conflict | visible target, no publisher or a separation-of-duties violation | hidden/absent target | unconditional step-up MFA; full preflight (publish phase) and atomic lineage row, audit and outbox |
| CMS-03B-10   | verified human with registry cms.author or cms.editor           | active compiled schema; no prior entry or base revision required                              | visible target, no create capability          | target hidden/absent         | server-derived owner, assignee, and first revision                                |
| CMS-03B-11   | verified human with cms.author/editor read scope on entry       | readable active entry and current readable draft revision                                     | visible entry, no read capability/assignment  | entry hidden/absent          | no draft fabrication; bounded values only                                         |
| CMS-03B-12   | assigned author/editor with entry read scope                    | conflict belongs to the readable entry; the conflict is `open` (a closed conflict is concealed)   | visible entry, no read scope                  | hidden/absent/closed entry/conflict | no ownership identifier; no-store bounded preimages                               |
| CMS-03B-13   | cms.author/editor read scope                                    | only the caller's assigned/owned entries in the acting context are returned, driven from the caller's authorized assignments and never a scan of the hidden population                   | not applicable to a scoped list               | not applicable to a scoped list | signed cursor bound to query and read scope; bounded rows                        |
| CMS-03B-14   | cms.author/editor scope                                         | creatable active types and author-safe field projection; never a registry-wide read           | visible type outside the caller's scope       | concealed/absent target schema | no caller-chosen schema; no ownership identifier                                  |
| CMS-03B-15   | entry assignee, owner-party `cms.publisher`, or active reviewer assignee of a review of the revision | readable active-or-held entry and a revision of that entry; `preparation` only for a `draft` revision the caller may submit | visible entry, no workflow read scope | hidden/absent entry or revision | recomputed on every read; no authority granted by the projection |
| CMS-03B-16   | submitter, reviewer assignee (non-revoked), entry assignee, owner-party `cms.publisher`, or the receipt-derived owner | review resolvable under RLS | visible review, no read scope | hidden/absent/cross-owner review | decisions show the caller's own `reason` only; `assignments` owner-only |
| CMS-03B-17   | verified human | `assigned` lists only reviews with the caller's non-revoked assignment; `submitted` only the caller's submissions | not applicable to a scoped list | not applicable to a scoped list | signed cursor bound to query and acting scope; bounded rows |
| CMS-03B-18   | receipt-derived owner with `cms.editorial_review.assign` (never grantable) | review `open`; reviewer eligible; expiry within seven days, the reviewer grant end and the grantor authority end; fewer than 16 active assignments | owner capability denied, or the owner holds no valid `cms.editor` grant | hidden/absent/cross-owner review | unconditional step-up MFA; assignment confers only `read` and `decide` on this frozen review |
| CMS-03B-19   | the registered Shard 04 delivery principal only | the token hash resolves to an `active`, unexpired, unrevoked token bound to the supplied actor, acting-context version, route, locale and audience, on an `active` entry | not applicable (a denial is `valid: false`) | not applicable (a denial is `valid: false`) | byte-identical denial for every cause except the owner's own `revoked` |
| CMS-03B-20   | the Worker `scheduled` sweep principal only | schedule `pending` or `failed_retryable` and due, leased `executing`; approval, manifest, preflight and publisher revocation rechecked | not applicable (no caller) | not applicable (no caller) | lease and CAS fence; MFA not rechecked at fire time (DEC-120) |

Known readable resources with insufficient capability return 403. Resources outside the caller's disclosure scope, absent UUIDs after structural validation, expired/revoked preview tokens, and hidden reviews return indistinguishable 404 or the preview-safe denial. Structural malformed input is always 400 before an existence check.

### Security and abuse controls

- Raw body max 256 KiB; JSON nesting max 8, keys 128, arrays 128; `rich_text` is the canonical `rich_text.v1` AST and `object` is the DEC-133 typed depth-1 `properties[]` structure; non-canonical rich text and non-structural object values are refused, never canonicalized server-side. Reject scripts, CSS, HTML event handlers, template expressions, SQL, executable URLs and unsafe link schemes, arbitrary projection names, and hidden field injection.
- CMS-03B-10 create is idempotent and atomic: a duplicate Idempotency-Key with the same body and actor replays the original entry/revision, a key reused with a different body/actor returns 409, and a unique owner/content-type/idempotency binding prevents a duplicate entry or aggregate revision. No caller-supplied owner, assignee, author, acting party, capability, or version is accepted.
- CMS-03B-11 is a bounded no-store read that returns authorized schema-typed draft values only. It never returns untyped or private content, never falls back to a cross-tenant value, and cannot be reached without read capability/assignment.
- CMS-03B-12 returns only the three-way preimages of the named conflict while it is `open` (a resolved or superseded conflict is the same 404 as an absent one), bounded to 256 KiB and schema-typed against each side; field values the caller cannot read are omitted, never placeholdered, and no ownership identifier is serialized. CMS-03B-13 returns only the caller's assigned/owned entries. CMS-03B-14 returns only author-safe creatable types and field definitions and never grants `cms.schema_registry.read`.
- CMS-03B-03 relation comparison emits only a keyed stable `targetToken` (HMAC-SHA-256 with the `cms.compare.relation.v1` domain separator), so a hidden target UUID cannot be confirmed by probing; a request over 512 combined changes is a typed 422 `comparison_too_large` and an unresolvable recorded version is a non-disclosing 422 `comparison_unavailable`, never a truncated success.
- Restore is fail-closed: `cms_restore_revision` re-derives the immutable chain manifest from the completed activation-plan edges and requires the request's `migrationChainId` to equal it (409 `migration_chain_mismatch`); an ambiguous or over-64-edge chain, a missing transform, a required field without a literal default, and a template-incompatible target each refuse 409 with nothing fabricated and the source revision unchanged.
- Autosave is advisory and bounded: default 3 seconds idle, hard maximum 30 seconds while dirty. Presence is a 2-minute lease renewed by each authorized autosave (an autosave reaches the write at least every 30 seconds while the editor is dirty) and cannot block another editor; an idle editor's lease lapses after 2 minutes and the bounded `cms_expire_edit_presence_leases` sweep marks it expired (DEC-143). Local unsent values remain client-side when server authority changes.
- Every revision stores normalized hash, schema/template/taxonomy versions, author/acting context, parent IDs, validation result, and timestamp. A changed dependency, authority, or revision invalidates approval.
- Separation of duties (E11): the publisher is never the author of the revision published, a reviewer is never the revision author or the submitter, and review is required by every registry workflow member (`Registry invariants`). Protected policy/legal/security/financial disclosure requires two distinct humans, named specialist capability, and recent MFA; every decision, schedule and publication requires recent MFA (E6). Reviewer identity is derived, never submitted as authority.
- Preview token plaintext is never persisted: the stored value is a SHA-256 hash and the token is re-derived only for an exact replay of the minting command (`Preview token and verification`); it is bound to person, user, acting context, revision, full version set, locale, audience, route, expiry, nonce, and capability snapshot. Public caches/search/sitemaps never admit preview.
- Publication runs the seventeen-category preflight registry (`Publication preflight registry`): contract, schema, template, block, pattern, taxonomy, settings, relation, privacy, security, accessibility, media, route, locale, migration, domain binding and revocation state. A category whose owning domain is unbuilt passes only when the revision holds no reference of its kind (D19). Last-known-good remains public only when no takedown/privacy/security fail-closed rule applies.
- Rate buckets are keyed by actor and acting party, with separate author/review/schedule/preview/publish classes. Concurrent revision writes cap at three per actor, enforced in the database transaction (a per-actor advisory lock count taken by `cms_create_revision` before insert) so the cap holds across Worker isolates; a fourth concurrent write is refused with 429 before any insert, and duplicate exact commands are replayed, not multiplied.

## Data Flow

### Transaction and external seams

CMS-03B-01: parse request → authenticate/resolve acting context → check assignment and the active ContentTypeVersion plus its non-null immutable activationEvidence, SchemaArtifact/compiler, protected validator refs, and editorial workflow-policy evidence → reserve idempotency → lock ContentEntry and base revision → resolve immutable RelationDefinition metadata and validate changed paths/values/relations → insert immutable EntryRevision plus normalized EntryFieldValue/EntryRelation → update current draft pointer/version → append audit and cms.entry.revision-created.v1 outbox row → return 201. A non-conflicting commit supersedes every open conflict of the entry in the same transaction; a divergent append records (or reuses, only while its `theirs` is the current draft) the single open conflict. Before the first write the command takes the locks of `Write-path lock order and authority fencing` and takes one of the actor's three concurrent-write slots after the idempotency replay check (none free: 429 `RATE_LIMITED`, transaction rolled back). No publication or review mutation occurs.

CMS-03B-10: parse request → authenticate/resolve acting context → require a registry-backed cms.author/cms.editor capability → resolve the active ContentTypeVersion plus its non-null activationEvidence, SchemaArtifact/compiler, and protected validator refs → reserve idempotency → insert ContentEntry (lifecycle active, server-derived version 1) and its first immutable EntryRevision draft with normalized EntryFieldValue/EntryRelation rows and the creator scoped cms_entry_assignments row (capability_key = the capability the authority check proved, `cms.author` or `cms.editor`) in one transaction → append audit and cms.entry.revision-created.v1 outbox row → return 201 with the created entry/revision envelope. No prior base revision or If-Match is required, and no publication or review mutation occurs.

CMS-03B-11: parse request → authenticate/resolve acting context → require read capability/assignment on the readable active entry → load the current readable immutable draft revision under RLS → return authorized, schema-typed field values and bounded relations with provenance and safe hashes. It writes nothing, emits no event, and never discloses a value the caller cannot read.

CMS-03B-12: parse request → authenticate/resolve acting context → require entry read scope → load the durable conflict record and its base/theirs/yours snapshots under RLS → conceal a resolved or superseded conflict as the same 404 as an absent one (DEC-139) → return the bounded three-way preimages of the `open` conflict, with each side schema-typed against its own `schemaVersionId`. It writes nothing, emits no event, and never discloses an unreadable value or an ownership identifier.

CMS-03B-13: parse request → authenticate/resolve acting context → require cms.author/cms.editor read scope → resolve the signed cursor against the complete query and acting read scope → in one statement (one snapshot) compute the collection epoch of the cursor position and read the caller's authorized page (`Entry list keyset, authorization and collection epoch`) → 409 `CONFLICT` when the epoch differs from `aheadDigest` → return only the caller's assigned/owned entries as bounded summaries with a page ETag and a fresh signed cursor. It writes nothing and emits no event.

CMS-03B-14: parse request → authenticate/resolve acting context → require cms.author/cms.editor scope → with `contentTypeVersionId` return the author-safe field-definition projection for that active compiled version, otherwise return the caller's creatable active types with their `schemaArtifact`, `validatorRefs`, `workflowPolicy`, and `activationEvidence`; it never grants `cms.schema_registry.read` and never accepts a caller-chosen schema. It writes nothing and emits no event.

CMS-03B-02: load the single durable open conflict record and common base under RLS → validate explicit choices against current schema → lock entry/base → insert revision with both parent IDs → CAS-close the open conflict atomically (state='resolved' with resolved_revision_id/by_person/at) → audit/outbox. Both competing revisions and the common base remain readable. If base moved, return 409 with safe base/theirs/yours hashes/values and preserve both revisions and the open conflict record. On same-field divergence a candidate committed as a revision is stored with yours_source='revision' plus yours_revision_id, while a rejected or late autosave that never became a revision is stored with yours_source='proposed' plus bounded proposed_values (≤128 keys/≤8 levels/≤256 KiB, enforced by both the table CHECK via platform_private.cms_json_bounded and the RPC boundary) and its 64-hex hash, leaving yours_revision_id NULL; a non-null yours_revision_id is never required. At most one open conflict exists per entry; resolution never last-writes-wins.

CMS-03B-03 reads only authorized revision summaries and safe schema-aware hashes, and its comparison reports field, block, and relation domains using only side hashes and keyed relation tokens. CMS-03B-04 re-derives the immutable restore chain manifest from completed 03a activation-plan edges, requires the request's `migrationChainId` to equal the derived ID, translates source content into the current active schema (revalidating `rich_text.v1`, `object` structures, and relations), validates non-fabricating defaults, and inserts a new draft with `parentRevisionIds = [currentDraftRevisionId, sourceRevisionId]`; it never edits or activates the source revision, fabricates nothing, supersedes every open conflict of the entry in the same transaction, and writes the chain evidence of `Revision comparison domains (D5) and restore chain (D6)`.

CMS-03B-05: parse → authenticate/resolve acting context → entry assignee with edit authority → verify the revision is the entry's current draft with effective state `draft` and the frozen hash equals its payload hash → rebuild the manifest with `cms_build_dependency_manifest` and require JCS equality with the request → run the preflight registry (submit phase) with the Worker's accessibility `PreflightEvidence` → reserve idempotency → insert the `open` EditorialReview (frozen revision, manifest, dependency hash, activation evidence, editorial workflow-policy evidence resolved by the strictest-of rule, `approval_evidence_hash`, `submitted_by`) and its ReviewDependency rows → audit and `cms.entry.review-changed.v1` → 201. CMS-03B-06 follows the ten ordered decision steps of `Review scopes, reviewer assignment and decision evaluation`, computes the policy-required count live, and invalidates on any hash/dependency/authority change (`Review invalidation`). CMS-03B-18 locks the review row, validates the reviewer and expiry bounds, inserts or revokes the assignment, and writes the audit record and `cms.entry.review-changed.v1`. CMS-03B-15, CMS-03B-16 and CMS-03B-17 are safe reads that write nothing and emit nothing.

CMS-03B-07: parse → authenticate/resolve acting context → step-up (unconditional) → owner-party publisher scope and the approved review (`version` equals `expectedVersion`) → Time authority (E8) → manifest equality and currency of every frozen identity → full preflight (schedule phase) → reserve idempotency → insert the `pending` schedule (local datetime, timezone, verified resolved UTC, pinned tzdb version, disambiguation, audience, `review_id`, the review version as `expected_version`, dependency hash, activation evidence hash) → audit → 202. It emits no event: `cms.publication.changed.v1` is emitted only by an executed publication. CMS-03B-20 claims and executes due schedules exactly as `Schedule execution (CMS-03B-20)` states. CMS-03B-09: parse → authenticate/resolve acting context → step-up (unconditional) → owner-party publisher scope, the approved review and separation of duties → `frozenHash`, manifest and version-set equality and currency → full preflight (publish phase) → reserve idempotency → lock the lineage and append the head row under the lineage rules (E3), the audit record and exactly one `cms.publication.changed.v1` in one transaction → 202 with `projectionState` `pending`.

CMS-03B-08: parse → authenticate/resolve acting context → preview scope on the revision → `If-Match` equals the entry `version` → recompute the version set of the named revision and require equality → reserve idempotency → insert the token row (hash only) and derive the token (`Preview token and verification`) → audit, no outbox event → 201 with the token returned in this response and on an exact replay. Every preview open is CMS-03B-19, which rechecks the token hash, expiry, person, acting-context version, route, audience, locale, minting scope and revocation. CMS-03B-09 never trusts a preview token as publication authorization.

The canonical compiler, migration transform, and projection consumers are internal. If a remote checker/registry adapter is enabled, its exact seam is: Zod request/response envelope, 2,000ms RPC timeout, application route deadline 15,000ms, at most three pre-effect retries at 15s/60s/300s with jitter, circuit opens after five consecutive retryable failures for 60s. Invalid upstream response maps 502, unavailable/open circuit 503, deadline 504. No publication commits on an unresolved preflight. An ambiguous post-effect response reconciles by idempotency/publication status before retry; no blind duplicate publish.

### State machine and concurrency

- EntryRevision (derived, E2): draft → submitted → approved or rejected → scheduled → published; the stored row never changes state and the exposed state is the first matching evidence rule of the effective-state helper. CMS-03B-10 creates the first draft revision in the same transaction as the entry aggregate and its assignment; a retried create with the same idempotency binding returns that same first revision and never appends a second one. Any changed draft creates a new immutable revision and invalidates affected review. A rejected revision remains immutable and readable to authorized actors; field-value and relation snapshots are `active`, version 1, and append-only.
- EditorialReview: open → approved, rejected, or invalidated, and approved → invalidated; rejected and invalidated are terminal. Approval count and distinct people/capabilities are computed transactionally from the frozen policy evidence (`1..8`, with recorded never exceeding required); protected review requires two distinct humans and specialist/MFA evidence; the first rejection ends the review; reviewer assignment create/revoke does not change the review state or version. EditorialReviewAssignment: active → revoked (an expired assignment is `active` with `ends_at` past and is inert).
- EditorialDecision: `recorded` only; each decision is an immutable append-only evidence row bound to the review's exact policy and approval-evidence hash.
- PublicationSchedule: pending → executing → completed, failed_retryable, blocked, or cancelled; failed_retryable → executing (the retry ladder, at most three attempts) and pending or failed_retryable → cancelled (approval invalidated or entry unavailable); completed, blocked and cancelled are terminal. Exact action/revision/version is idempotent. Late/repeated workers record actual time/deviation and cannot duplicate a PublicationVersion.
- PublicationVersion (lineage, E3): a publish appends an `active` head and derives the prior head `superseded`; unpublish, expire and archive append a `revoked` tombstone; a revoked lineage may be published again; no prior row is ever updated or deleted. PreviewToken is `active → revoked` with `expired` derived from `expires_at`, token identity/binding immutable and revocation CAS-only.
- ConflictRecord (DEC-139, lane H item 6c): `open` → `resolved` (the CMS-03B-02 resolution commit sets `resolved_revision_id`, `resolved_by_person_id`, `resolved_at`) or `open` → `superseded` (version + 1, the `resolved_*` members stay NULL and no resolution evidence is written); `resolved` and `superseded` are terminal and only an `open` conflict is readable. At most one `open` conflict exists per entry. A CMS-03B-01 append that commits without a conflict and every CMS-03B-04 restore supersede every open conflict of the entry in the same transaction as the revision insert, so a draft that moved past a conflict never leaves it wedged open; an append that diverges again never reuses an open conflict whose `theirs` is not the current draft revision: that conflict is superseded and a fresh one is recorded. A resolve against a closed conflict is 409 `CONFLICT` `INVALID_TRANSITION` and changes nothing.
- Revision write uses SELECT FOR UPDATE and exact base/entry version, taken in the global order of `Write-path lock order and authority fencing`. Same-field divergence never last-writes-wins; non-overlapping paths may merge with both parents. A lost response is resolved by the same idempotency key.
- Presence lease does not lock content. Worker/schedule leases use BE00 job semantics and CAS. Failed rows remain on old readable schema; a projection or provider outage cannot roll back committed publication state.

### Event schemas

All events use the BE00 identifier-only envelope: eventId UUID, eventType, schemaVersion, occurredAt, producer, correlationId, causationId, aggregateType, aggregateId, aggregateVersion as a lossless decimal string, and payload IDs only.

| Event type                    | Exact payload                                      | Producer / consumer rule                                                                                                                                                                  |
| ----------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cms.entry.revision-created.v1 | { entryId: UUID, revisionId: UUID }                | CMS-03B-01, CMS-03B-02, CMS-03B-04, and CMS-03B-10 emit after commit; CMS-03B-10 emits exactly one for the initial revision; review/search-draft/task consumers refetch under capability. |
| cms.entry.revision-restored.v1 | { entryId: UUID, revisionId: UUID, sourceRevisionId: UUID, migrationChainId: UUID, chainHash: lowercase 64-hex, edgeCount: integer 0..64, valueCount: integer >= 0, relationCount: integer >= 0 } | CMS-03B-04 emits exactly one after commit, together with `cms.entry.revision-created.v1`; identifiers, hash and counts only (no value, target identity, secret or authority); consumers refetch under capability. |
| cms.entry.review-changed.v1   | { reviewId: UUID, revisionId: UUID }               | CMS-03B-05/06 emit after review or decision commit, CMS-03B-18 after an assignment is created or revoked, and review invalidation after its commit; task/notification consumers refetch frozen state through CMS-03B-16.                                                                                     |
| cms.publication.changed.v1    | { entryId: UUID, publicationVersionId: UUID }      | CMS-03B-09 and the schedule executor (CMS-03B-20) emit exactly one per appended lineage row (a publish head or a tombstone), with that row's id as `publicationVersionId`; Shard 04 route/render/search/sitemap/cache consumers converge exact ID/version.                                        |
| cms.localization.changed.v1   | { entryId: UUID, locale: BCP47, revisionId: UUID } | 03c emits locale changes; 03b invalidates affected review/publication dependencies and refetches exact locale revision.                                                                   |

Consumers are at-least-once, deduplicated by event identity, and monotonic by aggregate version. Unknown event versions go directly to DLQ. Retries are max three at 15s/60s/300s; terminal failure is visible as degraded/pending and never guessed as success. Events contain no content values, review comments, token, PII, or target-domain authority.

### Cross-shard direction

- BE00 provides ApiError, request IDs, ETags, idempotency, audit/outbox, jobs, queue envelope, CORS/CSRF, rate, SLO, and recovery fencing.
- BE01 provides verified person/party/acting context, assignment, mandate, capability, and MFA facts. 03b stores only canonical IDs and rechecks at commit. DEC-106 requires BE01/migration ownership of the cms.author and cms.editor capability-registry keys and of the platform_private.cms_entry_assignments rows that CMS-03B-10/-11 authorize against; this shard only reads them and never mints assignment or capability authority.
- 03a provides active ContentTypeVersion, FieldDefinitionVersion, immutable RelationDefinition, SchemaArtifact, migration-chain, and BlockDefinitionVersion IDs/hashes. EntryRevision stores the exact schema version; its frozen review/publication VersionSet and DependencyManifest capture the active ContentTypeVersion id/hash, non-null server activationEvidence, SchemaArtifact id/hash/compiler, protected validator refs, and editorial workflow-policy evidence, and stale schema, activation evidence, or artifact rejects. 03b never treats an activation or approval ID supplied by a caller as authority.
- 03c provides TemplateVersion, PatternVersion, TaxonomyVersion/Term, LocaleVariant, and related-content dependencies. 03b freezes hashes and invalidates on source/dependency change; 03c does not receive authority through a revision.
- Shard 04 consumes cms.publication.changed.v1 and refetches exact PublicationVersion under its own public projection/auth/cache policy. It owns route/render/search/sitemap convergence and tombstone handling.
- Shard 05 supplies governed settings/checker/risk definitions only through versioned allowlists (`Settings snapshot authority`; the checker is the 05c D25 module delivered by Slice 11); it cannot bypass editorial or legal/security gates.
- Shard 04 reads preview tokens only through CMS-03B-19 and publication rows only through `cms.publication.changed.v1` plus the exact row (E3); it never reads control-plane tables.
- Domain shards supply named read-only projections for relations. A private/embargoed/deleted target is omitted or blocks per RelationDefinition; no stale target field is copied.
- Shard 16 canonical credential/entitlement/credit/EvidenceState/InstitutionGate records remain outside CMS; reserved-concept checks prevent entries or publications from impersonating them.

## Error Handling

### Operation error coverage

The route registry and contract matrix are exhaustive for all eighteen HTTP operation IDs; CMS-03B-19 and CMS-03B-20 are internal RPCs whose typed results replace an HTTP error matrix (below). Every failure uses BE00 ApiError { code, message, requestId, details } and no command reports success before its canonical transaction outcome is known.

| Operation ID | Before mutation                               | Transaction / race                                                                           | After commit / recovery                                                                                                |
| ------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| CMS-03B-01   | transport/auth/assignment/schema/value errors | 409 base/version/conflict/idempotency; rollback leaves no revision                           | committed revision event retries idempotently; local unsent value retained on denial                                   |
| CMS-03B-02   | transport/auth/conflict-choice errors         | 409 base moved or invalid transition; open conflict record preserved; both parents preserved | new two-parent revision; conflict CAS-closed atomically; no inferred choice                                            |
| CMS-03B-03   | transport/auth/cursor errors                  | safe read never mutates                                                                      | projection lag does not change history; refetch cursor on expiry                                                       |
| CMS-03B-04   | transport/auth/migration errors               | 409 stale version/chain/hash; source remains unchanged                                       | new draft only; migration failure resumes or remains blocked                                                           |
| CMS-03B-05   | transport/auth/preflight errors               | 409 not submittable/open review/dependency changed; 422 preflight_failed; no review on failure | review event retries; later dependency, revision or authority change invalidates the review                          |
| CMS-03B-06   | transport/auth/MFA errors                     | 409 stale review/duplicate decision/hash; append-only decision                               | review event retries; approval cannot survive changed dependency                                                       |
| CMS-03B-07   | transport/auth/time errors                    | 409 exact schedule collision/version; no job effect                                          | worker CAS, retry/DLQ; prior publication intact on blocked execution                                                   |
| CMS-03B-08   | transport/auth/version errors                 | 409 stale version set; no token mint                                                         | revocation/expiry causes 404-safe preview denial; no cache/search trace                                                |
| CMS-03B-09   | transport/auth/MFA/preflight errors           | 409 stale review version/version set/dependency/lineage conflict; no partial publication     | committed lineage row remains canonical; Shard 04 retries projection; privacy/security/takedown may fail closed        |
| CMS-03B-10   | transport/auth/assignment/schema/value errors | 409 duplicate key/schema/idempotency; rollback leaves nothing                                | committed entry and first revision event retries idempotently; replay returns the original resource                    |
| CMS-03B-11   | transport/auth/capability/query errors        | safe read never mutates                                                                      | no audit/outbox effect; concealment stays 404 on refetch                                                               |
| CMS-03B-15   | transport/auth/capability/query errors        | safe read never mutates; an unavailable preflight provider is reported inside `preparation.preflight`, not as a failure | no audit/outbox effect; concealment stays 404 on refetch |
| CMS-03B-16   | transport/auth/capability/query errors        | safe read never mutates                                                                      | no audit/outbox effect; concealment stays 404 on refetch                                                               |
| CMS-03B-17   | transport/auth/cursor errors                  | safe read never mutates; 409 expired/tampered/foreign cursor                                 | restart from the first page on a cursor conflict                                                                       |
| CMS-03B-18   | transport/auth/MFA/eligibility errors         | 409 stale review/ineligible reviewer/duplicate or full assignment/review not open; no row on failure | assignment event retries idempotently; an expired assignment is inert without a sweep                          |

Failure cascade rules: a PostgreSQL disconnect before commit leaves no revision/review/schedule/publication; a lost response after commit is reconciled by idempotency/status. Queue/outbox failure does not roll back canonical state. Worker crash resumes by lease/CAS. Projection failure leaves pending/degraded status and last-known-good. Audit failure blocks the command. Unknown exception is 500 with empty details and scrubbed telemetry.

## Observability

Each operation emits structured scrubbed logs keyed by operation ID, requestId, traceId, correlationId, actor class, acting-context class, safe aggregate ID/hash, revision/version, outcome, error code, duration, dependency class, and retryability. No content values, review comments, token, email, party name, capability graph, raw target projection, or request body enters logs/provider-native diagnostics.

Per-operation metrics:

- cms_editorial_request_total{operation,outcome}, cms_editorial_latency_ms, cms_editorial_error_total{operation,code}, cms_editorial_rate_limited_total, cms_editorial_conflict_total{operation,reason}
- cms_revision_created_total, cms_revision_validation_failed_total, cms_conflict_open_total, cms_conflict_closed_total, cms_conflict_one_open_violation_total, cms_conflict_records_created_total, cms_presence_active, cms_review_open_age, cms_review_invalidated_total
- cms_entry_create_total{outcome}, cms_entry_create_replayed_total, cms_entry_create_conflict_total, cms_entry_draft_detail_total{outcome}, cms_entry_draft_detail_denied_total
- cms_schedule_state_total, cms_schedule_lateness_seconds, cms_preview_minted_total, cms_preview_denied_total, cms_publication_state_total, cms_publication_projection_lag, cms_outbox_age, cms_queue_retry_total, cms_queue_dlq_total
- Slice 11: cms_review_submitted_total{riskClass,outcome}, cms_review_decision_total{decision,outcome}, cms_review_assignment_total{action,outcome}, cms_review_invalidated_total{reason}, cms_preflight_result_total{category,outcome,phase}, cms_preflight_latency_ms{category}, cms_a11y_checker_duration_ms, cms_schedule_blocked_total{reason}, cms_schedule_attempt_total{outcome}, cms_schedule_claim_batch_size, cms_preview_verify_total{valid}, cms_publication_lineage_conflict_total, cms_settings_snapshot_ordinal, cms_separation_of_duties_refusal_total{operation}. Labels never carry an id, hash, reason text or person.

Traces cover validation → principal/assignment → schema/dependency refetch → idempotency → RPC/SQL → audit/outbox → worker → Shard 04 refetch. Alert when review invalidation spikes >5%/5m, schedule blocked >15m, publication projection lag >2m, DLQ >0, outbox age >2m, preview denial anomaly indicates forwarding/abuse, any `cms_schedule_blocked_total{reason="retries_exhausted"}` increment, the accessibility checker exceeds 2,000 ms, or `cms_publication_lineage_conflict_total` rises above background. SLOs: Tier 1 p95 <750ms; Tier 2 p95 <1,200ms; protected RPC <300ms; job acceptance p95 ≤500ms/p99 ≤1,000ms; Queue first attempt p95 ≤60s; DLQ <0.1% daily.

## Testing Strategy

### Contract and route tests

- Generated OpenAPI, Hono routes, and registry rows match all eighteen HTTP operation IDs (and the two internal RPC operations CMS-03B-19 and CMS-03B-20 are absent from the browser inventory), method/path, request/success/error, auth, CORS, rate, timeout, cache, idempotency, ETag, and SLO fields.
- CMS-03B-01 tests every EntryRevisionRequest field, unique changedPaths, values max 128 UUID keys and JSON depth 8, autosave 3s/30s, all field kinds through 03a, structured rich text, missing/null/empty/default/inherited provenance, relation allowlist, assignment denial, base conflict, and cms.entry.revision-created.v1.
- CMS-03B-02 tests base/theirs/yours conflict payloads, each explicit choice with a schema-validated value, a named choice (base/theirs/yours) that carries a value rejected symmetrically rather than silently ignored, duplicate-path choices rejected, cross-field merge, same-field choice, no-answer preservation, moved-base 409, and two-parent revision. It also covers durable conflict-record create/load/close, the one-open-per-entry partial unique, the yours_source revision/proposed coupling (including the nullable yours_revision_id path where a candidate never became a revision), the bounded proposed_values CHECK plus RPC-boundary revalidation, and the resolved-envelope CHECK.
- CMS-03B-03 tests pagination limit 1/50, cursor signing/expiry/context binding, hidden revisions, compare hashes and safe field paths, no mutation, and no private content disclosure.
- CMS-03B-04 tests registered migration chain, missing step, non-fabricating transform, source immutability, current-schema draft, stale ETag, worker failure, and replay.
- CMS-03B-05 tests frozen content/dependency hashes, server-side manifest and version-set rebuild equality (a manifest differing by one hash is 409 `dependency_changed`), all seventeen preflight categories in submit phase with each reason code, the D19 reference gate (a revision with an `internal` link or a `no_fallback` schema field fails `provider_unbuilt_reference`; one without passes), ordinary/protected risk with the strictest-of rule over a superseded source version, one open review, duplicate submission, `revision_not_submittable` for a superseded or already-reviewed revision, the entry-version `If-Match`, the ReviewDependency rows, and the review event.
- CMS-03B-06 tests author/reviewer distinctness, duplicate reviewer, policy counts 1 and 8, recorded counts 0 and 8, `recordedDecisionCount <= requiredDecisionCount`, protected `requiredDecisionCount >= 2` and nonempty `requiredCapabilities`, specialist/MFA freshness, stale hash, reject path, invalidation, exact workflow-policy key/version/hash/capabilities/approval-evidence bindings, and append-only decisions.
- CMS-03B-07 tests every Time authority step (unknown zone, pinned-version mismatch, nonexistent time with both alternatives at a spring-forward gap, `ambiguous_local_time` and earlier/later at a fall-back fold, `disambiguation_not_applicable`, `resolved_utc_mismatch`, the 60 s / 366 d horizon and its boundaries, the −12 h / +14 h RPC sanity bound), a three-segment zone and `UTC`, all four actions, the approved-review `If-Match`, the grant-end-before-schedule refusal, `separation_of_duties`, unconditional step-up with no idempotency record on the 401, exact-version schedule uniqueness including `audience`, and no outbox event at acceptance; CMS-03B-20 tests claim batching with `SKIP LOCKED` under two concurrent sweepers, lease expiry recovery, duplicate and late runs (deviation recorded, one publication), every `reasonCode`, the 15 s / 60 s / 300 s ladder ending in `retries_exhausted`, `approval_invalidated` on a changed review version, the DEC-120 revocation recheck without an MFA recheck, and tombstone append for unpublish, expire and archive.
- CMS-03B-08 tests token derivation (43 base64url characters, never stored, hash-only persistence, an exact replay re-deriving the identical token and a replay after expiry or revocation being 409 `preview_expired`), exactly 900 s expiry, person/user/acting/audience/locale/route/version-set binding, the entry-version `If-Match`, revocation on authority loss and on entry unavailability, no-store/noindex; CMS-03B-19 tests every `valid: false` cause producing a byte-identical result (unknown hash, expired, forwarded actor, another context version, route, locale or audience, lost minting scope) with `revoked` true only for the bound owner, the valid result shape including `entryId` and `revisionId`, and zero writes.
- CMS-03B-09 tests publisher/approval gates, unconditional step-up, `separation_of_duties`, all seventeen preflight categories in publish phase, the approved-review `If-Match`, expected-version-set and frozen-hash equality with `version_set_stale` for a superseded schema, template or taxonomy version, the lineage append (head row, derived `superseded` for the prior head, `publication_conflict` under two racing publishers on `UNIQUE (entry_id, locale, audience, version)`), tombstone and re-publish after revocation, atomic lineage row + audit + exactly one outbox event, `projectionState` pending/converged/degraded, and `publication_hash` determinism.
- CMS-03B-10 tests atomic entry + first revision + normalized values/relations + creator assignment in one transaction, Idempotency-Key replay of the identical resource, key reuse with a changed body/actor returning 409, unique owner/content-type binding, off-registry schema/artifact/validator rejection, rejection of caller-supplied owner/assignee/author/acting-party/capability/version, the absent If-Match requirement, and exactly one cms.entry.revision-created.v1.
- CMS-03B-11 tests read-capability/assignment authorization, indistinguishable 404 concealment for hidden/absent entries, the 128-field and 512-relation bounds, schema-typed draft values with exact provenance and safe hashes, no untyped or cross-tenant fallback, locale selection, and the no-store ETag binding entry plus draft revision versions.
- CMS-03B-15 tests the three read scopes and the 404/403 split, `preparation` present only for a submittable `draft` revision, the manifest and version set served equal the rebuilt values, the 17-entry preflight report in registry order with an unavailable provider reported inside it, the 16-schedule and 64-publication bounds and the strong composite ETag. CMS-03B-16 tests each reader scope, `reason` visible only to its decider, `assignments` owner-only with no identifier, `distinctApprovalCount` live recount, and `permittedNextActions` per caller. CMS-03B-17 tests `assigned` and `submitted` scoping, the state filter, signed-cursor binding and the DEC-140 fault classes, and that a review outside the caller's scopes is never listed. CMS-03B-18 tests create and revoke, every eligibility refusal collapsing to the one `reviewer_not_eligible` response, the seven-day, reviewer-grant-end and grantor-authority bounds, the `cms.editor` grant requirement of the owner, `assignment_exists` and `assignment_limit`, `review_not_open`, unconditional step-up, owner-only authority, an unchanged review `version`, and the review event.
- The reviewer decision matrix (CMS-03B-06): ordinary count 1 and 8, protected 2 with each specialist class, the specialist slot derivation and `specialist_slot_unsatisfiable`, a reject at every point, `duplicate_decision`, submitter and author refusal, assignment expiry before and after the decision, assignment revocation unwinding an open review's count, standing-grant lapse after approval invalidating `reviewer_authority_changed`, the committed `invalidated` outcome answered 409, and the append-only decision with its `assignment_id`.
- The derived revision state (E2) is tested row by row (each of the six states and the precedence between `published`, `scheduled`, `approved`, `rejected`, `submitted` and `draft`), the physical `state` staying `draft`, the filtered-page scan bound, and the Slice 10 reads adopting the helper.
- Every operation tests status 400, 401, 403, 404, 409, 415, 422, 429, 502, 503, 504, and 500 where applicable; exact ApiError shape/details and required response headers are asserted.
- Browser-envelope tests reject ownership identifiers and unknown state values across list/detail/history responses; contract fixtures assert the exact EntryRevisionState, EditorialReviewState, PublicationScheduleState, PublicationState, and RevisionSummary state mappings.

### Authorization, persistence, and concurrency tests

- Anonymous, expired session, wrong person, wrong acting party, unassigned editor, revoked mandate/capability, stale MFA, reviewer self-approval, hidden entry/review/revision, forged JWT metadata, service-role misuse, and over-disclosure tests cover every route.
- Every table tests SQL types/nullability/checks, FK targets, unique/partial indexes, enum transitions, append-only behavior, immutable hashes, RLS enabled/forced, direct grant revocation, named RPC grants, and target projection reauthorization.
- A schema-contract test enumerates every persisted 03b table and asserts `id`, server-derived `owner_id`, a closed `state` (or the explicit IA `ContentEntry.lifecycle` physical-state exception), positive bigint `version`, `created_at`, and `updated_at`; immutable/append-only rows assert `updated_at = created_at` plus rejected UPDATE/DELETE, while mutable-envelope rows refresh `version`/`updated_at` only through their named CAS RPCs. cms_conflict_records is a mutable-envelope CAS table: it asserts no blanket `updated_at = created_at` (that would hold only while `state='open'`), a nullable `yours_revision_id` not coupled to `state`, and the resolved-envelope CHECK (open/superseded ⇒ resolved_* NULL; resolved ⇒ resolved_revision_id/resolved_by_person_id/resolved_at NOT NULL).
- Evidence-binding tests assert active 03a `ContentTypeVersion.id/hash`, non-null `activationEvidence`, `SchemaArtifact` id/hash/compiler, protected validator key/version pairs, and editorial workflow-policy key/version/`policyHash`/`requiredCapabilities`/`approvalEvidenceHash` are re-fetched and equal at save, review, restore, preview, schedule execution, and publication; caller owner/approval/capability metadata never supplies authority.
- Relation privacy tests assert `omit`, `block`, and `placeholder` produce no target-dependent disclosure and that every unavailable placeholder is exactly `{status:'unavailable', reason:'unavailable'}` with no target identity or data across authoring, preview, and publication projections.
- Concurrent same-key/same-body commands produce one effect and exact replay; same key with body/actor/path/version mismatch returns 409; changedPaths duplicates and values over 128 keys/depth 8 are rejected before RPC; failed transaction leaves no idempotency/audit/outbox/revision/review/schedule/publication; a failed initial create leaves no entry, revision, assignment, or event.
- Write-path concurrency (lane H rounds 1-2) is proven through the real commands, not stand-ins: each of the four writers is parked after its locks while the real human and Worker activation and the real grant and tenure revocation run (no raw deadlock, one winner, the typed refusals of `Write-path lock order and authority fencing`); a helper session taking the locks in the legacy order makes every wrapper answer 409 `CONFLICT` and the same command succeeds on retry; the fourth concurrent revision write of an actor is `RATE_LIMITED` while an exact replay is still answered; a mutual-reference deadlock commits exactly one writer; the CMS-03B-13 walk is tested for an unchanged collection, a seen entry updated, an unseen entry updated behind the position, and the conflicting cases (moved ahead, created ahead, left ahead, emptied) plus a missing, malformed and mismatched `aheadDigest`, and its per-page reads are bounded next to thousands of hidden entries; an editor-only creator can append to and read the entry they created; a non-conflicting append and a restore supersede an open conflict and a later resolve is 409 `INVALID_TRANSITION`; a restore commits exactly one `cms.entry.revision.restore.chain` audit row and one `cms.entry.revision-restored.v1` event and a replay or refusal commits none.
- Concurrent autosaves, presence expiry, conflict resolution, review decisions, invalidation, schedule execution, publish race, preview revocation, duplicate/out-of-order events, worker lease expiry, restore migration, and restore epoch fencing are covered. Slice 11 adds: two simultaneous decisions on the last required slot (one wins, the other is 409 `VERSION_MISMATCH` or `review_not_open`), a decision racing an assignment revoke and a revision append (row lock order), a new revision invalidating the live review and cancelling its schedules in one transaction, the dependency recheck job idempotence and its 500-review bound, two publishers racing one lineage, a claim race between sweepers, a settings snapshot insert-if-absent race with ordinal uniqueness, and the preflight registry parity with the contracts enum.

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
| 1    | Source and split completeness          | CMS-05–09 and CMS-13 mapped to eighteen HTTP operations and two internal RPC operations; seven IA canonical models plus publication/preview/presence/assignment/conflict support records covered; four owned event types retained exactly.                            | PASS   |
| 2    | Endpoint and contract reconciliation   | Registry, field matrix, Zod schemas, error matrix, authorization, rate, CORS, observability, and tests key to every operation ID; frozen schema dependencies include artifact, validator, and workflow-policy evidence.    | PASS   |
| 3    | Persistence hard floor                 | Every canonical/support table lists SQL types, nullability/checks, FK target or intentional code-registry boundary, indexes, RLS, and grants; revision relations resolve immutable 03a definitions before use.             | PASS   |
| 4    | Revision/review/publication sequencing | Immutable revisions, explicit conflicts, frozen hashes, distinct decisions, exact schedules, token rechecks, publication CAS, and outbox atomicity are deterministic.                                                      | PASS   |
| 5    | Security and disclosure                | Assignment/RLS, 403 versus 404, CSRF/CORS, MFA, no executable content, preview binding, target reauthorization, and fail-closed policy are explicit.                                                                       | PASS   |
| 6    | Failure and external seam              | RPC/remote checker timeout, retries, circuit, ambiguous outcomes, worker lease/DLQ, projection lag, and audit failure have typed recovery.                                                                                 | PASS   |
| 7    | Testability and accessibility          | All operation success/refusal paths, data constraints, status headers, JSON pointers, and accessible status semantics have tests.                                                                                          | PASS   |
| 8    | Cross-shard ownership                  | 03a schema/artifact/validator/workflow evidence, 03c composition/taxonomy/locale, BE01 authority, BE00 foundation, Shard 04 projection, and DEC-100 direction are explicit.                                                | PASS   |
| 9    | Two-implementer convergence            | Independent implementers derive the same eighteen HTTP operations, two internal operations, state machines, artifact/validator/workflow evidence, immutable relation resolution, version checks, transaction boundaries, error disclosure, and event payloads. | PASS   |
| 10   | Adversarial review                     | Stale autosave, hidden target, self-approval, token forwarding, DST ambiguity, duplicate schedule, publication race, projection outage, and takedown all have deterministic outcomes.                                      | PASS   |

## Ambiguity Gate

- Micro ambiguity PASS: each operation has exact path, field types/bounds, success/error schema, auth/assignment, 403/404 disclosure, CORS, rate, timeout, idempotency, concurrency, observability, and tests; frozen schema dependencies identify the immutable artifact, compiler, protected validators, workflow policy, and relation definitions.
- Create-precondition carve-out PASS: CMS-03B-10 is the single deliberate deviation from the uniform mutation If-Match rule, and it is fully specified (Idempotency-Key required, server-derived initial version, atomic entry + first revision + assignment); every other route remains uniformly preconditioned by exact strong If-Match.
- Macro ambiguity PASS: edit → revision → explicit conflict resolution → frozen review → distinct approval → schedule/preview → exact publication → outbox/projection is one complete flow; no hidden mutation or unowned handoff remains.
- Two-implementer PASS: two implementers using only this file and inherited 03a/BE00 contracts select identical routes, state transitions, RLS outcomes, event IDs, retry/DLQ behavior, and public fail-closed rules.
- Devil's-advocate PASS: hostile editor, reviewer self-approval, private relation target, caller-supplied relation metadata, stale schema/artifact/template/taxonomy, forwarded preview, ambiguous DST, duplicate schedule, worker crash, and Shard 04 outage are explicitly refused, reconciled, or degraded.
- Conflict-record PASS: exactly one durable open conflict per entry (partial unique), the nullable yours_revision_id with yours_source revision/proposed coupling, the bounded proposed_values CHECK plus RPC-boundary revalidation, and the resolved-envelope CHECK are explicit; no impossible revision FK is required and no last-write-wins path exists.
- Slice 11 PASS: the preparation reads, reviewer assignment, derived revision state, frozen manifest and version-set projection, seventeen-category preflight registry with the D19 reference gate, settings snapshot ordinal, pinned-tzdb time authority, append-only publication lineage, derived preview token with its verifier, and schedule claim/execute ladder each name exact routes or RPCs, closed enums, typed reason tokens, locks, and failure outcomes; two implementers reading only this file derive the same operand for every `If-Match`, the same step-up scope for every command, and the same publish/unpublish row sequence.
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
| 2026-10-02 | Slice 09 implementation reconciliation: "active schema locale set" for CMS-03B-10 is the active content-type version's `supportedLocales` (03a OD-4), and CMS-03B-10/CMS-03B-01 take a `FOR SHARE` lock on the content-type version row that the 03a activation switch conflicts with (03a Activation transaction rules).                                                                                                                                                     |
| 2026-10-03 | Slice 09 P240 (AC081/AC203): `EntryDraftRelation` is a union of a resolved relation (`unavailable: null`) and the opaque placeholder relation (field binding, position and policy only), so the draft read can produce the exact `{status:'unavailable', reason:'unavailable'}` fallback without copying the target. | /implement-slice | EntryDraftRelation contract, relation unavailable policy |
| 2026-10-07 | Slice 10 gap resolutions (DEC-139..DEC-146, orchestrator; owner may override). DEC-139: CMS-03B-12 answers a resolved or superseded conflict with the same 404 as an absent one (no metadata-only record). DEC-140: a structurally malformed CMS-03B-13 cursor is 400 and a well-formed cursor that is expired, tampered, foreign-bound, or signed by an unknown or stale key is 409 (same as CMS-03B-03); the entry-list error map gains CONFLICT. DEC-143: presence is renewed by each authorized autosave and lapses after 2 minutes; authority loss revokes entry assignments in the same transaction as presence release; the Named RPC list gains `cms_touch_edit_presence` and `cms_expire_edit_presence_leases`. DEC-144: object property `constraints` are a closed per-kind vocabulary (scalar min/max length and min/max, enum a required `enumValues` plus length, rich_text length) with values checked against them. DEC-145: `EntryListItem` = `RevisionSummary` + `entryId`, `entryLifecycle`, `entryUpdatedAt`; `contentHash` of a draft is the JCS SHA-256 of the returned `fields` projection; a malformed id is 400; timezone accepts one to three IANA segments including `UTC`; audience is `^[a-z0-9_-]{1,48}$` (never trimmed) for schedule, preview, and publication; the dependency manifest has one `checker` and a 256-entry total cap (every list element plus each present singleton) with protected validator refs only; the version set carries IDs (hashes live in the manifest); decision reasons are 1–2000 Unicode characters, NFC, with no control or bidi characters; the preview route is a normalized site path (no `//host`, query, fragment, backslash, dot or empty segment, or percent-encoded dot/slash); local datetimes are range-checked and nonexistent-local-time and resolvedUtc agreement are named Slice 11 runtime seams. DEC-146: `rich_text.v1`@1 has a canonical immutable grammar descriptor (JCS SHA-256 `4fe960667baa6d616e9fe00527d3e1a1d5740013b37f548eec74e20a244f2d15`, artifact reference `cms/validators/rich_text.v1/v1`) frozen into every compiled artifact that uses the grammar and revalidated before create, append, resolution, and restore. Also: command and conflict pointers are `/fields/{stableFieldId}` only; every editorial locale is at most 35 characters; `EntryRevisionResource.entryVersion` is the committed entry version and the only next CAS (the 201 ETag is `"{entryVersion}"`; `version` is the immutable revision's own); relation values are written to `EntryRelation` rows, never `EntryFieldValue`; the lowercase typed reasons `rich_text_not_canonical`, `object_kind_unspecified`, `object_property_invalid`, `relation_target_unavailable`, `taxonomy_source_unavailable`, and `media_source_unavailable` are the whole `P0001` message; restore re-fetches the editorial workflow-policy evidence; rich_text link targets and every length bound follow one code-point/control-character/backslash/dot-segment rule in TypeScript and PostgreSQL. |
| 2026-10-07 | Slice 11 specification cascade (orchestrator resolutions DEC-134, DEC-136 and the Slice 10 resolutions D19, D20, D25, G3, DEC-145; owner may override). Added the preparation and review reads CMS-03B-15 (entry workflow and submission preparation), CMS-03B-16 (review detail) and CMS-03B-17 (reviewer queue, a 03b read rather than the Shard 08 inbox because the review-changed consumer contract is identifier-only), CMS-03B-18 (owner reviewer assignment under `cms.editorial_review.assign`, DEC-136, mirroring CMS-03A-14) and the internal CMS-03B-19 (BE04c preview-token verifier) and CMS-03B-20 (schedule claim and execute). E2: the revision state is derived by one helper over review, schedule and publication evidence while the stored state stays `draft`. E3: PublicationVersion is an append-only lineage (publish heads, tombstones, derived `superseded`), `pending` is removed from `PublicationState` and the `UNIQUE WHERE state='active'` index is replaced by `UNIQUE (entry_id, locale, audience, version)`. E4: audience is `^[a-z0-9_-]{1,48}$` in every table and resource. E5: CMS-03B-08 requires the entry-version `If-Match` and the registry row and FE03 name it. E6: step-up is unconditional for CMS-03B-06, 07, 09 and 18. E7: `settingsVersion` is the ordinal of a settings snapshot over a code-owned key registry (version 1 empty). E8: schedule time is resolved by the Worker over one pinned tz database with `CMS_TZDB_VERSION`, explicit DST rules and a 60 s to 366 d horizon. E9: the schedule gains `audience`, `review_id`, lease and retry columns. E10: `step_up_at NOT NULL`. E11: author never publishes or reviews their own revision. D19/D25/DEC-134: the seventeen-category preflight registry with the generic reference gate for unbuilt owners and the Slice 11 `cms.a11y.structural` Worker provider. Review invalidation reasons, the dependency recheck job, the strictest-of editorial policy for successors, and the typed refusal catalog are defined. | /propagate-decision | Classification, Endpoint Completeness, Route Registry, Internal service operations, Registry invariants, Route field validation matrix, Contracts, Derived revision workflow state, Frozen dependency manifest, Publication preflight registry, Settings snapshot, Time authority, Review scopes and decision evaluation, Review invalidation, Publication lineage, Preview token, Schedule execution, Error matrix, Persisted model envelope, Database Schema, RLS and grants, Authorization matrix, Data Flow, Events, Observability, Testing Strategy |
| 2026-10-07 | Slice 10/11 follow-up 2 (lane H rounds 1-2 spec requests; orchestrator, owner may override). Codex SQL review 3 finding 3 and DEC-140: CMS-03B-13 keeps the locked mutable keyset order and binds the cursor to a collection epoch (`aheadDigest`, new subsection `Entry list keyset, authorization and collection epoch`); a changed collection is 409 `CONFLICT` with restart; the page is driven from the caller's authorized assignments. Lane H round 2 items 1, 2 and 4: one global lock order (authority rows first) for the writers, both activation commands, revocation and review invalidation (new subsection `Write-path lock order and authority fencing`), and a deadlock outside it is the typed retryable 409 `CONFLICT`. EB-AC063: the CMS-03B-10 creator assignment carries the proven capability. Evidence-gap pins (EA-AC002, EA-AC028, EA-AC029, EB AC-049; DEC-141, D-3, D-4, D-11, DEC-145): CMS-03B-01 `entryId` (malformed 400, absent/hidden/archived one 404) and `baseRevision` (names no revision: 422 at `/baseRevision`, never `VERSION_MISMATCH`) either/or rows are now single outcomes; a Slice 10 section states the DEC-141 fail-closed behavior of comparison and restore for recorded taxonomy-version references, composition instances and term assignments; the mutation-header rows now split `Content-Type` (415, BE00 step 3) from `Idempotency-Key`/`If-Match` (400), matching the 415 column of the error matrix. Lane H round 1 items 5, 6b-6e and 9: restore chain evidence (`cms.entry.revision.restore.chain` audit row and `cms.entry.revision-restored.v1`), conflict `superseded` on advance and 409 `INVALID_TRANSITION` on a resolve of a closed conflict, typed `VERSION_MISMATCH` restore CAS, `RATE_LIMITED` write slots, DETAIL pointer arrays, the replay header and the presence sweep `{ expiredLeases, activeLeases }`. | write-be-spec (follow-up 2) | Registry rows 04 and 13, registry invariants, Write-path lock order, Entry list keyset, Restore chain, Event schemas, State machine, Data Flow, error matrix, Testing |

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


<!-- spec-graph: auto-generated -->
## Related Specs

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]

### Constrained by
- [[decisions.md#d-11|D-11]]
- [[decisions.md#d-3|D-3]]
- [[decisions.md#d-4|D-4]]

### References
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
