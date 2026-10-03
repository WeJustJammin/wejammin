// @vitest-environment jsdom

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  NOW,
  reviewBinding,
  reviewRequest,
} from '../../server/content-schema-review-dec108.test-support';
import { createContentSchemaReviewPlatformPorts } from '../../server/content-schema-review-platform-api';
import { resolveContentSchemaReviewPage } from '../../server/content-schema-review-context';
import { takeReviewFlash } from './content-schema-registry-review-flash';
import {
  APPROVE_A_ID,
  APPROVE_B_ID,
  REVIEW_ID,
  REVIEW_PATH,
  approveDecision,
} from './content-schema-review-dec108.test-support';
import { WorkbenchUnderTest } from './content-schema-review-dec108-render.test-support';
import {
  apiError,
  decide,
  mountReviewer,
  protectedOpen,
  reviewerMarkup,
} from './content-schema-registry-s09-r4-ia-edges.test-support';

/**
 * Slice 09 IA03 edge cases (AC-1128..AC-1130) at the web layer: how the
 * review route and the decision form present what the server decided. The
 * server rules are proved by the database and Worker layers; here the real
 * server resolver, review route, forms and enhancement runtime show each
 * outcome.
 */

beforeEach(() => {
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('AC-1128 assignment expires or is revoked mid-review', () => {
  const resolveFor = async (review: unknown) => {
    const bound = reviewBinding({
      capability: 'cms.schema_review',
      variant: null,
      body: review,
    });
    return resolveContentSchemaReviewPage({
      request: reviewRequest(),
      reviewId: REVIEW_ID,
      ports: createContentSchemaReviewPlatformPorts(bound.binding),
      requestId: REVIEW_ID,
      now: () => NOW,
    });
  };

  it('[P2-S09-AC-1128] a reviewer whose assignment ended gets the review without a decision form and the named prerequisite', async () => {
    const result = await resolveFor(
      protectedOpen({ permittedNextActions: [] }),
    );
    if (result.kind !== 'authorized') throw new Error(result.kind);
    const markup = renderToStaticMarkup(
      React.createElement(
        WorkbenchUnderTest,
        result.page as unknown as React.ComponentProps<
          typeof WorkbenchUnderTest
        >,
      ),
    );
    expect(markup).not.toContain('data-operation-id="CMS-03A-12"');
    expect(markup).toContain(
      'You cannot record a decision on this review: your assignment to decide it is missing or has ended.',
    );
    // The review stays frozen: its evidence is still shown unchanged.
    expect(markup).toContain('Frozen evidence');
  });

  it('[P2-S09-AC-1128] a decision submitted after the assignment ended is refused and nothing is recorded', async () => {
    const { form, navigate } = await decide(
      'approve',
      apiError('FORBIDDEN', 403),
    );
    expect(form.querySelector('[data-cms-capability-gate]')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(takeReviewFlash(window.sessionStorage)).toBeNull();
  });
});

describe('AC-1129 submitter or duplicate decision', () => {
  it('[P2-S09-AC-1129] a refused duplicate or submitter decision is a typed conflict that records and announces nothing', async () => {
    const { form, navigate, calls } = await decide(
      'approve',
      apiError('CONFLICT', 409, { reason: 'repeated_human' }),
      protectedOpen({
        recordedDecisionCount: 1,
        distinctApprovalCount: 1,
        decisions: [approveDecision(APPROVE_A_ID)],
      }),
    );
    expect(calls).toHaveLength(1);
    expect(form.querySelector('[data-cms-sync-conflict]')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(takeReviewFlash(window.sessionStorage)).toBeNull();
    // The server-stated reason is never echoed.
    expect(form.textContent).not.toContain('repeated_human');
  });

  it('[P2-S09-AC-1129] the review shows exactly the decisions the server recorded: the refused attempt adds no row', () => {
    const before = protectedOpen({
      recordedDecisionCount: 1,
      distinctApprovalCount: 1,
      decisions: [approveDecision(APPROVE_A_ID)],
    });
    const markup = reviewerMarkup(before);
    expect(
      markup.match(/<code>[0-9a-f-]{36}<\/code> · approve/gu),
    ).toHaveLength(1);
    expect(markup).toMatch(/Recorded decisions<\/dt><dd>1</u);
  });
});

describe('AC-1130 concurrent decisions race the required count', () => {
  it('[P2-S09-AC-1130] the loser gets a conflict stating both versions and Review changes goes to the current review', async () => {
    const { form, navigate } = await decide(
      'approve',
      apiError('CONFLICT', 409, { expectedVersion: '3', currentVersion: '4' }),
    );
    const conflict = form.querySelector<HTMLElement>(
      '[data-cms-sync-conflict]',
    )!;
    expect(conflict.textContent).toContain('Server version: 4');
    expect(conflict.textContent).toContain('Local version: 3');
    const review = [...conflict.querySelectorAll('button')].find(
      (button) => button.textContent === 'Review current version',
    )!;
    review.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(navigate).toHaveBeenCalledWith(REVIEW_PATH);
  });

  it("[P2-S09-AC-1130] the refreshed review carries the new version and the other reviewer's decision, so the next submit uses the new version", () => {
    const refreshed = protectedOpen({
      version: '4',
      recordedDecisionCount: 1,
      distinctApprovalCount: 1,
      decisions: [approveDecision(APPROVE_B_ID)],
    });
    const form = mountReviewer(refreshed);
    expect(
      (form.elements.namedItem('if-match') as HTMLInputElement).value,
    ).toBe('"4"');
    expect(document.body.textContent).toMatch(/Recorded decisions\s*1/u);
  });
});
