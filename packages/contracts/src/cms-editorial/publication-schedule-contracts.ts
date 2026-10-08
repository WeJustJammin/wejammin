import { z } from 'zod';

import {
  CmsHashSchema,
  CmsInstantSchema,
  CmsUuidSchema,
  CmsVersionSchema,
} from '../content-schema-registry/primitives.ts';
import {
  IdempotencyKeySchema,
  QuotedVersionSchema,
} from '../request-navigation-security.ts';
import { VersionSetSchema } from './publication-contracts.ts';
import { Bcp47Schema } from './primitives.ts';

/*
 * BE03b schedule, preview, and publication contracts: the CMS-03B-07 schedule
 * body, the CMS-03B-08 preview body and the CMS-03B-09 publication body, with
 * their key-plus-If-Match header transports. They echo the frozen `VersionSet`
 * served by the review-side contracts in `publication-contracts.ts`.
 */

/** BE03b publication-schedule action vocabulary. */
const PublicationScheduleActionSchema = z.enum([
  'publish',
  'unpublish',
  'expire',
  'archive',
]);

/**
 * BE03b IANA timezone grammar (DEC-145): one to three `/`-separated name
 * segments over 1-64 total characters, so `UTC`, `America/New_York`, `Etc/GMT+5`
 * and the three-segment zones `America/Argentina/Buenos_Aires`,
 * `America/Indiana/Indianapolis` and `America/North_Dakota/Center` are all
 * valid. The first segment starts with a letter and no segment is `.` or `..`.
 * Whether the name is a member of the pinned tzdb is Slice 11 runtime.
 */
const TIMEZONE_PATTERN =
  /^[A-Za-z][A-Za-z0-9_+.-]*(?:\/[A-Za-z0-9_+.-]+){0,2}$/u;
const TimezoneSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(TIMEZONE_PATTERN, 'timezone_invalid')
  .refine(
    (value) => value.split('/').every((segment) => !/^\.+$/u.test(segment)),
    'timezone_invalid',
  );

/**
 * BE03b deliverable audience grammar (DEC-145, BE04c): shared by schedule,
 * preview, and publication, `^[a-z0-9_-]{1,48}$`. The value is matched as
 * submitted (never trimmed), so a padded or mixed-case audience is refused.
 */
const AudienceSchema = z
  .string()
  .regex(/^[a-z0-9_-]{1,48}$/u, 'audience_invalid');

/** True when `value` is a real proleptic-Gregorian calendar date. */
const isRealCalendarDate = (
  year: number,
  month: number,
  day: number,
): boolean => {
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const LOCAL_DATETIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?$/u;

/**
 * BE03b local datetime: an offset-free ISO local date and time whose every
 * component is in range (a real calendar day, hour 00-23, minute and second
 * 00-59 with no leap second, at most nine fractional digits). A nonexistent or
 * ambiguous wall-clock time in the zone is Slice 11 runtime, not a shape rule.
 */
const LocalDateTimeSchema = z
  .string()
  .regex(LOCAL_DATETIME_PATTERN, 'local_datetime_must_be_offset_free')
  .refine((value) => {
    const match = LOCAL_DATETIME_PATTERN.exec(value);
    if (match === null) return false;
    const [year, month, day, hour, minute, second] = [
      match[1],
      match[2],
      match[3],
      match[4],
      match[5],
      match[6] ?? '0',
    ].map(Number) as [number, number, number, number, number, number];
    return (
      isRealCalendarDate(year, month, day) &&
      hour <= 23 &&
      minute <= 59 &&
      second <= 59
    );
  }, 'local_datetime_out_of_range');

/**
 * BE03b preview/publication route: a normalized site path. The leading slash
 * excludes any external URL; control characters are excluded explicitly
 * because the repository lint bans control-character regexes.
 */
const PREVIEW_ROUTE_MAX_CHARACTERS = 2048;

/** True when `value` holds a C0, DEL or C1 control character (no control regex: lint). */
const hasControlCharacter = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true;
  }
  return false;
};

