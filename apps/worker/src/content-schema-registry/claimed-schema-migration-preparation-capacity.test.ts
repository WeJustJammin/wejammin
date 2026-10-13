/**
 * DEC-184 / BE03a "Preparation delivery budget": with page size 128 and `m` batches per invocation a
 * preparation of N source rows needs `2 x ceil(ceil(N / 128) / m) - 1` deliveries (1 for N = 0), so it
 * completes within the four BE00 deliveries only when N <= 256 x m. The real worker stages run against the
 * plan model of the simulator (page size, CAS and transitions follow the documented RPC contract).
 */
import { describe, expect, it } from 'vitest';

import { createClaimedSchemaMigrationPreparation } from './claimed-schema-migration-preparation';
import {
  createPlanSimulator,
  SIM_WORKER,
} from './claimed-schema-migration-preparation-sim.test-support';

const MAX_DELIVERIES = 4;
const PAGE = 128;
const formula = (rows: number, batches: number): number =>
  rows === 0 ? 1 : 2 * Math.ceil(Math.ceil(rows / PAGE) / batches) - 1;

const prepare = async (rows: number, batches: number) => {
  const sim = createPlanSimulator({ rows });
  const worker = createClaimedSchemaMigrationPreparation({
    port: sim.port,
    workerId: SIM_WORKER,
    now: () => 1_000_000,
    leaseDurationMs: 30_000,
    maxBatchRows: PAGE,
    maxBatchesPerInvocation: batches,
  });
  let deliveries = 0;
  let outcome = 'progress';
  while (outcome === 'progress' && deliveries < 40) {
    deliveries += 1;
    const result = await worker.process(sim.input(), {
      signal: new AbortController().signal,
      attempt: deliveries,
    });
    if (result.kind !== 'processed')
      throw new Error(`unexpected ${result.kind}`);
    outcome = result.result.outcome;
  }
  return { deliveries, outcome, sim };
};

describe('[P2-S12-AC-050] preparation capacity is 256 x maxBatchesPerInvocation source rows (DEC-184)', () => {
  it.each([
    [0, 1, 1],
    [1, 1, 1],
    [128, 1, 1],
    [129, 1, 3],
    [256, 1, 3],
    [257, 1, 5],
    [300, 1, 5],
    [1000, 1, 15],
    [300, 2, 3],
    [512, 2, 3],
    [513, 2, 5],
    [1000, 2, 7],
    [300, 4, 1],
    [1000, 4, 3],
    [1024, 4, 3],
    [1025, 4, 5],
    [8192, 32, 3],
    [8193, 32, 5],
  ])(
    '%s rows with %s batches per invocation complete in %s deliveries',
    async (rows, batches, expected) => {
      const { deliveries, outcome, sim } = await prepare(rows, batches);
      expect(outcome).toBe('completed');
      // The DEC-162 first-empty baseline is sealed `ready` and reported completed without a backfill.
      expect(sim.plan().state).toBe(rows === 0 ? 'ready' : 'completed');
      expect(deliveries).toBe(expected);
      expect(deliveries).toBe(formula(rows, batches));
      // The BE03a ceiling: within the four BE00 deliveries exactly when rows <= 256 x batches.
      expect(deliveries <= MAX_DELIVERIES).toBe(rows <= 256 * batches);
    },
  );
});
