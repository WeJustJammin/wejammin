# Governed Media and Renditions — Backend Specification

> IA Source: ../ia/04-cms-delivery-media.md
> Deep Dive: ../ia/deep-dives/04-cms-delivery-media.md
> Foundation: 00-infrastructure.md
> Status: Complete — bounded 04b backend contract; no shared tracking files changed

## Split Group

| Spec                               | IA interactions                                        | Feature ledger            | Ownership boundary                                                                                                              |
| ---------------------------------- | ------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 04a-navigation-routes-discovery.md | DLV-01, DLV-02, DLV-03, DLV-04, DLV-15, DLV-16, DLV-17 | 25.04.01 through 25.04.04 | Menus, routes, redirects, and discovery metadata                                                                                |
| 04b-governed-media-renditions.md   | DLV-05, DLV-06, DLV-07, DLV-08                         | 25.06.01 through 25.06.04 | Asset admission, rights and consent claims, accessibility, rendition jobs, references, replacement, archive, hold, and takedown |
| 04c-public-delivery-cache.md       | DLV-09, DLV-10, DLV-11, DLV-12, DLV-13, DLV-14         | 25.09.01 through 25.09.04 | Public and authenticated projections, previews, cache coherence, degraded delivery, and protected delivery command endpoints    |

04b owns the governed media record and its eligibility inputs. It never becomes a second upload-transfer service, publication control plane, rights adjudicator, or public delivery cache. BE00 remains the owner of generic upload intents, object verification admission, JobStatus, idempotency records, audit, outbox, and the ApiError wire contract. Shards 06, 10, and 20 own adjudication and assert their outcome through the protected command seam; this shard records the assertion and executes the local delivery consequence.

## Classification

- Type: domain command and asynchronous worker specification.
- Owned aggregate: AssetRecord plus its AssetRight, AssetAccessibility, TransformProfileVersion, RenditionRecord, AssetReference, TakedownCaseLink, ScanJob, and PlanLimitProfile dependencies, and the single physical DeliveryPurgeRecord table that the Slice 14 migration creates and 04c consumes through the BE00 purge seam (G9).
- Boundary: DLV-05 through DLV-08 only. DLV-01 through DLV-04 are 04a; DLV-09 through DLV-14 are 04c.
- Persistence: private Supabase PostgreSQL metadata is canonical; governed bytes and renditions remain in private Supabase Storage under BE00 object metadata.
- Security posture: readiness, ownership, rights, consent, accessibility, retention, and takedown are independent gates. Upload or possession never proves a right.
- Async posture: BE00 upload completion and verification, rendition work, and urgent purge use identifier-only outbox or queue messages and idempotent CAS consumers. Scanning is a pull model (DEC-116): a self-operated ClamAV scanner leases identifier-only ScanJob rows over an authenticated channel and posts its verdict back.
- Excluded: direct reads of Shards 06, 10, or 20 stores; rights or dispute adjudication; public signed-URL issuance; publication activation; generic upload-intent or upload-completion routes.

## Referenced Material Inventory

| Source file                                                 | Section and exact lines                                                                   | Material used                                                                                                                                | 04b consequence                                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| .memory/wiki/specs/ia/04-cms-delivery-media.md              | Overview and Features, lines 9-28                                                         | PostgreSQL authority, private Storage, immutable/versioned delivery, 25.06 media governance                                                  | Defines the media boundary and safety precedence                                                |
| .memory/wiki/specs/ia/04-cms-delivery-media.md              | Acceptance Criteria, lines 36-39                                                          | AC-DLV-05 through AC-DLV-08                                                                                                                  | Four operation contracts and failure outcomes                                                   |
| .memory/wiki/specs/ia/04-cms-delivery-media.md              | Interactions, lines 49-58                                                                 | DLV-05 Ingest media; DLV-06 Add rights/consent; DLV-07 Generate rendition; DLV-08 Replace/takedown asset                                     | Exact interaction-to-operation map                                                              |
| .memory/wiki/specs/ia/04-cms-delivery-media.md              | Media contracts, lines 88-99                                                              | private storage, admission, deduplication, original identity, rendition, accessibility, rights, and inbound commands                         | Exact validation and ownership rules                                                            |
| .memory/wiki/specs/ia/04-cms-delivery-media.md              | Data Models and typed registry, lines 111-152                                             | AssetRecord, AssetRight, AssetAccessibility, TransformProfileVersion, RenditionRecord, AssetReference, TakedownCaseLink, DeliveryPurgeRecord | Canonical model names and typed persistence design                                              |
| .memory/wiki/specs/ia/04-cms-delivery-media.md              | Access Control, lines 154-178                                                             | media contributor, media curator, rights/safety operator, delivery and owning-domain principals                                              | Role, scope, MFA, 403 versus 404 decisions                                                      |
| .memory/wiki/specs/ia/04-cms-delivery-media.md              | Event Schemas, lines 190-202                                                              | delivery.asset.changed.v1, delivery.rendition.ready.v1, delivery.asset.revoked.v1                                                            | Identifier-only outbox events and consumers                                                     |
| .memory/wiki/specs/ia/04-cms-delivery-media.md              | Edge Cases and Coverage Matrix, lines 204-246                                             | MIME mismatch, scanner outage, dedup isolation, failed rendition, expiry, replacement, command replay and hold races                         | Error, recovery, and adversarial tests                                                          |
| .memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md   | Assets, Rights, and Renditions, lines 34-45                                               | SQL-shaped media fields and lineage                                                                                                          | Table fields, FKs, and uniqueness                                                               |
| .memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md   | State Machines, lines 56-65                                                               | Asset, Right, Rendition, and Purge transitions                                                                                               | CAS states and terminal behavior                                                                |
| .memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md   | Media Ingest and Rendition Algorithm, lines 76-84                                         | private upload, inspection, scan, dedup, eligibility, deterministic transform                                                                | Transaction and worker flow                                                                     |
| .memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md   | Rights and Reference Evaluation, lines 86-93                                              | local eligibility facts, command inversion, replacement and deletion fences                                                                  | No cross-shard read and fail-closed effects                                                     |
| .memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md   | Concurrency and Idempotency, lines 123-128                                                | provider/job deduplication, publication safety, command reconciliation                                                                       | Replay and recovery rules                                                                       |
| .memory/wiki/specs/2026-08-02-architecture-design.md        | Shared contracts, lines 63-74                                                             | object and evidence storage, audit, roles, media handling, privacy, search                                                                   | Architecture invariants                                                                         |
| .memory/wiki/specs/data-placement-strategy.md               | Runtime and placement, lines 10-17 and 31-35                                              | Workers, PostgreSQL, private Storage, queues, public projections                                                                             | Technology placement and PII boundary                                                           |
| .memory/wiki/specs/feature-ledger.md                        | 25.06 rows, lines 767-770                                                                 | 25.06.01 through 25.06.04                                                                                                                    | Feature coverage                                                                                |
| .memory/wiki/specs/be/00-infrastructure.md                  | Routes, contracts, persistence, middleware, lines 67-365                                  | BE00 upload routes, ApiError, idempotency, object metadata, RLS, queues, retry policy                                                        | Explicit inheritance with no endpoint or table duplication                                      |
| .memory/wiki/specs/be/03b-editorial-workflow-publication.md | Publication/event handoff, lines 494-505                                                  | cms.publication.changed.v1 and exact publication versions                                                                                    | Consumer boundary for later 04c projection work                                                 |
| .memory/wiki/specs/be/01b-party-identity-aliases.md         | Canonical party table, lines 305-333                                                      | platform_private.party and server-derived party scope                                                                                        | Foreign-key target and authority source                                                         |
| .memory/wiki/specs/be/05a-settings-flags-runtime.md         | CFG-05A-01 release-principal contract (S07 service-credential pattern)                    | Principal id format, signature header, mTLS or allowlisted key id, 401 and 503 mapping                                                       | Authentication of the internal scanner operations DLV-04B-05 and DLV-04B-06                     |
| .memory/wiki/specs/be/04c-public-delivery-cache.md          | Purge seam and DLV-DEL-API-05 and -06                                                     | One physical DeliveryPurgeRecord table (G9)                                                                                                  | 04b defines and 04c consumes the table; 04c defines no second purge table                       |
| Owner decision DEC-116                                      | Media scanning and renditions are $0 self-operated; Phase 2 hosted per-file cap is 50 MiB | Scanner consumer contract, WASM image renditions, recorded plan-limit profile                                                                | DLV-04B-05, DLV-04B-06, cms_scan_jobs, cms_plan_limit_profiles, typed refusal above the profile |

## IA Source Map

| Exact IA identifier           | IA source location                                               | 04b backend artifact                                           | Coverage                                                                                            |
| ----------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| DLV-05 Ingest media           | 04-cms-delivery-media.md lines 36 and 55                         | DLV-04B-01 POST /api/v1/cms/assets                             | Request, upload admission, BE00 intent handoff, quarantine, and event                               |
| DLV-06 Add rights/consent     | 04-cms-delivery-media.md lines 37 and 56                         | DLV-04B-02 POST /api/v1/cms/assets/{assetId}/rights            | Claimed right, consent evidence, territory and use validation                                       |
| DLV-07 Generate rendition     | 04-cms-delivery-media.md lines 38 and 57                         | DLV-04B-03 POST /api/v1/cms/assets/{assetId}/renditions        | Registered profile, accessibility and eligibility gates, queued job                                 |
| DLV-08 Replace/takedown asset | 04-cms-delivery-media.md lines 39 and 58                         | DLV-04B-04 POST /api/v1/cms/assets/{assetId}/lifecycle-actions | Per-reference replacement, archive, revoke, erase, hold, and urgent purge                           |
| AssetRecord                   | 04-cms-delivery-media.md line 120                                | cms_asset_records                                              | Typed asset identity and private object lineage                                                     |
| AssetRight                    | 04-cms-delivery-media.md line 121                                | cms_asset_rights                                               | Claimed rights and local eligibility inputs                                                         |
| AssetAccessibility            | 04-cms-delivery-media.md line 122                                | cms_asset_accessibility                                        | Use, locale, alt, captions, transcript, focal, author, reviewer                                     |
| TransformProfileVersion       | 04-cms-delivery-media.md line 123                                | cms_transform_profile_versions                                 | Code-owned transform registry                                                                       |
| RenditionRecord               | 04-cms-delivery-media.md line 124                                | cms_rendition_records                                          | Deterministic output lineage and state                                                              |
| AssetReference                | 04-cms-delivery-media.md line 125                                | cms_asset_references                                           | Exact reverse references and per-use decisions                                                      |
| TakedownCaseLink              | 04-cms-delivery-media.md line 126                                | cms_takedown_case_links                                        | Caller shard, case, scope, hold, and effective state                                                |
| DeliveryPurgeRecord           | 04-cms-delivery-media.md line 129                                | cms_delivery_purge_records                                     | Versioned urgent and ordinary provider purge intent; the single physical table for 04b and 04c (G9) |
| delivery.asset.changed.v1     | 04-cms-delivery-media.md line 198                                | DLV-04B-01, DLV-04B-02, DLV-04B-04 outbox event                | Asset and eligibility consumers refetch by assetId                                                  |
| delivery.rendition.ready.v1   | 04-cms-delivery-media.md line 199                                | DLV-04B-03 worker outbox event                                 | Waiting reference and publication jobs refetch by renditionId and assetId                           |
| delivery.asset.revoked.v1     | 04-cms-delivery-media.md line 200                                | DLV-04B-04 revoke or hold consequence                          | 04c purge and reference consumers refetch by assetId and purgeId                                    |
| ScanJob                       | Deep Dive 04 Media Ingest and Rendition Algorithm (scanner step) | cms_scan_jobs, DLV-04B-05, DLV-04B-06                          | Identifier-only scan job, lease, verdict evidence (DEC-116)                                         |
| PlanLimitProfile              | IA Shard 04 Media and Rights (Admission) and DEC-116             | cms_plan_limit_profiles                                        | Recorded per-file plan limit under the 5 GiB contract ceiling                                       |

The other IA event literals remain visible in the ownership ledger below so event ownership is auditable without creating a second producer: delivery.menu.activated.v1 and delivery.route.changed.v1 belong to 04a; delivery.projection.ready.v1 and delivery.purge.completed.v1 belong to 04c.

## Feature Ledger Coverage

| Feature ledger row | Name                                            | 04b operation coverage                                                   | Result                                                                                         |
| ------------------ | ----------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 25.06.01           | Asset Ingest, Deduplication & Metadata          | DLV-04B-01                                                               | Complete: private admission, BE00 transfer, inspection, scan, dedup suggestion, and quarantine |
| 25.06.02           | Renditions, Transforms, Alt Text & Focal Points | DLV-04B-03 plus AssetAccessibility persistence                           | Complete: profile registry, accessibility gate, deterministic rendition and recovery           |
| 25.06.03           | Rights, Provenance, Usage & Consent             | DLV-04B-02 plus local eligibility evaluation                             | Complete: claimed state, use, territory, time, consent, evidence and owner scope               |
| 25.06.04           | Reference Lifecycle, Replacement & Takedown     | DLV-04B-04 plus AssetReference, TakedownCaseLink and DeliveryPurgeRecord | Complete: per-reference switch, archive, hold, revoke, erase and purge                         |

