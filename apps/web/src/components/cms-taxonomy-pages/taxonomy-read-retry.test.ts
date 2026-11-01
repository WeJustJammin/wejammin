import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  TAXONOMY_ID,
  jsonResponse,
  taxonomyApiError,
  termsPageFixture,
  versionsPageFixture,
} from '../../server/cms-taxonomy-platform.test-support';
import { SAFE_READ_RETRY_DELAYS_MS } from '../../lib/safe-read-retry';
import { readTaxonomyVersions } from '../cms-taxonomy-designer/taxonomy-versions-read';
import { readTaxonomyTerms } from '../cms-taxonomy-terms/taxonomy-terms-fetch';

// The delays are `lib/safe-read-retry.ts`' to define (FE03 :1173); this file only follows them.
const [FIRST_DELAY, SECOND_DELAY] = SAFE_READ_RETRY_DELAYS_MS;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const unavailable = (operation: 'terms' | 'versions', status: number) =>
  jsonResponse(
    status,
    taxonomyApiError(
      operation === 'terms'
        ? 'cmsTaxonomyTermsRead'
        : 'cmsTaxonomyVersionsRead',
      status,
    ),
  );

const CASES = [
  {
    name: 'cmsTaxonomyTermsRead',
    operation: 'terms',
    ok: () =>
      jsonResponse(200, termsPageFixture(), {
        etag: `"${termsPageFixture().pageVersion}"`,
      }),
    read: (fetcher: typeof fetch) =>
      readTaxonomyTerms(TAXONOMY_ID, {}, fetcher),
  },
  {
    name: 'cmsTaxonomyVersionsRead',
    operation: 'versions',
    ok: () =>
      jsonResponse(200, versionsPageFixture(), {
        etag: `"${versionsPageFixture().pageVersion}"`,
      }),
    read: (fetcher: typeof fetch) => readTaxonomyVersions(TAXONOMY_ID, fetcher),
  },
] as const;

describe.each(CASES)(
  '$name: the automatic safe-read retry (FE03 :1173)',
  (c) => {
    const stubbed = (...responses: Response[]) => {
      const queue = [...responses];
      return vi.fn(async () => {
        const next = queue.shift();
        if (next === undefined) throw new Error('unexpected fetch');
        return next;
      });
    };

    it('retries a declared-retryable 503 after the first delay and again after the second, then loads', async () => {
      const fetcher = stubbed(
        unavailable(c.operation, 503),
        unavailable(c.operation, 504),
        c.ok(),
      );
      const pending = c.read(fetcher as unknown as typeof fetch);
      await vi.advanceTimersByTimeAsync(FIRST_DELAY - 1);
      expect(fetcher).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetcher).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(SECOND_DELAY - 1);
      expect(fetcher).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect((await pending).kind).toBe('loaded');
      expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it('degrades to unavailable after the second retry fails, with no third retry', async () => {
      const fetcher = stubbed(
        unavailable(c.operation, 502),
        unavailable(c.operation, 502),
        unavailable(c.operation, 502),
      );
      const pending = c.read(fetcher as unknown as typeof fetch);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await pending).toEqual({ kind: 'unavailable' });
      expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it.each([404, 429])('does not retry a %i', async (status) => {
      const fetcher = stubbed(unavailable(c.operation, status));
      const pending = c.read(fetcher as unknown as typeof fetch);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await pending).toMatchObject({ kind: 'rejected', status });
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('does not retry a 503 that does not declare a retry safe', async () => {
      const fetcher = stubbed(
        jsonResponse(
          503,
          taxonomyApiError(
            c.operation === 'terms'
              ? 'cmsTaxonomyTermsRead'
              : 'cmsTaxonomyVersionsRead',
            503,
            {},
          ),
        ),
      );
      const pending = c.read(fetcher as unknown as typeof fetch);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await pending).toEqual({ kind: 'unavailable' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  },
);
