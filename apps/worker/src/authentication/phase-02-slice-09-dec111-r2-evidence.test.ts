import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTH_USER_ID,
  CHALLENGE_ID,
  FACTOR_ID,
  NEW_SESSION_ID,
  NOW,
  SESSION_ID,
  bodyOf,
  createWorld,
  expectApiError,
  iso,
  json,
  jwt,
  mintJar,
  primaryAuthAmr,
  providerCalls,
  rpcNames,
  rpcRefusal,
  send,
  setCookies,
  type Handler,
} from './dec111-composition.test-support';
import { BASE } from './dec111-wire-scenarios.test-support';

/**
 * Evidence added by the 2026-10-02 audit remediation (lane r2-auth) for
 * AUTH-API-16..21, through the production Worker composition. Only the
 * PostgREST and Supabase Auth HTTP endpoints are faked; a fake database
 * answers with exactly the error the database function raises, citing the
 * pgTAP assertion that proves the database raises it.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  for (const level of ['log', 'info', 'warn', 'error'] as const)
    vi.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const second = (offset: number): number => Math.floor(NOW / 1000) + offset;
const READ_ONLY = new Set([
  'auth_rate_limit',
  'auth_session_read',
  'auth_mfa_factors_read',
]);

describe('AUTH-API-16 dependency details (AC-729)', () => {
  it('[P2-S09-AC-729] answers an unavailable persistence layer with 503 DEPENDENCY_UNAVAILABLE and exactly { dependencyClass: "identity_persistence", retryable: true }', async () => {
    const world = createWorld({
      handlers: { auth_mfa_factors_read: () => rpcRefusal('boom', 500) },
    });
    const response = await send(world.app, {
      ...BASE[16],
      jar: await mintJar(),
    });
    await expectApiError(response, {
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      shape: {
        exact: { dependencyClass: 'identity_persistence', retryable: true },
      },
    });
  });
});

describe('AUTH-API-17 step-up proof variants (AC-764)', () => {
  const variants: ReadonlyArray<
    readonly [string, () => ReturnType<typeof mintJar>]
  > = [
    ['a missing proof', () => mintJar({ stepUpAt: null })],
    ['a stale proof (601 s old)', () => mintJar({ stepUpAt: iso(-601) })],
    ['a future-dated proof (31 s ahead)', () => mintJar({ stepUpAt: iso(31) })],
    [
      'an aal1 session that holds no step-up proof',
      () =>
        mintJar({
          stepUpAt: null,
          accessClaims: { aal: 'aal1', amr: primaryAuthAmr(-30) },
        }),
    ],
  ];
  it.each(variants)(
    '[P2-S09-AC-764] returns 401 STEP_UP_REQUIRED with exactly { recoveryAction: "step_up", allowedMethods: ["totp"] } for %s and retains no effect',
    async (_label, jarFor) => {
      const world = createWorld();
      const response = await send(world.app, {
        ...BASE[17],
        jar: await jarFor(),
      });
      await expectApiError(response, {
        status: 401,
        code: 'STEP_UP_REQUIRED',
        shape: {
          exact: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
        },
      });
      expect(
        rpcNames(world.calls).filter((name) => !READ_ONLY.has(name)),
      ).toStrictEqual([]);
      expect(providerCalls(world.calls)).toStrictEqual([]);
    },
  );

  it('[P2-S09-AC-764] accepts a proof exactly 30 s ahead and exactly 600 s old', async () => {
    for (const stepUpAt of [iso(30), iso(-600)]) {
      const world = createWorld();
      const response = await send(world.app, {
        ...BASE[17],
        jar: await mintJar({ stepUpAt }),
      });
      expect(response.status).toBe(201);
    }
  });
});

describe('AUTH-API-19 If-Match and validation (AC-796, AC-817)', () => {
  /** The removal function compares the expected version with the stored one. */
  const removalBegin: Handler = (call) =>
    call.body?.p_expected_version === '3'
      ? json({
          providerFactorId: '66666666-6666-4666-8666-666666666666',
          replay: null,
        })
      : rpcRefusal('VERSION_MISMATCH', 409);

  it('[P2-S09-AC-796] forwards the If-Match decimal as the expected version and a version other than the current MFA version is 409 VERSION_MISMATCH with no provider effect (database raises it: supabase/tests/phase_02_slice_09_dec111_mfa_removal.sql:49)', async () => {
    const jar = await mintJar();
    const stale = createWorld({
      handlers: { auth_mfa_removal_begin: removalBegin },
    });
    const refused = await send(stale.app, {
      ...BASE[19],
      headers: { ...BASE[19].headers, 'if-match': '"9"' },
      jar,
    });
    await expectApiError(refused, {
      status: 409,
      code: 'CONFLICT',
      shape: {
        exact: {
          conflict: 'VERSION_MISMATCH',
          reasonCode: 'version_mismatch',
          recoveryAction: 'refetch',
        },
      },
    });
    expect(
      stale.calls.find((call) => call.rpc === 'auth_mfa_removal_begin')?.body,
    ).toMatchObject({ p_expected_version: '9' });
    expect(providerCalls(stale.calls)).toStrictEqual([]);
    const current = createWorld({
      handlers: { auth_mfa_removal_begin: removalBegin },
    });
    const accepted = await send(current.app, { ...BASE[19], jar });
    expect(accepted.status).toBe(200);
    expect(
      current.calls.find((call) => call.rpc === 'auth_mfa_removal_begin')?.body,
    ).toMatchObject({ p_expected_version: '3' });
  });

  it('[P2-S09-AC-817] a reason outside user_request and factor_compromise is 422 VALIDATION_FAILED with one violation at /reason, a lowercase code and a safe message', async () => {
    const world = createWorld();
    const response = await send(world.app, {
      ...BASE[19],
      body: { reason: 'because' },
      jar: await mintJar(),
    });
    const body = await expectApiError(response, {
      status: 422,
      code: 'VALIDATION_FAILED',
      shape: {
        keys: ['violations'],
        check: (details) => {
          const rows = details.violations as Array<Record<string, string>>;
          expect(rows).toHaveLength(1);
          expect(rows[0]?.path).toBe('/reason');
          expect(rows[0]?.code).toBe('reason_invalid');
        },
      },
    });
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(rpcNames(world.calls)).not.toContain('auth_mfa_removal_begin');
  });
});

