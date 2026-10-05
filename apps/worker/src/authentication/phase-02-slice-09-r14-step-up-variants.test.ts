import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOW,
  SHAPES,
  createWorld,
  expectApiError,
  iso,
  mintJar,
  providerCalls,
  rpcNames,
  send,
} from './dec111-composition.test-support';
import { BASE } from './dec111-wire-scenarios.test-support';
import { AAL1, verifiedFactors } from './phase-02-slice-09-r8.test-support';

/**
 * AC823: AUTH-API-19 answers 401 STEP_UP_REQUIRED with exactly
 * { recoveryAction: 'step_up', allowedMethods: ['totp'] } for a missing, stale,
 * future-dated or aal1 proof, never 403 and never a retained partial effect.
 * Every variant runs through the production composition (real routes, session
 * verifier, MFA service, persistence adapter and Supabase MFA provider); only
 * the PostgREST and Supabase Auth HTTP endpoints are faked. The proof window
 * is -30 s <= now - proofAt <= 600 s.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const REFUSED: ReadonlyArray<
  readonly [string, () => ReturnType<typeof mintJar>]
> = [
  ['a missing proof', () => mintJar({ stepUpAt: null })],
  ['a stale proof (601 s old)', () => mintJar({ stepUpAt: iso(-601) })],
  ['a future-dated proof (31 s ahead)', () => mintJar({ stepUpAt: iso(31) })],
  [
    'an aal1 token that holds no step-up proof',
    () => mintJar({ stepUpAt: null, accessClaims: AAL1 }),
  ],
];

describe('AUTH-API-19 step-up proof variants (AC-823)', () => {
  it.each(REFUSED)(
    '[P2-S09-AC-823] returns 401 STEP_UP_REQUIRED with exactly { recoveryAction: step_up, allowedMethods: [totp] } for %s and retains no effect',
    async (_label, jarFor) => {
      const world = createWorld({ handlers: verifiedFactors() });
      const response = await send(world.app, {
        ...BASE[19],
        jar: await jarFor(),
      });
      await expectApiError(response, {
        status: 401,
        code: 'STEP_UP_REQUIRED',
        shape: SHAPES.stepUp,
      });
      expect(rpcNames(world.calls)).not.toContain('auth_mfa_removal_begin');
      expect(rpcNames(world.calls)).not.toContain('auth_mfa_removal_finish');
      expect(providerCalls(world.calls)).toStrictEqual([]);
    },
  );

  it('[P2-S09-AC-823] accepts a proof exactly 30 s ahead and exactly 600 s old, so the refusals above are the proof', async () => {
    for (const stepUpAt of [iso(30), iso(-600)]) {
      const world = createWorld({ handlers: verifiedFactors() });
      const response = await send(world.app, {
        ...BASE[19],
        jar: await mintJar({ stepUpAt }),
      });
      expect(response.status).toBe(200);
    }
  });
});
