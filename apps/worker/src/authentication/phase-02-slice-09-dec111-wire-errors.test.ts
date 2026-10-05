import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  countingRateLimiter,
  createWorld,
  expectApiError,
  mintJar,
  NOW,
  send,
} from './dec111-composition.test-support';
import {
  BASE,
  CSRF_SCENARIOS,
  SCENARIOS,
  type Scenario,
} from './dec111-wire-scenarios.test-support';

/**
 * AUTH-API-16..21 error matrix through the production Worker composition:
 * Hono routes, authentication dependencies, MFA service, persistence adapter
 * and Supabase MFA provider. Only the PostgREST and Supabase Auth HTTP
 * endpoints are faked. Each row asserts the BE00 ApiError envelope and the
 * strict details row of its status.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const run = async (scenario: Scenario) => {
  const world = createWorld({
    handlers: {
      ...(scenario.exhaust === undefined
        ? {}
        : { auth_rate_limit: countingRateLimiter() }),
      ...scenario.handlers,
    },
  });
  const base = { ...BASE[scenario.op], jar: await mintJar() };
  const spec = scenario.send === undefined ? base : await scenario.send(base);
  for (let n = 0; n < (scenario.exhaust ?? 0); n += 1)
    await send(world.app, spec);
  const handle = scenario.arrange?.();
  try {
    const response = await send(world.app, spec);
    return { response, world };
  } finally {
    handle?.restore();
  }
};

const operationName = (op: number): string => `AUTH-API-${op}`;

describe('DEC-111 wire error matrix (production composition)', () => {
  for (const scenario of [...SCENARIOS, ...CSRF_SCENARIOS]) {
    it(`[P2-S09-AC-${scenario.criterion}] ${operationName(scenario.op)} ${scenario.title}`, async () => {
      const { response, world } = await run(scenario);
      await expectApiError(response, {
        status: scenario.status,
        code: scenario.code,
        shape: scenario.shape,
      });
      if (scenario.status === 429) {
        expect(response.headers.get('ratelimit-limit')).not.toBeNull();
        expect(response.headers.get('retry-after')).not.toBeNull();
      }
      if (scenario.code === 'STEP_UP_REQUIRED')
        expect(
          world.calls.some(
            (call) =>
              call.rpc !== null &&
              ![
                'auth_rate_limit',
                'auth_session_read',
                'auth_mfa_factors_read',
              ].includes(call.rpc),
          ),
        ).toBe(false);
    });
  }
});
