import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { LIST_REFUSAL_COPY } from './related-content-copy';
import {
  addExclusion,
  addPin,
  movePin,
  removeExclusion,
  removePin,
  type RelatedLists,
} from './related-content-lists';
import type { RelatedStatus } from './related-content-types';

/**
 * FE03 1048: an edit never lifts the stable pending label, a conflict the person still has to review, or an unknown
 * outcome that is being (or could not be) reconciled: a retry waits for that read (FE03 1050).
 */
export const keepOnEdit = (current: RelatedStatus): RelatedStatus =>
  current.kind === 'pending' ||
  current.kind === 'reconciling' ||
  (current.kind === 'result' &&
    (current.result.kind === 'conflict' || current.result.kind === 'uncertain'))
    ? current
    : { kind: 'idle' };

interface Setters {
  readonly setLists: Dispatch<SetStateAction<RelatedLists>>;
  readonly setRows: (rows: never[]) => void;
  readonly setNote: (note: string) => void;
  readonly setStatus: Dispatch<SetStateAction<RelatedStatus>>;
}

/** The pin, exclude, remove and move commands over the two lists; the components only render. */
export const useRelatedListEdits = (
  lists: RelatedLists,
  { setLists, setRows, setNote, setStatus }: Setters,
) => {
  const edited = useCallback(
    (next: RelatedLists, message: string) => {
      setLists(next);
      setRows([]);
      setNote(message);
      // FE03 1048: an edit never lifts the stable pending label, nor a conflict the person still has to review.
      setStatus(keepOnEdit);
    },
    [setLists, setNote, setRows, setStatus],
  );

  const pin = useCallback(
    (id: string) => {
      const change = addPin(lists, id);
      if (change.ok)
        edited(change.lists, `Pinned at position ${change.lists.pins.length}.`);
      else setNote(LIST_REFUSAL_COPY[change.reason]);
    },
    [edited, lists],
  );
  const exclude = useCallback(
    (id: string) => {
      const change = addExclusion(lists, id);
      if (!change.ok) setNote(LIST_REFUSAL_COPY[change.reason]);
      else
        edited(
          change.lists,
          change.displacedPin
            ? 'Excluded. Its pin was removed because exclusions win.'
            : 'Excluded.',
        );
    },
    [edited, lists],
  );
  const unpin = useCallback(
    (id: string) => edited(removePin(lists, id), 'Pin removed.'),
    [edited, lists],
  );
  const unexclude = useCallback(
    (id: string) => edited(removeExclusion(lists, id), 'Exclusion removed.'),
    [edited, lists],
  );
  const move = useCallback(
    (index: number, delta: -1 | 1) => {
      const next = movePin(lists, index, delta);
      if (next !== lists)
        edited(
          next,
          `Moved to position ${index + delta + 1} of ${next.pins.length}.`,
        );
    },
    [edited, lists],
  );
  return { pin, exclude, unpin, unexclude, move };
};
