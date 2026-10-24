import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createPatternUpdateRpc,
  type PatternUpdateRpcInput,
} from './cms-composition-production-pattern-update-rpc';
import {
  configuration,
  URL_,
} from './cms-composition-production-pattern-update-rpc.test-support';
import {
  puId,
  PU_REQUEST_ID,
  PU_USER_ID,
} from './cms-composition/pattern-update.test-support';
import { puSession } from './cms-composition/pattern-update-routes.test-support';

/**
 * The named-RPC caller in isolation: every transport fault, under one deadline. The fresh-context verifier is in
 * `cms-composition-production-pattern-update-context.test.ts`.
 */
afterEach(() => {
  vi.useRealTimers();
});

describe('createPatternUpdateRpc', () => {
  const input = (
    operationId: PatternUpdateRpcInput['operationId'] = 'CMS-03C-13',
  ): PatternUpdateRpcInput => ({
    operationId,
    request: new Request(URL_, { headers: { 'x-request-id': PU_REQUEST_ID } }),
    requestId: PU_REQUEST_ID,
    session: puSession(),
  });
  const verifyOk = async () => ({
    ok: true as const,
    value: { authUserId: PU_USER_ID },
  });
  const json = (value: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(value), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init.headers as object),
      },
    });
  const make = (
    fetchImpl: typeof fetch,
    over: { verify?: never; deadlineMs?: number; bytes?: number } = {},
  ) =>
    createPatternUpdateRpc(
      configuration(fetchImpl, over.bytes),
      (over.verify ?? verifyOk) as never,
      over.deadlineMs ?? 15_000,
    );
  const call = (
    rpc: ReturnType<typeof make>,
    signal = new AbortController().signal,
  ) => rpc(input(), { contentTypeId: puId(1) }, signal);

  it('answers the parsed body and the ETag text, or null when the producer set none', async () => {
    const withTag = make(
      vi.fn(async () => json({ a: 1 }, { headers: { etag: '"4"' } })) as never,
    );
    expect(await call(withTag)).toEqual({
      ok: true,
      value: { value: { a: 1 }, etag: '"4"' },
    });
    const bare = make(vi.fn(async () => json({ a: 1 })) as never);
    expect(await call(bare)).toEqual({
      ok: true,
      value: { value: { a: 1 }, etag: null },
    });
  });

  it('a verifier that throws is a retryable 503 and no call is made', async () => {
    const fetchImpl = vi.fn();
    const rpc = make(fetchImpl as never, {
      verify: (async () => {
        throw new Error('boom');
      }) as never,
    });
    expect(await call(rpc)).toMatchObject({
      ok: false,
      status: 503,
      retryAfterSeconds: 15,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('a verifier refusal is returned unchanged', async () => {
    const rpc = make(vi.fn() as never, {
      verify: (async () => ({
        ok: false,
        status: 403,
        code: 'X',
        message: 'x',
      })) as never,
    });
    expect(await call(rpc)).toMatchObject({ ok: false, status: 403 });
  });

  it('a deadline already past is 504 before the verifier runs', async () => {
    const controller = new AbortController();
    controller.abort();
    const verify = vi.fn(verifyOk);
    const rpc = make(vi.fn() as never, { verify: verify as never });
    expect(await call(rpc, controller.signal)).toMatchObject({
      ok: false,
      status: 504,
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it('an abort while the verifier is pending is 504', async () => {
    const controller = new AbortController();
    const rpc = make(vi.fn() as never, {
      verify: (() => {
        queueMicrotask(() => controller.abort());
        return new Promise(() => undefined);
      }) as never,
    });
    expect(await call(rpc, controller.signal)).toMatchObject({
      ok: false,
      status: 504,
    });
  });

  it('an abort that lands as the verifier answers is 504, not a call', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn();
    const rpc = make(fetchImpl as never, {
      verify: (async () => {
        controller.abort();
        return { ok: true, value: {} };
      }) as never,
    });
    expect(await call(rpc, controller.signal)).toMatchObject({
      ok: false,
      status: 504,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('a fetch that rejects is a retryable 503', async () => {
    const rpc = make(
      vi.fn(async () => {
        throw new Error('network');
      }) as never,
    );
    expect(await call(rpc)).toMatchObject({
      ok: false,
      status: 503,
      retryAfterSeconds: 15,
    });
  });

  it('a fetch that never answers is a 504 at the deadline', async () => {
    const rpc = make(vi.fn(() => new Promise(() => undefined)) as never, {
      deadlineMs: 20,
    });
    expect(await call(rpc)).toMatchObject({
      ok: false,
      status: 504,
      retryAfterSeconds: 15,
    });
  });

  it.each([
    ['CMS-03C-13', 8_000],
    ['CMS-03C-14', 8_000],
    ['CMS-03C-15', 15_000],
  ] as const)(
    '%s narrows a longer configured deadline to its registry deadline of $1 ms',
    async (operationId, registryMs) => {
      vi.useFakeTimers();
      const configuredMs = 60_000;
      const rpc = make(vi.fn(() => new Promise(() => undefined)) as never, {
        deadlineMs: configuredMs,
      });
      let settled: Awaited<ReturnType<typeof rpc>> | undefined;
      const pending = rpc(
        input(operationId),
        { contentTypeId: puId(1) },
        new AbortController().signal,
        { idempotencyKey: 'pattern-update-0001', ifMatch: '4' },
      ).then((result) => {
        settled = result;
      });
      await vi.advanceTimersByTimeAsync(registryMs - 1);
      expect(settled).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(settled).toMatchObject({
        ok: false,
        status: 504,
        retryAfterSeconds: 15,
      });
    },
  );

  it('a configured deadline shorter than the registry deadline is kept, not widened', async () => {
    vi.useFakeTimers();
    const rpc = make(vi.fn(() => new Promise(() => undefined)) as never, {
      deadlineMs: 3_000,
    });
    let settled: Awaited<ReturnType<typeof rpc>> | undefined;
    const pending = call(rpc).then((result) => {
      settled = result;
    });
    await vi.advanceTimersByTimeAsync(2_999);
    expect(settled).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(settled).toMatchObject({ ok: false, status: 504 });
  });

  it('a body that stalls after the headers is a 504 at the deadline, success or failure', async () => {
    const stalled = (status: number) =>
      new Response(new ReadableStream({ start: () => undefined }), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    for (const status of [200, 400])
      expect(
        await call(
          make(vi.fn(async () => stalled(status)) as never, { deadlineMs: 20 }),
        ),
      ).toMatchObject({ ok: false, status: 504 });
  });

  it('an error body that is not JSON is 503 on a 5xx and the scrubbed 500 on a 4xx', async () => {
    expect(
      await call(
        make(
          vi.fn(async () => new Response('<html>', { status: 502 })) as never,
        ),
      ),
    ).toMatchObject({ ok: false, status: 503 });
    expect(
      await call(
        make(
          vi.fn(async () => new Response('<html>', { status: 400 })) as never,
        ),
      ),
    ).toMatchObject({ ok: false, status: 500 });
  });

  it('a success that is not JSON is 502 and its body is released', async () => {
    const cancel = vi.fn();
    const response = new Response(
      new ReadableStream({
        cancel,
        start: (c) => c.enqueue(new Uint8Array([60])),
      }),
      { status: 200, headers: { 'content-type': 'text/html' } },
    );
    expect(
      await call(make(vi.fn(async () => response) as never)),
    ).toMatchObject({
      ok: false,
      status: 502,
    });
    expect(cancel).toHaveBeenCalled();
  });

  it('an answer over the byte ceiling is 502, declared or streamed', async () => {
    const big = JSON.stringify({ pad: 'x'.repeat(200) });
    expect(
      await call(
        make(vi.fn(async () => json(JSON.parse(big))) as never, { bytes: 100 }),
      ),
    ).toMatchObject({ ok: false, status: 502 });
  });

  it('the byte ceiling is the operation own: the diff may read twice the others', async () => {
    const body = JSON.stringify({ pad: 'x'.repeat(300_000) });
    const response = () =>
      new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    const diff = make(vi.fn(async () => response()) as never);
    expect(
      await diff(
        input('CMS-03C-14'),
        { instanceId: puId(1) },
        new AbortController().signal,
      ),
    ).toMatchObject({
      ok: true,
    });
    const selector = make(vi.fn(async () => response()) as never);
    expect(await call(selector)).toMatchObject({ ok: false, status: 502 });
  });
});
