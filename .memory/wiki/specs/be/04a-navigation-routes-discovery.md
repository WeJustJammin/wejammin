# CMS Navigation, Routes & Discovery — Backend Specification

**Status:** Complete
**IA source:** [Shard 04 — CMS navigation, media and delivery](../ia/04-cms-delivery-media.md)
**Deep-dive source:** [Deep Dive 04 — CMS navigation, media and delivery](../ia/deep-dives/04-cms-delivery-media.md)
**Backend foundation:** [BE00 — Cross-cutting Platform Foundation](00-infrastructure.md)

## Split Group

This split owns editable menu trees, complete menu activation, canonical slug/redirect manifests, and policy-constrained discovery metadata. It contains DLV-01–DLV-04 and the DEC-115 candidate-review interactions DLV-15–DLV-17. Governed media/renditions (DLV-05–DLV-08) and public delivery/cache/projection workers (DLV-09–DLV-14) remain in sibling splits.

## Classification

- **Type:** CMS navigation and metadata command split.
- **Boundary:** `Menu`, `MenuVersion`, `MenuItemVersion`, `RouteRecord`, `RedirectRecord`, and `DiscoveryMetadataVersion` ownership, plus the delivery-candidate review records `DeliveryCandidateReview`, `DeliveryCandidateReviewDecision`, and `DeliveryCandidateReviewAssignment` (DEC-115); publication truth and policy adjudication remain in Shard 03/05 and delivery effects remain in 04c.
- **Expected operations:** eight HTTP operations. DLV-NAV-API-01–04 are one-to-one with IA interactions DLV-01, DLV-02, DLV-03, and DLV-04; DLV-NAV-API-05 (submit), DLV-NAV-API-06 (decide), DLV-NAV-API-07 (read review), and DLV-NAV-API-08 (assign reviewer) serve IA interactions DLV-15, DLV-16 (decide and read), and DLV-17 (assign).
- **Approval:** delegated authority for the bounded cross-range assist; 04b is owned by another writer and is not edited.
- **Decision lock:** whole-tree activation, normalized canonical routes, bounded redirect graphs, and policy-last discovery overrides are mandatory. Menu, route/redirect, and discovery-metadata candidates become `approved` only through the generalized CMS review machinery (DEC-115) and become `active` only through DLV-NAV-API-02 (DEC-115).

## IA Feature Coverage

The three bullets in IA Shard 04 `§ Features` (lines 24–29) are reconciled across the approved companion split. Media and delivery features remain explicit companion boundaries rather than unrecorded omissions.

| IA feature (exact source title)                       | Owning companion | Operation coverage                                 | Disposition                                                                                                                                                            |
| ----------------------------------------------------- | ---------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **25.04 Navigation, Routes & Discovery Metadata**     | 04a              | DLV-01–DLV-04 and DLV-15–DLV-17; DLV-NAV-API-01–08 | Complete here: menu trees, route/redirect manifests, slugs, policy-last discovery metadata, and reviewer approval of every candidate are authored.                     |
| **25.06 Media Library & Asset Governance**            | 04b              | DLV-05–DLV-08; DLV-04B-01–DLV-04B-04               | Complete in companion 04b: private ingest, scanning, immutable renditions, accessibility, rights, replacement, archive/takedown, and hold are authored there.          |
| **25.09 Content Delivery, Preview & Cache Coherence** | 04c              | DLV-09–DLV-14; DLV-DEL-API-01–06                   | Complete in companion 04c: render-ready reads, exact-version preview, publication/invalidation, last-known-good delivery, and fail-closed recovery are authored there. |

## Referenced Material Inventory

