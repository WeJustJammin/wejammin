// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  ACTOR_ID,
  APPROVE_A_ID,
  HASH,
  HASH_B,
  PARTY_ID,
  REQUEST_ID,
  REVIEW_ID,
  approveDecision,
  approvedProtectedReview,
  reviewResource,
} from './content-schema-review-dec108.test-support';
import {
  commandForm,
  definitionValue,
  fieldRecord,
  SUPPORT_REFERENCE,
  renderDocument,
  requireForm,
  requireRegion,
  reviewPageProps,
  reviewSuccess,
  versionPageProps,
  type Dec108ReviewState,
} from './content-schema-review-dec108-render.test-support';

/**
 * FE03 "DEC-108 review, dry-run and activation-preparation states": the
 * CMS-03A-13 `reviewState` AsyncState table, the review state rendering rules,
 * and the native approve/reject decision form (CMS-03A-12) on the protected
 * review route's bounded workbench island.
 */

const reviewerPage = (
  review = reviewResource(),
  overrides: Parameters<typeof reviewPageProps>[1] = {},
) =>
  reviewPageProps(review, {
    variant: 'schemaReviewAssigned',
    access: 'read-only',
    ...overrides,
  });

const reviewState = (state: Dec108ReviewState) =>
  reviewPageProps(reviewResource(), {
    variant: 'schemaReviewAssigned',
    access: 'read-only',
    initialReview: state,
  });

describe('[DEC-108] reviewState AsyncState (CMS-03A-13)', () => {
  it('[P2-S09-AC-949] idle: no reviewRef means the review panel is not rendered', () => {
    // Control: a review state does render the panel.
    requireRegion(
      renderDocument(
        versionPageProps({ initialReview: reviewSuccess(reviewResource()) }),
      ),
      /schema review/iu,
    );
    const doc = renderDocument(versionPageProps({ initialReview: null }));
    expect(doc.body.innerHTML).not.toMatch(/Schema review/u);
  });

  it('[P2-S09-AC-950] loading: renders a skeleton with a polite live region and no review facts', () => {
    const doc = renderDocument(reviewState({ status: 'loading' }));
    const region = requireRegion(doc, /schema review/iu);
    expect(
      region.querySelector('[role="status"][aria-live="polite"]'),
    ).not.toBeNull();
    expect(definitionValue(region, /required decisions/iu)).toBeNull();
  });

  it('[P2-S09-AC-952] empty: a concealed or absent review states only that it is not available', () => {
    const doc = renderDocument(
      reviewState({ status: 'empty', reason: 'not-disclosed' }),
    );
    const region = requireRegion(doc, /schema review/iu);
    expect(region.textContent).toMatch(/not available/iu);
    expect(region.textContent).not.toContain(REVIEW_ID);
    expect(commandForm(doc, 'CMS-03A-12')).toBeNull();
  });

  it('[P2-S09-AC-953] error: renders the typed ApiError with its request ID', () => {
    const error = {
      code: 'RATE_LIMITED',
      message: 'provider detail must never be shown',
      requestId: REQUEST_ID,
    } as const;
    const doc = renderDocument(
      reviewState({ status: 'error', error, retryable: true, httpStatus: 429 }),
    );
    const region = requireRegion(doc, /schema review/iu);
    expect(region.textContent).toContain(`Request ID: ${REQUEST_ID}`);
  });

  it('[P2-S09-AC-953] error: the rendered request ID is the ApiError one, not the page support reference', () => {
    const doc = renderDocument(
      reviewState({
        status: 'error',
        error: {
          code: 'RATE_LIMITED',
          message: 'x',
          requestId: REQUEST_ID,
        },
        retryable: true,
        httpStatus: 429,
      }),
    );
    expect(requireRegion(doc, /schema review/iu).textContent).not.toContain(
      SUPPORT_REFERENCE,
    );
  });

  it('[P2-S09-AC-953] error: never shows provider detail from the ApiError message', () => {
    const doc = renderDocument(
      reviewState({
        status: 'error',
        error: {
          code: 'RATE_LIMITED',
          message: 'provider detail must never be shown',
          requestId: REQUEST_ID,
        },
        retryable: true,
        httpStatus: 429,
      }),
    );
    expect(requireRegion(doc, /schema review/iu).textContent).not.toContain(
      'provider detail',
    );
  });

  it('[P2-S09-AC-953] error: offers retry for a retryable 429', () => {
    const doc = renderDocument(
      reviewState({
        status: 'error',
        error: { code: 'RATE_LIMITED', message: 'x', requestId: REQUEST_ID },
        retryable: true,
        httpStatus: 429,
      }),
    );
    expect(
      requireRegion(doc, /schema review/iu).querySelector(
        '[data-cms-retry-control]',
      ),
    ).not.toBeNull();
  });

  it('[P2-S09-AC-953] error: offers no retry for a terminal 500', () => {
    const doc = renderDocument(
      reviewState({
        status: 'error',
        error: {
          code: 'INTERNAL_ERROR',
          message: 'x',
          requestId: REQUEST_ID,
        },
        retryable: false,
        httpStatus: 500,
      }),
    );
    expect(
      requireRegion(doc, /schema review/iu).querySelector(
        '[data-cms-retry-control]',
      ),
    ).toBeNull();
  });

  it('[P2-S09-AC-953] degraded 502, 503 and 504: render the request ID and offer retry', () => {
    for (const code of [
      'DEPENDENCY_INVALID_RESPONSE',
      'DEPENDENCY_UNAVAILABLE',
      'DEPENDENCY_DEADLINE_EXCEEDED',
    ] as const) {
      const doc = renderDocument(
        reviewState({
          status: 'degraded',
          data: null,
          code,
          requestId: REQUEST_ID,
          lastVerifiedAt: null,
          retryable: true,
        }),
      );
      const region = requireRegion(doc, /schema review/iu);
      expect(region.textContent).toContain(`Request ID: ${REQUEST_ID}`);
      expect(region.querySelector('[data-cms-retry-control]')).not.toBeNull();
    }
  });

  it('[P2-S09-AC-953] error without a request ID falls back to the support reference', () => {
    const doc = renderDocument(
      reviewState({
        status: 'error',
        error: { code: 'INTERNAL_ERROR', message: 'x' },
        retryable: false,
        httpStatus: 500,
      }),
    );
    expect(requireRegion(doc, /schema review/iu).textContent).toContain(
      `Support reference: ${SUPPORT_REFERENCE}`,
    );
  });

  it('[P2-S09-AC-954] degraded: keeps the last verified review and disables decision controls', () => {
    const doc = renderDocument(
      reviewState({
        status: 'degraded',
        data: reviewResource(),
        lastVerifiedAt: '2026-10-02T11:59:00.000Z',
      }),
    );
    const region = requireRegion(doc, /schema review/iu);
    expect(region.textContent).toContain('2026-10-02T11:59:00.000Z');
    expect(definitionValue(region, /required decisions/iu)).toBe('1');
    expect(commandForm(doc, 'CMS-03A-12')).toBeNull();
  });

  it('[P2-S09-AC-955] disabled: names the missing prerequisite', () => {
    const doc = renderDocument(
      reviewState({
        status: 'disabled',
        reason: 'The assignment has expired.',
      }),
    );
    expect(requireRegion(doc, /schema review/iu).textContent).toContain(
      'The assignment has expired.',
    );
  });
});

