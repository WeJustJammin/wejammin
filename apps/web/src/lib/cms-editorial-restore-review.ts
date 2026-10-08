import { forgetRestoreDraft } from './cms-editorial-restore-draft';
import { clearRestoreFailure } from './cms-editorial-restore-feedback';

const REVIEW = 'details[data-cms-editorial-restore-review]';

const reviewOf = (target: EventTarget | null): HTMLDetailsElement | null =>
  target instanceof Element
    ? (target.closest(REVIEW) as HTMLDetailsElement | null)
    : null;

const storageOf = (review: HTMLDetailsElement): Storage | null => {
  try {
    return review.ownerDocument.defaultView?.sessionStorage ?? null;
  } catch {
    return null;
  }
};

/**
 * Closing the review before any commit is the explicit discard of the scoped
 * draft (FE03 :921 "clear only after success or explicit discard"): the kept
 * confirmation, its idempotency key and any failure summary are dropped.
 */
const close = (review: HTMLDetailsElement): void => {
  for (const form of Array.from(
    review.querySelectorAll<HTMLFormElement>(
      'form[data-cms-editorial-restore]',
    ),
  )) {
    forgetRestoreDraft(storageOf(review), form);
    clearRestoreFailure(form);
  }
  review.open = false;
  review.querySelector<HTMLElement>('summary')?.focus();
};

/**
 * Behavior of the inline restore review (FE03 `CmsEditorialRestoreForm`): the
 * confirmation heading takes focus when the review opens, and Escape or Cancel
 * closes it before any commit and returns focus to the control that opened it.
 * The review is a native disclosure, so it opens and closes without script; this
 * only adds the focus handling the spec requires.
 */
export const installCmsEditorialRestoreReview = (
  documentRef: Document,
  signal: AbortSignal | undefined,
): void => {
  const options = signal === undefined ? undefined : { signal };
  // `toggle` does not bubble, so it is observed in the capture phase.
  documentRef.addEventListener(
    'toggle',
    (event) => {
      const review = reviewOf(event.target);
      if (review?.open === true)
        review.querySelector<HTMLElement>('#history-restore-title')?.focus();
    },
    { capture: true, ...options },
  );
  documentRef.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return;
      const review = reviewOf(event.target);
      if (review === null || !review.open) return;
      event.preventDefault();
      close(review);
    },
    options,
  );
  documentRef.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (
        !(target instanceof Element) ||
        target.closest('[data-cms-editorial-restore-cancel]') === null
      )
        return;
      const review = reviewOf(target);
      if (review !== null) close(review);
    },
    options,
  );
};
