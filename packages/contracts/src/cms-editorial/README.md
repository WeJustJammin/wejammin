# CMS Editorial Contracts (03b)

Runtime Zod 4 contracts for the editorial workflow and publication shard. These
schemas are the single source for TypeScript types, Hono validation, OpenAPI,
tests, and JSONB checks in Shard 03b. The registry locks eighteen browser
operations: the nine Slice 10 entry-authoring operations (CMS-03B-01 existing-entry
revision, -02 conflict resolution, -03 revision history, -04 revision restore, -10
entry create, -11 draft detail, -12 conflict detail, -13 entry list, -14 authoring
context) and the nine Slice 11 operations (CMS-03B-05 submit review, -06 record
decision, -07 schedule publication, -08 mint preview token, -09 publish, -15
workflow and preparation read, -16 review detail, -17 reviewer queue, -18 reviewer
assignment). CMS-03B-19 (preview-token verifier) and CMS-03B-20 (schedule claim and
execute) are internal database RPCs: their contracts live in `internal-rpc.ts`
and they are never browser routes, registry rows or OpenAPI operations.

## Contents

| File                                | Owns                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `primitives.ts`                     | `Bcp47Schema`, `JsonPointerSchema`, `FieldPointerSchema`, `ChangedPathsSchema`, `BoundedEntryValuesSchema`, `cmsEditorialJsonDepth`              |
| `models.ts`                         | Entry revision and conflict state vocabularies, plus the shared revision meta shape                                                              |
| `resources.ts`                      | `EntryRevisionResourceSchema`, `ConflictRecordResourceSchema`, and the bounded proposed-values envelope                                          |
| `requests.ts`                       | `EntryRevisionRequestSchema` plus its path-parameter and header schemas, and the CMS-03B-01 `*ApiRequestSchema` transport view                   |
| `schema-evidence.ts`                | `SchemaArtifactEvidenceSchema`, `ValidatorEvidenceSchema`                                                                                        |
| `entry-create.ts`                   | CMS-03B-10 request/headers/resource plus the create seam checklist                                                                               |
| `entry-draft-detail.ts`             | CMS-03B-11 path/query/resource plus the draft-detail seam checklist                                                                              |
| `conflict-detail.ts`                | CMS-03B-12 path/query/resource: the bounded three-way preimages of an open conflict                                                              |
| `entry-list.ts`                     | CMS-03B-13 query/item/page; each item carries `entryId`, `entryLifecycle` and `entryUpdatedAt` (no owner or assignee identity)                   |
| `authoring-context.ts`              | CMS-03B-14 query, creatable types, author-safe field definitions and the combined read                                                           |
| `conflict-resolution.ts`            | CMS-03B-02 request/path/headers, the caller-authority guard, and the seam names                                                                  |
| `conflict-choice.ts`                | `ConflictChoiceSchema` and the bounded `ConflictChoiceValueSchema`                                                                               |
| `conflict-verification.ts`          | `ConflictYoursSourceEvidenceSchema`; the canonical yours-source enum lives in `models.ts`                                                        |
| `revision-history.ts`               | CMS-03B-03 page, compare, path, and query schemas                                                                                                |
| `revision-restore.ts`               | CMS-03B-04 request/path/headers plus the restore registry attestation                                                                            |
| `publication-contracts.ts`          | `VersionSet` and `DependencyManifest` frozen evidence plus the CMS-03B-05 review-submission and CMS-03B-06 decision contracts                    |
| `publication-schedule-contracts.ts` | CMS-03B-07 schedule, CMS-03B-08 preview and CMS-03B-09 publication bodies with their key-plus-If-Match headers                                   |
| `workflow-models.ts`                | Closed Slice 11 vocabularies: review, schedule, publication state, action, risk class, projection state, invalidation and schedule reason tokens |
| `review-resources.ts`               | `EditorialReviewResource` (CMS-03B-05/06), the `FrozenCandidate` and `checkEditorialReview` invariants shared by every review-bearing resource   |
| `publication-resources.ts`          | `PublicationScheduleResource` (CMS-03B-07), `PreviewTokenResource` (CMS-03B-08), `PublicationResource` (CMS-03B-09)                              |
| `workflow-requests.ts`              | OpenAPI transport views (path, headers, body) for CMS-03B-05..09, the CMS-03B-06 decision headers and the If-Match operand helpers               |
| `workflow-read.ts`                  | CMS-03B-15 query and `EntryWorkflowResource` with its preparation, schedules and publications                                                    |
| `review-read.ts`                    | CMS-03B-16 review detail and CMS-03B-17 reviewer queue (query, item, keyset page)                                                                |
| `review-assignment.ts`              | CMS-03B-18 discriminated create/revoke request, headers, resource and the seven-day expiry ceiling                                               |
| `preflight.ts`                      | The 17-category preflight registry (`CMS_PREFLIGHT_REGISTRY`), results, report, aggregation and the accessibility `PreflightEvidence`            |
| `version-set.ts`                    | `versionSetOf(manifest, revision)` and the manifest/version-set consistency check                                                                |
| `refusals.ts`                       | The closed Slice 11 `reasonCode` catalog, per-operation allow-lists and the per-token refusal `details` shapes                                   |
| `events.ts`                         | The four owned event payloads and the BE00 identifier-only envelope                                                                              |
| `settings-registry.ts`              | `CMS_PUBLICATION_SETTINGS_KEYS` (registry version 1, empty) and the settings snapshot shape (E7)                                                 |
| `internal-rpc.ts`                   | CMS-03B-19/20 request and result schemas, the internal operation table and the verifier and sweep constants                                      |
| `jobs.ts`, `observability.ts`       | The BE00 job types, the review dependency recheck job and the Slice 11 metric names with their label sets                                        |
| `route-slo.ts`                      | The shared Tier 1 and Tier 2 SLO objects                                                                                                         |
| `routes-review-publication.ts`      | The nine Slice 11 registry rows                                                                                                                  |
| `time-authority/`                   | The pinned tz snapshot and the shared schedule time resolver (BE03b E8); see its README                                                          |
| `route-policy-base.ts`              | Operation/path/schema vocabularies, capability predicate, telemetry header constants                                                             |
| `route-policy-contract.ts`          | `CmsEditorialRouteContract`, the Tier 1/2 SLO union, and `policyShapeSchema`                                                                     |
| `route-policy-errors.ts`            | `CmsEditorialErrorMap` and the per-operation error envelopes                                                                                     |
| `route-policy.ts`                   | `assertCmsEditorialRouteRegistry` runtime guard                                                                                                  |
| `routes-errors.ts`                  | The `as const` error envelopes the registry rows reference (including the step-up and scoped-list envelopes)                                     |
| `routes.ts`                         | `cmsEditorialRoutePolicies` — the Slice 10 rows followed by the Slice 11 rows (`routes-review-publication.ts`)                                   |

