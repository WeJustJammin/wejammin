// @vitest-environment jsdom

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SchemaReviewResourceSchema } from '@wejammin/contracts';

import { installContentSchemaRegistryCommandEnhancement } from './content-schema-registry-runtime-dom-mutations';
import { takeReviewFlash } from './content-schema-registry-review-flash';
import {
  activationPreparation,
  approvedReviewPreparation,
  passedDryRunPreparation,
} from './content-schema-registry-activation-preparation.test-support';
import {
  APPROVE_A_ID,
  APPROVE_B_ID,
  REVIEW_ID,
  REVIEW_PATH,
  approveDecision,
  draftDetail,
  rejectDecision,
} from './content-schema-review-dec108.test-support';
import {
  WorkbenchUnderTest,
  commandForm,
  renderDocument,
  reviewSuccess,
  successDetail,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';
import {
  apiError,
  decide,
  mountReviewer,
  protectedOpen,
  reviewerMarkup,
} from './content-schema-registry-s09-r4-ia-edges.test-support';

/**
 * Slice 09 IA03 edge cases (AC-1131, AC-1132, AC-1135, AC-1136) at the web
 * layer: invalidation after drift, rejection, a lapsed specialist capability
 * and the decision form around the specialist slot.
 */

beforeEach(() => {
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('AC-1131 drift after approval', () => {
  const invalidated = protectedOpen({
    state: 'invalidated',
    permittedNextActions: [],
  });

  it('[P2-S09-AC-1131] an invalidated review says a new frozen submission is required and offers no decision', () => {
    const markup = reviewerMarkup(invalidated);
    expect(markup).toContain(
      'The review is no longer valid; a new frozen submission is required.',
    );
    expect(markup).not.toContain('data-operation-id="CMS-03A-12"');
  });

  it('[P2-S09-AC-1131] the version page offers resubmission and no activation once the server stops permitting activation', () => {
    const doc = renderDocument(
      versionPageProps({
        initialDetail: successDetail(
          draftDetail(
            activationPreparation({
              ...passedDryRunPreparation,
              dryRunRef: passedDryRunPreparation.dryRunRef,
              jobRef: passedDryRunPreparation.jobRef,
              reviewRef: { id: REVIEW_ID, state: 'invalidated' },
              permittedNextActions: ['submit_review'],
            }),
          ),
        ),
        initialReview: reviewSuccess(invalidated),
      }),
    );
    expect(commandForm(doc, 'CMS-03A-11')).not.toBeNull();
    expect(commandForm(doc, 'CMS-03A-04')).toBeNull();
    expect(doc.body.textContent).toContain('invalidated');
  });

  it('[P2-S09-AC-1131] an activation refused for drift is a typed conflict and never a success', async () => {
    window.history.replaceState(
      {},
      '',
      '/app/cms-content-modeling/t/versions/v',
    );
    document.body.innerHTML = renderToStaticMarkup(
      React.createElement(
        WorkbenchUnderTest,
        versionPageProps({
          initialDetail: successDetail(draftDetail(approvedReviewPreparation)),
          initialReview: reviewSuccess(
            SchemaReviewResourceSchema.parse(
              protectedOpen({
                state: 'approved',
                distinctApprovalCount: 2,
                recordedDecisionCount: 2,
                approvalEvidenceHash: 'd'.repeat(64),
                decidedAt: '2026-10-02T12:00:00.000Z',
                decisions: [
                  { ...approveDecision(APPROVE_A_ID) },
                  {
                    ...approveDecision(APPROVE_B_ID),
                    capability: 'cms.reviewer.legal',
                  },
                ],
                permittedNextActions: ['activate'],
              }),
            ),
          ),
        }),
      ),
    );
    const form = document.querySelector<HTMLFormElement>(
      'form[data-operation-id="CMS-03A-04"]',
    )!;
    (form.elements.namedItem('confirmed') as HTMLInputElement).checked = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        apiError('CONFLICT', 409, { reason: 'approval_drift' }),
      ),
    );
    const navigate = vi.fn();
    const cleanup = installContentSchemaRegistryCommandEnhancement(document, {
      navigate,
    });
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() =>
      expect(form.querySelector('[data-cms-sync-conflict]')).not.toBeNull(),
    );
    cleanup();
    expect(form.querySelector('[data-cms-activation-result]')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(form.textContent).not.toContain('approval_drift');
  });
});

describe('AC-1132 rejected review', () => {
  const rejected = protectedOpen({
    state: 'rejected',
    recordedDecisionCount: 1,
    distinctApprovalCount: 0,
    decisions: [rejectDecision('f26c9d15-7a03-7b81-a6e4-0c58d3b72e19')],
    permittedNextActions: [],
  });

  it('[P2-S09-AC-1132] a rejected review states the candidate returned to an editable draft and keeps its decisions read-only', () => {
    const markup = reviewerMarkup(rejected);
    expect(markup).toContain(
      'The review was rejected and the candidate returned to an editable draft.',
    );
    expect(markup).toContain('reject');
    expect(markup).not.toContain('data-operation-id="CMS-03A-12"');
    // Immutable rows: no control edits, deletes or reverses a recorded decision.
    expect(markup).not.toMatch(/Delete decision|Edit decision|Undo/u);
  });

  it('[P2-S09-AC-1132] the returned draft is editable again: the version page offers the field and relation forms', () => {
    const doc = renderDocument(
      versionPageProps({
        initialDetail: successDetail(draftDetail(activationPreparation())),
      }),
    );
    expect(commandForm(doc, 'CMS-03A-02')).not.toBeNull();
    expect(commandForm(doc, 'CMS-03A-03')).not.toBeNull();
  });
});

describe('AC-1135 specialist capability ends after approval', () => {
  it('[P2-S09-AC-1135] the invalidated review shows the lost approver in the counts and the specialist slot, offers no activation and a new submission', () => {
    const review = protectedOpen({
      state: 'invalidated',
      recordedDecisionCount: 2,
      distinctApprovalCount: 1,
      decisions: [
        approveDecision(APPROVE_A_ID),
        { ...approveDecision(APPROVE_B_ID), capability: 'cms.reviewer.legal' },
      ],
      permittedNextActions: [],
    });
    const markup = reviewerMarkup(review);
    expect(markup).toMatch(/Distinct approvals<\/dt><dd>1</u);
    expect(markup).toMatch(/Required decisions<\/dt><dd>2</u);
    expect(markup).toContain('cms.reviewer.legal');
    expect(markup).toContain('a new frozen submission is required');
    expect(markup).not.toContain('data-operation-id="CMS-03A-04"');
  });
});

describe('AC-1136 too few decisions left for the specialist slot', () => {
  const tight = protectedOpen({
    recordedDecisionCount: 1,
    distinctApprovalCount: 1,
    decisions: [approveDecision(APPROVE_A_ID)],
  });

  it('[P2-S09-AC-1136] the decision form always offers both approve and reject, never disabled by the counts', () => {
    const form = mountReviewer(tight);
    const radios = [
      ...form.querySelectorAll<HTMLInputElement>('input[name="decision"]'),
    ];
    expect(radios.map((radio) => radio.value).sort()).toStrictEqual([
      'approve',
      'reject',
    ]);
    for (const radio of radios) expect(radio.disabled).toBe(false);
  });

  it('[P2-S09-AC-1136] an approve the server refuses as unsatisfiable is a typed conflict and records nothing', async () => {
    const { form, navigate } = await decide(
      'approve',
      apiError('CONFLICT', 409, { reason: 'specialist_slot_unsatisfiable' }),
      tight,
    );
    expect(form.querySelector('[data-cms-sync-conflict]')).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(takeReviewFlash(window.sessionStorage)).toBeNull();
    expect(form.textContent).not.toContain('specialist_slot_unsatisfiable');
  });

  it('[P2-S09-AC-1136] a reject the server accepts is recorded, announced and continues on the review', async () => {
    const accepted = new Response(
      JSON.stringify({
        id: APPROVE_B_ID,
        version: '1',
        contentHash: 'a'.repeat(64),
        createdAt: '2026-10-02T12:00:00.000Z',
        updatedAt: '2026-10-02T12:00:00.000Z',
        resourceKind: 'schema_review_decision',
        reviewId: REVIEW_ID,
        decision: 'reject',
        capability: 'cms.schema_review',
        decidedAt: '2026-10-02T12:00:00.000Z',
      }),
      {
        status: 201,
        headers: { 'content-type': 'application/json', location: REVIEW_PATH },
      },
    );
    const { navigate } = await decide('reject', accepted, tight);
    expect(navigate).toHaveBeenCalledWith(REVIEW_PATH);
    expect(takeReviewFlash(window.sessionStorage)).toStrictEqual({
      kind: 'decision',
      decision: 'reject',
    });
  });
});
