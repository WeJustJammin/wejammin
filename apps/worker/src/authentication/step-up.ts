import { authError } from './boundary';
import type { AuthenticationError } from './types';

/**
 * DEC-111 contract constants (BE01a "Step-Up Proof and MFA Method Registry").
 * They are code-owned: never caller-selectable and never a settings value.
 */
export const STEP_UP_FRESHNESS_SECONDS = 600;
export const STEP_UP_FORWARD_TOLERANCE_SECONDS = 30;

/** Enabled MFA method ids. `allowedMethods` in every 401 echoes this list. */
export const MFA_METHOD_REGISTRY: readonly ['totp'] = Object.freeze([
  'totp',
] as const);

/**
 * A proof is fresh when `-30 s <= now - proofAt <= 600 s`, so a just-minted
 * proof is never refused for clock skew and a future-dated one beyond the
 * verifier's bound is never accepted.
 */
export const isFreshProof = (
  proofAt: string | null,
  nowMs: number,
): boolean => {
  if (proofAt === null) return false;
  const proofMs = Date.parse(proofAt);
  if (!Number.isFinite(proofMs)) return false;
  const ageMs = nowMs - proofMs;
  return (
    ageMs >= -STEP_UP_FORWARD_TOLERANCE_SECONDS * 1000 &&
    ageMs <= STEP_UP_FRESHNESS_SECONDS * 1000
  );
};

export const freshUntilFor = (proofAt: string): string =>
  new Date(
    Date.parse(proofAt) + STEP_UP_FRESHNESS_SECONDS * 1000,
  ).toISOString();

/** 401 `STEP_UP_REQUIRED` is the only shape for a step-up shortfall. */
export const stepUpRequiredError = (): AuthenticationError =>
  authError(401, 'STEP_UP_REQUIRED', 'Recent verification is required.', {
    recoveryAction: 'step_up',
    allowedMethods: [...MFA_METHOD_REGISTRY],
  });

export const reauthenticateError = (): AuthenticationError =>
  authError(401, 'UNAUTHENTICATED', 'Sign in again to continue.', {
    recoveryAction: 'reauthenticate',
  });
