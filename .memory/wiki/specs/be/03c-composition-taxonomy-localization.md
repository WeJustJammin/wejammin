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
- Decision status: no new owner decision. DEC-100 is inherited: cross-shard target data is a bounded, versioned, allowlisted projection; no request-time upward store reads or authority copying. The Slice 12 cascade (2026-10-07) applies the owner decisions DEC-113 (reviewer-gated template and pattern activation), DEC-114 (CMS-15 and CMS-16 are Phase 2 scope), DEC-121 (stale and no_fallback locale behavior) and DEC-123 (template binding through a successor), and the orchestrator resolutions DEC-135 (taxonomy vocabularies declare the canonical domains they may overlap), DEC-137 (one subject-polymorphic review, decision and assignment set), DEC-138 (Slice 12 owns the shared no_fallback resolution helper and the locale preflight provider), DEC-141 (receiving obligations from Slice 10), D7, D9, D10, D11, D12, OD-1, OD-2, OD-5 and OD-6; the owner may override the orchestrator resolutions. The Slice 12 depth-floor cascade (2026-10-12) applies the owner decisions DEC-175 (a pattern placement stores one composition row per root node of the pinned pattern, refined by DEC-181 to one row per block root), DEC-176 (patterns apply to entry revisions only) and DEC-181 (a top-level nested pattern reference is expanded at placement into that pattern's own block roots, recursively, so the rows of a placement are bounded by the 512-node cap after expansion and not by 32) and the orchestrator resolutions DEC-178 (the depth-floor cascade), DEC-179 (reconciliations R1 to R4) and DEC-180 (R5 to R8 and the implementation decisions G2, G3, G4, G6, G8, G9 and G11); the owner may override the orchestrator items. The Slice 12 spec-completion pass (2026-10-13) applies the owner decision DEC-185 (every composition row carries an authored `position`: a placement keeps its forest order, two placements in one slot never interleave, and the render plan orders a slot by `position`) and the orchestrator resolution DEC-186 (the row path of a placement and its 248-octet bound, the digest refusal `block_registry_digest_mismatch`, and the override key chain inside an expanded root), and it settles the remaining DEC-181 consequences from the existing text (a placement larger than one CMS-03C-15 request, and the front-end list size); the owner may override the orchestrator items. The Slice 12 approved ceiling/lifecycle cascade (2026-10-13) applies the owner-approved decisions DEC-188 (the TemplateVersion, PatternVersion and TaxonomyVersion rows keep the immutable definition `version` used by every pin, uniqueness key, lookup, edit operand and `subjectVersion`, and add a separate internal `lifecycle_version` positive bigint default 1 that advances by exactly one on every governed state transition, changes only through the guarded lifecycle-metadata exception to the active-row UPDATE prohibition, and is never a public-resource field; the decision and activation `expectedVersion` and the review ETag still compare the governed-review `version`, and the activation/scheduled-execution/retirement event aggregateVersion is the committed subject `lifecycle_version`) and DEC-189 (the `CMS-03C-02` decoded JSON response body is the one response ceiling exception at 1,048,576 bytes / 1 MiB, response-only, carrying its bounded 1–512-row `PatternPlacementResource`, while its request and every other request and response stay at 256 KiB and the 1 MiB ceiling's sufficiency against the actual producer remains to be proven by a maximum-size success, and an over-budget refusal exists only at the Worker transport and route); the owner may override the orchestrator items. The Slice 12 linked-update cascade (2026-10-15) applies the owner decision DEC-193: a linked pattern update lets the author decide every structural change. The value of a node path for diff purposes is its `props` plus its block identity and `children`; a change of block identity or children is a `structure` collision; a block root the target version removes is a `removed_root` collision that `theirs` retires and `yours` keeps as a detached local copy; the block roots a target version adds are listed as new and placed only by the author, through CMS-03C-02 `roots`; and detach stores the full subtree as a detached local block tree bounded by the 512-node pattern limit, with no key-count refusal. Text overrides keep the existing rule: an override replaces the node's `props`.

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
| 25.03.02  | Template Definitions, Slots & Bindings | CMS-03C-01, CMS-03C-06 to CMS-03C-11, cmsTemplateContextRead, cmsTemplateLatestRead | TemplateVersion route/table, reserved regions, registered-block compatibility, slot bounds, and template tests.            |
| 25.03.03  | Page Composition & Reusable Patterns   | CMS-03C-02, CMS-03C-12 to CMS-03C-15, cmsPatternLatestRead, cmsCompositionInstancesRead, cmsPatternNestableRead | PatternVersion and CompositionInstance, linked/detached diff, cycle/depth limits, and composition tests.                   |
| 25.05.01  | Taxonomy & Vocabulary Definitions      | CMS-03C-03, CMS-03C-16, CMS-03C-17, CMS-03C-18, cmsTaxonomyVersionsRead, cmsTaxonomyTermsRead | TaxonomyVersion/TaxonomyTerm/TermLabel, canonical overlap refusal, immutable keys, hierarchy, aliases, and taxonomy tests. |
| 25.05.02  | Term Governance & Assignment           | CMS-03C-03   | Term actions, merge redirect, immutable label versions, assignment convergence, curator RLS, and idempotent merge tests.   |
| 25.05.03  | Localization Variants & Fallback       | CMS-03C-04, cmsLocaleVariantRead, CMS-03C-20 | LocaleVariant, BCP 47/fallback/no_fallback rules, source staleness, and locale tests.                                      |
| 25.05.04  | Related Content and Relationships      | CMS-03C-05, cmsRelatedContentRead, CMS-03C-21 | RelatedContentRule pins/exclusions/derived reason, target authorization, ordering, and unavailable-target tests.           |

25.01.* is owned by 03a; 25.02.* and 25.03.04 are owned by 03b; 03c consumes their versioned IDs/hashes only.

## Endpoint Completeness Reconciliation

Each remaining IA interaction has one concrete operation and one authoritative route registry row. Public projection is a downstream Shard 04 transition, not a 03c route. Template, pattern and taxonomy-version activation is **not** a downstream side effect: DEC-113 and OD-1 make it a governed, reviewer-gated, mutating command set (CMS-03C-06 through CMS-03C-11) over one subject-polymorphic review machinery (DEC-137), reached from CMS-11, CMS-12 and CMS-14. The IA interactions therefore reconcile to seventeen browser/protected HTTP operations (CMS-03C-01 through CMS-03C-17), five supporting reads (`cmsTemplateContextRead`, `cmsTemplateLatestRead` (D7), `cmsPatternLatestRead`, `cmsTaxonomyVersionsRead` and `cmsTaxonomyTermsRead`, the protected reads the designer and curator forms need to edit an existing definition) and four internal service operations (CMS-03C-18 through CMS-03C-21).

| IA interaction                | Operation ID | Concrete route                                               | Reconciliation                                                                                                                                     |
| ----------------------------- | ------------ | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| CMS-11 Define template        | CMS-03C-01   | POST /api/v1/cms/templates/versions                          | Creates a versioned template candidate from registered blocks; server computes blockRegistryDigest and activation is governed by review/preflight. |
| CMS-12 Use reusable pattern   | CMS-03C-02   | POST /api/v1/cms/compositions/pattern-instances              | Adds a linked or detached pattern placement to the entry's current draft revision (DEC-176: patterns apply to entry revisions only) as one composition row per block root of the pinned pattern version, after expanding any top-level nested pattern reference into that pattern's own block roots (DEC-175, DEC-181), at consecutive positions in forest order (DEC-185); server recomputes the pattern digest and never silently overwrites.         |
| CMS-12 Use reusable pattern   | cmsCompositionInstancesRead | GET /api/v1/cms/entries/{entryId}/compositions | Protected read of the entry's current draft revision's composition instances (the newest `draft`, `active` or `pending_diff` row of each path) in render order, for the composition page's instance list; it is also the page's edit-authority gate (DEC-206). |
| CMS-11 Design pattern         | cmsPatternNestableRead | GET /api/v1/cms/patterns/nestable | Designer-only read of the `active` pattern versions of the owner scope that list EVERY requested content type, for the nested-pattern picker of the pattern version designer (DEC-196); CMS-03C-13 stays the author/editor single-type selector. |
| CMS-14 Govern taxonomy term   | CMS-03C-03   | POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions       | Executes create/rename/alias/deprecate/merge through one idempotent term command.                                                                  |
| CMS-15 Author locale variant  | CMS-03C-04   | POST /api/v1/cms/entries/{entryId}/locales/{locale}/variants | Creates or replaces an immutable locale revision state through a new variant version.                                                              |
| CMS-15 Author locale variant  | cmsLocaleVariantRead | GET /api/v1/cms/entries/{entryId}/locales/{locale} | Protected read of the entry's current locale variant for the translation form: its stored field values, derived state and stale fields, every localizable field's CMS-03C-20 resolution and the active fallback order; it is also the form's edit-authority gate (DEC-205). |
| CMS-16 Curate related content | CMS-03C-05   | POST /api/v1/cms/entries/{entryId}/related-content           | Stores pins/exclusions/derived rule; public eligibility is rechecked at projection/read.                                                           |
| CMS-16 Curate related content | cmsRelatedContentRead | GET /api/v1/cms/entries/{entryId}/related-content | Protected read of the source entry's current related-content rule for the curation form; it is also the form's edit-authority gate (DEC-195). |
| CMS-11 Define template | cmsTemplateLatestRead | GET /api/v1/cms/templates/{templateKey} | Protected read of the owner's latest template definition for the designer edit form (D7). |
| CMS-11, CMS-12, CMS-14 Activate governed definitions | CMS-03C-06 to CMS-03C-11 | POST /api/v1/cms/governed-reviews; POST /api/v1/cms/governed-reviews/{reviewId}/decision; POST /api/v1/cms/governed-reviews/{reviewId}/assignments; POST /api/v1/cms/governed-reviews/{reviewId}/activation; GET /api/v1/cms/governed-reviews/{reviewId}; GET /api/v1/cms/governed-reviews | Submit, decide, assign reviewers, activate (immediate, scheduled or retire) and read the review of a template, pattern or taxonomy version (DEC-113, OD-1, OD-6, DEC-137). |
| CMS-12 Use reusable pattern | CMS-03C-12 to CMS-03C-15, cmsPatternLatestRead | POST /api/v1/cms/patterns/versions; GET /api/v1/cms/patterns/{patternKey}; GET /api/v1/cms/patterns/selector; GET /api/v1/cms/compositions/instances/{instanceId}/update-diff; POST /api/v1/cms/compositions/pattern-updates | Persisted PatternVersion create and selector read, and the linked-update diff, accept and detach flows (D9, OD-2). |
| CMS-14 Govern taxonomy term | CMS-03C-16, CMS-03C-17, cmsTaxonomyVersionsRead, cmsTaxonomyTermsRead | POST /api/v1/cms/taxonomies/versions; GET /api/v1/cms/taxonomies/selector; GET /api/v1/cms/taxonomies/{taxonomyId}/versions; GET /api/v1/cms/taxonomies/{taxonomyId}/terms | TaxonomyVersion create with declared canonical overlap domains and the selector read (D10, OD-1, DEC-135). |
| CMS-14, CMS-15, CMS-16 internal | CMS-03C-18 to CMS-03C-21 | internal RPCs only | Canonical-taxonomy overlap provider, governed scheduled-activation executor, shared locale field resolution with the locale preflight provider (DEC-138), and the related-content public target projection (D11). |

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
const CapabilityKey = z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/);
// The 03b decision reason grammar: 1-2000 code points, NFC, no control,
// line/paragraph-separator or bidirectional-formatting character, no `<>{}`.
const SafeReason = z
  .string()
  .min(1)
  .max(4000)
  .refine((v) => [...v].length <= 2000)
  .refine((v) => v === v.normalize('NFC'))
  .refine((v) => !/[\p{Cc}\u2028\u2029\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/u.test(v))
  .refine((v) => !/[<>{}]/.test(v));
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
- Mutations require Idempotency-Key 8–128 printable ASCII. Mutable parent commands require exact strong If-Match quoted positive decimal. Same bound request replays; the same actor reusing the key with a changed body, path or version returns 409. A changed server-resolved acting party never replays: it is part of the key's request binding (409 where the command addresses no target outside the new party's scope), and a command addressing a target outside the new party's scope answers that target's concealed 404 first, because ownership and visibility are checked before the key is reserved (BE00 binds `(actor_id, operation, key_hash)`, so a different actor is a distinct binding; DEC-235, DEC-236).
- RLS/RPC rechecks current schema/template/taxonomy/locale/entry version, target visibility, capability, assignment, and idempotency at commit. Mutation, audit, and outbox are atomic.
- Events carry IDs, versions, hashes, correlation/causation IDs only. Consumers refetch under their own authority and use at-least-once retries, leases, CAS, and DLQ.

## API Endpoints

### Route Registry

This is the sole authoritative 03c route registry. CI must match discovered Hono routes and generated OpenAPI to each operation ID, request/success/error schema, auth, CORS, rate, timeout, cache, SLO, idempotency, and BOLA policy.

