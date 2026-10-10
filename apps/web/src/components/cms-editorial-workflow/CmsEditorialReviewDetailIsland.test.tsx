// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { COMMAND_CASES } from '../../server/cms-workflow-platform-command.test-support';
import {
  jsonResponse,
  reviewDetailFixture,
} from './cms-workflow-fixtures.test-support';
import {
  formTitles,
  mountReviewIsland,
  ok,
} from './cms-workflow-island-mount.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const mount = mountReviewIsland;
const titles = formTitles;

describe('CmsEditorialReviewDetailIsland', () => {
  it('renders the review and the decision form only for an assignee who may decide', () => {
    const { container } = mount(reviewDetailFixture());
    expect(container.querySelector('[data-cms-review-detail]')).not.toBeNull();
    expect(titles(container)).toEqual(['Record your decision']);
  });

  it('renders the owner assignment controls only with the assign permission', () => {
    const owner = mount(
      reviewDetailFixture({
        permittedNextActions: ['assign_reviewer', 'revoke_assignment'],
      }),
    );
    expect(titles(owner.container)).toEqual(['Assign a reviewer']);
    owner.unmount();
    const reader = mount(reviewDetailFixture({ permittedNextActions: [] }));
    expect(titles(reader.container)).toEqual([]);
    expect(reader.container.textContent).toContain(
      'You have no active assignment to decide this review, or you have already decided it.',
    );
  });

  it('says nothing about deciding once the review is no longer open', () => {
    const { container } = mount(
      reviewDetailFixture({
        state: 'approved',
        decidedAt: '2026-10-09T12:00:00Z',
        recordedDecisionCount: 1,
        permittedNextActions: [],
        decisions: [
          {
            id: '123e4567-e89b-42d3-a456-426614176001',
            decision: 'approve',
            capability: 'cms.reviewer',
            decidedAt: '2026-10-09T12:00:00Z',
            mine: false,
            reason: null,
          },
        ],
        distinctApprovalCount: 1,
      }),
    );
    expect(container.textContent).not.toContain(
      'You have no active assignment',
    );
  });

  it('refetches the review after a decision and moves focus to the decisions heading', async () => {
    const decided = reviewDetailFixture({
      version: '3',
      state: 'approved',
      recordedDecisionCount: 1,
      decidedAt: '2026-10-09T12:00:00Z',
      permittedNextActions: [],
      decisions: [
        {
          id: '123e4567-e89b-42d3-a456-426614176002',
          decision: 'approve',
          capability: 'cms.reviewer',
          decidedAt: '2026-10-09T12:00:00Z',
          mine: true,
          reason: 'Matches the brief.',
        },
      ],
      distinctApprovalCount: 1,
    });
    const testCase = COMMAND_CASES['CMS-03B-06'];
    const { container, readReview } = mount(
      reviewDetailFixture(),
      [ok(decided)],
      [jsonResponse(200, testCase.resource, { etag: testCase.etag as string })],
    );
    await click(
      container.querySelector('input[value="approve"]') as HTMLElement,
    );
    await typeInto(
      byLabel<HTMLTextAreaElement>(container, 'Reason'),
      'Matches the brief.',
    );
    await click(buttonNamed(container, /Record approval/u));
    await vi.waitFor(() =>
      expect(document.activeElement?.id).toBe('review-decisions-title'),
    );
    expect(readReview).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Your reason: Matches the brief.');
    expect(titles(container)).toEqual([]);
  });

  it('keeps the last verified review with the forms off when a read cannot be verified', async () => {
    const testCase = COMMAND_CASES['CMS-03B-06'];
    const { container } = mount(
      reviewDetailFixture(),
      [{ kind: 'degraded', requestId: null }],
      [jsonResponse(200, testCase.resource, { etag: testCase.etag as string })],
    );
    await click(
      container.querySelector('input[value="approve"]') as HTMLElement,
    );
    await typeInto(byLabel<HTMLTextAreaElement>(container, 'Reason'), 'Fine.');
    await click(buttonNamed(container, /Record approval/u));
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-cms-workflow-degraded]'),
      ).not.toBeNull(),
    );
    expect(
      container.querySelector('[data-cms-workflow-disabled]')?.textContent,
    ).toBe(
      'The last read could not be verified. Commands are off until it is.',
    );
  });

  it('removes the review when it is gone or the session ended', async () => {
    const testCase = COMMAND_CASES['CMS-03B-06'];
    const answer = () =>
      jsonResponse(200, testCase.resource, { etag: testCase.etag as string });
    for (const [kind, text] of [
      ['gone', 'This record is not available.'],
      ['signed-out', 'Your session expired.'],
    ] as const) {
      const { container, unmount } = mount(
        reviewDetailFixture(),
        [{ kind }],
        [answer()],
      );
      await click(
        container.querySelector('input[value="approve"]') as HTMLElement,
      );
      await typeInto(
        byLabel<HTMLTextAreaElement>(container, 'Reason'),
        'Fine.',
      );
      await click(buttonNamed(container, /Record approval/u));
      await vi.waitFor(() =>
        expect(
          container.querySelector('[data-cms-workflow-closed]'),
        ).not.toBeNull(),
      );
      expect(container.textContent).toContain(text);
      expect(container.querySelector('[data-cms-review-detail]')).toBeNull();
      unmount();
    }
  });
});
