# CMS Editorial Contracts (03b)

Runtime Zod 4 contracts for the editorial workflow and publication shard. These
schemas are the single source for TypeScript types, Hono validation, OpenAPI,
tests, and JSONB checks in Shard 03b. The registry currently locks six
operations: CMS-03B-01 (existing-entry revision), CMS-03B-02 (conflict
resolution), CMS-03B-03 (revision history read), CMS-03B-04 (revision restore),
CMS-03B-10 (entry create), and CMS-03B-11 (draft-detail read).

## Contents

| File                       | Owns                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `primitives.ts`            | `Bcp47Schema`, `JsonPointerSchema`, `ChangedPathsSchema`, `BoundedEntryValuesSchema`, `cmsEditorialJsonDepth`                  |
| `models.ts`                | Entry revision and conflict state vocabularies, plus the shared revision meta shape                                            |
| `resources.ts`             | `EntryRevisionResourceSchema`, `ConflictRecordResourceSchema`, and the bounded proposed-values envelope                        |
| `requests.ts`              | `EntryRevisionRequestSchema` plus its path-parameter and header schemas, and the CMS-03B-01 `*ApiRequestSchema` transport view |
| `schema-evidence.ts`       | `SchemaArtifactEvidenceSchema`, `ValidatorEvidenceSchema`                                                                      |
| `entry-create.ts`          | CMS-03B-10 request/headers/resource plus the create seam checklist                                                             |
| `entry-draft-detail.ts`    | CMS-03B-11 path/query/resource plus the draft-detail seam checklist                                                            |
| `conflict-resolution.ts`   | CMS-03B-02 request/path/headers, the caller-authority guard, and the seam names                                                |
| `conflict-choice.ts`       | `ConflictChoiceSchema` and the bounded `ConflictChoiceValueSchema`                                                             |
| `conflict-verification.ts` | `ConflictYoursSourceEvidenceSchema`; the canonical yours-source enum lives in `models.ts`                                      |
| `revision-history.ts`      | CMS-03B-03 page, compare, path, and query schemas                                                                              |
| `revision-restore.ts`      | CMS-03B-04 request/path/headers plus the restore registry attestation                                                          |
| `route-policy-base.ts`     | Operation/path/schema vocabularies, capability predicate, telemetry header constants                                           |
| `route-policy-contract.ts` | `CmsEditorialRouteContract`, the Tier 1/2 SLO union, and `policyShapeSchema`                                                   |
| `route-policy-errors.ts`   | `CmsEditorialErrorMap` and the six per-operation error envelopes                                                               |
| `route-policy.ts`          | `assertCmsEditorialRouteRegistry` runtime guard                                                                                |
| `routes-errors.ts`         | The six `as const` error envelopes the registry rows reference                                                                 |
| `routes.ts`                | `cmsEditorialRoutePolicies` — the six registry rows                                                                            |

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
- Declare capabilities as `capabilities` plus `capabilityMode`; never add a
  singular `capability` field. BE03b grants CMS-03B-01, -02, -04, -10, and -11
  to "cms.author **or** cms.editor", so those rows stay
  `['cms.author', 'cms.editor']` + `any_of`; CMS-03B-03 adds read-only
  `cms.reviewer` to the same any-of gate.
- Add schema names to the unions in `route-policy-base.ts` and the literal sets
  in `route-policy-contract.ts` in the same change as the row, or
  `policyShapeSchema` rejects it.
- Keep each schema file at or below 150 lines and split by concern when a schema
  group outgrows it.

## SLO Tiers

Tier 1 is the read budget (`commandP95Ms: 750`) used by CMS-03B-03 and
CMS-03B-11; Tier 2 is the command budget (`commandP95Ms: 1_200`) used by
CMS-03B-01, -02, -04, and -10. Both share `protectedRpcP95Ms: 300` and
`acceptanceP99Ms: 1_000`. 03b has no 2s acceptance-target row yet, so every
command row keeps a `responseTargetMs: 2_000` documentation value while the
read rows keep `750`.

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
- Rate classes are the closed set `cms-entry-write`, `cms-entry-conflict`, and
  `cms-entry-read`; CMS-03B-02 is the only row on the conflict class. BE03b names actor-keyed classes (author/review/schedule/preview/publish) but locks no literal token, so these three are this directory canonical runtime tokens.

## Related Links

- [BE03b editorial workflow and publication spec](../../../../.memory/wiki/specs/be/03b-editorial-workflow-publication.md)
- [Content schema registry contracts](../content-schema-registry/README.md)
