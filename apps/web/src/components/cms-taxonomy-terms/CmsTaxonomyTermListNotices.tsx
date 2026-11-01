import * as React from 'react';

/** The two notices of the term list: a refresh that failed (actions off) and a cursor conflict that restarted it. */
export default function CmsTaxonomyTermListNotices({
  failed,
  restarted,
  refreshing,
  onRefresh,
}: {
  readonly failed: boolean;
  readonly restarted: boolean;
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
}): React.ReactElement {
  return (
    <>
      {failed ? (
        <p role="alert">
          The list could not be refreshed, so the last verified list is shown
          and term actions are off.{' '}
          <button type="button" disabled={refreshing} onClick={onRefresh}>
            {refreshing ? 'Refreshing…' : 'Refresh the list'}
          </button>
        </p>
      ) : null}
      {restarted ? (
        <p role="status">
          The list changed while you were paging, so it restarted from the first
          page.
        </p>
      ) : null}
    </>
  );
}
