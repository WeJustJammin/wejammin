import { describe, expect, it } from 'vitest';

import { readJsonBodyText } from './boundary';

/*
 * A chunked request carries no Content-Length, so the ceiling must be enforced
 * while the body streams: the Worker stops pulling at ceiling + 1 bytes rather
 * than buffering the whole body and comparing afterwards.
 */

const MAX_BODY_BYTES = 256 * 1024;
const CHUNK_BYTES = 16 * 1024;

type PulledStream = Readonly<{
  stream: ReadableStream<Uint8Array>;
  pulledBytes: () => number;
  cancelled: () => boolean;
}>;

const pulledStream = (totalBytes: number): PulledStream => {
  let pulled = 0;
  let wasCancelled = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (pulled >= totalBytes) {
          controller.close();
          return;
        }
        const size = Math.min(CHUNK_BYTES, totalBytes - pulled);
        pulled += size;
        controller.enqueue(new Uint8Array(size).fill(0x20));
      },
      cancel() {
        wasCancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return {
    stream,
    pulledBytes: () => pulled,
    cancelled: () => wasCancelled,
  };
};

const chunkedRequest = (stream: ReadableStream<Uint8Array>): Request =>
  new Request('https://api.wejammin.test/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: stream,
    duplex: 'half',
  } as RequestInit);

describe('readJsonBodyText on a headerless chunked body', () => {
  it('refuses 413 and stops pulling at the first chunk past the ceiling', async () => {
    const source = pulledStream(64 * 1024 * 1024);
    const result = await readJsonBodyText(chunkedRequest(source.stream));
    expect(result).toMatchObject({
      ok: false,
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
    expect(source.pulledBytes()).toBeLessThanOrEqual(
      MAX_BODY_BYTES + CHUNK_BYTES,
    );
    expect(source.cancelled()).toBe(true);
  });

  it('refuses 413 with a deadline signal on the same oversized chunked body', async () => {
    const source = pulledStream(64 * 1024 * 1024);
    const result = await readJsonBodyText(
      chunkedRequest(source.stream),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 413 });
    expect(source.pulledBytes()).toBeLessThanOrEqual(
      MAX_BODY_BYTES + CHUNK_BYTES,
    );
  });

  it('accepts a chunked body of exactly the ceiling', async () => {
    const source = pulledStream(MAX_BODY_BYTES);
    const result = await readJsonBodyText(chunkedRequest(source.stream));
    expect(result).toEqual({ ok: true, value: ' '.repeat(MAX_BODY_BYTES) });
    expect(source.pulledBytes()).toBe(MAX_BODY_BYTES);
  });

  it('refuses a chunked body one byte over the ceiling', async () => {
    const source = pulledStream(MAX_BODY_BYTES + 1);
    expect(await readJsonBodyText(chunkedRequest(source.stream))).toMatchObject(
      { ok: false, status: 413, code: 'PAYLOAD_TOO_LARGE' },
    );
  });
});
