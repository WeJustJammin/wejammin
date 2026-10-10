import type { JobEffectInput } from '@wejammin/application';
import { CmsVersionSchema } from '@wejammin/contracts';

import { isRecord } from './migration-worker-schema-core';
import {
  CmsSchemaDryRunClaimRequestSchema,
  type CmsSchemaDryRunClaimRequest,
} from './schema-dry-run-claim-request';

/** Bind the supplied receipt, not enduring lease authority, to the original job. */
export const buildCmsSchemaDryRunClaimRequest = (
  input: JobEffectInput,
): CmsSchemaDryRunClaimRequest | null => {
  if (
    !isRecord(input) ||
    !isRecord(input.job) ||
    !isRecord(input.envelope) ||
    !isRecord(input.claimedLease)
  )
    return null;

  const { job, envelope, claimedLease } = input;
  if (
    job.type !== 'cms.schema.dry_run' ||
    claimedLease.jobId !== job.id ||
    claimedLease.jobId !== envelope.aggregateId ||
    claimedLease.leaseToken !== input.leaseToken ||
    claimedLease.expectedVersion !== job.version ||
    !CmsVersionSchema.safeParse(job.version).success ||
    typeof claimedLease.leaseUntilMs !== 'number' ||
    !Number.isFinite(claimedLease.leaseUntilMs) ||
    claimedLease.leaseUntilMs < 0
  )
    return null;

  const parsed = CmsSchemaDryRunClaimRequestSchema.safeParse({
    claimedJob: {
      jobId: claimedLease.jobId,
      version: claimedLease.version,
      leaseToken: claimedLease.leaseToken,
    },
    // Validate the whole original object, including its own-key shape.
    requestedEvent: envelope,
  });
  return parsed.success ? parsed.data : null;
};
