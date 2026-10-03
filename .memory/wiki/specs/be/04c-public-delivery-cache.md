# Public Delivery & Cache — Backend Specification

**Status:** Complete
**IA source:** [Shard 04 — CMS navigation, media and delivery](../ia/04-cms-delivery-media.md)
**Deep-dive source:** [Deep Dive 04 — CMS navigation, media and delivery](../ia/deep-dives/04-cms-delivery-media.md)
**Backend foundation:** [BE00 — Cross-cutting Platform Foundation](00-infrastructure.md)

## Split Group

This split owns published projection selection, preview isolation, publication convergence, truthful degraded delivery/recovery, and the protected delivery-hold/eligibility-revocation consequences. It contains DLV-09–DLV-14. Navigation/routes/discovery authoring (DLV-01–DLV-04) is owned by 04a; governed assets/rights/renditions (DLV-05–DLV-08) are owned by 04b; cross-cutting transport and provider primitives remain in BE00.

## Classification

- **Type:** public read/projection and protected delivery-consequence split.
- **Boundary:** `PublicationProjection`, `ProjectionConsumerState`, the deep-dive support projections `active_delivery_pointer` and `preview_session`, and their public/cache lifecycle. `DeliveryPurgeRecord` is defined once, in 04b (`cms_delivery_purge_records`), and created by the Slice 14 migration; this split consumes it through the BE00 purge seam and defines no table for it (G9). It never adjudicates publication, rights, safety, or licensing truth.
- **Expected operations:** six operations, one-to-one with IA interactions DLV-09, DLV-10, DLV-11, DLV-12, DLV-13, and DLV-14.
- **Approval:** delegated cross-range assist; 04a and 04b files, BE00 routes, and shared trackers are not edited.
- **Decision lock:** public delivery is versioned and authorization-aware; preview is no-store/noindex; last-known-good is served only under staleness and revocation policy; owning shards call protected hold/revocation commands with their own case references.

## Referenced Material Inventory

