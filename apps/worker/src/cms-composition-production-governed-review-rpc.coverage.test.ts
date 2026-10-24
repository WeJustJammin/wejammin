import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  callGovernedRpc,
  type GovernedTransport,
} from './cms-composition-production-governed-review-rpc';
import type { CmsEditorialProductionConfiguration } from './cms-editorial-production-types';
import {
  detailPath,
  detailResource,
  REVIEW_ID,
  reviewerSession,
} from './cms-composition/governed-review-ops.test-support';
import { REQUEST_ID } from './cms-composition/governed-review-submit.test-support';
import type { GovernedPortInput } from './cms-composition/governed-review-ports';

/**
 * The named-RPC caller of the governed reviews in isolation: every transport fault, under one
 * deadline and never retried (BE03c 168-173). The fresh-context verifier is exercised by the
 * route suites.
 */
afterEach(() => {
  vi.useRealTimers();
});

const configuration = (
  fetchImpl: typeof fetch = vi.fn(),
  maxResponseBytes = 262_144,
): CmsEditorialProductionConfiguration => ({
  baseUrl: 'https://supabase.example.test',
  secret: 'sb_secret_test_only',
  fetchImpl,
  maxResponseBytes,
  now: () => Date.parse('2026-10-14T00:00:00Z'),
});

const readInput = (
  session: GovernedPortInput['session'] = reviewerSession,
): GovernedPortInput => ({
  operationId: 'CMS-03C-10',
  request: new Request(detailPath(), {
    headers: { 'x-request-id': REQUEST_ID },
  }),
  requestId: REQUEST_ID,
  session,
  reviewId: REVIEW_ID,
});

const verifyOk = async () => ({ ok: true as const, value: { ctx: 1 } });

const transportOf = (
  fetchImpl: typeof fetch,
  over: {
    verify?: GovernedTransport['verify'];
    maxResponseBytes?: number;
    deadlineMs?: number;
  } = {},
): GovernedTransport => ({
  configuration: configuration(fetchImpl, over.maxResponseBytes),
  verify: over.verify ?? (verifyOk as GovernedTransport['verify']),
  deadlineMs: over.deadlineMs ?? 15_000,
});

const call = (
  transport: GovernedTransport,
  input: GovernedPortInput = readInput(),
  signal: AbortSignal = new AbortController().signal,
  request: Readonly<Record<string, unknown>> = { reviewId: REVIEW_ID },
) => callGovernedRpc(transport, input, request, signal, null);

