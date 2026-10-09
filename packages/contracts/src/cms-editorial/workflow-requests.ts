import { z } from 'zod';

import { CmsUuidSchema } from '../content-schema-registry/primitives.ts';
import {
  IdempotencyKeySchema,
  QuotedVersionSchema,
} from '../request-navigation-security.ts';
import { refineIfMatchEqualsExpectedVersion } from './if-match.ts';
import {
  CmsEditorialReviewSubmissionHeadersSchema,
  EditorialDecisionRequestSchema,
  ReviewSubmissionRequestSchema,
} from './publication-contracts.ts';
import {
  CmsPreviewRequestHeadersSchema,
  CmsPublicationRequestHeadersSchema,
  CmsPublicationScheduleHeadersSchema,
  PreviewRequestSchema,
  PublicationRequestSchema,
  PublicationScheduleRequestSchema,
} from './publication-schedule-contracts.ts';

/*
 * OpenAPI transport views for the five Slice 11 commands. The generated
 * document needs one schema that names every parameter location; each body is
 * the runtime request schema rather than a restated copy (the Slice 10 pattern,
 * `EntryRevisionApiRequestSchema`).
 */

/**
 * BE03b CMS-03B-06 headers: key + exact strong If-Match over JSON. The
 * If-Match operand is the review `version`, and the body `expectedVersion` must
 * equal it (`cmsEditorialIfMatchEqualsExpectedVersion`, enforced by the composite
 * transport view below).
 */
export const CmsEditorialDecisionHeadersSchema = z
  .strictObject({
    contentType: z.literal('application/json'),
    idempotencyKey: IdempotencyKeySchema,
    ifMatch: QuotedVersionSchema,
  })
  .readonly();

/** CMS-03B-05 transport view: the entry path, command headers and body. */
export const ReviewSubmissionApiRequestSchema = z.strictObject({
  entryId: CmsUuidSchema,
  headers: CmsEditorialReviewSubmissionHeadersSchema,
  body: ReviewSubmissionRequestSchema,
});

/** CMS-03B-06 transport view: the review path, command headers and body. */
export const EditorialDecisionApiRequestSchema = z
  .strictObject({
    reviewId: CmsUuidSchema,
    headers: CmsEditorialDecisionHeadersSchema,
    body: EditorialDecisionRequestSchema,
  })
  .superRefine(refineIfMatchEqualsExpectedVersion);

/** CMS-03B-07 transport view: the route has no path parameters. */
export const PublicationScheduleApiRequestSchema = z
  .strictObject({
    headers: CmsPublicationScheduleHeadersSchema,
    body: PublicationScheduleRequestSchema,
  })
  .superRefine(refineIfMatchEqualsExpectedVersion);

/** CMS-03B-08 transport view: the route has no path parameters. */
export const PreviewApiRequestSchema = z.strictObject({
  headers: CmsPreviewRequestHeadersSchema,
  body: PreviewRequestSchema,
});

/** CMS-03B-09 transport view: the route has no path parameters. */
export const PublicationApiRequestSchema = z
  .strictObject({
    headers: CmsPublicationRequestHeadersSchema,
    body: PublicationRequestSchema,
  })
  .superRefine(refineIfMatchEqualsExpectedVersion);

export type EditorialDecisionHeaders = z.infer<
  typeof CmsEditorialDecisionHeadersSchema
>;