| Source file                                                 | Section / lines                                                                        | Material used in this specification                                                                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`            | Interactions, lines 47–65                                                              | DLV-09 query, DLV-10 preview, DLV-11 convergence, DLV-12 degraded recovery, DLV-13 hold, and DLV-14 eligibility revocation.                  |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`            | Delivery and Cache Contracts, lines 101–109                                            | Projection shape, public/private cache TTL, readiness, and degraded delivery safety.                                                         |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`            | Data Models, lines 111–131                                                             | `PublicationProjection`, `ProjectionConsumerState`, `DeliveryPurgeRecord`, and canonical delivery relationships.                             |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`            | Access Control, lines 154–178                                                          | Public visitor, preview user, delivery principal, publisher, and Shard 06/10/20 command principals.                                          |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`            | Accessibility, lines 180–188                                                           | Truthful degraded/unavailable/takedown states and non-empty status behavior.                                                                 |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`            | Event Schemas, lines 190–202                                                           | `delivery.projection.ready.v1` and `delivery.purge.completed.v1`; upstream menu/route/media event inputs.                                    |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`            | Edge Cases, lines 204–229                                                              | Preview forwarding, canonical publish/purge failure, control-plane failure, urgent takedown, no-safe-snapshot, and inbound command recovery. |
| `.memory/wiki/specs/ia/04-cms-delivery-media.md`            | Cross-Shard Dependencies, lines 254–258                                                | Shard 03/05 dependencies and downward Shard 06/10/20 protected command direction.                                                            |
| `.memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md` | Publication Delivery, lines 47–54                                                      | `publication_projection`, `projection_consumer_state`, `active_delivery_pointer`, and `preview_session` fields.                              |
| `.memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md` | State Machines, lines 56–65                                                            | Projection and purge transitions and immutable active-pointer behavior.                                                                      |
| `.memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md` | Projection and Cache Algorithm, lines 95–103                                           | Publication event lease, required consumer readiness, versioned cache key, and purge handling.                                               |
| `.memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md` | Signed Delivery, lines 105–110                                                         | Public hashed paths, private signing, audience/version binding, and range/disposition rules.                                                 |
| `.memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md` | Degraded Delivery and Recovery, lines 112–118                                          | Last-known-good eligibility, explicit unavailable response, and consumer-by-consumer rebuild/purge.                                          |
| `.memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md` | Concurrency and Idempotency, lines 120–129                                             | Pointer fencing, purge IDs, inbound command dedupe, and reconciliation sweep.                                                                |
| `.memory/wiki/specs/ia/deep-dives/04-cms-delivery-media.md` | Cross-Shard Contracts, lines 144–155                                                   | Shard 03/05 projection contracts and protected Shard 06/10/20 commands.                                                                      |
| `.memory/wiki/specs/be/00-infrastructure.md`                | Request/Response Contracts, lines 112–201; Deterministic Protocol Rules, lines 330–353 | Zod 4 wire conventions, global `ApiError`, ETag/cache, idempotency, and limits.                                                              |
| `.memory/wiki/specs/be/00-infrastructure.md`                | Middleware & Policies, lines 253–298; Event and Consumer Contracts, lines 355–416      | Hono middleware, CORS, RLS, outbox, and provider/consumer recovery.                                                                          |
| `.memory/wiki/specs/2026-08-02-architecture-design.md`      | API Design, lines 359–376; Security Model, lines 709–790                               | Cloudflare edge/API, authorization, browser, cache, and abuse boundaries.                                                                    |

## IA Source Map

| BE section                              | IA source / trace                                                                                                                                        |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public query and preview routes         | Shard 04 IA `§ Interactions`, lines 59–60; `§ Delivery and Cache`, lines 101–109                                                                         |
| Convergence and recovery workers        | Shard 04 IA `§ Interactions`, lines 61–62; deep dive `§ Projection and Cache Algorithm`, lines 95–103; `§ Degraded Delivery and Recovery`, lines 112–118 |
| Protected hold/revocation commands      | Shard 04 IA `§ Interactions`, lines 63–64; `§ Contracts`, lines 88–100; deep dive `§ Cross-Shard Contracts`, lines 144–155                               |
| Projection/purge persistence            | Shard 04 IA `§ Data Models`, lines 127–129; deep dive `§ Publication Delivery`, lines 47–54                                                              |
| State, concurrency, signing, and safety | Deep Dive 04 `§ State Machines`, lines 56–65; `§ Signed Delivery`, lines 105–110; `§ Concurrency and Idempotency`, lines 120–129                         |
| Events and cache consumers              | Shard 04 IA `§ Event Schemas`, lines 190–202; `§ Edge Cases`, lines 204–229                                                                              |
| Shared API behavior                     | BE00 `§ Request/Response Contracts`, lines 112–201; `§ Deterministic Protocol Rules`, lines 330–353; `§ Event and Consumer Contracts`, lines 355–416     |

## Endpoint Completeness Reconciliation

| IA interaction                     | BE operation ID | Method and path                                          | Result                                                                                                                                               |
| ---------------------------------- | --------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| DLV-09 Query published content     | DLV-DEL-API-01  | `GET /api/v1/content/{route}`                            | Reconciled: selects active route/locale/audience projection, hydrates only currently authorized bindings, returns ETag or safe unavailable/redirect. |
| DLV-10 Open preview                | DLV-DEL-API-02  | `GET /api/v1/preview/{route}`                            | Reconciled: reauthenticates exact Shard 03 token scope and returns no-store/noindex preview or existence-safe denial.                                |
| DLV-11 Converge publication        | DLV-DEL-API-03  | `POST /api/v1/internal/delivery/publications/converge`   | Reconciled: leases exact publication/version, builds required consumer set, and switches the active pointer only when ready.                         |
| DLV-12 Serve degraded/recover      | DLV-DEL-API-04  | `POST /api/v1/internal/delivery/recover`                 | Reconciled: validates last-known-good staleness/authorization, serves through the read path, and rebuilds or purges consumer versions.               |
| DLV-13 Apply/release delivery hold | DLV-DEL-API-05  | `POST /api/v1/internal/delivery/holds`                   | Reconciled: accepts only Shard 06/10/20 caller-owned case scope; apply queues urgent purge and release cannot clear another shard’s hold.            |
| DLV-14 Revoke delivery eligibility | DLV-DEL-API-06  | `POST /api/v1/internal/delivery/eligibility-revocations` | Reconciled: records the owning shard’s `AssetRight` consequence and queues delivery purge without adjudicating rights.                               |

No operation is inherited without an operation ID. BE00 supplies transport, cache primitives, error envelope, idempotency, and outbox behavior; it does not add a delivery route.

## API Endpoints

### Route Registry

| Operation ID   | Method | Path                                                | IA interaction | Auth / ownership                                                                                                                                                                         | Success                                                                                                                             |
| -------------- | ------ | --------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| DLV-DEL-API-01 | GET    | `/api/v1/content/{route}`                           | DLV-09         | Public visitor or authenticated audience; route projection and each binding authorize independently                                                                                      | `200` one content/redirect/unavailable projection or `304`; pagination N/A; render payload bounded to 128 keys/256 KiB              |
| DLV-DEL-API-02 | GET    | `/api/v1/preview/{route}`                           | DLV-10         | Preview user with bound Shard 03 token/context/capability/version set                                                                                                                    | `200` one no-store preview or safe denial; pagination N/A; version set bounded to 64 entries and render payload to 128 keys/256 KiB |
| DLV-DEL-API-03 | POST   | `/api/v1/internal/delivery/publications/converge`   | DLV-11         | Signed delivery principal holding exact publication/version lease                                                                                                                        | `200` projection consumer status                                                                                                    |
| DLV-DEL-API-04 | POST   | `/api/v1/internal/delivery/recover`                 | DLV-12         | Signed delivery/recovery worker; public caller never selects a stale snapshot                                                                                                            | `200` recovery status                                                                                                               |
| DLV-DEL-API-05 | POST   | `/api/v1/internal/delivery/holds`                   | DLV-13         | Registered Phase 2 command principal `delivery.command.shard06`, `delivery.command.shard10`, or `delivery.command.shard20` presenting a signed short-lived principal assertion (step-up) | `200` hold/case-link status                                                                                                         |
| DLV-DEL-API-06 | POST   | `/api/v1/internal/delivery/eligibility-revocations` | DLV-14         | Registered Phase 2 command principal `delivery.command.shard06`, `delivery.command.shard10`, or `delivery.command.shard20` presenting a signed short-lived principal assertion (step-up) | `200` eligibility/purge status                                                                                                      |

### Transport and external seams

Public GETs use HTTPS, `Accept-Language`, `If-None-Match`, safe `Cache-Control`, `X-Request-Id`, and no credential-bearing wildcard CORS. Internal commands use mTLS/service authentication, `X-Request-Id`, `Idempotency-Key`, `If-Match`, and never accept browser-originated authority headers.

| Seam                                   | Exact request                                                                                                               | Exact response                                                                                               |                                                                                                      Timeout | Retry / backoff                                                           | Circuit breaker and recovery                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -----------------------------------------------------------------------------------------------------------: | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Shard 03 publication projection input  | `{ publicationId: uuid, publicationVersion: bigint, schemaVersion: string, eventId: uuid }`                                 | `{ accepted: boolean, leaseId: uuid, sourceVersion: bigint }`                                                |                                                                                                       800 ms | 2 retries at 100 ms, 250 ms; event ID is idempotent                       | Open 45 s; event stays queued and prior pointer remains active.               |
| Shard 03 preview-token verifier        | `{ tokenHash: string, actorPersonId: uuid, actingContextVersion: string, route: string, locale: string, audience: string }` | `{ valid: boolean, userId: uuid, exactVersionSet: object, expiresAt: RFC3339, revoked: boolean }`            |                                                                                                       500 ms | 2 retries at 75 ms, 150 ms; read-safe                                     | Open 30 s; unknown verifier result denies preview and emits no draft details. |
| Shard 05 delivery policy               | `{ routeClass: string, locale: string, audience: string, requestedVersion: bigint }`                                        | `{ maxStalenessSeconds: int, publicMaxAgeSeconds: int, swrSeconds: int, noStore: boolean, version: bigint }` |                                                                                                       400 ms | 2 retries at 75 ms, 150 ms                                                | Open 30 s; fail closed to unavailable for unsafe policy state.                |
| BE00 CDN/cache purge                   | `{ purgeId: uuid, scope: string, routeTags: string[], version: bigint, urgent: boolean }`                                   | `{ purgeId: uuid, providerAttempts: int, state: 'completed'                                                  |                                                                                                    'partial' | 'pending', evidenceHash: string }`                                        | 2,000 ms                                                                      | 3 retries at 250 ms, 750 ms, 1,500 ms; same purge ID | Open 60 s; partial stays incident/open, version-addressed routes remain correct, and recovery re-verifies. |
| BE00 signed delivery verifier          | `{ subjectId: uuid, objectVersion: bigint, audience: string, actorPartyId: uuid                                             | null, expiresAt: RFC3339, range: string                                                                      |                                                                                                      null }` | `{ allowed: boolean, signedUrl: string                                    | null, expiresAt: RFC3339, disposition: 'inline'                               | 'attachment' }`                                      | 500 ms                                                                                                     | 2 retries at 75 ms, 150 ms; read-safe | Open 30 s; denial is fail-closed and no private object URL is emitted. |
| Shard 06/10/20 command acknowledgement | `{ callerShard: '06'                                                                                                        | '10'                                                                                                         | '20', caseId: uuid, subjectType: string, subjectId: uuid, expectedVersion: bigint, idempotencyKey: string }` | `{ accepted: boolean, state: string, caseLinkId: uuid, version: bigint }` | 800 ms                                                                        | 2 retries at 150 ms, 400 ms; caller case/key bound   | Open 45 s; lost commands are repaired by reconciliation and uncertainty keeps the subject held.            |

## Request/Response Contracts

All schemas below are Zod 4 schemas. Every failure uses the BE00/global error envelope exactly: `ApiError { code, message, requestId, details }`.

### Shared and operation schemas

```ts
const ReadContext = z
  .object({
    request_id: z.string().uuid(),
    actor_person_id: z.string().uuid().nullable(),
    acting_party_id: z.string().uuid().nullable(),
    acting_context_version: z.string().min(1).max(128).nullable(),
    locale: z.string().regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})?$/),
    audience: z.string().regex(/^[a-z0-9_-]{1,48}$/),
  })
  .strict();
