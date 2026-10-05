import {
  LogoutRequestSchema,
  PersonBootstrapRequestSchema,
  PersonBootstrapResourceSchema,
  SessionRefreshRequestSchema,
  SessionResourceSchema,
} from '@wejammin/contracts';

import type { WorkerApp } from '../index';
import {
  appendCookies,
  parseIdempotencyKey,
  admitJsonMutationTransport,
  rejectUnexpectedQuery,
  responseForAuthError,
  verifyReadOrigin,
} from './boundary';
import {
  enforceRate,
  isStepUpFresh,
  jsonSuccess,
  requireSession,
} from './route-support';
import { configureRoute } from './routes-provider-access';
import { stepUpRequiredError } from './step-up';
import type { AuthenticationDependencies } from './types';

export const registerSessionRoutes = (
  app: WorkerApp,
  dependencies: AuthenticationDependencies,
): void => {
  app.get('/api/v1/auth/session', async (context) => {
    configureRoute(context, 'AUTH-API-05');
    // BE00 step 2: a read has no body or CSRF token; the origin is the gate.
    const foreignOrigin = verifyReadOrigin(context.req.raw);
    if (foreignOrigin !== null)
      return responseForAuthError(context, foreignOrigin);
    // BE00 steps 4 and 5: verified session; strict path and query follow (step 6).
    const resolved = await requireSession(context, dependencies);
    if (!resolved.ok) return responseForAuthError(context, resolved);
    const queryError = rejectUnexpectedQuery(context.req.raw);
    if (queryError !== null) return responseForAuthError(context, queryError);
    const rateError = await enforceRate(
      context,
      dependencies,
      'AUTH-API-05',
      resolved.value,
    );
    if (rateError !== null) return rateError;
    const result = await dependencies.readSession(
      resolved.value,
      context.env,
      new AbortController().signal,
    );
    return result.ok
      ? jsonSuccess(
          context,
          SessionResourceSchema.parse(result.value),
          200,
          'no-store',
        )
      : responseForAuthError(context, result);
  });

  app.post('/api/v1/auth/session/refresh', async (context) => {
    configureRoute(context, 'AUTH-API-06');
    // BE00 step 2: origin, body ceiling, content type, session-bound CSRF.
    const transport = await admitJsonMutationTransport(context.req.raw);
    if (!transport.ok) return responseForAuthError(context, transport);
    // BE00 steps 4 and 5: verified session and acting context.
    const resolved = await requireSession(context, dependencies);
    if (!resolved.ok) return responseForAuthError(context, resolved);
    // BE00 step 6: strict body.
    const parsed = transport.value.decode(SessionRefreshRequestSchema);
    if (!parsed.ok) return responseForAuthError(context, parsed);
    const rateError = await enforceRate(
      context,
      dependencies,
      'AUTH-API-06',
      resolved.value,
    );
    if (rateError !== null) return rateError;
    const result = await dependencies.refreshSession(
      context.req.raw,
      context.env,
      new AbortController().signal,
    );
    if (!result.ok) return responseForAuthError(context, result);
    const response = jsonSuccess(
      context,
      SessionResourceSchema.parse(result.value.resource),
      200,
      'no-store',
    );
    appendCookies(response, result.value.cookies);
    return response;
  });

  app.post('/api/v1/auth/bootstrap', async (context) => {
    configureRoute(context, 'AUTH-API-07');
    const transport = await admitJsonMutationTransport(context.req.raw);
    if (!transport.ok) return responseForAuthError(context, transport);
    const resolved = await requireSession(context, dependencies);
    if (!resolved.ok) return responseForAuthError(context, resolved);
    const parsed = transport.value.decode(PersonBootstrapRequestSchema);
    if (!parsed.ok) return responseForAuthError(context, parsed);
    const rateError = await enforceRate(
      context,
      dependencies,
      'AUTH-API-07',
      resolved.value,
    );
    if (rateError !== null) return rateError;
    // BE00 step 8: exact Idempotency-Key.
    const key = parseIdempotencyKey(context.req.raw);
    if (!key.ok) return responseForAuthError(context, key);
    const result = await dependencies.bootstrap(
      resolved.value,
      key.value,
      context.req.raw,
      context.env,
      new AbortController().signal,
    );
    if (!result.ok) return responseForAuthError(context, result);
    return jsonSuccess(
      context,
      PersonBootstrapResourceSchema.parse(result.value.resource),
      result.value.created ? 201 : 200,
      'no-store',
    );
  });

  app.post('/api/v1/auth/logout', async (context) => {
    configureRoute(context, 'AUTH-API-08');
    const transport = await admitJsonMutationTransport(context.req.raw);
    if (!transport.ok) return responseForAuthError(context, transport);
    const resolved = await requireSession(context, dependencies);
    if (!resolved.ok) return responseForAuthError(context, resolved);
    const parsed = transport.value.decode(LogoutRequestSchema);
    if (!parsed.ok) return responseForAuthError(context, parsed);
    const scope = parsed.value.scope ?? 'current';
    if (scope === 'all' && !isStepUpFresh(resolved.value, Date.now())) {
      return responseForAuthError(context, stepUpRequiredError());
    }
    const rateError = await enforceRate(
      context,
      dependencies,
      'AUTH-API-08',
      resolved.value,
    );
    if (rateError !== null) return rateError;
    // BE00 step 8: exact Idempotency-Key.
    const key = parseIdempotencyKey(context.req.raw);
    if (!key.ok) return responseForAuthError(context, key);
    const result = await dependencies.logout(
      resolved.value,
      { scope },
      key.value,
      context.req.raw,
      context.env,
      new AbortController().signal,
    );
    if (!result.ok) return responseForAuthError(context, result);
    const response = context.body(null, 204, {
      'cache-control': 'no-store',
    });
    appendCookies(response, result.value.cookies);
    return response;
  });
};
