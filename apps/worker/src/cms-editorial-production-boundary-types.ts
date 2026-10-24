import type { CmsEditorialProductionOperationId } from './cms-editorial-production-types';

/** Server-derived session and acting context; browsers never supply these. */
export type CmsEditorialSession = Readonly<{
  userId: string;
  actingPartyId: string | null;
  capabilities: readonly string[];
  mfaFresh: boolean;
}>;

export type CmsEditorialServerSessionContext = Readonly<{
  authUserId: string;
  sessionId: string;
  actorPersonId: string | null;
  actingPartyId: string | null;
  stepUpAt: string | null;
}>;

/** BE00 rate-limit decision surface mirrored from the auth dependency. */
export type CmsEditorialRateLimitDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}>;

/**
 * Rate seam for the editorial lane. 03b is human-only, so `principalClass` is
 * pinned to `human` and there is no release-worker bucket to key against.
 */
export type CmsEditorialRateLimitInput = Readonly<{
  // Restore consumes a quota before its migration-chain RPC is wired.
  operationId:
    | CmsEditorialProductionOperationId
    | 'CMS-03C-01'
    | 'CMS-03C-02'
    | 'CMS-03C-03'
    | 'CMS-03C-04'
    | 'cmsLocaleVariantRead'
    | 'CMS-03C-05'
    | 'cmsRelatedContentRead'
    | 'CMS-03C-06'
    | 'CMS-03C-07'
    | 'CMS-03C-08'
    | 'CMS-03C-09'
    | 'CMS-03C-10'
    | 'CMS-03C-11'
    | 'cmsTemplateContextRead'
    | 'cmsTemplateLatestRead'
    | 'CMS-03C-12'
    | 'CMS-03C-13'
    | 'CMS-03C-14'
    | 'CMS-03C-15'
    | 'cmsCompositionInstancesRead'
    | 'cmsPatternLatestRead'
    | 'CMS-03C-16'
    | 'CMS-03C-17'
    | 'cmsTaxonomyVersionsRead'
    | 'cmsTaxonomyTermsRead';
  request: Request;
  /**
   * The bucket identity for THIS scope. For `user` it is the acting user id;
   * for `party` it is the acting party id, because BE03b keys the party quota
   * by acting party rather than by user.
   */
  actorId: string;
  actingPartyId: string | null;
  principalClass: 'human';
  rateClass: string;
  limit: number;
  windowSeconds: number;
  /**
   * Required. BE03b CMS-03B-01 enforces two independent buckets (120/min/user
   * and 240/min/party), so the limiter must enforce exactly the named scope and
   * key it by its own bucket identity. A single user-keyed call can never stand
   * in for the party quota.
   */
  rateScope: 'user' | 'party';
}>;

export type CmsEditorialProductionError = Readonly<{
  ok: false;
  status: 400 | 401 | 403 | 404 | 409 | 415 | 422 | 429 | 500 | 502 | 503 | 504;
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
  retryAfterSeconds?: number;
}>;

/**
 * A success may carry `replayed`: the database answered an exact-key replay
 * with the original committed outcome (response header
 * `x-cms-idempotent-replay: true`). It never reaches a client; telemetry uses
 * it so a replay is not counted as a second creation.
 */
export type CmsEditorialProductionResult<T> =
  | Readonly<{ ok: true; value: T; replayed?: true }>
  | CmsEditorialProductionError;

export type CmsEditorialProductionConfiguration = Readonly<{
  baseUrl: string;
  secret: string;
  fetchImpl: typeof fetch;
  maxResponseBytes: number;
  now: () => number;
}>;
