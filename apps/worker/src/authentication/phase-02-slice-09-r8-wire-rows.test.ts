import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOW,
  PROVIDER_FACTOR_ID,
  createWorld,
  expectApiError,
  factorRow,
  json,
  mintJar,
  providerCalls,
  rpcNames,
  send,
} from './dec111-composition.test-support';
import { BASE } from './dec111-wire-scenarios.test-support';

/**
 * R8 security remediation, CSRF/origin reasonCode and the AUTH-API-16 no-leak projection.
 * Each scenario runs through the real production composition (real routes,
 * session verifier, MFA service, persistence adapter and Supabase MFA
 * provider); only the PostgREST and Supabase Auth HTTP endpoints are faked.
 */

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('403 for a CSRF or origin failure carries the one registered reasonCode', () => {
  const MUTATING = [17, 18, 19, 20, 21] as const;

  it.each(MUTATING)(
    '[P2-S09-AC-1095] AUTH-API-%i answers 403 FORBIDDEN with exactly reasonCode origin_csrf_required for a forged CSRF token',
    async (operation) => {
      const world = createWorld();
      const jar = await mintJar();
      const response = await send(world.app, {
        ...BASE[operation],
        jar: { ...jar, csrf: 'forged-token' },
      });
      await expectApiError(response, {
        status: 403,
        code: 'FORBIDDEN',
        shape: { exact: { reasonCode: 'origin_csrf_required' } },
      });
    },
  );

  it.each(MUTATING)(
    '[P2-S09-AC-1095] AUTH-API-%i answers 403 FORBIDDEN with exactly reasonCode origin_csrf_required for a foreign origin',
    async (operation) => {
      const world = createWorld();
      const response = await send(world.app, {
        ...BASE[operation],
        jar: await mintJar(),
        headers: { ...BASE[operation].headers, origin: 'https://evil.example' },
      });
      await expectApiError(response, {
        status: 403,
        code: 'FORBIDDEN',
        shape: { exact: { reasonCode: 'origin_csrf_required' } },
      });
    },
  );

  it.each(MUTATING)(
    '[P2-S09-AC-1095] AUTH-API-%i reaches no persistence or provider call for a CSRF or origin failure',
    async (operation) => {
      const world = createWorld();
      const jar = await mintJar();
      await send(world.app, {
        ...BASE[operation],
        jar: { ...jar, csrf: 'forged-token' },
      });
      expect(providerCalls(world.calls)).toStrictEqual([]);
      expect(
        rpcNames(world.calls).filter(
          (name) => !['auth_session_read', 'auth_rate_limit'].includes(name),
        ),
      ).toStrictEqual([]);
    },
  );
});

describe('AUTH-API-16 refuses to relay any secret-bearing field a registry row carries', () => {
  const LEAKS = [
    ['a TOTP secret', 'totpSecret', 'JBSWY3DPEHPK3PXPJBSWY3DPEH'],
    ['an otpauth URI', 'otpauthUri', 'otpauth://totp/WeJammin:rob?secret=ABC'],
    ['a provider factor id', 'providerFactorId', PROVIDER_FACTOR_ID],
    ['a challenge id', 'challengeId', '77777777-7777-4777-8777-777777777777'],
    ['an access token', 'accessToken', 'caller-access-token-secret'],
    ['a client address', 'ip', '203.0.113.9'],
    ['another user data field', 'email', 'someone.else@example.test'],
  ] as const;

  it.each(LEAKS)(
    '[P2-S09-AC-722] a registry row that carries %s is refused with 502 and the value never reaches the response',
    async (_label, key, value) => {
      const world = createWorld({
        handlers: {
          auth_mfa_factors_read: () =>
            json({ factors: [factorRow({ [key]: value })], version: '3' }),
        },
      });
      const response = await send(world.app, {
        ...BASE[16],
        jar: await mintJar(),
      });
      expect(response.status).toBe(502);
      const text = await response.text();
      expect(text).not.toContain(value);
      expect(text).not.toContain(key);
    },
  );

  it('[P2-S09-AC-722] the read makes no provider call even though the session verifier asks the provider who the caller is', async () => {
    const world = createWorld();
    await send(world.app, { ...BASE[16], jar: await mintJar() });
    expect(providerCalls(world.calls)).toStrictEqual([]);
    expect(
      world.calls.filter((call) => call.path === '/auth/v1/user'),
    ).toHaveLength(1);
  });
});
