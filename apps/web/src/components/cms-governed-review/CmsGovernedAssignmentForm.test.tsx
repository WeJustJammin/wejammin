// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import { MemoryStorage } from '../../lib/test-support/memory-storage';
import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountWithIntent,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { localInputValue } from '../cms-editorial-workflow/cms-workflow-expiry';
import {
  ASSIGNMENT_ID,
  KEY,
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  governedApiError,
  governedAssignmentFixture,
  governedAssignmentSummaryFixture,
  governedDetailFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedAssignmentForm from './CmsGovernedAssignmentForm';
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
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);

const NOW = Date.parse('2026-10-08T12:00:00Z');
const DAY = 24 * 3_600_000;
const OTHER_PERSON = '123e4567-e89b-42d3-a456-42661417400d';

const review = (
  version = '2',
  assignments: unknown[] = [governedAssignmentSummaryFixture()],
  permittedNextActions = ['assign_reviewer', 'revoke_assignment'],
) => governedDetailFixture({ version, permittedNextActions, assignments });

const options = [
  {
    personId: REVIEWER_PERSON_ID,
    endsAt: new Date(NOW + 30 * DAY).toISOString(),
  },
  { personId: OTHER_PERSON, endsAt: new Date(NOW + 2 * DAY).toISOString() },
];

const created = () =>
  jsonResponse(201, governedAssignmentFixture(), { etag: '"1"' });
const revoked = () =>
  jsonResponse(200, governedAssignmentFixture({ state: 'revoked' }), {
    etag: '"1"',
  });
const error = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
) => jsonResponse(status, governedApiError(code, 'A fixed message.', details));
const stepUp = () =>
  error(401, 'STEP_UP_REQUIRED', {
    recoveryAction: 'step_up',
    allowedMethods: ['totp'],
  });

const mount = (
  responses: readonly Response[],
  extra: Partial<React.ComponentProps<typeof CmsGovernedAssignmentForm>> = {},
  storage = new MemoryStorage(),
) => {
  const fetcher = queuedFetcher(responses);
  const refetch = vi.fn(async () => true);
  const onDone = vi.fn();
  const navigate = vi.fn();
  const mounted = mountWithIntent(
    <CmsGovernedAssignmentForm
      review={review()}
      disabledReason={null}
      refetch={refetch}
      onDone={onDone}
      now={() => NOW}
      loadOptions={async () => ({ kind: 'ok', options })}
      environment={governedEnvironment(fetcher, storage, navigate)}
      {...extra}
    />,
  );
  return { ...mounted, fetcher, refetch, onDone, navigate, storage };
};

const fillCreate = async (
  container: HTMLElement,
  person = REVIEWER_PERSON_ID,
  expires = localInputValue(NOW + DAY),
  reason?: string,
) => {
  await flush();
  await choose(byLabel<HTMLSelectElement>(container, 'Reviewer'), person);
  await typeInto(
    byLabel<HTMLInputElement>(container, 'Assignment ends'),
    expires,
  );
  if (reason !== undefined)
    await typeInto(
      byLabel<HTMLTextAreaElement>(container, 'Reason (optional)'),
      reason,
    );
};

describe('CmsGovernedAssignmentForm visibility (CMS-03C-08)', () => {
  it('renders only the controls the server permits', async () => {
    const both = mount([]);
    await flush();
    expect(
      both.container.querySelector('#governed-assignment-create-title'),
    ).not.toBeNull();
    expect(
      both.container.querySelector('#governed-assignment-revoke-title'),
    ).not.toBeNull();
    both.unmount();
    const none = mount([], { review: review('2', [], ['record_decision']) });
    await flush();
    expect(none.container.querySelector('[data-cms-workflow-form]')).toBeNull();
    none.unmount();
    const revokedOnly = mount([], {
      review: review('2', [
        governedAssignmentSummaryFixture({ state: 'revoked' }),
      ]),
    });
    await flush();
    expect(
      revokedOnly.container.querySelector('#governed-assignment-revoke-title'),
    ).toBeNull();
    revokedOnly.unmount();
    const createOnly = mount([], {
      review: review('2', [], ['assign_reviewer']),
    });
    await flush();
    expect(
      createOnly.container.querySelector('#governed-assignment-create-title'),
    ).not.toBeNull();
    expect(
      createOnly.container.querySelector('#governed-assignment-revoke-title'),
    ).toBeNull();
  });
});

