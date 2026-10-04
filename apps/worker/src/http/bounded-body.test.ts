import { describe, expect, it } from 'vitest';

import {
  decodeBoundedText,
  readBoundedRequestBytes,
  type BoundedBodyOutcome,
} from './bounded-body';

const MAX = 1024;
const CHUNK = 128;

const probe = (totalBytes: number, failAfter?: number) => {
  let pulled = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (failAfter !== undefined && pulled >= failAfter) {
          controller.error(new Error('reset'));
          return;
        }
        if (pulled >= totalBytes) {
          controller.close();
          return;
        }
        const size = Math.min(CHUNK, totalBytes - pulled);
        pulled += size;
        controller.enqueue(new Uint8Array(size).fill(0x61));
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return {
    stream,
    pulled: () => pulled,
    cancelled: () => cancelled,
  };
};

const requestOf = (
  body: ReadableStream<Uint8Array> | string | null,
  headers: Record<string, string> = {},
): Request =>
  new Request('https://api.wejammin.test/x', {
    method: 'POST',
    headers,
    body,
    duplex: 'half',
  } as RequestInit);

/** A body whose reader is supplied directly, bypassing a real stream. */
const fakeBody = (reader: unknown): ReadableStream<Uint8Array> =>
  ({ getReader: () => reader }) as unknown as ReadableStream<Uint8Array>;

/** A body whose `getReader` always throws. */
const unopenableBody = (): ReadableStream<Uint8Array> =>
  ({
    getReader: () => {
      throw new Error('locked');
    },
  }) as unknown as ReadableStream<Uint8Array>;

/** A reader that resolves each read with `value`, recording a cancel. */
const readerYielding = (value: unknown, onCancel?: () => void): unknown => ({
  cancel: async () => {
    onCancel?.();
  },
  read: async () => ({ done: false, value }),
  releaseLock: () => undefined,
});

/** A reader whose read rejects, standing in for a reset stream. */
const readerErroring = (): unknown => ({
  cancel: async () => undefined,
  read: async () => {
    throw new Error('reset');
  },
  releaseLock: () => undefined,
});

/** Build a request whose `body` is whatever object is supplied. */
const requestWithBody = (body: unknown): Request => {
  const request = requestOf('{}');
  Object.defineProperty(request, 'body', { configurable: true, value: body });
  return request;
};

