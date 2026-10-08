import {
  deadlineExceeded,
  invalidResponse,
  isAbortError,
  mapAuthenticationFailure,
  unavailable,
} from './cms-editorial-production-errors';
import type {
  CmsEditorialProductionOptions,
  CmsEditorialProductionResult,
  CmsEditorialRateLimitDecision,
  CmsEditorialRateLimitInput,
} from './cms-editorial-production-types';

const digestHex = async (value: string): Promise<string> =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

/**
 * Scope-pinned bucket identity. BE03b keys the user bucket by actor and the
 * party bucket by acting party, so a user id must never hash into the party
 * quota. The digest is what the shared limiter persists; it never sees the raw
 * user or party identifier.
 */
export const bucketDigestFor = async (
  input: CmsEditorialRateLimitInput,
): Promise<string> =>
  digestHex(
    input.rateScope === 'party'
      ? `party:${input.actorId}`
      : `user:${input.actorId}`,
  );

const authRateLimiter = (
  options: CmsEditorialProductionOptions,
):
  | ((
      input: CmsEditorialRateLimitInput,
      signal: AbortSignal,
    ) => Promise<CmsEditorialProductionResult<CmsEditorialRateLimitDecision>>)
  | undefined => {
  const limiter = options.auth?.rateLimit;
  if (limiter === undefined) return undefined;
  return async (input, signal) => {
    const identifierDigest = await bucketDigestFor(input);
    const result = await limiter(
      {
        operationId: input.operationId,
        request: input.request,
        // BE03b:1351: an explicit scope keys the user bucket by actor alone and
        // the party bucket by acting party alone. Without it the shared limiter
        // falls back to its client-address bucket and the two quotas bleed into
        // each other and into the caller's IP.
        scope: input.rateScope,
        authUserId: input.rateScope === 'user' ? input.actorId : null,
        actingPartyId: input.rateScope === 'party' ? input.actorId : null,
        identifierDigest,
        limit: input.limit,
        windowSeconds: input.windowSeconds,
      },
      options.environment,
      signal,
    );
    if (result.ok) return result;
    return mapAuthenticationFailure(result);
  };
};

const decisionIsValid = (
  value: CmsEditorialRateLimitDecision,
  expectedLimit: number,
): boolean =>
  typeof value.allowed === 'boolean' &&
  Number.isSafeInteger(value.limit) &&
  value.limit === expectedLimit &&
  Number.isSafeInteger(value.remaining) &&
  value.remaining >= 0 &&
  value.remaining <= value.limit &&
  Number.isSafeInteger(value.resetAt) &&
  value.resetAt >= 0;

/**
 * Wrap the shared auth limiter with the editorial fail-closed bounds check. An
 * absent limiter or a decision outside the declared scope is a dependency
 * failure, never a silent allow.
 */
export const createRateLimiter = (
  options: CmsEditorialProductionOptions,
): ((
  input: CmsEditorialRateLimitInput,
  signal: AbortSignal,
) => Promise<CmsEditorialProductionResult<CmsEditorialRateLimitDecision>>) => {
  const limiter = options.rateLimit ?? authRateLimiter(options);
  return async (input, signal) => {
    if (limiter === undefined) return unavailable('rate_limiter');
    let result: CmsEditorialProductionResult<CmsEditorialRateLimitDecision>;
    try {
      result = await limiter(input, signal);
    } catch (error) {
      return isAbortError(error) || signal.aborted
        ? deadlineExceeded('rate_limiter')
        : unavailable('rate_limiter');
    }
    if (!result.ok) return result;
    if (!decisionIsValid(result.value, input.limit)) return invalidResponse();
    return { ok: true, value: result.value };
  };
};
