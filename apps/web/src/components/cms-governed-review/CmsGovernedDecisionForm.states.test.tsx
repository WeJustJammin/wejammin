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
  INSTANT,
  KEY,
  LATER,
  REVIEW_ID,
  governedDetailFixture,
  governedReviewFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedDecisionForm from './CmsGovernedDecisionForm';
import CmsGovernedReviewDetailIsland from './CmsGovernedReviewDetailIsland';
import {
  GATE,
  RECONCILED,
  WAITING,
  alertOf,
  conflictFor,
  expectOnlyCommitDisabled,
  expectStepUpRoute,
  forbiddenFor,
  heldReread,
  heldWire,
  invalidFor,
  statusOf,
  stepUpRequired,
} from './governed-command-states.test-support';
import {
  flushUntil,
  governedEnvironment,
  headersOf,
  queuedFetcher,
} from './governed-review-form-test-support';

beforeAll(preloadWorkflowAnswerMachinery);
beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);

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
  fetcher: ReturnType<typeof vi.fn>,
  extra: Partial<React.ComponentProps<typeof CmsGovernedDecisionForm>> = {},
  storage = new MemoryStorage(),
) => {
  const refetch = vi.fn(async () => true);
  const onDone = vi.fn();
  const navigate = vi.fn();
  const mounted = mountElement(
    <CmsGovernedDecisionForm
      review={governedDetailFixture({ version: '2' })}
      permitted
      disabledReason={null}
      refetch={refetch}
      onDone={onDone}
      environment={governedEnvironment(fetcher, storage, navigate)}
      {...extra}
    />,
  );
  return { ...mounted, refetch, onDone, navigate, storage };
};

const reason = (container: HTMLElement) =>
  byLabel<HTMLTextAreaElement>(container, 'Reason');
const radio = (container: HTMLElement, value: 'approve' | 'reject') =>
  container.querySelector<HTMLInputElement>(
    `input[type="radio"][value="${value}"]`,
  ) as HTMLInputElement;
const record = (container: HTMLElement) => buttonNamed(container, /Record/u);
const fillAndRecord = async (container: HTMLElement) => {
  await click(radio(container, 'approve'));
  await typeInto(reason(container), 'Fine.');
  await click(record(container));
};

