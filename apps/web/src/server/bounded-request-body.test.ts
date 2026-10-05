import { describe, expect, it } from 'vitest';

import {
  readBoundedRequestBody,
  type BoundedRequestBody,
} from './bounded-request-body';

const MAX = 1024;
const CHUNK = 128;
const URL = 'https://app.wejammin.test/auth/start';

type Source = Readonly<{
  stream: ReadableStream<Uint8Array>;
  pulled: () => number;
  cancelled: () => number;
}>;

/** A body of totalBytes in CHUNK-sized pieces, counting pulls and cancels. */
const source = (totalBytes: number): Source => {
  let pulled = 0;
  let cancelled = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull: (controller) => {
        if (pulled >= totalBytes) {
          controller.close();
          return;
        }
        const size = Math.min(CHUNK, totalBytes - pulled);
        pulled += size;
        controller.enqueue(new Uint8Array(size).fill(0x61));
      },
      cancel: () => {
        cancelled += 1;
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, pulled: () => pulled, cancelled: () => cancelled };
};

const requestOf = (
  body: ReadableStream<Uint8Array> | null,
  init: RequestInit = {},
): Request =>
  new Request(URL, {
    method: 'POST',
    body,
    duplex: 'half',
    ...init,
  } as RequestInit);

/** Resolves to pending if work has not settled within ms. */
const settledWithin = async <T>(
  work: Promise<T>,
  ms: number,
): Promise<T | 'pending'> =>
  Promise.race([
    work,
    new Promise<'pending'>((resolve) => {
      setTimeout(() => resolve('pending'), ms);
    }),
  ]);

