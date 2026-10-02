import type { WorkerContext } from '../index';
import { isMfaCircuitOpenError } from './mfa-provider-breaker';
import type { MfaProviderPort } from './mfa-types';

/**
 * BE01a "MFA factors and step-up" observability. One `identity.mfa.operation`
 * event per request: the operation, the safe reason, step-up shortfalls,
 * lockouts, provider latency and circuit state and reconciling marks, as log
 * attributes and metrics. A code, secret, URI, token, factor or provider
 * identifier is never attached; the only inputs are the response status,
 * its ApiError code and details, and the timing of provider calls.
 */
export const MFA_OPERATION_EVENT = 'identity.mfa.operation';

type ProviderCall = Readonly<{ latencyMs: number; circuitOpen: boolean }>;
const providerCalls = new WeakMap<Request, ProviderCall[]>();

/** Times every provider call against the request that caused it. */
export const withMfaProviderTelemetry = (
  provider: MfaProviderPort,
  now: () => number = Date.now,
): MfaProviderPort => {
  const timed =
    <Input extends Readonly<{ request: Request }>, Output extends object>(
      call: (
        input: Input,
        signal: AbortSignal,
      ) => Promise<Output & Readonly<{ ok: boolean }>>,
    ) =>
    async (input: Input, signal: AbortSignal) => {
      const startedAt = now();
      const result = await call(input, signal);
      const entry: ProviderCall = {
        latencyMs: Math.max(0, now() - startedAt),
        circuitOpen: !result.ok && isMfaCircuitOpenError(result),
      };
      providerCalls.set(input.request, [
        ...(providerCalls.get(input.request) ?? []),
        entry,
      ]);
      return result;
    };
  return {
    enroll: timed(provider.enroll),
    unenroll: timed(provider.unenroll),
    challenge: timed(provider.challenge),
    verify: timed(provider.verify),
  } as MfaProviderPort;
};

type Body = Readonly<{
  code?: unknown;
  details?: Readonly<Record<string, unknown>>;
}>;

const readBody = async (response: Response): Promise<Body> => {
  if (response.status < 400) return {};
  try {
    const parsed: unknown = await response.clone().json();
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Body)
      : {};
  } catch {
    return {};
  }
};

const reasonCodeOf = (details: Body['details']): string | null => {
  if (details === undefined) return null;
  if (typeof details.reasonCode === 'string') return details.reasonCode;
  const violations = details.violations;
  if (Array.isArray(violations)) {
    const first = violations[0] as { code?: unknown } | undefined;
    if (typeof first?.code === 'string') return first.code;
  }
  return null;
};

const VERIFICATION = new Set(['AUTH-API-18', 'AUTH-API-21']);
const POST_SEND = new Set(['AUTH-API-18', 'AUTH-API-19']);
const TRACED = new Set([
  'AUTH-API-17',
  'AUTH-API-18',
  'AUTH-API-19',
  'AUTH-API-21',
]);

export const emitMfaOperation = async (
  context: WorkerContext,
): Promise<void> => {
  try {
    const operation = String(context.get('operation'));
    const response = context.res;
    const status = response.status;
    const body = await readBody(response);
    const errorCode = typeof body.code === 'string' ? body.code : null;
    const reasonCode = reasonCodeOf(body.details);
    const calls = providerCalls.get(context.req.raw) ?? [];
    const circuitOpen = calls.some((call) => call.circuitOpen);
    const lockout =
      VERIFICATION.has(operation) &&
      status === 429 &&
      typeof body.details?.retryAfterSeconds === 'number';
    const verificationFailure =
      VERIFICATION.has(operation) && status >= 400 && !lockout && status < 500;
    const reconciling =
      POST_SEND.has(operation) &&
      calls.length > 0 &&
      (status === 500 || status === 502 || status === 504);
    const stepUpRequired = errorCode === 'STEP_UP_REQUIRED';
    const failed = status >= 400;
    const metrics: Record<string, number> = {};
    if (stepUpRequired) metrics.stepUpRequired = 1;
    if (lockout) metrics.lockout = 1;
    if (verificationFailure) metrics.verificationFailure = 1;
    if (reconciling) metrics.reconciling = 1;
    if (circuitOpen) metrics.circuitOpen = 1;
    if (calls.length > 0) {
      metrics.providerCalls = calls.length;
      metrics.providerLatencyMs = calls.reduce(
        (total, call) => total + call.latencyMs,
        0,
      );
    }
    const details = {
      attributes: {
        operationId: operation,
        errorCode,
        reasonCode,
        stepUpRequired,
        lockout,
        reconciling,
        circuit: calls.length === 0 ? null : circuitOpen ? 'open' : 'closed',
      },
      correlationId: context.get('correlationId'),
      durationMs: Math.max(0, Date.now() - context.get('startedAt')),
      eventName: MFA_OPERATION_EVENT,
      metrics,
      operation,
      outcome: !failed ? 'success' : status >= 500 ? 'failure' : 'rejected',
      requestId: context.get('requestId'),
    } as const;
    const logger = context.get('logger');
    // MFA operations are rare and their metrics are derived from these
    // events, so none is sampled out; failures of the traced operations are
    // additionally high-risk (100% trace retention).
    const options = {
      highRisk: failed && TRACED.has(operation),
      samplingClass: 'always',
    } as const;
    if (failed) logger.warn(details, options);
    else logger.info(details, options);
  } catch {
    // Telemetry failure cannot alter the response.
  }
};

export const mfaOperationTelemetry = async (
  context: WorkerContext,
  next: () => Promise<void>,
): Promise<void> => {
  await next();
  await emitMfaOperation(context);
};