describe('reviewer options', () => {
  it('loads the owner-only reviewers after mount and says so when none or unavailable', async () => {
    const { container } = mount([]);
    expect(container.textContent).toContain('Loading reviewers…');
    await flush();
    const select = byLabel<HTMLSelectElement>(container, 'Reviewer');
    expect(select.options).toHaveLength(3);
    expect(select.options[1]?.textContent).toContain('access ends');
    const unavailable = mount([], {
      loadOptions: async () => ({ kind: 'unavailable' }),
    });
    await flush();
    expect(unavailable.container.textContent).toContain(
      'Reviewer choices could not be loaded.',
    );
    expect(unavailable.container.textContent).toContain(
      'Try loading reviewers again',
    );
  });
});

describe('assign a reviewer (create)', () => {
  it('refuses a missing reviewer and an expiry outside the bounds before sending', async () => {
    const { container, fetcher } = mount([created()]);
    await flush();
    await click(buttonNamed(container, 'Assign reviewer'));
    const alert = container.querySelector(
      '[data-cms-workflow-local-errors]',
    ) as HTMLElement;
    expect(alert.textContent).toContain('Choose a reviewer.');
    expect(alert.textContent).toContain('Choose when the assignment ends.');
    await fillCreate(container, OTHER_PERSON, localInputValue(NOW + 3 * DAY));
    await click(buttonNamed(container, 'Assign reviewer'));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]')?.textContent,
    ).toContain('ends before the reviewer’s access ends');
    await fillCreate(
      container,
      REVIEWER_PERSON_ID,
      localInputValue(NOW + 8 * DAY),
    );
    await click(buttonNamed(container, 'Assign reviewer'));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]')?.textContent,
    ).toContain('within seven days');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends the strict create body at the review version, then refetches and focuses the assignments', async () => {
    const { container, fetcher, refetch, onDone } = mount([created()]);
    await fillCreate(
      container,
      REVIEWER_PERSON_ID,
      localInputValue(NOW + DAY),
      'Legal slot.',
    );
    await click(buttonNamed(container, 'Assign reviewer'));
    await flush();
    expect(pathOf(fetcher)).toBe(
      `/api/v1/cms/governed-reviews/${REVIEW_ID}/assignments`,
    );
    expect(bodyOf(fetcher)).toEqual({
      action: 'create',
      expectedVersion: '2',
      reviewerPersonId: REVIEWER_PERSON_ID,
      expiresAt: new Date(
        Math.floor((NOW + DAY) / 60_000) * 60_000,
      ).toISOString(),
      reason: 'Legal slot.',
    });
    expect(headersOf(fetcher).get('if-match')).toBe('"2"');
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('governed-assignments-title');
    expect(
      container.querySelector('[data-cms-workflow-status]')?.textContent,
    ).toContain('Reviewer assigned');
  });

  it('omits an empty reason and lets the owner assign another reviewer after a commit', async () => {
    const { container, fetcher } = mount([created(), created()]);
    await fillCreate(container);
    await click(buttonNamed(container, 'Assign reviewer'));
    await flush();
    expect(bodyOf(fetcher)).not.toHaveProperty('reason');
    await click(buttonNamed(container, 'Assign another reviewer'));
    expect(byLabel<HTMLSelectElement>(container, 'Reviewer').value).toBe('');
    await fillCreate(container);
    await click(buttonNamed(container, 'Assign reviewer'));
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('shows one fixed message for an ineligible reviewer and names the other refusals', async () => {
    for (const [reason, text, refetches] of [
      [
        'reviewer_not_eligible',
        'That person cannot be assigned to this review.',
        0,
      ],
      [
        'assignment_exists',
        'That reviewer already has an active assignment on this review.',
        1,
      ],
      [
        'assignment_limit',
        'This review already has the maximum of 16 active assignments.',
        1,
      ],
      ['review_not_open', 'This review is no longer open.', 1],
    ] as const) {
      const { container, refetch, unmount } = mount([
        error(409, 'GOVERNED_REVIEW_VERSION_CONFLICT', { reasonCode: reason }),
      ]);
      await fillCreate(container);
      await click(buttonNamed(container, 'Assign reviewer'));
      await flush();
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        text,
      );
      expect(refetch).toHaveBeenCalledTimes(refetches);
      unmount();
    }
    const expiry = mount([
      error(422, 'GOVERNED_REVIEW_VALIDATION_FAILED', {
        reasonCode: 'expiry_out_of_bounds',
        violations: [{ path: '/expiresAt', code: 'invalid' }],
      }),
    ]);
    await fillCreate(expiry.container);
    await click(buttonNamed(expiry.container, 'Assign reviewer'));
    await flush();
    expect(
      expiry.container.querySelector('[role="alert"]')?.textContent,
    ).toContain('Choose an expiry within seven days');
    expect(
      byLabel<HTMLInputElement>(
        expiry.container,
        'Assignment ends',
      ).getAttribute('aria-invalid'),
    ).toBe('true');
  });

  it('stores the scoped draft without the reviewer and restores it after step-up, asking to choose again', async () => {
    const storage = new MemoryStorage();
    const first = mount([stepUp()], {}, storage);
    await fillCreate(
      first.container,
      REVIEWER_PERSON_ID,
      localInputValue(NOW + DAY),
      'Legal slot.',
    );
    await click(buttonNamed(first.container, 'Assign reviewer'));
    await flushUntil(() => first.navigate.mock.calls.length > 0);
    expect(first.navigate).toHaveBeenCalledTimes(1);
    const raw = storage.getItem(
      'wj-step-up-draft:cms:/:CMS-03C-08-create',
    ) as string;
    expect(raw).not.toContain(REVIEWER_PERSON_ID);
    expect(JSON.parse(raw).values).toEqual({
      expiresAt: localInputValue(NOW + DAY),
      reason: 'Legal slot.',
    });
    first.unmount();

    const returned = mount([created()], {}, storage);
    await flush();
    expect(
      byLabel<HTMLInputElement>(returned.container, 'Assignment ends').value,
    ).toBe(localInputValue(NOW + DAY));
    expect(returned.container.textContent).toContain(
      'Choose the reviewer again.',
    );
    await choose(
      byLabel<HTMLSelectElement>(returned.container, 'Reviewer'),
      REVIEWER_PERSON_ID,
    );
    await click(buttonNamed(returned.container, 'Assign reviewer'));
    await flush();
    expect(returned.fetcher).toHaveBeenCalledTimes(1);
    expect(headersOf(returned.fetcher).get('idempotency-key')).toBe(KEY);
  });
});

