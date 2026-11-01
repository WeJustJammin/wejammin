import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BROWSER_READ_DEADLINE_MS } from '../../lib/read-deadline';
import { readTemplateContext } from './cms-template-context-read';

/*
 * Review V20 m1 / DEC-246(1): the designer context read is a protected browser read, so it has the shared 8,000 ms
 * deadline. A read that never answers becomes `unavailable` (the island's failed state with its repeat control)
 * instead of holding the send for ever.
 */
const valid = { contentTypes: [], registeredBlocks: [] };

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const hung = (): ReturnType<typeof vi.fn<typeof fetch>> =>
  vi.fn<typeof fetch>(() => new Promise<Response>(() => undefined));

describe('readTemplateContext deadline', () => {
  it('passes an abort signal to the fetch', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(valid, { status: 200 }));
    await readTemplateContext(fetcher);
    expect(fetcher.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('answers unavailable at the deadline for a fetch that never settles, and not before', async () => {
    const fetcher = hung();
    let answer: unknown = 'pending';
    void readTemplateContext(fetcher).then((value) => {
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
    void readTemplateContext(
      vi.fn<typeof fetch>().mockResolvedValue(response),
    ).then((value) => {
      answer = value;
    });
    await vi.advanceTimersByTimeAsync(BROWSER_READ_DEADLINE_MS);
    expect(answer).toEqual({ kind: 'unavailable' });
  });

  it('counts the safe retries inside the one deadline', async () => {
    const unavailable = (): Response =>
      Response.json(
        { code: 'DEPENDENCY_UNAVAILABLE', details: { retryable: true } },
        { status: 503 },
      );
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() => Promise.resolve(unavailable()))
      .mockImplementationOnce(() => Promise.resolve(unavailable()))
      .mockImplementation(() => new Promise<Response>(() => undefined));
    let answer: unknown = 'pending';
    void readTemplateContext(fetcher).then((value) => {
      answer = value;
    });
    await vi.advanceTimersByTimeAsync(BROWSER_READ_DEADLINE_MS);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(answer).toEqual({ kind: 'unavailable' });
  });

  it('leaves no timer behind after an answer', async () => {
    await readTemplateContext(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(valid, { status: 200 })),
    );
    expect(vi.getTimerCount()).toBe(0);
    await readTemplateContext(
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ code: 'X' }, { status: 403 })),
    );
    expect(vi.getTimerCount()).toBe(0);
    await readTemplateContext(
      vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});
