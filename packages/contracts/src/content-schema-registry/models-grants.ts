import { z } from 'zod';

/**
 * The closed, code-owned registry of CMS capabilities the owner may grant
 * (BE03a DEC-119). It is extended only by code plus a forward migration.
 * `cms.schema_review` (assignment-only), `cms.schema_review.assign`
 * (owner-only), `cms.delivery_review` and its `.assign` capability,
 * `admin.*` keys, wildcards, and unregistered keys are not members.
 */
export const GRANTABLE_CMS_CAPABILITIES = [
  'cms.schema_registry.read',
  'cms.schema_designer',
  'cms.template_designer',
  'cms.taxonomy_curator',
  'cms.author',
  'cms.editor',
  'cms.reviewer',
  'cms.reviewer.policy',
  'cms.reviewer.legal',
  'cms.reviewer.security',
  'cms.reviewer.financial',
  'cms.publisher',
  'cms.navigation_editor',
  'cms.media_contributor',
  'cms.media_curator',
] as const;

export const GrantableCmsCapabilitySchema = z.enum(GRANTABLE_CMS_CAPABILITIES);

/** `lapsed` is an `active` physical row whose `validThrough` has passed. */
export const CmsCapabilityGrantStateSchema = z.enum([
  'active',
  'lapsed',
  'revoked',
]);

export const CmsCapabilityGrantLastActionSchema = z.enum([
  'granted',
  'renewed',
  'revoked',
]);

export const CmsCapabilityGrantReasonSchema = z.string().min(1).max(256);

const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * Epoch milliseconds of 00:00:00Z on a real `YYYY-MM-DD` calendar date, or
 * `null` when the text is not a real calendar date.
 */
export const utcDateToEpochMs = (value: string): number | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) return null;
  const [year, month, day] = [match[1], match[2], match[3]].map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date.getTime()
    : null;
};

/** Whole UTC days from `from` to `to`; `null` when either is not a real date. */
export const daysBetweenUtcDates = (
  from: string,
  to: string,
): number | null => {
  const start = utcDateToEpochMs(from);
  const end = utcDateToEpochMs(to);
  return start === null || end === null
    ? null
    : Math.round((end - start) / MILLISECONDS_PER_DAY);
};

export const CmsUtcDateSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/u, 'utc_date_invalid')
  .refine((value) => utcDateToEpochMs(value) !== null, 'not a real calendar date');

export type GrantableCmsCapability = z.infer<
  typeof GrantableCmsCapabilitySchema
>;
export type CmsCapabilityGrantState = z.infer<
  typeof CmsCapabilityGrantStateSchema
>;
