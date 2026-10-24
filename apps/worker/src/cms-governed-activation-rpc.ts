import {
  ClaimedGovernedActivationSchema,
  CMS_SCHEDULE_CLAIM_BATCH_MAX,
  GovernedActivationExecutionResultSchema,
  type ClaimedGovernedActivation,
  type GovernedActivationExecutionResult,
} from '@wejammin/contracts';
import { z } from 'zod';

import type { AsyncWorkerBindings } from './async-entrypoint';
import type { AsyncRpcClient } from './async-runtime-rpc-types';
import {
  CMS_CLAIM_DUE_GOVERNED_ACTIVATIONS_RPC,
  CMS_EXECUTE_GOVERNED_ACTIVATION_RPC,
} from './cms-governed-activation-rpc-names';

/**
 * CMS-03C-19, the claim/execute port of the scheduled governed activation sweep (BE03c row 188,
 * job type `cms.governed_activation.execute`; mirrors CMS-03B-20).
 *
 * PRINCIPAL: this module is the only route to the two database RPCs, which are granted to the
 * Worker service credential alone and never appear in the browser route inventory. Only
 * `cms-governed-activation-sweep.ts` may import it; the architecture test pins the importer. Both
 * RPCs take one JSON request (`p_request`) shaped exactly like the contract schemas.
 */

/** A reply that breaks the strict CMS-03C-19 contract; it carries no payload. */
export class CmsGovernedActivationResponseError extends Error {
  constructor() {
    super('The governed activation RPC returned an invalid response.');
    this.name = 'CmsGovernedActivationResponseError';
  }
}

/** At most 100 distinct claimed schedules (the claim argument is an integer 1-100). */
const ClaimsSchema = z
  .array(ClaimedGovernedActivationSchema)
  .max(CMS_SCHEDULE_CLAIM_BATCH_MAX)
  .refine(
    (claims) =>
      new Set(claims.map((claim) => claim.scheduleId)).size === claims.length,
  );

/**
 * Claim at most `batch` due schedules. The reply is validated against the strict
 * `ClaimedGovernedActivation` contract and the requested bound, so a malformed or oversized claim
 * list is a contract fault, never a partial batch.
 */
export const claimDueGovernedActivations = async (
  rpc: AsyncRpcClient,
  env: AsyncWorkerBindings,
  batch: number,
  signal?: AbortSignal,
): Promise<readonly ClaimedGovernedActivation[]> => {
  if (
    !Number.isInteger(batch) ||
    batch < 1 ||
    batch > CMS_SCHEDULE_CLAIM_BATCH_MAX
  )
    throw new RangeError('The governed activation claim batch is invalid.');
  const reply = await rpc<unknown>(
    env,
    CMS_CLAIM_DUE_GOVERNED_ACTIVATIONS_RPC,
    { p_request: { batch } },
    signal,
  );
  const claims = ClaimsSchema.safeParse(reply);
  if (!claims.success || claims.data.length > batch)
    throw new CmsGovernedActivationResponseError();
  return claims.data;
};

/**
 * Execute one claimed schedule. `expectedVersion` is the IMMUTABLE REVIEW version the schedule
 * relied on (the claim's `expectedVersion`), NOT CMS-03B-20's advancing `scheduleVersion`; with the
 * lease it fences a stale or duplicate worker (governed-b `## RPC boundary`). The result must
 * answer the schedule that was executed.
 */
export const executeClaimedGovernedActivation = async (
  rpc: AsyncRpcClient,
  env: AsyncWorkerBindings,
  claim: ClaimedGovernedActivation,
  signal?: AbortSignal,
): Promise<GovernedActivationExecutionResult> => {
  const reply = await rpc<unknown>(
    env,
    CMS_EXECUTE_GOVERNED_ACTIVATION_RPC,
    {
      p_request: {
        scheduleId: claim.scheduleId,
        expectedVersion: claim.expectedVersion,
        leaseId: claim.leaseId,
      },
    },
    signal,
  );
  const result = GovernedActivationExecutionResultSchema.safeParse(reply);
  if (!result.success || result.data.scheduleId !== claim.scheduleId)
    throw new CmsGovernedActivationResponseError();
  return result.data;
};
