// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';

import { MemoryStorage } from '../../lib/test-support/memory-storage';
import { loadCmsValidators } from '../../lib/cms-contract-validators';
import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  KEY,
  governedActivationFixture,
  governedRetiredFixture,
} from '../../server/cms-governed-review-fixtures.test-support';
import {
  accepted,
  activeReview,
  apiFailure,
  approvedReview,
  choosing,
  continueButton,
  mountActivation,
  radio,
  statusLine,
  stepUp,
} from './governed-activation-form.test-support';
import {
  bodyOf,
  flushUntil,
  headersOf,
} from './governed-review-form-test-support';

beforeAll(preloadWorkflowAnswerMachinery);

beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);

const confirm = (container: HTMLElement, name: string) =>
  buttonNamed(container, name);

describe('retirement', () => {
  const retireMount = (responses: readonly Response[]) =>
    mountActivation(responses, { review: activeReview() });
  const reasonField = (container: HTMLElement) =>
    byLabel<HTMLTextAreaElement>(container, 'Reason (optional)');

  it('names the consequence and offers an optional reason with a counter of 256', async () => {
    const { container } = retireMount([]);
    await choosing(container, 'Retire this version');
    expect(container.textContent).toContain(
      'Entries bound to this version can no longer publish.',
    );
    expect(
      container.querySelector('#governed-activation-reason-counter')
        ?.textContent,
    ).toBe('0 of 256 characters');
  });

  it('retires without a reason and omits the member', async () => {
    const { container, fetcher, onDone } = retireMount([
      accepted(200, governedRetiredFixture(), '"3"'),
    ]);
    await choosing(container, 'Retire this version');
    await click(continueButton(container));
    expect(
      container.querySelector('#governed-activation-confirm-title')
        ?.textContent,
    ).toBe('Confirm retirement');
    expect(container.textContent).toContain(
      'Retire Template profile-header, version 2.',
    );
    await click(confirm(container, 'Retire this version'));
    await flush();
    expect(bodyOf(fetcher)).toEqual({ action: 'retire', expectedVersion: '2' });
    expect(onDone).toHaveBeenCalledWith('governed-summary-title');
    expect(statusLine(container)).toBe(
      'Retired: Template profile-header, version 2. Entries bound to this version can no longer publish.',
    );
  });

  it('sends the reason when given', async () => {
    const { container, fetcher } = retireMount([
      accepted(200, governedRetiredFixture(), '"3"'),
    ]);
    await choosing(container, 'Retire this version');
    await typeInto(reasonField(container), 'Superseded by the redesign.');
    await click(continueButton(container));
    await click(confirm(container, 'Retire this version'));
    await flush();
    expect(bodyOf(fetcher)).toEqual({
      action: 'retire',
      expectedVersion: '2',
      reason: 'Superseded by the redesign.',
    });
  });

  it.each([
    {
      name: 'a 257-character reason',
      reason: 'x'.repeat(257),
      sentence: 'Use at most 256 characters.',
    },
    {
      name: 'a decomposed accent (not NFC)',
      reason: 'é',
      sentence: 'Use the composed form of accented letters (Unicode NFC).',
    },
  ])(
    'refuses an invalid reason inline, sending nothing ($name)',
    async ({ reason, sentence }) => {
      const { container, fetcher } = retireMount([]);
      await choosing(container, 'Retire this version');
      await typeInto(reasonField(container), reason);
      await click(continueButton(container));
      expect(
        container.querySelector('[data-cms-workflow-local-errors]')
          ?.textContent,
      ).toContain(sentence);
      expect(reasonField(container).getAttribute('aria-invalid')).toBe('true');
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
});

describe('unconditional step-up (DEC-111)', () => {
  it('routes a shortfall to verification with the choice stored, replaying nothing', async () => {
    const { container, fetcher, storage, navigate } = mountActivation(
      [stepUp()],
      { review: activeReview() },
    );
    await choosing(container, 'Retire this version');
    await typeInto(
      byLabel<HTMLTextAreaElement>(container, 'Reason (optional)'),
      'Old.',
    );
    await click(continueButton(container));
    await click(confirm(container, 'Retire this version'));
    await flushUntil(() => navigate.mock.calls.length > 0);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toMatch(/^\/step-up\?returnTo=/u);
    const stored = JSON.parse(
      storage.getItem('wj-step-up-draft:cms:/:CMS-03C-09') as string,
    ) as {
      values: Record<string, string>;
      idempotencyKey: string;
      expectedVersion: string;
    };
    expect(stored.values).toMatchObject({ action: 'retire', reason: 'Old.' });
    expect(stored.idempotencyKey).toBe(KEY);
    expect(stored.expectedVersion).toBe('2');
  });

  it('restores the entries, waits for a new confirmation and resubmits under the original key once', async () => {
    const storage = new MemoryStorage();
    const first = mountActivation(
      [stepUp()],
      { review: activeReview() },
      storage,
    );
    await choosing(first.container, 'Retire this version');
    await typeInto(
      byLabel<HTMLTextAreaElement>(first.container, 'Reason (optional)'),
      'Old.',
    );
    await click(continueButton(first.container));
    await click(confirm(first.container, 'Retire this version'));
    await flushUntil(
      () => storage.getItem('wj-step-up-draft:cms:/:CMS-03C-09') !== null,
    );
    first.unmount();

    const returned = mountActivation(
      [accepted(200, governedRetiredFixture(), '"3"')],
      { review: activeReview() },
      storage,
    );
    await flush();
    expect(returned.fetcher).not.toHaveBeenCalled();
    expect(radio(returned.container, 'Retire this version').checked).toBe(true);
    expect(
      byLabel<HTMLTextAreaElement>(returned.container, 'Reason (optional)')
        .value,
    ).toBe('Old.');
    expect(statusLine(returned.container)).toBe(
      'Your entries were restored. Review them, then confirm.',
    );
    await click(continueButton(returned.container));
    await click(confirm(returned.container, 'Retire this version'));
    await flush();
    expect(returned.fetcher).toHaveBeenCalledTimes(1);
    expect(headersOf(returned.fetcher).get('idempotency-key')).toBe(KEY);
  });

  it('opens a sync conflict when the review version moved while verifying', async () => {
    const storage = new MemoryStorage();
    const first = mountActivation(
      [stepUp()],
      { review: activeReview() },
      storage,
    );
    await choosing(first.container, 'Retire this version');
    await click(continueButton(first.container));
    await click(confirm(first.container, 'Retire this version'));
    await flushUntil(
      () => storage.getItem('wj-step-up-draft:cms:/:CMS-03C-09') !== null,
    );
    first.unmount();
    const returned = mountActivation(
      [],
      { review: activeReview({ version: '9' }) },
      storage,
    );
    await flush();
    expect(
      returned.container.querySelector('[data-cms-editorial-sync-conflict]')
        ?.textContent,
    ).toContain('version 2');
    await click(continueButton(returned.container));
    expect(returned.fetcher).not.toHaveBeenCalled();
  });

  it('shows the degraded state when no verification method is available', async () => {
    const { container } = mountActivation([stepUp(['sms'])]);
    await choosing(container, 'Activate now');
    await click(continueButton(container));
    await click(confirm(container, 'Activate this version'));
    await flushUntil(() => container.querySelector('[role="alert"]') !== null);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'No verification method is available.',
    );
  });
});

describe('refusals and unknown outcomes', () => {
  const submitActivation = async (responses: readonly Response[]) => {
    const mounted = mountActivation(responses);
    await choosing(mounted.container, 'Activate now');
    await click(continueButton(mounted.container));
    await click(confirm(mounted.container, 'Activate this version'));
    await flush();
    return mounted;
  };

  it.each([
    [
      'subject_not_activatable',
      'This version can no longer be activated or scheduled.',
    ],
    [
      'activation_conflict',
      'Another version of this lineage was activated first.',
    ],
    ['schedule_exists', 'This version already has a scheduled activation.'],
    [
      'dependency_changed',
      'its review was invalidated and the version is back to draft',
    ],
  ])(
    'states why for %s and re-reads the review',
    async (reasonCode, sentence) => {
      const { container, refetch } = await submitActivation([
        apiFailure(409, 'GOVERNED_REVIEW_VERSION_CONFLICT', { reasonCode }),
      ]);
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        sentence,
      );
      expect(refetch).toHaveBeenCalledTimes(1);
    },
  );

  it('names the domain whose provider is not available for a vocabulary', async () => {
    const { container, refetch } = await submitActivation([
      apiFailure(422, 'GOVERNED_REVIEW_VALIDATION_FAILED', {
        reasonCode: 'canonical_source_unavailable',
        domain: 'rights',
      }),
    ]);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'The rights reference list is not available yet, so this vocabulary cannot be activated or scheduled.',
    );
    expect(refetch).not.toHaveBeenCalled();
  });

  it('renders the capability gate and never a step-up route for a 403', async () => {
    const { container } = await submitActivation([
      apiFailure(403, 'GOVERNED_REVIEW_FORBIDDEN', {
        reasonCode: 'capability_missing',
      }),
    ]);
    expect(
      container.querySelector('[data-cms-editorial-capability-gate]')
        ?.textContent,
    ).toContain('Your account does not have the capability');
    expect(container.querySelector('a[href*="step-up"]')).toBeNull();
  });

  it('keeps the frame and its sentence when the re-read removes the action', async () => {
    const { container, rerender } = await submitActivation([
      apiFailure(409, 'GOVERNED_REVIEW_VERSION_CONFLICT', {
        reasonCode: 'subject_not_activatable',
      }),
    ]);
    const { createElement } = await import('react');
    const { default: Form } = await import('./CmsGovernedActivationForm');
    rerender(
      createElement(Form, {
        review: approvedReview({ version: '3', permittedNextActions: [] }),
        disabledReason: null,
        refetch: async () => true,
        onDone: vi.fn(),
      }),
    );
    await flush();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'This version can no longer be activated or scheduled.',
    );
  });

  it('keeps the entries and offers a reconciled retry under the same key after a lost answer', async () => {
    const { container, fetcher, refetch } = await submitActivation([
      apiFailure(504, 'DEPENDENCY_UNAVAILABLE'),
      accepted(200, governedActivationFixture(), '"3"'),
    ]);
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(statusLine(container)).toBe(
      'The current state is loaded. You can retry the same request.',
    );
    await click(buttonNamed(container, 'Retry the same request'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(headersOf(fetcher, 0).get('idempotency-key')).toBe(KEY);
    expect(headersOf(fetcher, 1).get('idempotency-key')).toBe(KEY);
  });

  it('refuses to send while the read behind the form is not verified', async () => {
    const { container, fetcher } = mountActivation(
      [accepted(200, governedActivationFixture(), '"3"')],
      { disabledReason: 'Reload the page.' },
    );
    await choosing(container, 'Activate now');
    await click(continueButton(container));
    expect(container.textContent).toContain('Reload the page.');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
