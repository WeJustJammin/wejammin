import { stepUpHref } from '../identity-authority/step-up-mfa/step-up-return';
import type { ContentSchemaRegistryMutationOutcome } from './content-schema-registry-runtime';

export const safeOutcomeMessage = (
  outcome: ContentSchemaRegistryMutationOutcome,
  retryAfterSeconds: number | null,
): string => {
  if (outcome === 'success')
    return 'Schema change accepted. Refreshing current data.';
  if (outcome === 'validation') return 'Check the highlighted fields.';
  if (outcome === 'unauthenticated')
    return 'Your session expired. Sign in again.';
  if (outcome === 'step-up-required')
    return 'Recent verification is required. Redirecting to confirm your identity.';
  if (outcome === 'step-up-unavailable')
    return 'No verification method is available.';
  if (outcome === 'step-up-malformed')
    return 'The verification response could not be read. Check the current version before retrying.';
  if (outcome === 'forbidden')
    return 'You do not have permission for this schema change.';
  if (outcome === 'not-found')
    return 'The requested schema record was not found.';
  if (outcome === 'conflict')
    return 'The schema changed elsewhere. Review the current version.';
  if (outcome === 'rate-limited')
    return retryAfterSeconds === null
      ? 'Too many requests. Try again shortly.'
      : `Too many requests. Retry in ${retryAfterSeconds} seconds.`;
  return 'The schema change is still being reconciled. Check the current version before retrying.';
};

const SAVING_LABEL = 'Saving…';

/**
 * Mark a command form busy. While a command is in flight (`saving`) the commit
 * action reads "Saving…" and the locale fields are aria-disabled (FE03
 * "Locale configuration" pending state); a Retry-After wait only disables.
 */
export const setFormBusy = (
  form: HTMLFormElement,
  busy: boolean,
  saving = false,
): void => {
  form.setAttribute('aria-busy', String(busy));
  const fieldset = form.querySelector('fieldset');
  if (fieldset !== null) fieldset.disabled = busy;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit !== null) {
    submit.disabled = busy;
    submit.setAttribute('aria-busy', String(busy));
    if (busy && saving && submit.dataset.cmsIdleLabel === undefined) {
      submit.dataset.cmsIdleLabel = submit.textContent ?? '';
      submit.textContent = SAVING_LABEL;
    } else if (!busy && submit.dataset.cmsIdleLabel !== undefined) {
      submit.textContent = submit.dataset.cmsIdleLabel;
      delete submit.dataset.cmsIdleLabel;
    }
  }
  const locale = form.querySelector<HTMLElement>('[data-locale-fields]');
  if (locale !== null) {
    if (busy && saving) locale.setAttribute('aria-disabled', 'true');
    else if (!busy) locale.removeAttribute('aria-disabled');
  }
};

export const announce = (
  form: HTMLFormElement,
  message: string,
  alert = false,
): HTMLElement => {
  let status = form.querySelector<HTMLElement>('[data-cms-command-status]');
  if (status === null) {
    status = form.ownerDocument.createElement('p');
    status.dataset.cmsCommandStatus = 'true';
    status.tabIndex = -1;
    form.insertAdjacentElement('afterbegin', status);
  }
  status.className = alert
    ? 'content-schema-registry-command-error'
    : 'content-schema-registry-command-status';
  status.setAttribute('role', alert ? 'alert' : 'status');
  status.setAttribute('aria-live', alert ? 'assertive' : 'polite');
  status.setAttribute('aria-atomic', 'true');
  status.textContent = message;
  return status;
};

export const clearDynamicFeedback = (form: HTMLFormElement): void => {
  form
    .querySelectorAll<HTMLElement>(
      '[data-cms-validation-summary], [data-cms-capability-gate], [data-cms-sync-conflict], [data-cms-command-retry]',
    )
    .forEach((element) => element.remove());
  form
    .querySelectorAll<HTMLElement>('[aria-invalid="true"]')
    .forEach((field) => {
      field.removeAttribute('aria-invalid');
    });
};

export const sameOriginLocation = (
  form: HTMLFormElement,
  location: string,
): string | null => {
  try {
    const target = new URL(location, form.ownerDocument.location.href);
    return target.origin === form.ownerDocument.location.origin
      ? `${target.pathname}${target.search}${target.hash}`
      : null;
  } catch {
    return null;
  }
};

export const focusWithoutScroll = (element: HTMLElement): void => {
  element.focus({ preventScroll: true });
};

export const safeReauthentication = (
  form: HTMLFormElement,
  windowObject: Window,
  navigate: (target: string) => void = (target) =>
    windowObject.location.assign(target),
): void => {
  void form;
  const current = windowObject.location;
  const returnTo = `${current.pathname}${current.search}`;
  navigate(`/auth/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
};

/**
 * Route to the DEC-111 step-up page with the current relative page as returnTo:
 * path plus query when it is a usable return target, the path alone above 512
 * characters, and /app when even the path is not usable.
 */
export const safeStepUp = (
  windowObject: Window,
  navigate: (target: string) => void = (target) =>
    windowObject.location.assign(target),
): void => {
  const current = windowObject.location;
  navigate(stepUpHref(current.pathname, current.search));
};
