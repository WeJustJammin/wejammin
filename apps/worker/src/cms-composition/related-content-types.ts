import type {
  RelatedContentResource,
  RelatedContentRuleRequest,
} from '@wejammin/contracts';

import type { CmsEditorialSession } from '../cms-editorial/types';

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

export type CmsRelatedContentRateInput = Readonly<{
  operationId: 'CMS-03C-05';
  request: Request;
  actorId: string;
  actingPartyId: string;
  principalClass: 'human';
  rateClass: 'cms-related-content-write';
  rateScope: 'user' | 'party';
  limit: 60 | 120;
  windowSeconds: 60;
}>;

export type CmsRelatedContentRateDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}>;

export type CmsRelatedContentTelemetry = Readonly<{
  operationId: 'CMS-03C-05';
  requestId: string;
  status: number;
  outcome: 'success' | 'rejected' | 'failure';
  actorClass: 'human';
  durationMs: number;
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
  telemetry: (event: CmsRelatedContentTelemetry) => void | Promise<void>;
}>;

export type { Status as CmsRelatedContentStatus };
