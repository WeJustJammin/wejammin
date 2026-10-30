import * as React from 'react';

export interface CmsGovernedReviewDegradedProps {
  /** The time of the last verified read; the review itself is not shown. */
  readonly since: string;
  /** Reads the review again: offered for a non-429 degrade only (a 429 re-reads by itself after its Retry-After). */
  readonly onReread?: (() => void) | undefined;
}

/**
 * FE03 1050: a degraded review detail is re-required, never kept. The notice names the last verified time, stays a
 * polite status, and offers the re-read when the server stated no wait.
 */
export default function CmsGovernedReviewDegraded({
  since,
  onReread,
}: CmsGovernedReviewDegradedProps): React.ReactElement {
  return (
    <p data-cms-workflow-degraded="" role="status">
      The review is not shown because it could not be verified again. It was
      last verified <time dateTime={since}>{since}</time>. Commands are off
      until the review is read again.{' '}
      {onReread === undefined ? null : (
        <button type="button" onClick={onReread}>
          Read the review again
        </button>
      )}
    </p>
  );
}