| Operation ID           | IA     | Method and path                                              | Request → success                                        | Auth / ownership / 403 versus 404                                                                                               | Middleware incl. CORS                                                           | Idempotency / concurrency                                                                           | Rate / timeout / cache / SLO                                                   | Error envelope                                      | Event                                                                                    |
| ---------------------- | ------ | ------------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| CMS-03C-01             | CMS-11 | POST /api/v1/cms/templates/versions                          | TemplateVersionRequest → 201 TemplateVersionResource     | template_designer in scope; hidden owner/template is 404; readable template without capability is 403                           | BE00 order; CORS cms-console; CSRF; strict JSON; registry read                  | key + If-Match when editing parent; per-owner unique (key, version) (E14) and CAS; reserved keys refused (E13); server-computed blockRegistryDigest | 30/min/user, 60/min/party; 15,000ms, target <2s; no-store; Tier 2 p95 <1,200ms | BE00 ApiError { code, message, requestId, details } | none (activation is CMS-03C-09, which emits cms.template.activated.v1)                    |
| cmsTemplateContextRead | CMS-11 | GET /api/v1/cms/templates/context                            | EmptyRequest → 200 TemplateDesignerContext               | authenticated human with confirmed acting-party membership and active `cms.template_designer` grant; no owner selector accepted | BE00 order; cms-console origin; no CSRF or request body; server-derived context | read-only; no idempotency or If-Match                                                               | 60/min/user, 60/min/party; 15,000ms; no-store; Tier 2                          | BE00 ApiError { code, message, requestId, details } | none                                                                                     |
| CMS-03C-02             | CMS-12 | POST /api/v1/cms/compositions/pattern-instances              | PatternInstanceRequest (an optional `roots` names the block roots to place, DEC-193) → 201 PatternPlacementResource (one or more rows, at most 512 after expansion, DEC-175, DEC-181; decoded JSON response ≤ 1,048,576 bytes / 1 MiB, response-only, DEC-188/DEC-189) | assigned author/editor on the entry's current draft revision (DEC-176); hidden target is 404; visible target without edit is 403 | BE00 order; CORS cms-console; CSRF; strict JSON; block registry read            | key + If-Match; CAS revision; unique revision/path per row; one row per block root after expansion (per root that `roots` names, when present, DEC-193), all-or-nothing, at consecutive positions appended after the slot's greatest in forest order (DEC-175, DEC-181, DEC-185; a row placed on a path whose newest row is `retired` keeps that path's position, DEC-193); server recomputes pattern digest | 120/min/user, 240/min/party; 15,000ms; no-store; Tier 2                        | BE00 ApiError { code, message, requestId, details } | none                                                                                     |
| CMS-03C-03             | CMS-14 | POST /api/v1/cms/taxonomies/{taxonomyId}/terms/actions       | TaxonomyTermActionRequest → 200 TaxonomyTermResource     | taxonomy_curator for vocabulary; hidden taxonomy/term is 404; known vocabulary without capability is 403                        | BE00 order; CORS cms-console; CSRF; strict JSON; canonical-overlap check        | key + If-Match; term lock/CAS; merge unique survivor and redirect                                   | 60/min/user, 120/min/party; 15,000ms; no-store; Tier 2                         | BE00 ApiError { code, message, requestId, details } | cms.taxonomy.changed.v1                                                                  |
| CMS-03C-04             | CMS-15 | POST /api/v1/cms/entries/{entryId}/locales/{locale}/variants | LocaleVariantRequest → 201 LocaleVariantResource         | assigned author/editor for localizable fields; hidden entry or source revision is 404; a locale outside the active version's `supportedLocales` is 422 (DEC-230); visible entry without edit is 403                    | BE00 order; CORS cms-console; CSRF; strict JSON; source revision read           | key + If-Match; CAS source/entry; unique entry/locale/source revision                               | 60/min/user, 120/min/party; 15,000ms; no-store; Tier 2                         | BE00 ApiError { code, message, requestId, details } | cms.localization.changed.v1                                                              |
| CMS-03C-05             | CMS-16 | POST /api/v1/cms/entries/{entryId}/related-content           | RelatedContentRuleRequest → 201 RelatedContentResource   | author/editor with source assignment; a hidden or absent source is 404 and a hidden, absent or ineligible target is the uniform 422 `related_target_ineligible`; visible source without edit is 403                           | BE00 order; CORS cms-console; CSRF; strict JSON; target projection recheck      | key + If-Match; CAS source entry; unique pin/exclusion target                                       | 60/min/user, 120/min/party; 15,000ms; no-store; Tier 2                         | BE00 ApiError { code, message, requestId, details } | cms.publication.changed.v1 consumed for invalidation; no event emitted until publication |
| cmsRelatedContentRead  | CMS-16 | GET /api/v1/cms/entries/{entryId}/related-content           | path UUID → 200 RelatedContentRuleRead                    | as CMS-03C-05: an assigned CMS author or editor who can edit the source entry; a hidden or absent source is 404 and a visible source without edit is 403 (DEC-195) | BE00 order; CORS cms-console; no CSRF or request body | read-only; no idempotency or If-Match | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 1 p95 <750ms | BE00 ApiError { code, message, requestId, details } | none |
| cmsLocaleVariantRead   | CMS-15 | GET /api/v1/cms/entries/{entryId}/locales/{locale}          | path UUID + BCP 47 → 200 LocaleVariantRead                   | as CMS-03C-04: an assigned CMS author or editor who can edit the entry's localizable fields; a hidden or absent entry, or a `locale` that is not in the active content-type version's `supportedLocales`, is 404 and a visible entry without edit is 403 (DEC-205) | BE00 order; CORS cms-console; no CSRF or request body | read-only; no idempotency or If-Match | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 1 p95 <750ms | BE00 ApiError { code, message, requestId, details } | none |
| cmsTemplateLatestRead  | CMS-11 | GET /api/v1/cms/templates/{templateKey}                      | TemplateLatestQuery (path) → 200 TemplateVersionDetail   | `cms.template_designer` in the caller's owner scope; the key resolves only within that scope, a hidden or absent key is 404, a caller without the capability is 403 | BE00 order; CORS cms-console; no CSRF or request body | read-only; no idempotency or If-Match; strong ETag `"{version}"` | 60/min/user, 60/min/party; 15,000ms; no-store; Tier 2 | BE00 ApiError { code, message, requestId, details } | none |
| cmsPatternLatestRead   | CMS-12 | GET /api/v1/cms/patterns/{patternKey}                         | PatternLatestQuery (path) → 200 PatternVersionDetail         | `cms.template_designer` in the caller's owner scope; the key resolves only within that scope, a hidden or absent key is 404, a caller without the capability is 403 | BE00 order; CORS cms-console; no CSRF or request body | read-only; no idempotency or If-Match; strong ETag `"{version}"` | 60/min/user, 60/min/party; 15,000ms; no-store; Tier 2 | BE00 ApiError { code, message, requestId, details } | none |
| cmsTaxonomyVersionsRead | CMS-14 | GET /api/v1/cms/taxonomies/{taxonomyId}/versions           | TaxonomyVersionsQuery (path) → 200 TaxonomyVersionsPage      | `cms.taxonomy_curator` in the caller's owner scope; a hidden or absent vocabulary is 404; a caller without the capability is 403 | BE00 order; CORS cms-console; no CSRF or request body | read-only; no idempotency or If-Match; ETag on page version | 60/min/user, 60/min/party; 8,000ms; no-store; Tier 1 p95 <750ms | BE00 ApiError { code, message, requestId, details } | none |
| cmsTaxonomyTermsRead   | CMS-14 | GET /api/v1/cms/taxonomies/{taxonomyId}/terms              | TaxonomyTermListQuery → 200 TaxonomyTermListPage             | `cms.taxonomy_curator` in the caller's owner scope; a hidden or absent vocabulary is 404; a caller without the capability is 403 | BE00 order; CORS cms-console; no CSRF mutation; cursor/context binding | read-only; no idempotency or If-Match; signed keyset cursor over `(termKey ASC, termId ASC)`; default limit 25, max 50; ETag on page version | 120/min/user, 240/min/party; 8,000ms; no-store; Tier 1 p95 <750ms | BE00 ApiError { code, message, requestId, details } | none |
| CMS-03C-06             | CMS-11, CMS-12, CMS-14 | POST /api/v1/cms/governed-reviews                           | GovernedReviewSubmissionRequest → 201 GovernedReviewResource | subject owner capability in the subject's owner party (`cms.template_designer` for a template or pattern version, `cms.taxonomy_curator` for a taxonomy version); a hidden or absent subject is 404; a visible subject without the capability is 403 | BE00 order; CORS cms-console; CSRF; strict JSON; no step-up | key required; no If-Match (the exact subject version is named by id and hash); one live review per subject version via the partial unique; submit freezes the subject hash, policy basis and block digest | 30/min/user, 60/min/party; 15,000ms; no-store; Tier 2 | BE00 ApiError { code, message, requestId, details } | none |
| CMS-03C-07             | CMS-11, CMS-12, CMS-14 | POST /api/v1/cms/governed-reviews/{reviewId}/decision      | GovernedDecisionRequest → 200 GovernedReviewResource         | assigned reviewer: active `cms.definition_review` assignment plus a standing `cms.reviewer` grant (and the specialist capability for a specialist slot); a review the caller cannot read is 404; a readable review without an effective assignment or capability, or a separation-of-duties violation, is 403 | BE00 order; CORS cms-console; CSRF; step-up MFA (unconditional); strict JSON | key + If-Match (the review `version`); unique reviewer/review and review CAS; the first rejection ends the review | 30/min/user, 60/min/party; 15,000ms; no-store; Tier 2 | BE00 ApiError { code, message, requestId, details } | none |
| CMS-03C-08             | CMS-11, CMS-12, CMS-14 | POST /api/v1/cms/governed-reviews/{reviewId}/assignments   | GovernedReviewAssignmentRequest → 201/200 GovernedReviewAssignmentResource | existing owner holding `cms.definition_review.assign`, derived from the immutable owner initialization receipt and never grantable; concealed/cross-owner review is 404; capability denial is 403 | BE00 order; CORS cms-console; CSRF; step-up MFA (unconditional); strict JSON | key + exact review If-Match; create or revoke only read/decide on one frozen review; expires within seven days and no later than the reviewer grant and the grantor authority end | 10/min/user, 20/min/party; 15,000ms; no-store; Tier 2 | BE00 ApiError { code, message, requestId, details } | none |
| CMS-03C-09             | CMS-11, CMS-12, CMS-14 | POST /api/v1/cms/governed-reviews/{reviewId}/activation    | GovernedActivationRequest → 200 GovernedActivationResource (activate, retire) or 202 (scheduled) | subject owner capability as CMS-03C-06; hidden/absent review is 404; a visible review without the capability is 403 | BE00 order; CORS cms-console; CSRF; step-up MFA (unconditional); pinned-tzdb time authority for a scheduled activation; strict JSON | key + If-Match (the review `version`); atomic CAS switch of the subject and supersession of the previous active version of the lineage | 20/min/user, 40/min/party; 15,000ms; no-store; Tier 2 | BE00 ApiError { code, message, requestId, details } | cms.template.activated.v1, cms.pattern.activated.v1 or cms.taxonomy.changed.v1 only on a committed immediate activation, scheduled execution or retirement (schedule acceptance emits none) |
| CMS-03C-10             | CMS-11, CMS-12, CMS-14 | GET /api/v1/cms/governed-reviews/{reviewId}                | path UUID → 200 GovernedReviewDetailResource                 | submitter, reviewer assignee (non-revoked), subject owner-capability holder in the owner party, or the receipt-derived owner; hidden/absent/cross-owner review is 404; visible review without read scope is 403 | BE00 order; CORS cms-console; no CSRF mutation; no-store detail read | safe read; no Idempotency-Key or If-Match; strong ETag `"{review.version}"`, the review's CAS token (the `subjectState` and `activationSchedule` members can change without it); decision rows expose safe metadata only | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 1 p95 <750ms | BE00 ApiError { code, message, requestId, details } | none |
| CMS-03C-11             | CMS-11, CMS-12, CMS-14 | GET /api/v1/cms/governed-reviews                            | GovernedReviewQueueQuery → 200 GovernedReviewQueuePage       | verified human; `scope=assigned` lists only reviews the caller holds an assignment on, `scope=submitted` only the caller's submissions, `scope=owned` only reviews of subjects the caller's designer or curator capability covers | BE00 order; CORS cms-console; no CSRF mutation; cursor/context binding | safe read; no Idempotency-Key or If-Match; signed keyset cursor over `(updatedAt DESC, reviewId DESC)` bound to the complete query and acting scope; default limit 25, max 50; filter allowlist `scope`, `state`, `subjectKind` | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 1 p95 <750ms | BE00 ApiError { code, message, requestId, details } | none |
| CMS-03C-12             | CMS-12 | POST /api/v1/cms/patterns/versions                          | PatternVersionRequest → 201 PatternVersionResource           | `cms.template_designer` in scope; hidden owner/pattern is 404; readable pattern without capability is 403 | BE00 order; CORS cms-console; CSRF; strict JSON; block registry read | key + If-Match when editing a parent; per-owner unique (key, version) and CAS; server-computed blockRegistryDigest and graph validation | 30/min/user, 60/min/party; 15,000ms, target <2s; no-store; Tier 2 p95 <1,200ms | BE00 ApiError { code, message, requestId, details } | none (activation is CMS-03C-09) |
| CMS-03C-13             | CMS-12 | GET /api/v1/cms/patterns/selector                           | PatternSelectorQuery → 200 PatternSelectorPage               | verified human holding `cms.author` or `cms.editor` in the owner party; lists only `active` pattern versions of that owner compatible with the named content type | BE00 order; CORS cms-console; no CSRF mutation; no-store selector read | safe read; no Idempotency-Key or If-Match; signed keyset cursor over `(patternKey ASC, patternVersion DESC)`; default limit 25, max 50; ETag on page version | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 1 p95 <750ms | BE00 ApiError { code, message, requestId, details } | none |
| CMS-03C-14             | CMS-12 | GET /api/v1/cms/compositions/instances/{instanceId}/update-diff | path UUID → 200 CompositionUpdateDiffResource                | assigned author/editor on the instance's revision; hidden/absent instance is 404; visible instance without edit is 403 | BE00 order; CORS cms-console; no CSRF mutation; no-store bounded read | safe read; no Idempotency-Key or If-Match; strong ETag `"{instance.version}"`; bounded base/theirs node values (props, block identity and children), yours overrides, collision kinds and the target's new roots (DEC-193) | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 1 p95 <750ms | BE00 ApiError { code, message, requestId, details } | none |
| cmsCompositionInstancesRead | CMS-12 | GET /api/v1/cms/entries/{entryId}/compositions | path UUID + CompositionInstancesQuery → 200 CompositionInstancePage | as CMS-03C-02: an assigned CMS author or editor with edit authority on the entry's current draft revision; a hidden or absent entry is 404 and a visible entry without edit is 403 (DEC-206) | BE00 order; CORS cms-console; no CSRF or request body | read-only; no idempotency or If-Match; signed keyset cursor over `(slot ordinal, position, path, id)` bound as in the validation row (route, entry, draft revision, sort, user/acting context, ≤24 h; tamper, expiry or cross-context reuse 400); default limit 25, max 50; no entity tag | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 1 p95 <750ms | BE00 ApiError { code, message, requestId, details } | none |
| cmsPatternNestableRead | CMS-11 | GET /api/v1/cms/patterns/nestable | PatternNestableQuery → 200 PatternSelectorPage | verified human holding `cms.template_designer` in the owner party; lists only `active` pattern versions of that owner whose `compatibleTypeIds` contains every requested content type id (the DEC-181 nested-node rule), so each listed version can be a nested `pattern` node of a pattern compatible with those types (DEC-196) | BE00 order; CORS cms-console; no CSRF or request body | safe read; no Idempotency-Key or If-Match; signed keyset cursor over `(patternKey ASC, patternVersion DESC)` bound to the route, the requested type set, the sort and the caller's user/acting context (≤24 h; tamper, expiry or cross-context reuse 400); default limit 25, max 50; ETag on page version | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 1 p95 <750ms | BE00 ApiError { code, message, requestId, details } | none |
| CMS-03C-15             | CMS-12 | POST /api/v1/cms/compositions/pattern-updates                | CompositionUpdateRequest → 200 CompositionUpdateResource     | assigned author/editor on each instance's revision; hidden/absent instance is 404; visible instance without edit is 403 | BE00 order; CORS cms-console; CSRF; strict JSON; block registry read | key + If-Match (the entry aggregate `version`); each instance CAS on its own `version`; all-or-nothing for 1–32 instances per request (a placement of more rows takes successive requests, DEC-181) | 60/min/user, 120/min/party; 15,000ms; no-store; Tier 2 | BE00 ApiError { code, message, requestId, details } | none |
| CMS-03C-16             | CMS-14 | POST /api/v1/cms/taxonomies/versions                        | TaxonomyVersionRequest → 201 TaxonomyVersionResource         | `cms.taxonomy_curator` in scope; hidden owner/taxonomy is 404; readable taxonomy without capability is 403 | BE00 order; CORS cms-console; CSRF; strict JSON; canonical domain registry read | key + If-Match when editing a parent; per-owner unique (key, version) and CAS | 30/min/user, 60/min/party; 15,000ms; no-store; Tier 2 | BE00 ApiError { code, message, requestId, details } | none (activation is CMS-03C-09) |
| CMS-03C-17             | CMS-14 | GET /api/v1/cms/taxonomies/selector                         | TaxonomySelectorQuery → 200 TaxonomySelectorPage             | verified human holding `cms.author` or `cms.editor` in the owner party; lists only the `active` vocabularies of that owner whose allowlist names the requested content type key and field key | BE00 order; CORS cms-console; no CSRF mutation; no-store selector read | safe read; no Idempotency-Key or If-Match; signed keyset cursor over `(taxonomyKey ASC, termKey ASC)`; default limit 50, max 100; ETag on page version | 300/min/user, 600/min/party; 8,000ms; no-store; Tier 1 p95 <750ms | BE00 ApiError { code, message, requestId, details } | none |

### Internal service operations

CMS-03C-18 through CMS-03C-21 are not browser routes and are never listed in the BE00 browser route inventory. Each is a named database RPC or job reachable only by the registered non-browser principal named below; PUBLIC, anon, authenticated and every other role have execute revoked and the grant is named. Each has exactly one definition in this file.

| Operation ID | Caller | RPC | Request → result | Concurrency and failure |
| ------------ | ------ | --- | ---------------- | ----------------------- |
| CMS-03C-18 | `cms_act_taxonomy_term` for `create`, `rename` and `alias`, through `cms_term_overlap_check` (database-internal); the taxonomy-version activation preflight reads the domain registry's `provider_state` instead and never calls the matcher (DEC-227) | `platform_private.cms_canonical_taxonomy_match(p_domain text, p_candidates jsonb)` | `CanonicalTaxonomyMatchRequest` → `CanonicalTaxonomyMatchResult` (`Canonical taxonomy projection (D10, DEC-135)`) | read-only, bounded to 64 candidates and one domain per call; a provider fault or timeout (2,000 ms) is 503 `DEPENDENCY_UNAVAILABLE` with no editorial write |
| CMS-03C-19 | Worker `scheduled` sweep running BE00 job type `cms.governed_activation.execute` | `platform_private.cms_claim_due_governed_activations(batch)` then `platform_private.cms_execute_governed_activation(schedule_id, expected_version, lease_id)` | claim: `batch` 1–100 → `ClaimedGovernedActivation` records; execute → `GovernedActivationExecutionResult` | same claim, lease, retry ladder and idempotency as CMS-03B-20 (`Scheduled activation (OD-6)`) |
| CMS-03C-20 | publication preflight (`locale` category), Shard 04 delivery projection, editorial reads (including `cmsLocaleVariantRead`, DEC-205) | `platform_private.cms_resolve_locale_field(p_entry_id uuid, p_locale text, p_field_id uuid)` and the registered preflight provider `cms.locale.no_fallback_gate` | `LocaleFieldResolution` (`Locale field resolution (DEC-121, DEC-138)`) | read-only and deterministic; the gate evaluates every localizable field of the revision in one statement |
| CMS-03C-21 | Shard 04 delivery projection and the S11 related-content recheck | `platform_private.cms_related_content_public_targets(p_source_entry_id uuid, p_locale text, p_audience text)` | ordered `RelatedPublicTarget[]` (at most 128) | read-only; recomputed at every projection, preview and publication, never stored |

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
query is 400, a request that sends a body or media type is 415
`UNSUPPORTED_MEDIA_TYPE` (as for every 03c read), malformed provider projection is
502, and dependency/deadline failures are 503/504. The POST independently rechecks all authority and
compatibility; a context read never reserves permission for a later write.

- TemplateVersion, PatternVersion and TaxonomyVersion definition fields, including the definition `version`, are immutable from creation and stay immutable after activation. The definition `version` stays the immutable definition number used by every pin, uniqueness key, lookup, edit operand and `subjectVersion`; a separate internal `lifecycle_version` (positive bigint, default 1) advances by exactly one on every governed state transition and is never a definition or public-resource field (DEC-188). Lifecycle updates change only `state`, `lifecycle_version`, `activated_at`, `retired_at` and `updated_at`, through the guarded named RPCs; definition fields and pins never change. CompositionInstance updates create a new version/row, preserving prior revision evidence.
- BlockDefinitionVersion is consumed from 03a by immutable key/version, `propsSchemaRef`, `propsSchemaHash`, and compatibility/release digest. The normalized props snapshot is derived evidence whose signature must bind the ref/hash, block key/version, and `releaseDigest`; unknown, withdrawn, or incompatible blocks fail before mutation.
- Taxonomy terms retain stable IDs through rename/alias/merge; merged IDs resolve permanently to a survivor and cannot reactivate.
- Locale variants are source-hash aware; source changes mark dependent fields stale. Related-content exclusions always win and recommendations never grant access.
- All routes return BE00 ApiError { code, message, requestId, details } on failure. No route exposes hidden target existence, draft content, token material, private locale text, or reviewer authority.
- Browser/protected response envelopes contain no ownership identifiers or release-principal/signature evidence; authorization context stays server-side. Template, composition, taxonomy, locale, pattern, and related-content resources expose only their exact closed state/lifecycle enums.
- **Governed reviews (DEC-137).** CMS-03C-06 through CMS-03C-11 serve three subject kinds — `template_version`, `pattern_version` and `taxonomy_version` — through one set of private tables keyed by `(subject_kind, subject_id)`, so slot semantics, MFA, assignment, strictest-policy counting and invalidation have one implementation. The `subject_kind` registry is code-owned and is extended only by a forward migration (Slice 13 adds navigation, route and metadata subjects under DEC-115). The 03a `cms_schema_reviews` set and the 03b editorial review tables keep their own tables and operations.
- **If-Match operands.** CMS-03C-01, CMS-03C-12 and CMS-03C-16: the parent version's `version` when editing, `null` when creating a new lineage (the S09 `expectedVersion: null` form). CMS-03C-02: the entry aggregate `version`. CMS-03C-03: the active taxonomy version's `version`. CMS-03C-04 and CMS-03C-05: the entry aggregate `version`. CMS-03C-06 has no If-Match: it names the exact subject version by id and hash. CMS-03C-07, CMS-03C-08 and CMS-03C-09: the review `version` (never the subject's definition or lifecycle counter, DEC-188); assignment create and revoke do not advance it, a decision, an invalidation, an activation and a retirement do (a revoke of an assignment that authorized a counted approval invalidates the review in the same transaction, the 03b DEC-161 rule, and that invalidation advances it). CMS-03C-15: the entry aggregate `version`, plus each instance's own `version`. Where a body carries `expectedVersion`, the strong `If-Match` equals it exactly.
- **Recent MFA.** CMS-03C-07, CMS-03C-08 and CMS-03C-09 require recent binding-bound MFA unconditionally, with the 03b semantics (the DEC-111 window, 401 `STEP_UP_REQUIRED` before any idempotency reservation). CMS-03C-06 and the create, selector, diff and term commands require none.
- **Reserved keys (E13).** `templateKey` must not equal `context`, `versions` or `new` (the segments of `/api/v1/cms/templates/{templateKey}` that are fixed routes or pages: `GET /api/v1/cms/templates/context`, `POST /api/v1/cms/templates/versions`, `/app/cms-content-modeling/templates/new`), and `patternKey` must not equal `context`, `versions`, `selector` or `new`. The check is in the contracts schema and in a SQL CHECK; a reserved key is 422 `TEMPLATE_VALIDATION_FAILED` (or `COMPOSITION_VALIDATION_FAILED`) at `/templateKey` or `/patternKey` with `details.reasonCode` `key_reserved`.
- **Per-owner uniqueness (E14).** `UNIQUE (template_key, version)`, `UNIQUE (pattern_key, version)` and `UNIQUE (taxonomy_key, version)` become `UNIQUE (owner_id, <key>, version)` by forward migration. A key collision can therefore only be with the caller's own definitions, and a key held by another owner is indistinguishable from an unused key (the global constraint leaked cross-owner existence as a 409). Every lookup by key (the latest read, parents, selectors) is scoped to the caller's owner party.
- **Lineage ids.** `templateId`, `patternId` and `taxonomyId` are the stable lineage ids of (owner, key): the `id` of the version-1 row, carried on every successor row as `template_id`, `pattern_id` and `taxonomy_id`. A version number is unique within its lineage and a successor names its parent through `supersedes_id`.
- **Phase 2 scope (DEC-114).** CMS-03C-04 and CMS-03C-05 are Phase 2 runtime operations with human forms; no operation here is browser-deferred.
- **Exact impact set (IA03 AC-CMS-11, DEC-180 G8).** The "exact impact set" that IA03 returns with a versioned template candidate is the candidate's `compatibleTypeIds` plus the reachable block tuples behind its `blockRegistryDigest`, the same `content_type` and `block` identities that submission freezes as review dependencies. It adds no response field: `compatibleTypeIds` and `blockRegistryDigest` are already members of the resources, and a pattern's impact set is the same two parts over its expanded tree.

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
DB-internal (no API role may execute it) and every failure has zero side effects, so a success response
is the literal invariant `compatible: true` and `withdrawn: false` — the
resolver never returns a soft `compatible: false` success body. It returns only
the safe projection above (no owner IDs, binding manifests, slot internals, or
renderer refs) and echoes the exact candidate `contentTypeVersionId` it proved.
Its compatibility reflects 03c's immutable `compatible_type_ids` snapshot and
the draft-binding compatibility guard; it never grants public delivery or
activation authority. No API role may execute the `platform_api` name (P2-S09-AC-180: the Worker never calls it; the activation preflight calls the `platform_private` resolver as the function owner),
with no browser or authenticated table access, and it is the reciprocal dependency the 03a
activation preflight and the CMS-03C-01 create preflight both cite. No browser
route exposes the resolver: the browser receives only the safe projection, as the
optional `templateCompatibility` member of 03a's
`ContentSchemaRegistryDetail.activationPreparation`, and only for a compatible
result.

Consuming an immutable compatible template-version UUID is sufficient for the
AC169 reference. Public template activation is the reviewer-gated, atomic switch
specified by CMS-03C-06 through CMS-03C-09 (DEC-113); a draft binding is never
proof that public template activation works, and DEC-108 does not make public
activation an AC169 prerequisite.

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
before mutation or publication. A client digest that is not 64 lowercase hex is 422 at
`/blockRegistryDigest`; a well-formed digest that differs from the recomputed one
writes nothing and is 409 with the closed `details.reasonCode`
`block_registry_digest_mismatch` on CMS-03C-01 (`TEMPLATE_VERSION_CONFLICT`),
CMS-03C-02 and CMS-03C-12 (`COMPOSITION_VERSION_CONFLICT`) (DEC-186).
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
immutable and every activated/terminal row rejects definition updates; the
lifecycle columns of a version row (`state`, `lifecycle_version`,
`activated_at`, `retired_at`, `updated_at`) advance only through the governed
RPCs (CMS-03C-06 through CMS-03C-09), which is how `active` becomes
`superseded` or `retired`; this guarded lifecycle-metadata update is the sole
exception to the active-row definition-update prohibition: only `state`,
`lifecycle_version`, `activated_at`, `retired_at` and `updated_at` may change,
and the immutable definition `version` and every definition field and pin stay
unchanged (DEC-188). The Slice 12 tables add these explicit envelope
interpretations:
`cms_governed_reviews`, `cms_governed_review_assignments` and
`cms_governed_activation_schedules` are mutable CAS envelopes advanced only by
their named RPCs, while `cms_governed_review_decisions`,
`cms_governed_review_dependencies` and `cms_canonical_domain_registry` are
immutable (`updated_at = created_at`, no UPDATE or DELETE; the registry carries
the seeding release record as `owner_id` and state `seeded`). No other envelope
exception is permitted. Advisory presence renewal is not a 03c table and does
not weaken these rules.

### Route field validation matrix

| Operation             | Field                             | Exact constraint                                                                                                                                                                                        | Failure                       |
| --------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| CMS-03C-01            | templateKey/version               | key /^[a-z][a-z0-9-]{1,63}$/ and not a reserved key (`context`, `versions`, `new`; E13, `key_reserved`); version positive integer; the (owner, key, version) triple is never reused (E14); the first version of a key carries `expectedVersion: null`, a successor names its parent's `version` | 422/409                       |
| CMS-03C-01            | compatibleTypeIds                 | 1–64 UUIDs, each active/allowlisted ContentTypeVersion family                                                                                                                                           | 422                           |
| CMS-03C-01            | slots/reservedRegions             | strict JSON manifests; ≤64 slots, ≤32 reserved names; fixed Shard 02 Header→Now→Record→Detail/provenance regions immutable                                                                              | 422                           |
| CMS-03C-01            | allowedBlocks/blockRegistryDigest | every `blockKey` uses /^[a-z][a-z0-9._-]{0,95}$/; positive safe `blockVersion`; optional lowercase 64-hex digest is an equality expectation only (malformed: 422 at `/blockRegistryDigest`; well-formed but different from the recomputed digest: 409 `block_registry_digest_mismatch`; DEC-186); server resolves/recomputes the reachable tuple set    | 422/409                       |
| CMS-03C-01            | bindings/locale/audience          | strict binding manifest; BCP 47 locale; audience `^[a-z0-9_-]{1,48}$` (E4, the BE04c grammar, matched as submitted and never trimmed) | 422                           |
| CMS-03C-02            | revisionId/patternId              | UUIDs; `revisionId` is the entry's current draft revision (effective state `draft`, else 409 `revision_not_editable`) readable by the caller; `patternId` is a lineage id of the caller's owner scope; both are body members, so a malformed id is 422 at its pointer (DEC-227) | 422/404                       |
| CMS-03C-02            | patternVersion/linkMode           | positive version naming an `active` PatternVersion of that lineage whose `compatibleTypeIds` lists the revision's content type (else 422 `pattern_version_not_active` or `pattern_incompatible`); linked or detached only | 422                           |
| CMS-03C-02            | slotPath/overrides                | normalized `slotPath` 1–512 chars, and every row `path` a placement yields (the `slotPath` joined with `/` and the root's key chain, `Pattern versions and linked updates`) stays within 248 octets, else 422 at `/slotPath` (DEC-186); strict overrides max 64 keys/8 depth whose keys are normalized node paths under the inserted root (`/{nodeKey}(/{nodeKey})*`, each naming a node of the pinned pattern tree, with the reference's key leading the chain inside an expanded root; DEC-175, DEC-186) | 422                           |
| CMS-03C-02            | roots                             | optional; 1–512 unique normalized key chains (`ExpandedPatternNodePath`, the same slash-joined key grammar as a row `path`, 1–72 key segments and at most 4680 ASCII characters, DEC-193), each the key chain of a block root of the pinned forest after top-level nested pattern references are expanded (the chain its row `path` uses, DEC-181, DEC-186), else 422 at `/roots/{n}`; when present only the named roots are placed, in forest order, and an `overrides` key under no named root is 422 at `/overrides`; absent, every block root is placed (DEC-193) | 422                           |
| CMS-03C-02            | graph/blockRegistryDigest         | no cycles; max protected depth/nodes; every nested `blockKey` uses /^[a-z][a-z0-9._-]{0,95}$/ and is registered/compatible; optional digest is an equality expectation only and is recomputed by server (malformed: 422 at `/blockRegistryDigest`; well-formed but different: 409 `block_registry_digest_mismatch`; DEC-186) | 409/422                       |
| CMS-03C-03            | taxonomyId/action                 | UUID (the vocabulary lineage id `taxonomyId`); the vocabulary must have an `active` TaxonomyVersion (else 409 `taxonomy_not_active`); action create, rename, alias, deprecate, merge; `parentId` other than null requires shape `hierarchical` | 400/422                       |
| CMS-03C-03            | termKey/labels                    | stable key /^[a-z][a-z0-9-]{1,63}$/; 1–64 localized labels; NFC                                                                                                                                         | 422                           |
| CMS-03C-03            | survivorId/parentId               | UUID or null; required for merge/specified hierarchy; cannot be self/cyclic/merged                                                                                                                      | 422/409                       |
| CMS-03C-04            | entryId/locale/sourceRevisionId   | UUID, BCP 47, UUID; source revision must exist and be readable                                                                                                                                          | 400/404                       |
| CMS-03C-04            | fields/fallbackChain              | 1–128 field IDs/values; only localizable fields; ordered BCP 47 list ≤16 that must equal, element for element, the active content-type version's `fallbackChains` entry for `locale` (03a OD-4; `[]` when `locale` is that version's `defaultLocale`) — an equality expectation, never an authoring input; `locale` must be a member of its `supportedLocales`; explicit no_fallback                                                                                                          | 422                           |
| CMS-03C-04            | sourceHash/expectedVersion        | 64 lowercase hex; positive decimal version                                                                                                                                                              | 422/409                       |
| CMS-03C-05            | pins/exclusions                   | pin UUID array ≤32, exclusion UUID array ≤64, de-duplicated; exclusions win; every pin is an eligible target and every exclusion an existing readable entry (`Related-content eligibility (D11)`), and an ineligible, hidden or absent target is the one uniform 422 at `/pins/{n}` or `/exclusions/{n}` | 422                           |
| CMS-03C-05            | derivedRule                       | strict bounded rule or null; `key` a member of the code-owned rule registry (`shared-terms`, `same-type-recent`), `version` its registered version, `reasonCode` an equality expectation of the registry value, `maxCandidates` 1–128; no arbitrary query/expression | 422                           |
| CMS-03C-05            | expectedVersion                   | positive decimal strong If-Match match                                                                                                                                                                  | 400/409                       |
| cmsRelatedContentRead | entryId | UUID path; strict: no query key | 400/policy-safe 404 |
| CMS-03C-04            | locale fan-out and event key | at most 32 dependent locale variants per entry (D12): a request that would create a 33rd locale variant is 409 `LOCALE_VERSION_CONFLICT` `locale_limit_reached`; each variant and each source-change stale row carries its own aggregate version, so the `cms.localization.changed.v1` dedupe key `(cms_locale_variant, localeAggregateId, variantVersion)` is unique per locale (`Locale field resolution (DEC-121, DEC-138)`) | 409 |
| cmsLocaleVariantRead  | entryId/locale | UUID path; BCP 47 path; strict: no query key; `locale` must be a member of the active content-type version's `supportedLocales`, else the same policy-safe 404 as a hidden entry | 400/policy-safe 404 |
| CMS-03C-06            | subjectKind/subjectId/subjectHash | closed `subjectKind`; `subjectId` the exact version row id in the caller's owner scope; `subjectHash` 64 lowercase hex equal to the stored `content_hash` (422 at `/subjectHash`); the subject state is `draft` with no live review (else 409 `subject_not_submittable`); the caller holds the subject kind's owner capability | 400/404/409/422 |
| CMS-03C-07            | reviewId/decision/reason/expectedVersion | UUID path equal to the body `reviewId`; approve or reject; reason per the 03b `SafeText` grammar; `expectedVersion` the review `version` with the strong `If-Match` equal to it; `capability` and `stepUpAt` are unknown keys (422) | 400/401/403/404/409/422 |
| CMS-03C-08            | action/reviewerPersonId/expiresAt/assignmentId | the CMS-03B-18 grammar and bounds with `cms.definition_review.assign` and the owner's current designer or curator grant end as the grantor authority end | 400/403/404/409/422 |
| CMS-03C-09            | action/expectedVersion/activateAt/reason | discriminated `action`; `expectedVersion` the review `version`; `activate` requires an `approved` review, an unchanged subject hash and every dependency current; `schedule` additionally resolves `activateAt` through the 03b Time authority (E8); `retire` requires an `active` subject (else 409 `subject_not_retirable`) and accepts an optional reason 1–256 NFC characters | 400/401/403/404/409/422 |
| CMS-03C-10            | reviewId | UUID path; strict: no query key; decisions expose `reason` only to the decider and assignments only to the owner | 400/policy-safe 404 |
| CMS-03C-11            | scope/state/subjectKind/cursor/limit | `scope` assigned (default), submitted or owned; closed `state` and `subjectKind` optional; signed context-bound cursor ≤512 chars; limit 1–50 default 25; DEC-140 cursor fault classes | 400/409/422 |
| CMS-03C-12            | patternKey/compatibleTypeIds | key per the template grammar and not reserved (`context`, `versions`, `selector`, `nestable`, `new`; `nestable` since DEC-232, because `GET /api/v1/cms/patterns/nestable` shares the `/patterns/{patternKey}` path space); 1–64 unique UUIDs, each the id of an active content type of the caller's owner scope | 422/409 |
| CMS-03C-12            | blockTree | 1–32 root nodes; `block` nodes use the canonical BlockKey and a registered, non-withdrawn version; `pattern` nodes name an `active` PatternVersion of the same owner listing every `compatibleTypeIds` member (else 422 `nested_pattern_not_active`); sibling `key`s unique; depth ≤8; ≤512 nodes after expansion; no cycle through a nested lineage (409 `pattern_cycle`); a cycle, depth or node-count refusal names the offending request node's pointer `/blockTree/{i}(/children/{j})*` (DEC-228: depth, the first node in preorder at level 9; node count, the node whose expansion first takes the expanded total past 512; cycle, the nested `pattern` node whose lineage closes the cycle); props ≤64 keys and depth 8 | 422/409 |
| CMS-03C-12            | blockRegistryDigest               | optional lowercase 64-hex digest is an equality expectation only and is recomputed by the server: malformed 422 at `/blockRegistryDigest`; well-formed but different from the recomputed digest 409 `block_registry_digest_mismatch` (DEC-186) | 422/409 |
| CMS-03C-13            | contentTypeId/cursor/limit | UUID of a content type in the caller's owner scope; signed cursor ≤512 chars; limit 1–50 default 25; strict: no other key | 400/404 |
| CMS-03C-14            | instanceId | UUID path; strict: no query key; a diff over 128 changed paths or 256 KiB is 422 `diff_too_large`; a readable row that carries a positive provenance pattern pin and is not the linked `active` or `pending_diff` newest version of its path (a detached row, a detached copy, a `retired` row, an older version, or a historical linked `active`/`pending_diff` row that is no longer newest) answers the no-update diff, never a refusal, while a row with no pattern pin (a standalone block row) is refused, never answered with a fabricated pin (DEC-193) | 400/policy-safe 404/422 |
| cmsCompositionInstancesRead | entryId/cursor/limit | UUID path; optional signed `cursor` ≤512 characters per BE00 (authenticated, expires within 24 hours, bound to the route, entry, draft revision, sort and the caller's user/acting context; a tampered, expired or cross-context cursor is 400 without disclosing cursor internals); `limit` 1–50 default 25; strict: no other query key; an entry with no current draft revision answers an empty page | 400/policy-safe 404 |
| cmsPatternNestableRead | contentTypeId/cursor/limit | `contentTypeId` repeated 1–64 times, unique UUIDs, each a content type of the caller's owner scope (a hidden or absent one is the policy-safe 404); optional signed `cursor` ≤512 characters bound as in the Route Registry row (a tampered, expired or cross-context cursor is 400); `limit` 1–50 default 25 (more than 64 types or a limit outside 1–50 is 422 at its member); strict: no other query key; malformed members are 400 | 400/422/policy-safe 404 |
| CMS-03C-15            | action/instances/choices/targetPatternVersion | `accept` or `detach`; 1–32 unique instances per request (the bound is per request, not per placement: a placement of more rows takes successive requests, DEC-181), each with its own `expectedVersion`; `targetPatternVersion` must be the latest `active` compatible version above the pinned one (else 422 `pattern_version_not_active`); `choices` only for a single-instance request and covering every colliding path (a `props`, `structure` or `removed_root` collision, DEC-193) with `yours` or `theirs`; a bulk request containing a colliding instance is 409 `diff_has_collisions`; each instance is the newest version of its path and a linked `active` or `pending_diff` row (accept) or any linked pattern-origin row, including a `retired` one (detach), else 422 `COMPOSITION_VALIDATION_FAILED` at `/instances/{n}/instanceId` (DEC-193); the other typed refusals of this operation (`revision_not_editable` 409, `pattern_incompatible` and `nested_pattern_not_active` 422) carry the meanings of the Slice 12 typed refusals paragraph | 400/404/409/422 |
| CMS-03C-16            | taxonomyKey/shape/allowedTypeKeys/allowedFieldKeys | key `^[a-z][a-z0-9-]{1,63}$`; `flat` or `hierarchical`; 1–64 unique type keys and 1–64 unique field keys; the (owner, key, version) triple never reused | 422/409 |
| CMS-03C-16            | canonicalOverlapDomains | 0–6 unique members of `role`, `instrument`, `gear`, `place`, `rights`, `jurisdiction` (DEC-135); declaring a domain with no registered provider is accepted at create and refused at submission, at activation and at term action (`canonical_source_unavailable`) | 422 |
| CMS-03C-17            | typeKey/fieldKey/locale/cursor/limit | content type key and field key grammars; BCP 47 locale; signed cursor ≤512 chars; limit 1–100 default 50; strict: no other key | 400/422 |
| cmsTemplateLatestRead | templateKey | path key per the template grammar and not reserved; resolved only within the caller's owner scope; a hidden or absent key is the same 404 | 400/policy-safe 404 |
| cmsPatternLatestRead  | patternKey | path key per the pattern grammar and not reserved; resolved only within the caller's owner scope; a hidden or absent key is the same 404 | 400/policy-safe 404 |
| cmsTaxonomyVersionsRead | taxonomyId | UUID path (the vocabulary lineage id); strict: no query key; at most 50 versions, newest first | 400/policy-safe 404 |
| cmsTaxonomyTermsRead  | taxonomyId/lifecycle/cursor/limit | UUID path; optional `lifecycle` active, deprecated or merged; signed context-bound cursor ≤512 chars; limit 1–50 default 25; a response over 256 KiB is a 502 `DEPENDENCY_UNAVAILABLE` response-contract failure | 400/policy-safe 404/502 |
| All                   | headers/body                      | JSON, raw body ≤256 KiB, Idempotency-Key 8–128 printable ASCII, unknown keys reject                                                                                                                     | 400/415/422                   |
| All browser responses | state/ownership envelope          | ResourceMeta contains only id, version, contentHash where applicable, and timestamps; concrete resources use exact per-resource state/lifecycle enums; ownership and release evidence are absent        | 502 `DEPENDENCY_UNAVAILABLE` response-contract failure |

## Request/Response Contracts (Zod 4 schemas)

These strict Zod 4 schemas are normative for TypeScript, Hono, OpenAPI, tests, and JSONB validation. No uploaded markup, code, expression, arbitrary query, or target authority is accepted.

```ts
const Key = z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/);
const TemplateKey = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,63}$/)
  .refine((v) => !(ReservedTemplateKeys as readonly string[]).includes(v));
const PatternKey = z
  .string()
  .regex(/^[a-z][a-z0-9-]{1,63}$/)
  .refine((v) => !(ReservedPatternKeys as readonly string[]).includes(v));
const ContentTypeKey = z.string().regex(/^[a-z][a-z0-9_]{1,63}$/);
const BlockKey = z.string().regex(/^[a-z][a-z0-9._-]{0,95}$/);
const ArtifactRef = z
  .string()
  .regex(/^[a-z][a-z0-9._/-]{0,255}$/)
  .refine(
    (value) => !value.includes('..') && !value.includes('//'),
    'artifact reference cannot traverse or contain a URL',
  );
// E4: the BE04c audience grammar, matched as submitted and never trimmed.
const SafeAudience = z.string().regex(/^[a-z0-9_-]{1,48}$/);
// E13: keys that collide with fixed routes or pages are refused.
const ReservedTemplateKeys = ['context', 'versions', 'new'] as const;
const ReservedPatternKeys = ['context', 'versions', 'selector', 'nestable', 'new'] as const;
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
// DEC-175: a placement's `overrides` keys are normalized node paths under the
// inserted root, the grammar of PatternUpdateChoice.path, each naming a node of
// the pinned PatternVersion tree. Inside a block root reached through a nested
// pattern reference (DEC-181) the key chain begins with the reference's `key`,
// as the row `path` does (DEC-186). The bounds are those of BoundedPatternOverrides.
const PatternNodePath = z
  .string()
  .regex(/^\/[a-z][a-z0-9_-]{0,63}(\/[a-z][a-z0-9_-]{0,63})*$/)
  .max(512);
// DEC-193: the public address of a node in an expanded pattern forest. The same
// slash-joined key grammar as PatternNodePath, sized for a fully expanded
// forest: at most 72 key segments (nine nested pattern levels of eight keys) of
// 64 characters plus their separators, 4680 ASCII characters. It addresses the
// diff `path` and its `children`, a `choices` path, and a `newRoots` or `roots`
// key chain. The stored row `path`/`slotPath` and the 248-octet row-path cap are
// unchanged, and no address is encoded or shortened.
const ExpandedPatternNodePath = z
  .string()
  .regex(/^\/[a-z][a-z0-9_-]{0,63}(\/[a-z][a-z0-9_-]{0,63})*$/)
  .max(4680)
  .refine((value) => value.split('/').length - 1 <= 72, 'at most 72 key segments');
const PatternPlacementOverrides = z
  .record(PatternNodePath, Json)
  .refine((value) => Object.keys(value).length <= 64, 'overrides permits at most 64 keys')
  .refine((value) => jsonDepth(value) <= 8, 'overrides JSON depth must be at most 8');
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
  overrides: PatternPlacementOverrides,
  // DEC-193: when present, only these block roots of the pinned forest are
  // placed, each named by the key chain its row `path` uses after top-level
  // nested pattern references are expanded (DEC-181, DEC-186), for example the
  // `newRoots` of a linked-update diff; unique, each naming a block root (else
  // 422 at `/roots/{n}`), and every `overrides` key lies under one of them
  // (else 422 at `/overrides`). Absent: every block root is placed.
  roots: z
    .array(ExpandedPatternNodePath)
    .min(1)
    .max(512)
    .refine((value) => new Set(value).size === value.length, 'roots must be unique')
    .optional(),
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

// ---- Slice 12 requests (CMS-03C-06 .. CMS-03C-17) ----
const GovernedSubjectKind = z.enum([
  'template_version',
  'pattern_version',
  'taxonomy_version',
]);
const GovernedReviewState = z.enum([
  'open',
  'approved',
  'rejected',
  'invalidated',
]);
// DEC-137: one subject-polymorphic review set. `subjectId` is the exact
// version row id and `subjectHash` an equality expectation on its stored
// content hash; neither selects authority.
const GovernedReviewSubmissionRequest = z.strictObject({
  subjectKind: GovernedSubjectKind,
  subjectId: UUID,
  subjectHash: Hash,
});
// The 03b decision reason grammar (SafeText: 1-2000 code points, NFC, no
// control, line/paragraph-separator or bidirectional character, no `<>{}`).
const GovernedDecisionRequest = z.strictObject({
  reviewId: UUID,
  decision: z.enum(['approve', 'reject']),
  reason: SafeReason,
  expectedVersion: Version,
});
// Assignment and retirement reason (DEC-158): 1-256 Unicode characters (code
// points), already NFC (refused, never normalized); no other character rule.
const AssignmentReason = z
  .string()
  .min(1)
  .max(512)
  .refine((v) => [...v].length <= 256)
  .refine((v) => v === v.normalize('NFC'));
const GovernedReviewAssignmentRequest = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('create'),
    expectedVersion: Version,
    reviewerPersonId: UUID,
    expiresAt: z.string().datetime({ offset: true }),
    reason: AssignmentReason.optional(),
  }),
  z.strictObject({
    action: z.literal('revoke'),
    expectedVersion: Version,
    assignmentId: UUID,
    reason: AssignmentReason.optional(),
  }),
]);
// `activateAt` is the 03b ScheduledInstant (pinned tz database, DST rules and
// the 60 s to 366 d horizon, OD-6).
const GovernedActivationRequest = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('activate'), expectedVersion: Version }),
  z.strictObject({
    action: z.literal('schedule'),
    expectedVersion: Version,
    activateAt: ScheduledInstant,
  }),
  z.strictObject({
    action: z.literal('retire'),
    expectedVersion: Version,
    reason: AssignmentReason.optional(),
  }),
]);
const GovernedReviewQueueQuery = z.strictObject({
  cursor: z.string().max(512).nullable().optional(),
  limit: z.number().int().min(1).max(50).default(25),
  scope: z.enum(['assigned', 'submitted', 'owned']).default('assigned'),
  state: GovernedReviewState.optional(),
  subjectKind: GovernedSubjectKind.optional(),
});
// D9 / OD-2. A pattern tree is a bounded forest of registered blocks and
// nested pattern references.
type PatternNode =
  | {
      kind: 'block';
      key: string;
      blockKey: string;
      blockVersion: number;
      props: Record<string, unknown>;
      children: PatternNode[];
    }
  | { kind: 'pattern'; key: string; patternId: string; patternVersion: number };
const PatternNodeKey = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
const PatternNodeSchema: z.ZodType<PatternNode> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('block'),
      key: PatternNodeKey,
      blockKey: BlockKey,
      blockVersion: z.number().int().positive().max(2147483647),
      props: BoundedPatternOverrides,
      children: z.array(PatternNodeSchema).max(32),
    }),
    z.strictObject({
      kind: z.literal('pattern'),
      key: PatternNodeKey,
      patternId: UUID,
      patternVersion: z.number().int().positive().max(2147483647),
    }),
  ]),
);
// Also refined: sibling node keys unique; depth at most 8 and at most 512
// nodes after expanding nested pattern references; no cycle through a
// nested pattern lineage; every nested pattern is `active` and lists every
// `compatibleTypeIds` member of this pattern.
const PatternVersionRequest = z.strictObject({
  patternKey: PatternKey,
  compatibleTypeIds: z.array(UUID).min(1).max(64),
  blockTree: z.array(PatternNodeSchema).min(1).max(32),
  blockRegistryDigest: Hash.optional(),
  expectedVersion: Version.nullable(),
});
const PatternSelectorQuery = z.strictObject({
  contentTypeId: UUID,
  cursor: z.string().max(512).nullable().optional(),
  limit: z.number().int().min(1).max(50).default(25),
});
const PatternUpdateChoice = z.strictObject({
  // Normalized node path (`/{nodeKey}(/{nodeKey})*`) in the expanded forest
  // (ExpandedPatternNodePath, DEC-193).
  // B is the pinned expanded tree, L is B with the instance's local overrides
  // and T is the target tree. `theirs` selects the T node; `yours` selects the
  // L node's presence, block identity and ordered children and its effective
  // props, so a `structure` or `removed_root` collision answered `yours` keeps
  // the author's structure (a detached local copy), a `structure` collision
  // answered `theirs` adopts the T node and retains a local override only where
  // T left B's `props` unchanged, a `props` choice selects the L or T props, an
  // unchanged target path retains L and a changed non-collision path adopts T
  // (DEC-193).
  path: ExpandedPatternNodePath,
  choice: z.enum(['yours', 'theirs']),
});
const PatternUpdateTarget = z.strictObject({
  instanceId: UUID,
  expectedVersion: Version,
  choices: z.array(PatternUpdateChoice).max(128).default([]),
});
// Bulk acceptance (up to 32 instances) is all-or-nothing and admitted only
// when no listed instance has a colliding path; `choices` is allowed only
// for a single-instance request. The 32 is a bound per request: a placement
// can hold up to 512 rows (DEC-181) and no request spans a placement.
const CompositionUpdateRequest = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('accept'),
    targetPatternVersion: z.number().int().positive().max(2147483647),
    instances: z.array(PatternUpdateTarget).min(1).max(32),
    expectedVersion: Version,
  }),
  z.strictObject({
    action: z.literal('detach'),
    instances: z.array(PatternUpdateTarget).min(1).max(32),
    expectedVersion: Version,
  }),
]);
// D10 / OD-1 / DEC-135.
const CanonicalDomain = z.enum([
  'role',
  'instrument',
  'gear',
  'place',
  'rights',
  'jurisdiction',
]);
const TaxonomyVersionRequest = z
  .strictObject({
    taxonomyKey: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
    shape: z.enum(['flat', 'hierarchical']),
    allowedTypeKeys: z.array(ContentTypeKey).min(1).max(64),
    allowedFieldKeys: z.array(ContentTypeKey).min(1).max(64),
    // DEC-135: only the declared domains are checked; a declared domain with
    // no registered provider blocks activation and term actions.
    canonicalOverlapDomains: z.array(CanonicalDomain).max(6),
    expectedVersion: Version.nullable(),
  })
  .superRefine((value, ctx) => {
    for (const key of ['allowedTypeKeys', 'allowedFieldKeys'] as const) {
      if (new Set(value[key]).size !== value[key].length) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'keys must be unique',
        });
      }
    }
    if (
      new Set(value.canonicalOverlapDomains).size !==
      value.canonicalOverlapDomains.length
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['canonicalOverlapDomains'],
        message: 'domains must be unique',
      });
    }
  });
const TaxonomySelectorQuery = z.strictObject({
  typeKey: ContentTypeKey,
  fieldKey: ContentTypeKey,
  locale: Bcp47,
  cursor: z.string().max(512).nullable().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});
const CanonicalTaxonomyMatchRequest = z.strictObject({
  domain: CanonicalDomain,
  // NFC candidate labels, aliases and keys; matching is exact over the
  // normalized form (NFKC, lowercase, trim, whitespace collapse).
  candidates: z.array(z.string().min(1).max(160)).min(1).max(64),
});
// Supporting reads for the designer and curator forms.
const PatternLatestQuery = z.strictObject({ patternKey: PatternKey });
const TaxonomyVersionsQuery = z.strictObject({ taxonomyId: UUID });
const TaxonomyTermListQuery = z.strictObject({
  taxonomyId: UUID,
  lifecycle: z.enum(['active', 'deprecated', 'merged']).optional(),
  cursor: z.string().max(512).nullable().optional(),
  limit: z.number().int().min(1).max(50).default(25),
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
  templateId: UUID,
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
  // DEC-175: for a pattern placement, the block identity of the block root this
  // row places (a top-level nested pattern reference is first expanded into
  // that pattern's own block roots, DEC-181); its `path` is the placement's
  // `slotPath` joined with `/` and that root's key chain, at most 248 octets
  // (DEC-186).
  blockKey: BlockKey,
  blockVersion: z.number().int().positive(),
  patternId: UUID.nullable(),
  patternVersion: z.number().int().positive().nullable(),
  blockRegistryDigest: Hash,
  // DEC-193: a row that carries a detached local block tree (written by
  // `detach`, or by an accept that kept `yours` on a `structure` or
  // `removed_root` collision) is `detached`, its block identity is the tree
  // root's and its `patternId`/`patternVersion` are the provenance of the row
  // it follows, never read to render it.
  linkMode: z.enum(['linked', 'detached']),
  conflictState: z.enum(['none', 'pending_diff']).nullable(),
  // DEC-185, DEC-187: the row's authored order within its slot, read-only and
  // immutable per path; clients order a slot by it.
  position: z.number().int().nonnegative().max(2147483647),
});
// DEC-175, DEC-181: a placement writes one CompositionInstance row per block
// root of the pinned PatternVersion forest after top-level nested pattern
// references are expanded into that pattern's own block roots, so the 201 is a
// list of one or more rows, at most 512 (the node cap after expansion), as
// CompositionUpdateResource is a list for CMS-03C-15. The list is in `position`
// order, the forest order of the block roots (DEC-185). With `roots` (DEC-193)
// it holds the named roots only, and a row placed on a path whose newest row is
// `retired` keeps that path's position instead of taking the next one.
const PatternPlacementResource = z.strictObject({
  items: z.array(CompositionInstanceResource).min(1).max(512),
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
  // Fields whose source value changed since this variant was written
  // (DEC-121); empty unless state is `stale`.
  staleFieldIds: z.array(UUID).max(128),
});
const PatternVersionResource = ResourceMeta.extend({
  state: PatternVersionState,
  patternId: UUID,
  patternKey: PatternKey,
  patternVersion: z.number().int().positive(),
  compatibleTypeIds: z.array(UUID).min(1).max(64),
  nodeCount: z.number().int().min(1).max(512),
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
// DEC-195: `cmsRelatedContentRead` answers the source entry's current active rule, or null when none is active.
const RelatedContentRuleRead = z.strictObject({ rule: RelatedContentResource.nullable() });

// ---- Slice 12 resources (CMS-03C-06 .. CMS-03C-21) ----
const TaxonomyVersionState = PatternVersionState;
const TaxonomyVersionResource = ResourceMeta.extend({
  state: TaxonomyVersionState,
  taxonomyId: UUID,
  taxonomyKey: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
  taxonomyVersion: z.number().int().positive(),
  shape: z.enum(['flat', 'hierarchical']),
  allowedTypeKeys: z.array(ContentTypeKey).min(1).max(64),
  allowedFieldKeys: z.array(ContentTypeKey).min(1).max(64),
  canonicalOverlapDomains: z.array(CanonicalDomain).max(6),
});
// D7: the implemented protected latest read (`cmsTemplateLatestRead`).
const TemplateLatestQuery = z.strictObject({ templateKey: TemplateKey });
const TemplateVersionDetail = TemplateVersionResource.extend({
  slots: TemplateVersionRequest.shape.slots,
  bindings: TemplateVersionRequest.shape.bindings,
  locale: Bcp47,
  audience: SafeAudience,
});
const GovernedInvalidatedReason = z.enum([
  'dependency_changed',
  'reviewer_authority_changed',
]);
const GovernedReviewBase = ResourceMeta.extend({
  state: GovernedReviewState,
  subjectKind: GovernedSubjectKind,
  subjectId: UUID,
  // The lineage id: templateId, patternId or taxonomyId.
  lineageId: UUID,
  subjectKey: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
  subjectVersion: z.number().int().positive(),
  subjectHash: Hash,
  riskClass: z.enum(['ordinary', 'protected']),
  requiredDecisionCount: z.number().int().min(1).max(8),
  recordedDecisionCount: z.number().int().min(0).max(8),
  requiredCapabilities: z.array(CapabilityKey).min(1).max(16),
  // JCS SHA-256 of the sorted policy basis (`Governed policy basis`).
  policyBasisHash: Hash,
  submittedAt: z.string().datetime({ offset: true }),
  // Non-null exactly for approved and rejected reviews.
  decidedAt: z.string().datetime({ offset: true }).nullable(),
  // Non-null once an activation, schedule or retirement committed.
  activatedAt: z.string().datetime({ offset: true }).nullable(),
  invalidatedReason: GovernedInvalidatedReason.nullable(),
});
// contentHash is the JCS SHA-256 of
// { subjectKind, subjectId, subjectHash, policyBasisHash,
//   requiredDecisionCount, requiredCapabilities }.
const GovernedReviewResource = GovernedReviewBase;
const GovernedNextAction = z.enum([
  'record_decision',
  'assign_reviewer',
  'revoke_assignment',
  'activate',
  'schedule',
  'retire',
]);
const GovernedDecisionSummary = z.strictObject({
  id: UUID,
  decision: z.enum(['approve', 'reject']),
  capability: CapabilityKey,
  decidedAt: z.string().datetime({ offset: true }),
  mine: z.boolean(),
  // Non-null only on the caller's own decision.
  reason: SafeReason.nullable(),
});
const GovernedAssignmentSummary = z.strictObject({
  assignmentId: UUID,
  version: Version,
  state: z.enum(['active', 'revoked']),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  // Server-built display label, never an identifier.
  reviewerLabel: z.string().min(1).max(120),
});
const GovernedReviewDetailResource = GovernedReviewBase.extend({
  blockRegistryDigest: Hash.nullable(),
  // One summary per bound content type, sorted by label then policy key.
  policyBasis: z
    .array(
      z.strictObject({
        contentTypeLabel: z.string().min(1).max(120),
        policyKey: z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/),
        policyVersion: Version,
      }),
    )
    .max(64),
  distinctApprovalCount: z.number().int().min(0).max(8),
  decisions: z.array(GovernedDecisionSummary).max(8),
  // Owner-only; every other reader receives [].
  assignments: z.array(GovernedAssignmentSummary).max(32).default([]),
  myAssignment: z
    .strictObject({
      assignmentId: UUID,
      endsAt: z.string().datetime({ offset: true }),
    })
    .nullable(),
  subjectState: TemplateVersionState,
  permittedNextActions: z.array(GovernedNextAction).max(6),
  // DEC-191: the most recent GovernedActivationSchedule of this review (a live pending, executing or
  // failed_retryable row first, else the newest by creation), or null when it has none;
  // reasonCode is non-null exactly when state is blocked or cancelled (the table CHECK).
  activationSchedule: z
    .strictObject({
      state: z.enum(['pending', 'executing', 'completed', 'failed_retryable', 'blocked', 'cancelled']),
      reasonCode: z
        .enum([
          'approval_invalidated',
          'dependency_changed',
          'activation_authority_ended',
          'canonical_source_unavailable',
          'retries_exhausted',
        ])
        .nullable(),
    })
    .nullable(),
});
const GovernedReviewQueueItem = z.strictObject({
  reviewId: UUID,
  subjectKind: GovernedSubjectKind,
  subjectKey: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
  subjectVersion: z.number().int().positive(),
  state: GovernedReviewState,
  riskClass: z.enum(['ordinary', 'protected']),
  requiredDecisionCount: z.number().int().min(1).max(8),
  recordedDecisionCount: z.number().int().min(0).max(8),
  myDecision: z.enum(['none', 'approve', 'reject']),
  assignmentEndsAt: z.string().datetime({ offset: true }).nullable(),
  submittedAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
const GovernedReviewQueuePage = z.strictObject({
  items: z.array(GovernedReviewQueueItem).max(50),
  nextCursor: z.string().max(512).nullable(),
  pageVersion: Version,
});
const GovernedReviewAssignmentResource = ResourceMeta.extend({
  reviewId: UUID,
  state: z.enum(['active', 'revoked']),
  capability: z.literal('cms.definition_review'),
  actions: z.tuple([z.literal('read'), z.literal('decide')]),
  startsAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  reason: z.string().min(1).max(256).nullable(),
});
const GovernedActivationResource = z.strictObject({
  reviewId: UUID,
  reviewVersion: Version,
  subjectKind: GovernedSubjectKind,
  subjectId: UUID,
  lineageId: UUID,
  subjectVersion: z.number().int().positive(),
  // DEC-191: the definition version of the lineage's previously active version that this committed
  // immediate activation superseded; null for schedule, retire and a lineage's first activation.
  supersededVersion: z.number().int().positive().nullable(),
  action: z.enum(['activate', 'schedule', 'retire']),
  subjectState: z.enum(['active', 'scheduled', 'retired']),
  activatedAt: z.string().datetime({ offset: true }).nullable(),
  scheduledForUtc: z.string().datetime({ offset: true }).nullable(),
  // Set on a committed immediate activation or retirement.
  eventType: z
    .enum([
      'cms.template.activated.v1',
      'cms.pattern.activated.v1',
      'cms.taxonomy.changed.v1',
    ])
    .nullable(),
});
const PatternSelectorItem = z.strictObject({
  patternId: UUID,
  patternVersionId: UUID,
  patternKey: PatternKey,
  patternVersion: z.number().int().positive(),
  nodeCount: z.number().int().min(1).max(512),
  blockRegistryDigest: Hash,
});
const PatternSelectorPage = z.strictObject({
  items: z.array(PatternSelectorItem).max(50),
  nextCursor: z.string().max(512).nullable(),
  pageVersion: Version,
});
// DEC-196: `cmsPatternNestableRead` answers the same PatternSelectorPage for the designer's nested-pattern picker:
// `active` versions of the owner scope whose `compatibleTypeIds` contains EVERY requested content type id.
const PatternNestableQuery = z.strictObject({
  contentTypeId: z.array(UUID).min(1).max(64),
  cursor: z.string().max(512).nullable().optional(),
  limit: z.number().int().min(1).max(50).default(25),
});
// DEC-206: `cmsCompositionInstancesRead` lists the current draft revision's composition instances, the
// newest row of each path in state `draft`, `active` or `pending_diff` (superseded and retired rows are
// excluded), in render-plan order: slot ordinal, `position`, `path` (bytewise) and `id` (DEC-185).
const CompositionInstancesQuery = z.strictObject({
  cursor: z.string().max(512).nullable().optional(),
  limit: z.number().int().min(1).max(50).default(25),
});
const CompositionInstancePage = z.strictObject({
  revisionId: UUID.nullable(),
  items: z.array(CompositionInstanceResource).max(50),
  nextCursor: z.string().max(512).nullable(),
});
// DEC-193: the value of a node path for diff purposes, the node's `props` (an
// override replaces them whole) plus its structure: its block identity and its
// `children`, the node paths of its child block nodes in order (a nested
// pattern reference below the node contributes, in place, the block roots it
// expands to, its key leading their chains, DEC-186).
const CompositionDiffNodeValue = z.strictObject({
  blockKey: BlockKey,
  blockVersion: z.number().int().positive().max(2147483647),
  props: BoundedPatternOverrides,
  children: z.array(ExpandedPatternNodePath).max(512),
});
const CompositionUpdateDiffPath = z.strictObject({
  path: ExpandedPatternNodePath,
  // The pinned value (null for a node new in the target version), the target
  // value (null for a node the target removed) and the local override, which
  // replaces the node's `props` (null when absent); each bounded and
  // schema-typed.
  base: CompositionDiffNodeValue.nullable(),
  theirs: CompositionDiffNodeValue.nullable(),
  yours: Json.nullable(),
  collision: z.boolean(),
  // DEC-193: exactly one kind per colliding path, null exactly when
  // `collision` is false: `removed_root` (the target removed this instance's
  // block root), `structure` (the target changed the node's block identity or
  // `children`; a collision with or without an override) or `props` (the
  // override differs from the base `props` and the target changed them).
  collisionKind: z.enum(['removed_root', 'structure', 'props']).nullable(),
});
// DEC-193: a block root of the target forest, after top-level nested pattern
// references are expanded (DEC-181), whose key chain the pinned forest lacks;
// accept never creates a row for it, the author places it through CMS-03C-02
// with `roots`.
const CompositionUpdateNewRoot = z.strictObject({
  rootPath: ExpandedPatternNodePath,
  blockKey: BlockKey,
  blockVersion: z.number().int().positive().max(2147483647),
});
// `paths` is bounded to 128 entries and the whole resource to 256 KiB; an
// instance with more changed paths or a resource over 256 KiB is refused 422
// `COMPOSITION_VALIDATION_FAILED` `diff_too_large`. An instance with no newer
// `active` compatible version, and every readable row that carries a positive
// provenance pattern pin and is not the linked `active` or `pending_diff`
// newest version of its path (including a historical linked `active` or
// `pending_diff` row that is no longer newest), answers
// `paths: []`, `newRoots: []`, `collisionCount` 0, `bulkEligible` false and
// `targetPatternVersion` equal to `pinnedPatternVersion`; a row with no
// pattern pin (a standalone block row) is refused, never answered with a
// fabricated pin. Otherwise `bulkEligible` is true exactly when
// `collisionCount` is 0, including a target that changes none of the
// instance's paths (DEC-193).
const CompositionUpdateDiffResource = z.strictObject({
  instance: z.strictObject({
    id: UUID,
    version: Version,
    revisionId: UUID,
    path: z.string().max(512),
    state: CompositionInstanceState,
    linkMode: z.enum(['linked', 'detached']),
    pinnedPatternVersion: z.number().int().positive(),
  }),
  // DEC-193: the `slotPath` of the instance's placement (its `path` less its
  // block root's key chain), the slot where CMS-03C-02 `roots` places
  // `newRoots`.
  slotPath: z
    .string()
    .min(1)
    .max(512)
    .regex(/^\/[^\u0000-\u001f]*$/),
  targetPatternVersion: z.number().int().positive(),
  paths: z.array(CompositionUpdateDiffPath).max(128),
  newRoots: z.array(CompositionUpdateNewRoot).max(512),
  collisionCount: z.number().int().min(0).max(128),
  bulkEligible: z.boolean(),
});
// One appended row per listed instance (DEC-193): `active` and linked, pinned
// to the target; `retired`, for a removed root answered `theirs`; or `active`
// and detached, carrying the detached local block tree, for `detach` and for a
// `structure` or `removed_root` collision answered `yours`.
const CompositionUpdateResource = z.strictObject({
  items: z.array(CompositionInstanceResource).min(1).max(32),
});
const TaxonomySelectorTerm = z.strictObject({
  taxonomyId: UUID,
  taxonomyVersionId: UUID,
  taxonomyKey: z.string().regex(/^[a-z][a-z0-9-]{1,63}$/),
  shape: z.enum(['flat', 'hierarchical']),
  termId: UUID,
  termKey: Key,
  parentId: UUID.nullable(),
  // The label for the requested locale; null when the term has none.
  label: z.string().min(1).max(160).nullable(),
});
const TaxonomySelectorPage = z.strictObject({
  items: z.array(TaxonomySelectorTerm).max(100),
  nextCursor: z.string().max(512).nullable(),
  pageVersion: Version,
});
// `cmsPatternLatestRead`: the owner's latest version of the key in any state.
const PatternVersionDetail = PatternVersionResource.extend({
  blockTree: z.array(PatternNodeSchema).min(1).max(32),
});
const TaxonomyVersionsPage = z.strictObject({
  items: z.array(TaxonomyVersionResource).max(50),
  pageVersion: Version,
});
const TaxonomyTermListItem = z.strictObject({
  termId: UUID,
  termKey: Key,
  lifecycle: TaxonomyTermLifecycle,
  version: Version,
  parentId: UUID.nullable(),
  successorId: UUID.nullable(),
  labels: z
    .array(z.strictObject({ locale: Bcp47, label: z.string().min(1).max(160) }))
    .max(64),
  aliases: z.array(z.string().min(1).max(160)).max(64),
});
const TaxonomyTermListPage = z.strictObject({
  items: z.array(TaxonomyTermListItem).max(50),
  nextCursor: z.string().max(512).nullable(),
  pageVersion: Version,
});
const CanonicalTaxonomyMatchResult = z.discriminatedUnion('outcome', [
  z.strictObject({ outcome: z.literal('no_match') }),
  z.strictObject({
    outcome: z.literal('match'),
    domain: CanonicalDomain,
    canonicalId: UUID,
    canonicalKind: z.string().regex(/^[a-z][a-z0-9._-]{0,95}$/),
  }),
  z.strictObject({
    outcome: z.literal('source_unavailable'),
    domain: CanonicalDomain,
  }),
]);
const ClaimedGovernedActivation = z.strictObject({
  scheduleId: UUID,
  reviewId: UUID,
  subjectKind: GovernedSubjectKind,
  subjectId: UUID,
  scheduleVersion: Version,
  // The approved review version stored at acceptance.
  expectedVersion: Version,
  leaseId: UUID,
  correlationId: UUID,
});
const GovernedActivationExecutionResult = z.strictObject({
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
  actualUtc: z.string().datetime({ offset: true }).nullable(),
  deviationSeconds: z.number().int().nullable(),
});
// CMS-03C-20.
const LocaleFieldResolution = z.strictObject({
  fieldId: UUID,
  locale: Bcp47,
  mode: z.enum(['none', 'localized', 'no_fallback']),
  outcome: z.enum(['resolved', 'missing']),
  provenance: z.enum(['authored', 'localized_fallback', 'missing']),
  resolvedFromLocale: Bcp47.nullable(),
  stale: z.boolean(),
  blocking: z.boolean(),
  reasonCode: z.enum(['no_fallback_missing', 'no_fallback_stale']).nullable(),
});
// DEC-205: `cmsLocaleVariantRead` answers the entry's current locale variant for `locale` (null when none
// exists, shown as `untranslated`), that variant's stored localizable field values, the CMS-03C-20
// resolution of every localizable field of the active schema version, and the active fallback order.
const LocaleVariantRead = z.strictObject({
  locale: Bcp47,
  activeFallbackChain: z.array(Bcp47).max(16),
  variant: LocaleVariantResource.nullable(),
  fields: z.array(z.strictObject({ fieldId: UUID, value: Json })).max(128),
  resolutions: z.array(LocaleFieldResolution).max(128),
});
// CMS-03C-21.
const RelatedPublicTarget = z.strictObject({
  entryId: UUID,
  source: z.enum(['pin', 'derived']),
  reasonCode: z
    .string()
    .regex(/^[a-z][a-z0-9._-]{0,63}$/)
    .nullable(),
  position: z.number().int().min(0).max(127),
});
```

### Contract and error matrix

| Operation ID | 400                       | 401             | 403                      | 404                            | 409                                                      | 415      | 422                                      | 429                  | 502/503/504                     | 500               |
| ------------ | ------------------------- | --------------- | ------------------------ | ------------------------------ | -------------------------------------------------------- | -------- | ---------------------------------------- | -------------------- | ------------------------------- | ----------------- |
| CMS-03C-01   | malformed IDs/header/body | missing session | designer denied          | hidden/absent template scope   | stale parent/key/version/block compatibility, block_registry_digest_mismatch | non-JSON | slot/binding/reserved-region schema      | template-write limit | registry/RPC deadline           | scrubbed internal |
| CMS-03C-02   | malformed IDs/header/body | missing session | assignment/edit denied   | hidden/absent revision/pattern | stale revision, revision_not_editable, cycle, slot collision, block_registry_digest_mismatch, idempotency | non-JSON | graph/props schema, row path over 248 octets, `roots` naming no block root or an override under no named root (DEC-193), pattern_version_not_active, pattern_incompatible, nested_pattern_not_active | composition limit    | registry/RPC deadline           | scrubbed internal |
| CMS-03C-03   | malformed IDs/header/body | missing session | curator denied           | hidden/absent taxonomy/term    | stale taxonomy, duplicate key, merge race, idempotency   | non-JSON | key/label/parent/action schema           | taxonomy limit       | canonical registry/RPC deadline | scrubbed internal |
| CMS-03C-04   | malformed IDs/header/body | missing session | locale assignment denied | hidden/absent entry/source     | stale source/hash/version, duplicate locale, idempotency | non-JSON | BCP 47/field/fallback/no_fallback schema | locale limit         | schema/RPC deadline             | scrubbed internal |
| CMS-03C-05   | malformed IDs/header/body | missing session | source edit denied       | hidden/absent source           | stale version, duplicate pin, idempotency                | non-JSON | pin/exclusion/rule schema; hidden, absent or ineligible target (`related_target_ineligible`) | relationship limit   | target projection/RPC deadline  | scrubbed internal |
| cmsRelatedContentRead | malformed path/query | missing session | source edit denied | hidden/absent source | not applicable to bounded read | unsupported media if sent | not applicable | read limit | read dependency/deadline, response-contract failure | scrubbed internal |
| cmsLocaleVariantRead | malformed path/query | missing session | entry edit denied | hidden/absent entry or unsupported locale | not applicable to bounded read | unsupported media if sent | not applicable | read limit | read dependency/deadline, response-contract failure | scrubbed internal |
| CMS-03C-06   | malformed IDs/header/body | missing session | subject capability, separation_of_duties | hidden/absent subject | subject_not_submittable, idempotency | non-JSON | subject hash/kind failure, canonical_source_unavailable (taxonomy version) | governed-review limit | preflight/RPC deadline | scrubbed internal |
| CMS-03C-07   | malformed ID/header/body | missing session or step-up MFA | assignment/capability_missing/separation_of_duties | hidden/absent review | stale review, review_not_open, duplicate_decision, specialist_slot_unsatisfiable, dependency_changed (committed invalidation), idempotency | non-JSON | decision/reason failure (unknown key) | decision limit | RPC deadline | scrubbed internal |
| CMS-03C-08   | malformed ID/header/body | missing session or step-up MFA | owner capability, capability_missing | hidden/absent/cross-owner review | stale review, reviewer_not_eligible, assignment_exists, assignment_limit, review_not_open, idempotency | non-JSON | assignment contract, expiry_out_of_bounds | assignment limit | RPC deadline | scrubbed internal |
| CMS-03C-09   | malformed ID/header/body | missing session or step-up MFA | subject capability | hidden/absent review | stale review version, subject_not_activatable, subject_not_retirable, dependency_changed, activation_conflict, schedule_exists, idempotency | non-JSON | time/tzdb/horizon failure, canonical_source_unavailable (a template or pattern preflight difference is the step (4) `dependency_changed`, DEC-227) | activation limit | preflight/RPC deadline | scrubbed internal |
| CMS-03C-10   | malformed path/query | missing session | review read scope | hidden/absent/cross-owner review | not applicable to bounded read | unsupported media if sent | not applicable | read limit | read dependency/deadline, response-contract failure (response bounds) | scrubbed internal |
| CMS-03C-11   | malformed query/cursor | missing session | not applicable to a scoped list | not applicable to a scoped list | cursor/context mismatch | unsupported media if sent | query bounds | read limit | read dependency/deadline | scrubbed internal |
| CMS-03C-12   | malformed IDs/header/body | missing session | designer denied | hidden/absent pattern scope | stale parent/key/version, cycle, block_registry_digest_mismatch, idempotency | non-JSON | tree/props/graph bounds, nested pattern not active or incompatible | pattern-write limit | registry/RPC deadline | scrubbed internal |
| CMS-03C-13   | malformed query/cursor | missing session | author/editor scope | hidden/absent content type | cursor/context mismatch | unsupported media if sent | query bounds | read limit | read dependency/deadline | scrubbed internal |
| CMS-03C-14   | malformed path/query | missing session | edit denied | hidden/absent instance | not applicable to bounded read | unsupported media if sent | diff_too_large | read limit | read dependency/deadline | scrubbed internal |
| cmsCompositionInstancesRead | malformed path/query/cursor | missing session | edit denied | hidden/absent entry | not applicable to bounded read | unsupported media if sent | not applicable | read limit | read dependency/deadline, response-contract failure | scrubbed internal |
| cmsPatternNestableRead | malformed query; tampered, expired or cross-context cursor | missing session | designer scope | hidden/absent content type | not applicable to a keyset read (cursor faults are 400) | unsupported media if sent | query bounds (more than 64 types, limit out of 1–50) | read limit | read dependency/deadline, response-contract failure | scrubbed internal |
| CMS-03C-15   | malformed IDs/header/body | missing session | assignment/edit denied | hidden/absent instance | stale entry or instance version, revision_not_editable, diff_has_collisions, idempotency | non-JSON | choices/targets schema, an instance in no admitted state (a `retired`, detached or older row, DEC-193), pattern_version_not_active, pattern_incompatible, nested_pattern_not_active | composition limit | registry/RPC deadline | scrubbed internal |
| CMS-03C-16   | malformed IDs/header/body | missing session | curator denied | hidden/absent taxonomy scope | stale parent/key/version, idempotency | non-JSON | key/allowlist/domain schema | taxonomy-write limit | canonical registry/RPC deadline | scrubbed internal |
| CMS-03C-17   | malformed query/cursor | missing session | author/editor scope | hidden owner scope (no matching vocabulary is an empty page, DEC-227) | cursor/context mismatch | unsupported media if sent | query bounds | read limit | read dependency/deadline | scrubbed internal |
| cmsPatternLatestRead | malformed path | missing session | designer denied | hidden/absent pattern key | not applicable to bounded read | unsupported media if sent | not applicable | read limit | read dependency/deadline | scrubbed internal |
| cmsTemplateContextRead | any query string, malformed header | missing session | designer grant or confirmed membership denied | not applicable (no target) | not applicable to bounded read | unsupported media if sent | not applicable | read limit | malformed provider projection (502), read dependency/deadline (503/504) | scrubbed internal |
| cmsTemplateLatestRead | malformed path | missing session | designer denied | hidden/absent template key | not applicable to bounded read | unsupported media if sent | not applicable | read limit | read dependency/deadline | scrubbed internal |
| cmsTaxonomyVersionsRead, cmsTaxonomyTermsRead | malformed path/query/cursor | missing session | curator denied | hidden/absent vocabulary | cursor/context mismatch | unsupported media if sent | query bounds | read limit | read dependency/deadline, response-contract failure (a cmsTaxonomyTermsRead response over 256 KiB) | scrubbed internal |

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
| CMS-03C-01   | 400 INVALID_REQUEST; 401 UNAUTHENTICATED; 403 TEMPLATE_FORBIDDEN; 404 TEMPLATE_NOT_FOUND; 409 TEMPLATE_VERSION_CONFLICT; 415 UNSUPPORTED_MEDIA_TYPE; 422 TEMPLATE_VALIDATION_FAILED; 429 RATE_LIMITED; 502/503/504 DEPENDENCY_UNAVAILABLE; 500 INTERNAL_ERROR                             | Catalog cms.03c.template.v1; operation token is template; messages use the bound format above               | 400/401/403/404/415/422/500: retry N/A. 409: reconcile current version, then resubmit with a new idempotency key. 429: retry only after BE00 Retry-After. 502/503/504: a browser caller retries a safe operation at most twice, after 250 ms and 750 ms (FE03 Degradation); server, queue and job callers retry at most 3 times at 15s/60s/300s with jitter, circuit open 60s (DEC-211); after-effect ambiguity requires status/idempotency reconciliation first.                            | ApiError { code, message, requestId, details } from BE00; details allowlisted and bounded. |
| CMS-03C-02   | 400 INVALID_REQUEST; 401 UNAUTHENTICATED; 403 COMPOSITION_FORBIDDEN; 404 COMPOSITION_NOT_FOUND; 409 COMPOSITION_VERSION_CONFLICT; 415 UNSUPPORTED_MEDIA_TYPE; 422 COMPOSITION_VALIDATION_FAILED; 429 RATE_LIMITED; 502/503/504 DEPENDENCY_UNAVAILABLE; 500 INTERNAL_ERROR                 | Catalog cms.03c.composition.v1; operation token is composition; messages use the bound format above         | 400/401/403/404/415/422/500: retry N/A. 409: reconcile revision/slot CAS, then resubmit with a new idempotency key. 429: retry only after BE00 Retry-After. 502/503/504: a browser caller retries a safe operation at most twice, after 250 ms and 750 ms (FE03 Degradation); server, queue and job callers retry at most 3 times at 15s/60s/300s with jitter, circuit open 60s (DEC-211); after-effect ambiguity requires status/idempotency reconciliation first.                          | ApiError { code, message, requestId, details } from BE00; details allowlisted and bounded. |
| CMS-03C-03   | 400 INVALID_REQUEST; 401 UNAUTHENTICATED; 403 TAXONOMY_FORBIDDEN; 404 TAXONOMY_NOT_FOUND; 409 TAXONOMY_VERSION_CONFLICT; 415 UNSUPPORTED_MEDIA_TYPE; 422 TAXONOMY_VALIDATION_FAILED; 429 RATE_LIMITED; 502/503/504 DEPENDENCY_UNAVAILABLE; 500 INTERNAL_ERROR                             | Catalog cms.03c.taxonomy.v1; operation token is taxonomy; messages use the bound format above               | 400/401/403/404/415/422/500: retry N/A. 409: reconcile taxonomy/term lock and redirect state, then resubmit with a new idempotency key. 429: retry only after BE00 Retry-After. 502/503/504: a browser caller retries a safe operation at most twice, after 250 ms and 750 ms (FE03 Degradation); server, queue and job callers retry at most 3 times at 15s/60s/300s with jitter, circuit open 60s (DEC-211); after-effect ambiguity requires status/idempotency reconciliation first.      | ApiError { code, message, requestId, details } from BE00; details allowlisted and bounded. |
| CMS-03C-04   | 400 INVALID_REQUEST; 401 UNAUTHENTICATED; 403 LOCALE_FORBIDDEN; 404 LOCALE_SOURCE_NOT_FOUND; 409 LOCALE_VERSION_CONFLICT; 415 UNSUPPORTED_MEDIA_TYPE; 422 LOCALE_VALIDATION_FAILED; 429 RATE_LIMITED; 502/503/504 DEPENDENCY_UNAVAILABLE; 500 INTERNAL_ERROR                              | Catalog cms.03c.locale.v1; operation token is locale; messages use the bound format above. 422 LOCALE_VALIDATION_FAILED when `locale` is not in the active version's `supportedLocales`. 409 LOCALE_VERSION_CONFLICT with `details.reasonCode` `FALLBACK_CHAIN_MISMATCH` and `details.activeFallbackChain` (the active version's chain for `locale`, at most 16 BCP 47 tags) when `fallbackChain` differs from it in membership, order or length; no variant is written                   | 400/401/403/404/415/422/500: retry N/A. 409: reconcile source hash/entry version or adopt `details.activeFallbackChain`, then resubmit with a new idempotency key. 429: retry only after BE00 Retry-After. 502/503/504: a browser caller retries a safe operation at most twice, after 250 ms and 750 ms (FE03 Degradation); server, queue and job callers retry at most 3 times at 15s/60s/300s with jitter, circuit open 60s (DEC-211); after-effect ambiguity requires status/idempotency reconciliation first.                  | ApiError { code, message, requestId, details } from BE00; details allowlisted and bounded. |
| cmsLocaleVariantRead | 400 INVALID_REQUEST; 401 UNAUTHENTICATED; 403 LOCALE_FORBIDDEN; 404 LOCALE_SOURCE_NOT_FOUND; 429 RATE_LIMITED; 502/503/504 DEPENDENCY_UNAVAILABLE; 500 INTERNAL_ERROR | Catalog cms.03c.locale.v1; operation token is locale; messages use the bound format above. 404 LOCALE_SOURCE_NOT_FOUND also when `locale` is not in the active version's `supportedLocales` (DEC-205) | 400/401/403/404/500: retry N/A. 429: retry only after BE00 Retry-After. 502/503/504: a browser caller retries a safe operation at most twice, after 250 ms and 750 ms (FE03 Degradation); server, queue and job callers retry at most 3 times at 15s/60s/300s with jitter, circuit open 60s (DEC-211). | ApiError { code, message, requestId, details } from BE00; details allowlisted and bounded. |
| CMS-03C-05, cmsRelatedContentRead | 400 INVALID_REQUEST; 401 UNAUTHENTICATED; 403 RELATED_CONTENT_FORBIDDEN; 404 RELATED_CONTENT_NOT_FOUND; 409 RELATED_CONTENT_VERSION_CONFLICT; 415 UNSUPPORTED_MEDIA_TYPE; 422 RELATED_CONTENT_VALIDATION_FAILED; 429 RATE_LIMITED; 502/503/504 DEPENDENCY_UNAVAILABLE; 500 INTERNAL_ERROR | Catalog cms.03c.related-content.v1; operation token is related-content; messages use the bound format above | 400/401/403/404/415/422/500: retry N/A. 409: reconcile source-entry version and target projection, then resubmit with a new idempotency key. 429: retry only after BE00 Retry-After. 502/503/504: a browser caller retries a safe operation at most twice, after 250 ms and 750 ms (FE03 Degradation); server, queue and job callers retry at most 3 times at 15s/60s/300s with jitter, circuit open 60s (DEC-211); after-effect ambiguity requires status/idempotency reconciliation first. | ApiError { code, message, requestId, details } from BE00; details allowlisted and bounded. |
| CMS-03C-06 to CMS-03C-11 | 400 INVALID_REQUEST; 401 UNAUTHENTICATED or STEP_UP_REQUIRED (CMS-03C-07, -08, -09); 403 GOVERNED_REVIEW_FORBIDDEN; 404 GOVERNED_REVIEW_NOT_FOUND; 409 GOVERNED_REVIEW_VERSION_CONFLICT; 415 UNSUPPORTED_MEDIA_TYPE; 422 GOVERNED_REVIEW_VALIDATION_FAILED; 429 RATE_LIMITED; 502/503/504 DEPENDENCY_UNAVAILABLE; 500 INTERNAL_ERROR | Catalog cms.03c.governed-review.v1; operation token is governed-review; messages use the bound format above | 400/401/403/404/415/422/500: retry N/A. 409: reconcile the named version or state, then resubmit with a new idempotency key. 429: retry only after BE00 Retry-After. 502/503/504: a browser caller retries a safe operation at most twice, after 250 ms and 750 ms (FE03 Degradation); server, queue and job callers retry at most 3 times at 15s/60s/300s with jitter, circuit open 60s (DEC-211); after-effect ambiguity requires status/idempotency reconciliation first. A 401 STEP_UP_REQUIRED carries `{ recoveryAction: 'step_up', allowedMethods }`, reserves no idempotency record and changes no state. | ApiError { code, message, requestId, details } from BE00; details allowlisted and bounded. |
| CMS-03C-12 to CMS-03C-15, cmsPatternLatestRead, cmsCompositionInstancesRead, cmsPatternNestableRead | 400 INVALID_REQUEST; 401 UNAUTHENTICATED; 403 COMPOSITION_FORBIDDEN; 404 COMPOSITION_NOT_FOUND; 409 COMPOSITION_VERSION_CONFLICT; 415 UNSUPPORTED_MEDIA_TYPE; 422 COMPOSITION_VALIDATION_FAILED; 429 RATE_LIMITED; 502/503/504 DEPENDENCY_UNAVAILABLE; 500 INTERNAL_ERROR | Catalog cms.03c.composition.v1 (shared with CMS-03C-02); operation token is composition | 400/401/403/404/415/422/500: retry N/A. 409: reconcile the named version or state, then resubmit with a new idempotency key. 429: retry only after BE00 Retry-After. 502/503/504: a browser caller retries a safe operation at most twice, after 250 ms and 750 ms (FE03 Degradation); server, queue and job callers retry at most 3 times at 15s/60s/300s with jitter, circuit open 60s (DEC-211); after-effect ambiguity requires status/idempotency reconciliation first. | ApiError { code, message, requestId, details } from BE00; details allowlisted and bounded. |
| CMS-03C-16, CMS-03C-17, cmsTaxonomyVersionsRead, cmsTaxonomyTermsRead | 400 INVALID_REQUEST; 401 UNAUTHENTICATED; 403 TAXONOMY_FORBIDDEN; 404 TAXONOMY_NOT_FOUND; 409 TAXONOMY_VERSION_CONFLICT; 415 UNSUPPORTED_MEDIA_TYPE; 422 TAXONOMY_VALIDATION_FAILED; 429 RATE_LIMITED; 502/503/504 DEPENDENCY_UNAVAILABLE; 500 INTERNAL_ERROR | Catalog cms.03c.taxonomy.v1 (shared with CMS-03C-03); operation token is taxonomy | 400/401/403/404/415/422/500: retry N/A. 409: reconcile the named version or state, then resubmit with a new idempotency key. 429: retry only after BE00 Retry-After. 502/503/504: a browser caller retries a safe operation at most twice, after 250 ms and 750 ms (FE03 Degradation); server, queue and job callers retry at most 3 times at 15s/60s/300s with jitter, circuit open 60s (DEC-211); after-effect ambiguity requires status/idempotency reconciliation first. | ApiError { code, message, requestId, details } from BE00; details allowlisted and bounded. |
| cmsTemplateLatestRead | 400 INVALID_REQUEST; 401 UNAUTHENTICATED; 403 TEMPLATE_FORBIDDEN; 404 TEMPLATE_NOT_FOUND; 415 UNSUPPORTED_MEDIA_TYPE; 429 RATE_LIMITED; 502/503/504 DEPENDENCY_UNAVAILABLE; 500 INTERNAL_ERROR | Catalog cms.03c.template.v1 (shared with CMS-03C-01); operation token is template | 400/401/403/404/415/500: retry N/A. 429: retry only after BE00 Retry-After. 502/503/504: safe read; a browser caller retries at most twice, after 250 ms and 750 ms (FE03 Degradation); server, queue and job callers retry at most 3 times at 15s/60s/300s with jitter (DEC-211). | ApiError { code, message, requestId, details } from BE00; details allowlisted and bounded. |
| cmsTemplateContextRead | 400 INVALID_REQUEST; 401 UNAUTHENTICATED; 403 TEMPLATE_FORBIDDEN; 415 UNSUPPORTED_MEDIA_TYPE; 429 RATE_LIMITED; 502/503/504 DEPENDENCY_UNAVAILABLE; 500 INTERNAL_ERROR | Catalog cms.03c.template.v1 (shared with CMS-03C-01); operation token is template | 400/401/403/415/500: retry N/A. 429: retry only after BE00 Retry-After. 502/503/504: safe read; a browser caller retries at most twice, after 250 ms and 750 ms (FE03 Degradation); server, queue and job callers retry at most 3 times at 15s/60s/300s with jitter (DEC-211). | ApiError { code, message, requestId, details } from BE00; details allowlisted and bounded. |

The application code lists above are exhaustive per operation. A response with
an unmapped status or a message not generated by its operation catalog is a
contract failure and is treated as INTERNAL_ERROR 500 without leaking the
original payload. No operation uses a success-shaped error, partial mutation,
or HTTP reason phrase as its application code.

**Slice 12 typed refusals.** Within these catalogs a refusal carries exactly one lowercase `details.reasonCode` token from the closed list below, plus only the members named here. 403: `capability_missing` and `separation_of_duties` (the submitter, subject creator or a revision author acting as reviewer). 409: `subject_not_submittable`, `review_not_open`, `duplicate_decision`, `specialist_slot_unsatisfiable`, `reviewer_not_eligible` (one uniform refusal for an absent, cross-organization, banned or ungranted human, the submitter and the subject creator), `assignment_exists`, `assignment_limit`, `dependency_changed` (a committed invalidation), `subject_not_activatable`, `subject_not_retirable`, `activation_conflict` (a concurrent switch of the same lineage), `schedule_exists`, `revision_not_editable`, `pattern_cycle`, `diff_has_collisions`, `taxonomy_not_active`, `locale_limit_reached`, `block_registry_digest_mismatch` (a well-formed `blockRegistryDigest` that differs from the server-recomputed one, on CMS-03C-01, CMS-03C-02 and CMS-03C-12, no other member; DEC-186), plus `FALLBACK_CHAIN_MISMATCH`. 422: `key_reserved`, `pattern_version_not_active`, `pattern_incompatible`, `nested_pattern_not_active`, `pattern_depth_exceeded`, `pattern_nodes_exceeded`, `diff_too_large`, `canonical_overlap` (with `details.domain` and `details.canonicalId`, the pointer to reference instead), `canonical_source_unavailable` (with `details.domain`), `term_unavailable`, `derived_rule_unknown`, `related_target_ineligible` (uniform, at the request pointer), `block_rules_violated` (a tree that breaks a pinned block version's `allowedChildren` or `slotRules`, as `COMPOSITION_VALIDATION_FAILED` on CMS-03C-02, CMS-03C-12 and CMS-03C-15 only; DEC-210), and the 03b time tokens for a scheduled activation. A provider timeout or fault is 503 `DEPENDENCY_UNAVAILABLE` and never a success-shaped body. Each token is listed under exactly one status and keeps it on every operation that raises it: `pattern_version_not_active`, `pattern_incompatible` and `nested_pattern_not_active` are 422 on CMS-03C-02, CMS-03C-12 and CMS-03C-15 (a pattern version a request names as an input that is not `active` fails validation; the 409 of those operations is a stale CAS operand, a cycle or a collision), and every governed 409 is the catalog code `GOVERNED_REVIEW_VERSION_CONFLICT` with the reason token in `details.reasonCode` (the shorthands `VERSION_MISMATCH` and `CONFLICT` are not application codes in these catalogs) (DEC-180, R5).

### Governed review machinery (DEC-137, DEC-113, OD-1)

One set of private tables — `cms_governed_reviews`, `cms_governed_review_decisions`, `cms_governed_review_assignments` and `cms_governed_review_dependencies` (and `cms_governed_activation_schedules` for scheduled activation, OD-6) — serves every governed subject, keyed by `(subject_kind, subject_id)`, so slot semantics, MFA, assignment, strictest-policy counting and invalidation have exactly one implementation. They apply the 03b rules of `Review scopes, reviewer assignment and decision evaluation` and `Review invalidation` unchanged, with these substitutions: the *submitter* is the person who submitted the subject; the *subject creator* (`created_by` of the subject version) is treated like the revision author (never a reviewer); the assignment capability is `cms.definition_review` and the owner-only assignment authority is `cms.definition_review.assign`; the grantor authority end is the end of the owner's currently valid designer or curator grant (`cms.template_designer` for template and pattern versions, `cms.taxonomy_curator` for taxonomy versions; the owner may self-grant either, 03a); the standing qualification is the `cms.reviewer` grant plus the specialist capability of each specialist slot. The decision algorithm is the ten ordered steps of CMS-03B-06 as an order of checks (MFA first, concealment, `open` and `If-Match`, dependency and policy-basis check with a committed invalidation, separation of duties, standing capability, slot derivation, append-only decision, review CAS, audit) with `reviewed_hash` the review's frozen subject hash, and the first rejection ends the review; those steps are not an order of locks, which is `Slice 12 lock order` below (DEC-157 as extended by DEC-180), because taking the review row before the dependency positions is the order DEC-157 rejected. The DEC-108 `cms_schema_reviews` set and the 03b editorial review tables keep their own tables and operations.

| `subject_kind` | Subject row and lineage id | Owner capability | Submit preconditions | Frozen dependency kinds | Activation event |
| -------------- | -------------------------- | ---------------- | -------------------- | ----------------------- | ---------------- |
| `template_version` | `cms_template_versions`, `template_id` | `cms.template_designer` | state `draft`; the compatibility resolver succeeds for the active version of every `compatibleTypeIds` member; the recomputed `blockRegistryDigest` equals the stored one | `block` (each reachable block record), `content_type` (each compatible content type's active version id) | `cms.template.activated.v1` `{ templateId, templateVersionId }` |
| `pattern_version` | `cms_pattern_versions`, `pattern_id` | `cms.template_designer` | state `draft`; every nested pattern is `active`, compatible and acyclic; the recomputed digest equals the stored one | `block`, `pattern` (each nested pattern version), `content_type` | `cms.pattern.activated.v1` `{ patternId, patternVersionId }` |
| `taxonomy_version` | `cms_taxonomy_versions`, `taxonomy_id` | `cms.taxonomy_curator` | state `draft`; every declared canonical domain has a registered provider (else 422 `canonical_source_unavailable` with `details.domain`, DEC-180 G11) | `content_type` (each content type named by `allowedTypeKeys`), `canonical_domain` (the provider registry row of each declared domain) | `cms.taxonomy.changed.v1` `{ taxonomyId, taxonomyVersionId }` |

The `subject_kind` set is closed and code-owned; a later slice adds a kind by forward migration (Slice 13 navigation, route and metadata subjects, DEC-115) and registers its row here.

**Subject state machine.** `draft` → `review` at submission; `review` → `approved` when the last required approval lands; a rejection or an invalidation returns the subject from `review` (or from `approved`, `scheduled` or `blocked`) to `draft` through an audited transition, and the review record stays `rejected` or `invalidated`; `approved` → `active` (immediate activation) or `scheduled` (scheduled activation); `scheduled` → `active` at execution, or `blocked` when execution fails terminally; `blocked` → `active` or `scheduled` through a new activation command while its review is still `approved` and current; `active` → `superseded` in the same transaction that activates a newer version of the lineage, and `active` → `retired` by retirement; `superseded` and `retired` are terminal. A definition field never changes after creation: edits are successor versions (`supersedes_id`) created through CMS-03C-01, -12 or -16. Only one `active` version per lineage exists at any instant (partial unique on `(lineage_id) WHERE state = 'active'`). Each transition above advances the subject row's internal `lifecycle_version` by exactly one and never its definition `version` (DEC-188).

### Governed policy basis

The review count and slots are the strictest DEC-110 workflow policy among the content types the subject is bound to. For a template or pattern version the bound types are its `compatibleTypeIds`; for a taxonomy version they are the content types of the caller's owner scope whose keys appear in `allowedTypeKeys`. For each bound type the active ContentTypeVersion's editorial policy is resolved through the same fail-closed `cms_editorial_workflow_policy_evidence` seam as 03b (a NULL evidence is 503 `DEPENDENCY_UNAVAILABLE`). The basis is the array of `{ contentTypeId, policyKey, policyVersion, policyHash }` sorted by `(policyKey, policyVersion, contentTypeId)`. The effective `risk_class` is `protected` if any member is protected, `required_decision_count` is the largest member count, and `required_capabilities` is the base slot `cms.reviewer` followed by each specialist capability in order of first appearance across the sorted basis (at most 16); a subject with no resolvable bound type uses the single registry member `editorial.default` version 1 (`CMS_GOVERNED_DEFAULT_POLICY`). `policy_basis_hash` is the lowercase SHA-256 of the JCS basis array. The basis is frozen on the review; at every decision and activation it is recomputed, and a difference (a successor schema version changed a bound policy) invalidates the review `dependency_changed`.

### Governed activation, retirement and scheduled activation (DEC-113, OD-6)

CMS-03C-09 is the atomic CAS switch of DEC-113. Its ordered steps, in one transaction holding the review row and the lineage advisory lock (locks taken in `Slice 12 lock order`), are: (1) the unconditional step-up proof is verified before anything else; (2) the review is resolved and concealed per scope and the caller must hold the subject kind's owner capability; (3) the review `version` must equal `expectedVersion` (409 `GOVERNED_REVIEW_VERSION_CONFLICT`) and, for `activate` and `schedule`, the review must be `approved`; (4) for `activate` and `schedule`, the subject hash, the policy basis and every dependency are rechecked — a difference **commits the invalidation** (subject back to `draft`) and the RPC returns the outcome `invalidated`, answered 409 `GOVERNED_REVIEW_VERSION_CONFLICT` with `details.reasonCode` `dependency_changed`; (5) for `activate` and `schedule`, the kind-specific preflight runs (template: the compatibility resolver for every compatible type and the block digest; pattern: nested pattern state and the digest; taxonomy: a registered provider for every declared canonical domain, else 422 `canonical_source_unavailable` with the domain — this provider check runs before the step (4) comparison, so a declared domain whose current provider is unbuilt refuses the activation or schedule and keeps the approval, while a provider replaced by another built provider is the step (4) invalidation (DEC-237)); every input the template and pattern preflight reads (bound content types, block digest, nested pattern states) is part of the frozen status of step (4), so a difference there is the step (4) invalidation and never a separate refusal (DEC-227); (6) the action applies; `retire` takes steps (1), (2) and the version comparison of (3) and skips the approval requirement of (3) and steps (4) and (5) (DEC-190). **`activate`** requires the subject `approved` or `blocked` (else 409 `subject_not_activatable`): the subject becomes `active` (`lifecycle_version + 1`, `activated_at`), the lineage's previous `active` version becomes `superseded` (`lifecycle_version + 1`) in the same transaction, the review records `activated_at` and its `version` advances, and the audit record and exactly one activation event commit atomically (an activation that loses a race on the lineage is 409 `activation_conflict` and nothing commits). **`schedule`** resolves `activateAt` through the 03b Time authority (E8: pinned tz database, DST rules, 60 s to 366 d horizon), requires the same preflight, makes the subject `scheduled`, inserts one `pending` row in `cms_governed_activation_schedules` (a second live schedule for the subject is 409 `schedule_exists`) and answers 202; it emits no event. **`retire`** requires the subject `active` (else 409 `subject_not_retirable`) and makes it `retired` (`lifecycle_version + 1`, `retired_at`) and advances the review `version` by one with no fresh approval and no hash, policy, dependency, provider or preflight validity needed, because retirement only removes exposure, while it keeps the authentication, the unconditional recent MFA, the disclosure-safe review resolution, the subject kind's owner capability, the review `version` If-Match, the idempotency reservation and the transactional audit (DEC-190); it commits exactly one event of the same event type naming the retired version (consumers refetch the exact version and read its state), and a retired version fails the 03b `template` preflight and the 03a resolver as withdrawn (`WITHDRAWN`). Every governed state transition in the subject state machine above advances the subject's internal `lifecycle_version` by exactly one — submission, approval, scheduling, scheduled execution, terminal scheduling failure, recovery, immediate activation, supersession, retirement and invalidation — while the immutable definition `version` is unchanged (DEC-188).

**Scheduled activation (OD-6).** The schedule command performs the authority check; at fire time only revocation of the designer or curator grant, and a grant end before the fire instant, are rechecked (DEC-120; MFA is not rechecked). CMS-03C-19 mirrors CMS-03B-20 exactly: `cms_claim_due_governed_activations(batch)` claims due `pending` or `failed_retryable` rows `FOR UPDATE SKIP LOCKED`, moving them to `executing` with a lease; `cms_execute_governed_activation(schedule_id, expected_version, lease_id)` re-reads the review (`approved` at the stored `expected_version`), the subject (`scheduled`, hash equal), the policy basis and dependencies, the canonical providers and the grant, then performs the `activate` switch, sets the schedule `completed` with `actual_at_utc` and `deviation_seconds`, and commits one activation event. A retryable dependency failure follows the 15 s / 60 s / 300 s ladder (three attempts, then `blocked` `retries_exhausted`); a terminal failure makes the schedule `blocked` and the subject `blocked` with the closed `reasonCode` `approval_invalidated`, `dependency_changed`, `activation_authority_ended` or `canonical_source_unavailable`; an invalidation of the review while the subject is `scheduled` cancels the schedule (`cancelled`, `approval_invalidated`) and returns the subject to `draft` in the invalidating transaction. A late run activates and records its deviation; a repeated run on a `completed` schedule returns `already_completed`.

**Invalidation.** The closed reasons are `dependency_changed` and `reviewer_authority_changed`. `cms_governed_review_dependencies (review_id, kind, ref_id)` records the frozen identities (`block`, `pattern`, `content_type`, `canonical_domain`); the consumers of `cms.block.lifecycle.changed.v1` (a withdrawn block), `cms.schema.activated.v1` (a changed bound policy or type version), `cms.pattern.activated.v1` enqueue the idempotent job `cms.governed_review.recheck` (a typed platform-queue message, see `Job transport`; 500 reviews per run with a continuation cursor) which rebuilds the hash, policy basis and identities of each live review and invalidates on any difference. A run isolates each review (DEC-218): a review whose recheck raises an unexpected error is counted `unavailable` in the run result, left live and passed over, and the continuation cursor advances past it, while a lock timeout or deadlock remains the retryable conflict that retries the whole run, including one raised while the frozen block or pattern digest is recomputed (a lock failure is never read as a changed dependency, here or in CMS-03C-07 and CMS-03C-09, which share that recomputation; DEC-221); a passed-over review can never activate a stale subject, because CMS-03C-09 step (4) rechecks the subject hash, the policy basis and every dependency under its locks. Capability-grant revocation does not enqueue it: the job selects by `(kind, ref_id)` over dependency kinds that cannot name a person, so the revoking transaction invalidates synchronously instead (`Reviewer-authority invalidation on revocation`, DEC-207). Governed review state changes emit no event in Phase 2: CMS-03C-11 is the canonical queue, and a notification fan-out is a later addition that would first need an IA03 event schema.

**Reviewer-authority invalidation on revocation (DEC-180, G6).** `platform_private.cms_invalidate_governed_reviews_for_person(p_person_id uuid, p_capability text)` mirrors the 03b function `cms_invalidate_reviews_for_person` (03b `Review invalidation` and rule 7 of `Write-path lock order and authority fencing`). The transaction that revokes a standing capability grant calls it for the revoked person and capability. As in 03b, it is also called by AFTER UPDATE or DELETE triggers: on `identity_private.organization_actor_grant` with the old row's person and capability (and the new row's when an update changes them), and on `identity_private.membership_tenure` with the old row's person and a null capability, which considers every counted approval of that person (and the new row's person when an update changes it); each trigger sets and restores the transaction-local RPC context around the call. It is a SECURITY DEFINER function that is not scoped to the revoker's party, so it reaches the governed review rows whichever session performs the revocation. For every `open` or `approved` review in which `p_person_id` has a counted approving decision recorded under `p_capability` (the satisfied slot), it locks the subject version row before the review (`Slice 12 lock order`) and re-reads the review under that lock: a review that is no longer live (its subject was activated, or it was invalidated or decided meanwhile) is skipped, so a revocation never fails because of a governed review it no longer concerns (DEC-221); sets the review `invalidated` with the reason `reviewer_authority_changed` under CAS (`version` + 1), returns the subject to `draft`, cancels the review's `pending` and `failed_retryable` schedules (`cancelled`, `approval_invalidated`) and writes the audit record, all in the revoking transaction. As defense in depth, activation recomputes the live qualifying approvals under its locks and refuses a short count, so a stored `approved` state that lags a revocation can never activate a subject.

**Job transport (DEC-166, DEC-180 G9).** `cms.governed_review.recheck` and `cms.pattern.linked_update_scan` are system-initiated: they have no human actor and acting party, which a `platform_private.jobs` row requires, so each is a typed message on the platform queue carrying only identifiers, as DEC-166 decided for the Slice 11 dependency recheck, idempotent on re-delivery and bounded as stated above. `cms.taxonomy.merge_converge` continues a user command (the CMS-03C-03 merge), whose actor and acting party exist, so it is a BE00 jobs row bound to them, and its durable cursor is job state. The producers of these messages use the registered `cms.pattern.` and `cms.taxonomy.` producer prefixes, inserted if absent.

### Slice 12 lock order (DEC-157, DEC-180)

Every Slice 12 writer takes its locks in the BE03b global write-path order (`Write-path lock order and authority fencing`, positions 0 to 5) and never acquires an earlier position after a later one. The ten ordered steps of CMS-03B-06 that `Governed review machinery` adopts fix the order of the checks, not of the locks: locking by that prose (the review row before the dependency positions) is the order DEC-157 rejected, so Slice 12 extends DEC-157 as follows. Slice 12 adds one position, taken after every position above: **position 6**, the `cms_terms` rows of the vocabulary a command names (`FOR UPDATE` for a term action and a merge, `FOR SHARE` for a 03b entry writer that assigns a term), so that term locks serialize merge and assignment. Within one position a command locks rows in ascending `id` order.

| Writer | Positions taken, in order |
| ------ | ------------------------- |
| CMS-03C-02, CMS-03C-04, CMS-03C-05, CMS-03C-15 and the revision-append carry-over | 0 the entry row; 1 the caller's authority and entry-assignment rows (`FOR SHARE`, capability re-proved under the lock); 2 the pin and exclusion target entries of CMS-03C-05 (`FOR SHARE`, with the uniform refusal of BE03b rule 2); 3 the pattern version rows the write pins (`FOR SHARE`; CMS-03C-02 and CMS-03C-15); 4 the entry's content-type version row (`FOR SHARE`); 5 the entry revision's live editorial review rows when the write invalidates them (`FOR UPDATE`) |
| CMS-03C-01, CMS-03C-12, CMS-03C-16 | 1 the caller's designer or curator grant rows (`FOR SHARE`); 3 the parent version row when editing (`FOR UPDATE`, the CAS operand) and, for CMS-03C-12, each nested pattern version row (`FOR SHARE`); 4 the content-type version rows the definition names (`FOR SHARE`) |
| CMS-03C-03 term actions | 1 the curator's grant rows (`FOR SHARE`); for `merge`, the per-party merge-enqueue mutex (`cms_taxonomy_merge_enqueue_lock`, DEC-194, DEC-212) after 1 and before 3; 3 the vocabulary's `active` TaxonomyVersion row (`FOR SHARE`); 6 the term rows |
| CMS-03C-06 submit | 1 the submitter's owner-capability rows (`FOR SHARE`); 3 the subject version row (`FOR UPDATE`), then its dependency graph (nested pattern versions, `FOR SHARE`); 4 the bound content-type version rows (`FOR SHARE`) |
| CMS-03C-07 decision | 1 the reviewer's standing grant rows (`FOR SHARE`); 3 the subject version row (`FOR UPDATE`, because a committed invalidation returns it to `draft`), then its dependency graph (`FOR SHARE`); 4 the bound content-type version rows (`FOR SHARE`); 5 the review row (`FOR UPDATE`), then its assignment rows |
| CMS-03C-08 assignment | 1 the owner's designer or curator grant rows and the reviewer's `cms.reviewer` grant rows (`FOR SHARE`); 5 the review row (`FOR UPDATE`, exact review `version`), then its assignment rows, under which the partial unique on `(review_id, reviewer_person_id) WHERE state = 'active'` and the limit of 16 active assignments are checked |
| CMS-03C-09 activation, scheduling and retirement, and CMS-03C-19 execution | 1 the activator's (at execution, the schedule creator's) owner-capability grant rows (`FOR SHARE`); 3 the subject version row (`FOR UPDATE`), its dependency graph and, for `activate`, the lineage's current `active` version row (`FOR UPDATE`, after the subject); 4 the bound content-type version rows (`FOR SHARE`); 5 the review row (`FOR UPDATE`); then the schedule row (`FOR UPDATE`, rechecking the lease after the lock at execution) and last the lineage advisory lock |
| `cms_recheck_governed_reviews` (the job `cms.governed_review.recheck`) and `cms_invalidate_governed_reviews_for_person` | 3 the subject version row (`FOR UPDATE`) before 5 the review rows it invalidates (`FOR UPDATE`); the person invalidation runs inside the revoking transaction after the revocation's own position 1 `FOR UPDATE`; a review already `invalidated` is skipped |
| `cms.pattern.linked_update_scan` | the positions of a composition write, taking entries in ascending entry `id` order within a run of at most 500 instances |
| `cms.taxonomy.merge_converge` | the positions of the CMS-03C-03 merge it continues (1, 3 and 6), per batch from the durable cursor; the merge request, the fenced continuation and the DEC-194 recovery sweep also take the per-acting-party merge-enqueue mutex (`cms_taxonomy_merge_enqueue_lock`) after position 1 and before position 3, and the sweep takes only that mutex, parties in ascending id (DEC-212) |
| the claim RPC of CMS-03C-19 | schedule rows only (`FOR UPDATE SKIP LOCKED`), committed before execution starts; CMS-03C-18, CMS-03C-20 and CMS-03C-21 are reads and lock nothing |
| the 03b publication commands CMS-03B-07 schedule, CMS-03B-09 publish and CMS-03B-20 execute, for a revision with composition | their 03b positions, adding at position 3, before the schema and review locks, the revision's live pattern dependencies — every PatternVersion row its effective composition pins, roots and nested versions reached through live uses (a row that carries a nonnull `detached_tree` pins none) — `FOR SHARE` in ascending `id`, so a concurrent CMS-03C-09 activation or supersession of one of those versions waits for the publication or the publication waits for it and then refuses the changed pin through the pattern provider (DEC-224) |

