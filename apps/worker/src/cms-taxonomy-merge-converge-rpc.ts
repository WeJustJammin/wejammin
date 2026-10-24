import { z } from 'zod';

import type { AsyncWorkerBindings } from './async-entrypoint';
import type { AsyncRpcClient } from './async-runtime-rpc-types';
import {
  CANONICAL_JOB_UUID,
  CMS_RUN_TAXONOMY_MERGE_CONVERGE_RPC,
} from './cms-taxonomy-merge-converge-names';

/**
 * `platform_api.cms_run_taxonomy_merge_converge`, the fenced handler of the BE00 job `cms.taxonomy.merge_converge`
 * (lane taxonomy-terms f2, `## RPC boundary`; BE03c 1334). Granted to the Worker service credential alone; the request
 * is exactly the claimed job (the optional `batch` is not spec surface, so it is never sent and the database converges
 * its default 5,000 assignments); the answer is exactly `{ converged, remaining, continuationJobId }`. When work
 * remains the database has ALREADY requested a fresh BE00 continuation job and names it, so the caller never re-queues
 * the current one. An answer that breaks that coupling is a contract fault.
 */
export type ClaimedMergeJob = Readonly<{
  jobId: string;
  /** The version the claim returned (a decimal string), the fence operand. */
  version: string;
  leaseToken: string;
}>;

export class CmsTaxonomyMergeConvergeResponseError extends Error {
  constructor() {
    super('The taxonomy merge convergence RPC returned an invalid response.');
    this.name = 'CmsTaxonomyMergeConvergeResponseError';
  }
}

const AnswerSchema = z
  .strictObject({
    converged: z.number().int().min(0),
    remaining: z.number().int().min(0),
    continuationJobId: z.string().regex(CANONICAL_JOB_UUID).nullable(),
  })
  .refine(
    (answer) => answer.remaining > 0 === (answer.continuationJobId !== null),
  );

export type MergeConvergeAnswer = z.infer<typeof AnswerSchema>;

export const runTaxonomyMergeConverge = async (
  rpc: AsyncRpcClient,
  env: AsyncWorkerBindings,
  claim: ClaimedMergeJob,
  signal?: AbortSignal,
): Promise<MergeConvergeAnswer> => {
  const reply = await rpc<unknown>(
    env,
    CMS_RUN_TAXONOMY_MERGE_CONVERGE_RPC,
    {
      p_request: {
        claimedJob: {
          jobId: claim.jobId,
          version: claim.version,
          leaseToken: claim.leaseToken,
        },
      },
    },
    signal,
  );
  const answer = AnswerSchema.safeParse(reply);
  if (!answer.success) throw new CmsTaxonomyMergeConvergeResponseError();
  return answer.data;
};
