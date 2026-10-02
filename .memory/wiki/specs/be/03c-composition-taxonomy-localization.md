# Composition, Taxonomy, and Localization — Backend Specification

> IA Source: [Shard 03 — CMS content modeling and authoring](../ia/03-cms-content-modeling.md)
> Deep Dives: [Shard 03 CMS content modeling and authoring deep dive](../ia/deep-dives/03-cms-content-modeling.md)
> Foundation: [BE00 — Cross-cutting platform foundation](00-infrastructure.md)
> Registry dependency: [03a — Content schema registry](03a-content-schema-registry.md)
> Editorial dependency: [03b — Editorial workflow and publication](03b-editorial-workflow-publication.md)
> Status: Complete

## Split Group

This is the composition/taxonomy/localization member of the Shard 03 backend split:

| BE spec                                  | Owned IA interactions                          | Boundary                                                                                                      |
| ---------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 03a-content-schema-registry.md           | CMS-01, CMS-02, CMS-03, CMS-04, CMS-10         | Immutable schemas, relations, migrations, and code-owned BlockDefinitionVersion registry.                     |
| 03b-editorial-workflow-publication.md    | CMS-05, CMS-06, CMS-07, CMS-08, CMS-09, CMS-13 | Entries, revisions, review, schedules, preview, and publication.                                              |
| 03c-composition-taxonomy-localization.md | CMS-11, CMS-12, CMS-14, CMS-15, CMS-16         | Templates, patterns, composition instances, editorial taxonomies, locale variants, and related-content rules. |

03c owns these versioned editorial structures and their bounded references. BlockDefinitionVersion is owned by 03a; this file validates and consumes its immutable code manifest without a duplicate registration route or table owner. 03b freezes the exact template, pattern, taxonomy, term-label, locale, and relationship versions in review/publication dependencies. Shard 04 owns public delivery projections.

## Classification

- Type: domain definition, composition, and editorial projection-command backend.
- Included: CMS-11 Define template; CMS-12 Use reusable pattern; CMS-14 Govern taxonomy term; CMS-15 Author locale variant; CMS-16 Curate related content.
- Excluded: schema/block registration and activation are 03a; entry/revision/review/publication commands are 03b; public route/render/search/cache projections are Shard 04; identity, jobs, audit, idempotency, errors, and transport are BE00.
- Authority boundary: TemplateVersion, PatternVersion, CompositionInstance, TaxonomyVersion, TaxonomyTerm, TermLabel, TermAssignment, LocaleVariant, and RelatedContentRule are editorial metadata. They never become canonical identity, rights, money, entitlement, credential, evidence, or domain authority.
- Split decision: one operation per remaining IA interaction. Each operation has independent route, capability, RLS, rate, idempotency, and failure semantics.
- Decision status: no new decision. DEC-100 is inherited: cross-shard target data is a bounded, versioned, allowlisted projection; no request-time upward store reads or authority copying.

## Referenced Material Inventory

| Material                              | Sections / lines consumed                                                                                                                   | Use in this specification                                                                                                                                                                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IA Shard 03                           | Overview 9–22; Features 24–29; Acceptance Criteria 31–49                                                                                    | Scope and acceptance gates.                                                                                                                                                                                                                                            |
| IA Shard 03                           | Interactions 50–69, especially CMS-11, CMS-12, CMS-14, CMS-15, CMS-16                                                                       | Routes, preconditions, completions, refusals, and recovery.                                                                                                                                                                                                            |
| IA Shard 03                           | Contracts 79–129, Common Model Envelope 160–188                                                                                             | Block/template/pattern, preview, taxonomy, locale, related-content, and mandatory persisted-row envelope rules.                                                                                                                                                        |
| IA Shard 03                           | Data Models 130–156 and Typed Field/Cardinality Registry 190–218                                                                            | BlockDefinitionVersion, TemplateVersion, PatternVersion, CompositionInstance, TaxonomyVersion/TaxonomyTerm, TermLabel, TermAssignment, LocaleVariant, and RelatedContentRule.                                                                                          |
| IA Shard 03                           | Access Control 220–245; Accessibility 246–255                                                                                               | Designer/curator/author capabilities, assignment, target disclosure, and accessible composition/status semantics.                                                                                                                                                      |
| IA Shard 03                           | Event Schemas 256–274                                                                                                                       | cms.template.activated.v1, cms.taxonomy.changed.v1, cms.localization.changed.v1, and cms.publication.changed.v1.                                                                                                                                                       |
| IA Shard 03                           | Edge Cases 275–298; Cross-Shard Dependencies 326–342                                                                                        | Reserved regions, cycles, merges, fallback, unavailable targets, and projection ownership.                                                                                                                                                                             |
| IA Shard 03 deep dive                 | Common Model Envelope and Exceptions 48–76; Canonical Field Contracts 78–127; State Machines 129–146                                        | Exact envelope, composition, taxonomy, locale, and publication states, including the explicit lifecycle exception map.                                                                                                                                                 |
| IA Shard 03 deep dive                 | Composition and Preview Validation 204–237                                                                                                  | Block/slot validation, canonical block-registry digest, depth/count/cycle limits, reserved profile spine, and version-bound preview.                                                                                                                                   |
| IA Shard 03 deep dive                 | Taxonomy, Localization, and Relationship Rules 139–146                                                                                      | Canonical taxonomy overlap, term merge, fallback/no_fallback, and related-content ordering.                                                                                                                                                                            |
| IA Shard 03 deep dive                 | Review and Publication Algorithm 111–119; Abuse and Recovery Verification 148–161                                                           | Dependency freeze/invalidation and hostile-content tests.                                                                                                                                                                                                              |
| IA Shard 03 deep dive                 | Cross-Shard Contracts 163–170; Implementation Envelope 172–178                                                                              | 03a/03b/04/05/01 handoffs, RLS, Hono/Zod, PostgreSQL, and Queue.                                                                                                                                                                                                       |
| BE00                                  | Contracts 84–165; middleware/auth 253–297; transaction/events/errors 298–451; observability/tests 452–503                                   | Shared ApiError, ETag/idempotency, middleware, RLS/RPC, queue, audit, SLO, and test floor.                                                                                                                                                                             |
| 03a-content-schema-registry.md        | Route registry 132–145; Zod contracts 196–959; database/Middleware & Policies 976–1068                                                      | Immutable BlockDefinitionVersion ref/hash and signed snapshot/attestation, canonical BlockKey, SchemaArtifact id/hash/compiler, protected validator/workflow-policy evidence, schema compatibility, stable field IDs, lifecycle events, and safe registry projections. |
| 03b-editorial-workflow-publication.md | Route registry 123–135; dependency freeze 400–430; cross-shard direction 430–455                                                            | Entry/revision ownership, frozen version set, review invalidation, publication event, and target rechecks.                                                                                                                                                             |
| BE01a–01d                             | BE01a Shared Contract Inheritance 73–97; BE01b Contract Conventions 88–137; BE01c schema/access 294–395; BE01d disclosure semantics 424–502 | Verified person/party/acting context, capability, assignment, mandate, and MFA.                                                                                                                                                                                        |
| BE02a–02c                             | BE02a Shared Contract Inheritance 85–98; BE02b source contracts 102–227 and schema 429–652; BE02c schema 305–369                            | Fixed profile spine/provenance and canonical-domain non-smuggling.                                                                                                                                                                                                     |
| Architecture Design                   | Tech Stack/hosting 143–196; persistence 198–266; API 343–376; security/rate 535–668 and 770–797; observability 916–995                      | Hono/Cloudflare, Supabase PostgreSQL/Auth/RLS, rate/security, and diagnostics.                                                                                                                                                                                         |
| Data Placement Strategy               | N-Tier 5–17; placement 19–40; security 42–55; storage/isolation 86–93; lifecycle 95–114; tenancy/sync 116–148                               | Canonical store, privacy, retention, isolation, and sync.                                                                                                                                                                                                              |
| Engineering Standards                 | Tests 27–44; performance 53–121; async/recovery 122–138; accessibility 140–148; security 149–165; migration/CI 185–207                      | Production quality and release gates.                                                                                                                                                                                                                                  |

## IA Source Map

| BE section                              | Source of truth                             | Exact section / lines                                                                                                    |
| --------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Classification/split                    | IA Shard 03                                 | Overview 9–22; Features 24–29; Interactions 50–69                                                                        |
| Templates and patterns                  | IA Shard 03 and deep dive                   | CMS-11/12 lines 43–44, 64–65; Contracts 111–129; Data Models 150–153; Composition and Preview Validation 204–234         |
| Taxonomy and terms                      | IA Shard 03 and deep dive                   | CMS-14 line 46/67; Data Models 154–156; Typed Field Registry 213–216; Taxonomy rules 235–243                             |
| Localization and relationships          | IA Shard 03 and deep dive                   | CMS-15/16 lines 47–48, 68–69; Contracts 111–129; Taxonomy rules 235–243                                                  |
| Routes and contracts                    | IA Shard 03 plus BE00                       | Acceptance Criteria 31–48; Interactions 50–69; BE00 Contracts/middleware                                                 |
| Browser projection ownership and states | IA Shard 03 deep dive plus BE03c SQL matrix | Common Model Envelope and Exceptions 48–76; State Machines 129–140; canonical records and fields 520–528                 |
| Persistence and permissions             | IA Shard 03, placement, BE00                | Common Model Envelope 160–188; Data Models 130–156; Typed Field/Cardinality Registry 190–218; placement 19–55 and 86–114 |
| Events and downstream handoff           | IA Shard 03 plus BE00                       | Event Schemas 256–274; Cross-Shard Dependencies 326–342; BE00 outbox/queue                                               |
| Tests and ambiguity                     | IA Shard 03, deep dive, standards           | Edge Cases 275–298; Abuse and Recovery Verification 244–258; standards 27–44 and 185–207                                 |

## Feature Ledger Coverage

