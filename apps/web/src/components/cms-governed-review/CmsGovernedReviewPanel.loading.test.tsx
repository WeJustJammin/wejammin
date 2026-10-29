// @vitest-environment jsdom
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

import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
  mountElement,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';
import {
  HASH_A,
  KEY,
  SUBJECT_ID,
  governedApiError,
  governedReviewFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedReviewPanel, {
  type GovernedPanelSubject,
} from './CmsGovernedReviewPanel';
import {
  governedEnvironment,
  queuedFetcher,
} from './governed-review-form-test-support';

/*
 * P2-S12-AC-271 (FE03 46 and 912): after a command the panel re-reads the subject. A re-read still running after 250 ms
 * shows the loading state; a faster one never flashes it.
 */
beforeAll(preloadWorkflowAnswerMachinery);
beforeAll(enableReactAct);
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const subject = (
  overrides: Partial<GovernedPanelSubject> = {},
): GovernedPanelSubject => ({
  kind: 'template_version',
  id: SUBJECT_ID,
  hash: HASH_A,
  key: KEY,
  version: 2,
  state: 'draft',
  ...overrides,
});

const region = (container: HTMLElement): string | null =>
  container.querySelector('.cms-loading-region')?.textContent ?? null;

const mountWithHeldReread = (
  responses: readonly Response[] = [
    jsonResponse(201, governedReviewFixture(), { etag: '"1"' }),
  ],
) => {
  let answer: (next: GovernedPanelSubject | null) => void = () => undefined;
  const readSubject = vi.fn(
    () =>
      new Promise<GovernedPanelSubject | null>((resolve) => {
        answer = resolve;
      }),
  );
  const fetcher = queuedFetcher(responses);
  const mounted = mountElement(
    <CmsGovernedReviewPanel
      subject={subject()}
      readSubject={readSubject}
      environment={governedEnvironment(fetcher)}
    />,
  );
  return {
    ...mounted,
    fetcher,
    readSubject,
    answer: (next: GovernedPanelSubject | null) => answer(next),
  };
};

describe('CmsGovernedReviewPanel subject re-read loading state', () => {
  it('shows nothing at 249 ms and the loading state at 250 ms of the re-read, and removes it when answered', async () => {
    const { container, readSubject, answer } = mountWithHeldReread();
    expect(region(container)).toBeNull();
    await click(buttonNamed(container, 'Submit for review'));
    await flush();
    await flush();
    await flush();
    expect(readSubject).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(249));
    expect(region(container)).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(region(container)).toBe('Checking the current state…');
    await act(async () => answer(subject({ state: 'review' })));
    await flush();
    expect(region(container)).toBeNull();
  });

  it('never shows the loading state for a re-read answered before 250 ms', async () => {
    const { container, readSubject, answer } = mountWithHeldReread();
    await click(buttonNamed(container, 'Submit for review'));
    await flush();
    await flush();
    await flush();
    expect(readSubject).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(100));
    await act(async () => answer(subject({ state: 'review' })));
    await flush();
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(region(container)).toBeNull();
  });

  it('keeps the submit control blocked while the subject is re-read after a refusal, and releases it with the answer (the other half of AC-271)', async () => {
    const { container, fetcher, readSubject, answer } = mountWithHeldReread([
      jsonResponse(
        409,
        governedApiError(
          'GOVERNED_REVIEW_VERSION_CONFLICT',
          'A fixed message.',
          {
            reasonCode: 'subject_not_submittable',
          },
        ),
      ),
      jsonResponse(201, governedReviewFixture(), { etag: '"1"' }),
    ]);
    const submit = () => buttonNamed(container, 'Submit for review');
    await click(submit());
    await flush();
    await flush();
    expect(readSubject).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(250));
    expect(region(container)).toBe('Checking the current state…');
    expect(submit().getAttribute('aria-disabled')).toBe('true');
    // A press while the subject is re-read sends nothing and starts no second read.
    await click(submit());
    await flush();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(readSubject).toHaveBeenCalledTimes(1);
    // The answer releases the control: it follows the subject the server now serves.
    await act(async () => answer(subject()));
    await flush();
    expect(region(container)).toBeNull();
    expect(submit().getAttribute('aria-disabled')).toBe('false');
  });
});
