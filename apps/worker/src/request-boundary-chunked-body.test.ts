import { describe, expect, it } from 'vitest';

import { rejectReadMutationHeadersOrBody } from './content-schema-registry/admission-headers';
import { parseProtectedCommandRequest } from './request-boundary-command';
import { MAX_JSON_BODY_BYTES } from './request-boundary-types';

/* Headerless chunked bodies stop at the ceiling on the other buffering routes. */

const CHUNK_BYTES = 16 * 1024;

const endlessStream = (): {
  stream: ReadableStream<Uint8Array>;
  pulled: () => number;
} => {
  let pulled = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        pulled += CHUNK_BYTES;
        if (pulled > 64 * 1024 * 1024) {
          controller.close();
          return;
        }
        controller.enqueue(new Uint8Array(CHUNK_BYTES).fill(0x20));
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, pulled: () => pulled };
};

const chunked = (
  stream: ReadableStream<Uint8Array>,
  method: string,
  headers: Record<string, string>,
): Request =>
  new Request('https://api.wejammin.test/x', {
    method,
    headers,
    body: stream,
    duplex: 'half',
  } as RequestInit);

describe('protected command body on a headerless chunked body', () => {
  it('answers 413 and stops pulling at the first chunk past the ceiling', async () => {
    const source = endlessStream();
    const result = await parseProtectedCommandRequest(
      chunked(source.stream, 'POST', { 'content-type': 'application/json' }),
    );
    expect(result).toMatchObject({
      ok: false,
      error: { status: 413, code: 'PAYLOAD_TOO_LARGE' },
    });
    expect(source.pulled()).toBeLessThanOrEqual(
      MAX_JSON_BODY_BYTES + 2 * CHUNK_BYTES,
    );
  });
});

describe('protected read body check on a headerless chunked body', () => {
  it('refuses the read and stops pulling at the first chunk', async () => {
    const source = endlessStream();
    const refusal = await rejectReadMutationHeadersOrBody(
      chunked(source.stream, 'POST', {}),
    );
    expect(refusal).toMatchObject({ ok: false });
    expect(source.pulled()).toBeLessThanOrEqual(4 * CHUNK_BYTES);
  });

  it('accepts a read with no body', async () => {
    expect(
      await rejectReadMutationHeadersOrBody(
        new Request('https://api.wejammin.test/x'),
      ),
    ).toBeNull();
  });
});
