import { createCorrelationId, createRequestId } from '@wejammin/contracts';
import {
  parseServerEnvironment,
  projectServerEnvironment,
  SERVER_ENVIRONMENT_KEYS,
  type ServerEnvironment,
} from '@wejammin/config/environment';
import { Hono } from 'hono';

import type { AsyncWorkerBindings } from './async-entrypoint';
import { AsyncRpcManualReviewError } from './async-runtime-support';
import type { JobStatusProductionFetch } from './jobs/job-status-production';
import type { UploadCompletionRouteDependencies } from './upload-completion/upload-intent-completion';
import { type PlatformConfigurationProductionOptions } from './platform-configuration/production';
import {
  createProductionWorkerAppRuntime,
  createRuntimeDependencies,
  type ProductionContentSchemaRegistryOptions,
} from './production-worker-runtime';
import {
  createProductionAsyncEntrypoint,
  runProductionOperationalAlerts,
} from './production-async-entrypoint';
import { runProductionCmsReviewAuthoritySweep } from './production-cms-review-authority-sweep';
import { runProductionIdempotencyExpirySweep } from './production-idempotency-expiry-sweep';
import {
  logRequest,
  registerWorkerRoutes,
  routeTemplateFor,
} from './worker-route-composition';
import {
  applySecurityHeaders,
  createSecurityHeaders,
  createHttpsRedirectResponse,
  generateRequestNonce,
  shouldRedirectToHttps,
} from './security-headers';
import type { WorkerBindings } from './worker-bindings';
import { applyReleaseHeader } from './release-header';
import { type WorkerApp, type WorkerDependencies } from './worker-types';
export { routeTemplateFor } from './worker-route-composition';
export {
  createProductionJobEffectDispatcher,
  createProductionVerificationDispatcher,
} from './production-job-effect-dispatcher';
export type {
  PlatformVerificationDependencies,
  ProductionVerificationDependencies,
} from './production-job-effect-dispatcher';
export type { WorkerBindings };
export type ProductionPlatformConfigurationOptions = Pick<
  PlatformConfigurationProductionOptions,
  | 'resolveReleasePrincipal'
  | 'resolveServiceConsumer'
  | 'resolveRequestContext'
  | 'resolveCapabilities'
>;
export type { ProductionContentSchemaRegistryOptions } from './production-worker-runtime';
export {
  createProductionSchemaMigrationWorker,
  migrationQueueOutcome,
} from './production-worker-runtime';
export type { ProductionSchemaMigrationWorkerOptions } from './production-worker-runtime';
export {
  createProductionAsyncEntrypoint,
  runProductionOperationalAlerts,
} from './production-async-entrypoint';
export { DIAGNOSTICS_CAPABILITY } from './worker-types';
export type {
  DiagnosticAuditEvent,
  DiagnosticCheck,
  ErrorCaptureContext,
  WorkerApp,
  WorkerContext,
  WorkerDependencies,
  WebhookRouteRegistration,
} from './worker-types';
export const createWorkerApp = (dependencies: WorkerDependencies) => {
  const app: WorkerApp = new Hono();

  app.use('*', async (context, next) => {
    const requestNonce = generateRequestNonce();
    const requestId = createRequestId(context.req.header('x-request-id'));
    const correlationId = createCorrelationId(
      context.req.header('x-correlation-id') ?? requestId,
      requestId,
    );
    context.set('correlationId', correlationId);
    context.set('captureAttempted', false);
    context.set('errorHandled', false);
    context.set('logger', dependencies.createLogger(context.env));
    context.set('operation', 'http.request');
    context.set('requestId', requestId);
    context.set('startedAt', dependencies.now());

    if (shouldRedirectToHttps(context.req.raw)) {
      const response = applySecurityHeaders(
        createHttpsRedirectResponse(context.req.raw),
        requestNonce,
      );
      applyReleaseHeader(response, context.env);
      response.headers.set('x-correlation-id', correlationId);
      response.headers.set('x-request-id', requestId);
      context.res = response;
      return response;
    }

    await next();

    for (const [name, value] of Object.entries(
      createSecurityHeaders(requestNonce),
    )) {
      context.res.headers.set(name, value);
    }
    applyReleaseHeader(context.res, context.env);
    context.res.headers.set('x-correlation-id', correlationId);
    context.res.headers.set('x-request-id', requestId);
    if (!context.get('errorHandled')) {
      const status = context.res.status;
      const errorCode = context.get('errorCode');
      const retryableDependency =
        status === 503 && errorCode === 'DEPENDENCY_UNAVAILABLE';
      logRequest(
        context.get('logger'),
        {
          correlationId,
          durationMs: dependencies.now() - context.get('startedAt'),
          ...(errorCode === undefined ? {} : { errorCode }),
          eventName: 'http.request.completed',
          operation: context.get('operation'),
          outcome: retryableDependency
            ? 'failure'
            : status >= 400
              ? 'rejected'
              : 'success',
          requestId,
          retryable: retryableDependency,
          routeTemplate: routeTemplateFor(context.req.routePath),
        },
        status,
      );
    }
  });

  registerWorkerRoutes(app, dependencies);

  return app;
};
export const app = createWorkerApp(createRuntimeDependencies());

