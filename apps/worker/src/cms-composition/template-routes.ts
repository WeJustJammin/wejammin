import { Hono, type Env } from 'hono';

import { instrumentComposition } from './observability-instrument';
import { registerCmsTemplateContextRoutes } from './template-context-routes';
import { registerCmsTemplateVersionRoutes } from './template-version-routes';
import type { CmsTemplateDependencies } from './template-shared';

export {
  DEADLINE_MS,
  dependencyUnavailable,
  failure,
  invalidDependency,
  validEnvelope,
  validRateDecision,
} from './template-shared';
export type {
  CmsTemplateContextPortInput,
  CmsTemplateDependencies,
  CmsTemplateDetailPortInput,
  CmsTemplateError,
  CmsTemplatePortInput,
  CmsTemplateRateDecision,
  CmsTemplateRateInput,
  CmsTemplateResult,
  CmsTemplateTelemetry,
} from './template-shared';
export { commonHeaders, errorResponse } from './template-respond';

export const registerCmsTemplateRoutes = <E extends Env>(
  app: Hono<E>,
  registered: CmsTemplateDependencies,
): void => {
  // BE03c Observability: the request event lists only the stages the request reached.
  const dependencies = instrumentComposition(registered, {
    writes: ['defineTemplate'],
    reads: ['readContext', 'readLatest'],
  });
  registerCmsTemplateContextRoutes(app, dependencies);
  registerCmsTemplateVersionRoutes(app, dependencies);
};

export const createCmsTemplateApp = (
  dependencies: CmsTemplateDependencies,
): Hono => {
  const app = new Hono();
  registerCmsTemplateRoutes(app, dependencies);
  return app;
};
