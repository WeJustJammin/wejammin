import type { CmsDefinitionVersionState } from '@wejammin/contracts';
import {
  CMS_HASH_PATTERN,
  isCmsUuid,
  isCmsVersion,
} from '@wejammin/contracts/client';

import { startReadDeadline } from '../../lib/read-deadline';
import { withinDeadline } from '../../lib/read-within-deadline';
import {
  rateLimitWaitSeconds,
  retryingSafeRead,
} from '../../lib/safe-read-retry';
import type {
  PatternLatestDetail,
  PatternLatestResult,
} from './pattern-latest-read';
import { parseWireTree, patternKeyIssue } from './pattern-tree-rules';

/*
 * The on-demand chunk (`pattern-latest-fetch`, CMS_ON_DEMAND_CHUNKS): the reader of the owner's latest version of a
 * pattern key and its structural verification. It runs only as a re-read after a command, a lost answer or a 409
 * (`pattern-latest-read.ts` is the only importer), never with the route (P2-S11-AC-106, the initial-route budget).
 */
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

/**
 * Recheck the authoritative latest version without carrying mutation authority. The whole read (safe retries and body
 * included) has the shared 8,000 ms deadline (DEC-246(1)): a read that never answers is `unavailable`, which the island
 * shows with the control that repeats it. A caller abort (`controls.signal`) is also `unavailable`, and is not shown.
 */
export const readLatestPatternVersion = async (
  patternKey: string,
  fetcher: typeof fetch = fetch,
  controls: { readonly signal?: AbortSignal } = {},
): Promise<PatternLatestResult> => {
  if (patternKeyIssue(patternKey) !== null) return { kind: 'unavailable' };
  const deadline = startReadDeadline(controls.signal);
  const { signal } = deadline;
  try {
    // FE03 :1173: a 502/503/504 the BE declares safe is retried twice (250 ms, 750 ms).
    const response = await withinDeadline(
      deadline,
      retryingSafeRead(
        async () => {
          requireLiveRead(signal);
          const answer = await fetcher(`/api/v1/cms/patterns/${patternKey}`, {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'error',
            signal,
          });
          requireLiveRead(signal);
          return answer;
        },
        { sleep: (delay) => waitForPatternRead(delay, signal) },
      ),
    );
    if (!(response instanceof Response)) return { kind: 'unavailable' };
    if ([401, 403, 404, 429].includes(response.status)) {
      const wait =
        response.status === 429
          ? await withinDeadline(deadline, rateLimitWaitSeconds(response))
          : null;
      return {
        kind: 'rejected',
        status: response.status as 401 | 403 | 404 | 429,
        ...(wait === null ? {} : { retryAfterSeconds: wait }),
      };
    }
    if (response.status !== 200) return { kind: 'unavailable' };
    const candidate = await withinDeadline(deadline, response.json());
    const detail = verifiedPatternDetail(
      candidate,
      patternKey,
      response.headers.get('etag'),
    );
    return detail === null
      ? { kind: 'unavailable' }
      : { kind: 'loaded', detail };
  } catch {
    return { kind: 'unavailable' };
  } finally {
    deadline.clear();
  }
};
