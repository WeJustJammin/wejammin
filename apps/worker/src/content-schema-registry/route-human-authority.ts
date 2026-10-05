import {
  checkOrigin,
  csrfErrorIfCookie,
  dependencyDeadline,
  requireCapability,
  validHumanSession,
} from './admission';
import { CMS_STEP_UP_ALLOWED_METHODS } from './production-errors';
import { rateLimitedError } from './route-rate-refusal';
import { reportRateRefusal } from './route-rate-telemetry';
import type { Refuse } from './route-refusal-telemetry';
import { policyFor, setRateHeaders } from './route-response';
import type { FeatureContext } from './route-types';
import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistryError,
  ContentSchemaRegistrySession,
  HumanMutationOperationId,
  HumanReadOperationId,
} from './types';

export type HumanAuthentication = Readonly<
  | { ok: true; session: ContentSchemaRegistrySession }
  | { ok: false; response: Response }
>;

const stepUpRequired = (): ContentSchemaRegistryError => ({
  ok: false,
  status: 401,
  code: 'STEP_UP_REQUIRED',
  message: 'Recent verification is required.',
  // BE00: a missing recent step-up is recoverable by completing recent
  // verification, not by reauthenticating. Only methods the server is
  // actually configured to accept may be advertised.
  details: {
    allowedMethods: CMS_STEP_UP_ALLOWED_METHODS,
    recoveryAction: 'step_up',
  },
});

/**
 * The per-party bucket exists only on rows that declare `partyRateLimit`; the
 * release-worker rows (CMS-03A-05 and CMS-03A-08) carry none.
 */
export const partyLimitFor = (
  policy: ReturnType<typeof policyFor>,
): Readonly<{ partyLimit?: number }> =>
  'partyRateLimit' in policy ? { partyLimit: policy.partyRateLimit } : {};

/**
 * The shared human route gates, one function per BE00 "Hono Middleware Order"
 * step, so a handler composes them in exactly the contract order:
 * - step 2 `origin` (CORS allowlist) and `csrf` (same-origin session-bound CSRF
 *   on cookie mutations whose policy requires it);
 * - steps 4 and 5 `authenticate` (verified session, then acting context);
 * - step 7 `authorize` (route capability, step-up freshness, then the per-user
 *   and per-party quota).
 * A refusal is the complete response and the operation port is never reached;
 * each gate answers through the caller's `refuse`, which reports the refusal as
 * sanitized denial telemetry before returning it.
 */
export const createHumanAuthority = (
  dependencies: ContentSchemaRegistryDependencies,
) => {
  const origin = (
    context: FeatureContext,
    refuse: Refuse,
  ): Promise<Response | null> => {
    const refusal = checkOrigin(context.req.raw, dependencies.humanOrigins);
    return refusal === null ? Promise.resolve(null) : refuse(refusal);
  };

  const csrf = (
    context: FeatureContext,
    refuse: Refuse,
  ): Promise<Response | null> => {
    const refusal = csrfErrorIfCookie(context.req.raw);
    return refusal === null ? Promise.resolve(null) : refuse(refusal);
  };

  const authenticate = async (
    context: FeatureContext,
    refuse: Refuse,
  ): Promise<HumanAuthentication> => {
    const resolved = await dependencyDeadline(
      (signal) => dependencies.resolveSession(context.req.raw, signal),
      dependencies.deadlineMs ?? 15_000,
    );
    if (!resolved.ok) return { ok: false, response: await refuse(resolved) };
    const invalidSession = validHumanSession(resolved.value);
    if (invalidSession !== null)
      return { ok: false, response: await refuse(invalidSession) };
    return { ok: true, session: resolved.value };
  };

  const authorize = async (
    context: FeatureContext,
    operationId: HumanMutationOperationId | HumanReadOperationId,
    session: ContentSchemaRegistrySession,
    refuse: Refuse,
  ): Promise<Response | null> => {
    const startedAt = dependencies.now?.() ?? Date.now();
    const deadlineMs = dependencies.deadlineMs ?? 15_000;
    const policy = policyFor(operationId);
    const capability = requireCapability(session, operationId);
    if (capability !== null) return refuse(capability);
    if (policy.stepUp === 'required' && !session.mfaFresh)
      return refuse(stepUpRequired());
    const rate = await dependencyDeadline(
      (signal) =>
        dependencies.rateLimit(
          {
            operationId,
            request: context.req.raw,
            actorId: session.userId,
            actingPartyId: session.actingPartyId,
            principalClass: 'human',
            rateClass: policy.rateClass,
            limit: policy.rateLimit,
            ...partyLimitFor(policy),
            windowSeconds: policy.rateWindowSeconds,
          },
          signal,
        ),
      deadlineMs,
    );
    if (!rate.ok) return refuse(rate);
    setRateHeaders(context, rate.value);
    if (!rate.value.allowed) {
      await reportRateRefusal(
        dependencies,
        context,
        operationId,
        'human',
        rate.value,
        startedAt,
      );
      return refuse(
        rateLimitedError(rate.value, dependencies.now?.() ?? Date.now()),
      );
    }
    return null;
  };

  return { origin, csrf, authenticate, authorize };
};
