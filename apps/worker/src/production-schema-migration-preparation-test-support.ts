import { vi } from 'vitest';

import { SCHEMA_MIGRATION_RPC as RPC } from './content-schema-registry/migration-worker-constants';
import { SchemaMigrationJobPayloadSchema } from './content-schema-registry/migration-worker-job-schema';
import {
  MigrationPlanRecordSchema,
  SchemaMigrationBatchResultSchema,
} from './content-schema-registry/migration-worker-plan-schemas';
import { parseSourcePage } from './content-schema-registry/migration-source-read';
import {
  basePlan,
  job,
  NOW,
} from './content-schema-registry/migration-worker-test-support';
import type { WorkerBindings } from './worker-bindings';

export const ENVIRONMENT: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-11-preparation',
  SUPABASE_URL: 'https://supabase.example.test',
  SUPABASE_SECRET_KEY: 'sb_secret_preparation_unit_fixture',
};
export const WORKER = 'production-preparation-worker';
export const INSTANT = new Date(NOW).toISOString();
export const EXPIRES = new Date(NOW + 30_000).toISOString();
export const DRY_TOKEN = '10000000-0000-4000-8000-000000000011';
export const BACKFILL_TOKEN = '20000000-0000-4000-8000-000000000012';
export const ROW_ID = '30000000-0000-4000-8000-000000000013';
export const ROW_HASH =
  '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a';
export const FINGERPRINTS = {
  transformKey: 'identity.revalidate',
  transformVersion: '1',
  compilerHash: 'c'.repeat(64),
  sourceHash: 'a'.repeat(64),
  targetHash: 'b'.repeat(64),
};
export type Start = 'draft' | 'dry_running' | 'empty_ready';

// Purpose-independent persistence responses: real protected transport and core,
// not persisted dispatch, SQL census/fences, editorial approval or switch authority.
export const productionPreparationFixture = (start: Start = 'draft') => {
  const empty = start === 'empty_ready';
  const count = empty ? '0' : '1';
  const initial = MigrationPlanRecordSchema.parse(
    basePlan({
      ...FINGERPRINTS,
      state: start === 'empty_ready' ? 'ready' : start,
      sourceCount: count,
      leaseExpiresAt: empty ? INSTANT : null,
      progress: empty ? 1 : 0,
    }),
  );
  const held = MigrationPlanRecordSchema.parse({
    ...initial,
    state: 'dry_running',
    version: '8',
    leaseOwner: WORKER,
    leaseToken: DRY_TOKEN,
    leaseExpiresAt: EXPIRES,
  });
  const ready = MigrationPlanRecordSchema.parse({
    ...initial,
    state: 'ready',
    version: empty ? '7' : '9',
    cursor: count,
    progress: 1,
    targetCount: count,
    leaseExpiresAt: INSTANT,
  });
  const running = MigrationPlanRecordSchema.parse({
    ...ready,
    state: 'running',
    version: empty ? '8' : '10',
    cursor: '0',
    progress: 0,
    leaseOwner: WORKER,
    leaseToken: BACKFILL_TOKEN,
    leaseExpiresAt: EXPIRES,
  });
  const verifying = MigrationPlanRecordSchema.parse({
    ...running,
    state: 'verifying',
    version: empty ? '9' : '11',
    cursor: count,
    progress: 1,
    migratedCount: count,
  });
  const completed = MigrationPlanRecordSchema.parse({
    ...verifying,
    state: 'completed',
    version: empty ? '10' : '12',
    leaseOwner: null,
    leaseToken: null,
    leaseExpiresAt: INSTANT,
  });
  const page = parseSourcePage(
    {
      rows: empty
        ? []
        : [
            {
              sourceTable: 'cms_entry_revisions',
              sourceRowId: ROW_ID,
              sourceHash: ROW_HASH,
              document: {},
            },
          ],
      nextCursor: count,
      done: true,
      targetFields: [],
      retiredFields: [],
    },
    1,
  );
  const batch = SchemaMigrationBatchResultSchema.parse({
    done: true,
    cursor: count,
    progress: 1,
    sourceCount: count,
    targetCount: count,
    rowErrorCount: '0',
    migratedCount: count,
    failedCount: '0',
  });
  const dryBatch = SchemaMigrationBatchResultSchema.parse({
    ...batch,
    migratedCount: '0',
  });
  let sealed = empty;
  const fetchImpl = vi.fn<typeof fetch>(async (input) => {
    const rpc = new URL(String(input)).pathname.split('/').at(-1);
    switch (rpc) {
      case RPC.readPlan:
        return Response.json(initial);
      case RPC.claimLease:
        return Response.json({
          acquired: true,
          leaseToken: sealed ? BACKFILL_TOKEN : DRY_TOKEN,
          plan: sealed ? running : held,
          reasonCode: null,
        });
      case RPC.heartbeatLease:
        return Response.json({ renewed: true });
      case RPC.readSourceRows:
        return Response.json(page);
      case RPC.processDryRunBatch:
        return Response.json(dryBatch);
      case RPC.finalizeDryRun:
        sealed = true;
        return Response.json(ready);
      case RPC.processBatch:
        return Response.json(batch);
      case RPC.beginVerification:
        return Response.json(verifying);
      case RPC.verify:
        return Response.json({ valid: true });
      case RPC.complete:
        return Response.json(completed);
      case RPC.activate:
        return Response.json({ activated: true });
      case RPC.claimEvent:
        return Response.json({ status: 'new' });
      case RPC.acknowledgeEvent:
        return Response.json({ accepted: true });
      default:
        throw new Error(`Unexpected protected migration RPC: ${rpc}`);
    }
  });
  const signal = new AbortController().signal;
  const addAbortListener = vi.spyOn(signal, 'addEventListener');
  const removeAbortListener = vi.spyOn(signal, 'removeEventListener');
  const options = {
    workerId: WORKER,
    now: () => NOW,
    leaseDurationMs: 30_000,
    maxBatchRows: 1,
    maxBatchesPerInvocation: 1,
    deadlineMs: 15_000,
    maxResponseBytes: 16_384,
    telemetry: vi.fn(),
  };
  return {
    fetchImpl,
    signal,
    addAbortListener,
    removeAbortListener,
    options,
    initial,
    held,
    ready,
    running,
    verifying,
    completed,
    job: SchemaMigrationJobPayloadSchema.parse(job),
  };
};
