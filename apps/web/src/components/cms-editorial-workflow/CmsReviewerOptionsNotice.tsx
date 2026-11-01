import * as React from 'react';

import { rateLimitMessage } from '../../lib/rate-limit-message';
import type { ReviewerOptionsResult } from './cms-workflow-reviewer-options';

export interface CmsReviewerOptionsNoticeProps {
  readonly reviewers: ReviewerOptionsResult | null;
  /** Reads the choices again; the button of a failed read (not a rate limit) calls it. */
  readonly retry?: () => void;
}

/** The sentence of the polite status for each state of the read. */
export const reviewerStatusText = (
  reviewers: ReviewerOptionsResult | null,
): string => {
  if (reviewers === null) return 'Loading reviewers…';
  if (reviewers.kind === 'ok') return 'Reviewer choices loaded.';
  return reviewers.rateLimit === undefined
    ? 'Reviewer choices could not be loaded.'
    : '';
};

/**
 * The sentence of a reviewer list that is not there (FE03 :1172): the list is still loading, it
 * was rate limited (the stated wait is announced and the choices are read again after it, see
 * `useReviewerOptions`), or it failed for another reason and the person can read it again. The
 * polite status says each state in a sentence (FE03 "Loading": a read exposes its loading state;
 * :1125 a picker whose options are degraded says so and offers the retry).
 */
export default function CmsReviewerOptionsNotice({
  reviewers,
  retry,
}: CmsReviewerOptionsNoticeProps): React.ReactElement {
  const message =
    reviewers?.kind === 'unavailable' && reviewers.rateLimit !== undefined
      ? `Reviewer choices could not be loaded yet. ${rateLimitMessage(reviewers.rateLimit.retryAfterSeconds)}`
      : '';
  const announcementRef = React.useRef<HTMLParagraphElement>(null);
  // React owns the empty node; this effect owns its text after commit.
  React.useEffect(() => {
    const region = announcementRef.current;
    if (region === null) return;
    region.textContent = message;
    return () => {
      region.textContent = '';
    };
  }, [message]);
  const failed =
    reviewers?.kind === 'unavailable' && reviewers.rateLimit === undefined;
  return (
    <>
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-cms-reviewers-status=""
      >
        {reviewerStatusText(reviewers)}
      </p>
      {failed && retry !== undefined ? (
        <p>
          <button type="button" onClick={retry}>
            Try loading reviewers again
          </button>
        </p>
      ) : null}
      <p
        ref={announcementRef}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-cms-reviewers-rate-limit=""
      />
    </>
  );
}
