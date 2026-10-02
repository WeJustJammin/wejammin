import { CorrelationIdSchema } from '@wejammin/contracts';
import {
  type CmsEditorialProductionOperationId,
  type CmsEditorialSession,
  type CmsEditorialServerSessionContext,
} from './cms-editorial-production-types';
export {
  configuredOriginList,
  validateOriginList,
} from './cms-editorial-production-session-configuration';
export { createCmsEditorialSessionResolver } from './cms-editorial-production-session-resolver';

const STEP_UP_FRESHNESS_MS = 10 * 60 * 1000;

/**
 * The single freshness test for a step-up proof. Both `mfaFresh` on the session
 * and `stepUpVerified` in the RPC context are derived from this, so a stale or
 * future-dated proof can never be reported as verified transport evidence to the
 * RPC (today a no-op for -01, but the proof is forwarded for later -04/-09 work).
 */
export const stepUpIsFresh = (
  stepUpAt: string | null | undefined,
  now: number,
): boolean => {
  if (stepUpAt === null || stepUpAt === undefined) return false;
  const stepUpMs = Date.parse(stepUpAt);
  return (
    Number.isFinite(stepUpMs) &&
    stepUpMs <= now &&
    now - stepUpMs <= STEP_UP_FRESHNESS_MS
  );
};

/** Server-bound port input; browsers never supply session or context values. */
export type CmsEditorialPortInput = Readonly<{
  operationId: CmsEditorialProductionOperationId;
  requestId: string;
  request: Request;
  session?: CmsEditorialSession;
  path?: Readonly<{ entryId: string; conflictId?: string }>;
  query?: Readonly<Record<string, unknown>>;
  /** The already-validated request body; authority keys are rejected, not read. */
  body?: object;
  idempotencyKey?: string;
  ifMatch?: string;
}>;

export const correlationFor = (
  input: Pick<CmsEditorialPortInput, 'request' | 'requestId'>,
): string => {
  const parsed = CorrelationIdSchema.safeParse(
    input.request.headers.get('x-correlation-id'),
  );
  return parsed.success ? parsed.data : input.requestId;
};

/**
 * Server-derived context block. The RPC rechecks assignment, capability, and
 * workflow state regardless, so this is a transport convenience, not authority.
 */
export const cmsEditorialContextFor = (
  input: Pick<CmsEditorialPortInput, 'request' | 'requestId' | 'session'>,
  contexts: WeakMap<Request, CmsEditorialServerSessionContext>,
  now: () => number,
): Readonly<Record<string, unknown>> => {
  const fromServer = contexts.get(input.request);
  const userId = fromServer?.authUserId ?? input.session?.userId;
  const actingPartyId =
    fromServer?.actingPartyId ?? input.session?.actingPartyId ?? null;
  const sessionId = fromServer?.sessionId;
  const actorPersonId = fromServer?.actorPersonId;
  const stepUpAt = fromServer?.stepUpAt;
  const stepUpVerified =
    fromServer === undefined
      ? (input.session?.mfaFresh ?? false)
      : stepUpIsFresh(stepUpAt, now());
  return {
    ...(userId === undefined ? {} : { authUserId: userId }),
    ...(sessionId === undefined ? {} : { sessionId }),
    ...(actorPersonId === undefined ? {} : { actorPersonId }),
    actingPartyId,
    ...(stepUpAt === undefined || stepUpAt === null ? {} : { stepUpAt }),
    stepUpVerified,
    requestId: input.requestId,
    correlationId: correlationFor(input),
  };
};

export {
  projectEditorialBody,
  validateCmsEditorialPortInput,
  cmsEditorialRpcBodyFor,
} from './cms-editorial-production-session-rpc-body';
export { validCapabilities } from './cms-editorial-production-session-capabilities';
