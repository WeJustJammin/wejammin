import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOW,
  bodyOf,
  createWorld,
  factorRow,
  json,
  mintJar,
  pendingRow,
  rpcNames,
  send,
} from './dec111-composition.test-support';
import { BASE } from './dec111-wire-scenarios.test-support';

/**
 * R8 remediation of AC906 (Worker half): after an `identity.mfa-factor.changed.v1`
 * state change the settings and security projection is the AUTH-API-16 read, and
 * a refetch must observe the new state. The production composition keeps no
 * Worker-side copy of the factor list, so each GET reads the database again and
 * never serves a stored response.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const changingDatabase = () => {
  let version = 3;
  let rows: unknown[] = [pendingRow()];
  return {
    change: () => {
      version = 4;
      rows = [factorRow()];
    },
    handlers: {
      auth_mfa_factors_read: () =>
        json({ factors: rows, version: String(version) }),
    },
  };
};

describe('AUTH-API-16 reflects a factor change on the next read', () => {
  it('[P2-S09-AC-906] the second GET after a change returns the new version as ETag and body version', async () => {
    const database = changingDatabase();
    const world = createWorld({ handlers: database.handlers });
    const jar = await mintJar();
    const before = await send(world.app, { ...BASE[16], jar });
    database.change();
    const after = await send(world.app, { ...BASE[16], jar });
    expect([
      before.headers.get('etag'),
      after.headers.get('etag'),
      (await bodyOf(after)).version,
    ]).toStrictEqual(['"3"', '"4"', '4']);
  });

  it('[P2-S09-AC-906] the second GET after a change returns the new factor state', async () => {
    const database = changingDatabase();
    const world = createWorld({ handlers: database.handlers });
    const jar = await mintJar();
    await send(world.app, { ...BASE[16], jar });
    database.change();
    const after = await bodyOf(await send(world.app, { ...BASE[16], jar }));
    expect(
      (after.factors as { state: string }[]).map((factor) => factor.state),
    ).toStrictEqual(['verified']);
  });

  it('[P2-S09-AC-906] every GET reads the database once and is never served from a stored response', async () => {
    const database = changingDatabase();
    const world = createWorld({ handlers: database.handlers });
    const jar = await mintJar();
    for (let read = 0; read < 3; read += 1)
      await send(world.app, { ...BASE[16], jar });
    expect(
      rpcNames(world.calls).filter((name) => name === 'auth_mfa_factors_read'),
    ).toHaveLength(3);
  });

  it('[P2-S09-AC-906] the response forbids intermediary and browser caching so a refetch is never answered from a cache', async () => {
    const world = createWorld({ handlers: changingDatabase().handlers });
    const response = await send(world.app, {
      ...BASE[16],
      jar: await mintJar(),
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