describe('readBoundedRequestBody', () => {
  it('refuses a malformed declared length without touching the body', async () => {
    const body = source(MAX);
    const outcome = await readBoundedRequestBody(
      requestOf(body.stream, { headers: { 'content-length': '12, 34' } }),
      { maxBytes: MAX },
    );
    expect(outcome).toStrictEqual({
      ok: false,
      reason: 'malformed-length',
    } satisfies BoundedRequestBody);
    expect(body.pulled()).toBe(0);
    expect(body.cancelled()).toBe(0);
  });

  it('refuses a declared oversize length without touching the body', async () => {
    const body = source(MAX);
    const outcome = await readBoundedRequestBody(
      requestOf(body.stream, {
        headers: { 'content-length': String(MAX + 1) },
      }),
      { maxBytes: MAX },
    );
    expect(outcome).toStrictEqual({
      ok: false,
      reason: 'too-large',
    } satisfies BoundedRequestBody);
    expect(body.pulled()).toBe(0);
    expect(body.cancelled()).toBe(0);
  });

  it('accepts a declared length exactly at the ceiling', async () => {
    const body = source(MAX);
    const outcome = await readBoundedRequestBody(
      requestOf(body.stream, { headers: { 'content-length': String(MAX) } }),
      { maxBytes: MAX },
    );
    expect(outcome).toStrictEqual({
      ok: true,
      bytes: new Uint8Array(MAX).fill(0x61),
    } satisfies BoundedRequestBody);
    expect(body.pulled()).toBe(MAX);
  });

  it('reads a headerless body of exactly the ceiling', async () => {
    const body = source(MAX);
    const outcome = await readBoundedRequestBody(requestOf(body.stream), {
      maxBytes: MAX,
    });
    expect(outcome).toStrictEqual({
      ok: true,
      bytes: new Uint8Array(MAX).fill(0x61),
    } satisfies BoundedRequestBody);
    expect(body.pulled()).toBe(MAX);
    expect(body.cancelled()).toBe(0);
  });

  it('refuses and cancels the first chunk past the ceiling', async () => {
    const body = source(8 * MAX);
    const outcome = await readBoundedRequestBody(requestOf(body.stream), {
      maxBytes: MAX,
    });
    expect(outcome).toStrictEqual({
      ok: false,
      reason: 'too-large',
    } satisfies BoundedRequestBody);
    // Exactly one chunk is pulled past the ceiling before the reader stops.
    expect(body.pulled()).toBe(MAX + CHUNK);
    expect(body.cancelled()).toBe(1);
  });

  it('refuses a body whose reader cannot be acquired', async () => {
    const body = source(MAX);
    const request = requestOf(body.stream);
    // A locked stream throws from getReader().
    const lock = request.body!.getReader();
    const outcome = await readBoundedRequestBody(request, { maxBytes: MAX });
    expect(outcome).toStrictEqual({
      ok: false,
      reason: 'unreadable',
    } satisfies BoundedRequestBody);
    expect(body.pulled()).toBe(0);
    await lock.cancel();
  });

  it('refuses a body whose read fails mid-stream', async () => {
    const failing = new ReadableStream<Uint8Array>(
      { pull: (controller) => controller.error(new Error('reset')) },
      { highWaterMark: 0 },
    );
    const outcome = await readBoundedRequestBody(requestOf(failing), {
      maxBytes: MAX,
    });
    expect(outcome).toStrictEqual({
      ok: false,
      reason: 'unreadable',
    } satisfies BoundedRequestBody);
  });

  it('refuses a body whose read yields a non-byte chunk', async () => {
    const bogus = new ReadableStream<Uint8Array>({
      start: (controller) =>
        controller.enqueue('nope' as unknown as Uint8Array),
    });
    const outcome = await settledWithin(
      readBoundedRequestBody(requestOf(bogus), { maxBytes: MAX }),
      1_000,
    );
    expect(outcome).not.toBe('pending');
    expect(outcome).toStrictEqual({
      ok: false,
      reason: 'unreadable',
    } satisfies BoundedRequestBody);
  });

  it('accepts a cross-realm Uint8Array chunk', async () => {
    // undici (and every runtime boundary) hands chunks back from its own
    // realm, so a realm-sensitive instanceof Uint8Array would refuse a valid
    // body. A chunk whose prototype is detached from this realm's Uint8Array
    // stands in for that cross-realm value; its bytes are real and must be
    // read, not classified as unreadable.
    const foreign = new Uint8Array(4).fill(0x62);
    Object.setPrototypeOf(foreign, Object.getPrototypeOf(Uint8Array.prototype));
    expect(foreign instanceof Uint8Array).toBe(false);
    expect(ArrayBuffer.isView(foreign)).toBe(true);
    const crossRealm = new ReadableStream<Uint8Array>({
      start: (controller) => {
        controller.enqueue(foreign);
        controller.close();
      },
    });
    const outcome = await readBoundedRequestBody(requestOf(crossRealm), {
      maxBytes: MAX,
    });
    expect(outcome).toStrictEqual({
      ok: true,
      bytes: new Uint8Array(4).fill(0x62),
    } satisfies BoundedRequestBody);
  });

  it('refuses without reading when the request already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const body = source(MAX);
    const outcome = await readBoundedRequestBody(requestOf(body.stream), {
      maxBytes: MAX,
      signal: controller.signal,
    });
    expect(outcome).toStrictEqual({
      ok: false,
      reason: 'aborted',
    } satisfies BoundedRequestBody);
    expect(body.pulled()).toBe(0);
  });

  it('refuses a stalled body when the request aborts', async () => {
    const controller = new AbortController();
    const stalled = new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>(() => undefined),
    });
    const pending = readBoundedRequestBody(requestOf(stalled), {
      maxBytes: MAX,
      signal: controller.signal,
    });
    controller.abort();
    const outcome = await settledWithin(pending, 1_000);
    expect(outcome).not.toBe('pending');
    expect(outcome).toStrictEqual({
      ok: false,
      reason: 'aborted',
    } satisfies BoundedRequestBody);
  });

  it('refuses a stalled body once the deadline passes', async () => {
    const stalled = new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>(() => undefined),
    });
    const outcome = await settledWithin(
      readBoundedRequestBody(requestOf(stalled), {
        maxBytes: MAX,
        deadlineMs: 50,
      }),
      1_000,
    );
    expect(outcome).not.toBe('pending');
    expect(outcome).toStrictEqual({
      ok: false,
      reason: 'unreadable',
    } satisfies BoundedRequestBody);
  });

  it('does not wait on a tee-backed cancel that cannot settle', async () => {
    const body = source(8 * MAX);
    const branch = body.stream.tee()[0]!;
    const outcome = await settledWithin(
      readBoundedRequestBody(requestOf(branch), { maxBytes: MAX }),
      1_000,
    );
    expect(outcome).not.toBe('pending');
    expect(outcome).toStrictEqual({
      ok: false,
      reason: 'too-large',
    } satisfies BoundedRequestBody);
  });
});
