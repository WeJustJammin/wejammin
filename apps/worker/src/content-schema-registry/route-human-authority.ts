import {
  checkOrigin,
  csrfErrorIfCookie,
  dependencyDeadline,
  requireCapability,
  validHumanSession,
} from './admission';
import { CMS_STEP_UP_ALLOWED_METHODS } from './production-errors';
import { rateLimitedError } from './route-rate-refusal';
import { errorResponse, policyFor, setRateHeaders } from './route-response';
import type { FeatureContext } from './route-types';
import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistryError,
  ContentSchemaRegistrySession,
  HumanMutationOperationId,
  HumanReadOperationId,
} from './types';

export type HumanAuthority = Readonly<
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
 * The shared human authority pipeline: origin, session, capability, step-up
 * (policy `stepUp: required`), CSRF (policy `csrf: required`), then the
 * per-user and per-party rate gate. A refusal is the complete response and
 * the operation port is never reached.
 */
export const createHumanAuthority =
  (dependencies: ContentSchemaRegistryDependencies) =>
  async (
    context: FeatureContext,
    operationId: HumanMutationOperationId | HumanReadOperationId,
  ): Promise<HumanAuthority> => {
    const requestId = context.get('requestId');
    const refuse = (error: ContentSchemaRegistryError): HumanAuthority => ({
      ok: false,
      response: errorResponse(context, error, requestId),
    });
    const deadlineMs = dependencies.deadlineMs ?? 15_000;
    const policy = policyFor(operationId);
    const origin = checkOrigin(context.req.raw, dependencies.humanOrigins);
    if (origin !== null) return refuse(origin);
    const resolved = await dependencyDeadline(
      (signal) => dependencies.resolveSession(context.req.raw, signal),
      deadlineMs,
    );
    if (!resolved.ok) return refuse(resolved);
    const session = resolved.value;
    const invalidSession = validHumanSession(session);
    if (invalidSession !== null) return refuse(invalidSession);
    const capability = requireCapability(session, operationId);
    if (capability !== null) return refuse(capability);
    if (policy.stepUp === 'required' && !session.mfaFresh)
      return refuse(stepUpRequired());
    if (policy.csrf === 'required') {
      const csrf = csrfErrorIfCookie(context.req.raw);
      if (csrf !== null) return refuse(csrf);
    }
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
    if (!rate.value.allowed)
      return refuse(
        rateLimitedError(rate.value, dependencies.now?.() ?? Date.now()),
      );
    return { ok: true, session };
  };