const PrincipalCommandContext = z
  .object({
    idempotency_key: z.string().regex(/^[A-Za-z0-9._:-]{16,128}$/),
    request_id: z.string().uuid(),
    expected_version: z.bigint().positive().optional(),
  })
  .strict(); // DLV-DEL-API-03 through 06: the calling principal is resolved from the credential (and, for 05/06, the assertion header), never from the body; no person or acting-context field exists
const ApiErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    requestId: z.string().uuid(),
    details: z.record(z.string(), z.json()),
  })
  .strict(); // ApiError { code, message, requestId, details }
const RouteParam = z.string().regex(/^[a-z0-9][a-z0-9\/_-]{0,511}$/);
const BoundedRenderPayload = z
  .record(z.string().regex(/^[A-Za-z0-9_.-]{1,128}$/), z.json())
  .superRefine((v, ctx) => {
    if (Object.keys(v).length > 128)
      ctx.addIssue({
        code: 'custom',
        message: 'render payload has too many keys',
      });
    if (JSON.stringify(v).length > 262144)
      ctx.addIssue({
        code: 'custom',
        message: 'render payload exceeds 256 KiB',
      });
  });
const BoundedVersionSet = z
  .record(z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/), z.bigint())
  .superRefine((v, ctx) => {
    if (Object.keys(v).length > 64)
      ctx.addIssue({
        code: 'custom',
        message: 'version set has too many entries',
      });
  });

const PublishedContentRequest = ReadContext.extend({
  route: RouteParam,
  type: z
    .string()
    .regex(/^[a-z0-9_-]{1,64}$/)
    .optional(),
  if_none_match: z.string().max(128).optional(),
}).strict();
const PublishedContentSuccess = z
  .object({
    status: z.enum(['ok', 'redirect', 'unavailable']),
    publication_id: z.string().uuid().nullable(),
    projection_id: z.string().uuid().nullable(),
    route: RouteParam,
    version: z.bigint().positive().nullable(),
    etag: z
      .string()
      .regex(/^"[^"\r\n]{1,128}"$/)
      .nullable(),
    render_payload: BoundedRenderPayload.nullable(),
    redirect_location: z
      .string()
      .regex(/^\/[^\u0000-\u001f]{0,2047}$/)
      .nullable(),
    request_id: z.string().uuid(),
  })
  .strict();

const PreviewRequest = ReadContext.extend({
  route: RouteParam,
  preview_token: z.string().min(32).max(4096),
  requested_version: z.bigint().positive().optional(),
}).strict();
const PreviewSuccess = z
  .object({
    status: z.literal('preview'),
    projection_id: z.string().uuid(),
    publication_id: z.string().uuid(),
    version_set: BoundedVersionSet,
    render_payload: BoundedRenderPayload,
    cache_control: z.literal('no-store'),
    robots: z.literal('noindex'),
    request_id: z.string().uuid(),
  })
  .strict();

const ConvergeRequest = PrincipalCommandContext.extend({
  publication_id: z.string().uuid(),
  publication_version: z.bigint().positive(),
  source_event_id: z.string().uuid(),
  lease_id: z.string().uuid(),
  required_consumers: z
    .array(
      z.enum([
        'route',
        'render',
        'menu',
        'media',
        'search',
        'sitemap',
        'cache',
        'social',
      ]),
    )
    .min(1)
    .max(8),
  expected_pointer_version: z.bigint().positive(),
}).strict();
const ConvergeSuccess = z
  .object({
    publication_id: z.string().uuid(),
    projection_id: z.string().uuid(),
    consumer_states: z.record(
      z.string(),
      z.enum([
        'building',
        'ready',
        'blocked',
        'failed_retryable',
        'active',
        'superseded',
        'revoked',
      ]),
    ),
    active: z.boolean(),
    pointer_version: z.bigint().positive(),
    event_id: z.string().uuid(),
  })
  .strict();

const RecoverRequest = PrincipalCommandContext.extend({
  route: RouteParam,
  locale: z.string().regex(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})?$/),
  audience: z.string().regex(/^[a-z0-9_-]{1,48}$/),
  publication_id: z.string().uuid(),
  expected_projection_version: z.bigint().positive(),
  reason_code: z.string().regex(/^[a-z0-9_-]{1,64}$/),
}).strict();
const RecoverSuccess = z
  .object({
    publication_id: z.string().uuid(),
    route: RouteParam,
    served_projection_id: z.string().uuid().nullable(),
    served_version: z.bigint().positive().nullable(),
    status: z.enum(['healthy', 'degraded', 'unavailable', 'rebuilding']),
    purge_ids: z.array(z.string().uuid()),
    event_id: z.string().uuid(),
  })
  .strict();

const HoldRequest = PrincipalCommandContext.extend({
  caller_shard: z.enum(['06', '10', '20']),
  case_id: z.string().uuid(),
  action: z.enum(['apply', 'release']),
  subject_type: z.enum(['asset', 'reference', 'right']),
  subject_id: z.string().uuid(),
  reason_code: z.string().regex(/^[a-z0-9_-]{1,64}$/),
  effective_at: z.string().datetime(),
  expected_subject_version: z.bigint().positive(),
}).strict();
const HoldSuccess = z
  .object({
    case_link_id: z.string().uuid(),
    subject_type: z.enum(['asset', 'reference', 'right']),
    subject_id: z.string().uuid(),
    state: z.enum(['held', 'released', 'already_held']),
    purge_id: z.string().uuid().nullable(),
    version: z.bigint().positive(),
    event_id: z.string().uuid(),
  })
  .strict();

const RevocationRequest = PrincipalCommandContext.extend({
  caller_shard: z.enum(['06', '10', '20']),
  case_id: z.string().uuid(),
  asset_right_id: z.string().uuid(),
  target_state: z.enum(['restricted', 'disputed', 'revoked']),
  reason_code: z.string().regex(/^[a-z0-9_-]{1,64}$/),
  effective_at: z.string().datetime(),
  expected_right_version: z.bigint().positive(),
}).strict();
const RevocationSuccess = z
  .object({
    asset_right_id: z.string().uuid(),
    state: z.enum(['restricted', 'disputed', 'revoked']),
    purge_id: z.string().uuid(),
    version: z.bigint().positive(),
    event_id: z.string().uuid(),
  })
  .strict();
