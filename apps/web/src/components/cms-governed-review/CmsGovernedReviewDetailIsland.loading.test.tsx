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
 * FE03 1042 and 1046 (Slice 12 `governedReviewState`, loading: "Skeleton after 250 ms; forms disabled"; P2-S12-AC-271): the
 * canonical refetch that follows a command shows a skeleton in a polite region only after 250 ms, keeps the last verified
 * review, and turns every form off until the read answers. A read inside 250 ms shows nothing.
 */
type Read = CanonicalReadResult<GovernedReviewDetailResource>;
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

const mountAndRefetch = async () => {
  const initial = governedDetailFixture();
  let finish: (value: Read) => void = () => undefined;
  const readReview = vi.fn(
    () => new Promise<Read>((resolve) => (finish = resolve)),
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
  return {
    ...mounted,
    readReview,
    finish: (value: Read) => finish(value),
    initial,
  };
};
const region = (container: HTMLElement): Element | null =>
  container.querySelector('.cms-loading-region');

describe('governed review island: a canonical refetch over 250 ms', () => {
  it('shows nothing at 249 ms, then the skeleton with forms off at 250 ms, keeping the review', async () => {
    const view = await mountAndRefetch();
    expect(view.readReview).toHaveBeenCalledTimes(1);
    await advance(248);
    expect(region(view.container)).toBeNull();
    await advance(1);
    expect(region(view.container)).toBeNull();
    await advance(1);
    const shown = region(view.container) as HTMLElement;
    expect(shown.getAttribute('role')).toBe('status');
    expect(shown.textContent).toContain('Loading the current review');
    expect(view.container.textContent).toContain('Frozen version');
    // The commit control is off, with its reason; the typed input is kept (FE03 :1172 style input retention).
    expect(byLabel<HTMLTextAreaElement>(view.container, 'Reason').value).toBe(
      'Fine.',
    );
    expect(view.container.textContent).toContain('Reading the review…');
    expect(
      buttonNamed(view.container, /Record/u).getAttribute('aria-disabled'),
    ).toBe('true');
    await act(async () => {
      view.finish({ kind: 'ok', resource: view.initial });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(region(view.container)).toBeNull();
  });

  it('shows no skeleton for a read that answers inside 250 ms', async () => {
    const view = await mountAndRefetch();
    await advance(100);
    await act(async () => {
      view.finish({ kind: 'ok', resource: view.initial });
      await vi.advanceTimersByTimeAsync(0);
    });
    await advance(1_000);
    expect(region(view.container)).toBeNull();
  });
});
