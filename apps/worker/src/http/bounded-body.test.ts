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