## Endpoint Completeness Reconciliation

| IA flow                             | Operation ID and route                                            | HTTP boundary                                                                                         | Deliberate non-duplication                                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| DLV-05 Ingest media                 | DLV-04B-01 POST /api/v1/cms/assets                                | Creates AssetRecord and delegates one private upload intent to BE00                                   | BE00 owns POST /api/v1/upload-intents and its completion route; 04b does not expose either route again                                 |
| DLV-06 Add rights/consent           | DLV-04B-02 POST /api/v1/cms/assets/{assetId}/rights               | Appends one claimed AssetRight                                                                        | It does not verify, dispute, revoke, or read Shard 06, 10, or 20 adjudication stores                                                   |
| DLV-07 Generate rendition           | DLV-04B-03 POST /api/v1/cms/assets/{assetId}/renditions           | Creates one deterministic RenditionRecord and BE00 job request                                        | It does not create a second JobStatus API or accept arbitrary transform expressions                                                    |
| DLV-08 Replace/takedown asset       | DLV-04B-04 POST /api/v1/cms/assets/{assetId}/lifecycle-actions    | Executes one action over an enumerated reverse-reference set                                          | Public delivery and protected DLV-13 and DLV-14 command routes belong to 04c; this route does not impersonate an owning-domain command |
| Inbound delivery command seam       | ApplyDeliveryHold, ReleaseDeliveryHold, RevokeDeliveryEligibility | Internal authenticated command adapter with caller shard, case_id, subject scope and expected version | No public route or direct foreign-store read; local TakedownCaseLink and AssetRight consequence is idempotent                          |
| DLV-05 Ingest media (scanner facet) | DLV-04B-05 POST /api/v1/internal/media/scan-jobs/lease            | Internal service route; a registered scanner principal leases one identifier-only ScanJob             | Not browser-reachable; creates no asset and exposes no owner, claimant, filename, or right                                             |
| DLV-05 Ingest media (scanner facet) | DLV-04B-06 POST /api/v1/internal/media/scan-jobs/{scanId}/verdict | Internal service route; the lease holder posts one verdict with scan evidence                         | Never maps an unavailable scanner or an exhausted retry budget to clean                                                                |

Each route has exactly one stable operation ID. The route registry below is authoritative; every contract, error, authorization, rate, observability, and test row is keyed to one of these four IDs. The two internal scanner operations DLV-04B-05 and DLV-04B-06 are registered in § Internal scanner operations and keyed to their own IDs.

## Shared Contract Inheritance

04b inherits BE00 as a locked contract, not as a silent default:

- API base is /api/v1. Every failure body is exactly ApiError { code, message, requestId, details }. details is a bounded JSON object with at most 16 keys, four nesting levels, and 8 KiB serialized size; RFC 9457 top-level fields are not admitted.
- Request middleware is request ID, raw-size and media guard, JSON parse, strict Zod validation, verified session and JWT, server-derived acting context, capability evaluation, CSRF for browser mutations, first-party CORS allowlist, rate limiting, handler or RPC, and response/error normalization.
- Idempotency-Key is 8 to 128 printable ASCII bytes and is bound to operation ID, actor, acting party, path, normalized body, target, and expected version. Matching committed requests replay the original outcome; a different binding returns 409.
- Strong If-Match is an exact quoted decimal version for mutable resources. The four mutation routes require it where the route row says so; body expected versions must equal the parsed header version.
- PostgreSQL RPCs recheck authorization, ownership, CAS version, idempotency, audit, and outbox under RLS in one transaction. Direct authenticated or anonymous table writes are absent.
- BE00 owns platform_private.object_records, UploadIntent, JobStatus, idempotency, audit, outbox, queue envelopes, and their indexes. 04b stores only the domain link to the object or job.
- Queue messages contain identifiers, event type, version, correlation, and causation only. Consumers are at-least-once, retry retryable provider failures three times at 15 seconds, 60 seconds, and 300 seconds, then use DLQ and reconciliation.
- External RPC attempts have a 2,000 ms provider timeout and a 15,000 ms route or worker acceptance deadline. A circuit opens after five consecutive retryable failures for 60 seconds. An ambiguous post-effect response is reconciled by idempotency and status before any resend.
- Authenticated and admin responses are no-store. Public delivery of an eligible immutable object is owned by 04c; this shard never chooses a public cache policy.
- Internal scanner operations (DLV-04B-05, DLV-04B-06) authenticate a registered service principal by the S07 service-credential pattern (the BE05a CFG-05A-01 release-principal contract): a principal id matching `^[a-z][a-z0-9_.-]{1,95}$`, a signature header matching `^[A-Za-z0-9._~-]{16,256}$`, mTLS or an allowlisted key id, `401 UNAUTHENTICATED` for an invalid credential, and `503 DEPENDENCY_UNAVAILABLE` when the verifier is unavailable.

## API Endpoints

### Route Registry

| ID         | IA interaction                | Method and path                                     | Request to success                                                                                                                                     | Auth and ownership, including 403 versus 404                                                                                                                                                                                                                                                       | Middleware and CORS                                                                                                                                                     | Idempotency and concurrency                                                                                                                                                             | Rate, timeout, cache, SLO                                                                               | Error envelope                                                       | Event                                                                                                     |
| ---------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| DLV-04B-01 | DLV-05 Ingest media           | POST /api/v1/cms/assets                             | AssetIngestRequest to 201 AssetIngestResource with Location and private upload URL                                                                     | Verified session, server-resolved acting party, and media_contributor for ownerPartyId and purposeCode. An unknown or unreadable owner scope is 404 after shape validation; a known owner without capability is 403.                                                                               | BE00 order; CORS cms-console first-party allowlist with credentials; CSRF; JSON 256 KiB; content type application/json; rate cms-media-ingest                           | Idempotency-Key required; no If-Match for a new asset; quota and one live object reservation lock are rechecked in the RPC; exact replay returns the original asset and intent          | 20/hour/user and 50/hour/party; 15,000 ms route deadline; no-store; Tier 2 p95 under 1,200 ms           | Every failure is BE00 ApiError { code, message, requestId, details } | delivery.asset.changed.v1 after committed admission and after verifier state changes                      |
| DLV-04B-02 | DLV-06 Add rights/consent     | POST /api/v1/cms/assets/{assetId}/rights            | AssetRightCreateRequest to 201 AssetRightResource with Location and ETag                                                                               | Verified session and media_contributor for the asset owner scope or an explicitly delegated rights-entry capability. Unknown or unreadable asset is 404; readable asset without rights-entry scope is 403.                                                                                         | BE00 order; CORS cms-console first-party allowlist with credentials; CSRF; JSON 256 KiB; strict JSON; rate cms-media-rights                                             | Idempotency-Key and exact asset If-Match required; asset and active-right uniqueness are serialized; matching claim replays; different body, actor, scope, or version returns 409       | 60/hour/user and 120/hour/party; 15,000 ms; no-store; Tier 2 p95 under 1,200 ms                         | Every failure is BE00 ApiError { code, message, requestId, details } | delivery.asset.changed.v1 after claimed row and audit/outbox commit                                       |
| DLV-04B-03 | DLV-07 Generate rendition     | POST /api/v1/cms/assets/{assetId}/renditions        | RenditionGenerateRequest to 202 RenditionAcceptedResource with Location and ETag                                                                       | Verified session and media_curator for the owner scope, or media_contributor restricted to an asset it owns and a registered profile allowed for that purpose. Unknown or unreadable asset is 404; known asset without the required capability is 403.                                             | BE00 order; CORS cms-console first-party allowlist with credentials; CSRF; JSON 256 KiB; strict JSON; rate cms-media-rendition                                          | Idempotency-Key and exact asset If-Match required; unique asset, source checksum, profile, and transform hash lock one job; same request replays the same rendition and job             | 60/minute/user and 120/minute/party; 15,000 ms acceptance deadline; no-store; Tier 2 p95 under 1,200 ms | Every failure is BE00 ApiError { code, message, requestId, details } | delivery.rendition.ready.v1 only after clean output and commit                                            |
| DLV-04B-04 | DLV-08 Replace/takedown asset | POST /api/v1/cms/assets/{assetId}/lifecycle-actions | LifecycleActionRequest to 200 LifecycleActionResource for a completed local action or 202 LifecycleActionResource when purge or reference work remains | Replace and archive require media_curator in owner scope. Revoke, erase, and hold require rights_safety_operator, recent MFA, reason, and case scope. Unknown or unreadable asset is 404; known asset with the wrong action capability is 403; a valid action blocked by retention or hold is 409. | BE00 order; CORS cms-console first-party allowlist with credentials; CSRF; step-up MFA for revoke, erase, and hold; JSON 256 KiB; strict JSON; rate cms-media-lifecycle | Idempotency-Key and exact asset If-Match required; asset, reference, hold and purge rows lock in stable ID order; same action replays the first result and never creates a second purge | 10/hour/user and 20/hour/party; 15,000 ms acceptance deadline; no-store; Tier 2 p95 under 1,200 ms      | Every failure is BE00 ApiError { code, message, requestId, details } | delivery.asset.changed.v1 for non-revoke changes; delivery.asset.revoked.v1 for revoke, takedown, or hold |

### Internal scanner operations (DEC-116)

The scanner is a self-operated ClamAV container that runs outside the Cloudflare Worker and pulls work. It is a consumer of the contract below; the Worker never runs ClamAV, and no hosted or paid scanning API is used. A local scanner sandbox implements the same two operations for tests.

| ID         | IA interaction         | Method and path                                        | Request to success                                                   | Auth and ownership, including 403 versus 404                                                                                                                                                                                                     | Middleware and CORS                                                                                                             | Idempotency and concurrency                                                                                                                                                                   | Rate, timeout, cache, SLO                                             | Error envelope                                      | Event                                                  |
| ---------- | ---------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------ |
| DLV-04B-05 | DLV-05 (scanner facet) | POST /api/v1/internal/media/scan-jobs/lease            | ScanJobLeaseRequest to 200 ScanJobLeaseResponse with at most one job | Registered scanner service principal with scope media-scan; scannerId must equal the principal's registered scanner id. A bad credential is 401 and never a resource lookup; a principal without the scope or with a different scannerId is 403. | BE00 order with serviceAuth in place of session and CSRF; CORS non-browser none; JSON 256 KiB; rate cms-media-scan-lease        | No Idempotency-Key; a repeated lease by the holder of a live lease returns the same leaseId; one live lease per job (CAS on state and version)                                                | 60/minute/principal (the rendition rate); 15,000 ms; no-store; Tier 2 | BE00 ApiError { code, message, requestId, details } | none                                                   |
| DLV-04B-06 | DLV-05 (scanner facet) | POST /api/v1/internal/media/scan-jobs/{scanId}/verdict | ScanVerdictRequest to 200 ScanVerdictResource                        | Same principal that holds the live lease. Unknown or non-leased scanId is 404; a principal without scope or that is not the lease holder is 403.                                                                                                 | BE00 order with serviceAuth and a signature over the raw body; CORS non-browser none; JSON 256 KiB; rate cms-media-scan-verdict | Idempotency-Key required; exact job version If-Match is not used because leaseId is the CAS token; an identical replay returns the stored result; a different body for a completed job is 409 | 60/minute/principal; 15,000 ms; no-store; Tier 2                      | BE00 ApiError { code, message, requestId, details } | delivery.asset.changed.v1 when the asset state changes |

Scanner consumer contract:

- **Job source.** The BE00 upload-completion worker inserts one ScanJob (`queued`) after byte count, checksum, MIME, magic-byte, dimension, archive-risk, and metadata checks pass, and leaves the asset `inspecting`. The job and its queue message carry identifiers, checksum, and versions only: no bytes, filename, owner, claimant, right, or URL.
- **Channel.** Authenticated pull over HTTPS (mTLS or an allowlisted key id) by the principal `media.scanner.clamav`, registered through the S07 service-credential pattern. The scanner never receives a browser session and the Worker never pushes bytes to it.
- **Lease.** DLV-04B-05 moves the oldest `queued` job (then `failed_retryable` jobs whose backoff has elapsed) to `leased` for 120,000 ms (the rendition worker lease) and returns one single-use signed read URL bound to the object, checksum, and lease expiry. The URL is never logged, cached, or stored.
- **Verdict evidence.** `clean`, `infected`, or `unavailable`, plus the scanned checksum and byte count, the ClamAV `engineVersion`, `signatureDbVersion` and `signatureDbBuiltAt`, and a `findingsDigest` (SHA-256 of the finding names, never the names or any payload) required when and only when the verdict is `infected`. The 5,000 ms attempt budget applies to each verdict callback.
- **Signature freshness gate.** The server evaluates `signatureDbBuiltAt` at the instant it receives the verdict. A `clean` verdict is accepted only when that instant is no more than 24 hours (86,400,000 ms) after `signatureDbBuiltAt`; an older `signatureDbBuiltAt`, or one later than the receipt instant, makes the verdict `unavailable` (the job is stored `failed_retryable` with `unavailable` as its `verdict`, so the asset stays `quarantined` and the job is retried on the schedule below), while the submitted `engineVersion`, `signatureDbVersion` and `signatureDbBuiltAt` are still recorded as evidence. An `infected` verdict is never downgraded by the gate.
- **Asset effect.** `clean` is accepted only when the verdict checksum equals the AssetRecord `checksum_value`, the signature freshness gate passes, and then the verifier RPC CASes `inspecting → ready` once the remaining gates pass. `infected` CASes the asset to `rejected` (bytes retained under the retention fence, no rendition, no object access). `unavailable` (including a `clean` verdict refused by the signature freshness gate), a checksum mismatch, or an exhausted retry budget CASes the asset to `quarantined`. A verdict is never inferred and `unavailable` never maps to `clean`.
- **Timeouts, retries, DLQ.** An expired lease returns the job to `queued` and increments `attempts`; a `failed_retryable` verdict retries at 15 s, 60 s, and 300 s, so a job has at most four attempts; the fourth failure moves the job to `dead_lettered` and the asset to `quarantined`. A circuit opens after five consecutive retryable failures for 60 s. DLQ entries are replayed through the BE00 replay path, which re-queues the job idempotently.
- **Outage.** A scanner host that never leases leaves jobs `queued` and assets `inspecting` or `quarantined`; both states expose no rendition, signed delivery, or public object, and neither can satisfy a publication reference. Drafts may reference the asset but publication stays blocked. Queue age and DLQ depth alert.
- **Replay and tamper.** A verdict for a job that is not `leased`, for another lease, or after lease expiry is refused; an identical replay returns the first result; a different body for a completed job is `409 IDEMPOTENCY_MISMATCH`.

| Operation  | Exact validation                                                                                                                                                                                                                                                                                                                                                                                                 | Rejection result                                                                                                                                                               | State effect                                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DLV-04B-05 | body scannerId registered code; no other key; principal and scope valid                                                                                                                                                                                                                                                                                                                                          | 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 415 UNSUPPORTED_MEDIA_TYPE, 429 RATE_LIMITED, 503 DEPENDENCY_UNAVAILABLE                                              | At most one job moves `queued` or `failed_retryable` to `leased`; an empty queue returns jobs of length zero and writes nothing                              |
| DLV-04B-06 | path scanId UUID; leaseId UUID equal to the live lease; verdict clean, infected, or unavailable; checksum 64 lowercase hex; scannedBytes integer; findingsDigest 64 lowercase hex and required only for infected; engineVersion and signatureDbVersion 1 to 64 printable bytes; signatureDbBuiltAt and completedAt UTC, with a `clean` verdict stale beyond 24 hours (or future-dated) recorded as `unavailable` | 400 INVALID_REQUEST, 401 UNAUTHENTICATED, 403 FORBIDDEN, 404 NOT_FOUND, 409 LEASE_INVALID, CHECKSUM_MISMATCH, or IDEMPOTENCY_MISMATCH, 422 VALIDATION_FAILED, 429 RATE_LIMITED | The job becomes `completed`, `failed_retryable`, or `dead_lettered`; the asset CASes as the Asset effect rule states; unknown or stale lease changes nothing |

### Registry invariants

- DLV-04B-01 through DLV-04B-04 are the only public HTTP operations in this file; DLV-04B-05 and DLV-04B-06 are the only internal service operations and are never browser-reachable. Method and path pairs are unique and do not overlap BE00, 03a, 03b, or 03c routes.
- A route validates shape before existence or capability checks. A concealed target is 404; a known target with an insufficient role or scope is 403. No error body contains owner, claimant, evidence, object key, signed URL, or foreign reference data.
- Every route includes a named CORS policy. cms-console is an explicit first-party origin allowlist; wildcard origins and credentialed wildcard responses are forbidden. Internal queue and command adapters use a non-browser CORS policy and authenticated service identity.
- Every mutation commits domain state, idempotency result, audit event, and outbox intent atomically. Provider work is never reported complete from a client transfer progress signal.
- The client never selects a storage bucket or object key, transform operation, rights state, purge scope, caller shard, or authorization role.

### Route field validation matrix

| Operation  | Location                                                                                                                                                                                              | Exact validation                                                                                                                                                                                                                                                                                                                                                                                                                             | Rejection result                                                                                                                                                                                                                                                                                                      | State effect                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| DLV-04B-01 | body ownerPartyId, purposeCode, classification, declaredMime, declaredByteSize, originalFilename, requestedUses, locale                                                                               | Strict object; ownerPartyId UUID; purposeCode registry code; classification image, audio, video, or document; MIME 1 to 127 printable bytes; byte size integer 1 through 5,368,709,120 (the contract ceiling) and, after shape validation, at most the active PlanLimitProfile max_object_bytes; filename 1 to 160 NFC characters with no slash, backslash, control, or device name; uses 1 to 32 unique registry codes; locale BCP-47 shape | 400 INVALID_REQUEST for malformed path or header, 415 UNSUPPORTED_MEDIA_TYPE for non-JSON, 422 VALIDATION_FAILED for field or registry failure, 422 PLAN_LIMIT_EXCEEDED when the declared size is within the contract ceiling but above the active plan-limit profile, 409 CONFLICT for quota or idempotency mismatch | No asset, object, intent, audit, or outbox row on failure                                                |
| DLV-04B-02 | path assetId; body claimantPartyId, rightsholderPartyId, sourceCode, basis, useCodes, territories, startsAt, endsAt, audience, attribution, consentEvidenceRefs, ownerDomainIds, expectedAssetVersion | UUID path; parties UUID; source and use codes registry members; uses 1 to 64 unique; territories 1 to 250 unique and ISO alpha-2 or sole WORLDWIDE; startsAt UTC; endsAt null or later; no client state; expectedAssetVersion decimal string equal to strong If-Match                                                                                                                                                                        | 400 INVALID_REQUEST or 422 VALIDATION_FAILED for shape; 403 FORBIDDEN or 404 NOT_FOUND for scope; 409 VERSION_MISMATCH, RIGHT_DUPLICATE, or IDEMPOTENCY_MISMATCH                                                                                                                                                      | Existing rights and every derived eligibility remain unchanged                                           |
| DLV-04B-03 | path assetId; body profileKey, profileVersion, useCode, locale, audience, accessibilityVersion, expectedAssetVersion                                                                                  | UUID path; profileKey registered code; profileVersion positive integer; useCode registered; locale BCP-47; audience closed enum; accessibilityVersion and expectedAssetVersion decimal strings; header/body versions equal                                                                                                                                                                                                                   | 400 INVALID_REQUEST, 404 NOT_FOUND, 403 FORBIDDEN, or 422 VALIDATION_FAILED; 409 ASSET_NOT_READY, PROFILE_NOT_ALLOWED, MEDIA_INELIGIBLE, VERSION_MISMATCH, or IDEMPOTENCY_MISMATCH                                                                                                                                    | No rendition object, output key, or job is created before all gates pass                                 |
| DLV-04B-04 | path assetId; body action, reasonCode, effectiveAt, expectedVersion, replacementAssetId, referenceDecisions, caseId                                                                                   | UUID path; action replace, archive, revoke, erase, or hold; reason registry code; effectiveAt UTC; expectedVersion equals strong If-Match; replacement required only for replace; decisions are complete over the enumerated reverse set; caseId required for revoke, erase, and hold; no client-selected purge scope                                                                                                                        | 400 INVALID_REQUEST, 403 FORBIDDEN, 404 NOT_FOUND, 409 VERSION_MISMATCH, ERASURE_BLOCKED, HOLD_CONFLICT, or IDEMPOTENCY_MISMATCH                                                                                                                                                                                      | On failure, no lifecycle, reference, hold, or purge pointer changes; retained bytes and evidence survive |

## Request/Response Contracts (Zod 4 schemas)

The following are normative Zod 4 strict schemas. Parsing happens before authorization, and the operation ID plus normalized body are included in the BE00 idempotency binding. No schema accepts unknown keys, executable URLs, arbitrary transform expressions, or caller-selected storage keys.

```ts
const UUID = z.uuid();
const Version = z.string().regex(/^[1-9][0-9]{0,19}$/);
const IsoTime = z.string().datetime({ offset: true });
const SHA256 = z.string().regex(/^[a-f0-9]{64}$/);
const Code = z.string().regex(/^[a-z][a-z0-9._-]{1,63}$/);
const Locale = z.string().regex(/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/);
const Mime = z
  .string()
  .min(1)
  .max(127)
  .regex(/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/);
const Audience = z.enum([
  'public',
  'authenticated',
  'owner_only',
  'restricted',
]);
const Json = z.json();

const AssetState = z.enum([
  'pending_upload',
  'uploaded',
  'inspecting',
  'quarantined',
  'ready',
  'rejected',
  'restricted',
  'archived',
  'takedown',
  'erasure_pending',
]);
const RightState = z.enum([
  'claimed',
  'reviewing',
  'verified',
  'restricted',
  'expired',
  'disputed',
  'revoked',
  'unknown',
  'rejected',
]);
const RenditionState = z.enum([
  'queued',
  'processing',
  'ready',
  'failed_retryable',
  'failed_terminal',
  'revoked',
]);

const AssetIngestRequest = z
  .strictObject({
    ownerPartyId: UUID,
    purposeCode: Code,
    classification: z.enum(['image', 'audio', 'video', 'document']),
    declaredMime: Mime,
    declaredByteSize: z.number().int().positive().max(5368709120),
    originalFilename: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[^\u0000-\u001F\u007F\/\\]+$/),
    requestedUses: z.array(Code).min(1).max(32),
    locale: Locale.optional(),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.requestedUses).size !== value.requestedUses.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['requestedUses'],
        message: 'uses must be unique',
      });
    }
  });

const AssetIngestResource = z.strictObject({
  id: UUID,
  ownerPartyId: UUID,
  purposeCode: Code,
  classification: z.enum(['image', 'audio', 'video', 'document']),
  declaredMime: Mime,
  declaredByteSize: z.number().int().positive(),
  maxObjectBytes: z.number().int().positive().max(5368709120),
  objectId: UUID,
  uploadIntentId: UUID,
  uploadUrl: z.string().url(),
  uploadExpiresAt: IsoTime,
  state: z.literal('pending_upload'),
  version: Version,
  createdAt: IsoTime,
  updatedAt: IsoTime,
});

const AssetRightCreateRequest = z
  .strictObject({
    claimantPartyId: UUID,
    rightsholderPartyId: UUID.nullable().optional(),
    sourceCode: Code,
    basis: z.enum([
      'original_creation',
      'assignment',
      'license',
      'commission',
      'permission',
      'public_domain',
      'other',
    ]),
    useCodes: z.array(Code).min(1).max(64),
    territories: z
      .array(
        z
          .string()
          .regex(/^[A-Z]{2}$/)
          .or(z.literal('WORLDWIDE')),
      )
      .min(1)
      .max(250),
    startsAt: IsoTime,
    endsAt: IsoTime.nullable().optional(),
    audience: Audience,
    attribution: z.string().max(500).nullable().optional(),
    consentEvidenceRefs: z.array(UUID).max(16),
    ownerDomainIds: z.array(UUID).max(16),
    expectedAssetVersion: Version,
  })
  .superRefine((value, ctx) => {
    if (new Set(value.useCodes).size !== value.useCodes.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['useCodes'],
        message: 'uses must be unique',
      });
    }
    if (new Set(value.territories).size !== value.territories.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['territories'],
        message: 'territories must be unique',
      });
    }
    if (
      value.territories.includes('WORLDWIDE') &&
      value.territories.length !== 1
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['territories'],
        message: 'WORLDWIDE is exclusive',
      });
    }
    if (
      value.endsAt !== undefined &&
      value.endsAt !== null &&
      Date.parse(value.endsAt) <= Date.parse(value.startsAt)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'endsAt must be later than startsAt',
      });
    }
  });

const AssetRightResource = z.strictObject({
  id: UUID,
  assetId: UUID,
  claimantPartyId: UUID,
  rightsholderPartyId: UUID.nullable(),
  sourceCode: Code,
  basis: z.enum([
    'original_creation',
    'assignment',
    'license',
    'commission',
    'permission',
    'public_domain',
    'other',
  ]),
  useCodes: z.array(Code).min(1).max(64),
  territories: z
    .array(
      z
        .string()
        .regex(/^[A-Z]{2}$/)
        .or(z.literal('WORLDWIDE')),
    )
    .min(1),
  startsAt: IsoTime,
  endsAt: IsoTime.nullable(),
  audience: Audience,
  attribution: z.string().max(500).nullable(),
  consentEvidenceRefs: z.array(UUID),
  ownerDomainIds: z.array(UUID),
  state: z.literal('claimed'),
  version: Version,
  createdAt: IsoTime,
  updatedAt: IsoTime,
});

const RenditionGenerateRequest = z.strictObject({
  profileKey: Code,
  profileVersion: z.number().int().positive().max(2147483647),
  useCode: Code,
  locale: Locale,
  audience: Audience,
  accessibilityVersion: Version,
  expectedAssetVersion: Version,
});

const RenditionAcceptedResource = z.strictObject({
  renditionId: UUID,
  assetId: UUID,
  jobId: UUID,
  profileKey: Code,
  profileVersion: z.number().int().positive(),
  sourceChecksum: SHA256,
  state: z.literal('queued'),
  version: Version,
  statusUrl: z.string().url(),
  createdAt: IsoTime,
  updatedAt: IsoTime,
});

const ReferenceDecision = z.strictObject({
  referenceId: UUID,
  decision: z.enum(['switch', 'keep', 'block']),
  expectedReferenceVersion: Version,
  rationale: z.string().min(1).max(500),
});

const LifecycleActionRequest = z
  .strictObject({
    action: z.enum(['replace', 'archive', 'revoke', 'erase', 'hold']),
    reasonCode: Code,
    effectiveAt: IsoTime,
    expectedVersion: Version,
    replacementAssetId: UUID.nullable().optional(),
    referenceDecisions: z.array(ReferenceDecision).max(1024).optional(),
    caseId: UUID.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === 'replace' && value.replacementAssetId === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['replacementAssetId'],
        message: 'replacement is required',
      });
    }
    if (
      value.action !== 'replace' &&
      value.replacementAssetId !== undefined &&
      value.replacementAssetId !== null
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['replacementAssetId'],
        message: 'replacement is not allowed',
      });
    }
    if (
      ['revoke', 'erase', 'hold'].includes(value.action) &&
      (value.caseId === undefined || value.caseId === null)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['caseId'],
        message: 'case is required',
      });
    }
    if (
      value.action === 'replace' &&
      (value.referenceDecisions === undefined ||
        value.referenceDecisions.length === 0)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['referenceDecisions'],
        message: 'reference decisions are required',
      });
    }
  });

const LifecycleActionResource = z.strictObject({
  assetId: UUID,
  action: z.enum(['replace', 'archive', 'revoke', 'erase', 'hold']),
  state: AssetState,
  replacementAssetId: UUID.nullable(),
  referenceCount: z.number().int().nonnegative(),
  switchedReferenceCount: z.number().int().nonnegative(),
  blockedReferenceCount: z.number().int().nonnegative(),
  purgeId: UUID.nullable(),
  eventType: z
    .enum(['delivery.asset.changed.v1', 'delivery.asset.revoked.v1'])
    .nullable(),
  version: Version,
  createdAt: IsoTime,
  updatedAt: IsoTime,
});

const ScanJobLeaseRequest = z.strictObject({ scannerId: Code });

const ScanJobLease = z.strictObject({
  scanId: UUID,
  objectId: UUID,
  checksum: SHA256,
  byteSize: z.number().int().positive().max(5368709120),
  declaredMime: Mime,
  purposeCode: Code,
  leaseId: UUID,
  leaseExpiresAt: IsoTime,
  readUrl: z.string().url(),
  attempt: z.number().int().min(1).max(4),
});

const ScanJobLeaseResponse = z.strictObject({
  jobs: z.array(ScanJobLease).max(1),
});

const ScanVerdictRequest = z
  .strictObject({
    leaseId: UUID,
    verdict: z.enum(['clean', 'infected', 'unavailable']),
    checksum: SHA256,
    scannedBytes: z.number().int().nonnegative().max(5368709120),
    findingsDigest: SHA256.nullable(),
    engineVersion: z.string().min(1).max(64),
    signatureDbVersion: z.string().min(1).max(64),
    signatureDbBuiltAt: IsoTime,
    completedAt: IsoTime,
  })
  .superRefine((value, ctx) => {
    if ((value.verdict === 'infected') !== (value.findingsDigest !== null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['findingsDigest'],
        message: 'digest is required for infected and forbidden otherwise',
      });
    }
  });

const ScanVerdictResource = z.strictObject({
  scanId: UUID,
  state: z.enum(['completed', 'failed_retryable', 'dead_lettered']),
  assetState: AssetState,
  version: Version,
});

const ApiError = z.strictObject({
  code: z.string().min(1).max(96),
  message: z.string().min(1).max(512),
  requestId: UUID,
  details: z.record(z.string(), Json),
});
```