1. **Lock before write, capability re-proved under the lock.** A writer takes its positions before it reads what it will write and re-proves its capability under the position 1 locks. A revocation committed first wins: the writer is refused 403 with the operation's catalog code and writes no row; a later revocation waits for the writer to commit.
2. **Pinned definitions.** A writer that waited on a pinned or bound definition row and then finds it superseded is refused with the typed refusal of its operation (`pattern_version_not_active`, 422, for CMS-03C-02 and CMS-03C-15). The narrow initial-entry exception is CMS-03B-10 (DEC-202): resolve the exact authorized active schema's stored default template under the existing compatibility resolver; a compatible superseded default remains eligible, while a retired or blocked default is 409 `CONFLICT`. Recheck that exact default and compatibility after waiting, with the existing BE03b create refusal mapping and no latest/first-binding substitution. This exception does not relax live-pattern pins or review/publication active-only currentness rules.
3. **Revocation versus activation.** If a revocation of a counted approver's or an activator's authority commits first, the activation is refused 409 `GOVERNED_REVIEW_VERSION_CONFLICT`, the review becomes `invalidated` and the subject returns to `draft`; if the activation commits first, the revocation waits and then commits. Neither is aborted by a deadlock.
4. **Typed deadlock.** `deadlock_detected` and a lock-acquisition failure at a lock step are converted to the 409 code of the operation's catalog (`TEMPLATE_VERSION_CONFLICT`, `COMPOSITION_VERSION_CONFLICT`, `TAXONOMY_VERSION_CONFLICT`, `LOCALE_VERSION_CONFLICT`, `RELATED_CONTENT_VERSION_CONFLICT` or `GOVERNED_REVIEW_VERSION_CONFLICT`) with nothing committed; the retry may reuse the same `Idempotency-Key`.

