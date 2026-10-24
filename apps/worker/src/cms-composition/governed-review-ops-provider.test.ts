import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  COMMANDS,
  OPERATIONS,
  PROVIDER_FAULTS,
} from './governed-review-ops-table.test-support';
import {
  expectError,
  jsonReply,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from './governed-review-ops.test-support';
import { paddedResponse } from './governed-review-submit.test-support';

afterEach(() => vi.useRealTimers());

const MAX = 262_144;

describe.each(OPERATIONS)('$id provider boundary', (row) => {
  it('calls the named RPC with the platform_api profile and server context', async () => {
    const harness = row.harness();
    const response = await harness.send(row.request());
    expect(response.status).toBe(row.status);
    const call = harness.fetchImpl.mock.calls[0];
    expect(call?.[0]).toBe(
      `https://supabase.example.test/rest/v1/rpc/${row.rpc}`,
    );
    const headers = new Headers(call?.[1]?.headers);
    expect(headers.get('content-profile')).toBe('platform_api');
    expect(headers.get('accept-profile')).toBe('platform_api');
    expect(headers.get('x-operation-id')).toBe(row.id);
    expect(headers.get('x-request-id')).toBe(REQUEST_ID);
    const wire = JSON.parse(String(call?.[1]?.body)) as {
      p_request: { context: Record<string, unknown> };
    };
    expect(wire.p_request.context).toMatchObject({
      authUserId: USER_ID,
      actingPartyId: PARTY_ID,
      requestId: REQUEST_ID,
    });
    expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('sends an idempotency key exactly on the commands', async () => {
    const harness = row.harness();
    await harness.send(row.request());
    const call = harness.fetchImpl.mock.calls[0];
    const headers = new Headers(call?.[1]?.headers);
    const wire = JSON.parse(String(call?.[1]?.body)) as {
      p_request: Record<string, unknown>;
    };
    const command = COMMANDS.includes(row);
    expect(headers.has('x-idempotency-key')).toBe(command);
    expect('idempotencyKey' in wire.p_request).toBe(command);
    expect('ifMatch' in wire.p_request).toBe(command);
  });

  it.each([500, 502, 503, 504])(
    'maps provider HTTP %i to 503 with retry-after 15',
    async (status) => {
      const harness = row.harness({
        reply: () => jsonReply({ message: 'private provider' }, status),
      });
      const response = await harness.send(row.request());
      const error = await expectError(response, 503, 'DEPENDENCY_UNAVAILABLE');
      expect(error.details).toEqual({
        dependencyClass: 'cms_composition',
        retryable: true,
      });
      expect(response.headers.get('retry-after')).toBe('15');
    },
  );

  it.each(PROVIDER_FAULTS)('scrubs %s to 500', async (_n, status, payload) => {
    const harness = row.harness({ reply: () => jsonReply(payload, status) });
    const error = await expectError(
      await harness.send(row.request()),
      500,
      'INTERNAL_ERROR',
    );
    expect(error.details).toEqual({});
    expect(JSON.stringify(error)).not.toMatch(/private|PGRST|42702/);
  });

  it('scrubs an explicit INTERNAL_ERROR token', async () => {
    const harness = row.harness({
      reply: () =>
        jsonReply(
          { code: 'P0001', message: 'INTERNAL_ERROR', details: 'private' },
          400,
        ),
    });
    await expectError(await harness.send(row.request()), 500, 'INTERNAL_ERROR');
  });

  it.each(['not json', '', '{"a":'])(
    'answers a malformed 2xx body %j as a local 502',
    async (text) => {
      const harness = row.harness({
        reply: () =>
          Promise.resolve(
            new Response(text, {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          ),
      });
      const error = await expectError(
        await harness.send(row.request()),
        502,
        'DEPENDENCY_UNAVAILABLE',
      );
      expect(error.details).toMatchObject({ retryable: true });
    },
  );

  it('answers a non-JSON media type as a local 502', async () => {
    const harness = row.harness({
      reply: () =>
        Promise.resolve(
          new Response(JSON.stringify(row.valid()), {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
        ),
    });
    await expectError(
      await harness.send(row.request()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it('answers a success that fails the strict resource schema as a local 502', async () => {
    const harness = row.harness({
      reply: () => jsonReply({ ...(row.valid() as object), actorId: USER_ID }),
    });
    await expectError(
      await harness.send(row.request()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it.each([false, true])(
    'accepts exactly 256 KiB and refuses 256 KiB + 1 (declared: %s)',
    async (declared) => {
      const ok = row.harness({
        reply: async () => paddedResponse(row.valid(), MAX, 200, declared),
      });
      expect((await ok.send(row.request())).status).toBe(row.status);
      const over = row.harness({
        reply: async () => paddedResponse(row.valid(), MAX + 1, 200, declared),
      });
      await expectError(
        await over.send(row.request()),
        502,
        'DEPENDENCY_UNAVAILABLE',
      );
    },
  );

  it(`ends a stalled RPC at the ${row.deadlineMs} ms route deadline and never retries`, async () => {
    vi.useFakeTimers();
    const harness = row.harness({
      reply: () => new Promise<Response>(() => undefined),
    });
    const result = harness.send(row.request());
    await vi.advanceTimersByTimeAsync(row.deadlineMs);
    const response = await result;
    await expectError(response, 504, 'DEPENDENCY_UNAVAILABLE');
    expect(response.headers.get('retry-after')).toBe('15');
    expect(harness.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not end a stalled RPC before its deadline', async () => {
    vi.useFakeTimers();
    const harness = row.harness({
      reply: () => new Promise<Response>(() => undefined),
    });
    let settled = false;
    const result = (async () => {
      const response = await harness.send(row.request());
      settled = true;
      return response;
    })();
    await vi.advanceTimersByTimeAsync(row.deadlineMs - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await result).status).toBe(504);
  });

  it('answers an anonymous caller with 401 UNAUTHENTICATED before any dependency', async () => {
    const harness = row.harness({ anonymous: true });
    await expectError(
      await harness.send(row.request()),
      401,
      'UNAUTHENTICATED',
    );
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it(`charges ${row.limits[0]}/min/user then ${row.limits[1]}/min/party of ${row.rateClass}`, async () => {
    const harness = row.harness();
    await harness.send(row.request());
    expect(
      harness.rateLimit.mock.calls.map(([input]) => [
        input.operationId,
        input.rateClass,
        input.rateScope,
        input.limit,
        input.windowSeconds,
      ]),
    ).toEqual([
      [row.id, row.rateClass, 'user', row.limits[0], 60],
      [row.id, row.rateClass, 'party', row.limits[1], 60],
    ]);
  });

  it.each([
    ['user', 0],
    ['party', 1],
  ])(
    'answers a denied %s quota with 429 and the quota members',
    async (scope, index) => {
      const harness = row.harness({
        tuning: {
          rateLimit: async (input) => ({
            ok: true,
            value: {
              allowed: input.rateScope !== scope,
              limit: input.limit,
              remaining: 0,
              resetAt: 61,
            },
          }),
        },
      });
      const response = await harness.send(row.request());
      const error = await expectError(response, 429, 'RATE_LIMITED');
      const limit = row.limits[index] as number;
      expect(error.details).toMatchObject({
        limit,
        resetAt: '61',
        retryAfterSeconds: 60,
      });
      expect(response.headers.get('retry-after')).toBe('60');
      expect(response.headers.get('ratelimit-limit')).toBe(String(limit));
      expect(response.headers.get('ratelimit-remaining')).toBe('0');
      expect(response.headers.get('ratelimit-reset')).toBe('61');
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('refuses a foreign origin before authentication and a thrown quota as 503', async () => {
    const foreign = row.request();
    foreign.headers.set('origin', 'https://evil.example.test');
    const first = row.harness();
    await expectError(
      await first.send(foreign),
      403,
      'GOVERNED_REVIEW_FORBIDDEN',
    );
    expect(first.resolveSession).not.toHaveBeenCalled();
    const second = row.harness({
      tuning: {
        rateLimit: async () => {
          throw new Error('private provider');
        },
      },
    });
    await expectError(
      await second.send(row.request()),
      503,
      'DEPENDENCY_UNAVAILABLE',
    );
    expect(second.fetchImpl).not.toHaveBeenCalled();
  });
});
