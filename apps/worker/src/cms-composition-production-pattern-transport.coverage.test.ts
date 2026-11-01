import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  callPatternRpc,
  type PatternTransport,
} from './cms-composition-production-pattern-definition-latest';
import type { CmsEditorialProductionConfiguration } from './cms-editorial-production-types';
import {
  designerSession,
  PATTERN_KEY,
  readRequest,
  REQUEST_ID,
} from './cms-composition/pattern-definition.test-support';

afterEach(() => {
  vi.useRealTimers();
});

describe('callPatternRpc transport', () => {
  const configuration = (
    fetchImpl: typeof fetch,
    maxResponseBytes = 262_144,
  ): CmsEditorialProductionConfiguration => ({
    baseUrl: 'https://supabase.example.test',
    secret: 'sb_secret_test_only',
    fetchImpl,
    maxResponseBytes,
    now: () => Date.parse('2026-10-14T00:00:00Z'),
  });
  const verifyOk = async () => ({ ok: true as const, value: { ctx: 1 } });
  const transportOf = (
    fetchImpl: typeof fetch,
    verify: PatternTransport['verify'] = verifyOk as PatternTransport['verify'],
  ): PatternTransport => ({
    configuration: configuration(fetchImpl),
    verify,
    deadlineMs: 15_000,
  });
  const input = (session: unknown = designerSession) =>
    ({
      operationId: 'cmsPatternLatestRead',
      request: readRequest(),
      requestId: REQUEST_ID,
      session,
    }) as never;
  const call = (
    transport: PatternTransport,
    over: {
      input?: never;
      signal?: AbortSignal;
      payload?: object;
      write?: { idempotencyKey: string; ifMatch: string | null };
    } = {},
  ) =>
    callPatternRpc(
      transport,
      over.input ?? input(),
      over.payload ?? { patternKey: PATTERN_KEY },
      over.signal ?? new AbortController().signal,
      over.write,
    );

  it.each([
    ['a null session', null],
    ['a non-object session', 'session'],
  ])(
    'answers 401 for %s without a verifier or network call',
    async (_n, session) => {
      const fetchImpl = vi.fn();
      const verify = vi.fn(verifyOk);
      expect(
        await call(transportOf(fetchImpl as never, verify as never), {
          input: input(session),
        }),
      ).toMatchObject({ ok: false, status: 401 });
      expect(verify).not.toHaveBeenCalled();
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['no acting party', { ...designerSession, actingPartyId: null }],
    ['no designer capability', { ...designerSession, capabilities: [] }],
  ])(
    'answers 403 capability_missing for %s before any network',
    async (_n, session) => {
      const fetchImpl = vi.fn();
      expect(
        await call(transportOf(fetchImpl as never), { input: input(session) }),
      ).toMatchObject({
        ok: false,
        status: 403,
        details: { reasonCode: 'capability_missing' },
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('forwards the idempotency key and a strong If-Match only when a parent version is named', async () => {
    const seen: Headers[] = [];
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      seen.push(new Headers(init?.headers));
      bodies.push(
        (
          JSON.parse(String(init?.body)) as {
            p_request: Record<string, unknown>;
          }
        ).p_request,
      );
      return Response.json({ ok: 1 });
    });
    const transport = transportOf(fetchImpl as never);
    await call(transport, {
      write: { idempotencyKey: 'pattern-definition-0001', ifMatch: '4' },
    });
    await call(transport, {
      write: { idempotencyKey: 'pattern-definition-0002', ifMatch: null },
    });
    expect(seen[0]?.get('x-idempotency-key')).toBe('pattern-definition-0001');
    expect(seen[0]?.get('if-match')).toBe('"4"');
    expect(bodies[0]).toMatchObject({
      idempotencyKey: 'pattern-definition-0001',
      ifMatch: '4',
    });
    expect(seen[1]?.get('x-idempotency-key')).toBe('pattern-definition-0002');
    expect(seen[1]?.has('if-match')).toBe(false);
    expect(bodies[1]).not.toHaveProperty('ifMatch');
  });

  it('a verifier that throws is a retryable 503 and no call is made', async () => {
    const fetchImpl = vi.fn();
    expect(
      await call(
        transportOf(
          fetchImpl as never,
          (async () => {
            throw new Error('boom');
          }) as never,
        ),
      ),
    ).toMatchObject({ ok: false, status: 503, retryAfterSeconds: 15 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('a deadline already past is 504 before the verifier runs', async () => {
    const controller = new AbortController();
    controller.abort();
    const verify = vi.fn(verifyOk);
    expect(
      await call(transportOf(vi.fn() as never, verify as never), {
        signal: controller.signal,
      }),
    ).toMatchObject({ ok: false, status: 504, retryAfterSeconds: 15 });
    expect(verify).not.toHaveBeenCalled();
  });

  it('an abort that lands between the verifier answering and the continuation is 504, not a call', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn();
    const verify = (() => ({
      then: (settle: (value: unknown) => void) => {
        settle({ ok: true, value: {} });
        controller.abort();
      },
    })) as never;
    expect(
      await call(transportOf(fetchImpl as never, verify), {
        signal: controller.signal,
      }),
    ).toMatchObject({ ok: false, status: 504 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('an unserialisable payload is a retryable 503', async () => {
    expect(
      await call(transportOf(vi.fn() as never), {
        payload: {
          toJSON: () => {
            throw new Error('cannot serialise');
          },
        },
      }),
    ).toMatchObject({ ok: false, status: 503, retryAfterSeconds: 15 });
  });

  it('a fault that lands after the caller aborted is a 504', async () => {
    const controller = new AbortController();
    expect(
      await call(transportOf(vi.fn() as never), {
        signal: controller.signal,
        payload: {
          toJSON: () => {
            controller.abort();
            throw new Error('cannot serialise');
          },
        },
      }),
    ).toMatchObject({ ok: false, status: 504, retryAfterSeconds: 15 });
  });

  it('a body that cannot be released does not change the decided answer', async () => {
    const response = new Response(
      new ReadableStream({
        cancel: () => Promise.reject(new Error('cancel refused')),
        start: (c) => c.enqueue(new Uint8Array([60])),
      }),
      { status: 200, headers: { 'content-type': 'text/html' } },
    );
    expect(
      await call(transportOf(vi.fn(async () => response) as never)),
    ).toMatchObject({ ok: false, status: 502 });
  });
});
