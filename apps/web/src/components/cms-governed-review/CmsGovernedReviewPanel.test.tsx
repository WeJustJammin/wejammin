// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  HASH_A,
  KEY,
  REVIEW_ID,
  SUBJECT_ID,
  governedApiError,
  governedReviewFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedReviewPanel, {
  type GovernedPanelSubject,
} from './CmsGovernedReviewPanel';
import {
  bodyOf,
  governedEnvironment,
  headersOf,
  pathOf,
  queuedFetcher,
} from './governed-review-form-test-support';

beforeAll(preloadWorkflowAnswerMachinery);

beforeAll(enableReactAct);
afterAll(disableReactAct);

const subject = (
  overrides: Partial<GovernedPanelSubject> = {},
): GovernedPanelSubject => ({
  kind: 'template_version',
  id: SUBJECT_ID,
  hash: HASH_A,
  key: 'profile-header',
  version: 2,
  state: 'draft',
  ...overrides,
});

const submitted = () =>
  jsonResponse(201, governedReviewFixture(), { etag: '"1"' });
const error = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
) => jsonResponse(status, governedApiError(code, 'A fixed message.', details));

const mount = (
  responses: readonly Response[],
  props: Partial<React.ComponentProps<typeof CmsGovernedReviewPanel>> = {},
) => {
  const fetcher = queuedFetcher(responses);
  const readSubject = vi.fn(
    async () => subject({ state: 'review' }) as GovernedPanelSubject | null,
  );
  const mounted = mountElement(
    <CmsGovernedReviewPanel
      subject={subject()}
      readSubject={readSubject}
      environment={governedEnvironment(fetcher)}
      {...props}
    />,
  );
  return { ...mounted, fetcher, readSubject };
};

const submit = (container: HTMLElement) =>
  buttonNamed(container, 'Submit for review');

describe('CmsGovernedReviewPanel lifecycle (CMS-03C-06)', () => {
  it('offers the submit action only for a draft and never asks the person to type anything', () => {
    const { container } = mount([]);
    expect(container.querySelector('h2')?.textContent).toBe(
      'Definition review',
    );
    expect(container.textContent).toContain('Lifecycle: Draft');
    expect(submit(container)).toBeTruthy();
    expect(container.querySelectorAll('input, textarea, select')).toHaveLength(
      0,
    );
  });

  it.each([
    ['review', 'In review', 'An independent reviewer must approve it'],
    ['approved', 'Approved', 'Open its review to activate or schedule it.'],
    [
      'blocked',
      'Blocked',
      'Its activation failed. Open its review to activate it again while the review is still approved.',
    ],
    ['scheduled', 'Scheduled, not active', null],
    ['active', 'Active', 'Open its review to retire it.'],
    ['superseded', 'Superseded', null],
    ['retired', 'Retired', null],
  ] as const)(
    'states the %s lifecycle in words and offers no submit action',
    (state, label, sentence) => {
      const { container } = mount([], { subject: subject({ state }) });
      expect(container.textContent).toContain(`Lifecycle: ${label}`);
      expect(container.querySelector('form')).toBeNull();
      if (sentence !== null) expect(container.textContent).toContain(sentence);
      expect(container.textContent).not.toContain(
        'Activation is not available from this panel yet.',
      );
    },
  );

  it.each(['review', 'approved', 'blocked', 'active'] as const)(
    'links a %s version without a resolved review to its reviews',
    (state) => {
      const { container } = mount([], { subject: subject({ state }) });
      expect(container.querySelector('a[href*="scope=owned"]')).not.toBeNull();
    },
  );

  it('links an in-review or approved version to its reviews, filtered to its kind', () => {
    const { container } = mount([], { subject: subject({ state: 'review' }) });
    const link = container.querySelector<HTMLAnchorElement>(
      'a[href*="definition-reviews"]',
    );
    expect(link?.getAttribute('href')).toBe(
      '/app/cms-content-modeling/definition-reviews?scope=owned&subjectKind=template_version',
    );
  });
});

describe('the review summary (FE03 :877, :1066)', () => {
  const review = {
    reviewId: REVIEW_ID,
    state: 'open',
    requiredDecisionCount: 2,
    recordedDecisionCount: 1,
  } as const;
  const reviewLink = (container: HTMLElement) =>
    container
      .querySelector<HTMLAnchorElement>(`a[href$="/${REVIEW_ID}"]`)
      ?.getAttribute('href');

  it('states the review and links to the review itself, not the owned queue, after a reload', () => {
    const { container } = mount([], {
      subject: subject({ state: 'review' }),
      review,
    });
    expect(container.textContent).toContain('Review: Open · 1 of 2 decisions');
    expect(reviewLink(container)).toBe(
      `/app/cms-content-modeling/definition-reviews/${REVIEW_ID}`,
    );
    expect(container.querySelector('a[href*="scope=owned"]')).toBeNull();
    expect(container.querySelector('#governed-panel-result')).toBeNull();
  });

  it.each([
    ['approved', 'Approved'],
    ['rejected', 'Rejected'],
    ['invalidated', 'Invalidated'],
  ] as const)('names a %s review in words', (state, label) => {
    const { container } = mount([], {
      subject: subject({ state: state === 'approved' ? 'approved' : 'draft' }),
      review: { ...review, state },
    });
    expect(container.textContent).toContain(
      `Review: ${label} · 1 of 2 decisions`,
    );
    expect(reviewLink(container)).toBeTruthy();
  });

  it('keeps the link to the owned queue when the review could not be resolved', () => {
    const { container } = mount([], {
      subject: subject({ state: 'approved' }),
      review: null,
    });
    expect(container.textContent).not.toContain('Review: ');
    expect(
      container.querySelector('a[href*="scope=owned"]')?.getAttribute('href'),
    ).toBe(
      '/app/cms-content-modeling/definition-reviews?scope=owned&subjectKind=template_version',
    );
  });

  it('words the link to the review as an action', () => {
    const { container } = mount([], {
      subject: subject({ state: 'review' }),
      review,
    });
    expect(
      container.querySelector(`a[href$="/${REVIEW_ID}"]`)?.textContent,
    ).toBe('Open the review');
  });

  it('does not carry the review of a version over to its successor draft', async () => {
    const { container } = mount([submitted()], {
      subject: subject({ state: 'draft' }),
      review: { ...review, state: 'rejected' },
      readSubject: async () =>
        subject({
          id: '123e4567-e89b-42d3-a456-426614174777',
          version: 3,
          state: 'draft',
        }),
    });
    expect(container.textContent).toContain('Review: Rejected');
    await click(submit(container));
    await flush();
    expect(container.textContent).not.toContain('Review: ');
    expect(container.querySelector('#governed-panel-result')).toBeNull();
  });

  it('shows the summary of the review it just submitted', async () => {
    const { container } = mount([submitted()]);
    expect(container.textContent).not.toContain('Review: ');
    await click(submit(container));
    await flush();
    expect(container.textContent).toContain('Review: Open · 0 of 1 decisions');
    expect(reviewLink(container)).toBeTruthy();
  });
});

