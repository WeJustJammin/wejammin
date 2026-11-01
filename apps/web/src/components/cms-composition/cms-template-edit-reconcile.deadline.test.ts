import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import { BROWSER_READ_DEADLINE_MS } from '../../lib/read-deadline';
import { readLatestCmsTemplateVersion } from './cms-template-edit-reconcile';

/*
 * DEC-246(1): the read of a template (the key after a create, the latest version after a successor) that holds the retry
 * has the shared 8,000 ms deadline; a read that never answers is `unavailable`, which the island shows with the control
 * that repeats it, never a send held for ever.
 */
beforeAll(async () => {
  await loadCmsValidators();
});
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('readLatestCmsTemplateVersion deadline', () => {
  it('passes an abort signal and answers unavailable at the deadline for a fetch that never settles', async () => {
    const fetcher = vi.fn<typeof fetch>(
      () => new Promise<Response>(() => undefined),
    );
    let answer: unknown = 'pending';
    void readLatestCmsTemplateVersion('release-note', fetcher).then((value) => {
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
    void readLatestCmsTemplateVersion(
      'release-note',
      vi.fn<typeof fetch>().mockResolvedValue(response),
    ).then((value) => {
      answer = value;
    });
    await vi.advanceTimersByTimeAsync(BROWSER_READ_DEADLINE_MS);
    expect(answer).toEqual({ kind: 'unavailable' });
  });

  it('leaves no timer behind after an answer', async () => {
    await readLatestCmsTemplateVersion(
      'release-note',
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
    await expect(
      readLatestCmsTemplateVersion('release-note', fetcher),
    ).resolves.toEqual({
      kind: 'unavailable',
    });
  });
});
