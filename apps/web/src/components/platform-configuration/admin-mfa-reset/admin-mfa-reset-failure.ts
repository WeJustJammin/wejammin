import type { MfaFailure } from '../../identity-authority/step-up-mfa/mfa-failure';
import { DEFAULT_LOCK_SECONDS } from '../../identity-authority/step-up-mfa/step-up-failure';
import {
  ADMIN_RESET_COPY,
  type ResetFieldErrors,
} from './admin-mfa-reset-values';
import { isStepUpRequiredCode } from '../../step-up-required';

export type ResetNoticeKind =
  | 'degraded'
  | 'forbidden'
  | 'in-progress'
  | 'invalid'
  | 'locked'
  | 'not-found'
  | 'refresh'
  | 'self'
  | 'sign-in'
  | 'step-up'
  | 'unknown';

export type ResetFailureView = Readonly<{
  kind: ResetNoticeKind;
  message: string;
  fieldErrors: ResetFieldErrors;
  retryAfterSeconds: number | null;
  showRequestId: boolean;
}>;

const view = (
  kind: ResetNoticeKind,
  message: string,
  overrides: Partial<ResetFailureView> = {},
): ResetFailureView => ({
  kind,
  message,
  fieldErrors: {},
  retryAfterSeconds: null,
  showRequestId: false,
  ...overrides,
});

const schemaFieldErrors = (failure: MfaFailure): ResetFieldErrors => ({
  ...(failure.violationFields.includes('targetPersonId')
    ? { targetPersonId: ADMIN_RESET_COPY.personInvalid }
    : {}),
  ...(failure.violationFields.includes('reason')
    ? { reason: ADMIN_RESET_COPY.reasonInvalid }
    : {}),
});

/**
 * Maps a failed CFG-05B-06 call to FE05 copy and routing. Only the status
 * class is disclosed; server wording never reaches the operator, and an
 * outcome the client cannot know is never presented as a reset.
 */
export const resetFailureView = (failure: MfaFailure): ResetFailureView => {
  const { status, code } = failure;
  if (status === 401)
    return isStepUpRequiredCode(code)
      ? view('step-up', '')
      : view('sign-in', ADMIN_RESET_COPY.sessionEnded);
  if (status === 403) return view('forbidden', ADMIN_RESET_COPY.forbidden);
  if (status === 404) return view('not-found', ADMIN_RESET_COPY.notFound);
  if (status === 409)
    return code === 'MFA_RESET_IN_PROGRESS'
      ? view('in-progress', ADMIN_RESET_COPY.inProgress)
      : view('refresh', ADMIN_RESET_COPY.refresh);
  if (status === 422 && code === 'MFA_RESET_INVALID')
    return view('self', ADMIN_RESET_COPY.selfTarget, {
      fieldErrors: schemaFieldErrors(failure),
    });
  if (status === 400 || status === 422)
    return view('invalid', ADMIN_RESET_COPY.invalid, {
      fieldErrors: schemaFieldErrors(failure),
    });
  if (status === 429)
    return view('locked', 'Too many attempts. Try again later.', {
      retryAfterSeconds: failure.retryAfterSeconds ?? DEFAULT_LOCK_SECONDS,
    });
  if (status === 0 || status === 504)
    return view('unknown', ADMIN_RESET_COPY.unknown, { showRequestId: true });
  return view('degraded', ADMIN_RESET_COPY.degraded, { showRequestId: true });
};
