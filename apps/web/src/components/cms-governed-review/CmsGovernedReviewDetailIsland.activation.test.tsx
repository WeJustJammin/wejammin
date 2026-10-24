// @vitest-environment jsdom
import type { GovernedReviewDetailResource } from '@wejammin/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { CanonicalReadResult } from '../cms-editorial-workflow/cms-workflow-canonical-read';
import {
  INSTANT,
  REVIEW_ID,
  governedActivationFixture,
  governedDecisionFixture,
  governedDetailFixture,
  governedRetiredFixture,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedReviewDetailIsland from './CmsGovernedReviewDetailIsland';
import {
  accepted,
  activeReview,
  apiFailure,
  approvedReview,
  choosing,
  continueButton,
} from './governed-activation-form.test-support';
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

const islandStatus = (container: HTMLElement): string =>
  container.querySelector('[data-cms-workflow-status="island"]')?.textContent ??
  '';

describe('CmsGovernedReviewDetailIsland activation (CMS-03C-09, DEC-190)', () => {
  it('offers Activate and Schedule for an approved version and Retire for an active one, from permittedNextActions only', () => {
    const approved = mount(approvedReview());
    expect(titles(approved.container)).toEqual([
      'Activate or schedule this version',
    ]);
    approved.unmount();
    const active = mount(activeReview());
    expect(titles(active.container)).toEqual(['Retire this version']);
    active.unmount();
    const none = mount(approvedReview({ permittedNextActions: [] }));
    expect(titles(none.container)).toEqual([]);
  });

  it('offers a blocked version a new activation while the server permits it', () => {
    const { container } = mount(approvedReview({ subjectState: 'blocked' }));
    expect(titles(container)).toEqual(['Activate or schedule this version']);
  });

  it('tells a reader who cannot act why no activation control is offered', () => {
    const { container } = mount(approvedReview({ permittedNextActions: [] }));
    expect(container.textContent).toContain(
      'Only the owner of this version can activate or schedule it.',
    );
    const blocked = mount(
      approvedReview({
        subjectState: 'blocked',
        permittedNextActions: ['activate'],
      }),
    );
    expect(blocked.container.textContent).not.toContain(
      'Only the owner of this version can activate or schedule it.',
    );
    const open = mount(governedDetailFixture({ permittedNextActions: [] }));
    expect(open.container.textContent).not.toContain(
      'Only the owner of this version can activate or schedule it.',
    );
  });

  it('tells a reader of an active version who is not offered retire why, naming the missing action (FE03 :1048)', () => {
    const { container } = mount(activeReview({ permittedNextActions: [] }));
    expect(titles(container)).toEqual([]);
    expect(container.textContent).toContain(
      'Only the owner of this version can retire it.',
    );
    const owner = mount(activeReview());
    expect(owner.container.textContent).not.toContain(
      'Only the owner of this version can retire it.',
    );
    const approved = mount(approvedReview({ permittedNextActions: [] }));
    expect(approved.container.textContent).not.toContain(
      'Only the owner of this version can retire it.',
    );
    const open = mount(governedDetailFixture({ permittedNextActions: [] }));
    expect(open.container.textContent).not.toContain(
      'Only the owner of this version can retire it.',
    );
  });

  it('never says the owner alone can retire a version on a review that did not approve it, even while that subject is active', () => {
    const closed = [
      activeReview({
        state: 'rejected',
        decisions: [governedDecisionFixture({ decision: 'reject' })],
        distinctApprovalCount: 0,
        permittedNextActions: [],
      }),
      activeReview({
        state: 'invalidated',
        invalidatedReason: 'dependency_changed',
        decidedAt: null,
        permittedNextActions: [],
      }),
    ];
    for (const review of closed) {
      const { container } = mount(review);
      expect(container.textContent).not.toContain(
        'Only the owner of this version can retire it.',
      );
    }
  });

  it('activates, re-reads the review, focuses the summary and keeps the sentence in the island line', async () => {
    const after = approvedReview({
      version: '3',
      activatedAt: INSTANT,
      subjectState: 'active',
      permittedNextActions: ['retire'],
    });
    const { container, fetcher, readReview } = mount(
      approvedReview(),
      [ok(after)],
      [accepted(200, governedActivationFixture(), '"3"')],
    );
    await choosing(container, 'Activate now');
    await click(continueButton(container));
    await click(buttonNamed(container, 'Activate this version'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(readReview).toHaveBeenCalledTimes(1);
    expect(document.activeElement?.id).toBe('governed-summary-title');
    expect(container.textContent).toContain('Subject: Active');
    expect(islandStatus(container)).toBe(
      'Activated, not published: Template profile-header, version 2 is now the active version. Version 1 is now superseded.',
    );
    expect(titles(container)).toEqual(['Retire this version']);
  });

  it('shows a blocked and a cancelled schedule with their closed reason on the review (FE03 :1118)', async () => {
    const blocked = approvedReview({
      subjectState: 'blocked',
      activationSchedule: {
        state: 'blocked',
        reasonCode: 'dependency_changed',
      },
    });
    const { container } = mount(blocked);
    expect(
      container.querySelector('[data-cms-governed-activation-schedule]')
        ?.textContent,
    ).toBe(
      'Scheduled activation: blocked. A dependency changed after the review approved it.',
    );
    const cancelled = approvedReview({
      activationSchedule: {
        state: 'cancelled',
        reasonCode: 'approval_invalidated',
      },
    });
    const second = mount(cancelled);
    expect(
      second.container.querySelector('[data-cms-governed-activation-schedule]')
        ?.textContent,
    ).toBe(
      'Scheduled activation: cancelled. The review approval no longer applies.',
    );
  });

  it('keeps focus on the commit control while the review is re-read, then moves it to the summary heading (FE03 :1118)', async () => {
    const after = approvedReview({
      version: '3',
      activatedAt: INSTANT,
      subjectState: 'active',
      permittedNextActions: ['retire'],
    });
    let release: () => void = () => undefined;
    const held = new Promise<Read>((resolve) => {
      release = () => resolve(ok(after));
    });
    const fetcher = queuedFetcher([
      accepted(200, governedActivationFixture(), '"3"'),
    ]);
    const readReview = vi.fn(() => held);
    const { container } = mountElement(
      <CmsGovernedReviewDetailIsland
        init={{
          review: approvedReview(),
          reviewId: REVIEW_ID,
          verifiedAt: INSTANT,
        }}
        readReview={readReview}
        loadOptions={async () => ({ kind: 'ok', options: [] })}
        environment={governedEnvironment(fetcher)}
      />,
    );
    await choosing(container, 'Activate now');
    await click(continueButton(container));
    const commit = buttonNamed(container, 'Activate this version');
    commit.focus();
    await click(commit);
    await flush();
    await flush();
    expect(readReview).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(commit);
    release();
    await flush();
    await flush();
    expect(document.activeElement?.id).toBe('governed-summary-title');
    expect(container.textContent).toContain('Subject: Active');
    expect(
      container.querySelector('#governed-activation-confirm-title'),
    ).toBeNull();
  });

  it('retires and uses the advanced review version as the new validator', async () => {
    const after = activeReview({
      version: '3',
      subjectState: 'retired',
      permittedNextActions: [],
    });
    const { container, fetcher } = mount(
      activeReview(),
      [ok(after)],
      [accepted(200, governedRetiredFixture(), '"3"')],
    );
    await choosing(container, 'Retire this version');
    await click(continueButton(container));
    await click(buttonNamed(container, 'Retire this version'));
    await flush();
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(new Headers(init.headers).get('if-match')).toBe('"2"');
    expect(container.textContent).toContain('Subject: Retired');
    expect(islandStatus(container)).toContain(
      'Entries bound to this version can no longer publish.',
    );
    expect(container.querySelector('input[type="radio"]')).toBeNull();
  });

  it('keeps the refusal sentence after the re-read removed the action it was about', async () => {
    const closed = activeReview({
      version: '3',
      subjectState: 'retired',
      permittedNextActions: [],
    });
    const { container } = mount(
      activeReview(),
      [ok(closed)],
      [
        apiFailure(409, 'GOVERNED_REVIEW_VERSION_CONFLICT', {
          reasonCode: 'subject_not_retirable',
        }),
      ],
    );
    await choosing(container, 'Retire this version');
    await click(continueButton(container));
    await click(buttonNamed(container, 'Retire this version'));
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Only an active version can be retired, and this version is not active now.',
    );
    expect(container.textContent).toContain('Subject: Retired');
  });

  it('turns the activation controls off when a later read cannot be verified', async () => {
    const { container, fetcher } = mount(
      approvedReview(),
      [{ kind: 'degraded', requestId: null }],
      [
        apiFailure(409, 'GOVERNED_REVIEW_VERSION_CONFLICT', {
          reasonCode: 'subject_not_activatable',
        }),
      ],
    );
    await choosing(container, 'Activate now');
    await click(continueButton(container));
    await click(buttonNamed(container, 'Activate this version'));
    await flush();
    expect(container.textContent).toContain(
      'The last read could not be verified. Commands are off until it is.',
    );
    await choosing(container, 'Activate now');
    await click(continueButton(container));
    expect(
      container.querySelector('#governed-activation-confirm-title'),
    ).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
