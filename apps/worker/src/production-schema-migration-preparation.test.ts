import { describe, expect, it } from 'vitest';

import * as cmsRuntime from './production-worker-runtime-cms';
import * as runtimeFacade from './production-worker-runtime';
import * as workerFacade from './index';
import {
  SCHEMA_MIGRATION_RPC as RPC,
  type SchemaMigrationRpcName,
} from './content-schema-registry/migration-worker-constants';
import { SchemaMigrationQueueEnvelopeSchema } from './content-schema-registry/migration-worker-queue-schema';
import {
  CONTENT_TYPE_ID,
  event,
  job,
  OLD_VERSION_ID,
  PLAN_ID,
  TARGET_VERSION_ID,
} from './content-schema-registry/migration-worker-test-support';
import {
  BACKFILL_TOKEN,
  DRY_TOKEN,
  ENVIRONMENT,
  FINGERPRINTS,
  INSTANT,
  productionPreparationFixture,
  ROW_HASH,
  ROW_ID,
  WORKER,
  type Start,
} from './production-schema-migration-preparation-test-support';

type Factory = typeof cmsRuntime.createProductionSchemaMigrationWorker;
const isFactory = (value: unknown): value is Factory =>
  typeof value === 'function';
const preparationFactory = (
  exports: Readonly<Record<string, unknown>> = cmsRuntime,
): Factory => {
  const candidate: unknown =
    exports['createProductionSchemaMigrationPreparationWorker'];
  // Initial RED is the absent named entry, not functional purpose-boundary proof.
  expect(candidate).toBeTypeOf('function');
  if (!isFactory(candidate)) throw new Error('Preparation factory is absent');
  return candidate;
};
type RpcRequest = readonly [SchemaMigrationRpcName, unknown];
const rpc = (name: SchemaMigrationRpcName, request: unknown): RpcRequest => [
  name,
  request,
];
const readRequest = () =>
  rpc(RPC.readPlan, {
    migrationPlanId: PLAN_ID,
    schemaVersionId: TARGET_VERSION_ID,
    expectedVersion: '7',
  });
const claimRequest = (expectedVersion: string, cursor: string) =>
  rpc(RPC.claimLease, {
    migrationPlanId: PLAN_ID,
    schemaVersionId: TARGET_VERSION_ID,
    expectedVersion,
    cursor,
    leaseOwner: WORKER,
    workerId: WORKER,
    leaseDurationMs: 30_000,
    now: INSTANT,
    ...FINGERPRINTS,
  });
