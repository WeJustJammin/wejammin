import { cmsEditorialAppEntryPath } from '../components/cms-editorial/cms-editorial-app-routes';
import {
  saveCmsEditorialResult,
  type CmsEditorialResultSummary,
} from '../components/cms-editorial/cms-editorial-result-handoff';
import { submitCmsEditorialRestoreForm } from '../components/cms-editorial/cms-editorial-restore-submit';
import { announce, focusStorage } from './cms-editorial-page-actions-dom';
import {
  forgetRestoreDraft,
  rememberRestoreDraft,
} from './cms-editorial-restore-draft';
import {
  restoreFailureOf,
  showRestoreFailure,
} from './cms-editorial-restore-feedback';
import { markRouteHeadingForFocus } from './route-heading-focus';

/**
 * The CMS-03B-04 restore command of the document-level page actions. It is a
 * separate module because it brings the command's contract schemas (through the
 * restore submit module) and only the revision history page carries a restore
 * form, while the document shell loads its page actions on every CMS route:
 * `cms-editorial-page-actions-core.ts` imports this file dynamically, on the
 * first restore submit and when the restore review opens (AC-106). The review
 * behavior itself (focus, Escape, Cancel, a kept draft) is eager in the core.
 */
const RESTORE_STATUS = 'data-cms-editorial-restore-status';

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

/**
 * One submit of the restore confirmation: locks the form, sends the JSON
 * command and either opens the restored draft or shows the typed failure.
 */
export const submitCmsEditorialRestore = (
  target: HTMLFormElement,
  submitter: HTMLElement | null,
  documentRef: Document,
  navigate: (path: string) => void,
): Promise<void> =>
  withFormLock(target, submitter, async () => {
    const result = await submitCmsEditorialRestoreForm({
      form: target,
      documentRef: documentRef,
    });
    if (result.status === 'created') {
      forgetRestoreDraft(focusStorage(documentRef), target);
      const destination = cmsEditorialAppEntryPath(result.resource.entryId);
      if (destination !== null) {
        saveCmsEditorialResult(
          focusStorage(documentRef),
          restoreResultSummary(target, result.resource),
        );
        markRouteHeadingForFocus(focusStorage(documentRef));
        announce(
          documentRef,
          RESTORE_STATUS,
          'The restore was accepted. Loading the restored draft…',
        );
        navigate(destination);
        return;
      }
      announce(
        documentRef,
        RESTORE_STATUS,
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
      RESTORE_STATUS,
      `${failure.message} ${failure.recovery}`,
    );
    if (failure.interrupted)
      rememberRestoreDraft(focusStorage(documentRef), target);
    else forgetRestoreDraft(focusStorage(documentRef), target);
  });
