import { describe, expect, it, vi } from 'vitest';

import {
  createSchemaMigrationWorker,
  SCHEMA_MIGRATION_RPC,
  type MigrationPlanRecord,
  type MigrationWorkerPort,
  type SchemaMigrationRpcName,
} from './migration-worker';
import { emptySourcePage } from './migration-worker-test-support';

const CONTENT_TYPE_ID = '10000000-0000-4000-8000-000000000001';
const OLD_VERSION_ID = '20000000-0000-4000-8000-000000000002';
const TARGET_VERSION_ID = '30000000-0000-4000-8000-000000000003';
const PLAN_ID = '40000000-0000-4000-8000-000000000004';
const CORRELATION_ID = '60000000-0000-4000-8000-000000000006';
const HASH = 'a'.repeat(64);
const TARGET_HASH = 'b'.repeat(64);
const JOB = {
  schemaVersionId: TARGET_VERSION_ID,
  migrationPlanId: PLAN_ID,
  expectedVersion: '3',
  correlationId: CORRELATION_ID,
  causationId: null,
} as const;

const plan = (
  overrides: Partial<MigrationPlanRecord> = {},
): MigrationPlanRecord => ({
  id: PLAN_ID,
  contentTypeId: CONTENT_TYPE_ID,
  fromVersionId: OLD_VERSION_ID,
  toVersionId: TARGET_VERSION_ID,
  state: 'ready',
  version: '3',
  cursor: '0',
  progress: 0,
  sourceCount: '100',
  targetCount: '0',
  rowErrorCount: '0',
  migratedCount: '0',
  failedCount: '0',
  classification: 'breaking',
  transformKey: 'identity.revalidate',
  transformVersion: '1',
  compilerHash: HASH,
  sourceHash: HASH,
  targetHash: TARGET_HASH,
  activeVersionId: OLD_VERSION_ID,
  leaseOwner: null,
  leaseToken: null,
  leaseExpiresAt: null,
  ...overrides,
});

type Handler = (request: unknown) => unknown | Promise<unknown>;

const portFor = (
  handlers: Partial<Record<SchemaMigrationRpcName, Handler>>,
): MigrationWorkerPort & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    call: vi.fn(async (rpc: SchemaMigrationRpcName, request: unknown) => {
      calls.push(rpc);
      return (
        handlers[rpc]?.(request) ??
        (rpc === SCHEMA_MIGRATION_RPC.readSourceRows
          ? emptySourcePage(request)
          : {})
      );
    }),
  };
};

describe('schema migration recovery paths', () => {
  it('[P2-S09-AC-188] claims an expired dry-run lease, resumes its cursor, and continues through backfill', async () => {
    const port = portFor({
      [SCHEMA_MIGRATION_RPC.readPlan]: () =>
        plan({ state: 'dry_running', cursor: '42', version: '3' }),
      [SCHEMA_MIGRATION_RPC.claimLease]: () => ({
        acquired: true,
        leaseToken: 'lease-resumed',
        plan: plan({ state: 'dry_running', cursor: '42', version: '4' }),
      }),
      [SCHEMA_MIGRATION_RPC.heartbeatLease]: () => ({ renewed: true }),
      [SCHEMA_MIGRATION_RPC.processDryRunBatch]: () => ({
        done: true,
        cursor: '100',
        progress: 1,
        sourceCount: '100',
        targetCount: '100',
        rowErrorCount: '0',
        migratedCount: '0',
        failedCount: '0',
      }),
      [SCHEMA_MIGRATION_RPC.finalizeDryRun]: () =>
        plan({ state: 'ready', cursor: '100', version: '5', progress: 1 }),
      [SCHEMA_MIGRATION_RPC.processBatch]: () => ({
        done: true,
        cursor: '100',
        progress: 1,
        sourceCount: '100',
        targetCount: '100',
        rowErrorCount: '0',
        migratedCount: '100',
        failedCount: '0',
      }),
      [SCHEMA_MIGRATION_RPC.beginVerification]: () =>
        plan({ state: 'verifying', cursor: '100', version: '6', progress: 1 }),
      [SCHEMA_MIGRATION_RPC.verify]: () => ({ valid: true }),
      [SCHEMA_MIGRATION_RPC.complete]: () =>
        plan({ state: 'completed', cursor: '100', version: '7', progress: 1 }),
      [SCHEMA_MIGRATION_RPC.activate]: () => ({ activated: true }),
    });
    const worker = createSchemaMigrationWorker({
      port,
      workerId: 'recovery-worker',
      now: () => Date.parse('2026-09-02T12:00:00.000Z'),
    });

    await expect(worker.process(JOB)).resolves.toMatchObject({
      outcome: 'completed',
      activationSwitched: true,
    });
    expect(port.calls).toEqual([
      SCHEMA_MIGRATION_RPC.readPlan,
      SCHEMA_MIGRATION_RPC.claimLease,
      SCHEMA_MIGRATION_RPC.heartbeatLease,
      SCHEMA_MIGRATION_RPC.readSourceRows,
      SCHEMA_MIGRATION_RPC.processDryRunBatch,
      SCHEMA_MIGRATION_RPC.finalizeDryRun,
      SCHEMA_MIGRATION_RPC.heartbeatLease,
      SCHEMA_MIGRATION_RPC.readSourceRows,
      SCHEMA_MIGRATION_RPC.processBatch,
      SCHEMA_MIGRATION_RPC.beginVerification,
      SCHEMA_MIGRATION_RPC.verify,
      SCHEMA_MIGRATION_RPC.complete,
      SCHEMA_MIGRATION_RPC.activate,
    ]);
  });

  it('rolls back instead of accepting a regressing durable cursor', async () => {
    const port = portFor({
      [SCHEMA_MIGRATION_RPC.readPlan]: () => plan({ cursor: '5' }),
      [SCHEMA_MIGRATION_RPC.claimLease]: () => ({
        acquired: true,
        leaseToken: 'lease-regression',
        plan: plan({ state: 'running', cursor: '5', version: '4' }),
      }),
      [SCHEMA_MIGRATION_RPC.heartbeatLease]: () => ({ renewed: true }),
      [SCHEMA_MIGRATION_RPC.processBatch]: () => ({
        done: false,
        cursor: '4',
        progress: 0.5,
        sourceCount: '100',
        targetCount: '50',
        rowErrorCount: '0',
        migratedCount: '50',
        failedCount: '0',
      }),
      [SCHEMA_MIGRATION_RPC.rollback]: () => ({
        plan: plan({ state: 'failed_terminal', cursor: '5', version: '5' }),
      }),
    });
    const worker = createSchemaMigrationWorker({
      port,
      workerId: 'regression-worker',
      now: () => Date.parse('2026-09-02T12:00:00.000Z'),
    });

    await expect(worker.process(JOB)).resolves.toMatchObject({
      outcome: 'failed_terminal',
      reasonCode: 'MIGRATION_CURSOR_REGRESSION',
    });
    expect(port.calls.at(-1)).toBe(SCHEMA_MIGRATION_RPC.rollback);
  });
});
