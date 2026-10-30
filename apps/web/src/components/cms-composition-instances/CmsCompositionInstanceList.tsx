import * as React from 'react';

import CmsCompositionInstanceRow from './CmsCompositionInstanceRow';
import { canDetach, canReviewUpdate } from './composition-rows';
import type { InstanceRow } from './composition-types';
import { windowFor } from './composition-windowing';

export interface CmsCompositionInstanceListProps {
  readonly rows: readonly InstanceRow[];
  /** Selected row ids; kept by id so a selection survives a row scrolling out of the window. */
  readonly selected: ReadonlySet<string>;
  readonly reviewingId: string | null;
  /** A command is in flight or a diff is being read: every control that starts another command waits (DEC-241). */
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly onToggle: (id: string) => void;
  readonly onReview: (id: string) => void;
  readonly onDetach: (id: string) => void;
  readonly onBulkReview: () => void;
  readonly onBulkDetach: () => void;
}

export const INSTANCE_LIST_HEADING_ID = 'cms-instance-list-heading';

/**
 * The instances of the entry's draft (FE03 887, 1509; P2-S12-AC-123): one row per block root, in the render order the
 * instance list read answers (DEC-206: slot, stored `position` of DEC-185, path), shown as given, with stable row ids,
 * the count announced politely and virtualization above 100 rows. The page loads every page of the read, so the list
 * is one in-page collection with no pager.
 */
export default function CmsCompositionInstanceList({
  rows,
  selected,
  reviewingId,
  busy,
  disabled,
  onToggle,
  onReview,
  onDetach,
  onBulkReview,
  onBulkDetach,
}: CmsCompositionInstanceListProps): React.ReactElement {
  const ordered = rows;
  const [scrollTop, setScrollTop] = React.useState(0);
  const view = windowFor(ordered.length, scrollTop);
  const chosen = ordered.filter((row) => selected.has(row.id));
  const blocked = busy || disabled;
  const count = ordered.length;
  return (
    <section
      aria-labelledby={INSTANCE_LIST_HEADING_ID}
      className="cms-instances"
    >
      <h2 id={INSTANCE_LIST_HEADING_ID}>Composition instances</h2>
      <p data-row-count role="status" aria-live="polite">
        {count} {count === 1 ? 'row' : 'rows'}
      </p>
      <div className="cms-composition-actions">
        <span>{selected.size} selected</span>
        <button
          type="button"
          disabled={
            blocked ||
            chosen.length === 0 ||
            chosen.length !== selected.size ||
            !chosen.every(canReviewUpdate)
          }
          onClick={onBulkReview}
        >
          Review selected updates
        </button>
        <button
          type="button"
          disabled={
            blocked ||
            chosen.length === 0 ||
            chosen.length !== selected.size ||
            !chosen.every(canDetach)
          }
          onClick={onBulkDetach}
        >
          Detach selected
        </button>
      </div>
      {count === 0 ? <p>No pattern instances are listed yet.</p> : null}
      <div
        className="cms-instance-scroll"
        data-windowed={String(view.windowed)}
        tabIndex={view.windowed ? 0 : undefined}
        role={view.windowed ? 'group' : undefined}
        aria-label={view.windowed ? 'Instance rows' : undefined}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <ul
          className="cms-instance-rows"
          style={
            view.windowed
              ? { paddingBlockStart: view.before, paddingBlockEnd: view.after }
              : undefined
          }
        >
          {ordered.slice(view.start, view.end).map((row, offset) => (
            <CmsCompositionInstanceRow
              key={row.id}
              row={row}
              selected={selected.has(row.id)}
              reviewing={reviewingId === row.id}
              busy={blocked}
              windowed={view.windowed}
              posInSet={view.start + offset + 1}
              setSize={count}
              onToggle={onToggle}
              onReview={onReview}
              onDetach={onDetach}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