| Source file                                                                       | Section / lines                                                                                                                                    | Material used in this specification                                                                                                       |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`                                  | Overview and Features, lines 9–29                                                                                                                  | CMS delivery boundary and navigation/route/discovery feature scope.                                                                       |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`                                  | Interactions, lines 47–65                                                                                                                          | DLV-01–DLV-04 preconditions, outcomes, rejection rules, and recovery.                                                                     |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`                                  | Contracts, lines 74–87                                                                                                                             | Named locations, menu limits, target kinds, visibility predicates, reserved routes, and slug/redirect rules.                              |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`                                  | Contracts, lines 101–109                                                                                                                           | Projection/privacy/degraded-delivery constraints consumed by route and discovery records.                                                 |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`                                  | Data Models, lines 111–131                                                                                                                         | Canonical model names and navigation/route/discovery relationships.                                                                       |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`                                  | Typed Field and Cardinality Registry, lines 133–152                                                                                                | UUID/time/version/checksum typing and cardinality/immutability rules.                                                                     |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`                                  | Access Control and Access Escalation, lines 154–178                                                                                                | Navigation editor, CMS publisher, public visitor, preview, and delivery-principal authority.                                              |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`                                  | Accessibility, lines 180–188                                                                                                                       | Keyboard-equivalent tree editing, labels, focus, current-page state, and truthful unavailable states.                                     |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`                                  | Event Schemas, lines 190–202                                                                                                                       | `delivery.menu.activated.v1` and `delivery.route.changed.v1` payload/consumer contracts.                                                  |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`                                  | Edge Cases, lines 204–229                                                                                                                          | Cycle/orphan/depth, target privacy, slug collisions/loops, SEO policy override, and stale-manifest recovery.                              |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`                                  | Cross-Shard Dependencies, lines 254–258                                                                                                            | Shard 03/05 ownership and downstream delivery boundaries.                                                                                 |
| `.memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md`                       | Canonical Field Contracts, lines 20–32                                                                                                             | Typed menu, item, route, redirect, and discovery fields.                                                                                  |
| `.memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md`                       | State Machines, lines 56–65                                                                                                                        | Menu/route/discovery lifecycle and immutable-active rules.                                                                                |
| `.memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md`                       | Route and Menu Compilation, lines 67–74                                                                                                            | Normalization, target resolution, tree validation, redirect graph, policy override, and whole-manifest activation.                        |
| `.memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md`                       | Concurrency and Idempotency, lines 120–129                                                                                                         | Manifest leases, expected versions, idempotency, and stale builder fencing.                                                               |
| `.memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md`                       | Abuse and Recovery Verification, lines 130–142                                                                                                     | Unsafe targets, leakage, route tampering, accessibility, and recovery controls.                                                           |
| `.memory/wiki/specs/be/00-infrastructure.md`                                      | Request/Response Contracts, lines 112–201; Deterministic Protocol Rules, lines 330–353                                                             | Zod 4 wire contracts, global `ApiError`, idempotency, ETag, body limits, and collection limits.                                           |
| `.memory/wiki/specs/be/00-infrastructure.md`                                      | Middleware & Policies, lines 253–298; Event and Consumer Contracts, lines 355–416                                                                  | Hono middleware order, CORS, RLS, outbox, and consumer retry behavior.                                                                    |
| `.memory/wiki/specs/2026-08-02-architecture-design.md`                            | API Design, lines 359–376; Security Model, lines 709–790                                                                                           | Hono/Cloudflare boundary, authorization, headers, rate limits, and privacy controls.                                                      |
| `.memory/wiki/specs/be/03a-content-schema-registry.md`                            | CMS-03A-11–CMS-03A-14; `cms_schema_reviews`, `cms_schema_review_decisions`, `cms_schema_review_assignments`; Security and abuse controls (DEC-108) | Review, decision, and assignment shapes, triggers, RLS, owner derivation, and step-up behavior reused by reference for DLV-NAV-API-05–08. |
| `.memory/wiki/specs/be/03b-editorial-workflow-publication.md` and DEC-109/DEC-110 | Code-owned editorial workflow policy registry                                                                                                      | Ordinary-risk policy member whose `requiredDecisionCount` of 1 sets the delivery-candidate review count.                                  |
| `.memory/wiki/specs/be/05a-settings-flags-runtime.md`                             | CFG-05A-02 effective-value read                                                                                                                    | Typed settings source of the discovery policy projection.                                                                                 |
| `.memory/wiki/specs/be/02a-shadow-claim-ownership.md`                             | Shadow lifecycle `created → invited/suppressed/claimed/merged`                                                                                     | Unclaimed and suppressed subject status source of the discovery policy projection.                                                        |
| `.memory/wiki/specs/be/05c-portability-quality-lifecycle.md`                      | CFG-05C-02 lifecycle `hold` and `release_hold`                                                                                                     | Hold source of the discovery policy projection.                                                                                           |

## IA Source Map

| BE section                                           | IA source / trace                                                                                                                                                            |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route registry and commands                          | Shard 04 IA `§ Interactions`, lines 47–65; `§ Contracts`, lines 74–87                                                                                                        |
| Menu, route, redirect, and discovery persistence     | Shard 04 IA `§ Data Models`, lines 111–129; `§ Typed Field and Cardinality Registry`, lines 133–142                                                                          |
| Lifecycle and compiler algorithms                    | Deep Dive 04 `§ State Machines`, lines 56–65; `§ Route and Menu Compilation`, lines 67–74                                                                                    |
| Roles, privacy, accessibility, and edge handling     | Shard 04 IA `§ Access Control`, lines 154–178; `§ Accessibility`, lines 180–188; `§ Edge Cases`, lines 204–229                                                               |
| Menu/route events                                    | Shard 04 IA `§ Event Schemas`, lines 190–202                                                                                                                                 |
| Shared transport and reliability                     | BE00 `§ Request/Response Contracts`, lines 112–201; `§ Deterministic Protocol Rules`, lines 330–353; `§ Event and Consumer Contracts`, lines 355–416                         |
| Candidate review, decision, and assignment (DEC-115) | Shard 04 IA `§ Interactions` DLV-15–DLV-17; `§ Contracts` (Candidate review); `§ Data Models` (`DeliveryCandidateReview*`); Deep Dive 04 `§ Candidate Review and Activation` |
| Discovery policy projection (D24)                    | Shard 04 IA `§ Contracts` (Discovery override); Deep Dive 04 `§ Discovery Policy Projection`                                                                                 |

## Endpoint Completeness Reconciliation

| IA interaction                              | BE operation ID                | Method and path                                                                                         | Result                                                                                                                                                                                                                                                 |
| ------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DLV-01 Create/edit menu tree                | DLV-NAV-API-01                 | `POST /api/v1/cms/menus/{menuId}/versions`                                                              | Reconciled: validates a bounded typed tree and writes a versioned draft while the active tree remains unchanged.                                                                                                                                       |
| DLV-02 Publish menu version                 | DLV-NAV-API-02                 | `POST /api/v1/cms/menus/{menuId}/versions/{menuVersionId}/publish`                                      | Reconciled: checks that the menu version and every named route/redirect/discovery candidate are `approved` by a decided DLV-16 review, complete tree/hash/audiences, expected active manifest, and whole-manifest activation.                          |
| DLV-03 Create/change slug                   | DLV-NAV-API-03                 | `POST /api/v1/cms/publications/{publicationId}/routes/slugs`                                            | Reconciled: normalizes path, preserves canonical history, and commits one draft route candidate plus its draft redirect candidate and the path reservation atomically; the active manifest is unchanged until DLV-02 activates the approved candidate. |
| DLV-04 Configure discovery metadata         | DLV-NAV-API-04                 | `POST /api/v1/cms/publications/{publicationId}/discovery-metadata`                                      | Reconciled: stores a bounded draft metadata candidate and evaluates the discovery policy projection (privacy, suppression, unclaimed, hold, embargo, archive, and authorization overrides) last.                                                       |
| DLV-15 Submit delivery candidate for review | DLV-NAV-API-05                 | `POST /api/v1/cms/delivery-reviews`                                                                     | Reconciled: freezes one draft menu version, route candidate (with its redirect candidates), or discovery-metadata candidate and moves it `draft → review`.                                                                                             |
| DLV-16 Decide delivery candidate review     | DLV-NAV-API-06, DLV-NAV-API-07 | `POST /api/v1/cms/delivery-reviews/{reviewId}/decisions`; `GET /api/v1/cms/delivery-reviews/{reviewId}` | Reconciled: an independently assigned reviewer with recent MFA appends one immutable decision (06); the capability-scoped review projection is read separately (07).                                                                                   |
| DLV-17 Assign delivery review capability    | DLV-NAV-API-08                 | `POST /api/v1/cms/delivery-reviews/{reviewId}/assignments`                                              | Reconciled: the derived owner creates or revokes a bounded read/decide assignment on one frozen review.                                                                                                                                                |

No operation is inherited without an operation ID. BE00 supplies transport, error, idempotency, RLS, and outbox behavior; it does not add a CMS navigation endpoint. The review, decision, and assignment record shapes of DLV-NAV-API-05–08 are the BE03a (DEC-108) shapes applied to delivery subjects; BE03a remains their definition and 04a states only the substitutions.

## API Endpoints

### Route Registry

| Operation ID   | Method | Path                                                          | IA interaction | Auth / ownership                                                                                                                     | Success                                                            |
| -------------- | ------ | ------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| DLV-NAV-API-01 | POST   | `/api/v1/cms/menus/{menuId}/versions`                         | DLV-01         | Navigation editor for assigned menu/location; target publication/route ownership is checked                                          | `201` draft menu version                                           |
| DLV-NAV-API-02 | POST   | `/api/v1/cms/menus/{menuId}/versions/{menuVersionId}/publish` | DLV-02         | CMS publisher with assigned location capability                                                                                      | `200` active menu/route manifest projection                        |
| DLV-NAV-API-03 | POST   | `/api/v1/cms/publications/{publicationId}/routes/slugs`       | DLV-03         | Navigation editor for target publication/locale                                                                                      | `201` draft route candidate with its draft redirect candidate      |
| DLV-NAV-API-04 | POST   | `/api/v1/cms/publications/{publicationId}/discovery-metadata` | DLV-04         | Navigation editor for target publication/locale                                                                                      | `201` draft discovery metadata version                             |
| DLV-NAV-API-05 | POST   | `/api/v1/cms/delivery-reviews`                                | DLV-15         | Navigation editor holding the subject's own editor scope (menu/location, or publication/locale)                                      | `201` open delivery review                                         |
| DLV-NAV-API-06 | POST   | `/api/v1/cms/delivery-reviews/{reviewId}/decisions`           | DLV-16         | Independently authenticated human with an active `cms.delivery_review` assignment on that frozen review and recent binding-bound MFA | `201` immutable review decision                                    |
| DLV-NAV-API-07 | GET    | `/api/v1/cms/delivery-reviews/{reviewId}`                     | DLV-16         | Submitter editor scope or assigned review-only scope                                                                                 | `200` capability-safe review projection, `Cache-Control: no-store` |
| DLV-NAV-API-08 | POST   | `/api/v1/cms/delivery-reviews/{reviewId}/assignments`         | DLV-17         | Receipt-derived owner with `cms.delivery_review.assign` and recent binding-bound MFA                                                 | `201` create or `200` revoke assignment                            |

### Transport and external seams

All routes use HTTPS JSON, `X-Request-Id`, `Idempotency-Key`, `If-Match`, strict body limits, and BE00 error/outbox conventions. Unknown JSON keys, unsupported media types, malformed UUIDs, and oversized trees are rejected before database or provider effects. DLV-NAV-API-07 is a GET: it takes no body, `Idempotency-Key`, or `If-Match`.

| Seam                                                                  | Exact request                                                                                                     | Exact response                                                                                                                                                                                                                           |   Timeout | Retry / backoff                                          | Circuit breaker and recovery                                                                                                                                                        |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------: | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shard 03 publication/route resolver                                   | `{ publicationId: uuid, publicationVersion: bigint, locale: string, targetKind: string, targetId: uuid }`         | `{ active: boolean, approved: boolean, visible: boolean, version: bigint, routeClass: string }`                                                                                                                                          |    500 ms | 2 retries at 75 ms, 150 ms; read-safe                    | Open after 5 failures/30 s; unknown target fails closed with `TARGET_NOT_ELIGIBLE`; probe restores validation.                                                                      |
| Shard 05 policy projection (defined in § Discovery policy projection) | `{ publicationId: uuid, locale: string, policyVersion: bigint, fields: string[] }`                                | `{ noindex: boolean, excludeSitemap: boolean, redactFields: string[], blockerCode: 'policy_unavailable'\|'unclaimed_subject'\|'suppressed_subject'\|'lifecycle_hold'\|'settings_noindex'\|'target_not_visible'\|null, version: bigint }` |    500 ms | 2 retries at 75 ms, 150 ms; deterministic read           | Open 30 s; unavailable policy is the explicit fail-closed `policy_unavailable` state (noindex, sitemap exclusion, optional fields redacted, blocker recorded), never editor values. |
| BE00 route compiler worker                                            | `{ menuVersionId: uuid, manifestVersion: bigint, locale: string, audienceClass: string, treeHash: string }`       | `{ routeManifestVersionId: uuid, state: 'ready'                                                                                                                                                                                          | 'blocked' | 'failed_retryable', routeHash: string, errorCode: string | null }`                                                                                                                                                                             | 1,000 ms                            | 3 retries at 100 ms, 250 ms, 500 ms; lease/idempotency key                             | Open 45 s; stale builder cannot switch pointer; failed build keeps prior active manifest. |
| BE00 outbox/event registry                                            | `{ aggregateId: uuid, aggregateVersion: bigint, eventType: string, payloadHash: string, idempotencyKey: string }` | `{ eventId: uuid, state: 'committed'                                                                                                                                                                                                     | 'pending' | 'dead_lettered' }`                                       | 500 ms                                                                                                                                                                              | 3 retries at 100 ms, 250 ms, 500 ms | Open 60 s; committed domain rows remain authoritative and replay is keyed by event ID. |

### Discovery policy projection

Shard 05 owns governed policy definitions, but BE05a and BE05b define no discovery projection. This split therefore defines the read-only projection it consumes (D24). It is evaluated server-side from three registered sources and the existing Shard 03 resolver; no input is supplied by the client, and the result can only tighten authored values.

| Source                                                           | Provider contract                                                                                                                                                                                                                   | Effect                                                                                                                                                                                                                               |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Typed settings (Slice 07, BE05a CFG-05A-02 effective-value read) | Code-registered setting keys `delivery.discovery.noindex_default` (boolean) and `delivery.discovery.redact_fields` (string array of at most 4 members drawn from `description`, `social_asset_id`, `breadcrumb`, `structured_data`) | `noindex_default = true` forces `noindex` with blocker `settings_noindex`; `redact_fields` is unioned into `redactFields`. A key that is unregistered, malformed, or unresolved is a failed read.                                    |
| Unclaimed status (Slice 05, BE02a shadow lifecycle)              | For each subject party referenced by the exact publication version's binding descriptors, the shadow state                                                                                                                          | `created` or `invited` forces `noindex` and sitemap exclusion with blocker `unclaimed_subject`; `suppressed` with blocker `suppressed_subject`; `claimed` and `merged` have no effect. An unknown state is a failed read.            |
| Holds (Slice 16, BE05c lifecycle `hold` and `release_hold`)      | Any hold request not released whose scope covers the publication or a referenced subject                                                                                                                                            | Forces `noindex` and sitemap exclusion with blocker `lifecycle_hold`. Until the Slice 16 hold provider is registered no hold record can exist, so the hold set is empty; once registered, a failed read is a failed projection read. |
| Shard 03 resolver (existing seam)                                | `visible: false` or `active: false` for the target                                                                                                                                                                                  | Forces `noindex` and sitemap exclusion with blocker `target_not_visible`, which covers embargo, archive, and unpublish without disclosing the reason.                                                                                |

Evaluation rules:

- `noindex` and `excludeSitemap` are the OR over all sources and `redactFields` is the union. The effective projection is `noindex = authored.noindex OR projection.noindex`, `sitemap_excluded = effective noindex OR projection.excludeSitemap`, and every field named in `redactFields` is returned as its empty value. A projection can never relax an authored `noindex: true`.
- When several blockers apply, `blockerCode` is the first in this precedence order: `policy_unavailable`, `lifecycle_hold`, `suppressed_subject`, `unclaimed_subject`, `target_not_visible`, `settings_noindex`.
- `version` is a bigint that increases whenever any input version changes; the synthesized unavailable result carries `version: 0`.
- **Fail-closed `policy_unavailable` state.** A failed source read, an open circuit, or a seam timeout produces exactly `{ noindex: true, excludeSitemap: true, redactFields: ['description', 'social_asset_id', 'breadcrumb', 'structured_data'], blockerCode: 'policy_unavailable', version: 0 }`. DLV-NAV-API-04 and DLV-NAV-API-05 return `503 DEPENDENCY_UNAVAILABLE` and store no draft or review row, DLV-NAV-API-02 returns `503 DEPENDENCY_UNAVAILABLE` and activates nothing, and 04c convergence and serve still render the page but publish the synthesized noindex state and record the `policy_unavailable` blocker on the projection consumer state until the next successful evaluation. Editor values are never published while the state holds.
- The projection never reveals which source produced a blocker beyond the `blockerCode` and never discloses the protected fact it protects.

## Request/Response Contracts

All schemas below are Zod 4 schemas. Every failure uses the BE00/global error envelope exactly: `ApiError { code, message, requestId, details }`.

### Shared and operation schemas

```ts
const CommandContext = z
  .object({
    actor_person_id: z.string().uuid(),
    acting_party_id: z.string().uuid(),
    acting_context_version: z.string().min(1).max(128),
    idempotency_key: z.string().regex(/^[A-Za-z0-9._:-]{16,128}$/),
    request_id: z.string().uuid(),
    expected_version: z.bigint().positive().optional(),
  })
  .strict();

