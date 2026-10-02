import {
  clearStepUpDraft,
  loadStepUpDraft,
  saveStepUpDraft,
  type DraftStorage,
  type StepUpDraft,
} from '../identity-authority/step-up-mfa/step-up-draft';

/**
 * FE00 error-per-class: on 401 `STEP_UP_REQUIRED` the interrupted protected
 * form persists its tab-scoped draft, and after step-up it is restored for an
 * explicit re-confirmation (never auto-submitted). Only editable, non-secret,
 * non-identifying fields are kept: hidden transport fields, one-time codes,
 * acknowledgements and the reviewer person ID are never written.
 */

/** Names that must never be written to the draft (privacy, FE03 reviewer rule). */
const NEVER_PERSISTED: ReadonlySet<string> = new Set([
  'reviewerPersonId',
  'subjectPersonId',
  'targetPersonId',
]);

const TRANSPORT = new Set([
  'idempotency-key',
  'if-match',
  'csrf',
  'operationId',
]);

export const stepUpDraftScope = (
  pathname: string,
  operationId: string,
): string => `cms:${pathname}:${operationId}`;

const storageOf = (windowObject: Window): DraftStorage | null => {
  try {
    return windowObject.sessionStorage;
  } catch {
    return null;
  }
};

const fieldValue = (form: HTMLFormElement, name: string): string | null => {
  const element = form.elements.namedItem(name);
  return element instanceof HTMLInputElement ? element.value : null;
};

const versionOf = (form: HTMLFormElement): string | null => {
  const explicit = fieldValue(form, 'expectedVersion');
  if (explicit !== null && explicit.length > 0) return explicit;
  const ifMatch = fieldValue(form, 'if-match');
  return ifMatch === null ? null : ifMatch.replace(/^"|"$/gu, '') || null;
};

type FieldElement = HTMLInputElement | HTMLTextAreaElement;

const fieldsOf = (form: HTMLFormElement): readonly FieldElement[] => {
  const fields: FieldElement[] = [];
  for (const element of Array.from(form.elements))
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    )
      fields.push(element);
  return fields;
};

/** Editable user fields only: text-like inputs, textareas and radios. */
const editableValues = (form: HTMLFormElement): Record<string, string> => {
  const values: Record<string, string> = {};
  for (const element of fieldsOf(form)) {
    const name = element.name;
    if (name === '' || NEVER_PERSISTED.has(name) || TRANSPORT.has(name))
      continue;
    if (name === 'expectedVersion') continue;
    if (element instanceof HTMLInputElement) {
      if (['hidden', 'file', 'password', 'checkbox'].includes(element.type))
        continue;
      if (element.type === 'radio' && !element.checked) continue;
    }
    if (element.value !== '') values[name] = element.value;
  }
  return values;
};

export const persistStepUpDraft = (
  form: HTMLFormElement,
  windowObject: Window,
): boolean => {
  const idempotencyKey = fieldValue(form, 'idempotency-key');
  if (idempotencyKey === null || idempotencyKey.length === 0) return false;
  const operationId = form.dataset.operationId ?? 'unknown';
  return saveStepUpDraft(
    storageOf(windowObject),
    stepUpDraftScope(windowObject.location.pathname, operationId),
    {
      values: editableValues(form),
      idempotencyKey,
      expectedVersion: versionOf(form),
    },
  );
};

const setNative = (element: FieldElement, value: string): void => {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
};

export interface RestoredStepUpDraft {
  readonly form: HTMLFormElement;
  /** The version the interrupted form was submitted at, if it knew one. */
  readonly draftVersion: string | null;
  /** The version the freshly rendered form carries. */
  readonly currentVersion: string | null;
}

/**
 * Restore a consumed draft into the freshly rendered form: the editable values
 * come back, the original Idempotency-Key is reused, and the version the form
 * now carries is reported so the caller can open a conflict when it changed.
 */
export const restoreStepUpDraft = (
  form: HTMLFormElement,
  windowObject: Window,
): RestoredStepUpDraft | null => {
  const operationId = form.dataset.operationId ?? 'unknown';
  const scope = stepUpDraftScope(windowObject.location.pathname, operationId);
  const storage = storageOf(windowObject);
  const draft: StepUpDraft | null = loadStepUpDraft(storage, scope);
  if (draft === null) return null;
  clearStepUpDraft(storage, scope);
  for (const element of fieldsOf(form)) {
    const value = draft.values[element.name];
    if (value === undefined) continue;
    if (element instanceof HTMLInputElement && element.type === 'radio') {
      if (element.value === value) {
        element.checked = true;
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
      continue;
    }
    setNative(element, value);
  }
  const key = form.elements.namedItem('idempotency-key');
  if (key instanceof HTMLInputElement) {
    // Pinned so a later island re-render cannot put a fresh key back (the
    // transport fields re-apply `data-pinned-key` after every commit).
    key.dataset.pinnedKey = draft.idempotencyKey;
    key.value = draft.idempotencyKey;
  }
  return {
    form,
    draftVersion: draft.expectedVersion,
    currentVersion: versionOf(form),
  };
};
