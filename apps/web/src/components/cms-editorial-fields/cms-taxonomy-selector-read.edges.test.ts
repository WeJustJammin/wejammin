import { describe, expect, it, vi } from 'vitest';

import { readCmsTaxonomySelector } from './cms-taxonomy-selector-read';
import { SELECTOR_QUERY } from './cms-taxonomy-selector-read.test-support';

/** A caller that aborts while a 429's wait is read, and an answer that is not a Response, are `unavailable`. */
describe('readCmsTaxonomySelector: defensive answers', () => {
  it('answers unavailable for a fetcher that returns no Response', async () => {
    await expect(
      readCmsTaxonomySelector(
        SELECTOR_QUERY,
        vi
          .fn<typeof fetch>()
          .mockResolvedValue({ status: 200 } as unknown as Response),
      ),
    ).resolves.toEqual({ kind: 'unavailable' });
  });

  it('answers unavailable when the caller aborted while a 429 wait was read', async () => {
    const controller = new AbortController();
    const limited = Response.json({ code: 'RATE_LIMITED' }, { status: 429 });
    const original = limited.clone.bind(limited);
    vi.spyOn(limited, 'clone').mockImplementation(() => {
      controller.abort();
      return original();
    });
    await expect(
      readCmsTaxonomySelector(
        SELECTOR_QUERY,
        vi.fn<typeof fetch>().mockResolvedValue(limited),
        controller.signal,
      ),
    ).resolves.toEqual({ kind: 'unavailable' });
  });
});
