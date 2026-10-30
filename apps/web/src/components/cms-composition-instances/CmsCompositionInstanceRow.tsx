import * as React from 'react';

import {
  canDetach,
  canReviewUpdate,
  pinLabel,
  stateLabel,
} from './composition-rows';
import type { InstanceRow } from './composition-types';
import { ROW_HEIGHT_PX } from './composition-windowing';

export const instanceRowId = (id: string): string => `cms-instance-${id}`;

interface Props {
  readonly row: InstanceRow;
  readonly selected: boolean;
  readonly reviewing: boolean;
  /** A command is in flight (or a diff is being read): every control that starts another command waits (DEC-241). */
  readonly busy: boolean;
  readonly windowed: boolean;
  readonly posInSet: number;
  readonly setSize: number;
  readonly onToggle: (id: string) => void;
  readonly onReview: (id: string) => void;
  readonly onDetach: (id: string) => void;
}

/** One block root of a placed pattern: its path, block, state and pinned version, with its row commands. */
export default function CmsCompositionInstanceRow({
  row,
  selected,
  reviewing,
  busy,
  windowed,
  posInSet,
  setSize,
  onToggle,
  onReview,
  onDetach,
}: Props): React.ReactElement {
  const checkId = `${instanceRowId(row.id)}-select`;
  return (
    <li
      id={instanceRowId(row.id)}
      className="cms-instance-row"
      aria-current={reviewing ? 'true' : undefined}
      aria-posinset={windowed ? posInSet : undefined}
      aria-setsize={windowed ? setSize : undefined}
      style={windowed ? { blockSize: ROW_HEIGHT_PX } : undefined}
    >
      <label className="cms-instance-select">
        <input
          type="checkbox"
          id={checkId}
          checked={selected}
          onChange={() => onToggle(row.id)}
        />
        <span className="cms-visually-hidden">Select {row.path}</span>
      </label>
      <span className="cms-instance-facts">
        <code>{row.path}</code>
        <span>
          {row.blockKey} version {row.blockVersion}
        </span>
        <span className="cms-instance-state">{stateLabel(row)}</span>
        <span>{pinLabel(row)}</span>
      </span>
      <span className="cms-composition-actions">
        {canReviewUpdate(row) ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onReview(row.id)}
            aria-label={`Review update for ${row.path}`}
          >
            Review update
          </button>
        ) : null}
        {canDetach(row) ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onDetach(row.id)}
            aria-label={`Detach ${row.path}`}
          >
            Detach
          </button>
        ) : null}
      </span>
    </li>
  );
}
