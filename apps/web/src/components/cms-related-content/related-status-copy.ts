import { rateLimitMessage } from '../../lib/rate-limit-message';
import { TARGET_REFUSED_MESSAGE } from './related-content-copy';
import type { RelatedSubmitResult } from './related-content-submit';
import type { RelatedConflictReviewState } from './related-content-types';

/*
 * Fixed copy of every non-success outcome of CMS-03C-05. Nothing here is taken from a response: a
 * refusal of a target is one message that never says why (FE03 :890, :2665), and no outcome shows a
 * provider detail, an owner or a request body.
 */
type Failure = Exclude<RelatedSubmitResult, { kind: 'saved' }>;

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
    case 'conflict':
      return 'This entry changed';
    case 'refused':
      return failure.reason === 'capability_missing'
        ? 'You cannot change related content for this entry'
        : failure.reason === 'derived_rule_unknown'
          ? 'That rule is not available'
          : 'Some entries cannot be used';
    case 'rejected':
      return REJECTED_HEADING[failure.status] ?? 'Could not save';
    case 'uncertain':
      return 'Save not confirmed';
  }
};

const REJECTED_COPY: Readonly<Record<number, string>> = {
  400: 'This request could not be read. Reload the page and try again.',
  401: 'Your session ended. Sign in, then come back to this page. Your choices here are not kept.',
  403: 'This account cannot change related content for this entry, or the page is out of date. Reload the page and try again.',
  404: 'This entry is not available to this account.',
  415: 'The request could not be sent. Reload the page and try again.',
  422: 'Related content could not be saved. Check the pins, exclusions and rule, then save again.',
  500: 'Related content could not be saved. Nothing was confirmed. Try again shortly.',
  502: 'The related content service is not responding. Nothing was confirmed. Try again shortly.',
  503: 'The related content service is not responding. Nothing was confirmed. Try again shortly.',
  504: 'The related content service is not responding. Nothing was confirmed. Try again shortly.',
};

export const failureCopy = (failure: Failure): string => {
  switch (failure.kind) {
    case 'conflict':
      return 'The entry changed after this page loaded. Your choices are kept. Review the current server state before you reapply them, or reload the page.';
    case 'refused':
      if (failure.reason === 'capability_missing')
        return 'This account does not have edit access to this entry. Nothing was saved.';
      if (failure.reason === 'derived_rule_unknown')
        return 'Choose another rule, or none, and save again.';
      return failure.rows.length > 0
        ? 'The entries marked in the lists cannot be used for related content. Remove them and save again.'
        : TARGET_REFUSED_MESSAGE;
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

/** Fixed read-failure copy, with no server detail or inferred authority. */
export const reviewStateCopy = (state: RelatedConflictReviewState): string => {
  if (state.kind === 'reading')
    return 'Reading the current server state… Your choices are kept.';
  if (state.kind === 'rate_limited') {
    if (state.retryAfterSeconds !== null && state.retryAfterSeconds <= 0)
      return 'Your input is kept. Review changes is available again.';
    return rateLimitMessage(state.retryAfterSeconds);
  }
  if (state.kind !== 'failed') return '';
  if (state.status === 401)
    return 'Sign in again, then reload this page. Your choices here are kept until you leave.';
  if (state.status === 403)
    return 'This account cannot review related content for this entry. Your choices are kept; nothing was reapplied.';
  if (state.status === 404)
    return 'This entry is not available to this account. Your choices are kept; nothing was reapplied.';
  return 'The current server state could not be verified. Your choices are kept. Try Review changes again; nothing was reapplied.';
};