describe('submit for review', () => {
  it('sends the subject id and hash exactly as served, with no If-Match, then re-reads the subject and names the result', async () => {
    const { container, fetcher, readSubject } = mount([submitted()]);
    await click(submit(container));
    await flush();
    expect(pathOf(fetcher)).toBe('/api/v1/cms/governed-reviews');
    expect(bodyOf(fetcher)).toEqual({
      subjectKind: 'template_version',
      subjectId: SUBJECT_ID,
      subjectHash: HASH_A,
    });
    expect(headersOf(fetcher).has('if-match')).toBe(false);
    expect(headersOf(fetcher).get('idempotency-key')).toBe(KEY);
    expect(readSubject).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Lifecycle: In review');
    expect(container.querySelector('form')).toBeNull();
    const result = container.querySelector('#governed-panel-result');
    expect(result?.textContent).toBe('Submitted for review');
    expect(document.activeElement).toBe(result);
    expect(
      container
        .querySelector<HTMLAnchorElement>(`a[href$="/${REVIEW_ID}"]`)
        ?.getAttribute('href'),
    ).toBe(`/app/cms-content-modeling/definition-reviews/${REVIEW_ID}`);
    expect(
      container.querySelector('[data-cms-workflow-status="island"]')
        ?.textContent,
    ).toBe('Review submitted. It is open for decisions.');
  });

  it('keeps the submit action off and says why when the subject could not be re-read', async () => {
    const { container } = mount([submitted()], {
      readSubject: async () => null,
    });
    await click(submit(container));
    await flush();
    expect(container.textContent).toContain(
      'The current state could not be verified. Submitting is off until it is.',
    );
  });

  it('refuses to send while the subject read behind it is not verified', async () => {
    const { container, fetcher } = mount([submitted()], {
      disabledReason: 'The current state could not be verified.',
    });
    await click(submit(container));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('says a version that cannot be submitted is not a submittable draft and re-reads the subject', async () => {
    const { container, readSubject } = mount([
      error(409, 'GOVERNED_REVIEW_VERSION_CONFLICT', {
        reasonCode: 'subject_not_submittable',
      }),
    ]);
    await click(submit(container));
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'This version can no longer be submitted. It may already be under review.',
    );
    expect(readSubject).toHaveBeenCalledTimes(1);
  });

  it('names the unbuilt canonical domain of a vocabulary refused at submission', async () => {
    const { container } = mount([
      error(422, 'GOVERNED_REVIEW_VALIDATION_FAILED', {
        reasonCode: 'canonical_source_unavailable',
        domain: 'gear',
      }),
    ]);
    await click(submit(container));
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'The gear reference list is not available yet',
    );
  });

  it('renders the capability gate for a missing capability or separation of duties, never a step-up route', async () => {
    for (const reasonCode of ['capability_missing', 'separation_of_duties']) {
      const { container, unmount } = mount([
        error(403, 'GOVERNED_REVIEW_FORBIDDEN', { reasonCode }),
      ]);
      await click(submit(container));
      await flush();
      expect(
        container.querySelector('[data-cms-editorial-capability-gate]'),
      ).not.toBeNull();
      expect(container.querySelector('a[href*="step-up"]')).toBeNull();
      unmount();
    }
  });

  it('keeps its key and offers a reconciled retry after a lost answer', async () => {
    const { container, fetcher, readSubject } = mount([
      error(503, 'DEPENDENCY_UNAVAILABLE'),
      submitted(),
    ]);
    await click(submit(container));
    await flush();
    expect(readSubject).toHaveBeenCalledTimes(1);
    await click(buttonNamed(container, 'Retry the same request'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(headersOf(fetcher, 0).get('idempotency-key')).toBe(KEY);
    expect(headersOf(fetcher, 1).get('idempotency-key')).toBe(KEY);
    expect(container.querySelector('#governed-panel-result')).not.toBeNull();
  });

  it('sends a successor draft as a new subject when the re-read finds one', async () => {
    const { container, fetcher } = mount([submitted(), submitted()], {
      readSubject: async () =>
        subject({
          id: '123e4567-e89b-42d3-a456-426614174777',
          version: 3,
          state: 'draft',
        }),
    });
    await click(submit(container));
    await flush();
    await click(submit(container));
    await flush();
    expect(bodyOf(fetcher, 1).subjectId).toBe(
      '123e4567-e89b-42d3-a456-426614174777',
    );
  });
});
