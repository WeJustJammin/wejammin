import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MANUAL_KEY,
  NOW,
  OTHER_FACTOR_ID,
  OTPAUTH_URI,
  PROVIDER_FACTOR_ID,
  bodyOf,
  collapseDeadline,
  createWorld,
  hangUntilAborted,
  iso,
  json,
  mintJar,
  primaryAuthAmr,
  providerCalls,
  rpcNames,
  rpcRefusal,
  send,
} from './dec111-composition.test-support';
import { BASE, P_DELETE, P_ENROLL } from './dec111-wire-scenarios.test-support';

/**
 * AUTH-API-17 behaviour through the production Worker
 * composition (real routes, MFA service, persistence adapter and Supabase MFA
 * provider; only the PostgREST and Supabase Auth HTTP endpoints are faked).
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('AUTH-API-17 TOTP enrollment start (production composition)', () => {
  it('[P2-S09-AC-732][P2-S09-AC-742] returns 201 with exactly the TotpEnrollmentStart and the post-transaction MFA version as ETag', async () => {
    const world = createWorld();
    const response = await send(world.app, {
      ...BASE[17],
      jar: await mintJar(),
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"5"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await bodyOf(response);
    expect(Object.keys(body).sort()).toStrictEqual([
      'expiresAt',
      'factorId',
      'friendlyName',
      'manualEntryKey',
      'method',
      'otpauthUri',
      'version',
    ]);
    expect(body.version).toBe('5');
    expect(body.method).toBe('totp');
    expect(body.otpauthUri).toBe(OTPAUTH_URI);
    expect(body.manualEntryKey).toBe(MANUAL_KEY);
  });

  it('[P2-S09-AC-733] accepts a strict object containing only method and friendlyName', async () => {
    const jar = await mintJar();
    for (const extra of [
      { method: 'totp', friendlyName: 'Phone', secret: 'x' },
      { method: 'totp', friendlyName: 'Phone', factorId: OTHER_FACTOR_ID },
      { method: 'totp' },
      { friendlyName: 'Phone' },
    ]) {
      const world = createWorld();
      const response = await send(world.app, { ...BASE[17], body: extra, jar });
      expect([400, 422]).toContain(response.status);
      expect(rpcNames(world.calls)).not.toContain('auth_mfa_enrollment_begin');
    }
  });

  it('[P2-S09-AC-734][P2-S09-AC-740] limits method to the enabled registry (totp) and reports 422 method_not_available', async () => {
    const world = createWorld();
    const response = await send(world.app, {
      ...BASE[17],
      body: { method: 'sms', friendlyName: 'Phone' },
      jar: await mintJar(),
    });
    expect(response.status).toBe(422);
    const body = await bodyOf(response);
    expect(body.details).toMatchObject({
      violations: [{ path: '/method', code: 'method_not_available' }],
    });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'only whitespace'],
    ['a'.repeat(81), '81 characters'],
    ['Pho\u0000ne', 'a control character'],
    ['Pho\nne', 'a newline'],
  ])(
    '[P2-S09-AC-735][P2-S09-AC-741] rejects friendlyName %j (%s) with 422 friendly_name_invalid',
    async (friendlyName) => {
      const world = createWorld();
      const response = await send(world.app, {
        ...BASE[17],
        body: { method: 'totp', friendlyName },
        jar: await mintJar(),
      });
      expect(response.status).toBe(422);
      expect((await bodyOf(response)).details).toMatchObject({
        violations: [{ path: '/friendlyName', code: 'friendly_name_invalid' }],
      });
    },
  );

  it('[P2-S09-AC-735] requires an NFC, trimmed name: surrounding whitespace is trimmed before persistence and the provider, a decomposed form is refused', async () => {
    const world = createWorld();
    const response = await send(world.app, {
      ...BASE[17],
      body: { method: 'totp', friendlyName: '  Caf\u00e9 phone  ' },
      jar: await mintJar(),
    });
    expect(response.status).toBe(201);
    const begin = world.calls.find(
      (call) => call.rpc === 'auth_mfa_enrollment_begin',
    );
    expect(begin?.body?.p_friendly_name).toBe('Caf\u00e9 phone');
    const enroll = world.calls.find((call) => call.path === '/auth/v1/factors');
    expect(enroll?.body?.friendly_name).toBe('Caf\u00e9 phone');
    const decomposed = await send(createWorld().app, {
      ...BASE[17],
      body: { method: 'totp', friendlyName: 'Cafe\u0301' },
      jar: await mintJar(),
    });
    expect(decomposed.status).toBe(422);
    const accepted = await send(createWorld().app, {
      ...BASE[17],
      body: { method: 'totp', friendlyName: 'a'.repeat(80) },
      jar: await mintJar(),
    });
    expect(accepted.status).toBe(201);
  });

  it('[P2-S09-AC-738] requires one strong quoted positive decimal If-Match, forwards it as the expected MFA version, and maps a stale tag to 409', async () => {
    const jar = await mintJar();
    for (const header of [null, '3', 'W/"3"', '"0"', '"03"', '*', '"3", "4"']) {
      const world = createWorld();
      const response = await send(world.app, {
        ...BASE[17],
        jar,
        headers: { 'if-match': header },
      });
      expect(response.status).toBe(400);
      expect((await bodyOf(response)).code).toBe('INVALID_REQUEST');
      expect(rpcNames(world.calls)).not.toContain('auth_mfa_enrollment_begin');
    }
    const ok = createWorld();
    await send(ok.app, { ...BASE[17], jar, headers: { 'if-match': '"7"' } });
    expect(
      ok.calls.find((call) => call.rpc === 'auth_mfa_enrollment_begin')?.body
        ?.p_expected_version,
    ).toBe('7');
    const stale = createWorld({
      handlers: {
        auth_mfa_enrollment_begin: () => rpcRefusal('VERSION_MISMATCH', 409),
      },
    });
    const response = await send(stale.app, { ...BASE[17], jar });
    expect(response.status).toBe(409);
    expect((await bodyOf(response)).details).toMatchObject({
      conflict: 'VERSION_MISMATCH',
    });
  });

  it('[P2-S09-AC-749] returns 409 for a stale MFA version without any provider call', async () => {
    const stale = createWorld({
      handlers: {
        auth_mfa_enrollment_begin: () => rpcRefusal('VERSION_MISMATCH', 409),
      },
    });
    const response = await send(stale.app, {
      ...BASE[17],
      jar: await mintJar(),
    });
    expect(response.status).toBe(409);
    expect(providerCalls(stale.calls)).toStrictEqual([]);
  });

  it('[P2-S09-AC-739] carries no client Idempotency-Key: none is required, none is forwarded, and an enrollment is never replayed from a stored response', async () => {
    const world = createWorld();
    const jar = await mintJar();
    const first = await send(world.app, {
      ...BASE[17],
      jar,
      headers: { ...BASE[17].headers, 'idempotency-key': 'k'.repeat(24) },
    });
    const second = await send(world.app, { ...BASE[17], jar });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(
      rpcNames(world.calls).filter((n) => n === 'auth_mfa_enrollment_begin'),
    ).toHaveLength(2);
    expect(
      providerCalls(world.calls).filter((c) => c === P_ENROLL),
    ).toHaveLength(2);
    for (const call of world.calls)
      expect(Object.keys(call.body ?? {})).not.toContain('p_key_hash');
  });

  it('[P2-S09-AC-743] returns the secret and URI only in the no-store response: never in persistence, logs, URLs or other requests', async () => {
    const logged: string[] = [];
    for (const channel of ['log', 'info', 'warn', 'error', 'debug'] as const)
      vi.spyOn(console, channel).mockImplementation((...args: unknown[]) => {
        logged.push(args.map(String).join(' '));
      });
    const world = createWorld();
    const response = await send(world.app, {
      ...BASE[17],
      jar: await mintJar(),
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const secrets = [MANUAL_KEY, 'otpauth://'];
    for (const call of world.calls) {
      expect(call.url).not.toContain(MANUAL_KEY);
      if (call.rpc !== null)
        for (const secret of secrets)
          expect(JSON.stringify(call.body)).not.toContain(secret);
    }
    for (const line of logged)
      for (const secret of secrets) expect(line).not.toContain(secret);
    for (const [name, value] of response.headers.entries())
      for (const secret of secrets)
        expect(`${name}: ${value}`).not.toContain(secret);
  });

  it.each([
    ['active', 201],
    ['claimed', 201],
    ['suspended', 403],
    ['memorialised', 403],
    ['erasure_processing', 403],
  ] as const)(
    '[P2-S09-AC-745] allows a self account in state %s -> %i',
    async (accountState, status) => {
      const world = createWorld({
        handlers: {
          auth_session_read: () =>
            json({
              accountState,
              bootstrapState: 'complete',
              personId: '44444444-4444-4444-8444-444444444444',
              actingPartyId: '44444444-4444-4444-8444-444444444444',
            }),
        },
      });
      const response = await send(world.app, {
        ...BASE[17],
        jar: await mintJar(),
      });
      expect(response.status).toBe(status);
    },
  );

  it('[P2-S09-AC-746] requires a fresh step-up when a verified factor exists and answers 401 STEP_UP_REQUIRED with no persisted effect otherwise', async () => {
    const world = createWorld();
    const stale = await send(world.app, {
      ...BASE[17],
      jar: await mintJar({ stepUpAt: iso(-601) }),
    });
    expect(stale.status).toBe(401);
    expect((await bodyOf(stale)).code).toBe('STEP_UP_REQUIRED');
    expect(rpcNames(world.calls)).not.toContain('auth_mfa_enrollment_begin');
    expect(providerCalls(world.calls)).toStrictEqual([]);
    const fresh = await send(world.app, {
      ...BASE[17],
      jar: await mintJar({ stepUpAt: iso(-600) }),
    });
    expect(fresh.status).toBe(201);
  });

  it.each([
    [-600, 201],
    [-601, 401],
    [-30, 201],
  ] as const)(
    '[P2-S09-AC-747] with no verified factor requires primaryAuthAt within 600 s (%i s -> %i)',
    async (offset, status) => {
      const world = createWorld({
        handlers: {
          auth_mfa_factors_read: () => json({ factors: [], version: '3' }),
        },
      });
      const jar = await mintJar({
        stepUpAt: null,
        accessClaims: { amr: primaryAuthAmr(offset), aal: 'aal1' },
      });
      const response = await send(world.app, { ...BASE[17], jar });
      expect(response.status).toBe(status);
      if (status === 401) {
        const body = await bodyOf(response);
        expect(body.code).toBe('UNAUTHENTICATED');
        expect(body.details).toStrictEqual({
          recoveryAction: 'reauthenticate',
        });
        expect(rpcNames(world.calls)).not.toContain(
          'auth_mfa_enrollment_begin',
        );
      }
    },
  );

  it('[P2-S09-AC-747] answers 401 reauthenticate when the session carries no primary authentication timestamp at all', async () => {
    const world = createWorld({
      handlers: {
        auth_mfa_factors_read: () => json({ factors: [], version: '3' }),
      },
    });
    const jar = await mintJar({ stepUpAt: null });
    const response = await send(world.app, { ...BASE[17], jar });
    expect(response.status).toBe(401);
    expect((await bodyOf(response)).details).toStrictEqual({
      recoveryAction: 'reauthenticate',
    });
  });

  it('[P2-S09-AC-748] removes the superseded unverified provider factor before enrolling the new one', async () => {
    const world = createWorld({
      handlers: {
        auth_mfa_enrollment_begin: () =>
          json({
            supersededProviderFactorId: PROVIDER_FACTOR_ID,
            version: '4',
          }),
      },
    });
    const response = await send(world.app, {
      ...BASE[17],
      jar: await mintJar(),
    });
    expect(response.status).toBe(201);
    const sequence = providerCalls(world.calls);
    expect(sequence).toStrictEqual([P_DELETE, P_ENROLL]);
  });

  it('[P2-S09-AC-750] runs the registry transaction, then the provider enroll, then the second transaction, and never inside a database call', async () => {
    const world = createWorld();
    await send(world.app, { ...BASE[17], jar: await mintJar() });
    const order = world.calls
      .filter((call) => call.path !== '/auth/v1/user')
      .map((call) => call.rpc ?? `${call.method} ${call.path}`)
      .filter(
        (name) => name !== 'auth_rate_limit' && name !== 'auth_session_read',
      );
    expect(order).toStrictEqual([
      'auth_mfa_factors_read',
      'auth_mfa_enrollment_begin',
      P_ENROLL,
      'auth_mfa_enrollment_finish',
    ]);
  });

  it('[P2-S09-AC-751] is limited to 5 per hour per user with no-store and a 15 s deadline', async () => {
    const jar = await mintJar();
    const world = createWorld();
    const first = await send(world.app, { ...BASE[17], jar });
    expect(first.headers.get('cache-control')).toBe('no-store');
    expect(
      world.calls.find((call) => call.rpc === 'auth_rate_limit')?.body,
    ).toMatchObject({ p_limit: 5, p_window_seconds: 3600 });
    const delays = collapseDeadline(15_000);
    const slow = createWorld({
      handlers: { auth_mfa_enrollment_begin: hangUntilAborted },
    });
    const response = await send(slow.app, { ...BASE[17], jar });
    expect(delays).toContain(15_000);
    expect(response.status).toBe(504);
  });
});
