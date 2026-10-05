import type * as React from 'react';

export interface CmsEditorialSyncConflictProps {
  readonly headingId: string;
  readonly expectedVersion: string | null;
  readonly currentVersion: string;
  readonly unsentChangeCount: number;
}

/**
 * Multi-tab divergence. FE03:1441-1451 forbids last-write-wins: the editor is
 * told to reconcile explicitly and unsent local values are preserved.
 */
const CmsEditorialSyncConflict = ({
  headingId,
  expectedVersion,
  currentVersion,
  unsentChangeCount,
}: CmsEditorialSyncConflictProps): React.ReactElement => (
  <section
    className="cms-editorial-conflict"
    aria-labelledby={headingId}
    data-cms-editorial-sync-conflict="true"
  >
    <h2 id={headingId}>This entry changed in another tab or session</h2>
    <p>
      Loaded version {expectedVersion ?? 'unknown'} no longer matches the
      current version {currentVersion}. Nothing was overwritten.
    </p>
    <p>
      {unsentChangeCount === 0
        ? 'You have no unsent changes.'
        : unsentChangeCount +
          (unsentChangeCount === 1
            ? ' unsent change is kept in this browser only.'
            : ' unsent changes are kept in this browser only.')}
    </p>
    <p>Review the current version and choose how to resolve the difference.</p>
  </section>
);

export default CmsEditorialSyncConflict;
