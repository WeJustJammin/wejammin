import {
  type AuthOperationId,
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
} from './boundary';
import { responseForMfaError, withRouteDeadline } from './mfa-error-boundary';
import { enforceRate, jsonSuccess, requireSession } from './route-support';
import { admitMfaMutation, parsePathId } from './route-support-mfa';
import {
  configureRoute,
  missingSliceDependency,
} from './routes-provider-access';
import { mfaOperationTelemetry } from './mfa-telemetry';
import type { AuthenticationDependencies } from './types';

const invalidPersistence = (
  context: WorkerContext,
  operationId: AuthOperationId,
): Response =>
  responseForMfaError(
    context,
    operationId,
    authError(
      502,
      'DEPENDENCY_INVALID_RESPONSE',
      'Authentication persistence returned an invalid response.',
    ),
  );

const factorsResponse = (
  context: WorkerContext,
  operationId: AuthOperationId,
  value: unknown,
  cookies: readonly string[] = [],
): Response => {
  const parsed = MfaFactorsResourceSchema.safeParse(value);
  if (!parsed.success) return invalidPersistence(context, operationId);
  context.header('etag', quotedVersion(parsed.data.version));
  const response = jsonSuccess(context, parsed.data, 200, 'no-store');
  appendCookies(response, cookies);
  return response;
};

const factorPath = (context: WorkerContext): ReturnType<typeof parsePathId> =>
  parsePathId(
    context,
    AuthMfaFactorPathSchema.shape.factorId,
    context.req.param('factorId'),
  );

export const registerMfaFactorRoutes = (
  app: WorkerApp,
  dependencies: AuthenticationDependencies,
): void => {
  app.use('/api/v1/account/mfa/*', mfaOperationTelemetry);
  app.get('/api/v1/account/mfa/factors', async (context) => {
    configureRoute(context, 'AUTH-API-16');
    const fail = (error: Parameters<typeof responseForMfaError>[2]) =>
      responseForMfaError(context, 'AUTH-API-16', error);
    const queryError = rejectUnexpectedQuery(context.req.raw);
    if (queryError !== null) return fail(queryError);
    const resolved = await requireSession(context, dependencies);
    if (!resolved.ok) return fail(resolved);
    const rateError = await enforceRate(
      context,
      dependencies,
      'AUTH-API-16',
      resolved.value,
      null,
      (target, error) => responseForMfaError(target, 'AUTH-API-16', error),
    );
    if (rateError !== null) return rateError;
    const read = dependencies.readMfaFactors;
    if (read === undefined) return missingSliceDependency(context);
    const result = await withRouteDeadline('AUTH-API-16', (signal) =>
      read(
        { session: resolved.value, request: context.req.raw },
        context.env,
        signal,
      ),
    );
    return result.ok
      ? factorsResponse(context, 'AUTH-API-16', result.value)
      : fail(result);
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
    const start = dependencies.startTotpEnrollment;
    if (start === undefined) return missingSliceDependency(context);
    const result = await withRouteDeadline('AUTH-API-17', (signal) =>
      start(
        {
          session: admitted.session,
          request: context.req.raw,
          friendlyName: admitted.body.friendlyName,
          ifMatch: admitted.ifMatch,
        },
        context.env,
        signal,
      ),
    );
    if (!result.ok) return responseForMfaError(context, 'AUTH-API-17', result);
    const parsed = TotpEnrollmentStartSchema.safeParse(result.value);
    if (!parsed.success) return invalidPersistence(context, 'AUTH-API-17');
    context.header('etag', quotedVersion(parsed.data.version));
    return jsonSuccess(context, parsed.data, 201, 'no-store');
  });

  app.post('/api/v1/account/mfa/factors/:factorId/verify', async (context) => {
    configureRoute(context, 'AUTH-API-18');
    const factorId = factorPath(context);
    if (!factorId.ok)
      return responseForMfaError(context, 'AUTH-API-18', factorId);
    const admitted = await admitMfaMutation(
      context,
      dependencies,
      'AUTH-API-18',
      {
        schema: MfaFactorVerifyRequestSchema,
        idempotency: false,
        ifMatch: true,
        // BE01a: one verification bucket shared by AUTH-API-18 and -21.
        rateOperation: 'AUTH-API-21',
      },
    );
    if (admitted instanceof Response) return admitted;
    const verify = dependencies.verifyTotpEnrollment;
    if (verify === undefined) return missingSliceDependency(context);
    const result = await withRouteDeadline('AUTH-API-18', (signal) =>
      verify(
        {
          session: admitted.session,
          request: context.req.raw,
          factorId: factorId.value,
          code: admitted.body.code,
          ifMatch: admitted.ifMatch,
        },
        context.env,
        signal,
      ),
    );
    return result.ok
      ? factorsResponse(
          context,
          'AUTH-API-18',
          result.value.resource,
          result.value.cookies,
        )
      : responseForMfaError(context, 'AUTH-API-18', result);
  });

  app.delete('/api/v1/account/mfa/factors/:factorId', async (context) => {
    configureRoute(context, 'AUTH-API-19');
    const factorId = factorPath(context);
    if (!factorId.ok)
      return responseForMfaError(context, 'AUTH-API-19', factorId);
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
    const remove = dependencies.removeMfaFactor;
    if (remove === undefined) return missingSliceDependency(context);
    const result = await withRouteDeadline('AUTH-API-19', (signal) =>
      remove(
        {
          session: admitted.session,
          request: context.req.raw,
          factorId: factorId.value,
          reason: admitted.body.reason,
          ifMatch: admitted.ifMatch,
          idempotencyKey: admitted.idempotencyKey,
        },
        context.env,
        signal,
      ),
    );
    return result.ok
      ? factorsResponse(context, 'AUTH-API-19', result.value)
      : responseForMfaError(context, 'AUTH-API-19', result);
  });
};
