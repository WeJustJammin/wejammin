import type { CmsEditorialMutationOutcome } from './cms-editorial-runtime';
import { safeCmsEditorialErrorMessage } from './cms-editorial-types';

/**
 * Progressive-enhancement feedback. Status/conflict/autosave messages are
 * non-intrusive polite status text and never rely on colour
 * (.memory/wiki/specs/ia/03-cms-content-modeling.md:246).
 */

export const cmsEditorialOutcomeMessage = (
  outcome: CmsEditorialMutationOutcome,
  errorCode: string | null,
  retryAfterSeconds: number | null,
): string => {
  if (outcome === 'success') return 'Revision saved. Editing continues.';
  if (outcome === 'rate-limited')
    return retryAfterSeconds === null
      ? 'Too many saves. Try again shortly. Your unsent edits are kept.'
      : 'Too many saves. Retry in ' +
          retryAfterSeconds +
          ' seconds. Your unsent edits are kept.';
  if (outcome === 'unknown')
    return 'The save result could not be confirmed. Your unsent edits are kept; check the current version before retrying.';
  return safeCmsEditorialErrorMessage(errorCode ?? 'INTERNAL_ERROR');
};

/** Truthful determinate/unknown/retryable autosave status copy. */
export const cmsEditorialAutosaveStatusMessage = (input: {
  readonly dirty: boolean;
  readonly saving: boolean;
  readonly outcome: CmsEditorialMutationOutcome | null;
  readonly retryable: boolean;
}): string => {
  if (input.saving) return 'Saving changes.';
  if (!input.dirty && input.outcome === 'success') return 'All changes saved.';
  if (input.outcome === 'unknown')
    return 'Save status unknown. Your unsent edits are kept.';
  if (input.dirty)
    return input.outcome === null
      ? 'Unsaved changes. Autosave runs shortly.'
      : 'Unsaved changes. ' +
          (input.retryable
            ? 'Retrying shortly.'
            : 'Review the highlighted fields.');
  return 'No unsaved changes.';
};

export const setCmsEditorialFormBusy = (
  form: HTMLFormElement,
  busy: boolean,
): void => {
  form.setAttribute('aria-busy', String(busy));
  const fieldset = form.querySelector('fieldset');
  if (
    fieldset !== null &&
    !fieldset.hasAttribute('data-cms-editorial-readonly')
  )
    fieldset.disabled = busy;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit !== null) {
    submit.disabled = busy;
    submit.setAttribute('aria-busy', String(busy));
  }
};

/**
 * Publish a message in the workbench live region. Autosave/connection/presence
 * updates are `polite` so typing is never interrupted; only explicit failures
 * escalate to `alert`.
 */
export const announceCmsEditorialStatus = (input: {
  readonly document: Document;
  readonly regionId: string;
  readonly message: string;
  readonly alert?: boolean;
}): HTMLElement => {
  const existing = input.document.getElementById(input.regionId);
  const region =
    existing ??
    (() => {
      const created = input.document.createElement('p');
      created.id = input.regionId;
      created.dataset.cmsEditorialStatus = 'true';
      created.tabIndex = -1;
      input.document.body.appendChild(created);
      return created;
    })();
  region.setAttribute('role', input.alert === true ? 'alert' : 'status');
  region.setAttribute(
    'aria-live',
    input.alert === true ? 'assertive' : 'polite',
  );
  region.setAttribute('aria-atomic', 'true');
  region.textContent = input.message;
  return region;
};

/** Move focus without scrolling the viewport (no motion, no jump). */
export const focusCmsEditorialWithoutScroll = (element: HTMLElement): void => {
  element.focus({ preventScroll: true });
};

interface CmsEditorialViolation {
  readonly path: string;
  readonly message: string;
}

const violationFrom = (detail: unknown): CmsEditorialViolation | null => {
  if (typeof detail === 'string') {
    const path = detail.trim();
    return path === '' ? null : { path, message: 'Check this field.' };
  }
  if (detail === null || typeof detail !== 'object') return null;
  const record = detail as Record<string, unknown>;
  const rawPath = record.path;
  if (typeof rawPath !== 'string') return null;
  const path = rawPath.trim();
  if (path === '') return null;
  const message = record.message;
  return {
    path,
    message: typeof message === 'string' ? message : 'Check this field.',
  };
};

/**
 * Build a focusable validation summary. Each entry is a native link to the
 * stable JSON Pointer target so keyboard users can jump straight to the field.
 */
export const renderCmsEditorialValidationSummary = (input: {
  readonly document: Document;
  readonly form: HTMLFormElement;
  readonly details: readonly string[];
  readonly summaryId: string;
}): HTMLElement | null => {
  input.form
    .querySelectorAll('[data-cms-editorial-validation-summary]')
    .forEach((element) => element.remove());
  const violations = input.details
    .map(violationFrom)
    .filter(
      (violation): violation is CmsEditorialViolation => violation !== null,
    );
  if (violations.length === 0) return null;
  const summary = input.document.createElement('div');
  summary.id = input.summaryId;
  summary.dataset.cmsEditorialValidationSummary = 'true';
  summary.tabIndex = -1;
  summary.setAttribute('role', 'group');
  summary.setAttribute('aria-labelledby', input.summaryId + '-heading');
  const heading = input.document.createElement('h2');
  heading.id = input.summaryId + '-heading';
  heading.textContent = 'Check these fields before saving again';
  summary.appendChild(heading);
  const list = input.document.createElement('ul');
  for (const violation of violations) {
    const item = input.document.createElement('li');
    const link = input.document.createElement('a');
    link.href = '#' + input.summaryId;
    link.textContent = violation.path + ': ' + violation.message;
    const fieldId = violation.path.startsWith('/values/')
      ? violation.path.slice('/values/'.length)
      : null;
    if (fieldId !== null) {
      const field = input.form.querySelector<HTMLElement>(
        '[data-cms-editorial-field="' + CSS.escape(fieldId) + '"]',
      );
      if (field?.id !== undefined && field.id !== '')
        link.href = '#' + field.id;
    }
    item.appendChild(link);
    list.appendChild(item);
  }
  summary.appendChild(list);
  input.form.insertAdjacentElement('afterbegin', summary);
  return summary;
};