Header contract is also strict: Content-Type application/json, X-Request-Id UUID or server replacement, Idempotency-Key for every mutation, and an exact strong If-Match for DLV-04B-02, DLV-04B-03, and DLV-04B-04. The strong header version must equal the body expected version. DLV-04B-01 returns 201 because the pending domain asset and BE00 upload intent are committed; DLV-04B-03 returns 202 because the rendition is queued; DLV-04B-04 returns 202 when reference or purge work is still pending. Error bodies are the exact ApiError object and never a wrapper. The 422 PLAN_LIMIT_EXCEEDED body carries details { profileKey, profileVersion, maxObjectBytes, declaredByteSize } and no other plan or provider data. DLV-04B-05 and DLV-04B-06 are internal: they take no CSRF token, no session, and no If-Match, and DLV-04B-06 requires Idempotency-Key.

### Contract and error matrix

| Operation  | Success status and body                                 | 400 or 415                                  | 401                                      | 403 versus 404                                                              | 409 or 422                                                                                                                                                            | 429 or dependency failure                                                                                                            |
| ---------- | ------------------------------------------------------- | ------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| DLV-04B-01 | 201 AssetIngestResource; Location; no-store             | Invalid path, header, JSON, or content type | Missing, expired, or invalid session     | Known scope without media_contributor is 403; unreadable owner scope is 404 | Quota or duplicate idempotency binding is 409; registry failure or a declared size above the active plan-limit profile (PLAN_LIMIT_EXCEEDED) is 422; no partial asset | RATE_LIMITED with Retry-After; BE00 upload-intent or RPC outage is DEPENDENCY_UNAVAILABLE with Retry-After                           |
| DLV-04B-02 | 201 AssetRightResource; Location; ETag; no-store        | Invalid IDs, JSON, content type, or header  | Missing, expired, or invalid session     | Readable asset without rights-entry scope is 403; concealed asset is 404    | Stale version, duplicate active claim, forbidden state, or invalid use is 409 or 422                                                                                  | RATE_LIMITED with Retry-After; evidence projection or RPC outage is DEPENDENCY_UNAVAILABLE                                           |
| DLV-04B-03 | 202 RenditionAcceptedResource; Location; ETag; no-store | Invalid IDs, JSON, content type, or header  | Missing, expired, or invalid session     | Known asset without rendition capability is 403; concealed asset is 404     | Stale version, non-ready asset, profile, rights, accessibility, or idempotency conflict is 409 or 422                                                                 | RATE_LIMITED with Retry-After; queue, object, or profile dependency outage is DEPENDENCY_UNAVAILABLE                                 |
| DLV-04B-04 | 200 or 202 LifecycleActionResource; no-store            | Invalid IDs, action, JSON, or header        | Missing, expired session, or missing MFA | Known asset with wrong action capability is 403; concealed asset is 404     | Stale version, held evidence, active reference, retention, or idempotency conflict is 409                                                                             | RATE_LIMITED with Retry-After; purge provider failure is DEPENDENCY_UNAVAILABLE or accepted partial incident, never false completion |

## Database Schema

All 04b tables are in a non-exposed private schema with RLS enabled and forced. Anonymous and authenticated clients have no direct INSERT, UPDATE, or DELETE grants. Named security-invoker or tightly scoped security-definer RPCs set an empty search_path, recheck actor, acting party, capability, target scope, CAS version, and idempotency, and write BE00 audit and outbox rows atomically. JSONB is structured data validated by the contracts, never an EAV escape hatch.

### Canonical records and fields

The following rows are normative SQL shapes. Every domain field has an SQL type, nullability, constraint, relationship or explicit registry rationale, indexes, and grant boundary.

