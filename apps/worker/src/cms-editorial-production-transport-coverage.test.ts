import { describe, it } from 'vitest';

import {
  createDeadline,
  fetchWithDeadline,
  parseJsonResponse,
  readBoundedResponse,
  readRpcError,
} from './cms-editorial-production-transport';
import type { CmsEditorialProductionConfiguration } from './cms-editorial-production-types';
import {
  compose,
  expect,
  json,
  portInput,
  revisionResource,
  vi,
} from './cms-editorial-production.test-support';

const RPC_URL = 'https://supabase.example.test/rest/v1/rpc/x';

const streamed = (
  chunks: readonly string[],
  contentType = 'application/json',
): Response =>
  new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { headers: { 'content-type': contentType } },
  );

/** A response whose headers arrive but whose body never completes. */
const stalled = (): Response =>
  new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"ok":'));
      },
    }),
    { headers: { 'content-type': 'application/json' } },
  );

const configuration = (
  fetchImpl: typeof fetch,
  maxResponseBytes = 1024,
): CmsEditorialProductionConfiguration => ({
  baseUrl: 'https://supabase.example.test',
  secret: 'sb_secret_transport_coverage',
  fetchImpl,
  maxResponseBytes,
  now: () => Date.parse('2026-09-26T12:00:00.000Z'),
});

