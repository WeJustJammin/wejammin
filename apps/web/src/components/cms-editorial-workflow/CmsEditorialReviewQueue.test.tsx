import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsEditorialReviewQueue from './CmsEditorialReviewQueue';
import {
  queueItem,
  queuePageFixture,
} from './cms-workflow-fixtures.test-support';

const ROUTE = '/app/cms-content-modeling/reviews';

const render = (
  page = queuePageFixture([queueItem(1), queueItem(2)]),
  query: Record<string, string> = {},
  announcement: string | null = null,
): string =>
  renderToStaticMarkup(
    <CmsEditorialReviewQueue
      page={page}
      routePath={ROUTE}
      query={query}
      announcement={announcement}
    />,
  );

describe('CmsEditorialReviewQueue (CMS-03B-17)', () => {
  it('names its heading as a focus target and offers the two scopes as native links', () => {
    const html = render();
    expect(html).toContain(
      '<h2 id="review-queue-title" tabindex="-1">Reviews</h2>',
    );
    expect(html).toContain('aria-label="Review scope"');
    expect(html).toContain(`href="${ROUTE}?scope=assigned#review-queue-title"`);
    expect(html).toContain(
      `href="${ROUTE}?scope=submitted#review-queue-title"`,
    );
    expect(html).toContain('aria-current="page"');
  });

  it('marks the active scope and keeps the state filter when the scope changes', () => {
    const html = render(undefined, {
      scope: 'submitted',
      state: 'open',
      cursor: 'abc',
    });
    expect(html).toMatch(
      /<a[^>]*aria-current="page"[^>]*>Submitted by me<\/a>/u,
    );
    expect(html).not.toMatch(
      /<a[^>]*aria-current="page"[^>]*>Assigned to me<\/a>/u,
    );
    expect(html).toContain(
      `href="${ROUTE}?scope=assigned&amp;state=open#review-queue-title"`,
    );
    expect(html).not.toContain('cursor=abc#');
  });

  it('filters with a native GET form that carries the scope and the closed state options', () => {
    const html = render(undefined, { scope: 'submitted' });
    expect(html).toContain('method="get"');
    expect(html).toContain(`action="${ROUTE}#review-queue-title"`);
    expect(html).toContain(
      '<input type="hidden" name="scope" value="submitted"/>',
    );
    for (const state of ['open', 'approved', 'rejected', 'invalidated'])
      expect(html).toContain(`value="${state}"`);
    expect(html).toContain('for="review-state-filter"');
    expect(html).toContain('Filter reviews');
  });

  it('lists each review as a native link with state, risk, counts and the caller decision as text', () => {
    const html = render(
      queuePageFixture([
        queueItem(1, {
          riskClass: 'protected',
          requiredDecisionCount: 2,
          recordedDecisionCount: 1,
          myDecision: 'approve',
        }),
      ]),
    );
    expect(html).toContain(
      'href="/app/cms-content-modeling/reviews/123e4567-e89b-42d3-a456-426614175001"',
    );
    expect(html).toContain('Press release');
    expect(html).toContain('Revision 1 (en-US)');
    expect(html).toContain('State: Open');
    expect(html).toContain('Risk class: protected');
    expect(html).toContain('1 of 2 decisions');
    expect(html).toContain('Your decision: approve');
    expect(html).toContain('<time dateTime="2026-10-09T12:00:00Z">');
  });

  it('says none for a review the caller has not decided and omits an absent assignment end', () => {
    const html = render(
      queuePageFixture([queueItem(1, { assignmentEndsAt: null })]),
      { scope: 'submitted' },
    );
    expect(html).toContain('Your decision: none');
    expect(html).not.toContain('Assignment ends');
  });

  it('announces the count politely', () => {
    expect(render()).toMatch(
      /role="status"[^>]*aria-live="polite"[^>]*>2 reviews loaded\./u,
    );
    expect(render(queuePageFixture([queueItem(1)]))).toContain(
      '1 review loaded.',
    );
    expect(
      render(
        undefined,
        {},
        'The list changed, so it restarted from the first page.',
      ),
    ).toContain(
      'The list changed, so it restarted from the first page. 2 reviews loaded.',
    );
  });

  it('distinguishes no records from a filter that matches nothing, each with one action', () => {
    const assigned = render(queuePageFixture([]));
    expect(assigned).toContain('You have no reviews assigned to you.');
    expect(assigned).toContain(
      `href="${ROUTE}?scope=submitted#review-queue-title"`,
    );
    expect(assigned).toContain('See reviews you submitted');
    const submitted = render(queuePageFixture([]), { scope: 'submitted' });
    expect(submitted).toContain('You have not submitted any reviews.');
    expect(submitted).toContain('href="/app/cms-content-modeling/entries"');
    const miss = render(queuePageFixture([]), {
      scope: 'assigned',
      state: 'rejected',
    });
    expect(miss).toContain('No reviews match this state.');
    expect(miss).toContain(`href="${ROUTE}?scope=assigned#review-queue-title"`);
    expect(miss).toContain('Reset the filter');
  });

  it('continues with the signed cursor in the URL and nothing else protected', () => {
    const html = render(queuePageFixture([queueItem(1)], 'signed.cursor-1'), {
      scope: 'assigned',
      state: 'open',
    });
    expect(html).toContain('aria-label="Review queue pages"');
    expect(html).toContain(
      `href="${ROUTE}?scope=assigned&amp;state=open&amp;cursor=signed.cursor-1#review-queue-title"`,
    );
    expect(render()).not.toContain('Next page');
  });

  it('shows no entry, revision or person identifier in text', () => {
    const html = render();
    expect(html).not.toContain('123e4567-e89b-42d3-a456-426614174002');
    expect(html).not.toContain('123e4567-e89b-42d3-a456-426614174003');
  });
});
