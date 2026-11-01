import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiErrorSchema } from '@wejammin/contracts';

import {
  createReadsHarness,
  SELECTOR_PATH,
  SELECTOR_QUERY,
} from './taxonomy-reads.test-support';
import { createTaxonomyProductionHarness } from './taxonomy-definition.test-support';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/**
 * CMS-03C-17 (BE03c 179, 1419, 1447): "the read limit (429), a read dependency or deadline
 * (502/503/504)" as typed ApiError of catalog cms.03c.taxonomy.v1. The Terms read carries the
 * same cases in `taxonomy-terms-read.test.ts` and `cms-composition-production-taxonomy-reads.test.ts`;
 * the selector carried only the 502 and the port-relay 503/504 cases.
 */
const url = `${SELECTOR_PATH}?${SELECTOR_QUERY}`;
const AUTHOR = { resolveCapabilities: ['cms.author'] } as const;

describe('CMS-03C-17 selector read limit (429)', () => {
  it.each([
    ['user', 0, 300],
    ['party', 1, 600],
  ])(
    '[P2-S12-AC-134] CMS-03C-17 a denied %s bucket is 429 RATE_LIMITED with Retry-After and the bucket ceiling, and the port is never called',
    async (_scope, denied, ceiling) => {
      let index = 0;
      const rateLimit = vi.fn(async (input: { limit: number }) => ({
        ok: true as const,
        value: {
          allowed: index++ !== denied,
          limit: input.limit,
          remaining: 0,
          resetAt: 61,
        },
      }));
      const harness = createReadsHarness({ rateLimit });
      const response = await harness.request(url);
      expect(response.status).toBe(429);
      expect(response.headers.get('retry-after')).toBe('61');
      expect(response.headers.get('ratelimit-limit')).toBe(String(ceiling));
      expect(response.headers.get('ratelimit-remaining')).toBe('0');
      expect(response.headers.get('cache-control')).toBe('no-store');
      const error = ApiErrorSchema.parse(await response.json());
      expect(error.code).toBe('RATE_LIMITED');
      expect(error.details).toMatchObject({
        limit: ceiling,
        retryAfterSeconds: 61,
      });
      expect(harness.readSelector).not.toHaveBeenCalled();
      expect(rateLimit).toHaveBeenCalledTimes(denied + 1);
    },
  );
});

describe('CMS-03C-17 selector production port: read dependency and deadline', () => {
  it('[P2-S12-AC-134] CMS-03C-17 a provider 5xx is a retryable 503 DEPENDENCY_UNAVAILABLE', async () => {
    const down = vi.fn<typeof fetch>(async () =>
      Response.json({ message: 'boom' }, { status: 500 }),
    );
    const response = await createTaxonomyProductionHarness(
      down,
      AUTHOR,
    ).request(url);
    expect(response.status).toBe(503);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(
      'DEPENDENCY_UNAVAILABLE',
    );
    expect(down).toHaveBeenCalledTimes(1);
  });

  it('[P2-S12-AC-134] CMS-03C-17 a nonsettling transport is a 504 DEPENDENCY_UNAVAILABLE at the 8,000 ms read ceiling and not before', async () => {
    vi.useFakeTimers();
    const hung = vi.fn<typeof fetch>(() => new Promise(() => {}));
    const settled = vi.fn();
    const pending = Promise.resolve(
      createTaxonomyProductionHarness(hung, AUTHOR).request(url),
    ).then(settled);
    await vi.advanceTimersByTimeAsync(7_990);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(20);
    await pending;
    const response = settled.mock.calls[0]?.[0] as Response;
    expect(response.status).toBe(504);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(
      'DEPENDENCY_UNAVAILABLE',
    );
    expect(hung).toHaveBeenCalledTimes(1);
  });
});
