import type { CmsLeaseControl } from '@wejammin/application';

import { SCHEMA_MIGRATION_RPC } from './migration-worker-constants';
import type { MigrationWorkerRuntime } from './migration-worker-runtime';
import type { RpcCaller, RpcResult } from './migration-worker-types';

/** Reason of a stop caused by a lost BE00 Job lease; retryable, the consumer redelivers (BE00). */
export const JOB_LEASE_LOST = 'JOB_LEASE_LOST';

/**
 * The state-advancing worker RPCs (BE03a "Job lease checkpoints"). Each is preceded by one
 * `checkpoint()` of the private BE00 lease control. The three reads (`cms_get_schema_migration_plan`,
 * which is fenced in SQL on the Job at read time, the plan-lease heartbeat and the source-row read) are not.
 */
export const CHECKPOINTED_RPCS: ReadonlySet<string> = new Set([
  SCHEMA_MIGRATION_RPC.claimLease,
  SCHEMA_MIGRATION_RPC.processDryRunBatch,
  SCHEMA_MIGRATION_RPC.finalizeDryRun,
  SCHEMA_MIGRATION_RPC.processBatch,
  SCHEMA_MIGRATION_RPC.beginVerification,
  SCHEMA_MIGRATION_RPC.verify,
  SCHEMA_MIGRATION_RPC.complete,
  SCHEMA_MIGRATION_RPC.rollback,
]);

const LEASE_LOST: RpcResult = Object.freeze({
  ok: false,
  failure: Object.freeze({ code: JOB_LEASE_LOST, retryable: true }),
});

/**
 * A runtime whose RPC caller awaits `control.checkpoint()` before each state-advancing RPC. A checkpoint
 * that is not `current` (lost, or one that throws) stops the invocation before that RPC, and every later
 * call of any name answers the same retryable stop without reaching the port. A `current` checkpoint is a
 * candidate operational fact, not ownership: plan writes stay authorized by the plan lease, version and
 * cursor CAS, and the Job outcome by the BE00 outcome CAS.
 */
export const withJobLeaseCheckpoints = (
  runtime: MigrationWorkerRuntime,
  control: CmsLeaseControl,
): MigrationWorkerRuntime => {
  let lost = false;
  const call: RpcCaller = async (rpc, request, signal) => {
    if (lost) return LEASE_LOST;
    if (CHECKPOINTED_RPCS.has(rpc)) {
      const current = await control.checkpoint().then(
        (checkpoint) => checkpoint.kind === 'current',
        () => false,
      );
      if (!current) {
        lost = true;
        return LEASE_LOST;
      }
    }
    return runtime.call(rpc, request, signal);
  };
  return { ...runtime, call };
};