const ErrorResponse = ApiErrorSchema;
```

### Operation Contract Matrix

| Operation ID   | Request schema            | Success schema/status                      | Error schema/status                                                                                    |
| -------------- | ------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| DLV-DEL-API-01 | `PublishedContentRequest` | `PublishedContentSuccess` / `200` or `304` | `ErrorResponse` (`ApiError { code, message, requestId, details }`) / `400,404,409,429,503`             |
| DLV-DEL-API-02 | `PreviewRequest`          | `PreviewSuccess` / `200`                   | `ErrorResponse` (`ApiError { code, message, requestId, details }`) / `400,401,403,404,409,429,503`     |
| DLV-DEL-API-03 | `ConvergeRequest`         | `ConvergeSuccess` / `200`                  | `ErrorResponse` (`ApiError { code, message, requestId, details }`) / `400,401,403,404,409,422,429,503` |
| DLV-DEL-API-04 | `RecoverRequest`          | `RecoverSuccess` / `200`                   | `ErrorResponse` (`ApiError { code, message, requestId, details }`) / `400,401,403,404,409,422,429,503` |
| DLV-DEL-API-05 | `HoldRequest`             | `HoldSuccess` / `200`                      | `ErrorResponse` (`ApiError { code, message, requestId, details }`) / `400,401,403,404,409,422,429,503` |
| DLV-DEL-API-06 | `RevocationRequest`       | `RevocationSuccess` / `200`                | `ErrorResponse` (`ApiError { code, message, requestId, details }`) / `400,401,403,404,409,422,429,503` |

### Field Validation Matrix

| Operation      | Required validation and invariant                                                                                                                                                                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DLV-DEL-API-01 | Active projection exists for normalized route/locale/audience and required consumers are ready; only authorized domain bindings hydrate; unknown route redirects or safe-not-founds; revoked/held projections never serve from cache; no fabricated empty/default resource.                                                                                                                 |
| DLV-DEL-API-02 | Shard 03 token is unexpired/unrevoked and exact user/context/capability/version/locale/route/audience matches; delivery may narrow scope only; response is always no-store/noindex and never enters public cache/search/sitemap.                                                                                                                                                            |
| DLV-DEL-API-03 | Publication/version event is exact and lease held; all required route/render/menu/media consumers must be ready before pointer switch; optional search/sitemap/social can lag only when correctness/disclosure is unchanged; stale builder cannot replace newer pointer.                                                                                                                    |
| DLV-DEL-API-04 | Last-known-good projection was active/verified, caller remains authorized, route-class staleness is within protected maximum, and no urgent purge/hold/revocation/privacy block applies; otherwise return explicit unavailable. Recovery compares each consumer’s canonical version and rebuilds/purges.                                                                                    |
| DLV-DEL-API-05 | Caller is the registered command principal of Shard 06, 10, or 20 whose principal-bound shard equals `caller_shard`, presenting a valid principal assertion bound to this command, with own `case_id`; subject scope resolves; apply/release is attributed to caller shard; release cannot clear another shard’s hold; lost/uncertain command remains held.                                 |
| DLV-DEL-API-06 | Caller is the registered command principal of Shard 06, 10, or 20 whose principal-bound shard equals `caller_shard`, presenting a valid principal assertion bound to this command, with own `case_id`; `AssetRight` subject/version resolves; target state is restricted/disputed/revoked; this split records caller assertion and delivery consequence only, never ownership adjudication. |

### Error, authorization, idempotency, rate, and observability matrix

| Operation      | Status/code matrix (all bodies are `ApiError { code, message, requestId, details }`)                                                                                                                                                                               | Authorization and 403/404 rule                                                                                                                                                                                                                                                                                                   | Idempotency / rate / observability                                                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DLV-DEL-API-01 | `400 VALIDATION_FAILED`; `404 CONTENT_NOT_FOUND`; `409 VERSION_CONFLICT`; `429 RATE_LIMITED`; `503 DEPENDENCY_UNAVAILABLE`                                                                                                                                         | Public-safe 404 for unknown/private route; unauthorized bindings are omitted, not exposed as 403                                                                                                                                                                                                                                 | Deterministic route/locale/audience/version cache key makes repeat reads replay-safe; 600 reads/min/IP and 120 reads/min/authenticated party; trace requestId/routeHash/projectionVersion/cacheStatus, never protected binding fields. |
| DLV-DEL-API-02 | `400 VALIDATION_FAILED`; `401 UNAUTHENTICATED`; `403 PREVIEW_DENIED`/`PREVIEW_REVOKED`; `404 PREVIEW_NOT_FOUND`; `409 VERSION_CONFLICT`; `429 RATE_LIMITED`; `503 DEPENDENCY_UNAVAILABLE`                                                                          | 403 only after a valid token identifies a denied capability; 404 for invalid/forwarded token or hidden draft to prevent existence leakage                                                                                                                                                                                        | Token hash + exact scope is replay-safe but never cacheable; 60 requests/min/user; trace token hash/scope hash/decision, never draft IDs or payload.                                                                                   |
| DLV-DEL-API-03 | `400 VALIDATION_FAILED`; `401 UNAUTHENTICATED`; `403 FORBIDDEN`; `404 PUBLICATION_NOT_FOUND`; `409 VERSION_CONFLICT`/`PROJECTION_VERSION_CONFLICT`; `422 PROJECTION_BLOCKED`; `429 RATE_LIMITED`; `503 DEPENDENCY_UNAVAILABLE`                                     | 403 for known lease scope without delivery capability; 404 for publication outside worker scope                                                                                                                                                                                                                                  | 24h key per publication/version/event; 30 convergences/hour/principal; trace consumer states/version/error code and lease ID, not render payload.                                                                                      |
| DLV-DEL-API-04 | `400 VALIDATION_FAILED`; `401 UNAUTHENTICATED`; `403 FORBIDDEN`; `404 PUBLICATION_NOT_FOUND`; `409 VERSION_CONFLICT`/`IDEMPOTENCY_MISMATCH`; `422 STALE_CONTENT`/`UNAVAILABLE_NO_SAFE_SNAPSHOT`/`PURGE_REQUIRED`; `429 RATE_LIMITED`; `503 DEPENDENCY_UNAVAILABLE` | 403 for an untrusted recovery worker; 404 hides a publication outside worker scope                                                                                                                                                                                                                                               | 24h key per publication/route/version/reason; 60 recoveries/hour/principal; trace served version/staleness/rebuild/purge IDs, not content.                                                                                             |
| DLV-DEL-API-05 | `400 VALIDATION_FAILED`; `401 UNAUTHENTICATED`; `403 FORBIDDEN`/`CASE_REFERENCE_INVALID`; `404 SUBJECT_NOT_FOUND`; `409 VERSION_CONFLICT`/`IDEMPOTENCY_MISMATCH`; `422 HOLD_SCOPE_INVALID`; `429 RATE_LIMITED`; `503 DEPENDENCY_UNAVAILABLE`                       | 403 for wrong caller shard, a missing, expired, or invalid principal assertion (`details.reason` of `assertion_missing`, `assertion_expired`, or `assertion_invalid`), or case ownership; 401 UNAUTHENTICATED for an unregistered or invalid service credential; 404 only when subject is not resolvable in a safe command scope | 24h key bound to caller shard/case/subject/version/action; 30 commands/hour/case; trace case link/purge/version, never private evidence.                                                                                               |
| DLV-DEL-API-06 | `400 VALIDATION_FAILED`; `401 UNAUTHENTICATED`; `403 FORBIDDEN`/`CASE_REFERENCE_INVALID`; `404 RIGHT_NOT_FOUND`; `409 VERSION_CONFLICT`/`IDEMPOTENCY_MISMATCH`; `422 REVOKE_STATE_INVALID`; `429 RATE_LIMITED`; `503 DEPENDENCY_UNAVAILABLE`                       | 403 for wrong caller shard, a missing, expired, or invalid principal assertion (same `details.reason` values), or foreign case; 401 UNAUTHENTICATED for an unregistered or invalid service credential; 404 for unresolvable right without existence oracle                                                                       | 24h key bound to caller shard/case/right/version/state; 30 commands/hour/case; trace case/right/purge/version, never adjudication evidence.                                                                                            |

## Database Schema

### PostgreSQL model registry

| Canonical model                                         | Typed fields, nullability, constraints, foreign keys, indexes, RLS, and grants                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PublicationProjection` (`publication_projection`)      | `id uuid PK`; `publication_id uuid NOT NULL FK publication.id`; `route_manifest_id uuid NOT NULL FK delivery.route_manifest_version.id`; `locale varchar(16) NOT NULL`; `audience varchar(48) NOT NULL`; `render_payload jsonb NOT NULL CHECK (jsonb_typeof(render_payload)='object')`; `render_hash text NOT NULL CHECK (render_hash ~ '^[a-f0-9]{64}$')`; `discovery_hash text NOT NULL CHECK (discovery_hash ~ '^[a-f0-9]{64}$')`; `required_refs jsonb NOT NULL CHECK (jsonb_typeof(required_refs)='array')`; `state text NOT NULL CHECK (state IN ('building','ready','blocked','failed_retryable','active','superseded','revoked'))`; `version bigint NOT NULL CHECK (version>0)`; `created_at timestamptz NOT NULL`; `updated_at timestamptz NOT NULL`. Unique `(publication_id,route_manifest_id,locale,audience,version)`; indexes `(locale,audience,state)`, `(publication_id,version DESC)`, `(route_manifest_id,locale,audience)`. RLS: public reads only active safe projection; delivery worker writes leased version; direct browser grants none. |
| `ProjectionConsumerState` (`projection_consumer_state`) | `id uuid PK`; `publication_id uuid NOT NULL FK publication.id`; `projection_id uuid NOT NULL FK PublicationProjection.id`; `consumer text NOT NULL CHECK (consumer IN ('route','render','menu','media','search','sitemap','cache','social'))`; `expected_version bigint NOT NULL CHECK (expected_version>0)`; `state text NOT NULL CHECK (state IN ('building','ready','blocked','failed_retryable','active','superseded','revoked'))`; `attempts integer NOT NULL DEFAULT 0 CHECK (attempts>=0)`; `last_error_code varchar(96) NULL`; `updated_at timestamptz NOT NULL`; `version bigint NOT NULL CHECK (version>0)`. Unique `(publication_id,projection_id,consumer)`; indexes `(publication_id,state)`, `(consumer,state,updated_at)`. RLS: delivery principal and redacted publisher diagnostics; public clients cannot read.                                                                                                                                                                                                                                |
| `DeliveryPurgeRecord` (consumed, not defined here)      | Defined once in [04b](04b-governed-media-renditions.md) as `cms_delivery_purge_records` and created by the Slice 14 migration; this split defines no second table and creates, updates, and reads rows only through its named delivery RPCs and the BE00 CDN/cache purge seam. The subject types this split writes (`asset`, `reference`, `right`, `publication`, `route`, `projection`) and the scopes it writes (`public`, `private`, `route`, `tag`, `version`, `all_derived`) are members of the 04b registered sets; a scope is stored as the 04b `scope` JSON object with its `scope_hash`, and uniqueness is the 04b key `(subject_type, subject_id, subject_version, scope_hash, reason_code, urgent)`. State transitions, evidence, and the urgent-partial-stays-open rule are the 04b rules. RLS: delivery worker/auditor only; direct client grants none.                                                                                                                                                                                             |
| `active_delivery_pointer`                               | `id uuid PK`; `route text NOT NULL`; `locale varchar(16) NOT NULL`; `audience varchar(48) NOT NULL`; `publication_projection_id uuid NOT NULL FK PublicationProjection.id`; `route_manifest_id uuid NOT NULL FK delivery.route_manifest_version.id`; `switched_at timestamptz NOT NULL`; `version bigint NOT NULL CHECK (version>0)`. Unique `(route,locale,audience)`; index `(publication_projection_id,version)`. RLS: public safe pointer read; only transaction coordinator writes; browser direct writes denied.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `preview_session`                                       | `id uuid PK`; `token_hash text NOT NULL CHECK (token_hash ~ '^[a-f0-9]{64}$')`; `user_id uuid NOT NULL FK person.id`; `acting_context_version varchar(128) NOT NULL`; `capability varchar(96) NOT NULL`; `exact_version_set jsonb NOT NULL CHECK (jsonb_typeof(exact_version_set)='object')`; `route text NOT NULL`; `locale varchar(16) NOT NULL`; `audience varchar(48) NOT NULL`; `expires_at timestamptz NOT NULL`; `revoked_at timestamptz NULL`; `version bigint NOT NULL CHECK (version>0)`; unique `(token_hash)`; indexes `(user_id,expires_at)`, `(route,locale,audience,expires_at)`. RLS: owning user sees status only; verifier worker reads hash/scope; no public grants.                                                                                                                                                                                                                                                                                                                                                                          |

