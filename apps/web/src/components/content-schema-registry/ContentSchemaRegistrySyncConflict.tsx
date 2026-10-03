import * as React from 'react';

export interface ContentSchemaRegistrySyncConflictProps {
  readonly serverVersion: string;
  readonly localVersion: string;
  readonly onReviewLabel?: string;
  readonly onReview?: () => void;
  readonly onReapply?: () => void;
  readonly onDiscard?: () => void;
}

/** A conflict preserves local input and requires an explicit user outcome. */
export function ContentSchemaRegistrySyncConflict({
  serverVersion,
  localVersion,
  onReviewLabel = 'Review current version',
  onReview,
  onReapply,
  onDiscard,
}: ContentSchemaRegistrySyncConflictProps): React.ReactElement {
  return (
    <section
      className="content-schema-registry-sync-conflict"
      role="alert"
      aria-labelledby="content-schema-registry-conflict-heading"
    >
      <h3 id="content-schema-registry-conflict-heading" tabIndex={-1}>
        <span aria-hidden="true">⚠</span> Review the current registry version
      </h3>
      <p>
        No registry draft was overwritten. Review before reapplying any retained
        input.
      </p>
      <p>
        Server version: <code>{serverVersion}</code>. Local version:{' '}
        <code>{localVersion}</code>.
      </p>
      <div className="content-schema-registry-actions">
        <button type="button" onClick={onReview}>
          {onReviewLabel}
        </button>
        <button type="button" onClick={onReapply}>
          Reapply retained input
        </button>
        <button type="button" className="secondary-action" onClick={onDiscard}>
          Discard retained input
        </button>
      </div>
    </section>
  );
}

export default ContentSchemaRegistrySyncConflict;
