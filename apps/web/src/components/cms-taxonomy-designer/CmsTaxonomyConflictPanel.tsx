import * as React from 'react';

import CmsLoadingRegion from '../cms-editorial-workflow/CmsLoadingRegion';
import { LIFECYCLE_LABEL } from './CmsTaxonomyVersionFacts';
import { reviewRows, type DraftRules } from './taxonomy-review-outline';
import type { TaxonomyVersionFacts } from './taxonomy-versions-read';
import type { TaxonomyConflictState } from './use-taxonomy-conflict';

interface Props {
  readonly state: TaxonomyConflictState;
  /** The last verified latest version (kept while a re-read runs or after one failed), or null. */
  readonly verified: TaxonomyVersionFacts | null;
  /** The version the unsent edits are based on. */
  readonly baseVersion: string | null;
  /** The latest version is newer than the base and may be adopted (decided by the hook). */
  readonly newer: boolean;
  /** The unsent form, shown beside the newer version. */
  readonly draft: DraftRules;
  readonly onCheck: () => void;
  readonly onRebase: () => void;
  readonly onDiscard: () => void;
}

/** After a conflict: compare with the latest version and choose, never overwrite. */
export default function CmsTaxonomyConflictPanel({
  state,
  verified,
  baseVersion,
  newer,
  draft,
  onCheck,
  onRebase,
  onDiscard,
}: Props): React.ReactElement {
  const latest = verified;
  return (
    <section
      aria-labelledby="cms-taxonomy-conflict-title"
      className="cms-taxonomy-conflict"
    >
      <h3 id="cms-taxonomy-conflict-title">Compare with the latest version</h3>
      <button
        type="button"
        disabled={state.kind === 'checking'}
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
      {state.kind === 'failed' ? <p role="alert">{state.message}</p> : null}
      {latest === null ? null : (
        <>
          <p>
            Latest saved version: {latest.version},{' '}
            {LIFECYCLE_LABEL[latest.state].toLowerCase()}. Your unsent entries
            are based on{' '}
            {baseVersion === null
              ? 'no earlier version'
              : `version ${baseVersion}`}{' '}
            and are still in the form.
          </p>
          {newer ? (
            <>
              <ul className="cms-taxonomy-review">
                {reviewRows(draft, latest).map((row) => (
                  <li key={row.setting}>
                    <h4>{row.setting}</h4>
                    <p>Your unsent draft: {row.yours}</p>
                    <p>
                      Version {latest.version}: {row.latest}
                    </p>
                    <p>
                      {row.difference === 'Same'
                        ? 'Same in both.'
                        : row.difference}
                    </p>
                  </li>
                ))}
              </ul>
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
                Basing your edits on version {latest.version} changes nothing in
                it until you save; it does not merge the newer version into your
                entries.
              </p>
            </>
          ) : (
            <p>
              The version you started from is still the latest. Review your
              entries before saving again.
            </p>
          )}
        </>
      )}
    </section>
  );
}
