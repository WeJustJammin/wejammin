import { afterEach, describe, expect, it, vi } from 'vitest';

import { CHALLENGE_ID, PROVIDER_FACTOR_ID } from './mfa-test-support';
import {
  build,
  enrollInput,
  enrollPayload,
  json,
  request,
  signal,
} from './production-mfa-provider.test-support';

const verifyInput = {
  request,
  providerFactorId: PROVIDER_FACTOR_ID,
  providerChallengeId: CHALLENGE_ID,
  code: '123456',
};

const hangUntilAborted = () =>
  vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const abort = (): void =>
          reject(new DOMException('aborted', 'AbortError'));
        if (init.signal?.aborted === true) abort();
        else init.signal?.addEventListener('abort', abort);
      }),
  );

describe('Supabase MFA provider: transport branches', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats a provider body above the 128 KiB cap as an invalid response', async () => {
    const oversized = JSON.stringify({ pad: 'x'.repeat(128 * 1024 + 1) });
    const result = await build(
      vi.fn(async () => new Response(oversized, { status: 200 })),
    ).provider.verify(verifyInput, signal);
    expect(result).toMatchObject({ ok: false, status: 502 });
  });

  it('sleeps on the real timer between pre-effect retries when no sleep is injected', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json(enrollPayload));
    const { provider } = build(fetchImpl, { sleep: undefined });
    const pending = provider.enroll(enrollInput, signal);
    await vi.advanceTimersByTimeAsync(250);
    await expect(pending).resolves.toMatchObject({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('defaults the per-call deadline to five seconds when none is configured', async () => {
    vi.useFakeTimers();
    const hang = hangUntilAborted();
    const pending = build(hang, { timeoutMs: undefined }).provider.verify(
      verifyInput,
      signal,
    );
    await vi.advanceTimersByTimeAsync(4_999);
    expect(hang.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toMatchObject({ ok: false, status: 504 });
  });

  it('aborts the provider call when the caller signal is already aborted', async () => {
    const caller = new AbortController();
    caller.abort();
    const result = await build(hangUntilAborted()).provider.verify(
      verifyInput,
      caller.signal,
    );
    expect(result).toMatchObject({ ok: false, status: 504 });
  });

  it('relays a caller abort that arrives while the provider call is in flight', async () => {
    const caller = new AbortController();
    const hang = hangUntilAborted();
    const pending = build(hang).provider.verify(verifyInput, caller.signal);
    await vi.waitFor(() => expect(hang).toHaveBeenCalledTimes(1));
    caller.abort();
    await expect(pending).resolves.toMatchObject({ ok: false, status: 504 });
  });

  it('answers 503 for a transport failure that is not an abort', async () => {
    const result = await build(
      vi.fn(async () => {
        throw new TypeError('network down');
      }),
    ).provider.verify(verifyInput, signal);
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('classifies a failure whose body is not a JSON object by status alone', async () => {
    const result = await build(
      vi.fn(async () => new Response('upstream exploded', { status: 500 })),
    ).provider.verify(verifyInput, signal);
    expect(result).toMatchObject({ ok: false, status: 503 });
  });

  it('returns the classified failure when creating a challenge fails', async () => {
    const result = await build(
      vi.fn(async () => json({ error_code: 'insufficient_aal' }, 401)),
    ).provider.challenge(
      { request, providerFactorId: PROVIDER_FACTOR_ID },
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 401 });
  });
});
