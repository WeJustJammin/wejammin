import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createWorld,
  mintJar,
  NOW,
  providerCalls,
  send,
} from '../authentication/dec111-composition.test-support';
import { TARGET_ID } from './phase-02-slice-08-worker.test-support';
import {
  BODY,
  CAPABILITY,
  KEY,
  PATH,
  REMOVE_A,
  REMOVE_B,
  handlers,
  names,
  post,
} from './phase-02-slice-09-cfg05b06-wire.test-support';

/** CFG-05B-06 request contract and shared MFA breaker, through the production composition. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('CFG-05B-06 request contract and breaker (production composition)', () => {
  it('[P2-S09-AC-920][P2-S09-AC-935] rejects operator, organization, capability and step-up keys as 400 INVALID_REQUEST', async () => {
    for (const extra of [
      { operatorPersonId: TARGET_ID },
      { organizationId: TARGET_ID },
      { capability: CAPABILITY },
      { stepUpAt: new Date(NOW).toISOString() },
    ]) {
      const { world, response } = await post(
        {},
        { body: { ...BODY, ...extra } },
      );
      expect(response.status).toBe(400);
      expect(((await response.json()) as { code: string }).code).toBe(
        'INVALID_REQUEST',
      );
      expect(names(world.calls)).not.toContain('admin_mfa_factor_reset');
    }
  });

  it('[P2-S09-AC-921] rejects a malformed or non-UUID targetPersonId', async () => {
    for (const targetPersonId of ['someone', '', 42, [TARGET_ID], null]) {
      const { world, response } = await post(
        {},
        { body: { ...BODY, targetPersonId } },
      );
      expect(response.status).toBe(400);
      expect(names(world.calls)).not.toContain('admin_mfa_factor_reset');
    }
  });

  it('[P2-S09-AC-922] requires a reason of 1 to 512 characters, rejecting an empty reason and a 513-character reason and accepting 1 and 512', async () => {
    for (const reason of [undefined, '', '   ', 'r'.repeat(513)]) {
      const { world, response } = await post(
        {},
        {
          body: {
            targetPersonId: TARGET_ID,
            ...(reason === undefined ? {} : { reason }),
          },
        },
      );
      expect(response.status).toBe(400);
      expect(names(world.calls)).not.toContain('admin_mfa_factor_reset');
    }
    for (const reason of ['r', 'r'.repeat(512)]) {
      const { response } = await post(
        {},
        { body: { targetPersonId: TARGET_ID, reason } },
      );
      expect(response.status).toBe(200);
    }
  });

  it('[P2-S09-AC-915] shares the MFA breaker with the user-facing adapter: five user-facing provider failures refuse the operator removal without calling Supabase admin', async () => {
    const world = createWorld({
      handlers: {
        ...handlers(),
        'POST /auth/v1/factors/66666666-6666-4666-8666-666666666666/challenge':
          () => new Response('{}', { status: 500 }),
      },
    });
    const jar = await mintJar();
    for (let index = 0; index < 5; index += 1)
      await send(world.app, {
        method: 'POST',
        path: '/api/v1/auth/step-up/challenges',
        body: { method: 'totp' },
        jar,
      });
    const user = providerCalls(world.calls).filter((call) =>
      call.endsWith('/challenge'),
    );
    expect(user).toHaveLength(5);
    const response = await send(world.app, {
      method: 'POST',
      path: PATH,
      body: BODY,
      jar,
      headers: { 'idempotency-key': KEY },
    });
    expect(response.status).toBe(503);
    expect(((await response.json()) as { code: string }).code).toBe(
      'IDENTITY_UNAVAILABLE',
    );
    expect(
      providerCalls(world.calls).filter((call) => call.includes('/admin/')),
    ).toStrictEqual([]);
  });

  it('[P2-S09-AC-915] shares the MFA breaker in the other direction: operator-adapter failures refuse the user-facing provider calls', async () => {
    const world = createWorld({
      handlers: handlers({
        [REMOVE_A]: () => new Response('{}', { status: 500 }),
        [REMOVE_B]: () => new Response('{}', { status: 500 }),
      }),
    });
    const jar = await mintJar();
    for (let index = 0; index < 3; index += 1)
      await send(world.app, {
        method: 'POST',
        path: PATH,
        body: BODY,
        jar,
        headers: { 'idempotency-key': `${KEY}-${index}` },
      });
    const before = providerCalls(world.calls).length;
    const response = await send(world.app, {
      method: 'POST',
      path: '/api/v1/auth/step-up/challenges',
      body: { method: 'totp' },
      jar,
    });
    expect(response.status).toBe(503);
    expect(providerCalls(world.calls)).toHaveLength(before);
  });

  it('[P2-S09-AC-923] requires an Idempotency-Key and sends no If-Match to the database', async () => {
    const missing = await post({}, { headers: { 'idempotency-key': null } });
    expect(missing.response.status).toBe(400);
    const sent = await post();
    const reserve = sent.world.calls.find(
      (call) => call.rpc === 'admin_mfa_factor_reset',
    );
    expect(reserve?.body).not.toHaveProperty('ifMatch');
    expect(JSON.stringify(reserve?.body)).toContain(KEY);
  });
});
