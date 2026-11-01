import * as React from 'react';

import { planBulkAccept } from './composition-update-request';
import type { UpdateDiff } from './composition-types';

export const BULK_HEADING_ID = 'cms-bulk-heading';

interface Props {
  readonly diffs: readonly UpdateDiff[];
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly onAccept: () => void;
  readonly onClose: () => void;
}

/**
 * The selected updates (DEC-181): bulk acceptance is offered only when no listed instance collides. A selection of
 * more than 32 is sent as successive requests, which the panel states before the command.
 */
export default function CmsBulkUpdatePanel({
  diffs,
  busy,
  disabled,
  onAccept,
  onClose,
}: Props): React.ReactElement {
  const plan = planBulkAccept(diffs);
  const colliding = diffs.filter((diff) => !diff.bulkEligible);
  const requests = plan.ok ? plan.requests.length : 0;
  return (
    <section aria-labelledby={BULK_HEADING_ID} className="cms-diff">
      <h3 id={BULK_HEADING_ID} tabIndex={-1}>
        Selected updates
      </h3>
      <p role="status" aria-live="polite">
        {diffs.length} {diffs.length === 1 ? 'update' : 'updates'} selected.
      </p>
      {plan.ok ? (
        <p>
          None of them collides. Accepting sends {requests}{' '}
          {requests === 1 ? 'request' : 'requests'} of at most 32 instances
          each; the entry version is read again between requests.
        </p>
      ) : (
        <>
          <p>
            Bulk acceptance is available only when no selected instance has a
            collision or lacks a newer version. Review these one at a time:
          </p>
          <ul>
            {colliding.map((diff) => (
              <li key={diff.instance.id}>
                <code>{diff.instance.path}</code>
              </li>
            ))}
          </ul>
        </>
      )}
      <p>An unanswered update leaves each instance on its pinned version.</p>
      <div className="cms-composition-actions">
        <button
          type="button"
          disabled={busy || disabled || !plan.ok}
          onClick={onAccept}
        >
          Accept all selected updates
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </section>
  );
}
