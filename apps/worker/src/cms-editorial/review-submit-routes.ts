import {
  CmsEditorialReviewSubmissionHeadersSchema,
  EditorialReviewResourceSchema,
  ReviewSubmissionRequestSchema,
  type EditorialReviewResource,
  type PreflightEvidence,
  type ReviewSubmissionRequest,
} from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import { identifierDisagreement } from './workflow-admission';
import { registerWorkflowCommand } from './workflow-command';
import {
  accessibilityEvidence,
  policyFor,
  uuidParam,
} from './workflow-support';
import {
  CMS_EDITORIAL_SUBMIT_REVIEW_OPERATION_ID,
  type CmsEditorialDependencies,
  type CmsEditorialSubmitReviewPortInput,
} from './types';

const policy = policyFor(CMS_EDITORIAL_SUBMIT_REVIEW_OPERATION_ID);

/**
 * CMS-03B-05 submit review. The entry is bound from the path, the frozen hash
 * and dependency manifest are re-derived by the database, and the submit-phase
 * accessibility proof is produced here immediately before the RPC.
 */
export const registerCmsEditorialSubmitReviewRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void =>
  registerWorkflowCommand<
    E,
    Readonly<{ entryId: string }>,
    ReviewSubmissionRequest,
    EditorialReviewResource,
    CmsEditorialSubmitReviewPortInput,
    PreflightEvidence | null
  >(app, dependencies, {
    policy,
    honoPath: '/api/v1/cms/entries/:entryId/reviews',
    bodySchema: ReviewSubmissionRequestSchema,
    headersSchema: CmsEditorialReviewSubmissionHeadersSchema,
    path: uuidParam('entryId'),
    agree: (path, body) =>
      path.entryId === body.entryId ? null : identifierDisagreement('entryId'),
    port: (ports) => ports.submitReview,
    prepare: (context) =>
      accessibilityEvidence(context, {
        phase: 'submit',
        entryId: context.path.entryId,
        revisionId: context.body.revisionId,
      }),
    build: (base, path, body, evidence) => ({
      operationId: CMS_EDITORIAL_SUBMIT_REVIEW_OPERATION_ID,
      ...base,
      path,
      body,
      evidence,
    }),
    resourceSchema: EditorialReviewResourceSchema,
    accept: (review, path, body) =>
      review.entryId === path.entryId &&
      review.revisionId === body.revisionId &&
      review.state === 'open'
        ? {
            status: 201,
            etag: `"${review.version}"`,
            location: `/api/v1/cms/reviews/${review.id}`,
            entryId: review.entryId,
            labels: { riskClass: review.riskClass },
          }
        : null,
  });
