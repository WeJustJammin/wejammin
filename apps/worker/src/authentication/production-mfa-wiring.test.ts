import { describe, expect, it, vi } from 'vitest';

import type { WorkerBindings } from '../index';
import { createProductionAuthenticationDependencies } from './production';
import {
  MANUAL_KEY,
  NOW,
  OTPAUTH_URI,
  PROVIDER_FACTOR_ID,
  env,
  iso,
  requestFor,
  sessionFor,
  verifiedRow,
} from './mfa-test-support';

const environment = (appEnvironment: 'production' | 'staging') =>
  ({
    APP_ENVIRONMENT: appEnvironment,
    APP_RELEASE: 'dec-111-test',
    SUPABASE_SECRET_KEY: 'sb_secret_test_only',
    SUPABASE_URL: 'https://staging.example.supabase.co',
  }) as WorkerBindings;

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const signal = new AbortController().signal;
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

describe('production MFA wiring', () => {
  it('exposes every DEC-111 method on the production dependencies', () => {
    const deps = createProductionAuthenticationDependencies({
      environment: environment('staging'),
      fetchImpl: vi.fn() as never,
      now: () => NOW,
    });
    for (const name of [
      'readMfaFactors',
      'startTotpEnrollment',
      'verifyTotpEnrollment',
      'removeMfaFactor',
      'createStepUpChallenge',
      'verifyStepUpChallenge',
    ] as const)
      expect(typeof deps[name]).toBe('function');
  });

  it('reads the registry through the protected RPC with a computed step-up state', async () => {
    const fetchImpl = vi.fn<Fetch>(async () =>
      json({ factors: [verifiedRow()], version: '3' }),
    );
    const deps = createProductionAuthenticationDependencies({
      environment: environment('staging'),
      fetchImpl: fetchImpl as never,
      now: () => NOW,
    });
    const result = await deps.readMfaFactors?.(
      {
        session: sessionFor({ stepUpAt: iso(-60) }),
        request: requestFor('GET'),
      },
      env,
      signal,
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        version: '3',
        allowedMethods: ['totp'],
        stepUp: { fresh: true, freshUntil: iso(540) },
      },
    });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      'https://staging.example.supabase.co/rest/v1/rpc/auth_mfa_factors_read',
    );
  });

  it.each([
    ['production', 'WeJammin'],
    ['staging', 'WeJammin (staging)'],
  ] as const)('uses the %s issuer label at enrollment', async (name, label) => {
    const fetchImpl = vi.fn<Fetch>(async (url) => {
      if (url.includes('/rpc/auth_mfa_factors_read'))
        return json({ factors: [], version: '3' });
      if (url.includes('/rpc/auth_mfa_enrollment_begin'))
        return json({ supersededProviderFactorId: null, version: '4' });
      if (url.includes('/auth/v1/factors'))
        return json({
          id: PROVIDER_FACTOR_ID,
          totp: { secret: MANUAL_KEY, uri: OTPAUTH_URI },
        });
      return json({
        factorId: '55555555-5555-4555-8555-555555555555',
        expiresAt: iso(600),
        version: '5',
      });
    });
    const deps = createProductionAuthenticationDependencies({
      environment: environment(name),
      fetchImpl: fetchImpl as never,
      now: () => NOW,
    });
    const result = await deps.startTotpEnrollment?.(
      {
        session: sessionFor({ primaryAuthAt: iso(-30), stepUpAt: null }),
        request: requestFor(),
        friendlyName: 'Phone',
        ifMatch: '"3"',
      },
      env,
      signal,
    );
    expect(result).toMatchObject({ ok: true });
    const enroll = fetchImpl.mock.calls.find(([url]) =>
      String(url).includes('/auth/v1/factors'),
    );
    expect(JSON.parse(String((enroll?.[1] as RequestInit).body))).toMatchObject(
      {
        issuer: label,
        friendly_name: 'Phone',
      },
    );
  });
});