const scanRequests = (
  expectedVersion: string,
  leaseToken: string,
  dryRun: boolean,
  empty: boolean,
): RpcRequest[] => [
  rpc(RPC.heartbeatLease, {
    migrationPlanId: PLAN_ID,
    expectedVersion,
    cursor: '0',
    leaseToken,
    workerId: WORKER,
    now: INSTANT,
    leaseDurationMs: 30_000,
  }),
  rpc(RPC.readSourceRows, {
    migrationPlanId: PLAN_ID,
    expectedVersion,
    cursor: '0',
    limit: 1,
    leaseToken,
  }),
  rpc(dryRun ? RPC.processDryRunBatch : RPC.processBatch, {
    migrationPlanId: PLAN_ID,
    schemaVersionId: TARGET_VERSION_ID,
    expectedVersion,
    cursor: '0',
    limit: 1,
    leaseToken,
    rowEvidence: empty
      ? []
      : [
          {
            sourceTable: 'cms_entry_revisions',
            sourceRowId: ROW_ID,
            sourceHash: ROW_HASH,
            outputHash: ROW_HASH,
            errorCode: null,
          },
        ],
    ...FINGERPRINTS,
    correlationId: job.correlationId,
    causationId: job.causationId,
  }),
];
const fullRequests = (start: Start, activate: boolean): RpcRequest[] => {
  const empty = start === 'empty_ready';
  const count = empty ? '0' : '1';
  const counts = {
    cursor: count,
    sourceCount: count,
    targetCount: count,
    rowErrorCount: '0',
  };
  return [
    readRequest(),
    ...(empty
      ? []
      : [
          claimRequest('7', '0'),
          ...scanRequests('8', DRY_TOKEN, true, false),
          rpc(RPC.finalizeDryRun, {
            migrationPlanId: PLAN_ID,
            expectedVersion: '8',
            ...counts,
            ...FINGERPRINTS,
          }),
        ]),
    claimRequest(empty ? '7' : '9', count),
    ...scanRequests(empty ? '8' : '10', BACKFILL_TOKEN, false, empty),
    rpc(RPC.beginVerification, {
      migrationPlanId: PLAN_ID,
      expectedVersion: empty ? '8' : '10',
      ...counts,
      migratedCount: count,
      failedCount: '0',
      ...FINGERPRINTS,
    }),
    rpc(RPC.verify, {
      migrationPlanId: PLAN_ID,
      schemaVersionId: TARGET_VERSION_ID,
      expectedVersion: empty ? '9' : '11',
      cursor: count,
      leaseToken: BACKFILL_TOKEN,
      sourceCount: count,
      targetCount: count,
      rowErrorCount: '0',
      migratedCount: count,
      failedCount: '0',
      ...FINGERPRINTS,
    }),
    rpc(RPC.complete, {
      migrationPlanId: PLAN_ID,
      expectedVersion: empty ? '9' : '11',
      leaseToken: BACKFILL_TOKEN,
    }),
    ...(activate
      ? [
          rpc(RPC.activate, {
            migrationPlanId: PLAN_ID,
            contentTypeId: CONTENT_TYPE_ID,
            schemaVersionId: TARGET_VERSION_ID,
            expectedVersion: empty ? '10' : '12',
            expectedActiveVersionId: OLD_VERSION_ID,
            ...FINGERPRINTS,
            idempotencyKey: `cms-migration:${PLAN_ID}`,
            switchOnlyOnce: true,
          }),
        ]
      : []),
  ];
};
const expectTransport = (
  f: ReturnType<typeof productionPreparationFixture>,
  requests: readonly RpcRequest[],
) => {
  expect(
    f.fetchImpl.mock.calls.map(([input, init]) => [
      input,
      {
        ...init,
        body:
          typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
      },
    ]),
  ).toEqual(
    requests.map(([operation, request]) => [
      `${ENVIRONMENT.SUPABASE_URL}/rest/v1/rpc/${operation}`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Profile': 'platform_api',
          apikey: ENVIRONMENT.SUPABASE_SECRET_KEY,
          'Content-Profile': 'platform_api',
          'content-type': 'application/json',
        },
        body: { p_request: request },
        signal: expect.any(AbortSignal),
      },
    ]),
  );
  const signals = f.fetchImpl.mock.calls.map(([, init]) => init?.signal);
  expect(new Set(signals).size).toBe(requests.length);
  for (const signal of signals) {
    expect(signal).not.toBe(f.signal);
    expect(signal?.aborted).toBe(false);
  }
  expect(
    f.addAbortListener.mock.calls.map(([type, , options]) => [type, options]),
  ).toEqual(requests.map(() => ['abort', { once: true }]));
  expect(f.removeAbortListener.mock.calls).toEqual(
    f.addAbortListener.mock.calls.map(([type, listener]) => [type, listener]),
  );
};
const completedResult = (
  state: 'ready' | 'completed',
  cursor: string,
  activationSwitched: boolean,
) => ({
  outcome: 'completed',
  migrationPlanId: PLAN_ID,
  schemaVersionId: TARGET_VERSION_ID,
  eventId: null,
  state,
  cursor,
  progress: 1,
  retryAfterMs: null,
  reasonCode: null,
  activationSwitched,
});