| Ledger ID | Feature                                | BE ownership | Coverage evidence                                                                                                          |
| --------- | -------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 25.03.02  | Template Definitions, Slots & Bindings | CMS-03C-01   | TemplateVersion route/table, reserved regions, registered-block compatibility, slot bounds, and template tests.            |
| 25.03.03  | Page Composition & Reusable Patterns   | CMS-03C-02   | PatternVersion and CompositionInstance, linked/detached diff, cycle/depth limits, and composition tests.                   |
| 25.05.01  | Taxonomy & Vocabulary Definitions      | CMS-03C-03   | TaxonomyVersion/TaxonomyTerm/TermLabel, canonical overlap refusal, immutable keys, hierarchy, aliases, and taxonomy tests. |
| 25.05.02  | Term Governance & Assignment           | CMS-03C-03   | Term actions, merge redirect, immutable label versions, assignment convergence, curator RLS, and idempotent merge tests.   |
| 25.05.03  | Localization Variants & Fallback       | CMS-03C-04   | LocaleVariant, BCP 47/fallback/no_fallback rules, source staleness, and locale tests.                                      |
| 25.05.04  | Related Content and Relationships      | CMS-03C-05   | RelatedContentRule pins/exclusions/derived reason, target authorization, ordering, and unavailable-target tests.           |

25.01.* is owned by 03a; 25.02.* and 25.03.04 are owned by 03b; 03c consumes their versioned IDs/hashes only.

## Endpoint Completeness Reconciliation

Each remaining IA interaction has one concrete operation and one authoritative route registry row. Template activation and public projection are downstream state transitions, not duplicate public routes.

| IA interaction                | Operation ID | Concrete route                                               | Reconciliation                                                                                                                                     |
| ----------------------------- | ------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| CMS-11 Define template        | CMS-03C-01   | POST /api/v1/cms/templates/versions                          | Creates a versioned template candidate from registered blocks; server computes blockRegistryDigest and activation is governed by review/preflight. |
| CMS-12 Use reusable pattern   | CMS-03C-02   | POST /api/v1/cms/compositions/pattern-instances              | Adds linked or detached pattern instance to a revision/template draft; server recomputes the pattern digest and never silently overwrites.         |
| CMS-14 Govern taxonomy term   | CMS-03C-03   | POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions       | Executes create/rename/alias/deprecate/merge through one idempotent term command.                                                                  |
| CMS-15 Author locale variant  | CMS-03C-04   | POST /api/v1/cms/entries/{entryId}/locales/{locale}/variants | Creates or replaces an immutable locale revision state through a new variant version.                                                              |
| CMS-16 Curate related content | CMS-03C-05   | POST /api/v1/cms/entries/{entryId}/related-content           | Stores pins/exclusions/derived rule; public eligibility is rechecked at projection/read.                                                           |

BE00 GET /api/v1/jobs/{jobId}, 03a schema/block routes, and 03b entry/publication routes are inherited and not repeated. No public route can select draft template, pattern, taxonomy, locale, or relation state without its owner projection policy.

## Shared Contract Inheritance

All operations use BE00 /api/v1, strict Zod 4, request IDs, exact ApiError, ETags, idempotency, RLS/RPC, audit/outbox, CORS, CSRF, rate headers, and authenticated no-store responses.