describe('[DEC-108] review state rendering (FE03)', () => {
  it('[P2-S09-AC-981] [P2-S09-AC-984] [P2-S09-AC-951] [P2-S09-AC-956] open: shows the required and recorded decision counts and the frozen evidence summary', () => {
    const doc = renderDocument(
      reviewerPage(
        reviewResource({
          requiredDecisionCount: 2,
          riskClass: 'protected',
          distinctApprovalCount: 1,
          recordedDecisionCount: 1,
          decisions: [approveDecision(APPROVE_A_ID)],
        }),
      ),
    );
    const region = requireRegion(doc, /schema review/iu);
    expect(definitionValue(region, /required decisions/iu)).toBe('2');
    expect(definitionValue(region, /recorded decisions/iu)).toBe('1');
    expect(definitionValue(region, /risk class/iu)).toBe('protected');
    for (const evidence of ['compiler-1', 'cms/release_notes/v2', HASH, HASH_B])
      expect(region.textContent).toContain(evidence);
    expect(region.textContent).toContain('cms.standard');
  });

  it('[P2-S09-AC-957] open: never renders approvalEvidenceHash or decidedAt', () => {
    const region = requireRegion(
      renderDocument(reviewerPage()),
      /schema review/iu,
    );
    expect(region.textContent).not.toMatch(/approval evidence/iu);
    expect(region.textContent).not.toMatch(/decided at/iu);
  });

  it('[P2-S09-AC-951] [P2-S09-AC-957] approved: renders approvalEvidenceHash and decidedAt', () => {
    const region = requireRegion(
      renderDocument(reviewerPage(approvedProtectedReview())),
      /schema review/iu,
    );
    expect(definitionValue(region, /approval evidence/iu)).toBe(HASH_B);
    expect(definitionValue(region, /decided at/iu)).toContain('2026-10-02');
  });

  it('[P2-S09-AC-951] [P2-S09-AC-958] rejected: states the candidate returned to an editable draft', () => {
    const region = requireRegion(
      renderDocument(
        reviewerPage(
          reviewResource({
            state: 'rejected',
            permittedNextActions: [],
          }),
        ),
      ),
      /schema review/iu,
    );
    expect(region.textContent).toMatch(/editable draft/iu);
    expect(region.textContent).not.toMatch(/approval evidence/iu);
  });

  it('[P2-S09-AC-951] [P2-S09-AC-959] invalidated: states that a new frozen submission is required', () => {
    const region = requireRegion(
      renderDocument(
        reviewerPage(
          reviewResource({
            state: 'invalidated',
            permittedNextActions: [],
          }),
        ),
      ),
      /schema review/iu,
    );
    expect(region.textContent).toMatch(/new (frozen )?submission/iu);
  });

  it('[P2-S09-AC-984] lists each recorded decision reference without any reviewer identifier', () => {
    const doc = renderDocument(reviewerPage(approvedProtectedReview()));
    const region = requireRegion(doc, /schema review/iu);
    expect(region.textContent).toContain(APPROVE_A_ID);
    for (const privateId of [ACTOR_ID, PARTY_ID])
      expect(doc.body.innerHTML).not.toContain(privateId);
  });
});