/** A signal whose `aborted` flips to true on the Nth read. */
const abortsAtRead = (nth: number): AbortSignal => {
  let reads = 0;
  return {
    get aborted() {
      reads += 1;
      return reads >= nth;
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  } as unknown as AbortSignal;
};

const kindOf = (outcome: BoundedBodyOutcome): string => outcome.kind;

describe('readBoundedRequestBytes', () => {
  it('reads a headerless chunked body of exactly the ceiling', async () => {
    const source = probe(MAX);
    const outcome = await readBoundedRequestBytes(requestOf(source.stream), {
      maxBytes: MAX,
    });
    expect(outcome.kind).toBe('ok');
    if (outcome.kind === 'ok') expect(outcome.bytes.byteLength).toBe(MAX);
    expect(source.pulled()).toBe(MAX);
  });

  it('cancels at the first chunk past the ceiling of a headerless body', async () => {
    const source = probe(10 * 1024 * 1024);
    const outcome = await readBoundedRequestBytes(requestOf(source.stream), {
      maxBytes: MAX,
    });
    expect(kindOf(outcome)).toBe('too-large');
    expect(source.pulled()).toBeLessThanOrEqual(MAX + CHUNK);
    expect(source.cancelled()).toBe(true);
  });

  it('refuses a body one byte over the ceiling', async () => {
    const outcome = await readBoundedRequestBytes(
      requestOf(probe(MAX + 1).stream),
      { maxBytes: MAX },
    );
    expect(kindOf(outcome)).toBe('too-large');
  });

  it('refuses a declared oversize length without reading a byte', async () => {
    const source = probe(MAX);
    const outcome = await readBoundedRequestBytes(
      requestOf(source.stream, { 'content-length': String(MAX + 1) }),
      { maxBytes: MAX },
    );
    expect(kindOf(outcome)).toBe('too-large');
    expect(source.pulled()).toBe(0);
  });

  it.each(['-1', '1e3', 'abc', '', '0x10', '1.5'])(
    'refuses malformed declared length %j unread',
    async (declared) => {
      const source = probe(16);
      const request = requestOf(source.stream);
      Object.defineProperty(request, 'headers', {
        value: new Headers({ 'content-length': declared }),
      });
      const outcome = await readBoundedRequestBytes(request, {
        maxBytes: MAX,
      });
      expect(kindOf(outcome)).toBe('malformed-length');
      expect(source.pulled()).toBe(0);
    },
  );

  it('refuses a declared length beyond the safe integer range unread', async () => {
    const source = probe(16);
    const request = requestOf(source.stream);
    Object.defineProperty(request, 'headers', {
      value: new Headers({ 'content-length': '10000000000000000' }),
    });
    const outcome = await readBoundedRequestBytes(request, { maxBytes: MAX });
    expect(kindOf(outcome)).toBe('malformed-length');
    expect(source.pulled()).toBe(0);
  });

  it('answers aborted when the signal fires during a failing body access', async () => {
    const request = requestOf('{}');
    Object.defineProperty(request, 'body', {
      configurable: true,
      get: () => {
        throw new Error('body locked');
      },
    });
    expect(
      kindOf(
        await readBoundedRequestBytes(request, {
          maxBytes: MAX,
          signal: abortsAtRead(2),
        }),
      ),
    ).toBe('aborted');
  });

  it('answers unreadable when a body access fails without an abort', async () => {
    const request = requestOf('{}');
    Object.defineProperty(request, 'body', {
      configurable: true,
      get: () => {
        throw new Error('body locked');
      },
    });
    expect(
      kindOf(
        await readBoundedRequestBytes(request, {
          maxBytes: MAX,
          signal: abortsAtRead(3),
        }),
      ),
    ).toBe('unreadable');
  });

  it('answers aborted when the signal fires during a failing clone access', async () => {
    const request = requestOf('{}');
    Object.defineProperty(request, 'clone', {
      value: () => {
        throw new Error('clone locked');
      },
    });
    expect(
      kindOf(
        await readBoundedRequestBytes(request, {
          fromClone: true,
          maxBytes: MAX,
          signal: abortsAtRead(2),
        }),
      ),
    ).toBe('aborted');
  });

  it('answers aborted when the signal fires after the body resolves', async () => {
    const source = probe(16);
    expect(
      kindOf(
        await readBoundedRequestBytes(requestOf(source.stream), {
          maxBytes: MAX,
          signal: abortsAtRead(2),
        }),
      ),
    ).toBe('aborted');
    expect(source.pulled()).toBe(0);
  });

  it('answers aborted when the signal fires as getReader throws', async () => {
    expect(
      kindOf(
        await readBoundedRequestBytes(requestWithBody(unopenableBody()), {
          maxBytes: MAX,
          signal: abortsAtRead(3),
        }),
      ),
    ).toBe('aborted');
  });

  it('answers unreadable when getReader throws without an abort', async () => {
    expect(
      kindOf(
        await readBoundedRequestBytes(requestWithBody(unopenableBody()), {
          maxBytes: MAX,
          signal: abortsAtRead(4),
        }),
      ),
    ).toBe('unreadable');
  });

  it('answers unreadable for a non-byte stream value', async () => {
    let cancellations = 0;
    const outcome = await readBoundedRequestBytes(
      requestWithBody(
        fakeBody(
          readerYielding('not-bytes', () => {
            cancellations += 1;
          }),
        ),
      ),
      { maxBytes: MAX, signal: abortsAtRead(5) },
    );
    expect(kindOf(outcome)).toBe('unreadable');
    expect(cancellations).toBe(1);
  });

  it('answers aborted for a racing abort during non-byte value access', async () => {
    let cancellations = 0;
    const outcome = await readBoundedRequestBytes(
      requestWithBody(
        fakeBody(
          readerYielding('not-bytes', () => {
            cancellations += 1;
          }),
        ),
      ),
      { maxBytes: MAX, signal: abortsAtRead(4) },
    );
    expect(kindOf(outcome)).toBe('aborted');
    expect(cancellations).toBe(1);
  });

  it('answers aborted when the signal fires as a reader rejects', async () => {
    expect(
      kindOf(
        await readBoundedRequestBytes(
          requestWithBody(fakeBody(readerErroring())),
          {
            maxBytes: MAX,
            signal: abortsAtRead(3),
          },
        ),
      ),
    ).toBe('aborted');
  });

  it('enforces the ceiling on actual bytes when the declaration lies low', async () => {
    const source = probe(10 * 1024 * 1024);
    const request = requestOf(source.stream);
    Object.defineProperty(request, 'headers', {
      value: new Headers({ 'content-length': '10' }),
    });
    const outcome = await readBoundedRequestBytes(request, { maxBytes: MAX });
    expect(kindOf(outcome)).toBe('too-large');
    expect(source.pulled()).toBeLessThanOrEqual(MAX + CHUNK);
  });

  it('answers an empty body as zero bytes', async () => {
    const outcome = await readBoundedRequestBytes(requestOf(null), {
      maxBytes: MAX,
    });
    expect(outcome).toEqual({ kind: 'ok', bytes: new Uint8Array() });
  });

  it('answers unreadable when the stream errors mid-read', async () => {
    const outcome = await readBoundedRequestBytes(
      requestOf(probe(MAX, CHUNK).stream),
      { maxBytes: MAX },
    );
    expect(kindOf(outcome)).toBe('unreadable');
  });

  it('answers aborted when the signal fired before the read', async () => {
    const controller = new AbortController();
    controller.abort();
    const source = probe(16);
    const outcome = await readBoundedRequestBytes(requestOf(source.stream), {
      maxBytes: MAX,
      signal: controller.signal,
    });
    expect(kindOf(outcome)).toBe('aborted');
    expect(source.pulled()).toBe(0);
  });

  it('answers aborted when the signal fires while the body stalls', async () => {
    const controller = new AbortController();
    const stalled = new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>(() => undefined),
    });
    const pending = readBoundedRequestBytes(requestOf(stalled), {
      maxBytes: MAX,
      signal: controller.signal,
    });
    controller.abort();
    expect(kindOf(await pending)).toBe('aborted');
  });

  it('reads a clone branch and leaves the original unread when asked', async () => {
    const request = requestOf('{"a":1}');
    const outcome = await readBoundedRequestBytes(request, {
      maxBytes: MAX,
      fromClone: true,
    });
    expect(outcome.kind).toBe('ok');
    expect(await request.text()).toBe('{"a":1}');
  });

  it('cancels a clone branch past the ceiling without awaiting its sibling', async () => {
    const source = probe(10 * 1024 * 1024);
    const outcome = await readBoundedRequestBytes(requestOf(source.stream), {
      maxBytes: MAX,
      fromClone: true,
    });
    expect(kindOf(outcome)).toBe('too-large');
    expect(source.pulled()).toBeLessThanOrEqual(MAX + 2 * CHUNK);
  });

  it('decodes bounded bytes as UTF-8 text', () => {
    expect(decodeBoundedText(new TextEncoder().encode('héllo'))).toBe('héllo');
  });
});