### State machines, concurrency, and transaction rules

`PublicationProjection` and `ProjectionConsumerState` transition `building → ready, blocked, failed_retryable → active → superseded or revoked`; only required route/render/menu/media states gate the `active_delivery_pointer`. `DeliveryPurgeRecord` transitions `requested → dispatching → verifying → completed, partial, failed_retryable`; urgent partial remains open/incident. Preview sessions expire after 15 minutes, are revoked independently, and never enter a public cache. DLV-DEL-API-03 leases publication/version and uses serializable compare-and-swap on the pointer; a stale builder cannot switch newer content. DLV-DEL-API-04 serves a last-known-good only when authorization, staleness, and no-hold/revocation checks pass. DLV-DEL-API-05 stores one hold per calling shard/case/scope; each release is scoped to its applying shard. DLV-DEL-API-06 records the caller’s `AssetRight` consequence and never reads or overturns owning-domain truth.

All commands use canonical body hashes and 24-hour idempotency records. Purge IDs and provider attempt evidence are stable across retries. Outbox events commit with projection/purge/pointer rows. Lost inbound commands are repaired by reconciliation; a subject whose command state cannot be confirmed remains held rather than released. `anon` and browser direct table grants are denied except safe public projection/pointer reads; policy, draft, lease, purge evidence, and command case data are service-only.

