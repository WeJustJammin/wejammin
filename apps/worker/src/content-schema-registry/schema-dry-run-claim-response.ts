import { CmsUuidSchema, CmsVersionSchema } from '@wejammin/contracts';
import { z } from 'zod';

import {
  ClaimMigrationPlanSchema,
  ClaimRequestedEventSchema,
  requireClaimOwnKeys,
} from './schema-dry-run-claim-shape';

const JobSchema = requireClaimOwnKeys([
  'id',
  'type',
  'version',
  'actingPartyId',
  'originatingEventId',
]).pipe(
  z
    .strictObject({
      id: CmsUuidSchema,
      type: z.literal('cms.schema.dry_run'),
      version: CmsVersionSchema,
      actingPartyId: CmsUuidSchema,
      originatingEventId: CmsUuidSchema,
    })
    .readonly(),
);
const ReportSchema = requireClaimOwnKeys([
  'id',
  'jobId',
  'planId',
  'ownerId',
  'contentTypeId',
  'sourceVersionId',
  'targetVersionId',
]).pipe(
  z
    .strictObject({
      id: CmsUuidSchema,
      jobId: CmsUuidSchema,
      planId: CmsUuidSchema,
      ownerId: CmsUuidSchema,
      contentTypeId: CmsUuidSchema,
      sourceVersionId: CmsUuidSchema.nullable(),
      targetVersionId: CmsUuidSchema,
    })
    .readonly(),
);
const CandidateSchema = requireClaimOwnKeys([
  'id',
  'ownerId',
  'contentTypeId',
  'supersedesId',
  'dryRunId',
]).pipe(
  z
    .strictObject({
      id: CmsUuidSchema,
      ownerId: CmsUuidSchema,
      contentTypeId: CmsUuidSchema,
      supersedesId: CmsUuidSchema.nullable(),
      dryRunId: CmsUuidSchema,
    })
    .readonly(),
);
const PlanScopeSchema = requireClaimOwnKeys(['ownerId', 'dryRunId']).pipe(
  z
    .strictObject({ ownerId: CmsUuidSchema, dryRunId: CmsUuidSchema })
    .readonly(),
);

// Internal consistency only: a later decoder must bind receipt/original event,
// and server-side checks must establish provenance and live job authority.
export const CmsSchemaDryRunClaimResponseSchema = requireClaimOwnKeys([
  'job',
  'requestedEvent',
  'report',
  'candidate',
  'planScope',
  'plan',
])
  .pipe(
    z.strictObject({
      job: JobSchema,
      requestedEvent: ClaimRequestedEventSchema,
      report: ReportSchema,
      candidate: CandidateSchema,
      planScope: PlanScopeSchema,
      plan: ClaimMigrationPlanSchema,
    }),
  )
  .superRefine(
    ({ job, requestedEvent, report, candidate, planScope, plan }, context) => {
      const bindings = [
        [
          'job.originatingEventId',
          job.originatingEventId,
          requestedEvent.eventId,
        ],
        ['requestedEvent.aggregateId', requestedEvent.aggregateId, job.id],
        ['report.jobId', report.jobId, job.id],
        ['report.planId', report.planId, plan.id],
        ['report.ownerId', report.ownerId, job.actingPartyId],
        ['candidate.ownerId', candidate.ownerId, job.actingPartyId],
        ['planScope.ownerId', planScope.ownerId, job.actingPartyId],
        ['report.contentTypeId', report.contentTypeId, plan.contentTypeId],
        [
          'candidate.contentTypeId',
          candidate.contentTypeId,
          plan.contentTypeId,
        ],
        ['report.targetVersionId', report.targetVersionId, candidate.id],
        ['candidate.id', candidate.id, plan.toVersionId],
        [
          'report.sourceVersionId',
          report.sourceVersionId,
          candidate.supersedesId,
        ],
        ['candidate.supersedesId', candidate.supersedesId, plan.fromVersionId],
        ['candidate.dryRunId', candidate.dryRunId, report.id],
        ['planScope.dryRunId', planScope.dryRunId, report.id],
      ] as const;
      for (const [path, actual, expected] of bindings)
        if (actual !== expected)
          context.addIssue({
            code: 'custom',
            path: path.split('.'),
            message: 'Claim response binding mismatch',
          });
    },
  )
  .readonly();

export type CmsSchemaDryRunClaimResponse = z.infer<
  typeof CmsSchemaDryRunClaimResponseSchema
>;