| Model and table                                            | Typed fields, nullability, constraints, and foreign keys                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Query indexes and write rules                                                                                                                                                                                                                                                                                                                                                      | RLS and grants                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AssetRecord and cms_asset_records                          | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; owner_party_id uuid NOT NULL REFERENCES platform_private.party(id) ON DELETE RESTRICT; purpose_code text NOT NULL CHECK purpose_code matches the registered asset-purpose code; classification text NOT NULL CHECK classification IN image, audio, video, document; declared_mime text NOT NULL CHECK octet_length between 1 and 127; detected_mime text NULL CHECK octet_length between 1 and 127 when present; byte_size bigint NOT NULL CHECK byte_size > 0 and <= 5368709120; width integer NULL CHECK width > 0; height integer NULL CHECK height > 0; duration_ms bigint NULL CHECK duration_ms >= 0; page_count integer NULL CHECK page_count > 0; checksum_algorithm text NULL CHECK checksum_algorithm IN sha256; checksum_value char(64) NULL CHECK checksum_value matches lowercase SHA-256; metadata jsonb NOT NULL DEFAULT empty object CHECK object and <= 8192 bytes; object_id uuid NOT NULL REFERENCES platform_private.object_records(id) ON DELETE RESTRICT; plan_limit_profile_key text NOT NULL; plan_limit_profile_version integer NOT NULL CHECK > 0; FOREIGN KEY plan_limit_profile_key, plan_limit_profile_version REFERENCES cms_plan_limit_profiles(profile_key, profile_version); lifecycle cms_asset_state NOT NULL DEFAULT pending_upload; version bigint NOT NULL DEFAULT 1 CHECK version > 0; created_by uuid NOT NULL REFERENCES auth.users(id); created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now() | INDEX checksum_value where checksum_value is not null; INDEX owner_party_id, purpose_code, lifecycle; INDEX lifecycle, updated_at; INDEX object_id; content hash is a duplicate suggestion only and never joins owners or rights; byte_size at most the referenced profile max_object_bytes is a cross-table rule enforced by the cms_create_asset RPC and a BEFORE INSERT trigger | SELECT only owner scope, delegated media scope, curator scope, or a safe worker projection; INSERT through cms_create_asset RPC; lifecycle and object_id are immutable except named CAS transitions; no direct DELETE                                                   |
| AssetRight and cms_asset_rights                            | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; asset_id uuid NOT NULL REFERENCES cms_asset_records(id) ON DELETE RESTRICT; claimant_party_id uuid NOT NULL REFERENCES platform_private.party(id) ON DELETE RESTRICT; rightsholder_party_id uuid NULL REFERENCES platform_private.party(id) ON DELETE RESTRICT; source_code text NOT NULL CHECK source_code is a registered source code; basis text NOT NULL CHECK basis IN original_creation, assignment, license, commission, permission, public_domain, other; use_codes text[] NOT NULL CHECK cardinality between 1 and 64 and all members are registered; territories text[] NOT NULL CHECK cardinality between 1 and 250 and all members are ISO alpha-2 or WORLDWIDE; starts_at timestamptz NOT NULL; ends_at timestamptz NULL CHECK ends_at is null or ends_at > starts_at; audience text NOT NULL CHECK audience IN public, authenticated, owner_only, restricted; attribution text NULL CHECK octet_length <= 500; consent_evidence_refs uuid[] NOT NULL DEFAULT empty array CHECK cardinality <= 16; owner_domain_ids uuid[] NOT NULL DEFAULT empty array CHECK cardinality <= 16; state cms_right_state NOT NULL DEFAULT claimed; version bigint NOT NULL DEFAULT 1 CHECK version > 0; created_by uuid NOT NULL REFERENCES auth.users(id); created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now()                                                                                                                            | UNIQUE asset_id, claimant_party_id, source_code, starts_at; INDEX asset_id, state, starts_at, ends_at; GIN use_codes; GIN territories; INDEX claimant_party_id; evidence and owner-domain UUID arrays have no direct FK because they point to producer-owned restricted records and are verified through a scoped projection in the RPC                                            | SELECT only asset owner, delegated rights scope, curator, or named command consequence; INSERT claimed only through cms_add_asset_right RPC; state transitions into restricted, disputed, or revoked only through named inbound command RPC; no direct UPDATE or DELETE |
| AssetAccessibility and cms_asset_accessibility             | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; asset_id uuid NOT NULL REFERENCES cms_asset_records(id) ON DELETE RESTRICT; use_code text NOT NULL CHECK registered use code; locale text NOT NULL CHECK BCP-47 shape; decorative boolean NOT NULL DEFAULT false; alt_text text NULL CHECK octet_length <= 1000; caption_ref text NULL CHECK octet_length <= 256; transcript_ref text NULL CHECK octet_length <= 256; focal_x numeric(9,6) NULL CHECK focal_x between 0 and 1; focal_y numeric(9,6) NULL CHECK focal_y between 0 and 1; authored_by uuid NOT NULL REFERENCES auth.users(id); reviewed_by uuid NULL REFERENCES auth.users(id); state cms_accessibility_state NOT NULL DEFAULT draft; version bigint NOT NULL DEFAULT 1 CHECK version > 0; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK decorative or alt_text is non-empty for informative image use; CHECK audio and video uses have caption or transcript policy satisfied                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | UNIQUE asset_id, use_code, locale, version; UNIQUE asset_id, use_code, locale where state is active; INDEX asset_id, use_code, locale, state; INDEX reviewed_by, state                                                                                                                                                                                                             | SELECT owner or curator scope only; INSERT and review through scoped media RPC; public projections consume only approved rows through 04c; direct table grants absent                                                                                                   |
| TransformProfileVersion and cms_transform_profile_versions | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; profile_key text NOT NULL CHECK registered lowercase code; profile_version integer NOT NULL CHECK profile_version > 0; input_kinds text[] NOT NULL CHECK cardinality > 0 and members are registered kinds; operations jsonb NOT NULL CHECK object and <= 8192 bytes; output_mime text NOT NULL CHECK registered output MIME; output_width integer NULL CHECK > 0; output_height integer NULL CHECK > 0; quality numeric(5,2) NULL CHECK between 0 and 100; max_output_bytes bigint NOT NULL CHECK > 0; max_decoded_pixels bigint NOT NULL CHECK max_decoded_pixels > 0; accessibility_rules jsonb NOT NULL CHECK object; rights_rules jsonb NOT NULL CHECK object; lifecycle text NOT NULL CHECK lifecycle IN supported, deprecated, withdrawn; content_hash char(64) NOT NULL CHECK lowercase SHA-256; registered_at timestamptz NOT NULL DEFAULT now()                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | UNIQUE profile_key, profile_version; INDEX profile_key, lifecycle, profile_version DESC; GIN input_kinds; operations, output, accessibility, and rights rules are code-owned manifests and cannot be supplied by a caller                                                                                                                                                          | Worker and media-curator reads use a protected profile projection; registration is release RPC only; no human UPDATE or DELETE; withdrawn profiles cannot start new jobs                                                                                                |
| RenditionRecord and cms_rendition_records                  | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; asset_id uuid NOT NULL REFERENCES cms_asset_records(id) ON DELETE RESTRICT; source_checksum char(64) NOT NULL CHECK lowercase SHA-256; profile_key text NOT NULL; profile_version integer NOT NULL CHECK > 0; transform_hash char(64) NOT NULL CHECK lowercase SHA-256; object_id uuid NULL REFERENCES platform_private.object_records(id) ON DELETE RESTRICT; detected_mime text NULL CHECK octet_length between 1 and 127; output_checksum char(64) NULL CHECK lowercase SHA-256; output_width integer NULL CHECK > 0; output_height integer NULL CHECK > 0; output_duration_ms bigint NULL CHECK >= 0; output_page_count integer NULL CHECK > 0; state cms_rendition_state NOT NULL DEFAULT queued; error_code text NULL CHECK octet_length <= 96; version bigint NOT NULL DEFAULT 1 CHECK version > 0; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); FOREIGN KEY profile_key, profile_version REFERENCES cms_transform_profile_versions(profile_key, profile_version)                                                                                                                                                                                                                                                                                                                                                                                                                                                      | UNIQUE asset_id, source_checksum, profile_key, profile_version, transform_hash; INDEX asset_id, state, updated_at; INDEX profile_key, profile_version, state; INDEX object_id; INDEX state, updated_at for worker leases; outputs are immutable after ready and cannot replace source bytes                                                                                        | SELECT owner or curator projection; INSERT and CAS state through cms_queue_rendition RPC and worker lease RPC; object_id becomes set only after private re-inspection; no direct delete while referenced or retained                                                    |
| AssetReference and cms_asset_references                    | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; source_type text NOT NULL CHECK source_type is a registered source kind; source_id uuid NOT NULL; source_version bigint NOT NULL CHECK > 0; source_path text NOT NULL CHECK length between 1 and 512 and no control characters; asset_id uuid NOT NULL REFERENCES cms_asset_records(id) ON DELETE RESTRICT; rendition_id uuid NULL REFERENCES cms_rendition_records(id) ON DELETE RESTRICT; use_code text NOT NULL CHECK registered use code; locale text NOT NULL CHECK BCP-47 shape; audience text NOT NULL CHECK audience IN public, authenticated, owner_only, restricted; active_from timestamptz NULL; active_to timestamptz NULL CHECK active_to is null or active_from is not null and active_to > active_from; lifecycle text NOT NULL CHECK lifecycle IN planned, preview_pending, active, superseded, blocked, revoked, archived; version bigint NOT NULL DEFAULT 1 CHECK version > 0; created_by uuid NOT NULL REFERENCES auth.users(id); created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now()                                                                                                                                                                                                                                                                                                                                                                                                                             | UNIQUE source_type, source_id, source_version, source_path, use_code, locale, version; INDEX asset_id, lifecycle, use_code; INDEX rendition_id, lifecycle; INDEX source_type, source_id, source_version; active period index for reverse-reference and retention sweeps                                                                                                            | SELECT only source-owner or curator scope; source_type and source_id are intentionally polymorphic because 03 and downstream domains own source tables, with RPC allowlist and existence checks; reference decisions are named RPC only; no direct delete               |
| TakedownCaseLink and cms_takedown_case_links               | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; subject_type text NOT NULL CHECK subject_type IN asset, reference, right; subject_id uuid NOT NULL; caller_shard smallint NOT NULL CHECK caller_shard IN 6, 10, 20; case_id uuid NOT NULL; scope text NOT NULL CHECK scope IN asset, reference, right; hold boolean NOT NULL DEFAULT true; state text NOT NULL CHECK state IN active, released, expired; reason_code text NOT NULL CHECK registered reason; effective_at timestamptz NOT NULL; released_at timestamptz NULL; version bigint NOT NULL DEFAULT 1 CHECK version > 0; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK scope matches subject_type; subject_id is polymorphic by design and is resolved under subject_type in the command RPC because case ownership stays in Shard 06, 10, or 20                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | UNIQUE caller_shard, case_id, subject_type, subject_id; INDEX subject_type, subject_id, state; INDEX caller_shard, case_id; INDEX state, effective_at; no release may remove another caller shard hold                                                                                                                                                                             | Owning-domain command principal may insert or release only its own caller_shard and case_id through inbound command RPC; rights_safety_operator may use the same assigned case scope with MFA; worker may reconcile by CAS; no direct client grants                     |
| DeliveryPurgeRecord and cms_delivery_purge_records         | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY; subject_type text NOT NULL CHECK subject_type IN asset, reference, rendition, object, right, publication, route, projection; subject_id uuid NOT NULL; subject_version bigint NOT NULL CHECK > 0; scope jsonb NOT NULL CHECK object, <= 8192 bytes, and only registered purge scopes (public, private, route, tag, version, all_derived); scope_hash char(64) NOT NULL CHECK lowercase SHA-256 of the RFC 8785 canonical scope; reason_code text NOT NULL CHECK registered reason; urgent boolean NOT NULL; state cms_purge_state NOT NULL DEFAULT requested; requested_at timestamptz NOT NULL DEFAULT now(); completed_at timestamptz NULL; evidence_refs jsonb NOT NULL DEFAULT empty array CHECK array and <= 8192 bytes; provider_refs jsonb NOT NULL DEFAULT empty array CHECK array and <= 8192 bytes; version bigint NOT NULL DEFAULT 1 CHECK version > 0; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); subject_id is polymorphic so one purge can fence an asset, reference, rendition, BE00 object, right, publication, route, or projection without a false cross-schema FK; this is the only physical purge table, created by the Slice 14 migration, and 04c inserts rows through its named delivery RPCs and the BE00 purge seam without defining a second table                                                                                                                                                | UNIQUE subject_type, subject_id, subject_version, scope_hash, reason_code, urgent; INDEX state, requested_at; INDEX subject_type, subject_id, subject_version; INDEX urgent, state; provider refs are evidence, not authority                                                                                                                                                      | Authenticated media operators see scoped status only; lifecycle RPC and the 04c delivery RPCs create rows; purge worker updates state and evidence by CAS; provider adapter has no table grant; failed or partial urgent rows remain open                               |
| ScanJob and cms_scan_jobs                                  | id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY (the scanId); object_id uuid NOT NULL REFERENCES platform_private.object_records(id) ON DELETE RESTRICT; asset_id uuid NOT NULL REFERENCES cms_asset_records(id) ON DELETE RESTRICT; checksum_value char(64) NOT NULL CHECK lowercase SHA-256; state text NOT NULL CHECK state IN queued, leased, completed, failed_retryable, dead_lettered; attempts smallint NOT NULL DEFAULT 0 CHECK attempts between 0 and 4; lease_id uuid NULL; leased_by text NULL CHECK scanner principal id format; lease_expires_at timestamptz NULL; verdict text NULL CHECK verdict IN clean, infected, unavailable; findings_digest char(64) NULL CHECK lowercase SHA-256; engine_version text NULL CHECK octet_length between 1 and 64; signature_db_version text NULL CHECK octet_length between 1 and 64; signature_db_built_at timestamptz NULL; scanned_bytes bigint NULL CHECK >= 0; completed_at timestamptz NULL; version bigint NOT NULL DEFAULT 1 CHECK version > 0; created_at timestamptz NOT NULL DEFAULT now(); updated_at timestamptz NOT NULL DEFAULT now(); CHECK (state = 'leased') = (lease_id IS NOT NULL AND lease_expires_at IS NOT NULL); CHECK (verdict IS NULL OR state IN completed, failed_retryable, dead_lettered); CHECK (verdict = 'infected') = (findings_digest IS NOT NULL)                                                                                                                                                                                     | UNIQUE object_id, checksum_value WHERE state IN queued, leased, failed_retryable (one live job per object and checksum); INDEX state, created_at; INDEX asset_id; the row holds identifiers, digests, and versions only and never a filename, URL, or raw finding                                                                                                                  | SELECT only a scoped worker projection and operator status; INSERT by the upload-completion RPC; lease, verdict, retry, and DLQ transitions only through the scan-job RPCs by CAS; no direct grants                                                                     |
| PlanLimitProfile and cms_plan_limit_profiles               | profile_key text NOT NULL CHECK registered lowercase code; profile_version integer NOT NULL CHECK > 0; hosting_plan text NOT NULL CHECK octet_length between 1 and 64; max_object_bytes bigint NOT NULL CHECK between 1 and 5368709120; contract_ceiling_bytes bigint NOT NULL CHECK = 5368709120; state text NOT NULL CHECK state IN active, superseded; content_hash char(64) NOT NULL CHECK lowercase SHA-256; recorded_at timestamptz NOT NULL DEFAULT now(); PRIMARY KEY profile_key, profile_version                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Partial UNIQUE on state where state = active (exactly one active profile); rows are seeded by forward-only migration and are immutable except the active to superseded transition; the Phase 2 hosted row is profile_key phase2_hosted_free, profile_version 1, hosting_plan supabase_free, max_object_bytes 52428800 (50 MiB), contract_ceiling_bytes 5368709120                  | Worker and RPC read only; no human or browser write; raising the cap is a new forward-migration row at or below the contract ceiling and never a request field                                                                                                          |

### SQL state types and invariants

```sql
create type cms_asset_state as enum
  ('pending_upload', 'uploaded', 'inspecting', 'quarantined', 'ready',
   'rejected', 'restricted', 'archived', 'takedown', 'erasure_pending');
create type cms_right_state as enum
  ('claimed', 'reviewing', 'verified', 'restricted', 'expired',
   'disputed', 'revoked', 'unknown', 'rejected');
create type cms_accessibility_state as enum ('draft', 'approved', 'blocked', 'retired');
create type cms_rendition_state as enum
  ('queued', 'processing', 'ready', 'failed_retryable', 'failed_terminal', 'revoked');
create type cms_purge_state as enum
  ('requested', 'dispatching', 'verifying', 'completed', 'partial', 'failed_retryable');
```

- A ready AssetRecord requires BE00 object state ready, clean scan, detected metadata, checksum, and purpose-policy admission. A pending or quarantined asset has no rendition and no public object.
- A ready AssetRecord also requires a `clean` ScanJob verdict whose checksum equals `checksum_value`. While a scan job is queued or leased the asset is `inspecting`; both `inspecting` and `quarantined` expose no rendition, signed delivery, or public object and cannot satisfy a publication reference. The active PlanLimitProfile bounds `byte_size` below the 5,368,709,120-byte contract ceiling, and the profile that admitted the asset is recorded on it.
- A claimed AssetRight is an assertion only. This shard never changes it to verified, restricted, disputed, or revoked from the human rights-entry route. Inbound RevokeDeliveryEligibility or delivery-hold commands record caller attribution and expected version.
- Every array or JSONB field is bounded by the Zod contract and the SQL check. Every bigint crosses the API as a decimal string. A registry code or polymorphic source is not a missing FK: the named RPC verifies it against the producer-owned projection and records the producer/version.
- BE00 object_records and upload_intents remain the only physical upload metadata and signed-transfer records. A 04b object_id is a foreign key link, not a shadow object table.
- Retention or legal hold prevents physical byte deletion. Superseded records, evidence pointers, audit, outbox, and purge evidence remain immutable for configured legal and audit retention.

### Permission, RLS and grants

