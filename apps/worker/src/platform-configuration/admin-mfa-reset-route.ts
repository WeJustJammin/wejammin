import {
  Cfg05b06IdempotencyKeySchema,
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
import { isMfaCircuitOpenError } from '../authentication/mfa-provider-breaker';
import { isFreshProof, stepUpRequiredError } from '../authentication/step-up';
import type { AuthenticationResult } from '../authentication/types';
import {
  admitSession,
  decodeAdminBody,
  requireAdminCapability,
  withDeadline,
} from './admin-route-admission';
import { enforceMfaResetRate } from './admin-mfa-reset-rate';
import {
  admitConfigurationTransport,
  parseConfigurationCommandHeaders,
} from './route-support';
import type { AdminMfaFactorResetPort } from './types';

const OPERATION_ID = 'CFG-05B-06';

const portFor = (
  dependencies: WorkerDependencies,
): AdminMfaFactorResetPort | undefined =>
  dependencies.adminWorkspace?.resetMfaFactors ??
  dependencies.platformConfiguration?.resetMfaFactors;

const outcomeFor = (status: number): 'success' | 'rejected' | 'failure' => {
  if (status < 400) return 'success';
  return status < 500 ? 'rejected' : 'failure';
};

/** Closed set of counters BE05b names for CFG-05B-06. */
type ResetSignal =
  | 'circuit_open'
  | 'completed'
  | 'denied'
  | 'failed'
  | 'identity_unavailable'
  | 'rate_limited'
  | 'reconciling'
  | 'rejected'
  | 'stale_step_up';

export type Trace = {
  authUserId: string | null;
  targetPersonId: string | null;
  failure: AuthenticationResult<unknown> | null;
};

const signalFor = (
  status: number,
  code: string | null,
  state: string | null,
  circuitOpen: boolean,
): ResetSignal => {
  if (status === 200) return 'completed';
  if (status === 202)
    return state === 'reconciling' ? 'reconciling' : 'completed';
  if (status === 403) return 'denied';
  if (status === 429) return 'rate_limited';
  if (status === 401 && code === 'STEP_UP_REQUIRED') return 'stale_step_up';
  if (status === 503 && code === 'IDENTITY_UNAVAILABLE')
    return circuitOpen ? 'circuit_open' : 'identity_unavailable';
  return status < 500 ? 'rejected' : 'failed';
};

const readBody = async (
  response: Response,
): Promise<Readonly<Record<string, unknown>>> => {
  try {
    const parsed: unknown = await response.clone().json();
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Readonly<Record<string, unknown>>)
      : {};
  } catch {
    return {};
  }
};

/**
 * One hashed security event per request, whatever the outcome: reset id (when
 * a reset exists), actor and target hashes, state, removed-factor count and a
 * closed signal. No factor, provider or reason detail is ever attached.
 */
export const logReset = async (
  context: WorkerContext,
  trace: Trace,
  response: Response,
  startedAt: number,
  now: () => number,
): Promise<void> => {
  try {
    const body = await readBody(response);
    const success = response.status < 300;
    const circuitOpen =
      trace.failure !== null &&
      !trace.failure.ok &&
      isMfaCircuitOpenError(trace.failure);
    const state = typeof body.state === 'string' ? body.state : null;
    const signal = signalFor(
      response.status,
      success ? null : String(body.code ?? ''),
      state,
      circuitOpen,
    );
    const attributes: Record<string, string | number | boolean | null> = {
      signal,
      targetHash:
        trace.targetPersonId === null
          ? null
          : await safeIdentifierDigest(trace.targetPersonId),
      actorHash:
        trace.authUserId === null
          ? null
          : await safeIdentifierDigest(trace.authUserId),
      state,
      removedFactorCount:
        typeof body.removedFactorCount === 'number'
          ? body.removedFactorCount
          : null,
    };
    if (success && typeof body.resetId === 'string')
      attributes.resetId = body.resetId;
    const details = {
      attributes,
      metrics: {
        [signal]: 1,
        ...(typeof body.removedFactorCount === 'number'
          ? { removedFactorCount: body.removedFactorCount }
          : {}),
      },
      correlationId: context.get('correlationId'),
      durationMs: Math.max(0, now() - startedAt),
      eventName: 'admin.mfa-factor.reset',
      operation: OPERATION_ID,
      outcome: outcomeFor(response.status),
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

const execute = async (
  context: WorkerContext,
  dependencies: WorkerDependencies,
  signal: AbortSignal,
  trace: Trace,
): Promise<Response> => {
  // BE00 step 2: origin, body ceiling, content type, session-bound CSRF.
  const transport = await admitConfigurationTransport(context, signal);
  if (!transport.ok) return responseForAuthError(context, transport);
  // BE00 steps 4 and 5: verified session, then the acting context.
  const admitted = await admitSession(context, dependencies, signal);
  if ('response' in admitted) return admitted.response;
  const { session, requestContext } = admitted;
  trace.authUserId = session.authUserId;
  // BE00 step 6: strict body.
  const body = decodeAdminBody(
    transport.value,
    Cfg05b06MfaFactorResetRequestSchema,
  );
  if (!body.ok) return responseForAuthError(context, body);
  trace.targetPersonId = body.value.targetPersonId;
  // BE00 step 7: capability, step-up freshness, then quota.
  const denied = requireAdminCapability(context, OPERATION_ID, requestContext);
  if (denied !== null) return denied;
  if (!isFreshProof(session.stepUpAt, Date.now()))
    return responseForAuthError(context, stepUpRequiredError());
  const rate = await enforceMfaResetRate(
    context,
    // `admit` already refused the request when auth is not composed.
    dependencies.auth!,
    session,
    signal,
  );
  if (rate !== null) return rate;
  // BE00 step 8: exact Idempotency-Key.
  const headers = parseConfigurationCommandHeaders(context.req.raw);
  if (!headers.ok) return responseForAuthError(context, headers);
  if (
    !Cfg05b06IdempotencyKeySchema.safeParse(headers.value.idempotencyKey)
      .success
  )
    return responseForAuthError(
      context,
      authError(400, 'INVALID_REQUEST', 'A valid Idempotency-Key is required.'),
    );
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
  if (!checked.ok) {
    trace.failure = checked;
    return responseForAuthError(context, checked);
  }
  context.header('cache-control', 'no-store');
  const response = context.json(
    checked.value,
    checked.value.state === 'reconciling' ? 202 : 200,
  );
  context.res = response;
  return response;
};

export const createAdminMfaResetRoute =
  (dependencies: WorkerDependencies) =>
  async (context: WorkerContext): Promise<Response> => {
    context.set('operation', OPERATION_ID);
    return withDeadline(context, OPERATION_ID, async (signal) => {
      const startedAt = dependencies.now();
      const trace: Trace = {
        authUserId: null,
        targetPersonId: null,
        failure: null,
      };
      const response = await execute(context, dependencies, signal, trace);
      await logReset(context, trace, response, startedAt, dependencies.now);
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
