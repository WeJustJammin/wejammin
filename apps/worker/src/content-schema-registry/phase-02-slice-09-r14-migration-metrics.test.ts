import { createLogger, LogEventSchema } from '@wejammin/observability/logging';
import { describe, expect, it } from 'vitest';

import type { WorkerBindings } from '../index';
import { createProductionSchemaMigrationWorker } from '../production-worker-runtime';
import { SCHEMA_MIGRATION_RPC } from './migration-worker';
import { basePlan, job, makePort, NOW } from './migration-worker-test-support';

/**
 * AC208 migration and queue metrics produced by the real worker: the
 * production composition (protected RPC transport -> migration engine ->
 * production telemetry -> logger sink) runs a job, and the metric names and
 * values are read back from the log lines it writes. Nothing here calls the
 * telemetry function with a hand-built event. Only the PostgREST endpoint is
 * faked, by answering each named RPC from the shared migration test port.
 */
const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-09-r14',
  SUPABASE_SECRET_KEY: 'sb_secret_r14_metrics',
  SUPABASE_URL: 'https://supabase.example.test',
};

type Port = ReturnType<typeof makePort>;

const run = async (port: Port, input: unknown = job) => {
  const lines: string[] = [];
  const fetchImpl = async (target: RequestInfo | URL, init?: RequestInit) => {
    const rpc = new URL(String(target)).pathname
      .split('/')
      .at(-1) as Parameters<Port['call']>[0];
    const request = (JSON.parse(String(init?.body)) as { p_request: unknown })
      .p_request;
    return Response.json(
      await port.call(rpc, request, new AbortController().signal),
    );
  };
  const worker = createProductionSchemaMigrationWorker(
    environment,
    fetchImpl as typeof fetch,
    {
      now: () => NOW,
      logger: createLogger(
        {
          environment: 'staging',
          release: 'slice-09-r14',
          service: 'wejammin-cms-migration-worker',
        },
        { sink: (line) => lines.push(line), random: () => 0 },
      ),
    },
  );
  const result = await worker.process(input, { attempt: 1 });
  const metrics = lines.flatMap((line) => {
    const event = LogEventSchema.parse(JSON.parse(line));
    return event.metrics === undefined ? [] : [event.metrics];
  });
  return { result, metrics };
};

const blockedPort = () =>
  makePort({
    [SCHEMA_MIGRATION_RPC.readPlan]: () => basePlan({ state: 'draft' }),
    [SCHEMA_MIGRATION_RPC.claimLease]: () => ({
      acquired: true,
      leaseToken: 'token',
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
  });

describe('BE03a migration and queue metrics from the production worker', () => {
  it('[P2-S09-AC-208] a blocked plan writes cms_migration_blocked_total 1 and cms_migration_progress with the plan progress', async () => {
    const { result, metrics } = await run(blockedPort());
    expect(result.outcome).toBe('blocked');
    expect(metrics.at(-1)).toMatchObject({
      cms_migration_blocked_total: 1,
      cms_migration_progress: 0.5,
      cms_queue_retry_total: 0,
      cms_queue_dlq_total: 0,
    });
  });

  it('[P2-S09-AC-208] a retryable lease conflict writes cms_queue_retry_total 1 and no dead letter', async () => {
    const { result, metrics } = await run(
      makePort({
        [SCHEMA_MIGRATION_RPC.readPlan]: () => basePlan({ state: 'draft' }),
        [SCHEMA_MIGRATION_RPC.claimLease]: () => ({
          acquired: false,
          reasonCode: 'LEASE_HELD',
        }),
      }),
    );
    expect(result.outcome).toBe('retry');
    expect(metrics.at(-1)).toMatchObject({
      cms_queue_retry_total: 1,
      cms_queue_dlq_total: 0,
      cms_migration_blocked_total: 0,
    });
  });

  it('[P2-S09-AC-208] an unknown event version is dead-lettered and writes cms_queue_dlq_total 1', async () => {
    const { result, metrics } = await run(
      makePort({
        [SCHEMA_MIGRATION_RPC.deadLetter]: () => ({ accepted: true }),
      }),
      {
        eventId: '44444444-4444-4444-8444-444444444444',
        eventType: 'cms.schema.activated.v1',
        schemaVersion: 99,
      },
    );
    expect(result.outcome).toBe('dead_letter');
    expect(metrics.at(-1)).toMatchObject({
      cms_queue_dlq_total: 1,
      cms_queue_retry_total: 0,
    });
  });
});
