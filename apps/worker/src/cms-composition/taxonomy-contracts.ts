import type {
  TaxonomyTermActionRequest,
  TaxonomyTermResource,
} from '@wejammin/contracts';
import { TaxonomyTermResourceSchema } from '@wejammin/contracts';

import type { CmsEditorialSession } from '../cms-editorial/types';

export type Status =
  400 | 401 | 403 | 404 | 409 | 415 | 422 | 429 | 500 | 502 | 503 | 504;

export const ERROR_CODES: Readonly<Record<Status, string>> = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'TAXONOMY_FORBIDDEN',
  404: 'TAXONOMY_NOT_FOUND',
  409: 'TAXONOMY_VERSION_CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'TAXONOMY_VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'DEPENDENCY_INVALID_RESPONSE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_DEADLINE_EXCEEDED',
};

export const statusOf = (value: number): Status =>
  Object.hasOwn(ERROR_CODES, value) ? (value as Status) : 500;

export type CmsTaxonomyError = Readonly<{
  ok: false;
  status: Status;
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
  retryAfterSeconds?: number;
}>;
export type CmsTaxonomyResult<T> =
  Readonly<{ ok: true; value: T }> | CmsTaxonomyError;
export type CmsTaxonomyPortInput = Readonly<{
  operationId: 'CMS-03C-03';
  request: Request;
  requestId: string;
  session: CmsEditorialSession;
  path: Readonly<{ taxonomyId: string }>;
  body: TaxonomyTermActionRequest;
  idempotencyKey: string;
  ifMatch: string;
}>;
export type CmsTaxonomyRateInput = Readonly<{
  operationId: 'CMS-03C-03';
  request: Request;
  actorId: string;
  actingPartyId: string;
  principalClass: 'human';
  rateClass: 'cms-taxonomy-write';
  rateScope: 'user' | 'party';
  limit: 60 | 120;
  windowSeconds: 60;
}>;
export type CmsTaxonomyRateDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}>;
export type CmsTaxonomyTelemetry = Readonly<{
  operationId: 'CMS-03C-03';
  requestId: string;
  status: number;
  outcome: 'success' | 'rejected' | 'failure';
  actorClass: 'human';
  durationMs: number;
}>;
export type CmsTaxonomyDependencies = Readonly<{
  humanOrigins: readonly string[];
  now: () => number;
  resolveSession: (
    request: Request,
    signal: AbortSignal,
  ) => Promise<CmsTaxonomyResult<CmsEditorialSession>>;
  rateLimit: (
    input: CmsTaxonomyRateInput,
    signal: AbortSignal,
  ) => Promise<CmsTaxonomyResult<CmsTaxonomyRateDecision>>;
  actTerm: (
    input: CmsTaxonomyPortInput,
    signal: AbortSignal,
  ) => Promise<CmsTaxonomyResult<TaxonomyTermResource>>;
  telemetry: (event: CmsTaxonomyTelemetry) => void | Promise<void>;
}>;

export const failure = (
  status: Status,
  details: Readonly<Record<string, unknown>> = {},
  retryAfterSeconds?: number,
): CmsTaxonomyError => ({
  ok: false,
  status,
  code: ERROR_CODES[status],
  message: `${ERROR_CODES[status]}: taxonomy operation rejected or unavailable.`,
  details,
  ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
});

export const validEnvelope = <T>(
  value: unknown,
): value is CmsTaxonomyResult<T> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  'ok' in value &&
  typeof value.ok === 'boolean' &&
  (value.ok
    ? 'value' in value
    : 'status' in value && typeof value.status === 'number');

export const validRate = (
  value: unknown,
  limit: 60 | 120,
): value is CmsTaxonomyRateDecision =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  'allowed' in value &&
  typeof value.allowed === 'boolean' &&
  'limit' in value &&
  value.limit === limit &&
  'remaining' in value &&
  typeof value.remaining === 'number' &&
  Number.isSafeInteger(value.remaining) &&
  value.remaining >= 0 &&
  value.remaining <= limit &&
  'resetAt' in value &&
  typeof value.resetAt === 'number' &&
  Number.isSafeInteger(value.resetAt) &&
  value.resetAt >= 0;

export const validTerm = (
  value: unknown,
  body: TaxonomyTermActionRequest,
): value is TaxonomyTermResource => {
  const parsed = TaxonomyTermResourceSchema.safeParse(value);
  if (!parsed.success) return false;
  const term = parsed.data;
  return (
    term.taxonomyId === body.taxonomyId &&
    term.id === term.termId &&
    term.termKey === body.termKey &&
    term.parentId === body.parentId &&
    term.successorId === body.survivorId &&
    term.lifecycle ===
      (body.action === 'merge'
        ? 'merged'
        : body.action === 'deprecate'
          ? 'deprecated'
          : 'active') &&
    term.version ===
      (body.action === 'create'
        ? '1'
        : String(BigInt(body.expectedVersion) + 1n))
  );
};