```ts
import { z } from 'zod';

const UUID = z.string().uuid();
const Version = z.string().regex(/^[1-9][0-9]*$/);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Bcp47 = z.string().regex(/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/);
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

ApiError is exactly { code, message, requestId, details }. details is limited by BE00 to 16 keys, four levels, and 8 KiB. Every operation cites this envelope. Every failure includes JSON Content-Type, X-Request-Id, Cache-Control no-store, and Retry-After/RateLimit headers when applicable.

- Middleware order: request-id → raw-size/media guard → JSON parse → Zod validation → session/JWT → acting-context/capability/assignment → CSRF → configured first-party CORS → rate limiter → handler/RPC → response/error normalization.
- CORS is explicit per operation below: cms-console origins for browser commands; no production wildcard credentials. No browser origin is accepted for a worker-only operation.
- Mutations require Idempotency-Key 8–128 printable ASCII. Mutable parent commands require exact strong If-Match quoted positive decimal. Same bound request replays; changed actor/body/path/version returns 409.
- RLS/RPC rechecks current schema/template/taxonomy/locale/entry version, target visibility, capability, assignment, and idempotency at commit. Mutation, audit, and outbox are atomic.
- Events carry IDs, versions, hashes, correlation/causation IDs only. Consumers refetch under their own authority and use at-least-once retries, leases, CAS, and DLQ.

## API Endpoints

### Route Registry

This is the sole authoritative 03c route registry. CI must match discovered Hono routes and generated OpenAPI to each operation ID, request/success/error schema, auth, CORS, rate, timeout, cache, SLO, idempotency, and BOLA policy.

| Operation ID           | IA     | Method and path                                              | Request → success                                        | Auth / ownership / 403 versus 404                                                                                               | Middleware incl. CORS                                                           | Idempotency / concurrency                                                                           | Rate / timeout / cache / SLO                                                   | Error envelope                                      | Event                                                                                    |
| ---------------------- | ------ | ------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| CMS-03C-01             | CMS-11 | POST /api/v1/cms/templates/versions                          | TemplateVersionRequest → 201 TemplateVersionResource     | template_designer in scope; hidden owner/template is 404; readable template without capability is 403                           | BE00 order; CORS cms-console; CSRF; strict JSON; registry read                  | key + If-Match when editing parent; unique key/version and CAS; server-computed blockRegistryDigest | 30/min/user, 60/min/party; 15,000ms, target <2s; no-store; Tier 2 p95 <1,200ms | BE00 ApiError { code, message, requestId, details } | cms.template.activated.v1 only after governed activation                                 |
| cmsTemplateContextRead | CMS-11 | GET /api/v1/cms/templates/context                            | EmptyRequest → 200 TemplateDesignerContext               | authenticated human with confirmed acting-party membership and active `cms.template_designer` grant; no owner selector accepted | BE00 order; cms-console origin; no CSRF or request body; server-derived context | read-only; no idempotency or If-Match                                                               | 60/min/user, 60/min/party; 15,000ms; no-store; Tier 2                          | BE00 ApiError { code, message, requestId, details } | none                                                                                     |
| CMS-03C-02             | CMS-12 | POST /api/v1/cms/compositions/pattern-instances              | PatternInstanceRequest → 201 CompositionInstanceResource | assigned author/editor on revision/template draft; hidden target is 404; visible target without edit is 403                     | BE00 order; CORS cms-console; CSRF; strict JSON; block registry read            | key + If-Match; CAS revision; unique revision/slot path; server recomputes pattern digest           | 120/min/user, 240/min/party; 15,000ms; no-store; Tier 2                        | BE00 ApiError { code, message, requestId, details } | none                                                                                     |
| CMS-03C-03             | CMS-14 | POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions       | TaxonomyTermActionRequest → 200 TaxonomyTermResource     | taxonomy_curator for vocabulary; hidden taxonomy/term is 404; known vocabulary without capability is 403                        | BE00 order; CORS cms-console; CSRF; strict JSON; canonical-overlap check        | key + If-Match; term lock/CAS; merge unique survivor and redirect                                   | 60/min/user, 120/min/party; 15,000ms; no-store; Tier 2                         | BE00 ApiError { code, message, requestId, details } | cms.taxonomy.changed.v1                                                                  |
| CMS-03C-04             | CMS-15 | POST /api/v1/cms/entries/{entryId}/locales/{locale}/variants | LocaleVariantRequest → 201 LocaleVariantResource         | assigned author/editor for localizable fields; hidden entry/locale is 404; visible entry without edit is 403                    | BE00 order; CORS cms-console; CSRF; strict JSON; source revision read           | key + If-Match; CAS source/entry; unique entry/locale/source revision                               | 60/min/user, 120/min/party; 15,000ms; no-store; Tier 2                         | BE00 ApiError { code, message, requestId, details } | cms.localization.changed.v1                                                              |
| CMS-03C-05             | CMS-16 | POST /api/v1/cms/entries/{entryId}/related-content           | RelatedContentRuleRequest → 201 RelatedContentResource   | author/editor with source assignment; hidden source/target is 404; visible source without edit is 403                           | BE00 order; CORS cms-console; CSRF; strict JSON; target projection recheck      | key + If-Match; CAS source entry; unique pin/exclusion target                                       | 60/min/user, 120/min/party; 15,000ms; no-store; Tier 2                         | BE00 ApiError { code, message, requestId, details } | cms.publication.changed.v1 consumed for invalidation; no event emitted until publication |

### Registry invariants

`cmsTemplateContextRead` is a narrowly scoped supporting read for the CMS-11
human form, not another template mutation or a grant in the general auth
session. Its strict `TemplateDesignerContext` contains at most 64 owned active,
compiled content-type selectors (`id`, `typeKey`, `activeVersionId`,
`activeVersion`, `sourceLocale`) and 128 owned registered, currently supported
block selectors (`blockKey`, `blockVersion`). It excludes owner IDs, grant
records, renderer refs, manifests, and policy internals. The private RPC
rechecks the actor, acting party, confirmed membership, and current designer
grant on each read; the browser and authenticated database roles cannot call
that RPC or read its source tables directly. A denied read is 403, an invalid
query is 400, malformed provider projection is 502, and dependency/deadline
failures are 503/504. The POST independently rechecks all authority and
compatibility; a context read never reserves permission for a later write.

- TemplateVersion and PatternVersion are immutable after activation; CompositionInstance updates create a new version/row, preserving prior revision evidence.
- BlockDefinitionVersion is consumed from 03a by immutable key/version, `propsSchemaRef`, `propsSchemaHash`, and compatibility/release digest. The normalized props snapshot is derived evidence whose signature must bind the ref/hash, block key/version, and `releaseDigest`; unknown, withdrawn, or incompatible blocks fail before mutation.
- Taxonomy terms retain stable IDs through rename/alias/merge; merged IDs resolve permanently to a survivor and cannot reactivate.
- Locale variants are source-hash aware; source changes mark dependent fields stale. Related-content exclusions always win and recommendations never grant access.
- All routes return BE00 ApiError { code, message, requestId, details } on failure. No route exposes hidden target existence, draft content, token material, private locale text, or reviewer authority.
- Browser/protected response envelopes contain no ownership identifiers or release-principal/signature evidence; authorization context stays server-side. Template, composition, taxonomy, locale, pattern, and related-content resources expose only their exact closed state/lifecycle enums.

### Named template compatibility resolver (DEC-108)

03a's DEC-108 activation preflight, and this shard's own mutation preflight,
consume one non-mutating service-only resolver rather than reading template rows
directly or trusting a caller-supplied compatibility claim:

```ts
// platform_api.cms_resolve_template_compatibility
const TemplateCompatibilityRequest = z.strictObject({
  templateVersionId: UUID,
  contentTypeId: UUID,
  // The exact candidate content-type version. The resolver verifies this
  // version belongs to contentTypeId under the same owner/actor scope; it
  // never resolves a "current" version implicitly.
  contentTypeVersionId: UUID,
  // Optional caller-side assertion of the template's own version number
  // (not the content-type version). A mismatch is a typed failure; it never
  // selects or substitutes a template version.
  expectedTemplateVersionNo: Version.optional(),
});
const TemplateCompatibilityProjection = z.strictObject({
  templateVersionId: UUID,
  templateKey: z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/),
  templateVersionNo: Version,
  state: z.enum([
    'draft',
    'review',
    'approved',
    'scheduled',
    'active',
    'superseded',
    'retired',
  ]),
  // Success is a typed invariant, never a caller-supplied claim.
  compatible: z.literal(true),
  withdrawn: z.literal(false),
  templateDigest: Hash,
  contentTypeId: UUID,
  // Echoes the exact verified candidate version reference.
  contentTypeVersionId: UUID,
});
// Typed failure results; each one has zero side effects.
const TemplateCompatibilityFailure = z.strictObject({
  code: z.enum(['NOT_FOUND', 'INCOMPATIBLE', 'WITHDRAWN', 'VERSION_MISMATCH']),
});
```

The resolver is a pure read: it performs no INSERT, UPDATE, DELETE,
idempotency reservation, audit/outbox write, or state transition on success or
failure, and a GET or read path never derives a mutation from it. It resolves the
exact template-version, content-type, and candidate content-type-version
references under the server-verified actor/owner scope; the candidate version
must belong to the named content type under the same owner, and no "current" or
"latest" version is ever resolved implicitly. It conceals an inaccessible or
cross-owner template/version/type as 404. A reference that is absent or concealed returns the typed failure `NOT_FOUND`, an
incompatible reference `INCOMPATIBLE`, a withdrawn definition `WITHDRAWN`, and an
`expectedTemplateVersionNo` mismatch `VERSION_MISMATCH`; the resolver is
service-role only and every failure has zero side effects, so a success response
is the literal invariant `compatible: true` and `withdrawn: false` — the
resolver never returns a soft `compatible: false` success body. It returns only
the safe projection above (no owner IDs, binding manifests, slot internals, or
renderer refs) and echoes the exact candidate `contentTypeVersionId` it proved.
Its compatibility reflects 03c's immutable `compatible_type_ids` snapshot and
the draft-binding compatibility guard; it never grants public delivery or
activation authority. Only the service-role Worker may execute it (no browser
or authenticated table access), and it is the reciprocal dependency the 03a
activation preflight and the CMS-03C-01 create preflight both cite. No browser
route exposes the resolver: the browser receives only the safe projection, as the
optional `templateCompatibility` member of 03a's
`ContentSchemaRegistryDetail.activationPreparation`, and only for a compatible
result.

Consuming an immutable compatible template-version UUID is sufficient for the
AC169 reference. Public template activation remains an explicit, unresolved 03c
contract gap owned here; a draft binding is never proof that public template
activation works, and DEC-108 does not make public activation an AC169
prerequisite.

### Block registry record and digest invariants

03c consumes only the safe, authenticated `BlockDefinitionRegistryRecord` projection
from 03a. The projection contains the immutable `id`, `version`, `blockKey`,
`blockVersion`, `propsSchemaRef`, `propsSchemaHash`, `rendererRef`,
`releaseDigest`, and `lifecycle`; it deliberately excludes release principals,
signatures, raw manifests, and any executable or private payload. 03c never
registers, updates, or deletes a block and never treats a client block record as
authoritative.

`blockRegistryDigest` is the lowercase SHA-256 digest of the RFC 8785/JCS
canonical JSON array of the reachable, deduplicated tuples
`{blockKey,blockVersion,releaseDigest,propsSchemaHash,rendererRef,lifecycle}`.
The tuples are sorted first by the UTF-8 byte ordering of `blockKey`, then by
numeric `blockVersion`; JCS determines object member ordering and JSON number
serialization before hashing. The server resolves every reachable block from
the 03a safe registry and recomputes this digest at template create, template
activate, pattern create, pattern activate, and 03b publication preflight. A
client-supplied digest is an equality expectation only; it is compared with the
server result and never stored in place of the recomputed value. Missing,
withdrawn, incompatible, duplicate, or unreachable block references fail closed
before mutation or publication.
Digest recomputation checkpoints are: template create, template activate,
pattern create, pattern activate, and publication preflight.

### Persisted model envelope

Every 03c-owned persisted table below explicitly carries the IA common envelope:
`id uuid`, `owner_id uuid`, a closed `state` enum, monotonic `version bigint`,
`created_at timestamptz`, and `updated_at timestamptz`. `owner_id` identifies the
owning party or parent aggregate and never grants authority. Child rows copy the
parent owner ID even when a more specific foreign key exists. The only 03c
exception is the explicit IA lifecycle mapping: `TaxonomyTerm.lifecycle` is the
physical closed envelope state (`active|deprecated|merged`) and no duplicate
mutable `state` column is added. `BlockDefinitionVersion` is another explicit
boundary: it is persisted and owned by 03a, and 03c consumes its safe projection
only.

Immutable evidence and version rows use `updated_at = created_at` and reject
UPDATE and DELETE; replacements, stale snapshots, assignments, and revocations
are additive rows with a new ID/version. Draft/workflow rows may use named RPC
state transitions until activation, but identity and definition fields remain
immutable and every activated/terminal row rejects updates. No other envelope
exception is permitted. Advisory presence renewal is not a 03c table and does
not weaken these rules.

### Route field validation matrix

| Operation             | Field                             | Exact constraint                                                                                                                                                                                        | Failure                       |
| --------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| CMS-03C-01            | templateKey/version               | key /^[a-z][a-z0-9-]{1,63}$/; version positive integer; pair never reused                                                                                                                               | 422/409                       |
| CMS-03C-01            | compatibleTypeIds                 | 1–64 UUIDs, each active/allowlisted ContentTypeVersion family                                                                                                                                           | 422                           |
| CMS-03C-01            | slots/reservedRegions             | strict JSON manifests; ≤64 slots, ≤32 reserved names; fixed Shard 02 Header→Now→Record→Detail/provenance regions immutable                                                                              | 422                           |
| CMS-03C-01            | allowedBlocks/blockRegistryDigest | every `blockKey` uses /^[a-z][a-z0-9._-]{0,95}$/; positive safe `blockVersion`; optional lowercase 64-hex digest is an equality expectation only; server resolves/recomputes the reachable tuple set    | 422/409                       |
| CMS-03C-01            | bindings/locale/audience          | strict binding manifest; BCP 47 locale; audience 1–64 safe chars                                                                                                                                        | 422                           |
| CMS-03C-02            | revisionId/patternId              | UUIDs; revision/template draft readable and pattern immutable                                                                                                                                           | 400/404                       |
| CMS-03C-02            | patternVersion/linkMode           | positive version; linked or detached only                                                                                                                                                               | 422                           |
| CMS-03C-02            | slotPath/overrides                | normalized path 1–512 chars; strict overrides max 64 keys/8 depth                                                                                                                                       | 422                           |
| CMS-03C-02            | graph/blockRegistryDigest         | no cycles; max protected depth/nodes; every nested `blockKey` uses /^[a-z][a-z0-9._-]{0,95}$/ and is registered/compatible; optional digest is an equality expectation only and is recomputed by server | 409/422                       |
| CMS-03C-03            | taxonomyId/action                 | UUID; action create, rename, alias, deprecate, merge                                                                                                                                                    | 400/422                       |
| CMS-03C-03            | termKey/labels                    | stable key /^[a-z][a-z0-9-]{1,63}$/; 1–64 localized labels; NFC                                                                                                                                         | 422                           |
| CMS-03C-03            | survivorId/parentId               | UUID or null; required for merge/specified hierarchy; cannot be self/cyclic/merged                                                                                                                      | 422/409                       |
| CMS-03C-04            | entryId/locale/sourceRevisionId   | UUID, BCP 47, UUID; source revision must exist and be readable                                                                                                                                          | 400/404                       |
| CMS-03C-04            | fields/fallbackChain              | 1–128 field IDs/values; only localizable fields; ordered BCP 47 list ≤16, explicit no_fallback                                                                                                          | 422                           |
| CMS-03C-04            | sourceHash/expectedVersion        | 64 lowercase hex; positive decimal version                                                                                                                                                              | 422/409                       |
| CMS-03C-05            | pins/exclusions                   | pin UUID array ≤32, exclusion UUID array ≤64, de-duplicated; exclusions win                                                                                                                             | 422                           |
| CMS-03C-05            | derivedRule                       | strict bounded rule or null; explainable key/version, no arbitrary query/expression                                                                                                                     | 422                           |
| CMS-03C-05            | expectedVersion                   | positive decimal strong If-Match match                                                                                                                                                                  | 400/409                       |
| All                   | headers/body                      | JSON, raw body ≤256 KiB, Idempotency-Key 8–128 printable ASCII, unknown keys reject                                                                                                                     | 400/415/422                   |
| All browser responses | state/ownership envelope          | ResourceMeta contains only id, version, contentHash where applicable, and timestamps; concrete resources use exact per-resource state/lifecycle enums; ownership and release evidence are absent        | 422 response-contract failure |

## Request/Response Contracts (Zod 4 schemas)

These strict Zod 4 schemas are normative for TypeScript, Hono, OpenAPI, tests, and JSONB validation. No uploaded markup, code, expression, arbitrary query, or target authority is accepted.

```ts
const Key = z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/);
const TemplateKey = z.string().regex(/^[a-z][a-z0-9-]{1,63}$/);
const BlockKey = z.string().regex(/^[a-z][a-z0-9._-]{0,95}$/);
const ArtifactRef = z
  .string()
  .regex(/^[a-z][a-z0-9._/-]{0,255}$/)
  .refine(
    (value) => !value.includes('..') && !value.includes('//'),
    'artifact reference cannot traverse or contain a URL',
  );
