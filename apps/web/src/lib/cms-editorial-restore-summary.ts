/**
 * Removal of the restore confirmation's failure summary. It is the one piece of
 * the typed-failure surface (`cms-editorial-restore-feedback.ts`, whose fixed
 * copy only the lazy restore command needs) that the eager page actions use: the
 * review clears a summary when it closes and a new attempt clears the last one
 * before it starts (AC-106).
 */

/** The summary element the failure surface renders inside the confirmation. */
export const RESTORE_SUMMARY_SELECTOR = '[data-cms-editorial-restore-error]';

export const clearRestoreFailure = (form: HTMLFormElement): void => {
  for (const existing of Array.from(
    form.querySelectorAll(RESTORE_SUMMARY_SELECTOR),
  ))
    existing.remove();
};
