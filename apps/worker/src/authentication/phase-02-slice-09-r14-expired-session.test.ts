import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOW,
  SHAPES,
  createWorld,
  expectApiError,
  json,
  mintJar,
  providerCalls,
  send,
} from './dec111-composition.test-support';
import {
  BASE,
  type OperationNumber,
} from './dec111-wire-scenarios.test-support';

/**
 * AUTH-API-16..21 answer 401 UNAUTHENTICATED with `recoveryAction:
 * reauthenticate` for an EXPIRED session. The expired session is produced the
 * way production sees it, never by a stub that answers 401: an access token
 * whose own `exp` has passed (no provider round trip is needed), and a token
 * the identity provider no longer accepts (an expired or revoked session).
 * Everything runs through the production composition (real routes, session
 * verifier, MFA service and persistence adapter); only the PostgREST and
 * Supabase Auth HTTP endpoints are faked.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const ROWS: readonly (readonly [OperationNumber, number])[] = [
  [16, 726],
  [17, 753],
  [18, 780],
  [19, 811],
  [20, 841],
  [21, 867],
];

const EXPIRED_EXP = Math.floor(NOW / 1000) - 60;
const reauthenticate = {
  status: 401,
  code: 'UNAUTHENTICATED',
  shape: SHAPES.reauthenticate,
};
const operationRpcs = (world: ReturnType<typeof createWorld>) =>
  world.calls
    .map((call) => call.rpc)
    .filter(
      (rpc) =>
        rpc !== null &&
        rpc !== 'auth_session_read' &&
        !rpc.startsWith('auth_rate_limit'),
    );

describe('AUTH-API-16..21 401 UNAUTHENTICATED for an expired session', () => {
  for (const [op, criterion] of ROWS) {
    it(`[P2-S09-AC-${criterion}] AUTH-API-${op} an access token past its exp is a 401 reauthenticate with no provider call, no operation RPC and no rate bucket`, async () => {
      const world = createWorld();
      const response = await send(world.app, {
        ...BASE[op],
        jar: await mintJar({ accessClaims: { exp: EXPIRED_EXP } }),
      });
      await expectApiError(response, reauthenticate);
      expect(providerCalls(world.calls)).toStrictEqual([]);
      expect(
        world.calls.filter((call) => call.path === '/auth/v1/user'),
      ).toHaveLength(0);
      expect(operationRpcs(world)).toStrictEqual([]);
      expect(
        world.calls.filter((call) => call.rpc === 'auth_rate_limit'),
      ).toStrictEqual([]);
    });

    it(`[P2-S09-AC-${criterion}] AUTH-API-${op} a token the identity provider rejects as expired or revoked is a 401 reauthenticate with no operation RPC`, async () => {
      const world = createWorld({
        handlers: {
          'GET /auth/v1/user': () =>
            json({ msg: 'JWT expired', code: 401 }, 401),
        },
      });
      const response = await send(world.app, {
        ...BASE[op],
        jar: await mintJar(),
      });
      await expectApiError(response, reauthenticate);
      expect(operationRpcs(world)).toStrictEqual([]);
    });

    it(`[P2-S09-AC-${criterion}] AUTH-API-${op} control: the same request with an unexpired token is not refused as UNAUTHENTICATED, so the 401 above is the expiry`, async () => {
      const world = createWorld();
      const response = await send(world.app, {
        ...BASE[op],
        jar: await mintJar(),
      });
      const body = (await response.json()) as { code: string };
      expect(body.code).not.toBe('UNAUTHENTICATED');
    });
  }
});
