import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from '../pages/auth/start';
import {
  bindingStub,
  jsonResponse,
  type BindingStub,
} from './step-up-mfa-context.test-support';

/**
 * Codex R14f #2: `/auth/start` is public, so its 8 KiB form ceiling cannot rest
 * on a `Content-Length` the client may omit (chunked HTTP/1.1, HTTP/2). A missing
 * header used to count as zero, after which `request.formData()` buffered the
 * whole body. The ceiling is now enforced while the stream is consumed.
 */
const state: { binding: BindingStub } = { binding: bindingStub() };

vi.mock('cloudflare:workers', () => ({
  get env() {
    return { PLATFORM_API: state.binding };
  },
}));

const LIMIT = 8192;
const FORM = 'application/x-www-form-urlencoded';
const ORIGIN = 'https://app.example.test';

type Spy = {
  readonly stream: ReadableStream<Uint8Array>;
  readonly pulled: { bytes: number; chunks: number; cancelled: boolean };
};

/** A body of `total` bytes in `chunkSize` pieces, counting what is pulled from it. */
const spyStream = (total: number, chunkSize: number, fill = 'a'): Spy => {
  const pulled = { bytes: 0, chunks: 0, cancelled: false };
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull: (controller) => {
        const size = Math.min(chunkSize, total - sent);
        if (size <= 0) {
          controller.close();
          return;
        }
        sent += size;
        pulled.bytes += size;
        pulled.chunks += 1;
        controller.enqueue(new TextEncoder().encode(fill.repeat(size)));
      },
      cancel: () => {
        pulled.cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, pulled };
};

const streamOf = (text: string): Spy => {
  const bytes = new TextEncoder().encode(text);
  const pulled = { bytes: 0, chunks: 0, cancelled: false };
  const stream = new ReadableStream<Uint8Array>(
    {
      pull: (controller) => {
        pulled.bytes += bytes.byteLength;
        pulled.chunks += 1;
        controller.enqueue(bytes);
        controller.close();
      },
    },
    { highWaterMark: 0 },
  );
  return { stream, pulled };
};

const post = (body: Spy, headers: Record<string, string> = {}) =>
  POST({
    request: new Request(`${ORIGIN}/auth/start`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': FORM, ...headers },
      body: body.stream,
      duplex: 'half',
    } as RequestInit),
  } as never);

const VALID_FORM = 'email=person%40example.test&intent=sign_in&returnTo=%2Fapp';

describe('POST /auth/start body ceiling', () => {
  beforeEach(() => {
    state.binding = bindingStub(jsonResponse(202, {}));
  });

  it('refuses a headerless body far above the ceiling and stops reading at it', async () => {
    const body = spyStream(64 * 1024 * 1024, 1024);
    const response = await post(body);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toContain('outcome=invalid');
    // 8,193 bytes is the first byte over the cap; the reader never goes beyond
    // the chunk that crossed it.
    expect(body.pulled.bytes).toBeLessThanOrEqual(LIMIT + 1024);
    expect(body.pulled.cancelled).toBe(true);
    expect(state.binding.requests()).toHaveLength(0);
  });

  it('stops after one oversized chunk without reading the rest', async () => {
    const body = spyStream(64 * 1024 * 1024, 1024 * 1024);
    const response = await post(body);
    expect(response.headers.get('location')).toContain('outcome=invalid');
    expect(body.pulled.chunks).toBe(1);
    expect(body.pulled.cancelled).toBe(true);
  });

  it('refuses a body that exceeds the ceiling after declaring a smaller length', async () => {
    const body = spyStream(1024 * 1024, 1024);
    const response = await post(body, { 'content-length': '100' });
    expect(response.headers.get('location')).toContain('outcome=invalid');
    expect(body.pulled.bytes).toBeLessThanOrEqual(LIMIT + 1024);
    expect(body.pulled.cancelled).toBe(true);
  });

  it.each(['-1', 'abc', '1e3', '1.5', '', ' ', '0x10', '+5'])(
    'refuses the malformed Content-Length %j unread',
    async (declared) => {
      const body = streamOf(VALID_FORM);
      const response = await post(body, { 'content-length': declared });
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toContain('outcome=invalid');
      expect(body.pulled.chunks).toBe(0);
      expect(state.binding.requests()).toHaveLength(0);
    },
  );

  it('refuses a declared length above the ceiling unread', async () => {
    const body = streamOf(VALID_FORM);
    const response = await post(body, {
      'content-length': String(LIMIT + 1),
    });
    expect(response.headers.get('location')).toContain('outcome=invalid');
    expect(body.pulled.chunks).toBe(0);
  });

  it('still serves a valid small form that declares no Content-Length', async () => {
    const response = await post(streamOf(VALID_FORM));
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      '/auth/sign-in?outcome=email_sent',
    );
    expect(state.binding.requests()).toHaveLength(1);
  });

  it('still serves a valid small form that declares its true length', async () => {
    const response = await post(streamOf(VALID_FORM), {
      'content-length': String(new TextEncoder().encode(VALID_FORM).length),
    });
    expect(response.headers.get('location')).toBe(
      '/auth/sign-in?outcome=email_sent',
    );
  });

  it('accepts a form of exactly the ceiling and refuses one byte more', async () => {
    const pad = (size: number): string => {
      const base = `${VALID_FORM}&pad=`;
      return base + 'x'.repeat(size - base.length);
    };
    const exact = streamOf(pad(LIMIT));
    const accepted = await post(exact);
    expect(accepted.headers.get('location')).toBe(
      '/auth/sign-in?outcome=email_sent',
    );

    const over = streamOf(pad(LIMIT + 1));
    const refused = await post(over);
    expect(refused.headers.get('location')).toContain('outcome=invalid');
  });

  it('refuses a body with no content type as an invalid form', async () => {
    const response = await POST({
      request: new Request(`${ORIGIN}/auth/start`, {
        method: 'POST',
        headers: { origin: ORIGIN },
        body: VALID_FORM,
      }),
    } as never);
    expect(response.headers.get('location')).toContain('outcome=invalid');
    expect(state.binding.requests()).toHaveLength(0);
  });
});
