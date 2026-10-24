import {
  CMS_SLICE_12_OPERATION_REASONS,
  CmsSlice12ReasonCodeSchema,
  CmsViolationSchema,
  cmsSlice12ReasonStatus,
} from '@wejammin/contracts';

/** The fixed violation message BE00 allows across the first-party boundary. */
const VIOLATION_MESSAGE = 'The value is invalid.';
/** BE00: at most 50 violations per refusal. */
const MAX_VIOLATIONS = 50;

const asRecord = (source: unknown): Readonly<Record<string, unknown>> | null =>
  typeof source === 'object' && source !== null && !Array.isArray(source)
    ? (source as Readonly<Record<string, unknown>>)
    : null;

/**
 * BE03c 1304: a CMS-03C-02 refusal carries exactly one lowercase `reasonCode` token of its own list on the
 * one status that list gives the token, and no other member (DEC-186 for the digest token). A token on
 * another status, one this operation does not publish, or the pre-contract `CAPABILITY_REQUIRED` is
 * dropped, never repaired.
 */
export const patternInstanceReason = (
  status: number,
  source: unknown,
): string | null => {
  if (status !== 403 && status !== 409 && status !== 422) return null;
  const parsed = CmsSlice12ReasonCodeSchema.safeParse(
    asRecord(source)?.reasonCode,
  );
  return parsed.success &&
    cmsSlice12ReasonStatus(parsed.data) === status &&
    (
      CMS_SLICE_12_OPERATION_REASONS['CMS-03C-02'] as readonly string[]
    ).includes(parsed.data)
    ? parsed.data
    : null;
};

/**
 * The bounded RFC 6901 violations of a 422 (DEC-186 `/slotPath`, `/overrides`, the producer's `/patternId`),
 * rebuilt member by member so no private text crosses back to the browser.
 */
export const patternInstanceViolations = (
  source: unknown,
): ReadonlyArray<Readonly<{ path: string; code: string; message: string }>> => {
  const raw = asRecord(source)?.violations;
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_VIOLATIONS).flatMap((candidate: unknown) => {
    const record = asRecord(candidate);
    const parsed = CmsViolationSchema.safeParse({
      path: record?.path,
      code: record?.code,
      message: VIOLATION_MESSAGE,
    });
    return parsed.success ? [parsed.data] : [];
  });
};