### Pattern versions and linked updates (D9, OD-2)

A PatternVersion is a persisted, owner-scoped, versioned block tree. CMS-03C-12 creates a `draft` version: `compatibleTypeIds` (OD-2, mirroring templates; 1–64 active content type ids of the owner scope) names the types whose entries may use it and drives the review count (`Governed policy basis`); `blockTree` is the bounded forest of `PatternNode`s of the contracts (blocks and nested pattern references, depth ≤8, ≤512 nodes after expansion, sibling keys unique, props ≤64 keys and depth 8); the server resolves every reachable block from the 03a safe registry, rejects a missing, withdrawn or incompatible block, rejects any cycle through a nested lineage (the visited set is the lineage `pattern_id`), requires every nested pattern to be `active` and to list every `compatibleTypeIds` member of the new pattern, recomputes `blockRegistryDigest` (the client digest is an equality expectation), and stores `node_count`. A first version carries `expectedVersion: null`; a successor names its parent's `version`. Activation is CMS-03C-09 with `subject_kind = 'pattern_version'` and emits `cms.pattern.activated.v1`; the digest is recomputed again at activation and at 03b publication preflight.

CMS-03C-13 is the author-facing selector: it lists only `active` pattern versions of the caller's owner scope whose `compatibleTypeIds` contains the requested content type, ordered `(patternKey ASC, patternVersion DESC)`, with a signed keyset cursor. `cmsPatternNestableRead` (DEC-196) is its designer-facing counterpart for nested `pattern` nodes: a `cms.template_designer` of the owner party names the 1–64 content types of the pattern being designed and receives the `active` versions whose `compatibleTypeIds` contains every one of them, in the same order and page shape; it lists no version the CMS-03C-12 save would refuse as `nested_pattern_not_active` for that type set, while a cycle through a nested lineage stays the save's 409 `pattern_cycle` (the read does not exclude the lineage being edited).

CMS-03C-02 (`cms_insert_pattern_instance`) places a pattern on the entry's current draft revision (DEC-176: patterns apply to entry revisions only, never to a template draft): the revision must be the entry's current draft (effective state `draft`, else 409 `revision_not_editable`), the pattern version must be `active` and compatible with the entry's content type (422 `pattern_version_not_active` or `pattern_incompatible`), and the request `slotPath` must exist in the revision's template (or be a root path when the entry has no template). **One placement writes one `CompositionInstance` row per block root of the pinned pattern version's forest (DEC-175, DEC-181).** A root node that is a nested pattern reference (`kind: pattern`) has no block of its own, so it is expanded at placement into that pattern's own block roots, recursively (DEC-181), and every row carries a block. The placement writes one or more append-only rows in one transaction, all-or-nothing, bounded by the existing 512-node cap after expansion (a forest of 1–32 root nodes can therefore write more than 32 rows), and the 201 body is `PatternPlacementResource`, an `items` list of one or more `CompositionInstanceResource`, at most 512 (the precedent of `CompositionUpdateResource`, CMS-03C-15). Each row stays pinned to the placed `(patternId, patternVersion)`, whose pinned tree already fixes each nested version, carries its block root's block identity in `block_key` and `block_version`, and takes the request `slotPath` joined with `/` and that root's key chain as its `path` (DEC-186): for a root of the pinned forest the chain is its `key` (the `slotPath` `/main` and the root `hero` give `/main/hero`), for a block root reached through a nested pattern reference it is the reference's `key` followed by that root's `key` (`shared` expanding to `a` gives `/main/shared/a`) and, through several references, each reference's `key` in order, and the root path `/` adds no extra separator (`/` and `hero` give `/hero`); a placement in which any row `path` exceeds 248 octets (so that the `/blocks/{path}` comparison pointer fits the 256-character `JsonPointer` of 03b) is 422 `COMPOSITION_VALIDATION_FAILED` at `/slotPath` after the pinned pattern is resolved and writes nothing; the nodes below a block root, nested pattern references included, stay inside that root's pinned tree and are never rows. Each row stores the server-recomputed digest, the link mode and the `overrides` that lie under its root. `overrides` keys are normalized node paths under the inserted root (`/{nodeKey}(/{nodeKey})*`, at most 512 characters), each naming a node of the pinned version's tree, and any other key is 422 `COMPOSITION_VALIDATION_FAILED` at `/overrides`. Inside a block root reached through a nested pattern reference the key chain is the one the row `path` uses (the reference's `key`, then the root's `key`, then the keys below it), so `/shared/a/title` addresses the node `title` below the root `a` of the pattern that `shared` references (DEC-186); a key that stops at a reference node lies above every block root and under no row, and is refused 422 at `/overrides`; each row stores only the overrides whose key begins with its own key chain. `(revision_id, path)` is unique per version. **Row order (DEC-185).** Every row carries `position integer NOT NULL`. A placement takes consecutive positions in forest order: the order of the pinned forest's root nodes, with a top-level nested pattern reference replaced in place by that pattern's own block roots in their order, recursively (DEC-181). The first position is one more than the greatest `position` of any row, of any state or version, of the same `(revision_id, slot_key)`, or 0 when the slot has no row, computed under the revision/slot lock this operation already takes, so two placements into one slot never interleave or share a position and a placement never renumbers an existing row; the 201 `items` list is in position order. CMS-03C-15 `accept` and `detach`, the linked-update scan, `cms_restore_revision` and the revision-append carry-over append rows that copy the `position` of the instance they follow unchanged (a position is immutable per `path`, so the D5 comparison hash, which has no position input, is unchanged), and the render plan orders composition rows by region, slot ordinal, `position`, `path` (bytewise) and `id`, so the rows of one placement render in forest order, the rows of two placements stay grouped, and a document-order rule such as `heading.first_level` of BE05c sees authored order rather than key order. The one-block-per-row table, the D5 block comparison hash (03b) and the render plan (DEC-165, which reads each row as one block root at its own `path`, in `position` order within its slot, DEC-185, followed by the descendant blocks of that root's effective tree, DEC-214) therefore need no new concept, and each block-root row is diffed, accepted, detached and scanned independently. **Render plan and checker pointers (DEC-214).** The render plan and the accessibility checker input list a composition row's block root at pointer `/composition/{rowId}` and each descendant block of the row's effective tree at `/composition/{rowId}/nodes/{i}`, `i` the zero-based canonical preorder index of the node in that tree (the root is index 0 and carries no `/nodes` suffix). The effective tree is the row's `detached_tree` when it carries one, and otherwise its pinned version's subtree of the row's block root with nested pattern references expanded in place and the row's `overrides` applied; linked, `pending_diff` and plain `detached` rows are listed alike. The pointer is the identity of a plan entry and of a checker finding location, not an address a client may dereference, and the stored row `path` grammar is unchanged. A composition write never changes the revision's `contentHash` (composition instances are not part of it) and invalidates the revision's live review in the same transaction (`dependency_changed`, because the manifest `blocks` and `patterns` groups changed).

**Placing selected roots (DEC-193).** `roots`, when present, names 1–512 unique block roots of the pinned forest by their key chains, the chains the row `path`s use after top-level nested pattern references are expanded (DEC-181, DEC-186); only those roots are placed, in forest order, and an `overrides` key under no named root is 422 at `/overrides`; a chain that is not the key chain of a block root of the pinned forest is 422 `COMPOSITION_VALIDATION_FAILED` at `/roots/{n}`. A chain is an `ExpandedPatternNodePath`: the same slash-joined key grammar as a row `path` (`/{nodeKey}(/{nodeKey})*`), sized for the fully expanded forest (at most 72 key segments and 4680 ASCII characters, DEC-193), because a valid expansion can nest nine pattern levels of eight 64-character keys and its address exceeds the 512 characters the stored row `path` grammar allows; the stored row `path`/`slotPath` and their 248-octet cap are unchanged. Without `roots` every block root is placed, as above. This is how the author places the block roots a newer pattern version adds (the `newRoots` of a CMS-03C-14 diff): the diff's `slotPath`, the target version as `patternVersion` and `roots` naming them. A new root's key chain differs from the chain of every block root the earlier placement wrote (the version those rows were placed from lacks it), so its path is none of those rows' paths. A row path is occupied when the revision holds a row at that path whose newest version is not `retired`; a placement that would write an occupied path is 409 `COMPOSITION_VERSION_CONFLICT` (slot collision) and writes nothing. A path whose newest row is `retired` (a block root that an accepted linked update removed) is free: the placed row is that path's next `version` and keeps that path's `position`, because a position is immutable per path (DEC-185), while the rows placed on new paths take consecutive positions, in forest order, from one above the slot's greatest `position`.