describe('AUTH-API-20 concealment (AC-843)', () => {
  it('[P2-S09-AC-843] an unknown factorId is 404 with empty details while the same request with no factorId and no verified factor is 409 no_verified_factor, so the 404 carries no existence oracle (database: supabase/tests/phase_02_slice_09_dec111_step_up_challenge.sql:85 and :79)', async () => {
    const handler: Handler = (call) =>
      call.body?.p_factor_id === FACTOR_ID
        ? json({
            factorId: FACTOR_ID,
            providerFactorId: '66666666-6666-4666-8666-666666666666',
            friendlyName: 'Phone authenticator',
          })
        : call.body?.p_factor_id === null
          ? rpcRefusal('NO_VERIFIED_FACTOR', 409)
          : rpcRefusal('NOT_FOUND', 404);
    const jar = await mintJar();
    const foreign = createWorld({
      handlers: { auth_step_up_challenge_begin: handler },
    });
    const refused = await send(foreign.app, {
      ...BASE[20],
      body: {
        method: 'totp',
        factorId: '99999999-9999-4999-8999-999999999999',
      },
      jar,
    });
    await expectApiError(refused, {
      status: 404,
      code: 'NOT_FOUND',
      shape: { exact: {} },
    });
    expect(
      foreign.calls.find((c) => c.rpc === 'auth_step_up_challenge_begin')?.body,
    ).toMatchObject({ p_factor_id: '99999999-9999-4999-8999-999999999999' });
    const none = createWorld({
      handlers: { auth_step_up_challenge_begin: handler },
    });
    const absent = await send(none.app, { ...BASE[20], jar });
    expect(absent.status).toBe(409);
  });
});

