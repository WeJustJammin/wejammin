import type {
  CompositionInstanceResource,
  PatternInstanceRequest,
} from '@wejammin/contracts';
import { CompositionInstanceResourceSchema } from '@wejammin/contracts';

import type { CmsEditorialSession } from '../cms-editorial/types';

export type Status =
  400 | 401 | 403 | 404 | 409 | 415 | 422 | 429 | 500 | 502 | 503 | 504;

export const ERROR_CODES: Readonly<Record<Status, string>> = {
  400: 'INVALID_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'COMPOSITION_FORBIDDEN',
  404: 'COMPOSITION_NOT_FOUND',
  409: 'COMPOSITION_VERSION_CONFLICT',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'COMPOSITION_VALIDATION_FAILED',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
  502: 'DEPENDENCY_INVALID_RESPONSE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_DEADLINE_EXCEEDED',
};

export const statusOf = (value: number): Status =>
  Object.hasOwn(ERROR_CODES, value) ? (value as Status) : 500;

export type CmsPatternInstanceError = Readonly<{
  ok: false;
  status: Status;
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
  retryAfterSeconds?: number;
}>;
export type CmsPatternInstanceResult<T> =
  Readonly<{ ok: true; value: T }> | CmsPatternInstanceError;
export type CmsPatternInstancePortInput = Readonly<{
  operationId: 'CMS-03C-02';
  request: Request;
  requestId: string;
  session: CmsEditorialSession;
  body: PatternInstanceRequest;
  idempotencyKey: string;
  ifMatch: string;
}>;
export type CmsPatternInstanceRateInput = Readonly<{
  operationId: 'CMS-03C-02';
  request: Request;
  actorId: string;
  actingPartyId: string;
  principalClass: 'human';
  rateClass: 'cms-composition-write';
  rateScope: 'user' | 'party';
  limit: 120 | 240;
  windowSeconds: 60;
}>;
export type CmsPatternInstanceRateDecision = Readonly<{
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}>;
export type CmsPatternInstanceTelemetry = Readonly<{
  operationId: 'CMS-03C-02';
  requestId: string;
  status: number;
  outcome: 'success' | 'rejected' | 'failure';
  actorClass: 'human';
  durationMs: number;
}>;
export type CmsPatternInstanceDependencies = Readonly<{
  humanOrigins: readonly string[];
  now: () => number;
  resolveSession: (
    request: Request,
    signal: AbortSignal,
  ) => Promise<CmsPatternInstanceResult<CmsEditorialSession>>;
  rateLimit: (
    input: CmsPatternInstanceRateInput,
    signal: AbortSignal,
  ) => Promise<CmsPatternInstanceResult<CmsPatternInstanceRateDecision>>;
  insertPattern: (
    input: CmsPatternInstancePortInput,
    signal: AbortSignal,
  ) => Promise<CmsPatternInstanceResult<CompositionInstanceResource>>;
  telemetry: (event: CmsPatternInstanceTelemetry) => void | Promise<void>;
}>;

export const failure = (
  status: Status,
  details: Readonly<Record<string, unknown>> = {},
  retryAfterSeconds?: number,
): CmsPatternInstanceError => ({
  ok: false,
  status,
  code: ERROR_CODES[status],
  message: `${ERROR_CODES[status]}: composition operation rejected or unavailable.`,
  details,
  ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
});

export const validEnvelope = <T>(
  value: unknown,
): value is CmsPatternInstanceResult<T> =>
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
  limit: 120 | 240,
): value is CmsPatternInstanceRateDecision =>
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

export const validInstance = (
  value: unknown,
  body: PatternInstanceRequest,
): value is CompositionInstanceResource => {
  const parsed = CompositionInstanceResourceSchema.safeParse(value);
  if (!parsed.success) return false;
  const instance = parsed.data;
  return (
    instance.revisionId === body.revisionId &&
    instance.path === body.slotPath &&
    instance.patternId === body.patternId &&
    instance.patternVersion === body.patternVersion &&
    instance.linkMode === body.linkMode &&
    (body.blockRegistryDigest === undefined ||
      instance.blockRegistryDigest === body.blockRegistryDigest)
  );
};
