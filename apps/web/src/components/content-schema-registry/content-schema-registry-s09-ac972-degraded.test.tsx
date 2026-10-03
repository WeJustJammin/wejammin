// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  approvedProtectedReview,
  draftDetail,
} from './content-schema-review-dec108.test-support';
import {
  commandForm,
  renderDocument,
  reviewSuccess,
  successDetail,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';
import {
  activationPreparation,
  approvedReviewPreparation,
  passedDryRunPreparation,
} from './content-schema-registry-activation-preparation.test-support';

/**
 * R8 ruling for AC972 (activationPreparation mapping): every control is gated
 * solely on `permittedNextActions`. When the action is listed but the data the
 * control prefills is missing, the control renders in an explicit unavailable
 * state; it is never silently hidden by another field, and an unlisted action
 * renders nothing at all.
 */
const page = (
  preparation: Parameters<typeof draftDetail>[0],
  overrides: Parameters<typeof versionPageProps>[0] = {},
) =>
  versionPageProps({
    initialDetail: successDetail(draftDetail(preparation)),
    ...overrides,
  });

describe('[P2-S09-AC-972] a listed action with missing prefill data renders unavailable, never hidden', () => {
  it('shows the submit-review control as unavailable when submit_review is listed without a sealed passed dry run', () => {
    const doc = renderDocument(
      page(activationPreparation({ permittedNextActions: ['submit_review'] })),
    );
    expect(commandForm(doc, 'CMS-03A-11')).toBeNull();
    const notice = doc.querySelector('[data-submit-review-unavailable="true"]');
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toMatch(/unavailable/iu);
    expect(notice?.textContent).toMatch(/sealed|dry run/iu);
  });

  it('shows the submit-review control as unavailable when the dry run is sealed but failed', () => {
    const failed = activationPreparation({
      dryRunRef: {
        id: passedDryRunPreparation.dryRunRef?.id ?? '',
        state: 'completed',
        result: 'failed',
        jobId: passedDryRunPreparation.dryRunRef?.jobId ?? null,
      },
      permittedNextActions: ['submit_review'],
    });
    const doc = renderDocument(page(failed));
    expect(commandForm(doc, 'CMS-03A-11')).toBeNull();
    expect(
      doc.querySelector('[data-submit-review-unavailable="true"]'),
    ).not.toBeNull();
  });

  it('shows the activation control as unavailable when activate is listed but the approved review could not be read', () => {
    const doc = renderDocument(page(approvedReviewPreparation));
    expect(commandForm(doc, 'CMS-03A-04')).toBeNull();
    const notice = doc.querySelector('[data-activation-unavailable="true"]');
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toMatch(/unavailable/iu);
    expect(notice?.textContent).toMatch(/approved review|approval/iu);
  });

  it('shows the activation control as unavailable when the review read is not an approved review', () => {
    const invalidated = {
      ...approvedProtectedReview(),
      state: 'invalidated' as const,
    };
    const doc = renderDocument(
      page(approvedReviewPreparation, {
        initialReview: reviewSuccess(invalidated),
      }),
    );
    expect(commandForm(doc, 'CMS-03A-04')).toBeNull();
    expect(
      doc.querySelector('[data-activation-unavailable="true"]'),
    ).not.toBeNull();
  });

  it('renders the real forms and no unavailable notice when the data exists', () => {
    const submit = renderDocument(page(passedDryRunPreparation));
    expect(commandForm(submit, 'CMS-03A-11')).not.toBeNull();
    expect(
      submit.querySelector('[data-submit-review-unavailable="true"]'),
    ).toBeNull();
    const activate = renderDocument(
      page(approvedReviewPreparation, {
        initialReview: reviewSuccess(approvedProtectedReview()),
      }),
    );
    expect(commandForm(activate, 'CMS-03A-04')).not.toBeNull();
    expect(
      activate.querySelector('[data-activation-unavailable="true"]'),
    ).toBeNull();
  });

  it('renders neither a control nor a notice for an action the server does not list, whatever other fields hold', () => {
    const noActions = activationPreparation({
      dryRunRef: passedDryRunPreparation.dryRunRef,
      reviewRef: approvedReviewPreparation.reviewRef,
    });
    const doc = renderDocument(
      page(noActions, {
        initialReview: reviewSuccess(approvedProtectedReview()),
      }),
    );
    for (const id of ['CMS-03A-11', 'CMS-03A-04'])
      expect(commandForm(doc, id)).toBeNull();
    expect(
      doc.querySelector('[data-submit-review-unavailable="true"]'),
    ).toBeNull();
    expect(
      doc.querySelector('[data-activation-unavailable="true"]'),
    ).toBeNull();
  });
});
