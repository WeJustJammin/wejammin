import { ApiErrorSchema } from '@wejammin/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createRequest,
  fetchFailing,
  sessionSeam,
  wiredApp,
} from '../../apps/worker/src/cms-editorial-production-app.test-support';
import {
  REQUEST_ID,
  json,
} from '../../apps/worker/src/cms-editorial-production.test-support';
import { created } from './support/ev-eb-worker-create-support';

/**
 * Evidence lane EB (AC-065): the rate, dependency and deadline failures of CMS-03B-10 are each a complete BE00
 * ApiError (code, safe message, request id, details) with the recovery the client needs, and none of them reaches
 * the database. The production route composition runs; only the PostgREST fetch and the session/rate seams are faked.
 */

afterEach(() => {
  vi.useRealTimers();
});

const apiError = async (response: Response) => {
  const parsed = ApiErrorSchema.safeParse(await response.clone().json());
  expect(parsed.success, 'the body is a BE00 ApiError').toBe(true);
  return parsed.success ? parsed.data : null;
};

describe('EB create limits: rate, dependency and deadline are BE00 ApiErrors with safe recovery', () => {
  it('EB create rate limit: a denied decision is 429 RATE_LIMITED with Retry-After, a complete ApiError and no RPC', async () => {
    const fetchImpl = fetchFailing(() => json(created));
    const app = wiredApp(fetchImpl, {
      rateLimit: async (input: { limit: number }) => ({
        ok: true as const,
        value: {
          allowed: false,
          limit: input.limit,
          remaining: 0,
          resetAt: Date.now() + 30_000,
        },
      }),
    });
    const response = await createRequest(app);
    expect(response.status).toBe(429);
    const error = await apiError(response);
    expect(error?.code).toBe('RATE_LIMITED');
    expect(error?.requestId).toBe(REQUEST_ID);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(error?.message.length).toBeGreaterThan(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('EB create rate limit: the user bucket is asked for 120 per minute and the party bucket for 240, each denial stops the create', async () => {
    const asked: number[] = [];
    const fetchImpl = fetchFailing(() => json(created));
    const app = wiredApp(fetchImpl, {
      rateLimit: async (input: { limit: number }) => {
        asked.push(input.limit);
        return {
          ok: true as const,
          value: {
            allowed: input.limit !== 240,
            limit: input.limit,
            remaining: 0,
            resetAt: Date.now() + 10_000,
          },
        };
      },
    });
    const response = await createRequest(app);
    expect(response.status).toBe(429);
    expect(asked.sort((a, b) => a - b)).toEqual([120, 240]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('EB create dependency: an unavailable rate limiter fails closed as 503 DEPENDENCY_UNAVAILABLE, a complete ApiError, and never reaches the RPC', async () => {
    const fetchImpl = fetchFailing(() => json(created));
    const app = wiredApp(fetchImpl, {
      rateLimit: async () => ({
        ok: false as const,
        status: 503 as const,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Limiter down.',
      }),
    });
    const response = await createRequest(app);
    expect(response.status).toBe(503);
    const error = await apiError(response);
    expect(error?.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(error?.requestId).toBe(REQUEST_ID);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('EB create dependency: an unavailable session service fails closed with a complete ApiError and never reaches the RPC', async () => {
    const fetchImpl = fetchFailing(() => json(created));
    const app = wiredApp(fetchImpl, {
      resolveSession: async () => ({
        ok: false as const,
        status: 503 as const,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Session store down.',
      }),
    });
    const response = await createRequest(app);
    expect(response.status).toBe(503);
    expect((await apiError(response))?.code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('EB create deadline: a database that never answers ends the create at the 15 s route budget as 504 GATEWAY_TIMEOUT, a complete ApiError, and aborts the in-flight call', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'],
    });
    let upstream: AbortSignal | undefined;
    const fetchImpl = vi.fn((_url: unknown, init?: RequestInit) => {
      upstream = init?.signal as AbortSignal;
      return new Promise<Response>(() => undefined);
    });
    const app = wiredApp(fetchImpl as unknown as typeof fetch, {
      resolveSession: sessionSeam,
    });
    let settled: Response | null = null;
    void Promise.resolve(createRequest(app)).then((response) => {
      settled = response;
    });
    await vi.advanceTimersByTimeAsync(14_000);
    expect(settled).toBeNull();
    await vi.advanceTimersByTimeAsync(1_500);
    expect(settled).not.toBeNull();
    const response = settled as unknown as Response;
    expect(response.status).toBe(504);
    const error = await apiError(response);
    expect(error?.code).toBe('GATEWAY_TIMEOUT');
    expect(error?.requestId).toBe(REQUEST_ID);
    expect(upstream?.aborted).toBe(true);
  });

  it('EB create deadline: a slow session leaves only the remaining budget to the database call (one cumulative 15 s clock)', async () => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'],
    });
    const fetchImpl = vi.fn(() => new Promise<Response>(() => undefined));
    const app = wiredApp(fetchImpl as unknown as typeof fetch, {
      resolveSession: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        return sessionSeam();
      },
    });
    let status: number | null = null;
    void Promise.resolve(createRequest(app)).then((response) => {
      status = response.status;
    });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(status).toBeNull();
    await vi.advanceTimersByTimeAsync(5_500);
    expect(status).toBe(504);
  });
});