describe('revoke an assignment', () => {
  it('lists each active assignment by its label and revokes the one named', async () => {
    const { container, fetcher, refetch, onDone } = mount([revoked()]);
    expect(
      container.querySelector('#governed-assignment-revoke-title')?.textContent,
    ).toBe('Revoke an assignment');
    expect(container.textContent).toContain('Reviewer A');
    expect(container.textContent).not.toContain(ASSIGNMENT_ID);
    await click(buttonNamed(container, 'Revoke Reviewer A'));
    await flush();
    expect(pathOf(fetcher)).toBe(
      `/api/v1/cms/governed-reviews/${REVIEW_ID}/assignments`,
    );
    expect(bodyOf(fetcher)).toEqual({
      action: 'revoke',
      expectedVersion: '2',
      assignmentId: ASSIGNMENT_ID,
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('governed-assignments-title');
    expect(container.textContent).toContain('Assignment revoked.');
  });

  it('stores only the assignment record id on a step-up shortfall and confirms explicitly on return', async () => {
    const storage = new MemoryStorage();
    const first = mount([stepUp()], {}, storage);
    await click(buttonNamed(first.container, 'Revoke Reviewer A'));
    await flushUntil(() => first.navigate.mock.calls.length > 0);
    expect(first.navigate).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(
        storage.getItem('wj-step-up-draft:cms:/:CMS-03C-08-revoke') as string,
      ).values,
    ).toEqual({ assignmentId: ASSIGNMENT_ID });
    first.unmount();
    const returned = mount([revoked()], {}, storage);
    await flush();
    expect(returned.fetcher).not.toHaveBeenCalled();
    await click(buttonNamed(returned.container, 'Confirm revoke Reviewer A'));
    await flush();
    expect(returned.fetcher).toHaveBeenCalledTimes(1);
  });

  it('refuses to send while the read behind the form is not verified', async () => {
    const { container, fetcher } = mount([revoked()], {
      disabledReason: 'Reload the page.',
    });
    await click(buttonNamed(container, 'Revoke Reviewer A'));
    expect(fetcher).not.toHaveBeenCalled();
  });
});