describe('[DEC-108] CMS-03A-12 decision form', () => {
  const decisionForm = (review = reviewResource(), overrides = {}) =>
    requireForm(renderDocument(reviewerPage(review, overrides)), 'CMS-03A-12');

  it('[P2-S09-AC-956] [P2-S09-AC-982] posts natively to the review route with the exact review version and ETag', () => {
    const form = decisionForm();
    expect(form.getAttribute('method')).toBe('post');
    expect(form.getAttribute('action')).toBe(
      `/app/cms-content-modeling/schema-reviews/${REVIEW_ID}`,
    );
    const fields = fieldRecord(form);
    expect(fields.operationId).toBe('CMS-03A-12');
    expect(fields.expectedVersion).toBe('3');
    expect(fields['if-match']).toBe('"3"');
    expect(fields.csrf).toBe('csrf-token');
    expect(fields['idempotency-key']?.length).toBeGreaterThanOrEqual(8);
  });

  it('[P2-S09-AC-956] [P2-S09-AC-1040] offers approve and reject as native radios with a persistent group label and no default', () => {
    const form = decisionForm();
    const radios = [
      ...form.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ];
    expect(radios.map((radio) => radio.value).sort()).toStrictEqual([
      'approve',
      'reject',
    ]);
    expect(new Set(radios.map((radio) => radio.name))).toStrictEqual(
      new Set(['decision']),
    );
    expect(radios.every((radio) => !radio.checked)).toBe(true);
    expect(radios.every((radio) => radio.required)).toBe(true);
    expect(
      form.querySelector('fieldset legend')?.textContent?.length,
    ).toBeGreaterThan(0);
  });

  it('[P2-S09-AC-1040] words the group label and each decision precisely and ties every label to its radio', () => {
    const form = decisionForm();
    expect(form.querySelector('fieldset legend')?.textContent).toBe(
      'Record your decision',
    );
    const labelOf = (value: string): string => {
      const radio = form.querySelector<HTMLInputElement>(
        `input[type="radio"][value="${value}"]`,
      );
      if (radio === null) throw new Error(`no ${value} radio`);
      return (
        form.querySelector(`label[for="${radio.id}"]`)?.textContent?.trim() ??
        ''
      );
    };
    expect(labelOf('approve')).toBe('Approve the frozen evidence');
    expect(labelOf('reject')).toBe(
      'Reject and return the candidate to a draft',
    );
  });

  it('[P2-S09-AC-982] [P2-S09-AC-1040] collects only the decision: no reviewer, capability or evidence field', () => {
    const names = [...new FormData(decisionForm()).keys()].filter(
      (name) =>
        ![
          'operationId',
          'csrf',
          'idempotency-key',
          'if-match',
          // The review id is a path identifier, not a payload field.
          'reviewId',
          'expectedVersion',
          'decision',
        ].includes(name),
    );
    expect(names).toStrictEqual([]);
  });

  it('[P2-S09-AC-989] [P2-S09-AC-1041] renders no form when the server does not permit record_decision', () => {
    expect(
      commandForm(
        renderDocument(
          reviewerPage(reviewResource({ permittedNextActions: [] })),
        ),
        'CMS-03A-12',
      ),
    ).toBeNull();
    // Control: the same review with the permitted action renders the form.
    expect(decisionForm()).not.toBeNull();
  });

  it.each(['approved', 'rejected', 'invalidated'] as const)(
    '[P2-S09-AC-989] renders no form for a %s review even if record_decision is listed',
    (state) => {
      const approved = state === 'approved';
      const review = approved
        ? {
            ...approvedProtectedReview(),
            permittedNextActions: ['record_decision' as const],
          }
        : reviewResource({ state, permittedNextActions: ['record_decision'] });
      expect(decisionForm()).not.toBeNull();
      expect(
        commandForm(renderDocument(reviewerPage(review)), 'CMS-03A-12'),
      ).toBeNull();
    },
  );

  it('[P2-S09-AC-978] [P2-S09-AC-1040] shows the step-up disclosure and keeps any reviewer identifier out of the markup', () => {
    const doc = renderDocument(
      reviewerPage(reviewResource(), {
        stepUpState: 'required',
        actingContextLabel: 'Northwind Collective',
      }),
    );
    const form = requireForm(doc, 'CMS-03A-12');
    expect(form.textContent).toContain('Step-up required before commit');
    expect(doc.body.innerHTML).not.toContain(ACTOR_ID);
    expect(doc.body.innerHTML).not.toContain(PARTY_ID);
  });
});
