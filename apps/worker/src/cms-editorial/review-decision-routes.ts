import {
  CmsEditorialDecisionHeadersSchema,
  EditorialDecisionRequestSchema,
  EditorialReviewResourceSchema,
  type EditorialDecisionRequest,
  type EditorialReviewResource,
} from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import { identifierDisagreement } from './workflow-admission';
import { registerWorkflowCommand } from './workflow-command';
import { noPreparation, policyFor, uuidParam } from './workflow-support';
import {
  CMS_EDITORIAL_DECISION_OPERATION_ID,
  type CmsEditorialDecisionPortInput,
  type CmsEditorialDependencies,
} from './types';

const policy = policyFor(CMS_EDITORIAL_DECISION_OPERATION_ID);

/**
 * CMS-03B-06 record decision. Step-up is unconditional (E6) and the reviewer
 * scope, separation of duties and the decision count are the database's: the
 * Worker binds the review from the path and answers the review at its new
 * version.
 */
export const registerCmsEditorialDecisionRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void =>
  registerWorkflowCommand<
    E,
    Readonly<{ reviewId: string }>,
    EditorialDecisionRequest,
    EditorialReviewResource,
    CmsEditorialDecisionPortInput,
    null
  >(app, dependencies, {
    policy,
    honoPath: '/api/v1/cms/reviews/:reviewId/decision',
    bodySchema: EditorialDecisionRequestSchema,
    headersSchema: CmsEditorialDecisionHeadersSchema,
    path: uuidParam('reviewId'),
    agree: (path, body) =>
      path.reviewId === body.reviewId
        ? null
        : identifierDisagreement('reviewId'),
    expectedVersion: (body) => body.expectedVersion,
    labels: (body) => ({ decision: body.decision }),
    port: (ports) => ports.recordDecision,
    prepare: noPreparation,
    build: (base, path, body) => ({
      operationId: CMS_EDITORIAL_DECISION_OPERATION_ID,
      ...base,
      path,
      body,
    }),
    resourceSchema: EditorialReviewResourceSchema,
    // A recorded decision leaves the review open (more decisions required),
    // approved or rejected; an invalidation is a refusal, never this success.
    accept: (review, path) =>
      review.id === path.reviewId && review.state !== 'invalidated'
        ? {
            status: 200,
            etag: `"${review.version}"`,
            location: null,
            entryId: review.entryId,
          }
        : null,
  });
