import {
  ReviewQueueScopeSchema,
  type ReviewQueuePage,
} from '@wejammin/contracts';
import * as React from 'react';

import { REVIEW_STATE_LABEL } from './cms-workflow-labels';

export interface CmsEditorialReviewQueueProps {
  readonly page: ReviewQueuePage;
  readonly routePath: string;
  /** The request's URL-owned state: scope, state filter, limit and the signed cursor. */
  readonly query: Readonly<Record<string, string>>;
  /** A polite announcement (for example that the list restarted), if any. */
  readonly announcement?: string | null;
}

const ANCHOR = '#review-queue-title';
const STATES = ['open', 'approved', 'rejected', 'invalidated'] as const;

/** A route to the queue with exactly these members, never a cursor. */
const withMembers = (
  routePath: string,
  members: Readonly<Record<string, string>>,
): string => {
  const params = new URLSearchParams(members);
  return `${routePath}?${params.toString()}${ANCHOR}`;
};

/**
 * The CMS-03B-17 reviewer queue (server-rendered, never optimistic): the two
 * scopes as native links, a native GET state filter, a polite count, one native
 * link per review with its state, risk class, decision counts and the caller's
 * own decision as text, and a URL-owned signed continuation. Empty is two
 * states, each with one action: nothing in the scope, or a filter that excludes
 * every row. Nothing here names a person, an entry or a revision identifier.
 */
export default function CmsEditorialReviewQueue({
  page,
  routePath,
  query,
  announcement = null,
}: CmsEditorialReviewQueueProps): React.ReactElement {
  const parsedScope = ReviewQueueScopeSchema.safeParse(query.scope);
  const scope = parsedScope.success ? parsedScope.data : 'assigned';
  const state = query.state ?? '';
  const filtered = state !== '';
  const count = page.items.length;
  const scopeLink = (target: 'assigned' | 'submitted'): string =>
    withMembers(
      routePath,
      filtered ? { scope: target, state } : { scope: target },
    );
  const next =
    page.nextCursor === null
      ? null
      : `${routePath}?${new URLSearchParams({
          scope,
          ...(filtered ? { state } : {}),
          cursor: page.nextCursor,
        }).toString()}${ANCHOR}`;
  return (
    <section aria-labelledby="review-queue-title">
      <h2 id="review-queue-title" tabIndex={-1}>
        Reviews
      </h2>
      <nav aria-label="Review scope">
        <a
          href={scopeLink('assigned')}
          {...(scope === 'assigned' ? { 'aria-current': 'page' as const } : {})}
        >
          Assigned to me
        </a>{' '}
        <a
          href={scopeLink('submitted')}
          {...(scope === 'submitted'
            ? { 'aria-current': 'page' as const }
            : {})}
        >
          Submitted by me
        </a>
      </nav>
      <form
        method="get"
        action={`${routePath}${ANCHOR}`}
        aria-label="Filter reviews"
      >
        <input type="hidden" name="scope" value={scope} />
        <label htmlFor="review-state-filter">State</label>
        <select id="review-state-filter" name="state" defaultValue={state}>
          <option value="">All states</option>
          {STATES.map((value) => (
            <option key={value} value={value}>
              {REVIEW_STATE_LABEL[value]}
            </option>
          ))}
        </select>
        <button type="submit">Filter reviews</button>
      </form>
      <p role="status" aria-live="polite" aria-atomic="true">
        {announcement === null ? '' : `${announcement} `}
        {count === 0
          ? filtered
            ? 'No reviews match this state.'
            : scope === 'assigned'
              ? 'You have no reviews assigned to you.'
              : 'You have not submitted any reviews.'
          : `${count} ${count === 1 ? 'review' : 'reviews'} loaded.`}
      </p>
      {count === 0 ? (
        <p>
          {filtered ? (
            <a href={withMembers(routePath, { scope })}>Reset the filter</a>
          ) : scope === 'assigned' ? (
            <a href={withMembers(routePath, { scope: 'submitted' })}>
              See reviews you submitted
            </a>
          ) : (
            <a href="/app/cms-content-modeling/entries">Go to your entries</a>
          )}
        </p>
      ) : (
        <ul>
          {page.items.map((item) => (
            <li key={item.reviewId}>
              <a href={`${routePath}/${encodeURIComponent(item.reviewId)}`}>
                {item.contentTypeLabel}
              </a>
              <br />
              Revision {item.revisionNumber} ({item.locale}) · State:{' '}
              {REVIEW_STATE_LABEL[item.state]} · Risk class: {item.riskClass} ·{' '}
              {item.recordedDecisionCount} of {item.requiredDecisionCount}{' '}
              decisions · Your decision: {item.myDecision}
              {item.assignmentEndsAt === null ? null : (
                <>
                  {' '}
                  · Assignment ends{' '}
                  <time dateTime={item.assignmentEndsAt}>
                    {item.assignmentEndsAt}
                  </time>
                </>
              )}
              {' · Updated '}
              <time dateTime={item.updatedAt}>{item.updatedAt}</time>
            </li>
          ))}
        </ul>
      )}
      {next === null ? null : (
        <nav aria-label="Review queue pages">
          <a href={next}>Next page</a>
        </nav>
      )}
    </section>
  );
}