| Table                          | Read predicate                                                                                                                | Write predicate                                                                                                  | Grants and escalation                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| cms_asset_records              | Owner party, delegated media scope, assigned curator, or named worker projection; concealed scope returns no row              | cms_create_asset and lifecycle CAS RPCs; object verifier may transition only expected upload state               | No direct browser grants; operator requires assigned scope, MFA for protected actions, reason and audit             |
| cms_asset_rights               | Asset owner or delegated rights-entry scope; curator sees claims in assigned scope; command worker sees named subject only    | cms_add_asset_right creates claimed; inbound command RPC alone writes restricted, disputed, or revoked assertion | No direct table writes; foreign-domain principal cannot read a broad asset or claimant listing                      |
| cms_asset_accessibility        | Asset owner, assigned curator, or worker for named asset and use                                                              | Scoped author and review RPCs; only approved rows feed a downstream public projection                            | No direct grants; reviewers cannot alter authored evidence without a new version                                    |
| cms_transform_profile_versions | Registered profile projection for workers and authorized curators                                                             | Release registration RPC only; profile fields immutable                                                          | No browser INSERT, UPDATE, or DELETE; withdrawn profile remains readable for lineage                                |
| cms_rendition_records          | Owner, curator, or job status projection scoped to asset and rendition                                                        | Queue RPC creates queued row; worker CAS changes processing, ready, failed, or revoked                           | No direct object URL; object deletion is retention and reference fenced                                             |
| cms_asset_references           | Source owner, assigned curator, or worker named by source and asset                                                           | Lifecycle RPC and reference-convergence worker only; source ownership is rechecked                               | Polymorphic source is never traversed outside its registered projection                                             |
| cms_takedown_case_links        | Calling shard sees its own case and subject; curator sees assigned incident scope; worker sees identifier-only reconciliation | Apply or release command RPC with caller_shard and case_id binding; no broad release                             | Wrong caller shard, case, or subject is refused; support cannot override a hold                                     |
| cms_delivery_purge_records     | Scoped operator or worker sees subject, state, evidence and provider request IDs only                                         | Lifecycle RPC inserts; purge worker CAS updates; provider adapter never writes directly                          | Urgent partial and failed rows cannot be deleted or marked completed by a human                                     |
| cms_scan_jobs                  | Scoped worker projection and operator status; the lease holder sees only its own leased job                                   | Upload-completion RPC inserts; scan-job RPCs CAS lease, verdict, retry, and DLQ transitions                      | No direct grants; the scanner principal has the media-scan scope only and cannot read assets, rights, or other jobs |
| cms_plan_limit_profiles        | Worker and RPC read the active profile                                                                                        | Forward migration only                                                                                           | No browser or human write; a profile change never alters an admitted asset                                          |

## Middleware & Policies

### Hono middleware order

All four HTTP operations use the BE00 order: request ID, raw body and content-type guard, JSON parse, strict Zod validation, Supabase session and JWT verification, server-derived acting-context resolution, capability and owner-scope evaluation, session-bound CSRF, first-party CORS allowlist, operation rate limiter, handler and schema-qualified RPC, then response and error normalization. CORS is not a wildcard and is named in every registry row. Internal scanner, rendition, verifier, command, and purge adapters use a signed service principal guard, no browser CSRF, and a CORS policy of non-browser none.

### Per-operation authorization matrix

| Operation  | Principal and positive scope                                                                                   | 404 concealment                                           | 403 denial                                                                              | Additional hard gate                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| DLV-04B-01 | Verified human with media_contributor and current owner-party upload purpose scope                             | Owner party or target policy not readable                 | Known owner scope but no media_contributor or quota capability                          | Server derives owner context, enforces quota, scanner admission, and no operator bypass                |
| DLV-04B-02 | Verified human with media_contributor plus rights-entry scope for the asset owner, or approved delegated scope | Asset, owner, or target reference not readable            | Readable asset but actor lacks rights-entry capability or delegation                    | State is forced to claimed; no self-asserted verification or revocation                                |
| DLV-04B-03 | Verified human with media_curator in scope, or owner media_contributor for an allowed purpose/profile pair     | Asset, profile, or purpose scope not readable             | Readable asset but actor lacks rendition capability or requested profile scope          | Asset ready, clean inspection, effective local right, accessibility version, and profile compatibility |
| DLV-04B-04 | media_curator for replace or archive; rights_safety_operator with recent MFA for revoke, erase, or hold        | Asset or reverse references outside actor scope           | Known asset but action capability, assigned case, or MFA missing                        | Complete reverse-reference enumeration, stable lock order, retention and legal-hold checks             |
| DLV-04B-05 | Registered scanner service principal with scope media-scan bound to one scanner id                             | None: a bad credential is 401 and never a resource lookup | Principal authenticated but lacks the scope or scannerId differs from its registered id | One live lease per job; the response holds only the leased job identifiers and one single-use read URL |
| DLV-04B-06 | The same principal that holds the live lease                                                                   | Unknown or non-leased scanId is 404                       | Principal lacks the scope or is not the lease holder                                    | Verdict checksum must equal the stored checksum; clean is accepted only from the lease holder          |

### Capability provisioning (DEC-119)

The `media_contributor` and `media_curator` capabilities named in this section are the registered keys `cms.media_contributor` and `cms.media_curator`. Both are members of the closed grantable registry of BE03a CMS-03A-15, so the receipt-derived owner provisions them through that operation, including to itself, with no direct grant-row write. The grant supplies only the capability: each operation here still applies the owner-party upload-purpose, asset, profile and rights-entry scopes it already defines, and `rights_safety_operator` and every `admin.*` authority remain outside the grantable set.

### Security and abuse controls

- The raw JSON body is capped at 256 KiB, nesting at 8, object keys at 128, and arrays at 128 unless a field gives a lower bound. Filename, MIME, locale, code, UUID, URL, and decimal formats are strict.
- Declared MIME, extension, detected MIME, magic bytes, byte count, dimensions, duration, page count, checksum, archive/decompression ratio, metadata and scanner verdict are all checked. A mismatch, malware finding, scanner outage, parser bomb, or quota violation stays quarantined or rejected.
- Decompression-bomb guard: the default image transform profile registers `max_decoded_pixels` = 50,000,000 (decoded width times height; a code-owned profile value, never caller input). DLV-04B-03 compares the asset's inspected `width` times `height` to the requested profile's value and refuses a larger source as 422 `MEDIA_DECODE_LIMIT` before any job exists; the rendition worker re-checks the header dimensions before allocating decode buffers and aborts a decode that would exceed the limit as `failed_terminal` `MEDIA_DECODE_LIMIT`, which is never retried.
- Client input never supplies bucket, object key, signed URL, checksum authority, transform operations, profile manifest, public audience grant, right state, purge scope, caller shard, or owner role. Server-generated keys include asset and object identity and are not reused after replacement.
- Physical duplicate bytes may be reused only behind separate AssetRecord, AssetRight, AssetAccessibility, AssetReference, retention, and takedown rows. Duplicate responses contain no foreign owner, right, reference, filename, or object URL.
- Signed URLs are minted only by BE00 after PostgreSQL authorization and bind object or rendition ID, checksum, version, audience, use, disposition, range, and expiry. 04b never emits a public URL for pending, quarantined, revoked, or held bytes.
- Scanner and transform adapters receive private object IDs and checksums, not broad bucket listing permission. Queue payloads contain identifiers and versions only; raw media and protected rights evidence stay out of queues and logs.
- The scanner receives a job of identifiers and one single-use signed read URL bound to the object, checksum, and lease expiry; it holds no bucket listing, no database credential, and no browser session. Scan verdicts carry digests and versions, never finding names or payload bytes.
- CSRF requires same-origin and session-bound token for browser mutations. CORS allows configured CMS-console origins only. Rate limits are actor and acting-party keyed, with separate ingest, rights, rendition, and lifecycle buckets.
- structured logs scrub signed URLs, object keys, filename, claimant, consent evidence, case, token, body, and raw provider payload. Request ID, operation ID, safe error code, correlation ID, and hashed subject ID are retained.

## Data Flow

### Protected command transactions

1. DLV-04B-01 parses and authorizes the owner and purpose, checks the declared size against the active PlanLimitProfile (422 PLAN_LIMIT_EXCEEDED above it, with the profile recorded on the asset when admitted), reserves BE00 idempotency, calls the named BE00 upload-intent command for one private object, inserts AssetRecord in pending_upload, and commits audit plus delivery.asset.changed.v1 in one transaction. The response contains the one 15-minute signed upload intent. Client transfer progress is not readiness.
2. BE00 owns upload completion and object verification. The completion worker checks byte count, checksum, MIME, magic bytes, dimensions, archive risk, and metadata, then inserts one identifier-only ScanJob and leaves the asset `inspecting`. The self-operated scanner leases the job (DLV-04B-05) and posts its verdict (DLV-04B-06), and the 04b verifier RPC then uses CAS to move AssetRecord from inspecting to ready, quarantined, or rejected and emits delivery.asset.changed.v1. An `infected` verdict rejects the asset; `unavailable`, a checksum mismatch, or an exhausted retry budget leaves it `quarantined`; `clean` is never inferred.
3. DLV-04B-02 locks the asset at the If-Match version, validates use, territory, term, audience, claimant, consent and evidence references, inserts AssetRight in claimed, and commits audit and delivery.asset.changed.v1. It never infers a right from upload, claimant text, possession, or a client state field.
4. DLV-04B-03 locks AssetRecord and the exact TransformProfileVersion, evaluates local AssetRight, AssetAccessibility, hold and reference state, computes transform hash from source checksum plus profile version and use, inserts one queued RenditionRecord, and requests a BE00 JobStatus. No output object exists before the job passes gates.
5. The rendition worker leases the job, re-reads current source and profile rows, transforms (image transforms run as WASM codecs inside the Cloudflare Worker queue consumer, with no external image service) into a server key, re-inspects output, stores it privately through BE00 object metadata, and CASes RenditionRecord to ready or a retryable or terminal failure. It emits delivery.rendition.ready.v1 only after output checksum and metadata commit.
6. DLV-04B-04 locks the asset, reverse references, rights links, case links and purge fences in stable order. Replace requires a new asset and a complete per-reference decision set; archive preserves bytes and evidence; revoke, erase, or hold first makes delivery ineligible and inserts urgent DeliveryPurgeRecord in the same transaction. Provider purge completion is separate evidence.
7. Inbound ApplyDeliveryHold, ReleaseDeliveryHold, and RevokeDeliveryEligibility commands authenticate the owning shard, caller case, subject scope, reason, effective time, and expected version. A local TakedownCaseLink or AssetRight assertion is written atomically with its delivery consequence. Unknown subject, replay, or lost command never broadens scope; reconciliation leaves uncertainty held.

### Transaction and external seams

| Seam                                                                                                  | Exact request                                                                                                                                                                                                                                                                       | Exact response                                                                                                                                                                                                                                                                                                                                                           | Timeout, retry, and circuit behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE00 upload-intent command                                                                            | { operationId: DLV-04B-01, assetId: UUID, ownerPartyId: UUID, purposeCode: code, declaredMime: MIME, maxBytes: integer, expectedAssetVersion: decimal string }                                                                                                                      | { uploadIntentId: UUID, objectId: UUID, objectKey: server string, uploadUrl: URL, expiresAt: UTC time, state: issued }                                                                                                                                                                                                                                                   | PostgreSQL/RPC attempt 2,000 ms; three durable retry attempts at 15 s, 60 s, 300 s only before signed transfer effect; circuit opens after five retryable failures for 60 s; ambiguous result resolves by idempotency binding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Scanner consumer (self-operated ClamAV, pull model; DEC-116)                                          | Lease { scannerId: code } and verdict { leaseId: UUID, verdict: clean or infected or unavailable, checksum: SHA256, scannedBytes: integer, findingsDigest: SHA256 or null, engineVersion: string, signatureDbVersion: string, signatureDbBuiltAt: UTC time, completedAt: UTC time } | Lease { jobs: at most one { scanId: UUID, objectId: UUID, checksum: SHA256, byteSize: integer, declaredMime: MIME, purposeCode: code, leaseId: UUID, leaseExpiresAt: UTC time, readUrl: single-use signed URL, attempt: 1 to 4 } } and verdict { scanId: UUID, state: completed or failed_retryable or dead_lettered, assetState: asset state, version: decimal string } | Lease valid 120,000 ms; verdict callback attempt 5,000 ms; three retries at 15 s, 60 s, 300 s then DLQ; circuit opens after five retryable failures for 60 s; unavailable (including a `clean` verdict from signatures older than 24 hours), DLQ, and checksum mismatch quarantine and never map to clean                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Rendition worker (WASM image codec in a Cloudflare Worker queue consumer; DEC-116) and object adapter | { jobId: UUID, renditionId: UUID, assetId: UUID, sourceChecksum: SHA256, profileKey: code, profileVersion: integer, useCode: code, accessibilityVersion: decimal string }                                                                                                           | { renditionId: UUID, objectId: UUID or null, outputChecksum: SHA256 or null, detectedMime: MIME or null, state: ready or failed_retryable or failed_terminal, errorCode: code or null }                                                                                                                                                                                  | Transform attempt aborts at 10,000 ms wall time with failed_retryable TRANSFORM_TIME_EXCEEDED under a 120,000 ms lease; the registered profile supplies maxDecodedPixels (50,000,000 for the default image profile) and max_output_bytes and a violation is failed_terminal MEDIA_DECODE_LIMIT or MEDIA_OUTPUT_LIMIT, with a source already over the pixel limit refused at DLV-04B-03 as 422 MEDIA_DECODE_LIMIT; three retries at 15 s, 60 s, 300 s for retryable faults; five failures open a 60 s circuit; lease expiry fences stale workers and CAS prevents duplicate output; no external transform provider and no Supabase image transformation is used; Phase 2 registers image input kinds only, so audio, video, and document profiles are absent and DLV-04B-03 answers 409 PROFILE_NOT_ALLOWED for them |
| Urgent purge adapter                                                                                  | { purgeId: UUID, subjectType: asset or reference or rendition or object, subjectId: UUID, subjectVersion: decimal string, scope: registered scope list, urgent: boolean }                                                                                                           | { purgeId: UUID, providerRequestIds: UUID list, acceptedScopes: registered scope list, completedScopes: registered scope list, state: dispatching or verifying or completed or partial }                                                                                                                                                                                 | Adapter attempt 2,000 ms; three durable retries at 15 s, 60 s, 300 s; five retryable failures open a 60 s circuit; partial urgent purge remains open and alerts until provider evidence verifies every scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

