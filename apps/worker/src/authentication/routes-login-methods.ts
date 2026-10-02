import {
  AuthIdentityPathSchema,
  AuthProviderPathSchema,
  AuthorizationStartSchema,
  LinkIntentRequestSchema,
  LoginMethodsResourceSchema,
  UnlinkRequestSchema,
} from '@wejammin/contracts';

import type { WorkerApp } from '../index';
import {
  appendCookies,
  authError,
  parseIdempotencyKey,
  parseIfMatch,
  parseJsonBody,
  quotedVersion,
  rejectUnexpectedQuery,
  responseForAuthError,
  verifySameOriginCsrf,
} from './boundary';
import {
  enforceRate,
  isStepUpFresh,
  jsonSuccess,
  requireSession,
} from './route-support';
import {
  configureRoute,
  missingSliceDependency,
} from './routes-provider-access';
import { stepUpRequiredError } from './step-up';
import type { AuthenticationDependencies } from './types';

export const registerLoginMethodRoutes = (
  app: WorkerApp,
  dependencies: AuthenticationDependencies,
): void => {
  app.get('/api/v1/account/login-methods', async (context) => {
    configureRoute(context, 'AUTH-API-09');
    const queryError = rejectUnexpectedQuery(context.req.raw);
    if (queryError !== null) return responseForAuthError(context, queryError);
    const resolved = await requireSession(context, dependencies);
    if (!resolved.ok) return responseForAuthError(context, resolved);
    const rateError = await enforceRate(
      context,
      dependencies,
      'AUTH-API-09',
      resolved.value,
    );
    if (rateError !== null) return rateError;
    if (dependencies.readLoginMethods === undefined)
      return missingSliceDependency(context);
    const result = await dependencies.readLoginMethods(
      { session: resolved.value, request: context.req.raw },
      context.env,
      new AbortController().signal,
    );
    if (!result.ok) return responseForAuthError(context, result);
    const parsed = LoginMethodsResourceSchema.safeParse(result.value);
    if (!parsed.success) {
      return responseForAuthError(
        context,
        authError(
          502,
          'DEPENDENCY_INVALID_RESPONSE',
          'Authentication persistence returned an invalid response.',
        ),
      );
    }
    context.header('etag', quotedVersion(parsed.data.version));
    return jsonSuccess(context, parsed.data, 200, 'no-store');
  });

  app.post(
    '/api/v1/account/login-methods/:provider/link-intents',
    async (context) => {
      configureRoute(context, 'AUTH-API-10');
      const path = AuthProviderPathSchema.safeParse({
        provider: context.req.param('provider'),
      });
      if (!path.success) {
        return responseForAuthError(
          context,
          authError(422, 'VALIDATION_FAILED', 'Check the highlighted fields.'),
        );
      }
      const parsed = await parseJsonBody(
        context.req.raw,
        LinkIntentRequestSchema,
      );
      if (!parsed.ok) return responseForAuthError(context, parsed);
      const key = parseIdempotencyKey(context.req.raw);
      if (!key.ok) return responseForAuthError(context, key);
      const version = parseIfMatch(context.req.raw);
      if (!version.ok) return responseForAuthError(context, version);
      const csrfError = await verifySameOriginCsrf(context.req.raw);
      if (csrfError !== null) return responseForAuthError(context, csrfError);
      const resolved = await requireSession(context, dependencies);
      if (!resolved.ok) return responseForAuthError(context, resolved);
      if (!isStepUpFresh(resolved.value, Date.now())) {
        return responseForAuthError(
          context,
          stepUpRequiredError(),
        );
      }
      const rateError = await enforceRate(
        context,
        dependencies,
        'AUTH-API-10',
        resolved.value,
      );
      if (rateError !== null) return rateError;
      if (dependencies.startLoginMethodLink === undefined)
        return missingSliceDependency(context);
      const result = await dependencies.startLoginMethodLink(
        {
          session: resolved.value,
          idempotencyKey: key.value,
          ifMatch: version.value,
          request: context.req.raw,
          provider: path.data.provider,
          returnTo: parsed.value.returnTo,
        },
        context.env,
        new AbortController().signal,
      );
      if (!result.ok) return responseForAuthError(context, result);
      const resource = AuthorizationStartSchema.safeParse(
        result.value.resource,
      );
      if (!resource.success) {
        return responseForAuthError(
          context,
          authError(
            502,
            'DEPENDENCY_INVALID_RESPONSE',
            'Authentication persistence returned an invalid response.',
          ),
        );
      }
      const response = jsonSuccess(context, resource.data, 201, 'no-store');
      appendCookies(response, result.value.cookies);
      return response;
    },
  );

  app.delete('/api/v1/account/login-methods/:identityId', async (context) => {
    configureRoute(context, 'AUTH-API-11');
    const path = AuthIdentityPathSchema.safeParse({
      identityId: context.req.param('identityId'),
    });
    if (!path.success) {
      return responseForAuthError(
        context,
        authError(
          400,
          'INVALID_REQUEST',
          'The identity identifier is invalid.',
        ),
      );
    }
    const parsed = await parseJsonBody(context.req.raw, UnlinkRequestSchema);
    if (!parsed.ok) return responseForAuthError(context, parsed);
    const key = parseIdempotencyKey(context.req.raw);
    if (!key.ok) return responseForAuthError(context, key);
    const version = parseIfMatch(context.req.raw);
    if (!version.ok) return responseForAuthError(context, version);
    const csrfError = await verifySameOriginCsrf(context.req.raw);
    if (csrfError !== null) return responseForAuthError(context, csrfError);
    const resolved = await requireSession(context, dependencies);
    if (!resolved.ok) return responseForAuthError(context, resolved);
    if (!isStepUpFresh(resolved.value, Date.now())) {
      return responseForAuthError(
        context,
        stepUpRequiredError(),
      );
    }
    const rateError = await enforceRate(
      context,
      dependencies,
      'AUTH-API-11',
      resolved.value,
    );
    if (rateError !== null) return rateError;
    if (dependencies.unlinkLoginMethod === undefined)
      return missingSliceDependency(context);
    const result = await dependencies.unlinkLoginMethod(
      {
        session: resolved.value,
        idempotencyKey: key.value,
        ifMatch: version.value,
        request: context.req.raw,
        identityId: path.data.identityId,
        reason: parsed.value.reason,
      },
      context.env,
      new AbortController().signal,
    );
    if (!result.ok) return responseForAuthError(context, result);
    const resource = LoginMethodsResourceSchema.safeParse(result.value);
    if (!resource.success) {
      return responseForAuthError(
        context,
        authError(
          502,
          'DEPENDENCY_INVALID_RESPONSE',
          'Authentication persistence returned an invalid response.',
        ),
      );
    }
    context.header('etag', quotedVersion(resource.data.version));
    return jsonSuccess(context, resource.data, 200, 'no-store');
  });
};
