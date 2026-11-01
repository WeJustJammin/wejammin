import { z } from 'zod';

import {
  CmsInstantSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import { GovernedSubjectKindSchema } from './governed-review.ts';

/*
 * CMS-03C-19 scheduled governed activation (OD-6): two database RPCs run by the
 * Worker `scheduled` sweep as the BE00 job type below. Neither is a browser
 * route, proxy or client type; these schemas are exported for the Worker and
 * SQL tests. The claim, lease, retry ladder (15 s / 60 s / 300 s, three
 * attempts) and idempotency mirror CMS-03B-20.
 */

/** The BE00 job type the Worker `scheduled` sweep runs. */
export const CMS_GOVERNED_ACTIVATION_JOB_TYPE =
  'cms.governed_activation.execute';

/**
 * `platform_private.cms_claim_due_governed_activations(batch)`: claims due
 * `pending` or `failed_retryable` schedules `FOR UPDATE SKIP LOCKED`.
 */
export const GovernedActivationClaimRequestSchema = z.strictObject({
  batch: z.number().int().min(1).max(100),
});

/** One claimed schedule; `expectedVersion` is the approved review version stored at acceptance. */
export const ClaimedGovernedActivationSchema = z.strictObject({
  scheduleId: CmsUuidSchema,
  reviewId: CmsUuidSchema,
  subjectKind: GovernedSubjectKindSchema,
  subjectId: CmsUuidSchema,
  scheduleVersion: CmsVersionSchema,
  expectedVersion: CmsVersionSchema,
  leaseId: CmsUuidSchema,
  correlationId: CmsUuidSchema,
});

/** `platform_private.cms_execute_governed_activation(schedule_id, expected_version, lease_id)`. */
export const GovernedActivationExecutionRequestSchema = z.strictObject({
  scheduleId: CmsUuidSchema,
  expectedVersion: CmsVersionSchema,
  leaseId: CmsUuidSchema,
});

/**
 * The closed `reasonCode` of a `blocked` schedule: the four terminal failures
 * of execution plus the exhausted retry ladder. An invalidation of the review
 * while the subject is `scheduled` cancels the schedule with
 * `approval_invalidated` instead.
 */
export const CMS_GOVERNED_SCHEDULE_BLOCK_REASONS = [
  'approval_invalidated',
  'dependency_changed',
  'activation_authority_ended',
  'canonical_source_unavailable',
  'retries_exhausted',
] as const;

/**
 * `GovernedActivationExecutionResult`. A `completed` run records the actual
 * instant and the signed deviation from the scheduled instant (a late run
 * activates and records it); a repeated run on a `completed` schedule is
 * `already_completed`; a terminal failure is `blocked` with a closed reason.
 */
export const GovernedActivationExecutionResultSchema = z
  .strictObject({
    scheduleId: CmsUuidSchema,
    outcome: z.enum([
      'completed',
      'blocked',
      'failed_retryable',
      'already_completed',
    ]),
    reasonCode: z
      .string()
      .regex(/^[a-z][a-z0-9_]{0,63}$/u)
      .nullable(),
    actualUtc: CmsInstantSchema.nullable(),
    deviationSeconds: z.number().int().nullable(),
  })
  .superRefine((value, context) => {
    if (value.outcome === 'completed') {
      if (value.actualUtc === null)
        context.addIssue({
          code: 'custom',
          path: ['actualUtc'],
          message: 'a completed activation records its actual instant',
        });
      if (value.deviationSeconds === null)
        context.addIssue({
          code: 'custom',
          path: ['deviationSeconds'],
          message: 'a completed activation records its deviation',
        });
    }
    if (
      value.outcome === 'blocked' &&
      !(
        CMS_GOVERNED_SCHEDULE_BLOCK_REASONS as readonly (string | null)[]
      ).includes(value.reasonCode)
    )
      context.addIssue({
        code: 'custom',
        path: ['reasonCode'],
        message: 'a blocked schedule carries one closed block reason',
      });
  })
  .readonly();

export type GovernedScheduleBlockReason =
  (typeof CMS_GOVERNED_SCHEDULE_BLOCK_REASONS)[number];
export type ClaimedGovernedActivation = z.infer<
  typeof ClaimedGovernedActivationSchema
>;
export type GovernedActivationExecutionResult = z.infer<
  typeof GovernedActivationExecutionResultSchema
>;
