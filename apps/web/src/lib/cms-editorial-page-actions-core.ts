import { cmsEditorialAppEntryPath } from '../components/cms-editorial/cms-editorial-app-routes';
import {
  saveCmsEditorialResult,
  type CmsEditorialResultSummary,
} from '../components/cms-editorial/cms-editorial-result-handoff';
import { submitCmsEditorialRestoreForm } from '../components/cms-editorial/cms-editorial-restore-submit';
import {
  forgetRestoreDraft,
  recoverRestoreDrafts,
  rememberRestoreDraft,
} from './cms-editorial-restore-draft';
import {
  clearRestoreFailure,
  restoreFailureOf,
  showRestoreFailure,
} from './cms-editorial-restore-feedback';
import { installCmsEditorialRestoreReview } from './cms-editorial-restore-review';
import { markRouteHeadingForFocus } from './route-heading-focus';

/**
 * Bundled page actions for the CMS editorial surfaces. The routes carry no
 * script tags of their own (entries-route.test.ts), so the behavior is
 * installed here and bundled by Astro with the shared document shell. The
 * create form is a React island that owns its own submit; what remains here is
 * the document-level interception of the create type selector and the CMS-07
 * restore confirmation form.
 */
const announce = (
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

const inFlightForms = new WeakSet<HTMLFormElement>();

/**
 * Locks a form while its command runs: the form is `aria-busy`, a second submit
 * is refused, and every control is made inert EXCEPT the one that was activated
 * and the one holding focus. Disabling a focused control makes the browser drop
 * focus to <body>, so those stay enabled and are marked `aria-busy` instead.
 */
const withFormLock = async (
  form: HTMLFormElement,
  submitter: HTMLElement | null,
  action: () => Promise<void>,
): Promise<void> => {
  if (inFlightForms.has(form)) return;
  inFlightForms.add(form);
  const focused = form.ownerDocument.activeElement;
  const controls = (
    Array.from(
      form.querySelectorAll('button, input, select, textarea'),
    ) as Array<
      | HTMLButtonElement
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
    >
  ).filter((control) => control !== submitter && control !== focused);
  const kept = [submitter, focused].filter(
    (control): control is HTMLElement =>
      control !== null && form.contains(control),
  );
  const disabled = controls.map((control) => control.disabled);
  form.setAttribute('aria-busy', 'true');
  for (const control of kept) control.setAttribute('aria-busy', 'true');
  for (const control of controls) control.disabled = true;
  try {
    await action();
  } finally {
    controls.forEach((control, index) => {
      control.disabled = disabled[index] ?? false;
    });
    for (const control of kept) control.removeAttribute('aria-busy');
    form.setAttribute('aria-busy', 'false');
    inFlightForms.delete(form);
  }
};

/**
 * The canonical result of a verified restore: the new draft's revision and entry
 * version, its parents (`[current draft, source]`, CMS-03B-04) and the migration
 * chain the confirmation named. Identifiers and counts only.
 */
const restoreResultSummary = (
  form: HTMLFormElement,
  resource: {
    readonly entryId: string;
    readonly revisionNumber: string;
    readonly entryVersion: string;
    readonly state: string;
    readonly parentRevisionIds: readonly string[];
  },
): CmsEditorialResultSummary => {
  const field = (name: string): string | null => {
    const control = form.elements.namedItem(name);
    return control instanceof HTMLInputElement ? control.value : null;
  };
  const edges = Number(field('edgeCount'));
  return {
    kind: 'restored',
    entryId: resource.entryId,
    revisionNumber: resource.revisionNumber,
    entryVersion: resource.entryVersion,
    state: resource.state,
    parentRevisionIds: [...resource.parentRevisionIds],
    migrationChainId: field('migrationChainId'),
    edgeCount: Number.isInteger(edges) ? edges : null,
  };
};

const focusStorage = (documentRef: Document): Storage | null => {
  try {
    return documentRef.defaultView?.sessionStorage ?? null;
  } catch {
    return null;
  }
};

export interface CmsEditorialPageActionsOptions {
  /** Browser navigation seam; defaults to `location.assign` on the page. */
  readonly navigate?: (path: string) => void;
  /** Removes the interceptor when aborted (tests and hot reload). */
  readonly signal?: AbortSignal;
}

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
        void withFormLock(target, event.submitter, async () => {
          const result = await submitCmsEditorialRestoreForm({
            form: target,
            documentRef: documentRef,
          });
          if (result.status === 'created') {
            forgetRestoreDraft(focusStorage(documentRef), target);
            const destination = cmsEditorialAppEntryPath(
              result.resource.entryId,
            );
            if (destination !== null) {
              saveCmsEditorialResult(
                focusStorage(documentRef),
                restoreResultSummary(target, result.resource),
              );
              markRouteHeadingForFocus(focusStorage(documentRef));
              announce(
                documentRef,
                'data-cms-editorial-restore-status',
                'The restore was accepted. Loading the restored draft…',
              );
              navigate(destination);
              return;
            }
            announce(
              documentRef,
              'data-cms-editorial-restore-status',
              'The restore was accepted, but its page could not be opened. Open the entry from the entry list.',
            );
            return;
          }
          // AC-058 / FE03 :2599-:2604: the typed failure is a summary inside the
          // confirmation, and focus goes to it. The polite status announcement is
          // kept for the surfaces that read it.
          const failure = restoreFailureOf(result);
          showRestoreFailure(target, documentRef, failure);
          announce(
            documentRef,
            'data-cms-editorial-restore-status',
            `${failure.message} ${failure.recovery}`,
          );
          if (failure.interrupted)
            rememberRestoreDraft(focusStorage(documentRef), target);
          else forgetRestoreDraft(focusStorage(documentRef), target);
        });
      }
    },
    options.signal === undefined ? undefined : { signal: options.signal },
  );
  installCmsEditorialRestoreReview(documentRef, options.signal);
  recoverRestoreDrafts(documentRef, focusStorage(documentRef), (message) =>
    announce(documentRef, 'data-cms-editorial-restore-status', message),
  );
};
