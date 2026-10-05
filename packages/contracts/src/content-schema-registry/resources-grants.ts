import { z } from 'zod';

import {
  CmsCapabilityGrantLastActionSchema,
  CmsCapabilityGrantReasonSchema,
  CmsCapabilityGrantStateSchema,
  CmsUtcDateSchema,
  GrantableCmsCapabilitySchema,
  daysBetweenUtcDates,
  utcDateToEpochMs,
} from './models-grants.ts';
import {
  CmsInstantSchema,
  CmsOpaqueCursorSchema,
  CmsUuidSchema,
} from './primitives.ts';
import { resourceMetaShape } from './resources-meta.ts';

const MILLISECONDS_PER_DAY = 86_400_000;
/** DEC-120: a standing CMS grant spans at most 90 UTC days (validThrough <= validFrom + 89). */
const MAX_GRANT_SPAN_DAYS = 89;

/**
 * One owner CMS capability grant aggregate. `subjectPersonId` is returned
 * only to the receipt-derived owner, who supplied it; grantor, actor, party,
 * private-binding, and ownership identifiers are absent.
 */
export const CmsCapabilityGrantResourceSchema = z
  .strictObject({
    ...resourceMetaShape,
    resourceKind: z.literal('cms_capability_grant'),
    state: CmsCapabilityGrantStateSchema,
    subjectPersonId: CmsUuidSchema,
    capability: GrantableCmsCapabilitySchema,
    validFrom: CmsUtcDateSchema,
    validThrough: CmsUtcDateSchema,
    /** 00:00:00Z of the UTC day after `validThrough`. */
    endsAt: CmsInstantSchema,
    lastAction: CmsCapabilityGrantLastActionSchema,
    reason: CmsCapabilityGrantReasonSchema.nullable(),
  })
  .superRefine((value, context) => {
    const spanDays = daysBetweenUtcDates(value.validFrom, value.validThrough);
    if (spanDays !== null && (spanDays < 0 || spanDays > MAX_GRANT_SPAN_DAYS))
      context.addIssue({
        code: 'custom',
        path: ['validThrough'],
        message: 'grant_term_spans_at_most_ninety_utc_days',
      });
    const throughMs = utcDateToEpochMs(value.validThrough);
    if (
      throughMs !== null &&
      Date.parse(value.endsAt) !== throughMs + MILLISECONDS_PER_DAY
    )
      context.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'ends_at_must_be_start_of_day_after_valid_through',
      });
  })
  .readonly();

export const CmsCapabilityGrantListPageSchema = z
  .strictObject({
    items: z.array(CmsCapabilityGrantResourceSchema).max(100).readonly(),
    nextCursor: CmsOpaqueCursorSchema.nullable(),
  })
  .readonly();

export type CmsCapabilityGrantResource = z.infer<
  typeof CmsCapabilityGrantResourceSchema
>;
export type CmsCapabilityGrantListPage = z.infer<
  typeof CmsCapabilityGrantListPageSchema
>;
