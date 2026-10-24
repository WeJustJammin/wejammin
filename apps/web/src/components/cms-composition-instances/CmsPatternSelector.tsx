import * as React from 'react';

import { rateLimitMessage } from '../../lib/rate-limit-message';
import { refusalMessage } from './composition-copy';
import type {
  ReadState,
  SelectorItem,
  SelectorPage,
} from './composition-types';

export const PATTERN_SELECT_ID = 'cms-composition-pattern';
const COUNT_ID = 'cms-composition-pattern-count';
const ERROR_ID = 'cms-composition-pattern-error';

export interface CmsPatternSelectorProps {
  /** The patterns listed so far (CMS-03C-13) and the cursor that continues the listing. */
  readonly page: SelectorPage;
  /** The state of the "Load more" read; the listed patterns stay while it runs or fails. */
  readonly state: ReadState<unknown>;
  readonly selectedId: string | null;
  readonly onSelect: (item: SelectorItem | null) => void;
  readonly onLoadMore: () => void;
  readonly invalid?: string | null;
  readonly disabled?: boolean;
}

const nodes = (count: number): string =>
  `${count} ${count === 1 ? 'node' : 'nodes'}`;

export const patternLabel = (item: SelectorItem): string =>
  `${item.patternKey} version ${item.patternVersion} (${nodes(item.nodeCount)})`;

const stateMessage = (state: ReadState<unknown>): string | null =>
  state.kind === 'failed'
    ? refusalMessage('selector', state.status ?? 0, state.reason)
    : state.kind === 'rate_limited'
      ? rateLimitMessage(state.retryAfterSeconds)
      : null;

/**
 * The pattern chooser of the instance-insert form (FE03 886, 1508; P2-S12-AC-111): the active, compatible pattern
 * versions of the entry's content type as a native select, never preselected, with the result count announced
 * politely. Selection is an input to a command, never authority; the cursor stays in component state only.
 */
export default function CmsPatternSelector({
  page,
  state,
  selectedId,
  onSelect,
  onLoadMore,
  invalid = null,
  disabled = false,
}: CmsPatternSelectorProps): React.ReactElement {
  const count = page.items.length;
  const message = stateMessage(state);
  const describedBy = [COUNT_ID, invalid === null ? null : ERROR_ID]
    .filter((value) => value !== null)
    .join(' ');
  return (
    <div className="cms-composition-field">
      <label htmlFor={PATTERN_SELECT_ID}>Pattern</label>
      <select
        id={PATTERN_SELECT_ID}
        value={selectedId ?? ''}
        disabled={disabled || count === 0}
        aria-invalid={invalid === null ? undefined : true}
        aria-describedby={describedBy}
        onChange={(event) =>
          onSelect(
            page.items.find(
              (item) => item.patternVersionId === event.target.value,
            ) ?? null,
          )
        }
      >
        <option value="">Choose a pattern</option>
        {page.items.map((item) => (
          <option key={item.patternVersionId} value={item.patternVersionId}>
            {patternLabel(item)}
          </option>
        ))}
      </select>
      <p id={COUNT_ID} role="status" aria-live="polite">
        {count} compatible {count === 1 ? 'pattern' : 'patterns'}
      </p>
      {count === 0 ? <p>No compatible pattern is active</p> : null}
      {invalid === null ? null : (
        <p id={ERROR_ID} className="cms-composition-error">
          {invalid}
        </p>
      )}
      {message === null ? null : (
        <p className="cms-composition-error" role="alert">
          {message}
        </p>
      )}
      {page.nextCursor === null ? null : (
        <button
          type="button"
          disabled={disabled || state.kind === 'loading'}
          onClick={onLoadMore}
        >
          Load more patterns
        </button>
      )}
    </div>
  );
}
