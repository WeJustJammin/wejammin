import type { CmsEditorialSession } from '../cms-editorial/types';
import { validEnvelope, validRate } from './related-content-envelope';
import { failure, statusOf } from './related-content-response';
import type {
  CmsRelatedContentDependencies,
  CmsRelatedContentError,
  CmsRelatedContentRateDecision,
  CmsRelatedContentRateInput,
  CmsRelatedContentResult,
} from './related-content-types';

type Scope = 'user' | 'party';
type Common = Omit<
  CmsRelatedContentRateInput,
  'operationId' | 'rateClass' | 'limit'
>;

/** One operation's quota: the registry rate class and the per-minute limit of each bucket. */
export type RelatedContentQuota = Readonly<{
  limit: (scope: Scope) => 60 | 120 | 300 | 600;
  input: (common: Common, scope: Scope) => CmsRelatedContentRateInput;
}>;

/** CMS-03C-05: 60 per minute per user, 120 per acting party. */
export const RELATED_WRITE_QUOTA: RelatedContentQuota = {
  limit: (scope) => (scope === 'user' ? 60 : 120),
  input: (common, scope) => ({
    ...common,
    operationId: 'CMS-03C-05',
    rateClass: 'cms-related-content-write',
    limit: scope === 'user' ? 60 : 120,
  }),
};

/** cmsRelatedContentRead (DEC-195): 300 per minute per user, 600 per acting party. */
export const RELATED_READ_QUOTA: RelatedContentQuota = {
  limit: (scope) => (scope === 'user' ? 300 : 600),
  input: (common, scope) => ({
    ...common,
    operationId: 'cmsRelatedContentRead',
    rateClass: 'cms-related-content-read',
    limit: scope === 'user' ? 300 : 600,
  }),
};

export type RelatedContentQuotaRefusal = Readonly<{
  error: CmsRelatedContentError;
  headers?: Headers;
}>;

/**
 * BE00 step 7: the user bucket, then the acting-party bucket. An aborted deadline, a failing or malformed limiter and a
 * decision outside the bucket's limit are dependency failures (never an allow); a denied bucket is a 429 whose
 * `Retry-After` is the seconds until the window resets. `null` means both buckets admitted the call.
 */
export const chargeRelatedContentQuota = async (
  dependencies: CmsRelatedContentDependencies,
  request: Request,
  session: CmsEditorialSession & Readonly<{ actingPartyId: string }>,
  signal: AbortSignal,
  quota: RelatedContentQuota,
): Promise<RelatedContentQuotaRefusal | null> => {
  for (const scope of ['user', 'party'] as const) {
    if (signal.aborted) return { error: failure(504, {}, 15) };
    const limit = quota.limit(scope);
    let rate: CmsRelatedContentResult<CmsRelatedContentRateDecision>;
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
        Math.ceil((rate.value.resetAt - dependencies.now()) / 1000),
      );
      return {
        error: failure(
          429,
          { retryAfterSeconds, limit, resetAt: rate.value.resetAt },
          retryAfterSeconds,
        ),
        headers: new Headers({
          'ratelimit-limit': String(limit),
          'ratelimit-remaining': '0',
        }),
      };
    }
  }
  return null;
};
