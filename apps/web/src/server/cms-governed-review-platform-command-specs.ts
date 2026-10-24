import {
  GovernedActivationHeadersSchema,
  GovernedActivationRequestSchema,
  GovernedDecisionHeadersSchema,
  GovernedDecisionRequestSchema,
  GovernedReviewAssignmentHeadersSchema,
  GovernedReviewAssignmentRequestSchema,
  GovernedReviewSubmissionHeadersSchema,
  GovernedReviewSubmissionRequestSchema,
  governedActivationSuccessStatus,
  governedAssignmentSuccessStatus,
  type GovernedActivationRequest,
  type GovernedActivationResource,
  type GovernedDecisionRequest,
  type GovernedReviewAssignmentRequest,
  type GovernedReviewSubmissionRequest,
} from '@wejammin/contracts';

import {
  boundGovernedActivation,
  boundGovernedAssignment,
  boundGovernedDecision,
  boundGovernedSubmission,
} from './cms-governed-review-binding';
import type { GovernedProxyOperation } from './cms-governed-review-platform-error-details';

/**
 * The four governed browser commands as one table (CMS-03C-06 submit, -07
 * decision, -08 assignment, -09 activation): their route, header and request schemas, the
 * version operand the strong `If-Match` must equal, and the verifier that binds
 * a committed resource to the request that produced it.
 */
export type CmsGovernedCommandOperationId = Extract<
  GovernedProxyOperation,
  'CMS-03C-06' | 'CMS-03C-07' | 'CMS-03C-08' | 'CMS-03C-09'
>;

export interface HeaderParse {
  readonly success: boolean;
  readonly data?: {
    readonly idempotencyKey: string;
    readonly ifMatch?: string;
  };
}
export interface GovernedCommandSpec<Body, Resource> {
  readonly operationId: CmsGovernedCommandOperationId;
  readonly route: (reviewId: string | null) => string;
  readonly needsReview: boolean;
  readonly takesIfMatch: boolean;
  readonly requestSchema: {
    readonly safeParse: (value: unknown) =>
      | { readonly success: true; readonly data: Body }
      | {
          readonly success: false;
          readonly error: {
            readonly issues: readonly {
              readonly path: readonly PropertyKey[];
            }[];
          };
        };
  };
  readonly parseHeaders: (input: {
    contentType: string;
    idempotencyKey: string | undefined;
    ifMatch: string | undefined;
  }) => HeaderParse;
  /** The version operand the strong If-Match must equal, or null. */
  readonly expectedVersion: (body: Body) => string | null;
  /** False when the path review and the body disagree. */
  readonly agrees: (reviewId: string | null, body: Body) => boolean;
  readonly successStatus: (body: Body) => 200 | 201 | 202;
  readonly bound: (
    value: unknown,
    reviewId: string | null,
    body: Body,
  ) => Resource | null;
  /** The version the strong `ETag` of a committed answer must quote. */
  readonly etagVersion: (resource: Resource) => string;
  readonly location: (
    reviewId: string | null,
    body: Body,
    resource: Resource,
  ) => string | null;
}

const SUBMIT: GovernedCommandSpec<
  GovernedReviewSubmissionRequest,
  { id: string; version: string }
> = {
  operationId: 'CMS-03C-06',
  route: () => '/api/v1/cms/governed-reviews',
  needsReview: false,
  takesIfMatch: false,
  requestSchema: GovernedReviewSubmissionRequestSchema,
  parseHeaders: ({ contentType, idempotencyKey }) =>
    GovernedReviewSubmissionHeadersSchema.safeParse({
      contentType,
      idempotencyKey,
    }),
  expectedVersion: () => null,
  agrees: () => true,
  successStatus: () => 201,
  bound: (value, _reviewId, body) => boundGovernedSubmission(value, body),
  etagVersion: (resource) => resource.version,
  location: () => null,
};

const DECIDE: GovernedCommandSpec<
  GovernedDecisionRequest,
  { id: string; version: string }
> = {
  operationId: 'CMS-03C-07',
  route: (reviewId) => `/api/v1/cms/governed-reviews/${reviewId}/decision`,
  needsReview: true,
  takesIfMatch: true,
  requestSchema: GovernedDecisionRequestSchema,
  parseHeaders: (input) => GovernedDecisionHeadersSchema.safeParse(input),
  expectedVersion: (body) => body.expectedVersion,
  agrees: (reviewId, body) =>
    reviewId?.toLowerCase() === body.reviewId.toLowerCase(),
  successStatus: () => 200,
  bound: (value, reviewId, body) =>
    boundGovernedDecision(value, reviewId as string, body),
  etagVersion: (resource) => resource.version,
  location: () => null,
};

const ASSIGN: GovernedCommandSpec<
  GovernedReviewAssignmentRequest,
  { id: string; version: string }
> = {
  operationId: 'CMS-03C-08',
  route: (reviewId) => `/api/v1/cms/governed-reviews/${reviewId}/assignments`,
  needsReview: true,
  takesIfMatch: true,
  requestSchema: GovernedReviewAssignmentRequestSchema,
  parseHeaders: (input) =>
    GovernedReviewAssignmentHeadersSchema.safeParse(input),
  expectedVersion: (body) => body.expectedVersion,
  agrees: () => true,
  successStatus: (body) => governedAssignmentSuccessStatus(body.action),
  bound: (value, reviewId, body) =>
    boundGovernedAssignment(value, reviewId as string, body),
  etagVersion: (resource) => resource.version,
  location: (reviewId, body, resource) =>
    body.action === 'create'
      ? `/api/v1/cms/governed-reviews/${reviewId}/assignments/${resource.id}`
      : null,
};

const ACTIVATE: GovernedCommandSpec<
  GovernedActivationRequest,
  GovernedActivationResource
> = {
  operationId: 'CMS-03C-09',
  route: (reviewId) => `/api/v1/cms/governed-reviews/${reviewId}/activation`,
  needsReview: true,
  takesIfMatch: true,
  requestSchema: GovernedActivationRequestSchema,
  parseHeaders: (input) => GovernedActivationHeadersSchema.safeParse(input),
  expectedVersion: (body) => body.expectedVersion,
  agrees: () => true,
  successStatus: (body) => governedActivationSuccessStatus(body.action),
  bound: (value, reviewId, body) =>
    boundGovernedActivation(value, reviewId as string, body),
  // The answer names the review's version after the command, not a resource `version`.
  etagVersion: (resource) => resource.reviewVersion,
  location: (reviewId) => `/api/v1/cms/governed-reviews/${reviewId}`,
};

export const GOVERNED_PROXY_SPECS = {
  'CMS-03C-06': SUBMIT,
  'CMS-03C-07': DECIDE,
  'CMS-03C-08': ASSIGN,
  'CMS-03C-09': ACTIVATE,
} as const;
