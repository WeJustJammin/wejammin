import type { CmsEditorialRestoreSubmitResult } from '../components/cms-editorial/cms-editorial-restore-response';

/**
 * The typed-failure surface of the restore confirmation (FE03 error behavior,
 * :2599 "Focus linked summary then field", :2600 "Focus auth heading", :2602
 * "Focus gate", :2604 "Focus conflict; announce no overwrite"; AC-058). A
 * refused restore renders an error summary INSIDE the confirmation and moves
 * focus to its heading, so a keyboard user lands on the reason instead of on a
 * control that did nothing. Only fixed copy is shown (never a server message);
 * the confirmation, the carrier and the source revision stay exactly as the
 * author confirmed them ("a refusal preserves the source and draft", :582).
 */

const SUMMARY = '[data-cms-editorial-restore-error]';

const NOTHING_CHANGED =
  'Nothing was changed; the source revision and your confirmation are unchanged.';
const RETRY_SAME_REQUEST =
  'Choose Confirm restore again to retry the same request; it cannot restore twice.';

export interface CmsEditorialRestoreFailure {
  readonly heading: string;
  readonly message: string;
  readonly recovery: string;
  /** True when the author must sign in again before retrying. */
  readonly signIn: boolean;
  /**
   * True when the attempt may have been applied or the session needs recovery:
   * the confirmation (and the key of an unconfirmed attempt) is kept as a scoped
   * draft instead of being forgotten.
   */
  readonly interrupted: boolean;
}

export const restoreFailureOf = (
  result: Exclude<CmsEditorialRestoreSubmitResult, { status: 'created' }>,
): CmsEditorialRestoreFailure => {
  if (result.status === 'refused')
    return {
      heading: 'The restore did not complete',
      message: result.message,
      recovery: NOTHING_CHANGED,
      signIn: false,
      interrupted: false,
    };
  const unauthenticated = result.error.code === 'UNAUTHENTICATED';
  return {
    heading: result.outcomeUnknown
      ? 'The restore could not be confirmed'
      : 'The restore did not complete',
    message: result.error.message,
    recovery: result.outcomeUnknown
      ? RETRY_SAME_REQUEST
      : unauthenticated
        ? 'Your confirmation stays in this page; choose Confirm restore again after signing in.'
        : NOTHING_CHANGED,
    signIn: unauthenticated,
    interrupted: result.outcomeUnknown || unauthenticated || result.retryable,
  };
};

export const clearRestoreFailure = (form: HTMLFormElement): void => {
  for (const existing of Array.from(form.querySelectorAll(SUMMARY)))
    existing.remove();
};

/** Renders the summary at the top of the form and moves focus to its heading. */
export const showRestoreFailure = (
  form: HTMLFormElement,
  documentRef: Document,
  failure: CmsEditorialRestoreFailure,
): void => {
  clearRestoreFailure(form);
  const summary = documentRef.createElement('div');
  summary.setAttribute('data-cms-editorial-restore-error', '');
  summary.setAttribute('role', 'group');
  summary.setAttribute('aria-labelledby', 'cms-editorial-restore-error-title');
  const heading = documentRef.createElement('h4');
  heading.id = 'cms-editorial-restore-error-title';
  heading.tabIndex = -1;
  heading.textContent = failure.heading;
  const message = documentRef.createElement('p');
  message.textContent = `${failure.message} ${failure.recovery}`;
  summary.appendChild(heading);
  summary.appendChild(message);
  if (failure.signIn) {
    const location = documentRef.defaultView?.location;
    const link = documentRef.createElement('a');
    link.href = `/auth/sign-in?returnTo=${encodeURIComponent(
      location === undefined ? '' : `${location.pathname}${location.search}`,
    )}`;
    // A new tab keeps this page, and so the confirmation, exactly as it is.
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Sign in again';
    const paragraph = documentRef.createElement('p');
    paragraph.appendChild(link);
    paragraph.appendChild(documentRef.createTextNode(' (opens in a new tab)'));
    summary.appendChild(paragraph);
  }
  form.insertBefore(summary, form.firstChild);
  heading.focus();
};
