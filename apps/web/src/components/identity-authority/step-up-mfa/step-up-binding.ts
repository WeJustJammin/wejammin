/**
 * Binding and expiry for everything a step-up detour persists in tab storage
 * (the protected-form drafts, the capability-grant pending-command envelope and
 * the admin reset "not saved" marker).
 *
 * A record is stamped with the opaque session scope the browser held when it
 * was written and the time it was written. It restores only for the same scope
 * inside the DEC-111 600 s freshness window; anything else is cleared, so a
 * later user in the same tab (after logout, a session switch or a context
 * switch) can never read, or replay the idempotency key of, the previous
 * person's interrupted command.
 *
 * The scope is the `wj_step_up_scope` cookie the web edge derives from the
 * session cookie it already receives (`server/step-up-scope.ts`). It is stable
 * across the step-up session rotation (it follows the signed-in subject, not
 * the session id) and carries no identifier a page, island prop or URL ever
 * sees.
 */

/** DEC-111 step-up freshness window, in milliseconds. */
export const STEP_UP_STATE_TTL_MS = 600_000;

export const STEP_UP_SCOPE_COOKIE = 'wj_step_up_scope';

/** Storage keys and prefixes that hold step-up detour state in a tab. */
export const STEP_UP_DRAFT_KEY_PREFIX = 'wj-step-up-draft:';
export const STEP_UP_GRANT_ENVELOPE_KEY = 'wj:cms-grants:step-up-return';
export const STEP_UP_ADMIN_RESET_MARKER_KEY = 'wj-admin-mfa-reset-interrupted';

export type StepUpStateContext = Readonly<{
  /** The signed-in scope now, or null when the tab holds no session scope. */
  binding: string | null;
  /** Epoch milliseconds now. */
  now: number;
}>;

export type StepUpStamp = Readonly<{
  binding: string | null;
  createdAt: number;
}>;

type ClearableStorage = Pick<Storage, 'key' | 'length' | 'removeItem'>;

export const readStepUpScope = (cookieJar: string | null): string | null => {
  if (cookieJar === null) return null;
  for (const part of cookieJar.split(';')) {
    const item = part.trim();
    if (!item.startsWith(`${STEP_UP_SCOPE_COOKIE}=`)) continue;
    const value = item.slice(STEP_UP_SCOPE_COOKIE.length + 1);
    return /^[A-Za-z0-9_-]{16,128}$/u.test(value) ? value : null;
  }
  return null;
};

const readCookieJar = (): string | null => {
  try {
    return typeof document === 'undefined' ? null : document.cookie;
  } catch {
    return null;
  }
};

export const currentStepUpContext = (): StepUpStateContext => ({
  binding: readStepUpScope(readCookieJar()),
  now: Date.now(),
});

export const stampFor = (context: StepUpStateContext): StepUpStamp => ({
  binding: context.binding,
  createdAt: context.now,
});

/** True only for the same scope, written no later than now and within the window. */
export const isStampLive = (
  stamp: unknown,
  context: StepUpStateContext,
): stamp is StepUpStamp => {
  if (typeof stamp !== 'object' || stamp === null) return false;
  const { binding, createdAt } = stamp as Record<string, unknown>;
  if (
    (binding !== null && typeof binding !== 'string') ||
    typeof createdAt !== 'number' ||
    !Number.isFinite(createdAt)
  )
    return false;
  const age = context.now - createdAt;
  return binding === context.binding && age >= 0 && age <= STEP_UP_STATE_TTL_MS;
};

/**
 * Removes every step-up draft and envelope this tab holds. Called when the
 * acting context changes and when the tab reaches sign-in (logout, expiry).
 */
export const clearAllStepUpState = (storage: ClearableStorage | null): void => {
  if (storage === null) return;
  try {
    const doomed: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (
        key !== null &&
        (key.startsWith(STEP_UP_DRAFT_KEY_PREFIX) ||
          key === STEP_UP_GRANT_ENVELOPE_KEY ||
          key === STEP_UP_ADMIN_RESET_MARKER_KEY)
      )
        doomed.push(key);
    }
    for (const key of doomed) storage.removeItem(key);
  } catch {
    // Blocked storage holds no state this tab could restore.
  }
};
