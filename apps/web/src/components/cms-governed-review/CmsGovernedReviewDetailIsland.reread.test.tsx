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

import { loadCmsValidators } from '../../lib/cms-contract-validators';
import { rateLimitMessage } from '../../lib/rate-limit-message';
import {
  buttonNamed,
  click,
  disableReactAct,
  enableReactAct,
  flush,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import { preloadWorkflowAnswerMachinery } from '../cms-editorial-workflow/cms-workflow-answer-machinery.test-support';
import { governedAssignmentSummaryFixture } from '../../server/cms-governed-review-fixtures.test-support';
import {
  advance,
  degradedCommitControls,
  everyFormReview,
  mountDetail,
  provokeRefetch,
  aria,
  type Read,
} from './CmsGovernedReviewDetailIsland.states.test-support';

/**
 * [P2-S12-AC-271] governedReviewState degraded (FE03 1050): a degraded review detail is re-required. The unverified
 * review is not shown, and its commit controls stay disabled, from the failed read until a later read VERIFIES, which
 * includes the time that read is in flight (the offered re-read and the 429 auto-retry alike).
 */
beforeAll(preloadWorkflowAnswerMachinery);
beforeAll(enableReactAct);
beforeAll(async () => {
  await loadCmsValidators();
});
afterAll(disableReactAct);
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const label = governedAssignmentSummaryFixture().reviewerLabel;
const text = (container: HTMLElement): string => container.textContent ?? '';
const hold = () => {
  let release: (read: Read) => void = () => undefined;
  const held = new Promise<Read>((resolve) => {
    release = resolve;
  });
  return { held, release: (read: Read) => release(read) };
};
const REREAD = 'Read the review again';

describe('CmsGovernedReviewDetailIsland: a degraded detail and its re-read', () => {
  it('[P2-S12-AC-271] governedReviewState degraded: no stale assignment, a polite notice and an offered re-read that restores the review once it verifies', async () => {
    const review = everyFormReview();
    const second = hold();
    const reads: Array<Promise<Read> | Read> = [
      { kind: 'degraded', requestId: null },
      second.held,
    ];
    const readReview = vi.fn(async () => (await reads.shift()) as Read);
    const { container } = mountDetail(review, readReview);
    await flush();
    await provokeRefetch(container);
    expect(text(container)).toContain('The review is not shown');
    expect(text(container)).not.toContain(label);
    expect(
      container
        .querySelector('[data-cms-workflow-degraded]')
        ?.getAttribute('role'),
    ).toBe('status');
    await click(buttonNamed(container, REREAD));
    expect(readReview).toHaveBeenCalledTimes(2);
    await act(async () => {
      second.release({ kind: 'ok', resource: review });
    });
    await flush();
    expect(text(container)).toContain('Frozen version');
    expect(text(container)).toContain(`Revoke ${label}`);
    expect(() => buttonNamed(container, REREAD)).toThrow();
  });

  it('[P2-S12-AC-271] governedReviewState degraded: while the offered re-read is in flight the unverified review stays hidden and every commit control stays disabled', async () => {
    const review = everyFormReview();
    const second = hold();
    const reads: Array<Promise<Read> | Read> = [
      { kind: 'degraded', requestId: null },
      second.held,
    ];
    const readReview = vi.fn(async () => (await reads.shift()) as Read);
    const { container } = mountDetail(review, readReview);
    await flush();
    await provokeRefetch(container);
    await click(buttonNamed(container, REREAD));
    const inFlight = (): void => {
      expect(text(container)).not.toContain('Frozen version');
      expect(text(container)).not.toContain(label);
      expect(text(container)).toContain('The review is not shown');
      expect(degradedCommitControls(container).map(aria)).toEqual([
        'true',
        'true',
        'true',
      ]);
    };
    inFlight();
    await advance(300);
    inFlight();
    await act(async () => {
      second.release({ kind: 'ok', resource: review });
    });
    await flush();
    expect(text(container)).toContain('Frozen version');
    expect(container.querySelector('[data-cms-workflow-degraded]')).toBeNull();
  });

  it('[P2-S12-AC-271] governedReviewState degraded: a 429 shows no re-read control, keeps the review hidden through the Retry-After wait and its automatic read, and re-shows it when that read verifies', async () => {
    const review = everyFormReview();
    const second = hold();
    const reads: Array<Promise<Read> | Read> = [
      {
        kind: 'degraded',
        requestId: null,
        rateLimit: { retryAfterSeconds: 6 },
      },
      second.held,
    ];
    const readReview = vi.fn(async () => (await reads.shift()) as Read);
    const { container } = mountDetail(review, readReview);
    await flush();
    await provokeRefetch(container);
    expect(() => buttonNamed(container, REREAD)).toThrow();
    expect(
      container.querySelector('[data-cms-workflow-rate-limit]')?.textContent,
    ).toBe(rateLimitMessage(6));
    await advance(5_999);
    expect(readReview).toHaveBeenCalledTimes(1);
    expect(text(container)).not.toContain('Frozen version');
    await advance(1);
    expect(readReview).toHaveBeenCalledTimes(2);
    expect(() => buttonNamed(container, REREAD)).toThrow();
    expect(text(container)).not.toContain('Frozen version');
    expect(text(container)).not.toContain(label);
    expect(degradedCommitControls(container).map(aria)).toEqual([
      'true',
      'true',
      'true',
    ]);
    await act(async () => {
      second.release({ kind: 'ok', resource: review });
    });
    await flush();
    expect(text(container)).toContain('Frozen version');
  });
  it('[P2-S12-AC-271] governedReviewState degraded (V17 N7): the re-read control stays mounted, focused and announced while it reads, and focus moves to the restored review heading with the outcome announced', async () => {
    const review = everyFormReview();
    const second = hold();
    const reads: Array<Promise<Read> | Read> = [
      { kind: 'degraded', requestId: null },
      second.held,
    ];
    const readReview = vi.fn(async () => (await reads.shift()) as Read);
    const { container } = mountDetail(review, readReview);
    await flush();
    await provokeRefetch(container);
    const button = buttonNamed(container, REREAD);
    button.focus();
    await click(button);
    const reading = (): void => {
      expect(button.isConnected).toBe(true);
      expect(document.activeElement).toBe(button);
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.textContent).toBe(REREAD);
      expect(
        container.querySelector('[data-cms-workflow-degraded]')?.textContent,
      ).toContain('Reading the review again');
    };
    reading();
    // A second activation while the read runs starts no second read.
    await click(button);
    expect(readReview).toHaveBeenCalledTimes(2);
    await advance(300);
    reading();
    await act(async () => {
      second.release({ kind: 'ok', resource: review });
    });
    await flush();
    expect(document.activeElement?.id).toBe('governed-summary-title');
    expect(
      container.querySelector('[data-cms-workflow-status]')?.textContent ??
        text(container),
    ).toContain('The review was read again.');
  });

  it('[P2-S12-AC-271] governedReviewState degraded (V17 N7): a re-read that fails again keeps the same control focused and enabled for the next try', async () => {
    const review = everyFormReview();
    const reads: Array<Read> = [
      { kind: 'degraded', requestId: null },
      { kind: 'degraded', requestId: null },
      { kind: 'ok', resource: review },
    ];
    const readReview = vi.fn(async () => reads.shift() as Read);
    const { container } = mountDetail(review, readReview);
    await flush();
    await provokeRefetch(container);
    const button = buttonNamed(container, REREAD);
    button.focus();
    await click(button);
    await flush();
    expect(buttonNamed(container, REREAD)).toBe(button);
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-disabled')).not.toBe('true');
    await click(button);
    await flush();
    expect(document.activeElement?.id).toBe('governed-summary-title');
  });

  it('[P2-S12-AC-271] governedReviewState degraded (V17 N7): a read that restores the review by itself after a 429 does not move focus', async () => {
    const review = everyFormReview();
    const second = hold();
    const reads: Array<Promise<Read> | Read> = [
      {
        kind: 'degraded',
        requestId: null,
        rateLimit: { retryAfterSeconds: 6 },
      },
      second.held,
    ];
    const readReview = vi.fn(async () => (await reads.shift()) as Read);
    const { container } = mountDetail(review, readReview);
    await flush();
    await provokeRefetch(container);
    await advance(6_000);
    await act(async () => {
      second.release({ kind: 'ok', resource: review });
    });
    await flush();
    expect(text(container)).toContain('Frozen version');
    expect(document.activeElement?.id).not.toBe('governed-summary-title');
  });
});
