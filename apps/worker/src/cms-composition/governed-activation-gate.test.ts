import { describe, expect, it, vi } from 'vitest';

import {
  authenticationSession,
  NOW,
} from '../cms-editorial-production-session-test-support';
import {
  activatedResource,
  activationHarness,
  activationPath,
  activateBody,
  activationRequest,
  retireBody,
  scheduleBody,
} from './governed-activation.test-support';
import {
  expectError,
  expectNoWork,
  FRESH_STEP_UP,
  governedHarness,
  jsonReply,
  PARTY_ID,
  reviewerSession,
  STALE_STEP_UP,
} from './governed-review-ops.test-support';
import { curatorSession } from './governed-review-submit.test-support';

describe('CMS-03C-09 capability, recent MFA and quota order (BE03c 216, 1326 step 1)', () => {
  it('answers a caller with neither owner capability with 403 before step-up and quota', async () => {
    const harness = activationHarness({
      session: reviewerSession,
      stepUpAt: null,
    });
    const error = await expectError(
      await harness.send(activationRequest()),
      403,
      'GOVERNED_REVIEW_FORBIDDEN',
    );
    expect(error.details).toEqual({ reasonCode: 'capability_missing' });
    expectNoWork(harness);
  });

  it('admits a taxonomy curator as well (the any-of owner gate); the database decides the subject kind', async () => {
    const harness = activationHarness({ session: curatorSession });
    expect((await harness.send(activationRequest())).status).toBe(200);
  });

  it.each([
    ['no proof', null],
    ['a stale proof (701 s)', STALE_STEP_UP],
  ])(
    'answers %s with 401 STEP_UP_REQUIRED before quota, reservation and RPC, for every action',
    async (_n, stepUpAt) => {
      for (const body of [activateBody(), scheduleBody(), retireBody()]) {
        const harness = activationHarness({ stepUpAt });
        const error = await expectError(
          await harness.send(activationRequest(body)),
          401,
          'STEP_UP_REQUIRED',
        );
        expect(error.details).toEqual({
          recoveryAction: 'step_up',
          allowedMethods: ['totp'],
        });
        expectNoWork(harness);
      }
    },
  );

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
        resolveCapabilities: ['cms.template_designer'],
      },
      tuning: { now: () => NOW },
      reply: () => jsonReply(activatedResource()),
    });
    const error = await expectError(
      await harness.send(activationRequest()),
      401,
      'STEP_UP_REQUIRED',
    );
    expect(error.details).toMatchObject({ recoveryAction: 'step_up' });
    expect(auth).toHaveBeenCalledTimes(2);
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses an owner capability revoked after admission', async () => {
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
          ++calls === 1 ? ['cms.template_designer'] : ['cms.author'],
      },
      tuning: { now: () => NOW },
    });
    await expectError(
      await harness.send(activationRequest()),
      403,
      'GOVERNED_REVIEW_FORBIDDEN',
    );
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('consumes the user quota (20/min) then the party quota (40/min) of cms-governed-activation', async () => {
    const harness = activationHarness();
    await harness.send(activationRequest());
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
      ['CMS-03C-09', 'cms-governed-activation', 'user', 'user', 20, 60],
      ['CMS-03C-09', 'cms-governed-activation', 'party', 'party', 40, 60],
    ]);
  });

  it.each(['user', 'party'])(
    'stops a denied %s quota before the RPC with 429',
    async (scope) => {
      const harness = activationHarness({
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
      const response = await harness.send(activationRequest());
      const error = await expectError(response, 429, 'RATE_LIMITED');
      expect(response.headers.get('retry-after')).toBe('60');
      expect(response.headers.get('ratelimit-limit')).toBe(
        scope === 'user' ? '20' : '40',
      );
      expect(error.details).toMatchObject({
        limit: scope === 'user' ? 20 : 40,
      });
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
        resolveCapabilities: ['cms.template_designer'],
      },
      reply: () => jsonReply(activatedResource()),
    });
    expect((await harness.send(activationRequest())).status).toBe(200);
    expect(harness.rateLimit.mock.calls.map(([i]) => i.rateScope)).toEqual([
      'user',
    ]);
  });

  it('answers the preflight with If-Match and Idempotency-Key and refuses a foreign origin', async () => {
    const harness = activationHarness();
    const ok = await harness.send(
      new Request(activationPath(), {
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
      new Request(activationPath(), {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.example.test' },
      }),
    );
    expect(bad.status).toBe(403);
  });
});
