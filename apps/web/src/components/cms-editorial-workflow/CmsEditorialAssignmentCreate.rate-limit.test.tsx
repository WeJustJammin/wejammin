// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import { rateLimitMessage } from '../../lib/safe-read-retry';
import {
  byLabel,
  disableReactAct,
  enableReactAct,
  mountWithIntent,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import CmsEditorialReviewAssignmentForm from './CmsEditorialReviewAssignmentForm';
import {
  REVIEWER_PERSON_ID,
  reviewDetailFixture,
} from './cms-workflow-fixtures.test-support';
import type { ReviewerOptionsResult } from './cms-workflow-reviewer-options';

beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * FE03 "Network and retry contract" (:1172): the assignment form's reviewer list read answered
 * 429. The wait is announced, the form stays usable and reads the choices again once it elapsed.
 */
const options: ReviewerOptionsResult = {
  kind: 'ok',
  options: [
    { personId: REVIEWER_PERSON_ID, endsAt: '2027-01-01T00:00:00.000Z' },
  ],
};
const limited = (seconds: number | null): ReviewerOptionsResult => ({
  kind: 'unavailable',
  rateLimit: { retryAfterSeconds: seconds },
});

const mount = (loadOptions: () => Promise<ReviewerOptionsResult>) =>
  mountWithIntent(
    <CmsEditorialReviewAssignmentForm
      review={reviewDetailFixture({
        version: '2',
        permittedNextActions: ['assign_reviewer'],
      })}
      disabledReason={null}
      refetch={async () => true}
      onDone={() => undefined}
      loadOptions={loadOptions}
    />,
  );

const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe('assignment form: reviewer choices answered 429', () => {
  it('announces the stated wait politely in a live region that was already there, and reads the choices again after it', async () => {
    const load = vi
      .fn<() => Promise<ReviewerOptionsResult>>()
      .mockResolvedValueOnce(limited(6))
      .mockResolvedValueOnce(options);
    const { container } = mount(load);
    // Mounted empty with the form, so assistive technology has registered it before the 429.
    const region = container.querySelector('[data-cms-reviewers-rate-limit]');
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.getAttribute('aria-atomic')).toBe('true');
    expect(region?.textContent).toBe('');
    await advance(0);
    const notice = container.querySelector('[data-cms-reviewers-rate-limit]');
    expect(notice).toBe(region);
    expect(notice?.textContent).toBe(
      `Reviewer choices could not be loaded yet. ${rateLimitMessage(6)}`,
    );
    expect(container.textContent).not.toContain('Reload the page');
    await advance(5_999);
    expect(load).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(load).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-cms-reviewers-rate-limit]')).toBe(
      region,
    );
    expect(region?.textContent).toBe('');
    expect(
      byLabel<HTMLSelectElement>(container, 'Reviewer').options,
    ).toHaveLength(2);
  });

  it('waits five seconds when none was stated, and waits again after a second 429', async () => {
    const load = vi
      .fn<() => Promise<ReviewerOptionsResult>>()
      .mockResolvedValueOnce(limited(null))
      .mockResolvedValueOnce(limited(2))
      .mockResolvedValueOnce(options);
    const { container } = mount(load);
    await advance(0);
    expect(
      container.querySelector('[data-cms-reviewers-rate-limit]')?.textContent,
    ).toContain(rateLimitMessage(null));
    await advance(4_999);
    expect(load).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(load).toHaveBeenCalledTimes(2);
    await advance(1_999);
    expect(load).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('stops waiting when the form unmounts', async () => {
    const load = vi
      .fn<() => Promise<ReviewerOptionsResult>>()
      .mockResolvedValue(limited(3));
    const view = mount(load);
    await advance(0);
    view.unmount();
    await advance(60_000);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('offers a retry for an unavailable list that is not rate limited', async () => {
    const load = vi
      .fn<() => Promise<ReviewerOptionsResult>>()
      .mockResolvedValue({ kind: 'unavailable' });
    const { container } = mount(load);
    await advance(0);
    expect(container.textContent).toContain(
      'Reviewer choices could not be loaded.',
    );
    // A failed read offers the retry, not an instruction to reload the page.
    expect(container.textContent).toContain('Try loading reviewers again');
    expect(container.textContent).not.toContain('Reload the page');
    expect(
      container.querySelector('[data-cms-reviewers-rate-limit]')?.textContent,
    ).toBe('');
    await advance(60_000);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
