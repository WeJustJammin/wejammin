// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
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
import {
  KEY,
  LATER,
  REVIEW_ID,
  governedApiError,
  governedDecisionFixture,
  governedDetailFixture,
  governedReviewFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedDecisionForm from './CmsGovernedDecisionForm';
import {
  bodyOf,
  flushUntil,
  governedEnvironment,
  headersOf,
  pathOf,
  queuedFetcher,
} from './governed-review-form-test-support';

beforeAll(preloadWorkflowAnswerMachinery);

beforeAll(enableReactAct);
// The reason check runs synchronously once the lazily loaded validators are in.
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);

const review = (version = '2') => governedDetailFixture({ version });

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

const error = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
) => jsonResponse(status, governedApiError(code, 'A fixed message.', details));

const stepUp = (methods: string[] = ['totp']) =>
  error(401, 'STEP_UP_REQUIRED', {
    recoveryAction: 'step_up',
    allowedMethods: methods,
  });

const mount = (
  responses: readonly Response[],
  extra: Partial<React.ComponentProps<typeof CmsGovernedDecisionForm>> = {},
  storage = new MemoryStorage(),
  navigate = vi.fn(),
) => {
  const fetcher = queuedFetcher(responses);
  const refetch = vi.fn(async () => true);
  const onDone = vi.fn();
  const mounted = mountElement(
    <CmsGovernedDecisionForm
      review={review()}
      permitted
      disabledReason={null}
      refetch={refetch}
      onDone={onDone}
      environment={governedEnvironment(fetcher, storage, navigate)}
      {...extra}
    />,
  );
  return { ...mounted, fetcher, refetch, onDone, storage, navigate };
};

const choose = async (container: HTMLElement, value: 'approve' | 'reject') => {
  await click(
    container.querySelector<HTMLInputElement>(
      `input[type="radio"][value="${value}"]`,
    ) as HTMLInputElement,
  );
};
const reasonField = (container: HTMLElement) =>
  byLabel<HTMLTextAreaElement>(container, 'Reason');
const record = (container: HTMLElement) => buttonNamed(container, /Record/u);

