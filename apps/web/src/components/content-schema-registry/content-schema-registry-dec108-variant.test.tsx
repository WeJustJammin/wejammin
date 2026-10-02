// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  VERSION_PATH,
  approvedProtectedReview,
  reviewResource,
} from './content-schema-review-dec108.test-support';
import {
  renderDocument,
  requireRegion,
  reviewPageProps,
} from './content-schema-review-dec108-render.test-support';

/**
 * FE03 "DEC-108 bounded authorization" and the `schemaReviewAssigned`
 * presentation variant: an assigned `cms.schema_review` human sees only the
 * exact protected review and, when the server permits, the decision form.
 * It never implies registry-wide read or any designer, successor, dry-run,
 * submit-review, activation, entry or publication control.
 */

const operationIds = (doc: Document): string[] =>
  [...doc.querySelectorAll('form[data-cms-command-form]')]
    .map((form) => form.getAttribute('data-operation-id') ?? '')
    .sort();

const reviewerDoc = (review = reviewResource()) =>
  renderDocument(
    reviewPageProps(review, {
      variant: 'schemaReviewAssigned',
      access: 'read-only',
    }),
  );

describe('[DEC-108] schemaReviewAssigned review-only variant', () => {
  it('[P2-S09-AC-986] is a distinct presentation variant on the workbench root', () => {
    const doc = reviewerDoc();
    expect(
      doc
        .querySelector('[data-workbench="content-schema-registry"]')
        ?.getAttribute('data-variant'),
    ).toBe('schemaReviewAssigned');
    requireRegion(doc, /schema review/iu);
  });

  it('[P2-S09-AC-986] [P2-S09-AC-987] [P2-S09-AC-1020] exposes the decision form and no other command form', () => {
    expect(operationIds(reviewerDoc())).toStrictEqual(['CMS-03A-12']);
  });

  it('exposes no command form at all when the server permits no next action', () => {
    // Control: with record_decision the decision form is the only form.
    expect(operationIds(reviewerDoc())).toStrictEqual(['CMS-03A-12']);
    expect(
      operationIds(reviewerDoc(reviewResource({ permittedNextActions: [] }))),
    ).toStrictEqual([]);
  });

  it('[P2-S09-AC-987] renders no registry-wide list, filter bar or create form', () => {
    const doc = reviewerDoc();
    requireRegion(doc, /schema review/iu);
    expect(doc.querySelector('table')).toBeNull();
    expect(doc.querySelector('[name="keyPrefix"]')).toBeNull();
    expect(doc.querySelector('[name="resourceKind"]')).toBeNull();
    expect(
      doc.querySelector('form[data-operation-id="CMS-03A-01"]'),
    ).toBeNull();
  });

  it('[P2-S09-AC-987] links to no registry list or version detail route it could not read', () => {
    const doc = reviewerDoc(approvedProtectedReview());
    requireRegion(doc, /schema review/iu);
    const hrefs = [...doc.querySelectorAll('a')].map(
      (anchor) => anchor.getAttribute('href') ?? '',
    );
    expect(
      hrefs.filter((href) => href === '/app/cms-content-modeling'),
    ).toHaveLength(0);
    expect(hrefs.filter((href) => href.includes('/versions/'))).toHaveLength(0);
  });

  it('[P2-S09-AC-987] does not offer the activation path even for an approved review it can read', () => {
    const doc = reviewerDoc({
      ...approvedProtectedReview(),
      permittedNextActions: ['activate'],
    });
    requireRegion(doc, /schema review/iu);
    expect(
      doc.querySelector('form[data-operation-id="CMS-03A-04"]'),
    ).toBeNull();
    expect(doc.body.innerHTML).not.toContain(VERSION_PATH);
  });
});

describe('[DEC-108] designer view of the review route', () => {
  it('links the submitter/designer to the candidate version page where activation lives', () => {
    const review = {
      ...approvedProtectedReview(),
      permittedNextActions: ['activate' as const],
    };
    const doc = renderDocument(
      reviewPageProps(review, { variant: 'ownerFull', access: 'full' }),
    );
    requireRegion(doc, /schema review/iu);
    const hrefs = [...doc.querySelectorAll('a')].map((anchor) =>
      anchor.getAttribute('href'),
    );
    expect(hrefs).toContain(VERSION_PATH);
  });
});