## Ownership

This directory owns every 03b editorial contract schema and route policy. It
does not own 03a schema-registry contracts, BE00 shared envelopes, or web
presentation contracts; import those instead of copying them.

## Runtime Verification Seams

Static Zod can only prove request/response shape, so every operation that
depends on live state or the active schema carries a seam checklist plus a
registry attestation schema.

- CMS-03B-02 (`CONFLICT_RESOLUTION_SEAMS`) and CMS-03B-04
  (`REVISION_RESTORE_SEAMS`) must read the durable conflict record or the
  registered migration chain before a two-parent revision or restored draft may
  be trusted.
- CMS-03B-10 (`ENTRY_CREATE_VERIFICATION_SEAMS`) and CMS-03B-11
  (`ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS`) must resolve active-schema
  identity, field typing, stable-ID binding, target visibility, and content
  hashes.

Each seam array is an **implementation checklist**. The names are not
attestation labels, and repeating them is not evidence that a check ran. The
attestation schemas therefore accept a **server-produced `registry` evidence
object** — the conflict hash and recorded divergent paths, the resolved
migration chain, the compiled artifact identity, the recomputed content hash —
and cross-check it against the request or returned resource. A caller supplying
only seam-name strings is rejected. Even then, a consumer must re-verify the
evidence against a live record or registry read before treating it as authority.

