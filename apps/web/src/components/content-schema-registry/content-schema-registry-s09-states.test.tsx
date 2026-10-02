// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  DRY_RUN_ID,
  JOB_ID,
  REVIEW_ID,
  approvedProtectedReview,
  draftDetail,
  reviewResource,
} from './content-schema-review-dec108.test-support';
import {
  commandForm,
  definitionValue,
  regionNamed,
  renderDocument,
  requireRegion,
  reviewPageProps,
  successDetail,
  versionPageProps,
} from './content-schema-review-dec108-render.test-support';
import {
  activationPreparation,
  passedDryRunPreparation,
} from './content-schema-registry-activation-preparation.test-support';

/**
 * FE03 "DEC-108 review, dry-run and activation-preparation states" rows that
 * name a missing prerequisite, a safe failure code, or a degraded last
 * verified state. Static server HTML, the repository convention for the
 * workbench.
 */

type Preparation = Parameters<typeof draftDetail>[0];

const failedDryRun = (failureCode: string | null) =>
  activationPreparation({
    dryRunRef: {
      id: DRY_RUN_ID,
      state: 'failed',
      result: null,
      jobId: JOB_ID,
      ...(failureCode === null ? {} : { failureCode }),
    },
    jobRef: { id: JOB_ID, state: 'failed' },
    permittedNextActions: ['start_dry_run'],
  });

const detailDocument = (preparation: Preparation) =>
  renderDocument(
    versionPageProps({
      initialDetail: successDetail(draftDetail(preparation)),
    }),
  );

const reviewerDocument = (review = reviewResource()) =>
  renderDocument(
    reviewPageProps(review, {
      variant: 'schemaReviewAssigned',
      access: 'read-only',
    }),
  );

describe('[P2-S09-AC-955] review disabled state names the missing prerequisite', () => {
  it('[P2-S09-AC-955] an open review the reviewer may not decide names the missing or ended assignment', () => {
    const doc = reviewerDocument(reviewResource({ permittedNextActions: [] }));
    const note = doc.querySelector('[data-decision-prerequisite]');
    expect(note?.textContent).toMatch(/assignment/iu);
    expect(note?.textContent).toMatch(/missing|ended|expired/iu);
    expect(commandForm(doc, 'CMS-03A-12')).toBeNull();
  });

  it.each(['approved', 'rejected', 'invalidated'] as const)(
    '[P2-S09-AC-955] a %s review names that decisions are recorded only while it is open',
    (state) => {
      const review =
        state === 'approved'
          ? { ...approvedProtectedReview(), permittedNextActions: [] }
          : reviewResource({ state, permittedNextActions: [] });
      const note = reviewerDocument(review).querySelector(
        '[data-decision-prerequisite]',
      );
      expect(note?.textContent).toMatch(/only while .*open/iu);
      expect(note?.textContent).toContain(state);
    },
  );

  it('[P2-S09-AC-955] names nothing when the decision form is available', () => {
    const doc = reviewerDocument();
    expect(commandForm(doc, 'CMS-03A-12')).not.toBeNull();
    expect(doc.querySelector('[data-decision-prerequisite]')).toBeNull();
  });

  it('[P2-S09-AC-955] never shows the reviewer prerequisite to the schema designer, who does not decide', () => {
    const doc = renderDocument(
      reviewPageProps(reviewResource({ permittedNextActions: [] })),
    );
    expect(doc.querySelector('[data-decision-prerequisite]')).toBeNull();
  });
});