describe('CmsGovernedDecisionForm (CMS-03C-07)', () => {
  it('offers a radio pair, a persistent reason label with a counter and names the consequence', async () => {
    const { container } = mount([]);
    expect(container.querySelector('fieldset legend')?.textContent).toBe(
      'Decision',
    );
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(2);
    expect(container.querySelector('h3')?.textContent).toBe(
      'Record your decision',
    );
    expect(
      container.querySelector('#governed-decision-reason-counter')?.textContent,
    ).toBe('0 of 2000 characters');
    expect(record(container).textContent).toBe('Record decision');
    await choose(container, 'reject');
    expect(record(container).textContent).toBe(
      'Record rejection. This ends the review.',
    );
    await choose(container, 'approve');
    expect(record(container).textContent).toBe('Record approval');
  });

  it('refuses a missing choice and an unsafe reason inline, sending nothing, with focus on the summary', async () => {
    const { container, fetcher } = mount([]);
    await click(record(container));
    const alert = container.querySelector(
      '[data-cms-workflow-local-errors]',
    ) as HTMLElement;
    expect(alert.textContent).toContain('Choose approve or reject.');
    expect(alert.textContent).toContain('Enter a reason.');
    expect(document.activeElement).toBe(alert);
    await choose(container, 'approve');
    await typeInto(reasonField(container), 'a <b> c');
    await click(record(container));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]')?.textContent,
    ).toContain('Remove the characters < > { and }.');
    expect(reasonField(container).getAttribute('aria-invalid')).toBe('true');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends the strict body at the review version, then refetches and focuses the decisions', async () => {
    const { container, fetcher, refetch, onDone } = mount([decided()]);
    await choose(container, 'approve');
    await typeInto(
      reasonField(container),
      'The candidate matches its frozen dependencies.',
    );
    await click(record(container));
    await flush();
    expect(pathOf(fetcher)).toBe(
      `/api/v1/cms/governed-reviews/${REVIEW_ID}/decision`,
    );
    expect(bodyOf(fetcher)).toEqual({
      reviewId: REVIEW_ID,
      decision: 'approve',
      reason: 'The candidate matches its frozen dependencies.',
      expectedVersion: '2',
    });
    expect(headersOf(fetcher).get('if-match')).toBe('"2"');
    expect(headersOf(fetcher).get('idempotency-key')).toBe(KEY);
    expect(Object.keys(bodyOf(fetcher))).not.toContain('capability');
    expect(Object.keys(bodyOf(fetcher))).not.toContain('stepUpAt');
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('governed-decisions-title');
    expect(
      container.querySelector('[data-cms-workflow-status]')?.textContent,
    ).toBe('Decision recorded.');
  });

  it('routes a step-up shortfall to the verification page with the draft stored and nothing replayed', async () => {
    const { container, fetcher, storage, navigate } = mount([stepUp()]);
    await choose(container, 'reject');
    await typeInto(reasonField(container), 'Needs a second look.');
    await click(record(container));
    await flushUntil(() => navigate.mock.calls.length > 0);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toMatch(/^\/step-up\?returnTo=/u);
    const stored = JSON.parse(
      storage.getItem('wj-step-up-draft:cms:/:CMS-03C-07') as string,
    ) as {
      values: Record<string, string>;
      idempotencyKey: string;
      expectedVersion: string;
    };
    expect(stored.values).toEqual({
      decision: 'reject',
      reason: 'Needs a second look.',
    });
    expect(stored.idempotencyKey).toBe(KEY);
    expect(stored.expectedVersion).toBe('2');
    expect(container.querySelector('a[href*="sign-in"]')).toBeNull();
  });

  it('keeps its draft apart from the editorial decision form', async () => {
    const { container, storage, navigate } = mount([stepUp()]);
    await choose(container, 'approve');
    await typeInto(reasonField(container), 'Fine.');
    await click(record(container));
    await flushUntil(() => navigate.mock.calls.length > 0);
    expect(navigate).toHaveBeenCalled();
    expect(storage.getItem('wj-step-up-draft:cms:/:CMS-03B-06')).toBeNull();
  });

  it('restores the draft after step-up, waits for confirmation and resubmits under the original key once', async () => {
    const storage = new MemoryStorage();
    const first = mount([stepUp()], {}, storage);
    await choose(first.container, 'reject');
    await typeInto(reasonField(first.container), 'Needs a second look.');
    await click(record(first.container));
    await flushUntil(
      () => storage.getItem('wj-step-up-draft:cms:/:CMS-03C-07') !== null,
    );
    expect(storage.getItem('wj-step-up-draft:cms:/:CMS-03C-07')).not.toBeNull();
    first.unmount();

    const returned = mount([decided()], {}, storage);
    await flush();
    expect(returned.fetcher).not.toHaveBeenCalled();
    expect(reasonField(returned.container).value).toBe('Needs a second look.');
    expect(
      returned.container.querySelector<HTMLInputElement>(
        'input[value="reject"]',
      )?.checked,
    ).toBe(true);
    expect(
      returned.container.querySelector('[data-cms-workflow-status]')
        ?.textContent,
    ).toBe('Your entries were restored. Review them, then confirm.');
    await click(record(returned.container));
    await flush();
    expect(returned.fetcher).toHaveBeenCalledTimes(1);
    expect(headersOf(returned.fetcher).get('idempotency-key')).toBe(KEY);
  });

  it('opens a sync conflict when the review version changed while verifying', async () => {
    const storage = new MemoryStorage();
    const first = mount([stepUp()], {}, storage);
    await choose(first.container, 'approve');
    await typeInto(reasonField(first.container), 'Fine.');
    await click(record(first.container));
    await flushUntil(
      () => storage.getItem('wj-step-up-draft:cms:/:CMS-03C-07') !== null,
    );
    expect(storage.getItem('wj-step-up-draft:cms:/:CMS-03C-07')).not.toBeNull();
    first.unmount();

    const returned = mount([decided()], { review: review('9') }, storage);
    await flush();
    expect(
      returned.container.querySelector('[data-cms-editorial-sync-conflict]')
        ?.textContent,
    ).toContain('version 2');
    await click(record(returned.container));
    expect(returned.fetcher).not.toHaveBeenCalled();
    await click(
      buttonNamed(
        returned.container,
        'Review the current version and continue',
      ),
    );
    await click(record(returned.container));
    await flush();
    expect(returned.fetcher).toHaveBeenCalledTimes(1);
    expect(bodyOf(returned.fetcher).expectedVersion).toBe('9');
  });

  it('shows the degraded state when no verification method is available', async () => {
    const { container } = mount([stepUp(['sms'])]);
    await choose(container, 'approve');
    await typeInto(reasonField(container), 'Fine.');
    await click(record(container));
    await flushUntil(() => container.querySelector('[role="alert"]') !== null);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'No verification method is available.',
    );
  });

  it('renders the separation-of-duties gate, never a step-up route', async () => {
    const { container } = mount([
      error(403, 'GOVERNED_REVIEW_FORBIDDEN', {
        reasonCode: 'separation_of_duties',
      }),
    ]);
    await choose(container, 'approve');
    await typeInto(reasonField(container), 'Fine.');
    await click(record(container));
    await flush();
    expect(
      container.querySelector('[data-cms-editorial-capability-gate]')
        ?.textContent,
    ).toContain('You cannot record a decision on your own work');
    expect(container.querySelector('a[href*="step-up"]')).toBeNull();
  });

  it.each([
    ['review_not_open', 'This review is no longer open.'],
    ['duplicate_decision', 'You already recorded a decision on this review.'],
    [
      'specialist_slot_unsatisfiable',
      'Your account cannot fill a required specialist slot on this review.',
    ],
    [
      'dependency_changed',
      'The review was invalidated because its dependencies changed.',
    ],
  ] as const)(
    'refetches the review and states why for %s',
    async (reasonCode, sentence) => {
      const { container, refetch } = mount([
        error(409, 'GOVERNED_REVIEW_VERSION_CONFLICT', { reasonCode }),
      ]);
      await choose(container, 'approve');
      await typeInto(reasonField(container), 'Fine.');
      await click(record(container));
      await flush();
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        sentence,
      );
      expect(refetch).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps the entered text and offers a reconciled retry after a lost answer', async () => {
    const { container, fetcher, refetch } = mount([
      error(504, 'DEPENDENCY_UNAVAILABLE'),
      decided(),
    ]);
    await choose(container, 'approve');
    await typeInto(reasonField(container), 'Keep me.');
    await click(record(container));
    await flush();
    expect(reasonField(container).value).toBe('Keep me.');
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-cms-workflow-status]')?.textContent,
    ).toBe('The current state is loaded. You can retry the same request.');
    await click(buttonNamed(container, 'Retry the same request'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(headersOf(fetcher, 0).get('idempotency-key')).toBe(KEY);
    expect(headersOf(fetcher, 1).get('idempotency-key')).toBe(KEY);
  });

  it('shows a polite status, not an alert, and offers the same key again when the answer is lost on the wire (the connection resets)', async () => {
    // A response dropped after the server committed it reaches the page as a rejected fetch.
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(decided());
    const { container, refetch } = mount([], {
      environment: governedEnvironment(fetcher),
    });
    await choose(container, 'approve');
    await typeInto(reasonField(container), 'Keep me.');
    await click(record(container));
    await flush();
    // FE03 (Governed review reconciliation, DEC-113 and DEC-137): an unknown outcome renders
    // pending and is reconciled against a canonical read; it is a status with the controls,
    // never an alert and never a guess.
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-cms-workflow-status]')?.textContent,
    ).toBe('The current state is loaded. You can retry the same request.');
    expect(reasonField(container).value).toBe('Keep me.');
    await click(buttonNamed(container, 'Retry the same request'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(headersOf(fetcher, 0).get('idempotency-key')).toBe(KEY);
    expect(headersOf(fetcher, 1).get('idempotency-key')).toBe(KEY);
  });

  describe('when the answer is lost after the server recorded the decision', () => {
    const LOST = 'The current state is loaded. You can retry the same request.';
    // The canonical re-read that follows a lost answer: the review now carries the caller's own
    // decision, so the server no longer offers the form.
    const recordedBy = (mine: boolean) =>
      governedDetailFixture({
        version: '3',
        state: 'approved',
        decidedAt: LATER,
        recordedDecisionCount: 1,
        distinctApprovalCount: 1,
        permittedNextActions: [],
        decisions: [governedDecisionFixture({ mine })],
      });

    const mountLost = (afterwards: ReturnType<typeof recordedBy>) => {
      const fetcher = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const onDone = vi.fn();
      const element = (
        current: ReturnType<typeof review>,
        permitted: boolean,
        refetch: () => Promise<boolean>,
      ) => (
        <CmsGovernedDecisionForm
          review={current}
          permitted={permitted}
          disabledReason={null}
          refetch={refetch}
          onDone={onDone}
          environment={governedEnvironment(fetcher)}
        />
      );
      const refetch = vi.fn(async () => {
        mounted.rerender(element(afterwards, false, refetch));
        return true;
      });
      const mounted = mountElement(element(review(), true, refetch));
      return { mounted, fetcher, refetch };
    };

    const lose = async (container: HTMLElement) => {
      await choose(container, 'approve');
      await typeInto(reasonField(container), 'Keep me.');
      await click(record(container));
      await flush();
    };
    const statusOf = (container: HTMLElement) =>
      container.querySelector('[data-cms-workflow-status]')?.textContent;
    const hasButton = (container: HTMLElement, name: string) =>
      [...container.querySelectorAll('button')].some(
        (button) => button.textContent === name,
      );

    it('says the decision is recorded and offers no retry when the re-read shows the caller own decision', async () => {
      const { mounted, fetcher } = mountLost(recordedBy(true));
      await lose(mounted.container);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(statusOf(mounted.container)).toBe('Decision recorded.');
      expect(statusOf(mounted.container)).not.toBe(LOST);
      expect(hasButton(mounted.container, 'Retry the same request')).toBe(
        false,
      );
      expect(mounted.container.querySelector('[role="alert"]')).toBeNull();
    });

    it('says the review no longer takes the decision, with no retry, when someone else closed it', async () => {
      const { mounted } = mountLost(recordedBy(false));
      await lose(mounted.container);
      expect(statusOf(mounted.container)).toBe(
        'The current state is loaded. This review no longer takes your decision.',
      );
      expect(hasButton(mounted.container, 'Retry the same request')).toBe(
        false,
      );
      expect(mounted.container.querySelector('[role="alert"]')).toBeNull();
    });
  });

  it('refuses to send while the read behind it is not verified', async () => {
    const { container, fetcher } = mount([decided()], {
      disabledReason: 'Reload the page.',
    });
    await choose(container, 'approve');
    await typeInto(reasonField(container), 'Fine.');
    await click(record(container));
    expect(fetcher).not.toHaveBeenCalled();
  });
});
