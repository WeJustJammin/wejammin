import { describe, expect, it, vi } from 'vitest';

import { CHALLENGE_ID, NOW, PROVIDER_FACTOR_ID } from './mfa-test-support';
import {
  build,
  json,
  request,
  signal,
} from './production-mfa-provider.test-support';

describe('Supabase MFA provider: circuit breaker', () => {
  it('opens after five failures in 60 s, refuses without calling Supabase, then recovers', async () => {
    const fetchImpl = vi.fn(async () => json({}, 500));
    const clock = { now: NOW };
    const { provider } = build(fetchImpl, {}, clock);
    const unenroll = () =>
      provider.unenroll(
        { request, providerFactorId: PROVIDER_FACTOR_ID },
        signal,
      );
    for (let attempt = 0; attempt < 5; attempt += 1) await unenroll();
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(await unenroll()).toMatchObject({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    clock.now += 61_000;
    await unenroll();
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it('does not count wrong codes or rate refusals as provider failures', async () => {
    const fetchImpl = vi.fn(async () =>
      json({ error_code: 'mfa_verification_failed' }, 400),
    );
    const { provider } = build(fetchImpl);
    for (let attempt = 0; attempt < 8; attempt += 1)
      await provider.verify(
        {
          request,
          providerFactorId: PROVIDER_FACTOR_ID,
          providerChallengeId: CHALLENGE_ID,
          code: '000000',
        },
        signal,
      );
    expect(fetchImpl).toHaveBeenCalledTimes(8);
  });
});