## Middleware & Policies

### Authorization matrix

| Operation      | Allowed authority                                                                         | 403 condition                                                                           | 404 condition                                                              |
| -------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| DLV-DEL-API-01 | Public visitor or authenticated audience                                                  | No 403 for an unknown public route; a known binding is omitted when unauthorized        | Safe 404 for unknown/private/suppressed route or no canonical redirect     |
| DLV-DEL-API-02 | Preview user with exact Shard 03 token                                                    | Valid token but capability/context/audience mismatch                                    | Invalid/forwarded/expired token or hidden draft returns existence-safe 404 |
| DLV-DEL-API-03 | Signed delivery principal with exact lease                                                | Known publication/lease but principal lacks delivery capability                         | Publication/version outside lease scope                                    |
| DLV-DEL-API-04 | Signed recovery worker                                                                    | Known publication but principal lacks recovery capability                               | Publication outside worker scope                                           |
| DLV-DEL-API-05 | Registered Shard 06/10/20 command principal with a valid principal assertion and own case | Caller shard/case/subject authority mismatch, or missing, expired, or invalid assertion | Subject cannot be safely resolved in command scope                         |
| DLV-DEL-API-06 | Registered Shard 06/10/20 command principal with a valid principal assertion and own case | Caller shard/case/right authority mismatch, or missing, expired, or invalid assertion   | Right cannot be safely resolved in command scope                           |

### Internal command principals and step-up assertions (D17)

Shards 06, 10, and 20 are later phases, so Phase 2 registers the three caller identities and their verifier and exercises them with test principals; no production caller exists. The registration uses the S07 service-credential pattern (the BE05a CFG-05A-01 release-principal contract), not a new mechanism.

- **Principals.** Exactly three principal ids, each bound to one caller shard and one scope: `delivery.command.shard06`, `delivery.command.shard10`, and `delivery.command.shard20`, scope `delivery-command`. A principal id matches `^[a-z][a-z0-9_.-]{1,95}$`. A principal can act only for its bound shard: `caller_shard` in the body must equal it, otherwise `403 FORBIDDEN`.
- **Credential.** mTLS or an allowlisted key id with a signature header matching `^[A-Za-z0-9._~-]{16,256}$`, verified by the same resolver contract as release principals. An unregistered, unsigned, or invalid credential is `401 UNAUTHENTICATED`; a verifier outage is `503 DEPENDENCY_UNAVAILABLE`; no browser session, cookie, CSRF token, or acting context is accepted. DLV-DEL-API-05 and -06 take their caller identity from the credential and never from the body.
- **Step-up.** Each command also carries a signed short-lived principal assertion in the `X-Principal-Assertion` header: a compact JWS signed with the principal's registered key whose claims are `iss` (the principal id), `aud` (`wejammin-delivery-command`), `iat`, `exp` no later than 15 minutes after `iat` (the preview-session lifetime of this spec), `jti` (a UUID), `shard`, `op` (the operation id), `case_id`, and `cmd_hash` (the lowercase SHA-256 hex of the RFC 8785 canonical JSON of the request body). The assertion is valid only when `exp` is in the future, `jti` has not been used within the 24-hour idempotency window, and `shard`, `op`, `case_id`, and `cmd_hash` match the command. A missing, expired, replayed, or mismatched assertion is `403 FORBIDDEN` with `details.reason` `assertion_missing`, `assertion_expired`, or `assertion_invalid`, and no row is written.
- **Convergence and recovery callers.** DLV-DEL-API-03 and DLV-DEL-API-04 are called only by the delivery plane's own internal workers (the signed delivery principal holding the publication/version lease, and the signed recovery worker), never by a person, so they take `PrincipalCommandContext` instead of a person acting context: the caller identity comes from the verified service credential, no `actor_person_id`, `acting_party_id` or `acting_context_version` exists on the wire, and the audit actor is the principal id. They carry no `X-Principal-Assertion` (step-up applies to the owning-domain commands DLV-DEL-API-05 and -06 only); their authority stays bound to the exact publication lease and recovery scope named in the registry rows.
- **Seams.** The Shard 06/10/20 command acknowledgement seam is unchanged. A lost or uncertain command is still repaired by reconciliation and keeps the subject held.

### Per-operation middleware and CORS

| Operation      | Middleware and CORS policy                                                                                                                                                                                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DLV-DEL-API-01 | `requestId → strictCors(public read origins; credentials disabled for anonymous) → securityHeaders → bodyLimit(8KiB) → contentType(accept negotiation) → rateLimit(public-read) → optional auth → zod(PublishedContentRequest) → route/projection lookup → binding authorization/redaction → ETag/cache policy → handler → response headers`.           |
| DLV-DEL-API-02 | `requestId → strictCors(registered web origins; credentials only for same-site) → securityHeaders → bodyLimit(16KiB) → contentType(accept negotiation) → rateLimit(preview) → auth → actingContext → zod(PreviewRequest) → Shard03 token reauth → exact version/scope gate → no-store/noindex handler → audit`.                                         |
| DLV-DEL-API-03 | `requestId → strictCors(internal service origins; browser credentials disabled) → securityHeaders → bodyLimit(64KiB) → contentType(json) → rateLimit(convergence-worker) → serviceAuth → zod(ConvergeRequest) → lease/version/consumer gate → idempotency → If-Match/CAS → handler → audit/outbox`.                                                     |
| DLV-DEL-API-04 | `requestId → strictCors(internal service origins; browser credentials disabled) → securityHeaders → bodyLimit(32KiB) → contentType(json) → rateLimit(recovery-worker) → serviceAuth → zod(RecoverRequest) → staleness/authorization/hold gate → idempotency → If-Match/CAS → handler → audit/outbox`.                                                   |
| DLV-DEL-API-05 | `requestId → strictCors(internal service origins; browser credentials disabled) → securityHeaders → bodyLimit(32KiB) → contentType(json) → rateLimit(protected-delivery-command) → mTLS+serviceCredential → principalAssertion(step-up) → zod(HoldRequest) → caller-shard/case/scope gate → idempotency → If-Match/CAS → handler → audit/outbox`.       |
| DLV-DEL-API-06 | `requestId → strictCors(internal service origins; browser credentials disabled) → securityHeaders → bodyLimit(32KiB) → contentType(json) → rateLimit(protected-delivery-command) → mTLS+serviceCredential → principalAssertion(step-up) → zod(RevocationRequest) → caller-shard/case/right gate → idempotency → If-Match/CAS → handler → audit/outbox`. |

