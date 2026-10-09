# CMS editorial publication runbook

Operational reference for the Slice 11 review, scheduling, preview and publication
operations of Shard 03b (`docs/runbooks/platform/cms-editorial.md` covers entry
authoring, CMS-03B-01 to -04 and -10 to -14). Every row below is read from the
contracts package (`packages/contracts/src/cms-editorial`) and the BE03b
specification; the registry rows, the generated OpenAPI document
(`docs/openapi/openapi.json`) and the Worker routes must agree with it.

## Operations

Browser operations share the BE00 envelope: the first-party browser audience
with the `cms-console` CORS class, no-store responses, `X-Request-Id` and the
BE00 middleware order. What each operation takes on the wire depends on its
class: six mutations and three safe reads.

### Mutation operations

CMS-03B-05, CMS-03B-06, CMS-03B-07, CMS-03B-08, CMS-03B-09 and CMS-03B-18 are
`POST` commands. Each takes strict
JSON (`Content-Type: application/json`, unknown keys refused), an
`Idempotency-Key` (8 to 128 printable ASCII characters), an exact strong
`If-Match` (`"<positive decimal>"`) and a CSRF token. The `If-Match` operand is
the entry `version` for CMS-03B-05 and CMS-03B-08 (E5), the review `version` for
CMS-03B-06 and CMS-03B-18, and the approved review `version` for CMS-03B-07 and
CMS-03B-09. Wherever the body carries `expectedVersion` (CMS-03B-06, CMS-03B-07,
CMS-03B-09, CMS-03B-18) the `If-Match` operand must equal it, otherwise the
request is `400 INVALID_REQUEST`.

CMS-03B-06, CMS-03B-07, CMS-03B-09 and CMS-03B-18 additionally require recent
binding-bound MFA (E6): a missing or stale proof is `401 STEP_UP_REQUIRED`
before any idempotency reservation or domain read, and changes nothing.
CMS-03B-05 and CMS-03B-08 require no step-up.

### Safe reads

CMS-03B-15, CMS-03B-16 and CMS-03B-17 are `GET` reads. They have no request body and accept
neither `Idempotency-Key` nor `If-Match`; they need no CSRF token and no step-up,
and emit no event. The query is strict (CMS-03B-15 takes only `revisionId`,
CMS-03B-16 takes none, CMS-03B-17 takes only `cursor`, `limit`, `scope` and
`state`). Each answers a strong `ETag` (CMS-03B-16 is `"{review.version}"`), and
the preparation read CMS-03B-15 is recomputed on every request and never stored.

### Routes

| Operation    | Route                                             | Success                                                          | Limit (user / party per minute)   | Deadline | Tier | Event                         |
| ------------ | ------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------- | -------- | ---- | ----------------------------- |
| `CMS-03B-05` | `POST /api/v1/cms/entries/{entryId}/reviews`      | `201 EditorialReviewResource`                                    | 30 / 60 (`cms-review-write`)      | 15 s     | 2    | `cms.entry.review-changed.v1` |
| `CMS-03B-06` | `POST /api/v1/cms/reviews/{reviewId}/decision`    | `200 EditorialReviewResource`                                    | 30 / 60 (`cms-review-write`)      | 15 s     | 2    | `cms.entry.review-changed.v1` |
| `CMS-03B-07` | `POST /api/v1/cms/publication-schedules`          | `202 PublicationScheduleResource`                                | 20 / 40 (`cms-schedule-write`)    | 15 s     | 2    | none until execution          |
| `CMS-03B-08` | `POST /api/v1/cms/previews`                       | `201 PreviewTokenResource`                                       | 60 / 120 (`cms-preview-write`)    | 8 s      | 1    | none                          |
| `CMS-03B-09` | `POST /api/v1/cms/publications`                   | `202 PublicationResource`                                        | 20 / 40 (`cms-publish-write`)     | 15 s     | 2    | `cms.publication.changed.v1`  |
| `CMS-03B-15` | `GET /api/v1/cms/entries/{entryId}/workflow`      | `200 EntryWorkflowResource`                                      | 300 / 600 (`cms-entry-read`)      | 8 s      | 2    | none                          |
| `CMS-03B-16` | `GET /api/v1/cms/reviews/{reviewId}`              | `200 EditorialReviewDetailResource`                              | 300 / 600 (`cms-entry-read`)      | 8 s      | 1    | none                          |
| `CMS-03B-17` | `GET /api/v1/cms/reviews`                         | `200 ReviewQueuePage`                                            | 300 / 600 (`cms-entry-read`)      | 8 s      | 1    | none                          |
| `CMS-03B-18` | `POST /api/v1/cms/reviews/{reviewId}/assignments` | `201` created, `200` revoked `EditorialReviewAssignmentResource` | 10 / 20 (`cms-review-assignment`) | 15 s     | 2    | `cms.entry.review-changed.v1` |

