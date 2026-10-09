import {
  EditorialReviewDetailResourceSchema,
  type EditorialReviewDetailResource,
} from '@wejammin/contracts';
import type { Env, Hono } from 'hono';

import { registerWorkflowRead } from './workflow-read';
import {
  closedQuery,
  noPreparation,
  policyFor,
  uuidParam,
} from './workflow-support';
import {
  CMS_EDITORIAL_REVIEW_DETAIL_OPERATION_ID,
  type CmsEditorialDependencies,
  type CmsEditorialReviewDetailPortInput,
} from './types';

const policy = policyFor(CMS_EDITORIAL_REVIEW_DETAIL_OPERATION_ID);
const NO_QUERY: ReadonlySet<string> = new Set();

/**
 * CMS-03B-16 review detail. Addressed entirely by the path (any query key is a
 * 400); the database resolves the reader scope and conceals a hidden review.
 * The strong validator is the review version.
 */
export const registerCmsEditorialReviewDetailRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void =>
  registerWorkflowRead<
    E,
    Readonly<{ reviewId: string }>,
    Record<never, never>,
    EditorialReviewDetailResource,
    CmsEditorialReviewDetailPortInput,
    null
  >(app, dependencies, {
    policy,
    honoPath: '/api/v1/cms/reviews/:reviewId',
    path: uuidParam('reviewId'),
    query: (request) => {
      const members = closedQuery(request, NO_QUERY);
      return members.ok ? { ok: true, value: {} } : members;
    },
    port: (ports) => ports.getEditorialReview,
    prepare: noPreparation,
    build: (base, path) => ({
      operationId: CMS_EDITORIAL_REVIEW_DETAIL_OPERATION_ID,
      ...base,
      path,
    }),
    resourceSchema: EditorialReviewDetailResourceSchema,
    accept: async (review, path) =>
      review.id === path.reviewId
        ? {
            etag: `"${review.version}"`,
            entryId: review.entryId,
            counts: {
              decisions_returned: review.decisions.length,
              assignments_returned: review.assignments.length,
            },
          }
        : null,
  });
