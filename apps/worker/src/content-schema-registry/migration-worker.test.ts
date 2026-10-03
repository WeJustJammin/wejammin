import { describe, expect, it, vi } from 'vitest';

import {
  createSchemaMigrationWorker,
  MIGRATION_RETRY_DELAYS_MS,
  SCHEMA_MIGRATION_RPC,
  SchemaMigrationJobPayloadSchema,
  SchemaMigrationQueueEnvelopeSchema,
} from './migration-worker';

import {
  basePlan,
  event,
  EVENT_ID,
  HASH,
  job,
  makePort,
  NOW,
  OLD_VERSION_ID,
  PLAN_ID,
  TARGET_HASH,
} from './migration-worker-test-support';

describe('S09 schema migration worker contract', () => {
  it('accepts bounded identifier-only jobs and rejects extra or oversized payload data', () => {
    expect(SchemaMigrationJobPayloadSchema.safeParse(job).success).toBe(true);
    expect(
      SchemaMigrationJobPayloadSchema.safeParse({
        ...job,
        body: 'private data',
      }),
    ).toMatchObject({ success: false });
    expect(
      SchemaMigrationJobPayloadSchema.safeParse({
        ...job,
        correlationId: 'x'.repeat(17_000),
      }),
    ).toMatchObject({ success: false });
    expect(SchemaMigrationQueueEnvelopeSchema.safeParse(event).success).toBe(
      true,
    );
    expect(
      SchemaMigrationQueueEnvelopeSchema.safeParse({
        ...event,
        schemaVersion: 2,
      }),
    ).toMatchObject({ success: false });
  });

  it('claims a lease with CAS, resumes from the durable cursor, verifies, and switches once', async () => {
    const plans = [basePlan(), basePlan({ state: 'running', cursor: '50' })];
    let readCount = 0;
    const port = makePort({
      [SCHEMA_MIGRATION_RPC.readPlan]: () => plans[Math.min(readCount++, 1)],
      [SCHEMA_MIGRATION_RPC.claimLease]: () => ({
        acquired: true,
        leaseToken: 'lease-1',
        plan: basePlan({ state: 'running', cursor: '50', version: '8' }),
      }),
      [SCHEMA_MIGRATION_RPC.heartbeatLease]: () => ({ renewed: true }),
      [SCHEMA_MIGRATION_RPC.processBatch]: () => ({
        done: true,
        cursor: '100',
        sourceCount: '100',
        targetCount: '100',
        migratedCount: '100',
        failedCount: '0',
        rowErrorCount: '0',
        progress: 1,
      }),
      [SCHEMA_MIGRATION_RPC.beginVerification]: () => ({
        plan: basePlan({
          state: 'verifying',
          cursor: '100',
          version: '9',
          progress: 1,
        }),
      }),
      [SCHEMA_MIGRATION_RPC.verify]: () => ({ valid: true }),
      [SCHEMA_MIGRATION_RPC.complete]: () => ({
        plan: basePlan({
          state: 'completed',
          cursor: '100',
          version: '10',
          progress: 1,
        }),
      }),
      [SCHEMA_MIGRATION_RPC.activate]: () => ({ activated: true }),
    });
    const telemetry = vi.fn();
    const worker = createSchemaMigrationWorker({
      port,
      workerId: 'worker-a',
      now: () => NOW,
      maxBatchesPerInvocation: 2,
      telemetry,
    });

    const result = await worker.process(job);

    expect(result).toMatchObject({
      outcome: 'completed',
      migrationPlanId: PLAN_ID,
    });
    expect(port.calls.map(({ rpc }) => rpc)).toEqual([
      SCHEMA_MIGRATION_RPC.readPlan,
      SCHEMA_MIGRATION_RPC.claimLease,
      SCHEMA_MIGRATION_RPC.heartbeatLease,
      SCHEMA_MIGRATION_RPC.readSourceRows,
      SCHEMA_MIGRATION_RPC.processBatch,
      SCHEMA_MIGRATION_RPC.beginVerification,
      SCHEMA_MIGRATION_RPC.verify,
      SCHEMA_MIGRATION_RPC.complete,
      SCHEMA_MIGRATION_RPC.activate,
    ]);
    expect(port.calls[1]?.request).toMatchObject({
      migrationPlanId: PLAN_ID,
      expectedVersion: '7',
      cursor: '0',
      workerId: 'worker-a',
    });
    expect(port.calls[4]?.request).toMatchObject({
      cursor: '50',
      transformKey: 'identity.revalidate',
      transformVersion: '1',
      compilerHash: HASH,
      sourceHash: HASH,
      targetHash: TARGET_HASH,
    });
    expect(telemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'success',
        cursor: '100',
        progress: 1,
      }),
    );
  });

  it('returns a scheduled retry when another worker owns the lease', async () => {
    const port = makePort({
      [SCHEMA_MIGRATION_RPC.readPlan]: () => basePlan(),
      [SCHEMA_MIGRATION_RPC.claimLease]: () => ({
        acquired: false,
        reasonCode: 'LEASE_HELD',
      }),
    });
    const worker = createSchemaMigrationWorker({
      port,
      workerId: 'worker-b',
      now: () => NOW,
    });

    await expect(worker.process(job)).resolves.toMatchObject({
      outcome: 'retry',
      retryAfterMs: MIGRATION_RETRY_DELAYS_MS[0],
      reasonCode: 'LEASE_HELD',
    });
    expect(port.calls).toHaveLength(2);
  });

  it('[P2-S09-AC-188] preserves the old active version and never deletes rows when a transform fails', async () => {
    const port = makePort({
      [SCHEMA_MIGRATION_RPC.readPlan]: () => basePlan(),
      [SCHEMA_MIGRATION_RPC.claimLease]: () => ({
        acquired: true,
        leaseToken: 'lease-2',
        plan: basePlan({ state: 'running', version: '8' }),
      }),
      [SCHEMA_MIGRATION_RPC.heartbeatLease]: () => ({ renewed: true }),
      [SCHEMA_MIGRATION_RPC.processBatch]: () => {
        throw { code: 'TRANSFORM_FAILED', retryable: false } as const;
      },
      [SCHEMA_MIGRATION_RPC.rollback]: () => ({
        plan: basePlan({ state: 'failed_terminal', version: '9' }),
      }),
    });
    const worker = createSchemaMigrationWorker({
      port,
      workerId: 'worker-c',
      now: () => NOW,
    });

    await expect(worker.process(job)).resolves.toMatchObject({
      outcome: 'failed_terminal',
      reasonCode: 'TRANSFORM_FAILED',
    });
    expect(port.calls.map(({ rpc }) => rpc)).toEqual([
      SCHEMA_MIGRATION_RPC.readPlan,
      SCHEMA_MIGRATION_RPC.claimLease,
      SCHEMA_MIGRATION_RPC.heartbeatLease,
      SCHEMA_MIGRATION_RPC.readSourceRows,
      SCHEMA_MIGRATION_RPC.processBatch,
      SCHEMA_MIGRATION_RPC.rollback,
    ]);
    expect(port.calls[5]?.request).toMatchObject({
      fallbackVersionId: OLD_VERSION_ID,
      preserveOldActive: true,
      deleteRows: false,
    });
  });

  it('deduplicates an event before loading a plan and dead-letters unknown event versions', async () => {
    const port = makePort({
      [SCHEMA_MIGRATION_RPC.claimEvent]: () => ({ status: 'duplicate' }),
      [SCHEMA_MIGRATION_RPC.deadLetter]: () => ({ accepted: true }),
    });
    const worker = createSchemaMigrationWorker({
      port,
      workerId: 'worker-d',
      now: () => NOW,
    });

    await expect(worker.process(event)).resolves.toMatchObject({
      outcome: 'duplicate',
    });
    expect(port.calls.map(({ rpc }) => rpc)).toEqual([
      SCHEMA_MIGRATION_RPC.claimEvent,
    ]);

    const unknown = { ...event, schemaVersion: 99 };
    await expect(worker.process(unknown)).resolves.toMatchObject({
      outcome: 'dead_letter',
    });
    expect(port.calls.at(-1)?.rpc).toBe(SCHEMA_MIGRATION_RPC.deadLetter);
    expect(port.calls.at(-1)?.request).toMatchObject({
      eventId: EVENT_ID,
      reasonCode: 'UNKNOWN_EVENT_VERSION',
    });
  });

  it('claims and acknowledges activation events that require no migration', async () => {
    const noMigration = {
      ...event,
      payload: { ...event.payload, migrationPlanId: null },
    };
    const port = makePort({
      [SCHEMA_MIGRATION_RPC.claimEvent]: () => ({ status: 'new' }),
      [SCHEMA_MIGRATION_RPC.acknowledgeEvent]: () => ({ accepted: true }),
    });
    const worker = createSchemaMigrationWorker({
      port,
      workerId: 'worker-no-migration',
      now: () => NOW,
    });

    await expect(worker.process(noMigration)).resolves.toMatchObject({
      outcome: 'completed',
      reasonCode: null,
    });
    expect(port.calls.map(({ rpc }) => rpc)).toEqual([
      SCHEMA_MIGRATION_RPC.claimEvent,
      SCHEMA_MIGRATION_RPC.acknowledgeEvent,
    ]);
  });

  it('supports an explicit DLQ replay after the event claim becomes replayable', async () => {
    const port = makePort({
      [SCHEMA_MIGRATION_RPC.claimEvent]: (request) =>
        (request as { replay?: boolean }).replay
          ? { status: 'replayable' }
          : { status: 'new' },
      [SCHEMA_MIGRATION_RPC.readPlan]: () =>
        basePlan({ state: 'completed', progress: 1 }),
      [SCHEMA_MIGRATION_RPC.acknowledgeEvent]: () => ({ accepted: true }),
    });
    const worker = createSchemaMigrationWorker({
      port,
      workerId: 'worker-e',
      now: () => NOW,
    });

    await expect(worker.replayDlq(event)).resolves.toMatchObject({
      outcome: 'completed',
    });
    expect(port.calls[0]?.request).toMatchObject({
      replay: true,
      eventId: EVENT_ID,
    });
  });

  it('does not reopen terminal plans or repeat activation on duplicate delivery', async () => {
    const port = makePort({
      [SCHEMA_MIGRATION_RPC.readPlan]: () =>
        basePlan({ state: 'completed', progress: 1 }),
    });
    const worker = createSchemaMigrationWorker({
      port,
      workerId: 'worker-f',
      now: () => NOW,
    });

    await expect(worker.process(job)).resolves.toMatchObject({
      outcome: 'completed',
    });
    await expect(worker.process(job)).resolves.toMatchObject({
      outcome: 'completed',
    });
    expect(port.calls.map(({ rpc }) => rpc)).toEqual([
      SCHEMA_MIGRATION_RPC.readPlan,
      SCHEMA_MIGRATION_RPC.readPlan,
    ]);
  });
});