`202` on CMS-03B-07 means scheduled, never published. `202` with
`projectionState` `pending` on CMS-03B-09 means the lineage row is committed
canonically; it is not proof of public visibility.

## Internal operations (not browser routes)

CMS-03B-19 and CMS-03B-20 are named database RPCs, absent from the browser route
inventory and the OpenAPI document. They return typed results instead of
`ApiError`.

| Operation    | RPC                                                                                                         | Caller                                            | Notes                                                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `CMS-03B-19` | `platform_api.cms_verify_preview_token`                                                                     | Shard 04 delivery principal                       | Read-safe, 500 ms deadline, retries at 75 ms and 150 ms, circuit open 30 s; every denial is byte-identical except the bound owner's `revoked`. |
| `CMS-03B-20` | `platform_private.cms_claim_due_publication_schedules`, `platform_private.cms_execute_publication_schedule` | Worker `scheduled` sweep (every minute, batch 25) | `FOR UPDATE SKIP LOCKED` claim, five-minute lease, 15 s deadline, retries at 15 s, 60 s and 300 s then `blocked` `retries_exhausted`.          |

## Typed refusals

A Slice 11 refusal carries one lowercase `details.reasonCode` from the closed
catalog exported as `CMS_SLICE_11_OPERATION_REASONS`. A stale CAS operand is
`409 CONFLICT` with `details.conflict` `VERSION_MISMATCH`.

| Status | Tokens                                                                                                                                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 403    | `capability_missing`, `separation_of_duties`                                                                                                                                                                                                                                                                       |
| 409    | `revision_not_submittable`, `dependency_changed`, `version_set_stale`, `review_not_open`, `duplicate_decision`, `specialist_slot_unsatisfiable`, `reviewer_not_eligible`, `assignment_exists`, `assignment_limit`, `publication_conflict`, `publication_not_active`, `preview_expired`, `preflight_evidence_stale` |
| 422    | `preflight_failed`, `dependency_manifest_too_large`, `unknown_timezone`, `tzdb_version_mismatch`, `nonexistent_local_time`, `ambiguous_local_time`, `disambiguation_not_applicable`, `resolved_utc_mismatch`, `schedule_out_of_horizon`, `authority_ends_before_schedule`, `expiry_out_of_bounds`                  |
| 503    | an unavailable preflight provider: `dependencyClass` `preflight`, `retryable` true; nothing commits and no success idempotency record is kept.                                                                                                                                                                     |

A `429` and a retryable `503` carry `Retry-After` and the `RateLimit-Limit`,
`RateLimit-Remaining` and `RateLimit-Reset` headers; the generated OpenAPI
publishes them on every Slice 11 operation. A `500` or `502` is never retryable
and carries none.

## Time authority

Schedule times are resolved over one pinned IANA tz snapshot (BE03b E8). The
release tag is `CMS_TZDB_VERSION` and the snapshot's SHA-256 is
`CMS_TZDB_SHA256`; both are exported by the contracts package and recorded in
DEC-153. A hash mismatch at module load answers every schedule command
`503 DEPENDENCY_UNAVAILABLE`. Advancing the pin is code plus a forward migration
(`platform_private.cms_tzdb_version()` must return the same tag).

## Observability

Metrics (labels never carry an id, hash, reason text or person):
`cms_review_submitted_total{risk_class,outcome}`, `cms_review_decision_total{decision,outcome}`,
`cms_review_assignment_total{action,outcome}`, `cms_review_invalidated_total{reason}`,
`cms_preflight_result_total{category,outcome,phase}`, `cms_preflight_latency_ms{category}`,
`cms_a11y_checker_duration_ms`, `cms_schedule_blocked_total{reason}`,
`cms_schedule_attempt_total{outcome}`, `cms_schedule_claim_batch_size`,
`cms_preview_verify_total{valid}`, `cms_publication_lineage_conflict_total`,
`cms_settings_snapshot_ordinal`, `cms_separation_of_duties_refusal_total{operation}`.

Alert when review invalidation spikes above 5% in 5 minutes, a schedule stays
blocked for more than 15 minutes, publication projection lag exceeds 2 minutes, the
DLQ is non-empty, outbox age exceeds 2 minutes, preview denial anomalies indicate
token forwarding, any `cms_schedule_blocked_total{reason="retries_exhausted"}`
increment occurs, the accessibility checker exceeds 2,000 ms, or
`cms_publication_lineage_conflict_total` rises above background.
