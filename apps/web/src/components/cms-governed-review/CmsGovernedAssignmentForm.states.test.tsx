// @vitest-environment jsdom
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
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { localInputValue } from '../cms-editorial-workflow/cms-workflow-expiry';
import { KEY } from '../../server/cms-governed-review-fixtures.test-support';
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
  headersOf,
  queuedFetcher,
} from './governed-review-form-test-support';
import {
  NOW,
  DAY,
  review,
  created,
  revoked,
  mount,
  ends,
  why,
  assign,
  revoke,
  revokeFrame,
  fill,
  create,
} from './CmsGovernedAssignmentForm.states.test-support';

beforeAll(preloadWorkflowAnswerMachinery);
beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);

describe('CmsGovernedAssignmentForm (CMS-03C-08 create and revoke) commandState', () => {
  it('[P2-S12-AC-271] commandState idle: no form open, or a form with an unsent scoped draft', async () => {
    const none = mount(queuedFetcher([]), {
      review: review(['record_decision']),
    });
    await flush();
    expect(none.container.textContent).toBe('');
    none.unmount();

    const wire = queuedFetcher([stepUpRequired()]);
    const first = mount(wire);
    await fill(first.container);
    expect(wire).not.toHaveBeenCalled();
    expect(first.storage.length).toBe(0);
    expect(statusOf(first.container)).toBe('');
    expect(why(first.container).value).toBe('Legal slot.');
    expect(assign(first.container).getAttribute('aria-disabled')).toBe('false');
    expect(revoke(first.container).getAttribute('aria-disabled')).toBe('false');
    await click(assign(first.container));
    await flushUntil(() => first.navigate.mock.calls.length > 0);
    first.unmount();

    const returned = mount(queuedFetcher([]), {}, first.storage);
    await flush();
    expect(ends(returned.container).value).toBe(localInputValue(NOW + DAY));
    expect(why(returned.container).value).toBe('Legal slot.');
    expect(returned.container.textContent).toContain(
      'Choose the reviewer again.',
    );
  });

  it('[P2-S12-AC-271] commandState loading: a stable pending label and only the commit control disabled', async () => {
    const createWire = heldWire();
    const assigning = mount(createWire.fetcher);
    await create(assigning.container);
    await flush();
    expect(createWire.fetcher).toHaveBeenCalledTimes(1);
    expectOnlyCommitDisabled(
      assigning.container,
      assign(assigning.container),
      'Assign reviewer',
      'Assigning reviewer…',
    );
    expect(ends(assigning.container).disabled).toBe(false);
    expect(why(assigning.container).disabled).toBe(false);
    assigning.unmount();

    const revokeWire = heldWire();
    const revoking = mount(revokeWire.fetcher);
    await click(revoke(revoking.container));
    await flush();
    expect(revokeWire.fetcher).toHaveBeenCalledTimes(1);
    const button = revoke(revoking.container);
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(statusOf(revokeFrame(revoking.container))).toBe(
      'Revoking assignment…',
    );
    expect(
      [...revoking.container.querySelectorAll('input, textarea, select')].some(
        (control) => control.hasAttribute('disabled'),
      ),
    ).toBe(false);
    await click(button);
    expect(revokeWire.fetcher).toHaveBeenCalledTimes(1);
  });

  it('[P2-S12-AC-271] commandState success: the named resources, stored draft cleared, typed create fields cleared and review refetched', async () => {
    const assigning = mount(queuedFetcher([created()]));
    await create(assigning.container);
    await flush();
    expect(statusOf(assigning.container)).toContain('Reviewer assigned until');
    expect(assigning.refetch).toHaveBeenCalledTimes(1);
    expect(assigning.onDone).toHaveBeenCalledWith('governed-assignments-title');
    expect(assigning.storage.length).toBe(0);
    expect(why(assigning.container).value).toBe('');
    expect(ends(assigning.container).value).toBe('');
    expect(
      byLabel<HTMLSelectElement>(assigning.container, 'Reviewer').value,
    ).toBe('');
    assigning.unmount();

    const revoking = mount(queuedFetcher([revoked()]));
    await click(revoke(revoking.container));
    await flush();
    expect(statusOf(revokeFrame(revoking.container))).toBe(
      'Assignment revoked.',
    );
    expect(revoking.refetch).toHaveBeenCalledTimes(1);
    expect(revoking.onDone).toHaveBeenCalledWith('governed-assignments-title');
    expect(revoking.storage.length).toBe(0);
  });

  it('[P2-S12-AC-271] commandState error: 401 STEP_UP_REQUIRED routes to /step-up?returnTo= and never renders a gate', async () => {
    const createWire = queuedFetcher([stepUpRequired()]);
    const assigning = mount(createWire);
    await create(assigning.container);
    await flushUntil(() => assigning.navigate.mock.calls.length > 0);
    expectStepUpRoute(assigning.container, assigning.navigate, createWire);
    assigning.unmount();

    const revokeWire = queuedFetcher([stepUpRequired()]);
    const revoking = mount(revokeWire);
    await click(revoke(revoking.container));
    await flushUntil(() => revoking.navigate.mock.calls.length > 0);
    expectStepUpRoute(
      revoking.container,
      revoking.navigate,
      revokeWire,
      revokeFrame(revoking.container),
    );
  });

  it('[P2-S12-AC-271] commandState error: 403 capability_missing renders the CapabilityGate copy', async () => {
    const assigning = mount(
      queuedFetcher([forbiddenFor('capability_missing')]),
    );
    await create(assigning.container);
    await flush();
    expect(assigning.container.querySelector(GATE)?.textContent).toContain(
      'Your account does not have the capability for this action.',
    );
    expect(assigning.container.querySelector('a[href*="step-up"]')).toBeNull();
    assigning.unmount();

    const revoking = mount(queuedFetcher([forbiddenFor('capability_missing')]));
    await click(revoke(revoking.container));
    await flush();
    expect(revoking.container.querySelector(GATE)?.textContent).toContain(
      'Your account does not have the capability for this action.',
    );
  });

  it.each([
    ['review_not_open', 'This review is no longer open.'],
    [
      'assignment_exists',
      'That reviewer already has an active assignment on this review.',
    ],
    [
      'assignment_limit',
      'This review already has the maximum of 16 active assignments.',
    ],
  ])(
    '[P2-S12-AC-271] commandState error: 409 %s renders fixed copy and refetches (create and revoke)',
    async (reasonCode, sentence) => {
      const assigning = mount(queuedFetcher([conflictFor(reasonCode)]));
      await create(assigning.container);
      await flush();
      expect(alertOf(assigning.container)).toContain(sentence);
      expect(alertOf(assigning.container)).not.toContain('A fixed message.');
      expect(assigning.refetch).toHaveBeenCalledTimes(1);
      assigning.unmount();

      const revoking = mount(queuedFetcher([conflictFor(reasonCode)]));
      await click(revoke(revoking.container));
      await flush();
      expect(alertOf(revoking.container)).toContain(sentence);
      expect(revoking.refetch).toHaveBeenCalledTimes(1);
    },
  );

  it('[P2-S12-AC-271] commandState error: 409 reviewer_not_eligible renders the one uniform copy at the reviewer field and refetches the review (FE03 884, DEC-242)', async () => {
    const { container, refetch } = mount(
      queuedFetcher([conflictFor('reviewer_not_eligible')]),
    );
    await create(container);
    await flush();
    expect(alertOf(container)).toContain(
      'That person cannot be assigned to this review.',
    );
    expect(
      container.querySelector(
        '[role="alert"] a[href="#governed-assignment-reviewer"]',
      ),
    ).not.toBeNull();
    // FE03 884 gives the fixed copy and 1049 says 409 reasons "refetch": the review is read again (DEC-242).
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('[P2-S12-AC-271] commandState error: 422 expiry_out_of_bounds renders fixed copy at the expiry field', async () => {
    const { container } = mount(
      queuedFetcher([
        invalidFor('expiry_out_of_bounds', {
          violations: [{ path: '/expiresAt', code: 'invalid' }],
        }),
      ]),
    );
    await create(container);
    await flush();
    expect(alertOf(container)).toContain(
      'Choose an expiry within seven days that ends before the reviewer access ends.',
    );
    expect(ends(container).getAttribute('aria-invalid')).toBe('true');
    expect(
      container.querySelector(
        '[role="alert"] a[href="#governed-assignment-expires"]',
      )?.textContent,
    ).toBe('Assignment ends');
  });

  it('[P2-S12-AC-271] commandState degraded: an unknown outcome renders pending and reconciles by refetching the review before any retry', async () => {
    const lost = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(created());
    const reread = heldReread();
    const assigning = mount(lost, { refetch: reread.refetch });
    await create(assigning.container);
    await flush();
    expect(statusOf(assigning.container)).toBe(WAITING);
    expect(reread.refetch).toHaveBeenCalledTimes(1);
    expect(assigning.container.querySelector('[role="alert"]')).toBeNull();
    const retry = buttonNamed(assigning.container, 'Retry the same request');
    expect(retry.getAttribute('aria-disabled')).toBe('true');
    await click(retry);
    expect(lost).toHaveBeenCalledTimes(1);
    reread.release(true);
    await flush();
    expect(statusOf(assigning.container)).toBe(RECONCILED);
    await click(retry);
    await flush();
    expect(lost).toHaveBeenCalledTimes(2);
    expect(headersOf(lost, 1).get('idempotency-key')).toBe(KEY);
    assigning.unmount();

    const lostRevoke = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(revoked());
    const second = heldReread();
    const revoking = mount(lostRevoke, { refetch: second.refetch });
    await click(revoke(revoking.container));
    await flush();
    expect(statusOf(revokeFrame(revoking.container))).toBe(WAITING);
    expect(second.refetch).toHaveBeenCalledTimes(1);
    await click(buttonNamed(revoking.container, 'Retry the same request'));
    expect(lostRevoke).toHaveBeenCalledTimes(1);
    second.release(true);
    await flush();
    await click(buttonNamed(revoking.container, 'Retry the same request'));
    await flush();
    expect(lostRevoke).toHaveBeenCalledTimes(2);
    expect(statusOf(revokeFrame(revoking.container))).toBe(
      'Assignment revoked.',
    );
  });

  it('[P2-S12-AC-271] commandState disabled: an unverified read withholds both controls with its reason (the missing assign_reviewer entry is stated by the island, CmsGovernedReviewDetailIsland.test.tsx)', async () => {
    const wire = queuedFetcher([created()]);
    const { container } = mount(wire, {
      disabledReason:
        'The last read could not be verified. Commands are off until it is.',
    });
    await fill(container);
    expect(
      [...container.querySelectorAll('[data-cms-workflow-disabled]')].map(
        (reason) => reason.textContent,
      ),
    ).toEqual([
      'The last read could not be verified. Commands are off until it is.',
      'The last read could not be verified. Commands are off until it is.',
    ]);
    expect(assign(container).getAttribute('aria-disabled')).toBe('true');
    expect(revoke(container).getAttribute('aria-disabled')).toBe('true');
    await click(assign(container));
    await click(revoke(container));
    expect(wire).not.toHaveBeenCalled();
  });
});