const PreviewRouteSchema = z
  .string()
  .max(PREVIEW_ROUTE_MAX_CHARACTERS * 2)
  .refine(
    (value) => Array.from(value).length <= PREVIEW_ROUTE_MAX_CHARACTERS,
    'route_max',
  )
  // One leading slash: an absolute site path, never a URL and never
  // protocol-relative (`//host` is an external URL).
  .refine(
    (value) => value.startsWith('/') && !value.startsWith('//'),
    'route_must_be_normalized_path',
  )
  .refine((value) => !hasControlCharacter(value), 'route_control_characters')
  .refine((value) => !value.includes('\\'), 'route_backslash_cross_origin')
  // A path only: a query or fragment is not part of a normalized route.
  .refine((value) => !/[?#]/u.test(value), 'route_query_or_fragment')
  // Normalized: no empty interior segment (`//`), no `.` or `..` segment, and no
  // percent-encoded dot, slash or backslash (`%2e`, `%2f`, `%5c` are normalized
  // away by common servers). A trailing slash is a valid directory path.
  .refine((value) => {
    if (/%(?:2e|2f|5c)/iu.test(value)) return false;
    const segments = value.slice(1).split('/');
    return !segments.some(
      (segment, index) =>
        segment === '.' ||
        segment === '..' ||
        (segment === '' && index !== segments.length - 1),
    );
  }, 'route_not_normalized');

/**
 * BE03b `PublicationScheduleRequest`: the CMS-03B-07 body. The schedule
 * stores the offset-free local datetime, IANA timezone, resolved UTC instant,
 * tzdb version, and DST disambiguation together, so a nonexistent local time
 * cannot hide behind an offset-carrying local value.
 */
export const PublicationScheduleRequestSchema = z
  .strictObject({
    revisionId: CmsUuidSchema,
    action: PublicationScheduleActionSchema,
    localDateTime: LocalDateTimeSchema,
    timezone: TimezoneSchema,
    resolvedUtc: CmsInstantSchema,
    tzdbVersion: z.string().min(1).max(32),
    disambiguation: z.enum(['none', 'earlier', 'later']),
    audience: AudienceSchema,
    expectedVersion: CmsVersionSchema,
  })
  .readonly();

/**
 * BE03b `PreviewRequest`: the CMS-03B-08 body. The caller echoes the exact
 * version set served by the preparation read and the runtime revalidates it.
 */
export const PreviewRequestSchema = z
  .strictObject({
    entryId: CmsUuidSchema,
    revisionId: CmsUuidSchema,
    locale: Bcp47Schema,
    audience: AudienceSchema,
    route: PreviewRouteSchema,
    versionSet: VersionSetSchema,
  })
  .readonly();

/**
 * BE03b `PublicationRequest`: the CMS-03B-09 body. The frozen hash and exact
 * expected version set must equal the approved candidate; the runtime CAS
 * checks both.
 */
export const PublicationRequestSchema = z
  .strictObject({
    entryId: CmsUuidSchema,
    revisionId: CmsUuidSchema,
    frozenHash: CmsHashSchema,
    expectedVersionSet: VersionSetSchema,
    audience: AudienceSchema,
    expectedVersion: CmsVersionSchema,
  })
  .readonly();

/** BE03b CMS-03B-07 headers: key + exact strong If-Match over JSON. */
export const CmsPublicationScheduleHeadersSchema = z
  .strictObject({
    contentType: z.literal('application/json'),
    idempotencyKey: IdempotencyKeySchema,
    ifMatch: QuotedVersionSchema,
  })
  .readonly();

/** BE03b CMS-03B-07 addressing: the schedule route has no path parameters. */
export const CmsPublicationSchedulePathParamsSchema = z
  .strictObject({})
  .readonly();

/** BE03b CMS-03B-08 headers: key + exact strong If-Match over JSON. */
export const CmsPreviewRequestHeadersSchema = z
  .strictObject({
    contentType: z.literal('application/json'),
    idempotencyKey: IdempotencyKeySchema,
    ifMatch: QuotedVersionSchema,
  })
  .readonly();

/** BE03b CMS-03B-09 headers: key + exact strong If-Match over JSON. */
export const CmsPublicationRequestHeadersSchema = z
  .strictObject({
    contentType: z.literal('application/json'),
    idempotencyKey: IdempotencyKeySchema,
    ifMatch: QuotedVersionSchema,
  })
  .readonly();

/**
 * Implementation checklist only. These are the schedule checks that need the
 * pinned tzdb and the persisted schedule store, so they are Slice 11 runtime and
 * deliberately NOT contract rules: the contract proves shape, never that the
 * wall-clock time exists. Naming them is not proof that any check ran.
 */
export const CMS_PUBLICATION_SCHEDULE_SEAMS = [
  'timezone_is_member_of_pinned_tzdb',
  'nonexistent_local_time_rejected',
  'resolved_utc_equals_local_time_timezone_and_disambiguation',
] as const;

/**
 * Implementation checklist only. These are the checks the CMS-03B-09 runtime
 * must perform against the approved candidate and publication store.
 */
export const CMS_PUBLICATION_SEAMS = [
  'frozen_hash_equals_normalized_revision_hash',
  'expected_version_set_equals_approved_candidate',
  'publication_cas_and_unique_constraint',
] as const;

export type PublicationScheduleRequest = z.infer<
  typeof PublicationScheduleRequestSchema
>;
export type PreviewRequest = z.infer<typeof PreviewRequestSchema>;
export type PublicationRequest = z.infer<typeof PublicationRequestSchema>;
