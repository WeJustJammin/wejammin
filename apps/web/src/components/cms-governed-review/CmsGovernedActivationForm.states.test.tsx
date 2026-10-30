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
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  INSTANT,
  KEY,
  REVIEW_ID,
  governedActivationFixture,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedReviewDetailIsland from './CmsGovernedReviewDetailIsland';
import {
  accepted,
  activeReview,
  approvedReview,
  choosing,
  continueButton,
  mountActivation,
  radio,
  statusLine,
} from './governed-activation-form.test-support';
import {
  GATE,
  RECONCILED,
  WAITING,
  alertOf,
  conflictFor,
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
// The 218 KB tz snapshot is slow on a loaded host; waits are conditions, not budgets.
vi.setConfig({ testTimeout: 90_000 });
beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);

const activate = async (container: HTMLElement) => {
  await choosing(container, 'Activate now');
  await click(continueButton(container));
  await click(buttonNamed(container, 'Activate this version'));
};
const schedule = async (container: HTMLElement) => {
  await choosing(container, 'Schedule activation');
  await flush();
  await typeInto(
    byLabel<HTMLInputElement>(container, 'Local date and time'),
    '2026-12-01T09:00',
  );
  await typeInto(
    byLabel<HTMLInputElement>(container, 'Time zone'),
    'America/New_York',
  );
  await click(continueButton(container));
  await click(buttonNamed(container, 'Schedule activation'));
};
const done = () => accepted(200, governedActivationFixture(), '"3"');

