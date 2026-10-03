import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTH_USER_ID,
  NEW_SESSION_ID,
  NOW,
  PERSON_ID,
  PROVIDER_CHALLENGE_ID,
  PROVIDER_FACTOR_ID,
  createWorld,
  iso,
  json,
  mintJar,
  send,
  setCookies,
  type Handler,
} from './dec111-composition.test-support';
import { BASE, P_CHALLENGE } from './dec111-wire-scenarios.test-support';

/**
 * DEC-111 proof properties through the production Worker composition: the
 * first-party step-up response, the factor-selection rule, the freshness
 * window and the absence of any recovery bypass.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const OTHER_PARTY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORGANIZATION = '88888888-8888-4888-8888-888888888889';

const withActing = (actingPartyId: string): Record<string, Handler> => ({
  auth_session_read: () =>
    json({
      accountState: 'active',
      bootstrapState: 'complete',
      personId: PERSON_ID,
      actingPartyId,
      actingContextId: ORGANIZATION,
    }),
});

describe('step-up always verifies the signed-in human', () => {
  it('[P2-S09-AC-888] the acting party, organization, alias or mandate context never selects or relaxes the factor: the challenge and verify RPCs carry only the Auth UUID and exact session', async () => {
    const seen: Record<string, unknown>[] = [];
    for (const actingPartyId of [PERSON_ID, OTHER_PARTY]) {
      const world = createWorld({ handlers: withActing(actingPartyId) });
      const jar = await mintJar();
      const challenge = await send(world.app, { ...BASE[20], jar });
      expect(challenge.status).toBe(201);
      const verify = await send(world.app, { ...BASE[21], jar });
      expect(verify.status).toBe(200);
      for (const call of world.calls.filter((entry) =>
        entry.rpc?.startsWith('auth_step_up_challenge'),
      )) {
        const body = call.body ?? {};
        expect(body.p_auth_user_id).toBe(AUTH_USER_ID);
        const text = JSON.stringify(body);
        for (const foreign of [OTHER_PARTY, ORGANIZATION])
          expect(text).not.toContain(foreign);
        for (const key of Object.keys(body))
          expect(key).not.toMatch(
            /party|organi[sz]ation|alias|mandate|context/iu,
          );
        seen.push({ rpc: call.rpc, keys: Object.keys(body).sort() });
      }
    }
    const half = seen.length / 2;
    expect(seen.slice(0, half)).toStrictEqual(seen.slice(half));
  });
});

describe('first-party step-up response', () => {
  it('[P2-S09-AC-882] carries only stepUpAt and freshUntil and rotates the CSRF token with the session reference, never exposing tokens, provider ids, factor ids or amr', async () => {
    const world = createWorld();
    const jar = await mintJar();
    const response = await send(world.app, { ...BASE[21], jar });
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(Object.keys(JSON.parse(text) as object).sort()).toStrictEqual([
      'freshUntil',
      'method',
      'stepUpAt',
      'verified',
    ]);
    for (const secret of [
      'access_token',
      'refresh_token',
      'amr',
      PROVIDER_FACTOR_ID,
      PROVIDER_CHALLENGE_ID,
      NEW_SESSION_ID,
      'caller-refresh-token-secret',
    ])
      expect(text).not.toContain(secret);
    const csrf = setCookies(response).find(
      (cookie) => cookie.name === 'wj_csrf',
    );
    expect(csrf).toBeDefined();
    expect(csrf?.value).not.toBe(jar.csrf);
    expect(csrf?.value).toMatch(/^[\w-]+\.[0-9a-f]{64}$/u);
  });

  it('[P2-S09-AC-882] the enrollment verify response is the factor resource and also carries no token, provider session id or amr', async () => {
    const world = createWorld();
    const response = await send(world.app, {
      ...BASE[18],
      jar: await mintJar(),
    });
    expect(response.status).toBe(200);
    const text = await response.text();
    for (const secret of [
      'access_token',
      'refresh_token',
      'amr',
      NEW_SESSION_ID,
    ])
      expect(text).not.toContain(secret);
    expect(
      setCookies(response).find((cookie) => cookie.name === 'wj_csrf')?.value,
    ).not.toBe((await mintJar()).csrf);
  });
});

describe('freshness window and recovery', () => {
  it('[P2-S09-AC-886] no header, query value or body field selects a different freshness window: a 601-second-old proof is refused', async () => {
    const world = createWorld();
    const jar = await mintJar({ stepUpAt: iso(-601) });
    const selectors = {
      'x-step-up-freshness-seconds': '3600',
      'x-freshness': '3600',
    };
    const response = await send(world.app, {
      ...BASE[19],
      jar,
      path: `${BASE[19].path}?freshnessSeconds=3600&maxAgeSeconds=3600`,
      headers: { ...BASE[19].headers, ...selectors },
    });
    expect(response.status).toBe(401);
    expect(((await response.json()) as { code: string }).code).toBe(
      'STEP_UP_REQUIRED',
    );
    const smuggled = await send(world.app, {
      ...BASE[19],
      jar,
      body: { reason: 'user_request', freshnessSeconds: 3600 },
    });
    expect(smuggled.status).toBe(422);
    expect(((await smuggled.json()) as { code: string }).code).toBe(
      'VALIDATION_FAILED',
    );
    const clean = await send(world.app, {
      ...BASE[19],
      jar,
      headers: { ...BASE[19].headers },
    });
    expect(clean.status).toBe(401);
    expect(((await clean.json()) as { code: string }).code).toBe(
      'STEP_UP_REQUIRED',
    );
    expect(
      world.calls.some((call) => call.rpc === 'auth_mfa_removal_begin'),
    ).toBe(false);
  });

  it('[P2-S09-AC-890] no recovery-code, support-bypass or self-service factor-reset operation exists in the production Worker', async () => {
    const world = createWorld();
    const jar = await mintJar();
    for (const [method, path] of [
      ['GET', '/api/v1/account/mfa/recovery-codes'],
      ['POST', '/api/v1/account/mfa/recovery-codes'],
      ['POST', '/api/v1/auth/mfa/recovery'],
      ['POST', '/api/v1/auth/step-up/bypass'],
      ['POST', '/api/v1/account/mfa/factors/reset'],
      ['POST', '/api/v1/support/mfa-factor-resets'],
      ['POST', '/api/v1/admin/mfa-factor-resets'],
    ] as const) {
      const response = await send(world.app, {
        method,
        path,
        body: {},
        jar,
        headers: { 'idempotency-key': 'idem-key-0123456789' },
      });
      // An unregistered operation is the Worker's one 404 NOT_FOUND, never a
      // 405 and never a session or provider interaction.
      expect(response.status, `${method} ${path}`).toBe(404);
      expect(((await response.json()) as { code: string }).code).toBe(
        'NOT_FOUND',
      );
    }
    expect(world.calls.some((call) => call.rpc?.includes('reset'))).toBe(false);
  });
});

describe('open MFA circuit', () => {
  it('[P2-S09-AC-914] five provider failures open the circuit for 60 s: 503 DEPENDENCY_UNAVAILABLE, no cookie, no verified or consumed state, and a working challenge after recovery', async () => {
    const world = createWorld({
      handlers: {
        [P_CHALLENGE]: () => new Response('{}', { status: 500 }),
      },
    });
    const jar = await mintJar();
    for (let index = 0; index < 5; index += 1)
      await send(world.app, { ...BASE[20], jar });
    const before = world.calls.length;
    for (const op of [18, 20, 21] as const) {
      const response = await send(world.app, { ...BASE[op], jar });
      expect(response.status).toBe(503);
      expect(((await response.json()) as { code: string }).code).toBe(
        'DEPENDENCY_UNAVAILABLE',
      );
      expect(setCookies(response)).toHaveLength(0);
    }
    const names = world.calls.slice(before).map((call) => call.rpc);
    for (const settle of [
      'auth_step_up_challenge_verify_settle',
      'auth_mfa_enrollment_verify_settle',
      'auth_step_up_challenge_finish',
    ])
      expect(names).not.toContain(settle);
    expect(
      world.calls
        .slice(before)
        .filter((call) => call.rpc === null && call.path !== '/auth/v1/user'),
    ).toHaveLength(0);
    vi.setSystemTime(NOW + 61_000);
    await send(world.app, {
      ...BASE[20],
      jar: await mintJar(),
    });
    expect(
      world.calls
        .slice(before)
        .some((call) => call.path.endsWith('/challenge')),
    ).toBe(true);
  });
});
