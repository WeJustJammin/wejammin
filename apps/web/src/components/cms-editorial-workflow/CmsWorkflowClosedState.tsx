import * as React from 'react';

export interface CmsWorkflowClosedStateProps {
  /** `signed-out`: the session ended; `gone`: concealed, denied or no longer there. */
  readonly kind: 'signed-out' | 'gone';
}

/**
 * What an island shows once its protected data has been removed (FE03 "remove
 * protected data"): never a partial page, never a hint whether a record exists.
 * A concealed, denied and vanished record read identically.
 */
export default function CmsWorkflowClosedState({
  kind,
}: CmsWorkflowClosedStateProps): React.ReactElement {
  return (
    <section data-cms-workflow-closed={kind}>
      {kind === 'gone' ? (
        <p role="alert">This record is not available.</p>
      ) : (
        <p role="alert">
          Your session expired. Your entries were not saved.{' '}
          <a
            href={`/auth/sign-in?returnTo=${encodeURIComponent(
              `${window.location.pathname}${window.location.search}`,
            )}`}
          >
            Sign in again
          </a>
        </p>
      )}
    </section>
  );
}
