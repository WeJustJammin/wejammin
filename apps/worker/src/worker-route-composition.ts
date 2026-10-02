import {
  ApiErrorSchema,
  HealthResponseSchema,
  ReadinessResponseSchema,
} from '@wejammin/contracts';
import type { Logger, LogEventDetails } from '@wejammin/observability/logging';

import { registerAc265HostedRoutes } from './ac265-hosted/routes';
import { registerDiagnosticsRoute } from './diagnostics';
import { registerAuthenticationRoutes } from './authentication/routes';
import { createContentSchemaRegistryApp } from './content-schema-registry/routes';
import { registerCmsEditorialRoutes } from './cms-editorial';
import { registerCmsTemplateRoutes } from './cms-composition/template-routes';
import { registerCmsLocaleRoutes } from './cms-composition/locale-routes';
import { registerCmsTaxonomyRoutes } from './cms-composition/taxonomy-routes';
import { registerCmsPatternInstanceRoutes } from './cms-composition/pattern-instance-routes';
import { registerCmsRelatedContentRoutes } from './cms-composition/related-content-routes';
import { registerCmsTemplateDetailRoutes } from './cms-composition/template-detail-routes';
import { registerJobStatusRoute } from './jobs/job-status';
import { registerUploadCompletionRoute } from './upload-completion/upload-intent-completion';
import { registerIdentityAuthorityRoutes } from './identity-authority/routes';
import { registerProfileOwnershipRoutes } from './profile-ownership/routes';
import { registerProfilePortfolioRoutes } from './profile-portfolio/routes';
import { registerPlatformConfigurationRoutes } from './platform-configuration/routes';
import type { WorkerApp, WorkerDependencies } from './index';

export const routeTemplateFor = (routePath: string): string =>
  routePath.startsWith('/') ? routePath : '/_unmatched';

export const logRequest = (
  logger: Logger,
  details: LogEventDetails,
  status: number,
): void => {
  if (status >= 500) {
    logger.error(details);
  } else if (status >= 400) {
    logger.warn(details);
  } else {
    logger.info(details, { samplingClass: 'public_success' });
  }
};

const registerHealthRoutes = (
  app: WorkerApp,
  dependencies: WorkerDependencies,
): void => {
  app.get('/api/v1/health', (context) => {
    context.set('operation', 'health.read');
    const payload = HealthResponseSchema.parse({
      requestId: context.get('requestId'),
      service: 'wejammin-api',
      status: 'ok',
      version: 'v1',
    });

    return context.json(payload);
  });

  app.get('/api/v1/ready', async (context) => {
    context.set('operation', 'readiness.read');
    let ready = false;
    if (dependencies.checkReadiness !== undefined) {
      try {
        const result = await dependencies.checkReadiness(
          context.req.raw,
          context.env,
        );
        ready =
          typeof result === 'boolean'
            ? result
            : typeof result === 'object' &&
                result !== null &&
                typeof result.ready === 'boolean'
              ? result.ready
              : false;
      } catch {
        ready = false;
      }
    }

    const payload = ReadinessResponseSchema.parse({
      requestId: context.get('requestId'),
      service: 'wejammin-api',
      status: ready ? 'ready' : 'not_ready',
      version: 'v1',
    });
    context.header('cache-control', 'no-store');
    if (ready) return context.json(payload, 200);
    context.set('errorCode', 'DEPENDENCY_UNAVAILABLE');
    context.header('retry-after', '5');
    return context.json(payload, 503);
  });
};

const registerUploadRoutes = (
  app: WorkerApp,
  dependencies: WorkerDependencies,
): void => {
  registerJobStatusRoute(app, dependencies.jobs);
  registerUploadCompletionRoute(app, dependencies.uploadCompletion);

  app.post('/api/v1/upload-intents', async (context) => {
    context.set('operation', 'uploadIntentCreate');
    if (dependencies.uploadIntent !== undefined) {
      return dependencies.uploadIntent(context.req.raw);
    }

    context.set('errorCode', 'DEPENDENCY_UNAVAILABLE');
    context.header('cache-control', 'no-store');
    context.header('retry-after', '5');
    const payload = ApiErrorSchema.parse({
      code: 'DEPENDENCY_UNAVAILABLE',
      details: {},
      message: 'Upload admission is not available.',
      requestId: context.get('requestId'),
    });
    return context.json(payload, 503);
  });
};

