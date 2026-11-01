import type {
  CmsDefinitionVersionState,
  PatternNode,
} from '@wejammin/contracts';
import {
  CMS_HASH_PATTERN,
  isCmsUuid,
  isCmsVersion,
} from '@wejammin/contracts/client';

import {
  rateLimitWaitSeconds,
  retryingSafeRead,
} from '../../lib/safe-read-retry';
import { parseWireTree, patternKeyIssue } from './pattern-tree-rules';

/**
 * The verified facts of the owner's latest version of a pattern key
 * (`cmsPatternLatestRead`). The same-origin proxy has already parsed the strict
 * `PatternVersionDetail`; the browser repeats the identity binding and the tree
 * rules structurally (zod-free, FE03 AC261).
 */
export interface PatternLatestDetail {
  readonly id: string;
  readonly version: string;
  readonly contentHash: string;
  readonly state: CmsDefinitionVersionState;
  readonly patternKey: string;
  readonly patternVersion: number;
  readonly compatibleTypeIds: readonly string[];
  readonly nodeCount: number;
  /** The server-computed registry digest of this version. */
  readonly blockRegistryDigest: string;
  readonly blockTree: PatternNode[];
}

export type PatternLatestResult =
  | { readonly kind: 'loaded'; readonly detail: PatternLatestDetail }
  | {
      readonly kind: 'rejected';
      readonly status: 401 | 403 | 404 | 429;
      /** A 429's stated wait in whole seconds (FE03 :1172); absent when none was stated. */
      readonly retryAfterSeconds?: number;
    }
  | { readonly kind: 'unavailable' };

/** The definition lifecycle (`CMS_DEFINITION_VERSION_STATES`; the test is the drift guard). */
export const PATTERN_LIFECYCLE_STATES: readonly string[] = [
  'draft',
  'review',
  'approved',
  'scheduled',
  'active',
  'superseded',
  'retired',
  'blocked',
];

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readCanceled = (signal: AbortSignal | undefined): boolean =>
  signal?.aborted === true;

const requireLiveRead = (signal: AbortSignal | undefined): void => {
  if (readCanceled(signal)) throw new Error('Pattern read canceled');
};

/** A canceled read must not wake later and issue another safe-retry GET. */
const waitForPatternRead = (
  milliseconds: number,
  signal: AbortSignal | undefined,
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (readCanceled(signal)) {
      reject(new Error('Pattern read canceled'));
      return;
    }
    const cancel = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      reject(new Error('Pattern read canceled'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', cancel);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', cancel, { once: true });
  });

/** The detail of THIS key whose strong ETag is its version, or null. */
export const verifiedPatternDetail = (
  candidate: unknown,
  patternKey: string,
  etag: string | null,
): PatternLatestDetail | null => {
  if (!isRecord(candidate)) return null;
  const {
    id,
    version,
    contentHash,
    state,
    patternVersion,
    compatibleTypeIds,
    nodeCount,
    blockRegistryDigest,
  } = candidate;
  const blockTree = parseWireTree(candidate.blockTree);
  if (
    typeof id !== 'string' ||
    !isCmsUuid(id) ||
    typeof version !== 'string' ||
    !isCmsVersion(version) ||
    typeof contentHash !== 'string' ||
    !CMS_HASH_PATTERN.test(contentHash) ||
    typeof state !== 'string' ||
    !PATTERN_LIFECYCLE_STATES.includes(state) ||
    candidate.patternKey !== patternKey ||
    typeof patternVersion !== 'number' ||
    version !== String(patternVersion) ||
    !Array.isArray(compatibleTypeIds) ||
    !compatibleTypeIds.every(
      (entry): entry is string => typeof entry === 'string' && isCmsUuid(entry),
    ) ||
    typeof nodeCount !== 'number' ||
    !Number.isInteger(nodeCount) ||
    typeof blockRegistryDigest !== 'string' ||
    !CMS_HASH_PATTERN.test(blockRegistryDigest) ||
    blockTree === null ||
    etag !== `"${version}"`
  )
    return null;
  return {
    id,
    version,
    contentHash,
    state: state as CmsDefinitionVersionState,
    patternKey,
    patternVersion,
    compatibleTypeIds,
    nodeCount,
    blockRegistryDigest,
    blockTree,
  };
};

/** Recheck the authoritative latest version without carrying mutation authority. */
export const readLatestPatternVersion = async (
  patternKey: string,
  fetcher: typeof fetch = fetch,
  controls: { readonly signal?: AbortSignal } = {},
): Promise<PatternLatestResult> => {
  if (patternKeyIssue(patternKey) !== null) return { kind: 'unavailable' };
  let response: Response;
  try {
    // FE03 :1173: a 502/503/504 the BE declares safe is retried twice (250 ms, 750 ms).
    response = await retryingSafeRead(
      async () => {
        requireLiveRead(controls.signal);
        const answer = await fetcher(`/api/v1/cms/patterns/${patternKey}`, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          redirect: 'error',
          ...(controls.signal === undefined ? {} : { signal: controls.signal }),
        });
        requireLiveRead(controls.signal);
        return answer;
      },
      { sleep: (delay) => waitForPatternRead(delay, controls.signal) },
    );
  } catch {
    return { kind: 'unavailable' };
  }
  if (readCanceled(controls.signal) || !(response instanceof Response))
    return { kind: 'unavailable' };
  if ([401, 403, 404, 429].includes(response.status)) {
    const wait =
      response.status === 429 ? await rateLimitWaitSeconds(response) : null;
    if (readCanceled(controls.signal)) return { kind: 'unavailable' };
    return {
      kind: 'rejected',
      status: response.status as 401 | 403 | 404 | 429,
      ...(wait === null ? {} : { retryAfterSeconds: wait }),
    };
  }
  if (response.status !== 200) return { kind: 'unavailable' };
  let candidate: unknown;
  try {
    candidate = await response.json();
  } catch {
    return { kind: 'unavailable' };
  }
  if (readCanceled(controls.signal)) return { kind: 'unavailable' };
  const detail = verifiedPatternDetail(
    candidate,
    patternKey,
    response.headers.get('etag'),
  );
  return detail === null ? { kind: 'unavailable' } : { kind: 'loaded', detail };
};