const jsonResponse = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('callGovernedRpc local admission', () => {
  it.each([
    ['a null session', null],
    ['a non-object session', 'session'],
  ])(
    'answers 401 for %s without a verifier or network call',
    async (_n, session) => {
      const fetchImpl = vi.fn();
      const verify = vi.fn(verifyOk);
      const result = await call(
        transportOf(fetchImpl as never, { verify: verify as never }),
        readInput(session as never),
      );
      expect(result).toMatchObject({ ok: false, status: 401 });
      expect(verify).not.toHaveBeenCalled();
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('answers 403 capability_missing before any network when the session lacks the owner capability', async () => {
    const fetchImpl = vi.fn();
    const verify = vi.fn(verifyOk);
    const result = await call(
      transportOf(fetchImpl as never, { verify: verify as never }),
      {
        ...readInput(reviewerSession),
        operationId: 'CMS-03C-06',
      } as never,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 403,
      details: { reasonCode: 'capability_missing' },
    });
    expect(verify).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses an RPC payload over the response budget with 400 before the network', async () => {
    const fetchImpl = vi.fn();
    const result = await call(
      transportOf(fetchImpl as never, { maxResponseBytes: 200 }),
      readInput(),
      new AbortController().signal,
      { reviewId: REVIEW_ID, filler: 'x'.repeat(400) },
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('callGovernedRpc verifier and deadline', () => {
  it('a verifier that throws is a retryable 503 and no call is made', async () => {
    const fetchImpl = vi.fn();
    const result = await call(
      transportOf(fetchImpl as never, {
        verify: (async () => {
          throw new Error('boom');
        }) as never,
      }),
    );
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      retryAfterSeconds: 15,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('a verifier refusal is returned unchanged', async () => {
    const result = await call(
      transportOf(vi.fn() as never, {
        verify: (async () => ({
          ok: false,
          status: 401,
          code: 'UNAUTHENTICATED',
          message: 'x',
          details: {},
        })) as never,
      }),
    );
    expect(result).toMatchObject({ ok: false, status: 401 });
  });

  it('a deadline already past is 504 before the verifier runs', async () => {
    const controller = new AbortController();
    controller.abort();
    const verify = vi.fn(verifyOk);
    const result = await call(
      transportOf(vi.fn() as never, { verify: verify as never }),
      readInput(),
      controller.signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 504,
      retryAfterSeconds: 15,
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it('an abort while the verifier is pending is 504', async () => {
    const controller = new AbortController();
    const result = await call(
      transportOf(vi.fn() as never, {
        verify: (() => {
          queueMicrotask(() => controller.abort());
          return new Promise(() => undefined);
        }) as never,
      }),
      readInput(),
      controller.signal,
    );
    expect(result).toMatchObject({ ok: false, status: 504 });
  });

  it('an abort that lands as the verifier answers is 504, not a call', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn();
    const result = await call(
      transportOf(fetchImpl as never, {
        verify: (async () => {
          controller.abort();
          return { ok: true, value: {} };
        }) as never,
      }),
      readInput(),
      controller.signal,
    );
    expect(result).toMatchObject({ ok: false, status: 504 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('an abort that lands between the verifier answering and the continuation is 504, not a call', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn();
    const result = await call(
      transportOf(fetchImpl as never, {
        // A thenable that settles the verifier first and aborts the caller in the same turn.
        verify: (() => ({
          then: (settle: (value: unknown) => void) => {
            settle({ ok: true, value: {} });
            controller.abort();
          },
        })) as never,
      }),
      readInput(),
      controller.signal,
    );
    expect(result).toMatchObject({ ok: false, status: 504 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([200, 400])(
    'a body that stalls after the headers is a 504 at the deadline (status %s)',
    async (status) => {
      const stalled = new Response(
        new ReadableStream({ start: () => undefined }),
        {
          status,
          headers: { 'content-type': 'application/json' },
        },
      );
      const result = await call(
        transportOf(vi.fn(async () => stalled) as never, { deadlineMs: 20 }),
      );
      expect(result).toMatchObject({ ok: false, status: 504 });
    },
  );

  it('a configured deadline longer than the registry deadline is narrowed to 8 seconds for a read', async () => {
    vi.useFakeTimers();
    const transport = transportOf(
      vi.fn(() => new Promise(() => undefined)) as never,
      {
        deadlineMs: 60_000,
      },
    );
    let settled: Awaited<ReturnType<typeof call>> | undefined;
    const pending = call(transport).then((result) => {
      settled = result;
    });
    await vi.advanceTimersByTimeAsync(7_999);
    expect(settled).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(settled).toMatchObject({ ok: false, status: 504 });
  });
});

describe('callGovernedRpc answers', () => {
  it('relays a verified JSON success unchanged', async () => {
    const detail = detailResource();
    const result = await call(
      transportOf(vi.fn(async () => jsonResponse(detail)) as never),
    );
    expect(result).toEqual({
      ok: true,
      value: JSON.parse(JSON.stringify(detail)),
    });
  });

  it('a success that is not JSON is a local 502 and its body is released', async () => {
    const cancel = vi.fn();
    const response = new Response(
      new ReadableStream({
        cancel,
        start: (c) => c.enqueue(new Uint8Array([60])),
      }),
      { status: 200, headers: { 'content-type': 'text/html' } },
    );
    const result = await call(
      transportOf(vi.fn(async () => response) as never),
    );
    expect(result).toMatchObject({ ok: false, status: 502 });
    expect(cancel).toHaveBeenCalled();
  });

  it('a body that cannot be released does not change the decided answer', async () => {
    const response = new Response(
      new ReadableStream({
        cancel: () => Promise.reject(new Error('cancel refused')),
        start: (c) => c.enqueue(new Uint8Array([60])),
      }),
      { status: 200, headers: { 'content-type': 'text/html' } },
    );
    const result = await call(
      transportOf(vi.fn(async () => response) as never),
    );
    expect(result).toMatchObject({ ok: false, status: 502 });
  });

  it('an unserialisable payload is a retryable 503', async () => {
    const fetchImpl = vi.fn();
    const result = await call(
      transportOf(fetchImpl as never),
      readInput(),
      new AbortController().signal,
      {
        toJSON: () => {
          throw new Error('cannot serialise');
        },
      },
    );
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      retryAfterSeconds: 15,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('a fault that lands after the caller aborted is a 504', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn();
    const result = await call(
      transportOf(fetchImpl as never),
      readInput(),
      controller.signal,
      {
        toJSON: () => {
          controller.abort();
          throw new Error('cannot serialise');
        },
      },
    );
    expect(result).toMatchObject({
      ok: false,
      status: 504,
      retryAfterSeconds: 15,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
