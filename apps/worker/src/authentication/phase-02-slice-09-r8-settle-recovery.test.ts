import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FACTOR_ID,
  NOW,
  PROVIDER_FACTOR_ID,
  bodyOf,
  createWorld,
  expectApiError,
  factorRow,
  iso,
  json,
  mintJar,
  providerCalls,
  rpcNames,
  rpcRefusal,
  send,
  type Handler,
} from './dec111-composition.test-support';
import { BASE } from './dec111-wire-scenarios.test-support';
import {
  FRESH,
  MFA_AMR,
  SECOND,
  verifiedFactors,
} from './phase-02-slice-09-r8.test-support';

/**
 * R8 security remediation, settle lockout refusal, AUTH-API-17 503 variants and the sole-administrator provider-removal recovery.
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

describe('AUTH-API-18 enrollment settle refused by the persisted lockout', () => {
  const lockedAtSettle = () =>
    createWorld({
      handlers: {
        ...verifiedFactors(),
        auth_mfa_enrollment_verify_settle: () =>
          rpcRefusal('MFA_VERIFICATION_LOCKED:742'),
      },
    });
  const verifyEnrollment = async (world: ReturnType<typeof lockedAtSettle>) =>
    send(world.app, {
      ...BASE[18],
      jar: await mintJar({
        stepUpAt: null,
        accessClaims: { aal: 'aal2', amr: MFA_AMR },
      }),
    });

  it('[P2-S09-AC-865][P2-S09-AC-778] a lock that landed between prepare and settle answers 429 RATE_LIMITED', async () => {
    const response = await verifyEnrollment(lockedAtSettle());
    await expectApiError(response, {
      status: 429,
      code: 'RATE_LIMITED',
      shape: {
        exact: { limit: 10, resetAt: iso(742), retryAfterSeconds: 742 },
      },
    });
  });

  it('[P2-S09-AC-865][P2-S09-AC-778] the settle lock refusal carries Retry-After with the remaining lock', async () => {
    const response = await verifyEnrollment(lockedAtSettle());
    expect(response.headers.get('retry-after')).toBe('742');
  });

  it('[P2-S09-AC-865][P2-S09-AC-778] the settle lock refusal never marks the factor reconciling', async () => {
    const world = lockedAtSettle();
    await verifyEnrollment(world);
    expect(rpcNames(world.calls)).not.toContain(
      'auth_mfa_factor_mark_reconciling',
    );
  });

  it('[P2-S09-AC-865][P2-S09-AC-778] the settle lock refusal sends no rotated session cookies', async () => {
    const response = await verifyEnrollment(lockedAtSettle());
    expect(response.headers.getSetCookie()).toStrictEqual([]);
  });

  it('[P2-S09-AC-778] an unrelated settle failure still marks the factor reconciling and answers 500', async () => {
    const world = createWorld({
      handlers: {
        ...verifiedFactors(),
        auth_mfa_enrollment_verify_settle: () => rpcRefusal('UNEXPECTED'),
      },
    });
    const response = await verifyEnrollment(world);
    expect(response.status).toBe(500);
    expect(rpcNames(world.calls)).toContain('auth_mfa_factor_mark_reconciling');
  });
});

describe('AUTH-API-17 503 DEPENDENCY_UNAVAILABLE for each unavailable dependency', () => {
  const FRESH_AAL2 = { aal: 'aal2', amr: MFA_AMR } as const;
  const enroll = async (world: ReturnType<typeof createWorld>) =>
    send(world.app, {
      ...BASE[17],
      jar: await mintJar({ stepUpAt: FRESH, accessClaims: FRESH_AAL2 }),
    });

  it('[P2-S09-AC-761] an unavailable database (the factor read fails) answers 503 with the identity_persistence details and calls no provider', async () => {
    const world = createWorld({
      handlers: { auth_mfa_factors_read: () => rpcRefusal('boom', 500) },
    });
    const response = await enroll(world);
    await expectApiError(response, {
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      shape: {
        exact: { dependencyClass: 'identity_persistence', retryable: true },
      },
    });
    expect(providerCalls(world.calls)).toStrictEqual([]);
  });

  it('[P2-S09-AC-761] an unavailable database after the provider enrolled answers 503 and unenrolls the provider factor', async () => {
    const world = createWorld({
      handlers: {
        ...verifiedFactors(),
        auth_mfa_enrollment_finish: () => rpcRefusal('boom', 500),
      },
    });
    const response = await enroll(world);
    await expectApiError(response, {
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      shape: {
        exact: { dependencyClass: 'identity_persistence', retryable: true },
      },
    });
    expect(providerCalls(world.calls)).toStrictEqual([
      'POST /auth/v1/factors',
      `DELETE /auth/v1/factors/${PROVIDER_FACTOR_ID}`,
    ]);
  });

  it('[P2-S09-AC-761] an unavailable provider answers 503 with the identity_provider details', async () => {
    const world = createWorld({
      handlers: {
        ...verifiedFactors(),
        'POST /auth/v1/factors': () => new Response('{}', { status: 500 }),
      },
    });
    const response = await enroll(world);
    await expectApiError(response, {
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      shape: {
        exact: { dependencyClass: 'identity_provider', retryable: true },
      },
    });
  });

  it('[P2-S09-AC-761] an open provider circuit answers 503 with the identity_provider details and sends no provider request', async () => {
    const world = createWorld({
      handlers: {
        ...verifiedFactors(),
        'POST /auth/v1/factors': () => new Response('{}', { status: 500 }),
      },
    });
    for (let index = 0; index < 5; index += 1) await enroll(world);
    const before = providerCalls(world.calls).length;
    const response = await enroll(world);
    await expectApiError(response, {
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      shape: {
        exact: { dependencyClass: 'identity_provider', retryable: true },
      },
    });
    expect(providerCalls(world.calls)).toHaveLength(before);
  });
});

describe('sole-administrator recovery after the provider factor was removed in the dashboard', () => {
  const PROVIDER_CHALLENGE = `POST /auth/v1/factors/${PROVIDER_FACTOR_ID}/challenge`;
  const notFound: Handler = () =>
    json({ error_code: 'mfa_factor_not_found', msg: 'x' }, 404);

  /**
   * The registry holds one verified factor the provider no longer has. The
   * registry read reflects `auth_mfa_factor_mark_reconciling` (verified to
   * reconciling) exactly as the database applies it.
   */
  const dashboardRemoval = () => {
    let state: 'verified' | 'reconciling' = 'verified';
    return createWorld({
      handlers: {
        auth_mfa_factors_read: () =>
          json({ factors: [factorRow({ state })], version: '3' }),
        auth_mfa_factor_mark_reconciling: () => {
          state = 'reconciling';
          return json({ marked: true });
        },
        [PROVIDER_CHALLENGE]: notFound,
      },
    });
  };
  const signedInAgain = () =>
    mintJar({
      stepUpAt: null,
      accessClaims: {
        aal: 'aal1',
        amr: [{ method: 'otp', timestamp: SECOND - 30 }],
      },
    });

  it('[P2-S09-AC-1150] a step-up challenge for a factor the provider no longer has answers 409 no_verified_factor with the enroll_factor recovery', async () => {
    const world = dashboardRemoval();
    const response = await send(world.app, {
      ...BASE[20],
      jar: await signedInAgain(),
    });
    await expectApiError(response, {
      status: 409,
      code: 'CONFLICT',
      shape: {
        exact: {
          conflict: 'INVALID_TRANSITION',
          reasonCode: 'no_verified_factor',
          recoveryAction: 'enroll_factor',
        },
      },
    });
  });

  it('[P2-S09-AC-1150] the same request marks exactly that registry factor reconciling and records no challenge', async () => {
    const world = dashboardRemoval();
    await send(world.app, { ...BASE[20], jar: await signedInAgain() });
    const marks = world.calls.filter(
      (call) => call.rpc === 'auth_mfa_factor_mark_reconciling',
    );
    expect(marks.map((call) => call.body?.p_factor_id)).toStrictEqual([
      FACTOR_ID,
    ]);
    expect(rpcNames(world.calls)).not.toContain(
      'auth_step_up_challenge_finish',
    );
  });

  it('[P2-S09-AC-1150] a failed reconciling mark is surfaced as 503 instead of the enroll instruction', async () => {
    const world = createWorld({
      handlers: {
        auth_mfa_factor_mark_reconciling: () => rpcRefusal('boom', 500),
        [PROVIDER_CHALLENGE]: notFound,
      },
    });
    const response = await send(world.app, {
      ...BASE[20],
      jar: await signedInAgain(),
    });
    expect(response.status).toBe(503);
  });

  it('[P2-S09-AC-1150] a provider 404 that is not the challenge of a registry factor is unchanged: other provider failures never mark a factor reconciling', async () => {
    const world = createWorld({
      handlers: {
        [PROVIDER_CHALLENGE]: () => new Response('{}', { status: 500 }),
      },
    });
    const response = await send(world.app, {
      ...BASE[20],
      jar: await signedInAgain(),
    });
    expect(response.status).toBe(503);
    expect(rpcNames(world.calls)).not.toContain(
      'auth_mfa_factor_mark_reconciling',
    );
  });

  it('[P2-S09-AC-1150] the recovery runs end to end: refused enrollment, challenge that reconciles the factor, then first-factor enrollment succeeds on the fresh sign-in', async () => {
    const world = dashboardRemoval();
    const jar = await signedInAgain();
    const refused = await send(world.app, { ...BASE[17], jar });
    expect(refused.status).toBe(401);
    expect((await bodyOf(refused)).code).toBe('STEP_UP_REQUIRED');
    const challenged = await send(world.app, { ...BASE[20], jar });
    expect(challenged.status).toBe(409);
    const enrolled = await send(world.app, { ...BASE[17], jar });
    expect(enrolled.status).toBe(201);
  });
});
