import { retryable } from './retryable-import';
/**
 * The small DOM helpers the CMS editorial page actions share: the polite status
 * line they append to the document, and the session storage of the page. They
 * live apart so the core (loaded with every CMS page) and the restore submit
 * module (loaded on the first restore, AC-106) use one copy.
 */

export const announce = (
  documentRef: Document,
  attribute: string,
  message: string,
): void => {
  const selector = `p[${attribute}]`;
  const existing: HTMLParagraphElement | null =
    documentRef.querySelector(selector);
  if (existing !== null) {
    existing.textContent = message;
    return;
  }
  const created = documentRef.createElement('p') as HTMLParagraphElement;
  created.setAttribute('role', 'status');
  created.setAttribute(attribute, '');
  documentRef.body.appendChild(created);
  created.textContent = message;
};

export const focusStorage = (documentRef: Document): Storage | null => {
  try {
    return documentRef.defaultView?.sessionStorage ?? null;
  } catch {
    return null;
  }
};

/** The seam a test replaces: the dynamic import of the restore command (AC-106). */
export const restoreActionImporters = {
  load: retryable(() => import('./cms-editorial-page-actions-restore')),
};

/** The seam a test replaces: the dynamic import of the restore draft store (AC-106). */
export const restoreDraftImporters = {
  load: retryable(() => import('./cms-editorial-restore-draft')),
};

export const RESTORE_DRAFT_RECOVERY_UNAVAILABLE =
  'Part of this page could not be loaded, so a kept restore confirmation may not have been recovered. Reload the page.';

export const RESTORE_DRAFT_FORGET_UNAVAILABLE =
  'Part of this page could not be loaded, so the restore confirmation you closed may still be kept. Reload the page.';
