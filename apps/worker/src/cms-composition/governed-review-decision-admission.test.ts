import { describe, expect, it, vi } from 'vitest';

import {
  authenticationSession,
  NOW,
} from '../cms-editorial-production-session-test-support';
import {
  decidedReview,
  decisionPath,
  decisionRequest,
  expectError,
  expectNoWork,
  FRESH_STEP_UP,
  governedHarness,
  jsonReply,
  ownerSession,
  PARTY_ID,
  reviewerHarness,
  STALE_STEP_UP,
} from './governed-review-ops.test-support';

describe('CMS-03C-07 capability, recent MFA and quota order (BE03c 216)', () => {
  it('answers a caller without cms.reviewer with 403 before step-up and quota', async () => {
    const harness = reviewerHarness({ session: ownerSession, stepUpAt: null });
    const error = await expectError(
      await harness.send(decisionRequest()),
      403,
      'GOVERNED_REVIEW_FORBIDDEN',
    );
    expect(error.details).toEqual({ reasonCode: 'capability_missing' });
    expectNoWork(harness);
  });

  it.each([
    ['no proof', null],
    ['a stale proof (701 s)', STALE_STEP_UP],
  ])(
    'answers %s with 401 STEP_UP_REQUIRED before quota, reservation and RPC',
    async (_n, stepUpAt) => {
      const harness = reviewerHarness({ stepUpAt });
      const error = await expectError(
        await harness.send(decisionRequest()),
        401,
        'STEP_UP_REQUIRED',
      );
      expect(error.details).toEqual({
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      });
      expectNoWork(harness);
    },
  );

  it('answers an anonymous caller with UNAUTHENTICATED, never step-up', async () => {
    const harness = reviewerHarness({ anonymous: true });
    const error = await expectError(
      await harness.send(decisionRequest()),
      401,
      'UNAUTHENTICATED',
    );
    expect(error.details).toEqual({ recoveryAction: 'reauthenticate' });
    expectNoWork(harness);
  });

  it('re-proves recent MFA on the refreshed session before the RPC', async () => {
    let calls = 0;
    const fresh = authenticationSession({
      stepUpAt: '2026-09-26T11:55:00.000Z',
    });
    const stale = { ...fresh, stepUpAt: '2026-09-26T10:00:00.000Z' };
    const auth = vi.fn(async () => ({
      ok: true as const,
      value: ++calls === 1 ? fresh : stale,
    }));
    const harness = governedHarness({
      authority: {
        auth: { resolveSession: auth },
        resolveCapabilities: ['cms.reviewer'],
      },
      tuning: { now: () => NOW },
      reply: () => jsonReply(decidedReview()),
    });
    const error = await expectError(
      await harness.send(decisionRequest()),
      401,
      'STEP_UP_REQUIRED',
    );
    expect(error.details).toMatchObject({ recoveryAction: 'step_up' });
    expect(auth).toHaveBeenCalledTimes(2);
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses a reviewer grant revoked after admission', async () => {
    let calls = 0;
    const harness = governedHarness({
      authority: {
        auth: {
          resolveSession: async () => ({
            ok: true as const,
            value: authenticationSession({
              stepUpAt: '2026-09-26T11:55:00.000Z',
            }),
          }),
        },
        resolveCapabilities: async () =>
          ++calls === 1 ? ['cms.reviewer'] : ['cms.author'],
      },
      tuning: { now: () => NOW },
    });
    await expectError(
      await harness.send(decisionRequest()),
      403,
      'GOVERNED_REVIEW_FORBIDDEN',
    );
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('consumes the user quota (30/min) then the party quota (60/min) of cms-governed-decision', async () => {
    const harness = reviewerHarness();
    await harness.send(decisionRequest());
    expect(
      harness.rateLimit.mock.calls.map(([input]) => [
        input.operationId,
        input.rateClass,
        input.rateScope,
        input.actorId === PARTY_ID ? 'party' : 'user',
        input.limit,
        input.windowSeconds,
      ]),
    ).toEqual([
      ['CMS-03C-07', 'cms-governed-decision', 'user', 'user', 30, 60],
      ['CMS-03C-07', 'cms-governed-decision', 'party', 'party', 60, 60],
    ]);
  });

  it.each(['user', 'party'])(
    'stops a denied %s quota before the RPC with 429',
    async (scope) => {
      const harness = reviewerHarness({
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
      const response = await harness.send(decisionRequest());
      await expectError(response, 429, 'RATE_LIMITED');
      expect(response.headers.get('retry-after')).toBe('60');
      expect(harness.fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('leaves a missing acting party to the RPC and charges only the user quota', async () => {
    const harness = governedHarness({
      authority: {
        auth: {
          resolveSession: async () => ({
            ok: true as const,
            value: authenticationSession({
              actingPartyId: null,
              stepUpAt: FRESH_STEP_UP,
            }),
          }),
        },
        resolveCapabilities: ['cms.reviewer'],
      },
      reply: () => jsonReply(decidedReview()),
    });
    expect((await harness.send(decisionRequest())).status).toBe(200);
    expect(harness.rateLimit.mock.calls.map(([i]) => i.rateScope)).toEqual([
      'user',
    ]);
  });

  it('answers the preflight with If-Match and Idempotency-Key and refuses a foreign origin', async () => {
    const harness = reviewerHarness();
    const ok = await harness.send(
      new Request(decisionPath(), {
        method: 'OPTIONS',
        headers: { origin: 'https://cms.example.test' },
      }),
    );
    expect(ok.status).toBe(204);
    expect(ok.headers.get('access-control-allow-methods')).toBe(
      'POST, OPTIONS',
    );
    expect(ok.headers.get('access-control-allow-headers')).toBe(
      'Content-Type, Idempotency-Key, If-Match, X-CSRF-Token, X-Request-Id',
    );
    const bad = await harness.send(
      new Request(decisionPath(), {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.example.test' },
      }),
    );
    expect(bad.status).toBe(403);
  });
});
