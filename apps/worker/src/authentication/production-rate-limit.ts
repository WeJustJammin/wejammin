import { PersonBootstrapResourceSchema } from '@wejammin/contracts';

import { authError } from './boundary';
import {
  asRecord,
  bytea,
  sha256Hex,
  traceFor,
  type AuthProductionConfiguration,
} from './production-configuration';
import { callAuthJson, callRpc, mapProductionFailure } from './production-http';
import {
  ACCESS_COOKIE,
  clearAuthCookies,
  readCookie,
} from './production-cookie';
import type { AuthenticationDependencies, AuthRateLimitInput } from './types';

const AUTH_RATE_LIMIT_OPERATION_PATTERN = /^AUTH-API-(?:0[1-9]|1[0-9]|2[01])$/u;
const AUTH_RATE_LIMIT_FALLBACK_OPERATION = 'AUTH-API-15' as const;

/**
 * Bucket identity per explicit scope. `user` and `party` buckets carry no
 * client address and no other identity; the default `client` scope keeps the
 * address-keyed buckets of the login and flow limits (a legacy party-only
 * bucket still drops the address). Returns null when the scope's identity is
 * missing, which the caller refuses rather than sharing a bucket.
 */
const rateBucketKey = (input: AuthRateLimitInput): string | null => {
  const operation = input.operationId;
  if (input.scope === 'user') {
    const identity = input.authUserId ?? input.identifierDigest;
    return identity === null || identity === ''
      ? null
      : `${operation}\u0000user\u0000${identity}`;
  }
  if (input.scope === 'party') {
    const party = input.actingPartyId;
    return typeof party !== 'string' || party === ''
      ? null
      : `${operation}\u0000party\u0000${party}`;
  }
  const isPartyBucket =
    input.authUserId === null &&
    typeof input.actingPartyId === 'string' &&
    input.actingPartyId !== '';
  const ip = isPartyBucket
    ? ''
    : (input.request.headers.get('cf-connecting-ip') ?? 'unknown');
  return `${operation}\u0000${ip}\u0000${input.authUserId ?? ''}\u0000${input.actingPartyId ?? ''}\u0000${input.identifierDigest ?? ''}`;
};

export const createOperationalDependencies = (
  config: AuthProductionConfiguration,
): Pick<AuthenticationDependencies, 'bootstrap' | 'logout' | 'rateLimit'> => ({
  bootstrap: async (session, idempotencyKey, request, _env, signal) => {
    try {
      const trace = traceFor(request);
      const result = asRecord(
        await callRpc(
          config,
          'auth_bootstrap',
          {
            p_auth_user_id: session.authUserId,
            p_key_hash: bytea(await sha256Hex(idempotencyKey)),
            p_request_hash: bytea(await sha256Hex('{}')),
            p_request_id: trace.requestId,
            p_correlation_id: trace.correlationId,
          },
          signal,
        ),
      );
      const parsed = PersonBootstrapResourceSchema.safeParse({
        personId: result?.personId,
        actingPartyId: result?.actingPartyId,
        contextKind: result?.contextKind,
        accountState: result?.accountState,
        bindingVersion: result?.bindingVersion,
      });
      return parsed.success && typeof result?.created === 'boolean'
        ? {
            ok: true,
            value: { created: result.created, resource: parsed.data },
          }
        : authError(
            502,
            'DEPENDENCY_INVALID_RESPONSE',
            'Authentication persistence returned an invalid response.',
          );
    } catch (error) {
      return mapProductionFailure(error);
    }
  },

  logout: async (session, input, idempotencyKey, request, _env, signal) => {
    try {
      const trace = traceFor(request);
      await callRpc(
        config,
        'auth_logout',
        {
          p_auth_user_id: session.authUserId,
          p_session_id: session.sessionId,
          p_scope: input.scope,
          p_key_hash: bytea(await sha256Hex(idempotencyKey)),
          p_request_hash: bytea(await sha256Hex(JSON.stringify(input))),
          p_request_id: trace.requestId,
          p_correlation_id: trace.correlationId,
        },
        signal,
      );
      const accessToken = readCookie(request, ACCESS_COOKIE);
      try {
        await callAuthJson(
          config,
          `/auth/v1/logout?scope=${input.scope === 'all' ? 'global' : 'local'}`,
          {
            method: 'POST',
            signal,
            headers:
              accessToken === null
                ? {}
                : { authorization: `Bearer ${accessToken}` },
          },
        );
      } catch {
        // Local revocation is authoritative; the outbox reconciles provider logout.
      }
      return { ok: true, value: { cookies: clearAuthCookies() } };
    } catch (error) {
      return mapProductionFailure(error);
    }
  },

  rateLimit: async (input, _env, signal) => {
    try {
      if (
        !Number.isSafeInteger(input.limit) ||
        input.limit < 1 ||
        input.limit > 10_000 ||
        !Number.isSafeInteger(input.windowSeconds) ||
        input.windowSeconds < 1 ||
        input.windowSeconds > 86_400
      )
        return authError(
          400,
          'INVALID_REQUEST',
          'The authentication rate limit request is invalid.',
        );
      const key = rateBucketKey(input);
      if (key === null)
        return authError(
          400,
          'INVALID_REQUEST',
          'The authentication rate limit request is invalid.',
        );
      const bucket = await sha256Hex(key);
      const operationId = AUTH_RATE_LIMIT_OPERATION_PATTERN.test(
        input.operationId,
      )
        ? input.operationId
        : AUTH_RATE_LIMIT_FALLBACK_OPERATION;
      const candidate = asRecord(
        await callRpc(
          config,
          'auth_rate_limit',
          {
            p_operation_id: operationId,
            p_bucket_digest: bucket,
            p_limit: input.limit,
            p_window_seconds: input.windowSeconds,
          },
          signal,
        ),
      );
      if (
        typeof candidate?.allowed !== 'boolean' ||
        typeof candidate.limit !== 'number' ||
        !Number.isSafeInteger(candidate.limit) ||
        candidate.limit < 1 ||
        candidate.limit > 10_000 ||
        typeof candidate.remaining !== 'number' ||
        !Number.isSafeInteger(candidate.remaining) ||
        candidate.remaining < 0 ||
        candidate.remaining > candidate.limit ||
        typeof candidate.resetAt !== 'number' ||
        !Number.isSafeInteger(candidate.resetAt) ||
        candidate.resetAt < 0
      ) {
        return authError(
          502,
          'DEPENDENCY_INVALID_RESPONSE',
          'Authentication persistence returned an invalid response.',
        );
      }
      return {
        ok: true,
        value: {
          allowed: candidate.allowed,
          limit: candidate.limit as number,
          remaining: candidate.remaining as number,
          resetAt: candidate.resetAt as number,
        },
      };
    } catch (error) {
      return mapProductionFailure(error);
    }
  },
});