const SafeAudience = z
  .string()
  .min(1)
  .max(64)
  .refine((v) => !/[<>{}]/.test(v));
const RegisteredBlock = z.strictObject({
  blockKey: BlockKey,
  blockVersion: z.number().int().positive().max(2147483647),
});
const BoundedPatternOverrides = z
  .record(z.string().max(128), Json)
  .superRefine((value, ctx) => {
    if (Object.keys(value).length > 64) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 64,
        inclusive: true,
        origin: 'record',
        message: 'overrides permits at most 64 keys',
      });
    }
    if (jsonDepth(value) > 8) {
      ctx.addIssue({
        code: 'custom',
        message: 'overrides JSON depth must be at most 8',
      });
    }
  });
const BlockDefinitionRegistryRecord = z.strictObject({
  resourceKind: z.literal('block_definition_registry_record'),
  id: UUID,
  version: Version,
  blockKey: BlockKey,
  blockVersion: z.number().int().positive().max(2147483647),
  propsSchemaRef: ArtifactRef,
  propsSchemaHash: Hash,
  rendererRef: z.string().regex(/^[a-z][a-z0-9._/-]{0,159}$/),
  releaseDigest: Hash,
  lifecycle: z.enum(['supported', 'deprecated', 'withdrawn']),
});
const TemplateVersionRequest = z.strictObject({
  templateKey: TemplateKey,
  compatibleTypeIds: z.array(UUID).min(1).max(64),
  slots: z
    .array(
      z.strictObject({
        key: Key,
        required: z.boolean(),
        allowedBlocks: z.array(RegisteredBlock).max(32),
        maxCount: z.number().int().min(1).max(128),
      }),
    )
    .max(64),
  reservedRegions: z.array(Key).max(32),
  bindings: z.record(
    z.string().max(128),
    z.strictObject({
      projection: z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/),
      required: z.boolean(),
    }),
  ),
  locale: Bcp47,
  audience: SafeAudience,
  blockRegistryDigest: Hash.optional(),
  expectedVersion: Version.nullable(),
});
const PatternInstanceRequest = z.strictObject({
  revisionId: UUID,
  patternId: UUID,
  patternVersion: z.number().int().positive(),
  linkMode: z.enum(['linked', 'detached']),
  slotPath: z
    .string()
    .min(1)
    .max(512)
    .regex(/^\/[^\u0000-\u001f]*$/),
  overrides: BoundedPatternOverrides,
  blockRegistryDigest: Hash.optional(),
  expectedVersion: Version,
});
const TaxonomyTermActionRequest = z
  .strictObject({
    taxonomyId: UUID,
    action: z.enum(['create', 'rename', 'alias', 'deprecate', 'merge']),
    termKey: Key,
    parentId: UUID.nullable(),
    survivorId: UUID.nullable(),
    labels: z
      .array(
        z.strictObject({ locale: Bcp47, label: z.string().min(1).max(160) }),
      )
      .min(1)
      .max(64),
    aliases: z.array(z.string().min(1).max(160)).max(64),
    expectedVersion: Version,
  })
  .superRefine((value, ctx) => {
    if (value.action === 'merge' && value.survivorId === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['survivorId'],
        message: 'merge requires survivorId',
      });
    }
    if (value.action !== 'merge' && value.survivorId !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['survivorId'],
        message: 'survivorId is merge-only',
      });
    }
  });
const LocaleVariantRequest = z.strictObject({
  entryId: UUID,
  locale: Bcp47,
  sourceRevisionId: UUID,
  fields: z
    .array(z.strictObject({ fieldId: UUID, value: Json }))
    .min(1)
    .max(128),
  fallbackChain: z.array(Bcp47).max(16),
  noFallbackFieldIds: z.array(UUID).max(128),
  sourceHash: Hash,
  expectedVersion: Version,
});
const RelatedContentRuleRequest = z
  .strictObject({
    entryId: UUID,
    pins: z.array(UUID).max(32),
    exclusions: z.array(UUID).max(64),
    derivedRule: z
      .strictObject({
        key: Key,
        version: Version,
        reasonCode: z.string().regex(/^[a-z][a-z0-9._-]{0,63}$/),
        maxCandidates: z.number().int().min(1).max(128),
      })
      .nullable(),
    expectedVersion: Version,
  })
  .superRefine((value, ctx) => {
    const all = value.pins.concat(value.exclusions);
    if (new Set(value.pins).size !== value.pins.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['pins'],
        message: 'pins must be unique',
      });
    }
    if (new Set(value.exclusions).size !== value.exclusions.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['exclusions'],
        message: 'exclusions must be unique',
      });
    }
    if (
      all.some((id) => value.pins.includes(id) && value.exclusions.includes(id))
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['exclusions'],
        message: 'exclusions override pins explicitly',
      });
    }
  });
