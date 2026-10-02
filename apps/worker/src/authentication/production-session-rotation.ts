import { authError } from './boundary';
import {
  traceFor,
  type AuthProductionConfiguration,
} from './production-configuration';
import { sessionCookies } from './production-cookie';
import { callRpc, mapProductionFailure } from './production-http';
import { verifyTokenResponse } from './production-token';
import { freshUntilFor, isFreshProof } from './step-up';
import type { SessionRotationPort } from './mfa-types';

const invalidRotation = () =>
  authError(
    502,
    'PROVIDER_INVALID_RESPONSE',
    'The authentication provider returned an invalid response.',
  );

/**
 * AUTH-API-18 and AUTH-API-21 session rotation (BE01a "Session rotation to
 * aal2"). `validate` has no local effect: the provider session must verify
 * exactly like a sign-in token, belong to the initiating Auth UUID, carry
 * `aal2`, and hold a fresh MFA `amr` timestamp. `commit` then touches or swaps
 * the first-party index row and returns the replacement cookies together, so
 * a failed transaction can never strand the caller with half-rotated cookies.
 */
export const createSessionRotation = (
  config: AuthProductionConfiguration,
): SessionRotationPort => ({
  validate: async ({ session, request, payload }, signal) => {
    const verified = await verifyTokenResponse(payload, config, signal);
    if (!verified.ok) return verified;
    const token = verified.value;
    if (
      token.authUserId !== session.authUserId ||
      token.aal !== 'aal2' ||
      token.stepUpAt === null ||
      !isFreshProof(token.stepUpAt, config.now())
    )
      return invalidRotation();
    const stepUpAt = token.stepUpAt;
    return {
      ok: true,
      value: {
        stepUpAt,
        freshUntil: freshUntilFor(stepUpAt),
        commit: async (commitSignal) => {
          try {
            const trace = traceFor(request);
            const sameSession = token.sessionId === session.sessionId;
            await callRpc(
              config,
              sameSession ? 'auth_session_register' : 'auth_session_rotate',
              {
                p_auth_user_id: token.authUserId,
                ...(sameSession
                  ? {}
                  : { p_previous_session_id: session.sessionId }),
                p_session_id: token.sessionId,
                p_issued_at: new Date(config.now()).toISOString(),
                p_request_id: trace.requestId,
                p_correlation_id: trace.correlationId,
              },
              commitSignal,
            );
            return {
              ok: true,
              value: { cookies: await sessionCookies(token, config) },
            };
          } catch (error) {
            return mapProductionFailure(error);
          }
        },
      },
    };
  },
});