const registerWebhookRoutes = (
  app: WorkerApp,
  dependencies: WorkerDependencies,
): void => {
  const webhookPaths = new Set<string>();
  for (const route of dependencies.webhookRoutes ?? []) {
    if (
      !/^\/api\/v1\/webhooks\/[a-z][a-z0-9_.-]{0,63}$/u.test(route.path) ||
      webhookPaths.has(route.path)
    ) {
      throw new Error('Webhook route registration is invalid.');
    }
    webhookPaths.add(route.path);
    app.post(route.path, (context) => {
      context.set('operation', 'providerWebhookReceive');
      return route.handler(context.req.raw);
    });
  }
};

const registerFallbackHandlers = (
  app: WorkerApp,
  dependencies: WorkerDependencies,
): void => {
  app.notFound((context) => {
    context.set('errorCode', 'NOT_FOUND');
    context.set('operation', 'route.lookup');
    context.header('cache-control', 'no-store');
    const payload = ApiErrorSchema.parse({
      code: 'NOT_FOUND',
      details: {},
      message: 'The requested API route does not exist.',
      requestId: context.get('requestId'),
    });

    return context.json(payload, 404);
  });

  app.onError((error, context) => {
    context.set('errorHandled', true);
    const requestId = context.get('requestId');
    const correlationId = context.get('correlationId');
    const operation = context.get('operation');
    const routeTemplate = routeTemplateFor(context.req.routePath);
    if (!context.get('captureAttempted')) {
      context.set('captureAttempted', true);
      try {
        dependencies.captureException(error, {
          correlationId,
          operation,
          requestId,
          routeTemplate,
        });
      } catch {
        // Telemetry transport failure must not replace the canonical response.
      }
    }
    context.header('x-correlation-id', correlationId);
    context.header('x-request-id', requestId);
    context.header('cache-control', 'no-store');
    logRequest(
      context.get('logger'),
      {
        correlationId,
        durationMs: dependencies.now() - context.get('startedAt'),
        errorCode: 'INTERNAL_ERROR',
        eventName: 'http.request.completed',
        operation,
        outcome: 'failure',
        requestId,
        retryable: false,
        routeTemplate,
      },
      500,
    );

    const payload = ApiErrorSchema.parse({
      code: 'INTERNAL_ERROR',
      details: {},
      message: 'An unexpected error occurred.',
      requestId,
    });
    return context.json(payload, 500);
  });
};

export const registerWorkerRoutes = (
  app: WorkerApp,
  dependencies: WorkerDependencies,
): void => {
  if (dependencies.ac265Hosted !== undefined)
    registerAc265HostedRoutes(app, dependencies.ac265Hosted);
  registerAuthenticationRoutes(app, dependencies.auth);
  if (dependencies.contentSchemaRegistry !== undefined) {
    app.route(
      '/',
      createContentSchemaRegistryApp(dependencies.contentSchemaRegistry),
    );
  }
  if (dependencies.cmsEditorial !== undefined) {
    registerCmsEditorialRoutes(app, dependencies.cmsEditorial);
  }
  if (dependencies.cmsTemplate !== undefined) {
    registerCmsTemplateRoutes(app, dependencies.cmsTemplate);
    registerCmsTemplateDetailRoutes(app, dependencies.cmsTemplate);
  }
  if (dependencies.cmsLocale !== undefined) {
    registerCmsLocaleRoutes(app, dependencies.cmsLocale);
  }
  if (dependencies.cmsTaxonomy !== undefined) {
    registerCmsTaxonomyRoutes(app, dependencies.cmsTaxonomy);
  }
  if (dependencies.cmsPatternInstance !== undefined) {
    registerCmsPatternInstanceRoutes(app, dependencies.cmsPatternInstance);
  }
  if (dependencies.cmsRelatedContent !== undefined) {
    registerCmsRelatedContentRoutes(app, dependencies.cmsRelatedContent);
  }
  registerIdentityAuthorityRoutes(app, dependencies);
  registerProfileOwnershipRoutes(app, dependencies);
  registerProfilePortfolioRoutes(app, dependencies);
  registerPlatformConfigurationRoutes(app, dependencies);
  registerHealthRoutes(app, dependencies);
  registerDiagnosticsRoute(app, dependencies);
  registerUploadRoutes(app, dependencies);
  registerWebhookRoutes(app, dependencies);
  registerFallbackHandlers(app, dependencies);
};
