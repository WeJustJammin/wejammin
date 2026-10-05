import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOW,
  SHAPES,
  createWorld,
  expectApiError,
  json,
  mintJar,
  send,
} from '../authentication/dec111-composition.test-support';
import {
  BODY,
  KEY,
  PATH,
  handlers,
  names,
} from './phase-02-slice-09-cfg05b06-wire.test-support';

/**
 * AC936: CFG-05B-06 answers 401 UNAUTHENTICATED for an EXPIRED session. The
 * expired session is produced the way production sees it (an access token past
 * its own `exp`, and a token the identity provider rejects), through the
 * production Worker composition; no stub answers 401 on request.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const attempt = async (
  world: ReturnType<typeof createWorld>,
  accessClaims?: Record<string, unknown>,
) =>
  send(world.app, {
    method: 'POST',
    path: PATH,
    body: BODY,
    jar: await mintJar(accessClaims === undefined ? {} : { accessClaims }),
    headers: { 'idempotency-key': KEY },
  });

const reauthenticate = {
  status: 401,
  code: 'UNAUTHENTICATED',
  shape: SHAPES.reauthenticate,
};

describe('CFG-05B-06 401 UNAUTHENTICATED for an expired session', () => {
  it('[P2-S09-AC-936] an access token past its exp is a 401 reauthenticate with no reservation RPC, no provider call and no rate bucket', async () => {
    const world = createWorld({ handlers: handlers() });
    await expectApiError(
      await attempt(world, { exp: Math.floor(NOW / 1000) - 60 }),
      reauthenticate,
    );
    expect(names(world.calls)).not.toContain('admin_mfa_factor_reset');
    expect(names(world.calls)).not.toContain('auth_rate_limit');
    expect(
      world.calls.filter((call) => call.path.includes('/admin/')),
    ).toStrictEqual([]);
  });

  it('[P2-S09-AC-936] a token the identity provider rejects as expired or revoked is a 401 reauthenticate with no reservation RPC', async () => {
    const world = createWorld({
      handlers: handlers({
        'GET /auth/v1/user': () => json({ msg: 'JWT expired', code: 401 }, 401),
      }),
    });
    await expectApiError(await attempt(world), reauthenticate);
    expect(names(world.calls)).not.toContain('admin_mfa_factor_reset');
  });

  it('[P2-S09-AC-936] control: the same request with an unexpired token is not refused as UNAUTHENTICATED, so the 401 above is the expiry', async () => {
    const world = createWorld({ handlers: handlers() });
    const response = await attempt(world);
    expect(((await response.json()) as { code: string }).code).not.toBe(
      'UNAUTHENTICATED',
    );
  });
});
