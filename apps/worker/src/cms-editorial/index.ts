import { Hono, type Env } from 'hono';

import { registerCmsEditorialConflictRoutes } from './conflict-routes';
import { registerCmsEditorialCreateRoutes } from './create-routes';
import { registerCmsEditorialDetailRoutes } from './detail-routes';
import { registerCmsEditorialHistoryRoutes } from './history-routes';
import { registerCmsEditorialRestoreRoutes } from './restore-routes';
import { registerCmsEditorialRoutes as registerRevisionRoutes } from './routes';
import type { CmsEditorialDependencies } from './types';

export const registerCmsEditorialRoutes = <E extends Env>(
  app: Hono<E>,
  dependencies: CmsEditorialDependencies,
): void => {
  registerRevisionRoutes(app, dependencies);
  registerCmsEditorialConflictRoutes(app, dependencies);
  registerCmsEditorialCreateRoutes(app, dependencies);
  registerCmsEditorialHistoryRoutes(app, dependencies);
  registerCmsEditorialRestoreRoutes(app, dependencies);
  registerCmsEditorialDetailRoutes(app, dependencies);
};

export const createCmsEditorialApp = (
  dependencies: CmsEditorialDependencies,
): Hono => {
  const app = new Hono();
  registerCmsEditorialRoutes(app, dependencies);
  return app;
};
export type {
  CmsEditorialDependencies,
  CmsEditorialConflictPortInput,
  CmsEditorialCreatePortInput,
  CmsEditorialDraftPortInput,
  CmsEditorialHistoryPortInput,
  CmsEditorialRestorePortInput,
  CmsEditorialPortInput,
  CmsEditorialResult,
  CmsEditorialSession,
} from './types';