### Cache, privacy, and abuse policy

Static content-hashed public assets are immutable for one year. Public HTML/read models use route-class policy, default edge max-age 60 seconds plus stale-while-revalidate 300 seconds, and event/version purge keys. Authenticated, admin, and preview responses are `no-store`; cache keys include user/party/audience/entity/publication version where required. Public responses contain no drafts, admin fields, protected domain bindings, private policy facts, unrestricted PII, or provider details. Rate keys use route, IP, actor, party, and audience; suspicious route probing and preview forwarding produce redacted security audit events. No stale response bypasses urgent purge, rights hold/revocation, privacy, or authorization checks.

## Data Flow

1. Public reads normalize route/locale/audience, apply CORS/security/cache policy, load the active pointer, and authorize every domain binding before hydration.
2. Preview reads reauthenticate the Shard 03 token and exact context/version set, then return a no-store/noindex projection outside the public cache.
3. Convergence consumes exact `cms.publication.changed.v1`, obtains a lease, loads the version set, resolves menu/route/discovery (the discovery effective values come from the 04a discovery policy projection) and eligible media inputs, writes consumer states, and switches the pointer only after required readiness.
4. Recovery compares canonical publication/manifest/purge versions consumer by consumer; it serves eligible last-known-good or explicit unavailable and schedules rebuild/purge work.
5. Shard 06/10/20 commands write hold/case or eligibility consequences and urgent purge intents in one transaction; this split never adjudicates their case or reads their state.
6. BE00 outbox delivers `delivery.projection.ready.v1` and `delivery.purge.completed.v1`; consumers dedupe by event ID/version and refetch the exact projection.

## Events and Consumer Contracts

