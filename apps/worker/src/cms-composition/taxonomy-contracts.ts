import type {
  TaxonomyTermActionRequest,
  TaxonomyTermResource,
} from '@wejammin/contracts';
import { TaxonomyTermResourceSchema } from '@wejammin/contracts';
import type { CompositionObservation } from './observability-observation';

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
  502: 'DEPENDENCY_UNAVAILABLE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_UNAVAILABLE',
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
  /** BE03c Observability: the trace, counters and allowlisted log members of the request. */
  observation?: CompositionObservation;
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

/**
 * The CMS-03C-03 answer is the TERM row (`cms_term_resource`, 20261014120200), not the vocabulary: its `version` is the
 * term's own row version (1 on create, a later one after every other action) and is unrelated to the active
 * TaxonomyVersion `expectedVersion` the If-Match carries (BE03c 1380). `create` and `rename` apply the requested
 * parent (D3); `alias`, `deprecate` and `merge` keep the stored one. A deprecated term can still be renamed or aliased
 * (BE03c 1377), so those two accept `active` or `deprecated`; only `merge` names a successor, the requested survivor.
 */
export const validTerm = (
  value: unknown,
  body: TaxonomyTermActionRequest,
): value is TaxonomyTermResource => {
  const parsed = TaxonomyTermResourceSchema.safeParse(value);
  if (!parsed.success) return false;
  const term = parsed.data;
  const first = body.action === 'create';
  const lifecycles: readonly string[] =
    body.action === 'merge'
      ? ['merged']
      : body.action === 'deprecate'
        ? ['deprecated']
        : first
          ? ['active']
          : ['active', 'deprecated'];
  return (
    term.taxonomyId === body.taxonomyId &&
    term.id === term.termId &&
    term.termKey === body.termKey &&
    (body.action === 'create' || body.action === 'rename'
      ? term.parentId === body.parentId
      : true) &&
    term.successorId === (body.action === 'merge' ? body.survivorId : null) &&
    lifecycles.includes(term.lifecycle) &&
    (first ? term.version === '1' : BigInt(term.version) >= 2n)
  );
};