describe('production schema migration preparation construction', () => {
  it.each([
    { name: 'CMS runtime', exports: cmsRuntime },
    { name: 'runtime facade', exports: runtimeFacade },
    { name: 'Worker facade', exports: workerFacade },
  ])('exports the named preparation factory from $name', ({ exports }) => {
    expect(preparationFactory(exports)).toBe(preparationFactory());
  });

  it.each([
    { start: 'draft', method: 'process' },
    { start: 'draft', method: 'replayDlq' },
    { start: 'dry_running', method: 'process' },
    { start: 'dry_running', method: 'replayDlq' },
  ] as const)(
    'named preparation $method scans $start through fresh backfill and completion without switching',
    async ({ start, method }) => {
      const factory = preparationFactory();
      const f = productionPreparationFixture(start);
      const worker = factory(ENVIRONMENT, f.fetchImpl, f.options);
      const result = await worker[method](f.job, { signal: f.signal });

      expect(result).toEqual(completedResult('completed', '1', false));
      expectTransport(f, fullRequests(start, false));
      expect(f.completed.activeVersionId).toBe(OLD_VERSION_ID);
      expect(f.held.leaseToken).toBe(DRY_TOKEN);
      expect(f.ready.leaseToken).toBeNull();
      expect(f.running.leaseToken).toBe(BACKFILL_TOKEN);
      expect(BACKFILL_TOKEN).not.toBe(DRY_TOKEN);
    },
  );

  it.each(['process', 'replayDlq'] as const)(
    'named preparation %s completes genuinely empty sealed ready with read-only transport',
    async (method) => {
      const factory = preparationFactory();
      const f = productionPreparationFixture('empty_ready');
      const worker = factory(ENVIRONMENT, f.fetchImpl, f.options);

      expect(await worker[method](f.job, { signal: f.signal })).toEqual(
        completedResult('ready', '0', false),
      );
      expectTransport(f, [readRequest()]);
      expect(f.initial.activeVersionId).toBe(OLD_VERSION_ID);
    },
  );

  it.each([
    { method: 'process', migrationPlanId: PLAN_ID },
    { method: 'process', migrationPlanId: null },
    { method: 'replayDlq', migrationPlanId: PLAN_ID },
    { method: 'replayDlq', migrationPlanId: null },
  ] as const)(
    'named preparation $method refuses valid activated envelope plan $migrationPlanId before HTTP',
    async ({ method, migrationPlanId }) => {
      const factory = preparationFactory();
      const f = productionPreparationFixture();
      const input = SchemaMigrationQueueEnvelopeSchema.parse({
        ...event,
        payload: { ...event.payload, migrationPlanId },
      });
      const worker = factory(ENVIRONMENT, f.fetchImpl, f.options);

      expect(await worker[method](input, { signal: f.signal })).toEqual({
        outcome: 'failed_terminal',
        migrationPlanId,
        schemaVersionId: TARGET_VERSION_ID,
        eventId: event.eventId,
        state: null,
        cursor: null,
        progress: null,
        retryAfterMs: null,
        reasonCode: 'EXECUTION_PURPOSE_MISMATCH',
        activationSwitched: false,
      });
      expect(f.fetchImpl.mock.calls).toEqual([]);
      expect(f.addAbortListener.mock.calls).toEqual([]);
    },
  );

  it.each(['draft', 'dry_running', 'empty_ready'] as const)(
    'legacy default factory preserves full %s preparation and private activation continuation',
    async (start) => {
      const f = productionPreparationFixture(start);
      const worker = cmsRuntime.createProductionSchemaMigrationWorker(
        ENVIRONMENT,
        f.fetchImpl,
        f.options,
      );

      expect(await worker.process(f.job, { signal: f.signal })).toEqual(
        completedResult('completed', start === 'empty_ready' ? '0' : '1', true),
      );
      expectTransport(f, fullRequests(start, true));
      expect(f.completed.activeVersionId).toBe(OLD_VERSION_ID);
    },
  );
});
