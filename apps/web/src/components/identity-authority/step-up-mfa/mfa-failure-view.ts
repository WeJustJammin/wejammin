import { ONE_TIME_CODE_COPY } from './one-time-code';
import type { MfaFailure } from './mfa-failure';
import { DEFAULT_LOCK_SECONDS, STEP_UP_COPY } from './step-up-failure';

export type MfaContext = 'start' | 'verify' | 'remove' | 'cancel' | 'refresh';

export type MfaNoticeKind =
  | 'code'
  | 'conflict'
  | 'degraded'
  | 'expired'
  | 'gate'
  | 'last-factor'
  | 'limit'
  | 'locked'
  | 'name'
  | 'reload'
  | 'sign-in'
  | 'step-up';

export type MfaFailureView = Readonly<{
  kind: MfaNoticeKind;
  message: string;
  clearCode: boolean;
  retryAfterSeconds: number | null;
  showRequestId: boolean;
}>;

export const MFA_COPY = {
  firstFactorSignIn:
    'For your security, sign in again to set up your first authenticator.',
  sessionEnded: 'Your session ended. Sign in again to continue.',
  limit: 'You have reached the limit of 10 authenticators. Remove one first.',
  nameTaken:
    'You already have an authenticator with that name. Choose another name.',
  nameInvalid: 'Enter a name between 1 and 80 characters.',
  expired: 'Setup expired. Start again.',
  conflict:
    'This page was out of date. The list has been refreshed; review it and try again.',
  lastFactor:
    'You still have access that needs verification, so add another authenticator before removing this one.',
} as const;

const view = (
  kind: MfaNoticeKind,
  message: string,
  overrides: Partial<MfaFailureView> = {},
): MfaFailureView => ({
  kind,
  message,
  clearCode: false,
  retryAfterSeconds: null,
  showRequestId: false,
  ...overrides,
});

const conflictView = (reason: string | null): MfaFailureView => {
  switch (reason) {
    case 'mfa_factor_limit':
      return view('limit', MFA_COPY.limit);
    case 'factor_name_taken':
      return view('name', MFA_COPY.nameTaken);
    case 'enrollment_expired':
    case 'factor_not_pending':
      return view('expired', MFA_COPY.expired);
    case 'last_factor_required':
      return view('last-factor', MFA_COPY.lastFactor);
    default:
      return view('conflict', MFA_COPY.conflict);
  }
};

/** Maps a failed AUTH-API-16 to AUTH-API-19 call to the FE01 copy and routing. */
export const mfaFailureView = (
  failure: MfaFailure,
  context: MfaContext,
): MfaFailureView => {
  const { status, reason } = failure;
  if (status === 401) {
    return failure.code === 'STEP_UP_REQUIRED'
      ? view('step-up', '')
      : view(
          'sign-in',
          context === 'start' ? MFA_COPY.firstFactorSignIn : MFA_COPY.sessionEnded,
        );
  }
  if (status === 409) return conflictView(reason);
  if (status === 404) return view('conflict', MFA_COPY.conflict);
  if (status === 422) {
    if (reason === 'code_incorrect')
      return view('code', ONE_TIME_CODE_COPY.incorrect, { clearCode: true });
    if (reason === 'friendly_name_invalid')
      return view('name', MFA_COPY.nameInvalid);
    return view('code', ONE_TIME_CODE_COPY.invalid);
  }
  if (status === 403) {
    return reason === 'account_not_eligible'
      ? view('gate', STEP_UP_COPY.notEligible)
      : view('reload', STEP_UP_COPY.reload);
  }
  if (status === 429)
    return view('locked', 'Too many attempts. Try again later.', {
      retryAfterSeconds: failure.retryAfterSeconds ?? DEFAULT_LOCK_SECONDS,
    });
  return view('degraded', STEP_UP_COPY.unavailable, { showRequestId: true });
};
