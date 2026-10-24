// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { CanonicalReadResult } from '../cms-editorial-workflow/cms-workflow-canonical-read';
import {
  INSTANT,
  LATER,
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  governedApiError,
  governedAssignmentSummaryFixture,
  governedDecisionFixture,
  governedDetailFixture,
  governedReviewFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import type { GovernedReviewDetailResource } from '@wejammin/contracts';
import CmsGovernedReviewDetailIsland from './CmsGovernedReviewDetailIsland';
import {
  governedEnvironment,
  queuedFetcher,
} from './governed-review-form-test-support';

beforeAll(preloadWorkflowAnswerMachinery);

beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);

type Read = CanonicalReadResult<GovernedReviewDetailResource>;
const ok = (resource: GovernedReviewDetailResource): Read => ({
  kind: 'ok',
  resource,
});

const decided = () =>
  jsonResponse(
    200,
    governedReviewFixture({
      version: '3',
      state: 'approved',
      recordedDecisionCount: 1,
      decidedAt: LATER,
    }),
    { etag: '"3"' },
  );

const mount = (
  initial: GovernedReviewDetailResource,
  reads: readonly Read[] = [],
  responses: readonly Response[] = [],
) => {
  const queue = [...reads];
  const readReview = vi.fn(async () => queue.shift() ?? ok(initial));
  const fetcher = queuedFetcher(responses);
  const mounted = mountElement(
    <CmsGovernedReviewDetailIsland
      init={{ review: initial, reviewId: REVIEW_ID, verifiedAt: INSTANT }}
      readReview={readReview}
      loadOptions={async () => ({ kind: 'ok', options: [] })}
      environment={governedEnvironment(fetcher)}
    />,
  );
  return { ...mounted, readReview, fetcher };
};

const titles = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('[data-cms-workflow-form] > h3')].map(
    (heading) => heading.textContent ?? '',
  );

