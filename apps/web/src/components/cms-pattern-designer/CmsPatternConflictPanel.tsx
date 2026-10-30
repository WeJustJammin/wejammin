import * as React from 'react';

import CmsLoadingRegion from '../cms-editorial-workflow/CmsLoadingRegion';

import CmsPatternReview from './CmsPatternReview';
import type { PatternDesignerContext } from './pattern-designer-request';
import type { EditableTree } from './pattern-tree-state';
import type { PatternLatestDetail } from './pattern-latest-read';
import type { PatternConflictState } from './use-pattern-conflict';

interface Props {
  readonly state: PatternConflictState;
  /** The last verified latest version (kept while a re-read runs or after one failed), or null. */
  readonly verified: PatternLatestDetail | null;
  /** The version the unsent edits are based on, or null for a first version. */
  readonly baseVersion: string | null;
  /** The latest version is newer than the base and may be adopted (decided by the hook). */
  readonly newer: boolean;
  /** A 429's stated wait has not elapsed (FE03 :1172): the check stays off. */
  readonly waiting: boolean;
  /** The unsent form, shown beside the newer version. */
  readonly draftTree: EditableTree;
  readonly draftTypeIds: readonly string[];
  readonly context: PatternDesignerContext;
  readonly onCheck: () => void;
  readonly onRebase: () => void;
  readonly onDiscard: () => void;
}

/** After a conflict: compare with the latest version and choose, never overwrite. */
export default function CmsPatternConflictPanel({
  state,
  verified,
  baseVersion,
  newer,
  waiting,
  draftTree,
  draftTypeIds,
  context,
  onCheck,
  onRebase,
  onDiscard,
}: Props): React.ReactElement {
  const latest = verified;
  return (
    <section
      aria-labelledby="cms-pattern-conflict-title"
      className="cms-pattern-conflict"
    >
      <h3 id="cms-pattern-conflict-title">Compare with the latest version</h3>
      <button
        type="button"
        disabled={state.kind === 'checking' || waiting}
        onClick={onCheck}
      >
        {state.kind === 'checking'
          ? 'Checking latest version…'
          : 'Check latest version'}
      </button>
      <CmsLoadingRegion
        active={state.kind === 'checking'}
        label="Checking the latest version…"
      />
      {/* Mounted empty with the panel so a 429 is announced when its text arrives (FE03 :1172). */}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-cms-pattern-rate-limit=""
      >
        {state.kind === 'failed' && state.rateLimited === true
          ? state.message
          : ''}
      </p>
      {state.kind === 'failed' && state.rateLimited !== true ? (
        <p role="alert">{state.message}</p>
      ) : null}
      {latest !== null ? (
        <>
          <p>
            Latest saved version: {latest.version}, {latest.nodeCount}{' '}
            {latest.nodeCount === 1 ? 'node' : 'nodes'}, {latest.state}. Your
            unsent tree is based on{' '}
            {baseVersion === null
              ? 'no earlier version'
              : `version ${baseVersion}`}{' '}
            and is still in the form.
          </p>
          {newer && latest !== null ? (
            <>
              <CmsPatternReview
                latest={latest}
                draftTree={draftTree}
                draftTypeIds={draftTypeIds}
                context={context}
              />
              <button
                type="button"
                disabled={state.kind === 'checking'}
                onClick={onRebase}
              >
                Keep my edits and base them on version {latest.version}
              </button>
              <button
                type="button"
                disabled={state.kind === 'checking'}
                onClick={onDiscard}
              >
                Discard my edits and load version {latest.version}
              </button>
              <p>
                Basing your edits on version {latest.version} replaces nothing
                in it with your tree until you save; it does not merge the newer
                version into your tree.
              </p>
            </>
          ) : (
            <p>
              The version you started from is still the latest. Review your tree
              before saving again.
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}
