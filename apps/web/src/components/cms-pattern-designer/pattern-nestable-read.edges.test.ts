import { describe, expect, it, vi } from 'vitest';

import { readNestablePatterns } from './pattern-nestable-read';

/*
 * The defensive answers of the nestable-pattern reader: a caller that aborts while a 429's wait or the body is read, and an
 * answer that is not a Response, are `unavailable`, never a half-read page.
 */
const TYPE = '018f0c45-73fe-7dc2-9c09-68f7ecf132da';
const read = (fetcher: typeof fetch, controller = new AbortController()) =>
  readNestablePatterns([TYPE], null, fetcher, { signal: controller.signal });
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

describe('readNestablePatterns: defensive answers', () => {
  it('answers unavailable for a fetcher that returns no Response', async () => {
    await expect(
      read(
        vi
          .fn<typeof fetch>()
          .mockResolvedValue({ status: 200 } as unknown as Response),
      ),
    ).resolves.toEqual({ kind: 'unavailable' });
  });

  it('answers unavailable when the caller aborted while a 429 wait was read', async () => {
    const controller = new AbortController();
    const limited = Response.json({ code: 'RATE_LIMITED' }, { status: 429 });
    await expect(
      read(
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(abortsWhenInspected(limited, controller, 'clone')),
        controller,
      ),
    ).resolves.toEqual({ kind: 'unavailable' });
  });

  it('answers unavailable when the caller aborted while the body was read', async () => {
    const controller = new AbortController();
    await expect(
      read(
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            abortsWhenInspected(Response.json({}), controller, 'json'),
          ),
        controller,
      ),
    ).resolves.toEqual({ kind: 'unavailable' });
  });
});
