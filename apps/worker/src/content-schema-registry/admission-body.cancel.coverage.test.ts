import { describe, expect, it } from 'vitest';

import { readBytes } from './admission-body';

const MAX_BODY_BYTES = 256 * 1024;

/**
 * A request whose cloned body is a stream that yields one oversized chunk and
 * whose cancel promise rejects, the way a tee branch can when its sibling has
 * already been torn down.
 */
const requestWithRejectingCancel = (): Request => {
  let cancelled = false;
  const reader = {
    read: async () => ({
      done: false as const,
      value: new Uint8Array(MAX_BODY_BYTES + 1),
    }),
    cancel: async () => {
      cancelled = true;
      throw new Error('tee sibling already cancelled');
    },
  };
  const body = { getReader: () => reader } as unknown as ReadableStream;
  const request = {
    headers: new Headers(),
    clone: () => ({ body }),
  } as unknown as Request;
  Object.defineProperty(request, 'cancelled', { get: () => cancelled });
  return request;
};

describe('request body cap with a cancel that rejects', () => {
  it('answers 413 and swallows the cancel rejection instead of leaking an unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const record = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', record);
    try {
      const request = requestWithRejectingCancel();
      const result = await readBytes(request);
      expect(result).toMatchObject({ ok: false, status: 413 });
      expect((request as unknown as { cancelled: boolean }).cancelled).toBe(
        true,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', record);
    }
  });
});
