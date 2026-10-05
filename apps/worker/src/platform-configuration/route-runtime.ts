import {
  Cfg05a01DefinitionResponseSchema,
  Cfg05a02EffectiveValueResponseSchema,
  Cfg05a03ChangeResponseSchema,
  Cfg05a04ChangeActionResponseSchema,
} from '@wejammin/contracts';

import type { WorkerApp, WorkerContext, WorkerDependencies } from '../index';
import { registerAdminWorkspaceRoutes } from './admin-route-runtime';
import { authError, responseForAuthError } from '../authentication/boundary';
import type { AuthenticationSession } from '../authentication/types';
import { createPlatformConfigurationPortRunner } from './runtime-port';
import {
  admitConfigurationTransport,
  checkConfigurationSameOrigin,
  configurationBodySchemas,
  configurationOperation,
  configurationPathSchemas,
  bindEffectiveQueryScope,
  bindMutationScope,
  enforceConfigurationRate,
  hasServiceConsumerHeaders,
  parseConfigurationCommandHeaders,
  parseEffectiveQuery,
  requireConfigurationSession,
  resolveReleasePrincipal,
  resolveServiceConsumer,
} from './route-support';
import { parseRoutePath, send, stepUpAndRate } from './route-runtime-support';
import type { ConfigurationServiceConsumer } from './types';

export type PlatformConfigurationRouteRuntime = Readonly<{
  register: (context: WorkerContext) => Promise<Response>;
  effective: (context: WorkerContext) => Promise<Response>;
  propose: (context: WorkerContext) => Promise<Response>;
  action: (context: WorkerContext) => Promise<Response>;
}>;

