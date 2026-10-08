/**
 * Slice 10 evidence lane EA: every declared failure of CMS-03B-01, -02, -03 and -04 maps to the
 * typed BE00 ApiError through the PRODUCTION Hono app and the PRODUCTION RPC adapter (harness:
 * `support/ev-ea-editorial-app.ts`). The same table runs for all four operations so none inherits
 * another operation's mapping by assumption.
 *
 * For each failure it asserts the status, the closed error code, that the dependency's own text is
 * never echoed, the retry and recovery hints the client acts on, and that a request refused before
 * persistence (rate limit) never reaches the RPC.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  LEAK,
  OPERATIONS,
  PARTY,
  USER,
  build,
  read,
  rpcError,
  send,
} from './support/ev-ea-editorial-app';

describe.each(OPERATIONS)(
  '$id failure mapping through the production app and adapter',
  (operation) => {
    it(`${operation.id} maps a transport failure to a retryable 503 DEPENDENCY_UNAVAILABLE without echoing the dependency text`, async () => {
      const fetchImpl = vi.fn(async () => {
        throw new TypeError(`socket hang up ${LEAK}`);
      });
      const response = await send(
        build(fetchImpl as unknown as typeof fetch),
        operation,
      );
      expect(response.status).toBe(503);
      const body = await read(response);
      expect(body.code).toBe('DEPENDENCY_UNAVAILABLE');
      expect(response.headers.get('x-cms-editorial-retryable')).toBe('true');
      expect(JSON.stringify(body)).not.toContain(LEAK);
      expect(body.requestId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    });

    it(`${operation.id} scrubs an unexpected RPC 5xx into a retryable 503 and never echoes its body`, async () => {
      const fetchImpl = vi.fn(
        async () =>
          new Response(JSON.stringify({ message: LEAK }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          }),
      );
      const response = await send(
        build(fetchImpl as unknown as typeof fetch),
        operation,
      );
      expect(response.status).toBe(503);
      expect(response.headers.get('x-cms-editorial-retryable')).toBe('true');
      expect(await response.text()).not.toContain(LEAK);
    });

    it(`${operation.id} maps the database INTERNAL_ERROR token to a scrubbed 500 INTERNAL_ERROR`, async () => {
      const fetchImpl = vi.fn(async () => rpcError('INTERNAL_ERROR'));
      const response = await send(
        build(fetchImpl as unknown as typeof fetch),
        operation,
      );
      expect(response.status).toBe(500);
      const body = await read(response);
      expect(body.code).toBe('INTERNAL_ERROR');
      expect(body.message).toBe('An unexpected error occurred.');
      expect(body.details).toEqual({});
    });

    it(`${operation.id} maps a success payload that fails the declared resource contract to a non-retryable 502 BAD_GATEWAY`, async () => {
      const fetchImpl = vi.fn(
        async () =>
          new Response(JSON.stringify({ unexpected: LEAK }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      );
      const response = await send(
        build(fetchImpl as unknown as typeof fetch),
        operation,
      );
      expect(response.status).toBe(502);
      expect(response.headers.get('x-cms-editorial-retryable')).toBe('false');
      const body = await read(response);
      expect(body.code).toBe('BAD_GATEWAY');
      expect(JSON.stringify(body)).not.toContain(LEAK);
    });

    it(`${operation.id} maps a dependency that outlives the route deadline to a retryable 504 GATEWAY_TIMEOUT and aborts the call`, async () => {
      let aborted = false;
      const fetchImpl = vi.fn(
        (_input: unknown, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              aborted = true;
              reject(new DOMException('aborted', 'AbortError'));
            });
          }),
      );
      const response = await send(
        build(fetchImpl as unknown as typeof fetch, { deadlineMs: 30 }),
        operation,
      );
      expect(response.status).toBe(504);
      expect((await read(response)).code).toBe('GATEWAY_TIMEOUT');
      expect(response.headers.get('x-cms-editorial-retryable')).toBe('true');
      expect(aborted).toBe(true);
    });

    it(`${operation.id} refuses a denied rate decision with 429 RATE_LIMITED, Retry-After and no RPC call`, async () => {
      const fetchImpl = vi.fn(async () => rpcError('NOT_FOUND'));
      const app = build(fetchImpl as unknown as typeof fetch, {
        rateLimit: async (input) => ({
          ok: true,
          value: {
            allowed: false,
            limit: input.limit,
            remaining: 0,
            resetAt: Math.floor(Date.now() / 1000) + 30,
          },
        }),
      });
      const response = await send(app, operation);
      expect(response.status).toBe(429);
      const body = await read(response);
      expect(body.code).toBe('RATE_LIMITED');
      expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
      expect(response.headers.get('ratelimit-remaining')).toBe('0');
      expect(body.details.retryAfterSeconds).toBeGreaterThan(0);
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it(`${operation.id} fails closed with 503 and no RPC call when the rate limiter itself is unavailable`, async () => {
      const fetchImpl = vi.fn(async () => rpcError('NOT_FOUND'));
      const app = build(fetchImpl as unknown as typeof fetch, {
        rateLimit: async () => ({
          ok: false,
          status: 503,
          code: 'DEPENDENCY_UNAVAILABLE',
          message: LEAK,
        }),
      });
      const response = await send(app, operation);
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain(LEAK);
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it(`${operation.id} maps the database NOT_FOUND token to an empty-detail 404 NOT_FOUND`, async () => {
      const fetchImpl = vi.fn(async () => rpcError('NOT_FOUND'));
      const response = await send(
        build(fetchImpl as unknown as typeof fetch),
        operation,
      );
      expect(response.status).toBe(404);
      const body = await read(response);
      expect(body.code).toBe('NOT_FOUND');
      expect(body.details).toEqual({});
    });

    it(`${operation.id} maps the database FORBIDDEN token to 403 FORBIDDEN`, async () => {
      const fetchImpl = vi.fn(async () => rpcError('FORBIDDEN'));
      const response = await send(
        build(fetchImpl as unknown as typeof fetch),
        operation,
      );
      expect(response.status).toBe(403);
      expect((await read(response)).code).toBe('FORBIDDEN');
    });

    it(`${operation.id} sends the named RPC once with the verified session context and never a caller identity`, async () => {
      const fetchImpl = vi.fn(async () => rpcError('NOT_FOUND'));
      await send(build(fetchImpl as unknown as typeof fetch), operation);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [url, init] = fetchImpl.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      expect(url).toBe(
        `https://supabase.example.test/rest/v1/rpc/${operation.rpc}`,
      );
      const sent = JSON.parse(String(init.body)) as {
        p_request: { context: Record<string, unknown> };
      };
      expect(sent.p_request.context).toMatchObject({
        authUserId: USER,
        actingPartyId: PARTY,
      });
    });
  },
);

describe.each(OPERATIONS.filter((operation) => operation.method === 'POST'))(
  '$id write conflicts through the production app and adapter',
  (operation) => {
    it(`${operation.id} maps VERSION_MISMATCH to a definite 409 CONFLICT with reload recovery and no retry hint`, async () => {
      const fetchImpl = vi.fn(async () => rpcError('VERSION_MISMATCH'));
      const response = await send(
        build(fetchImpl as unknown as typeof fetch),
        operation,
      );
      expect(response.status).toBe(409);
      const body = await read(response);
      expect(body.code).toBe('CONFLICT');
      expect(body.details).toMatchObject({
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'reload',
      });
      expect(response.headers.get('retry-after')).toBeNull();
    });

    it(`${operation.id} maps IDEMPOTENCY_MISMATCH to a 409 CONFLICT that tells the client to use a new key`, async () => {
      const fetchImpl = vi.fn(async () => rpcError('IDEMPOTENCY_MISMATCH'));
      const response = await send(
        build(fetchImpl as unknown as typeof fetch),
        operation,
      );
      expect(response.status).toBe(409);
      expect((await read(response)).details).toMatchObject({
        conflict: 'IDEMPOTENCY_MISMATCH',
        recoveryAction: 'use_new_idempotency_key',
      });
    });
  },
);
