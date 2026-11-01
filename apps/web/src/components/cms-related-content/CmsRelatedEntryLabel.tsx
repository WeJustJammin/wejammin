import * as React from 'react';

import type { RelatedCandidate } from './related-candidates';
import { UNAVAILABLE_ENTRY_NOTE } from './related-content-copy';
import { formatInstant } from './related-format';

interface Props {
  readonly entryId: string;
  /** The facts of the list row, or null for an entry the loaded pages do not show. */
  readonly facts: RelatedCandidate | null;
  /**
   * True when the whole list of entries the person can open was seen without this id: the entry is hidden,
   * gone or no longer theirs to open (DEC-195). It stays in the rule until they remove it.
   */
  readonly unavailable?: boolean;
}

/** An entry as the list can describe it: its id, which has no title, and the facts the list carries. */
export default function CmsRelatedEntryLabel({
  entryId,
  facts,
  unavailable = false,
}: Props): React.ReactElement {
  return (
    <span className="cms-related-entry">
      <code>{entryId}</code>
      {unavailable ? (
        <small>
          <strong>Unavailable entry.</strong> {UNAVAILABLE_ENTRY_NOTE}
        </small>
      ) : facts === null ? null : (
        <small>
          {facts.locale}, {facts.state}, {facts.lifecycle}, updated{' '}
          <time dateTime={facts.updatedAt}>
            {formatInstant(facts.updatedAt)}
          </time>
        </small>
      )}
    </span>
  );
}
