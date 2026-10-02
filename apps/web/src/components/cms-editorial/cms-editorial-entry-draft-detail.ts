import {
  CmsUuidSchema,
  ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS,
  EntryDraftDetailPathParamsSchema,
  EntryDraftDetailQuerySchema,
  EntryDraftDetailResourceSchema,
  EntryDraftDetailSchemaValidationSchema,
  EntryDraftFieldValueSchema,
  EntryDraftRelationSchema,
} from '@wejammin/contracts';
import type {
  EntryDraftDetailPathParams,
  EntryDraftDetailQuery,
  EntryDraftDetailResource,
  EntryDraftFieldValue,
  EntryDraftRelation,
} from '@wejammin/contracts';

/**
 * Browser-facing projection of the locked BE03b CMS-03B-11 draft-detail read
 * for the CMS-05 entry workbench.
 *
 * Source of truth: .memory/wiki/specs/be/03b-editorial-workflow-publication.md
 * (Request/Response Contracts 660-712; route rows 823 and 903). FE03
 * (.memory/wiki/specs/fe/03-cms-content-modeling.md:378-391 and :750) assigns
 * this operation to `cms-editorial-entry-draft-detail` with
 * `browserPolicy: 'protected-read-only'` and no optimistic state.
 *
 * `packages/contracts/src/cms-editorial/` has landed, so every schema below is
 * the shared contract re-exported instead of a second, drift-prone copy. Only
 * what the browser itself owns stays local: the honest transport boundary and
 * the fail-closed page resolver. The read carries no body, no Idempotency-Key
 * and no If-Match, and it never mutates on GET.
 */

export const CMS_EDITORIAL_ENTRY_DRAFT_DETAIL_SOURCE = {
  source: 'packages/contracts/src/cms-editorial/entry-draft-detail.ts',
  spec: '.memory/wiki/specs/be/03b-editorial-workflow-publication.md',
  browserLocal:
    'CMS_EDITORIAL_ENTRY_DRAFT_DETAIL_BOUNDARY and resolveCmsEditorialEntryDraftDetailPageState',
} as const;

/** BE03b CMS-03B-11 addressing: exactly one UUID path parameter. */
export const CmsEditorialEntryDraftDetailPathParamsSchema =
  EntryDraftDetailPathParamsSchema;

/** BE03b `EntryDraftDetailQuery`: the bound entry id plus optional locale. */
export const CmsEditorialEntryDraftDetailQuerySchema =
  EntryDraftDetailQuerySchema;

/** BE03b `EntryDraftFieldValue`: bounded JSON plus closed provenance. */
export const CmsEditorialEntryDraftFieldValueSchema =
  EntryDraftFieldValueSchema;

/** BE03b `EntryDraftRelation`: target binding plus unavailable policy. */
export const CmsEditorialEntryDraftRelationSchema = EntryDraftRelationSchema;

/** BE03b `EntryDraftDetailResource`: the closed draft-detail envelope. */
export const CmsEditorialEntryDraftDetailResourceSchema =
  EntryDraftDetailResourceSchema;

/**
 * The checks static Zod cannot prove, which is why a read is only trusted once
 * the active-schema resolution attested every seam exactly once.
 */
export const CMS_EDITORIAL_ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS =
  ENTRY_DRAFT_DETAIL_SCHEMA_VALIDATION_SEAMS;

/** Fail-closed attestation that the read resolved against the active schema. */
export const CmsEditorialEntryDraftDetailSchemaValidationSchema =
  EntryDraftDetailSchemaValidationSchema;

/**
 * Honest browser boundary. FE03 authorises CMS-03B-11, the shared contract is
 * implemented and registered, and the first-party proxy now exists at
 * apps/web/src/server/cms-editorial-platform-reads.ts. The Worker serves the
 * protected GET route and named production getEntryDraft port. The private RPC
 * checks active-schema fields and content-relation visibility; unsupported
 * projections refuse. The page may render verified read metadata, but no
 * authoring editor is wired and no hosted read has been accepted.
 */
export const CMS_EDITORIAL_ENTRY_DRAFT_DETAIL_BOUNDARY = {
  status: 'local-production-read-bound-hosted-unverified',
  operationId: 'CMS-03B-11',
  method: 'GET',
  path: '/api/v1/cms/entries/{entryId}',
  successStatus: 200,
  browserPolicy: 'protected-read-only',
  idempotencyRequired: false,
  ifMatchRequired: false,
  locationRequired: false,
  etag: 'strong',
  cacheControl: 'no-store',
  blocker:
    'The CMS-03B-11 proxy, protected Worker route, and named production RPC adapter are implemented locally; unsupported projections fail closed and hosted acceptance is unverified.',
  owner: '03b-editorial-workflow-publication.md',
  spec: '.memory/wiki/specs/be/03b-editorial-workflow-publication.md',
} as const;

/**
 * Safe copy for the disabled draft surface. Fixed and non-disclosing: it must
 * not hint whether any entry exists or whether the caller may read it.
 */
export const CMS_EDITORIAL_ENTRY_DRAFT_DETAIL_DISABLED_REASON =
  'Draft detail is unavailable, and no entry values were loaded.';

export type CmsEditorialEntryDraftDetailPageResolution =
  { readonly kind: 'not-found' } | { readonly kind: 'loadable' };

/**
 * Resolves the addressing state without loading values.
 *
 * An id that is not a UUID addresses no entry at all, so the page answers
 * `not-found` and never echoes the malformed input back. A well-formed id is
 * loadable in principle, so the page hands control to the protected read
 * attempt rather than pre-deciding a disabled state; the absent, the forbidden,
 * and the read cases stay distinguishable only through the authenticated
 * upstream, never through client-side guessing.
 */
export const resolveCmsEditorialEntryDraftDetailPageState = (input: {
  readonly entryId: string;
}): CmsEditorialEntryDraftDetailPageResolution =>
  CmsUuidSchema.safeParse(input.entryId).success
    ? { kind: 'loadable' }
    : { kind: 'not-found' };

export type CmsEditorialEntryDraftDetailPathParams = EntryDraftDetailPathParams;
export type CmsEditorialEntryDraftDetailQuery = EntryDraftDetailQuery;
export type CmsEditorialEntryDraftFieldValue = EntryDraftFieldValue;
export type CmsEditorialEntryDraftRelation = EntryDraftRelation;
export type CmsEditorialEntryDraftDetailResource = EntryDraftDetailResource;
