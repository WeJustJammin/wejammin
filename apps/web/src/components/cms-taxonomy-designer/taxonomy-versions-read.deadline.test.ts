import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TAXONOMY_ID } from '../../server/cms-taxonomy-platform.test-support';
import { BROWSER_READ_DEADLINE_MS } from '../../lib/read-deadline';
import { readTaxonomyVersions } from './taxonomy-versions-read';

/*
 * DEC-246(1): the versions read that follows a save, a lost answer or a 409 (and holds the send until it answers) has
 * the shared 8,000 ms deadline; a read that never answers is `unavailable`, with the control that repeats it.
 */
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('readTaxonomyVersions deadline', () => {
  it('passes an abort signal and answers unavailable at the deadline for a fetch that never settles, and not before', async () => {
    const fetcher = vi.fn<typeof fetch>(
      () => new Promise<Response>(() => undefined),
    );
    let answer: unknown = 'pending';
    void readTaxonomyVersions(TAXONOMY_ID, fetcher).then((value) => {
      answer = value;
    });
    await vi.advanceTimersByTimeAsync(BROWSER_READ_DEADLINE_MS - 1);
    expect(answer).toBe('pending');
    expect(fetcher.mock.calls[0]![1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(answer).toEqual({ kind: 'unavailable' });
    expect(fetcher.mock.calls[0]![1]?.signal?.aborted).toBe(true);
  });

  it('answers unavailable when the body never arrives', async () => {
    const response = new Response('{}', { status: 200 });
    vi.spyOn(response, 'json').mockReturnValue(new Promise(() => undefined));
    let answer: unknown = 'pending';
    void readTaxonomyVersions(
      TAXONOMY_ID,
      vi.fn<typeof fetch>().mockResolvedValue(response),
    ).then((value) => {
      answer = value;
    });
    await vi.advanceTimersByTimeAsync(BROWSER_READ_DEADLINE_MS);
    expect(answer).toEqual({ kind: 'unavailable' });
  });

  it('leaves no timer behind after an answer', async () => {
    await readTaxonomyVersions(
      TAXONOMY_ID,
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ code: 'X' }, { status: 404 })),
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it('answers unavailable for a fetcher that returns no Response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue({ status: 200 } as unknown as Response);
    await expect(readTaxonomyVersions(TAXONOMY_ID, fetcher)).resolves.toEqual({
      kind: 'unavailable',
    });
  });
});