The direct client upload uses the BE00 15-minute intent and its 30-second no-byte inactivity abort. It is not an API response deadline and cannot advance AssetRecord by itself. No provider response containing a signed URL or raw finding is logged.

### State machine and concurrency

| Aggregate                                | Allowed states and transitions                                                                                                               | CAS and duplicate rule                                                                                                                                         | Failure recovery                                                                                                                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AssetRecord                              | pending_upload to uploaded to inspecting to quarantined or ready or rejected; ready to restricted or archived or takedown or erasure_pending | Asset version increments on every transition; only one live object link; duplicate checksum is a suggestion and never an ownership merge                       | Expired intent quarantines or removes orphan under BE00 retention; scanner outage stays quarantined; stale verifier loses CAS and rereads current state                                                  |
| AssetRight                               | claimed to reviewing to verified, restricted, unknown, or rejected; verified to expired, disputed, or revoked                                | Claimed insert is unique by asset, claimant, source and start; restricted, disputed, or revoked assertions require inbound command caller and expected version | Expiry sweep creates ineligible state and asset event; disputed or revoked state removes eligible uses before purge; unknown fails closed                                                                |
| AssetAccessibility                       | draft to approved or blocked or retired                                                                                                      | One current asset, use, locale version; reviewer CAS cannot overwrite authored version                                                                         | Missing required alt, caption, transcript or focal policy blocks the dependent rendition or reference; old approved evidence remains                                                                     |
| RenditionRecord                          | queued to processing to ready, failed_retryable, failed_terminal, or revoked                                                                 | Unique asset, source checksum, profile version and transform hash; same key returns same rendition and job                                                     | Lease expiry requeues within three attempts; terminal failure keeps reference blocked; source or right change revokes use without deleting evidence                                                      |
| AssetReference                           | planned to preview_pending to active to superseded, blocked, revoked, or archived                                                            | Per-reference expected version and complete reverse set; replacement never silently swaps every reference                                                      | Missing replacement or approval blocks only affected reference; source deletion creates a tombstone and dependent invalidation                                                                           |
| TakedownCaseLink and DeliveryPurgeRecord | hold link active to released or expired; purge requested to dispatching to verifying to completed, partial, or failed_retryable              | Unique caller shard, case, subject; unique purge subject, version, reason and urgency; one shard cannot release another                                        | Lost command is repaired by outbox reconciliation; urgent partial remains incident/open; bytes survive legal hold, evidence, retention, or uncertain scope                                               |
| ScanJob                                  | queued to leased to completed, failed_retryable, or dead_lettered; failed_retryable back to leased                                           | One live job per object and checksum; leaseId is the CAS token; at most four attempts                                                                          | Expired lease re-queues; fourth failure dead-letters and quarantines the asset; DLQ replay re-queues idempotently; an infected verdict rejects the asset and an unavailable verdict never marks it clean |

Shared BE00 JobStatus remains queued, running, succeeded, failed, or cancelled. The media state failed_retryable or failed_terminal belongs to RenditionRecord and is not added to JobStatus. Every worker has a lease, attempt count, expected version, correlation ID, causation ID, and DLQ path.

## Event Schemas

All events use the BE00 identifier-only envelope. The payload below is the exact domain payload; envelope event ID, schema version, occurred time, producer, correlation, causation, and aggregate version are supplied by BE00.

| Event type                   | Exact payload                       | Producer and consumer rule                                                                                                                                                                       |
| ---------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| delivery.asset.changed.v1    | { assetId }                         | DLV-04B-01 admission and verifier, DLV-04B-02 claimed-right commit, and DLV-04B-04 non-revoke lifecycle commit emit after transaction; 04c and rendition workers refetch current authorized rows |
| delivery.rendition.ready.v1  | { renditionId, assetId }            | Rendition worker emits only after private output checksum and state ready commit; waiting references and 04c projection workers refetch exact IDs                                                |
| delivery.asset.revoked.v1    | { assetId, purgeId }                | DLV-04B-04 emits after revoke, hold, or takedown eligibility plus urgent purge intent commit; delivery consumers remove unsafe output before any last-known-good path                            |
| delivery.menu.activated.v1   | { menuId, menuVersionId }           | Owned and emitted by 04a; 04b consumes no menu state and does not emit this event                                                                                                                |
| delivery.route.changed.v1    | { routeId, routeManifestVersionId } | Owned and emitted by 04a; 04b consumes no route state and does not emit this event                                                                                                               |
| delivery.projection.ready.v1 | { publicationId, projectionId }     | Owned and emitted by 04c; 04b provides media readiness through delivery.asset.changed.v1 and delivery.rendition.ready.v1                                                                         |
| delivery.purge.completed.v1  | { purgeId, subjectType, subjectId } | Owned and emitted by 04c after provider verification; 04b reads no delivery cache and does not emit this event                                                                                   |

Events are written only after the matching transaction commits its canonical row and BE00 outbox record. Unknown event versions go to DLQ. Duplicate or out-of-order events trigger a current-row reread and CAS, never a backwards state transition.

### Cross-shard direction

- BE00 supplies upload intent, object verification admission, JobStatus, error envelope, idempotency, audit, outbox, queue retry, and request context. 04b references those contracts and does not duplicate their endpoints or tables.
- Shard 01 supplies server-derived platform_private.party IDs, owner authority and capability snapshots. Client party IDs and role claims are never trusted as authority.
- Shard 03 supplies schema, entry, content, publication and exact version-set facts. DLV-04B-04 treats a 03-owned source reference as a typed reverse reference and never writes a 03 publication row.
- 04c consumes 04b asset and rendition events and decides public or authenticated projection, signed delivery, cache, and degraded output. 04b never reads a public cache or serves an object.
- Shards 06, 10, and 20 own dispute, safety, rights, and licence adjudication. Under DEC-098 they call ApplyDeliveryHold, ReleaseDeliveryHold, or RevokeDeliveryEligibility with their own caller shard and case_id; 04b records the asserted consequence and never reads their stores or adjudicates.
- Shard 05 may provide bounded media policy definitions through its registered configuration contract, but it cannot weaken privacy, rights, scanner, retention, accessibility, or takedown floors.
- Scanner, transform, Storage, and purge providers are replaceable adapters. Provider success is evidence for the local state machine, not a replacement source of truth.

## Error Handling

### Boundary mapping

- 400 INVALID_REQUEST: malformed path, header, JSON, idempotency key, or If-Match grammar.
- 401 UNAUTHENTICATED: absent, expired, revoked, or invalid session, service signature, or step-up proof.
- 403 FORBIDDEN: resource is readable under the caller's current context but the required capability, action scope, MFA, or delegated rights is absent.
- 404 NOT_FOUND: malformed values have already passed shape validation but the resource or scope is concealed to prevent owner, claimant, object, evidence, or reference enumeration.
- 409 CONFLICT: stale version, idempotency mismatch, duplicate claim or profile, illegal state transition, quota reservation race, active reference, hold, retention fence, or provider ambiguity requiring reconciliation.
- 415 UNSUPPORTED_MEDIA_TYPE: non-JSON API body or transfer type outside the BE00 route guard.
- 422 VALIDATION_FAILED: strict field, code registry, territory, time, MIME, profile, rights, accessibility, or action rule failure. 422 PLAN_LIMIT_EXCEEDED: the declared byte size is within the contract ceiling but above the active plan-limit profile.
- 429 RATE_LIMITED: operation actor or acting-party bucket exceeded; Retry-After and RateLimit headers are returned.
- 502, 503, or 504 DEPENDENCY_UNAVAILABLE: scanner, Storage, RPC, queue, or purge provider cannot satisfy its typed contract within the deadline; no unsafe success is fabricated.
- 500 INTERNAL_ERROR: scrubbed unexpected failure with request ID only; provider-native diagnostic sinks receive the protected diagnostic out of band.

### Operation error coverage

| Operation  | Validation and transport                                                                       | Authorization and existence                                                                                              | Conflict and state                                                                                                                                                                     | Dependency and recovery                                                                                                                 | Safe client action                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| DLV-04B-01 | Invalid JSON, MIME, size, filename, code, UUID, or idempotency header maps to 400, 415, or 422 | Session, owner scope, and media_contributor are checked after shape; conceal target as 404 and known scope denial as 403 | Quota, live object, key mismatch, or versioned owner race maps to 409; a declared size above the active plan-limit profile maps to 422 PLAN_LIMIT_EXCEEDED; no row remains on rollback | BE00 intent or verifier outage maps to dependency unavailable; retry by exact key or inspect status                                     | Correct fields or capability; replay exact key; never reuse a signed URL after expiry                |
| DLV-04B-02 | Invalid territory, use, term, evidence reference, or state field maps to 400 or 422            | Asset and delegation scope produce 404 or 403; claimant is not auto-discovered from text                                 | Duplicate claim, stale If-Match, and forbidden self-state map to 409; existing rights unchanged                                                                                        | Evidence projection or RPC outage rolls back the claim and outbox                                                                       | Refetch asset version, submit a claimed row, or route authority dispute to owning shard              |
| DLV-04B-03 | Invalid profile, locale, accessibility version, use, or header maps to 400 or 422              | Asset/profile scope produces 404 or 403                                                                                  | Not-ready, missing rights or accessibility, profile withdrawal, stale version, and idempotency mismatch map to 409                                                                     | Queue, object, scanner, or transform failure leaves queued, failed_retryable, failed_terminal, or blocked reference; DLQ replay is safe | Use registered profile and current metadata; poll JobStatus; approved fallback is server policy only |
| DLV-04B-04 | Invalid action, reason, case, reference decision, or header maps to 400 or 422                 | Action-specific role, case scope, MFA, and concealed reverse references map to 403 or 404                                | Hold, legal retention, evidence duty, active reference, stale version, and duplicate action map to 409                                                                                 | Purge provider ambiguity returns 202/open incident or dependency unavailable; reconciliation proves every scope                         | Keep bytes retained, inspect lifecycle status, and resolve the assigned case or purge incident       |
| DLV-04B-05 | Invalid body or media type maps to 400 or 415                                                  | A bad credential is 401 and a principal or scannerId mismatch is 403; no resource is looked up                           | No state conflict: an empty queue is a normal 200                                                                                                                                      | Verifier or RPC outage maps to dependency unavailable; the scanner retries with its own backoff                                         | Lease again after backoff; never reuse a read URL after the lease expires                            |
| DLV-04B-06 | Invalid verdict, digest rule, version string, or time maps to 400 or 422                       | Unknown or non-leased scanId is 404; a non-holder or missing scope is 403                                                | Stale lease, checksum mismatch, or a different body for a completed job maps to 409                                                                                                    | RPC outage maps to dependency unavailable; the job stays leased until expiry and then re-queues                                         | Re-post the identical verdict by its key, or re-lease after expiry                                   |

No provider response is copied into an ApiError message. details contains only bounded field paths, safe recovery code, retryability, and versions that the caller is authorized to see.

## Observability

- Every route, RPC, worker, event, and provider attempt carries requestId, operationId, correlationId, causationId, actor class, acting-party class, asset or rendition hash, expected version, outcome, and retry count. Raw object key, signed URL, filename, claimant, evidence, case, and body are scrubbed.
- Metrics are generated per operation ID: request count, duration, status, validation denial, 403, concealed 404, idempotency replay or mismatch, CAS conflict, rate rejection, RPC timing, and no-store response.
- DLV-04B-01 metrics include quota decisions, intent age, upload expiry, verifier lag, MIME mismatch, checksum mismatch, scan verdict, scan job queue age, lease expiry count, scan DLQ depth, engine and signature-database version, plan-limit refusals, quarantine age, duplicate suggestion count, and orphan cleanup.
- DLV-04B-02 metrics include claim state, use and territory validation, consent reference resolution, evidence dependency latency, and claimed-to-ineligible transition count. Claimant identity is never a metric label.
- DLV-04B-03 metrics include queue age, lease age, profile rejection, transform duration, output bytes, source and output checksum mismatch, retryable and terminal failure, DLQ depth, and ready event lag.
- DLV-04B-04 metrics include reverse-reference count, switched and blocked references, hold count, purge scope count, urgent purge age, provider response, partial scope count, and reconciliation age.
- SLOs inherit BE00: Tier 2 mutation p95 under 1,200 ms, protected RPC p95 under 300 ms where synchronous, acceptance p95 under 500 ms where queued, and DLQ under 0.1 percent. Scanner and transform long work are measured by queue and job lag, not hidden inside a request.
- Alerts fire for quarantined assets beyond policy, scan outage, repeated profile failures, DLQ growth, stale rendition leases, urgent purge partial or overdue evidence, unexpected public-object state, event lag, and any RLS or grant violation. Structured diagnostics record unexpected errors with allowlisted fields only; source maps remain private build artifacts.

