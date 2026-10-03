// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  APPROVE_A_ID,
  APPROVE_B_ID,
  DRY_RUN_ID,
  REVIEW_ID,
  approvedProtectedReview,
  draftDetail,
  reviewResource,
} from './content-schema-review-dec108.test-support';
import {
  commandForm,
  fieldRecord,
  requireForm,
  renderDocument,
  reviewSuccess,
  submittedFields,
  successDetail,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';
import {
  activationPreparation,
  approvedReviewPreparation,
  passedDryRunPreparation,
  queuedDryRunPreparation,
  startDryRunPreparation,
} from './content-schema-registry-activation-preparation.test-support';

/**
 * FE03 Interaction Specification CMS-04a/b/c and the `activationPreparation`
 * data mapping: the version workbench renders the successor, dry-run,
 * submit-review and activation forms only when the server's
 * `permittedNextActions` allow them, with transport fields and prefilled
 * identifiers derived from server state (the user never types JSON or IDs).
 */

const pageWith = (
  preparation: Parameters<typeof draftDetail>[0],
  overrides: Parameters<typeof versionPageProps>[0] = {},
) =>
  versionPageProps({
    initialDetail: successDetail(draftDetail(preparation)),
    ...overrides,
  });

const FORMS = ['CMS-03A-09', 'CMS-03A-10', 'CMS-03A-11', 'CMS-03A-04'] as const;

describe('[DEC-108] FE03 next-action gating of the version forms', () => {
  it.each([
    [
      'create_successor',
      'CMS-03A-09',
      activationPreparation({ permittedNextActions: ['create_successor'] }),
    ],
    ['start_dry_run', 'CMS-03A-10', startDryRunPreparation],
    ['submit_review', 'CMS-03A-11', passedDryRunPreparation],
    ['activate', 'CMS-03A-04', approvedReviewPreparation],
  ] as const)(
    '[P2-S09-AC-985] [P2-S09-AC-972] renders only the %s form (%s) for a designer when the server permits it',
    (_action, operationId, preparation) => {
      const review =
        operationId === 'CMS-03A-04'
          ? { initialReview: reviewSuccess(approvedProtectedReview()) }
          : {};
      const doc = renderDocument(pageWith(preparation, review));
      expect(commandForm(doc, operationId)).not.toBeNull();
      for (const other of FORMS.filter((id) => id !== operationId))
        expect(commandForm(doc, other)).toBeNull();
    },
  );

  it('[P2-S09-AC-972] renders none of the four forms when the server permits no next action', () => {
    const doc = renderDocument(pageWith(activationPreparation()));
    for (const operationId of FORMS)
      expect(commandForm(doc, operationId)).toBeNull();
  });

  it('[P2-S09-AC-972] keeps every form out of a read-only projection even if an action is listed', () => {
    // Control: the same preparation does render the form for a designer.
    expect(
      requireForm(
        renderDocument(pageWith(passedDryRunPreparation)),
        'CMS-03A-11',
      ),
    ).not.toBeNull();
    const doc = renderDocument(
      pageWith(passedDryRunPreparation, {
        variant: 'entitledRead',
        access: 'read-only',
      }),
    );
    for (const operationId of FORMS)
      expect(commandForm(doc, operationId)).toBeNull();
  });
});

describe('[DEC-108] CMS-03A-09 successor form', () => {
  const successor = () =>
    requireForm(
      renderDocument(
        pageWith(
          activationPreparation({ permittedNextActions: ['create_successor'] }),
        ),
      ),
      'CMS-03A-09',
    );

  it('[P2-S09-AC-979] posts natively to the version page with the exact source ETag and version', () => {
    const form = successor();
    expect(form.getAttribute('method')).toBe('post');
    expect(form.getAttribute('action')).toBe(
      versionPageProps().retryUrl.split('?')[0],
    );
    const fields = fieldRecord(form);
    expect(fields.operationId).toBe('CMS-03A-09');
    expect(fields.expectedVersion).toBe('4');
    expect(fields['if-match']).toBe('"4"');
    expect(fields.csrf).toBe('csrf-token');
    expect(fields['idempotency-key']?.length).toBeGreaterThanOrEqual(8);
  });

  it('[P2-S09-AC-979] collects only the contract fields: no caller version number, row id or identity', () => {
    const names = [...submittedFields(successor()).keys()].filter(
      (name) =>
        ![
          'operationId',
          'csrf',
          'idempotency-key',
          'if-match',
          // Path identifiers the page already posts as transport fields.
          'contentTypeId',
          'versionId',
          // OD-4 replacement choice radio: transport only, never a payload key.
          'localeChoice',
          // DEC-123 template choice radio: transport only, never a payload key.
          'templateChoice',
        ].includes(name),
    );
    // The default choices keep the source locale and template configurations
    // (both members of each pair null).
    expect(names.sort()).toStrictEqual([
      'defaultTemplateVersionId',
      'expectedVersion',
      'fallbackChains',
      'supportedLocales',
      'templateBindings',
    ]);
  });

  it('uses an idempotency key distinct from every other form on the page', () => {
    const doc = renderDocument(
      pageWith(
        activationPreparation({
          permittedNextActions: ['create_successor', 'start_dry_run'],
        }),
      ),
    );
    const keys = ['CMS-03A-09', 'CMS-03A-10'].map(
      (id) => fieldRecord(requireForm(doc, id))['idempotency-key'],
    );
    expect(new Set(keys).size).toBe(2);
  });
});

describe('[DEC-108] CMS-03A-10 dry-run form', () => {
  const dryRun = () =>
    requireForm(renderDocument(pageWith(startDryRunPreparation)), 'CMS-03A-10');

  it('[P2-S09-AC-980] collects the nullable transform pair as blank text fields next to expectedVersion', () => {
    const form = dryRun();
    const fields = fieldRecord(form);
    expect(fields.operationId).toBe('CMS-03A-10');
    expect(fields.expectedVersion).toBe('4');
    expect(fields['if-match']).toBe('"4"');
    expect(fields.transformKey).toBe('');
    expect(fields.transformVersion).toBe('');
    expect(form.querySelectorAll('textarea')).toHaveLength(0);
  });

  it('[P2-S09-AC-980] labels both transform fields and explains the both-or-neither rule', () => {
    const form = dryRun();
    for (const name of ['transformKey', 'transformVersion']) {
      const input = form.querySelector<HTMLInputElement>(`[name="${name}"]`);
      expect(input?.required).toBe(false);
      expect(
        input?.id !== undefined &&
          form.querySelector(`label[for="${input.id}"]`) !== null,
      ).toBe(true);
    }
    expect(form.textContent?.toLowerCase()).toMatch(/both|together|neither/u);
  });

  it('[P2-S09-AC-980] offers no field for classification, counts, hashes or a report', () => {
    const names = [...submittedFields(dryRun()).keys()];
    for (const forbidden of [
      'classification',
      'result',
      'sourceCount',
      'reportHash',
    ])
      expect(names).not.toContain(forbidden);
  });
});

describe('[DEC-108] CMS-03A-11 submit-review form', () => {
  it('[P2-S09-AC-968] prefills dryRunId from the sealed passed dry run and keeps it read-only', () => {
    const form = requireForm(
      renderDocument(pageWith(passedDryRunPreparation)),
      'CMS-03A-11',
    );
    const fields = fieldRecord(form);
    expect(fields.operationId).toBe('CMS-03A-11');
    expect(fields.dryRunId).toBe(DRY_RUN_ID);
    expect(fields.expectedVersion).toBe('4');
    const control = form.querySelector<HTMLInputElement>('[name="dryRunId"]');
    expect(control?.type === 'hidden' || control?.readOnly === true).toBe(true);
  });

  it.each([
    ['queued', queuedDryRunPreparation],
    [
      'running',
      activationPreparation({
        dryRunRef: {
          id: DRY_RUN_ID,
          state: 'running',
          result: null,
          jobId: null,
        },
        permittedNextActions: ['submit_review'],
      }),
    ],
    [
      'sealed failed',
      activationPreparation({
        dryRunRef: {
          id: DRY_RUN_ID,
          state: 'completed',
          result: 'failed',
          jobId: null,
        },
        permittedNextActions: ['submit_review'],
      }),
    ],
    [
      'unsealed failed',
      activationPreparation({
        dryRunRef: {
          id: DRY_RUN_ID,
          state: 'failed',
          result: null,
          jobId: null,
        },
        permittedNextActions: ['submit_review'],
      }),
    ],
  ])(
    'keeps submit-review unavailable for a %s dry run even if the server lists it',
    (_label, preparation) => {
      // FE03: submit-review stays disabled until a passed persisted dry run
      // exists. Control: a sealed passed dry run does render the form.
      expect(
        commandForm(
          renderDocument(pageWith(passedDryRunPreparation)),
          'CMS-03A-11',
        ),
      ).not.toBeNull();
      const doc = renderDocument(pageWith(preparation));
      expect(commandForm(doc, 'CMS-03A-11')).toBeNull();
    },
  );
});

describe('[DEC-108] CMS-03A-04 activation form prefill (FE03 approvalIds mapping)', () => {
  const activation = (
    initialReview = reviewSuccess(approvedProtectedReview()),
  ) =>
    requireForm(
      renderDocument(pageWith(approvedReviewPreparation, { initialReview })),
      'CMS-03A-04',
    );

  it('[P2-S09-AC-973] prefills approvalIds with the approve-decision ids of the approved review, in order', () => {
    const values = submittedFields(activation()).getAll('approvalIds');
    expect(values).toHaveLength(1);
    expect(JSON.parse(String(values[0]))).toStrictEqual([
      APPROVE_A_ID,
      APPROVE_B_ID,
    ]);
  });

  it('[P2-S09-AC-968] prefills dryRunId from the dry run and never asks the user to type JSON or IDs', () => {
    const form = activation();
    expect(fieldRecord(form).dryRunId).toBe(DRY_RUN_ID);
    expect(form.textContent).not.toMatch(/JSON array/iu);
    for (const name of ['approvalIds', 'dryRunId']) {
      const control = form.querySelector<
        HTMLInputElement | HTMLTextAreaElement
      >(`[name="${name}"]`);
      expect(control?.tagName).toBe('INPUT');
      expect(
        (control as HTMLInputElement).type === 'hidden' ||
          (control as HTMLInputElement).readOnly,
      ).toBe(true);
    }
    expect(form.querySelectorAll('textarea')).toHaveLength(0);
  });

  it('[P2-S09-AC-973] shows the approve-decision ids as a read-only list', () => {
    const text = activation().textContent ?? '';
    expect(text).toContain(APPROVE_A_ID);
    expect(text).toContain(APPROVE_B_ID);
  });

  it('[P2-S09-AC-973] never includes a reject decision id or an id from an unapproved review', () => {
    const open = reviewResource({
      distinctApprovalCount: 1,
      recordedDecisionCount: 2,
      decisions: [
        {
          id: APPROVE_A_ID,
          decision: 'approve',
          capability: 'cms.schema_review',
          decidedAt: '2026-10-02T12:00:00.000Z',
        },
        {
          id: APPROVE_B_ID,
          decision: 'reject',
          capability: 'cms.schema_review',
          decidedAt: '2026-10-02T12:00:00.000Z',
        },
      ],
    });
    const doc = renderDocument(
      pageWith(approvedReviewPreparation, {
        initialReview: reviewSuccess(open),
      }),
    );
    // No approved review is available, so no activation form (and no ids) renders.
    expect(commandForm(doc, 'CMS-03A-04')).toBeNull();
    expect(doc.body.innerHTML).not.toContain(APPROVE_B_ID);
  });

  it('renders no activation form while the review read is unavailable', () => {
    for (const initialReview of [
      null,
      { status: 'loading' as const },
      { status: 'empty' as const, reason: 'not-disclosed' as const },
    ]) {
      const doc = renderDocument(
        pageWith(approvedReviewPreparation, { initialReview }),
      );
      expect(commandForm(doc, 'CMS-03A-04')).toBeNull();
    }
  });
});

describe('[DEC-108] FE03 review deep link from the activation preparation', () => {
  it('[P2-S09-AC-970] links the reviewRef to the protected review route carrying only the review id', () => {
    const doc = renderDocument(
      pageWith(approvedReviewPreparation, {
        initialReview: reviewSuccess(approvedProtectedReview()),
      }),
    );
    const link = [...doc.querySelectorAll('a')].find((anchor) =>
      anchor.getAttribute('href')?.includes('/schema-reviews/'),
    );
    expect(link?.getAttribute('href')).toBe(
      `/app/cms-content-modeling/schema-reviews/${REVIEW_ID}`,
    );
  });

  it('[P2-S09-AC-970] renders no review link when the preparation carries no reviewRef', () => {
    expect(
      renderDocument(
        pageWith(approvedReviewPreparation, {
          initialReview: reviewSuccess(approvedProtectedReview()),
        }),
      ).body.innerHTML,
    ).toContain('/schema-reviews/');
    const doc = renderDocument(pageWith(startDryRunPreparation));
    expect(doc.body.innerHTML).not.toContain('/schema-reviews/');
  });
});