describe('[P2-S09-AC-965] dry-run error renders a safe failure code only', () => {
  it('[P2-S09-AC-965] [P2-S09-AC-968] renders the safe failureCode with no counts or hashes', () => {
    const region = requireRegion(
      detailDocument(failedDryRun('DRY_RUN_ROW_LIMIT')),
      /activation preparation/iu,
    );
    expect(definitionValue(region, /failure code/iu)).toBe('DRY_RUN_ROW_LIMIT');
    expect(region.textContent).not.toMatch(/[a-f0-9]{64}/u);
    expect(region.textContent).not.toMatch(/\bcount/iu);
    expect(region.textContent).not.toMatch(/passed/iu);
  });

  it('[P2-S09-AC-968] a failed dry run without a code keeps the generic unsealed-failure copy and no code row', () => {
    const region = requireRegion(
      detailDocument(failedDryRun(null)),
      /activation preparation/iu,
    );
    expect(definitionValue(region, /failure code/iu)).toBeNull();
    expect(region.textContent).toMatch(/did not complete/iu);
  });

  it('[P2-S09-AC-968] a failure code selects its copy only for a failed dry run', () => {
    const region = requireRegion(
      detailDocument(passedDryRunPreparation),
      /activation preparation/iu,
    );
    expect(definitionValue(region, /failure code/iu)).toBeNull();
  });
});

describe('[P2-S09-AC-966] dry-run degraded keeps the last verified dry run', () => {
  const degradedProps = (preparation: Preparation) =>
    versionPageProps({
      initialDetail: {
        status: 'degraded',
        data: draftDetail(preparation),
        lastVerifiedAt: '2026-10-02T11:59:00.000Z',
        retryable: true,
        httpStatus: 503,
      } as never,
    });

  it('[P2-S09-AC-966] keeps the last verified dryRunRef with lastVerifiedAt in the preparation panel', () => {
    const doc = renderDocument(degradedProps(passedDryRunPreparation));
    const region = requireRegion(doc, /activation preparation/iu);
    expect(region.textContent).toContain('2026-10-02T11:59:00.000Z');
    expect(region.textContent).toMatch(/last verified/iu);
    expect(definitionValue(region, /result/iu)).toBe('passed');
  });

  it('[P2-S09-AC-966] keeps submit-review disabled while degraded even with a sealed passed dry run', () => {
    const doc = renderDocument(degradedProps(passedDryRunPreparation));
    expect(commandForm(doc, 'CMS-03A-11')).toBeNull();
    expect(commandForm(doc, 'CMS-03A-10')).toBeNull();
    expect(
      regionNamed(doc, /activation preparation/iu)?.textContent,
    ).toMatch(/submit review is disabled/iu);
  });

  it('[P2-S09-AC-966] renders nothing from a degraded read that holds no last verified detail', () => {
    const doc = renderDocument(
      versionPageProps({
        initialDetail: {
          status: 'degraded',
          data: null,
          lastVerifiedAt: null,
          retryable: true,
          httpStatus: 503,
        } as never,
      }),
    );
    expect(regionNamed(doc, /activation preparation/iu)).toBeNull();
  });
});

describe('[P2-S09-AC-967] dry-run disabled names the missing prerequisite', () => {
  it('[P2-S09-AC-967] names start_dry_run as the missing prerequisite when the server does not list it', () => {
    const doc = detailDocument(
      activationPreparation({ permittedNextActions: ['create_successor'] }),
    );
    expect(commandForm(doc, 'CMS-03A-10')).toBeNull();
    const note = doc.querySelector('[data-dry-run-prerequisite]');
    expect(note?.textContent).toMatch(/dry run/iu);
    expect(note?.textContent).toMatch(/not (?:currently )?permitted|unavailable/iu);
  });

  it('[P2-S09-AC-967] renders the start-dry-run form and no prerequisite note when the server lists start_dry_run', () => {
    const doc = detailDocument(
      activationPreparation({ permittedNextActions: ['start_dry_run'] }),
    );
    expect(commandForm(doc, 'CMS-03A-10')).not.toBeNull();
    expect(doc.querySelector('[data-dry-run-prerequisite]')).toBeNull();
  });

  it('[P2-S09-AC-967] names nothing to a read-only reader who holds no start-dry-run form', () => {
    const doc = renderDocument(
      versionPageProps({
        access: 'read-only',
        variant: 'entitledRead',
        initialDetail: successDetail(draftDetail(activationPreparation())),
      }),
    );
    expect(doc.querySelector('[data-dry-run-prerequisite]')).toBeNull();
  });

  it('is anchored on the review id used by the review route fixtures', () => {
    expect(REVIEW_ID).toMatch(/^[0-9a-f-]{36}$/u);
  });
});
