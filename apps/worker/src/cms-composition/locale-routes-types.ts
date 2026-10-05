import type {
  LocaleVariantRequest,
  LocaleVariantResource,
} from '@wejammin/contracts';

import type { CmsEditorialSession } from '../cms-editorial/types';

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

export type CmsLocaleRateInput = Readonly<{
  operationId: 'CMS-03C-04';
  request: Request;
  actorId: string;
  actingPartyId: string;
  principalClass: 'human';
  rateClass: 'cms-locale-write';
  rateScope: 'user' | 'party';
  limit: 60 | 120;
  windowSeconds: 60;
}>;
export type CmsLocaleRateDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}>;
export type CmsLocaleTelemetry = Readonly<{
  operationId: 'CMS-03C-04';
  requestId: string;
  status: number;
  outcome: 'success' | 'rejected' | 'failure';
  actorClass: 'human';
  durationMs: number;
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
  telemetry: (event: CmsLocaleTelemetry) => void | Promise<void>;
}>;
