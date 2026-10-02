import { describe, expect, it, vi } from 'vitest';

import type { WorkerBindings } from '../index';
import type { RateLimitDecision } from './types';
import { createProductionContentSchemaRegistryDependencies } from './production';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const PARTY_ID = '20000000-0000-4000-8000-000000000002';
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'rate-coverage',
  SUPABASE_SECRET_KEY: 'sb_secret_rate_coverage',
  SUPABASE_URL: 'https://supabase.example.test',
};
const request = new Request('https://api.example.test/cms');
const input = (overrides: Record<string, unknown> = {}) =>
  ({
    operationId: 'CMS-03A-01',
    request,
    requestId: REQUEST_ID,
    actorId: USER_ID,
    actingPartyId: PARTY_ID,
    principalClass: 'human',
    rateClass: 'cms-write',
    limit: 20,
    windowSeconds: 60,
    ...overrides,
  }) as unknown as Parameters<
    ReturnType<
      typeof createProductionContentSchemaRegistryDependencies
    >['rateLimit']
  >[0];
const validDecision: RateLimitDecision = {
  allowed: true,
  limit: 20,
  remaining: 19,
  resetAt: 1_757_000_000,
};
const baseOptions = (overrides: Record<string, unknown> = {}) => ({
  environment,
  fetchImpl: vi.fn<typeof fetch>(async () => new Response('{}')),
  auth: {
    resolveSession: vi.fn(async () => ({
      ok: false as const,
      status: 401 as const,
      code: 'UNAUTHENTICATED',
      message: 'invalid',
    })),
  },
  humanOrigins: [],
  releaseOrigins: [],
  ...overrides,
});

describe('content registry rate limiter adapter', () => {
  it('passes valid decisions through and rejects every impossible decision shape', async () => {
    const success = createProductionContentSchemaRegistryDependencies(
      baseOptions({
        rateLimit: vi.fn(async () => ({
          ok: true as const,
          value: validDecision,
        })),
      }),
    );
    await expect(
      success.rateLimit(input(), new AbortController().signal),
    ).resolves.toEqual({
      ok: true,
      value: validDecision,
    });
    const malformed = [
      { allowed: 'yes', limit: 20, remaining: 19, resetAt: 1 },
      { allowed: true, limit: 0, remaining: 0, resetAt: 1 },
      { allowed: true, limit: 20.2, remaining: 19, resetAt: 1 },
      { allowed: true, limit: 20, remaining: -1, resetAt: 1 },
      { allowed: true, limit: 20, remaining: 21, resetAt: 1 },
      { allowed: true, limit: 20, remaining: 19.2, resetAt: 1 },
      { allowed: true, limit: 20, remaining: 19, resetAt: -1 },
      { allowed: true, limit: 20, remaining: 19, resetAt: 1.2 },
    ];
    for (const value of malformed) {
      const dependencies = createProductionContentSchemaRegistryDependencies(
        baseOptions({
          rateLimit: vi.fn(async () => ({ ok: true as const, value })),
        }),
      );
      await expect(
        dependencies.rateLimit(input(), new AbortController().signal),
      ).resolves.toMatchObject({
        ok: false,
        status: 502,
      });
    }
    const error = createProductionContentSchemaRegistryDependencies(
      baseOptions({
        rateLimit: vi.fn(async () => ({
          ok: false as const,
          status: 429 as const,
          code: 'RATE_LIMITED',
          message: 'safe',
        })),
      }),
    );
    await expect(
      error.rateLimit(input(), new AbortController().signal),
    ).resolves.toMatchObject({
      ok: false,
      status: 429,
    });
  });

  it('maps limiter exceptions and signal cancellation to safe recovery responses', async () => {
    for (const thrown of [
      new Error('offline'),
      new DOMException('abort', 'AbortError'),
    ]) {
      const dependencies = createProductionContentSchemaRegistryDependencies(
        baseOptions({
          rateLimit: vi.fn(async () => {
            throw thrown;
          }),
        }),
      );
      await expect(
        dependencies.rateLimit(input(), new AbortController().signal),
      ).resolves.toMatchObject({
        ok: false,
        status: thrown instanceof DOMException ? 504 : 503,
      });
    }
    const controller = new AbortController();
    controller.abort();
    const cancelled = createProductionContentSchemaRegistryDependencies(
      baseOptions({
        rateLimit: vi.fn(async () => {
          throw new Error('late');
        }),
      }),
    );
    await expect(
      cancelled.rateLimit(input(), controller.signal),
    ).resolves.toMatchObject({
      ok: false,
      status: 504,
    });
    const noLimiter = createProductionContentSchemaRegistryDependencies(
      baseOptions({ rateLimit: undefined, auth: undefined }),
    );
    await expect(
      noLimiter.rateLimit(input(), new AbortController().signal),
    ).resolves.toMatchObject({
      ok: false,
      status: 503,
    });
  });

  it('uses the authentication rate-limit seam with digest-only human and release buckets', async () => {
    const authRateLimit = vi.fn(async (value) => {
      expect(value.identifierDigest).toMatch(/^[a-f0-9]{64}$/u);
      expect(value.identifierDigest).not.toContain(USER_ID);
      return { ok: true as const, value: validDecision };
    });
    const dependencies = createProductionContentSchemaRegistryDependencies(
      baseOptions({
        rateLimit: undefined,
        auth: {
          resolveSession: vi.fn(async () => ({
            ok: false as const,
            status: 401 as const,
            code: 'UNAUTHENTICATED',
            message: 'invalid',
          })),
          rateLimit: authRateLimit,
        },
      }),
    );
    await expect(
      dependencies.rateLimit(input(), new AbortController().signal),
    ).resolves.toMatchObject({
      ok: true,
    });
    await expect(
      dependencies.rateLimit(
        input({
          principalClass: 'release-worker',
          actorId: 'release-worker-01',
          operationId: 'CMS-03A-05',
        }),
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ ok: true });
    expect(authRateLimit).toHaveBeenCalledTimes(2);
    expect(authRateLimit.mock.calls[0]?.[0]).toMatchObject({
      scope: 'user',
      authUserId: USER_ID,
      actingPartyId: null,
    });
    expect(authRateLimit.mock.calls[1]?.[0]).toMatchObject({
      scope: 'user',
      authUserId: null,
      actingPartyId: null,
    });
  });

  it('maps digest and authentication-seam failures', async () => {
    const digest = vi
      .spyOn(crypto.subtle, 'digest')
      .mockRejectedValueOnce(new Error('crypto down'));
    const dependencies = createProductionContentSchemaRegistryDependencies(
      baseOptions({
        rateLimit: undefined,
        auth: {
          resolveSession: vi.fn(async () => ({
            ok: false as const,
            status: 401 as const,
            code: 'UNAUTHENTICATED',
            message: 'invalid',
          })),
          rateLimit: vi.fn(async () => ({
            ok: true as const,
            value: validDecision,
          })),
        },
      }),
    );
    await expect(
      dependencies.rateLimit(input(), new AbortController().signal),
    ).resolves.toMatchObject({
      ok: false,
      status: 503,
    });
    digest.mockRestore();
  });
});
