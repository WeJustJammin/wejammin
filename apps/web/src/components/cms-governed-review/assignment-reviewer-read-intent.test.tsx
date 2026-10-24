// @vitest-environment jsdom
import * as React from 'react';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
  showIntent,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsEditorialReviewAssignmentForm from '../cms-editorial-workflow/CmsEditorialReviewAssignmentForm';
import { resetLazyIntentForTest } from '../cms-editorial-workflow/cms-lazy-intent';
import { reviewDetailFixture } from '../cms-editorial-workflow/cms-workflow-fixtures.test-support';
import type { ReviewerOptionsResult } from '../cms-editorial-workflow/cms-workflow-reviewer-options';
import { governedDetailFixture } from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedAssignmentForm from './CmsGovernedAssignmentForm';

beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(resetLazyIntentForTest);

/*
 * Both assignment forms read the reviewer choices, and that read fetches the contract validators.
 * It waits for the first sign of intent in the form (FE03 "Performance budgets and loading
 * strategy": lazy modules load on explicit entry), so an owner who opens a review and does not
 * touch the assignment form does not pay for it in the cold load (P2-S11-AC-106).
 */
const EMPTY: ReviewerOptionsResult = { kind: 'ok', options: [] };

describe.each([
  [
    'editorial',
    (load: () => Promise<ReviewerOptionsResult>) => (
      <CmsEditorialReviewAssignmentForm
        review={reviewDetailFixture({
          version: '2',
          permittedNextActions: ['assign_reviewer'],
        })}
        disabledReason={null}
        refetch={async () => true}
        onDone={() => undefined}
        loadOptions={load}
      />
    ),
  ],
  [
    'governed',
    (load: () => Promise<ReviewerOptionsResult>) => (
      <CmsGovernedAssignmentForm
        review={governedDetailFixture({
          version: '2',
          permittedNextActions: ['assign_reviewer'],
        })}
        disabledReason={null}
        refetch={async () => true}
        onDone={() => undefined}
        loadOptions={load}
      />
    ),
  ],
] as const)('%s assignment form reviewer read', (_name, form) => {
  it('is not made at mount, and is made once when a pointer reaches the form', async () => {
    const load = vi.fn(async () => EMPTY);
    const { container } = mountElement(form(load));
    await flush();
    expect(load).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Loading reviewers');
    showIntent(container);
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    showIntent(container);
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('is made when the reviewer control takes focus', async () => {
    const load = vi.fn(async () => EMPTY);
    const { container } = mountElement(form(load));
    await flush();
    container
      .querySelector('select')!
      .dispatchEvent(new Event('focusin', { bubbles: true }));
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('starts on intent anywhere in the form, not only on the select, and shows the list as loading until it answers', async () => {
    let answer: (value: ReviewerOptionsResult) => void = () => undefined;
    const load = vi.fn(
      () =>
        new Promise<ReviewerOptionsResult>((resolve) => {
          answer = resolve;
        }),
    );
    const { container } = mountElement(form(load));
    await flush();
    const select = container.querySelector('select') as HTMLSelectElement;
    // Before any intent the list already says it has not been read.
    expect([...select.options].map((option) => option.textContent)).toEqual([
      'Loading reviewers…',
    ]);
    // The label sits next to the select, outside it: the earliest sign of intent.
    container
      .querySelector('label')!
      .dispatchEvent(new Event('pointerover', { bubbles: true }));
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(select.getAttribute('aria-busy')).toBe('true');
    expect(select.options[0]?.disabled).toBe(true);
    answer({
      kind: 'ok',
      options: [
        {
          personId: '30000000-0000-4000-8000-000000000001',
          endsAt: '2027-01-01',
        },
      ],
    });
    await flush();
    await flush();
    expect([...select.options].map((option) => option.textContent)).toEqual([
      'Choose a reviewer',
      '30000000-0000-4000-8000-000000000001 (access ends 2027-01-01)',
    ]);
    expect(select.getAttribute('aria-busy')).not.toBe('true');
  });
});
