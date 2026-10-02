import type { ApiError } from '@wejammin/contracts';

import type { AuthenticationError } from './types';

/**
 * Database refusals for the DEC-111 MFA and step-up RPCs. `match` is the
 * upper-case exception message raised by the identity RPCs; `reasonCode` is
 * the lower-case BE01a reason surfaced in the 409/422 details.
 */
export type RpcFailure = Readonly<{
  match: string;
  status: AuthenticationError['status'];
  code: string;
  message: string;
  details?: ApiError['details'];
}>;

type Recovery =
  'enroll_factor' | 'new_challenge' | 'refetch' | 'restart_enrollment';

const conflict = (
  match: string,
  reasonCode: string,
  recoveryAction: Recovery,
  message: string,
): RpcFailure => ({
  match,
  status: 409,
  code: 'CONFLICT',
  message,
  details: { conflict: 'INVALID_TRANSITION', reasonCode, recoveryAction },
});

export const mfaRpcFailures: readonly RpcFailure[] = [
  conflict(
    'MFA_FACTOR_LIMIT',
    'mfa_factor_limit',
    'refetch',
    'The account already has the maximum number of authenticator factors.',
  ),
  conflict(
    'FACTOR_NAME_TAKEN',
    'factor_name_taken',
    'refetch',
    'An authenticator with that name already exists.',
  ),
  conflict(
    'FACTOR_NOT_PENDING',
    'factor_not_pending',
    'restart_enrollment',
    'The authenticator is not awaiting verification.',
  ),
  conflict(
    'ENROLLMENT_EXPIRED',
    'enrollment_expired',
    'restart_enrollment',
    'The authenticator enrollment expired; start again.',
  ),
  conflict(
    'FACTOR_NOT_VERIFIED',
    'factor_not_verified',
    'refetch',
    'The authenticator is not verified.',
  ),
  conflict(
    'FACTOR_STATE_CONFLICT',
    'factor_state_conflict',
    'refetch',
    'The authenticator is changing; reload and try again.',
  ),
  conflict(
    'NO_VERIFIED_FACTOR',
    'no_verified_factor',
    'enroll_factor',
    'Add an authenticator before verifying.',
  ),
  conflict(
    'LAST_FACTOR_REQUIRED',
    'last_factor_required',
    'enroll_factor',
    'Add a replacement authenticator before removing the last one.',
  ),
  conflict(
    'CHALLENGE_EXPIRED',
    'challenge_expired',
    'new_challenge',
    'The verification challenge expired; start a new one.',
  ),
  conflict(
    'CHALLENGE_CONSUMED',
    'challenge_consumed',
    'new_challenge',
    'The verification challenge is no longer usable; start a new one.',
  ),
  {
    match: 'FACTOR_ID_REQUIRED',
    status: 422,
    code: 'VALIDATION_FAILED',
    message: 'Check the highlighted fields.',
    details: {
      violations: [
        {
          path: '/factorId',
          code: 'factor_id_required',
          message: 'The value is invalid.',
        },
      ],
    },
  },
];

/** The 15-minute verification lock of BE01a (ten failures, AUTH-API-18 and -21). */
const VERIFICATION_LOCK_SECONDS = 900;
const VERIFICATION_LOCK_PATTERN =
  /MFA_VERIFICATION_LOCKED:([0-9]{1,3})(?![0-9])/u;

/**
 * `MFA_VERIFICATION_LOCKED:<seconds>` is raised by the verify-prepare
 * transactions while the account lock is held. It becomes the standard 429
 * with the remaining lock as the retry delay; a suffix outside 1..900 is never
 * trusted as a delay (it falls through to the dependency failure).
 */
export const verificationLockFailure = (
  message: string,
): AuthenticationError | null => {
  const seconds = Number(VERIFICATION_LOCK_PATTERN.exec(message)?.[1]);
  if (
    !Number.isSafeInteger(seconds) ||
    seconds < 1 ||
    seconds > VERIFICATION_LOCK_SECONDS
  )
    return null;
  return {
    ok: false,
    status: 429,
    code: 'RATE_LIMITED',
    message: 'Too many verification attempts.',
    details: { retryAfterSeconds: seconds },
    retryAfterSeconds: seconds,
  };
};
