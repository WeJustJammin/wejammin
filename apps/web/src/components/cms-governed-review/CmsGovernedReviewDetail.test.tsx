import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ASSIGNMENT_ID,
  HASH_A,
  HASH_B,
  LATER,
  LINEAGE_ID,
  REVIEWER_PERSON_ID,
  SUBJECT_ID,
  governedAssignmentSummaryFixture,
  governedDecisionFixture,
  governedDetailFixture,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedReviewDetail, {
  GOVERNED_DETAIL_HEADING_IDS,
} from './CmsGovernedReviewDetail';

const render = (
  overrides: Record<string, unknown> = {},
  degradedSince: string | null = null,
): string =>
  renderToStaticMarkup(
    <CmsGovernedReviewDetail
      review={governedDetailFixture(overrides)}
      degradedSince={degradedSince}
    />,
  );

describe('CmsGovernedReviewDetail (CMS-03C-10)', () => {
  it('names each section as a focus target and links back to the queue', () => {
    const html = render({
      assignments: [governedAssignmentSummaryFixture()],
      permittedNextActions: ['assign_reviewer'],
    });
    for (const id of Object.values(GOVERNED_DETAIL_HEADING_IDS))
      expect(html).toContain(`id="${id}" tabindex="-1"`);
    expect(html).toContain(
      'href="/app/cms-content-modeling/definition-reviews">Back to definition reviews</a>',
    );
  });

  it('shows the subject identity, review state, subject lifecycle and risk class as text', () => {
    const html = render({
      subjectKind: 'pattern_version',
      subjectKey: 'hero-banner',
      subjectVersion: 4,
      riskClass: 'protected',
      requiredDecisionCount: 2,
      subjectState: 'review',
    });
    expect(html).toContain('Pattern hero-banner, version 4');
    expect(html).toContain('State: Open');
    expect(html).toContain('Subject: In review');
    expect(html).toContain('Risk class: Protected');
    expect(html).not.toContain('Risk class: protected');
    expect(html).toContain('0 of 2 decisions recorded.');
    expect(html).toContain('Qualifying approvals: 0.');
  });

  it('shows the frozen subject and policy as hashes and labels, never ids', () => {
    const html = render();
    expect(html).toContain(`Subject hash: <code>${HASH_A}</code>`);
    expect(html).toContain(`Policy basis hash: <code>${HASH_B}</code>`);
    expect(html).toContain(`Block registry digest: <code>${HASH_A}</code>`);
    expect(html).toContain('Profile');
    expect(html).toContain('editorial.default');
    expect(html).toContain('cms.reviewer');
    expect(html).not.toContain(SUBJECT_ID);
    expect(html).not.toContain(LINEAGE_ID);
  });

  it('omits the block registry digest line when the subject has none', () => {
    expect(render({ blockRegistryDigest: null })).not.toContain(
      'Block registry digest',
    );
  });

  it('states an invalidation with its fixed copy and the version back at draft', () => {
    const html = render({
      state: 'invalidated',
      invalidatedReason: 'dependency_changed',
      subjectState: 'draft',
    });
    expect(html).toContain('State: Invalidated');
    expect(html).toContain('Subject: Draft');
    expect(html).toContain('The version is back to draft.');
  });

  it('lists decisions as a semantic list without the decider and with only the own reason', () => {
    const html = render({
      recordedDecisionCount: 2,
      requiredDecisionCount: 2,
      riskClass: 'protected',
      distinctApprovalCount: 1,
      decisions: [
        governedDecisionFixture({
          id: '123e4567-e89b-42d3-a456-426614174a01',
          mine: true,
          reason: 'Matches the frozen dependencies.',
        }),
        governedDecisionFixture({
          id: '123e4567-e89b-42d3-a456-426614174a02',
          decision: 'reject',
        }),
      ],
    });
    expect(html).toContain('<ul>');
    expect(html).toContain('Your decision: Approved');
    expect(html).toContain('Your reason: Matches the frozen dependencies.');
    expect(html).toContain('Decision: Rejected');
    expect((html.match(/Your reason/gu) ?? []).length).toBe(1);
    expect(html).toContain('Slot <code>cms.reviewer</code>');
  });

  it('says no decisions are recorded yet', () => {
    expect(render()).toContain('No decisions recorded yet.');
  });

  it('shows the own assignment end and, for the owner only, the assignments by server label', () => {
    const own = render({
      myAssignment: { assignmentId: ASSIGNMENT_ID, endsAt: LATER },
    });
    expect(own).toContain('Your assignment ends');
    expect(own).not.toContain('Assignments</h2>');
    const owner = render({
      assignments: [
        governedAssignmentSummaryFixture({ reviewerLabel: 'Pat Reviewer' }),
      ],
      permittedNextActions: ['assign_reviewer', 'revoke_assignment'],
    });
    expect(owner).toContain('Assignments</h2>');
    expect(owner).toContain('Pat Reviewer');
    expect(owner).toContain('Active');
    expect(owner).not.toContain(ASSIGNMENT_ID);
    expect(owner).not.toContain(REVIEWER_PERSON_ID);
  });

  it('shows the empty assignment list to the owner who can assign', () => {
    const html = render({ permittedNextActions: ['assign_reviewer'] });
    expect(html).toContain('No active assignments');
  });

  it('marks a degraded read with the last verified time', () => {
    const html = render({}, '2026-10-14T12:00:00Z');
    expect(html).toContain('Showing the last verified state from');
    expect(html).toContain(
      'Commands are off until the page is verified again.',
    );
    expect(render()).not.toContain('last verified state');
  });

  it('says a scheduled subject is not active', () => {
    expect(
      render({
        subjectState: 'scheduled',
        state: 'approved',
        decidedAt: LATER,
        recordedDecisionCount: 1,
        distinctApprovalCount: 0,
        decisions: [governedDecisionFixture({ mine: false })],
      }),
    ).toContain('Subject: Scheduled, not active');
  });

  it('shows nothing about a schedule when the review has none', () => {
    expect(render({ activationSchedule: null })).not.toContain(
      'Scheduled activation',
    );
  });

  it.each([
    ['pending', 'Scheduled activation: pending.'],
    ['executing', 'Scheduled activation: running now.'],
    ['completed', 'Scheduled activation: completed.'],
    [
      'failed_retryable',
      'Scheduled activation: an attempt failed and will be retried.',
    ],
  ])(
    'says a %s schedule in words and gives it no reason',
    (state, sentence) => {
      const html = render({ activationSchedule: { state, reasonCode: null } });
      expect(html).toContain(
        `<p data-cms-governed-activation-schedule="">${sentence}</p>`,
      );
    },
  );

  it.each([
    ['approval_invalidated', 'The review approval no longer applies.'],
    [
      'dependency_changed',
      'A dependency changed after the review approved it.',
    ],
    ['activation_authority_ended', 'The authority to activate it ended.'],
    [
      'canonical_source_unavailable',
      'A canonical source it depends on was unavailable.',
    ],
    ['retries_exhausted', 'It stopped after its retries ran out.'],
  ])(
    'shows a blocked schedule with its closed reason %s as fixed copy',
    (reasonCode, copy) => {
      const html = render({
        activationSchedule: { state: 'blocked', reasonCode },
      });
      expect(html).toContain(
        `<p data-cms-governed-activation-schedule="">Scheduled activation: blocked. ${copy}</p>`,
      );
      expect(html).not.toContain(reasonCode);
    },
  );

  it('shows a cancelled schedule with its closed reason as fixed copy', () => {
    const html = render({
      activationSchedule: {
        state: 'cancelled',
        reasonCode: 'approval_invalidated',
      },
    });
    expect(html).toContain(
      '<p data-cms-governed-activation-schedule="">Scheduled activation: cancelled. The review approval no longer applies.</p>',
    );
    expect(html).not.toContain('approval_invalidated');
  });

  it('keeps the schedule line inside the summary section, after the status line', () => {
    const html = render({
      activationSchedule: { state: 'blocked', reasonCode: 'retries_exhausted' },
    });
    const summary = html.slice(
      html.indexOf('governed-summary-title'),
      html.indexOf('governed-frozen-title'),
    );
    expect(summary.indexOf('role="status"')).toBeGreaterThan(-1);
    expect(
      summary.indexOf('data-cms-governed-activation-schedule'),
    ).toBeGreaterThan(summary.indexOf('role="status"'));
  });
});
