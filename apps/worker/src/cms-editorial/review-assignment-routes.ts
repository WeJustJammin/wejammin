import {
  CmsEditorialReviewAssignmentHeadersSchema,
  EditorialReviewAssignmentRequestSchema,
  EditorialReviewAssignmentResourceSchema,
  reviewAssignmentSuccessStatus,
  type EditorialReviewAssignmentRequest,
  type EditorialReviewAssignmentResource,
} from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import { registerWorkflowCommand } from './workflow-command';
import { noPreparation, policyFor, uuidParam } from './workflow-support';
import {
  CMS_EDITORIAL_ASSIGNMENT_OPERATION_ID,
  type CmsEditorialAssignmentPortInput,
  type CmsEditorialDependencies,
} from './types';

const policy = policyFor(CMS_EDITORIAL_ASSIGNMENT_OPERATION_ID);

/**
 * CMS-03B-18 assign or revoke a reviewer. Only the receipt-derived owner may
 * act, so the Worker applies no coarse capability gate (`rpc_scope`); step-up is
 * unconditional. A create answers `201` with a Location, a revoke `200` without.
 */
export const registerCmsEditorialAssignmentRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void =>
  registerWorkflowCommand<
    E,
    Readonly<{ reviewId: string }>,
    EditorialReviewAssignmentRequest,
    EditorialReviewAssignmentResource,
    CmsEditorialAssignmentPortInput,
    null
  >(app, dependencies, {
    policy,
    honoPath: '/api/v1/cms/reviews/:reviewId/assignments',
    bodySchema: EditorialReviewAssignmentRequestSchema,
    headersSchema: CmsEditorialReviewAssignmentHeadersSchema,
    path: uuidParam('reviewId'),
    agree: () => null,
    expectedVersion: (body) => body.expectedVersion,
    labels: (body) => ({ assignmentAction: body.action }),
    port: (ports) => ports.assignEditorialReviewer,
    prepare: noPreparation,
    build: (base, path, body) => ({
      operationId: CMS_EDITORIAL_ASSIGNMENT_OPERATION_ID,
      ...base,
      path,
      body,
    }),
    resourceSchema: EditorialReviewAssignmentResourceSchema,
    accept: (assignment, path, body) => {
      if (assignment.reviewId !== path.reviewId) return null;
      if (body.action === 'revoke')
        return assignment.id === body.assignmentId &&
          assignment.state === 'revoked'
          ? {
              status: reviewAssignmentSuccessStatus('revoke'),
              etag: `"${assignment.version}"`,
              location: null,
              entryId: null,
            }
          : null;
      return assignment.state === 'active'
        ? {
            status: reviewAssignmentSuccessStatus('create'),
            etag: `"${assignment.version}"`,
            location: `/api/v1/cms/reviews/${assignment.reviewId}/assignments/${assignment.id}`,
            entryId: null,
          }
        : null;
    },
  });