describe('CmsGovernedReviewDetailIsland (CMS-03C-10)', () => {
  it('serves the evidence and exactly the forms permittedNextActions allows', async () => {
    const reviewer = mount(governedDetailFixture());
    await flush();
    expect(reviewer.container.textContent).toContain('Frozen version');
    expect(titles(reviewer.container)).toEqual(['Record your decision']);
    reviewer.unmount();
    const owner = mount(
      governedDetailFixture({
        permittedNextActions: ['assign_reviewer', 'revoke_assignment'],
        assignments: [governedAssignmentSummaryFixture()],
      }),
    );
    await flush();
    expect(titles(owner.container)).toEqual([
      'Assign a reviewer',
      'Revoke an assignment',
    ]);
    expect(owner.container.textContent).not.toContain(REVIEWER_PERSON_ID);
  });

  it('states why no decision form is offered on an open review', () => {
    const { container } = mount(
      governedDetailFixture({ permittedNextActions: [] }),
    );
    expect(titles(container)).toEqual([]);
    expect(container.textContent).toContain(
      'You can record a decision only with an effective assignment as a reviewer.',
    );
  });

  it('offers no command on a closed review', () => {
    const { container } = mount(
      governedDetailFixture({
        state: 'approved',
        decidedAt: LATER,
        recordedDecisionCount: 1,
        permittedNextActions: [],
        subjectState: 'approved',
        distinctApprovalCount: 1,
        decisions: [governedDecisionFixture()],
      }),
    );
    expect(titles(container)).toEqual([]);
    expect(container.textContent).not.toContain('effective assignment');
  });

  it('refetches the review after a decision and focuses the decisions heading', async () => {
    const after = governedDetailFixture({
      version: '3',
      state: 'approved',
      decidedAt: LATER,
      recordedDecisionCount: 1,
      permittedNextActions: [],
      subjectState: 'approved',
      distinctApprovalCount: 1,
      decisions: [
        {
          id: '123e4567-e89b-42d3-a456-426614174a01',
          decision: 'approve',
          capability: 'cms.reviewer',
          decidedAt: LATER,
          mine: true,
          reason: 'Matches the frozen dependencies.',
        },
      ],
    });
    const { container, readReview } = mount(
      governedDetailFixture({ version: '2' }),
      [ok(after), ok(after)],
      [decided()],
    );
    await click(
      container.querySelector<HTMLInputElement>(
        'input[value="approve"]',
      ) as HTMLInputElement,
    );
    await typeInto(
      byLabel<HTMLTextAreaElement>(container, 'Reason'),
      'Matches the frozen dependencies.',
    );
    await click(buttonNamed(container, /Record/u));
    await flush();
    expect(readReview).toHaveBeenCalled();
    expect(container.textContent).toContain('State: Approved');
    expect(container.textContent).toContain(
      'Your reason: Matches the frozen dependencies.',
    );
    expect(titles(container)).toEqual([]);
    expect(document.activeElement?.id).toBe('governed-decisions-title');
    expect(
      container.querySelector('[data-cms-workflow-status="island"]')
        ?.textContent,
    ).toBe('Decision recorded.');
  });

  it('keeps the sentence of a refusal after the re-read removed the action it was about', async () => {
    const closed = governedDetailFixture({
      version: '3',
      state: 'approved',
      decidedAt: LATER,
      recordedDecisionCount: 1,
      distinctApprovalCount: 1,
      decisions: [governedDecisionFixture()],
      permittedNextActions: [],
      subjectState: 'approved',
    });
    const { container } = mount(
      governedDetailFixture(),
      [ok(closed)],
      [
        jsonResponse(
          409,
          governedApiError('GOVERNED_REVIEW_VERSION_CONFLICT', 'm', {
            reasonCode: 'review_not_open',
          }),
        ),
      ],
    );
    await click(
      container.querySelector<HTMLInputElement>(
        'input[value="approve"]',
      ) as HTMLInputElement,
    );
    await typeInto(byLabel<HTMLTextAreaElement>(container, 'Reason'), 'Fine.');
    await click(buttonNamed(container, /Record/u));
    await flush();
    expect(container.textContent).toContain('State: Approved');
    expect(container.querySelector('input[type="radio"]')).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'This review is no longer open.',
    );
  });

  it('keeps the sentence of an assignment refusal after the review closed', async () => {
    const owner = governedDetailFixture({
      permittedNextActions: ['revoke_assignment'],
      assignments: [governedAssignmentSummaryFixture()],
    });
    const closed = governedDetailFixture({
      version: '3',
      state: 'rejected',
      decidedAt: LATER,
      recordedDecisionCount: 1,
      decisions: [governedDecisionFixture({ decision: 'reject' })],
      // The closed re-read still lists the active assignment: only the permission is gone.
      assignments: [governedAssignmentSummaryFixture()],
      permittedNextActions: [],
      subjectState: 'draft',
    });
    const { container } = mount(
      owner,
      [ok(closed)],
      [
        jsonResponse(
          409,
          governedApiError('GOVERNED_REVIEW_VERSION_CONFLICT', 'm', {
            reasonCode: 'review_not_open',
          }),
        ),
      ],
    );
    await click(buttonNamed(container, 'Revoke Reviewer A'));
    await flush();
    expect(container.textContent).toContain('State: Rejected');
    expect(container.textContent).toContain('Reviewer A');
    expect(container.querySelector('ul button')).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'This review is no longer open.',
    );
  });

  it('keeps the last verified review with the forms off when a later read fails', async () => {
    const { container, readReview } = mount(
      governedDetailFixture(),
      [{ kind: 'degraded', requestId: null }],
      [
        jsonResponse(
          409,
          governedApiError('GOVERNED_REVIEW_VERSION_CONFLICT', 'm', {
            reasonCode: 'review_not_open',
          }),
        ),
      ],
    );
    await click(
      container.querySelector<HTMLInputElement>(
        'input[value="approve"]',
      ) as HTMLInputElement,
    );
    await typeInto(byLabel<HTMLTextAreaElement>(container, 'Reason'), 'Fine.');
    await click(buttonNamed(container, /Record/u));
    await flush();
    expect(readReview).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain(
      'Showing the last verified state from',
    );
    expect(container.textContent).toContain(
      'The last read could not be verified. Commands are off until it is.',
    );
    expect(container.textContent).toContain('Frozen version');
  });

  it('removes the protected data when the review is gone or the session ended', async () => {
    const gone = mount(
      governedDetailFixture(),
      [{ kind: 'gone' }],
      [
        jsonResponse(
          409,
          governedApiError('GOVERNED_REVIEW_VERSION_CONFLICT', 'm', {
            reasonCode: 'review_not_open',
          }),
        ),
      ],
    );
    await click(
      gone.container.querySelector<HTMLInputElement>(
        'input[value="approve"]',
      ) as HTMLInputElement,
    );
    await typeInto(
      byLabel<HTMLTextAreaElement>(gone.container, 'Reason'),
      'Fine.',
    );
    await click(buttonNamed(gone.container, /Record/u));
    await flush();
    expect(
      gone.container.querySelector('[data-cms-workflow-closed="gone"]'),
    ).not.toBeNull();
    expect(gone.container.textContent).not.toContain('Frozen version');
    gone.unmount();
    const out = mount(
      governedDetailFixture(),
      [{ kind: 'signed-out' }],
      [
        jsonResponse(
          409,
          governedApiError('GOVERNED_REVIEW_VERSION_CONFLICT', 'm', {
            reasonCode: 'review_not_open',
          }),
        ),
      ],
    );
    await click(
      out.container.querySelector<HTMLInputElement>(
        'input[value="approve"]',
      ) as HTMLInputElement,
    );
    await typeInto(
      byLabel<HTMLTextAreaElement>(out.container, 'Reason'),
      'Fine.',
    );
    await click(buttonNamed(out.container, /Record/u));
    await flush();
    expect(
      out.container.querySelector('[data-cms-workflow-closed="signed-out"]'),
    ).not.toBeNull();
  });
});
