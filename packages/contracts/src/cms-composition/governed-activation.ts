import { z } from 'zod';

import { refineIfMatchEqualsExpectedVersion } from '../cms-editorial/if-match.ts';
import {
  CmsScheduleLocalDateTimeSchema,
  CmsScheduleTimezoneSchema,
} from '../cms-editorial/publication-schedule-contracts.ts';
import { ScheduleDisambiguationSchema } from '../cms-editorial/workflow-models.ts';
import { ReviewAssignmentReasonSchema } from '../cms-editorial/review-assignment.ts';
import {
  CmsInstantSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import {
  IdempotencyKeySchema,
  QuotedVersionSchema,
} from '../request-navigation-security.ts';
import { GovernedSubjectKindSchema } from './governed-review.ts';

/*
 * CMS-03C-09 governed activation, scheduling and retirement (DEC-113, OD-6):
 * the atomic CAS switch of a template, pattern or taxonomy version. `activate`
 * and `retire` answer 200, `schedule` answers 202 and emits no event.
 */

/**
 * The 03b `ScheduledInstant` (pinned tz database, DST rules, 60 s to 366 d
 * horizon): the offset-free local time, the IANA zone, the resolved UTC
 * instant, the tzdb version it was resolved under and the disambiguation of a
 * repeated local time. Whether the zone is in the pinned tzdb and whether the
 * local time exists is the Time authority at the Worker, not a shape rule.
 */
export const ScheduledInstantSchema = z.strictObject({
  localDateTime: CmsScheduleLocalDateTimeSchema,
  timezone: CmsScheduleTimezoneSchema,
  resolvedUtc: CmsInstantSchema,
  tzdbVersion: z
    .string()
    .regex(/^[A-Za-z0-9._-]{1,32}$/u, 'tzdb_version_invalid'),
  disambiguation: ScheduleDisambiguationSchema,
});

/**
 * CMS-03C-09 body. Every action carries the review `version` as
 * `expectedVersion`; `retire` takes an optional reason of 1-256 NFC code points
 * (DEC-158) and needs no review decision, because retirement only removes
 * exposure.
 */
export const GovernedActivationRequestSchema = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('activate'),
    expectedVersion: CmsVersionSchema,
  }),
  z.strictObject({
    action: z.literal('schedule'),
    expectedVersion: CmsVersionSchema,
    activateAt: ScheduledInstantSchema,
  }),
  z.strictObject({
    action: z.literal('retire'),
    expectedVersion: CmsVersionSchema,
    reason: ReviewAssignmentReasonSchema.optional(),
  }),
]);

/** CMS-03C-09 headers: key + the exact strong review-version If-Match. */
export const GovernedActivationHeadersSchema = z.strictObject({
  contentType: z.literal('application/json'),
  idempotencyKey: IdempotencyKeySchema,
  ifMatch: QuotedVersionSchema,
});

/** OpenAPI transport view: the review path, headers and body. */
export const GovernedActivationApiRequestSchema = z
  .strictObject({
    reviewId: CmsUuidSchema,
    headers: GovernedActivationHeadersSchema,
    body: GovernedActivationRequestSchema,
  })
  .superRefine(refineIfMatchEqualsExpectedVersion);

export type GovernedActivationAction = z.infer<
  typeof GovernedActivationRequestSchema
>['action'];

/** `activate` and `retire` are 200, `schedule` is 202. */
export const governedActivationSuccessStatus = (
  action: GovernedActivationAction,
): 200 | 202 => (action === 'schedule' ? 202 : 200);

/** The event each subject kind emits on an immediate activation or retirement. */
export const CMS_GOVERNED_ACTIVATION_EVENT_TYPES = {
  template_version: 'cms.template.activated.v1',
  pattern_version: 'cms.pattern.activated.v1',
  taxonomy_version: 'cms.taxonomy.changed.v1',
} as const;

export const GovernedActivationEventTypeSchema = z.enum([
  'cms.template.activated.v1',
  'cms.pattern.activated.v1',
  'cms.taxonomy.changed.v1',
]);

/**
 * `GovernedActivationResource`: the state the command left the subject in.
 * `eventType` is set only on a committed immediate activation or retirement and
 * names the event of the subject's kind; a scheduled acceptance emits nothing.
 * `supersededVersion` (DEC-191) is the immutable definition `version` of the
 * lineage's previously active version that a committed immediate activation
 * superseded; it is null for a schedule, a retirement and a lineage's first
 * activation.
 */
export const GovernedActivationResourceSchema = z
  .strictObject({
    reviewId: CmsUuidSchema,
    reviewVersion: CmsVersionSchema,
    subjectKind: GovernedSubjectKindSchema,
    subjectId: CmsUuidSchema,
    lineageId: CmsUuidSchema,
    subjectVersion: z.number().int().positive(),
    supersededVersion: z.number().int().positive().nullable(),
    action: z.enum(['activate', 'schedule', 'retire']),
    subjectState: z.enum(['active', 'scheduled', 'retired']),
    activatedAt: CmsInstantSchema.nullable(),
    scheduledForUtc: CmsInstantSchema.nullable(),
    eventType: GovernedActivationEventTypeSchema.nullable(),
  })
  .superRefine((value, context) => {
    const state = {
      activate: 'active',
      schedule: 'scheduled',
      retire: 'retired',
    }[value.action];
    if (value.subjectState !== state)
      context.addIssue({
        code: 'custom',
        path: ['subjectState'],
        message: `action ${value.action} leaves the subject ${state}`,
      });
    if ((value.action === 'schedule') !== (value.scheduledForUtc !== null))
      context.addIssue({
        code: 'custom',
        path: ['scheduledForUtc'],
        message: 'scheduledForUtc exists exactly for a scheduled activation',
      });
    if (value.action !== 'activate' && value.supersededVersion !== null)
      context.addIssue({
        code: 'custom',
        path: ['supersededVersion'],
        message: 'only an immediate activation supersedes a version',
      });
    if (value.action === 'activate' && value.activatedAt === null)
      context.addIssue({
        code: 'custom',
        path: ['activatedAt'],
        message: 'an immediate activation records activatedAt',
      });
    if (value.action === 'schedule' && value.activatedAt !== null)
      context.addIssue({
        code: 'custom',
        path: ['activatedAt'],
        message: 'a scheduled acceptance has not activated the subject',
      });
    const expectedEvent =
      value.action === 'schedule'
        ? null
        : CMS_GOVERNED_ACTIVATION_EVENT_TYPES[value.subjectKind];
    if (value.eventType !== expectedEvent)
      context.addIssue({
        code: 'custom',
        path: ['eventType'],
        message:
          'eventType is set only on an immediate activation or retirement and names the subject kind event',
      });
  })
  .readonly();

export type ScheduledInstant = z.infer<typeof ScheduledInstantSchema>;
export type GovernedActivationRequest = z.infer<
  typeof GovernedActivationRequestSchema
>;
export type GovernedActivationResource = z.infer<
  typeof GovernedActivationResourceSchema
>;
