import { z } from 'zod';

export const CMS_EDITORIAL_OPERATION_IDS = [
  'CMS-03B-01',
  'CMS-03B-02',
  'CMS-03B-03',
  'CMS-03B-04',
  'CMS-03B-10',
  'CMS-03B-11',
  'CMS-03B-12',
  'CMS-03B-13',
  'CMS-03B-14',
  // Slice 11 (DEC-148): review, schedule, preview, publication and the
  // preparation, detail, queue and assignment reads. CMS-03B-19 and CMS-03B-20
  // are internal RPCs and never appear here (see `internal-rpc.ts`).
  'CMS-03B-05',
  'CMS-03B-06',
  'CMS-03B-07',
  'CMS-03B-08',
  'CMS-03B-09',
  'CMS-03B-15',
  'CMS-03B-16',
  'CMS-03B-17',
  'CMS-03B-18',
] as const;

export type CmsEditorialOperationId =
  (typeof CMS_EDITORIAL_OPERATION_IDS)[number];

/**
 * Only these capabilities may open an editorial route. CMS-03B-03 additionally
 * grants reviewer read scope; the Slice 11 commands add `cms.publisher` and the
 * owner-only, non-grantable `cms.editorial_review.assign` (CMS-03B-18, DEC-136).
 * No route grants a capability outside this set.
 */
export type CmsEditorialCapability =
  | 'cms.author'
  | 'cms.editor'
  | 'cms.reviewer'
  | 'cms.publisher'
  | 'cms.editorial_review.assign';

export const CmsEditorialCapabilityModeSchema = z.enum(['any_of', 'all_of']);

export type CmsEditorialCapabilityMode = z.infer<
  typeof CmsEditorialCapabilityModeSchema
>;

export type CmsEditorialPath =
  | '/api/v1/cms/entries/{entryId}/revisions'
  | '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve'
  | '/api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore'
  | '/api/v1/cms/entries'
  | '/api/v1/cms/entries/{entryId}'
  | '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}'
  | '/api/v1/cms/entries/authoring-context'
  | '/api/v1/cms/entries/{entryId}/reviews'
  | '/api/v1/cms/reviews/{reviewId}/decision'
  | '/api/v1/cms/publication-schedules'
  | '/api/v1/cms/previews'
  | '/api/v1/cms/publications'
  | '/api/v1/cms/entries/{entryId}/workflow'
  | '/api/v1/cms/reviews/{reviewId}'
  | '/api/v1/cms/reviews'
  | '/api/v1/cms/reviews/{reviewId}/assignments';

export type CmsEditorialRequestSchemaName =
  | 'EntryRevisionRequestSchema'
  | 'ConflictResolutionRequestSchema'
  | 'RevisionHistoryQuerySchema'
  | 'RevisionRestoreRequestSchema'
  | 'EntryCreateRequestSchema'
  | 'EntryDraftDetailQuerySchema'
  | 'ConflictDetailQuerySchema'
  | 'EntryListQuerySchema'
  | 'AuthoringContextQuerySchema'
  | 'ReviewSubmissionRequestSchema'
  | 'EditorialDecisionRequestSchema'
  | 'PublicationScheduleRequestSchema'
  | 'PreviewRequestSchema'
  | 'PublicationRequestSchema'
  | 'EntryWorkflowQuerySchema'
  | 'EditorialReviewDetailQuerySchema'
  | 'ReviewQueueQuerySchema'
  | 'EditorialReviewAssignmentRequestSchema';

export type CmsEditorialSuccessSchemaName =
  | 'EntryRevisionResourceSchema'
  | 'RevisionHistoryPageSchema'
  | 'EntryCreateResourceSchema'
  | 'EntryDraftDetailResourceSchema'
  | 'ConflictDetailResourceSchema'
  | 'EntryListPageSchema'
  | 'AuthoringContextResourceSchema'
  | 'EditorialReviewResourceSchema'
  | 'PublicationScheduleResourceSchema'
  | 'PreviewTokenResourceSchema'
  | 'PublicationResourceSchema'
  | 'EntryWorkflowResourceSchema'
  | 'EditorialReviewDetailResourceSchema'
  | 'ReviewQueuePageSchema'
  | 'EditorialReviewAssignmentResourceSchema';

export type CmsEditorialPathParamsSchemaName =
  | 'EntryRevisionPathParamsSchema'
  | 'ConflictResolutionPathParamsSchema'
  | 'RevisionHistoryPathParamsSchema'
  | 'RevisionRestorePathParamsSchema'
  | 'EntryDraftDetailPathParamsSchema'
  | 'ConflictDetailPathParamsSchema'
  | 'CmsEditorialReviewSubmissionPathParamsSchema'
  | 'CmsEditorialDecisionPathParamsSchema'
  | 'EntryWorkflowPathParamsSchema'
  | 'EditorialReviewDetailPathParamsSchema'
  | 'EditorialReviewAssignmentPathParamsSchema';

export type CmsEditorialErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHENTICATED'
  | 'STEP_UP_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'VALIDATION_FAILED'
  | 'RATE_LIMITED'
  | 'BAD_GATEWAY'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'GATEWAY_TIMEOUT'
  | 'INTERNAL_ERROR';

export type CmsEditorialErrorStatus =
  400 | 401 | 403 | 404 | 409 | 415 | 422 | 429 | 500 | 502 | 503 | 504;

/** Trusted dependency-read proof consumed by the browser retry gate. */
export const CMS_EDITORIAL_RETRYABLE_HEADER =
  'x-cms-editorial-retryable' as const;

/** Internal presentation proof for the server-rendered editorial workbench. */
export const CMS_EDITORIAL_CAPABILITY_HEADER =
  'x-cms-editorial-capabilities' as const;

/**
 * Explicit any-of/all-of capability check.  CMS-03B-01 declares
 * `['cms.author', 'cms.editor']` with `any_of` because BE03b grants the route
 * to "cms.author or cms.editor", so author-only and editor-only both pass.
 */
export const cmsEditorialCapabilitiesSatisfied = (
  required: readonly CmsEditorialCapability[],
  mode: CmsEditorialCapabilityMode,
  granted: readonly string[],
): boolean => {
  // Fail closed: every editorial route declares at least one capability, so an
  // empty requirement is a contract error rather than a vacuous grant.
  if (required.length === 0) return false;
  const grantedCapabilities = new Set(granted);
  return mode === 'any_of'
    ? required.some((capability) => grantedCapabilities.has(capability))
    : required.every((capability) => grantedCapabilities.has(capability));
};
