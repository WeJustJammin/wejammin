import type { Env, Hono } from 'hono';

import { registerCmsEditorialPreviewRoutes } from './preview-routes';
import { registerCmsEditorialPublicationRoutes } from './publication-routes';
import { registerCmsEditorialAssignmentRoutes } from './review-assignment-routes';
import { registerCmsEditorialDecisionRoutes } from './review-decision-routes';
import { registerCmsEditorialReviewDetailRoutes } from './review-detail-routes';
import { registerCmsEditorialReviewQueueRoutes } from './review-queue-routes';
import { registerCmsEditorialSubmitReviewRoutes } from './review-submit-routes';
import { registerCmsEditorialScheduleRoutes } from './schedule-routes';
import type { CmsEditorialDependencies } from './types';
import { registerCmsEditorialWorkflowReadRoutes } from './workflow-read-routes';

/**
 * The Slice 11 browser operations (CMS-03B-05..09 and 15..18). CMS-03B-19 and
 * CMS-03B-20 are internal RPCs and never appear here: the browser route
 * inventory is exactly the registry.
 */
export const registerCmsEditorialWorkflowRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void => {
  registerCmsEditorialSubmitReviewRoutes(app, dependencies);
  registerCmsEditorialDecisionRoutes(app, dependencies);
  registerCmsEditorialScheduleRoutes(app, dependencies);
  registerCmsEditorialPreviewRoutes(app, dependencies);
  registerCmsEditorialPublicationRoutes(app, dependencies);
  registerCmsEditorialAssignmentRoutes(app, dependencies);
  registerCmsEditorialReviewQueueRoutes(app, dependencies);
  registerCmsEditorialReviewDetailRoutes(app, dependencies);
  registerCmsEditorialWorkflowReadRoutes(app, dependencies);
};
