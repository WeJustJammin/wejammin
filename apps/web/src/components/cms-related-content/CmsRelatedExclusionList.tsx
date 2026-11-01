import * as React from 'react';

import CmsRelatedEntryLabel from './CmsRelatedEntryLabel';
import type { RelatedCandidate } from './related-candidates';
import {
  EXCLUSIONS_WIN_NOTE,
  TARGET_REFUSED_MESSAGE,
} from './related-content-copy';
import { MAX_EXCLUSIONS } from './related-content-lists';
import { entryName } from './related-format';

export const EXCLUSIONS_HEADING_ID = 'cms-related-exclusions-heading';

interface Props {
  readonly exclusions: readonly string[];
  readonly factsOf: (entryId: string) => RelatedCandidate | null;
  /** Whether the whole entry list was seen without this id (DEC-195). */
  readonly isUnavailable: (entryId: string) => boolean;
  readonly refused: ReadonlySet<number>;
  readonly onRemove: (entryId: string) => void;
}

/** The exclusions, with "exclusions win" stated beside the lists (FE03 :890). */
export default function CmsRelatedExclusionList({
  exclusions,
  factsOf,
  isUnavailable,
  refused,
  onRemove,
}: Props): React.ReactElement {
  const heading = React.useRef(false);
  React.useEffect(() => {
    if (!heading.current) return;
    heading.current = false;
    document.getElementById(EXCLUSIONS_HEADING_ID)?.focus();
  }, [exclusions]);
  return (
    <section
      aria-labelledby={EXCLUSIONS_HEADING_ID}
      className="cms-related-list"
    >
      <h2 id={EXCLUSIONS_HEADING_ID} tabIndex={-1}>
        Excluded entries
      </h2>
      <p>
        {exclusions.length} of {MAX_EXCLUSIONS} exclusions used.
      </p>
      <p className="cms-related-note">{EXCLUSIONS_WIN_NOTE}</p>
      {exclusions.length === 0 ? (
        <p>No entries are excluded.</p>
      ) : (
        <ul className="cms-related-rows">
          {exclusions.map((id, index) => (
            <li
              key={id}
              aria-describedby={
                refused.has(index)
                  ? `cms-related-exclusion-refusal-${index}`
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
                  aria-label={`Remove exclusion ${entryName(id)}`}
                  onClick={() => {
                    heading.current = true;
                    onRemove(id);
                  }}
                >
                  Remove exclusion
                </button>
              </div>
              {refused.has(index) ? (
                <p
                  id={`cms-related-exclusion-refusal-${index}`}
                  className="cms-related-refusal"
                >
                  {TARGET_REFUSED_MESSAGE}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
