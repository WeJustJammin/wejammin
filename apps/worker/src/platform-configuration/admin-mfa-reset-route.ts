import {
  Cfg05b06MfaFactorResetRequestSchema,
  Cfg05b06MfaFactorResetResponseSchema,
  type Cfg05b06MfaFactorResetResponse,
} from '@wejammin/contracts';

import type { WorkerApp, WorkerContext, WorkerDependencies } from '../index';
import {
  authError,
  responseForAuthError,
  safeIdentifierDigest,
} from '../authentication/boundary';
import { isFreshProof, stepUpRequiredError } from '../authentication/step-up';
import type { AuthenticationResult } from '../authentication/types';
import { admit, parseBody, withDeadline } from './admin-route-admission';
import { enforceMfaResetRate } from './admin-mfa-reset-rate';
import {
  checkConfigurationSameOrigin,
  csrfIfCookie,
  parseConfigurationCommandHeaders,
} from './route-support';
import type { AdminMfaFactorResetPort } from './types';

const OPERATION_ID = 'CFG-05B-06';

const portFor = (
  dependencies: WorkerDependencies,
): AdminMfaFactorResetPort | undefined =>
  dependencies.adminWorkspace?.resetMfaFactors ??
  dependencies.platformConfiguration?.resetMfaFactors;

const outcomeFor = (
  outcome: AuthenticationResult<unknown>,
): 'success' | 'rejected' | 'failure' => {
  if (outcome.ok) return 'success';
  return outcome.status < 500 ? 'rejected' : 'failure';
};

/** One hashed security event: no ids, reason, factor or provider detail. */
const logReset = async (
  context: WorkerContext,
  authUserId: string,
  targetPersonId: string,
  outcome: AuthenticationResult<unknown>,
  startedAt: number,
  now: () => number,
): Promise<void> => {
  try {
    const value =
      outcome.ok && typeof outcome.value === 'object' && outcome.value !== null
        ? (outcome.value as Readonly<Record<string, unknown>>)
        : {};
    const details = {
      attributes: {
        actorHash: await safeIdentifierDigest(authUserId),
        targetHash: await safeIdentifierDigest(targetPersonId),
        state: typeof value.state === 'string' ? value.state : null,
        removedFactorCount:
          typeof value.removedFactorCount === 'number'
            ? value.removedFactorCount
            : null,
      },
      correlationId: context.get('correlationId'),
      durationMs: Math.max(0, now() - startedAt),
      eventName: 'admin.mfa-factor.reset',
      operation: OPERATION_ID,
      outcome: outcomeFor(outcome),
      requestId: context.get('requestId'),
    };
    const logger = context.get('logger');
    const options = { highRisk: true, samplingClass: 'always' } as const;
    if (details.outcome === 'success') logger.info(details, options);
    else logger.warn(details, options);
  } catch {
    // Telemetry failure cannot alter the recovery response.
  }
};

const parseResponse = (
  value: unknown,
): AuthenticationResult<Cfg05b06MfaFactorResetResponse> => {
  const parsed = Cfg05b06MfaFactorResetResponseSchema.safeParse(value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : authError(
        502,
        'UPSTREAM_FAILURE',
        'The admin workspace dependency returned an invalid response.',
      );
};

export const createAdminMfaResetRoute =
  (dependencies: WorkerDependencies) =>
  async (context: WorkerContext): Promise<Response> => {
    context.set('operation', OPERATION_ID);
    return withDeadline(context, OPERATION_ID, async (signal) => {
      const origin = checkConfigurationSameOrigin(context);
      if (!origin.ok) return responseForAuthError(context, origin);
      const body = await parseBody(
        context.req.raw,
        Cfg05b06MfaFactorResetRequestSchema,
        signal,
      );
      if (!body.ok) return responseForAuthError(context, body);
      const headers = parseConfigurationCommandHeaders(context.req.raw);
      if (!headers.ok) return responseForAuthError(context, headers);
      const admitted = await admit(context, dependencies, OPERATION_ID, signal);
      if ('response' in admitted) return admitted.response;
      const { session, requestContext } = admitted;
      if (!isFreshProof(session.stepUpAt, Date.now()))
        return responseForAuthError(context, stepUpRequiredError());
      const csrf = await csrfIfCookie(context);
      if (!csrf.ok) return responseForAuthError(context, csrf);
      const rate = await enforceMfaResetRate(
        context,
        // `admit` already refused the request when auth is not composed.
        dependencies.auth!,
        session,
        signal,
      );
      if (rate !== null) return rate;
      if (body.value.targetPersonId === session.personId)
        return responseForAuthError(
          context,
          authError(
            422,
            'MFA_RESET_INVALID',
            'An operator cannot reset their own authenticators.',
          ),
        );
      const port = portFor(dependencies);
      const startedAt = dependencies.now();
      const outcome: AuthenticationResult<unknown> =
        port === undefined
          ? authError(
              503,
              'DEPENDENCY_UNAVAILABLE',
              'Admin workspace persistence is temporarily unavailable.',
              { dependencyClass: 'admin_workspace', retryable: true },
            )
          : await port(
              {
                request: context.req.raw,
                body: body.value,
                session,
                requestContext,
                idempotencyKey: headers.value.idempotencyKey,
              },
              context.env,
              signal,
            );
      const checked = outcome.ok ? parseResponse(outcome.value) : outcome;
      await logReset(
        context,
        session.authUserId,
        body.value.targetPersonId,
        checked,
        startedAt,
        dependencies.now,
      );
      if (!checked.ok) return responseForAuthError(context, checked);
      context.header('cache-control', 'no-store');
      const response = context.json(
        checked.value,
        checked.value.state === 'reconciling' ? 202 : 200,
      );
      context.res = response;
      return response;
    });
  };

export const registerAdminMfaResetRoute = (
  app: WorkerApp,
  dependencies: WorkerDependencies,
): void => {
  app.post(
    '/api/v1/admin/identity/mfa-factor-resets',
    createAdminMfaResetRoute(dependencies),
  );
};
