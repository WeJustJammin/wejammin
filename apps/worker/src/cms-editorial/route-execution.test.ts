import { describe, expect, it, vi } from 'vitest';

import { rateCheck } from './route-execution';
import type { CmsEditorialDependencies, CmsEditorialSession } from './types';

const request = new Request('https://api.example.test/cms');
const session: CmsEditorialSession = {
  userId: '10000000-0000-4000-8000-000000000001',
  actingPartyId: null,
  capabilities: ['cms.author'],
  mfaFresh: true,
};

const dependencies = (
  rateLimit: CmsEditorialDependencies['rateLimit'],
  omitClock = false,
): CmsEditorialDependencies => ({
  ports: {
    appendRevision: async () => ({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'Unavailable.',
    }),
  },
  resolveSession: async () => ({ ok: true, value: session }),
  rateLimit,
  humanOrigins: [],
  ...(omitClock ? {} : { now: () => 0 }),
});

describe('CMS editorial dual-scope rate admission', () => {
  it('uses only the user bucket when no acting party exists', async () => {
    const calls: unknown[] = [];
    const limiter: CmsEditorialDependencies['rateLimit'] = async (input) => {
      calls.push(input);
      return {
        ok: true as const,
        value: { allowed: true, limit: 120, remaining: 119, resetAt: 60_000 },
      };
    };
    expect((await rateCheck(request, dependencies(limiter), session)).ok).toBe(
      true,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ rateScope: 'user' });
  });

  it('propagates a limiter dependency failure without calling a persistence port', async () => {
    const limiter: CmsEditorialDependencies['rateLimit'] = async () => ({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'Unavailable.',
    });
    expect(
      await rateCheck(request, dependencies(limiter), session),
    ).toMatchObject({
      ok: false,
      status: 503,
    });
  });

  it('derives Retry-After from the injected clock for a denied user bucket', async () => {
    const limiter: CmsEditorialDependencies['rateLimit'] = async () => ({
      ok: true,
      value: { allowed: false, limit: 120, remaining: 0, resetAt: 2 },
    });
    expect(
      await rateCheck(request, dependencies(limiter), session),
    ).toMatchObject({
      ok: false,
      status: 429,
      retryAfterSeconds: 2,
    });
  });

  it('uses the wall clock for Retry-After when no test clock is injected', async () => {
    const wallClock = vi.spyOn(Date, 'now').mockReturnValue(0);
    try {
      const limiter: CmsEditorialDependencies['rateLimit'] = async () => ({
        ok: true,
        value: { allowed: false, limit: 120, remaining: 0, resetAt: 2 },
      });
      const withoutClock = dependencies(limiter, true);
      expect(await rateCheck(request, withoutClock, session)).toMatchObject({
        ok: false,
        status: 429,
        retryAfterSeconds: 2,
      });
    } finally {
      wallClock.mockRestore();
    }
  });

  it('aborts the second bucket when both rate checks exhaust one route budget', async () => {
    vi.useFakeTimers();
    try {
      let notifyRate!: () => void;
      const rateStarted = new Promise<void>((resolve) => {
        notifyRate = resolve;
      });
      const partySession = {
        ...session,
        actingPartyId: '20000000-0000-4000-8000-000000000002',
      };
      const signals: AbortSignal[] = [];
      const limiter: CmsEditorialDependencies['rateLimit'] = async (
        input,
        signal,
      ) => {
        signals.push(signal);
        notifyRate();
        await new Promise<void>((resolve) => setTimeout(resolve, 8_000));
        return {
          ok: true,
          value: {
            allowed: true,
            limit: input.limit,
            remaining: input.limit - 1,
            resetAt: 60_000,
          },
        };
      };
      const deadlineAt = performance.now() + 15_000;
      const result = rateCheck(
        request,
        dependencies(limiter),
        partySession,
        undefined,
        deadlineAt,
      );
      await rateStarted;
      await vi.advanceTimersByTimeAsync(15_000);
      const status = Promise.race([
        result.then((value) => (value.ok ? 200 : value.status)),
        new Promise<number>((resolve) => setTimeout(() => resolve(0), 1)),
      ]);
      await vi.advanceTimersByTimeAsync(1);
      expect(await status).toBe(504);
      expect(signals).toHaveLength(2);
      expect(signals[1]?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not call a limiter after the route budget is exhausted', async () => {
    const limiter = vi.fn<CmsEditorialDependencies['rateLimit']>();
    const result = await rateCheck(
      request,
      dependencies(limiter),
      session,
      undefined,
      performance.now(),
    );
    expect(result).toMatchObject({ ok: false, status: 504 });
    expect(limiter).not.toHaveBeenCalled();
  });
});
