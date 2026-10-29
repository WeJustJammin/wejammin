import {
  CMS_HASH_PATTERN,
  isCmsUuid,
  isCmsVersion,
} from '@wejammin/contracts/client';

import {
  rateLimitWaitSeconds,
  retryingSafeRead,
} from '../../lib/safe-read-retry';
import { PATTERN_KEY_REGEX } from './pattern-tree-rules';

/**
 * The browser's read of the nestable patterns (cmsPatternNestableRead, DEC-196; BE03c 184): the active pattern versions of
 * the owner party that list EVERY content type of the pattern being designed. The same-origin proxy has parsed the strict
 * `PatternSelectorPage`; the browser repeats the structural checks zod-free (FE03 AC261), the request binding (at most
 * the requested page size, no version row twice, the keyset order) and the ETag binding, so a bad answer is never listed.
 */
export interface NestablePattern {
  readonly patternId: string;
  readonly patternVersionId: string;
  readonly patternKey: string;
  readonly patternVersion: number;
  readonly nodeCount: number;
  readonly blockRegistryDigest: string;
}
export interface NestablePage {
  readonly items: readonly NestablePattern[];
  /** The opaque signed cursor of the next page; it lives in component state only. */
  readonly nextCursor: string | null;
  readonly pageVersion: string;
}

export type NestableReadResult =
  | { readonly kind: 'page'; readonly page: NestablePage }
  | {
      readonly kind: 'rejected';
      /** 400: the cursor no longer opens (restart); 401, 403, 404, 422 and 429 name themselves. */
      readonly status: 400 | 401 | 403 | 404 | 422 | 429;
      /** A 429's stated wait in whole seconds; absent when none was stated. */
      readonly retryAfterSeconds?: number;
    }
  | { readonly kind: 'unavailable' };

/** The page size the picker asks for (BE03c: default 25, maximum 50). */
export const NESTABLE_PAGE_LIMIT = 25;
const TYPES_MAX = 64;
const CURSOR_MAX = 512;
const NODE_COUNT_MAX = 512;
const ITEM_KEYS = [
  'blockRegistryDigest',
  'nodeCount',
  'patternId',
  'patternKey',
  'patternVersion',
  'patternVersionId',
];
const REJECTED: readonly number[] = [400, 401, 403, 404, 422, 429];

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const bytewise = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const verifiedItem = (candidate: unknown): NestablePattern | null => {
  if (
    !isRecord(candidate) ||
    Object.keys(candidate).sort().join() !== ITEM_KEYS.join()
  )
    return null;
  const {
    patternId,
    patternVersionId,
    patternKey,
    patternVersion,
    nodeCount,
    blockRegistryDigest,
  } = candidate;
  return typeof patternId === 'string' &&
    isCmsUuid(patternId) &&
    typeof patternVersionId === 'string' &&
    isCmsUuid(patternVersionId) &&
    typeof patternKey === 'string' &&
    PATTERN_KEY_REGEX.test(patternKey) &&
    typeof patternVersion === 'number' &&
    Number.isSafeInteger(patternVersion) &&
    patternVersion >= 1 &&
    typeof nodeCount === 'number' &&
    Number.isSafeInteger(nodeCount) &&
    nodeCount >= 1 &&
    nodeCount <= NODE_COUNT_MAX &&
    typeof blockRegistryDigest === 'string' &&
    CMS_HASH_PATTERN.test(blockRegistryDigest)
    ? {
        patternId,
        patternVersionId,
        patternKey,
        patternVersion,
        nodeCount,
        blockRegistryDigest,
      }
    : null;
};

