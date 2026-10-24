import type {
  LocaleVariantRead,
  LocaleVariantRequest,
  LocaleVariantResource,
} from '@wejammin/contracts';

import type { CmsEditorialSession } from '../cms-editorial/types';
import type { CompositionObservation } from './observability-observation';

export type CmsLocaleStatus =
  400 | 401 | 403 | 404 | 409 | 415 | 422 | 429 | 500 | 502 | 503 | 504;

export type CmsLocaleError = Readonly<{
  ok: false;
  status: CmsLocaleStatus;
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
  retryAfterSeconds?: number;
}>;
export type CmsLocaleResult<T> =
  Readonly<{ ok: true; value: T }> | CmsLocaleError;

export type CmsLocalePortInput = Readonly<{
  operationId: 'CMS-03C-04';
  request: Request;
  requestId: string;
  session: CmsEditorialSession;
  path: Readonly<{ entryId: string; locale: string }>;
  body: LocaleVariantRequest;
  idempotencyKey: string;
  ifMatch: string;
}>;

/**
 * `cmsLocaleVariantRead` (DEC-205) carries the verified session and the two path members: no body, no
 * precondition, no query. The database re-proves the entry visibility and edit assignment.
 */
export type CmsLocaleReadInput = Readonly<{
  operationId: 'cmsLocaleVariantRead';
  request: Request;
  requestId: string;
  session: CmsEditorialSession;
  path: Readonly<{ entryId: string; locale: string }>;
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
export type CmsLocaleRateInput = RateInputBase &
  (
    | Readonly<{
        operationId: 'CMS-03C-04';
        rateClass: 'cms-locale-write';
        limit: 60 | 120;
      }>
    | Readonly<{
        operationId: 'cmsLocaleVariantRead';
        rateClass: 'cms-locale-read';
        limit: 300 | 600;
      }>
  );
export type CmsLocaleRateDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}>;
export type CmsLocaleTelemetry = Readonly<{
  operationId: 'CMS-03C-04' | 'cmsLocaleVariantRead';
  requestId: string;
  status: number;
  outcome: 'success' | 'rejected' | 'failure';
  actorClass: 'human';
  durationMs: number;
  /** BE03c Observability: the trace, counters and allowlisted log members of the request. */
  observation?: CompositionObservation;
}>;
export type CmsLocaleDependencies = Readonly<{
  humanOrigins: readonly string[];
  now: () => number;
  resolveSession: (
    request: Request,
    signal: AbortSignal,
  ) => Promise<CmsLocaleResult<CmsEditorialSession>>;
  rateLimit: (
    input: CmsLocaleRateInput,
    signal: AbortSignal,
  ) => Promise<CmsLocaleResult<CmsLocaleRateDecision>>;
  authorLocale: (
    input: CmsLocalePortInput,
    signal: AbortSignal,
  ) => Promise<CmsLocaleResult<LocaleVariantResource>>;
  readLocaleVariant: (
    input: CmsLocaleReadInput,
    signal: AbortSignal,
  ) => Promise<CmsLocaleResult<LocaleVariantRead>>;
  telemetry: (event: CmsLocaleTelemetry) => void | Promise<void>;
}>;
