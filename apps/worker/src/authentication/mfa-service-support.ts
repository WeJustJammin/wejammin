import {
  MfaFactorsResourceSchema,
  type MfaFactorsResource,
} from '@wejammin/contracts';

import { authError } from './boundary';
import type { MfaRegistrySnapshot } from './mfa-types';
import type {
  AuthenticationError,
  AuthenticationResult,
  AuthenticationSession,
} from './result-types';
import { freshUntilFor, isFreshProof, MFA_METHOD_REGISTRY } from './step-up';

/** Accounts that may manage factors and step up (BE01a "self only" rows). */
const ELIGIBLE_ACCOUNT_STATES: readonly (string | null)[] = [
  'active',
  'claimed',
];

export const requireEligibleAccount = (
  session: AuthenticationSession,
): AuthenticationError | null =>
  ELIGIBLE_ACCOUNT_STATES.includes(session.accountState)
    ? null
    : authError(
        403,
        'FORBIDDEN',
        'The account is not eligible for this action.',
        { reasonCode: 'account_not_eligible' },
      );

/** `If-Match` arrives as a strong quoted decimal; the database takes the bare number. */
export const bareVersion = (ifMatch: string): string =>
  ifMatch.startsWith('"') ? ifMatch.slice(1, -1) : ifMatch;

export const notFoundError = (): AuthenticationError =>
  authError(404, 'NOT_FOUND', 'The requested resource was not found.', {});

export const transitionConflict = (
  reasonCode: string,
  recoveryAction: 'enroll_factor' | 'new_challenge' | 'refetch',
  message: string,
): AuthenticationError =>
  authError(409, 'CONFLICT', message, {
    conflict: 'INVALID_TRANSITION',
    reasonCode,
    recoveryAction,
  });

export const invalidProviderOrPersistence = (): AuthenticationError =>
  authError(
    502,
    'DEPENDENCY_INVALID_RESPONSE',
    'Authentication persistence returned an invalid response.',
  );

export const finalizationFailed = (): AuthenticationError =>
  authError(500, 'INTERNAL_ERROR', 'The request could not be completed.', {});

/** Proof state is computed from the verified session proof only. */
const stepUpProjection = (
  stepUpAt: string | null,
  nowMs: number,
): MfaFactorsResource['stepUp'] =>
  stepUpAt !== null && isFreshProof(stepUpAt, nowMs)
    ? { fresh: true, freshUntil: freshUntilFor(stepUpAt) }
    : { fresh: false, freshUntil: null };

export const buildFactorsResource = (
  snapshot: MfaRegistrySnapshot,
  stepUpAt: string | null,
  nowMs: number,
): AuthenticationResult<MfaFactorsResource> => {
  const parsed = MfaFactorsResourceSchema.safeParse({
    factors: snapshot.factors,
    allowedMethods: [...MFA_METHOD_REGISTRY],
    stepUp: stepUpProjection(stepUpAt, nowMs),
    version: snapshot.version,
  });
  return parsed.success
    ? { ok: true, value: parsed.data }
    : invalidProviderOrPersistence();
};

/** 502 and 504 leave the provider outcome unknown; other failures did not apply. */
export const isAmbiguousProviderOutcome = (
  error: AuthenticationError,
): boolean => error.status === 502 || error.status === 504;
