import {
  CapabilityGrantRenewalRequestSchema,
  CapabilityGrantRequestSchema,
  CapabilityGrantRevocationRequestSchema,
  CmsUtcDateSchema,
  GrantableCmsCapabilitySchema,
} from '@wejammin/contracts';

export interface CmsCapabilityGrantTermBounds {
  readonly minDate: string;
  readonly maxDate: string;
}

/** FE03 per-field copy (grant console form table). */
export const GRANT_ERROR_COPY = {
  person: "Enter the person's ID as a UUID.",
  capability: 'Choose a capability from the list.',
  reason: 'Keep the reason to 256 characters.',
  serverTerm: 'Choose an end date no more than 90 days from today (UTC).',
} as const;

export const GRANT_PERSON_HELPER =
  'Enter the person ID exactly as the person gave it to you. The person must already be a confirmed member of your organization.';
export const GRANT_TERM_HELPER =
  'The grant ends at the end of this date (UTC) and lasts at most 90 days. You can renew it or revoke it at any time.';
export const MAX_REASON_LENGTH = 256;

export type GrantFieldName =
  'person' | 'capability' | 'validThrough' | 'reason';
export type GrantFieldErrors = Partial<Record<GrantFieldName, string>>;

export const grantTermFieldError = (bounds: CmsCapabilityGrantTermBounds) =>
  `Choose an end date from ${bounds.minDate} through ${bounds.maxDate} (UTC).`;

const termOk = (value: string, bounds: CmsCapabilityGrantTermBounds): boolean =>
  CmsUtcDateSchema.safeParse(value).success &&
  value >= bounds.minDate &&
  value <= bounds.maxDate;

const reasonOk = (reason: string): boolean =>
  reason.trim() === '' ||
  CapabilityGrantRevocationRequestSchema.safeParse({
    expectedVersion: '1',
    reason,
  }).success;

export interface GrantFormValues {
  readonly subjectPersonId: string;
  readonly capability: string;
  readonly validThrough: string;
  readonly reason: string;
}

export const validateGrantFields = (
  values: GrantFormValues,
  bounds: CmsCapabilityGrantTermBounds,
): GrantFieldErrors => {
  const errors: { -readonly [K in GrantFieldName]?: string } = {};
  const shape = CapabilityGrantRequestSchema.safeParse({
    subjectPersonId: values.subjectPersonId.trim(),
    capability: values.capability,
    validThrough: '2026-01-01',
  });
  const failed = new Set(
    shape.success ? [] : shape.error.issues.map((issue) => issue.path[0]),
  );
  if (failed.has('subjectPersonId')) errors.person = GRANT_ERROR_COPY.person;
  if (!GrantableCmsCapabilitySchema.safeParse(values.capability).success)
    errors.capability = GRANT_ERROR_COPY.capability;
  if (!termOk(values.validThrough, bounds))
    errors.validThrough = grantTermFieldError(bounds);
  if (!reasonOk(values.reason)) errors.reason = GRANT_ERROR_COPY.reason;
  return errors;
};

export const validateRenewalFields = (
  values: Pick<GrantFormValues, 'validThrough' | 'reason'>,
  bounds: CmsCapabilityGrantTermBounds,
): GrantFieldErrors => {
  const errors: { -readonly [K in GrantFieldName]?: string } = {};
  const shape = CapabilityGrantRenewalRequestSchema.safeParse({
    expectedVersion: '1',
    validThrough: values.validThrough,
  });
  if (!shape.success || !termOk(values.validThrough, bounds))
    errors.validThrough = grantTermFieldError(bounds);
  if (!reasonOk(values.reason)) errors.reason = GRANT_ERROR_COPY.reason;
  return errors;
};

export const validateRevocationFields = (
  values: Pick<GrantFormValues, 'reason'>,
): GrantFieldErrors =>
  reasonOk(values.reason) ? {} : { reason: GRANT_ERROR_COPY.reason };

export interface GrantViolation {
  readonly pointer: string;
  readonly code: string | null;
}

const POINTER_FIELDS: Readonly<Record<string, GrantFieldName>> = {
  '/subjectPersonId': 'person',
  '/capability': 'capability',
  '/validThrough': 'validThrough',
  '/reason': 'reason',
};

/** Map server 422 violations onto field errors; unknown pointers are dropped. */
export const violationFieldErrors = (
  violations: readonly GrantViolation[],
  bounds: CmsCapabilityGrantTermBounds,
): GrantFieldErrors => {
  const errors: { -readonly [K in GrantFieldName]?: string } = {};
  for (const violation of violations) {
    const field = POINTER_FIELDS[violation.pointer];
    if (field === undefined) continue;
    errors[field] =
      field === 'person'
        ? GRANT_ERROR_COPY.person
        : field === 'capability'
          ? GRANT_ERROR_COPY.capability
          : field === 'reason'
            ? GRANT_ERROR_COPY.reason
            : violation.code === 'grant_term_spans_at_most_ninety_utc_days'
              ? GRANT_ERROR_COPY.serverTerm
              : grantTermFieldError(bounds);
  }
  return errors;
};
