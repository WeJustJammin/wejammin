import { describe, expect, it } from 'vitest';

import {
  createSchemaMigrationWorker,
  SCHEMA_MIGRATION_RPC,
} from './migration-worker';
import type { MigrationWorkerTelemetryEvent } from './migration-worker-types';
import {
  basePlan,
  event,
  makePort,
  NOW,
} from './migration-worker-test-support';

const CLAIM_TOKEN = '83000000-0000-4000-8000-000000000003';

const blockedEventPort = () =>
  makePort({
    [SCHEMA_MIGRATION_RPC.claimEvent]: () => ({ status: 'new' }),
    [SCHEMA_MIGRATION_RPC.readPlan]: () => basePlan({ state: 'draft' }),
    [SCHEMA_MIGRATION_RPC.claimLease]: () => ({
      acquired: true,
      leaseToken: 'plan-lease',
      plan: basePlan({ state: 'dry_running' }),
    }),
    [SCHEMA_MIGRATION_RPC.heartbeatLease]: () => ({ renewed: true }),
    [SCHEMA_MIGRATION_RPC.processDryRunBatch]: () => ({
      done: true,
      cursor: '100',
      progress: 1,
      sourceCount: '100',
      targetCount: '100',
      rowErrorCount: '0',
      migratedCount: '100',
      failedCount: '0',
    }),
    [SCHEMA_MIGRATION_RPC.finalizeDryRun]: () =>
      basePlan({ state: 'blocked', progress: 0.5 }),
    [SCHEMA_MIGRATION_RPC.releaseEvent]: () => ({ released: true }),
  });

describe('BE03a cms_migration_blocked_total for a queue event', () => {
  it('reports the blocked event with its age since occurredAt, measured on the worker clock', async () => {
    const events: MigrationWorkerTelemetryEvent[] = [];
    const worker = createSchemaMigrationWorker({
      port: blockedEventPort(),
      workerId: 'worker-blocked-event',
      now: () => NOW,
      eventClaimTokenFactory: () => CLAIM_TOKEN,
      telemetry: (entry) => {
        events.push(entry);
      },
    });

    await expect(worker.process(event)).resolves.toMatchObject({
      outcome: 'blocked',
      reasonCode: 'MIGRATION_BLOCKED',
    });

    const blocked = events.filter((entry) => entry.outcome === 'blocked');
    expect(blocked).toHaveLength(1);
    expect(blocked[0]).toMatchObject({
      eventId: event.eventId,
      correlationId: event.correlationId,
      // occurredAt is 11:59:00, the worker clock reads 12:00:00.
      durationMs: 60_000,
    });
  });
});