describe('CmsGovernedActivationForm (CMS-03C-09 activate, schedule, retire) commandState', () => {
  it('[P2-S12-AC-271] commandState idle: no form open, or a form with an unsent scoped draft', async () => {
    const none = mountActivation([], {
      review: approvedReview({ permittedNextActions: ['record_decision'] }),
    });
    expect(none.container.textContent).toBe('');
    none.unmount();

    const first = mountActivation([stepUpRequired()]);
    await choosing(first.container, 'Activate now');
    expect(first.fetcher).not.toHaveBeenCalled();
    expect(first.storage.length).toBe(0);
    expect(statusLine(first.container)).toBe('');
    expect(radio(first.container, 'Activate now').checked).toBe(true);
    await click(continueButton(first.container));
    await click(buttonNamed(first.container, 'Activate this version'));
    await flushUntil(() => first.navigate.mock.calls.length > 0);
    first.unmount();

    // The scoped draft (the choice, never an instant) returns and waits for a new confirmation.
    const returned = mountActivation([], {}, first.storage);
    await flush();
    expect(radio(returned.container, 'Activate now').checked).toBe(true);
    expect(statusLine(returned.container)).toBe(
      'Your entries were restored. Review them, then confirm.',
    );
    expect(returned.fetcher).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-271] commandState loading: a stable pending label with the commit control disabled and busy; no field is withheld; Continue and Cancel stay aria-disabled while the command runs (DEC-241 item 2)', async () => {
    const wire = heldWire();
    const { container } = mountActivation([], {
      environment: governedEnvironment(wire.fetcher),
    });
    await activate(container);
    await flush();
    expect(wire.fetcher).toHaveBeenCalledTimes(1);
    const commit = buttonNamed(container, 'Activate this version');
    expect(statusOf(container)).toBe('Activating…');
    expect(commit.textContent).toBe('Activate this version');
    expect(commit.getAttribute('aria-disabled')).toBe('true');
    expect(commit.getAttribute('aria-busy')).toBe('true');
    // No field is withheld: the choices stay editable.
    expect(
      [...container.querySelectorAll('input, textarea, select')].some(
        (control) =>
          control.hasAttribute('disabled') ||
          control.getAttribute('aria-disabled') === 'true',
      ),
    ).toBe(false);
    await click(commit);
    expect(wire.fetcher).toHaveBeenCalledTimes(1);
  });

  it('[P2-S12-AC-271] commandState success: the named resource, stored draft cleared, the chosen action cleared and review refetched', async () => {
    const { container, refetch, onDone, storage } = mountActivation([done()]);
    await activate(container);
    await flush();
    expect(statusLine(container)).toBe(
      'Activated, not published: Template profile-header, version 2 is now the active version. Version 1 is now superseded.',
    );
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('governed-summary-title');
    expect(storage.length).toBe(0);
    expect(
      container.querySelector('#governed-activation-confirm-title'),
    ).toBeNull();
    expect(
      container.querySelectorAll('input[type="radio"]:checked'),
    ).toHaveLength(0);
  });

  it('[P2-S12-AC-271] commandState error: 401 STEP_UP_REQUIRED routes to /step-up?returnTo= and never renders a gate', async () => {
    const { container, fetcher, navigate } = mountActivation([
      stepUpRequired(),
    ]);
    await activate(container);
    await flushUntil(() => navigate.mock.calls.length > 0);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toMatch(/^\/step-up\?returnTo=/u);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(container.querySelector(GATE)).toBeNull();
    expect(statusOf(container)).toBe('Opening verification…');
  });

  it('[P2-S12-AC-271] commandState error: 403 capability_missing renders the CapabilityGate copy', async () => {
    const { container } = mountActivation([forbiddenFor('capability_missing')]);
    await activate(container);
    await flush();
    expect(container.querySelector(GATE)?.textContent).toContain(
      'Your account does not have the capability for this action.',
    );
    expect(container.querySelector('a[href*="step-up"]')).toBeNull();
  });

  it.each([
    [
      'subject_not_activatable',
      'This version can no longer be activated or scheduled. Its state changed; review it before acting again.',
    ],
    [
      'subject_not_retirable',
      'Only an active version can be retired, and this version is not active now.',
    ],
    [
      'activation_conflict',
      'Another version of this lineage was activated first. Nothing changed. Review the current state before acting again.',
    ],
    ['schedule_exists', 'This version already has a scheduled activation.'],
    [
      'dependency_changed',
      'A dependency of this version changed, so its review was invalidated and the version is back to draft. Nothing was activated or scheduled.',
    ],
  ])(
    '[P2-S12-AC-271] commandState error: 409 %s renders fixed copy and refetches',
    async (reasonCode, sentence) => {
      const { container, refetch } = mountActivation([conflictFor(reasonCode)]);
      await activate(container);
      await flush();
      expect(alertOf(container)).toContain(sentence);
      expect(alertOf(container)).not.toContain('A fixed message.');
      expect(refetch).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['unknown_timezone', 'That time zone is not recognised.', 'Time zone'],
    [
      'resolved_utc_mismatch',
      'The resolved time did not match. Choose the time again.',
      'Local date and time',
    ],
    [
      'schedule_out_of_horizon',
      'Choose a time between one minute and 366 days from now.',
      'Local date and time',
    ],
    [
      'authority_ends_before_schedule',
      'Your owner access ends before this time. Choose an earlier time.',
      'Local date and time',
    ],
  ])(
    '[P2-S12-AC-271] commandState error: 422 %s renders fixed copy at the field',
    async (reasonCode, sentence, label) => {
      const { container } = mountActivation([invalidFor(reasonCode)]);
      await schedule(container);
      await flush();
      expect(alertOf(container)).toContain(sentence);
      expect(alertOf(container)).not.toContain('A fixed message.');
      expect(byLabel(container, label).getAttribute('aria-invalid')).toBe(
        'true',
      );
    },
  );

  it('[P2-S12-AC-271] commandState error: 422 canonical_source_unavailable renders fixed copy naming the domain (no field exists to mark)', async () => {
    const { container } = mountActivation([
      invalidFor('canonical_source_unavailable', { domain: 'gear' }),
    ]);
    await activate(container);
    await flush();
    expect(alertOf(container)).toContain(
      'The gear reference list is not available yet, so this vocabulary cannot be activated or scheduled.',
    );
  });

  it('[P2-S12-AC-271] commandState degraded: an unknown outcome renders pending and reconciles by refetching the review before any retry', async () => {
    const lost = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(done());
    const reread = heldReread();
    const { container } = mountActivation([], {
      environment: governedEnvironment(lost),
      refetch: reread.refetch,
    });
    await activate(container);
    await flush();
    expect(statusOf(container)).toBe(WAITING);
    expect(reread.refetch).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    const retry = buttonNamed(container, 'Retry the same request');
    expect(retry.getAttribute('aria-disabled')).toBe('true');
    await click(retry);
    expect(lost).toHaveBeenCalledTimes(1);
    reread.release(true);
    await flush();
    expect(statusOf(container)).toBe(RECONCILED);
    await click(retry);
    await flush();
    expect(lost).toHaveBeenCalledTimes(2);
    expect(headersOf(lost, 1).get('idempotency-key')).toBe(KEY);
    expect(statusLine(container)).toContain('Activated, not published');
  });

  it('[P2-S12-AC-271] commandState disabled: the reason names the missing activate, schedule or retire entry of permittedNextActions', async () => {
    // An approved version waiting for its owner: the reader has no activate or schedule entry.
    const element = (permittedNextActions: string[], subjectState: string) => (
      <CmsGovernedReviewDetailIsland
        init={{
          review: approvedReview({ permittedNextActions, subjectState }),
          reviewId: REVIEW_ID,
          verifiedAt: INSTANT,
        }}
        readReview={vi.fn()}
        environment={governedEnvironment(queuedFetcher([]))}
      />
    );
    const waiting = mountElement(element(['record_decision'], 'approved'));
    await flush();
    expect(waiting.container.textContent).toContain(
      'Only the owner of this version can activate or schedule it.',
    );
    expect(
      waiting.container.querySelector('#governed-activation-title'),
    ).toBeNull();
    waiting.unmount();
    const active = mountElement(element(['record_decision'], 'active'));
    await flush();
    expect(active.container.textContent).toContain(
      'Only the owner of this version can retire it.',
    );
    expect(
      active.container.querySelector('#governed-activation-title'),
    ).toBeNull();
    active.unmount();

    // Withheld by an unverified read: the confirmation cannot be committed and says why.
    const wire = heldWire();
    const open = mountActivation([], {
      review: activeReview(),
      disabledReason:
        'The last read could not be verified. Commands are off until it is.',
      environment: governedEnvironment(wire.fetcher),
    });
    expect(
      open.container.querySelector('[data-cms-workflow-disabled]')?.textContent,
    ).toBe(
      'The last read could not be verified. Commands are off until it is.',
    );
    expect(continueButton(open.container).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });
});
