import type { TemplateDesignerContext } from '@wejammin/contracts';
import {
  CMS_TYPE_KEY_PATTERN,
  isCanonicalLocale,
  isCmsUuid,
} from '@wejammin/contracts/client';

import { startReadDeadline } from '../../lib/read-deadline';
import { withinDeadline } from '../../lib/read-within-deadline';
import {
  rateLimitWaitSeconds,
  retryingSafeRead,
} from '../../lib/safe-read-retry';

/*
 * The browser's read of the designer context (`cmsTemplateContextRead`, `GET /api/v1/cms/templates/context`): the
 * active content types and the supported block selectors a template or pattern designer chooses from. The same-origin
 * proxy has already parsed the strict `TemplateDesignerContext`; the browser repeats the structural rules zod-free
 * (FE03 AC261), so a bad answer is never listed. It is read again by itself after a 409
 * `block_registry_digest_mismatch` (FE03 1048): the block registry moved while the person was editing.
 */
export type TemplateContextResult =
  | { readonly kind: 'loaded'; readonly context: TemplateDesignerContext }
  | {
      readonly kind: 'rejected';
      readonly status: 401 | 403 | 429;
      /** A 429's stated wait in whole seconds; absent when none was stated. */
      readonly retryAfterSeconds?: number;
    }
  | { readonly kind: 'unavailable' };

/**
 * The block key grammar (`CMS_BLOCK_KEY_PATTERN`). It is written out here and not imported from the pattern designer's
 * rules, so this on-demand chunk shares no module with the pattern route (initial-route budget); the drift guard in
 * `cms-template-context-read.test.ts` compares it with that source.
 */
export const CONTEXT_BLOCK_KEY_REGEX = /^[a-z][a-z0-9._-]{0,95}$/u;
const TYPES_MAX = 64;
const BLOCKS_MAX = 128;
const INT_MAX = 2_147_483_647;
const TYPE_KEYS = 'activeVersion,activeVersionId,id,sourceLocale,typeKey';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const positiveInt = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= 1 &&
  value <= INT_MAX;
const sortedKeys = (value: Readonly<Record<string, unknown>>): string =>
  Object.keys(value).sort().join();

/** The strict context, or null when the body is not one. */
export const verifiedTemplateContext = (
  candidate: unknown,
): TemplateDesignerContext | null => {
  if (
    !isRecord(candidate) ||
    sortedKeys(candidate) !== 'contentTypes,registeredBlocks' ||
    !Array.isArray(candidate.contentTypes) ||
    candidate.contentTypes.length > TYPES_MAX ||
    !Array.isArray(candidate.registeredBlocks) ||
    candidate.registeredBlocks.length > BLOCKS_MAX
  )
    return null;
  for (const type of candidate.contentTypes as unknown[]) {
    if (
      !isRecord(type) ||
      sortedKeys(type) !== TYPE_KEYS ||
      typeof type.id !== 'string' ||
      !isCmsUuid(type.id) ||
      typeof type.activeVersionId !== 'string' ||
      !isCmsUuid(type.activeVersionId) ||
      typeof type.typeKey !== 'string' ||
      !CMS_TYPE_KEY_PATTERN.test(type.typeKey) ||
      !positiveInt(type.activeVersion) ||
      typeof type.sourceLocale !== 'string' ||
      !isCanonicalLocale(type.sourceLocale)
    )
      return null;
  }
  for (const block of candidate.registeredBlocks as unknown[]) {
    if (
      !isRecord(block) ||
      sortedKeys(block) !== 'blockKey,blockVersion' ||
      typeof block.blockKey !== 'string' ||
      !CONTEXT_BLOCK_KEY_REGEX.test(block.blockKey) ||
      !positiveInt(block.blockVersion)
    )
      return null;
  }
  return candidate as unknown as TemplateDesignerContext;
};

/**
 * One bounded, no-store GET of the context; a failure changes nothing the person typed. The whole read, safe retries
 * and body included, shares the 8,000 ms deadline (review V20 m1, DEC-246(1)): a read that never answers is
 * `unavailable`, which the island shows with its control to read again.
 */
export const readTemplateContext = async (
  fetcher: typeof fetch = fetch,
): Promise<TemplateContextResult> => {
  const deadline = startReadDeadline();
  const within = <T>(work: Promise<T>): Promise<T> =>
    withinDeadline(deadline, work);
  try {
    // FE03 :1173: a 502/503/504 the BE declares safe is retried twice (250 ms, 750 ms).
    const response = await within(
      retryingSafeRead(() =>
        fetcher('/api/v1/cms/templates/context', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          redirect: 'error',
          headers: { accept: 'application/json' },
          signal: deadline.signal,
        }),
      ),
    );
    if (response.status === 401 || response.status === 403) {
      return { kind: 'rejected', status: response.status };
    }
    if (response.status === 429) {
      const wait = await within(rateLimitWaitSeconds(response));
      return {
        kind: 'rejected',
        status: 429,
        ...(wait === null ? {} : { retryAfterSeconds: wait }),
      };
    }
    if (response.status !== 200) return { kind: 'unavailable' };
    const context = verifiedTemplateContext(await within(response.json()));
    return context === null
      ? { kind: 'unavailable' }
      : { kind: 'loaded', context };
  } catch {
    return { kind: 'unavailable' };
  } finally {
    deadline.clear();
  }
};