```

Success resources:

```ts
const TemplateVersionState = z.enum([
  'draft',
  'review',
  'approved',
  'scheduled',
  'active',
  'superseded',
  'retired',
  'blocked',
]);
const CompositionInstanceState = z.enum([
  'draft',
  'active',
  'pending_diff',
  'superseded',
  'retired',
]);
const TaxonomyTermLifecycle = z.enum(['active', 'deprecated', 'merged']);
const LocaleVariantState = z.enum([
  'untranslated',
  'draft',
  'review',
  'approved',
  'stale',
]);
const PatternVersionState = z.enum([
  'draft',
  'review',
  'approved',
  'scheduled',
  'active',
  'superseded',
  'retired',
  'blocked',
]);
const RelatedContentState = z.enum(['active', 'revoked']);
const ResourceMeta = z.strictObject({
  id: UUID,
  version: Version,
  contentHash: Hash,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
const TemplateVersionResource = ResourceMeta.extend({
  state: TemplateVersionState,
  templateKey: TemplateKey,
  templateVersion: z.number().int().positive(),
  compatibleTypeIds: z.array(UUID).max(64),
  reservedRegions: z.array(Key).max(32),
  blockRegistryDigest: Hash,
});
const CompositionInstanceResource = ResourceMeta.extend({
  state: CompositionInstanceState,
  revisionId: UUID,
  path: z.string().regex(/^\/[^\u0000-\u001f]{0,511}$/),
  blockKey: BlockKey,
  blockVersion: z.number().int().positive(),
  patternId: UUID.nullable(),
  patternVersion: z.number().int().positive().nullable(),
  blockRegistryDigest: Hash,
  linkMode: z.enum(['linked', 'detached']),
  conflictState: z.enum(['none', 'pending_diff']).nullable(),
});
const TaxonomyTermResource = z.strictObject({
  id: UUID,
  version: Version,
  lifecycle: TaxonomyTermLifecycle,
  contentHash: Hash,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  taxonomyId: UUID,
  termId: UUID,
  termKey: Key,
  parentId: UUID.nullable(),
  successorId: UUID.nullable(),
});
const LocaleVariantResource = ResourceMeta.extend({
  state: LocaleVariantState,
  entryId: UUID,
  revisionId: UUID,
  locale: Bcp47,
  sourceRevisionId: UUID,
  fallbackChain: z.array(Bcp47).max(16),
  noFallbackFieldIds: z.array(UUID).max(128),
});
const PatternVersionResource = ResourceMeta.extend({
  state: PatternVersionState,
  patternKey: TemplateKey,
  patternVersion: z.number().int().positive(),
  blockRegistryDigest: Hash,
});
const RelatedContentResource = ResourceMeta.extend({
  state: RelatedContentState,
  sourceEntryId: UUID,
  pins: z.array(UUID).max(32),
  exclusions: z.array(UUID).max(64),
  derivedRule: z.strictObject({ key: Key, version: Version }).nullable(),
  eligibleCount: z.number().int().nonnegative().max(128),
});
```

### Contract and error matrix

| Operation ID | 400                       | 401             | 403                      | 404                            | 409                                                      | 415      | 422                                      | 429                  | 502/503/504                     | 500               |
| ------------ | ------------------------- | --------------- | ------------------------ | ------------------------------ | -------------------------------------------------------- | -------- | ---------------------------------------- | -------------------- | ------------------------------- | ----------------- |
| CMS-03C-01   | malformed IDs/header/body | missing session | designer denied          | hidden/absent template scope   | stale parent/key/version/block compatibility             | non-JSON | slot/binding/reserved-region schema      | template-write limit | registry/RPC deadline           | scrubbed internal |
| CMS-03C-02   | malformed IDs/header/body | missing session | assignment/edit denied   | hidden/absent revision/pattern | stale revision, cycle, slot collision, idempotency       | non-JSON | graph/props schema                       | composition limit    | registry/RPC deadline           | scrubbed internal |
| CMS-03C-03   | malformed IDs/header/body | missing session | curator denied           | hidden/absent taxonomy/term    | stale taxonomy, duplicate key, merge race, idempotency   | non-JSON | key/label/parent/action schema           | taxonomy limit       | canonical registry/RPC deadline | scrubbed internal |
| CMS-03C-04   | malformed IDs/header/body | missing session | locale assignment denied | hidden/absent entry/source     | stale source/hash/version, duplicate locale, idempotency | non-JSON | BCP 47/field/fallback/no_fallback schema | locale limit         | schema/RPC deadline             | scrubbed internal |
| CMS-03C-05   | malformed IDs/header/body | missing session | source edit denied       | hidden/absent source/target    | stale version, duplicate pin, idempotency                | non-JSON | pin/exclusion/rule schema                | relationship limit   | target projection/RPC deadline  | scrubbed internal |

Every row returns BE00 ApiError { code, message, requestId, details }. 400/422 details are bounded JSON-pointer violations; 401 is recoveryAction only; 403 reasonCode without policy predicates; 404 empty; 409 safe version/conflict metadata only when authorized; 429 retryAfterSeconds/limit/resetAt; 502/503/504 dependencyClass/retryable/optional retryAfterSeconds; 500 empty.

### Normative application error catalog

The following table is the authoritative D3/D11 mapping for all five operations. The
HTTP status is never used as the application error code. The code is the exact
allowlisted enum value shown below, and message is bound to the operation's
catalog format: "{CODE}: {operation} operation rejected or unavailable.", with
{CODE} replaced only by the mapped code and no IDs, labels, policy predicates,
SQL, provider text, PII or stack data interpolated. Clients localize by
operation/code; requestId remains a separate envelope field.

| Operation ID | Exact HTTP status -> application code mapping                                                                                                                                                                                                                                                                                                        | Message-format binding                                                                                      | Retry / N/A guidance                                                                                                                                                                                                                                                                                                                            | Exact response envelope                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| CMS-03C-01   | 400 INVALID_REQUEST; 401 UNAUTHENTICATED; 403 TEMPLATE_FORBIDDEN; 404 TEMPLATE_NOT_FOUND; 409 TEMPLATE_VERSION_CONFLICT; 415 UNSUPPORTED_MEDIA_TYPE; 422 TEMPLATE_VALIDATION_FAILED; 429 RATE_LIMITED; 502 DEPENDENCY_INVALID_RESPONSE; 503 DEPENDENCY_UNAVAILABLE; 504 DEPENDENCY_DEADLINE_EXCEEDED; 500 INTERNAL_ERROR                             | Catalog cms.03c.template.v1; operation token is template; messages use the bound format above               | 400/401/403/404/415/422/500: retry N/A. 409: reconcile current version, then resubmit with a new idempotency key. 429: retry only after BE00 Retry-After. 502/503/504: retry at most 3 times at 15s/60s/300s with jitter, circuit open 60s; after-effect ambiguity requires status/idempotency reconciliation first.                            | ApiError { code, message, requestId, details } from BE00; details allowlisted and bounded. |
| CMS-03C-02   | 400 INVALID_REQUEST; 401 UNAUTHENTICATED; 403 COMPOSITION_FORBIDDEN; 404 COMPOSITION_NOT_FOUND; 409 COMPOSITION_VERSION_CONFLICT; 415 UNSUPPORTED_MEDIA_TYPE; 422 COMPOSITION_VALIDATION_FAILED; 429 RATE_LIMITED; 502 DEPENDENCY_INVALID_RESPONSE; 503 DEPENDENCY_UNAVAILABLE; 504 DEPENDENCY_DEADLINE_EXCEEDED; 500 INTERNAL_ERROR                 | Catalog cms.03c.composition.v1; operation token is composition; messages use the bound format above         | 400/401/403/404/415/422/500: retry N/A. 409: reconcile revision/slot CAS, then resubmit with a new idempotency key. 429: retry only after BE00 Retry-After. 502/503/504: retry at most 3 times at 15s/60s/300s with jitter, circuit open 60s; after-effect ambiguity requires status/idempotency reconciliation first.                          | ApiError { code, message, requestId, details } from BE00; details allowlisted and bounded. |
| CMS-03C-03   | 400 INVALID_REQUEST; 401 UNAUTHENTICATED; 403 TAXONOMY_FORBIDDEN; 404 TAXONOMY_NOT_FOUND; 409 TAXONOMY_VERSION_CONFLICT; 415 UNSUPPORTED_MEDIA_TYPE; 422 TAXONOMY_VALIDATION_FAILED; 429 RATE_LIMITED; 502 DEPENDENCY_INVALID_RESPONSE; 503 DEPENDENCY_UNAVAILABLE; 504 DEPENDENCY_DEADLINE_EXCEEDED; 500 INTERNAL_ERROR                             | Catalog cms.03c.taxonomy.v1; operation token is taxonomy; messages use the bound format above               | 400/401/403/404/415/422/500: retry N/A. 409: reconcile taxonomy/term lock and redirect state, then resubmit with a new idempotency key. 429: retry only after BE00 Retry-After. 502/503/504: retry at most 3 times at 15s/60s/300s with jitter, circuit open 60s; after-effect ambiguity requires status/idempotency reconciliation first.      | ApiError { code, message, requestId, details } from BE00; details allowlisted and bounded. |
| CMS-03C-04   | 400 INVALID_REQUEST; 401 UNAUTHENTICATED; 403 LOCALE_FORBIDDEN; 404 LOCALE_SOURCE_NOT_FOUND; 409 LOCALE_VERSION_CONFLICT; 415 UNSUPPORTED_MEDIA_TYPE; 422 LOCALE_VALIDATION_FAILED; 429 RATE_LIMITED; 502 DEPENDENCY_INVALID_RESPONSE; 503 DEPENDENCY_UNAVAILABLE; 504 DEPENDENCY_DEADLINE_EXCEEDED; 500 INTERNAL_ERROR                              | Catalog cms.03c.locale.v1; operation token is locale; messages use the bound format above                   | 400/401/403/404/415/422/500: retry N/A. 409: reconcile source hash/entry version, then resubmit with a new idempotency key. 429: retry only after BE00 Retry-After. 502/503/504: retry at most 3 times at 15s/60s/300s with jitter, circuit open 60s; after-effect ambiguity requires status/idempotency reconciliation first.                  | ApiError { code, message, requestId, details } from BE00; details allowlisted and bounded. |
| CMS-03C-05   | 400 INVALID_REQUEST; 401 UNAUTHENTICATED; 403 RELATED_CONTENT_FORBIDDEN; 404 RELATED_CONTENT_NOT_FOUND; 409 RELATED_CONTENT_VERSION_CONFLICT; 415 UNSUPPORTED_MEDIA_TYPE; 422 RELATED_CONTENT_VALIDATION_FAILED; 429 RATE_LIMITED; 502 DEPENDENCY_INVALID_RESPONSE; 503 DEPENDENCY_UNAVAILABLE; 504 DEPENDENCY_DEADLINE_EXCEEDED; 500 INTERNAL_ERROR | Catalog cms.03c.related-content.v1; operation token is related-content; messages use the bound format above | 400/401/403/404/415/422/500: retry N/A. 409: reconcile source-entry version and target projection, then resubmit with a new idempotency key. 429: retry only after BE00 Retry-After. 502/503/504: retry at most 3 times at 15s/60s/300s with jitter, circuit open 60s; after-effect ambiguity requires status/idempotency reconciliation first. | ApiError { code, message, requestId, details } from BE00; details allowlisted and bounded. |

The application code lists above are exhaustive per operation. A response with
an unmapped status or a message not generated by its operation catalog is a
contract failure and is treated as INTERNAL_ERROR 500 without leaking the
original payload. No operation uses a success-shaped error, partial mutation,
or HTTP reason phrase as its application code.

## Database Schema

03c persists exactly nine private Supabase PostgreSQL tables with RLS enabled and forced: TemplateVersion, PatternVersion, CompositionInstance, TaxonomyVersion, TaxonomyTerm, TermLabel, TermAssignment, LocaleVariant, and RelatedContentRule. Browser roles have no direct table grants; named RPCs perform version, capability, cycle, target, and idempotency checks. BlockDefinitionVersion remains the 03a-owned table and is consumed by immutable key/version/digest.

### Canonical records and fields

| Model / table                                              | Typed fields, constraints, nullability, and FKs                                                                                                                                                                                                                                                                                                                                                                                               | Query indexes and write rules                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BlockDefinitionVersion / 03a cms_block_definition_versions | 03a-owned dependency, not a 03c table: id uuid PK, owner_id uuid NOT NULL, physical state `registered`; API lifecycle is derived from append-only supported → deprecated → withdrawn lifecycle events, version bigint >0, created_at, updated_at, canonical block_key and block_version, props ref/hash/signed snapshot, renderer, release digest/principal and immutable verification evidence.                                              | 03a owns UNIQUE(block_key,block_version), forced RLS, and signed registration/lifecycle RPC and lifecycle event; 03c may only SELECT the safe BlockDefinitionRegistryRecord with literal `resourceKind: 'block_definition_registry_record'`; no duplicate insert/update/delete or route.                                                                                                 |
| TemplateVersion / cms_template_versions                    | id uuid PK, owner_id uuid NOT NULL, state closed enum draft, review, approved, scheduled, active, superseded, retired, blocked, version bigint >0, created_at, updated_at; template_key regex /^[a-z][a-z0-9-]{1,63}$/; compatible type IDs, slots, reserved regions, binding manifest, BCP 47 locale, bounded audience, content_hash, and computed block_registry_digest char(64) lowercase hex; supersedes_id and created_by are typed FKs. | UNIQUE(template_key,version); INDEX(template_key,state,version DESC); INDEX(owner_id,state,updated_at DESC). Draft state transitions use the named RPC; definition fields never update, activation makes the row immutable, and immutable rows enforce updated_at=created_at with UPDATE/DELETE rejected. No uploaded markup/code.                                                       |
| PatternVersion / cms_pattern_versions                      | id uuid PK, owner_id uuid NOT NULL, state closed enum draft, review, approved, scheduled, active, superseded, retired, blocked, version bigint >0, created_at, updated_at; pattern_key regex /^[a-z][a-z0-9-]{1,63}$/; acyclic block_tree JSONB object whose every blockKey is canonical BlockKey; computed lowercase block_registry_digest char(64), content_hash, owner_capability, created_by.                                             | UNIQUE(pattern_key,version); INDEX(pattern_key,state,version DESC); INDEX(owner_id,state,updated_at DESC). The server resolves/recomputes the digest at pattern create/activate and publication preflight; draft transitions are RPC-only and active rows reject UPDATE/DELETE.                                                                                                          |
| CompositionInstance / cms_composition_instances            | id uuid PK, owner_id uuid NOT NULL, state closed enum draft, active, pending_diff, superseded, retired, version bigint >0, created_at, updated_at; revision_id FK; path/slot; block_key CHECK /^[a-z][a-z0-9._-]{0,95}$/; positive block_version; optional pattern/version; computed block_registry_digest; linked/detached mode; props/bindings; optional parent instance; created_by.                                                       | UNIQUE(revision_id,path,version); INDEX(owner_id,revision_id,slot_key); INDEX(pattern_id,pattern_version); block key/version and the nested tree are checked against the 03a safe registry; CAS and linked diff/accept/detach are required. Each instance version is append-only with updated_at=created_at; UPDATE/DELETE rejected.                                                     |
| TaxonomyVersion / cms_taxonomy_versions                    | id uuid PK, owner_id uuid NOT NULL, state closed enum draft, review, approved, scheduled, active, superseded, retired, blocked, version bigint >0, created_at, updated_at; taxonomy key, owner capability, flat/hierarchical shape, allowlisted type/field keys, content hash, and created_by.                                                                                                                                                | UNIQUE(taxonomy_key,version); INDEX(owner_id,taxonomy_key,state,version DESC). Canonical overlap is checked against the protected allowlist; key/definition fields are immutable, draft transitions are RPC-only, and active rows reject UPDATE/DELETE with updated_at=created_at.                                                                                                       |
| TaxonomyTerm / cms_terms                                   | id uuid PK, owner_id uuid NOT NULL, physical envelope lifecycle closed enum active, deprecated, merged (the explicit IA exception; no duplicate state), version bigint >0, created_at, updated_at; taxonomy_version_id FK; stable term_key, parent, aliases, optional successor FK, created_by; successor cannot equal self.                                                                                                                  | UNIQUE(taxonomy_version_id,term_key,version); INDEX(owner_id,taxonomy_version_id,lifecycle); INDEX(parent_term_id); INDEX(successor_id). Parent-cycle checks and lifecycle transitions use the named RPC; merged rows cannot reactivate, and terminal rows reject UPDATE/DELETE with updated_at=created_at.                                                                              |
| TermLabel / cms_term_labels                                | id uuid PK, owner_id uuid NOT NULL inherited from the taxonomy aggregate, state closed enum active, retired, version bigint >0, created_at, updated_at; term_id FK; BCP 47 locale; NFC label/optional description; aliases JSONB array; created_by.                                                                                                                                                                                           | UNIQUE(term_id,locale,version); INDEX(owner_id,term_id,locale,state). Labels are immutable per version (updated_at=created_at); replacement creates a new ID/version and UPDATE/DELETE is rejected.                                                                                                                                                                                      |
| TermAssignment / cms_term_assignments                      | id uuid PK, owner_id uuid NOT NULL inherited from the entry aggregate, state closed enum active, superseded, revoked, version bigint >0, created_at, updated_at; revision, field, term, taxonomy FKs; position; provenance authored, inherited, system_rule; created_by.                                                                                                                                                                      | UNIQUE(revision_id,field_definition_id,term_id,version); INDEX(owner_id,revision_id,field_definition_id,position); INDEX(term_id,state). Assignment rows are append-only with updated_at=created_at; replacement/revocation creates a new version and UPDATE/DELETE is rejected. Allowlist and publication checks run transactionally.                                                   |
| LocaleVariant / cms_locale_variants                        | id uuid PK, owner_id uuid NOT NULL inherited from the entry aggregate, state closed enum untranslated, draft, review, approved, stale, version bigint >0, created_at, updated_at; entry/revision/source revision FKs; target/source BCP 47 locales; source hash; fallback chain; no-fallback field IDs; optional approval evidence; created_by; target locale differs from source.                                                            | UNIQUE(entry_id,locale,source_revision_id,version); INDEX(owner_id,entry_id,locale,state); INDEX(source_revision_id,source_hash). Each locale snapshot is immutable (updated_at=created_at); source changes append a stale/new variant row, and UPDATE/DELETE is rejected. no_fallback fields block publication when absent/stale.                                                       |
| RelatedContentRule / cms_related_content_rules             | id uuid PK, owner_id uuid NOT NULL inherited from the source entry aggregate, state closed enum active, revoked, version bigint >0, created_at, updated_at; source/optional target entry FKs; optional rule key/version; mode pin, exclude, derived; reason code; optional position; created_by; derived rows have no target and pin/exclude rows require one.                                                                                | UNIQUE(source_entry_id,target_entry_id,mode,version); UNIQUE(source_entry_id,mode,version) WHERE mode='derived'; INDEX(owner_id,source_entry_id,state,mode,position); INDEX(target_entry_id,state). Rules are append-only (updated_at=created_at); revoke creates a new version and UPDATE/DELETE is rejected. Exclusions win and target authorization is rechecked at read/publication. |

For SQL, every persisted block-key column and every JSON block-tree key is
validated with `CHECK (block_key ~ '^[a-z][a-z0-9._-]{0,95}$')`; the equivalent
request/resource/test grammar is exactly `/^[a-z][a-z0-9._-]{0,95}$/`. Template
and pattern writes reject any alternate block-key grammar before the transaction.

### Permission, RLS and grants

- All 03c tables use forced RLS. authenticated and anon receive no direct write grants. Named RPCs are cms_define_template, cms_insert_pattern_instance, cms_act_taxonomy_term, cms_author_locale_variant, and cms_curate_related_content.
- TemplateVersion/PatternVersion SELECT requires designer scope or approved impact-read scope. INSERT is draft-only through RPC; activation is a separate governed transition. Reserved Shard 02 profile/provenance regions are protected checks, not caller fields.
- CompositionInstance RLS inherits the parent revision/entry assignment and requires edit capability. Pattern and block refs are registry-view reads; no cross-shard table is queried at request time.
- TaxonomyVersion/TaxonomyTerm/TermLabel/TermAssignment RLS requires curator scope for the vocabulary plus field/type allowlist. Merged terms remain readable as redirects; canonical-taxonomy overlap is rejected before write. Label and assignment versions are append-only.
- LocaleVariant RLS requires entry assignment and source revision visibility. Approved legal/safety/jurisdictional fields use no_fallback and cannot borrow another jurisdiction. RelatedContentRule RLS requires source edit scope; target visibility is rechecked on every projection.
- identity_private.person/id and identity_private.party/id are canonical BE01 references only where inherited entry RLS needs them; 03c never duplicates identity data. Cross-domain target IDs are not arbitrary joins: named projection adapters authorize them.
- SECURITY DEFINER functions are schema-qualified with empty search_path, PUBLIC execute revoked, named grants only, and positive/negative tests. Audit/idempotency/outbox remain BE00-owned and atomic.

## Middleware & Policies

### Per-operation authorization matrix

| Operation ID | Principal / capability                        | State/ownership predicate                                         | 403 rule                             | 404 rule                       | Extra gate                                          |
| ------------ | --------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------ | ------------------------------ | --------------------------------------------------- |
| CMS-03C-01   | verified human template_designer              | draft template in caller scope; every block registered/current    | visible scope, capability missing    | hidden/absent template         | fixed profile/provenance regions; activation review |
| CMS-03C-02   | CMS author/editor with assigned revision edit | revision/template draft; pattern readable and acyclic             | visible revision, no edit            | hidden/absent revision/pattern | explicit linked diff or detach                      |
| CMS-03C-03   | verified taxonomy_curator                     | assigned editorial vocabulary; taxonomy/term state permits action | visible vocabulary, no curator scope | hidden/absent taxonomy/term    | canonical overlap, cycle, merge survivor lock       |
| CMS-03C-04   | assigned CMS author/editor                    | source revision readable; field localizable; locale chain valid   | visible entry, no assignment/edit    | hidden/absent entry/source     | source hash, no_fallback, legal/safety gate         |
| CMS-03C-05   | assigned CMS author/editor                    | source entry editable; targets eligible authorized projections    | visible source, no edit              | hidden source/target           | exclusions win; recommendations never grant access  |

Known readable resources with insufficient capability return 403. Resources outside disclosure scope, absent IDs, or hidden targets return indistinguishable 404. Structural malformed input is 400 before existence checks.

### Security and abuse controls

- Raw body ceiling 256 KiB; JSON depth 8, keys 128, arrays 128; strict schemas reject HTML, scripts, CSS, expressions, dynamic imports, arbitrary SQL, external URLs, and unregistered block/renderer/projection references.
- Composition graphs reject cycles and enforce protected depth/node/slot counts before save and again before publish. Linked pattern changes show a three-way diff; no silent local overwrite.
- Taxonomy keys are immutable; rename changes labels, alias preserves lookup, merge locks survivor/retired IDs and migrates assignments idempotently. A merged term cannot reactivate.
- Locale IDs are BCP 47. Fallback is explicit ordered per type/field and records the selected source. no_fallback is the default for legal, safety, and jurisdiction fields.
- Related content uses manual pins first, exclusions always, bounded deterministic derived rules with reason/version. Eligibility and target authorization are rechecked at read, preview, and publication.
- Idempotency is bound to operation, actor, acting party, path, body, target, and expected version. Concurrent commands cap at three per actor; duplicate exact commands replay.
- Logs/provider-native diagnostics contain only operation, safe IDs/hashes, version, actor class, outcome, duration, and error. No content, private locale text, labels, target names, or capability graph.

## Data Flow

### Transaction and external seams

CMS-03C-01: parse → authenticate/acting context → template capability → reserve idempotency → read the 03a safe BlockDefinitionRegistryRecord projection for every reachable block → validate slots/bindings/reserved regions/type compatibility → resolve and recompute blockRegistryDigest → insert the TemplateVersion draft with the server digest (a client digest is only an equality expectation) → audit/idempotency. Governed activation recomputes the same digest before the immutable switch and emits cms.template.activated.v1 only after exact compatibility checks.

CMS-03C-02: authenticate assignment → load immutable PatternVersion and safe block registry records → expand graph with cycle/depth/node checks → resolve and recompute the pattern digest at create/activate (and at 03b publication preflight) → lock revision/slot → insert an append-only CompositionInstance version with linked/detached mode → audit. A local override collision produces pending_diff and never overwrites.

CMS-03C-03: authenticate curator → lock taxonomy/terms → check canonical overlap and hierarchy → apply create/rename/alias/deprecate/merge → append assignment versions with term redirect and idempotency → audit/outbox cms.taxonomy.changed.v1. A merge keeps the retired ID as a permanent redirect.

CMS-03C-04: authenticate assignment/source → load source revision and 03a localizable field definitions → validate BCP 47/fallback/no_fallback → insert locale revision/variant → append stale versions for source-dependent variants when hashes differ → audit/outbox cms.localization.changed.v1. It never borrows another jurisdiction's text.

CMS-03C-05: authenticate source edit → validate pin/exclusion/derived rule → recheck each target's current authorization/publication state → append rules or revocation versions → audit. A target that becomes private/unpublished disappears from public output; its editorial explanation remains private.

Before every template/pattern validation, 03c consumes the latest
`cms.block.lifecycle.changed.v1` event or refetches the safe 03a registry record;
withdrawn blocks are rejected and deprecated blocks are handled according to
the fixed compatibility policy. The event is identifier/hash-only and never
grants 03c registration or mutation authority.

The block registry adapter accepts only the safe `BlockDefinitionRegistryRecord`
shape with literal `resourceKind: 'block_definition_registry_record'`. For
each template or pattern, it follows the bounded block tree, rejects a
missing/withdrawn/incompatible record, sorts the deduplicated tuples by UTF-8
blockKey then numeric blockVersion, serializes the array with RFC 8785/JCS, and
hashes those bytes with lowercase SHA-256. The client-provided digest is
compared only as an equality expectation; the recomputed server digest is
authoritative. The same recomputation runs during publication preflight.
Normal registry/canonical taxonomy/checker calls are in-process or bounded
projections. If a remote canonical registry/checker adapter is enabled, its
exact seam is typed request/response Zod, 2,000ms RPC timeout, 15,000ms route
deadline, at most three pre-effect retries at 15s/60s/300s with jitter, and
circuit open after five consecutive retryable failures for 60s. Invalid
response is 502; unavailable/open circuit 503; deadline 504. No editorial
mutation commits on unresolved overlap or target authorization. Ambiguous
post-effect results reconcile with the idempotency/status RPC before retry.

### State machine and concurrency

- TemplateVersion and PatternVersion: draft → review → approved → scheduled or active → superseded or retired; blocked may return draft; active content immutable.
- CompositionInstance: linked/detached instance changes append a new version; linked update collision is pending_diff until explicit accept/detach. Parent revision CAS prevents two writers using the same slot path, and each stored version pins the server-recomputed blockRegistryDigest.
- TaxonomyVersion: same definition lifecycle. Term: active → deprecated → merged; merged cannot reactivate and redirects permanently. Term locks serialize merge and assignment.
- LocaleVariant: untranslated → draft → review → approved; source hash change appends an immutable stale snapshot; explicit revalidation appends a new approved version.
- RelatedContentRule: active → revoked by an append-only version; publication/read authorization is evaluated at use time, not inferred from creation.
- Duplicate delivery is safe through idempotency/outbox identity and version monotonicity. Unknown event versions go to DLQ. Worker or projection failure never regresses an active version.

### Event schemas

All events use the BE00 identifier-only envelope: eventId UUID, eventType, schemaVersion, occurredAt, producer, correlationId, causationId, aggregateType, aggregateId, aggregateVersion as lossless decimal string, and payload IDs/hashes only.

| Event type                     | Exact payload                                                                                                                                                                                          | Producer / consumer rule                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| cms.template.activated.v1      | { templateId: UUID, templateVersionId: UUID }                                                                                                                                                          | Template activation emits after immutable switch; 03b review/publication and Shard 04 preflight consumers refetch exact versions.                   |
| cms.taxonomy.changed.v1        | { taxonomyId: UUID, taxonomyVersionId: UUID }                                                                                                                                                          | CMS-03C-03 emits after taxonomy/term commit; assignments/search/navigation consumers refetch aliases/terms under authority.                         |
| cms.localization.changed.v1    | { entryId: UUID, locale: BCP47, revisionId: UUID }                                                                                                                                                     | CMS-03C-04 emits after variant commit; 03b invalidates review/publication dependencies and consumers refetch exact variant.                         |
| cms.publication.changed.v1     | { entryId: UUID, publicationVersionId: UUID }                                                                                                                                                          | 03b is producer; 03c consumes the event to invalidate related/locale/composition eligibility. It never emits a duplicate publication event.         |
| cms.block.lifecycle.changed.v1 | { blockDefinitionVersionId: UUID, blockKey: BlockKey, blockVersion: positive integer, fromLifecycle: `supported\|deprecated`, toLifecycle: `deprecated\|withdrawn`, releaseDigest: lowercase SHA-256 } | 03a is producer after signed immutable lifecycle append; 03c consumes/refetches the safe registry record and rejects withdrawn/incompatible blocks. |

Events contain no content values, labels, locale text, target names, secrets, tokens, or authority. Retries are max three at 15s/60s/300s, then DLQ and alert. Out-of-order events cannot regress a higher version.

### Cross-shard direction

- BE00 supplies errors, request IDs, ETags, idempotency, audit/outbox, CORS/CSRF, queues, rates, SLOs, and recovery fencing.
- BE01 supplies verified person/party/acting context, mandate, capability, assignment, and MFA; 03c stores only IDs.
- 03a supplies the authenticated safe BlockDefinitionRegistryRecord projection with literal `resourceKind: 'block_definition_registry_record'` for immutable BlockDefinitionVersion key/version, props ref/hash, renderer, derived lifecycle, and release digest, plus active schema/field/relation IDs/hashes, SchemaArtifact id/hash/compiler, protected validator refs, and workflow-policy evidence. 03c consumes `cms.block.lifecycle.changed.v1`, validates compatibility against those exact artifacts, follows only safe registry records, recomputes blockRegistryDigest, and never registers a block or changes a field.
- 03b supplies EntryRevision/PublicationVersion and frozen dependency hashes; 03c invalidates dependent states on source/publication changes but never publishes directly.
- Shard 04 consumes exact active template/pattern/taxonomy/locale/related projections after authorized publication; it owns public cache/search/sitemap/render convergence.
- Shard 05 supplies governed settings/checkers/risk definitions only by versioned allowlist; it cannot override fixed profile, no_fallback, canonical taxonomy, or target authorization.
- Shard 16 and other domain shards retain canonical education/rights/money/identity state. CMS references only named read-only projections and cannot manufacture authority.

## Error Handling

### Operation error coverage

| Operation ID | Before mutation                         | Transaction/race                                                | After commit/recovery                                                         |
| ------------ | --------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| CMS-03C-01   | transport/auth/block/slot validation    | 409 key/version/compatibility/idempotency; rollback no template | draft remains; activation event only after later governed switch              |
| CMS-03C-02   | transport/auth/graph validation         | 409 cycle/slot/CAS/idempotency; no silent overwrite             | linked diff remains pending; retry exact command                              |
| CMS-03C-03   | transport/auth/overlap validation       | 409 term/merge/CAS/idempotency; assignments preserve old IDs    | taxonomy event retries; redirect/assignment convergence is idempotent         |
| CMS-03C-04   | transport/auth/locale/source validation | 409 stale hash/version/duplicate; no illegal fallback           | locale event retries; stale/no_fallback state remains honest                  |
| CMS-03C-05   | transport/auth/target validation        | 409 source version/duplicate/idempotency; no target authority   | unavailable target drops from public projection; rule history remains private |

Every failure uses BE00 ApiError { code, message, requestId, details }. PostgreSQL failure before commit creates no record; lost response after commit replays by idempotency/status. Audit failure rolls back. Outbox/Queue failure leaves canonical state and retries. Projection outage shows pending/degraded. 429 honors Retry-After; 503/504 retries only after status reconciliation; unknown state is never guessed active.

## Observability

Structured scrubbed logs are keyed by operation ID, requestId, traceId, correlationId, actor/acting-context class, safe aggregate ID/hash, version, outcome, error code, duration, dependency class, and retryability. No content, locale text, target name, token, raw rule, or capability graph is logged.

Metrics: cms_composition_request_total{operation,outcome}, cms_composition_latency_ms, cms_composition_error_total{operation,code}, cms_composition_conflict_total, cms_template_activation_age, cms_pattern_cycle_reject_total, cms_taxonomy_merge_total, cms_taxonomy_overlap_reject_total, cms_locale_stale_total, cms_no_fallback_block_total, cms_related_target_filtered_total, cms_outbox_age, cms_queue_retry_total, cms_queue_dlq_total. Alert on DLQ >0, outbox age >2m, activation blocked >15m, stale locale legal-field count >0, or target-filter anomaly.

Traces cover validation → principal/assignment → registry/projection refetch → idempotency → RPC/SQL → audit/outbox → consumer refetch. Structured diagnostics use allowlisted fields only; audit is PostgreSQL authority. SLOs: Tier 2 p95 <1,200ms, protected RPC <300ms, queue first attempt p95 ≤60s, DLQ <0.1% daily.

## Testing Strategy

### Contract and route tests

- OpenAPI, Hono routes, and the five registry rows match operation ID, method/path, request/success/error, auth, CORS, rate, timeout, cache, idempotency, ETag, and SLO.
- CMS-03C-01 tests slots, required/allowed blocks, canonical BlockKey acceptance/rejection, reserved regions, profile/provenance spine, type compatibility, locale/audience, unknown keys, registered/deprecated/withdrawn block lifecycle, safe `resourceKind: 'block_definition_registry_record'`, server recomputation versus client digest expectation, lifecycle event/refetch, activation event, and exact TemplateVersionResource.
- CMS-03C-02 tests linked/detached modes, three-way diff, slot/path uniqueness, override max 64 keys/depth 8, canonical nested BlockKey acceptance/rejection, cycle/depth/node rejection, safe registry compatibility, deterministic RFC 8785/JCS digest sorting, CAS, and exact CompositionInstanceResource.
- CMS-03C-03 tests all actions, stable key/rename/alias, parent cycles, canonical overlap, merge survivor, merged reactivation, duplicate replay, assignment migration, redirect, and taxonomy event.
- CMS-03C-04 tests BCP 47, source hash, localizable-field filtering, fallback order, no_fallback legal/safety/jurisdiction block, source-stale transition, explicit revalidation, and locale event.
- CMS-03C-05 tests pin/exclusion ordering, derived reason/version, duplicate/unauthorized target, target unpublish/private transition, public filtering, and publication invalidation.
- Every route tests 400, 401, 403, 404, 409, 415, 422, 429, 502, 503, 504, and 500 where applicable with exact ApiError, headers, and safe details.
- Browser-envelope tests reject ownership identifiers and unknown state values, and assert the exact TemplateVersionState, CompositionInstanceState, TaxonomyTermLifecycle, LocaleVariantState, PatternVersionState, and RelatedContentState mappings.

### Authorization, persistence, and concurrency tests

- Anonymous, expired session, wrong person/party, missing assignment, revoked capability, wrong vocabulary, hidden target, forged JWT metadata, service-role misuse, and existence leakage are tested for every operation.
- Every 03c table (TemplateVersion, PatternVersion, CompositionInstance, TaxonomyVersion, TaxonomyTerm, TermLabel, TermAssignment, LocaleVariant, and RelatedContentRule) tests the mandatory id/owner_id/closed-state/version/timestamps envelope, SQL type/nullability/check, FK target, canonical BlockKey SQL checks where applicable, unique/partial indexes, immutable fields, updated_at=created_at and UPDATE/DELETE rejection for immutable rows, lifecycle/terminal transitions, cycle/merge constraints, 03a safe registry discriminator/lifecycle-event consumption, RLS enabled/forced, direct grants revoked, and named RPC grants.
- Same-key concurrent commands produce one effect/replay; changed body/actor/path/version returns 409; failed transaction leaves no idempotency/audit/outbox row.
- Template activation versus block withdrawal, linked pattern update versus local override, term merge versus assignment, locale source edit versus translation, related target unpublish, duplicate/out-of-order events, worker lease expiry, and restore-epoch fencing are covered.

### Security, performance, and recovery tests

- Fuzz JSON depth/keys/arrays, paths, Unicode/control chars, HTML/script/CSS/expression injection, arbitrary projection/query attempts, timezone/locale tags, target IDs, and oversized bodies.
- Prove no private locale text, draft composition, unauthorized target, capability, or canonical-domain authority enters public projection, event payload, logs, or cache.
- Prove BlockKey is exactly /^[a-z][a-z0-9._-]{0,95}$/ in request, safe registry resource, SQL block references, and nested pattern/slot fixtures; prove blockRegistryDigest is lowercase SHA-256 over the RFC 8785/JCS canonical UTF-8 sorted tuple array and that server recomputation wins over a mismatched client expectation at create, activate, and publication preflight.
- Remote checker tests assert exact 2,000ms timeout, 15s/60s/300s retries, five-failure/60s circuit, 502/503/504 mapping, and ambiguous-result reconciliation.
- Representative 64-slot templates, 512-node pattern bounds, 50-term pages, 128 locale fields, and 64 related targets meet Tier 2 p95 <1,200ms and RPC <300ms.
- Recovery drills prove merge retry/redirect, linked-pattern rebase, source-locale stale recovery, target authorization filtering, DLQ replay, publication invalidation, and fail-closed takedown.

### Accessibility handoff tests

Template/slot validation errors preserve stable JSON Pointer paths. Composition changes have a linear semantic representation and keyboard-safe ordering. Locale and fallback status is truthful and announced through frontend status semantics. Reserved profile/provenance components cannot be hidden or reordered by content.

## Deepening Passes

| Pass | Focus                         | Evidence                                                                                                                                                                                                       | Result |
| ---- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1    | Source/split completeness     | CMS-11, CMS-12, CMS-14, CMS-15, CMS-16, all owned models, and five event types including the consumed 03a block-lifecycle event mapped above.                                                                  | PASS   |
| 2    | Route/contract reconciliation | Five registry rows, strict Zod request/success schemas, error matrix, auth, CORS, rate, idempotency, and tests align; 03a artifact, validator, workflow-policy, and block props identity evidence is explicit. | PASS   |
| 3    | Persistence hard floor        | Each owned table lists SQL type/nullability/checks, FKs or explicit registry boundary, indexes, RLS, and grants; the 03a block snapshot is verified against its ref/hash and release digest.                   | PASS   |
| 4    | State/concurrency/failure     | Immutable versions, graph/term locks, locale staleness, target rechecks, CAS, outbox, retry, and DLQ are deterministic.                                                                                        | PASS   |
| 5    | Security/disclosure           | CORS/CSRF, 403/404, no code upload, canonical overlap, no_fallback, target BOLA, and no PII logging are explicit.                                                                                              | PASS   |
| 6    | External seams/operations     | Exact timeout/retry/backoff/circuit, metrics/traces/SLOs, and ambiguous-result reconciliation are specified.                                                                                                   | PASS   |
| 7    | Tests/accessibility           | Field, refusal, RLS, idempotency, event, recovery, performance, and accessible status tests cover all operations.                                                                                              | PASS   |
| 8    | Cross-shard ownership         | 03a schema/artifact/validator/workflow evidence, 03b editorial/publication, BE01 identity, BE00 foundation, Shard 04 projections, and DEC-100 direction are explicit.                                          | PASS   |
| 9    | Two-implementer convergence   | Same routes, schemas, immutable block props ref/hash/snapshot evidence, canonical BlockKey and server-computed digest, lifecycle, RLS, event payloads, retries, and disclosure result from this document.      | PASS   |
| 10   | Adversarial review            | Reserved region removal, withdrawn blocks, cycles, merge race, locale legal fallback, target BOLA, and projection outage have typed outcomes.                                                                  | PASS   |

## Ambiguity Gate

- Micro ambiguity PASS: every request field has exact type/bound/nullability, every state guard and recovery is explicit, and every operation has auth, CORS, rate, idempotency, error, observability, and test rows; 03a block props identity is the ref/hash and its normalized signed snapshot is bound to release digest.
- Macro ambiguity PASS: define template/pattern → compose revision → govern taxonomy → author locale → curate related content → freeze versions in 03b → project through Shard 04 has one ownership direction and no hidden write.
- Two-implementer PASS: independent implementers select the same five routes, nine owned model tables plus 03a registry dependency, states, FKs, RLS outcomes, event payloads, safe registry record, canonical BlockKey, digest algorithm, and retries.
- Devil's-advocate PASS: hostile markup/code, forged or mismatched block props snapshot/signature/release digest, reserved profile reorder, withdrawn block, cyclic pattern, taxonomy overlap/merge race, no_fallback legal omission, forwarded target, and publication outage are blocked or safely degraded.
- No unresolved product, architecture, security, or implementation ambiguity remains in this boundary.

## Open Questions

None.

## Changelog

| Date       | Change                                                                                                                                                                                                                                                                                                                                | Workflow                | Sections affected                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------- |
| 2026-09-02 | Reconciled all nine persisted 03c models to the IA common envelope and explicit lifecycle exception, added TermLabel, aligned the safe 03a registry record, fixed canonical BlockKey grammar, and made server-computed RFC 8785/JCS blockRegistryDigest checkpoints explicit.                                                         | /implement-slice        | Source maps, contracts, database schema, data flow, tests, ambiguity gate              |
| 2026-10-02 | DEC-108: added the reciprocal draft-compatible template creation `POST /api/v1/cms/templates/versions` (CMS-03C-01) and the named non-mutating service-only `platform_api.cms_resolve_template_compatibility` resolver contract with its safe projection, and reaffirmed public template activation as a separate unresolved 03c gap. | /propagate-decision     | Endpoint reconciliation note, Route Registry invariants                                |
| 2026-09-02 | Reconciled 03a SchemaArtifact and protected dependency evidence and adopted immutable block props ref/hash with a normalized signed snapshot bound to the release digest.                                                                                                                                                             | /implement-slice        | Referenced Material, Contracts, Database Schema, Cross-shard direction, Ambiguity Gate |
| 2026-09-02 | Added the bounded max-64/depth-8 pattern override refinement, ArtifactRef traversal/URL guard, and explicit safe block lifecycle-event/discriminator consumption.                                                                                                                                                                     | /implement-slice        | Contracts, Data Flow, Events, Testing Strategy                                         |
| 2026-09-02 | Closed browser response state/lifecycle enums against the IA and SQL matrices and removed ownership identifiers from ResourceMeta/resources while retaining server/DB authorization context.                                                                                                                                          | /implement-slice        | Source Map, Route Registry, Contracts, Testing Strategy                                |
| 2026-08-28 | Classified IA Shard 03 into registry, editorial/publication, and composition/taxonomy/localization backend boundaries.                                                                                                                                                                                                                | /write-be-spec-classify | Split Group, Classification                                                            |
| 2026-08-28 | Authored complete composition, taxonomy, localization, and related-content backend contract for CMS-11, CMS-12, CMS-14, CMS-15, and CMS-16.                                                                                                                                                                                           | /write-be-spec-write    | All                                                                                    |
| 2026-10-02 | DEC-108 consistency closure: the template-compatibility resolver has typed failures `NOT_FOUND`, `INCOMPATIBLE`, `WITHDRAWN` and `VERSION_MISMATCH`, is service-role only with zero side effects, and reaches the browser only as 03a's optional `activationPreparation.templateCompatibility`.                                       |

## Dependency References

- [IA Shard 03 — CMS content modeling and authoring](../ia/03-cms-content-modeling.md)
- [IA Shard 03 deep dive — CMS content modeling and authoring](../ia/deep-dives/03-cms-content-modeling.md)
- [BE00 — Cross-cutting platform foundation](00-infrastructure.md)
- [03a — Content schema registry](03a-content-schema-registry.md)
- [03b — Editorial workflow and publication](03b-editorial-workflow-publication.md)
- [BE01 — Identity authority and party governance](01a-auth-account-linking.md)
- [BE02 — Shadow/profile/credentials boundaries](02a-shadow-claim-ownership.md)
- [Architecture Design](../2026-08-02-architecture-design.md)
- [Data Placement Strategy](../data-placement-strategy.md)
- [DEC-100 — bounded allowlisted cross-shard projections](../../decisions.md#dec-100-shard-02-accepts-bounded-inbound-evidence-and-policy-commands-without-upward-store-reads-2026-08-28)
