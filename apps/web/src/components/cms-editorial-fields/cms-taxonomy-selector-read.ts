import type { TaxonomySelectorPage } from '@wejammin/contracts';

import { startReadDeadline } from '../../lib/read-deadline';
import { withinDeadline } from '../../lib/read-within-deadline';
import {
  rateLimitWaitSeconds,
  retryingSafeRead,
} from '../../lib/safe-read-retry';
import {
  parseSelectorQuery,
  verifiedTaxonomySelectorPage,
  type TaxonomySelectorQueryInput,
} from './cms-taxonomy-selector-read-rules';

/*
 * The protected browser transport of CMS-03C-17 (`GET /api/v1/cms/taxonomies/selector`, FE03
 * :1618/:1747). The shared safe read retries a declared-retryable 502/503/504 twice (250 ms,
 * 750 ms) and nothing else. A 429 is never auto-retried: the transport returns its stated
 * `Retry-After` wait as metadata and the connected hook enforces the manual wait. The read
 * carries no mutation authority: no body, no `Idempotency-Key`, no `If-Match`, no CSRF. A 200 is
 * accepted only as the strict, `no-store` page of THIS request whose quoted ETag is its
 * `pageVersion`; every other answer is an unavailability, never a server copy.
 */

export { verifiedTaxonomySelectorPage };
export type { TaxonomySelectorQueryInput };

export type TaxonomySelectorRejectedStatus =
  400 | 401 | 403 | 404 | 409 | 415 | 422 | 429;

export type TaxonomySelectorResult =
  | { readonly kind: 'loaded'; readonly page: TaxonomySelectorPage }
  | {
      readonly kind: 'rejected';
      readonly status: TaxonomySelectorRejectedStatus;
      /** A 429's stated wait in whole seconds; `null` when none was stated. */
      readonly retryAfterSeconds: number | null;
    }
  | { readonly kind: 'unavailable' };

export const TAXONOMY_SELECTOR_PATH = '/api/v1/cms/taxonomies/selector';

const REJECTED_STATUSES: readonly number[] = [
  400, 401, 403, 404, 409, 415, 422, 429,
];

/** The tokens of the response's `Cache-Control`, case-insensitively. */
const declaresNoStore = (response: Response): boolean =>
  (response.headers.get('cache-control') ?? '')
    .split(',')
    .some((token) => token.trim().toLowerCase() === 'no-store');

const readCanceled = (signal: AbortSignal | undefined): boolean =>
  signal?.aborted === true;

/** A canceled read must not wake later and issue another safe-retry GET. */
const requireLiveRead = (signal: AbortSignal | undefined): void => {
  if (readCanceled(signal)) throw new Error('Taxonomy selector read canceled');
};

const waitForRead = (
  milliseconds: number,
  signal: AbortSignal | undefined,
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (readCanceled(signal)) {
      reject(new Error('Taxonomy selector read canceled'));
      return;
    }
    const cancel = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      reject(new Error('Taxonomy selector read canceled'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', cancel);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', cancel, { once: true });
  });

/**
 * Read one page of the selector without carrying mutation authority; the caller's input is
 * admitted first so nothing it invented reaches the proxy. The whole read has the shared 8,000 ms
 * deadline (DEC-246(1)): a read that never answers is `unavailable`, the degraded cell with its
 * Try again control. A caller abort (`signal`) is also `unavailable`, and is not shown.
 */
export const readCmsTaxonomySelector = async (
  query: TaxonomySelectorQueryInput,
  fetcher: typeof fetch = fetch,
  caller?: AbortSignal,
): Promise<TaxonomySelectorResult> => {
  const parsed = parseSelectorQuery(query);
  if (!parsed.ok)
    return { kind: 'rejected', status: parsed.status, retryAfterSeconds: null };
  const search = new URLSearchParams({
    typeKey: parsed.value.typeKey,
    fieldKey: parsed.value.fieldKey,
    locale: parsed.value.locale,
  });
  if (parsed.value.cursor !== null) search.set('cursor', parsed.value.cursor);
  search.set('limit', String(parsed.value.limit));
  const deadline = startReadDeadline(caller);
  const { signal } = deadline;
  try {
    const response = await withinDeadline(
      deadline,
      retryingSafeRead(
        async () => {
          requireLiveRead(signal);
          const answer = await fetcher(`${TAXONOMY_SELECTOR_PATH}?${search}`, {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            redirect: 'error',
            signal,
          });
          requireLiveRead(signal);
          return answer;
        },
        { sleep: (delay) => waitForRead(delay, signal) },
      ),
    );
    if (!(response instanceof Response)) return { kind: 'unavailable' };
    if (REJECTED_STATUSES.includes(response.status)) {
      const status = response.status as TaxonomySelectorRejectedStatus;
      const wait =
        status === 429
          ? await withinDeadline(deadline, rateLimitWaitSeconds(response))
          : null;
      return { kind: 'rejected', status, retryAfterSeconds: wait };
    }
    if (response.status !== 200) return { kind: 'unavailable' };
    if (!declaresNoStore(response)) return { kind: 'unavailable' };
    const candidate = await withinDeadline(deadline, response.json());
    const page = verifiedTaxonomySelectorPage(
      candidate,
      response.headers.get('etag'),
    );
    return page === null ? { kind: 'unavailable' } : { kind: 'loaded', page };
  } catch {
    return { kind: 'unavailable' };
  } finally {
    deadline.clear();
  }
};
