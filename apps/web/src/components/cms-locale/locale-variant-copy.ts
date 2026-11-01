import { rateLimitMessage } from '../../lib/rate-limit-message';
import type { LocaleSourceRefreshResult } from './locale-source-refresh';
import type { LocaleSubmitResult } from './locale-variant-submit';
import type { LocaleVariantState } from './locale-variant-types';

/*
 * Fixed copy of every non-success outcome of CMS-03C-04 (FE03 :891, :1122, :1336). Nothing here is taken
 * from a response: no outcome shows a provider detail, an owner, a person or a request body, and the 403 and
 * the 404 stay apart (a visible entry without edit authority versus a hidden or absent one).
 */
export const LOCALE_RESULT_HEADING_ID = 'cms-locale-result-heading';

type Failure = Exclude<LocaleSubmitResult, { kind: 'saved' }>;

const REJECTED_HEADING: Readonly<Record<number, string>> = {
  400: 'Invalid request',
  401: 'Sign in again',
  403: 'Not allowed',
  404: 'Entry not available',
  415: 'Could not save',
  422: 'Could not save',
  429: 'Too many requests',
  500: 'Could not save',
  502: 'Temporarily unavailable',
  503: 'Temporarily unavailable',
  504: 'Temporarily unavailable',
};

export const failureHeading = (failure: Failure): string => {
  switch (failure.kind) {
    case 'chain_mismatch':
      return 'Fallback order changed';
    case 'limit_reached':
      return 'No more languages can be added';
    case 'conflict':
      return 'This entry changed';
    case 'rejected':
      return REJECTED_HEADING[failure.status] ?? 'Could not save';
    case 'uncertain':
      return 'Save not confirmed';
  }
};

const REJECTED_COPY: Readonly<Record<number, string>> = {
  400: 'This request could not be read. Reload the page and try again.',
  401: 'Your session ended. Sign in, then come back to this page. What you typed here is not kept.',
  403: 'This account cannot edit this entry, so it cannot save translations for it. Nothing was saved.',
  404: 'This entry or its source revision is not available to this account. Nothing was saved.',
  415: 'The request could not be sent. Reload the page and try again.',
  422: 'This language is not supported for this content type, so the translation cannot be saved. Nothing was saved.',
  500: 'The translation could not be saved. Nothing was confirmed. Try again shortly.',
  502: 'The translation service is not responding. Nothing was confirmed. Try again shortly.',
  503: 'The translation service is not responding. Nothing was confirmed. Try again shortly.',
  504: 'The translation service is not responding. Nothing was confirmed. Try again shortly.',
};

export const failureCopy = (failure: Failure, locale: string): string => {
  switch (failure.kind) {
    case 'chain_mismatch':
      return `The fallback order for ${locale} changed. Reload the current order and review your translation before saving.`;
    case 'limit_reached':
      return 'This entry already has translations in 32 languages, the most it can have. Nothing was saved.';
    case 'conflict':
      return 'The entry or its source changed after this page loaded. Your translations are kept. Review the current source, then use it before you save again.';
    case 'rejected':
      return failure.status === 429
        ? failure.retryAfterSeconds === undefined
          ? 'Too many requests. Try again shortly.'
          : `Too many requests. Try again in ${failure.retryAfterSeconds} seconds.`
        : (REJECTED_COPY[failure.status] ?? REJECTED_COPY[500]!);
    case 'uncertain':
      return 'We could not confirm whether the save went through. Saving again is safe: the same request is never applied twice.';
  }
};

/** What the order change leaves the person with, beside the fixed sentence of FE03 :1336. */
export const MISMATCH_FOLLOW_UP =
  'The order above now shows the current one. Your translations are kept.';

/** Fixed read-failure copy for the source refetch, with no server detail. */
export const sourceReviewCopy = (state: LocaleSourceRefreshResult): string => {
  if (state.kind === 'rate_limited')
    return rateLimitMessage(state.retryAfterSeconds);
  if (state.kind !== 'failed') return '';
  if (state.status === 401)
    return 'Sign in again, then reload this page. Your translations here are kept until you leave.';
  if (state.status === 403 || state.status === 404)
    return 'The current source is not available to this account. Your translations are kept; nothing was applied.';
  return 'The current source could not be verified. Your translations are kept. Try again; nothing was applied.';
};

export const SAVE_WARNING =
  'Saving writes a new draft of this language with exactly the translations on this page. A field you leave empty is not translated, even if an earlier save translated it.';
/** The derived variant state in words (BE03c 1532, AC-234): never colour alone. */
export const variantStateText = (state: LocaleVariantState): string =>
  ({
    untranslated: 'Untranslated',
    draft: 'Draft',
    review: 'In review',
    approved: 'Approved',
    stale: 'Out of date',
  })[state];
export const NO_FALLBACK_SOURCE_NOTE =
  'The source text is not shown for a no-fallback field.';

/** A verified read after an unknown outcome showed the entry or its source moved (DEC-244 3): reported, never adopted. */
export const ENTRY_MOVED_NOTICE =
  'The entry changed after this page loaded, so the translation may have been saved. Sending again retries the same request and cannot save it twice.';
