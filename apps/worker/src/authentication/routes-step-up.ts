import {
  AuthStepUpChallengePathSchema,
  StepUpChallengeRequestSchema,
  StepUpChallengeSchema,
  StepUpResultSchema,
  StepUpVerifyRequestSchema,
} from '@wejammin/contracts';

import type { WorkerApp, WorkerContext } from '../index';
import { appendCookies, authError, responseForAuthError } from './boundary';
import { jsonSuccess } from './route-support';
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

export const registerStepUpRoutes = (
  app: WorkerApp,
  dependencies: AuthenticationDependencies,
): void => {
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
    if (dependencies.createStepUpChallenge === undefined)
      return missingSliceDependency(context);
    const result = await dependencies.createStepUpChallenge(
      {
        session: admitted.session,
        request: context.req.raw,
        method: admitted.body.method,
        factorId: admitted.body.factorId ?? null,
      },
      context.env,
      new AbortController().signal,
    );
    if (!result.ok) return responseForAuthError(context, result);
    const parsed = StepUpChallengeSchema.safeParse(result.value);
    return parsed.success
      ? jsonSuccess(context, parsed.data, 201, 'no-store')
      : invalidPersistence(context);
  });

  app.post(
    '/api/v1/auth/step-up/challenges/:challengeId/verify',
    async (context) => {
      configureRoute(context, 'AUTH-API-21');
      const challengeId = parsePathId(
        context,
        AuthStepUpChallengePathSchema.shape.challengeId,
        context.req.param('challengeId') ?? '',
      );
      if (!challengeId.ok) return responseForAuthError(context, challengeId);
      const admitted = await admitMfaMutation(
        context,
        dependencies,
        'AUTH-API-21',
        {
          schema: StepUpVerifyRequestSchema,
          idempotency: false,
          ifMatch: false,
        },
      );
      if (admitted instanceof Response) return admitted;
      if (dependencies.verifyStepUpChallenge === undefined)
        return missingSliceDependency(context);
      const result = await dependencies.verifyStepUpChallenge(
        {
          session: admitted.session,
          request: context.req.raw,
          challengeId: challengeId.value,
          code: admitted.body.code,
        },
        context.env,
        new AbortController().signal,
      );
      if (!result.ok) return responseForAuthError(context, result);
      const parsed = StepUpResultSchema.safeParse(result.value.resource);
      if (!parsed.success) return invalidPersistence(context);
      const response = jsonSuccess(context, parsed.data, 200, 'no-store');
      appendCookies(response, result.value.cookies);
      return response;
    },
  );
};