describe('AUTH-API-21 rotated aal2 cookies (AC-853)', () => {
  it('[P2-S09-AC-853] replaces access, refresh, session reference and CSRF cookies with new values and the new access token carries aal2 for the new session', async () => {
    const jar = await mintJar();
    const world = createWorld();
    const response = await send(world.app, { ...BASE[21], jar });
    expect(response.status).toBe(200);
    const issued = new Map(
      setCookies(response).map((cookie) => [cookie.name, cookie.value]),
    );
    const previous = new Map(
      jar.cookie.split('; ').map((pair) => {
        const index = pair.indexOf('=');
        return [pair.slice(0, index), pair.slice(index + 1)] as const;
      }),
    );
    for (const name of [
      'wj_access',
      'wj_refresh',
      'wj_session_ref',
      'wj_csrf',
    ]) {
      expect(issued.get(name) ?? '').not.toBe('');
      expect(issued.get(name)).not.toBe(previous.get(name));
    }
    const payload = JSON.parse(
      Buffer.from(
        (issued.get('wj_access') ?? '').split('.')[1] ?? '',
        'base64url',
      ).toString('utf8'),
    ) as Record<string, unknown>;
    expect(payload.aal).toBe('aal2');
    expect(payload.session_id).toBe(NEW_SESSION_ID);
    expect(payload.session_id).not.toBe(SESSION_ID);
  });
});

describe('Session rotation validation on AUTH-API-21 (AC-879)', () => {
  const verifyWith =
    (token: string): Handler =>
    () =>
      json({ access_token: token, refresh_token: 'r2' });
  const aal2 = {
    aal: 'aal2',
    amr: [{ method: 'totp', timestamp: second(0) }],
  };
  const rows: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ['an aal1 token', { aal: 'aal1' }],
    ['a token with no aal claim', { aal: undefined }],
    ['a token with no amr claim', { amr: undefined }],
    [
      'a token whose only amr entry is a primary method',
      { amr: primaryAuthAmr(0) },
    ],
    [
      'a token whose MFA amr timestamp is 601 s old',
      { amr: [{ method: 'totp', timestamp: second(-601) }] },
    ],
    [
      'a token whose MFA amr timestamp is 31 s in the future',
      { amr: [{ method: 'totp', timestamp: second(31) }] },
    ],
    ['a wrong issuer', { iss: 'https://evil.example/auth/v1' }],
    ['a non-authenticated audience', { aud: 'anon' }],
    ['an expired token', { exp: second(-1) }],
    ['a subject that is not the initiating Auth UUID', { sub: NEW_SESSION_ID }],
  ];
  it.each(rows)(
    '[P2-S09-AC-879] returns 502 DEPENDENCY_UNAVAILABLE and settles nothing for %s',
    async (_label, claims) => {
      const world = createWorld({
        handlers: {
          [`POST /auth/v1/factors/66666666-6666-4666-8666-666666666666/verify`]:
            verifyWith(jwt({ ...aal2, ...claims }, NEW_SESSION_ID)),
        },
      });
      const response = await send(world.app, {
        ...BASE[21],
        jar: await mintJar(),
      });
      await expectApiError(response, {
        status: 502,
        code: 'DEPENDENCY_UNAVAILABLE',
        shape: {
          keys: ['dependencyClass', 'retryable'],
          optional: ['retryAfterSeconds'],
        },
      });
      expect(rpcNames(world.calls)).not.toContain(
        'auth_step_up_challenge_verify_settle',
      );
      expect(response.headers.getSetCookie()).toStrictEqual([]);
    },
  );

  it('[P2-S09-AC-879] returns 502 and settles nothing when Supabase rejects the signature of the returned token (the caller token is still accepted)', async () => {
    const world = createWorld({
      handlers: {
        'GET /auth/v1/user': (call) => {
          const token =
            call.headers.get('authorization')?.slice('Bearer '.length) ?? '';
          const claims = JSON.parse(
            Buffer.from(token.split('.')[1] ?? '', 'base64url').toString(
              'utf8',
            ),
          ) as { session_id: string };
          return claims.session_id === NEW_SESSION_ID
            ? json({ message: 'bad jwt' }, 401)
            : json({ id: AUTH_USER_ID });
        },
      },
    });
    const response = await send(world.app, {
      ...BASE[21],
      jar: await mintJar(),
    });
    expect(response.status).toBe(502);
    expect(rpcNames(world.calls)).not.toContain(
      'auth_step_up_challenge_verify_settle',
    );
    expect(providerCalls(world.calls)).toContain(
      'POST /auth/v1/factors/66666666-6666-4666-8666-666666666666/verify',
    );
  });
});

const keep = [CHALLENGE_ID, bodyOf];
void keep;
