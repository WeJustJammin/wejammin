import { stepUpHref as sharedStepUpHref } from '../identity-authority/step-up-mfa/step-up-return';

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

const STEP_UP_RETURN_KEY = 'wj:cms-grants:step-up-return';

/** Remember only that a step-up detour happened; never any entered value. */
export const markStepUpDetour = (): void => {
  try {
    window.sessionStorage.setItem(STEP_UP_RETURN_KEY, '1');
  } catch {
    // Without storage the owner simply sees an empty form on return.
  }
};

/** True once after returning from a step-up detour. */
export const consumeStepUpDetour = (): boolean => {
  try {
    const found = window.sessionStorage.getItem(STEP_UP_RETURN_KEY) === '1';
    if (found) window.sessionStorage.removeItem(STEP_UP_RETURN_KEY);
    return found;
  } catch {
    return false;
  }
};

/** `/step-up?returnTo=` for the console's relative path plus query. */
export const stepUpHref = (returnTo: string): string => {
  const at = returnTo.indexOf('?');
  return sharedStepUpHref(
    at === -1 ? returnTo : returnTo.slice(0, at),
    at === -1 ? '' : returnTo.slice(at),
  );
};

export const signInHref = (returnTo: string): string =>
  `/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`;
