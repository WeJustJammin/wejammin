import {
  AuthStepUpChallengePathSchema,
  StepUpChallengeRequestSchema,
  StepUpChallengeSchema,
  StepUpResultSchema,
  StepUpVerifyRequestSchema,
} from '@wejammin/contracts';

import type { WorkerApp, WorkerContext } from '../index';
import { appendCookies, authError } from './boundary';
import { responseForMfaError, withRouteDeadline } from './mfa-error-boundary';
import { jsonSuccess } from './route-support';
import { admitMfaMutation, parsePathId } from './route-support-mfa';
import {
  configureRoute,
  missingSliceDependency,
} from './routes-provider-access';
import { mfaOperationTelemetry } from './mfa-telemetry';
import type { AuthenticationDependencies } from './types';

const invalidPersistence = (
  context: WorkerContext,
  operationId: 'AUTH-API-20' | 'AUTH-API-21',
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

export const registerStepUpRoutes = (
  app: WorkerApp,
  dependencies: AuthenticationDependencies,
): void => {
  app.use('/api/v1/auth/step-up/*', mfaOperationTelemetry);
  app.post('/api/v1/auth/step-up/challenges', async (context) => {
    configureRoute(context, 'AUTH-API-20');
    const admitted = await admitMfaMutation(
      context,
      dependencies,
      'AUTH-API-20',
      {
        schema: StepUpChallengeRequestSchema,
        idempotency: false,
        ifMatch: false,
      },
    );
    if (admitted instanceof Response) return admitted;
    const create = dependencies.createStepUpChallenge;
    if (create === undefined) return missingSliceDependency(context);
    const result = await withRouteDeadline('AUTH-API-20', (signal) =>
      create(
        {
          session: admitted.session,
          request: context.req.raw,
          method: admitted.body.method,
          factorId: admitted.body.factorId ?? null,
        },
        context.env,
        signal,
      ),
    );
    if (!result.ok) return responseForMfaError(context, 'AUTH-API-20', result);
    const parsed = StepUpChallengeSchema.safeParse(result.value);
    return parsed.success
      ? jsonSuccess(context, parsed.data, 201, 'no-store')
      : invalidPersistence(context, 'AUTH-API-20');
  });

  app.post(
    '/api/v1/auth/step-up/challenges/:challengeId/verify',
    async (context) => {
      configureRoute(context, 'AUTH-API-21');
      const admitted = await admitMfaMutation(
        context,
        dependencies,
        'AUTH-API-21',
        {
          schema: StepUpVerifyRequestSchema,
          path: () =>
            parsePathId(
              context,
              AuthStepUpChallengePathSchema.shape.challengeId,
              context.req.param('challengeId'),
            ),
          idempotency: false,
          ifMatch: false,
        },
      );
      if (admitted instanceof Response) return admitted;
      const verify = dependencies.verifyStepUpChallenge;
      if (verify === undefined) return missingSliceDependency(context);
      const result = await withRouteDeadline('AUTH-API-21', (signal) =>
        verify(
          {
            session: admitted.session,
            request: context.req.raw,
            challengeId: admitted.path,
            code: admitted.body.code,
          },
          context.env,
          signal,
        ),
      );
      if (!result.ok)
        return responseForMfaError(context, 'AUTH-API-21', result);
      const parsed = StepUpResultSchema.safeParse(result.value.resource);
      if (!parsed.success) return invalidPersistence(context, 'AUTH-API-21');
      const response = jsonSuccess(context, parsed.data, 200, 'no-store');
      appendCookies(response, result.value.cookies);
      return response;
    },
  );
};
