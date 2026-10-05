import { blurIssue } from './content-schema-registry-blur-rules';

/**
 * Inline blur feedback for the registry command forms (FE03 form contract:
 * "Syntax and safe local constraints on blur ... server remains
 * authoritative"). An invalid value gets `aria-invalid`, a persistent error
 * paragraph linked with `aria-describedby`, and nothing else: the submit stays
 * available and the server's answer always wins. The error clears as soon as
 * the value is acceptable. No error appears before a field's first blur.
 */

const FORM_SELECTOR = '[data-cms-command-form]';
const ERROR_SUFFIX = '-blur-error';

type Control = HTMLInputElement | HTMLTextAreaElement;

const isControl = (target: EventTarget | null): target is Control =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

const describedBy = (control: Control): string[] =>
  (control.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);

const writeDescribedBy = (control: Control, ids: readonly string[]): void => {
  if (ids.length === 0) control.removeAttribute('aria-describedby');
  else control.setAttribute('aria-describedby', ids.join(' '));
};

const clear = (control: Control): void => {
  if (control.dataset.cmsBlurInvalid !== 'true') return;
  const errorId = `${control.id}${ERROR_SUFFIX}`;
  control.ownerDocument.getElementById(errorId)?.remove();
  writeDescribedBy(
    control,
    describedBy(control).filter((id) => id !== errorId),
  );
  control.removeAttribute('aria-invalid');
  delete control.dataset.cmsBlurInvalid;
};

const show = (control: Control, message: string): void => {
  const errorId = `${control.id}${ERROR_SUFFIX}`;
  let error = control.ownerDocument.getElementById(errorId);
  if (error === null) {
    error = control.ownerDocument.createElement('p');
    error.id = errorId;
    error.className = 'content-schema-registry-field-error';
    error.dataset.cmsFieldError = 'true';
    (
      control.closest('.content-schema-registry-field') ?? control.parentElement
    )?.appendChild(error);
  }
  error.textContent = message;
  control.setAttribute('aria-invalid', 'true');
  control.dataset.cmsBlurInvalid = 'true';
  const ids = describedBy(control);
  if (!ids.includes(errorId)) writeDescribedBy(control, [...ids, errorId]);
};

/** Evaluate one control and show or clear its feedback. */
export const checkRegistryField = (target: EventTarget | null): void => {
  if (!isControl(target) || target.id === '' || target.name === '') return;
  const form = target.closest<HTMLFormElement>(FORM_SELECTOR);
  if (form === null) return;
  const message = blurIssue(
    form.dataset.operationId ?? '',
    target.name,
    target.value,
  );
  if (message === null) clear(target);
  else show(target, message);
};

/** Wire blur (first feedback) and input (live clearing) for a document. */
export const installRegistryBlurFeedback = (
  document: Document,
): (() => void) => {
  const onBlur = (event: Event): void => checkRegistryField(event.target);
  const onInput = (event: Event): void => {
    // Typing clears or updates an existing error; it never raises a new one.
    if (
      isControl(event.target) &&
      event.target.dataset.cmsBlurInvalid === 'true'
    )
      checkRegistryField(event.target);
  };
  document.addEventListener('focusout', onBlur, true);
  document.addEventListener('input', onInput, true);
  return () => {
    document.removeEventListener('focusout', onBlur, true);
    document.removeEventListener('input', onInput, true);
  };
};
