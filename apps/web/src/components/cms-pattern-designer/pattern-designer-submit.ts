import type { PatternVersionRequest } from '@wejammin/contracts';
import {
  CMS_HASH_PATTERN,
  isCmsUuid,
  isCmsVersion,
} from '@wejammin/contracts/client';

import {
  PATTERN_CATALOG_CODES,
  patternWriteReason,
  type PatternWriteReason,
} from './pattern-designer-reasons';
import { countWrittenNodes } from './pattern-tree-rules';

/*
 * The browser transport of CMS-03C-12 (zod-free, FE03 AC261). The same-origin proxy
 * has already parsed the strict `PatternVersionResource` and bound it to the request,
 * so the browser repeats that binding structurally: a 2xx that is not the answer to
 * THIS request is an unknown outcome, never a guessed success. An unknown outcome
 * keeps the form's `Idempotency-Key` and replays the identical request (BE03c 1502).
 */
export const PATTERN_WRITE_PATH = '/api/v1/cms/patterns/versions';
const UNKNOWN_OUTCOME_HEADER = 'x-cms-editorial-outcome';

export interface PatternCreatedFacts {
  readonly id: string;
  readonly patternKey: string;
  readonly patternVersion: number;
  readonly version: string;
  readonly nodeCount: number;
  /** The server-computed registry digest (never typed, never sent). */
  readonly blockRegistryDigest: string;
}

export type PatternRejectedStatus =
  400 | 401 | 403 | 404 | 415 | 422 | 429 | 500 | 502 | 503 | 504;

export type PatternSubmitResult =
  | { readonly kind: 'created'; readonly resource: PatternCreatedFacts }
  /** A plain compare-and-set conflict: another version of the key was written. */
  | { readonly kind: 'conflict'; readonly currentVersion: string | null }
  /** A typed refusal of the server: the reason token and its one status. */
  | {
      readonly kind: 'refused';
      readonly status: 403 | 409 | 422;
      readonly reason: PatternWriteReason;
    }
  | {
      readonly kind: 'rejected';
      readonly status: PatternRejectedStatus;
      readonly retryAfterSeconds?: number;
    }
  | { readonly kind: 'uncertain' };

type Json = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The ApiError of a refusal when it is the catalog code of its status, else null. */
const refusalOf = async (response: Response): Promise<Json | null> => {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }
  return isRecord(body) &&
    body.code === PATTERN_CATALOG_CODES[response.status] &&
    isRecord(body.details)
    ? body.details
    : null;
};

const rejected = (
  status: number,
  retryAfterSeconds?: number,
): PatternSubmitResult => ({
  kind: 'rejected',
  status: status as PatternRejectedStatus,
  ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
});

const rateWait = (response: Response, details: Json): PatternSubmitResult => {
  const raw = response.headers.get('retry-after');
  if (raw === null || !/^[1-9]\d{0,4}$/u.test(raw))
    return { kind: 'uncertain' };
  const seconds = Number(raw);
  const stated = details.retryAfterSeconds;
  if (seconds > 86_400 || (stated !== undefined && stated !== seconds))
    return { kind: 'uncertain' };
  return rejected(429, seconds);
};

/** The draft that answers this request, or null. */
const createdFacts = (
  resource: unknown,
  request: PatternVersionRequest,
  etag: string | null,
): PatternCreatedFacts | null => {
  if (!isRecord(resource)) return null;
  const {
    id,
    version,
    patternKey,
    patternVersion,
    nodeCount,
    compatibleTypeIds,
  } = resource;
  if (
    typeof id !== 'string' ||
    !isCmsUuid(id) ||
    typeof version !== 'string' ||
    !isCmsVersion(version) ||
    resource.state !== 'draft' ||
    patternKey !== request.patternKey ||
    typeof patternVersion !== 'number' ||
    !Number.isInteger(patternVersion) ||
    version !== String(patternVersion) ||
    BigInt(version) !== BigInt(request.expectedVersion ?? '0') + 1n ||
    !Array.isArray(compatibleTypeIds) ||
    compatibleTypeIds.join('\u0000') !==
      request.compatibleTypeIds.join('\u0000') ||
    typeof nodeCount !== 'number' ||
    !Number.isInteger(nodeCount) ||
    nodeCount < countWrittenNodes(request.blockTree) ||
    nodeCount > 512 ||
    typeof resource.blockRegistryDigest !== 'string' ||
    !CMS_HASH_PATTERN.test(resource.blockRegistryDigest) ||
    etag !== `"${version}"`
  )
    return null;
  return {
    id,
    patternKey,
    patternVersion,
    version,
    nodeCount,
    blockRegistryDigest: resource.blockRegistryDigest,
  };
};

/** Send one CMS-03C-12 request; the browser never sends an authority claim or a digest. */
export const submitPatternVersion = async (
  request: PatternVersionRequest,
  csrfToken: string,
  idempotencyKey: string,
  fetcher: typeof fetch = fetch,
): Promise<PatternSubmitResult> => {
  let response: Response;
  try {
    response = await fetcher(PATTERN_WRITE_PATH, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': csrfToken,
        'idempotency-key': idempotencyKey,
        ...(request.expectedVersion === null
          ? {}
          : { 'if-match': `"${request.expectedVersion}"` }),
      },
      body: JSON.stringify(request),
    });
  } catch {
    return { kind: 'uncertain' };
  }
  if (!(response instanceof Response)) return { kind: 'uncertain' };
  if (response.headers.get(UNKNOWN_OUTCOME_HEADER) === 'unknown')
    return { kind: 'uncertain' };
  const status = response.status;
  if (status === 201) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: 'uncertain' };
    }
    const facts = createdFacts(body, request, response.headers.get('etag'));
    return facts === null
      ? { kind: 'uncertain' }
      : { kind: 'created', resource: facts };
  }
  if (!Object.hasOwn(PATTERN_CATALOG_CODES, status))
    return { kind: 'uncertain' };
  const details = await refusalOf(response);
  if (details === null) return { kind: 'uncertain' };
  if (status === 429) return rateWait(response, details);
  const reason = patternWriteReason(details.reasonCode, status);
  if (reason !== null && (status === 403 || status === 409 || status === 422))
    return { kind: 'refused', status, reason };
  if (status === 409) {
    const current = details.currentVersion;
    return {
      kind: 'conflict',
      currentVersion:
        typeof current === 'string' && isCmsVersion(current) ? current : null,
    };
  }
  return rejected(status);
};