| Event type                                                                                  | Producer/consumer and payload                                                                                                                                                                               | Consumer/recovery contract                                                                                                                                                       |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cms.publication.changed.v1`                                                                | Inbound Shard 03 event `{ eventId, publicationId, publicationVersion, schemaVersion }`                                                                                                                      | DLV-DEL-API-03 accepts only the registered publication/version scope, leases it, and never builds from a newer or unreferenced version. Queue retry preserves the prior pointer. |
| `delivery.projection.ready.v1`                                                              | DLV-DEL-API-03 after required consumers are ready: `{ eventId, occurredAt, publicationId, projectionId, routeManifestVersionId, locale, audience, version, schemaVersion }`; no render payload/drafts       | Active-pointer coordinator evaluates readiness; at-least-once outbox retries five times with 1/5/30/300/900 s backoff and dedupes by event ID/version.                           |
| `delivery.purge.completed.v1`                                                               | DLV-DEL-API-04 or purge worker: `{ eventId, occurredAt, purgeId, subjectType, subjectId, subjectVersion, scope, state, evidenceHash, version, schemaVersion }`; no provider credentials or private evidence | Takedown/recovery/admin status verifies provider scopes; `partial` remains incident/open and replay never broadens scope.                                                        |
| `delivery.menu.activated.v1` and `delivery.route.changed.v1`                                | Upstream 04a inputs `{ menuId, menuVersionId }` and `{ routeId, routeManifestVersionId }`                                                                                                                   | Convergence loads exact menu/route versions; 04c does not mutate their owner rows or expose drafts.                                                                              |
| `delivery.asset.changed.v1`, `delivery.rendition.ready.v1`, and `delivery.asset.revoked.v1` | Upstream 04b inputs `{ assetId }`, `{ renditionId, assetId }`, and `{ assetId, purgeId }`                                                                                                                   | Projection consumers re-evaluate required media; revocation blocks/schedules purge before serving and does not substitute a private original.                                    |

All events use BE00 identifier-only envelopes, aggregate version, payload hash, and outbox transactionality. Public/cache consumers never treat event receipt as authorization; they refetch the exact version under RLS and policy.

## Error Handling and Failure Recovery

| Failure                                                              | Deterministic response and recovery                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unknown/private/unauthorized route                                   | Redirect if a canonical redirect is safe; otherwise public-safe 404 or explicit unavailable; no existence-sensitive detail.                                                                                                                                                                                                                                                                                                                                      |
| Binding authorization failure                                        | Omit the binding and continue only if the page disclosure contract remains valid; otherwise return explicit unavailable and log a redacted blocker.                                                                                                                                                                                                                                                                                                              |
| Preview token mismatch/expiry/revocation                             | Safe denial, `no-store`, `noindex`, no draft identifiers or payload; no public cache write.                                                                                                                                                                                                                                                                                                                                                                      |
| Required projection consumer blocked/failed                          | Keep prior active pointer; record consumer, expected version, attempts, and error code; retry or page after dead-letter.                                                                                                                                                                                                                                                                                                                                         |
| Stale builder or pointer race                                        | `409 VERSION_CONFLICT`; CAS loser does not switch or emit a second ready event.                                                                                                                                                                                                                                                                                                                                                                                  |
| CDN purge timeout/partial                                            | Persist one purge ID and provider evidence; version-addressed route remains correct; urgent partial stays incident/open and recovery retries.                                                                                                                                                                                                                                                                                                                    |
| No safe degraded snapshot                                            | `422 UNAVAILABLE_NO_SAFE_SNAPSHOT` with request ID and truthful unavailable status; never empty/default/unrelated/draft content.                                                                                                                                                                                                                                                                                                                                 |
| Hold/revocation command lost or uncertain                            | Outbox reconciliation reasserts caller case set; subject remains held/blocked until confirmed; no release on uncertainty.                                                                                                                                                                                                                                                                                                                                        |
| Discovery policy projection unavailable at convergence or serve time | The page is still built and served by its own required consumers; the search, sitemap, and social outputs carry the synthesized 04a `policy_unavailable` state (noindex, sitemap exclusion, optional fields redacted), `last_error_code` `policy_unavailable` is recorded on those optional consumer rows, and they do not block the pointer switch because page correctness and disclosure are unchanged. The next convergence recomputes the effective values. |
| Duplicate command/event                                              | Same canonical hash/event ID returns original result; different body returns `409 IDEMPOTENCY_MISMATCH`; no second pointer, hold, purge, or transition.                                                                                                                                                                                                                                                                                                          |

## Verification and Test Strategy

### Operation Test Matrix

| Operation ID   | Contract and handler tests                                                                                                             | Authorization/RLS and failure tests                                                                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DLV-DEL-API-01 | Route normalization, active pointer/ETag, authorized binding hydration, redirect/not-found/unavailable, cache TTL and conditional read | Public/auth audience, 403/404 policy, revoked/held cache rejection, no draft/private leakage, rate abuse                                                                                                    |
| DLV-DEL-API-02 | Token/context/version exact match, scope narrowing, expiry/revocation, no-store/noindex headers, no public cache                       | Preview user/capability, safe denial, forwarded token, stale context, draft payload redaction                                                                                                               |
| DLV-DEL-API-03 | Event/version lease, required consumer readiness, whole pointer switch, stale builder CAS, outbox event/dedupe                         | Delivery principal/lease, 403/404, blocked consumer, queue retry, prior pointer preservation                                                                                                                |
| DLV-DEL-API-04 | Last-known-good staleness, authorization/hold gate, explicit unavailable, consumer rebuild/purge and recovery idempotency              | Recovery worker authority, 403/404, urgent purge, stale snapshot, provider partial evidence                                                                                                                 |
| DLV-DEL-API-05 | Caller shard/case/subject scope, apply/release state, per-shard hold isolation, purge intent, replay                                   | Principal registration and shard binding, assertion present/expired/replayed/forged/`cmd_hash` mismatch/wrong `op`, mTLS, 401/403/404, foreign case, lost command reconciliation, no release on uncertainty |
| DLV-DEL-API-06 | Right version/target-state, caller attribution, purge intent, CAS/replay, no adjudication mutation                                     | Principal registration and shard binding, assertion present/expired/replayed/forged/`cmd_hash` mismatch/wrong `op`, mTLS, 401/403/404, invalid state, foreign case, rights evidence privacy, purge recovery |

Cross-operation test-level matrix:

| Level                     | Required tests                                                                                                                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract                  | Zod 4 valid/invalid fixtures for every operation; strict unknown-key rejection, route/policy bounds, token scope, worker/case fields, and `ApiError { code, message, requestId, details }` snapshots.      |
| Persistence/concurrency   | Unique active pointer, projection consumer CAS, lease fencing, preview expiry/revocation, purge uniqueness, per-shard hold isolation, idempotency hash, RLS direct-table denial, and outbox atomicity.     |
| Security/privacy          | Public/authenticated/preview/worker/06/10/20 matrices, 403 versus 404, cache poisoning, open redirect handoff, draft/PII/policy redaction, CORS/CSRF/security headers, and signed URL boundaries.          |
| Degraded/recovery         | No-safe-snapshot unavailable, max staleness, urgent revoke during outage, provider purge partial, queue dead-letter/replay, version-by-version rebuild, and synthetic route verification.                  |
| Accessibility             | Truthful unavailable/degraded/takedown status, no empty slot, locale/audience correctness, focus/landmark preservation, and preview/read errors communicated without protected detail.                     |
| Integration/observability | Shard 03/05, 04a/04b, BE00 CDN/signer/outbox seams honor exact timeout/retry/breaker profiles; every operation emits requestId/operationId/version/cache/purge/result metrics without content or evidence. |

## Deepening Passes and Ambiguity Gate

- **Pass 1 — micro contract:** route/audience/version schemas, cache controls, token scope, projection/consumer/purge fields, hold/revocation caller cases, and closed states are strict.
- **Pass 2 — macro contract:** DLV-09–DLV-14 map one-to-one to routes; public reads, preview, workers, and owning-domain commands have separate authority and ownership boundaries.
- **Pass 3 — race/recovery:** pointer CAS, publication leases, last-known-good policy, purge IDs, per-shard holds, reconciliation, outbox replay, and provider breaker behavior are explicit.
- **Pass 4 — security/privacy/accessibility:** public/private cache isolation, no-store preview, 403/404, RLS, CORS, urgent purge, truthful unavailable status, and redacted telemetry are per operation.

## Ambiguity Gate

**PASS.** DLV-09–DLV-14 are reconciled one-to-one with stable operation IDs. Published query, exact preview, publication convergence, degraded recovery, protected holds, and rights eligibility consequences have deterministic schemas, ownership, cache/purge/state behavior, 403-vs-404 outcomes, CORS/auth/rate middleware, typed persistence, external seams, events, tests, and recovery. No implementation decision remains open.

## Open Questions

None.

## Changelog

| Date       | Change                                                                                                                                                                                                                                                                                                                             | Workflow               | Sections affected                                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------- |
| 2026-08-28 | Authored the public delivery/cache backend split for DLV-09–DLV-14.                                                                                                                                                                                                                                                                | `/write-be-spec`       | All                                                |
| 2026-08-28 | Added per-operation Zod 4, CORS, cache/purge, projection, protected command, event, and recovery contracts.                                                                                                                                                                                                                        | `/write-be-spec-write` | API, Database, Middleware, Events, Tests           |
| 2026-10-02 | G9: removed the duplicate `DeliveryPurgeRecord` (`delivery_purge`) definition; the single table is `cms_delivery_purge_records` in 04b, created in Slice 14 and consumed here through the BE00 purge seam                                                                                                                          | `/propagate-decision`  | Classification, Database                           |
| 2026-10-02 | D17: registered the Phase 2 internal command principals `delivery.command.shard06`, `.shard10`, and `.shard20` through the S07 service-credential pattern, defined the signed short-lived principal assertion as step-up, and replaced the person-based command context on DLV-DEL-API-05 and -06 with a principal command context | `/propagate-decision`  | API, Contracts, Middleware, Tests                  |
| 2026-10-02 | D24: convergence and serve consume the 04a discovery policy projection and publish the fail-closed `policy_unavailable` noindex state                                                                                                                                                                                              | `/propagate-decision`  | Data Flow, Errors                                  |
| 2026-10-02 | A3 follow-up: DLV-DEL-API-03 and DLV-DEL-API-04 are internal worker operations and move to `PrincipalCommandContext` (identity from the service credential, no person acting-context fields, no `actingContext` stage); the unused person `CommandContext` was removed                                                             | /propagate-decision    | Contracts, Middleware, Internal command principals |

## Dependency References

- [BE00 — Cross-cutting Platform Foundation](00-infrastructure.md): global `ApiError`, request IDs, idempotency, ETag/cache, RLS, signed delivery, outbox, and provider recovery.
- [IA Shard 04 — CMS navigation, media and delivery](../ia/04-cms-delivery-media.md) and [Deep Dive 04](../ia/deep-dives/04-cms-delivery-media.md): canonical DLV-09–DLV-14 interactions, models, cache contracts, states, events, accessibility, and recovery.
- [04a — CMS navigation, routes & discovery](04a-navigation-routes-discovery.md): immutable menu/route/discovery versions consumed by convergence; no route ownership is duplicated.
- 04b governed-media/rendition split: asset/rendition eligibility events are consumed; this file does not own media ingest, rights claims, or rendition routes.
- [04b](04b-governed-media-renditions.md) also owns the single `DeliveryPurgeRecord` table that this file consumes; [BE05a](05a-settings-flags-runtime.md) supplies the S07 service-credential pattern for the command principals.
- Shard 03: publication/version and preview-token authority. Shard 05: route/cache policy. Shards 06, 10, and 20: downward protected hold/revocation callers and case ownership.


<!-- spec-graph: auto-generated -->
## Related Specs

### Phases into
- [[specs/phases/phase-2|Phase 2 — Identity, admin, CMS/settings]]
