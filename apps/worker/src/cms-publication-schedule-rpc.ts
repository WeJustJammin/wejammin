import {
  CMS_SCHEDULE_CLAIM_BATCH_MAX,
  ClaimDueSchedulesResultSchema,
  ScheduleExecutionResultSchema,
  type ClaimedSchedule,
  type PreflightEvidence,
  type ScheduleExecutionResult,
} from '@wejammin/contracts';

import type { AsyncWorkerBindings } from './async-entrypoint';
import type { AsyncRpcClient } from './async-runtime-rpc-types';
import {
  CMS_CLAIM_DUE_SCHEDULES_RPC,
  CMS_EXECUTE_SCHEDULE_RPC,
} from './cms-publication-schedule-rpc-names';

/**
 * CMS-03B-20, the claim/execute port of the scheduled publication sweep
 * (BE03b "Internal service operations", DEC-156).
 *
 * PRINCIPAL: this module is the only route to the two database RPCs, which are
 * granted to the Worker service credential alone and never appear in the
 * browser route inventory. Only `cms-publication-schedule-sweep.ts` may import
 * it; the architecture test pins the importer. Both RPCs take one JSON request
 * (`p_request`) shaped exactly like the contract schemas.
 */

/** A reply that breaks the strict CMS-03B-20 contract; it carries no payload. */
export class CmsScheduleResponseError extends Error {
  constructor() {
    super('The publication schedule RPC returned an invalid response.');
    this.name = 'CmsScheduleResponseError';
  }
}

/**
 * Claim at most `batch` due schedules. The reply is validated against the strict
 * `ClaimedSchedule` contract and the requested bound, so a malformed or
 * oversized claim list is a contract fault, never a partial batch.
 */
export const claimDueSchedules = async (
  rpc: AsyncRpcClient,
  env: AsyncWorkerBindings,
  batch: number,
  signal?: AbortSignal,
): Promise<readonly ClaimedSchedule[]> => {
  const reply = await rpc<unknown>(
    env,
    CMS_CLAIM_DUE_SCHEDULES_RPC,
    { p_request: { batch } },
    signal,
  );
  const claims = ClaimDueSchedulesResultSchema.safeParse(reply);
  if (
    !claims.success ||
    claims.data.length > Math.min(batch, CMS_SCHEDULE_CLAIM_BATCH_MAX)
  )
    throw new CmsScheduleResponseError();
  return claims.data;
};

/**
 * Execute one claimed schedule with the Worker-verified accessibility proof (or
 * null when the checker produced none). `expectedVersion` is the schedule row
 * version the claim produced; with the lease it fences a stale or duplicate
 * worker. The result must answer the schedule that was executed.
 */
export const executeClaimedSchedule = async (
  rpc: AsyncRpcClient,
  env: AsyncWorkerBindings,
  claim: ClaimedSchedule,
  evidence: PreflightEvidence | null,
  signal?: AbortSignal,
): Promise<ScheduleExecutionResult> => {
  const reply = await rpc<unknown>(
    env,
    CMS_EXECUTE_SCHEDULE_RPC,
    {
      p_request: {
        scheduleId: claim.scheduleId,
        expectedVersion: claim.scheduleVersion,
        leaseId: claim.leaseId,
        evidence,
      },
    },
    signal,
  );
  const result = ScheduleExecutionResultSchema.safeParse(reply);
  if (!result.success || result.data.scheduleId !== claim.scheduleId)
    throw new CmsScheduleResponseError();
  return result.data;
};
