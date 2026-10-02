import { authError } from './boundary';
import type { AuthProductionConfiguration } from './production-configuration';
import { sessionCookies } from './production-cookie';
import { mapProductionFailure } from './production-http';
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
 * aal2"). `validate` has no persistent effect: the provider session must
 * verify exactly like a sign-in token, belong to the initiating Auth UUID,
 * carry `aal2`, and hold a fresh MFA `amr` timestamp. It then seals the
 * replacement cookies locally. The first-party index-row swap travels with the
 * settle RPC (`rotation`), so settlement and rotation commit atomically and a
 * failed rotation can never strand the caller with a consumed proof.
 */
export const createSessionRotation = (
  config: AuthProductionConfiguration,
): SessionRotationPort => ({
  validate: async ({ session, payload }, signal) => {
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
    try {
      return {
        ok: true,
        value: {
          stepUpAt,
          freshUntil: freshUntilFor(stepUpAt),
          rotation: {
            sessionId: token.sessionId,
            issuedAt: new Date(config.now()).toISOString(),
          },
          cookies: await sessionCookies(token, config),
        },
      };
    } catch (error) {
      return mapProductionFailure(error);
    }
  },
});
