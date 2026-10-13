/**
 * DEC-183 reachability (design fact F3): on the claimed path the event is always null and the purpose is
 * `dry_run`, so a worker result is only ever `completed`, `progress`, `retry`, `blocked` or
 * `failed_terminal`. `duplicate`, `stale` and `dead_letter` need a queue event and `failed_retryable` needs a
 * retryable rollback that no stage requests. The mapper still answers those four fail-closed; this test
 * pins that the claimed entry cannot produce them, over every worker RPC failing once, twice or thrice with a
 * retryable and a non-retryable refusal, from every plan state, at zero and a few source rows.
 */
import { describe, expect, it } from 'vitest';

import { createClaimedSchemaMigrationPreparation } from './claimed-schema-migration-preparation';
import {
  createPlanSimulator,
  SIM_WORKER,
} from './claimed-schema-migration-preparation-sim.test-support';
import {
  MIGRATION_STATES,
  SCHEMA_MIGRATION_RPC,
} from './migration-worker-constants';

const REACHABLE = new Set([
  'completed',
  'progress',
  'retry',
  'blocked',
  'failed_terminal',
]);
const retryable = Object.assign(new Error('x'), {
  code: 'DEPENDENCY_UNAVAILABLE',
  retryable: true,
});
const terminal = Object.assign(new Error('x'), {
  code: 'VALIDATION_FAILED',
  retryable: false,
});

describe('[P2-S12-AC-050] reachable worker outcomes on the claimed path (F3)', () => {
  it('only completed, progress, retry, blocked and failed_terminal are produced', async () => {
    const seen = new Set<string>();
    let runs = 0;
    for (const rows of [0, 3]) {
      for (const state of MIGRATION_STATES) {
        for (const rpc of Object.values(SCHEMA_MIGRATION_RPC)) {
          for (const nth of [1, 2, 3]) {
            for (const error of [retryable, terminal]) {
              const sim = createPlanSimulator({
                rows,
                state,
                holdLease: state !== 'draft',
                cursor: state === 'running' || state === 'verifying' ? rows : 0,
              });
              sim.fail({ rpc, nth, error });
              const worker = createClaimedSchemaMigrationPreparation({
                port: sim.port,
                workerId: SIM_WORKER,
                now: () => 1_000_000,
                leaseDurationMs: 30_000,
                maxBatchRows: 1,
                maxBatchesPerInvocation: 2,
              });
              const result = await worker.process(sim.input(), {
                signal: new AbortController().signal,
                attempt: 1,
              });
              runs += 1;
              if (result.kind === 'processed') seen.add(result.result.outcome);
            }
          }
        }
      }
    }
    expect(runs).toBeGreaterThan(1000);
    expect([...seen].filter((outcome) => !REACHABLE.has(outcome))).toEqual([]);
    // The sweep is not vacuous: it reaches the retry, blocked, failed_terminal and completed branches.
    expect(seen).toEqual(new Set(REACHABLE).add('progress'));
  }, 120_000);
});
