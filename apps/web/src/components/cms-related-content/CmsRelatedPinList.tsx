import * as React from 'react';

import CmsRelatedEntryLabel from './CmsRelatedEntryLabel';
import type { RelatedCandidate } from './related-candidates';
import { TARGET_REFUSED_MESSAGE } from './related-content-copy';
import { MAX_PINS } from './related-content-lists';
import { entryName } from './related-format';

export const PINS_HEADING_ID = 'cms-related-pins-heading';

interface Props {
  readonly pins: readonly string[];
  readonly factsOf: (entryId: string) => RelatedCandidate | null;
  /** Whether the whole entry list was seen without this id (DEC-195). */
  readonly isUnavailable: (entryId: string) => boolean;
  /** Row indexes the server refused, each with the one fixed message. */
  readonly refused: ReadonlySet<number>;
  readonly onMove: (index: number, delta: -1 | 1) => void;
  readonly onRemove: (entryId: string) => void;
}

type Pending =
  { readonly id: string; readonly direction: 'up' | 'down' } | 'heading' | null;

/**
 * The ordered pins (FE03 :890): an ordered list whose order is the order shown, with Move up and Move
 * down on every row so no path depends on dragging. Focus follows the moved row, and a removal returns
 * focus to the list heading.
 */
export default function CmsRelatedPinList({
  pins,
  factsOf,
  isUnavailable,
  refused,
  onMove,
  onRemove,
}: Props): React.ReactElement {
  const pending = React.useRef<Pending>(null);
  const root = React.useRef<HTMLOListElement | null>(null);
  React.useEffect(() => {
    const target = pending.current;
    pending.current = null;
    if (target === null) return;
    if (target === 'heading') {
      document.getElementById(PINS_HEADING_ID)?.focus();
      return;
    }
    const row = root.current?.querySelector(`[data-entry-id="${target.id}"]`);
    const wanted = row?.querySelector<HTMLButtonElement>(
      `button[data-move="${target.direction}"]`,
    );
    const other = row?.querySelector<HTMLButtonElement>(
      `button[data-move="${target.direction === 'up' ? 'down' : 'up'}"]`,
    );
    (wanted?.disabled === false ? wanted : other)?.focus();
  }, [pins]);

  return (
    <section aria-labelledby={PINS_HEADING_ID} className="cms-related-list">
      <h2 id={PINS_HEADING_ID} tabIndex={-1}>
        Pinned entries
      </h2>
      <p>
        {pins.length} of {MAX_PINS} pins used. Pinned entries come first, in
        this order.
      </p>
      {pins.length === 0 ? (
        <p>No entries are pinned.</p>
      ) : (
        <ol ref={root} className="cms-related-rows">
          {pins.map((id, index) => (
            <li
              key={id}
              data-entry-id={id}
              aria-describedby={
                refused.has(index)
                  ? `cms-related-pin-refusal-${index}`
                  : undefined
              }
            >
              <CmsRelatedEntryLabel
                entryId={id}
                facts={factsOf(id)}
                unavailable={isUnavailable(id)}
              />
              <div className="cms-related-actions">
                <button
                  type="button"
                  data-move="up"
                  disabled={index === 0}
                  aria-label={`Move up ${entryName(id)}, now position ${index + 1} of ${pins.length}`}
                  onClick={() => {
                    pending.current = { id, direction: 'up' };
                    onMove(index, -1);
                  }}
                >
                  Move up
                </button>
                <button
                  type="button"
                  data-move="down"
                  disabled={index === pins.length - 1}
                  aria-label={`Move down ${entryName(id)}, now position ${index + 1} of ${pins.length}`}
                  onClick={() => {
                    pending.current = { id, direction: 'down' };
                    onMove(index, 1);
                  }}
                >
                  Move down
                </button>
                <button
                  type="button"
                  aria-label={`Remove pin ${entryName(id)}`}
                  onClick={() => {
                    pending.current = 'heading';
                    onRemove(id);
                  }}
                >
                  Remove pin
                </button>
              </div>
              {refused.has(index) ? (
                <p
                  id={`cms-related-pin-refusal-${index}`}
                  className="cms-related-refusal"
                >
                  {TARGET_REFUSED_MESSAGE}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