/** The strict page that honours the requested page size, or null. */
export const verifiedNestablePage = (
  candidate: unknown,
  limit: number = NESTABLE_PAGE_LIMIT,
): NestablePage | null => {
  if (
    !isRecord(candidate) ||
    Object.keys(candidate).sort().join() !== 'items,nextCursor,pageVersion' ||
    !Array.isArray(candidate.items) ||
    candidate.items.length > limit ||
    typeof candidate.pageVersion !== 'string' ||
    !isCmsVersion(candidate.pageVersion)
  )
    return null;
  const { nextCursor } = candidate;
  if (
    nextCursor !== null &&
    (typeof nextCursor !== 'string' ||
      nextCursor === '' ||
      nextCursor.length > CURSOR_MAX ||
      candidate.items.length !== limit)
  )
    return null;
  const items: NestablePattern[] = [];
  for (const entry of candidate.items) {
    const parsed = verifiedItem(entry);
    const previous = items.at(-1);
    if (parsed === null) return null;
    if (previous !== undefined) {
      const order = bytewise(previous.patternKey, parsed.patternKey);
      if (
        order > 0 ||
        (order === 0 && previous.patternVersion <= parsed.patternVersion)
      )
        return null;
    }
    if (items.some((seen) => seen.patternVersionId === parsed.patternVersionId))
      return null;
    items.push(parsed);
  }
  return {
    items,
    nextCursor: nextCursor as string | null,
    pageVersion: candidate.pageVersion,
  };
};

const canceled = (signal: AbortSignal | undefined): boolean =>
  signal?.aborted === true;

const require = (signal: AbortSignal | undefined): void => {
  if (canceled(signal)) throw new Error('Nestable read canceled');
};

/** A canceled read must not wake later and issue another safe-retry GET. */
const wait = (
  milliseconds: number,
  signal: AbortSignal | undefined,
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (canceled(signal)) {
      reject(new Error('Nestable read canceled'));
      return;
    }
    const cancel = (): void => {
      clearTimeout(timer);
      reject(new Error('Nestable read canceled'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', cancel);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', cancel, { once: true });
  });

/**
 * One page of the nestable patterns for the content types of the pattern being designed (1-64), after the opaque cursor of
 * the page before (null for the first). FE03 :1173: a 502/503/504 the BE declares safe is retried twice (250 ms, 750 ms).
 */
export const readNestablePatterns = async (
  typeIds: readonly string[],
  cursor: string | null,
  fetcher: typeof fetch = fetch,
  controls: { readonly signal?: AbortSignal } = {},
): Promise<NestableReadResult> => {
  if (typeIds.length === 0 || typeIds.length > TYPES_MAX)
    return { kind: 'unavailable' };
  const query = new URLSearchParams();
  for (const typeId of typeIds) query.append('contentTypeId', typeId);
  if (cursor !== null) query.set('cursor', cursor);
  query.set('limit', String(NESTABLE_PAGE_LIMIT));
  let response: Response;
  try {
    response = await retryingSafeRead(
      async () => {
        require(controls.signal);
        const answer = await fetcher(
          `/api/v1/cms/patterns/nestable?${query.toString().replaceAll('+', '%20')}`,
          {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'error',
            ...(controls.signal === undefined
              ? {}
              : { signal: controls.signal }),
          },
        );
        require(controls.signal);
        return answer;
      },
      { sleep: (delay) => wait(delay, controls.signal) },
    );
  } catch {
    return { kind: 'unavailable' };
  }
  if (canceled(controls.signal) || !(response instanceof Response))
    return { kind: 'unavailable' };
  if (REJECTED.includes(response.status)) {
    const seconds =
      response.status === 429 ? await rateLimitWaitSeconds(response) : null;
    if (canceled(controls.signal)) return { kind: 'unavailable' };
    return {
      kind: 'rejected',
      status: response.status as 400 | 401 | 403 | 404 | 422 | 429,
      ...(seconds === null ? {} : { retryAfterSeconds: seconds }),
    };
  }
  if (response.status !== 200) return { kind: 'unavailable' };
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: 'unavailable' };
  }
  const page = canceled(controls.signal) ? null : verifiedNestablePage(body);
  return page !== null &&
    response.headers.get('etag') === `"${page.pageVersion}"`
    ? { kind: 'page', page }
    : { kind: 'unavailable' };
};
