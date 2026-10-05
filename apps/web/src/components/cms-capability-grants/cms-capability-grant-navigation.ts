import {
  STEP_UP_GRANT_ENVELOPE_KEY,
  currentStepUpContext,
  isStampLive,
  stampFor,
  type StepUpStateContext,
} from '../identity-authority/step-up-mfa/step-up-binding';
import { stepUpTargetForReturnTo } from '../step-up-required';

/** Browser navigation seam so the console is testable without real navigation. */
export const navigateTo = (target: string): void => {
  window.location.assign(target);
};

/** Reflect list state in the address bar without adding a person identifier. */
export const recordConsoleUrl = (
  target: string,
  mode: 'push' | 'replace',
): void => {
  try {
    if (mode === 'push') window.history.pushState(null, '', target);
    else window.history.replaceState(null, '', target);
  } catch {
    // History is a convenience; the server stays authoritative for the URL.
  }
};

const STEP_UP_RETURN_KEY = STEP_UP_GRANT_ENVELOPE_KEY;

/**
 * The pending command a step-up detour interrupted (FE03 DEC-111 recovery).
 * The 401 reserved no idempotency record, so the command is retried with its
 * ORIGINAL `Idempotency-Key`. The envelope holds only the command kind, the
 * grant it targeted (renew and revoke) and that key: never the person ID, a
 * reason or any entered value, because the owner console returns an empty form.
 */
export interface PendingGrantCommand {
  readonly kind: 'grant' | 'renew' | 'revoke';
  readonly grantId: string | null;
  readonly idempotencyKey: string;
}

const isPendingGrantCommand = (
  value: unknown,
): value is PendingGrantCommand => {
  if (typeof value !== 'object' || value === null) return false;
  const { kind, grantId, idempotencyKey } = value as Record<string, unknown>;
  return (
    (kind === 'grant' || kind === 'renew' || kind === 'revoke') &&
    (grantId === null || typeof grantId === 'string') &&
    typeof idempotencyKey === 'string' &&
    idempotencyKey.length > 0 &&
    idempotencyKey.length <= 128
  );
};

/**
 * Persist the pending command in tab-scoped storage before leaving for
 * /step-up. The envelope is stamped with the session scope and time so another
 * user in this tab, or the same tab after the 600 s window, never restores it.
 */
export const markStepUpDetour = (
  pending: PendingGrantCommand,
  context: StepUpStateContext = currentStepUpContext(),
): void => {
  try {
    window.sessionStorage.setItem(
      STEP_UP_RETURN_KEY,
      JSON.stringify({ ...pending, ...stampFor(context) }),
    );
  } catch {
    // Without storage the owner sees an empty form and a fresh key on return.
  }
};

export interface ConsumedStepUpDetour {
  readonly found: boolean;
  readonly pending: PendingGrantCommand | null;
}

/**
 * Read and clear the detour once after returning from step-up. An envelope
 * written under another session scope, past the 600 s window or with no stamp
 * is cleared and reported as no detour.
 */
export const consumeStepUpDetour = (
  context: StepUpStateContext = currentStepUpContext(),
): ConsumedStepUpDetour => {
  try {
    const raw = window.sessionStorage.getItem(STEP_UP_RETURN_KEY);
    if (raw === null) return { found: false, pending: null };
    window.sessionStorage.removeItem(STEP_UP_RETURN_KEY);
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // An unreadable envelope still means a detour happened.
    }
    if (!isStampLive(parsed, context)) return { found: false, pending: null };
    return {
      found: true,
      pending: isPendingGrantCommand(parsed)
        ? {
            kind: parsed.kind,
            grantId: parsed.grantId,
            idempotencyKey: parsed.idempotencyKey,
          }
        : null,
    };
  } catch {
    return { found: false, pending: null };
  }
};

/**
 * The key a form submits: the restored original key when the page returned
 * from /step-up for exactly this command (same kind, same target grant), the
 * page's derived key otherwise.
 */
export const keyForCommand = (
  restored: PendingGrantCommand | null,
  kind: PendingGrantCommand['kind'],
  grantId: string | null,
  derived: string,
): string =>
  restored !== null && restored.kind === kind && restored.grantId === grantId
    ? restored.idempotencyKey
    : derived;

/** `/step-up?returnTo=` for the console's relative path plus query. */
export const stepUpHref = stepUpTargetForReturnTo;

export const signInHref = (returnTo: string): string =>
  `/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`;