const LocationKey = z.enum([
  'primary',
  'utility',
  'footer',
  'legal',
  'account',
]);
const TargetKind = z.enum(['publication', 'internal_route', 'external_https']);
const VisibilityPredicate = z.enum([
  'always',
  'anonymous',
  'authenticated',
  'locale',
  'capability',
  'entitlement',
  'feature_available',
]);
const MenuTarget = z
  .object({
    target_kind: TargetKind,
    target_ref: z.string().trim().min(1).max(512),
    visibility: z.array(VisibilityPredicate).max(8),
  })
  .strict();
const MenuItemInput = z
  .object({
    item_id: z.string().uuid(),
    parent_item_id: z.string().uuid().nullable(),
    position: z.number().int().min(0).max(199),
    label: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    icon_key: z
      .string()
      .regex(/^[a-z0-9._-]{1,64}$/)
      .optional(),
    target: MenuTarget,
  })
  .strict();
const ApiErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    requestId: z.string().uuid(),
    details: z.record(z.string(), z.json()),
  })
  .strict(); // ApiError { code, message, requestId, details }

const CreateMenuVersionRequest = CommandContext.extend({
  menu_id: z.string().uuid(),
  location_key: LocationKey,
  locale: z.string().regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})?$/),
  audience_class: z.string().regex(/^[a-z0-9_-]{1,48}$/),
  items: z.array(MenuItemInput).max(200),
  tree_hash: z.string().regex(/^[a-f0-9]{64}$/),
})
  .strict()
  .superRefine((v, ctx) => {
    const byId = new Set(v.items.map((i) => i.item_id));
    const children = new Map();
    for (const i of v.items) {
      if (i.parent_item_id && !byId.has(i.parent_item_id))
        ctx.addIssue({
          code: 'custom',
          path: ['items'],
          message: 'parent must be in same candidate tree',
        });
      children.set(
        i.parent_item_id ?? 'root',
        (children.get(i.parent_item_id ?? 'root') ?? 0) + 1,
      );
    }
    if ([...children.values()].some((n) => n > 50))
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'sibling limit exceeded',
      });
  });
const CreateMenuVersionSuccess = z
  .object({
    menu_id: z.string().uuid(),
    menu_version_id: z.string().uuid(),
    version: z.bigint().positive(),
    state: z.literal('draft'),
    tree_hash: z.string().regex(/^[a-f0-9]{64}$/),
    event_id: z.string().uuid(),
  })
  .strict();

const PublishMenuVersionRequest = CommandContext.extend({
  menu_id: z.string().uuid(),
  menu_version_id: z.string().uuid(),
  expected_active_manifest_version: z.bigint().positive(),
  preview_tree_hash: z.string().regex(/^[a-f0-9]{64}$/),
  audiences: z
    .array(z.string().regex(/^[a-z0-9_-]{1,48}$/))
    .min(1)
    .max(16),
  route_candidate_ids: z.array(z.string().uuid()).max(200).default([]),
  metadata_candidate_ids: z.array(z.string().uuid()).max(200).default([]),
}).strict();
const PublishMenuVersionSuccess = z
  .object({
    menu_id: z.string().uuid(),
    menu_version_id: z.string().uuid(),
    route_manifest_version_id: z.string().uuid(),
    state: z.literal('active'),
    version: z.bigint().positive(),
    activated_route_ids: z.array(z.string().uuid()).max(200),
    activated_metadata_version_ids: z.array(z.string().uuid()).max(200),
    event_id: z.string().uuid(),
  })
  .strict();

const SlugRequest = CommandContext.extend({
  publication_id: z.string().uuid(),
  locale: z.string().regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})?$/),
  current_path: z
    .string()
    .regex(/^\/[a-z0-9][a-z0-9\/_-]{0,511}$/)
    .optional(),
  proposed_path: z.string().min(2).max(512),
  target_version: z.bigint().positive(),
  redirect_status: z.union([z.literal(301), z.literal(308)]),
}).strict();
const SlugSuccess = z
  .object({
    route_id: z.string().uuid(),
    normalized_path: z.string().regex(/^\/[a-z0-9][a-z0-9\/_-]{0,511}$/),
    redirect_id: z.string().uuid().nullable(),
    state: z.literal('draft'),
    version: z.bigint().positive(),
    event_id: z.string().uuid(),
  })
  .strict();

const DiscoveryMetadataRequest = CommandContext.extend({
  publication_id: z.string().uuid(),
  locale: z.string().regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})?$/),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(320),
  canonical_url: z.string().url().max(2048),
  noindex: z.boolean(),
  social_asset_id: z.string().uuid().nullable(),
  breadcrumb: z
    .array(
      z
        .object({
          label: z.string().trim().min(1).max(120),
          route_id: z.string().uuid(),
        })
        .strict(),
    )
    .max(32),
  structured_data: z.record(z.string(), z.json()),
  policy_overrides: z.array(z.string().regex(/^[a-z0-9_-]{1,64}$/)).max(32),
}).strict();
const DiscoveryMetadataSuccess = z
  .object({
    discovery_metadata_version_id: z.string().uuid(),
    publication_id: z.string().uuid(),
    locale: z.string().regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})?$/),
    state: z.literal('draft'),
    noindex: z.boolean(),
    sitemap_excluded: z.boolean(),
    blocker_code: z
      .string()
      .regex(/^[a-z0-9_-]{1,64}$/)
      .nullable(),
    version: z.bigint().positive(),
    event_id: z.string().uuid(),
  })
  .strict();
const ErrorResponse = ApiErrorSchema;

// DEC-115 delivery-candidate review (shapes follow BE03a SchemaReview*, wire names are snake_case like this file)
const DeliverySubjectKind = z.enum([
  'menu_version',
  'route_record',
  'discovery_metadata_version',
]); // a RedirectRecord is reviewed with its route_record, never alone
const DeliveryReviewState = z.enum([
  'open',
  'approved',
  'rejected',
  'invalidated',
]);
const Sha256Hex = z.string().regex(/^[a-f0-9]{64}$/);
const ReviewCommandContext = CommandContext.omit({ expected_version: true }); // CAS comes from the explicit expected_* field and If-Match

const SubmitDeliveryReviewRequest = ReviewCommandContext.extend({
  subject_kind: DeliverySubjectKind,
  subject_id: z.string().uuid(),
  expected_subject_version: z.bigint().positive(),
}).strict();
const DeliveryReviewDecisionRef = z
  .object({
    decision_id: z.string().uuid(),
    decision: z.enum(['approve', 'reject']),
    decided_at: z.string().datetime({ offset: true }),
  })
  .strict();
