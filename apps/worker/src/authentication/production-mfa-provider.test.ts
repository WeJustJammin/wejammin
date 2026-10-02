import { describe, expect, it, vi } from 'vitest';

import {
  ACCESS_TOKEN,
  CHALLENGE_ID,
  MANUAL_KEY,
  NOW,
  OTPAUTH_URI,
  PROVIDER_CHALLENGE_ID,
  PROVIDER_FACTOR_ID,
  REFRESH_TOKEN,
} from './mfa-test-support';
import {
  build,
  enrollInput,
  enrollPayload,
  json,
  request,
  signal,
} from './production-mfa-provider.test-support';

describe('Supabase MFA provider: enroll', () => {
  it('posts the factor with the caller token and returns the one-time secret only', async () => {
    const fetchImpl = vi.fn(async () => json(enrollPayload, 200));
    const { provider } = build(fetchImpl);
    const result = await provider.enroll(enrollInput, signal);
    expect(result).toEqual({
      ok: true,
      value: {
        providerFactorId: PROVIDER_FACTOR_ID,
        otpauthUri: OTPAUTH_URI,
        manualEntryKey: MANUAL_KEY,
      },
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('https://staging.example.supabase.co/auth/v1/factors');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      factor_type: 'totp',
      friendly_name: 'Phone authenticator',
      issuer: 'WeJammin (staging)',
    });
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(headers.get('apikey')).toBe('sb_secret_test_only');
    expect(JSON.stringify(result)).not.toContain('qr_code');
  });

  it('uppercases and strips padding from the base32 secret', async () => {
    const fetchImpl = vi.fn(async () =>
      json({
        ...enrollPayload,
        totp: {
          ...enrollPayload.totp,
          secret: `${MANUAL_KEY.toLowerCase()}====`,
        },
      }),
    );
    const result = await build(fetchImpl).provider.enroll(enrollInput, signal);
    expect(result).toMatchObject({
      ok: true,
      value: { manualEntryKey: MANUAL_KEY },
    });
  });

  it.each([
    ['non-uuid id', { ...enrollPayload, id: 'not-a-uuid' }],
    ['missing totp', { id: PROVIDER_FACTOR_ID }],
    [
      'short secret',
      { ...enrollPayload, totp: { ...enrollPayload.totp, secret: 'AAAA' } },
    ],
    [
      'non-otpauth uri',
      {
        ...enrollPayload,
        totp: { ...enrollPayload.totp, uri: 'https://x.example' },
      },
    ],
  ] as const)('answers 502 for %s', async (_name, payload) => {
    const result = await build(
      vi.fn(async () => json(payload)),
    ).provider.enroll(enrollInput, signal);
    expect(result).toMatchObject({ ok: false, status: 502 });
  });

  it('answers 401 reauthenticate without calling Supabase when the access cookie is missing', async () => {
    const fetchImpl = vi.fn();
    const result = await build(fetchImpl).provider.enroll(
      {
        request: new Request('https://api.example.test/x', { method: 'POST' }),
        friendlyName: 'x',
      },
      signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 401,
      details: { recoveryAction: 'reauthenticate' },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps a rejected caller token to 401 and a provider 5xx to 503', async () => {
    expect(
      await build(
        vi.fn(async () => json({ error_code: 'bad_jwt' }, 401)),
      ).provider.enroll(enrollInput, signal),
    ).toMatchObject({ ok: false, status: 401, code: 'UNAUTHENTICATED' });
    expect(
      await build(vi.fn(async () => json({}, 500))).provider.enroll(
        enrollInput,
        signal,
      ),
    ).toMatchObject({ ok: false, status: 503 });
  });

  it('retries pre-effect 503s after 250 ms then 750 ms and then gives up', async () => {
    const fetchImpl = vi.fn(async () => json({}, 503));
    const { provider, sleep } = build(fetchImpl);
    const result = await provider.enroll(enrollInput, signal);
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[250], [750]]);
  });

  it('succeeds when a retry recovers', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json(enrollPayload));
    const result = await build(fetchImpl).provider.enroll(enrollInput, signal);
    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('Supabase MFA provider: unenroll, challenge, verify', () => {
  it('deletes the factor and treats an absent factor as removed', async () => {
    const fetchImpl = vi.fn(async () => json({ id: PROVIDER_FACTOR_ID }));
    const { provider } = build(fetchImpl);
    expect(
      await provider.unenroll(
        { request, providerFactorId: PROVIDER_FACTOR_ID },
        signal,
      ),
    ).toEqual({ ok: true, value: null });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      `https://staging.example.supabase.co/auth/v1/factors/${PROVIDER_FACTOR_ID}`,
    );
    expect(init.method).toBe('DELETE');
    const gone = build(vi.fn(async () => json({}, 404)));
    expect(
      await gone.provider.unenroll(
        { request, providerFactorId: PROVIDER_FACTOR_ID },
        signal,
      ),
    ).toEqual({ ok: true, value: null });
  });

  it('never retries an unenroll after a failure', async () => {
    const fetchImpl = vi.fn(async () => json({}, 503));
    const { provider, sleep } = build(fetchImpl);
    const result = await provider.unenroll(
      { request, providerFactorId: PROVIDER_FACTOR_ID },
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('maps insufficient_aal on unenroll to the 401 step-up body', async () => {
    const result = await build(
      vi.fn(async () => json({ error_code: 'insufficient_aal' }, 403)),
    ).provider.unenroll(
      { request, providerFactorId: PROVIDER_FACTOR_ID },
      signal,
    );
    expect(result).toEqual({
      ok: false,
      status: 401,
      code: 'STEP_UP_REQUIRED',
      message: 'Recent verification is required.',
      details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
    });
  });

  it('creates a challenge and converts the unix expiry to ISO', async () => {
    const expires = Math.floor(NOW / 1000) + 300;
    const fetchImpl = vi.fn(async () =>
      json({ id: PROVIDER_CHALLENGE_ID, expires_at: expires }),
    );
    const result = await build(fetchImpl).provider.challenge(
      { request, providerFactorId: PROVIDER_FACTOR_ID },
      signal,
    );
    expect(result).toEqual({
      ok: true,
      value: {
        providerChallengeId: PROVIDER_CHALLENGE_ID,
        expiresAt: new Date(expires * 1000).toISOString(),
      },
    });
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(
      `https://staging.example.supabase.co/auth/v1/factors/${PROVIDER_FACTOR_ID}/challenge`,
    );
  });

  it('answers 502 for an invalid challenge payload', async () => {
    const result = await build(
      vi.fn(async () => json({ id: 'x' })),
    ).provider.challenge(
      { request, providerFactorId: PROVIDER_FACTOR_ID },
      signal,
    );
    expect(result).toMatchObject({ ok: false, status: 502 });
  });

  const verifyInput = {
    request,
    providerFactorId: PROVIDER_FACTOR_ID,
    providerChallengeId: CHALLENGE_ID,
    code: '123456',
  };

  it('verifies the code and returns the raw provider session without retrying', async () => {
    const session = { access_token: 'a.b.c', refresh_token: 'r' };
    const fetchImpl = vi.fn(async () => json(session));
    const result = await build(fetchImpl).provider.verify(verifyInput, signal);
    expect(result).toEqual({ ok: true, value: session });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      `https://staging.example.supabase.co/auth/v1/factors/${PROVIDER_FACTOR_ID}/verify`,
    );
    expect(JSON.parse(String(init.body))).toEqual({
      challenge_id: CHALLENGE_ID,
      code: '123456',
    });
  });

  it.each([
    [400, 'mfa_verification_failed'],
    [422, 'mfa_verification_rejected'],
  ] as const)(
    'maps a wrong code (%i %s) to 422 code_incorrect',
    async (status, error_code) => {
      const result = await build(
        vi.fn(async () => json({ error_code }, status)),
      ).provider.verify(verifyInput, signal);
      expect(result).toMatchObject({
        ok: false,
        status: 422,
        code: 'VALIDATION_FAILED',
        details: { violations: [{ path: '/code', code: 'code_incorrect' }] },
      });
    },
  );

  it('maps a provider rate refusal to 429 with the provider delay or 900 s', async () => {
    const delayed = await build(
      vi.fn(async () => json({}, 429, { 'retry-after': '120' })),
    ).provider.verify(verifyInput, signal);
    expect(delayed).toMatchObject({
      ok: false,
      status: 429,
      retryAfterSeconds: 120,
    });
    const defaulted = await build(
      vi.fn(async () => json({}, 429)),
    ).provider.verify(verifyInput, signal);
    expect(defaulted).toMatchObject({
      ok: false,
      status: 429,
      retryAfterSeconds: 900,
    });
  });

  it('maps an expired provider challenge to a 409 new_challenge conflict', async () => {
    const result = await build(
      vi.fn(async () => json({ error_code: 'mfa_challenge_expired' }, 422)),
    ).provider.verify(verifyInput, signal);
    expect(result).toMatchObject({
      ok: false,
      status: 409,
      details: {
        reasonCode: 'challenge_expired',
        recoveryAction: 'new_challenge',
      },
    });
  });

  it('answers 502 for a non-JSON 2xx and 504 for a timeout', async () => {
    expect(
      await build(
        vi.fn(async () => new Response('<html>', { status: 200 })),
      ).provider.verify(verifyInput, signal),
    ).toMatchObject({ ok: false, status: 502 });
    const hang = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    expect(
      await build(hang, { timeoutMs: 20 }).provider.verify(verifyInput, signal),
    ).toMatchObject({ ok: false, status: 504 });
  });

  it('never places the caller token, refresh token or code in a failure result', async () => {
    const result = await build(
      vi.fn(async () =>
        json({ msg: `${ACCESS_TOKEN} ${REFRESH_TOKEN} 123456` }, 400),
      ),
    ).provider.verify(verifyInput, signal);
    const text = JSON.stringify(result);
    for (const secret of [
      ACCESS_TOKEN,
      REFRESH_TOKEN,
      '123456',
      'sb_secret_test_only',
    ])
      expect(text).not.toContain(secret);
  });
});
