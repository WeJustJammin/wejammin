import { ONE_TIME_CODE_COPY } from './one-time-code';
import type { MfaFailure } from './mfa-failure';
import type { StepUpPhase } from './step-up-phase';

/** Default provider lockout when the server does not state a delay (BE01a). */
export const DEFAULT_LOCK_SECONDS = 900;

export const STEP_UP_COPY = {
  expired: 'This code request is no longer valid.',
  newRequest: 'Get a new code request',
  unavailable: 'Verification is temporarily unavailable.',
  notEligible: 'Two-step verification is not available for this account.',
  reload: 'Your session changed. Reload to continue.',
  locked: 'Too many attempts. Try again later.',
} as const;

export type StepUpFailureView = Readonly<{
  phase: StepUpPhase;
  message: string | null;
  fieldError: string | null;
  clearCode: boolean;
  retryAfterSeconds: number | null;
  signIn: boolean;
  needsReload: boolean;
  showRequestId: boolean;
  retryLabel: 'Get a new code request' | 'Retry' | null;
}>;

const view = (
  phase: StepUpPhase,
  overrides: Partial<StepUpFailureView> = {},
): StepUpFailureView => ({
  phase,
  message: null,
  fieldError: null,
  clearCode: false,
  retryAfterSeconds: null,
  signIn: false,
  needsReload: false,
  showRequestId: false,
  retryLabel: null,
  ...overrides,
});

const expired = (): StepUpFailureView =>
  view('challenge-expired', {
    message: STEP_UP_COPY.expired,
    retryLabel: STEP_UP_COPY.newRequest,
  });

const degraded = (): StepUpFailureView =>
  view('degraded', {
    message: STEP_UP_COPY.unavailable,
    showRequestId: true,
    retryLabel: 'Retry',
  });

/**
 * Maps a failed AUTH-API-20 or AUTH-API-21 call to presentation state, using
 * the exact FE01 copy. Server wording and codes never reach the person.
 */
export const stepUpFailureView = (
  failure: MfaFailure,
  _during: 'challenge' | 'verify',
): StepUpFailureView => {
  const { status, reason } = failure;
  if (status === 401) return view('signed-out', { signIn: true });
  if (status === 422 && reason === 'code_incorrect')
    return view('awaiting-code', {
      fieldError: ONE_TIME_CODE_COPY.incorrect,
      clearCode: true,
    });
  if (status === 422)
    return view('awaiting-code', { fieldError: ONE_TIME_CODE_COPY.invalid });
  if (status === 404) return expired();
  if (status === 409) {
    if (reason === 'no_verified_factor') return view('no-factor');
    if (reason === 'challenge_expired' || reason === 'challenge_consumed')
      return expired();
    return degraded();
  }
  if (status === 403) {
    return reason === 'account_not_eligible'
      ? view('degraded', { message: STEP_UP_COPY.notEligible })
      : view('degraded', { message: STEP_UP_COPY.reload, needsReload: true });
  }
  if (status === 429)
    return view('locked', {
      message: STEP_UP_COPY.locked,
      retryAfterSeconds: failure.retryAfterSeconds ?? DEFAULT_LOCK_SECONDS,
    });
  return degraded();
};