describe('CmsGovernedDecisionForm (CMS-03C-07) commandState', () => {
  it('[P2-S12-AC-271] commandState idle: no form open, or a form with an unsent scoped draft', async () => {
    const none = mount(queuedFetcher([]), { permitted: false });
    await flush();
    expect(none.container.textContent).toBe('');
    none.unmount();

    const firstWire = queuedFetcher([stepUpRequired()]);
    const first = mount(firstWire);
    await click(radio(first.container, 'reject'));
    await typeInto(reason(first.container), 'Kept, unsent.');
    // An unsent draft stays in the form: nothing is sent, nothing is stored, no status speaks.
    expect(firstWire).not.toHaveBeenCalled();
    expect(statusOf(first.container)).toBe('');
    expect(first.storage.length).toBe(0);
    expect(reason(first.container).value).toBe('Kept, unsent.');
    expect(record(first.container).getAttribute('aria-disabled')).toBe('false');
    await click(record(first.container));
    await flushUntil(() => first.navigate.mock.calls.length > 0);
    first.unmount();

    // The scoped draft (decision and reason only) returns on the form that follows the step-up.
    const returned = mount(queuedFetcher([]), {}, first.storage);
    await flush();
    expect(reason(returned.container).value).toBe('Kept, unsent.');
    expect(radio(returned.container, 'reject').checked).toBe(true);
    expect(statusOf(returned.container)).toBe(
      'Your entries were restored. Review them, then confirm.',
    );
  });

  it('[P2-S12-AC-271] commandState loading: a stable pending label and only the commit control disabled', async () => {
    const wire = heldWire();
    const { container } = mount(wire.fetcher);
    await fillAndRecord(container);
    await flush();
    expect(wire.fetcher).toHaveBeenCalledTimes(1);
    expectOnlyCommitDisabled(
      container,
      record(container),
      'Record approval',
      'Recording decision…',
    );
    // The fields stay editable: nothing but the commit control is withheld.
    expect(radio(container, 'reject').disabled).toBe(false);
    expect(reason(container).disabled).toBe(false);
    await click(record(container));
    expect(wire.fetcher).toHaveBeenCalledTimes(1);
  });

  it('[P2-S12-AC-271] commandState success (kept half): the named resource, the stored draft cleared and the review refetched; typed fields are not cleared (C1)', async () => {
    const { container, refetch, onDone, storage } = mount(
      queuedFetcher([decided()]),
    );
    await fillAndRecord(container);
    await flush();
    expect(statusOf(container)).toBe('Decision recorded.');
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('governed-decisions-title');
    expect(storage.length).toBe(0);
  });

  it('[P2-S12-AC-271] commandState error: 401 STEP_UP_REQUIRED routes to /step-up?returnTo= and never renders a gate', async () => {
    const wire = queuedFetcher([stepUpRequired()]);
    const { container, navigate } = mount(wire);
    await fillAndRecord(container);
    await flushUntil(() => navigate.mock.calls.length > 0);
    expectStepUpRoute(container, navigate, wire);
  });

  it.each(['capability_missing', 'separation_of_duties'])(
    '[P2-S12-AC-271] commandState error: 403 %s renders the CapabilityGate copy',
    async (reasonCode) => {
      const { container } = mount(queuedFetcher([forbiddenFor(reasonCode)]));
      await fillAndRecord(container);
      await flush();
      const gate = container.querySelector(GATE);
      expect(gate?.textContent).toContain(
        reasonCode === 'capability_missing'
          ? 'Your account does not have the capability for this action.'
          : 'You cannot record a decision on your own work',
      );
      expect(container.querySelector('a[href*="step-up"]')).toBeNull();
    },
  );

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
  ])(
    '[P2-S12-AC-271] commandState error: 409 %s renders fixed copy and refetches',
    async (reasonCode, sentence) => {
      const { container, refetch } = mount(
        queuedFetcher([conflictFor(reasonCode)]),
      );
      await fillAndRecord(container);
      await flush();
      expect(alertOf(container)).toContain(sentence);
      expect(alertOf(container)).not.toContain('A fixed message.');
      expect(refetch).toHaveBeenCalledTimes(1);
    },
  );

  it('[P2-S12-AC-271] commandState error: 422 renders fixed copy at the field it names', async () => {
    const { container } = mount(
      queuedFetcher([
        invalidFor('invalid_request', {
          violations: [{ path: '/reason', code: 'invalid' }],
        }),
      ]),
    );
    await fillAndRecord(container);
    await flush();
    expect(alertOf(container)).toContain('Check the highlighted fields.');
    expect(alertOf(container)).not.toContain('A fixed message.');
    expect(reason(container).getAttribute('aria-invalid')).toBe('true');
    expect(
      container.querySelector(
        '[role="alert"] a[href="#governed-decision-reason"]',
      )?.textContent,
    ).toBe('Reason');
  });

  it('[P2-S12-AC-271] commandState degraded: an unknown outcome renders pending and reconciles by refetching the review before any retry', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(decided());
    const reread = heldReread();
    const { container } = mount(fetcher, { refetch: reread.refetch });
    await fillAndRecord(container);
    await flush();
    // Pending, not a guessed success and not an alert; the review is being re-read.
    expect(statusOf(container)).toBe(WAITING);
    expect(reread.refetch).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    const retry = buttonNamed(container, 'Retry the same request');
    expect(retry.getAttribute('aria-disabled')).toBe('true');
    await click(retry);
    expect(fetcher).toHaveBeenCalledTimes(1);
    reread.release(true);
    await flush();
    expect(statusOf(container)).toBe(RECONCILED);
    expect(retry.getAttribute('aria-disabled')).toBe('false');
    await click(retry);
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(headersOf(fetcher, 1).get('idempotency-key')).toBe(KEY);
    expect(statusOf(container)).toBe('Decision recorded.');
  });

  it('[P2-S12-AC-271] commandState disabled: the reason names the missing record_decision entry of permittedNextActions', async () => {
    const readReview = vi.fn();
    const withoutEntry = mountElement(
      <CmsGovernedReviewDetailIsland
        init={{
          review: governedDetailFixture({ permittedNextActions: [] }),
          reviewId: REVIEW_ID,
          verifiedAt: INSTANT,
        }}
        readReview={readReview}
        environment={governedEnvironment(queuedFetcher([]))}
      />,
    );
    await flush();
    expect(withoutEntry.container.textContent).toContain(
      'You can record a decision only with an effective assignment as a reviewer.',
    );
    expect(
      withoutEntry.container.querySelector('#governed-decision-title'),
    ).toBeNull();
    expect(withoutEntry.container.querySelector('form')).toBeNull();
    withoutEntry.unmount();

    // The same island, with the entry present, offers the form and no reason.
    const withEntry = mountElement(
      <CmsGovernedReviewDetailIsland
        init={{
          review: governedDetailFixture({
            permittedNextActions: ['record_decision'],
          }),
          reviewId: REVIEW_ID,
          verifiedAt: INSTANT,
        }}
        readReview={readReview}
        environment={governedEnvironment(queuedFetcher([]))}
      />,
    );
    await flush();
    expect(withEntry.container.textContent).not.toContain(
      'only with an effective assignment',
    );
    expect(record(withEntry.container)).toBeTruthy();
  });

  it('[P2-S12-AC-271] commandState disabled (unverified read): the commit control is aria-disabled with its reason and sends nothing', async () => {
    const wire = queuedFetcher([decided()]);
    const { container } = mount(wire, {
      disabledReason:
        'The last read could not be verified. Commands are off until it is.',
    });
    expect(
      container.querySelector('[data-cms-workflow-disabled]')?.textContent,
    ).toBe(
      'The last read could not be verified. Commands are off until it is.',
    );
    expect(record(container).getAttribute('aria-disabled')).toBe('true');
    await fillAndRecord(container);
    expect(wire).not.toHaveBeenCalled();
  });
});
