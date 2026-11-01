import * as React from 'react';

import type { RelatedConflictReviewState } from './related-content-types';
import { reviewStateCopy } from './related-status-copy';

interface Props {
  readonly state: RelatedConflictReviewState;
  readonly waiting: boolean;
  readonly pending: boolean;
  readonly reapplyBlocked: boolean;
  readonly returnTo: string;
  readonly onReview: () => void;
  readonly onReapply: () => void;
}

/** The verified server snapshot stays beside the independently editable local draft. */
export default function CmsRelatedConflictReview({
  state,
  waiting,
  pending,
  reapplyBlocked,
  returnTo,
  onReview,
  onReapply,
}: Props): React.ReactElement {
  const snapshot = state.kind === 'reviewed' ? state.snapshot : null;
  const rule = snapshot?.rule ?? null;
  return (
    <section aria-label="Related content conflict review">
      <p role="status">{reviewStateCopy(state)}</p>
      <button
        type="button"
        disabled={pending || waiting || state.kind === 'reading'}
        onClick={onReview}
      >
        Review changes
      </button>
      {snapshot === null ? null : (
        <section aria-labelledby="cms-related-server-heading">
          <h3 id="cms-related-server-heading">Current server state</h3>
          <dl className="cms-related-facts">
            <div>
              <dt>Reviewed draft entry version</dt>
              <dd>{snapshot.draft.entry.version}</dd>
            </div>
            <div>
              <dt>Locale</dt>
              <dd>{snapshot.draft.locale}</dd>
            </div>
            <div>
              <dt>Lifecycle</dt>
              <dd>{snapshot.draft.lifecycle}</dd>
            </div>
            <div>
              <dt>Revision state</dt>
              <dd>{snapshot.draft.state}</dd>
            </div>
            <div>
              <dt>Reapply entry version</dt>
              <dd>{snapshot.expectedVersion}</dd>
            </div>
          </dl>
          {rule === null ? (
            <p>No related-content rule is saved.</p>
          ) : (
            <>
              <p>
                Saved rule entry version: {rule.version}. Eligible entries:{' '}
                {rule.eligibleCount}.
              </p>
              <h4>Saved pins, in order</h4>
              {rule.pins.length === 0 ? (
                <p>No saved pins.</p>
              ) : (
                <ol>
                  {rule.pins.map((id) => (
                    <li key={id}>
                      <code>{id}</code>
                    </li>
                  ))}
                </ol>
              )}
              <h4>Saved exclusions</h4>
              {rule.exclusions.length === 0 ? (
                <p>No saved exclusions.</p>
              ) : (
                <ul>
                  {rule.exclusions.map((id) => (
                    <li key={id}>
                      <code>{id}</code>
                    </li>
                  ))}
                </ul>
              )}
              {rule.derivedRule === null ? (
                <p>No saved derived rule.</p>
              ) : (
                <p>
                  Saved derived rule: <code>{rule.derivedRule.key}</code>,
                  version {rule.derivedRule.version}. Its candidate bound is
                  unavailable in this read. Your entered bound is kept.
                </p>
              )}
            </>
          )}
          <p>
            Your choices below are kept. Reapply sends those choices against the
            reviewed entry version.
          </p>
          <button
            type="button"
            disabled={pending || reapplyBlocked}
            onClick={onReapply}
          >
            Reapply my choices
          </button>{' '}
          <a href={returnTo}>Discard my choices and reload</a>
        </section>
      )}
    </section>
  );
}
