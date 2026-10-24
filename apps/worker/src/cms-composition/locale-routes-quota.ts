import type { CmsEditorialSession } from '../cms-editorial/types';
import {
  failure,
  statusOf,
  validEnvelope,
  validRate,
} from './locale-routes-support';
import type {
  CmsLocaleDependencies,
  CmsLocaleError,
  CmsLocaleRateDecision,
  CmsLocaleRateInput,
  CmsLocaleResult,
} from './locale-routes-types';

type Scope = 'user' | 'party';
type Common = Omit<CmsLocaleRateInput, 'operationId' | 'rateClass' | 'limit'>;

/** One operation's quota: the registry rate class and the per-minute limit of each bucket. */
export type LocaleQuota = Readonly<{
  limit: (scope: Scope) => 60 | 120 | 300 | 600;
  input: (common: Common, scope: Scope) => CmsLocaleRateInput;
}>;

/** cmsLocaleVariantRead (DEC-205): 300 per minute per user, 600 per acting party. */
export const LOCALE_READ_QUOTA: LocaleQuota = {
  limit: (scope) => (scope === 'user' ? 300 : 600),
  input: (common, scope) => ({
    ...common,
    operationId: 'cmsLocaleVariantRead',
    rateClass: 'cms-locale-read',
    limit: scope === 'user' ? 300 : 600,
  }),
};

export type LocaleQuotaRefusal = Readonly<{
  error: CmsLocaleError;
  headers?: Headers;
}>;

/**
 * BE00 step 7: the user bucket, then the acting-party bucket. An aborted deadline, a failing or malformed limiter and a
 * decision outside the bucket's limit are dependency failures (never an allow); a denied bucket is a 429 whose
 * `Retry-After` is the seconds until the window resets (`resetAt` is epoch seconds). `null` means both buckets admitted.
 */
export const chargeLocaleQuota = async (
  dependencies: CmsLocaleDependencies,
  request: Request,
  session: CmsEditorialSession & Readonly<{ actingPartyId: string }>,
  signal: AbortSignal,
  quota: LocaleQuota,
): Promise<LocaleQuotaRefusal | null> => {
  for (const scope of ['user', 'party'] as const) {
    if (signal.aborted) return { error: failure(504, {}, 15) };
    const limit = quota.limit(scope);
    let rate: CmsLocaleResult<CmsLocaleRateDecision>;
    try {
      rate = await dependencies.rateLimit(
        quota.input(
          {
            request,
            actorId: scope === 'user' ? session.userId : session.actingPartyId,
            actingPartyId: session.actingPartyId,
            principalClass: 'human',
            rateScope: scope,
            windowSeconds: 60,
          },
          scope,
        ),
        signal,
      );
    } catch {
      return { error: failure(503, {}, 15) };
    }
    if (!validEnvelope(rate)) return { error: failure(502) };
    if (!rate.ok)
      return {
        error: failure(
          statusOf(rate.status),
          rate.details,
          rate.retryAfterSeconds,
        ),
      };
    if (!validRate(rate.value, limit)) return { error: failure(502) };
    if (!rate.value.allowed) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(rate.value.resetAt - dependencies.now() / 1000),
      );
      return {
        error: failure(
          429,
          { retryAfterSeconds, limit, resetAt: String(rate.value.resetAt) },
          retryAfterSeconds,
        ),
        headers: new Headers({
          'ratelimit-limit': String(limit),
          'ratelimit-remaining': '0',
          'ratelimit-reset': String(rate.value.resetAt),
        }),
      };
    }
  }
  return null;
};
