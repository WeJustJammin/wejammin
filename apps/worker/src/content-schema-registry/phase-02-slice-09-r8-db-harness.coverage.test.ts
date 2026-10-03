import { describe, expect, it } from 'vitest';

import { json } from './production-test-support';
import { idempotentDb, type RpcCall } from './phase-02-slice-09-r8-db-harness';

const call = (overrides: Partial<RpcCall>): RpcCall => ({
  rpc: 'cms_rpc',
  actor: '10000000-0000-4000-8000-000000000001',
  idempotencyKey: 'key-0001',
  request: { value: 1 },
  ...overrides,
});

describe('R8 database harness idempotency binding', () => {
  it('answers a call with no idempotency key from the database without recording a binding', async () => {
    const db = idempotentDb(() => json({ created: true }, 201));
    const first = await db.behaviour(call({ idempotencyKey: null }));
    const second = await db.behaviour(call({ idempotencyKey: null }));
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(db.commits()).toBe(0);
  });

  it('binds a call with no actor on its own (actor, RPC, key) and replays an identical retry', async () => {
    const db = idempotentDb(() => json({ created: true }, 201));
    const first = await db.behaviour(call({ actor: null }));
    const replay = await db.behaviour(call({ actor: null }));
    expect(await replay.json()).toEqual(await first.json());
    expect(db.commits()).toBe(1);
    // A named actor with the same key is a different binding.
    await db.behaviour(call({}));
    expect(db.commits()).toBe(2);
  });
});
