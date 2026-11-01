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
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import { rateLimitMessage } from '../../lib/safe-read-retry';
import {
  buttonNamed,
  byLabel,
  click,
  disableReactAct,
  enableReactAct,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { CanonicalReadResult } from '../cms-editorial-workflow/cms-workflow-canonical-read';
import {
  INSTANT,
  REVIEW_ID,
  governedApiError,
  governedDetailFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import type { GovernedReviewDetailResource } from '@wejammin/contracts';
import CmsGovernedReviewDetailIsland from './CmsGovernedReviewDetailIsland';
import {
  governedEnvironment,
  queuedFetcher,
} from './governed-review-form-test-support';

beforeAll(preloadWorkflowAnswerMachinery);

beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/**
 * FE03 "Network and retry contract" (:1172): a governed canonical read answered 429 keeps the
 * last verified review, announces the stated wait politely with the input kept, and reads once
 * more after the wait.
 */
type Read = CanonicalReadResult<GovernedReviewDetailResource>;
const limited = (seconds: number | null): Read => ({
  kind: 'degraded',
  requestId: null,
  rateLimit: { retryAfterSeconds: seconds },
});

const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const conflict = () =>
  jsonResponse(
    409,
    governedApiError('GOVERNED_REVIEW_VERSION_CONFLICT', 'm', {
      reasonCode: 'review_not_open',
    }),
  );

const mountAndRead = async (reads: readonly Read[]) => {
  const initial = governedDetailFixture();
  const queue = [...reads];
  const readReview = vi.fn(
    async () => queue.shift() ?? ({ kind: 'ok', resource: initial } as Read),
  );
  const mounted = mountElement(
    <CmsGovernedReviewDetailIsland
      init={{ review: initial, reviewId: REVIEW_ID, verifiedAt: INSTANT }}
      readReview={readReview}
      loadOptions={async () => ({ kind: 'ok', options: [] })}
      environment={governedEnvironment(queuedFetcher([conflict()]))}
    />,
  );
  const { container } = mounted;
  await click(
    container.querySelector<HTMLInputElement>(
      'input[value="approve"]',
    ) as HTMLInputElement,
  );
  await typeInto(byLabel<HTMLTextAreaElement>(container, 'Reason'), 'Fine.');
  await click(buttonNamed(container, /Record/u));
  await advance(0);
  return { ...mounted, readReview };
};

const notice = (container: HTMLElement): Element | null =>
  container.querySelector('[data-cms-workflow-rate-limit]');

describe('governed review island: canonical read answered 429', () => {
  it('announces the wait politely, does not keep the stale review, keeps the typed reason, and reads again after it', async () => {
    const { container, readReview } = await mountAndRead([limited(6)]);
    expect(notice(container)?.getAttribute('role')).toBe('status');
    expect(notice(container)?.getAttribute('aria-live')).toBe('polite');
    expect(notice(container)?.textContent).toBe(rateLimitMessage(6));
    expect(container.textContent).not.toContain('Frozen version');
    expect(container.textContent).toContain(
      'The last read could not be verified. Commands are off until it is.',
    );
    expect(byLabel<HTMLTextAreaElement>(container, 'Reason').value).toBe(
      'Fine.',
    );
    await advance(5_999);
    expect(readReview).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(readReview).toHaveBeenCalledTimes(2);
    expect(notice(container)?.textContent).toBe('');
    expect(container.textContent).toContain('Frozen version');
    expect(container.textContent).not.toContain('Commands are off');
  });

  it('waits five seconds when no wait was stated', async () => {
    const { container, readReview } = await mountAndRead([limited(null)]);
    expect(notice(container)?.textContent).toBe(rateLimitMessage(null));
    await advance(4_999);
    expect(readReview).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(readReview).toHaveBeenCalledTimes(2);
  });

  it('mounts the notice empty with the island, and shows none for another failure', async () => {
    const { container } = await mountAndRead([
      { kind: 'degraded', requestId: null },
    ]);
    expect(notice(container)).not.toBeNull();
    expect(notice(container)?.textContent).toBe('');
  });
});
