import * as React from 'react';

import { rateLimitMessage } from '../../lib/rate-limit-message';
import CmsLoadingRegion from '../cms-editorial-workflow/CmsLoadingRegion';
import type { NestablePattern } from './pattern-nestable-read';
import type { NestedPatternChoice } from './pattern-tree-nested';
import {
  useNestablePatterns,
  type NestableFailure,
  type ReadNestable,
} from './use-nestable-patterns';

export const NESTED_PICKER_NO_TYPES_REASON =
  'Choose at least one compatible content type to list the patterns that can be nested: a nested pattern must be compatible with every content type of this pattern.';
export const NESTED_PICKER_TREE_FULL_REASON =
  'The tree has no room for another top-level node, so a nested pattern cannot be added. Remove a node first.';
export const NESTED_PICKER_EMPTY =
  'No active pattern lists every content type of this pattern.';
const RESTART_NOTE =
  'The list of nestable patterns changed while you were loading it, so it restarted from the first page.';
const SELECT_ID = 'cms-pattern-nested-select';
const REASON_ID = 'cms-pattern-nested-reason';
const COUNT_ID = 'cms-pattern-nested-count';
const ERROR_ID = 'cms-pattern-nested-error';

export interface CmsPatternNestedPickerProps {
  /** The compatible content types of the pattern being designed (the request of cmsPatternNestableRead). */
  readonly typeIds: readonly string[];
  /** Whether the tree has room for another top-level node. */
  readonly canAdd: boolean;
  readonly onAdd: (choice: NestedPatternChoice) => void;
  /** Seam for a test. */
  readonly read?: ReadNestable | undefined;
}

const nodes = (count: number): string =>
  `${count} ${count === 1 ? 'node' : 'nodes'}`;
const optionLabel = (item: NestablePattern): string =>
  `${item.patternKey} version ${item.patternVersion} (${nodes(item.nodeCount)})`;

const failureMessage = ({
  status,
  retryAfterSeconds,
}: NestableFailure): string => {
  switch (status) {
    case 401:
      return 'Your session has ended. Sign in again to list the patterns you can nest.';
    case 403:
      return 'You do not hold the pattern designer capability, so the patterns you can nest cannot be listed.';
    case 404:
      return 'One of the content types of this pattern is not available to you, so the patterns you can nest cannot be listed.';
    case 429:
      return rateLimitMessage(retryAfterSeconds);
    case 400:
    case 422:
      return 'The list of patterns you can nest could not be requested. Reload the page and try again.';
    default:
      return 'The list of patterns you can nest could not be loaded.';
  }
};

/**
 * The nested-pattern picker of the pattern version designer (FE03 `CmsPatternVersionDesigner`, DEC-196, P2-S12-AC-105): the
 * active owner-scope pattern versions that list EVERY content type of the pattern being designed, read through the
 * designer-only `cmsPatternNestableRead`, as a native select that is never preselected. Choosing is an input to the tree, never
 * authority: the save re-proves the version is active and compatible, and refuses a cycle.
 */
export default function CmsPatternNestedPicker({
  typeIds,
  canAdd,
  onAdd,
  read,
}: CmsPatternNestedPickerProps): React.ReactElement {
  const { state, retry, loadMore } = useNestablePatterns(typeIds, read);
  const [selectedId, setSelectedId] = React.useState('');
  const selected =
    state.items.find((item) => item.patternVersionId === selectedId) ?? null;
  const listed = state.status === 'ready' || state.status === 'more_failed';
  const empty = state.status === 'ready' && state.items.length === 0;
  const reason =
    state.status === 'idle'
      ? NESTED_PICKER_NO_TYPES_REASON
      : empty
        ? NESTED_PICKER_EMPTY
        : null;
  const describedBy = [
    reason === null ? null : REASON_ID,
    listed ? COUNT_ID : null,
    state.failure === null ? null : ERROR_ID,
  ]
    .filter((id) => id !== null)
    .join(' ');
  const count = state.items.length;
  return (
    <div className="cms-pattern-nested-picker">
      <label htmlFor={SELECT_ID}>Add a nested pattern</label>
      <select
        id={SELECT_ID}
        value={selected === null ? '' : selected.patternVersionId}
        disabled={!listed || count === 0}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        onChange={(event) => setSelectedId(event.currentTarget.value)}
      >
        <option value="">Choose a pattern</option>
        {state.items.map((item) => (
          <option key={item.patternVersionId} value={item.patternVersionId}>
            {optionLabel(item)}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={selected === null || !canAdd}
        onClick={() => {
          if (selected === null) return;
          onAdd({
            patternId: selected.patternId,
            patternKey: selected.patternKey,
            patternVersion: selected.patternVersion,
          });
          setSelectedId('');
        }}
      >
        Add nested pattern
      </button>
      {reason === null ? null : <small id={REASON_ID}>{reason}</small>}
      {listed ? (
        <p id={COUNT_ID} role="status" aria-live="polite">
          {count} nestable {count === 1 ? 'pattern' : 'patterns'}
        </p>
      ) : null}
      {canAdd ? null : <small>{NESTED_PICKER_TREE_FULL_REASON}</small>}
      {state.failure === null ? null : (
        <p id={ERROR_ID} role="alert">
          {failureMessage(state.failure)}
        </p>
      )}
      <CmsLoadingRegion
        active={state.status === 'loading' || state.status === 'loading_more'}
        label="Loading nestable patterns…"
      />
      {state.restarted && state.status === 'ready' ? (
        <p role="status">{RESTART_NOTE}</p>
      ) : null}
      {state.status === 'failed' ? (
        <button type="button" onClick={retry}>
          Retry loading nestable patterns
        </button>
      ) : null}
      {listed && state.nextCursor !== null ? (
        <button type="button" onClick={loadMore}>
          Load more patterns
        </button>
      ) : null}
    </div>
  );
}
