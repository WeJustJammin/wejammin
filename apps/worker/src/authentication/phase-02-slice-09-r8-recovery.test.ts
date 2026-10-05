import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOW,
  createWorld,
  mintJar,
  providerCalls,
  rpcNames,
  send,
} from './dec111-composition.test-support';
import { FRESH, MFA_AMR } from './phase-02-slice-09-r8.test-support';

/**
 * R8 remediation of AC890 and AC1142: a person who lost every verified factor
 * has no recovery code, support bypass, self-service reset or operator reset
 * outside CFG-05B-06. Each alternative route is probed through the real
 * production composition with a fresh aal2 MFA session (the most privileged
 * caller a bypass could trust) and must be an exact 404 that reaches neither
 * the database nor the provider.
 */
const ABSENT_ROUTES = [
  ['GET', '/api/v1/account/mfa/recovery-codes'],
  ['POST', '/api/v1/account/mfa/recovery-codes'],
  ['POST', '/api/v1/account/mfa/recovery-codes/redeem'],
  ['POST', '/api/v1/auth/mfa/recovery'],
  ['POST', '/api/v1/auth/step-up/bypass'],
  ['POST', '/api/v1/account/mfa/factors/reset'],
  ['POST', '/api/v1/support/mfa-factor-resets'],
  ['POST', '/api/v1/admin/mfa-factor-resets'],
] as const;
const BASELINE_RPCS: readonly string[] = [
  'auth_session_read',
  'auth_rate_limit',
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('no recovery code, support bypass or self-service factor reset exists', () => {
  it.each(ABSENT_ROUTES)(
    '[P2-S09-AC-890][P2-S09-AC-1142] %s %s is exactly 404',
    async (method, path) => {
      const world = createWorld();
      const response = await send(world.app, {
        method,
        path,
        body: {},
        jar: await mintJar({
          stepUpAt: FRESH,
          accessClaims: { aal: 'aal2', amr: MFA_AMR },
        }),
        headers: { 'idempotency-key': 'r8-recovery-probe-001' },
      });
      expect(response.status).toBe(404);
    },
  );

  it.each(ABSENT_ROUTES)(
    '[P2-S09-AC-890][P2-S09-AC-1142] %s %s reaches no operation RPC',
    async (method, path) => {
      const world = createWorld();
      await send(world.app, {
        method,
        path,
        body: {},
        jar: await mintJar({
          stepUpAt: FRESH,
          accessClaims: { aal: 'aal2', amr: MFA_AMR },
        }),
        headers: { 'idempotency-key': 'r8-recovery-probe-001' },
      });
      expect(
        rpcNames(world.calls).filter((name) => !BASELINE_RPCS.includes(name)),
      ).toStrictEqual([]);
    },
  );

  it.each(ABSENT_ROUTES)(
    '[P2-S09-AC-890][P2-S09-AC-1142] %s %s makes no provider call',
    async (method, path) => {
      const world = createWorld();
      await send(world.app, {
        method,
        path,
        body: {},
        jar: await mintJar({
          stepUpAt: FRESH,
          accessClaims: { aal: 'aal2', amr: MFA_AMR },
        }),
        headers: { 'idempotency-key': 'r8-recovery-probe-001' },
      });
      expect(providerCalls(world.calls)).toStrictEqual([]);
    },
  );
});