describe('cms editorial production transport bounds', () => {
  it('treats a transport abort rejection as a deadline', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.reject(new DOMException('aborted', 'AbortError')),
    );
    const deadline = createDeadline(new AbortController().signal, 2000);
    try {
      const result = await fetchWithDeadline(
        configuration(fetchImpl as unknown as typeof fetch),
        RPC_URL,
        {},
        deadline,
      );
      expect(result).toMatchObject({ ok: false, status: 504 });
    } finally {
      deadline.dispose();
    }
  });

  it('fails closed even when the runtime reports no timer handle', async () => {
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(((callback: () => void) => {
        callback();
        return undefined as never;
      }) as never);
    try {
      const deadline = createDeadline(new AbortController().signal, 2000);
      try {
        const result = await fetchWithDeadline(
          configuration(
            vi.fn(
              () => new Promise<Response>(() => undefined),
            ) as unknown as typeof fetch,
          ),
          RPC_URL,
          {},
          deadline,
        );
        expect(result).toMatchObject({ ok: false, status: 504 });
      } finally {
        deadline.dispose();
      }
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  it('short-circuits a request whose caller signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn();
    const deadline = createDeadline(controller.signal, 2000);
    try {
      const result = await fetchWithDeadline(
        configuration(fetchImpl as unknown as typeof fetch),
        RPC_URL,
        {},
        deadline,
      );
      expect(result).toMatchObject({ ok: false, status: 504 });
      expect(deadline.expired()).toBe(false);
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      deadline.dispose();
    }
  });

  it('disposes the deadline idempotently without aborting the caller signal', () => {
    const controller = new AbortController();
    const deadline = createDeadline(controller.signal, 2000);
    deadline.dispose();
    deadline.dispose();
    expect(deadline.signal.aborted).toBe(false);
    expect(controller.signal.aborted).toBe(false);
  });

  it('rejects a declared content length beyond the response budget', async () => {
    const response = json({ value: 'x'.repeat(200) }, 200, {
      'content-length': '1024',
    });
    expect(await parseJsonResponse(response, 16)).toMatchObject({
      ok: false,
      status: 502,
    });
  });

  it('rejects an unparsable content length', async () => {
    const response = json({ ok: true }, 200, {
      'content-length': 'not-a-number',
    });
    expect(await parseJsonResponse(response, 1024)).toMatchObject({
      ok: false,
      status: 502,
    });
  });

  it('rejects a negative content length', async () => {
    const response = json({ ok: true }, 200, { 'content-length': '-1' });
    expect(await parseJsonResponse(response, 1024)).toMatchObject({
      ok: false,
      status: 502,
    });
  });

  it('parses a body whose declared content length is within budget', async () => {
    const body = JSON.stringify({ ok: true });
    const response = json({ ok: true }, 200, {
      'content-length': String(body.length),
    });
    expect(await parseJsonResponse(response, 1024)).toEqual({
      ok: true,
      value: { ok: true },
    });
  });

  it('bounds a streamed body that omits a content length', async () => {
    expect(
      await parseJsonResponse(streamed(['x'.repeat(100)]), 16),
    ).toMatchObject({ ok: false, status: 502 });
  });

  it('treats an empty body as an invalid dependency response', async () => {
    const response = new Response(null, {
      status: 204,
      headers: { 'content-type': 'application/json' },
    });
    expect(response.body).toBeNull();
    expect(await parseJsonResponse(response, 1024)).toMatchObject({
      ok: false,
      status: 502,
    });
  });

  it('fails closed when the response stream errors', async () => {
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new Error('stream failure'));
        },
      }),
      { headers: { 'content-type': 'application/json' } },
    );
    expect(await parseJsonResponse(response, 1024)).toMatchObject({
      ok: false,
      status: 502,
    });
  });

  it('stops reading once the caller signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    expect(
      await readBoundedResponse(streamed(['{}']), 1024, controller.signal),
    ).toBeNull();
  });

  it('cancels a pending body read when the deadline signal aborts', async () => {
    const controller = new AbortController();
    const pending = readBoundedResponse(stalled(), 1024, controller.signal);
    controller.abort();
    expect(await pending).toBeNull();
  });

  it('swallows a stream whose cancellation rejects while aborting', async () => {
    const controller = new AbortController();
    const response = new Response(
      new ReadableStream({
        start(source) {
          source.enqueue(new TextEncoder().encode('{'));
        },
        cancel() {
          throw new Error('cancel refused');
        },
      }),
      { headers: { 'content-type': 'application/json' } },
    );
    const pending = readBoundedResponse(response, 1024, controller.signal);
    controller.abort();
    expect(await pending).toBeNull();
  });

  it('rejects a body with an unsupported media type before reading', async () => {
    expect(
      await parseJsonResponse(streamed(['{}'], 'text/plain'), 1024),
    ).toMatchObject({ ok: false, status: 502 });
  });

  it('returns null for an error payload that is not valid JSON', async () => {
    expect(
      await readRpcError(streamed(['not json'], 'text/html'), 1024),
    ).toBeNull();
    expect(await readRpcError(json({ code: 'NOT_FOUND' }, 404), 1024)).toEqual({
      code: 'NOT_FOUND',
    });
  });

  it('enforces the total deadline across a stalled response body', async () => {
    const fetchImpl = vi.fn(async () => stalled());
    const dependencies = compose(fetchImpl as unknown as typeof fetch, {
      deadlineMs: 20,
    });
    const result = await dependencies.ports.appendRevision(
      portInput(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 504 });
  });

  it('maps a transport rejection to a retryable dependency failure', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('network down')));
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const result = await dependencies.ports.appendRevision(
      portInput(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('fails closed when the transport throws synchronously', async () => {
    const fetchImpl = vi.fn(() => {
      throw new Error('synchronous transport failure');
    });
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const result = await dependencies.ports.appendRevision(
      portInput(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 500,
      code: 'INTERNAL_ERROR',
      details: {},
    });
    expect(JSON.stringify(result)).not.toContain('synchronous transport');
  });

  it('honours a caller abort raised after the request starts', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const controller = new AbortController();
    const pending = dependencies.ports.appendRevision(
      portInput(),
      controller.signal,
    );
    controller.abort();
    expect(await pending).toMatchObject({ ok: false, status: 504 });
  });

  it('treats an abort that lands while the request is being issued as a deadline', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(() => {
      controller.abort();
      return Promise.reject(new DOMException('aborted', 'AbortError'));
    });
    const dependencies = compose(fetchImpl as unknown as typeof fetch);
    const result = await dependencies.ports.appendRevision(
      portInput(),
      controller.signal,
    );
    expect(result).toMatchObject({ ok: false, status: 504 });
  });

  it('bounds a response that exceeds a caller-tightened budget', async () => {
    const fetchImpl = vi.fn(async () => json(revisionResource, 201));
    const dependencies = compose(fetchImpl as unknown as typeof fetch, {
      maxResponseBytes: 8,
    });
    const result = await dependencies.ports.appendRevision(
      portInput(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 502 });
  });
});