## Testing Strategy

### Contract and route tests

| Operation  | Required tests                                                                                                                                                                                                                                                                                                                                                                        | Pass oracle                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| DLV-04B-01 | Parse every AssetIngestRequest field; reject unknown keys, control filename, unsupported MIME, size over 5 GiB, size over the active plan-limit profile (exactly 52,428,800 bytes accepted and 52,428,801 refused with PLAN_LIMIT_EXCEEDED under the Phase 2 hosted profile), duplicate uses, bad locale, malformed UUID, invalid key, and non-JSON; verify 201 resource and Location | Strict schema accepts only bounded fields; response is pending_upload with one object and one 15-minute intent; failure body is exact ApiError |
| DLV-04B-02 | Parse every rights and consent field; test WORLDWIDE exclusivity, ISO territories, empty uses, end before start, nullable references, forced claimed state, strong If-Match, and exact ETag                                                                                                                                                                                           | One claimed AssetRight is returned; no client state can enter verified, restricted, disputed, or revoked                                       |
| DLV-04B-03 | Parse profile, use, locale, audience, accessibility and version fields; reject arbitrary operations and withdrawn profile; verify 202 Location and JobStatus link                                                                                                                                                                                                                     | One queued deterministic rendition request is accepted; duplicate input returns the original job and no second output                          |
| DLV-04B-04 | Parse each action and conditional field; require replacement and complete decisions for replace, case for protected actions, and exact reason and time; verify 200 versus 202                                                                                                                                                                                                         | Action-specific resource is returned; a blocked erase or partial purge is not reported as completed                                            |
| DLV-04B-05 | Parse the lease request and response; reject unknown keys and a scannerId that differs from the principal; verify an empty queue returns zero jobs and writes nothing                                                                                                                                                                                                                 | One leased job with identifiers and a single-use read URL; repeated lease by the holder returns the same leaseId                               |
| DLV-04B-06 | Parse every verdict field; require findingsDigest only for infected; reject a stale or foreign leaseId and a checksum that differs from the asset; treat a `clean` verdict whose `signatureDbBuiltAt` is more than 24 hours before receipt (or later than receipt) as `unavailable`                                                                                                   | State and asset CAS follow the Asset effect rule; an identical replay returns the first result and a different body is 409                     |

### Authorization, persistence, and concurrency tests

| Operation  | Required tests                                                                                                                                                            | Pass oracle                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| DLV-04B-01 | Anonymous, wrong user, wrong party, expired context, owner scope, media_contributor, operator without target capability, quota race, RLS and object FK                    | Concealed target is 404, known scope denial is 403, no direct table write succeeds, and one reservation wins          |
| DLV-04B-02 | Owner, delegated rights scope, curator read, wrong claimant, foreign evidence ref, self-asserted terminal state, duplicate claim, concurrent If-Match                     | Only claimed row commits; existing rows and eligibility are unchanged on failure; RLS cannot enumerate foreign claims |
| DLV-04B-03 | Curator and owner contributor profile scope, not-ready asset, quarantined asset, missing a11y, expired right, profile withdrawal, duplicate transform, stale worker lease | No private output before all gates; one CAS winner; stale worker cannot move a newer row                              |
| DLV-04B-04 | Curator replace/archive, safety operator MFA, owner scope, foreign case, complete reverse set, two simultaneous actions, hold and retention fences                        | Stable lock order yields one winner; per-reference decisions persist; one caller cannot release another hold          |

### Security, performance, and recovery tests

| Operation  | Required tests                                                                                                                                                                                                                                                                                                                                                                                                                  | Pass oracle                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DLV-04B-01 | Polyglot and magic-byte mismatch, decompression bomb, oversized object, scanner unavailable, infected scan, duplicate tenant isolation, signed intent expiry, queue retry and DLQ                                                                                                                                                                                                                                               | No rendition or public object on unsafe input; duplicate response leaks no foreign fact; retry and reconciliation are bounded                                 |
| DLV-04B-02 | Evidence projection timeout, rights expiry, empty territory, WORLDWIDE mixing, event duplicate or reorder, audit/outbox rollback                                                                                                                                                                                                                                                                                                | Failure is fail-closed with no partial claim; current right state and event consumers converge                                                                |
| DLV-04B-03 | Transform timeout, provider circuit open, output reinspection mismatch, worker crash, object write ambiguity, source revocation during transform, DLQ replay                                                                                                                                                                                                                                                                    | Output is private and immutable; failed state and reference block are truthful; replay is idempotent                                                          |
| DLV-04B-04 | Purge timeout, partial provider result, command replay, lost command, two caller shards, legal hold, backup duty, urgent takedown during outage                                                                                                                                                                                                                                                                                 | Delivery becomes ineligible before provider work; partial stays open; uncertainty never releases bytes                                                        |
| DLV-04B-05 | Unregistered, wrong-scope, and wrong-scannerId principals; two scanners racing for one job; lease expiry re-queue; scanner host down with a queued job                                                                                                                                                                                                                                                                          | Principal failures are 401 or 403 with no resource lookup; one lease wins; queued jobs keep the asset inspecting and never produce a ready asset              |
| DLV-04B-06 | EICAR sandbox file yielding infected; clean verdict with a wrong checksum; clean verdict with `signatureDbBuiltAt` at 24 hours (accepted) and one millisecond past 24 hours or future-dated (recorded `unavailable`, asset quarantined, retried) and an infected verdict with stale signatures (still `infected`); unavailable verdict through three retries to DLQ and replay; verdict after lease expiry; two verdicts racing | Infected rejects the asset; mismatch, unavailable, and DLQ quarantine and never mark clean; replay is idempotent; the late and losing verdicts change nothing |

### Accessibility handoff tests

| Operation  | Backend accessibility assertion                                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DLV-04B-01 | Upload and scan status exposes determinate or unknown progress, quarantine reason is actionable but safe, and media library clients receive an equivalent list or table representation |
| DLV-04B-02 | Alt, caption, transcript, decorative, locale, and evidence controls expose stable JSON Pointer errors and do not treat empty alt as an accidental bypass                               |
| DLV-04B-03 | Rendition progress, retryability, failure, fallback policy, and required accessibility metadata are explicit for keyboard and assistive-technology status announcements                |
| DLV-04B-04 | Replacement, blocked, held, revoked, and unavailable states are truthful status content; no empty media slot implies that protected content never existed                              |

## Deepening Passes

| Pass                  | Evidence applied                                                                                                                                                                                                                                      | Result |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Micro field pass      | Every DLV-04B request has strict fields, bounds, conditional refinement, header binding, success schema, error mapping, and safe recovery. Every persistence field has SQL type, nullability, constraint, FK or registry rationale, index, and grant. | PASS   |
| Micro security pass   | MIME and magic-byte checks, private object lineage, duplicate isolation, signed URL binding, no public pending bytes, CSRF, CORS, rate classes, RLS, MFA, and case scope are explicit.                                                                | PASS   |
| Micro failure pass    | Scanner outage, transform failure, provider ambiguity, worker lease loss, outbox retry, purge partial, retention fence, command replay, and lost command each have a state and recovery outcome.                                                      | PASS   |
| Macro flow pass       | Ingest to private verification to claimed right and accessibility to deterministic rendition to per-reference use to replacement or urgent revoke forms one versioned, auditable flow with no cross-shard adjudication read.                          | PASS   |
| Macro dependency pass | BE00 owns transfer, object, job, idempotency, audit, outbox, error, and queue contracts; 03 owns source versions; 04c owns public delivery; 06, 10, and 20 own adjudication.                                                                          | PASS   |
| Two-implementer pass  | The route registry, exact Zod schemas, state transitions, lock order, 403 versus 404 rule, event payloads, retries, and table grants lead independent implementers to the same outcomes.                                                              | PASS   |

## Ambiguity Gate

| Gate                        | PASS evidence                                                                                                                                                                                                                                                                                | Result |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Micro ambiguity gate        | DLV-04B-01, DLV-04B-02, DLV-04B-03, and DLV-04B-04 each have one route, exact request and success resource, exact BE00 ApiError, actor and owner scope, 403 versus 404, idempotency, If-Match rule, CORS, rate, timeout, persistence, errors, metrics, and tests.                            | PASS   |
| Macro ambiguity gate        | Private ingest, BE00 verification, claimed rights, accessibility, deterministic rendition, reverse references, per-reference replacement, hold or revoke, urgent purge, reconciliation, and 04c handoff have one owner and one direction. No route duplicates BE00 or another 04b operation. | PASS   |
| External seam gate          | Upload intent, scanner, transform/object, and purge adapters name exact request and response, timeout, retry count and backoff, circuit threshold, ambiguous-result recovery, and no-raw-payload rule.                                                                                       | PASS   |
| Schema and table-shape gate | Eight IA model names are represented; each table row includes typed fields, nullability, constraints, FK or registry rationale, indexes, RLS, and grants; every Markdown table data row matches its header width.                                                                            | PASS   |

## Open Questions

None.

## Changelog

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Workflow                | Sections affected                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| 2026-08-28 | Classified IA Shard 04 media boundary into four bounded backend operations and reconciled 04a and 04c ownership.                                                                                                                                                                                                                                                                                                                                                                                                       | /write-be-spec-classify | Split Group, Classification, Source Map, Endpoint Reconciliation               |
| 2026-08-28 | Authored governed media, rights, accessibility, rendition, reference, takedown, purge, security, persistence, and recovery contracts.                                                                                                                                                                                                                                                                                                                                                                                  | /write-be-spec-write    | All sections                                                                   |
| 2026-10-02 | DEC-116: added the self-operated ClamAV scanner consumer contract (DLV-04B-05, DLV-04B-06, cms_scan_jobs), WASM image rendition bounds in Workers, and the recorded plan-limit profile (cms_plan_limit_profiles, 50 MiB Phase 2 hosted cap, typed PLAN_LIMIT_EXCEEDED refusal, 5 GiB contract ceiling unchanged)                                                                                                                                                                                                       | /propagate-decision     | Classification, API, Contracts, Database, Middleware, Data Flow, Errors, Tests |
| 2026-10-02 | G9: this file is the single definition of the DeliveryPurgeRecord table (subject types and scopes widened to cover 04c needs; scope_hash added to the uniqueness key); 04c consumes it                                                                                                                                                                                                                                                                                                                                 | /propagate-decision     | Database, Classification                                                       |
| 2026-10-02 | A3 follow-ups: ClamAV signature freshness gate (a `clean` verdict from signatures more than 24 hours old, or future-dated, is recorded `unavailable`, the asset stays quarantined and the job is retried; evidence still recorded; `infected` never downgraded); default image profile `max_decoded_pixels` = 50,000,000 with the DLV-04B-03 pre-check as 422 `MEDIA_DECODE_LIMIT`; `cms.media_contributor` and `cms.media_curator` named as the grantable capabilities behind `media_contributor` and `media_curator` | /propagate-decision     | Internal scanner operations, Security, Data, Seams, Testing                    |
| 2026-10-02 | A3 follow-up: `cms.media_contributor` and `cms.media_curator` declared grantable through BE03a CMS-03A-15 (scopes still checked by each operation)                                                                                                                                                                                                                                                                                                                                                                     | /propagate-decision     | Middleware & Policies                                                          |

## Dependency References

- ../ia/00-infrastructure.md — Shard 00 cross-cutting platform foundation
- ../ia/01-identity-authority.md — Shard 01 identity authority and party governance
- ../ia/03-cms-content-modeling.md — Shard 03 CMS content modeling and authoring
- ../ia/04-cms-delivery-media.md — Shard 04 source interactions, models, contracts, events, and edge cases
- ../ia/deep-dives/04-cms-delivery-media.md — Shard 04 media and delivery algorithms
- 00-infrastructure.md — BE00 error, upload, idempotency, queue, RLS, audit, and observability inheritance
- 03b-editorial-workflow-publication.md — publication version and event handoff
- 01b-party-identity-aliases.md — canonical platform party foreign-key boundary
- 04c-public-delivery-cache.md — consumer of the single DeliveryPurgeRecord table through the BE00 purge seam
- 05a-settings-flags-runtime.md — S07 service-credential pattern authenticating the scanner principal


<!-- spec-graph: auto-generated -->
## Related Specs

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]

### References
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
