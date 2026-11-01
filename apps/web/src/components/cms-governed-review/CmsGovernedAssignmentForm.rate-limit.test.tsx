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
import type { ReviewerOptionsResult } from '../cms-editorial-workflow/cms-workflow-reviewer-options';
import {
  REVIEWER_PERSON_ID,
  governedDetailFixture,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedAssignmentForm from './CmsGovernedAssignmentForm';

beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * FE03 "Network and retry contract" (:1172): the governed assignment form's reviewer list read
 * answered 429. The wait is announced, the form stays usable and reads the choices again once
 * it elapsed. A form the server does not offer reads nothing.
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

const mount = (
  loadOptions: () => Promise<ReviewerOptionsResult>,
  permittedNextActions = ['assign_reviewer'],
) =>
  mountWithIntent(
    <CmsGovernedAssignmentForm
      review={governedDetailFixture({ version: '2', permittedNextActions })}
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

const notice = (container: HTMLElement): Element | null =>
  container.querySelector('[data-cms-reviewers-rate-limit]');

describe('governed assignment form: reviewer choices answered 429', () => {
  it('announces the stated wait politely and reads the choices again after it', async () => {
    const load = vi
      .fn<() => Promise<ReviewerOptionsResult>>()
      .mockResolvedValueOnce(limited(6))
      .mockResolvedValueOnce(options);
    const { container } = mount(load);
    const initialNotice = notice(container);
    expect(initialNotice).not.toBeNull();
    expect(initialNotice?.textContent).toBe('');
    await advance(0);
    expect(notice(container)?.getAttribute('role')).toBe('status');
    expect(notice(container)?.textContent).toBe(
      `Reviewer choices could not be loaded yet. ${rateLimitMessage(6)}`,
    );
    expect(container.textContent).not.toContain('Reload the page');
    await advance(5_999);
    expect(load).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(load).toHaveBeenCalledTimes(2);
    expect(notice(container)).toBe(initialNotice);
    expect(initialNotice?.textContent).toBe('');
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
    expect(notice(container)?.textContent).toContain(rateLimitMessage(null));
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
    const initialNotice = notice(container);
    expect(initialNotice).not.toBeNull();
    expect(initialNotice?.textContent).toBe('');
    await advance(0);
    expect(container.textContent).toContain(
      'Reviewer choices could not be loaded.',
    );
    // A failed read offers the retry, not an instruction to reload the page.
    expect(container.textContent).toContain('Try loading reviewers again');
    expect(container.textContent).not.toContain('Reload the page');
    expect(notice(container)).toBe(initialNotice);
    expect(initialNotice?.textContent).toBe('');
    await advance(60_000);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reads nothing while the server does not offer an assignment', async () => {
    const load = vi
      .fn<() => Promise<ReviewerOptionsResult>>()
      .mockResolvedValue(options);
    mount(load, []);
    await advance(60_000);
    expect(load).not.toHaveBeenCalled();
  });
});
