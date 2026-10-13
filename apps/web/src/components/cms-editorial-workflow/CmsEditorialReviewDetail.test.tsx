import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CmsEditorialReviewDetail from './CmsEditorialReviewDetail';
import {
  ASSIGNMENT_ID,
  HASH_A,
  HASH_B,
  INSTANT,
  LATER,
  REVIEWER_PERSON_ID,
  reviewDetailFixture,
} from './cms-workflow-fixtures.test-support';

const render = (
  overrides: Record<string, unknown> = {},
  degradedSince: string | null = null,
) =>
  renderToStaticMarkup(
    <CmsEditorialReviewDetail
      review={reviewDetailFixture(overrides)}
      degradedSince={degradedSince}
    />,
  );

const decision = (n: number, overrides: Record<string, unknown> = {}) => ({
  id: `123e4567-e89b-42d3-a456-4266141760${String(n).padStart(2, '0')}`,
  decision: 'approve',
  capability: 'cms.reviewer',
  decidedAt: LATER,
  mine: false,
  reason: null,
  ...overrides,
});

describe('CmsEditorialReviewDetail (CMS-03B-16)', () => {
  it('names its regions with focusable headings and states the review in words', () => {
    const html = render();
    for (const id of [
      'review-summary-title',
      'review-candidate-title',
      'review-decisions-title',
    ])
      expect(html).toContain(`id="${id}"`);
    expect(html).toContain('Press release');
    expect(html).toContain('Revision 4 (en-US)');
    expect(html).toContain('State: Open');
    expect(html).toContain('Risk class: ordinary');
    expect(html).toContain('0 of 1 decisions recorded');
    expect(html).toContain('Qualifying approvals: 0');
  });

  it('shows the frozen candidate as hash text and version identities, not a manifest', () => {
    const html = render();
    expect(html).toContain(HASH_A);
    expect(html).toContain(HASH_B);
    expect(html).toContain('Content type version');
    expect(html).toContain('Settings version 1');
    expect(html).toContain('Compiler 1.2.3');
    expect(html).toContain('1 block');
    expect(html).not.toContain('dependencyManifest');
    expect(html).not.toContain('schemaArtifact');
  });

  it('lists decisions as a semantic list and shows only the caller’s own reason', () => {
    const html = render({
      requiredDecisionCount: 2,
      recordedDecisionCount: 2,
      riskClass: 'protected',
      workflowPolicy: {
        ...reviewDetailFixture().workflowPolicy,
        key: 'cms.disclosure.legal',
        riskClass: 'protected',
        requiredDecisionCount: 2,
        requiredCapabilities: ['cms.reviewer', 'cms.reviewer.legal'],
      },
      distinctApprovalCount: 1,
      decisions: [
        decision(1, { mine: true, reason: 'The candidate matches the brief.' }),
        decision(2, { decision: 'reject', capability: 'cms.reviewer.legal' }),
      ],
    });
    expect(html).toContain('<ul');
    expect(html.match(/data-cms-review-decision/gu)).toHaveLength(2);
    expect(html).toContain('Your decision: approve');
    expect(html).toContain('Your reason: The candidate matches the brief.');
    expect(html).toContain('Decision: reject');
    expect(html).toContain('cms.reviewer.legal');
    expect(html.match(/Your reason/gu)).toHaveLength(1);
    expect(html).toContain('Qualifying approvals: 1');
    expect(html).not.toMatch(/reviewer label|decided by/iu);
  });

  it('shows the caller’s own assignment end and nothing about other assignments for a non-owner', () => {
    const html = render({
      myAssignment: { assignmentId: ASSIGNMENT_ID, endsAt: LATER },
    });
    expect(html).toContain('Your assignment ends');
    expect(html).toContain(`<time dateTime="${LATER}">`);
    expect(html).not.toContain('review-assignments-title');
    expect(html).not.toContain(ASSIGNMENT_ID);
  });

  it('lists the owner assignments by label only, under a focusable heading', () => {
    const html = render({
      permittedNextActions: ['assign_reviewer', 'revoke_assignment'],
      assignments: [
        {
          assignmentId: ASSIGNMENT_ID,
          version: '1',
          state: 'active',
          startsAt: INSTANT,
          endsAt: LATER,
          reviewerLabel: 'Reviewer 1',
        },
      ],
    });
    expect(html).toContain(
      '<h2 id="review-assignments-title" tabindex="-1">Assignments</h2>',
    );
    expect(html).toContain('Reviewer 1');
    expect(html).toContain('Active');
    expect(html).not.toContain(ASSIGNMENT_ID);
    expect(html).not.toContain(REVIEWER_PERSON_ID);
    expect(render({ permittedNextActions: ['assign_reviewer'] })).toContain(
      'No active assignments',
    );
  });

  it('explains an invalidated or decided review in words', () => {
    const invalid = render({
      state: 'invalidated',
      invalidatedReason: 'revision_superseded',
      decidedAt: null,
    });
    expect(invalid).toContain('State: Invalidated');
    expect(invalid).toContain(
      'A newer revision replaced the one under review.',
    );
    const decided = render({
      state: 'approved',
      decidedAt: LATER,
      recordedDecisionCount: 1,
      decisions: [decision(1)],
      distinctApprovalCount: 1,
    });
    expect(decided).toContain('State: Approved');
    expect(decided).toContain(`Decided <time dateTime="${LATER}">`);
  });

  it('offers a native link back to the queue and marks a degraded last-verified read', () => {
    const html = render({}, INSTANT);
    expect(html).toContain('href="/app/cms-content-modeling/reviews"');
    expect(html).toContain('Back to reviews');
    expect(html).toContain('Showing the last verified state from');
  });
});
