import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistryResult,
  RateLimitDecision,
} from './types';
import type { ContentSchemaRegistryProductionOptions } from './production-types';
import { MAX_RATE_RESET_EPOCH_SECONDS } from './route-rate-refusal';
import {
  deadlineExceeded,
  invalidResponse,
  isAbortError,
  mapAuthResult,
  unavailable,
} from './production-errors';

const digestHex = async (value: BufferSource): Promise<string> =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', value))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

/** The decision that leaves the least room: refused first, then fewest remaining. */
const stricterDecision = (
  first: RateLimitDecision,
  second: RateLimitDecision,
): RateLimitDecision => {
  if (first.allowed !== second.allowed) return first.allowed ? second : first;
  if (first.remaining !== second.remaining)
    return first.remaining < second.remaining ? first : second;
  return first.limit <= second.limit ? first : second;
};

/**
 * Enforces the per-user bucket and, for a human with an acting party, the
 * per-party bucket (BE03a rate rows), each with an explicit rate scope. The
 * user bucket is keyed by operation plus the server-derived auth user only
 * (scope `user`: no acting party, no client address). The party bucket is keyed
 * by operation plus the server-derived party only (scope `party`: no user, no
 * client address). A user refused by their own bucket is not charged to the
 * party. If the party bucket cannot be evaluated the request fails closed.
 */
const authRateLimiter = (
  options: ContentSchemaRegistryProductionOptions,
): ContentSchemaRegistryDependencies['rateLimit'] | undefined => {
  const limiter = options.auth?.rateLimit;
  if (limiter === undefined) return undefined;
  return async (input, signal) => {
    const bucket = async (
      scope: 'party' | 'user',
      authUserId: string | null,
      actingPartyId: string | null,
      identifier: string,
      limit: number,
    ): Promise<ContentSchemaRegistryResult<RateLimitDecision>> =>
      mapAuthResult(
        await limiter(
          {
            operationId: input.operationId,
            request: input.request,
            scope,
            authUserId,
            actingPartyId,
            identifierDigest: await digestHex(
              new TextEncoder().encode(identifier),
            ),
            limit,
            windowSeconds: input.windowSeconds,
          },
          options.environment,
          signal,
        ),
      );
    const user = await bucket(
      'user',
      input.principalClass === 'human' ? input.actorId : null,
      null,
      `${input.principalClass}:${input.actorId}`,
      input.limit,
    );
    if (
      !user.ok ||
      !user.value.allowed ||
      input.principalClass !== 'human' ||
      input.actingPartyId === null ||
      input.partyLimit === undefined
    )
      return user;
    const party = await bucket(
      'party',
      null,
      input.actingPartyId,
      `party:${input.actingPartyId}`,
      input.partyLimit,
    );
    return party.ok
      ? { ok: true, value: stricterDecision(user.value, party.value) }
      : party;
  };
};

export const createRateLimiter = (
  options: ContentSchemaRegistryProductionOptions,
): ContentSchemaRegistryDependencies['rateLimit'] => {
  const limiter = options.rateLimit ?? authRateLimiter(options);
  return async (input, signal) => {
    if (limiter === undefined) return unavailable('rate_limiter');
    try {
      const result = await limiter(input, signal);
      if (!result.ok) return result;
      const value = result.value;
      if (
        typeof value.allowed !== 'boolean' ||
        !Number.isSafeInteger(value.limit) ||
        value.limit < 1 ||
        value.remaining < 0 ||
        !Number.isSafeInteger(value.remaining) ||
        value.remaining > value.limit ||
        !Number.isSafeInteger(value.resetAt) ||
        value.resetAt < 0 ||
        value.resetAt > MAX_RATE_RESET_EPOCH_SECONDS
      )
        return invalidResponse();
      return {
        ok: true,
        value,
      } as ContentSchemaRegistryResult<RateLimitDecision>;
    } catch (error) {
      return isAbortError(error) || signal.aborted
        ? deadlineExceeded('rate_limiter')
        : unavailable('rate_limiter');
    }
  };
};
