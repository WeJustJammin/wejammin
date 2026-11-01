import type {
  PatternInstanceRequest,
  PatternPlacementResource,
} from '@wejammin/contracts';
import {
  PatternPlacementResourceSchema,
  PatternNodePathSchema,
  QuotedVersionSchema,
} from '@wejammin/contracts';

import type { CompositionObservation } from './observability-observation';
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
  502: 'DEPENDENCY_UNAVAILABLE',
  503: 'DEPENDENCY_UNAVAILABLE',
  504: 'DEPENDENCY_UNAVAILABLE',
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

/**
 * DEC-189: the CMS-03C-02 decoded/serialized response ceiling (1 MiB, UTF-8).
 * Every other request and response keeps the ordinary 256 KiB ceiling.
 */
export const CMS_PLACEMENT_MAX_RESPONSE_BYTES = 1_048_576;

/** True when the UTF-8 serialization of a value fits the given byte budget. */
export const serializedBytesWithin = (value: unknown, limit: number): boolean =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength <= limit;
export type CmsPatternInstanceResult<T> =
  Readonly<{ ok: true; value: T }> | CmsPatternInstanceError;
/**
 * CMS-03C-02 answers 201 PatternPlacementResource and forwards the committed
 * entry aggregate strong ETag; the value is the placement list and the ETag
 * rides beside it (never a synthesized row version, never a public field).
 */
export type CmsPatternInstancePlacementResult =
  | Readonly<{ ok: true; value: PatternPlacementResource; etag: string }>
  | CmsPatternInstanceError;
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
  /** BE03c Observability: the trace, counters and allowlisted log members of the request. */
  observation?: CompositionObservation;
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
  ) => Promise<CmsPatternInstancePlacementResult>;
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

/** The declared row path bound (DEC-186): the /blocks/{path} pointer budget. */
const PLACEMENT_PATH_MAX_BYTES = 248;

const placementPathBytes = (value: string): number =>
  new TextEncoder().encode(value).byteLength;

/**
 * DEC-186: a row path is the requested slot path joined with the root key
 * chain, so the relative part must be a normalized node path
 * (PatternNodePathSchema): no empty, dot or trailing segment. The root slot
 * path / adds no extra separator, so the whole path is the node path.
 */
const isNormalizedDescendant = (slotPath: string, path: string): boolean => {
  const prefix = slotPath === '/' ? '/' : slotPath + '/';
  if (!path.startsWith(prefix) || path.length <= prefix.length) return false;
  const relative = slotPath === '/' ? path : path.slice(slotPath.length);
  return PatternNodePathSchema.safeParse(relative).success;
};

/**
 * A placement result envelope carries the list value and the forwarded ETag.
 * Session and rate results keep the generic validEnvelope.
 */
export const validPlacementResult = (
  value: unknown,
): value is CmsPatternInstancePlacementResult =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  'ok' in value &&
  typeof value.ok === 'boolean' &&
  (value.ok
    ? 'value' in value &&
      'etag' in value &&
      QuotedVersionSchema.safeParse((value as { etag: unknown }).etag).success
    : 'status' in value && typeof value.status === 'number');

/**
 * The port must bind the actual request, not merely be a uniform list. Every
 * row is pinned to the request revision, pattern version and link mode; when
 * the request carries a digest every row equals it; every row path is a
 * normalized descendant of the requested slot within the 248-octet bound.
 * Uniformity, unique paths/ids and strictly increasing, possibly sparse
 * positions are schema refinements; the list is never sorted or truncated.
 * Selected roots bind the exact full-path set, not the order of this list.
 */
export const validPlacement = (
  value: unknown,
  body: PatternInstanceRequest,
  etag: unknown,
): value is PatternPlacementResource => {
  if (!QuotedVersionSchema.safeParse(etag).success) return false;
  const parsed = PatternPlacementResourceSchema.safeParse(value);
  if (!parsed.success) return false;
  const prefix = body.slotPath === '/' ? '' : body.slotPath;
  const selectedPaths =
    body.roots === undefined
      ? undefined
      : new Set(body.roots.map((root) => prefix + root));
  if (
    selectedPaths !== undefined &&
    parsed.data.items.length !== selectedPaths.size
  )
    return false;
  return parsed.data.items.every((item) => {
    if (
      item.revisionId !== body.revisionId ||
      item.patternId !== body.patternId ||
      item.patternVersion !== body.patternVersion ||
      item.linkMode !== body.linkMode
    )
      return false;
    if (
      body.blockRegistryDigest !== undefined &&
      item.blockRegistryDigest !== body.blockRegistryDigest
    )
      return false;
    return (
      (selectedPaths === undefined || selectedPaths.has(item.path)) &&
      isNormalizedDescendant(body.slotPath, item.path) &&
      placementPathBytes(item.path) <= PLACEMENT_PATH_MAX_BYTES
    );
  });
};
