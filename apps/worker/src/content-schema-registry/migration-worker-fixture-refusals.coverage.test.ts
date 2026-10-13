import { describe, expect, it } from 'vitest';

import { SCHEMA_MIGRATION_RPC as RPC } from './migration-worker-constants';
import { preparationFixture } from './migration-worker-pre-review-purpose-test-support';
import { fixture as sealedLeaseFixture } from './migration-worker-sealed-lease-test-support';

/*
 * These controlled-persistence fixtures answer only the RPCs their scenario scripts and
 * must refuse every other one, so a worker that reaches outside its purpose fails the
 * test that drove it instead of receiving an invented reply.
 */
describe('the pre-review preparation fixture', () => {
  it.each([
    RPC.processDryRunBatch,
    RPC.finalizeDryRun,
    RPC.reconcileActivation,
    RPC.claimEvent,
    RPC.releaseEvent,
    RPC.acknowledgeEvent,
    RPC.deadLetter,
  ])('refuses %s, which a preparation never issues', async (rpc) => {
    const f = preparationFixture();
    await expect(f.call(rpc, {}, f.signal)).rejects.toThrow(
      `Unexpected preparation RPC: ${rpc}`,
    );
  });

  it('still answers the plan read it scripts', async () => {
    const f = preparationFixture();
    await expect(f.call(RPC.readPlan, {}, f.signal)).resolves.toBe(f.ready);
  });
});

describe('the sealed-lease handoff fixture', () => {
  it.each([
    RPC.beginVerification,
    RPC.verify,
    RPC.complete,
    RPC.activate,
    RPC.rollback,
    RPC.claimEvent,
    RPC.acknowledgeEvent,
  ])('refuses %s, which the handoff scenario never issues', async (rpc) => {
    const f = sealedLeaseFixture();
    await expect(f.call(rpc, {}, f.signal)).rejects.toThrow(
      `Unexpected RPC: ${rpc}`,
    );
  });

  it('still answers the dry-run finalize it scripts', async () => {
    const f = sealedLeaseFixture();
    await expect(f.call(RPC.finalizeDryRun, {}, f.signal)).resolves.toBe(
      f.sealed,
    );
  });
});
