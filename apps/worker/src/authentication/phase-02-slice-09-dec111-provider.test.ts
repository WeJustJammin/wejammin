import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ACCESS_TOKEN,
  CHALLENGE_ID,
  PROVIDER_CHALLENGE_ID,
  PROVIDER_FACTOR_ID,
  REFRESH_TOKEN,
} from './mfa-test-support';
import { createSupabaseMfaProvider } from './production-mfa-provider';
import { normalizeAuthProductionOptions } from './production-support';
import {
  build,
  enrollInput,
  environment,
  enrollPayload,
  json,
  request,
  signal,
} from './production-mfa-provider.test-support';

/**
 * BE01a "MFA provider seams" (DEC-111): the Supabase Auth MFA adapter, its
 * per-call deadline, retry policy and breaker, exercised through the real
 * production adapter with only the Supabase Auth HTTP endpoint faked.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const base = { request, providerFactorId: PROVIDER_FACTOR_ID };
const verifyInput = {
  ...base,
  providerChallengeId: CHALLENGE_ID,
  code: '123456',
};

type Operation = Readonly<{
  name: string;
  run: (provider: ReturnType<typeof build>['provider']) => Promise<unknown>;
}>;

const OPERATIONS: readonly Operation[] = [
  { name: 'enroll', run: (p) => p.enroll(enrollInput, signal) },
  { name: 'challenge', run: (p) => p.challenge(base, signal) },
  { name: 'verify', run: (p) => p.verify(verifyInput, signal) },
  { name: 'unenroll', run: (p) => p.unenroll(base, signal) },
];

const okFor = (name: string): Response =>
  json(
    name === 'enroll'
      ? enrollPayload
      : name === 'challenge'
        ? { id: PROVIDER_CHALLENGE_ID, expires_at: 2_000_000_000 }
        : { id: PROVIDER_FACTOR_ID, access_token: 'a', refresh_token: 'r' },
  );

/** The production adapter with its own default deadline, not the test override. */
const buildDefault = (fetchImpl: ReturnType<typeof vi.fn>) =>
  createSupabaseMfaProvider(
    normalizeAuthProductionOptions({
      environment,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => Date.parse('2026-10-02T14:00:00Z'),
    }),
    { issuer: 'WeJammin (staging)' },
  );

describe('Supabase MFA provider seam', () => {
  it.each(OPERATIONS)(
    '[P2-S09-AC-912] $name uses the caller access token from the request, the 5,000 ms per-call deadline and puts no token or code in a failure result',
    async ({ name, run }) => {
      const delays: number[] = [];
      const original = globalThis.setTimeout;
      vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
        callback: () => void,
        delay?: number,
        ...rest: unknown[]
      ) => {
        delays.push(Number(delay));
        return (original as (...args: unknown[]) => unknown)(
          callback,
          delay,
          ...rest,
        );
      }) as unknown as typeof setTimeout);
      const fetchImpl = vi.fn(async () => okFor(name));
      const provider = buildDefault(fetchImpl);
      await run(provider);
      expect(delays).toContain(5000);
      const init = (
        fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
      )[1];
      const headers = new Headers(init.headers);
      expect(headers.get('authorization')).toBe(`Bearer ${ACCESS_TOKEN}`);
      const failing = build(
        vi.fn(async () => json({ message: 'nope' }, 500)),
        { sleep: vi.fn(async () => undefined) },
      );
      const failed = JSON.stringify(await run(failing.provider));
      for (const secret of [ACCESS_TOKEN, REFRESH_TOKEN, '123456'])
        expect(failed).not.toContain(secret);
    },
  );

  it('[P2-S09-AC-912] aborts a call that outlives 5,000 ms', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const provider = buildDefault(fetchImpl);
    const pending = provider.verify(verifyInput, signal);
    await vi.advanceTimersByTimeAsync(4_999);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(await pending).toMatchObject({ ok: false, status: 504 });
    vi.useRealTimers();
  });

  it('[P2-S09-AC-913] enroll and challenge make two pre-effect retries after 250 ms and 750 ms', async () => {
    for (const name of ['enroll', 'challenge'] as const) {
      const fetchImpl = vi.fn(async () => json({}, 503));
      const { provider, sleep } = build(fetchImpl);
      const operation = OPERATIONS.find((entry) => entry.name === name);
      await operation?.run(provider);
      expect(fetchImpl).toHaveBeenCalledTimes(3);
      expect(sleep.mock.calls).toStrictEqual([[250], [750]]);
    }
  });

  it('[P2-S09-AC-913] verify and unenroll never retry after send, whether the provider answers 5xx, a malformed 2xx or times out', async () => {
    for (const name of ['verify', 'unenroll'] as const) {
      const operation = OPERATIONS.find((entry) => entry.name === name);
      for (const reply of [
        () => Promise.resolve(json({}, 500)),
        () => Promise.resolve(json({}, 503)),
        () => Promise.resolve(new Response('not json', { status: 200 })),
        () => Promise.reject(new DOMException('aborted', 'AbortError')),
      ]) {
        const fetchImpl = vi.fn(reply);
        const { provider, sleep } = build(fetchImpl);
        const result = (await operation?.run(provider)) as { ok: boolean };
        expect(result.ok).toBe(false);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(sleep).not.toHaveBeenCalled();
      }
    }
  });

  it('[P2-S09-AC-914] five failures in 60 s open the breaker for 60 s: 503 DEPENDENCY_UNAVAILABLE without calling Supabase, then recovery after the window, across all four operations', async () => {
    const fetchImpl = vi.fn(async () => json({}, 500));
    const clock = { now: Date.parse('2026-10-02T14:00:00Z') };
    const { provider } = build(fetchImpl, {}, clock);
    for (const operation of OPERATIONS.slice(2))
      for (let index = 0; index < 3; index += 1) {
        if (fetchImpl.mock.calls.length >= 5) break;
        await operation.run(provider);
      }
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    for (const operation of OPERATIONS)
      expect(await operation.run(provider)).toMatchObject({
        ok: false,
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
      });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    clock.now += 59_000;
    await OPERATIONS[3]?.run(provider);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    clock.now += 2_000;
    await OPERATIONS[3]?.run(provider);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });
});
