import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { GovernedReviewQueuePageSchema } from '@wejammin/contracts';

import {
  governedQueueItem,
  governedQueuePageFixture,
  HASH_A,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedReviewQueue from './CmsGovernedReviewQueue';

const ROUTE = '/app/cms-content-modeling/definition-reviews';
const ANCHOR = '#governed-queue-title';

const render = (
  page = governedQueuePageFixture([governedQueueItem(1), governedQueueItem(2)]),
  query: Record<string, string> = {},
  announcement: string | null = null,
): string =>
  renderToStaticMarkup(
    <CmsGovernedReviewQueue
      page={page}
      routePath={ROUTE}
      query={query}
      announcement={announcement}
    />,
  );

describe('CmsGovernedReviewQueue (CMS-03C-11)', () => {
  it('names its heading as a focus target and offers the three scopes as native links', () => {
    const html = render();
    expect(html).toContain(
      '<h2 id="governed-queue-title" tabindex="-1">Definition reviews</h2>',
    );
    expect(html).toContain('aria-label="Review scope"');
    for (const scope of ['assigned', 'submitted', 'owned'])
      expect(html).toContain(`href="${ROUTE}?scope=${scope}${ANCHOR}"`);
    expect(html).toContain('Assigned to me');
    expect(html).toContain('Submitted by me');
    expect(html).toContain('On versions I own');
  });

  it('marks the active scope and keeps the filters, never the cursor, when the scope changes', () => {
    const html = render(undefined, {
      scope: 'owned',
      state: 'open',
      subjectKind: 'pattern_version',
      limit: '10',
      cursor: 'abc',
    });
    expect(html).toMatch(
      /<a[^>]*aria-current="page"[^>]*>On versions I own<\/a>/u,
    );
    expect(html).not.toMatch(
      /<a[^>]*aria-current="page"[^>]*>Assigned to me<\/a>/u,
    );
    expect(html).toContain(
      `href="${ROUTE}?scope=assigned&amp;state=open&amp;subjectKind=pattern_version&amp;limit=10${ANCHOR}"`,
    );
    expect(html).not.toContain('cursor=abc#');
  });

  it('treats an unknown scope in the URL as the default assigned scope', () => {
    const html = render(undefined, { scope: 'everyone' });
    expect(html).toMatch(
      /<a[^>]*aria-current="page"[^>]*>Assigned to me<\/a>/u,
    );
  });

  it('filters with a native GET form carrying the scope and the closed state and kind options', () => {
    const html = render(undefined, { scope: 'submitted', state: 'approved' });
    expect(html).toContain('method="get"');
    expect(html).toContain(`action="${ROUTE}${ANCHOR}"`);
    expect(html).toContain(
      '<input type="hidden" name="scope" value="submitted"/>',
    );
    for (const label of ['Open', 'Approved', 'Rejected', 'Invalidated'])
      expect(html).toContain(`>${label}</option>`);
    for (const label of ['Template', 'Pattern', 'Vocabulary'])
      expect(html).toContain(`>${label}</option>`);
    expect(html).toContain('<label for="governed-state-filter">State</label>');
    expect(html).toContain('<label for="governed-kind-filter">Kind</label>');
    expect(html).toContain('Filter reviews');
  });

  it('shows one native link per review with its facts as text', () => {
    const html = render(
      governedQueuePageFixture([
        governedQueueItem(1, {
          subjectKind: 'taxonomy_version',
          subjectKey: 'gear-list',
          subjectVersion: 3,
          riskClass: 'protected',
          requiredDecisionCount: 2,
          recordedDecisionCount: 1,
          myDecision: 'approve',
        }),
      ]),
    );
    expect(html).toContain(
      `<a href="${ROUTE}/123e4567-e89b-42d3-a456-426614176001">Vocabulary gear-list, version 3</a>`,
    );
    expect(html).toContain('State: Open');
    expect(html).toContain('Risk class: Protected');
    expect(html).toContain('1 of 2 decisions');
    expect(html).toContain('Your decision: Approved');
    expect(html).toContain('Assignment ends');
    expect(html).toContain('<time dateTime=');
  });

  it('announces the count politely and singularly', () => {
    expect(render()).toContain('2 reviews loaded.');
    expect(render(governedQueuePageFixture([governedQueueItem(1)]))).toContain(
      '1 review loaded.',
    );
    expect(render()).toContain(
      'role="status" aria-live="polite" aria-atomic="true"',
    );
  });

  it('prefixes the restart announcement', () => {
    expect(render(undefined, {}, 'The list changed.')).toContain(
      'The list changed. 2 reviews loaded.',
    );
  });

  it.each([
    [
      'assigned',
      {},
      'No definition reviews are assigned to you.',
      'See reviews you submitted',
    ],
    [
      'submitted',
      { scope: 'submitted' },
      'You have not submitted any definition reviews.',
      'Go to content modeling',
    ],
    [
      'owned',
      { scope: 'owned' },
      'No definition reviews are open on versions you own.',
      'Go to content modeling',
    ],
  ] as const)(
    'shows one empty state with one action for the %s scope',
    (_scope, query, sentence, action) => {
      const html = render(governedQueuePageFixture([]), query);
      expect(html).toContain(sentence);
      expect(html).toContain(action);
    },
  );

  it('distinguishes a filter that excludes every row from an empty scope', () => {
    const html = render(governedQueuePageFixture([]), { state: 'approved' });
    expect(html).toContain('No reviews match these filters.');
    expect(html).toContain('Reset the filters');
    expect(html).toContain(`href="${ROUTE}?scope=assigned${ANCHOR}"`);
  });

  it('continues with the signed cursor in the URL and keeps the filters', () => {
    const html = render(
      governedQueuePageFixture([governedQueueItem(1)], 'signed-cursor'),
      { scope: 'owned', state: 'open', limit: '10' },
    );
    expect(html).toContain('aria-label="Review queue pages"');
    expect(html).toContain(
      `href="${ROUTE}?scope=owned&amp;state=open&amp;limit=10&amp;cursor=signed-cursor${ANCHOR}"`,
    );
  });

  it('shows no next link on the last page', () => {
    expect(render()).not.toContain('Next page');
  });

  it('prints no identifier: a review id is only ever an address, and the contract refuses person, party and hash members', () => {
    const items = [governedQueueItem(1), governedQueueItem(2)];
    const html = render(governedQueuePageFixture(items));
    const visible = html.replace(/<[^>]*>/gu, ' ');
    for (const item of items) {
      const id = String(item.reviewId);
      expect(html).toContain(`href="${ROUTE}/${id}"`);
      expect(visible).not.toContain(id);
    }
    for (const member of ['personId', 'subjectHash', 'reviewerPersonId']) {
      const page = {
        items: [{ ...governedQueueItem(1), [member]: HASH_A }],
        nextCursor: null,
        pageVersion: '5',
      };
      expect(GovernedReviewQueuePageSchema.safeParse(page).success).toBe(false);
    }
  });

  it("words the risk class and the viewer's own decision instead of printing contract tokens", () => {
    const html = render(
      governedQueuePageFixture([
        governedQueueItem(1, {
          riskClass: 'protected',
          requiredDecisionCount: 2,
          myDecision: 'none',
        }),
        governedQueueItem(2, { riskClass: 'ordinary', myDecision: 'approve' }),
        governedQueueItem(3, { riskClass: 'ordinary', myDecision: 'reject' }),
      ]),
    );
    expect(html).toContain('Risk class: Protected');
    expect(html).toContain('Risk class: Ordinary');
    expect(html).toContain('Your decision: None yet');
    expect(html).toContain('Your decision: Approved');
    expect(html).toContain('Your decision: Rejected');
    expect(html).not.toMatch(/Risk class: (?:protected|ordinary)/u);
    expect(html).not.toMatch(/Your decision: (?:none|approve|reject)\b/u);
  });
});
