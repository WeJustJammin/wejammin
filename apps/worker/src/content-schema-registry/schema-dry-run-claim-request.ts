import { CmsUuidSchema, CmsVersionSchema } from '@wejammin/contracts';
import { z } from 'zod';

import {
  ClaimRequestedEventSchema,
  requireClaimOwnKeys,
} from './schema-dry-run-claim-shape';

const ClaimedJobSchema = requireClaimOwnKeys([
  'jobId',
  'version',
  'leaseToken',
]).pipe(
  z
    .strictObject({
      jobId: CmsUuidSchema,
      // Actual claim receipt version, independent of the immutable event version.
      version: CmsVersionSchema,
      leaseToken: CmsUuidSchema,
    })
    .transform((value) => Object.freeze(value)),
);

/** Private server-resolution request; no caller-selected report or plan IDs. */
export const CmsSchemaDryRunClaimRequestSchema = requireClaimOwnKeys([
  'claimedJob',
  'requestedEvent',
])
  .pipe(
    z.strictObject({
      claimedJob: ClaimedJobSchema,
      requestedEvent: ClaimRequestedEventSchema,
    }),
  )
  .refine(
    ({ claimedJob, requestedEvent }) =>
      claimedJob.jobId === requestedEvent.aggregateId,
    {
      message: 'Claim job and event aggregate differ',
      path: ['requestedEvent', 'aggregateId'],
    },
  )
  .transform((value) => Object.freeze(value));

export type CmsSchemaDryRunClaimRequest = z.infer<
  typeof CmsSchemaDryRunClaimRequestSchema
>;
