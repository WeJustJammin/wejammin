import { describe, expect, it } from 'vitest';

import { SCHEMA_MIGRATION_RPC as RPC } from './content-schema-registry/migration-worker-constants';
import { productionPreparationFixture } from './production-schema-migration-preparation-test-support';

const rpcUrl = (name: string): string =>
  `https://supabase.example.test/rest/v1/rpc/${name}`;

describe('the production preparation fixture', () => {
  it.each([
    RPC.claimEvent,
    RPC.releaseEvent,
    RPC.acknowledgeEvent,
    RPC.deadLetter,
    RPC.reconcileActivation,
    RPC.rollback,
  ])('refuses %s, which a preparation job never issues', async (name) => {
    const { fetchImpl } = productionPreparationFixture();
    await expect(fetchImpl(rpcUrl(name))).rejects.toThrow(
      `Unexpected protected migration RPC: ${name}`,
    );
  });

  it('still answers the plan read it scripts', async () => {
    const { fetchImpl, initial } = productionPreparationFixture();
    const response = await fetchImpl(rpcUrl(RPC.readPlan));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(JSON.parse(JSON.stringify(initial)));
  });
});
