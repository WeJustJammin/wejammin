import * as React from 'react';

import CmsDiffNewRoots from './CmsDiffNewRoots';
import CmsDiffPath, { choiceRadioId } from './CmsDiffPath';
import { collisions, firstUnanswered } from './composition-choices';
import type { Choice, ChoiceMap, UpdateDiff } from './composition-types';

export interface CmsPatternUpdateDiffProps {
  readonly diff: UpdateDiff;
  /** The author's answers, held in memory only (never cached, never in a URL). */
  readonly choices: ChoiceMap;
  readonly onChoose: (path: string, choice: Choice) => void;
  readonly onAccept: () => void;
  readonly onDetach: () => void;
  readonly onPlaceNewRoots: (rootPaths: readonly string[]) => void;
  readonly busy: boolean;
  readonly disabled: boolean;
}

export const DIFF_HEADING_ID = 'cms-diff-heading';
const NO_UPDATE_ID = 'cms-diff-no-update';

/**
 * CMS-03C-14 and -15 (FE03 887, 1115; P2-S12-AC-117, AC-123): one instance's three-way diff with a radio pair per
 * collision that is never preselected. Accept sends only when every collision has an answer; otherwise it names the
 * count and moves focus to the first unanswered one. Nothing is accepted automatically.
 */
export default function CmsPatternUpdateDiff({
  diff,
  choices,
  onChoose,
  onAccept,
  onDetach,
  onPlaceNewRoots,
  busy,
  disabled,
}: CmsPatternUpdateDiffProps): React.ReactElement {
  const [refused, setRefused] = React.useState(false);
  const missing = collisions(diff).filter(
    (entry) => choices[entry.path] === undefined,
  ).length;
  const hasNewer =
    diff.targetPatternVersion > diff.instance.pinnedPatternVersion;
  const blocked = busy || disabled;

  const accept = (): void => {
    const first = firstUnanswered(diff, choices);
    if (first === null) {
      setRefused(false);
      onAccept();
      return;
    }
    setRefused(true);
    const index = diff.paths.findIndex((entry) => entry.path === first);
    document.getElementById(choiceRadioId(index, 'yours'))?.focus();
  };

  return (
    <section aria-labelledby={DIFF_HEADING_ID} className="cms-diff">
      <h3 id={DIFF_HEADING_ID} tabIndex={-1}>
        Update for <code>{diff.instance.path}</code>
      </h3>
      <p>
        Pinned to pattern version {diff.instance.pinnedPatternVersion}
        {hasNewer
          ? `; version ${diff.targetPatternVersion} is available.`
          : '.'}
      </p>
      {hasNewer ? null : (
        <p id={NO_UPDATE_ID}>No newer compatible pattern version.</p>
      )}
      {hasNewer && diff.paths.length === 0 ? (
        <p>No changes to this block.</p>
      ) : null}
      {diff.paths.length > 0 ? (
        <>
          <p data-diff-count aria-live="polite" role="status">
            {diff.paths.length} changed{' '}
            {diff.paths.length === 1 ? 'path' : 'paths'}, {diff.collisionCount}{' '}
            {diff.collisionCount === 1 ? 'collision' : 'collisions'}
          </p>
          <ul className="cms-diff-paths">
            {diff.paths.map((entry, index) => (
              <CmsDiffPath
                key={entry.path}
                entry={entry}
                index={index}
                choice={choices[entry.path]}
                onChoose={onChoose}
                disabled={disabled}
              />
            ))}
          </ul>
        </>
      ) : null}
      {diff.newRoots.length > 0 ? (
        <CmsDiffNewRoots
          roots={diff.newRoots}
          onPlace={onPlaceNewRoots}
          disabled={blocked}
        />
      ) : null}
      {refused && missing > 0 ? (
        <p role="alert" className="cms-composition-error">
          {missing} {missing === 1 ? 'collision needs' : 'collisions need'} an
          answer before this update can be accepted.
        </p>
      ) : null}
      <p>
        An unanswered update leaves this instance on its pinned version. Nothing
        is accepted automatically.
      </p>
      <p>
        Detaching makes this block a local copy that no longer receives updates.
      </p>
      <div className="cms-composition-actions">
        <button
          type="button"
          disabled={blocked || !hasNewer}
          aria-describedby={hasNewer ? undefined : NO_UPDATE_ID}
          onClick={accept}
        >
          Accept update
        </button>
        <button type="button" disabled={blocked} onClick={onDetach}>
          Detach as a local copy
        </button>
      </div>
    </section>
  );
}
