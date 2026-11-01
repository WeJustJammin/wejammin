import { describe, expect, it, vi } from 'vitest';

import {
  expectError,
  governedHarness,
  jsonReply,
  MAX_BYTES,
  paddedResponse,
  PARTY_ID,
  REQUEST_ID,
  reviewResource,
  submitBody,
  submitRequest,
  USER_ID,
} from './governed-review-submit.test-support';

describe('CMS-03C-06 production transport boundary', () => {
  it('calls the named RPC with server-bound context and no caller authority', async () => {
    const harness = governedHarness({
      reply: () => jsonReply(reviewResource()),
    });
    const request = submitRequest();
    request.headers.set('x-actor-id', 'caller-controlled');
    request.headers.set('x-capabilities', 'cms.admin');
    request.headers.set('x-owner-party-id', 'caller-controlled');
    expect((await harness.send(request)).status).toBe(201);
    const call = harness.fetchImpl.mock.calls[0];
    expect(call?.[0]).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_submit_governed_review',
    );
    expect(call?.[1]?.method).toBe('POST');
    const headers = new Headers(call?.[1]?.headers);
    expect(headers.get('content-profile')).toBe('platform_api');
    expect(headers.get('accept-profile')).toBe('platform_api');
    expect(headers.get('x-operation-id')).toBe('CMS-03C-06');
    expect(headers.get('x-request-id')).toBe(REQUEST_ID);
    const wire: unknown = JSON.parse(String(call?.[1]?.body));
    expect(wire).toMatchObject({
      p_request: {
        ...submitBody(),
        context: {
          authUserId: USER_ID,
          actingPartyId: PARTY_ID,
          requestId: REQUEST_ID,
          correlationId: REQUEST_ID,
          stepUpVerified: false,
        },
      },
    });
    expect(JSON.stringify(wire)).not.toContain('caller-controlled');
    expect(JSON.stringify(wire)).not.toContain('cms.admin');
  });

  it('consumes the user quota (30/min) then the party quota (60/min)', async () => {
    const harness = governedHarness({
      reply: () => jsonReply(reviewResource()),
    });
    await harness.send(submitRequest());
    expect(
      harness.rateLimit.mock.calls.map(([input]) => ({
        operationId: input.operationId,
        actorId: input.actorId,
        rateClass: input.rateClass,
        rateScope: input.rateScope,
        limit: input.limit,
        windowSeconds: input.windowSeconds,
      })),
    ).toEqual([
      {
        operationId: 'CMS-03C-06',
        actorId: USER_ID,
        rateClass: 'cms-governed-review-write',
        rateScope: 'user',
        limit: 30,
        windowSeconds: 60,
      },
      {
        operationId: 'CMS-03C-06',
        actorId: PARTY_ID,
        rateClass: 'cms-governed-review-write',
        rateScope: 'party',
        limit: 60,
        windowSeconds: 60,
      },
    ]);
  });

  it.each([false, true])(
    'accepts exactly 256 KiB decoded success (declared: %s)',
    async (declared) => {
      const harness = governedHarness({
        reply: async () =>
          paddedResponse(reviewResource(), MAX_BYTES, 200, declared),
      });
      const response = await harness.send(submitRequest());
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(reviewResource());
    },
  );

  it.each([false, true])(
    'rejects 256 KiB + 1 decoded success (declared: %s)',
    async (declared) => {
      const harness = governedHarness({
        reply: async () =>
          paddedResponse(reviewResource(), MAX_BYTES + 1, 200, declared),
      });
      await expectError(
        await harness.send(submitRequest()),
        502,
        'DEPENDENCY_UNAVAILABLE',
      );
    },
  );

  it('preserves a tighter configured response budget', async () => {
    const harness = governedHarness({
      tuning: { maxResponseBytes: 1_024 },
      reply: async () => paddedResponse(reviewResource(), 1_025),
    });
    await expectError(
      await harness.send(submitRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it.each(['user', 'party'])(
    'stops denied %s quota before RPC',
    async (scope) => {
      const harness = governedHarness({
        tuning: {
          rateLimit: async (input) => ({
            ok: true,
            value: {
              allowed: input.rateScope !== scope,
              limit: input.limit,
              remaining: input.rateScope === scope ? 0 : input.limit - 1,
              resetAt: 61,
            },
          }),
        },
      });
      const response = await harness.send(submitRequest());
      await expectError(response, 429, 'RATE_LIMITED');
      expect(response.headers.get('retry-after')).toBe('60');
      expect(response.headers.get('ratelimit-remaining')).toBe('0');
      expect(harness.rateLimit).toHaveBeenCalledTimes(scope === 'user' ? 1 : 2);
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('ends a stalled session at the 15 second route deadline', async () => {
    vi.useFakeTimers();
    try {
      const harness = governedHarness({
        tuning: { resolveSession: () => new Promise(() => undefined) },
      });
      const response = harness.send(submitRequest());
      await vi.advanceTimersByTimeAsync(15_000);
      const done = await response;
      await expectError(done, 504, 'DEPENDENCY_UNAVAILABLE');
      expect(done.headers.get('retry-after')).toBe('15');
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
