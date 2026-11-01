import { describe, expect, it, vi } from 'vitest';

import { readLatestPatternVersion } from './pattern-latest-fetch';

/*
 * The defensive answers of the latest-version reader: an answer that is not a Response, a caller that aborts at each point
 * of the read (before it, while the retry sleeps, while a 429's wait or the body is read) and a body that is not an object
 * are all `unavailable`, never a half-read detail.
 */
const KEY = 'profile-hero';
const retryable = (): Response =>
  Response.json(
    { code: 'DEPENDENCY_UNAVAILABLE', details: { retryable: true } },
    { status: 503 },
  );
/** The response, which aborts `controller` the first time the reader inspects or reads it. */
const abortsWhenInspected = (
  response: Response,
  controller: AbortController,
  method: 'clone' | 'json',
): Response => {
  const original = response[method].bind(response) as () => unknown;
  vi.spyOn(response, method).mockImplementation((() => {
    controller.abort();
    return original();
  }) as never);
  return response;
};
const read = (
  fetcher: typeof fetch,
  controller = new AbortController(),
): Promise<unknown> =>
  readLatestPatternVersion(KEY, fetcher, { signal: controller.signal });

describe('readLatestPatternVersion: defensive answers', () => {
  it('answers unavailable for a fetcher that returns no Response', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue({ status: 200 } as unknown as Response);
    await expect(read(fetcher)).resolves.toEqual({ kind: 'unavailable' });
  });

  it('sends nothing when the caller has already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn<typeof fetch>();
    await expect(read(fetcher, controller)).resolves.toEqual({
      kind: 'unavailable',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not sleep into a retry when the caller aborted while the answer was inspected', async () => {
    const controller = new AbortController();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(abortsWhenInspected(retryable(), controller, 'clone'));
    await expect(read(fetcher, controller)).resolves.toEqual({
      kind: 'unavailable',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('answers unavailable when the caller aborted while a 429 wait was read', async () => {
    const controller = new AbortController();
    const limited = Response.json({ code: 'RATE_LIMITED' }, { status: 429 });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(abortsWhenInspected(limited, controller, 'clone'));
    await expect(read(fetcher, controller)).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it('answers unavailable when the caller aborted while the body was read', async () => {
    const controller = new AbortController();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        abortsWhenInspected(Response.json({}), controller, 'json'),
      );
    await expect(read(fetcher, controller)).resolves.toEqual({
      kind: 'unavailable',
    });
  });

  it('answers unavailable for a body that is not an object', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('"text"', { status: 200, headers: { etag: '"1"' } }),
      );
    await expect(read(fetcher)).resolves.toEqual({ kind: 'unavailable' });
  });
});
