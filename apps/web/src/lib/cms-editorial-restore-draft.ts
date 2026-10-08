import {
  clearStepUpDraft,
  loadStepUpDraft,
  saveStepUpDraft,
  type DraftStorage,
} from '../components/identity-authority/step-up-mfa/step-up-draft';

/**
 * The scoped draft of a restore confirmation (FE03 Unsaved changes :921, Draft
 * handling :1178, :2640 "scoped draft survives recoverable auth and same-record
 * navigation"). The restore form has no typed input; its draft is the INTENT:
 * which revision, which read-derived migration chain, the entry version it was
 * confirmed against and, after an attempt whose outcome is unknown, the
 * idempotency key that makes a retry unable to restore twice. It is kept in the
 * same tab-scoped, session-bound, 600 s store the protected forms use, restored
 * on the same record, never submitted by itself, and cleared only when the
 * restore succeeds or the author cancels. A changed entry version drops the key
 * (the request body differs) and asks for a fresh review.
 */

export const CMS_EDITORIAL_RESTORE_DRAFT_SCOPE = 'cms-editorial-restore';

const FORM = 'form[data-cms-editorial-restore]';
const REVIEW = 'details[data-cms-editorial-restore-review]';
const KEY = 'cmsEditorialRestoreIdempotencyKey';

interface RestoreIntent {
  readonly scope: string;
  readonly migrationChainId: string;
  readonly expectedVersion: string;
}

const field = (form: HTMLFormElement, name: string): string | null => {
  const control = form.elements.namedItem(name);
  return control instanceof HTMLInputElement ? control.value : null;
};

const intentOf = (form: HTMLFormElement): RestoreIntent | null => {
  const entryId = field(form, 'entryId');
  const revisionId = field(form, 'revisionId');
  const migrationChainId = field(form, 'migrationChainId');
  const expectedVersion = field(form, 'expectedVersion');
  return entryId === null ||
    revisionId === null ||
    migrationChainId === null ||
    expectedVersion === null
    ? null
    : {
        scope: `${CMS_EDITORIAL_RESTORE_DRAFT_SCOPE}:${entryId}:${revisionId}`,
        migrationChainId,
        expectedVersion,
      };
};

/** Keeps the confirmation (and the key of an unconfirmed attempt) for a retry. */
export const rememberRestoreDraft = (
  storage: DraftStorage | null,
  form: HTMLFormElement,
): void => {
  const intent = intentOf(form);
  if (intent === null) return;
  saveStepUpDraft(storage, intent.scope, {
    values: { migrationChainId: intent.migrationChainId },
    idempotencyKey: form.dataset[KEY] ?? '',
    expectedVersion: intent.expectedVersion,
  });
};

/** Success or an explicit discard: the draft and the kept key are gone. */
export const forgetRestoreDraft = (
  storage: DraftStorage | null,
  form: HTMLFormElement,
): void => {
  const intent = intentOf(form);
  if (intent !== null) clearStepUpDraft(storage, intent.scope);
  delete form.dataset[KEY];
};

/**
 * On a page load, re-opens the confirmation the author left on THIS record and
 * restores the key of an unconfirmed attempt. It submits nothing: the author
 * reviews and confirms again, and a changed entry version is announced instead.
 */
export const recoverRestoreDrafts = (
  documentRef: Document,
  storage: DraftStorage | null,
  announce: (message: string) => void,
): void => {
  for (const form of Array.from(
    documentRef.querySelectorAll<HTMLFormElement>(FORM),
  )) {
    const intent = intentOf(form);
    if (intent === null) continue;
    const draft = loadStepUpDraft(storage, intent.scope);
    if (draft === null) continue;
    if (draft.values.migrationChainId !== intent.migrationChainId) continue;
    const sameVersion = draft.expectedVersion === intent.expectedVersion;
    if (sameVersion && draft.idempotencyKey !== '')
      form.dataset[KEY] = draft.idempotencyKey;
    const review = form.closest<HTMLDetailsElement>(REVIEW);
    if (review !== null) review.open = true;
    if (sameVersion) {
      // Loading consumed the record; keep it until success or cancel.
      rememberRestoreDraft(storage, form);
      announce(
        'Your restore confirmation was kept. Review it and choose Confirm restore; nothing was submitted.',
      );
    } else {
      clearStepUpDraft(storage, intent.scope);
      announce(
        'The entry changed since you started this restore. Review the comparison again before confirming.',
      );
    }
  }
};
