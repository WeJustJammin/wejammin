import { announce, focusStorage } from './cms-editorial-page-actions-dom';
import { recoverRestoreDrafts } from './cms-editorial-restore-draft';
import { clearRestoreFailure } from './cms-editorial-restore-summary';
import { installCmsEditorialRestoreReview } from './cms-editorial-restore-review';

/**
 * Bundled page actions for the CMS editorial surfaces. The routes carry no
 * script tags of their own (entries-route.test.ts), so the behavior is
 * installed here and bundled by Astro with the shared document shell. The
 * create form is a React island that owns its own submit; what remains here is
 * the document-level interception of the create type selector and the CMS-07
 * restore confirmation form.
 *
 * The shell loads this file on every CMS route (AC-106), so the restore command
 * itself, which carries the contract schemas of its request and answer, lives in
 * `cms-editorial-page-actions-restore.ts` and is imported dynamically: on the
 * first restore submit, and as soon as the restore review opens so that the
 * confirmation is usually ready. The review's focus, Escape and Cancel handling
 * and the recovery of a kept confirmation stay here, installed at once, because
 * they must work before any chunk has arrived.
 */
export interface CmsEditorialPageActionsOptions {
  /** Browser navigation seam; defaults to `location.assign` on the page. */
  readonly navigate?: (path: string) => void;
  /** Removes the interceptor when aborted (tests and hot reload). */
  readonly signal?: AbortSignal;
}

const loadRestoreActions = () => import('./cms-editorial-page-actions-restore');

export const installCmsEditorialPageActions = (
  documentRef: Document,
  options: CmsEditorialPageActionsOptions = {},
): void => {
  const navigate =
    options.navigate ??
    ((path: string): void => documentRef.defaultView?.location.assign(path));
  documentRef.addEventListener(
    'submit',
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLFormElement)) return;

      // The create type selector never navigates to the JSON endpoint: choosing
      // a type re-renders the page with the selected compiled version, and the
      // SSR page loads the projected fields through the server proxy.
      if (target.hasAttribute('data-cms-editorial-create-type-selector')) {
        event.preventDefault();
        const select = target.querySelector(
          'select[name="contentTypeVersionId"]',
        ) as HTMLSelectElement | null;
        const versionId = select?.value ?? '';
        const url = new URL(documentRef.defaultView?.location.href ?? '/');
        if (versionId === '') url.searchParams.delete('contentTypeVersionId');
        else url.searchParams.set('contentTypeVersionId', versionId);
        navigate(url.pathname + url.search);
        return;
      }

      if (target.hasAttribute('data-cms-editorial-restore')) {
        event.preventDefault();
        clearRestoreFailure(target);
        const submitter = event.submitter;
        void loadRestoreActions().then((restore) =>
          restore.submitCmsEditorialRestore(
            target,
            submitter,
            documentRef,
            navigate,
          ),
        );
      }
    },
    options.signal === undefined ? undefined : { signal: options.signal },
  );
  // Opening the restore review is the sign of intent: fetch the restore command
  // now (its failure is reported by the submit that really needs it).
  // `toggle` does not bubble, so it is observed in the capture phase.
  documentRef.addEventListener(
    'toggle',
    (event) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.hasAttribute('data-cms-editorial-restore-review') &&
        (target as HTMLDetailsElement).open
      )
        loadRestoreActions().catch(() => undefined);
    },
    {
      capture: true,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    },
  );
  installCmsEditorialRestoreReview(documentRef, options.signal);
  recoverRestoreDrafts(documentRef, focusStorage(documentRef), (message) =>
    announce(documentRef, 'data-cms-editorial-restore-status', message),
  );
};
