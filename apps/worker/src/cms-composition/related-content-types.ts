import type {
  RelatedContentResource,
  RelatedContentRuleRead,
  RelatedContentRuleRequest,
} from '@wejammin/contracts';

import type { CmsEditorialSession } from '../cms-editorial/types';
import type { CompositionObservation } from './observability-observation';

type Status =
  400 | 401 | 403 | 404 | 409 | 415 | 422 | 429 | 500 | 502 | 503 | 504;

export type CmsRelatedContentError = Readonly<{
  ok: false;
  status: Status;
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
  retryAfterSeconds?: number;
}>;

export type CmsRelatedContentResult<T> =
  Readonly<{ ok: true; value: T }> | CmsRelatedContentError;

export type CmsRelatedContentPortInput = Readonly<{
  operationId: 'CMS-03C-05';
  request: Request;
  requestId: string;
  session: CmsEditorialSession;
  path: Readonly<{ entryId: string }>;
  body: RelatedContentRuleRequest;
  idempotencyKey: string;
  ifMatch: string;
}>;

/**
 * `cmsRelatedContentRead` (DEC-195) carries the verified session and the one path entry id: no body, no
 * precondition, no idempotency key. The port re-proves the source edit assignment in the database.
 */
export type CmsRelatedContentReadInput = Readonly<{
  operationId: 'cmsRelatedContentRead';
  request: Request;
  requestId: string;
  session: CmsEditorialSession;
  path: Readonly<{ entryId: string }>;
}>;

type RateInputBase = Readonly<{
  request: Request;
  actorId: string;
  actingPartyId: string;
  principalClass: 'human';
  rateScope: 'user' | 'party';
  windowSeconds: 60;
}>;

/** The write buckets are 60/120 per minute, the read buckets 300/600 (BE03c route registry). */
export type CmsRelatedContentRateInput = RateInputBase &
  (
    | Readonly<{
        operationId: 'CMS-03C-05';
        rateClass: 'cms-related-content-write';
        limit: 60 | 120;
      }>
    | Readonly<{
        operationId: 'cmsRelatedContentRead';
        rateClass: 'cms-related-content-read';
        limit: 300 | 600;
      }>
  );

export type CmsRelatedContentRateDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}>;

export type CmsRelatedContentTelemetry = Readonly<{
  operationId: 'CMS-03C-05' | 'cmsRelatedContentRead';
  requestId: string;
  status: number;
  outcome: 'success' | 'rejected' | 'failure';
  actorClass: 'human';
  durationMs: number;
  /** BE03c Observability: the trace, counters and allowlisted log members of the request. */
  observation?: CompositionObservation;
}>;

export type CmsRelatedContentDependencies = Readonly<{
  humanOrigins: readonly string[];
  now: () => number;
  resolveSession: (
    request: Request,
    signal: AbortSignal,
  ) => Promise<CmsRelatedContentResult<CmsEditorialSession>>;
  rateLimit: (
    input: CmsRelatedContentRateInput,
    signal: AbortSignal,
  ) => Promise<CmsRelatedContentResult<CmsRelatedContentRateDecision>>;
  actRelatedContent: (
    input: CmsRelatedContentPortInput,
    signal: AbortSignal,
  ) => Promise<CmsRelatedContentResult<RelatedContentResource>>;
  readRelatedContent: (
    input: CmsRelatedContentReadInput,
    signal: AbortSignal,
  ) => Promise<CmsRelatedContentResult<RelatedContentRuleRead>>;
  telemetry: (event: CmsRelatedContentTelemetry) => void | Promise<void>;
}>;

export type { Status as CmsRelatedContentStatus };
