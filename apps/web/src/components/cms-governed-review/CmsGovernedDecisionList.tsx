import type { GovernedReviewDetailResource } from '@wejammin/contracts';
import * as React from 'react';

import { GOVERNED_DECISION_LABEL } from './governed-review-labels';

interface Props {
  readonly headingId: string;
  readonly decisions: GovernedReviewDetailResource['decisions'];
}

/** The decisions as a semantic list that never names the decider and shows only the caller's own reason. */
export default function CmsGovernedDecisionList({
  headingId,
  decisions,
}: Props): React.ReactElement {
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} tabIndex={-1}>
        Decisions
      </h2>
      {decisions.length === 0 ? (
        <p>No decisions recorded yet.</p>
      ) : (
        <ul>
          {decisions.map((decision) => (
            <li key={decision.id} data-cms-review-decision="">
              {decision.mine ? 'Your decision' : 'Decision'}:{' '}
              {GOVERNED_DECISION_LABEL[decision.decision]} · Slot{' '}
              <code>{decision.capability}</code> ·{' '}
              <time dateTime={decision.decidedAt}>{decision.decidedAt}</time>
              {decision.reason === null ? null : (
                <>
                  <br />
                  Your reason: {decision.reason}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