const DeliveryReviewResource = z
  .object({
    review_id: z.string().uuid(),
    subject_kind: DeliverySubjectKind,
    subject_id: z.string().uuid(),
    subject_version: z.bigint().positive(),
    state: DeliveryReviewState,
    version: z.bigint().positive(),
    policy_key: z.string().regex(/^[a-z][a-z0-9._-]{0,127}$/),
    policy_version: z.bigint().positive(),
    policy_hash: Sha256Hex,
    risk_class: z.literal('ordinary'),
    required_decision_count: z.number().int().min(1).max(8),
    recorded_decision_count: z.number().int().min(0).max(8),
    frozen_hash: Sha256Hex,
    approval_evidence_hash: Sha256Hex.nullable(),
    decisions: z.array(DeliveryReviewDecisionRef).max(8),
    permitted_next_actions: z
      .array(z.enum(['decide', 'assign', 'resubmit']))
      .max(3),
    submitted_at: z.string().datetime({ offset: true }),
    decided_at: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

const DecideDeliveryReviewRequest = ReviewCommandContext.extend({
  review_id: z.string().uuid(),
  expected_review_version: z.bigint().positive(),
  decision: z.enum(['approve', 'reject']),
}).strict();
const DeliveryReviewDecisionResource = z
  .object({
    decision_id: z.string().uuid(),
    review_id: z.string().uuid(),
    decision: z.enum(['approve', 'reject']),
    decided_at: z.string().datetime({ offset: true }),
    review_state: DeliveryReviewState,
    review_version: z.bigint().positive(),
    approved_at: z.string().datetime({ offset: true }).nullable(),
    approval_evidence_hash: Sha256Hex.nullable(),
  })
  .strict();

const AssignDeliveryReviewRequest = z.discriminatedUnion('action', [
  ReviewCommandContext.extend({
    action: z.literal('create'),
    review_id: z.string().uuid(),
    expected_review_version: z.bigint().positive(),
    reviewer_person_id: z.string().uuid(),
    expires_at: z.string().datetime({ offset: true }),
    reason: z.string().min(1).max(256).optional(),
  }).strict(),
  ReviewCommandContext.extend({
    action: z.literal('revoke'),
    review_id: z.string().uuid(),
    expected_review_version: z.bigint().positive(),
    assignment_id: z.string().uuid(),
    reason: z.string().min(1).max(256).optional(),
  }).strict(),
]);
const DeliveryReviewAssignmentResource = z
  .object({
    assignment_id: z.string().uuid(),
    review_id: z.string().uuid(),
    state: z.enum(['active', 'revoked']),
    actions: z.tuple([z.literal('read'), z.literal('decide')]),
    starts_at: z.string().datetime({ offset: true }),
    ends_at: z.string().datetime({ offset: true }),
    version: z.bigint().positive(),
  })
  .strict();
```

### Operation Contract Matrix

| Operation ID   | Request schema                | Success schema/status                                           | Error schema/status                                                                                    |
| -------------- | ----------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| DLV-NAV-API-01 | `CreateMenuVersionRequest`    | `CreateMenuVersionSuccess` / `201`                              | `ErrorResponse` (`ApiError { code, message, requestId, details }`) / `400,401,403,404,409,422,429,503` |
| DLV-NAV-API-02 | `PublishMenuVersionRequest`   | `PublishMenuVersionSuccess` / `200`                             | `ErrorResponse` (`ApiError { code, message, requestId, details }`) / `400,401,403,404,409,422,429,503` |
| DLV-NAV-API-03 | `SlugRequest`                 | `SlugSuccess` / `201`                                           | `ErrorResponse` (`ApiError { code, message, requestId, details }`) / `400,401,403,404,409,422,429,503` |
| DLV-NAV-API-04 | `DiscoveryMetadataRequest`    | `DiscoveryMetadataSuccess` / `201`                              | `ErrorResponse` (`ApiError { code, message, requestId, details }`) / `400,401,403,404,409,422,429,503` |
| DLV-NAV-API-05 | `SubmitDeliveryReviewRequest` | `DeliveryReviewResource` / `201`                                | `ErrorResponse` (`ApiError { code, message, requestId, details }`) / `400,401,403,404,409,422,429,503` |
| DLV-NAV-API-06 | `DecideDeliveryReviewRequest` | `DeliveryReviewDecisionResource` / `201`                        | `ErrorResponse` (`ApiError { code, message, requestId, details }`) / `400,401,403,404,409,429,503`     |
| DLV-NAV-API-07 | path `reviewId` UUID          | `DeliveryReviewResource` / `200`                                | `ErrorResponse` (`ApiError { code, message, requestId, details }`) / `400,401,403,404,429,503`         |
| DLV-NAV-API-08 | `AssignDeliveryReviewRequest` | `DeliveryReviewAssignmentResource` / `201` create, `200` revoke | `ErrorResponse` (`ApiError { code, message, requestId, details }`) / `400,401,403,404,409,422,429,503` |

### Field Validation Matrix

| Operation      | Required validation and invariant                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DLV-NAV-API-01 | Location is one of `primary`, `utility`, `footer`, `legal`, `account`; tree depth is at most 3, item count at most 200, siblings at most 50; targets are active publications, approved internal routes, or allowlisted HTTPS URLs; visibility is bounded AND predicates; cycles/orphans, preview/admin/private targets, active schemes, sensitive client predicates, and missing keyboard-equivalent labels reject.                                                                                                                                                                                                                                                                                                                                 |
| DLV-NAV-API-02 | The menu version (or, for a manifest-only activation, the currently active menu version of the same location, locale, and audience class) is `approved`/complete and every `route_candidate_ids` and `metadata_candidate_ids` entry is `approved` by a decided DLV-NAV-API-06 review whose `frozen_hash` equals the evidence recomputed at activation; each approving reviewer's assignment and `cms.delivery_review` capability are still current; tree hash matches previewed responsive variants and each audience; expected active manifest version matches; target eligibility and the discovery policy projection are rechecked; only a whole manifest activates; active versions are immutable and stale builders cannot switch the pointer. |
| DLV-NAV-API-03 | Path is Unicode NFC, locale-lowercase, slash-delimited safe segments; reserved `/api`, `/admin`, `/auth`, `/_astro`, `/.well-known`, `/health`, `/preview`, and code-declared prefixes reject; canonical collision (against the active manifest and every live draft, review, or approved route candidate), locale ambiguity, self-loop, cycle, and redirect chain over five hops reject; the draft route candidate, its draft redirect candidate, and the path reservation commit together and the active manifest is untouched.                                                                                                                                                                                                                   |
| DLV-NAV-API-04 | Title/description/canonical/card/breadcrumb/structured-data values are bounded; publication policy resolves before commit; privacy, suppression, unclaimed, embargo, archive, legal, safety, and authorization policy overrides editor values; blocked facts force noindex/sitemap exclusion with a blocker and no protected existence leak; the discovery policy projection (§ Discovery policy projection) is evaluated before commit and an unavailable projection is `503 DEPENDENCY_UNAVAILABLE` with no draft stored.                                                                                                                                                                                                                         |
| DLV-NAV-API-05 | `subject_kind` is one of `menu_version`, `route_record`, `discovery_metadata_version`; the subject is inside the caller's own editor scope, is `draft`, and its `version` equals both `expected_subject_version` and the strong `If-Match`; the candidate is revalidated with the gates of its creating operation (tree/target gate, normalization/reservation/graph gate with its bundled redirect candidates, or policy projection); the code-owned policy `cms.delivery.navigation` resolves; one `open` review exists per `(subject_kind, subject_id, subject_version)`; evidence is frozen into `frozen_hash` and the subject moves `draft → review` in the same transaction.                                                                  |
| DLV-NAV-API-06 | Review is `open`; the reviewer is server-resolved from the session, is not the submitter, has not already decided, holds an active unexpired assignment and the current `cms.delivery_review` capability, and presents recent binding-bound MFA; `decision` is `approve` or `reject`; `expected_review_version` equals the strong `If-Match`; frozen evidence is recomputed and must equal `frozen_hash`; approval requires `recorded approvals >= required_decision_count` before the subject becomes `approved`.                                                                                                                                                                                                                                  |
| DLV-NAV-API-07 | Path `reviewId` is a UUID; no body, `Idempotency-Key`, or `If-Match`; returns only the capability-safe projection (frozen evidence digest, required and recorded counts, decision references, permitted next actions) and never reviewer or grantor identity.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| DLV-NAV-API-08 | `action` is `create` or `revoke` with the exact `expected_review_version`; `create` names an existing eligible human (never the submitter) and a finite `expires_at` no later than seven days after `starts_at` and no later than the grantor's current effective authority; only `read` and `decide` on this one frozen review are grantable; `revoke` names an existing active assignment of this review; no identity is created and the assignment is never delegable.                                                                                                                                                                                                                                                                           |

### Error, authorization, idempotency, rate, and observability matrix

| Operation      | Status/code matrix (all bodies are `ApiError { code, message, requestId, details }`)                                                                                                                                                                                                                                                                                                                                | Authorization and 403/404 rule                                                                                                                    | Idempotency / rate / observability                                                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DLV-NAV-API-01 | `400 VALIDATION_FAILED`; `401 UNAUTHENTICATED`; `403 FORBIDDEN`; `404 MENU_NOT_FOUND` or target-safe not-found; `409 VERSION_CONFLICT` or `IDEMPOTENCY_MISMATCH`; `422 TARGET_NOT_ELIGIBLE`/`TREE_INVALID`; `429 RATE_LIMITED`; `503 DEPENDENCY_UNAVAILABLE`                                                                                                                                                        | 403 for known assigned menu without editor capability; 404 for a menu outside actor projection or undiscoverable target                           | 24h key per menu/tree hash; 30 drafts/min/editor; trace operationId/menuVersionId/treeHash/result; never log labels, private target refs, or URLs.                                                                              |
| DLV-NAV-API-02 | `400 VALIDATION_FAILED`; `401 UNAUTHENTICATED`; `403 FORBIDDEN`; `404 MENU_VERSION_NOT_FOUND`; `409 VERSION_CONFLICT`/`IDEMPOTENCY_MISMATCH`; `422 PUBLISH_BLOCKED` (with `details.reason` of `candidate_not_approved`, `review_drift`, or `authority_drift`)/`TREE_HASH_MISMATCH`/`TARGET_NOT_ELIGIBLE`; `429 RATE_LIMITED`; `503 DEPENDENCY_UNAVAILABLE`                                                          | 403 for visible candidate without publisher capability; 404 hides a candidate outside publisher scope                                             | 24h key per candidate/hash/manifest version; 10 publishes/hour/location; trace manifest/version/readiness/error consumer; no draft fields.                                                                                      |
| DLV-NAV-API-03 | `400 VALIDATION_FAILED`; `401 UNAUTHENTICATED`; `403 FORBIDDEN`; `404 PUBLICATION_NOT_FOUND`; `409 ROUTE_CONFLICT`/`VERSION_CONFLICT`/`IDEMPOTENCY_MISMATCH`; `422 REDIRECT_GRAPH_INVALID`/`TARGET_NOT_ELIGIBLE`; `429 RATE_LIMITED`; `503 DEPENDENCY_UNAVAILABLE`                                                                                                                                                  | 403 for visible publication without editor capability; 404 for an undiscoverable publication/target                                               | 24h key per publication/path/version; 30 slug writes/hour/editor; trace normalized path hash/manifest/version; do not log raw paths for protected publications.                                                                 |
| DLV-NAV-API-04 | `400 VALIDATION_FAILED`; `401 UNAUTHENTICATED`; `403 FORBIDDEN`; `404 PUBLICATION_NOT_FOUND`; `409 VERSION_CONFLICT`/`IDEMPOTENCY_MISMATCH`; `422 DISCOVERY_POLICY_BLOCKED`/`CANONICAL_INVALID`; `429 RATE_LIMITED`; `503 DEPENDENCY_UNAVAILABLE`                                                                                                                                                                   | 403 for visible publication without locale editor capability; 404 hides suppressed/private publication                                            | 24h key per publication/locale/content hash; 60 writes/hour/editor; trace policy version/noindex/blocker/version; never log descriptions or structured data.                                                                    |
| DLV-NAV-API-05 | `400 VALIDATION_FAILED`; `401 UNAUTHENTICATED`; `403 FORBIDDEN`; `404 SUBJECT_NOT_FOUND`; `409 VERSION_CONFLICT`/`REVIEW_CONFLICT` (`details.reason` of `live_review_exists` or `subject_not_draft`)/`IDEMPOTENCY_MISMATCH`; `422 TREE_INVALID`/`TARGET_NOT_ELIGIBLE`/`REDIRECT_GRAPH_INVALID`/`DISCOVERY_POLICY_BLOCKED`/`REVIEW_POLICY_UNRESOLVED`; `429 RATE_LIMITED`; `503 DEPENDENCY_UNAVAILABLE`              | 403 for a visible subject without the subject's editor capability; 404 for a subject outside the actor projection                                 | 24h key per subject kind, subject, and version; 30 submissions/hour/editor (the DLV-NAV-API-03 limit); trace operationId/reviewId/subjectKind/frozenHash/result; never log labels, paths, descriptions, or private target refs. |
| DLV-NAV-API-06 | `400 VALIDATION_FAILED`; `401 UNAUTHENTICATED`/`STEP_UP_REQUIRED` (`details { recoveryAction: 'step_up', allowedMethods: string[] }`); `403 FORBIDDEN`; `404 REVIEW_NOT_FOUND`; `409 VERSION_CONFLICT`/`REVIEW_CONFLICT` (`details.reason` of `submitter_self`, `repeated_human`, `review_closed`, `evidence_drift`, or `authority_drift`)/`IDEMPOTENCY_MISMATCH`; `429 RATE_LIMITED`; `503 DEPENDENCY_UNAVAILABLE` | 403 for a readable review without an active assignment or `cms.delivery_review`; 404 for a concealed review, indistinguishable from an absent one | 24h key per review, reviewer, and decision; 30/min/user and 60/min/party (BE03a CMS-03A-12); trace operationId/reviewId/decision/result and review state; never log reviewer identity, labels, or paths.                        |
| DLV-NAV-API-07 | `400 VALIDATION_FAILED`; `401 UNAUTHENTICATED`; `403 FORBIDDEN`; `404 REVIEW_NOT_FOUND`; `429 RATE_LIMITED`; `503 DEPENDENCY_UNAVAILABLE`                                                                                                                                                                                                                                                                           | 403 for a readable review without read scope; 404 for concealed, absent, or out-of-scope review                                                   | No idempotency or CAS; 120/min/user and 240/min/party (BE03a CMS-03A-13); `Cache-Control: no-store`; no mutation, audit write, or outbox write on success or failure.                                                           |
| DLV-NAV-API-08 | `400 VALIDATION_FAILED`; `401 UNAUTHENTICATED`/`STEP_UP_REQUIRED` (same `details`); `403 FORBIDDEN`; `404 REVIEW_NOT_FOUND`; `409 VERSION_CONFLICT`/`REVIEW_CONFLICT` (`details.reason` of `review_closed`, `ineligible_reviewer`, `self_assignment`, or `assignment_not_found`)/`IDEMPOTENCY_MISMATCH`; `422 INVALID_EXPIRY`; `429 RATE_LIMITED`; `503 DEPENDENCY_UNAVAILABLE`                                     | 403 when the caller is not the derived owner or lacks `cms.delivery_review.assign`; 404 for a concealed or cross-owner review                     | 24h key per review and assignment; 10/min/user and 20/min/party (BE03a CMS-03A-14); trace operationId/reviewId/action/result; never log reviewer or grantor identity.                                                           |

## Database Schema

### PostgreSQL model registry

| Canonical model                                                         | Typed fields, nullability, constraints, foreign keys, indexes, RLS, and grants                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Menu`                                                                  | `id uuid PK`; `owner_id uuid NOT NULL FK party.id`; `key varchar(64) NOT NULL UNIQUE`; `location_key text NOT NULL CHECK (location_key IN ('primary','utility','footer','legal','account'))`; `state text NOT NULL CHECK (state IN ('draft','review','approved','active','superseded','revoked'))`; `version bigint NOT NULL CHECK (version>0)`; `created_at timestamptz NOT NULL`; `updated_at timestamptz NOT NULL`. Indexes `(owner_id,state)`, `(location_key,state)`. RLS: owner/mandate rows; browser direct table grants none; service worker uses scoped functions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `MenuVersion`                                                           | `id uuid PK`; `menu_id uuid NOT NULL FK Menu.id ON DELETE RESTRICT`; `owner_id uuid NOT NULL FK party.id`; `version_no bigint NOT NULL CHECK (version_no>0)`; `locale varchar(16) NOT NULL`; `audience_class varchar(48) NOT NULL`; `tree_hash text NOT NULL CHECK (tree_hash ~ '^[a-f0-9]{64}$')`; `state text NOT NULL CHECK (state IN ('draft','review','approved','active','superseded','revoked'))`; `approved_by_person_id uuid NULL FK person.id`; `approved_at timestamptz NULL`; `publication_version bigint NULL`; `created_at timestamptz NOT NULL`; `updated_at timestamptz NOT NULL`. Unique `(menu_id,version_no,locale,audience_class)`; indexes `(menu_id,locale,audience_class,state)`, `(tree_hash)`. RLS: assigned editors read drafts, publishers activate, public receives active projection only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `MenuItemVersion`                                                       | `id uuid PK`; `menu_version_id uuid NOT NULL FK MenuVersion.id ON DELETE CASCADE`; `item_id uuid NOT NULL`; `parent_item_id uuid NULL FK MenuItemVersion.id`; `position smallint NOT NULL CHECK (position BETWEEN 0 AND 199)`; `label varchar(120) NOT NULL`; `description varchar(500) NULL`; `icon_key varchar(64) NULL`; `target_kind text NOT NULL CHECK (target_kind IN ('publication','internal_route','external_https'))`; `target_ref text NOT NULL CHECK (char_length(target_ref) BETWEEN 1 AND 512)`; `visibility jsonb NOT NULL CHECK (jsonb_typeof(visibility)='array')`; `accessibility_metadata jsonb NOT NULL CHECK (jsonb_typeof(accessibility_metadata)='object')`; `created_at timestamptz NOT NULL`. Unique `(menu_version_id,item_id)`, `(menu_version_id,parent_item_id,position)`; indexes `(menu_version_id,parent_item_id,position)`, `(target_kind,target_ref)`. RLS: inherited menu owner/editor; parent must be same version; no direct client grants.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `RouteRecord`                                                           | `id uuid PK`; `manifest_version_id uuid NULL FK delivery.route_manifest_version.id` (NULL only while `state` is `draft`, `review`, or `approved`; set at activation); `route_id uuid NOT NULL`; `normalized_path text NOT NULL`; `locale varchar(16) NOT NULL`; `target_kind text NOT NULL CHECK (target_kind IN ('publication','internal_route','external_https'))`; `target_id uuid NOT NULL`; `target_version bigint NOT NULL CHECK (target_version>0)`; `canonical boolean NOT NULL`; `state text NOT NULL CHECK (state IN ('draft','review','approved','active','superseded','revoked'))`; `approved_by_person_id uuid NULL FK person.id`; `approved_at timestamptz NULL`; `version bigint NOT NULL CHECK (version>0)`; `created_at timestamptz NOT NULL`; `updated_at timestamptz NOT NULL`. Checks `(manifest_version_id IS NOT NULL OR state IN ('draft','review','approved'))`, `((approved_by_person_id IS NULL) = (approved_at IS NULL))`, and `(state NOT IN ('approved','active','superseded') OR approved_at IS NOT NULL)`. Unique `(manifest_version_id,normalized_path,locale)` and partial unique `(normalized_path,locale) WHERE state IN ('draft','review','approved')` (the draft path reservation); indexes `(target_id,target_version)`, `(locale,normalized_path)`. RLS: editor/publisher for assigned publication; public active route projection only; direct grants none.                                                                                                                                |
| `RedirectRecord`                                                        | `id uuid PK`; `manifest_version_id uuid NULL FK delivery.route_manifest_version.id` (NULL only while `state` is `draft`, `review`, or `approved`; set at activation); `source_path text NOT NULL`; `destination_path text NULL`; `destination_route_id uuid NULL FK RouteRecord.id`; `status smallint NOT NULL CHECK (status IN (301,308))`; `reason text NOT NULL CHECK (reason IN ('slug_change','canonical_merge','migration'))`; `active_from timestamptz NOT NULL`; `active_to timestamptz NULL`; `hop_count smallint NOT NULL CHECK (hop_count BETWEEN 1 AND 5)`; `state text NOT NULL CHECK (state IN ('draft','review','approved','active','superseded','revoked'))`; `approved_by_person_id uuid NULL FK person.id`; `approved_at timestamptz NULL`; `version bigint NOT NULL CHECK (version>0)`; `created_at timestamptz NOT NULL`. Checks `(manifest_version_id IS NOT NULL OR state IN ('draft','review','approved'))`, `((approved_by_person_id IS NULL) = (approved_at IS NULL))`, and `(state NOT IN ('approved','active','superseded') OR approved_at IS NOT NULL)`; a redirect candidate carries the state of the route candidate written in the same DLV-NAV-API-03 command and is reviewed and approved with it. Unique `(manifest_version_id,source_path)` and partial unique `(source_path) WHERE state IN ('draft','review','approved')`; indexes `(source_path,state)`, `(destination_route_id)`. RLS: publication editor/publisher; graph validation forbids cycles/self-loops; direct client grants none. |
| `DiscoveryMetadataVersion`                                              | `id uuid PK`; `publication_id uuid NOT NULL FK publication.id`; `locale varchar(16) NOT NULL`; `title varchar(160) NOT NULL`; `description varchar(320) NOT NULL`; `canonical_url text NOT NULL`; `noindex boolean NOT NULL`; `social_asset_id uuid NULL FK AssetRecord.id`; `breadcrumb jsonb NOT NULL CHECK (jsonb_typeof(breadcrumb)='array')`; `structured_data jsonb NOT NULL CHECK (jsonb_typeof(structured_data)='object')`; `policy_overrides jsonb NOT NULL CHECK (jsonb_typeof(policy_overrides)='array')`; `metadata_hash text NOT NULL CHECK (metadata_hash ~ '^[a-f0-9]{64}$')`; `state text NOT NULL CHECK (state IN ('draft','review','approved','active','superseded','revoked'))`; `approved_by_person_id uuid NULL FK person.id`; `approved_at timestamptz NULL`; `version bigint NOT NULL CHECK (version>0)`; `created_at timestamptz NOT NULL`; `updated_at timestamptz NOT NULL`. Checks `((approved_by_person_id IS NULL) = (approved_at IS NULL))` and `(state NOT IN ('approved','active','superseded') OR approved_at IS NOT NULL)`. Unique `(publication_id,locale,version)`; indexes `(publication_id,locale,state)`, `(canonical_url)`. RLS: publication owner/editor and policy worker; public safe projection only; direct client grants none.                                                                                                                                                                                                                                                       |
| `DeliveryCandidateReview` (`cms_delivery_reviews`)                      | Same column set, CHECK constraints, envelope, ENABLE/FORCE RLS, revoked direct grants, and named-RPC-only write rule as BE03a `cms_schema_reviews` (DEC-108), with these substitutions. The content-type columns `content_type_id`, `content_type_version_id`, `candidate_version_no`, `definition_hash`, `schema_artifact_id`, `compiler_version`, `dependency_manifest_hash`, `dry_run_id`, and `dry_run_report_hash` are replaced by `subject_kind text NOT NULL CHECK (subject_kind IN ('menu_version','route_record','discovery_metadata_version'))`, `subject_id uuid NOT NULL`, `subject_version bigint NOT NULL CHECK (subject_version>0)`, `frozen_hash char(64) NOT NULL CHECK (frozen_hash ~ '^[a-f0-9]{64}$')`, and `policy_projection_version bigint NULL CHECK (policy_projection_version IS NULL OR policy_projection_version>=0)` (set only for `discovery_metadata_version` subjects). `risk_class` is `CHECK (risk_class = 'ordinary')`; `required_capabilities` is the one-member array `['cms.delivery_review']`; `state IN ('open','approved','rejected','invalidated')`. One live review per exact subject version is `UNIQUE (subject_kind, subject_id, subject_version) WHERE state = 'open'`. `subject_id` is polymorphic over the three subject tables and is verified under `subject_kind` by the submit RPC.                                                                                                                                                                                           |
| `DeliveryCandidateReviewDecision` (`cms_delivery_review_decisions`)     | Same as BE03a `cms_schema_review_decisions`, with `review_id` referencing `cms_delivery_reviews(id)`, `assignment_id` referencing `cms_delivery_review_assignments(id)`, `capability_key` `CHECK (capability_key = 'cms.delivery_review')`, and `reviewed_hash` holding the `frozen_hash` recomputed at decision time. Append-only; `UNIQUE (review_id, reviewer_person_ref)` prevents repeated humans; a BEFORE INSERT trigger and the decision RPC together forbid `reviewer_person_ref` equal to the review's `submitter_person_ref` (a cross-row rule, so a trigger and never a CHECK); UPDATE/DELETE and direct grants are revoked.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `DeliveryCandidateReviewAssignment` (`cms_delivery_review_assignments`) | Same as BE03a `cms_schema_review_assignments`, with `review_id` referencing `cms_delivery_reviews(id)`, `capability_key` `CHECK (capability_key = 'cms.delivery_review')`, `actions = ARRAY['read','decide']::text[]`, and `CHECK (ends_at <= starts_at + interval '7 days')`. Only the assignment RPC creates or revokes; effective authority requires `starts_at <= now < ends_at` and is rechecked at decision and at activation, so no expiry sweep is required; an assignment never stores an owner acting context and cannot be delegated or broadened.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### State machines and transaction rules

`Menu`, `MenuVersion`, `RouteRecord`, `RedirectRecord`, and `DiscoveryMetadataVersion` use `draft → review → approved → active → superseded or revoked`; active versions are immutable. DLV-NAV-API-01 writes only a draft. DLV-NAV-API-05 moves exactly one subject `draft → review`; DLV-NAV-API-06 moves it `review → approved` once the policy-required approvals are recorded (filling `approved_by_person_id` and `approved_at`) or `review → draft` on a reject decision or an invalidation. DLV-NAV-API-02 is the only operation that moves `approved → active`: it locks the approved candidates and the expected manifest, validates targets/tree hash/audiences and each approved review's frozen evidence, writes route/redirect projections, and switches the whole manifest atomically. DLV-NAV-API-03 reserves the normalized path and its redirect source as draft candidates in one serializable transaction; a failed graph leaves the prior active manifest and writes nothing. DLV-NAV-API-04 stores the authored draft version and evaluates the discovery policy projection, which is re-evaluated at activation and at every 04c convergence; blocked policy state is explicit and safe.

The idempotency record is keyed by actor, effective party, route operation, and canonical body hash for 24 hours. `expected_version` and `If-Match` use compare-and-swap; a stale builder cannot replace a newer pointer. Outbox rows and audit records commit with domain rows. Provider timeout creates a pending compile/effect record; it never activates a partial tree or policy-unsafe metadata.

### Candidate review and activation (DEC-115)

Menu, route/redirect, and discovery-metadata candidates use the generalized CMS review machinery of DEC-108 and DEC-113. BE03a defines the review, decision, and assignment records, the submitter-distinctness trigger, the owner derivation, and the step-up rules; this section states only what is specific to delivery subjects.

| Subject kind                 | Reviewed aggregate                                                                       | Frozen evidence hashed into `frozen_hash`                                                                                                                    | Effect of an approving decision                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `menu_version`               | One `MenuVersion`                                                                        | `tree_hash`, `locale`, `audience_class`, and the Shard 03 resolver response (`active`, `approved`, `visible`, `version`, `routeClass`) for every item target | `MenuVersion.state` becomes `approved`; `approved_by_person_id` and `approved_at` are filled                         |
| `route_record`               | One `RouteRecord` with every `RedirectRecord` written by the same DLV-NAV-API-03 command | Hash of `normalized_path`, `locale`, `target_id`, `target_version`, and each redirect's `source_path` hash, `status`, `reason`, and `hop_count`              | The route and each bundled redirect become `approved` together; both carry `approved_by_person_id` and `approved_at` |
| `discovery_metadata_version` | One `DiscoveryMetadataVersion`                                                           | `metadata_hash` and the discovery policy projection result (`noindex`, `excludeSitemap`, `redactFields`, `blockerCode`, `version`)                           | `DiscoveryMetadataVersion.state` becomes `approved`; `approved_by_person_id` and `approved_at` are filled            |

- `frozen_hash` is the lowercase SHA-256 hex of the RFC 8785 JCS canonical JSON of the frozen evidence object, following the BE03a content-hash rule. `approval_evidence_hash` is computed as in BE03a.
- A `RedirectRecord` has no `subject_kind`: it is never submitted or approved alone, only with its route candidate.
- **Count and policy.** The required decision count comes from the code-owned editorial policy registry of DEC-109 and DEC-110 through the same evidence seam: the ordinary-risk member `cms.delivery.navigation` version 1 (`requiredDecisionCount` 1, `requiredCapabilities` `['cms.delivery_review']`), seeded as an immutable row by the same forward-only migration. A missing, ambiguous, or malformed row resolves to NULL and DLV-NAV-API-05 answers `422 REVIEW_POLICY_UNRESOLVED`. Callers never supply policy, count, or capability. One approving decision therefore approves the candidate.
- **Authority.** The submitter is the editor who wrote the candidate. The reviewer is server-resolved, is a different human, decides at most once per review, holds an active unexpired assignment and the current `cms.delivery_review` capability, and presents recent binding-bound MFA (DEC-111 step-up). Only the receipt-derived owner holding `cms.delivery_review.assign` can assign, as BE03a CMS-03A-14 defines; the assignment grants only read and decide on one frozen review, for at most seven days and no later than the grantor's authority.
- **Decision transaction.** DLV-NAV-API-06 locks the review and the subject, rechecks assignment, capability, and MFA, recomputes the frozen evidence (re-running the Shard 03 resolver and, for discovery metadata, the policy projection), and appends the decision. A recomputed hash that differs from `frozen_hash` invalidates the review, returns the subject to `draft`, and answers `409 REVIEW_CONFLICT` with `details.reason` `evidence_drift`. An approving decision that reaches the required count moves the review to `approved` and the subject `review → approved` and fills `approved_by_person_id` and `approved_at`; a reject decision moves the review to `rejected` and the subject back to `draft`.
- **Activation.** DLV-NAV-API-02 re-reads each named candidate and its approved review, recomputes the frozen evidence, and rechecks only the approving reviewers' current assignment and capability (not the freshness of their earlier MFA); the publisher's own binding and capability are checked by the existing operation chain. A candidate that is not `approved`, whose evidence drifted, or whose reviewer authority lapsed fails the whole activation with `422 PUBLISH_BLOCKED`.
- **Immutability.** A subject in `review` or `approved` changes only through the named state transitions. Any content change is a new draft version written by DLV-NAV-API-01, -03, or -04 and needs its own review.
- **Audit.** DLV-NAV-API-05, -06, and -08 commit an audit record atomically with their domain rows and define no outbox event type; DLV-NAV-API-07 writes nothing.

### Grants and RLS

Anonymous clients read only active public route/menu/discovery projections after independent target authorization. Editors see assigned drafts; publishers see assigned approved candidates; delivery workers see the exact manifest lease. Policy and private publication values are service-only. `service_role` is restricted to migrations/workers, browser direct table grants are denied, and all writes pass party/capability checks. Redirects never disclose a private target; a safe 404 is returned when an existence-sensitive lookup is denied. Review, decision, and assignment rows are readable only through the DLV-NAV-API-07 projection, direct browser and service-role table grants on them are revoked, and forced RLS applies (the BE03a rule).

## Middleware & Policies

### Authorization matrix

| Operation      | Allowed authority                                                                                                                    | 403 condition                                                                                                             | 404 condition                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| DLV-NAV-API-01 | Navigation editor for assigned menu/location and target scope                                                                        | Known menu is visible but actor lacks editor capability or target mandate                                                 | Menu/target is outside actor projection or intentionally undiscoverable   |
| DLV-NAV-API-02 | CMS publisher for assigned location and approved candidate                                                                           | Candidate is visible but actor lacks publisher capability                                                                 | Candidate is outside publisher scope or does not exist in safe projection |
| DLV-NAV-API-03 | Navigation editor for target publication/locale                                                                                      | Publication is visible but actor lacks route-edit capability                                                              | Publication is private/suppressed or outside actor projection             |
| DLV-NAV-API-04 | Navigation editor for target publication/locale                                                                                      | Publication is visible but actor lacks discovery-edit capability                                                          | Suppressed/private publication is not discoverable                        |
| DLV-NAV-API-05 | Navigation editor holding the subject's own editor scope                                                                             | Subject is visible but actor lacks the subject's editor capability                                                        | Subject is outside the actor projection or intentionally undiscoverable   |
| DLV-NAV-API-06 | Independently authenticated human with an active `cms.delivery_review` assignment on that frozen review and recent binding-bound MFA | Review is readable but the assignment or capability is missing or expired; missing or stale MFA is `401 STEP_UP_REQUIRED` | Review is concealed, absent, or outside the caller's scope                |
| DLV-NAV-API-07 | Submitter editor scope or assigned review-only scope                                                                                 | Review is readable but required capability is missing                                                                     | Review is concealed, absent, or out of scope                              |
| DLV-NAV-API-08 | Receipt-derived owner with current effective owner authority and `cms.delivery_review.assign`, plus recent binding-bound MFA         | Caller is not the derived owner or lacks the assign capability                                                            | Review is concealed or cross-owner                                        |

### Capability provisioning (DEC-119)

The navigation editor capability named in this section is the registered key `cms.navigation_editor`, and the CMS publisher capability is `cms.publisher` (named by BE03b). Both are members of the closed grantable registry of BE03a CMS-03A-15, so the receipt-derived owner provisions them through that operation, including to itself, with no direct grant-row write. The grant supplies only the capability: each operation here still applies the assigned menu/location or target publication/locale scope and the review rules above, so a grant never widens a scope and never lets a submitter approve their own candidate. `cms.delivery_review` and `cms.delivery_review.assign` are not grantable and are assigned per review as BE03a CMS-03A-14 does for schema reviews.

### Per-operation middleware and CORS

The ordered chain is `requestId → strictCors(registered web origins; credentials only for same-site, no wildcard) → securityHeaders → bodyLimit → contentType → rateLimit → auth → actingContext → zod → capability/ownership → policy/target gate → idempotency → If-Match/CAS → handler → audit/outbox`. Every operation has a named CORS policy:

| Operation      | Middleware and CORS policy                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DLV-NAV-API-01 | `requestId → strictCors(registered web origins; credentials only for same-site) → securityHeaders → bodyLimit(256KiB) → contentType(json) → rateLimit(menu-draft) → auth → actingContext → zod(CreateMenuVersionRequest) → editor+menu ownership → target/visibility/tree gate → idempotency → If-Match → handler → audit/outbox`.                                              |
| DLV-NAV-API-02 | `requestId → strictCors(registered web origins; credentials only for same-site) → securityHeaders → bodyLimit(32KiB) → contentType(json) → rateLimit(menu-publish) → auth → actingContext → zod(PublishMenuVersionRequest) → publisher capability → approval/hash/target preflight → idempotency → If-Match/CAS → compiler seam → handler → audit/outbox`.                      |
| DLV-NAV-API-03 | `requestId → strictCors(registered web origins; credentials only for same-site) → securityHeaders → bodyLimit(32KiB) → contentType(json) → rateLimit(route-slug) → auth → actingContext → zod(SlugRequest) → editor+publication ownership → normalization/reserved/graph gate → idempotency → If-Match/CAS → handler → audit/outbox`.                                           |
| DLV-NAV-API-04 | `requestId → strictCors(registered web origins; credentials only for same-site) → securityHeaders → bodyLimit(128KiB) → contentType(json) → rateLimit(discovery) → auth → actingContext → zod(DiscoveryMetadataRequest) → editor+publication ownership → policy/privacy/legal gate → idempotency → If-Match/CAS → handler → audit/outbox`.                                      |
| DLV-NAV-API-05 | `requestId → strictCors(registered web origins; credentials only for same-site) → securityHeaders → bodyLimit(32KiB) → contentType(json) → rateLimit(delivery-review-submit) → auth → actingContext → zod(SubmitDeliveryReviewRequest) → editor+subject ownership → candidate revalidation/policy gate → idempotency → If-Match → handler → audit`.                             |
| DLV-NAV-API-06 | `requestId → strictCors(registered web origins; credentials only for same-site) → securityHeaders → bodyLimit(32KiB) → contentType(json) → rateLimit(delivery-review-decide) → auth → actingContext → stepUp(binding-bound MFA) → zod(DecideDeliveryReviewRequest) → assignment+capability → frozen-evidence/authority recheck → idempotency → If-Match/CAS → handler → audit`. |
| DLV-NAV-API-07 | `requestId → strictCors(registered web origins; credentials only for same-site) → securityHeaders → no request body → rateLimit(delivery-review-read) → auth → actingContext → zod(path UUID) → submitter-or-assigned scope → read-only projection → no-store response headers`.                                                                                                |
| DLV-NAV-API-08 | `requestId → strictCors(registered web origins; credentials only for same-site) → securityHeaders → bodyLimit(32KiB) → contentType(json) → rateLimit(delivery-review-assign) → auth → actingContext → stepUp(binding-bound MFA) → zod(AssignDeliveryReviewRequest) → derived-owner+assign capability → idempotency → If-Match/CAS → handler → audit`.                           |

### Rate, abuse, privacy, and security policy

Rate keys are effective party plus actor person plus route; unauthenticated failures use IP/account buckets. Labels, metadata, paths, and external URLs are length-limited and normalized; server-side URL fetching is never performed. External targets require HTTPS and an allowlist; `javascript:`, `data:`, credentials/userinfo, open redirects, preview/admin/private targets, and arbitrary visibility expressions reject. Policy overrides are applied last and a refusal reveals neither suppressed content nor target existence. Audit logs store hashes and IDs, not private labels, descriptions, route paths, or structured data. CSRF protection applies to credentialed browser commands; CSP/security headers and MIME/content limits are inherited from BE00. Review records never expose reviewer or grantor identity to the submitter, and `approved_by_person_id` and `approved_at` never leave the private tables.

## Data Flow

1. Hono binds request ID, strict CORS, headers, body/content limits, auth, acting context, rate bucket, and the operation’s Zod 4 schema.
2. The handler loads the assigned aggregate under RLS, checks capability/ownership, normalizes/validates the tree/path/metadata, and calls Shard 03/05 gates as applicable.
3. A serializable Supabase transaction writes immutable version rows, reservations/redirects, policy-safe metadata, audit, and an outbox event. Menu publish also records the compiler lease and expected manifest version.
4. The compiler/outbox worker builds only the exact version. Whole-location activation occurs after readiness; otherwise the prior active pointer remains and the failed consumer/error is recorded.
5. Consumers dedupe `(event_type,event_id)` and load the exact version. Public projections exclude drafts/private fields; stale or unsafe results become explicit blocked/unavailable states.
6. Candidate review (DEC-115): DLV-NAV-API-05 freezes one draft candidate and opens one review; the derived owner assigns a reviewer through DLV-NAV-API-08; the assigned reviewer decides through DLV-NAV-API-06 after recomputing the frozen evidence; only then can DLV-NAV-API-02 activate the approved candidate within a whole manifest.

## Events and Consumer Contracts

| Event type                   | Producer and trigger                                                                                                        | Versioned payload and exclusions                                                                                                                                                            | Consumers / delivery                                                                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `delivery.menu.activated.v1` | DLV-NAV-API-02 after complete location activation                                                                           | `{ eventId, occurredAt, menuId, menuVersionId, locationKey, locale, audienceClass, treeHash, version, schemaVersion }`; excludes private labels, target refs, drafts, and policy evidence   | Route/render/cache consumers load the exact complete tree; BE00 outbox retries five times with 1/5/30/300/900 s backoff then dead-letters. |
| `delivery.route.changed.v1`  | DLV-NAV-API-02 after the whole-manifest activation commits; DLV-NAV-API-03 writes only a draft candidate and emits no event | `{ eventId, occurredAt, routeId, routeManifestVersionId, normalizedPathHash, locale, canonical, version, schemaVersion }`; protected paths and private publication identifiers are redacted | Edge/router/sitemap/redirect consumers refetch the manifest; event/version dedupe prevents stale replacement.                              |

Events use BE00 identifier-only envelopes, aggregate version, and payload hash. Discovery metadata is versioned in its owning table and included in the next ready projection; this split does not invent a separate event type. Review, decision, and assignment commits write audit records only. Consumers never treat a draft or predicate as authorization and never fetch an external URL from an event.

## Error Handling and Failure Recovery

| Failure                                                                                                          | Deterministic response and recovery                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tree cycle/orphan/depth/sibling/item overflow                                                                    | `422 TREE_INVALID`; candidate is discarded and active tree remains.                                                                                                                                                |
| Unsafe or unresolved target                                                                                      | `422 TARGET_NOT_ELIGIBLE`; no target lookup result or private existence is exposed.                                                                                                                                |
| Stale editor/publisher version or hash                                                                           | `409 VERSION_CONFLICT`/`TREE_HASH_MISMATCH`; reload exact version; no activation.                                                                                                                                  |
| Reserved/colliding slug or redirect graph issue                                                                  | `409 ROUTE_CONFLICT`/`422 REDIRECT_GRAPH_INVALID`; reservation and redirect transaction rolls back.                                                                                                                |
| Policy service unavailable or blocking                                                                           | `503 DEPENDENCY_UNAVAILABLE` or `422 DISCOVERY_POLICY_BLOCKED`; noindex/sitemap exclusion and blocker preserve safety; editor metadata is not published.                                                           |
| Compiler timeout/failure                                                                                         | Prior active complete pointer remains; pending lease retries with bounded backoff; stale builder is fenced by manifest version.                                                                                    |
| Idempotency replay/mismatch                                                                                      | Same canonical hash returns stored result; different hash returns `409 IDEMPOTENCY_MISMATCH`; no duplicate version/pointer/event.                                                                                  |
| Outbox delivery failure                                                                                          | Domain rows remain committed; outbox retries, dead-letters, and pages; consumers replay by event ID and refetch exact version.                                                                                     |
| Candidate not approved, evidence drifted, or reviewer authority lapsed at activation                             | `422 PUBLISH_BLOCKED` with `details.reason` `candidate_not_approved`, `review_drift`, or `authority_drift`; nothing activates and the prior manifest stays.                                                        |
| Submit with no resolvable review policy                                                                          | `422 REVIEW_POLICY_UNRESOLVED`; no review row is written and the subject stays `draft`.                                                                                                                            |
| Duplicate live review, non-draft subject, self-review, repeated reviewer, closed review, or stale review version | `409 REVIEW_CONFLICT` with `details.reason` `live_review_exists`, `subject_not_draft`, `submitter_self`, `repeated_human`, or `review_closed`, or `409 VERSION_CONFLICT`; no second review or decision is written. |
| Frozen evidence differs at decision                                                                              | The review becomes `invalidated`, the subject returns to `draft`, and `409 REVIEW_CONFLICT` with `details.reason` `evidence_drift` is returned; the editor resubmits a fresh candidate.                            |
| Missing or stale MFA on decision or assignment                                                                   | `401 STEP_UP_REQUIRED` with `{ recoveryAction: 'step_up', allowedMethods: string[] }`; no row is written.                                                                                                          |
| Discovery policy projection unavailable                                                                          | `503 DEPENDENCY_UNAVAILABLE` on DLV-NAV-API-04, -05, and -02 with nothing stored or activated; 04c publishes the synthesized `policy_unavailable` noindex state (§ Discovery policy projection).                   |

## Verification and Test Strategy

### Operation Test Matrix

| Operation ID   | Contract and handler tests                                                                                                                                                                 | Authorization/RLS and failure tests                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| DLV-NAV-API-01 | Zod tree bounds, target/visibility closure, cycle/depth checks, draft immutability, hash/idempotent replay                                                                                 | Editor/menu/target scope, 403/404, unsafe URL, private target, RLS projection, provider timeout                                 |
| DLV-NAV-API-02 | Approval/hash/audience preflight, whole-location activation, compiler lease, stale pointer fencing, event dedupe                                                                           | Publisher scope, 403/404, removed target, partial tree failure, prior-pointer preservation                                      |
| DLV-NAV-API-03 | Unicode NFC/lowercase normalization, reserved/collision/loop/hop graph, atomic reservation/redirect, CAS                                                                                   | Publication/locale scope, 403/404, protected path redaction, concurrent slug race                                               |
| DLV-NAV-API-04 | Bounded metadata/structured data, policy-last override, noindex/blocker, canonical validation, version replay, draft-only result                                                           | Locale editor scope, 403/404, suppressed publication safety, policy outage, private field redaction                             |
| DLV-NAV-API-05 | Subject-kind coverage, draft-only submit, revalidation per kind, frozen-hash determinism, policy resolution and `REVIEW_POLICY_UNRESOLVED`, one live review per version, idempotent replay | Editor scope, 403/404, redirect-only submit rejected, concurrent submit race, dependency outage leaves no review row            |
| DLV-NAV-API-06 | Approve reaching count 1, reject back to draft, `approved_by_person_id`/`approved_at` filled on subject and bundled redirects, evidence-drift invalidation, append-only decision, replay   | Submitter and repeated-human refusal, assignment expiry mid-review, missing/stale MFA is 401, 403/404, concurrent decision race |
| DLV-NAV-API-07 | Capability-safe projection, counts, decision references, permitted actions, `no-store`, no write on success or failure                                                                     | Submitter scope, assigned review-only scope, concealed 404, no reviewer or grantor identity                                     |
| DLV-NAV-API-08 | Create and revoke, finite expiry within seven days and within grantor authority, read/decide only, no identity creation                                                                    | Non-owner 403, cross-owner 404, self/submitter target refusal, missing MFA is 401, replay                                       |

Cross-operation test-level matrix:

| Level                       | Required tests                                                                                                                                                                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract                    | Zod 4 accepts each valid request and rejects unknown keys, invalid UUIDs, unsafe paths, oversized trees, arbitrary predicates, malformed URLs, and missing required metadata. Snapshot `ApiError { code, message, requestId, details }`.                                                                      |
| Persistence/concurrency     | Unique menu/version/path/redirect constraints, serializable whole-tree activation, manifest CAS, redirect graph invariants, idempotency hash, RLS direct-table denial, and outbox atomicity.                                                                                                                  |
| Security/privacy            | Capability/mandate matrix, 403 versus 404, reserved routes, open-redirect prevention, target-independent authorization, policy override, CSP/CSRF/CORS, and protected-field redaction.                                                                                                                        |
| Accessibility               | Keyboard-equivalent reorder/expand, labels/current-page state, focus/skip links, mobile disclosure, normalized route preview, and truthful blocked/unavailable states.                                                                                                                                        |
| Integration/observability   | Shard 03 resolver, Shard 05 policy, BE00 compiler/outbox seams honor exact timeout/retry/breaker profiles; every operation emits requestId/operationId/resource/version/result metrics without private values.                                                                                                |
| Review and activation       | Activation of an unapproved, drifted, or authority-lapsed candidate fails whole; approved route/redirect/discovery candidates activate in one manifest switch; approved fields are filled exactly once; no active row is ever mutated.                                                                        |
| Discovery policy projection | Each source (settings, shadow status, holds, resolver) forces its blocker; precedence order; authored `noindex: true` is never relaxed; every failed source read yields the exact synthesized `policy_unavailable` state; 503 on write, submit, and activation; synthesized noindex state in 04c convergence. |

## Deepening Passes and Ambiguity Gate

- **Pass 1 — micro contract:** closed locations/targets/predicates/states, UUID/time/version/checksum types, tree/path/metadata limits, and route graph bounds are schema- and database-enforced.
- **Pass 2 — macro contract:** DLV-01–DLV-04 map one-to-one to stable routes; menu, route, redirect, and discovery ownership is separated from media and public delivery.
- **Pass 3 — race/recovery:** serializable activation, manifest leases, CAS, idempotency, compiler fencing, outbox replay, and prior-pointer preservation are explicit.
- **Pass 4 — security/privacy/accessibility:** RLS, CORS, auth, 403/404, safe target handling, policy-last disclosure, keyboard parity, and redacted telemetry are specified per operation.

## Ambiguity Gate

**PASS.** DLV-01–DLV-04 are reconciled one-to-one with stable routes and operation IDs, and DLV-15–DLV-17 are reconciled to DLV-NAV-API-05–08. Menu limits, target and predicate vocabularies, whole-tree publish, normalized slug/redirect graph, policy-last discovery metadata, ownership/403-vs-404 behavior, typed persistence, CORS/auth/rate/error contracts, external seams, events, tests, and recovery are deterministic. No implementation decision remains open.

## Open Questions

None.

## Changelog

| Date       | Change                                                                                                                                                                                                                                                                                                                                  | Workflow               | Sections affected                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------- |
| 2026-08-28 | Authored the navigation/routes/discovery backend split for DLV-01–DLV-04.                                                                                                                                                                                                                                                               | `/write-be-spec`       | All                                                            |
| 2026-08-28 | Added per-operation Zod 4, CORS, target/policy gates, typed persistence, event, and recovery contracts.                                                                                                                                                                                                                                 | `/write-be-spec-write` | API, Database, Middleware, Events, Tests                       |
| 2026-10-02 | DEC-115: added DLV-NAV-API-05–08 (submit, decide, read, assign) over the generalized CMS review machinery by reference to BE03a; DLV-NAV-API-03 and -04 now write draft candidates; DLV-NAV-API-02 activates approved candidates in one manifest; added approval fields and draft reservation to route, redirect, and discovery records | `/propagate-decision`  | API, Contracts, Database, Middleware, Data Flow, Errors, Tests |
| 2026-10-02 | D24: defined the Shard 05 discovery policy projection over typed settings, shadow status, holds, and the Shard 03 resolver, with the fail-closed `policy_unavailable` state                                                                                                                                                             | `/propagate-decision`  | API seams, Discovery policy projection, Errors, Tests          |
| 2026-10-02 | G6: corrected the media operation range to DLV-04B-01–DLV-04B-04                                                                                                                                                                                                                                                                        | `/propagate-decision`  | IA Feature Coverage                                            |
| 2026-10-02 | A3 follow-up: `cms.navigation_editor` and `cms.publisher` declared grantable through BE03a CMS-03A-15 (scopes still checked by each operation; review capabilities stay assignment-only)                                                                                                                                                | /propagate-decision    | Middleware & Policies                                          |

## Dependency References

- [BE00 — Cross-cutting Platform Foundation](00-infrastructure.md): global `ApiError`, request IDs, idempotency, ETag/CAS, Hono middleware, RLS, outbox, and worker recovery.
- [IA Shard 04 — CMS navigation, media and delivery](../ia/04-cms-delivery-media.md) and [Deep Dive 04](../ia/deep-dives/04-cms-delivery-media.md): canonical interactions, contracts, models, state machines, events, accessibility, and algorithms.
- Shard 03: publication/schema/template/route target authority and version resolver.
- Shard 05: governed policy definitions; policy state overrides authored discovery values.
- 04b/04c sibling BE splits: media/rendition and public delivery/cache projections consume immutable menu/route/discovery versions; this file does not duplicate their endpoints.
- [BE03a — Content schema registry](03a-content-schema-registry.md): DEC-108 review, decision, and assignment record shapes, owner derivation, and step-up rules reused by DLV-NAV-API-05–08.
- [BE03b — Editorial workflow](03b-editorial-workflow-publication.md): code-owned editorial policy registry (DEC-109, DEC-110) that supplies the review count.
- [BE05a — Settings](05a-settings-flags-runtime.md), [BE02a — Shadow claim](02a-shadow-claim-ownership.md), and [BE05c — Quality and lifecycle](05c-portability-quality-lifecycle.md): typed settings, unclaimed status, and hold sources of the discovery policy projection.
