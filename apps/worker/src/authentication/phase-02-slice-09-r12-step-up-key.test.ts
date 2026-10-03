import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOW,
  bodyOf,
  createWorld,
  iso,
  mintJar,
  providerCalls,
  rpcNames,
  send,
} from './dec111-composition.test-support';
import { BASE } from './dec111-wire-scenarios.test-support';

/**
 * AC1031 worker half for AUTH-API-17, -19, -20 and -21 (DEC-111): the step-up
 * check runs before any reservation, so a refused command leaves no idempotency
 * or persistence state and the same request (the same Idempotency-Key where the
 * route has one) succeeds once the proof is fresh. AUTH-API-20 and -21 are the
 * recovery itself: no step-up precondition and no client key, so the recovery
 * can never ask for the recovery it is providing.
 */

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const STEP_UP_DETAILS = { recoveryAction: 'step_up', allowedMethods: ['totp'] };
const stale = () => mintJar({ stepUpAt: iso(-601) });

describe('[P2-S09-AC-1031] AUTH-API-19 factor removal step-up recovery', () => {
  it('[P2-S09-AC-1031] refuses a stale proof with the exact step_up details, reserves nothing, and the same Idempotency-Key then removes once', async () => {
    const world = createWorld();
    const key = BASE[19].headers?.['idempotency-key'];
    expect(typeof key).toBe('string');
    const refused = await send(world.app, { ...BASE[19], jar: await stale() });
    expect(refused.status).toBe(401);
    const body = await bodyOf(refused);
    expect(body.code).toBe('STEP_UP_REQUIRED');
    expect(body.details).toEqual(STEP_UP_DETAILS);
    expect(rpcNames(world.calls)).not.toContain('auth_mfa_removal_begin');
    expect(providerCalls(world.calls)).toStrictEqual([]);

    const retried = await send(world.app, {
      ...BASE[19],
      jar: await mintJar({ stepUpAt: iso(-60) }),
    });
    expect(retried.status).toBe(200);
    const begins = world.calls.filter(
      (call) => call.rpc === 'auth_mfa_removal_begin',
    );
    expect(begins).toHaveLength(1);
    expect(String(begins[0]?.body?.p_key_hash)).toMatch(/^[0-9a-f\\x]{16,}/u);
    expect(JSON.stringify(begins[0]?.body)).not.toContain(key as string);
  });
});

describe('[P2-S09-AC-1031] AUTH-API-17 enrollment start step-up recovery', () => {
  it('[P2-S09-AC-1031] refuses a stale proof (a verified factor exists) with the exact step_up details and no enrollment, then the identical key-less request enrolls', async () => {
    const world = createWorld();
    expect(BASE[17].headers?.['idempotency-key']).toBeUndefined();
    const refused = await send(world.app, { ...BASE[17], jar: await stale() });
    expect(refused.status).toBe(401);
    const body = await bodyOf(refused);
    expect(body.code).toBe('STEP_UP_REQUIRED');
    expect(body.details).toEqual(STEP_UP_DETAILS);
    expect(rpcNames(world.calls)).not.toContain('auth_mfa_enrollment_begin');
    expect(providerCalls(world.calls)).toStrictEqual([]);

    const retried = await send(world.app, {
      ...BASE[17],
      jar: await mintJar({ stepUpAt: iso(-60) }),
    });
    expect(retried.status).toBe(201);
    expect(
      world.calls.filter((call) => call.rpc === 'auth_mfa_enrollment_begin'),
    ).toHaveLength(1);
  });
});

describe('[P2-S09-AC-1031] AUTH-API-20 and AUTH-API-21 are the recovery and need no step-up', () => {
  it('[P2-S09-AC-1031] AUTH-API-20 answers 201 for a session with no or a stale proof and carries no Idempotency-Key', async () => {
    expect(BASE[20].headers?.['idempotency-key']).toBeUndefined();
    for (const jar of [
      await mintJar({ stepUpAt: null }),
      await mintJar({ stepUpAt: iso(-601) }),
    ]) {
      const world = createWorld();
      const response = await send(world.app, { ...BASE[20], jar });
      expect(response.status).toBe(201);
      expect(JSON.stringify(await bodyOf(response))).not.toContain(
        'STEP_UP_REQUIRED',
      );
    }
  });

  it('[P2-S09-AC-1031] AUTH-API-21 verifies for a session with no or a stale proof and carries no Idempotency-Key', async () => {
    expect(BASE[21].headers?.['idempotency-key']).toBeUndefined();
    for (const jar of [
      await mintJar({ stepUpAt: null }),
      await mintJar({ stepUpAt: iso(-601) }),
    ]) {
      const world = createWorld();
      const response = await send(world.app, { ...BASE[21], jar });
      expect(response.status).toBe(200);
      expect((await bodyOf(response)).verified).toBe(true);
    }
  });
});