The CMS-03B-02 yours-side evidence is a discriminated union:
`yoursSource: 'revision'` must bind a `yoursRevisionId`, while
`yoursSource: 'proposed'` must carry a 64-hex `proposedValuesHash` with a null
`yoursRevisionId`. The raw proposed values are deliberately absent, so
verification evidence can never leak unpublished draft content.

## Extension Rules

- Add one operation per slice under `CMS_EDITORIAL_OPERATION_IDS` and one
  registry row in `routes.ts`; the assert helper fails closed on a missing or
  extra operation.
- A row declares how its principal is admitted: `gate: 'capability'` is the
  Worker's coarse any-of/all-of check, while `gate: 'rpc_scope'` leaves scope
  (entry assignee, reviewer assignee, submitter, receipt-derived owner) to the RPC
  that answers 403 or 404. A row that requires recent MFA declares
  `stepUp: 'required'` and carries `STEP_UP_REQUIRED` in its errors (and no other
  row does); `assertCmsEditorialRouteRegistry` fails closed on any disagreement.
- Typed refusals are tokens of the closed catalog in `refusals.ts`; a row lists
  the tokens its BE03b matrix allows in `reasonCodes`.
- Declare capabilities as `capabilities` plus `capabilityMode`; never add a
  singular `capability` field. BE03b grants CMS-03B-01, -02, -04, -10, -11, -12,
  -13 and -14 to "cms.author **or** cms.editor", so those rows stay
  `['cms.author', 'cms.editor']` + `any_of`; CMS-03B-03 adds read-only
  `cms.reviewer` to the same any-of gate.
- Add schema names to the unions in `route-policy-base.ts` and the literal sets
  in `route-policy-contract.ts` in the same change as the row, or
  `policyShapeSchema` rejects it.
- Keep each schema file at or below 150 lines and split by concern when a schema
  group outgrows it.

## SLO Tiers

Tier 1 is the read budget (`commandP95Ms: 750`) used by CMS-03B-03, -11, -12, -13,
-14, -16, -17 and the preview mint -08; Tier 2 is the command budget
(`commandP95Ms: 1_200`) used by CMS-03B-01, -02, -04, -05, -06, -07, -09, -10 and
-18, and by the CMS-03B-15 preparation read (its p95 includes the 2,000 ms
accessibility checker). Both share `protectedRpcP95Ms: 300` and
`acceptanceP99Ms: 1_000`. Every Tier 2 command row keeps a `responseTargetMs:
2_000` documentation value, the preparation read keeps `1_200`, and the read rows
and the preview mint keep `750`.

## Conventions

- Objects are `strictObject` and `.readonly()`; unknown keys reject.
- Entry values are bounded as one UTF-8 JSON map to 256 KiB and 128 stable-field
  keys; the shared JSON value schema also rejects nested objects or arrays over
  128 members. The existing eight-level aggregate depth bound still applies.
- Import shared primitives from `../content-schema-registry/primitives.ts` and
  `JsonValueSchema` from `../api-error.ts` rather than redefining them.
- 03b `ResourceMeta` carries only `id`, `version`, `createdAt`, and
  `updatedAt`; `contentHash` lives on the revision resource itself.
- Failure messages are snake_case keys such as `changed_paths_must_be_unique`.
- Rate classes are the closed set `cms-entry-write`, `cms-entry-conflict`,
  `cms-entry-read`, `cms-review-write` (CMS-03B-05, -06), `cms-review-assignment`
  (CMS-03B-18), `cms-schedule-write`, `cms-preview-write` and `cms-publish-write`;
  CMS-03B-02 is the only row on the conflict class. BE03b names actor-keyed classes (author/review/schedule/preview/publish) but locks no literal token, so these eight are this directory canonical runtime tokens.

## Related Links

- [BE03b editorial workflow and publication spec](../../../../.memory/wiki/specs/be/03b-editorial-workflow-publication.md)
- [Content schema registry contracts](../content-schema-registry/README.md)
