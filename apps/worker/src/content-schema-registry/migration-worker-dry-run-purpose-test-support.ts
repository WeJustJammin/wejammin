import { vi } from 'vitest';

import { SCHEMA_MIGRATION_RPC as RPC } from './migration-worker-constants';
import { createSchemaMigrationWorker } from './migration-worker-engine';
import type { MigrationWorkerPort } from './migration-worker-types';
import {
  batchRequest,
  EXPIRES,
  fixture,
  FINGERPRINTS,
  INSTANT,
  NEW_TOKEN,
  OLD_TOKEN,
  reclaimRequest,
  ROW_ONE,
  ROW_TWO,
  WORKER,
} from './migration-worker-sealed-lease-test-support';
import {
  job,
  NOW,
  PLAN_ID,
  TARGET_VERSION_ID,
} from './migration-worker-test-support';

export const CLAIM_TOKEN = 'd0000000-0000-4000-8000-000000000001';
type Mode =
  | 'seal'
  | 'ready'
  | 'partial'
  | 'blocked'
  | 'finalize_retryable'
  | 'finalize_terminal'
  | 'finalize_invalid'
  | 'scan_invalid';

// Controlled RPC responses drive the real scanner/stages. They do not prove
// SQL authority, seal races, approval, activation or production job dispatch.
export const purposeFixture = (mode: Mode = 'seal') => {
  const f = fixture('acquired', mode !== 'partial');
  const running = {
    ...f.sealed,
    state: 'running' as const,
    version: '10',
    cursor: '1',
    progress: 0.5,
    migratedCount: '1',
    leaseOwner: WORKER,
    leaseToken: NEW_TOKEN,
    leaseExpiresAt: EXPIRES,
  };
  let sealed = false;
  let backfilled = false;
  const call = vi.fn<MigrationWorkerPort['call']>(
    async (rpc, request, signal) => {
      if (rpc === RPC.readPlan) {
        if (backfilled) return running;
        if (mode === 'ready' || sealed) return f.sealed;
        if (mode === 'blocked')
          return {
            ...f.sealed,
            state: 'blocked',
            version: '7',
            targetCount: '1',
            rowErrorCount: '1',
          };
      }
      if (rpc === RPC.readSourceRows && mode === 'scan_invalid')
        return { rows: null };
      if (rpc === RPC.finalizeDryRun) {
        if (mode === 'finalize_retryable')
          throw { code: 'DEPENDENCY_UNAVAILABLE', retryable: true };
        if (mode === 'finalize_terminal')
          throw { code: 'CONFLICT', retryable: false };
        if (mode === 'finalize_invalid') return {};
        sealed = true;
      }
      if (rpc === RPC.rollback)
        return {
          plan: {
            ...f.held,
            state: 'blocked',
            version: '9',
            leaseOwner: null,
            leaseToken: null,
            leaseExpiresAt: INSTANT,
          },
        };
      if (rpc === RPC.deadLetter || rpc === RPC.acknowledgeEvent)
        return { accepted: true };
      if (rpc === RPC.claimEvent) return { status: 'new' };
      const response = await f.call(rpc, request, signal);
      if (rpc === RPC.processBatch) backfilled = true;
      return response;
    },
  );
  const telemetry = vi.fn();
  const baseDependencies = {
    port: { call },
    workerId: WORKER,
    now: () => NOW,
    maxBatchRows: 1,
    maxBatchesPerInvocation: 1,
    leaseDurationMs: 30_000,
    eventClaimTokenFactory: () => CLAIM_TOKEN,
    telemetry,
  };
  // Variable assignment intentionally exercises the existing factory without
  // excess-property errors or casts while the private purpose is not yet typed.
  const dependencies = {
    ...baseDependencies,
    executionPurpose: 'dry_run' as const,
  };
  return {
    ...f,
    running,
    call,
    telemetry,
    baseDependencies,
    dependencies,
    worker: createSchemaMigrationWorker(dependencies),
  };
};

export const readCall = (signal: AbortSignal) => [
  RPC.readPlan,
  {
    migrationPlanId: PLAN_ID,
    schemaVersionId: TARGET_VERSION_ID,
    expectedVersion: job.expectedVersion,
  },
  signal,
];
export const scanCalls = (signal: AbortSignal) => [
  readCall(signal),
  [
    RPC.claimLease,
    { ...reclaimRequest, expectedVersion: '7', cursor: '1' },
    signal,
  ],
  [
    RPC.heartbeatLease,
    {
      migrationPlanId: PLAN_ID,
      expectedVersion: '8',
      cursor: '1',
      leaseToken: OLD_TOKEN,
      workerId: WORKER,
      now: INSTANT,
      leaseDurationMs: 30_000,
    },
    signal,
  ],
  [
    RPC.readSourceRows,
    {
      migrationPlanId: PLAN_ID,
      expectedVersion: '8',
      cursor: '1',
      limit: 1,
      leaseToken: OLD_TOKEN,
    },
    signal,
  ],
  [RPC.processDryRunBatch, batchRequest('8', '1', OLD_TOKEN, ROW_TWO), signal],
];
export const sealCall = (signal: AbortSignal) => [
  RPC.finalizeDryRun,
  {
    migrationPlanId: PLAN_ID,
    expectedVersion: '8',
    cursor: '2',
    sourceCount: '2',
    targetCount: '2',
    rowErrorCount: '0',
    ...FINGERPRINTS,
  },
  signal,
];
export const activationCalls = (signal: AbortSignal) => [
  [RPC.claimLease, reclaimRequest, signal],
  [
    RPC.heartbeatLease,
    {
      migrationPlanId: PLAN_ID,
      expectedVersion: '10',
      cursor: '0',
      leaseToken: NEW_TOKEN,
      workerId: WORKER,
      now: INSTANT,
      leaseDurationMs: 30_000,
    },
    signal,
  ],
  [
    RPC.readSourceRows,
    {
      migrationPlanId: PLAN_ID,
      expectedVersion: '10',
      cursor: '0',
      limit: 1,
      leaseToken: NEW_TOKEN,
    },
    signal,
  ],
  [RPC.processBatch, batchRequest('10', '0', NEW_TOKEN, ROW_ONE), signal],
];

export const READY_RESULT = {
  outcome: 'completed',
  migrationPlanId: PLAN_ID,
  schemaVersionId: TARGET_VERSION_ID,
  eventId: null,
  state: 'ready',
  cursor: '2',
  progress: 1,
  retryAfterMs: null,
  reasonCode: null,
  activationSwitched: false,
} as const;