**Linked update (diff, accept, detach).** When a pattern version is activated, the consumer job `cms.pattern.linked_update_scan` (payload `{ patternId, patternVersionId }`, 500 instances per run with a continuation cursor, idempotent) appends a new `pending_diff` row, pinned to the unchanged version and carrying `pending_pattern_version` and the instance's `position` unchanged (DEC-185), for each `linked` instance on a *draft* revision whose pinned version is older and whose entry type is compatible with the new version; instances on reviewed or published revisions keep their pin as history. The scan reads a *draft* revision as the entry's current draft revision whose derived state is `draft`; a head that is already `pending_diff` for an older pending version gets a newer `pending_diff` row; a target version that is no longer `active` when the job runs is a no-op; an appended row keeps the head's `created_by` (a system job has no actor), changes no entry `version` and writes no audit or event of its own, while the review invalidation it causes is audited as every composition write's is (DEC-222). A `pending_diff` instance renders its pinned version: an unanswered update overwrites nothing. CMS-03C-14 returns the three-way diff of the instance's block root between its pinned version and the target (the newest `active` compatible version): for each node path of the root's subtree, nested pattern references expanded in place with their keys leading the chain (DEC-181, DEC-186), the pinned value (`base`), the target value (`theirs`) and the local override (`yours`), bounded to 128 paths and 256 KiB. Every `path` of the diff, every entry of a node's `children` and every `choices` path is an `ExpandedPatternNodePath` (DEC-193): the same slash-joined key grammar as a stored row `path`, sized for the fully expanded forest (at most 72 key segments and 4680 ASCII characters), because a valid expansion can address a node whose address exceeds the 512 characters a stored row `path` allows; the 128-path and 256 KiB bounds of the diff are unchanged and no full snapshot is ever returned. **Node value (DEC-193).** The value of a node path is the node's `props` plus its structure: its block identity (`blockKey`, `blockVersion`) and its `children`, the node paths of its child block nodes in order, as expanded addresses (a nested pattern reference below the node contributes, in place, the block roots it expands to); the list reflects every actual child of the node within the 512-node expanded total and is not limited to the authored 32-root bound. `base` is null for a node new in the target and `theirs` is null for a node the target removed; `yours` stays the override, which replaces the node's `props` whole and never changes its structure. A path is listed when the target changed its value; a node the target adds or removes is listed once, at its own path, and its descendants are not listed separately (its parent's `children` change carries them). A listed path is a **collision** of exactly one `collisionKind`, the first that applies: `removed_root` when it is the instance's own block root and the target removed it; `structure` when the target changed the node's block identity or `children`, with or without an override, because a structural change is never adopted silently; `props` when the override differs from the base `props` and the target also changed them. Any other listed path is not a collision. The diff also lists `newRoots`, the block roots of the target forest after top-level expansion whose key chain the pinned forest lacks, with the instance's `slotPath`; they belong to no instance, so accept never creates a row for one, and the author places them through CMS-03C-02 `roots` (`Placing selected roots`, above). When the instance has no newer `active` compatible pattern version, CMS-03C-14 answers 200 with `paths: []`, `newRoots: []`, `collisionCount` 0, `bulkEligible` false and `targetPatternVersion` equal to `pinnedPatternVersion` (DEC-180, G4); that is not an error and changes nothing, and the front end renders its `no-update` state. The same no-update answer is given for a readable row that carries a positive provenance pattern pin and is not the linked `active` or `pending_diff` newest version of its path (a detached row, a detached copy, a `retired` row, an older version, or a historical linked `active`/`pending_diff` row that is no longer newest), so the diff never refuses a pattern-origin row it can read; a row with no pattern pin (a standalone block row) is refused, never answered with a fabricated pin or a fabricated no-update (DEC-193). A target that changes none of the instance's paths still offers its newer pin and its `newRoots`: `paths` is empty, `targetPatternVersion` is above `pinnedPatternVersion` and `bulkEligible` is true. A placement of several block roots is several instances, each diffed, accepted and detached independently (a bulk request may list up to 32 of them when none collides). A placement can write up to 512 rows (DEC-181) and one CMS-03C-15 request lists at most 32 instances, so no operation spans a placement: its rows are accepted or detached in successive requests of at most 32 instances, each request all-or-nothing and each carrying the entry's then-current `version` as `If-Match` (read again after the previous request) and every listed instance's own `version`, and a row not yet answered stays on its pinned version (an unanswered update overwrites nothing). CMS-03C-14 diffs one instance per call, and the stored rows carry no placement identity, so there is no placement-wide accept. CMS-03C-15 `accept` adopts the target version for each listed instance: a listed path that is not a collision adopts the target value (an override equal to the base is dropped with it), a local override on a path the target did not change is retained, and every collision requires an explicit `yours` or `theirs` choice (a missing choice is 422). Every choice of one instance applies simultaneously, and each descendant answer applies within the topology its chosen ancestor reaches. A complete answer set whose resolved choices cannot form one consistent reachable tree (a parent's `theirs` excludes a node whose own answer requires it present, or a parent's `yours` requires a node the answer set leaves absent), or that selects an invalid graph, an unregistered or protected block, or a protected `props` or `children` value, is refused atomically as 422 `COMPOSITION_VALIDATION_FAILED` at `/instances/0/choices` (the SQL `VALIDATION_FAILED`), with no partial row and no new reason code; the 400 malformed, 422 bad-choice and 409 `diff_has_collisions` mappings are otherwise unchanged (DEC-193). Resolution is defined over three trees: B is the pinned expanded tree, L is B with the instance's local overrides applied, and T is the target tree. On a `props` collision `theirs` takes the T props and drops the override, and `yours` keeps the L props. On a `structure` collision `theirs` selects the T node at that path, adopting its block identity and ordered children and retaining that path's local override only where T left B's `props` unchanged, and `yours` selects the L node: its presence, block identity and ordered children and its effective props. An unchanged target path retains L; a changed path that is not a collision adopts T. A worked counterexample: a node path is block `a` with `old` props in B and L (no local override), and the target T changes it to block `b` with `new` props, a `structure` collision; `yours` selects the L node, block `a` with `old`, not the target block, so the result is unambiguous. On a `structure` collision `theirs` adopts the target's block identity and `children` at that path (an added child with its target subtree, a removed child gone with every override at or below it) and keeps that path's override only when the target left its `props` unchanged. When the target keeps the instance's block root and every `structure` collision is answered `theirs`, accept appends an `active` linked row pinned to the target version, whose kept overrides each name a node of the target tree (DEC-193). On a `removed_root` collision `theirs` retires the instance: accept appends a `retired` row, which the render plan excludes and which CMS-03C-14 answers with the no-update diff; a `retired` row is not accepted, but the newest version of its path may still be detached (DEC-193). `yours` on a `structure` or `removed_root` collision keeps the author's structure, which no linked row pinned to the target can hold (an override replaces `props` only), so accept appends a `detached` row carrying the resolved tree rather than a linked row: unlike an ordinary `detach`, which copies the instance's current effective content unchanged, this row materializes the tree that every explicit choice resolves to, so no choice is discarded and the result is never an unchanged whole-instance copy (DEC-193). No row is ever left linked and pinned to a version whose forest lacks its block root: the `retired` row and the detached copy keep the `(pattern_id, pattern_version)` of the row they follow, whose forest has that root. `detach` appends a `detached` row that materializes the instance's current effective content, the full subtree of its block root in its pinned version with nested pattern references expanded in place and every override applied (an override replaces its node's `props`), as a **detached local block tree** in the row's `detached_tree` (`Canonical records and fields`), and the row stops receiving updates (DEC-193). The tree is bounded by the pattern node limit the pinned version already satisfies (at most 512 nodes, each node's `props` within the pattern and `overrides` bounds), so detach has no key-count refusal; the row's `props` is `{}`, its `block_key` and `block_version` are the tree root's, its `block_registry_digest` is recomputed over the tree's reachable blocks, and its `(pattern_id, pattern_version)` is the provenance of the row it follows, never read to render it; this provenance-only treatment applies to a row that carries a nonnull `detached_tree`, while a plain `detached` row with a NULL `detached_tree` (a CMS-03C-02 `linkMode: detached` row) keeps its defined pinned render and checker behavior and is not exempted. Reads resolve a detached tree: the render plan reads a row that carries `detached_tree` as that tree at the row's `path` (the root block at the row `path`, its descendants from the tree), never from its pin or its overrides; CMS-03C-14 answers it with the no-update diff; restore and the revision-append carry-over copy it unchanged (`Receiving obligations from Slice 10 (DEC-141)`). `accept` admits a linked `active` or `pending_diff` row and `detach` any linked pattern-origin row, including a `retired` one, each the newest version of its path; any other named row is 422 `COMPOSITION_VALIDATION_FAILED` at `/instances/{n}/instanceId` (DEC-193). Every row that `accept` or `detach` appends keeps the instance's `position` unchanged (DEC-185). Bulk acceptance of up to 32 instances is all-or-nothing and admitted only when none has a collision (409 `diff_has_collisions` otherwise); `choices` are accepted only for a single-instance request. Both commands take the entry's `version` as `If-Match`, each instance's own `version` as its CAS, and invalidate the revision's live review.

