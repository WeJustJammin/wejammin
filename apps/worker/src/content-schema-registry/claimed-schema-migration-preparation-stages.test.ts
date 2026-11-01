import type { JobEffectInput } from '@wejammin/application';
import { describe, expect, it, vi } from 'vitest';

import { createClaimedSchemaMigrationPreparation } from './claimed-schema-migration-preparation';
import { SCHEMA_MIGRATION_RPC as RPC } from './migration-worker-constants';
import { MigrationPlanRecordSchema } from './migration-worker-plan-schemas';
import {
  preparationFixture,
  expectedCall,
  claimBody,
  FINGERPRINTS,
  INSTANT,
  ROW_HASH,
  ROW_ID,
  TOKEN,
  WORKER,
} from './migration-worker-pre-review-purpose-test-support';
import {
  CONTENT_TYPE_ID,
  NOW,
  OLD_VERSION_ID,
  PLAN_ID,
  TARGET_VERSION_ID,
} from './migration-worker-test-support';
import type { MigrationWorkerPort } from './migration-worker-types';
import { CmsSchemaDryRunClaimRequestSchema } from './schema-dry-run-claim-request';
import { CmsSchemaDryRunClaimResponseSchema } from './schema-dry-run-claim-response';
import {
  IDS,
  responseFixture,
} from './schema-dry-run-claim-response-test-support';

const BE00_TOKEN = 'cccccccc-0000-4000-8000-000000000013';
const SCAN_TOKEN = 'dddddddd-0000-4000-8000-000000000014';
type InitialState =
  | 'draft'
  | 'dry_running'
  | 'ready'
  | 'blocked'
  | 'failed_terminal'
  | 'completed';

// Controlled persistence replies exercise real scanning/stages, not SQL authority.
const fixture = (state: InitialState = 'draft', empty = false) => {
  const f = preparationFixture('dry_run', 'none', empty);
  const delegate = f.call.getMockImplementation();
  if (delegate === undefined) throw new Error('Missing controlled RPC handler');
  const provisional = state === 'draft' || state === 'dry_running';
  const initial = MigrationPlanRecordSchema.parse({
    ...f.ready,
    state,
    version: provisional ? '5' : '7',
    cursor: provisional ? '0' : f.ready.cursor,
    progress: provisional ? 0 : f.ready.progress,
    targetCount: provisional ? '0' : f.ready.targetCount,
  });
  const held = MigrationPlanRecordSchema.parse({
    ...initial,
    state: 'dry_running',
    version: '6',
    leaseOwner: WORKER,
    leaseToken: SCAN_TOKEN,
    leaseExpiresAt: new Date(NOW + 30_000).toISOString(),
  });
  const response = responseFixture({
    requestedEvent: { causationId: IDS.owner },
    report: {
      planId: PLAN_ID,
      contentTypeId: CONTENT_TYPE_ID,
      sourceVersionId: initial.fromVersionId,
      targetVersionId: TARGET_VERSION_ID,
    },
    candidate: {
      id: TARGET_VERSION_ID,
      contentTypeId: CONTENT_TYPE_ID,
      supersedesId: initial.fromVersionId,
    },
    plan: initial,
  });
  expect(CmsSchemaDryRunClaimResponseSchema.safeParse(response)).toEqual({
    success: true,
    data: response,
  });
  const input = {
    job: {
      id: IDS.job,
      type: 'cms.schema.dry_run',
      state: 'running',
      version: '9007199254740995',
      leaseUntilMs: null,
    },
    envelope: response.requestedEvent,
    leaseToken: BE00_TOKEN,
    claimedLease: {
      jobId: IDS.job,
      leaseToken: BE00_TOKEN,
      expectedVersion: '9007199254740995',
      version: response.job.version,
      leaseUntilMs: NOW + 30_000,
    },
  } satisfies JobEffectInput;
  const request = CmsSchemaDryRunClaimRequestSchema.parse({
    claimedJob: {
      jobId: IDS.job,
      version: response.job.version,
      leaseToken: BE00_TOKEN,
    },
    requestedEvent: input.envelope,
  });
  let sealed = !provisional;
  const call = vi.fn<MigrationWorkerPort['call']>(async (rpc, body, signal) => {
    if (rpc === RPC.readPlan) return response;
    if (rpc === RPC.claimLease && !sealed)
      return { acquired: true, leaseToken: SCAN_TOKEN, plan: held };
    if (rpc === RPC.processDryRunBatch)
      return {
        done: true,
        cursor: f.ready.cursor,
        progress: 1,
        sourceCount: f.ready.sourceCount,
        targetCount: f.ready.targetCount,
        rowErrorCount: '0',
        migratedCount: '0',
        failedCount: '0',
      };
    if (rpc === RPC.finalizeDryRun) {
      sealed = true;
      return f.ready;
    }
    return delegate(rpc, body, signal);
  });
  const dependencies = {
    port: { call },
    workerId: WORKER,
    now: () => NOW,
    maxBatchRows: 1,
    maxBatchesPerInvocation: 1,
    leaseDurationMs: 30_000,
  };
  return { ...f, initial, input, request, call, dependencies };
};
type Fixture = ReturnType<typeof fixture>;

