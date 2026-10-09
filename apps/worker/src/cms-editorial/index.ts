import { Hono, type Env } from 'hono';

import { registerCmsEditorialAuthoringContextRoutes } from './authoring-context-routes';
import { registerCmsEditorialConflictRoutes } from './conflict-routes';
import { registerCmsEditorialConflictDetailRoutes } from './conflict-detail-routes';
import { registerCmsEditorialCreateRoutes } from './create-routes';
import { registerCmsEditorialDetailRoutes } from './detail-routes';
import { registerCmsEditorialHistoryRoutes } from './history-routes';
import { registerCmsEditorialListRoutes } from './list-routes';
import { registerCmsEditorialRestoreRoutes } from './restore-routes';
import { registerCmsEditorialRoutes as registerRevisionRoutes } from './routes';
import { instrumentDependencies } from './route-stages';
import { registerCmsEditorialWorkflowRoutes } from './workflow-routes';
import type { CmsEditorialDependencies } from './types';

export const registerCmsEditorialRoutes = <E extends Env>(
  app: Hono<E>,
  injected: CmsEditorialDependencies,
): void => {
  // Every seam is wrapped once so telemetry can state which stages truly ran.
  const dependencies = instrumentDependencies(injected);
  registerRevisionRoutes(app, dependencies);
  registerCmsEditorialConflictRoutes(app, dependencies);
  registerCmsEditorialCreateRoutes(app, dependencies);
  registerCmsEditorialHistoryRoutes(app, dependencies);
  registerCmsEditorialRestoreRoutes(app, dependencies);
  // The literal authoring-context read registers before the `:entryId` detail
  // route so the segment is not captured as an entry UUID.
  registerCmsEditorialAuthoringContextRoutes(app, dependencies);
  registerCmsEditorialListRoutes(app, dependencies);
  registerCmsEditorialDetailRoutes(app, dependencies);
  registerCmsEditorialConflictDetailRoutes(app, dependencies);
  registerCmsEditorialWorkflowRoutes(app, dependencies);
};

export const createCmsEditorialApp = (
  dependencies: CmsEditorialDependencies,
): Hono => {
  const app = new Hono();
  registerCmsEditorialRoutes(app, dependencies);
  return app;
};
export type {
  CmsEditorialAssignmentPortInput,
  CmsEditorialDecisionPortInput,
  CmsEditorialDependencies,
  CmsEditorialPreviewPortInput,
  CmsEditorialPublishPortInput,
  CmsEditorialQualityGate,
  CmsEditorialQualityGateInput,
  CmsEditorialReviewDetailPortInput,
  CmsEditorialReviewQueuePortInput,
  CmsEditorialSchedulePortInput,
  CmsEditorialSubmitReviewPortInput,
  CmsEditorialWorkflowPortInput,
  CmsEditorialAuthoringContextPortInput,
  CmsEditorialConflictPortInput,
  CmsEditorialConflictDetailPortInput,
  CmsEditorialCreatePortInput,
  CmsEditorialDraftPortInput,
  CmsEditorialEntryListPortInput,
  CmsEditorialHistoryPortInput,
  CmsEditorialRestorePortInput,
  CmsEditorialPortInput,
  CmsEditorialResult,
  CmsEditorialSession,
} from './types';
