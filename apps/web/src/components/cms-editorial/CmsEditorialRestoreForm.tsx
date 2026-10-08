import type { RevisionHistoryPage } from '@wejammin/contracts';
import * as React from 'react';

export interface CmsEditorialRestoreFormProps {
  readonly compare: NonNullable<RevisionHistoryPage['compare']>;
  readonly entryId: string;
  /** Current entry version for the restore CAS, or null when it is unavailable. */
  readonly expectedVersion: string | null;
}

/** Closed refusal copy of an unavailable D6 carrier: the verdict, never the chain. */
const UNAVAILABLE_COPY: Readonly<Record<string, string>> = {
  chain_unavailable: 'The migration chain is unavailable for this revision.',
  transform_missing: 'A required transform is missing for this revision.',
};

/**
 * The CMS-03B-04 restore as an inline review step. `compare.restore` is the
 * deterministic chain for the LEFT revision, so the LEFT revision is what is
 * restored (BE03b); the right side is only what it was compared against. The
 * review is a native disclosure: it states the consequence, the migration steps
 * and the availability, and one deliberate Confirm button commits the real
 * command (the page action sends it with the read-derived chain unchanged).
 * Escape and Cancel close it before any commit; an unavailable verdict offers
 * no commit at all, only the reason.
 */
export default function CmsEditorialRestoreForm({
  compare,
  entryId,
  expectedVersion,
}: CmsEditorialRestoreFormProps): React.ReactElement | null {
  const restore = compare.restore;
  if (restore === null) return null;
  if (restore.availability !== 'available')
    return (
      <p role="status">
        {UNAVAILABLE_COPY[restore.availability] ??
          'This revision cannot be restored.'}
      </p>
    );
  if (expectedVersion === null)
    return (
      <p role="status">
        The current entry version is unavailable. Reload before restoring.
      </p>
    );
  const action = `/api/v1/cms/entries/${encodeURIComponent(entryId)}/revisions/${encodeURIComponent(compare.leftRevisionId)}/restore`;
  return (
    <details data-cms-editorial-restore-review="">
      <summary>Restore this revision</summary>
      <section aria-labelledby="history-restore-title">
        <h3 id="history-restore-title" tabIndex={-1}>
          Confirm restore
        </h3>
        <p>
          Restoring creates a new draft revision. The source revision stays
          unchanged.
        </p>
        <p>
          Migration steps: {restore.edgeCount}. Availability:{' '}
          {restore.availability}.
        </p>
        <form data-cms-editorial-restore="" method="post" action={action}>
          <input type="hidden" name="entryId" value={entryId} />
          <input
            type="hidden"
            name="revisionId"
            value={compare.leftRevisionId}
          />
          <input
            type="hidden"
            name="migrationChainId"
            value={restore.migrationChainId}
          />
          <input
            type="hidden"
            name="edgeCount"
            value={String(restore.edgeCount)}
          />
          <input
            type="hidden"
            name="availability"
            value={restore.availability}
          />
          <input type="hidden" name="expectedVersion" value={expectedVersion} />
          <button type="submit">Confirm restore</button>{' '}
          <button type="button" data-cms-editorial-restore-cancel="">
            Cancel
          </button>
        </form>
      </section>
    </details>
  );
}
