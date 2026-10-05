import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOW,
  createWorld,
  expectApiError,
  mintJar,
  providerCalls,
  rpcRefusal,
  send,
} from './dec111-composition.test-support';
import {
  BASE,
  FIRST_RPC,
  PROVIDER_CALL,
  providerDown,
  type OperationNumber,
} from './dec111-wire-scenarios.test-support';

/**
 * AUTH-API-18..21 503 DEPENDENCY_UNAVAILABLE for each unavailable dependency
 * the criterion names (provider, circuit, database), through the production
 * Worker composition: real routes, session verifier, MFA service, persistence
 * adapter and Supabase MFA provider. Only the PostgREST and Supabase Auth HTTP
 * endpoints are faked. AUTH-API-17 is covered in r8-settle-recovery.
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
  [18, 789],
  [19, 820],
  [20, 850],
  [21, 876],
];

const unavailable = (dependencyClass: string) => ({
  status: 503,
  code: 'DEPENDENCY_UNAVAILABLE',
  shape: { exact: { dependencyClass, retryable: true } },
});

describe('AUTH-API-18..21 503 DEPENDENCY_UNAVAILABLE for provider, circuit and database', () => {
  for (const [op, criterion] of ROWS) {
    const providerKey = PROVIDER_CALL[op] as string;
    const call = async (world: ReturnType<typeof createWorld>) =>
      send(world.app, { ...BASE[op], jar: await mintJar() });

    it(`[P2-S09-AC-${criterion}] AUTH-API-${op} an unavailable database answers 503 with the identity_persistence details and calls no provider`, async () => {
      const world = createWorld({
        handlers: { [FIRST_RPC[op]]: () => rpcRefusal('boom', 500) },
      });
      await expectApiError(
        await call(world),
        unavailable('identity_persistence'),
      );
      expect(providerCalls(world.calls)).toStrictEqual([]);
    });

    it(`[P2-S09-AC-${criterion}] AUTH-API-${op} an unavailable provider answers 503 with the identity_provider details`, async () => {
      const world = createWorld({ handlers: { [providerKey]: providerDown } });
      await expectApiError(await call(world), unavailable('identity_provider'));
    });

    it(`[P2-S09-AC-${criterion}] AUTH-API-${op} an open provider circuit answers 503 with the identity_provider details and sends no provider request`, async () => {
      const world = createWorld({ handlers: { [providerKey]: providerDown } });
      for (let index = 0; index < 5; index += 1) await call(world);
      const before = providerCalls(world.calls).length;
      await expectApiError(await call(world), unavailable('identity_provider'));
      expect(providerCalls(world.calls)).toHaveLength(before);
    });
  }
});
