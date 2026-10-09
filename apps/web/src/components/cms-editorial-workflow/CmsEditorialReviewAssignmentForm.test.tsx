// @vitest-environment jsdom
import * as React from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MemoryStorage } from '../../lib/test-support/memory-storage';
import {
  buttonNamed,
  byLabel,
  choose,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import {
  COMMAND_CASES,
  CSRF,
  REVOKE_CASE,
} from '../../server/cms-workflow-platform-command.test-support';
import CmsEditorialReviewAssignmentForm from './CmsEditorialReviewAssignmentForm';
import { localInputValue } from './cms-workflow-expiry';
import {
  ASSIGNMENT_ID,
  INSTANT,
  LATER,
  REVIEWER_PERSON_ID,
  REVIEW_ID,
  apiError,
  jsonResponse,
  reviewDetailFixture,
} from './cms-workflow-fixtures.test-support';

beforeAll(enableReactAct);
afterAll(disableReactAct);

const KEY = 'idem-key-assign-0001';
const NOW = Date.parse('2026-10-08T12:00:00Z');
const DAY = 24 * 3_600_000;
const OTHER_PERSON = '123e4567-e89b-42d3-a456-42661417400d';

const assignment = {
  assignmentId: ASSIGNMENT_ID,
  version: '1',
  state: 'active',
  startsAt: INSTANT,
  endsAt: LATER,
  reviewerLabel: 'Reviewer 1',
};

const review = (version = '2', assignments: unknown[] = [assignment]) =>
  reviewDetailFixture({
    version,
    permittedNextActions: ['assign_reviewer', 'revoke_assignment'],
    assignments,
  });

const options = [
  {
    personId: REVIEWER_PERSON_ID,
    endsAt: new Date(NOW + 30 * DAY).toISOString(),
  },
  { personId: OTHER_PERSON, endsAt: new Date(NOW + 2 * DAY).toISOString() },
];

const created = () => {
  const testCase = COMMAND_CASES['CMS-03B-18'];
  return jsonResponse(201, testCase.resource, {
    etag: testCase.etag as string,
    location: testCase.location as string,
  });
};
const revoked = () =>
  jsonResponse(200, REVOKE_CASE.resource, { etag: REVOKE_CASE.etag as string });
const stepUp = () =>
  jsonResponse(
    401,
    apiError('STEP_UP_REQUIRED', {
      recoveryAction: 'step_up',
      allowedMethods: ['totp'],
    }),
  );

const mount = (
  responses: readonly Response[],
  extra: Partial<
    React.ComponentProps<typeof CmsEditorialReviewAssignmentForm>
  > = {},
  storage = new MemoryStorage(),
) => {
  const queue = [...responses];
  const fetcher = vi.fn(async () => queue.shift() as Response);
  const refetch = vi.fn(async () => true);
  const onDone = vi.fn();
  const navigate = vi.fn();
  const mounted = mountElement(
    <CmsEditorialReviewAssignmentForm
      review={review()}
      disabledReason={null}
      refetch={refetch}
      onDone={onDone}
      now={() => NOW}
      loadOptions={async () => ({ kind: 'ok', options })}
      environment={{
        transport: { fetcher, documentRef: { cookie: `wj_csrf=${CSRF}` } },
        newKey: () => KEY,
        storage: () => storage,
        navigate,
      }}
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

describe('reviewer options', () => {
  it('loads the owner-only reviewers after mount and offers each as an option', async () => {
    const { container } = mount([]);
    expect(container.textContent).toContain('Loading reviewers…');
    await flush();
    const select = byLabel<HTMLSelectElement>(container, 'Reviewer');
    expect(select.options).toHaveLength(3);
    expect(select.options[0]?.textContent).toBe('Choose a reviewer');
    expect(select.options[1]?.textContent).toContain(REVIEWER_PERSON_ID);
    expect(select.options[1]?.textContent).toContain('access ends');
    expect(container.textContent).not.toContain('Loading reviewers…');
  });

  it('says so when the reviewer list cannot be loaded or is empty', async () => {
    const unavailable = mount([], {
      loadOptions: async () => ({ kind: 'unavailable' }),
    });
    await flush();
    expect(unavailable.container.textContent).toContain(
      'Reviewer choices could not be loaded. Reload the page.',
    );
    const none = mount([], {
      loadOptions: async () => ({ kind: 'ok', options: [] }),
    });
    await flush();
    expect(none.container.textContent).toContain(
      'No reviewer has an active cms.reviewer grant.',
    );
    expect(
      none.container.querySelector(
        'a[href="/app/cms-content-modeling/capability-grants"]',
      ),
    ).not.toBeNull();
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
    await typeInto(
      byLabel<HTMLInputElement>(container, 'Assignment ends'),
      localInputValue(NOW + DAY),
    );
    await typeInto(
      byLabel<HTMLTextAreaElement>(container, 'Reason (optional)'),
      'x'.repeat(257),
    );
    await click(buttonNamed(container, 'Assign reviewer'));
    expect(
      container.querySelector('[data-cms-workflow-local-errors]')?.textContent,
    ).toContain('Use at most 256 characters.');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends the strict create body at the review version and refetches the review', async () => {
    const { container, fetcher, refetch, onDone } = mount([created()]);
    await fillCreate(
      container,
      REVIEWER_PERSON_ID,
      localInputValue(NOW + DAY),
      'Legal slot.',
    );
    await click(buttonNamed(container, 'Assign reviewer'));
    await flush();
    const [target, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(target).toBe(`/api/v1/cms/reviews/${REVIEW_ID}/assignments`);
    expect(JSON.parse(init.body as string)).toEqual({
      action: 'create',
      expectedVersion: '2',
      reviewerPersonId: REVIEWER_PERSON_ID,
      expiresAt: new Date(
        Math.floor((NOW + DAY) / 60_000) * 60_000,
      ).toISOString(),
      reason: 'Legal slot.',
    });
    expect(new Headers(init.headers).get('if-match')).toBe('"2"');
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('review-assignments-title');
    expect(
      container.querySelector('[data-cms-workflow-status]')?.textContent,
    ).toContain('Reviewer assigned');
  });

  it('omits an empty reason and lets the owner assign another reviewer after a commit', async () => {
    const { container, fetcher } = mount([created(), created()]);
    await fillCreate(container);
    await click(buttonNamed(container, 'Assign reviewer'));
    await flush();
    expect(
      JSON.parse(
        (fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
          .body as string,
      ),
    ).not.toHaveProperty('reason');
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
        jsonResponse(409, apiError('CONFLICT', { reasonCode: reason })),
      ]);
      await fillCreate(container);
      await click(buttonNamed(container, 'Assign reviewer'));
      await flush();
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        text,
      );
      expect(refetch).toHaveBeenCalledTimes(refetches);
      // Element ids repeat across mounts, so each case owns the document alone.
      unmount();
    }
    const expiry = mount([
      jsonResponse(
        422,
        apiError('VALIDATION_FAILED', { reasonCode: 'expiry_out_of_bounds' }),
      ),
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
    await vi.waitFor(() => expect(first.navigate).toHaveBeenCalledTimes(1));
    const raw = storage.getItem(
      'wj-step-up-draft:cms:/:CMS-03B-18-create',
    ) as string;
    expect(raw).not.toContain(REVIEWER_PERSON_ID);
    expect(JSON.parse(raw).values).toEqual({
      expiresAt: localInputValue(NOW + DAY),
      reason: 'Legal slot.',
    });
    expect(first.fetcher).toHaveBeenCalledTimes(1);
    first.unmount();

    const returned = mount([created()], {}, storage);
    await flush();
    expect(
      byLabel<HTMLInputElement>(returned.container, 'Assignment ends').value,
    ).toBe(localInputValue(NOW + DAY));
    expect(
      byLabel<HTMLTextAreaElement>(returned.container, 'Reason (optional)')
        .value,
    ).toBe('Legal slot.');
    expect(
      byLabel<HTMLSelectElement>(returned.container, 'Reviewer').value,
    ).toBe('');
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
    expect(
      new Headers(
        (returned.fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
          .headers,
      ).get('idempotency-key'),
    ).toBe(KEY);
  });
});

describe('revoke an assignment', () => {
  it('lists each active assignment by its label and revokes the one named', async () => {
    const { container, fetcher, refetch, onDone } = mount([revoked()]);
    expect(
      container.querySelector('#assignment-revoke-title')?.textContent,
    ).toBe('Revoke an assignment');
    expect(container.textContent).toContain('Reviewer 1');
    expect(container.textContent).not.toContain(ASSIGNMENT_ID);
    await click(buttonNamed(container, 'Revoke Reviewer 1'));
    await flush();
    const [target, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(target).toBe(`/api/v1/cms/reviews/${REVIEW_ID}/assignments`);
    expect(JSON.parse(init.body as string)).toEqual({
      action: 'revoke',
      expectedVersion: '2',
      assignmentId: ASSIGNMENT_ID,
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('review-assignments-title');
    expect(container.textContent).toContain('Assignment revoked.');
  });

  it('shows no revoke section without an active assignment or the permission', () => {
    const none = mount([], {
      review: review('2', [{ ...assignment, state: 'revoked' }]),
    });
    expect(none.container.querySelector('#assignment-revoke-title')).toBeNull();
    const denied = mount([], {
      review: reviewDetailFixture({
        permittedNextActions: ['assign_reviewer'],
        assignments: [assignment],
      }),
    });
    expect(
      denied.container.querySelector('#assignment-revoke-title'),
    ).toBeNull();
    const noCreate = mount([], {
      review: reviewDetailFixture({
        permittedNextActions: ['revoke_assignment'],
        assignments: [assignment],
      }),
    });
    expect(
      noCreate.container.querySelector('#assignment-create-title'),
    ).toBeNull();
    expect(
      noCreate.container.querySelector('#assignment-revoke-title'),
    ).not.toBeNull();
  });

  it('routes a revoke through step-up and asks for an explicit confirmation on return', async () => {
    const storage = new MemoryStorage();
    const first = mount([stepUp()], {}, storage);
    await click(buttonNamed(first.container, 'Revoke Reviewer 1'));
    await vi.waitFor(() => expect(first.navigate).toHaveBeenCalledTimes(1));
    first.unmount();
    const returned = mount([revoked()], {}, storage);
    await flush();
    expect(returned.fetcher).not.toHaveBeenCalled();
    await click(buttonNamed(returned.container, 'Confirm revoke Reviewer 1'));
    await flush();
    expect(returned.fetcher).toHaveBeenCalledTimes(1);
    expect(
      new Headers(
        (returned.fetcher.mock.calls[0] as unknown as [string, RequestInit])[1]
          .headers,
      ).get('idempotency-key'),
    ).toBe(KEY);
  });

  it('refuses to send while the read behind it is not verified', async () => {
    const { container, fetcher } = mount([revoked()], {
      disabledReason: 'Reload the page.',
    });
    await click(buttonNamed(container, 'Revoke Reviewer 1'));
    expect(fetcher).not.toHaveBeenCalled();
  });
});