export const createPlatformConfigurationRouteRuntime = (
  dependencies: WorkerDependencies,
): PlatformConfigurationRouteRuntime => {
  const runner = createPlatformConfigurationPortRunner(dependencies);
  const auth = dependencies.auth;
  const configuration = dependencies.platformConfiguration;

  const register = async (context: WorkerContext): Promise<Response> => {
    const operationId = 'CFG-05A-01' as const;
    configurationOperation(context, operationId);
    // BE00 step 2: origin, body ceiling, content type (a signed service call
    // carries no cookie, so there is no CSRF step).
    const transport = await admitConfigurationTransport(context);
    if (!transport.ok) return responseForAuthError(context, transport);
    // BE00 step 4: the verified release principal.
    const principal = await resolveReleasePrincipal(
      context,
      configuration?.resolveReleasePrincipal,
    );
    if (!principal.ok) return responseForAuthError(context, principal);
    // BE00 step 6: strict body.
    const body = transport.value.decode(configurationBodySchemas.register);
    if (!body.ok) return responseForAuthError(context, body);
    const rate = await enforceConfigurationRate(
      context,
      operationId,
      auth,
      null,
      {
        principalId: principal.value.principalId,
        consumerKey: 'registry.release',
      },
    );
    if (rate !== null) return rate;
    // BE00 step 8: exact Idempotency-Key.
    const headers = parseConfigurationCommandHeaders(context.req.raw);
    if (!headers.ok) return responseForAuthError(context, headers);
    return send(
      context,
      await runner.run(
        context,
        operationId,
        'registerDefinition',
        {
          operationId,
          request: context.req.raw,
          body: body.value as Readonly<Record<string, unknown>>,
          idempotencyKey: headers.value.idempotencyKey,
          servicePrincipalId: principal.value.principalId,
        },
        Cfg05a01DefinitionResponseSchema,
      ),
      operationId,
    );
  };

  const effective = async (context: WorkerContext): Promise<Response> => {
    const operationId = 'CFG-05A-02' as const;
    configurationOperation(context, operationId);
    // BE00 step 2: origin (a read has no body, CSRF or media).
    const origin = checkConfigurationSameOrigin(context);
    if (!origin.ok) return responseForAuthError(context, origin);
    // BE00 steps 4 and 5: a verified service consumer or a verified session.
    const serviceAttempt = hasServiceConsumerHeaders(context.req.raw);
    let session: AuthenticationSession | undefined;
    let service: ConfigurationServiceConsumer | null = null;
    if (serviceAttempt) {
      const resolvedService = await resolveServiceConsumer(
        context,
        configuration?.resolveServiceConsumer,
      );
      if (!resolvedService.ok)
        return responseForAuthError(context, resolvedService);
      service = resolvedService.value;
    } else {
      const resolved = await requireConfigurationSession(context, auth, false);
      if (!resolved.ok) return responseForAuthError(context, resolved);
      session = resolved.value;
    }
    // BE00 step 6: strict path and query.
    const path = parseRoutePath(
      configurationPathSchemas.key,
      context.req.param('key'),
    );
    if (!path.ok) return responseForAuthError(context, path);
    let query = parseEffectiveQuery(context.req.raw, path.value);
    if (!query.ok) return responseForAuthError(context, query);
    // BE00 step 7: the caller's own scope, then quota.
    if (service !== null) {
      const queryRecord = query.value as Readonly<Record<string, unknown>>;
      if (queryRecord.consumerKey !== service.consumerKey)
        return responseForAuthError(
          context,
          authError(
            403,
            'FORBIDDEN',
            'The service consumer is not allowed for this key.',
          ),
        );
      const rate = await enforceConfigurationRate(
        context,
        operationId,
        auth,
        null,
        service,
      );
      if (rate !== null) return rate;
    } else {
      const bound = bindEffectiveQueryScope(
        query.value as Readonly<Record<string, unknown>>,
        session as AuthenticationSession,
      );
      if (!bound.ok) return responseForAuthError(context, bound);
      query = bound;
      const rate = await enforceConfigurationRate(
        context,
        operationId,
        auth,
        session as AuthenticationSession,
        null,
      );
      if (rate !== null) return rate;
    }
    return send(
      context,
      await runner.run(
        context,
        operationId,
        'resolveEffectiveValue',
        {
          operationId,
          request: context.req.raw,
          path: { key: path.value },
          query: query.value as Readonly<Record<string, unknown>>,
          ...(session === undefined ? {} : { session }),
          ...(service === null
            ? {}
            : {
                servicePrincipalId: service.principalId,
                serviceConsumerKey: service.consumerKey,
              }),
        },
        Cfg05a02EffectiveValueResponseSchema,
      ),
      operationId,
    );
  };

  const propose = async (context: WorkerContext): Promise<Response> => {
    const operationId = 'CFG-05A-03' as const;
    configurationOperation(context, operationId);
    // BE00 step 2: origin, body ceiling, content type, session-bound CSRF.
    const transport = await admitConfigurationTransport(context);
    if (!transport.ok) return responseForAuthError(context, transport);
    // BE00 steps 4 and 5: verified session, then the acting context.
    const session = await requireConfigurationSession(context, auth, true);
    if (!session.ok) return responseForAuthError(context, session);
    // BE00 step 6: strict path and body, then the server-bound scope.
    const path = parseRoutePath(
      configurationPathSchemas.definitionId,
      context.req.param('definitionId'),
    );
    if (!path.ok) return responseForAuthError(context, path);
    const body = transport.value.decode(configurationBodySchemas.propose);
    if (!body.ok) return responseForAuthError(context, body);
    const bound = bindMutationScope(
      body.value as Readonly<Record<string, unknown>>,
      session.value,
    );
    if (!bound.ok) return responseForAuthError(context, bound);
    // BE00 step 7: step-up freshness, then quota.
    const gated = await stepUpAndRate(
      context,
      operationId,
      auth,
      session.value,
    );
    if (gated !== null) return gated;
    // BE00 step 8: exact Idempotency-Key and quoted If-Match.
    const headers = parseConfigurationCommandHeaders(context.req.raw);
    if (!headers.ok) return responseForAuthError(context, headers);
    return send(
      context,
      await runner.run(
        context,
        operationId,
        'proposeChange',
        {
          operationId,
          request: context.req.raw,
          path: { definitionId: path.value },
          body: bound.value,
          idempotencyKey: headers.value.idempotencyKey,
          ...(headers.value.ifMatch === undefined
            ? {}
            : { ifMatch: headers.value.ifMatch }),
          session: session.value,
        },
        Cfg05a03ChangeResponseSchema,
      ),
      operationId,
    );
  };

  const action = async (context: WorkerContext): Promise<Response> => {
    const operationId = 'CFG-05A-04' as const;
    configurationOperation(context, operationId);
    const transport = await admitConfigurationTransport(context);
    if (!transport.ok) return responseForAuthError(context, transport);
    const session = await requireConfigurationSession(context, auth, true);
    if (!session.ok) return responseForAuthError(context, session);
    const path = parseRoutePath(
      configurationPathSchemas.reviewId,
      context.req.param('reviewId'),
    );
    if (!path.ok) return responseForAuthError(context, path);
    const body = transport.value.decode(configurationBodySchemas.action);
    if (!body.ok) return responseForAuthError(context, body);
    const gated = await stepUpAndRate(
      context,
      operationId,
      auth,
      session.value,
    );
    if (gated !== null) return gated;
    const headers = parseConfigurationCommandHeaders(context.req.raw);
    if (!headers.ok) return responseForAuthError(context, headers);
    return send(
      context,
      await runner.run(
        context,
        operationId,
        'changeAction',
        {
          operationId,
          request: context.req.raw,
          path: { reviewId: path.value },
          body: body.value as Readonly<Record<string, unknown>>,
          idempotencyKey: headers.value.idempotencyKey,
          ...(headers.value.ifMatch === undefined
            ? {}
            : { ifMatch: headers.value.ifMatch }),
          session: session.value,
        },
        Cfg05a04ChangeActionResponseSchema,
      ),
      operationId,
    );
  };

  return { register, effective, propose, action };
};

export const registerPlatformConfigurationRoutes = (
  app: WorkerApp,
  dependencies: WorkerDependencies,
): void => {
  const runtime = createPlatformConfigurationRouteRuntime(dependencies);
  app.post('/api/v1/internal/config/definitions', runtime.register);
  app.get('/api/v1/config/:key/effective', runtime.effective);
  app.post('/api/v1/admin/settings/:definitionId/changes', runtime.propose);
  app.post('/api/v1/admin/settings/changes/:reviewId/actions', runtime.action);
  registerAdminWorkspaceRoutes(app, dependencies);
};
