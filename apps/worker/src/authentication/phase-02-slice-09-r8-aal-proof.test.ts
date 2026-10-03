import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FACTOR_ID,
  NOW,
  OTHER_FACTOR_ID,
  SHAPES,
  bodyOf,
  createWorld,
  expectApiError,
  iso,
  json,
  mintJar,
  providerCalls,
  rpcNames,
  send,
} from './dec111-composition.test-support';
import { BASE } from './dec111-wire-scenarios.test-support';
import {
  AAL1,
  FRESH,
  MFA_AMR,
  PASSWORD_AMR,
  SECOND,
  UNPROVEN_TOKENS,
  verifiedFactors,
} from './phase-02-slice-09-r8.test-support';

/**
 * R8 security remediation, aal2 gate: a step-up proof is a token with aal2 and an MFA amr (BE01a "Consumption"); an aal1 proof is always 401 STEP_UP_REQUIRED.
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

describe('AUTH-API-17 requires an aal2 token with an MFA amr for the verified-factor step-up', () => {
  it.each(UNPROVEN_TOKENS)(
    '[P2-S09-AC-764][P2-S09-AC-746] a fresh session whose token is %s is refused with 401 STEP_UP_REQUIRED and the exact step-up details',
    async (_label, accessClaims) => {
      const world = createWorld({ handlers: verifiedFactors() });
      const response = await send(world.app, {
        ...BASE[17],
        jar: await mintJar({ stepUpAt: FRESH, accessClaims }),
      });
      await expectApiError(response, {
        status: 401,
        code: 'STEP_UP_REQUIRED',
        shape: SHAPES.stepUp,
      });
    },
  );

  it.each(UNPROVEN_TOKENS)(
    '[P2-S09-AC-764] a fresh session whose token is %s persists nothing and never reaches the provider',
    async (_label, accessClaims) => {
      const world = createWorld({ handlers: verifiedFactors() });
      await send(world.app, {
        ...BASE[17],
        jar: await mintJar({ stepUpAt: FRESH, accessClaims }),
      });
      expect(rpcNames(world.calls)).not.toContain('auth_mfa_enrollment_begin');
      expect(rpcNames(world.calls)).not.toContain('auth_mfa_enrollment_finish');
      expect(providerCalls(world.calls)).toStrictEqual([]);
    },
  );

  it('[P2-S09-AC-764] the same fresh session with an aal2 token carrying an MFA amr enrolls the factor', async () => {
    const world = createWorld({ handlers: verifiedFactors() });
    const response = await send(world.app, {
      ...BASE[17],
      jar: await mintJar({
        stepUpAt: FRESH,
        accessClaims: { aal: 'aal2', amr: MFA_AMR },
      }),
    });
    expect(response.status).toBe(201);
  });

  it('[P2-S09-AC-884] a fresh sealed instant never outlives the token: an aal2 token whose MFA amr is stale is refused even when the sealed reference is fresh', async () => {
    const world = createWorld({ handlers: verifiedFactors() });
    const response = await send(world.app, {
      ...BASE[17],
      jar: await mintJar({
        stepUpAt: FRESH,
        accessClaims: {
          aal: 'aal2',
          amr: [{ method: 'totp', timestamp: SECOND - 601 }],
        },
      }),
    });
    expect((await bodyOf(response)).code).toBe('STEP_UP_REQUIRED');
  });

  it('[P2-S09-AC-884] the instant is the older of the token amr and the sealed reference, so neither can extend the other', async () => {
    const olderToken = createWorld({ handlers: verifiedFactors() });
    const refusedByToken = await send(olderToken.app, {
      ...BASE[17],
      jar: await mintJar({
        stepUpAt: iso(-10),
        accessClaims: {
          aal: 'aal2',
          amr: [{ method: 'totp', timestamp: SECOND - 601 }],
        },
      }),
    });
    expect(refusedByToken.status).toBe(401);
    const olderSeal = createWorld({ handlers: verifiedFactors() });
    const refusedBySeal = await send(olderSeal.app, {
      ...BASE[17],
      jar: await mintJar({
        stepUpAt: iso(-601),
        accessClaims: {
          aal: 'aal2',
          amr: [{ method: 'totp', timestamp: SECOND - 10 }],
        },
      }),
    });
    expect(refusedBySeal.status).toBe(401);
  });

  it('[P2-S09-AC-747] the first-factor rule is unchanged: an aal1 session with a fresh primary sign-in and no verified factor still enrolls', async () => {
    const world = createWorld({
      handlers: {
        auth_mfa_factors_read: () => json({ factors: [], version: '3' }),
      },
    });
    const response = await send(world.app, {
      ...BASE[17],
      jar: await mintJar({
        stepUpAt: null,
        accessClaims: { aal: 'aal1', amr: PASSWORD_AMR },
      }),
    });
    expect(response.status).toBe(201);
  });
});

describe('AUTH-API-19 requires an aal2 token with an MFA amr to remove a verified factor', () => {
  it.each(UNPROVEN_TOKENS)(
    '[P2-S09-AC-823] a fresh session whose token is %s is refused with 401 STEP_UP_REQUIRED and the exact step-up details',
    async (_label, accessClaims) => {
      const world = createWorld({ handlers: verifiedFactors() });
      const response = await send(world.app, {
        ...BASE[19],
        jar: await mintJar({ stepUpAt: FRESH, accessClaims }),
      });
      await expectApiError(response, {
        status: 401,
        code: 'STEP_UP_REQUIRED',
        shape: SHAPES.stepUp,
      });
    },
  );

  it.each(UNPROVEN_TOKENS)(
    '[P2-S09-AC-823] a fresh session whose token is %s reserves nothing and never calls the provider',
    async (_label, accessClaims) => {
      const world = createWorld({ handlers: verifiedFactors() });
      await send(world.app, {
        ...BASE[19],
        jar: await mintJar({ stepUpAt: FRESH, accessClaims }),
      });
      expect(rpcNames(world.calls)).not.toContain('auth_mfa_removal_begin');
      expect(rpcNames(world.calls)).not.toContain('auth_mfa_removal_finish');
      expect(providerCalls(world.calls)).toStrictEqual([]);
    },
  );

  it('[P2-S09-AC-801] cancelling a pending factor needs no step-up, so an aal1 token still cancels it', async () => {
    const world = createWorld({ handlers: verifiedFactors() });
    const response = await send(world.app, {
      ...BASE[19],
      path: `/api/v1/account/mfa/factors/${OTHER_FACTOR_ID}`,
      jar: await mintJar({ stepUpAt: null, accessClaims: AAL1 }),
    });
    expect(response.status).toBe(200);
  });

  it('[P2-S09-AC-801] the verified factor is removed once the token is aal2 with an MFA amr', async () => {
    const world = createWorld({ handlers: verifiedFactors() });
    const response = await send(world.app, {
      ...BASE[19],
      path: `/api/v1/account/mfa/factors/${FACTOR_ID}`,
      jar: await mintJar({
        stepUpAt: FRESH,
        accessClaims: { aal: 'aal2', amr: MFA_AMR },
      }),
    });
    expect(response.status).toBe(200);
  });
});

describe('AUTH-API-16 reports no fresh proof for a token that is not aal2 with an MFA amr', () => {
  it.each(UNPROVEN_TOKENS)(
    '[P2-S09-AC-717] a fresh session whose token is %s reads stepUp.fresh false with a null freshUntil',
    async (_label, accessClaims) => {
      const world = createWorld({ handlers: verifiedFactors() });
      const response = await send(world.app, {
        ...BASE[16],
        jar: await mintJar({ stepUpAt: FRESH, accessClaims }),
      });
      expect((await bodyOf(response)).stepUp).toStrictEqual({
        fresh: false,
        freshUntil: null,
      });
    },
  );

  it('[P2-S09-AC-717] an aal2 token with an MFA amr reads stepUp.fresh true until the sealed instant plus 600 s', async () => {
    const world = createWorld({ handlers: verifiedFactors() });
    const response = await send(world.app, {
      ...BASE[16],
      jar: await mintJar({
        stepUpAt: FRESH,
        accessClaims: { aal: 'aal2', amr: MFA_AMR },
      }),
    });
    expect((await bodyOf(response)).stepUp).toStrictEqual({
      fresh: true,
      freshUntil: iso(540),
    });
  });
});
