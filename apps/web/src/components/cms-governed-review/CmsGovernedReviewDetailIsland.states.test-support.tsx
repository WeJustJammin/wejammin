import type { GovernedReviewDetailResource } from '@wejammin/contracts';
import * as React from 'react';
import { act } from 'react';
import { vi } from 'vitest';

import {
  buttonNamed,
  byLabel,
  click,
  mountElement,
  typeInto,
} from '../cms-editorial-fields/cms-editor-dom.test-support';
import type { CanonicalReadResult } from '../cms-editorial-workflow/cms-workflow-canonical-read';
import {
  INSTANT,
  REVIEW_ID,
  governedApiError,
  governedAssignmentSummaryFixture,
  governedDetailFixture,
  jsonResponse,
} from '../../server/cms-governed-review-fixtures.test-support';
import CmsGovernedReviewDetailIsland from './CmsGovernedReviewDetailIsland';
import {
  governedEnvironment,
  queuedFetcher,
} from './governed-review-form-test-support';

/*
 * The harness of the P2-S12-AC-271 governedReviewState suites for the CMS-03C-10 review detail
 * island: the REAL island and forms, with only the canonical read (or its fetcher) and the command
 * wire replaced. A decision refused with 409 `review_not_open` is the one real event that makes the
 * island refetch the review, so every cell that needs a read starts there.
 */
export type Read = CanonicalReadResult<GovernedReviewDetailResource>;

export const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

/** A reader offered every command the island can host, so one refetch exercises every form. */
export const everyFormReview = () =>
  governedDetailFixture({
    permittedNextActions: [
      'record_decision',
      'assign_reviewer',
      'revoke_assignment',
      'activate',
      'schedule',
      'retire',
    ],
    assignments: [governedAssignmentSummaryFixture()],
  });

const refusedDecision = () =>
  jsonResponse(
    409,
    governedApiError('GOVERNED_REVIEW_VERSION_CONFLICT', 'm', {
      reasonCode: 'review_not_open',
    }),
  );

export const mountDetail = (
  initial: GovernedReviewDetailResource,
  readReview: () => Promise<Read>,
) =>
  mountElement(
    <CmsGovernedReviewDetailIsland
      init={{ review: initial, reviewId: REVIEW_ID, verifiedAt: INSTANT }}
      readReview={readReview}
      loadOptions={async () => ({ kind: 'ok', options: [] })}
      environment={governedEnvironment(queuedFetcher([refusedDecision()]))}
    />,
  );

/** Records a decision the server refuses as no longer open: the island then refetches the review. */
export const provokeRefetch = async (container: HTMLElement): Promise<void> => {
  await click(
    container.querySelector<HTMLInputElement>(
      'input[value="approve"]',
    ) as HTMLInputElement,
  );
  await typeInto(byLabel<HTMLTextAreaElement>(container, 'Reason'), 'Fine.');
  await click(buttonNamed(container, /Record/u));
  await advance(0);
};

export const loadingRegion = (container: HTMLElement): Element | null =>
  container.querySelector('.cms-loading-region');

/** The commit control of every form the island hosts, in page order. */
export const commitControls = (container: HTMLElement): HTMLButtonElement[] => [
  buttonNamed(container, /^Record/u),
  buttonNamed(container, 'Assign reviewer'),
  buttonNamed(container, 'Revoke Reviewer A'),
  buttonNamed(container, 'Continue'),
];

export const reasonsShown = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('[data-cms-workflow-disabled]')].map(
    (node) => node.textContent ?? '',
  );

export const aria = (control: HTMLButtonElement): string | null =>
  control.getAttribute('aria-disabled');