export const createProductionWorkerApp = (
  environment: WorkerBindings,
  fetchImpl: JobStatusProductionFetch = (input, init) =>
    globalThis.fetch(input, init),
  uploadCompletion?: UploadCompletionRouteDependencies,
  checkReadiness?: WorkerDependencies['checkReadiness'],
  platformConfigurationOptions?: ProductionPlatformConfigurationOptions,
  contentSchemaRegistryOptions?: ProductionContentSchemaRegistryOptions,
): WorkerApp => {
  const validatedEnvironment = parseServerEnvironment(environment);
  return createProductionWorkerAppRuntime(
    createWorkerApp,
    validatedEnvironment,
    fetchImpl,
    uploadCompletion,
    checkReadiness,
    platformConfigurationOptions,
    contentSchemaRegistryOptions,
  );
};
let cachedProductionApp: WorkerApp | undefined;
let cachedProductionEnvironment: ServerEnvironment | undefined;

const sameProductionEnvironment = (
  left: ServerEnvironment | undefined,
  right: ServerEnvironment,
): boolean =>
  left !== undefined &&
  SERVER_ENVIRONMENT_KEYS.every((key) => left[key] === right[key]);

const productionAppFor = (environment: ServerEnvironment): WorkerApp => {
  if (!sameProductionEnvironment(cachedProductionEnvironment, environment)) {
    cachedProductionEnvironment = environment;
    cachedProductionApp = createProductionWorkerApp(environment);
  }
  return cachedProductionApp as WorkerApp;
};

const handler = {
  fetch: (request, env, executionContext) => {
    const validatedEnvironment = projectServerEnvironment(env);
    return productionAppFor(validatedEnvironment).fetch(
      request,
      validatedEnvironment,
      executionContext,
    );
  },
  queue: (batch, env, executionContext) =>
    createProductionAsyncEntrypoint().queue(batch, env, executionContext),
  scheduled: async (controller, env, executionContext) => {
    const outboxSweep = createProductionAsyncEntrypoint().scheduled(
      controller,
      env,
      executionContext,
    );
    const idempotencyExpirySweep = runProductionIdempotencyExpirySweep(env);
    const reviewAuthoritySweep = runProductionCmsReviewAuthoritySweep(env);
    const operationalAlerts = runProductionOperationalAlerts(controller, env);
    const [sweepResult, expiryResult, reviewAuthorityResult, alertResult] =
      await Promise.allSettled([
        outboxSweep,
        idempotencyExpirySweep,
        reviewAuthoritySweep,
        operationalAlerts,
      ]);
    const rejectedResults = [
      sweepResult,
      expiryResult,
      reviewAuthorityResult,
      alertResult,
    ].filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );

    if (
      rejectedResults.length > 0 &&
      rejectedResults.every(
        ({ reason }) => reason instanceof AsyncRpcManualReviewError,
      )
    )
      controller.noRetry();

    // Surface the highest-priority rejection; retry disposition was decided
    // above so manual-review-only failures remain visible without replay.
    if (sweepResult.status === 'rejected') throw sweepResult.reason;
    if (expiryResult.status === 'rejected') throw expiryResult.reason;
    if (reviewAuthorityResult.status === 'rejected')
      throw reviewAuthorityResult.reason;
    if (alertResult.status === 'rejected') throw alertResult.reason;
  },
} satisfies ExportedHandler<AsyncWorkerBindings>;
export default handler;
