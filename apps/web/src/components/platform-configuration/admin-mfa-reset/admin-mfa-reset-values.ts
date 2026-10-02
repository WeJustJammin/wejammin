import {
  Cfg05b06MfaFactorResetRequestSchema,
  type Cfg05b06MfaFactorResetRequest,
} from '@wejammin/contracts';

export const REASON_MAX_LENGTH = 512;

/** Exact FE05 `AdminMfaFactorResetForm` copy. */
export const ADMIN_RESET_COPY = {
  personHelp:
    "Enter the person's ID exactly as it appears in the admin directory.",
  personInvalid:
    'Enter the 36-character person ID, for example from the admin directory.',
  reasonInvalid: `Enter a reason between 1 and ${REASON_MAX_LENGTH} characters.`,
  prerequisite:
    "Verify your identity to reset a person's two-step verification.",
  confirmation:
    'Remove every two-step verification factor for this person. They will need to set up a new authenticator before they can approve protected actions. This cannot be undone.',
  completed: 'Two-step verification was reset for this person.',
  reconciling: 'The reset was recorded and is finishing. Check back shortly.',
  notSaved: 'Your entries were not saved.',
  sessionEnded: 'Your session ended. Sign in again to continue.',
  forbidden: 'You do not have permission to reset two-step verification.',
  notFound: 'That person could not be found.',
  inProgress: 'A reset for this person is already finishing.',
  refresh:
    'This request conflicted with an earlier one. Refresh the page and enter the details again.',
  selfTarget:
    'You cannot reset your own two-step verification. Ask another administrator.',
  invalid: 'Check the person ID and the reason, then try again.',
  degraded: 'The reset service is temporarily unavailable.',
  unknown:
    'We could not confirm whether the reset finished. Do not assume it did. Retry to find out; the same request is never applied twice.',
  runbook:
    'If you are the only administrator and have lost your own authenticator, follow the runbook named sole-admin-mfa-lockout.',
} as const;

export type ResetValues = Readonly<{ targetPersonId: string; reason: string }>;
export type ResetField = 'targetPersonId' | 'reason';
export type ResetFieldErrors = Readonly<Partial<Record<ResetField, string>>>;

const trimmed = (values: ResetValues): ResetValues => ({
  targetPersonId: values.targetPersonId.trim(),
  reason: values.reason.trim(),
});

/** The strict CFG-05B-06 body, or null when either field is invalid. */
export const buildResetRequest = (
  values: ResetValues,
): Cfg05b06MfaFactorResetRequest | null => {
  const parsed = Cfg05b06MfaFactorResetRequestSchema.safeParse(trimmed(values));
  return parsed.success ? parsed.data : null;
};

export const validateResetField = (
  field: ResetField,
  values: ResetValues,
): string | null => {
  const request = trimmed(values);
  const parsed = Cfg05b06MfaFactorResetRequestSchema.safeParse({
    targetPersonId: request.targetPersonId,
    reason: 'x',
  });
  if (field === 'targetPersonId')
    return parsed.success ? null : ADMIN_RESET_COPY.personInvalid;
  return request.reason.length >= 1 &&
    request.reason.length <= REASON_MAX_LENGTH
    ? null
    : ADMIN_RESET_COPY.reasonInvalid;
};

export const validateResetValues = (values: ResetValues): ResetFieldErrors => {
  const person = validateResetField('targetPersonId', values);
  const reason = validateResetField('reason', values);
  return {
    ...(person === null ? {} : { targetPersonId: person }),
    ...(reason === null ? {} : { reason }),
  };
};
