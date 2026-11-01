import { claimedJobPayload } from './claimed-schema-migration-preparation-job-payload';
import { PREPARATION_JOB_ERROR } from './claimed-schema-migration-preparation-job-result';
import { SCHEMA_MIGRATION_RPC } from './migration-worker-constants';
import { acquireMigrationLease } from './migration-worker-lease';
import type { MigrationPlanRecord } from './migration-worker-plan-schemas';
import { failAndRollback } from './migration-worker-results';
import type { MigrationWorkerRuntime } from './migration-worker-runtime';
import { decodeCmsSchemaDryRunClaimResponse } from './schema-dry-run-claim-binding';
import type { CmsSchemaDryRunClaimRequest } from './schema-dry-run-claim-request';

/** The terminal reason of a preparation that spent its four BE00 deliveries (BE03a, DEC-184). */
export const PREPARATION_EXHAUSTED_REASON = PREPARATION_JOB_ERROR.exhausted;

/** A lease that outlives the rollback request by at least this long is used as found. */
const LEASE_MARGIN_MS = 5_000;

export type PreparationExhaustion =
  'rolled_back' | 'not_needed' | 'unavailable';

/**
 * States `cms_rollback_schema_migration` accepts. A `dry_running` plan blocks and fails its report; `running`,
 * `verifying` and `failed_retryable` plans fail terminally. A `draft` or `ready` plan is superseded by the
 * next CMS-03A-10 attempt, and `blocked`, `completed` and `failed_terminal` plans are already settled.
 */
const ROLLBACK_STATES: ReadonlySet<MigrationPlanRecord['state']> = new Set([
  'dry_running',
  'running',
  'verifying',
  'failed_retryable',
]);

const liveLeaseToken = (
  plan: MigrationPlanRecord,
  nowMs: number,
): string | null => {
  if (plan.leaseToken === null || plan.leaseExpiresAt === null) return null;
  const expires = Date.parse(plan.leaseExpiresAt);
  return Number.isFinite(expires) && expires - nowMs > LEASE_MARGIN_MS
    ? plan.leaseToken
    : null;
};

/**
 * Rolls an in-flight plan back to its terminal failure so a new CMS-03A-10 attempt is admitted. It reads the
 * plan again through the Job-fenced claimed read (the attempt's own result does not carry the final plan),
 * uses the plan lease it finds or claims a fresh one, then makes the terminal rollback with reason
 * `MIGRATION_RETRIES_EXHAUSTED`. The runtime's RPC caller is the fenced one, so the claim and the rollback
 * are each preceded by a lease checkpoint. Every failure is reported, never thrown: the Job is failed either
 * way and a plan left behind is the operator signal.
 */
export const rollBackExhaustedPlan = async (
  runtime: MigrationWorkerRuntime,
  claimRequest: CmsSchemaDryRunClaimRequest,
  signal: AbortSignal,
  attempt: number,
): Promise<PreparationExhaustion> => {
  const read = await runtime.call(
    SCHEMA_MIGRATION_RPC.readPlan,
    claimRequest,
    signal,
  );
  if (!read.ok) return 'unavailable';
  const resolved = decodeCmsSchemaDryRunClaimResponse(claimRequest, read.value);
  if (resolved === null) return 'unavailable';
  let plan = resolved.plan;
  if (!ROLLBACK_STATES.has(plan.state)) return 'not_needed';

  const job = claimedJobPayload(claimRequest, plan);
  let leaseToken = liveLeaseToken(plan, runtime.now());
  if (leaseToken === null) {
    // A verifying plan cannot be re-leased; its stored token is tried as found and the RPC decides.
    if (plan.state === 'verifying') leaseToken = plan.leaseToken;
    else {
      const lease = await acquireMigrationLease(
        runtime,
        plan,
        null,
        job,
        signal,
        attempt,
      );
      if (lease.kind !== 'acquired') return 'unavailable';
      plan = lease.plan;
      leaseToken = lease.leaseToken;
    }
  }
  if (leaseToken === null) return 'unavailable';

  const rolledBack = await failAndRollback(
    plan,
    null,
    claimedJobPayload(claimRequest, plan),
    leaseToken,
    PREPARATION_EXHAUSTED_REASON,
    false,
    attempt,
    signal,
    runtime.now,
    runtime.emit,
    runtime.call,
  );
  return rolledBack.outcome === 'failed_terminal' &&
    rolledBack.reasonCode === PREPARATION_EXHAUSTED_REASON
    ? 'rolled_back'
    : 'unavailable';
};
