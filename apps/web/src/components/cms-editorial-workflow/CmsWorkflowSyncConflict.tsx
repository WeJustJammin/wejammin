import * as React from 'react';

import type { SyncConflictState } from './cms-workflow-command-controller';

export interface CmsWorkflowSyncConflictProps {
  readonly headingId: string;
  readonly conflict: SyncConflictState;
  readonly onAcknowledge: () => void;
}

/** The record changed while the person was verifying: nothing was sent, the entries are kept. */
export default function CmsWorkflowSyncConflict({
  headingId,
  conflict,
  onAcknowledge,
}: CmsWorkflowSyncConflictProps): React.ReactElement {
  return (
    <section
      aria-labelledby={`${headingId}-conflict`}
      data-cms-editorial-sync-conflict="true"
    >
      <h4 id={`${headingId}-conflict`}>
        This record changed while you were verifying
      </h4>
      <p>
        You started at version {conflict.draftVersion ?? 'unknown'}; the current
        record is version {conflict.currentVersion ?? 'unknown'}. Nothing was
        sent and your entries are kept in this browser only.
      </p>
      <button type="button" onClick={onAcknowledge}>
        Review the current version and continue
      </button>
    </section>
  );
}