const read = (f: Fixture) => expectedCall(RPC.readPlan, f.request, f.signal);
const batchCalls = (
  f: Fixture,
  version: string,
  token: string,
  dry: boolean,
) => {
  const position = {
    migrationPlanId: PLAN_ID,
    expectedVersion: version,
    cursor: '0',
    leaseToken: token,
  };
  return [
    expectedCall(
      RPC.heartbeatLease,
      {
        ...position,
        workerId: WORKER,
        now: INSTANT,
        leaseDurationMs: 30_000,
      },
      f.signal,
    ),
    expectedCall(RPC.readSourceRows, { ...position, limit: 1 }, f.signal),
    expectedCall(
      dry ? RPC.processDryRunBatch : RPC.processBatch,
      {
        ...position,
        schemaVersionId: TARGET_VERSION_ID,
        limit: 1,
        rowEvidence: f.ready.sourceCount === '0' ? [] : [ROW_EVIDENCE],
        ...fingerprints(f),
        correlationId: IDS.other,
        causationId: IDS.owner,
      },
      f.signal,
    ),
  ];
};
const ROW_EVIDENCE = {
  sourceTable: 'cms_entry_revisions',
  sourceRowId: ROW_ID,
  sourceHash: ROW_HASH,
  outputHash: ROW_HASH,
  errorCode: null,
};
const fingerprints = (f: Fixture) => ({
  ...FINGERPRINTS,
  transformKey: f.ready.transformKey,
  transformVersion: f.ready.transformVersion,
  sourceHash: f.ready.sourceHash,
});
const dryCalls = (f: Fixture) => [
  read(f),
  expectedCall(
    RPC.claimLease,
    {
      ...claimBody,
      ...fingerprints(f),
      expectedVersion: '5',
      cursor: '0',
    },
    f.signal,
  ),
  ...batchCalls(f, '6', SCAN_TOKEN, true),
  expectedCall(
    RPC.finalizeDryRun,
    {
      migrationPlanId: PLAN_ID,
      expectedVersion: '6',
      cursor: f.ready.cursor,
      sourceCount: f.ready.sourceCount,
      targetCount: f.ready.targetCount,
      rowErrorCount: '0',
      ...fingerprints(f),
    },
    f.signal,
  ),
];
const counts = {
  cursor: '1',
  sourceCount: '1',
  targetCount: '1',
  rowErrorCount: '0',
  migratedCount: '1',
  failedCount: '0',
};
const finishCalls = (f: Fixture) => [
  expectedCall(RPC.claimLease, claimBody, f.signal),
  ...batchCalls(f, '8', TOKEN, false),
  expectedCall(
    RPC.beginVerification,
    {
      migrationPlanId: PLAN_ID,
      expectedVersion: '8',
      ...counts,
      ...FINGERPRINTS,
    },
    f.signal,
  ),
  expectedCall(
    RPC.verify,
    {
      migrationPlanId: PLAN_ID,
      schemaVersionId: TARGET_VERSION_ID,
      expectedVersion: '9',
      leaseToken: TOKEN,
      ...counts,
      ...FINGERPRINTS,
    },
    f.signal,
  ),
  expectedCall(
    RPC.complete,
    { migrationPlanId: PLAN_ID, expectedVersion: '9', leaseToken: TOKEN },
    f.signal,
  ),
];
const result = (
  f: Fixture,
  state: InitialState,
  outcome = 'completed',
  reasonCode: string | null = null,
) => ({
  kind: 'processed',
  claimRequest: f.request,
  reportId: IDS.report,
  result: {
    outcome,
    migrationPlanId: PLAN_ID,
    schemaVersionId: TARGET_VERSION_ID,
    eventId: null,
    state,
    cursor: f.ready.cursor,
    progress: f.ready.progress,
    retryAfterMs: null,
    reasonCode,
    activationSwitched: false,
  },
});
const assertHistory = (f: Fixture, expected: ReturnType<typeof dryCalls>) => {
  expect(f.call.mock.calls).toStrictEqual(expected);
  for (const [, , signal] of f.call.mock.calls) expect(signal).toBe(f.signal);
  expect(f.call.mock.calls[0]?.[1]).toStrictEqual(f.request);
};

