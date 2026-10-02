import {
  AuthMfaFactorPathSchema,
  MfaFactorRemoveRequestSchema,
  MfaFactorVerifyRequestSchema,
  MfaFactorsResourceSchema,
  TotpEnrollmentStartRequestSchema,
  TotpEnrollmentStartSchema,
} from '@wejammin/contracts';

import type { WorkerApp, WorkerContext } from '../index';
import {
  appendCookies,
  authError,
  quotedVersion,
  rejectUnexpectedQuery,
  responseForAuthError,
} from './boundary';
import { enforceRate, jsonSuccess, requireSession } from './route-support';
import { admitMfaMutation, parsePathId } from './route-support-mfa';
import {
  configureRoute,
  missingSliceDependency,
} from './routes-provider-access';
import type { AuthenticationDependencies } from './types';

const invalidPersistence = (context: WorkerContext): Response =>
  responseForAuthError(
    context,
    authError(
      502,
      'DEPENDENCY_INVALID_RESPONSE',
      'Authentication persistence returned an invalid response.',
    ),
  );

const factorsResponse = (
  context: WorkerContext,
  value: unknown,
  cookies: readonly string[] = [],
): Response => {
  const parsed = MfaFactorsResourceSchema.safeParse(value);
  if (!parsed.success) return invalidPersistence(context);
  context.header('etag', quotedVersion(parsed.data.version));
  const response = jsonSuccess(context, parsed.data, 200, 'no-store');
  appendCookies(response, cookies);
  return response;
};

const factorPath = (context: WorkerContext): ReturnType<typeof parsePathId> =>
  parsePathId(
    context,
    AuthMfaFactorPathSchema.shape.factorId,
    context.req.param('factorId') ?? '',
  );

export const registerMfaFactorRoutes = (
  app: WorkerApp,
  dependencies: AuthenticationDependencies,
): void => {
  app.get('/api/v1/account/mfa/factors', async (context) => {
    configureRoute(context, 'AUTH-API-16');
    const queryError = rejectUnexpectedQuery(context.req.raw);
    if (queryError !== null) return responseForAuthError(context, queryError);
    const resolved = await requireSession(context, dependencies);
    if (!resolved.ok) return responseForAuthError(context, resolved);
    const rateError = await enforceRate(
      context,
      dependencies,
      'AUTH-API-16',
      resolved.value,
    );
    if (rateError !== null) return rateError;
    if (dependencies.readMfaFactors === undefined)
      return missingSliceDependency(context);
    const result = await dependencies.readMfaFactors(
      { session: resolved.value, request: context.req.raw },
      context.env,
      new AbortController().signal,
    );
    return result.ok
      ? factorsResponse(context, result.value)
      : responseForAuthError(context, result);
  });

  app.post('/api/v1/account/mfa/factors', async (context) => {
    configureRoute(context, 'AUTH-API-17');
    const admitted = await admitMfaMutation(
      context,
      dependencies,
      'AUTH-API-17',
      {
        schema: TotpEnrollmentStartRequestSchema,
        idempotency: false,
        ifMatch: true,
      },
    );
    if (admitted instanceof Response) return admitted;
    if (dependencies.startTotpEnrollment === undefined)
      return missingSliceDependency(context);
    const result = await dependencies.startTotpEnrollment(
      {
        session: admitted.session,
        request: context.req.raw,
        friendlyName: admitted.body.friendlyName,
        ifMatch: admitted.ifMatch,
      },
      context.env,
      new AbortController().signal,
    );
    if (!result.ok) return responseForAuthError(context, result);
    const parsed = TotpEnrollmentStartSchema.safeParse(result.value);
    if (!parsed.success) return invalidPersistence(context);
    context.header('etag', quotedVersion(parsed.data.version));
    return jsonSuccess(context, parsed.data, 201, 'no-store');
  });

  app.post('/api/v1/account/mfa/factors/:factorId/verify', async (context) => {
    configureRoute(context, 'AUTH-API-18');
    const factorId = factorPath(context);
    if (!factorId.ok) return responseForAuthError(context, factorId);
    const admitted = await admitMfaMutation(
      context,
      dependencies,
      'AUTH-API-18',
      {
        schema: MfaFactorVerifyRequestSchema,
        idempotency: false,
        ifMatch: true,
      },
    );
    if (admitted instanceof Response) return admitted;
    if (dependencies.verifyTotpEnrollment === undefined)
      return missingSliceDependency(context);
    const result = await dependencies.verifyTotpEnrollment(
      {
        session: admitted.session,
        request: context.req.raw,
        factorId: factorId.value,
        code: admitted.body.code,
        ifMatch: admitted.ifMatch,
      },
      context.env,
      new AbortController().signal,
    );
    return result.ok
      ? factorsResponse(context, result.value.resource, result.value.cookies)
      : responseForAuthError(context, result);
  });

  app.delete('/api/v1/account/mfa/factors/:factorId', async (context) => {
    configureRoute(context, 'AUTH-API-19');
    const factorId = factorPath(context);
    if (!factorId.ok) return responseForAuthError(context, factorId);
    const admitted = await admitMfaMutation(
      context,
      dependencies,
      'AUTH-API-19',
      {
        schema: MfaFactorRemoveRequestSchema,
        idempotency: true,
        ifMatch: true,
      },
    );
    if (admitted instanceof Response) return admitted;
    if (dependencies.removeMfaFactor === undefined)
      return missingSliceDependency(context);
    const result = await dependencies.removeMfaFactor(
      {
        session: admitted.session,
        request: context.req.raw,
        factorId: factorId.value,
        reason: admitted.body.reason,
        ifMatch: admitted.ifMatch,
        idempotencyKey: admitted.idempotencyKey,
      },
      context.env,
      new AbortController().signal,
    );
    return result.ok
      ? factorsResponse(context, result.value)
      : responseForAuthError(context, result);
  });
};
