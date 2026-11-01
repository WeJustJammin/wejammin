import type {
  GovernedReviewQueuePage,
  GovernedReviewState,
  GovernedSubjectKind,
} from '@wejammin/contracts';
import * as React from 'react';

import {
  GOVERNED_MY_DECISION_LABEL,
  GOVERNED_RISK_CLASS_LABEL,
  GOVERNED_SUBJECT_KIND_LABEL,
} from './governed-review-labels';
import { GOVERNED_REVIEW_STATE_LABEL } from './governed-state-labels';

export interface CmsGovernedReviewQueueProps {
  readonly page: GovernedReviewQueuePage;
  readonly routePath: string;
  /** The request's URL-owned state: scope, filters, limit and the signed cursor. */
  readonly query: Readonly<Record<string, string>>;
  /** A polite announcement (for example that the list restarted), if any. */
  readonly announcement?: string | null;
}

export const GOVERNED_QUEUE_HEADING_ID = 'governed-queue-title';
const ANCHOR = `#${GOVERNED_QUEUE_HEADING_ID}`;
const SCOPES = [
  ['assigned', 'Assigned to me'],
  ['submitted', 'Submitted by me'],
  ['owned', 'On versions I own'],
] as const;
type Scope = (typeof SCOPES)[number][0];
const STATES = Object.keys(
  GOVERNED_REVIEW_STATE_LABEL,
) as GovernedReviewState[];
const KINDS = Object.keys(GOVERNED_SUBJECT_KIND_LABEL) as GovernedSubjectKind[];

const EMPTY_SCOPE: Readonly<Record<Scope, string>> = {
  assigned: 'No definition reviews are assigned to you.',
  submitted: 'You have not submitted any definition reviews.',
  owned: 'No definition reviews are open on versions you own.',
};

const isScope = (value: string | undefined): value is Scope =>
  SCOPES.some(([scope]) => scope === value);

/** A route to the queue with exactly these members, never a cursor. */
const withMembers = (
  routePath: string,
  members: Readonly<Record<string, string>>,
): string => `${routePath}?${new URLSearchParams(members).toString()}${ANCHOR}`;

/**
 * The CMS-03C-11 definition-review queue (server-rendered, never optimistic):
 * three scopes as native links, a native GET filter form, a polite count, one
 * native link per review with its state, risk class, decision counts and the
 * caller's own decision as text, and a URL-owned signed continuation. Empty is
 * two states, each with one action: nothing in the scope, or filters that exclude
 * every row. Nothing here names a person, a party or a content hash.
 */
export default function CmsGovernedReviewQueue({
  page,
  routePath,
  query,
  announcement = null,
}: CmsGovernedReviewQueueProps): React.ReactElement {
  const scope: Scope = isScope(query.scope) ? query.scope : 'assigned';
  const filters: Record<string, string> = {};
  for (const key of ['state', 'subjectKind', 'limit'] as const) {
    const value = query[key];
    if (value !== undefined && value !== '') filters[key] = value;
  }
  const filtered =
    filters.state !== undefined || filters.subjectKind !== undefined;
  const count = page.items.length;
  const next =
    page.nextCursor === null
      ? null
      : withMembers(routePath, { scope, ...filters, cursor: page.nextCursor });
  return (
    <section aria-labelledby={GOVERNED_QUEUE_HEADING_ID}>
      <h2 id={GOVERNED_QUEUE_HEADING_ID} tabIndex={-1}>
        Definition reviews
      </h2>
      <nav aria-label="Review scope">
        {SCOPES.map(([target, label]) => (
          <React.Fragment key={target}>
            <a
              href={withMembers(routePath, { scope: target, ...filters })}
              {...(scope === target ? { 'aria-current': 'page' as const } : {})}
            >
              {label}
            </a>{' '}
          </React.Fragment>
        ))}
      </nav>
      <form
        method="get"
        action={`${routePath}${ANCHOR}`}
        aria-label="Filter reviews"
      >
        <input type="hidden" name="scope" value={scope} />
        <label htmlFor="governed-state-filter">State</label>
        <select
          id="governed-state-filter"
          name="state"
          defaultValue={filters.state ?? ''}
        >
          <option value="">All states</option>
          {STATES.map((value) => (
            <option key={value} value={value}>
              {GOVERNED_REVIEW_STATE_LABEL[value]}
            </option>
          ))}
        </select>
        <label htmlFor="governed-kind-filter">Kind</label>
        <select
          id="governed-kind-filter"
          name="subjectKind"
          defaultValue={filters.subjectKind ?? ''}
        >
          <option value="">All kinds</option>
          {KINDS.map((value) => (
            <option key={value} value={value}>
              {GOVERNED_SUBJECT_KIND_LABEL[value]}
            </option>
          ))}
        </select>
        <button type="submit">Filter reviews</button>
      </form>
      <p role="status" aria-live="polite" aria-atomic="true">
        {announcement === null ? '' : `${announcement} `}
        {count === 0
          ? filtered
            ? 'No reviews match these filters.'
            : EMPTY_SCOPE[scope]
          : `${count} ${count === 1 ? 'review' : 'reviews'} loaded.`}
      </p>
      {count === 0 ? (
        <p>
          {filtered ? (
            <a href={withMembers(routePath, { scope })}>Reset the filters</a>
          ) : scope === 'assigned' ? (
            <a href={withMembers(routePath, { scope: 'submitted' })}>
              See reviews you submitted
            </a>
          ) : (
            <a href="/app/cms-content-modeling">Go to content modeling</a>
          )}
        </p>
      ) : (
        <ul>
          {page.items.map((item) => (
            <li key={item.reviewId}>
              <a href={`${routePath}/${encodeURIComponent(item.reviewId)}`}>
                {GOVERNED_SUBJECT_KIND_LABEL[item.subjectKind]}{' '}
                {item.subjectKey}, version {item.subjectVersion}
              </a>
              <br />
              State: {GOVERNED_REVIEW_STATE_LABEL[item.state]} · Risk class:{' '}
              {GOVERNED_RISK_CLASS_LABEL[item.riskClass]} ·{' '}
              {item.recordedDecisionCount} of {item.requiredDecisionCount}{' '}
              decisions · Your decision:{' '}
              {GOVERNED_MY_DECISION_LABEL[item.myDecision]}
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
