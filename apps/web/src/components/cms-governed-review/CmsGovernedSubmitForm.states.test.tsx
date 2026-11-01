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
  SUBJECT_ID,
  governedReviewFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedReviewPanel, {
  type GovernedPanelSubject,
} from './CmsGovernedReviewPanel';
import {
  GATE,
  RECONCILED,
  WAITING,
  alertOf,
  conflictFor,
  expectOnlyCommitDisabled,
  failureResponse,
  forbiddenFor,
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

const mount = (
  fetcher: ReturnType<typeof vi.fn>,
  props: Partial<React.ComponentProps<typeof CmsGovernedReviewPanel>> = {},
) => {
  const navigate = vi.fn();
  const readSubject = vi.fn(
    async () => subject({ state: 'review' }) as GovernedPanelSubject | null,
  );
  const mounted = mountElement(
    <CmsGovernedReviewPanel
      subject={subject()}
      readSubject={readSubject}
      environment={governedEnvironment(fetcher, undefined, navigate)}
      {...props}
    />,
  );
  return { ...mounted, readSubject, navigate };
};
const submit = (container: HTMLElement) =>
  buttonNamed(container, 'Submit for review');
const send = async (container: HTMLElement) => {
  await click(submit(container));
  await flush();
};

describe('CmsGovernedReviewPanel submit form (CMS-03C-06) commandState', () => {
  it('[P2-S12-AC-271] commandState idle: no form open, or a form with nothing sent', async () => {
    const closed = mount(queuedFetcher([]), {
      subject: subject({ state: 'review' }),
    });
    expect(closed.container.querySelector('form')).toBeNull();
    closed.unmount();

    // The submit form holds no field and no draft: it is open, silent and not withheld.
    const wire = queuedFetcher([submitted()]);
    const open = mount(wire);
    expect(statusOf(open.container)).toBe('');
    expect(submit(open.container).getAttribute('aria-disabled')).toBe('false');
    expect(
      open.container.querySelectorAll('input, textarea, select'),
    ).toHaveLength(0);
    expect(wire).not.toHaveBeenCalled();
  });

  it('[P2-S12-AC-271] commandState loading: a stable pending label and only the commit control disabled', async () => {
    const wire = heldWire();
    const { container } = mount(wire.fetcher);
    await send(container);
    expect(wire.fetcher).toHaveBeenCalledTimes(1);
    expectOnlyCommitDisabled(
      container,
      submit(container),
      'Submit for review',
      'Submitting for review…',
    );
    await click(submit(container));
    expect(wire.fetcher).toHaveBeenCalledTimes(1);
  });

  it('[P2-S12-AC-271] commandState success: the named review, the form closed and the subject refetched', async () => {
    const { container, readSubject } = mount(queuedFetcher([submitted()]));
    await send(container);
    expect(container.querySelector('#governed-panel-result')?.textContent).toBe(
      'Submitted for review',
    );
    expect(
      container.querySelector('[data-cms-workflow-status="island"]')
        ?.textContent,
    ).toBe('Review submitted. It is open for decisions.');
    expect(readSubject).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Lifecycle: In review');
    expect(container.querySelector('form')).toBeNull();
  });

  it('[P2-S12-AC-271] commandState error: a 401 STEP_UP_REQUIRED answer routes to /step-up?returnTo= and never renders a gate (BE03c requires no MFA for this operation)', async () => {
    const wire = queuedFetcher([stepUpRequired()]);
    const { container, navigate } = mount(wire);
    await click(submit(container));
    await flushUntil(() => navigate.mock.calls.length > 0);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]?.[0]).toMatch(/^\/step-up\?returnTo=/u);
    expect(wire).toHaveBeenCalledTimes(1);
    expect(container.querySelector(GATE)).toBeNull();
  });

  it('[P2-S12-AC-271] commandState error: a plain 401 UNAUTHENTICATED answer says the session ended and links to sign-in with the page as returnTo; it is never a step-up route or a gate', async () => {
    const wire = queuedFetcher([failureResponse(401, 'UNAUTHENTICATED')]);
    const { container, navigate } = mount(wire);
    await send(container);
    expect(wire).toHaveBeenCalledTimes(1);
    expect(statusOf(container) + alertOf(container)).toContain(
      'Your session expired. Your entries were not saved.',
    );
    const link = container.querySelector<HTMLAnchorElement>(
      'a[href^="/auth/sign-in?returnTo="]',
    );
    expect(link?.textContent).toBe('Sign in again');
    expect(navigate).not.toHaveBeenCalled();
    expect(container.querySelector('a[href*="step-up"]')).toBeNull();
    expect(container.querySelector(GATE)).toBeNull();
    expect(alertOf(container)).not.toContain('A fixed message.');
  });

  it.each(['capability_missing', 'separation_of_duties'])(
    '[P2-S12-AC-271] commandState error: 403 %s renders the CapabilityGate copy',
    async (reasonCode) => {
      const { container } = mount(queuedFetcher([forbiddenFor(reasonCode)]));
      await send(container);
      expect(container.querySelector(GATE)?.textContent).toContain(
        reasonCode === 'capability_missing'
          ? 'Your account does not have the capability for this action.'
          : 'A different person must do this step.',
      );
      expect(container.querySelector('a[href*="step-up"]')).toBeNull();
    },
  );

  it('[P2-S12-AC-271] commandState error: 409 subject_not_submittable renders fixed copy and refetches the subject', async () => {
    const { container, readSubject } = mount(
      queuedFetcher([conflictFor('subject_not_submittable')]),
    );
    await send(container);
    expect(alertOf(container)).toContain(
      'This version can no longer be submitted. It may already be under review.',
    );
    expect(alertOf(container)).not.toContain('A fixed message.');
    expect(readSubject).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'gear',
      'The gear reference list is not available yet, so this vocabulary cannot be submitted.',
    ],
    [
      null,
      'A reference list this vocabulary declares is not available yet, so it cannot be submitted.',
    ],
  ])(
    '[P2-S12-AC-271] commandState error: 422 canonical_source_unavailable (domain %s) renders fixed copy in the form (it has no field to mark)',
    async (domain, sentence) => {
      const { container } = mount(
        queuedFetcher([
          invalidFor(
            'canonical_source_unavailable',
            domain === null ? {} : { domain },
          ),
        ]),
      );
      await send(container);
      expect(alertOf(container)).toContain(sentence);
      expect(alertOf(container)).not.toContain('A fixed message.');
    },
  );

  it('[P2-S12-AC-271] commandState degraded: an unknown outcome renders pending and reconciles by refetching the subject before any retry', async () => {
    const lost = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(submitted());
    let release: (next: GovernedPanelSubject | null) => void = () => undefined;
    const readSubject = vi.fn(
      () =>
        new Promise<GovernedPanelSubject | null>((resolve) => {
          release = resolve;
        }),
    );
    const { container } = mount(lost, { readSubject });
    await send(container);
    expect(statusOf(container)).toBe(WAITING);
    expect(readSubject).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    const retry = buttonNamed(container, 'Retry the same request');
    expect(retry.getAttribute('aria-disabled')).toBe('true');
    await click(retry);
    expect(lost).toHaveBeenCalledTimes(1);
    release(subject());
    await flush();
    expect(statusOf(container)).toBe(RECONCILED);
    await click(retry);
    await flush();
    expect(lost).toHaveBeenCalledTimes(2);
    expect(headersOf(lost, 1).get('idempotency-key')).toBe(KEY);
  });

  it('[P2-S12-AC-271] commandState disabled (kept half): a lifecycle state names why there is no form, and an unverified read withholds the commit; the panel has no permittedNextActions input', async () => {
    const review = mount(queuedFetcher([]), {
      subject: subject({ state: 'review' }),
    });
    expect(review.container.querySelector('form')).toBeNull();
    expect(review.container.textContent).toContain(
      "Needs an independent reviewer's approval",
    );
    review.unmount();

    const wire = queuedFetcher([submitted()]);
    const withheld = mount(wire, {
      disabledReason: 'The current state could not be verified.',
    });
    expect(
      withheld.container.querySelector('[data-cms-workflow-disabled]')
        ?.textContent,
    ).toBe('The current state could not be verified.');
    expect(submit(withheld.container).getAttribute('aria-disabled')).toBe(
      'true',
    );
    await send(withheld.container);
    expect(wire).not.toHaveBeenCalled();
  });
});