describe('controlled claimed preparation stage continuation', () => {
  it.each(['omitted', 'activation'] as const)(
    'scans seals freshly reclaims and completes nonzero preparation with %s runtime purpose',
    async (purpose) => {
      const f = fixture();
      const dependencies = {
        ...f.dependencies,
        ...(purpose === 'activation' ? { executionPurpose: purpose } : {}),
      };
      expect(new Set([BE00_TOKEN, SCAN_TOKEN, TOKEN]).size).toBe(3);
      expect(f.page.rows).toStrictEqual([
        {
          sourceTable: 'cms_entry_revisions',
          sourceRowId: ROW_ID,
          sourceHash: ROW_HASH,
          document: {},
        },
      ]);
      const output = await createClaimedSchemaMigrationPreparation(
        dependencies,
      ).process(f.input, { signal: f.signal, attempt: 3 });
      assertHistory(f, [...dryCalls(f), ...finishCalls(f)]);
      expect(output).toStrictEqual(result(f, 'completed'));
      if (output.kind !== 'processed')
        throw new Error('Expected processed claim');
      expect(output.claimRequest).toBe(f.call.mock.calls[0]?.[1]);
      expect(Object.isFrozen(output.claimRequest)).toBe(true);
      expect(Object.isFrozen(output.claimRequest.requestedEvent)).toBe(true);
      expect(output.claimRequest.requestedEvent).toStrictEqual(
        f.input.envelope,
      );
      expect(f.completed).toMatchObject({
        ...counts,
        state: 'completed',
        version: '10',
        activeVersionId: OLD_VERSION_ID,
        leaseOwner: null,
        leaseToken: null,
      });
    },
  );

  it('completes only a sealed all-zero READY plan read-only with truthful metadata', async () => {
    const f = fixture('ready', true);
    expect(f.initial).toMatchObject({
      state: 'ready',
      cursor: '0',
      sourceCount: '0',
      targetCount: '0',
      rowErrorCount: '0',
      migratedCount: '0',
      failedCount: '0',
      leaseOwner: null,
      leaseToken: null,
    });
    const output = await createClaimedSchemaMigrationPreparation(
      f.dependencies,
    ).process(f.input, { signal: f.signal, attempt: 3 });
    assertHistory(f, [read(f)]);
    expect(output).toStrictEqual(result(f, 'ready'));
  });

  it.each(['draft', 'dry_running'] as const)(
    'scans and seals provisional zero %s before completing without backfill or activation',
    async (state) => {
      const f = fixture(state, true);
      const output = await createClaimedSchemaMigrationPreparation(
        f.dependencies,
      ).process(f.input, { signal: f.signal, attempt: 3 });
      assertHistory(f, dryCalls(f));
      expect(f.page.rows).toStrictEqual([]);
      expect(output).toStrictEqual(result(f, 'ready'));
    },
  );

  it.each([
    ['blocked', 'MIGRATION_BLOCKED'],
    ['failed_terminal', 'MIGRATION_TERMINAL'],
    ['completed', null],
  ] as const)(
    'retains %s admission metadata without event claim ACK release or activation',
    async (state, reason) => {
      const f = fixture(state);
      const output = await createClaimedSchemaMigrationPreparation(
        f.dependencies,
      ).process(f.input, { signal: f.signal, attempt: 3 });
      assertHistory(f, [read(f)]);
      expect(output).toStrictEqual(result(f, state, state, reason));
      expect(f.initial.state).toBe(state);
    },
  );
});