**Block composition rules (DEC-210).** Each registered block version declares `allowedChildren` and `slotRules` (03a `BlockRegistrationRequest`); a BlockDefinitionVersion row is immutable, so the rules of a pinned `(blockKey, blockVersion)` never change. Over the expanded block forest of a tree (nested pattern references expanded into their pinned versions' block roots, DEC-181), every block node N with rule R satisfies: each child block node of N has a `blockKey` listed in R.`allowedChildren` (an empty list admits no child); the subtree rooted at N, counting N, has at most R.`slotRules.maxNodes` block nodes and at most R.`slotRules.maxDepth` levels (N is level 1). The rule is enforced wherever a tree is written or published: CMS-03C-12 pattern version save (422 `COMPOSITION_VALIDATION_FAILED` at the offending node's pointer in the request `blockTree`, `/blockTree/{i}(/children/{j})*`, like the operation's other `blockTree` refusals), CMS-03C-02 placement (422 at `/roots`, or `/patternVersion` when no roots are named), CMS-03C-15 accept and detach, including a resolved tree that keeps `yours` on a `structure` or `removed_root` collision (422 at `/instances/{i}/choices` for accept, `/instances/{i}` for detach), each with `details.reasonCode` `block_rules_violated` and nothing written; and the `cms.pattern.active_digest` publication provider, which fails the `pattern` category with the reason `pattern_block_rules_violated` for any reachable tree that violates them (a pattern saved before this rule is caught there). The check reads the pinned registry rows under the existing lock order and never consults a newer block version.

### Taxonomy versions, canonical projection and term governance (D10, OD-1, DEC-135)

A vocabulary is identified by its stable lineage id `taxonomyId`; a TaxonomyVersion is the reviewed *rule set* of the vocabulary (shape, allowlists, declared canonical overlap domains), and the terms belong to the vocabulary, not to a version (IA03 deep dive `taxonomy_term.taxonomy_id`): `cms_terms` carries `taxonomy_id` and `UNIQUE (taxonomy_id, term_key, version)`, so a successor version never duplicates or re-keys a term and term ids stay stable across versions and merges. CMS-03C-16 creates a `draft` version (`taxonomyKey`, `shape`, `allowedTypeKeys`, `allowedFieldKeys`, `canonicalOverlapDomains`, `expectedVersion`); activation is CMS-03C-09 with `subject_kind = 'taxonomy_version'` (OD-1) and emits `cms.taxonomy.changed.v1`. CMS-03C-03 term actions run under the vocabulary's `active` version: no active version is 409 `taxonomy_not_active`; `parentId` other than null needs shape `hierarchical`; assigning a term to a field requires the vocabulary's active version to list the entry content type's key in `allowedTypeKeys` and the field key in `allowedFieldKeys`. CMS-03C-17 is the author-facing selector over `active` terms of such vocabularies, with the label for the requested locale (null when the term has none; there is no fallback), `merged` and `deprecated` terms never listed.

**Canonical taxonomy projection (D10).** `platform_private.cms_canonical_domain_registry` (seeded by forward migration, immutable, never writable by a caller) holds the closed domains `role`, `instrument`, `gear`, `place`, `rights` and `jurisdiction` with `provider_state` (`built` or `unbuilt`), `provider_key` and `provider_version`. In Phase 2 only `role` is built (its provider reads the Shard 02 role facet assertion projection); the others are `unbuilt` until their owning shard registers a provider by forward migration. `cms_canonical_taxonomy_match` (CMS-03C-18) compares each candidate (key, label or alias, NFC) with the domain's named read-only projection after normalization (NFKC, lowercase, trim, whitespace collapse) by exact equality and returns `match` with the canonical record id and kind, `no_match`, or `source_unavailable` for an unbuilt domain; it never fuzzy-matches and never reads another shard's store directly (DEC-100).

**DEC-135 declared domains.** The overlap check runs only against the `canonicalOverlapDomains` declared by the vocabulary's active version, and the declaration is part of the reviewed version. A `match` in a declared domain is 422 `TAXONOMY_VALIDATION_FAILED` `canonical_overlap` with `details.domain` and `details.canonicalId` (the pointer to reference instead). A declared domain whose provider is `unbuilt` is refused with the typed `canonical_source_unavailable` at taxonomy-version submission (CMS-03C-06: 422 `GOVERNED_REVIEW_VALIDATION_FAILED` with `details.reasonCode` `canonical_source_unavailable` and `details.domain`, DEC-180 G11), at taxonomy-version activation and, defensively, at every `create`, `rename` and `alias` action (a `merge` or `deprecate` introduces no new string and runs no overlap check). A vocabulary that declares no domain is never checked, and an undeclared domain gives CMS-14 a real Phase 2 path; the reviewers see the declaration when they approve the version.

**Term actions and merge convergence.** `create` inserts a term with `lifecycle` `active` and its first labels; `rename` appends a new label version (the key never changes); `alias` appends an alias; `deprecate` moves the term to `deprecated` (still resolvable, not newly assignable); `merge` locks the survivor and the retired term (`FOR UPDATE` in id order), requires a survivor that is `active` or `deprecated` and a retired term that is not already `merged`, sets the retired term `merged` with `successor_id`, and re-points every `active` TermAssignment of the retired term to the survivor by appending superseding assignment versions: up to 5,000 assignments converge in the same transaction, a larger set continues through the idempotent job `cms.taxonomy.merge_converge` from a durable cursor, and the retired id resolves permanently to the survivor throughout. `cms.taxonomy.changed.v1` is emitted once per committed term action with the vocabulary's active version id. A write that names a merged, deprecated-for-assignment, unknown or other-vocabulary term in a taxonomy field value (03b) is the uniform 422 `term_unavailable`.

**Merge convergence Job disposition (BE00 233, 554, 571).** The `cms.taxonomy.merge_converge` Job effect reports exactly one BE00 disposition per delivery, `succeeded` or `failed`; it never reports `queued`, `cancelled` or `pending_manual_review`, because a re-queued ordinary Job is skipped as stale once its claim advanced the Job version (BE00 547). A `succeeded` Job carries `errorCode = null` and a `resultRef` naming the continuation Job when the batch requested one, else this Job. A `failed` Job carries exactly one code below, of the `^[A-Z][A-Z0-9_]{0,63}$` grammar; a code never contains a value, row, label or term id.

| Delivery result                                                                | Job state   | errorCode                         |
| ------------------------------------------------------------------------------ | ----------- | --------------------------------- |
| the claim receipt is refused before any call (type, token or version mismatch) | `failed`    | `MERGE_CONVERGE_CLAIM_INVALID`    |
| the Job actor no longer holds `cms.taxonomy_curator` (`capability_missing`)    | `failed`    | `CAPABILITY_MISSING`              |
| no such Job, or a Job of another type (`NOT_FOUND`)                            | `failed`    | `MERGE_CONVERGE_JOB_UNKNOWN`      |
| the request is invalid (`INVALID_REQUEST`)                                     | `failed`    | `MERGE_CONVERGE_REQUEST_INVALID`  |
| a lock or lease conflict on every attempt                                      | `failed`    | `MERGE_CONVERGE_CONFLICT`         |
| a timeout, provider fault or unknown token on every attempt, or no budget left | `failed`    | `DEPENDENCY_UNAVAILABLE`          |
| no effect is wired or the effect threw (dispatcher guard)                      | `failed`    | `DEPENDENCY_UNAVAILABLE`          |
| the effect answered outside this disposition set (dispatcher guard)            | `failed`    | `MERGE_CONVERGE_OUTCOME_UNMAPPED` |
| the answer broke its contract on every attempt                                 | `failed`    | `DEPENDENCY_INVALID_RESPONSE`     |
| the batch converged                                                            | `succeeded` | null                              |

**Merge convergence recovery (DEC-194; BE00 571 domain recovery reference).** A scheduled reconciliation sweep, run by the Worker scheduler in the pattern of the CMS-03C-19 sweep, calls `platform_api.cms_reconcile_taxonomy_merge_converge()` (executable by `service_role` only; private SECURITY DEFINER body `platform_private.cms_reconcile_taxonomy_merge_converge()` owned by the CMS definer with an empty `search_path`, executable by no API role). For each acting party that has a `failed` `cms.taxonomy.merge_converge` Job, still has merged-term work, and has no `queued` or `running` Job of the type, it requests one fresh convergence Job bound to the failed Job's actor and acting party, under an idempotency key derived from the failed Job's id (so a replayed tick requests nothing twice). It requests at most one Job per acting party per 15 minutes and stops after 3 consecutive failed generations for that party, leaving the alert to `platform.on_call`. It records each reconciled failed Job once in the non-aggregate support table `platform_private.taxonomy_merge_recoveries` (failed Job id → requested Job id, cascading with the failed Job row; DEC-212), so a replayed tick requests nothing twice even after the request idempotency receipt expires; it answers `{ requested }` (a count, no ids), writes nothing else, and until its next successful generation the unconverged assignments keep resolving to the survivor through the retired id's redirect.

### Related-content eligibility and derived rules (D11, OD-5)

**Eligible targets.** For CMS-03C-05 a **pin** target must be an entry that (a) exists and differs from the source, (b) has lifecycle `active`, (c) belongs to the same owner party as the source, and (d) is readable by the caller under the draft-read predicate (the caller is assigned to it or holds owner-party scope), so a recommendation can never grant access to something the editor could not already see. An **exclusion** target must exist and be readable by the caller; its lifecycle is not constrained. An ineligible, hidden or absent pin or exclusion is one uniform 422 `RELATED_CONTENT_VALIDATION_FAILED` `related_target_ineligible` at `/pins/{n}` or `/exclusions/{n}`, so a write is never an existence oracle. Rules are append-only versions: a request replaces the whole rule set (pins in array order as `position`, exclusions, derived rule) by appending `revoked` rows for removed items and `active` rows for new ones, and `If-Match` is the source entry `version`.

**Derived rules (OD-5).** The code-owned rule registry `CMS_RELATED_RULES` has two members at version 1: `shared-terms` (reason `shared_terms`) and `same-type-recent` (reason `same_type_recent`); a rule row selects exactly one, `derivedRule.reasonCode` is an equality expectation of the registry value, and an unknown key or version is 422 `derived_rule_unknown`. Candidates are always **eligible public targets**: entries of the same owner with an `active` publication head for the requested locale and audience, other than the source, not excluded, and not already pinned. `shared-terms` ranks by the number of active terms shared with the source's term assignments (the published revision's in a public projection, the draft's in an editorial preview) descending, then the target head's `created_at` descending, then `entryId` ascending; `same-type-recent` keeps candidates of the source's content type ranked by the head's `created_at` descending then `entryId` ascending. At most `maxCandidates` (1–128) derived candidates are used. A rule is never evaluated at write time except to compute `eligibleCount` (the eligible pins plus the derived candidates for the source revision's locale and the audience of the source's most recent active publication, 0 derived when it has none).

**Public projection (CMS-03C-21).** `cms_related_content_public_targets(source, locale, audience)` returns at most 128 `RelatedPublicTarget`s: eligible pins first in `position` order (public eligibility: the target's lineage head is an `active` `publish` row for `(locale, audience)` and no hold applies), then derived candidates in rank order, with exclusions always removed and a vacated slot refilled only from the eligible derived candidates. It is recomputed at every projection, preview and publication and never stored; a target that becomes unpublished or private disappears from the output while its editorial explanation and history stay private.

### Locale field resolution (DEC-121, DEC-138) and fan-out (D12)

**Resolution helper.** `platform_private.cms_resolve_locale_field(entry, locale, field)` (CMS-03C-20) is the single resolver used by the 03b `locale` preflight provider, by Shard 04 delivery projection (04c) and by editorial reads. For a localizable field `F` of the active schema version it returns a `LocaleFieldResolution`: with `localizationMode` `none` the value is the source-locale value; with `localized` (fallback permitted) the value is `F` in the target locale's own revision when present (a **stale** value is still served and flagged `stale: true`), otherwise the first locale of the active version's `fallbackChains[locale]` (ordered, at most 16, ending at the default locale) that has a value, recording `resolvedFromLocale` and provenance `localized_fallback`, otherwise `missing`; with `no_fallback` the value comes **only** from the target locale's own revision and is never resolved through `fallbackChains` to the default locale or any other locale: a missing value is `no_fallback_missing` and a stale one `no_fallback_stale`, both `blocking: true`. A stale `localized` field never blocks and never falls through to another locale (DEC-121, AC-052).

**Locale preflight provider.** `cms.locale.no_fallback_gate` version 1 (registered by Slice 12 in the 03b preflight registry, replacing the reference gate for the `locale` category) evaluates every `no_fallback` field of the revision's schema for the revision's locale in one statement: every blocking resolution fails the category with the reason `no_fallback_missing` or `no_fallback_stale` (counted into `cms_no_fallback_block_total`), in the `schedule`, `publish` and `execute` phases a revision whose locale variant is not in the effective state `approved`, `scheduled` or `published` (E2 over the locale revision) fails with `locale_variant_not_approved`, the `submit` phase never applies this approval check (a locale revision is an effective `draft` at submit, CMS-03B-05, so the approval is reached through the review that submit opens), a missing `no_fallback` value outranks a stale one and a stale one outranks the approval check (DEC-192), and otherwise the category passes. It is the same helper CMS-15 delivery consumes, so a field blocked at publication is never resolved differently at delivery.

**Derived variant state.** A stored LocaleVariant row is `draft` (written by CMS-03C-04) or `stale` (appended by the source-change fan-out); the browser `LocaleVariantState` also shows `review` and `approved`, **derived** from the editorial review of the locale revision by the 03b effective-state rule (`submitted` shows `review`; `approved`, `scheduled` and `published` show `approved`, consistent with the DEC-192 approval gate that admits a `scheduled` locale revision) and `untranslated` when no variant exists for the locale. Staleness is per field: the variant records `field_source_hashes` (the source value hash of each translated field at write time), a field is stale when the current source value hash differs, and `staleFieldIds` carries them; unchanged fields keep their approved state. Explicit revalidation is a new CMS-03C-04 write with the current `sourceHash`, which appends a `draft` row and returns to `approved` only through the revision's editorial review.

**Fan-out bound and event key (D12).** A source-locale change appends stale rows synchronously for at most 32 dependent locale variants per entry; the 33rd distinct locale variant is refused 409 `LOCALE_VERSION_CONFLICT` `locale_limit_reached` (the new-locale refusal), which the 03a limit of 32 supported locales already makes unreachable in a valid configuration. Every locale variant and every stale row is a version of the locale aggregate `(entry, locale)`: the outbox identity of `cms.localization.changed.v1` is the triple aggregateType `cms_locale_variant`, aggregateId a UUIDv5 over the entry id and locale under the fixed namespace `cms.locale.aggregate.v1`, and aggregateVersion the variant row's `version`, so the author RPC and the fan-out writer never share a dedupe key. `cms_locale_stale_total` counts stale fields at append (read from the database, `Database-side locale observability (DEC-208)`) and `cms_no_fallback_block_total` counts blocking gate evaluations.

### Preflight providers registered by Slice 12

Slice 12 registers three providers in the 03b preflight registry by forward migration, each a newer registry row that replaces the `preflight.reference_gate` row of its category (`Publication preflight registry`, 03b): `cms.pattern.active_digest` version 1 (category `pattern`, database) requires every PatternVersion in the manifest to be `active` with an equal `content_hash` and the `blockRegistryDigest` recomputed over the reachable set to equal the frozen one (reasons `pattern_not_active`, `nested_pattern_not_active`, `pattern_digest_changed`, `pattern_block_rules_violated` (DEC-210); when several pins of the manifest fail, the category reports the first reason present in that order; DEC-199 additionally rechecks every pinned nested version reached through a live use for active state and the existing same-owner/all-parent-compatible-types graph rule, with a missing, inactive or incompatible nested version failing `nested_pattern_not_active`), where a row that carries a nonnull `detached_tree` has its `patterns` entry as provenance only and its reachable set as the detached tree's own blocks, never reopened through the pin, while a plain `detached` row with a NULL `detached_tree` (a CMS-03C-02 `linkMode: detached` row) is not exempted and keeps its defined pinned render and checker behavior (DEC-193); `cms.taxonomy.assignment_integrity` version 1 (category `taxonomy`, database) requires every `active` TermAssignment of the revision to name an `active` term (a `deprecated` term is tolerated for an existing assignment, and a `merged` term whose assignment has not converged fails `term_merged_unconverged`), the vocabulary's active version to still list the entry type key and field key (`allowlist_changed`), and every manifest taxonomy version id to be `active` (`taxonomy_version_not_active`) (DEC-229: when several fail, the category reports the first reason present in the order `term_merged_unconverged`, `allowlist_changed`, `taxonomy_version_not_active`, and `blockingCount` is the number of offending assignments plus offending manifest versions, as for the pattern provider); and `cms.locale.no_fallback_gate` version 1 (category `locale`, database) as defined by `Locale field resolution`. The `route`, `media` and `privacy` categories stay on the reference gate until Slices 13, 14 and 16 register theirs.

### Receiving obligations from Slice 10 (DEC-141)

Slice 10 carries taxonomy-version ids and composition and term records by identity and fails closed where it needs resolution; Slice 12 receives both obligations.

1. **Taxonomy-version resolution in comparison and restore lineage.** Slice 12 registers `platform_private.cms_resolve_taxonomy_version(p_taxonomy_version_id uuid)`, which resolves any taxonomy version id of the caller's owner scope, in any state (`draft` through `retired`), to `{ taxonomyId, taxonomyKey, taxonomyVersion, state, contentHash }`; an id that is absent or outside the owner scope is the non-disclosing `comparison_unavailable`. With the provider registered, CMS-03B-03 comparison and the CMS-03B-04 lineage compare recorded taxonomy versions by that identity and no longer fail closed for a non-empty reference.
2. **Restore translation of composition instances.** `cms_restore_revision` selects the named source revision's newest row at each composition path before filtering eligibility and carries only its `active` rows into the new draft revision. Under DEC-201, resolve each selected child's recorded parent within that source owner/revision to its logical path and reconnect it to the fresh destination copy of that path's newest eligible active parent, including when the recorded parent ID is historical. An excluded parent or an unrepresentable remapped graph, including a collapsed cycle, refuses the entire restore atomically under the existing restore validation/translation boundary; never resurrect older excluded history, drop or detach a child, fabricate a parent or retain a cross-revision edge. Copies have fresh identities and immediate `carried_from_id` provenance and are inserted parent-first. Each instance keeps its path, `position` (DEC-185), link mode and detached local block tree (DEC-193) and is re-pinned to the current registry, so a pinned block version, or a block of a detached tree, that is `withdrawn` fails the restore 409 `migration_chain_incomplete`, a pinned pattern version that is no longer `active` fails it the same way unless the instance is `detached`, and a slot path absent from the current compatible template fails it 409 `template_incompatible`; nothing is fabricated. DEC-201 does not carry `pending_diff` or `draft` heads and does not change the ordinary DEC-198/200 carry policy.
3. **Restore translation of term assignments.** (DEC-229: a TermAssignment's taxonomy foreign key is a storage key — the assigned term's own `(taxonomy_version_id, owner_id)` identity — and never names the governing version; the governing versions are the revision's recorded `taxonomy_version_ids`.) Each `active` TermAssignment of the source revision is carried to the new revision: an assignment to an `active` term carries unchanged, a `deprecated` term carries (it stays resolvable), a `merged` term is re-pointed to its surviving successor, and an unknown or other-vocabulary term fails the restore 409 `migration_chain_incomplete`. The new revision's `taxonomy_version_ids` are the vocabularies' current `active` version ids — exactly one per vocabulary with a carried assignment, the rule every revision writer applies (AC-246); a source-recorded version whose vocabulary has no carried assignment is not carried (DEC-240). A vocabulary with no `active` version cannot carry: its assignments refuse the restore 409 `migration_chain_incomplete`, a new value naming its terms is 422 `term_unavailable`, and a revision that still records one of its versions fails the provider with `taxonomy_version_not_active` (review V12-13).
4. **Revision append carry-over.** The Slice 12 migration extends `cms_create_revision` and `cms_resolve_conflict` to select the source revision (for `cms_create_revision` its base revision; for `cms_resolve_conflict` the entry's current draft `theirs`, never the conflict base, because CMS-03C-02 and CMS-03C-15 write composition only to the current draft, DEC-209)'s newest row at each composition path before filtering eligibility, then carry its `active` or `pending_diff` rows into the new revision (DEC-198). A copied pending row remains `pending_diff` with the same pin and `pending_pattern_version`; an autosave never accepts its target, clears the unanswered update or resurrects older active history under an ineligible newest head. These are fresh append-only rows with immediate `carried_from_id` provenance and valid destination parent remapping. Under DEC-200, resolve each recorded parent within the source owner/revision to its logical path and reconnect to that path's newest eligible copied head, including when the recorded ID is historical. No eligible parent or an unrepresentable remapped graph refuses the whole command atomically; never resurrect excluded history, drop/detach a child or retain cross-revision edges. Copies retain every source semantic member, including `position` (DEC-185), `detached_tree` (DEC-193), overrides and bindings, unless the command's pointers explicitly change them. `cms_restore_revision` separately carries and translates the named source revision's newest eligible `active` rows under obligation 2; DEC-198 does not widen that restore policy.
5. **Taxonomy field values.** The 03b `taxonomy` value encoder, which fails closed with `taxonomy_source_unavailable` until this authority exists, is replaced by the rule of 03b `Value encodings by field kind` once this slice registers the taxonomy authority: each `termId` must be an `active` term of a vocabulary whose active version lists the entry's content type key and the field's key, else 422 `term_unavailable`; a `deprecated` term that the source revision already assigns in the same field is an existing assignment and stays accepted when the value is re-sent (`cms_create_revision` and `cms_resolve_conflict` alike), and a value naming the same `termId` twice is refused 422 `VALIDATION_FAILED` at the field pointer (DEC-233).

### Template reads, reserved keys and per-owner uniqueness (D7, E13, E14)

`cmsTemplateLatestRead` (`GET /api/v1/cms/templates/{templateKey}`, D7) returns the caller owner's **latest** template version for `templateKey` as `TemplateVersionDetail` (the resource plus `slots`, `bindings`, `locale` and `audience`, no owner or authority field), for the designer edit form; the key is resolved only within the caller's owner scope, so a key held by another owner is the same 404 as an unused one. Editing creates a successor through CMS-03C-01 with the read version as `expectedVersion`. The browser pages `/app/cms-content-modeling/templates/new` and `/app/cms-content-modeling/templates/{templateKey}` and the routes `GET /api/v1/cms/templates/context` and `POST /api/v1/cms/templates/versions` share the `templates` path segment, so `context`, `versions` and `new` are reserved template keys (E13, `key_reserved`) and `context`, `versions`, `selector` and `new` reserved pattern keys, enforced by the contracts schema and a SQL CHECK. Uniqueness of `(template_key, version)`, `(pattern_key, version)` and `(taxonomy_key, version)` is per owner (E14, `UNIQUE (owner_id, key, version)`), because a global constraint leaked the existence of another owner's keys through a 409.

## Database Schema

03c persists exactly fifteen private Supabase PostgreSQL tables with RLS enabled and forced: the nine definition and assignment tables TemplateVersion, PatternVersion, CompositionInstance, TaxonomyVersion, TaxonomyTerm, TermLabel, TermAssignment, LocaleVariant, and RelatedContentRule, and the six Slice 12 tables GovernedReview, GovernedReviewDecision, GovernedReviewAssignment, GovernedReviewDependency, GovernedActivationSchedule and CanonicalDomainRegistry. It also persists one non-aggregate job-recovery support table outside the `cms_` aggregate namespace, `platform_private.taxonomy_merge_recoveries` (DEC-194, DEC-212), likewise RLS-forced with no browser-role grant; it carries no CMS aggregate envelope. Its columns are exactly `failed_job_id uuid PRIMARY KEY REFERENCES platform_private.jobs(id) ON DELETE CASCADE`, `recovery_job_id uuid NOT NULL` (deliberately no foreign key: the row is the durable record that the failed Job was already re-requested, whatever later happens to the requested Job) and `requested_at timestamptz NOT NULL DEFAULT clock_timestamp()`; only the CMS definer may SELECT and INSERT it, under the RPC context, and nothing updates or deletes it except the cascade. Browser roles have no direct table grants; named RPCs perform version, capability, cycle, target, and idempotency checks. BlockDefinitionVersion remains the 03a-owned table and is consumed by immutable key/version/digest.

### Canonical records and fields

| Model / table                                              | Typed fields, constraints, nullability, and FKs                                                                                                                                                                                                                                                                                                                                                                                               | Query indexes and write rules                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BlockDefinitionVersion / 03a cms_block_definition_versions | 03a-owned dependency, not a 03c table: id uuid PK, owner_id uuid NOT NULL, physical state `registered`; API lifecycle is derived from append-only supported → deprecated → withdrawn lifecycle events, version bigint >0, created_at, updated_at, canonical block_key and block_version, props ref/hash/signed snapshot, renderer, release digest/principal and immutable verification evidence.                                              | 03a owns UNIQUE(block_key,block_version), forced RLS, and signed registration/lifecycle RPC and lifecycle event; 03c may only SELECT the safe BlockDefinitionRegistryRecord with literal `resourceKind: 'block_definition_registry_record'`; no duplicate insert/update/delete or route.                                                                                                 |
| TemplateVersion / cms_template_versions                    | id uuid PK, owner_id uuid NOT NULL, state closed enum draft, review, approved, scheduled, active, superseded, retired, blocked, version bigint >0, lifecycle_version bigint NOT NULL DEFAULT 1 CHECK (lifecycle_version > 0), created_at, updated_at; template_key regex /^[a-z][a-z0-9-]{1,63}$/; compatible type IDs, slots, reserved regions, binding manifest, BCP 47 locale, bounded audience, content_hash, and computed block_registry_digest char(64) lowercase hex; supersedes_id and created_by are typed FKs. Slice 12 delta: template_id uuid NOT NULL (the lineage id: the version-1 row's id); activated_at timestamptz NULL; retired_at timestamptz NULL; audience CHECK audience ~ '^[a-z0-9_-]{1,48}$' (E4); CHECK template_key NOT IN ('context','versions','new') (E13). | UNIQUE(template_key,version); INDEX(template_key,state,version DESC); INDEX(owner_id,state,updated_at DESC). Draft state transitions use the named RPC; definition fields never update, activation makes the definition immutable, and immutable definition rows reject DELETE and reject every UPDATE other than the guarded lifecycle-metadata transition (`state`, `lifecycle_version`, `activated_at`, `retired_at`, `updated_at`) through the governed RPCs, so `updated_at` moves only with such a transition (DEC-188). No uploaded markup/code. Slice 12 delta: `UNIQUE(template_key,version)` is replaced by `UNIQUE(owner_id,template_key,version)` (E14); `UNIQUE(template_id) WHERE state='active'`; activation makes the definition immutable while `state`, `lifecycle_version`, `activated_at`, `retired_at` and `updated_at` advance only through the governed RPCs; the definition `version` is immutable and the internal `lifecycle_version` counter advances by exactly one per governed transition (DEC-188). |
| PatternVersion / cms_pattern_versions                      | id uuid PK, owner_id uuid NOT NULL, state closed enum draft, review, approved, scheduled, active, superseded, retired, blocked, version bigint >0, lifecycle_version bigint NOT NULL DEFAULT 1 CHECK (lifecycle_version > 0), created_at, updated_at; pattern_key regex /^[a-z][a-z0-9-]{1,63}$/; acyclic block_tree JSONB object whose every blockKey is canonical BlockKey; computed lowercase block_registry_digest char(64), content_hash, owner_capability, created_by. Slice 12 delta: pattern_id uuid NOT NULL (lineage id); compatible_type_ids jsonb NOT NULL CHECK array of 1–64 UUIDs (OD-2); node_count smallint NOT NULL CHECK node_count BETWEEN 1 AND 512; activated_at timestamptz NULL; retired_at timestamptz NULL; CHECK pattern_key NOT IN ('context','versions','selector','nestable','new') (E13; `nestable` since DEC-232); block_tree is the bounded `PatternNode` forest. | UNIQUE(pattern_key,version); INDEX(pattern_key,state,version DESC); INDEX(owner_id,state,updated_at DESC). The server resolves/recomputes the digest at pattern create/activate and publication preflight; draft transitions are RPC-only and active rows reject DELETE and reject every UPDATE other than the guarded lifecycle-metadata transition through the governed RPCs, while definition fields and the definition `version` never change (DEC-188). Slice 12 delta: `UNIQUE(pattern_key,version)` is replaced by `UNIQUE(owner_id,pattern_key,version)` (E14); `UNIQUE(pattern_id) WHERE state='active'`; lifecycle columns (`state`, `lifecycle_version`, `activated_at`, `retired_at`, `updated_at`) advance only through the governed RPCs, the internal `lifecycle_version` counter advancing by exactly one per governed transition while the definition `version` stays immutable (DEC-188). |
| CompositionInstance / cms_composition_instances            | id uuid PK, owner_id uuid NOT NULL, state closed enum draft, active, pending_diff, superseded, retired, version bigint >0, created_at, updated_at; revision_id FK; path/slot; block_key CHECK /^[a-z][a-z0-9._-]{0,95}$/; positive block_version; optional pattern/version; computed block_registry_digest; linked/detached mode; props/bindings; optional parent instance; created_by. Slice 12 delta: pending_pattern_version integer NULL (non-null exactly when state = 'pending_diff'); carried_from_id uuid NULL REFERENCES cms_composition_instances(id) (revision-append and restore carry-over provenance); position integer NOT NULL CHECK (position >= 0) (DEC-185: the authored order of a row within its (revision_id, slot_key); the forward migration backfills every existing row with the dense rank, from 0 and bytewise `COLLATE "C"`, of its path among the distinct paths of its (revision_id, slot_key), so all versions of a path share one position and the render order before the migration is unchanged). DEC-175 placement rule: `block_key` and `block_version` stay NOT NULL because a pattern placement writes one row per block root of the pinned pattern version (a top-level nested pattern reference is expanded into that pattern's own block roots first, DEC-181), each row carrying that block root's block identity, pinned to the placed `(pattern_id, pattern_version)` and taking the `slotPath` joined with `/` and its key chain as `path` (the root's `key`, led by the keys of the nested pattern references it was expanded through; at most 248 octets; DEC-186); child nodes are never rows. DEC-193: detached_tree jsonb NULL, the detached local block tree of a row that `detach` appends or that an accept appends for a `structure` or `removed_root` collision answered `yours`: CHECK an object `{ format: 'cms.detached_tree.v1', nodes: [...] }` whose `nodes` is a JSON array of 1–512 node objects in tree pre-order (a node before its descendants, siblings in order), each exactly `{ parent, keySegments, blockKey, blockVersion, props }`: index 0 is the sole root and its `parent` is null; every other `parent` is the integer index of a node already open on the active pre-order stack (an ancestor whose subtree is still being built), so a parent is always an earlier index and a closed subtree is never reopened (a parent list like `[null, 0, 0, 1]` is rejected); `keySegments` is a non-empty array of complete anchored ASCII key segments `^[a-z][a-z0-9_-]{0,63}$` relative to that parent, preserving the intervening nested-pattern reference namespaces and the row's block-root key chain, from which the reconstructed absolute addresses are unique with consistent ancestry and sibling order; `blockKey` is the canonical BlockKey, `blockVersion` 1–2147483647, and `props` copies the node's effective props exactly under the existing per-value pattern and `overrides` bounds, with no object coercion and no aggregate 128-key, 256 KiB or depth bound on the snapshot as a whole, so no valid instance is refused; CHECK (detached_tree IS NULL OR (link_mode = 'detached' AND props = '{}' AND the index-0 node's `blockKey` and `blockVersion` equal `block_key` and `block_version`)); one pure immutable validator is shared by the CHECK and the producers, as for `block_tree`. | UNIQUE(revision_id,path,version); INDEX(owner_id,revision_id,slot_key); INDEX(pattern_id,pattern_version); block key/version and the nested tree are checked against the 03a safe registry; CAS and linked diff/accept/detach are required. Each instance version is append-only with updated_at=created_at; UPDATE/DELETE rejected. Slice 12 delta: every composition write (CMS-03C-02, CMS-03C-15, the linked-update scan, the carry-over) appends a row and invalidates the revision's live editorial review in the same transaction; a placement appends one or more rows (at most 512, the node cap after expansion) in one transaction, all-or-nothing (DEC-175, DEC-181), at consecutive `position`s in forest order starting one above the slot's greatest (0 for an empty slot); every other append (CMS-03C-15 accept and detach, the linked-update scan, restore, the carry-over) copies the position of the row it follows, and the `position` of a `path` never changes (DEC-185). DEC-193: a row placed on a path whose newest row is `retired` is that path's next version and keeps its position, and a path whose newest row is not `retired` is occupied (409); accept appends a `retired` row for a removed root answered `theirs` and, for a `structure` or `removed_root` collision answered `yours`, a `detached_tree` row materializing the tree every explicit choice resolves to (an ordinary `detach` copies the current effective content unchanged instead), both keeping the pin of the row they follow, and never a linked row pinned to a version whose forest lacks the row's block root; `detach` admits any linked pattern-origin row including a `retired` one; restore and the carry-over copy `detached_tree` unchanged. |
| TaxonomyVersion / cms_taxonomy_versions                    | id uuid PK, owner_id uuid NOT NULL, state closed enum draft, review, approved, scheduled, active, superseded, retired, blocked, version bigint >0, lifecycle_version bigint NOT NULL DEFAULT 1 CHECK (lifecycle_version > 0), created_at, updated_at; taxonomy key, owner capability, flat/hierarchical shape, allowlisted type/field keys, content hash, and created_by. Slice 12 delta: taxonomy_id uuid NOT NULL (the vocabulary lineage id); canonical_overlap_domains jsonb NOT NULL DEFAULT '[]' CHECK array of at most 6 unique members of role, instrument, gear, place, rights, jurisdiction (DEC-135); activated_at timestamptz NULL; retired_at timestamptz NULL. | UNIQUE(taxonomy_key,version); INDEX(owner_id,taxonomy_key,state,version DESC). Canonical overlap is checked against the protected allowlist; key/definition fields are immutable, draft transitions are RPC-only, and active rows reject definition UPDATE/DELETE; the guarded lifecycle metadata (`state`, `lifecycle_version`, `activated_at`, `retired_at`, `updated_at`) advances only through the governed RPCs, the internal `lifecycle_version` counter advancing by exactly one per governed transition while the definition `version` stays immutable (DEC-188). Slice 12 delta: `UNIQUE(taxonomy_key,version)` is replaced by `UNIQUE(owner_id,taxonomy_key,version)` (E14); `UNIQUE(taxonomy_id) WHERE state='active'`; a version holds rules only, the terms belong to the vocabulary. |
| TaxonomyTerm / cms_terms                                   | id uuid PK, owner_id uuid NOT NULL, physical envelope lifecycle closed enum active, deprecated, merged (the explicit IA exception; no duplicate state), version bigint >0, created_at, updated_at; taxonomy_version_id FK; stable term_key, parent, aliases, optional successor FK, created_by; successor cannot equal self. Slice 12 delta: taxonomy_id uuid NOT NULL (the vocabulary lineage id); taxonomy_version_id is the version in force when the row was written. | UNIQUE(taxonomy_version_id,term_key,version); INDEX(owner_id,taxonomy_version_id,lifecycle); INDEX(parent_term_id); INDEX(successor_id). Parent-cycle checks and lifecycle transitions use the named RPC; merged rows cannot reactivate, and terminal rows reject UPDATE/DELETE with updated_at=created_at. Slice 12 delta: `UNIQUE(taxonomy_version_id,term_key,version)` is replaced by `UNIQUE(taxonomy_id,term_key,version)` so term ids and keys are stable across taxonomy versions; merge convergence re-points assignments by appending superseding rows. |
| TermLabel / cms_term_labels                                | id uuid PK, owner_id uuid NOT NULL inherited from the taxonomy aggregate, state closed enum active, retired, version bigint >0, created_at, updated_at; term_id FK; BCP 47 locale; NFC label/optional description; aliases JSONB array; created_by.                                                                                                                                                                                           | UNIQUE(term_id,locale,version); INDEX(owner_id,term_id,locale,state). Labels are immutable per version (updated_at=created_at); replacement creates a new ID/version and UPDATE/DELETE is rejected.                                                                                                                                                                                      |
| TermAssignment / cms_term_assignments                      | id uuid PK, owner_id uuid NOT NULL inherited from the entry aggregate, state closed enum active, superseded, revoked, version bigint >0, created_at, updated_at; revision, field, term, taxonomy FKs; position; provenance authored, inherited, system_rule; created_by.                                                                                                                                                                      | UNIQUE(revision_id,field_definition_id,term_id,version); INDEX(owner_id,revision_id,field_definition_id,position); INDEX(term_id,state). Assignment rows are append-only with updated_at=created_at; replacement/revocation creates a new version and UPDATE/DELETE is rejected. Allowlist and publication checks run transactionally.                                                   |
| LocaleVariant / cms_locale_variants                        | id uuid PK, owner_id uuid NOT NULL inherited from the entry aggregate, state closed enum untranslated, draft, review, approved, stale, version bigint >0, created_at, updated_at; entry/revision/source revision FKs; target/source BCP 47 locales; source hash; fallback chain; no-fallback field IDs; optional approval evidence; created_by; target locale differs from source. Slice 12 delta: field_source_hashes jsonb NOT NULL DEFAULT '{}' CHECK object of at most 128 field-id keys to 64-hex hashes (the source value hash of each translated field at write time); stale_field_ids jsonb NOT NULL DEFAULT '[]' CHECK array of at most 128 UUIDs; the physical state is `draft` or `stale` (the displayed `review`, `approved` and `untranslated` are derived). | UNIQUE(entry_id,locale,source_revision_id,version); INDEX(owner_id,entry_id,locale,state); INDEX(source_revision_id,source_hash). Each locale snapshot is immutable (updated_at=created_at); source changes append a stale/new variant row, and UPDATE/DELETE is rejected. no_fallback fields block publication when absent/stale. Slice 12 delta: the fan-out writer and the author RPC each append a row per (entry, locale) version, never sharing an outbox identity. |
| RelatedContentRule / cms_related_content_rules             | id uuid PK, owner_id uuid NOT NULL inherited from the source entry aggregate, state closed enum active, revoked, version bigint >0, created_at, updated_at; source/optional target entry FKs; optional rule key/version; mode pin, exclude, derived; reason code; optional position; created_by; derived rows have no target and pin/exclude rows require one. Slice 12 delta: rule_key and rule_version are validated by `platform_private.cms_related_rule_valid` (code-owned members `shared-terms` and `same-type-recent` at version 1). | UNIQUE(source_entry_id,target_entry_id,mode,version); UNIQUE(source_entry_id,mode,version) WHERE mode='derived'; INDEX(owner_id,source_entry_id,state,mode,position); INDEX(target_entry_id,state). Rules are append-only (updated_at=created_at); revoke creates a new version and UPDATE/DELETE is rejected. Exclusions win and target authorization is rechecked at read/publication. |
| GovernedReview / cms_governed_reviews | id uuid PK; owner_id uuid NOT NULL; state text NOT NULL CHECK state IN ('open','approved','rejected','invalidated'); version bigint NOT NULL CHECK version > 0; subject_kind text NOT NULL CHECK subject_kind IN ('template_version','pattern_version','taxonomy_version'); subject_id uuid NOT NULL (the exact subject version row; polymorphic by design and validated by `platform_private.cms_governed_subject_resolve(kind,id)` in the RPC and a BEFORE INSERT trigger); lineage_id uuid NOT NULL; subject_key text NOT NULL CHECK subject_key ~ '^[a-z][a-z0-9-]{1,63}$'; subject_version bigint NOT NULL CHECK subject_version > 0; subject_hash char(64) NOT NULL CHECK subject_hash ~ '^[a-f0-9]{64}$'; block_registry_digest char(64) NULL; risk_class text NOT NULL CHECK risk_class IN ('ordinary','protected'); required_decision_count smallint NOT NULL CHECK BETWEEN 1 AND 8; recorded_decision_count smallint NOT NULL DEFAULT 0 CHECK BETWEEN 0 AND 8 AND recorded_decision_count <= required_decision_count; required_capabilities jsonb NOT NULL CHECK jsonb_typeof(required_capabilities)='array' AND jsonb_array_length(required_capabilities) BETWEEN 1 AND 16; policy_basis jsonb NOT NULL CHECK jsonb_typeof(policy_basis)='array' AND jsonb_array_length(policy_basis) BETWEEN 1 AND 64; policy_basis_hash char(64) NOT NULL; approval_evidence_hash char(64) NOT NULL (the JCS SHA-256 of `{ policyBasisHash, subjectHash, subjectId, subjectKind }`); submitted_by uuid NOT NULL REFERENCES platform_private.person_party(party_id); submitted_at timestamptz NOT NULL DEFAULT clock_timestamp(); decided_at timestamptz NULL; activated_at timestamptz NULL; invalidated_reason text NULL CHECK (invalidated_reason IS NULL OR invalidated_reason IN ('dependency_changed','reviewer_authority_changed')); created_at timestamptz NOT NULL DEFAULT clock_timestamp(); updated_at timestamptz NOT NULL DEFAULT clock_timestamp(); CHECK((risk_class <> 'protected') OR (required_decision_count >= 2 AND jsonb_array_length(required_capabilities) >= 2)); CHECK((state = 'invalidated') = (invalidated_reason IS NOT NULL)); CHECK((state IN ('approved','rejected')) = (decided_at IS NOT NULL)). | UNIQUE(subject_kind,subject_id) WHERE state IN ('open','approved'); INDEX(owner_id,state,updated_at DESC); INDEX(subject_kind,lineage_id,state); INDEX(submitted_by,updated_at DESC). INSERT only through `cms_submit_governed_review`; frozen columns immutable; `state`, `recorded_decision_count`, `activated_at`, `version` and `updated_at` advance only through the named RPCs under CAS; direct UPDATE/DELETE and table grants revoked. |
| GovernedReviewDecision / cms_governed_review_decisions | id uuid PK; owner_id uuid NOT NULL; state text NOT NULL CHECK state = 'recorded'; version bigint NOT NULL DEFAULT 1 CHECK version = 1; review_id uuid NOT NULL REFERENCES cms_governed_reviews(id); reviewer_person_id uuid NOT NULL REFERENCES platform_private.person_party(party_id); acting_party_id uuid NULL REFERENCES platform_private.party(id); assignment_id uuid NOT NULL REFERENCES cms_governed_review_assignments(id); assignment_version bigint NOT NULL CHECK assignment_version > 0; capability text NOT NULL CHECK octet_length(capability) BETWEEN 1 AND 128 (the satisfied slot); decision text NOT NULL CHECK decision IN ('approve','reject'); reason text NOT NULL CHECK char_length(reason) BETWEEN 1 AND 2000 (code points, DEC-158); comment_hash char(64) NOT NULL; reviewed_hash char(64) NOT NULL; step_up_at timestamptz NOT NULL; decided_at timestamptz NOT NULL DEFAULT clock_timestamp(); created_at timestamptz NOT NULL DEFAULT clock_timestamp(); updated_at timestamptz NOT NULL DEFAULT clock_timestamp(); CHECK(updated_at = created_at). | UNIQUE(review_id,reviewer_person_id); INDEX(review_id,decided_at); INDEX(reviewer_person_id,decided_at DESC). Append-only; a BEFORE INSERT trigger forbids `reviewer_person_id` equal to the review's `submitted_by` or the subject version's creator (a cross-row rule enforced by trigger and RPC, never a CHECK); the reviewer, slot capability and MFA instant are server-derived; `reason` is readable only by its decider; UPDATE/DELETE and direct grants revoked. |
| GovernedReviewAssignment / cms_governed_review_assignments | id uuid PK; owner_id uuid NOT NULL; review_id uuid NOT NULL REFERENCES cms_governed_reviews(id); reviewer_person_id uuid NOT NULL REFERENCES platform_private.person_party(party_id); grantor_person_id uuid NOT NULL REFERENCES platform_private.person_party(party_id); capability_key text NOT NULL CHECK capability_key = 'cms.definition_review'; actions text[] NOT NULL CHECK actions = ARRAY['read','decide']::text[]; state text NOT NULL CHECK state IN ('active','revoked'); starts_at timestamptz NOT NULL; ends_at timestamptz NOT NULL; reason text NULL CHECK reason IS NULL OR char_length(reason) BETWEEN 1 AND 256 (code points, DEC-158); version bigint NOT NULL DEFAULT 1 CHECK version > 0; created_at timestamptz NOT NULL DEFAULT clock_timestamp(); updated_at timestamptz NOT NULL DEFAULT clock_timestamp(); CHECK (ends_at > starts_at); CHECK (ends_at <= starts_at + interval '7 days'). | UNIQUE(review_id,reviewer_person_id) WHERE state='active'; INDEX(review_id,reviewer_person_id,state); INDEX(reviewer_person_id,state,ends_at); INDEX(owner_id,state,ends_at). Created and revoked only by `cms_assign_governed_reviewer`; decide authority requires `starts_at <= now < ends_at` and a non-revoked row, rechecked with the standing capability at decision time; stores no acting context or delegation authority; direct UPDATE/DELETE and grants revoked. |
| GovernedReviewDependency / cms_governed_review_dependencies | id uuid PK; owner_id uuid NOT NULL; state text NOT NULL CHECK state = 'active'; version bigint NOT NULL DEFAULT 1 CHECK version = 1; review_id uuid NOT NULL REFERENCES cms_governed_reviews(id); kind text NOT NULL CHECK kind IN ('block','pattern','content_type','canonical_domain'); ref_id uuid NOT NULL; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(updated_at = created_at); UNIQUE(review_id,kind,ref_id). | INDEX(kind,ref_id); INDEX(review_id). Written only by `cms_submit_governed_review` from the frozen identities; immutable; the recheck job selects live reviews by (kind, ref_id); forced RLS, no grants. |
| GovernedActivationSchedule / cms_governed_activation_schedules | id uuid PK; owner_id uuid NOT NULL; state text NOT NULL CHECK state IN ('pending','executing','completed','failed_retryable','blocked','cancelled'); version bigint NOT NULL CHECK version > 0; review_id uuid NOT NULL REFERENCES cms_governed_reviews(id); subject_kind text NOT NULL; subject_id uuid NOT NULL; local_datetime timestamp NOT NULL; timezone text NOT NULL CHECK octet_length(timezone) BETWEEN 1 AND 64; resolved_at_utc timestamptz NOT NULL; tzdb_version text NOT NULL CHECK octet_length(tzdb_version) BETWEEN 1 AND 32; disambiguation text NOT NULL CHECK disambiguation IN ('none','earlier','later'); expected_version bigint NOT NULL CHECK expected_version > 0 (the approved review's version at acceptance); attempt_count smallint NOT NULL DEFAULT 0 CHECK BETWEEN 0 AND 3; next_attempt_at timestamptz NULL; lease_id uuid NULL; lease_until timestamptz NULL; reason_code text NULL CHECK (reason_code IS NULL OR reason_code IN ('approval_invalidated','dependency_changed','activation_authority_ended','canonical_source_unavailable','retries_exhausted')); actual_at_utc timestamptz NULL; deviation_seconds bigint NULL; created_by uuid NOT NULL REFERENCES platform_private.person_party(party_id); created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK((state IN ('blocked','cancelled')) = (reason_code IS NOT NULL)). | UNIQUE(subject_kind,subject_id) WHERE state IN ('pending','executing','failed_retryable'); INDEX(state,next_attempt_at,resolved_at_utc) WHERE state IN ('pending','failed_retryable'); INDEX(review_id). Written only by CMS-03C-09 (insert) and the claim/execute RPCs of CMS-03C-19 (CAS on state and version); the schedule evidence is never replaced; direct UPDATE/DELETE and grants revoked. |
| CanonicalDomainRegistry / cms_canonical_domain_registry | id uuid PK; owner_id uuid NOT NULL (the seeding release record); state text NOT NULL CHECK state = 'seeded'; version bigint NOT NULL CHECK version > 0; domain text NOT NULL CHECK domain IN ('role','instrument','gear','place','rights','jurisdiction'); provider_state text NOT NULL CHECK provider_state IN ('built','unbuilt'); provider_key text NULL; provider_version bigint NULL; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK(updated_at = created_at); CHECK((provider_state = 'built') = (provider_key IS NOT NULL AND provider_version IS NOT NULL)); CHECK((provider_key IS NULL) = (provider_version IS NULL)) (DEC-238: each member is non-null exactly when `built`); UNIQUE(domain,version). | Seeded by forward migration only and immutable; the current row of a domain is the one with the greatest `version`; Phase 2 seeds `role` as `built` and the other five as `unbuilt`; an owning shard registers its provider by inserting a newer row; never writable by a caller. |

For SQL, every persisted block-key column and every JSON block-tree key is
validated with `CHECK (block_key ~ '^[a-z][a-z0-9._-]{0,95}$')`; the equivalent
request/resource/test grammar is exactly `/^[a-z][a-z0-9._-]{0,95}$/`. Template
and pattern writes reject any alternate block-key grammar before the transaction.

### Permission, RLS and grants

- All 03c tables use forced RLS. authenticated and anon receive no direct write grants. Named RPCs are cms_define_template, cms_insert_pattern_instance, cms_act_taxonomy_term, cms_author_locale_variant, and cms_curate_related_content, plus the Slice 12 commands and reads `cms_template_latest`, `cms_pattern_latest`, `cms_list_taxonomy_versions`, `cms_list_taxonomy_terms`, `cms_submit_governed_review`, `cms_record_governed_decision`, `cms_assign_governed_reviewer`, `cms_activate_governed_subject`, `cms_get_governed_review`, `cms_list_governed_reviews`, `cms_create_pattern_version`, `cms_list_pattern_selector`, `cms_list_pattern_nestable` (cmsPatternNestableRead, DEC-196), `cms_get_instance_update_diff`, `cms_apply_pattern_update`, `cms_create_taxonomy_version`, `cms_list_taxonomy_selector`, and the supporting reads `cms_get_related_content` (cmsRelatedContentRead, DEC-195), `cms_get_locale_variant` (cmsLocaleVariantRead, DEC-205) and `cms_list_composition_instances` (cmsCompositionInstancesRead, DEC-206, DEC-217); the internal RPCs `cms_canonical_taxonomy_match`, `cms_claim_due_governed_activations`, `cms_execute_governed_activation`, `cms_resolve_locale_field`, `cms_related_content_public_targets`, `cms_resolve_taxonomy_version`, `cms_invalidate_governed_reviews_for_person`, the recheck RPC `cms_recheck_governed_reviews(p_request jsonb)` with request `{ eventId, kind, refId, cursor, batch? }` and result `{ examined, invalidated, dependencyChanged, reviewerAuthorityChanged, unavailable, nextCursor }` and its event resolver `cms_governed_recheck_resolve_event` (DEC-218), the linked-update scan `cms_scan_linked_pattern_updates` with its event resolver `cms_linked_scan_resolve_event` (DEC-222), the merge-recovery sweep `cms_reconcile_taxonomy_merge_converge` (DEC-194, DEC-212) and the locale observability read `cms_locale_observability_read` (DEC-208); the support table `platform_private.taxonomy_merge_recoveries` is likewise RLS-forced with no browser-role grant; and the job handlers `cms.pattern.linked_update_scan` and `cms.governed_review.recheck` (typed platform-queue messages) and `cms.taxonomy.merge_converge` (a BE00 jobs row), see `Job transport`.
- TemplateVersion/PatternVersion SELECT requires designer scope in the owner party, or a governed-review read scope (`Governed review machinery`), which reads the review record (its `policyBasis` and `blockRegistryDigest` summarize the exact impact set, `Registry invariants`) and never the definition row (DEC-180, G8); the author selector CMS-03C-13 lists only `active` compatible versions to `cms.author`/`cms.editor`. INSERT is draft-only through RPC; activation is the separate governed transition CMS-03C-09. Reserved Shard 02 profile/provenance regions are protected checks, not caller fields.
- GovernedReview SELECT requires one of the scopes of `Governed review machinery` (submitter, non-revoked reviewer assignee, subject owner-capability holder, receipt-derived owner); a decision's `reason` is readable only by its decider; assignments are serialized only to the owner and the own assignment to its reviewer, with no person, actor or party identifier; GovernedActivationSchedule, GovernedReviewDependency and CanonicalDomainRegistry have no browser or service-role read; the only browser-visible projection of a schedule is the `{state, reasonCode}` member of the CMS-03C-10 detail (DEC-191).
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
| CMS-03C-02   | CMS author/editor with assigned revision edit | the entry's current draft revision (DEC-176); pattern readable and acyclic | visible revision, no edit            | hidden/absent revision/pattern | explicit linked diff or detach                      |
| CMS-03C-03   | verified taxonomy_curator                     | assigned editorial vocabulary; taxonomy/term state permits action | visible vocabulary, no curator scope | hidden/absent taxonomy/term    | canonical overlap, cycle, merge survivor lock       |
| CMS-03C-04   | assigned CMS author/editor                    | source revision readable; field localizable; locale chain valid   | visible entry, no assignment/edit    | hidden/absent entry/source     | source hash, no_fallback, legal/safety gate         |
| CMS-03C-05   | assigned CMS author/editor                    | source entry editable; targets eligible authorized projections    | visible source, no edit              | hidden source                  | exclusions win; recommendations never grant access  |
| cmsRelatedContentRead | assigned CMS author/editor | source entry editable (as CMS-03C-05) | visible source, no edit | hidden source | returns the current active rule or null; pins and exclusions as stored, never target projections |
| cmsLocaleVariantRead | assigned CMS author/editor | entry's localizable fields editable (as CMS-03C-04) | visible entry, no edit | hidden/absent entry or unsupported locale | returns the current variant or null, its stored values, every localizable field's CMS-03C-20 resolution and the active fallback order; never another locale's text in place of a `no_fallback` value |
| CMS-03C-06   | subject owner capability in the owner party (`cms.template_designer` for template and pattern versions, `cms.taxonomy_curator` for taxonomy versions) | subject `draft` with no live review; hash equal; policy basis resolvable | visible subject, no capability | hidden/absent subject | strictest-of policy basis frozen server-side; dependency rows written |
| CMS-03C-07   | assigned reviewer: active `cms.definition_review` assignment plus a standing `cms.reviewer` grant (and the specialist capability for a specialist slot) | review `open`; frozen dependencies current; reviewer is neither submitter nor subject creator and has not decided | readable review without effective assignment or capability, or separation of duties | hidden/absent review | unconditional recent binding MFA; first rejection ends the review |
| CMS-03C-08   | receipt-derived owner with `cms.definition_review.assign` (never grantable) | review `open`; reviewer eligible; expiry within seven days, the reviewer grant end and the grantor authority end; fewer than 16 active assignments | owner capability denied or no valid designer/curator grant | hidden/absent/cross-owner review | unconditional step-up MFA; read/decide on this frozen review only |
| CMS-03C-09   | subject owner capability (as CMS-03C-06) | review at `expectedVersion`; for `activate` and `schedule` the review `approved`, subject hash and dependencies current and canonical providers available for declared domains; for `retire` the subject `active` and no approval, dependency or provider validity (DEC-190) | visible review, no capability | hidden/absent review | unconditional step-up MFA; atomic CAS switch and supersession; the scheduled form is rechecked at fire time for revocation only (DEC-120) |
| CMS-03C-10   | submitter, reviewer assignee (non-revoked), subject owner-capability holder, or the receipt-derived owner | review resolvable under RLS | visible review, no read scope | hidden/absent/cross-owner review | decisions show the caller's own `reason` only; `assignments` owner-only |
| CMS-03C-11   | verified human | `assigned`, `submitted` and `owned` scopes only | not applicable to a scoped list | not applicable to a scoped list | signed cursor bound to query and acting scope |
| CMS-03C-12   | verified human `cms.template_designer` | draft pattern in caller scope; every block registered/current; nested patterns active, compatible and acyclic | visible scope, capability missing | hidden/absent pattern | server-computed digest; reserved keys refused |
| CMS-03C-13   | `cms.author` or `cms.editor` in the owner party | active compatible pattern versions only | not applicable to a scoped list | hidden/absent content type | no draft or non-compatible version is ever listed |
| CMS-03C-14   | assigned CMS author/editor on the instance's revision | instance readable (no newer active compatible version, and a row that is not a linked `active` or `pending_diff` newest version, answers 200 with an empty diff, DEC-180 G4, DEC-193) | visible instance, no edit | hidden/absent instance | bounded three-way diff; no-store |
| cmsCompositionInstancesRead | assigned CMS author/editor | edit authority on the entry's current draft revision (as CMS-03C-02) | visible entry, no edit | hidden/absent entry | current-head `draft`, `active` and `pending_diff` rows of the draft revision in render order, at most `limit` (1–50) per page; never superseded or retired history or another owner's rows |
| cmsPatternNestableRead | `cms.template_designer` in the owner party | active pattern versions compatible with every requested type | not applicable to a scoped list | hidden/absent content type | no draft, non-compatible or other-owner version is ever listed (DEC-196) |
| CMS-03C-15   | assigned CMS author/editor on each instance's revision | each instance the newest version of its path: `pending_diff` or `active` linked (accept) or any linked pattern-origin row, including `retired` (detach, DEC-193); entry and instance versions current | visible instance, no edit | hidden/absent instance | explicit choice for every collision (`props`, `structure`, `removed_root`; DEC-193); bulk only without collisions |
| CMS-03C-16   | verified human `cms.taxonomy_curator` | draft vocabulary in caller scope | visible scope, capability missing | hidden/absent taxonomy | declared canonical domains frozen into the reviewed version |
| CMS-03C-17   | `cms.author` or `cms.editor` in the owner party | active vocabularies whose allowlist names the type and field key; active terms only | not applicable to a scoped list | hidden owner scope (no matching vocabulary is an empty page) | selector never lists a merged or deprecated term |
| cmsPatternLatestRead | `cms.template_designer` in the caller's owner scope | the owner's latest version of the key | visible scope, capability missing | hidden/absent key | no owner or authority field serialized |
| cmsTaxonomyVersionsRead, cmsTaxonomyTermsRead | `cms.taxonomy_curator` in the caller's owner scope | the owner's vocabulary lineage | visible scope, capability missing | hidden/absent vocabulary | no owner or authority field serialized; merged terms listed with their successor |

Known readable resources with insufficient capability return 403. Resources outside disclosure scope, absent IDs, or hidden targets return indistinguishable 404. Structural malformed input is 400 before existence checks.

### Security and abuse controls

- Raw body ceiling 256 KiB; JSON depth 8, keys 128, arrays 128; strict schemas reject HTML, scripts, CSS, expressions, dynamic imports, arbitrary SQL, external URLs, and unregistered block/renderer/projection references.
- **CMS-03C-02 response ceiling (DEC-188/DEC-189).** The decoded JSON response body of CMS-03C-02 (`CMS03C02`) is at most 1,048,576 bytes (1 MiB), response-only, carrying its bounded 1–512-row `PatternPlacementResource`; its request body and every other request and response in 03c stay at 256 KiB, and the raw request, array, key, depth and string limits are unchanged. The 1 MiB ceiling is an approved allowance: a maximum-size success against the actual producer remains required before it is accepted, and because the largest producible response (512 maximal rows) fits under it, an over-budget refusal exists only at the Worker transport and route, never as a producer refusal.
- Composition graphs reject cycles and enforce protected depth/node/slot counts before save and again before publish. Linked pattern changes show a three-way diff; no silent local overwrite and no silent structural adoption: a block identity or children change, a removed block root and the block roots a version adds each wait for the author (DEC-193).
- Taxonomy keys are immutable; rename changes labels, alias preserves lookup, merge locks survivor/retired IDs and migrates assignments idempotently. A merged term cannot reactivate.
- Locale IDs are BCP 47. Fallback is explicit ordered per type/field and records the selected source. no_fallback is the default for legal, safety, and jurisdiction fields. Resolution is specified here (DEC-121, DEC-138) by `Locale field resolution (DEC-121, DEC-138)`: a `no_fallback` field resolves only from its own target-locale variant and is never resolved through `fallbackChains` to the default locale or any other locale, a missing or stale `no_fallback` value blocks publication of that locale (counted in `cms_no_fallback_block_total`), and a stale fallback-permitted field keeps serving the last approved translation and never blocks. Shard 04 delivery (04c) consumes the same resolver and adds no resolution rule of its own.
- Related content uses manual pins first, exclusions always, bounded deterministic derived rules from the code-owned registry with reason/version (`Related-content eligibility and derived rules`). A pin must be an eligible, caller-readable, same-owner active entry and an ineligible, hidden or absent target is one uniform refusal; eligibility and target authorization are rechecked at read, preview, and publication.
- Governed review, decision, assignment and activation (CMS-03C-06 through CMS-03C-09) follow the 03b controls: unconditional recent MFA, separation of duties (the submitter and the subject creator are never reviewers), one decision per human, bounded owner-only assignment, committed invalidation on a changed dependency or policy basis, and no caller-supplied capability, slot, hash or version authority. Retirement removes exposure only: it keeps the unconditional recent MFA, the subject kind's owner capability and the review-`version` CAS through the same review-addressed route and needs no new approval and no dependency, policy, provider or preflight validity (DEC-190).
- Idempotency is bound to operation, actor, acting party, path, body, target, and expected version. Concurrent commands cap at three per actor; duplicate exact commands replay.
- Logs/provider-native diagnostics contain only operation, safe IDs/hashes, version, actor class, outcome, duration, and error. No content, private locale text, labels, target names, or capability graph.

## Data Flow

### Transaction and external seams

CMS-03C-01: parse → authenticate/acting context → template capability → reserve idempotency → read the 03a safe BlockDefinitionRegistryRecord projection for every reachable block → validate slots/bindings/reserved regions/type compatibility → resolve and recompute blockRegistryDigest → insert the TemplateVersion draft with the server digest (a client digest is only an equality expectation) → audit/idempotency. Governed activation (CMS-03C-09) recomputes the same digest before the immutable switch and emits cms.template.activated.v1 only after exact compatibility checks.

CMS-03C-06: parse → authenticate/acting context → subject owner capability → resolve the exact subject version and require `draft`, equal hash and no live review → resolve the policy basis (strictest-of) and the reachable dependencies (for a taxonomy version, a registered provider for every declared canonical domain, else 422 `canonical_source_unavailable`) → reserve idempotency → insert the `open` GovernedReview with its dependency rows, set the subject `review` → audit → 201. CMS-03C-07 follows the 03b ten-step decision order of checks over the governed tables, with its locks taken in `Slice 12 lock order` (the `invalidated` outcome is a committed 409). CMS-03C-08 locks the review row (after the authority positions, `Slice 12 lock order`), validates the reviewer and expiry bounds against `cms.definition_review.assign`, inserts or revokes the assignment, and audits. CMS-03C-09 follows the ordered steps of `Governed activation, retirement and scheduled activation`: step-up → scope → review at `expectedVersion`, then per action — `activate` and `schedule`: `approved` → hash, basis and dependency recheck → kind-specific preflight → the atomic switch of the subject and supersession of the previous active version (or the schedule insert) with audit and, for an immediate activation or execution, exactly one event (schedule acceptance emits none); `retire`: the `active` subject guard → the atomic transition to `retired` with audit and exactly one event (DEC-190). CMS-03C-10, CMS-03C-11, CMS-03C-13, CMS-03C-14 and CMS-03C-17 are safe reads that write nothing and emit nothing.

CMS-03C-02: authenticate assignment → load immutable PatternVersion and safe block registry records → expand graph with cycle/depth/node checks → resolve and recompute the pattern digest at create/activate (and at 03b publication preflight) → lock revision/slot → insert one append-only CompositionInstance row per block root of the pinned forest after expanding top-level nested pattern references, or per root that `roots` names (at most 512, all-or-nothing, DEC-175, DEC-181, DEC-193) at consecutive `position`s after the slot's greatest in forest order (DEC-185; a row placed on a path whose newest row is `retired` keeps that path's position, DEC-193) and with the row `path` of DEC-186, with linked/detached mode → invalidate the revision's live review → audit. A local override collision produces pending_diff and never overwrites.

CMS-03C-03: authenticate curator → resolve the vocabulary's `active` TaxonomyVersion (else 409 `taxonomy_not_active`) → lock the vocabulary's terms in id order → run the canonical overlap check for `create`, `rename` and `alias` over the version's declared domains through CMS-03C-18 (DEC-135) and the hierarchy/cycle check → apply create/rename/alias/deprecate/merge → append superseding assignment versions with the term redirect (in the same transaction up to 5,000 assignments, then the resumable job `cms.taxonomy.merge_converge`) and idempotency → audit/outbox cms.taxonomy.changed.v1. A merge keeps the retired ID as a permanent redirect. CMS-03C-16 creates a draft TaxonomyVersion (rules and declared domains) whose activation is CMS-03C-09.

CMS-03C-04: authenticate assignment/source → load source revision and 03a localizable field definitions → validate BCP 47, membership of `locale` in the active version's `supportedLocales` (03a OD-4) and equality of `fallbackChain` with the active version's chain for `locale` (409 `FALLBACK_CHAIN_MISMATCH` on difference), then no_fallback → insert locale revision/variant → record `field_source_hashes` → append stale versions (with `stale_field_ids`) for source-dependent variants whose field hashes differ, at most 32 per entry (D12), each as its own version of the (entry, locale) aggregate → audit/outbox cms.localization.changed.v1 per appended row. It never borrows another jurisdiction's text.

CMS-03C-05: authenticate source edit → validate pin/exclusion/derived rule against the rule registry → check pin eligibility (exists, active, same owner, caller-readable, not the source) and exclusion existence/readability through the uniform `related_target_ineligible` refusal → compute `eligibleCount` → append `active` rows for new items and `revoked` rows for removed items as new versions → audit. A target that becomes private/unpublished disappears from the public projection (CMS-03C-21); its editorial explanation remains private.

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

- TemplateVersion and PatternVersion: draft → review → approved → scheduled or active → superseded or retired; a rejection or invalidation returns the subject to draft, `blocked` is a failed activation that may re-activate while its review is current or return to draft when the review is invalidated; the full transition table is `Governed review machinery`; definition fields and the definition `version` are immutable from creation, active content is immutable, and only the lifecycle columns (`state`, `lifecycle_version`, `activated_at`, `retired_at`, `updated_at`) advance, only through the governed RPCs (DEC-188).
- CompositionInstance: linked/detached instance changes append a new version; linked update collision is pending_diff until explicit accept/detach; an accept appends a `retired` row for a removed block root answered `theirs` and a detached copy for a `structure` or `removed_root` collision answered `yours` (DEC-193). Parent revision CAS prevents two writers using the same slot path, and each stored version pins the server-recomputed blockRegistryDigest.
- TaxonomyVersion: same definition lifecycle, activated through the governed machinery (OD-1). Term: active → deprecated → merged; merged cannot reactivate and redirects permanently. Term locks serialize merge and assignment, and term ids are stable across taxonomy versions.
- GovernedReview: open → approved, rejected or invalidated, and approved → invalidated; rejected and invalidated are terminal; assignment create/revoke never changes the review state, except that a revoke of an assignment that authorized a counted approval on the review invalidates it `reviewer_authority_changed` in the same transaction (03b DEC-161). GovernedActivationSchedule: pending → executing → completed, failed_retryable, blocked or cancelled, with the 03b ladder. CompositionInstance: a pattern activation appends `pending_diff` for linked draft-revision instances until an explicit accept (active with a newer pin, `retired` for a removed block root, or a detached copy, DEC-193) or detach (detached).
- LocaleVariant: untranslated → draft → review → approved, where `review` and `approved` are derived from the editorial review of the locale revision and only `draft` and `stale` are stored; a source hash change appends an immutable stale snapshot with its stale field ids; explicit revalidation appends a new `draft` version that returns to approved through the editorial review.
- RelatedContentRule: active → revoked by an append-only version; publication/read authorization is evaluated at use time, not inferred from creation.
- Locks: every Slice 12 writer takes its locks in `Slice 12 lock order` (the BE03b global order extended by DEC-157 and DEC-180).
- Duplicate delivery is safe through idempotency/outbox identity and version monotonicity. Unknown event versions go to DLQ. Worker or projection failure never regresses an active version.

### Event schemas

All events use the BE00 identifier-only envelope: eventId UUID, eventType, schemaVersion, occurredAt, producer, correlationId, causationId, aggregateType, aggregateId, aggregateVersion as lossless decimal string, and payload IDs/hashes only.

| Event type                     | Exact payload                                                                                                                                                                                          | Producer / consumer rule                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| cms.template.activated.v1      | { templateId: UUID, templateVersionId: UUID }                                                                                                                                                          | CMS-03C-09 emits after the immutable template switch or retirement; 03b review/publication and Shard 04 preflight consumers refetch exact versions.  |
| cms.pattern.activated.v1       | { patternId: UUID, patternVersionId: UUID }                                                                                                                                                            | CMS-03C-09 emits after the immutable pattern switch or retirement; 03b dependency recheck, the linked-update scan job and Shard 04 preflight consumers refetch exact versions. |
| cms.taxonomy.changed.v1        | { taxonomyId: UUID, taxonomyVersionId: UUID }                                                                                                                                                          | CMS-03C-03 emits after each committed term action and CMS-03C-09 after a taxonomy-version activation or retirement; assignments/search/navigation consumers refetch aliases/terms under authority. |
| cms.localization.changed.v1    | { entryId: UUID, locale: BCP47, revisionId: UUID }                                                                                                                                                     | CMS-03C-04 and the source-change fan-out emit after each appended variant version, each with its own (entry, locale) aggregate version; 03b invalidates review/publication dependencies and consumers refetch exact variant. |
| cms.publication.changed.v1     | { entryId: UUID, publicationVersionId: UUID }                                                                                                                                                          | 03b is producer; 03c needs no consumer (DEC-231): related eligibility is evaluated at read (CMS-03C-21), locale staleness is recorded in the source-change transaction and composition validity follows the governed recheck consumers. It never emits a duplicate publication event.         |
| cms.block.lifecycle.changed.v1 | { blockDefinitionVersionId: UUID, blockKey: BlockKey, blockVersion: positive integer, fromLifecycle: `supported\|deprecated`, toLifecycle: `deprecated\|withdrawn`, releaseDigest: lowercase SHA-256 } | 03a is producer after signed immutable lifecycle append; 03c consumes/refetches the safe registry record and rejects withdrawn/incompatible blocks. |

Events contain no content values, labels, locale text, target names, secrets, tokens, or authority. Retries are max three at 15s/60s/300s, then DLQ and alert. Out-of-order events cannot regress a higher version.

**Outbox identity of the activation and taxonomy events (DEC-180 G3, corrected by DEC-188).** The BE00 dedupe identity `(aggregateType, aggregateId, aggregateVersion)` of `cms.template.activated.v1`, `cms.pattern.activated.v1` and the activation-side `cms.taxonomy.changed.v1` is the subject version row the command switched: aggregateType `cms_template_version`, `cms_pattern_version` or `cms_taxonomy_version`, aggregateId the `templateVersionId`, `patternVersionId` or `taxonomyVersionId` of the payload, and aggregateVersion that row's committed `lifecycle_version` after the switch (an immediate activation, a scheduled execution and a retirement each advance it by exactly one; DEC-188 corrects DEC-180 G3 to the internal lifecycle counter, not the immutable definition `version`). `cms.taxonomy.changed.v1` from a CMS-03C-03 term action uses the term row: aggregateType `cms_term`, aggregateId the term id, aggregateVersion the term `version` after the action. Each committed command therefore has its own unique triple, the `superseded` transition of the previous version emits nothing, and `cms.localization.changed.v1` keeps the per-locale aggregate of `Locale field resolution (DEC-121, DEC-138) and fan-out (D12)`.

### Cross-shard direction

- BE00 supplies errors, request IDs, ETags, idempotency, audit/outbox, CORS/CSRF, queues, rates, SLOs, and recovery fencing.
- BE01 supplies verified person/party/acting context, mandate, capability, assignment, and MFA; 03c stores only IDs.
- 03a supplies the authenticated safe BlockDefinitionRegistryRecord projection with literal `resourceKind: 'block_definition_registry_record'` for immutable BlockDefinitionVersion key/version, props ref/hash, renderer, derived lifecycle, and release digest, plus active schema/field/relation IDs/hashes, SchemaArtifact id/hash/compiler, protected validator refs, and workflow-policy evidence. 03c consumes `cms.block.lifecycle.changed.v1`, validates compatibility against those exact artifacts, follows only safe registry records, recomputes blockRegistryDigest, and never registers a block or changes a field.
- 03b supplies EntryRevision/PublicationVersion lineage rows and frozen dependency hashes; 03c invalidates dependent states on source/publication changes but never publishes directly. 03b consumes the 03c activation events to recheck live editorial reviews, the 03c `cms.locale.no_fallback_gate` provider (DEC-138) and the pattern, taxonomy and template providers registered in the 03b preflight registry, and the 03c selectors and `cms_resolve_taxonomy_version`/`cms_resolve_locale_field` helpers (DEC-141).
- Shard 04 consumes exact active template/pattern/taxonomy/locale/related projections after authorized publication; it owns public cache/search/sitemap/render convergence.
- Shard 05 supplies governed settings/checkers/risk definitions only by versioned allowlist; it cannot override fixed profile, no_fallback, canonical taxonomy, or target authorization.
- Owning domain shards register their canonical taxonomy provider (`cms_canonical_domain_registry`) by forward migration; until then the domain is `unbuilt` and a vocabulary that declares it cannot activate (DEC-135). Shard 04 consumes `cms_resolve_locale_field` and `cms_related_content_public_targets` for delivery and never re-implements resolution or eligibility.
- Shard 16 and other domain shards retain canonical education/rights/money/identity state. CMS references only named read-only projections and cannot manufacture authority.

## Error Handling

### Operation error coverage

| Operation ID | Before mutation                         | Transaction/race                                                | After commit/recovery                                                         |
| ------------ | --------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| CMS-03C-01   | transport/auth/block/slot validation    | 409 key/version/compatibility/digest mismatch/idempotency; rollback no template | draft remains; activation event only after later governed switch              |
| CMS-03C-02   | transport/auth/graph validation         | 409 cycle/slot/CAS/digest mismatch/idempotency; no silent overwrite | linked diff remains pending; retry exact command                              |
| CMS-03C-03   | transport/auth/overlap validation       | 409 term/merge/CAS/idempotency; assignments preserve old IDs    | taxonomy event retries; redirect/assignment convergence is idempotent         |
| CMS-03C-04   | transport/auth/locale/source validation | 409 stale hash/version/duplicate; no illegal fallback           | locale event retries; stale/no_fallback state remains honest                  |
| CMS-03C-05   | transport/auth/target validation        | 409 source version/duplicate/idempotency; no target authority   | unavailable target drops from public projection; rule history remains private |
| CMS-03C-06 to CMS-03C-09 | transport/auth/MFA/eligibility errors | 409 stale review/subject state/dependency changed/activation conflict; the committed `invalidated` outcome is answered 409; no partial switch | governed review events none; an expired assignment is inert; a failed scheduled activation blocks with the prior active version intact |
| CMS-03C-10, CMS-03C-11 | transport/auth/cursor errors | safe read never mutates; 409 expired/tampered/foreign cursor | restart from the first page on a cursor conflict |
| CMS-03C-12, CMS-03C-13 | transport/auth/block/graph validation | 409 key/version/cycle/digest mismatch/idempotency; rollback no pattern | draft remains; activation only through CMS-03C-09 |
| CMS-03C-14, CMS-03C-15 | transport/auth/diff validation | 409 stale entry/instance version, collisions; nothing overwritten | an unanswered update leaves the instance on its pinned version |
| CMS-03C-16, CMS-03C-17 | transport/auth/allowlist/domain validation | 409 key/version/idempotency | draft vocabulary remains; activation only through CMS-03C-09 |

Every failure uses BE00 ApiError { code, message, requestId, details }. PostgreSQL failure before commit creates no record; lost response after commit replays by idempotency/status. Audit failure rolls back. Outbox/Queue failure leaves canonical state and retries. Projection outage shows pending/degraded. 429 honors Retry-After; 503/504 retries only after status reconciliation; unknown state is never guessed active.

## Observability

Structured scrubbed logs are keyed by operation ID, requestId, traceId, correlationId, actor/acting-context class, safe aggregate ID/hash, version, outcome, error code, duration, dependency class, and retryability. No content, locale text, target name, token, raw rule, or capability graph is logged.

Metrics: cms_composition_request_total{operation,outcome}, cms_composition_latency_ms, cms_composition_error_total{operation,code}, cms_composition_conflict_total, cms_template_activation_age, cms_pattern_cycle_reject_total, cms_taxonomy_merge_total, cms_taxonomy_overlap_reject_total, cms_locale_stale_total, cms_no_fallback_block_total, cms_related_target_filtered_total, cms_outbox_age, cms_queue_retry_total, cms_queue_dlq_total. Slice 12: cms_governed_review_total{subject_kind,outcome}, cms_governed_decision_total{decision,outcome}, cms_governed_activation_total{subject_kind,action,outcome}, cms_governed_review_invalidated_total{reason}, cms_governed_schedule_blocked_total{reason}, cms_pattern_linked_update_pending_total, cms_pattern_update_total{action,outcome}, cms_canonical_match_total{domain,outcome}, cms_canonical_source_unavailable_total{domain}, cms_related_target_ineligible_total, cms_locale_fanout_total, cms_locale_limit_reached_total. `cms_locale_stale_total` counts stale fields at append and `cms_no_fallback_block_total{reason}` counts blocking gate evaluations. Labels never carry an id, label text, locale text, hash or person. Alert on DLQ >0, outbox age >2m, activation blocked >15m, stale locale legal-field count >0, or target-filter anomaly.

**Database-side locale observability (DEC-208).** The locale fan-out and the staleness it records happen inside PostgreSQL transactions (`Fan-out bound and event key (D12)`), so the Worker reads them on its scheduled tick. On every firing of the `* * * * *` cron, with T the firing's `scheduledTime` floored to the minute, the Worker calls the internal RPC `platform_api.cms_locale_observability_read(p_window_start timestamptz, p_window_end timestamptz)` with the closed-open window [T − 3 min, T − 2 min): each tick reads the one minute that ended two minutes before it, so consecutive ticks tile time without overlap and a fan-out whose transaction commits within two minutes of its start is never missed (`created_at` is `clock_timestamp()` taken when the fan-out writer starts). The RPC is SECURITY DEFINER over a private reader, executable by `service_role` only (revoked from public, anon and authenticated), and refuses `VALIDATION_FAILED` unless both bounds fall on a whole minute and `p_window_end − p_window_start` is exactly 60 s. It takes no lock, writes nothing (no audit, outbox or receipt row), sets the transaction-local RPC context its forced-RLS reads require and restores the caller's value before returning, as every protected read does, and answers exactly `{ fanoutRows, staleFieldsAppended, staleLegalFields }`, three non-negative integers and nothing else (no id, locale, field id or text). `fanoutRows` counts the `cms_locale_variants` rows in state `stale` (only the source-change fan-out writes that state) whose `created_at` lies in the window; `staleFieldsAppended` is the sum of `jsonb_array_length(stale_field_ids)` over those rows; `staleLegalFields` is a point-in-time count, over the current locale variant of every entry whose `lifecycle` is `active` (an `archived`, `deletion_pending` or `held` entry cannot be revalidated, so counting it would hold the alert open; DEC-216) (the newest row per entry and case-insensitive locale by `version`, `created_at`, `id` descending, the `cmsLocaleVariantRead` rule), of the `stale_field_ids` members whose locale policy is `no_fallback` in the entry's current schema (the predicate `cms_resolve_locale_field` applies; `no_fallback` is the default for legal, safety and jurisdiction fields). The implementing migration adds `INDEX(state, created_at)`, `INDEX(entry_id, lower(locale), version DESC, created_at DESC, id DESC)` and `INDEX(entry_id, locale, version DESC, created_at DESC, id DESC)` on `cms_locale_variants` (under forced RLS a predicate becomes an index condition only when its functions are leakproof, and `lower()` is not, so the skip scan probes the plain `locale` column and keeps the newest row per case-insensitive locale; DEC-220). `cms_locale_variants` is append-only, so neither count may grow with its history: the window counts read only the window's rows through the first index, and `staleLegalFields` starts from the `active` entries and reaches each entry's current row per locale by a skip scan of the plain-`locale` index (one index probe per distinct `(entry, locale)` head, then the newest per case-insensitive locale), so its cost grows with live entries and their locales (at most 32 per entry), never with superseded or historical stale rows. The Worker adds `fanoutRows` to `cms_locale_fanout_total` and `staleFieldsAppended` to `cms_locale_stale_total`, sets the gauge `cms_locale_stale_legal_fields` to `staleLegalFields`, and passes that value to the alert evaluator as the stale locale legal-field count (alert above 0). A missed firing leaves its minute uncounted and a repeated firing counts it twice: the two counters are trend signals, and the alert reads the gauge, which every firing samples afresh. The Worker aborts the call after 5,000 ms and treats the abort as a failed read (a function-level `statement_timeout` cannot bound the statement that calls the function, so the bound is the caller's). Each failed, timed-out or malformed read increments `cms_locale_observability_read_failed_total` (no labels) and raises the alert `locale_observability_unavailable` for that firing (delivery deduplicates repeats), because the stale legal-field alert input would otherwise disappear silently; the Worker keeps no failure history between scheduled firings, which need not share an isolate (DEC-220). A failed, timed-out or malformed read is logged with allowlisted fields only (dependency class `database`, outcome, duration) and swallowed, so observability never fails the scheduled sweep. Labels never carry a locale (DEC-208, DEC-213).

Traces cover validation → principal/assignment → registry/projection refetch → idempotency → RPC/SQL → audit/outbox → consumer refetch. Structured diagnostics use allowlisted fields only; audit is PostgreSQL authority. SLOs: Tier 2 p95 <1,200ms, protected RPC <300ms, queue first attempt p95 ≤60s, DLQ <0.1% daily.

## Testing Strategy

### Contract and route tests

- OpenAPI, Hono routes, and the seventeen HTTP registry rows plus the five supporting reads (the four internal operations CMS-03C-18 through CMS-03C-21 are absent from the browser inventory) match operation ID, method/path, request/success/error, auth, CORS, rate, timeout, cache, idempotency, ETag, and SLO.
- CMS-03C-01 tests slots, required/allowed blocks, canonical BlockKey acceptance/rejection, reserved regions, profile/provenance spine, type compatibility, locale/audience, unknown keys, registered/deprecated/withdrawn block lifecycle, safe `resourceKind: 'block_definition_registry_record'`, server recomputation versus client digest expectation (a malformed digest 422, a different well-formed digest 409 `block_registry_digest_mismatch`, DEC-186), lifecycle event/refetch, activation event, and exact TemplateVersionResource.
- CMS-03C-02 tests linked/detached modes, three-way diff, slot/path uniqueness, a placement of a forest of 1, 2 and 32 block roots writing that many rows all-or-nothing with the items list in the 201 (DEC-175), a forest whose top-level nested pattern reference expands recursively into that pattern's own block roots so every row carries a block, a placement whose expansion writes more than 32 rows and the 512-node cap after expansion (DEC-181), the row `path` of a plain root, of the root `slotPath` `/` and of an expanded nested root (the key chain, DEC-186), a row path of 248 octets accepted and of 249 octets refused 422 at `/slotPath` with nothing written (DEC-186), consecutive `position`s in forest order after the slot's greatest and two concurrent placements into one slot staying grouped without a shared position, `position` copied unchanged by accept, detach, the linked-update scan, restore and carry-over, and the render plan order of region, slot ordinal, `position`, `path` and `id` (DEC-185), `overrides` keys through an expanded root's key chain and a key above every block root refused (DEC-186), a malformed `blockRegistryDigest` refused 422 at its pointer against a different well-formed digest refused 409 `block_registry_digest_mismatch` (DEC-186), `overrides` keys as normalized node paths under the inserted root (a key that is not one is 422), override max 64 keys/depth 8, canonical nested BlockKey acceptance/rejection, cycle/depth/node rejection, safe registry compatibility, deterministic RFC 8785/JCS digest sorting, CAS, and exact PatternPlacementResource and CompositionInstanceResource.
- CMS-03C-03 tests all actions, stable key/rename/alias, parent cycles, canonical overlap, merge survivor, merged reactivation, duplicate replay, assignment migration, redirect, and taxonomy event.
- CMS-03C-04 tests an unsupported target locale (422), a `fallbackChain` that is equal, reordered, truncated, extended or has a substituted member (equal accepted; every difference 409 `FALLBACK_CHAIN_MISMATCH` returning the active chain and writing nothing), `[]` accepted exactly for the default locale, a type whose active version changes its chain through a successor (the new chain applies, the old chain 409s), BCP 47, source hash, localizable-field filtering, fallback order, no_fallback legal/safety/jurisdiction block, source-stale transition, explicit revalidation, and locale event.
- CMS-03C-05 tests pin/exclusion ordering, derived reason/version from the rule registry (an unknown key or version is `derived_rule_unknown`), the uniform `related_target_ineligible` for an absent, hidden, inactive, other-owner or self target (identical bodies, no existence oracle), exclusions winning over pins, append-only replacement and revocation versions, `eligibleCount`, target unpublish/private transition, public filtering, and publication invalidation; CMS-03C-21 tests pins-first ordering, the deterministic `shared-terms` and `same-type-recent` ranking and tie-breaks, the 128-target bound, refill only from eligible derived candidates, and recomputation at every projection.
- CMS-03C-06 to CMS-03C-11 test, per subject kind: submit preconditions and the `subject_not_submittable` cases, the strictest-of policy basis over several bound content types (ordinary 1, protected 2 with each specialist class, the union of specialist slots, the `editorial.default` fallback), one live review per subject version, the ten decision steps with the 03b decision matrix (distinct humans, slot derivation, `specialist_slot_unsatisfiable`, first rejection, assignment expiry before and after, revocation unwinding an open count), unconditional step-up with no idempotency record on the 401, owner-only assignment with the seven-day, reviewer-grant and grantor-authority bounds and the uniform `reviewer_not_eligible`, the committed `dependency_changed` invalidation (a withdrawn block, a changed bound policy, a changed hash), exact replay and same-key serialization, no event on any refusal, and 403/404 concealment; activation tests cover `activate` (atomic CAS, previous version `superseded`, exactly one `cms.template.activated.v1`, `cms.pattern.activated.v1` or `cms.taxonomy.changed.v1`, `activation_conflict` under two racing activators), `schedule` (the 03b Time authority cases, one live schedule per subject, no event at acceptance, execution with only a revocation and grant-end recheck, the retry ladder and every `reasonCode`, a late run and a repeated run), `retire` (the `WITHDRAWN` resolver result and the failing 03b `template` preflight), `blocked` re-activation and invalidation back to `draft`, and the review and queue reads with per-reader redaction.
- CMS-03C-12 to CMS-03C-15 test pattern version create (reserved keys, `compatibleTypeIds` 1 and 64, depth 8 and the 9th level, 512 and 513 expanded nodes, a nested pattern cycle through a lineage, a nested pattern that is not `active` or not compatible (422 `nested_pattern_not_active`), digest recomputation versus the client expectation, per-owner uniqueness with another owner's identical key accepted), the selector (only `active` compatible versions, keyset order, cursor binding), instance insertion on the current draft revision (`revision_not_editable`, `pattern_version_not_active`, `pattern_incompatible`, slot-path existence), the linked-update scan (a `pending_diff` row per linked draft instance, none on reviewed or published revisions, idempotent and bounded at 500), the diff (collision definition, 128-path and 256 KiB bounds, an instance with no newer version answering 200 with an empty diff), `accept` (a target that is not the latest `active` compatible version is 422 `pattern_version_not_active`, theirs-only adoption, retained overrides, mandatory choices for collisions, `diff_has_collisions` for a bulk request, all-or-nothing over 32 instances, and a placement of more than 32 rows accepted in successive requests of at most 32 with the unanswered rows still on their pinned version, DEC-181) and `detach` (the materialized detached local block tree, no further updates), and the invalidation of the revision's live review by every composition write. DEC-193 adds: the node value of a diff path (`props`, block identity, `children`) with `base` null for an added node and `theirs` null for a removed one, each added or removed node listed once; a `structure` collision for a block-identity change and for a `children` change, with and without an override; a `removed_root` collision; `newRoots` and `slotPath`; a target that changes no path answering `bulkEligible` true; `accept` with `theirs` and `yours` on each collision kind (a `retired` row for a removed root, a detached copy for a structural or removed-root `yours`, no linked row ever pinned to a version lacking its block root, every kept override naming a node of the target tree); `detach` of a block root with more than 128 nodes and nested references below it (the full tree stored, no key-count refusal) and the 512-node bound; the render plan reading a detached tree; restore and carry-over copying it; a `retired`, detached or older row answered by the no-update diff, refused by accept and, for a detached or older row, by detach, while the newest `retired` row of a path may still be detached (DEC-193); and CMS-03C-02 `roots` placing only the named roots, a chain that names no block root refused at `/roots/{n}`, an override under an unnamed root refused at `/overrides`, an occupied path refused 409 and a path whose newest row is `retired` reused at its position.
- CMS-03C-16 and CMS-03C-17, and the CMS-03C-03 changes, test taxonomy version create (allowlists, declared domains, uniqueness per owner), submission and activation with an unbuilt declared domain refused `canonical_source_unavailable` (422 with `details.domain`), a vocabulary declaring no domain never being checked, the canonical overlap check for `create`, `rename` and `alias` in a declared built domain (`canonical_overlap` with the canonical id) and its absence for `merge` and `deprecate`, `taxonomy_not_active`, hierarchical-only parents, stable term ids across a successor version, merge convergence of up to 5,000 assignments in one transaction and the resumable job beyond it with the redirect valid throughout, the selector never listing a merged or deprecated term, and the `term_unavailable` refusal for taxonomy field values; the `cmsPatternLatestRead`, `cmsTaxonomyVersionsRead` and `cmsTaxonomyTermsRead` reads test owner scoping (another owner's identical key is the same 404), reserved keys, newest-first versions, term keyset order and cursor binding, and merged terms listed with their successor.
- Locale tests (CMS-03C-04 and CMS-03C-20): the resolver for each `localizationMode` (a `no_fallback` field never resolved through `fallbackChains`, `no_fallback_missing` and `no_fallback_stale` blocking, a stale `localized` field still served and flagged, the fallback chain walk and `resolvedFromLocale`), the `cms.locale.no_fallback_gate` provider including `locale_variant_not_approved` in the `schedule`, `publish` and `execute` phases for every effective state (admitted `approved`, `scheduled`, `published`; refused `draft`, `submitted`, `rejected`), never at `submit`, with missing outranking stale outranking approval (DEC-192), per-field staleness from `field_source_hashes`, the derived `review` and `approved` variant states, the 32-variant cap and `locale_limit_reached`, and the per-locale outbox identity so the author RPC and the fan-out writer never collide.
- DEC-141 receiving-obligation tests: taxonomy-version resolution by identity in CMS-03B-03 comparison and the CMS-03B-04 lineage (any state, owner scope, non-disclosing `comparison_unavailable`), restore translation of composition instances (a withdrawn block, an inactive pattern, an absent slot) and of term assignments (active, deprecated, merged re-pointed, unknown refused), and revision-append carry-over of instances so an autosave never drops a composition.
- Every route tests 400, 401, 403, 404, 409, 415, 422, 429, 502, 503, 504, and 500 where applicable with exact ApiError, headers, and safe details.
- Browser-envelope tests reject ownership identifiers and unknown state values, and assert the exact TemplateVersionState, CompositionInstanceState, TaxonomyTermLifecycle, LocaleVariantState, PatternVersionState, and RelatedContentState mappings.

### Authorization, persistence, and concurrency tests

- Anonymous, expired session, wrong person/party, missing assignment, revoked capability, wrong vocabulary, hidden target, forged JWT metadata, service-role misuse, and existence leakage are tested for every operation.
- Every 03c table (TemplateVersion, PatternVersion, CompositionInstance, TaxonomyVersion, TaxonomyTerm, TermLabel, TermAssignment, LocaleVariant, and RelatedContentRule) tests the mandatory id/owner_id/closed-state/version/timestamps envelope, SQL type/nullability/check, FK target, canonical BlockKey SQL checks where applicable, unique/partial indexes, immutable fields, updated_at=created_at and UPDATE/DELETE rejection for immutable rows, lifecycle/terminal transitions, cycle/merge constraints, 03a safe registry discriminator/lifecycle-event consumption, RLS enabled/forced, direct grants revoked, and named RPC grants.
- Same-key concurrent commands produce one effect/replay; changed body/actor/path/version returns 409; failed transaction leaves no idempotency/audit/outbox row.
- The `Slice 12 lock order` is proven through the real commands: concurrent pairs of its writers (a composition write versus the activation of the pinned version, decision versus activation, assignment versus decision, term merge versus assignment, revocation versus activation) each end in one committed command and one typed 409 or 403, never a deadlock or a lost write.
- Template activation versus block withdrawal, linked pattern update versus local override, term merge versus assignment, locale source edit versus translation, related target unpublish, duplicate/out-of-order events, worker lease expiry, and restore-epoch fencing are covered.

### Security, performance, and recovery tests

- Fuzz JSON depth/keys/arrays, paths, Unicode/control chars, HTML/script/CSS/expression injection, arbitrary projection/query attempts, timezone/locale tags, target IDs, and oversized bodies.
- Prove no private locale text, draft composition, unauthorized target, capability, or canonical-domain authority enters public projection, event payload, logs, or cache.
- Prove BlockKey is exactly /^[a-z][a-z0-9._-]{0,95}$/ in request, safe registry resource, SQL block references, and nested pattern/slot fixtures; prove blockRegistryDigest is lowercase SHA-256 over the RFC 8785/JCS canonical UTF-8 sorted tuple array and that the server recomputes the digest and refuses a client expectation that differs from the recomputed value (409 `block_registry_digest_mismatch`, DEC-186; an equality expectation, never stored in place of the recomputed digest) at create, activate, and publication preflight.
- Remote checker tests assert exact 2,000ms timeout, 15s/60s/300s retries, five-failure/60s circuit, 502/503/504 mapping, and ambiguous-result reconciliation. A maximum-size `CMS-03C-02` `PatternPlacementResource` (a 512-row placement at the field bounds) is decoded and returned within the 1 MiB response ceiling, and an over-budget response is refused rather than truncated; the request body stays within 256 KiB (DEC-188/DEC-189).
- Representative 64-slot templates, 512-node pattern bounds, 50-term pages, 128 locale fields, and 64 related targets meet Tier 2 p95 <1,200ms and RPC <300ms.
- Recovery drills prove merge retry/redirect, linked-pattern rebase, source-locale stale recovery, target authorization filtering, DLQ replay, publication invalidation, and fail-closed takedown.

### Accessibility handoff tests

Template/slot validation errors preserve stable JSON Pointer paths. Composition changes have a linear semantic representation and keyboard-safe ordering. Locale and fallback status is truthful and announced through frontend status semantics. Reserved profile/provenance components cannot be hidden or reordered by content.

## Deepening Passes

| Pass | Focus                         | Evidence                                                                                                                                                                                                       | Result |
| ---- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1    | Source/split completeness     | CMS-11, CMS-12, CMS-14, CMS-15, CMS-16, all owned models, the governed review set, and six event types (adding `cms.pattern.activated.v1`) including the consumed 03a block-lifecycle event mapped above.                                                                  | PASS   |
| 2    | Route/contract reconciliation | Seventeen registry rows, five supporting reads, four internal operations, strict Zod request/success schemas, error matrix, auth, CORS, rate, idempotency, and tests align; 03a artifact, validator, workflow-policy, and block props identity evidence is explicit. | PASS   |
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
- Slice 12 PASS: the governed review machinery, strictest-of policy basis, activation, retirement and scheduled activation, pattern versions and linked updates, taxonomy versions with declared canonical domains, related-content eligibility and derived rules, locale resolution and fan-out, and the DEC-141 receiving obligations each name exact routes or RPCs, closed enums, typed reason tokens, locks and failure outcomes; two implementers derive the same operand for every `If-Match`, the same state machine for every subject kind, and the same resolution for every locale field.
- Two-implementer PASS: independent implementers select the same seventeen routes and four internal operations, fifteen owned model tables plus 03a registry dependency, states, FKs, RLS outcomes, event payloads, safe registry record, canonical BlockKey, digest algorithm, and retries.
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
| 2026-10-02 | OD-4: CMS-03C-04 `fallbackChain` is now an equality expectation against the active content-type version's `fallbackChains` entry for the target locale (03a), the target locale must be in that version's `supportedLocales` (422 `LOCALE_VALIDATION_FAILED` otherwise), and a differing chain is 409 `LOCALE_VERSION_CONFLICT` with `FALLBACK_CHAIN_MISMATCH` and the active chain. |
| 2026-10-02 | Slice 09 implementation reconciliation: replaced the non-BE00 `DEPENDENCY_INVALID_RESPONSE` (502) and `DEPENDENCY_DEADLINE_EXCEEDED` (504) names with the BE00 `DEPENDENCY_UNAVAILABLE` (502/503/504) in the CMS-03C-01..05 error catalogs. |
| 2026-10-02 | Slice 09 follow-ups reconciliation: pointer only. `no_fallback` public resolution semantics are a CMS-15 delivery concern (DEC-121) owned by delivery (04c); 03c declares and enforces `no_fallback` at authoring and storage and specifies no resolution behavior. |
| 2026-10-07 | Slice 12 specification cascade (owner decisions DEC-113, DEC-114, DEC-121, DEC-123; orchestrator resolutions DEC-135, DEC-137, DEC-138, DEC-141, D7, D9, D10, D11, D12, OD-1, OD-2, OD-5, OD-6, E13, E14; owner may override the orchestrator items). Public template activation is no longer an unresolved gap: CMS-03C-06 through CMS-03C-11 are one subject-polymorphic review, decision, assignment and activation machinery for template, pattern and taxonomy versions (strictest-of DEC-110 policy basis, owner-only `cms.definition_review.assign`, unconditional MFA, atomic CAS switch, retirement, scheduled activation with the 03b Time authority, committed invalidation) emitting `cms.template.activated.v1`, the new `cms.pattern.activated.v1` and `cms.taxonomy.changed.v1`. Added PatternVersion create, selector, linked-update diff, accept and detach (CMS-03C-12 to CMS-03C-15, `compatibleTypeIds`), TaxonomyVersion create and selector with declared canonical overlap domains and the canonical projection (CMS-03C-16, CMS-03C-17, CMS-03C-18), the related-content eligible-target authority, the OD-5 derived-rule registry and public projection (CMS-03C-21), the shared locale resolution helper, `no_fallback` gate and fan-out bound with a per-locale event identity (CMS-03C-20; BE03c no longer defers resolution to 04c), the DEC-141 receiving obligations, the latest-template read (D7) and the matching pattern, taxonomy-version and term reads, reserved template and pattern keys (E13), per-owner key uniqueness and lineage ids (E14), the BE04c audience grammar for templates (E4), and CMS-03C-04 and CMS-03C-05 as Phase 2 runtime operations (DEC-114). | write-be-spec (Slice 12 cascade) | Classification, route registry, internal operations, invariants, Zod contracts, validation and error matrices, behavior sections, database, RLS, authorization, security controls, data flow, state machines, events, observability, testing, deepening |
| 2026-10-12 | Slice 12 depth-floor cascade (owner decisions DEC-175 and DEC-176; orchestrator resolutions DEC-178 to DEC-180; owner may override the orchestrator items). DEC-175: CMS-03C-02 writes one `CompositionInstance` row per root node of the pinned pattern version (block identity per row, node `key` as the path suffix, `overrides` keys as normalized node paths under the inserted root) and answers 201 `PatternPlacementResource`, an `items` list of 1–32 rows. DEC-176: patterns apply to entry revisions only (the `revision/template draft` wording is removed). DEC-179: response-contract failures are 502 `DEPENDENCY_UNAVAILABLE` (DEC-172), decision and assignment reasons count code points and assignment and retirement reasons are NFC (DEC-158), metric labels are `subject_kind` (DEC-159). DEC-180: `nested_pattern_not_active` and `pattern_version_not_active` are 422 and every governed 409 is `GOVERNED_REVIEW_VERSION_CONFLICT` with the reason in `details.reasonCode`; the digest is an equality expectation the server recomputes and refuses on a mismatch; `Slice 12 lock order` extends DEC-157 (G2); outbox identity of the activation and taxonomy events (G3); CMS-03C-14 answers 200 with an empty diff when no newer version exists (G4); `cms_invalidate_governed_reviews_for_person` behavior (G6); the exact impact set and the review read scope (G8); job transport (G9); `canonical_source_unavailable` at taxonomy-version submission (G11). | write-be-spec (Slice 12 depth-floor cascade) | Decision status, endpoint reconciliation, route registry, validation matrix, Zod contracts and resources, error matrix and typed refusals, governed review machinery, lock order, pattern versions and linked updates, taxonomy, canonical records, permissions, authorization matrix, data flow, events, observability, testing |
| 2026-10-12 | Slice 12 nested-pattern expansion (owner decision DEC-181, 2026-10-12). A top-level nested pattern reference (`kind: pattern`) in a pattern forest has no block of its own, so CMS-03C-02 expands it at placement into that pattern's own block roots, recursively, and writes one `CompositionInstance` row per block root; every row stays pinned to the placed `(patternId, patternVersion)`, whose pinned tree fixes each nested version, and nested references below a block root stay inside that root's tree. The 201 `PatternPlacementResource` `items` list therefore holds one or more rows bounded by the existing 512-node cap after expansion, not 1–32; this supersedes the `1–32 rows` and `per root node` wording of the DEC-175 row above (that row is history and is not edited). Amended the route registry row and Zod `PatternPlacementResource` (`max(512)`), the `CompositionInstanceResource` comment, the pattern-placement paragraph, the linked-update paragraph, the composition table rule, the CMS-03C-02 data flow and the contract test list. | write-be-spec (Slice 12 wording and DEC-181 pass) | Decision status, IA source map, route registry, Zod contracts and resources, pattern versions and linked updates, canonical records and fields, data flow, testing |
| 2026-10-13 | Slice 12 spec completion (owner decision DEC-185; orchestrator resolution DEC-186; the remaining DEC-181 consequences). DEC-185: `cms_composition_instances` gains `position integer NOT NULL` (the forward migration backfills existing rows by bytewise path rank within `(revision_id, slot_key)`); a placement takes consecutive positions in forest order after DEC-181 expansion, appended after the slot's greatest under the revision/slot lock; CMS-03C-15 accept and detach, the linked-update scan, restore and carry-over copy the position unchanged; the render plan orders composition rows by region, slot ordinal, `position`, `path` and `id`; the D5 comparison hash is unchanged. DEC-186 items 1 to 3: a placement row `path` is the `slotPath` joined with `/` and the root's key chain (the root path `/` adds no extra separator; an expanded nested root takes the keys of the references it came through) and stays within 248 octets, else 422 at `/slotPath`; a malformed `blockRegistryDigest` is 422 at its pointer and a different well-formed digest is 409 with the new closed token `block_registry_digest_mismatch` on CMS-03C-01, CMS-03C-02 and CMS-03C-12 (validation rows, error matrix 409 cells, typed refusals, operation error coverage); `overrides` keys use the same key chain inside expanded roots. DEC-181 consequences: the 32 of CMS-03C-15 is a bound per request, so a placement of more rows is accepted or detached in successive requests (no placement-wide operation exists, rows carry no placement identity). Amended the decision status, the IA map and route registry rows, the digest invariants, the validation matrix, the Zod comments, the pattern-placement and linked-update paragraphs, the receiving obligations, the composition table row, the CMS-03C-02 data flow, the error matrix and operation error coverage, the typed refusals and the test list. | write-be-spec (Slice 12 spec-completion pass) | Decision status, IA source map, route registry, digest invariants, route field validation matrix, Zod contracts, error matrix, typed refusals, pattern versions and linked updates, receiving obligations, canonical records and fields, data flow, testing |
| 2026-10-13 | Slice 12 approved ceiling/lifecycle cascade (owner-approved DEC-188 and DEC-189). DEC-188: the TemplateVersion, PatternVersion and TaxonomyVersion definition `version` stays the immutable definition number used by every pin, uniqueness key, lookup, edit operand and `subjectVersion`; each row adds an internal `lifecycle_version` positive bigint default 1 that advances by exactly one per governed state transition (submission, approval, scheduling, scheduled execution, terminal scheduling failure, recovery, activation, supersession, retirement, invalidation), changes only `state`, `lifecycle_version`, `activated_at`, `retired_at` and `updated_at` through the guarded RPCs, and is never a public-resource field; `expectedVersion` and the review ETag still compare the governed-review `version`; the activation, scheduled-execution and retirement event aggregateVersion becomes the committed subject `lifecycle_version` (correcting DEC-180 G3), term and locale aggregates are unchanged, and supersession emits no separate event. DEC-189: the `CMS-03C-02` decoded JSON response body is the one response ceiling exception at 1,048,576 bytes (1 MiB), response-only, carrying its bounded 1–512-row `PatternPlacementResource`, with the request body and every other request and response at 256 KiB and the 1 MiB ceiling's sufficiency proven only by a maximum-size success and an over-budget refusal against the actual producer. | /propagate-decision | Decision status, route registry, registry invariants, If-Match operands, persisted model envelope, governed activation and retirement, canonical records and fields, security and abuse controls, event schemas, testing strategy, changelog |
| 2026-10-15 | Slice 12 retirement and ratified-correction cascade (owner decision DEC-190; root-ratified implementation rulings). DEC-190: `retire` through CMS-03C-09 requires only an `active` subject (409 `subject_not_retirable`), keeps authentication, unconditional recent MFA, disclosure-safe review resolution, the owner capability, the review-`version` If-Match, idempotency and audit, needs no fresh approval and no hash, policy, dependency, provider or preflight validity, and commits exactly one event; `activate` and `schedule` keep every approval and validity check; the route-registry event column now names retirement. Ratified rulings: the locale aggregate type is the underscored `cms_locale_variant` (the consumer grammar `^[a-z][a-z0-9_]{0,63}$`); a hidden or absent related-content source is 404 while a hidden, absent or ineligible target is the uniform 422 `related_target_ineligible`; the CMS-03C-02 over-budget refusal exists only at the Worker transport and route, never at the producer. | /propagate-decision | Route registry, governed activation and retirement, security and abuse controls, related-content eligibility rows, locale event key, response ceiling, changelog |
| 2026-10-15 | Slice 12 DEC-188 wording residue (owner decision DEC-188, approved 2026-10-13). The Template, Pattern and Taxonomy immutability statements, the legacy `updated_at=created_at` and UPDATE/DELETE bans on the template and pattern rows, and the lifecycle summary now say that definition fields and the definition `version` are immutable from creation, that DELETE stays rejected, and that the only permitted UPDATE on an activated row is the guarded lifecycle-metadata transition (`state`, the private `lifecycle_version`, `activated_at`, `retired_at`, `updated_at`) through the governed RPCs. | /propagate-decision | Governed review data rules, template and pattern rows, lifecycle summary, changelog |
| 2026-10-15 | Slice 12 DEC-190 follow-up (root-ratified implementation ruling under the owner-approved DEC-190 cascade). The If-Match operands paragraph lists a retirement among the review `version` advances, as for an activation through the same CMS-03C-09 switch (root ruling for the retire implementation, `briefs/governed-retire-f1.md`). No other behavior is added. |
| 2026-10-15 | Slice 12 FE03-BE03c read gap (orchestrator resolution DEC-191; owner may override). FE03 :882 and :1118 require the activation answer to name the superseded version and blocked or cancelled schedules to show their closed reason, but no 03c resource carried either. `GovernedActivationResource` gains nullable `supersededVersion`; `GovernedReviewDetailResource` gains nullable `activationSchedule {state, reasonCode}` projecting the stored `cms_governed_activation_schedules` state and its existing closed `reason_code`. Additive read members only; no new state, vocabulary or authority. |
| 2026-10-15 | Slice 12 merge-convergence Job disposition (BE00 233 owning-domain registration; root ratification of the independently reviewed Worker error-code registry). Adds the `cms.taxonomy.merge_converge` disposition table after "Term actions and merge convergence", in the form of BE03a "Preparation Job disposition", and states that no re-request after a `failed` Job is specified yet. No behavior change. |
| 2026-10-15 | Slice 12 CMS-03C-15 matrix cell (consistency with the typed-refusals paragraph and the frozen operation list). The 409 cell names `revision_not_editable` (FE03 :885, P2-S12-AC-123) and the 422 cell names `pattern_incompatible` and `nested_pattern_not_active` beside `pattern_version_not_active`, as `refusals.ts` already lists for CMS-03C-15. No behavior change. |
| 2026-10-15 | Slice 12 cascade-review follow-ups (independent review of the 2026-10-15 edits). The retire branch states that it advances the review `version` by one; the CMS-03C-10 ETag is described as the review's CAS token that `subjectState` and `activationSchedule` can change without; the CMS-03C-02 matrix cell lists the operation's typed refusals as the frozen contract does; the CMS-03C-15 validation row points to the typed-refusals paragraph for its other tokens; the decision-status summary drops the unreachable producer over-budget refusal (as :1523 and FE03 :1050); the DEC-191 schedule ordering and the one browser-visible schedule projection are stated. No behavior change. |
| 2026-10-15 | Slice 12 merge convergence recovery (owner decision DEC-194). The Merge convergence Job disposition section gains the bounded reconciliation sweep (`platform_api.cms_reconcile_taxonomy_merge_converge`, service_role only; one fresh Job per acting party with a failed Job, remaining work and no live Job; 15-minute and 3-generation bounds; alert to `platform.on_call`) as the BE00 571 recovery reference, replacing the sentence that no re-request was specified. |
| 2026-10-15 | Slice 12 related-content read (owner decision DEC-195). Adds `cmsRelatedContentRead` (`GET /api/v1/cms/entries/{entryId}/related-content` → `RelatedContentRuleRead { rule: RelatedContentResource | null }`) to the epic index, interaction map, route registry, validation, error matrix, catalog and authority rows: authorized exactly like CMS-03C-05 (403 for a visible source without edit, 404 hidden/absent), current active rule or null, pins and exclusions as stored. |
| 2026-10-15 | Slice 12 locale approval gate phases (owner decision DEC-192, 2026-10-15; review-locale F4). The Locale preflight provider paragraph and the locale tests line state that `locale_variant_not_approved` applies in the `schedule`, `publish` and `execute` phases to a locale revision whose effective state is not `approved`, `scheduled` or `published`, never at `submit`, and that a missing `no_fallback` value outranks a stale one which outranks the approval check. This resolves the contradiction between the stateless rule and the 03b submit phase that evaluates the `locale` category (a locale revision is an effective `draft` at submit), and aligns the gate with the derived variant state, which already shows a scheduled revision as approved. No new vocabulary or error token. |
| 2026-10-15 | Slice 12 linked-update cascade (owner decision DEC-193, 2026-10-15; review-pattern-updates.md and review-pattern-updates-f1.md §6: D-VALUE, D-RETIRE, B2, D-DETACH). A diff node value is `props` plus block identity and `children`; `CompositionUpdateDiffPath` gains typed `base`/`theirs` node values and `collisionKind` (`removed_root`, `structure`, `props`), and `CompositionUpdateDiffResource` gains `slotPath` and `newRoots`. A structural change and a removed block root are collisions the author resolves: `theirs` on a removed root appends a `retired` row, `yours` on a structural or removed-root collision appends the detached copy that `detach` writes, and no linked row is ever pinned to a version lacking its block root. `detach` stores the full subtree in the new `cms_composition_instances.detached_tree` (1–512 pre-order nodes, no key-count refusal), which the render plan, restore and the carry-over resolve. A row that is not a linked `active`/`pending_diff` newest version answers the no-update diff; accept admits linked `active`/`pending_diff` rows and detach any linked pattern-origin row, including a `retired` one (the newest version of its path). A target that changes no path of an instance is bulk-eligible. CMS-03C-02 gains `roots` to place the block roots a version adds, and a path whose newest row is `retired` is free at its kept position. Text overrides keep replacing the node's `props`. | /propagate-decision | Decision status, route registry, route field validation matrix, Zod contracts and resources, error matrix, pattern versions and linked updates, canonical records and fields, receiving obligations, authorization matrix, security controls, data flow, state machine, testing, changelog |
| 2026-10-15 | Slice 12 DEC-193 owner clarification and scan fixes (owner answered "Honor each choice" and "Apply listed corrections"; propagation scan `propagation-scan-2026-10-15-codex-dec193-choice.md` APPLY APPROVED). Every explicit per-path `yours`/`theirs` choice of one instance now applies simultaneously: an accept that keeps `yours` on a `structure` or `removed_root` collision materializes the resolved tree (never an unchanged whole-instance copy), descendant answers apply within the topology their chosen ancestor reaches, and a complete answer set that cannot form one consistent reachable tree is refused atomically 422 `COMPOSITION_VALIDATION_FAILED` at `/instances/0/choices` (SQL `VALIDATION_FAILED`) with no new reason code. `detached_tree` is now the private `{ format: 'cms.detached_tree.v1', nodes: [{ parent, keySegments, blockKey, blockVersion, props }] }` preorder snapshot (1-512 nodes, index 0 the sole root, relative key segments preserving reference namespaces, exact effective props, no whole-tree key/KiB/depth bound). Public node addresses use `ExpandedPatternNodePath` (the row-path grammar, 1-72 segments, at most 4680 ASCII characters) for diff `path`/`children`, `choices` path, `newRoots` and `roots`, while the stored row `path`/`slotPath` and the 248-octet cap are unchanged; the diff child list reflects every actual child within the 512-node total. The no-update diff is scoped to a readable pattern-origin row with a positive pin (a standalone no-pin row stays refused), and `detach` admits any linked pattern-origin row including a `retired` one. A row that carries a nonnull `detached_tree` has its provenance pin never reopened: the digest provider, the render plan, restore and the carry-over resolve its detached tree, while a plain `detached` row with a NULL `detached_tree` (a CMS-03C-02 `linkMode: detached` row) is not exempted and keeps its defined pinned render and checker behavior. Amended the validation matrix, Zod contracts, the placing-selected-roots, linked-update, digest-provider, derived-variant-state and canonical-records sections, the composition table rule, the authorization matrix and this changelog. | /propagate-decision | Route field validation matrix, Zod contracts and resources, Pattern versions and linked updates, Canonical records and fields, Receiving obligations, Authorization matrix, Changelog |
| 2026-10-22 | Slice 12 locale-variant read (owner decision DEC-205). Adds `cmsLocaleVariantRead` (`GET /api/v1/cms/entries/{entryId}/locales/{locale}` → `LocaleVariantRead { locale, activeFallbackChain, variant: LocaleVariantResource \| null, fields, resolutions: LocaleFieldResolution[] }`) to the epic index, interaction map, route registry, CMS-03C-20 consumers, validation, error-kind, error matrix and authority rows: authorized exactly like CMS-03C-04 (403 for a visible entry without edit, 404 for a hidden or absent entry or a locale outside `supportedLocales`), the current variant or null with its stored values, every localizable field's resolution and the active fallback order. | /propagate-decision | Epic index, Interaction map, Route Registry, Supporting-read consumers, Validation, Schemas, Error kinds, Error matrix, Authority, Changelog |
| 2026-10-22 | Slice 12 composition-instance list read (owner decision DEC-206). Adds `cmsCompositionInstancesRead` (`GET /api/v1/cms/entries/{entryId}/compositions` → `CompositionInstancePage { revisionId, items: CompositionInstanceResource[] ≤100, nextCursor }`) to the epic index, interaction map, route registry, validation, schemas, error kinds, error matrix (composition catalog) and authority rows: authorized like CMS-03C-02 (403 for a visible entry without edit, 404 hidden/absent), the newest `draft`, `active` or `pending_diff` row of each path of the current draft revision in render-plan order. | /propagate-decision | Epic index, Interaction map, Route Registry, Validation, Schemas, Error kinds, Error matrix, Authority, Changelog |
| 2026-10-22 | Slice 12 governed recheck producers (owner decision DEC-207). The Invalidation paragraph no longer lists the capability-grant revocation transaction among the enqueuers of `cms.governed_review.recheck`: the job is keyed by dependency `(kind, ref_id)`, which cannot name a person, and revocation is covered synchronously by `cms_invalidate_governed_reviews_for_person` (DEC-180 G6, mirroring BE03b). P2-S12-AC-202 updated identically (owner-approved cascade). | /propagate-decision | Governed review machinery, Changelog |
| 2026-10-22 | Slice 12 conflict-resolution carry source (owner decision DEC-209, amending DEC-198 for `cms_resolve_conflict`). Receiving obligation 4 now carries composition into a resolved draft from the entry's current draft (`theirs`), never the conflict base: composition commands write only to the current draft, so carrying from the base silently dropped every placement, accept or detach made since it. `cms_create_revision` still carries from its base revision. P2-S12-AC-245 updated identically (owner-approved cascade). | /propagate-decision | Receiving obligations from Slice 10, Changelog |
| 2026-10-22 | DEC-206 read aligned to BE00 collection rules (root correction after review R3-01/R3-02): `cmsCompositionInstancesRead` takes `limit` 1–50 default 25 and a signed BE00 cursor (authenticated, ≤24 h, bound to route, entry, draft revision, sort and user/acting context; tamper, expiry or cross-context reuse 400), pages at most 50 items, matching CMS-03C-13. | /propagate-decision | Validation, Schemas, Authority, Changelog |
| 2026-10-22 | Block composition rules (owner decision DEC-210, review R1-001). New paragraph in "Pattern versions and linked updates": registry `allowedChildren` and `slotRules` are enforced at CMS-03C-12 save, CMS-03C-02 placement, CMS-03C-15 accept/detach (422 `COMPOSITION_VALIDATION_FAILED`, `details.reasonCode` `block_rules_violated`) and by the `cms.pattern.active_digest` provider (`pattern_block_rules_violated`), so an author is never refused late for a tree that was accepted earlier. | /propagate-decision | Pattern versions and linked updates, Changelog |
| 2026-10-22 | Retry by caller (owner decision DEC-211). Every error-matrix retry cell now separates browser callers (at most two retries after 250 ms and 750 ms for safe operations, FE03 Degradation) from server, queue and job callers (BE00 schedule 15 s/60 s/300 s with jitter, circuit open 60 s); the 15/60/300 s schedule was BE00's queue-consumer rule copied into interactive HTTP rows. P2-S12-AC-169 updated identically (owner-approved cascade). | /propagate-decision | Error matrix, Changelog |
| 2026-10-22 | Merge-recovery support state ratified (implementation decision DEC-212, review R2-01/R2-02): the DEC-194 sweep records each reconciled failed Job in `platform_private.taxonomy_merge_recoveries`, a non-aggregate support table outside the `cms_` namespace (so the `cms_` envelope, RPC-gate policy and guard-trigger invariants keep covering only aggregates), and the merge request, continuation and sweep serialize on a per-party merge-enqueue mutex placed in the Slice 12 lock order. | /propagate-decision | Merge convergence recovery, Database Schema, Slice 12 lock order, Changelog |
| 2026-10-22 | DEC-210 closed-list cascade (root, at lane F2's request): `block_rules_violated` joins the 422 members of "Slice 12 typed refusals" (CMS-03C-02, CMS-03C-12 and CMS-03C-15 only) and `pattern_block_rules_violated` joins the `cms.pattern.active_digest` failure reasons, so both closed lists name the tokens the "Block composition rules (DEC-210)" paragraph already requires. P2-S12-AC-211, P2-S12-AC-238 and P2-S12-AC-274 updated identically (owner-approved cascade of DEC-210). | /propagate-decision | Normative application error catalog, Preflight providers registered by Slice 12, Changelog |
| 2026-10-22 | Database-side locale observability (owner decision DEC-208; mechanism DEC-213, root implementation decision). New paragraph in Observability: a per-minute scheduled Worker read of the service-role RPC `platform_api.cms_locale_observability_read` feeds `cms_locale_fanout_total`, `cms_locale_stale_total` and the new gauge `cms_locale_stale_legal_fields` (the stale locale legal-field alert input); the `locale` label is dropped from `cms_locale_stale_total` because labels never carry locale text. Closes observability-lane BOUNDARY items 1, 2 and 6 (stale half). | /propagate-decision | Fan-out bound and event key, Observability, Changelog |
| 2026-10-22 | DEC-208 read bound corrected (root, after the dec208 lane's observation): the 5 s bound of `cms_locale_observability_read` is the Worker's 5,000 ms call deadline (abort = failed read), not a function `statement_timeout`, which cannot bound its own calling statement. | /propagate-decision | Observability, Changelog |
| 2026-10-22 | DEC-208 read scope and context (root DEC-216 after review V3 F-1/F-10): the gauge counts only entries whose `lifecycle` is `active` (a non-editable entry would hold the alert open forever), and the read sets and restores the transaction-local RPC context like every protected read (without it the forced-RLS tables answer zero rows). | /propagate-decision | Observability, Changelog |
| 2026-10-22 | Review V1 spec residue (root): the `cmsCompositionInstancesRead` route row states its signed cursor and limit like its siblings; the instance read order drops the nonexistent `region`; the merge-recovery support table's three columns, its deliberate missing foreign key and its definer-only grants are specified; the CMS-03C-03 lock-order row names the merge-enqueue mutex. | /propagate-decision | Endpoint table, Schemas, Database Schema, Slice 12 lock order, Changelog |
| 2026-10-22 | Governed recheck hardening (review R3, lane F4b): the governed reviewer-authority invalidation is also driven by the 03b-equivalent AFTER UPDATE/DELETE triggers on `organization_actor_grant` and `membership_tenure` (a tenure change passes a null capability), and a recheck run isolates each review: an unexpected per-review error is counted `unavailable`, the review is left live and the cursor advances (root DEC-218), safe because activation step (4) rechecks everything under its locks. | /propagate-decision | Governed review machinery, Changelog |
| 2026-10-22 | DEC-208 read cost and failure signal (root DEC-219, after the dec208 lane's F-5 cost model): `staleLegalFields` is computed from active entries by a skip scan of the current-row index, so the per-minute cost is bounded by live entries and locales rather than by the append-only stale history; read failures are counted (`cms_locale_observability_read_failed_total`) and five within ten minutes raise `locale_observability_unavailable`; the `created_at` remark now names `clock_timestamp()` at fan-out entry. | /propagate-decision | Observability, Changelog |
| 2026-10-22 | Template supporting reads completed in the error tables (root, after the AC-275 registry-parity lane BOUNDARY): `cmsTemplateContextRead` and `cmsTemplateLatestRead` gain contract-matrix rows, `cmsTemplateContextRead` gains its catalog row (cms.03c.template.v1), and both answer 415 `UNSUPPORTED_MEDIA_TYPE` when media is sent, like every sibling read (the Worker already does). | /propagate-decision | Contract and error matrix, Normative application error catalog, Changelog |
| 2026-10-23 | DEC-208 index and failure alert (root DEC-220, after the dec208 lane's measurements): a third index on the plain `locale` column serves the gauge's skip scan because `lower()` is not leakproof under forced RLS; the read-failure alert fires per failed firing instead of over a ten-minute window, because scheduled firings need not share an isolate and an in-process window could never accumulate. | /propagate-decision | Observability, Changelog |
| 2026-10-23 | Review V2 wording (root): the DEC-210 CMS-03C-12 refusal points into the request `blockTree` (`/blockTree/{i}(/children/{j})*`), as the code and the contract closed pointer set already do; the request has no `nodes` member. | /propagate-decision | Pattern versions and linked updates, Changelog |
| 2026-10-23 | Governed lock failures and revocation races (root DEC-221, review V4-02/V4-05): a lock timeout or deadlock inside the frozen digest recomputation is the retryable conflict, never a changed dependency (recheck, decision and activation share it); the reviewer-authority invalidation re-reads each candidate under the subject lock and skips a review that is no longer live, so a revocation that loses a race with an activation still commits. | /propagate-decision | Governed review machinery, Changelog |
| 2026-10-23 | Linked-update scan details (root DEC-222, lane linked-scan): draft means the current draft revision in derived state `draft`; an older pending head gets a newer pending row; an inactive target is a no-op; appended rows keep the head's `created_by`, change no entry version and write no audit of their own. | /propagate-decision | Pattern versions and linked updates, Changelog |
| 2026-10-23 | Pattern provider reason precedence (root, V2-04(b) BOUNDARY): a category with several failing pins reports the first present reason in the order `pattern_not_active`, `nested_pattern_not_active`, `pattern_digest_changed`, `pattern_block_rules_violated`, as the provider already does. | /propagate-decision | Preflight providers registered by Slice 12, Changelog |
| 2026-10-23 | RPC and grant inventory completed (root, reviews R2-02, R3-10, V4-12): the named-RPC list adds the DEC-195/205/206 supporting reads and the internal recheck resolver, linked-update scan and resolver, merge-recovery sweep and locale observability read, states the real `cms_recheck_governed_reviews(p_request jsonb)` request and result, and names the RLS-forced support table. P2-S12-AC-203 and AC-261 updated identically. | /propagate-decision | Permission, RLS and grants, Changelog |
| 2026-10-23 | Publication commands lock pattern dependencies (root DEC-224; the DEC-199 publication race found that publish, schedule and execute never locked the pattern versions the pattern provider reads, so a concurrent activation could switch a pinned version between the provider's check and the commit): new Slice 12 lock-order row; submit and decision are not changed, because publication rechecks every pin and refuses a stale one. | /propagate-decision | Slice 12 lock order, Changelog |
| 2026-10-24 | Spec-versus-code cleanup from the Slice 12 re-citation (root DEC-227, owner may override; research `docs/handoffs/2026-10-22-claude-s12/recite/spec-questions.md`): CMS-03C-02 body `revisionId`/`patternId` fail 422 like every other body id (field matrix); the CMS-03C-18 caller is `cms_act_taxonomy_term` through `cms_term_overlap_check`, and the activation preflight reads the domain registry (DEC-135 behaviour unchanged); CMS-03C-09 has no separate 422 preflight failure, because the template and pattern preflight inputs are in the step (4) frozen status; CMS-03C-17 is a scoped list, so only a hidden owner scope is 404 and no matching vocabulary is an empty page; CMS-03C-08 create/revoke keep the review version and state except the 03b DEC-161 counted-approval revoke invalidation. No code change. | root | Internal service operations, Route field validation matrix, Contract and error matrix, Per-operation authorization matrix, Governed activation, Registry invariants, State machines, Changelog |
| 2026-10-24 | CMS-03C-12 refusal pointers (root DEC-228, owner may override): a cycle, depth or node-count refusal names the offending request node's `/blockTree/{i}(/children/{j})*` pointer, defined per refusal, so the designer renders it inline at the node (FE03 `CmsPatternVersionDesigner`); this makes the 1525 "like the operation's other `blockTree` refusals" rule concrete. Today's SQL answers the root `/blockTree`: implementation follows. | root | Route field validation matrix, Changelog |
| 2026-10-27 | Taxonomy provider precedence and assignment key (root DEC-229, owner may override; the DEC-141 lane's BOUNDARY items 1 and 3): `cms.taxonomy.assignment_integrity` reports the first present reason in the listed order with one blocking unit per offending assignment or manifest version, like the pattern provider; a TermAssignment's taxonomy foreign key is the assigned term's storage identity, while the revision's `taxonomy_version_ids` name the governing active versions. | root | Preflight providers registered by Slice 12, Receiving obligations from Slice 10, Changelog |
| 2026-10-27 | Unsupported locale on the CMS-03C-04 write (OWNER decision DEC-230, 2026-10-27: "go with 422"): the Route Registry row now matches the field and error matrices — a hidden or absent entry or source revision is 404, a locale outside the active content-type version's `supportedLocales` is 422 `LOCALE_VALIDATION_FAILED`; the read `cmsLocaleVariantRead` keeps its policy-safe 404 for an unsupported locale. P2-S12-AC-055 amended. No code change. | owner | Route Registry, Changelog |
| 2026-10-27 | No 03c consumer of `cms.publication.changed.v1` (root DEC-231, owner may override; spec-questions Q10): nothing in 03c stores eligibility a publication could invalidate — related eligibility is evaluated at read by CMS-03C-21, locale staleness is recorded in the source-change transaction and composition validity follows the governed recheck consumers — so the event table row and P2-S12-AC-061 no longer claim a consumer. No code change. | root | Event schemas, Changelog |
| 2026-10-27 | Slice 12 nested-pattern picker read (owner decision DEC-196, 2026-10-15; root cascade DEC-232). Adds `cmsPatternNestableRead` (`GET /api/v1/cms/patterns/nestable?contentTypeId=…` → `PatternSelectorPage`) to the epic index, interaction map, route registry, validation, schemas, the CMS-03C-13 paragraph, error kinds, error matrix (composition catalog), authority rows and the RPC inventory (`cms_list_pattern_nestable`): designer-only, the `active` versions of the owner scope whose `compatibleTypeIds` contains every requested content type, paged like CMS-03C-13. CMS-03C-13 is unchanged. | /propagate-decision | Epic index, Interaction map, Route Registry, Validation, Schemas, Error kinds, Error matrix, Authority, Permission, Changelog |
| 2026-10-27 | DEC-232 read consistency (root, from the nestable-read lane): `cmsPatternNestableRead` cursor faults are all 400 (no 409 for a keyset read), bounds are 422 at the member and other malformed members 400; `nestable` joins the reserved pattern keys because the read shares the `/patterns/{patternKey}` path space. | root | Route field validation matrix, Contract and error matrix, Changelog |
| 2026-10-28 | Reserved pattern keys aligned (root, review V14-05): the `ReservedPatternKeys` contract and the `cms_pattern_versions` CHECK now list `nestable` as the field matrix does since DEC-232. | root | Schemas, Canonical records and fields, Changelog |
| 2026-10-27 | Taxonomy value re-sends and duplicates (root DEC-233, review V12-06/07): a deprecated term the source revision already assigns in the same field is an existing assignment and stays accepted on a re-sent value by both writers; a duplicated `termId` is refused 422 `VALIDATION_FAILED` at the field pointer, so the stored value stays canonical. | root | Receiving obligations from Slice 10, Changelog |
| 2026-10-28 | Vocabulary without an active version (root, review V12-13): restore refuses its assignments `migration_chain_incomplete`, a new value naming its terms is `term_unavailable`, and a recorded version of it fails the taxonomy provider `taxonomy_version_not_active`. | root | Receiving obligations from Slice 10, Changelog |
| 2026-10-29 | Idempotency binding aligned with BE00 (root DEC-235, refutation round 2 finding on AC-056): a changed actor under the same key is a distinct binding, not a 409, as BE03a ruled for AC300 on 2026-10-02; a changed server-resolved acting party, body, path or version of the same actor stays 409. | root | Shared Contract Inheritance |
| 2026-10-29 | Changed acting party under the same key (root DEC-236, amends DEC-235; lane gaps-db3): the reservation binding includes the server-resolved acting party, but CMS-03C-04 (and every command addressing an owned target) checks ownership and visibility before it reserves, so a changed party meets the target's concealed 404, never a 409 that would confirm the target exists; the 409 applies where no addressed target is out of scope (e.g. CMS-03C-01, CMS-03B-10). | root | Shared Contract Inheritance |
| 2026-10-29 | Taxonomy provider check before the frozen comparison (root DEC-237, owner may override; lane gaps-db4): AC-210 and AC-223 require 422 `canonical_source_unavailable` at taxonomy-version activation, which is reachable only if the unbuilt-provider check precedes the step (4) dependency comparison (the versioned registry gives an unbuilt provider a new row); step (5) now states that order, as the shared activation verdict (`20261014070200`) implements it. | root | Governed activation, retirement and scheduled activation |
| 2026-10-29 | Canonical registry provider pair (root DEC-238, lane gaps-db4, refute3): the ratified AC-256 says `provider_key` and `provider_version` are each non-null exactly when `built`; the DDL CHECK admitted an unbuilt row holding one of them, so the row now also carries `CHECK((provider_key IS NULL) = (provider_version IS NULL))` (forward migration `20261029110000`). | root | Canonical records and fields |
| 2026-10-29 | Restore records only carried vocabularies (root DEC-240, review V16 / closeout BOUNDARY in `20261024100700`): a source-recorded taxonomy version whose vocabulary has no carried assignment is not carried; the restored revision records one current active id per vocabulary with a carried assignment, as every revision writer does, so a restored revision with no terms of a vocabulary never fails publication on that vocabulary's stale version. | root | Receiving obligations from Slice 10 (DEC-141) |
| 2026-10-22 | Render plan and checker pointers (DEC-214, root implementation decision; review R1-008, lane F1 BOUNDARY). The render plan reads each row as a block root followed by the descendant blocks of its effective tree (as the detached-tree rule already required for detached rows), and the plan and checker input name them `/composition/{rowId}` and `/composition/{rowId}/nodes/{i}` (canonical preorder index), matching the DEC-193 implementation. P2-S12-AC-247 updated identically. | /propagate-decision | Pattern versions and linked updates, Changelog |

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


<!-- spec-graph: auto-generated -->
## Related Specs

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]

### Constrained by
- [[decisions.md#d-value|D-VALUE]]
- [[decisions.md#d-retire|D-RETIRE]]
- [[decisions.md#d-detach|D-DETACH]]

### References
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
