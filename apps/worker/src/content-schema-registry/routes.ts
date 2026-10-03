import { Hono } from 'hono';
import { createContentSchemaRegistryDomain } from './domain';
import type { ContentSchemaRegistryDependencies } from './types';
import {
  corsOriginsFor,
  errorResponse,
  isReleasePath,
  requestIdFor,
} from './route-response';
import type { FeatureApp } from './route-types';
import { createExecutor } from './route-execution';
import { createRouteHandlers } from './route-handlers';
import { registerContentSchemaRegistryEndpoints } from './route-registration';

export const createContentSchemaRegistryApp = (
  dependencies: ContentSchemaRegistryDependencies,
): FeatureApp => {
  const app: FeatureApp = new Hono();
  const domain = createContentSchemaRegistryDomain(dependencies);
  const execute = createExecutor(dependencies, domain);
  const handlers = createRouteHandlers(dependencies, execute);

  app.use('/api/v1/cms/*', async (context, next) => {
    const requestId = requestIdFor(context.req.raw);
    context.set('requestId', requestId);
    await next();
    const origin = context.req.header('origin');
    const allowedOrigins = corsOriginsFor(context.req.path, dependencies);
    if (origin !== undefined && allowedOrigins.includes(origin)) {
      context.header('access-control-allow-origin', origin);
      context.header('vary', 'Origin');
      if (!isReleasePath(context.req.path))
        context.header('access-control-allow-credentials', 'true');
    }
    if (!context.res.headers.has('x-request-id'))
      context.header('x-request-id', requestId);
  });

  app.options('/api/v1/cms/*', (context) => {
    const origin = context.req.header('origin');
    const release = isReleasePath(context.req.path);
    const allowedOrigins = corsOriginsFor(context.req.path, dependencies);
    const allowed = origin !== undefined && allowedOrigins.includes(origin);
    if (!allowed)
      return errorResponse(
        context,
        {
          ok: false,
          status: 403,
          code: 'FORBIDDEN',
          message: 'The request origin is not allowed.',
          details: { reasonCode: 'POLICY_NOT_MET' },
        },
        context.get('requestId'),
      );
    context.header('access-control-allow-origin', origin as string);
    context.header('vary', 'Origin');
    if (!release) context.header('access-control-allow-credentials', 'true');
    context.header(
      'access-control-allow-methods',
      release ? 'POST, OPTIONS' : 'GET, POST, OPTIONS',
    );
    context.header(
      'access-control-allow-headers',
      release
        ? 'Content-Type, Idempotency-Key, If-Match, X-Correlation-Id, X-Request-Id, X-WeJammin-Release-Key-Id, X-WeJammin-Release-Issued-At, X-WeJammin-Release-Nonce, X-WeJammin-Release-Signature'
        : 'Authorization, Content-Type, Idempotency-Key, If-Match, X-CSRF-Token, X-Correlation-Id, X-Request-Id',
    );
    context.header('cache-control', 'no-store');
    return new Response(null, { status: 204, headers: context.res.headers });
  });

  registerContentSchemaRegistryEndpoints(app, handlers);

  app.onError((error, context) => {
    void error;
    const requestId = context.get('requestId');
    return errorResponse(
      context,
      {
        ok: false,
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
        details: {},
      },
      requestId,
    );
  });
  app.notFound((context) =>
    errorResponse(
      context,
      {
        ok: false,
        status: 404,
        code: 'NOT_FOUND',
        message: 'The requested API route does not exist.',
        details: {},
      },
      context.get('requestId') ?? requestIdFor(context.req.raw),
    ),
  );
  return app;
};

/**
 * Mount the feature app at the worker's existing root. The root composition
 * supplies the feature's injected ports and remains the owner of deployment
 * wiring; this registrar owns only the CMS route tree.
 */
export const registerContentSchemaRegistryRoutes = (
  app: Hono,
  dependencies: ContentSchemaRegistryDependencies,
): void => {
  app.route('/', createContentSchemaRegistryApp(dependencies));
};
