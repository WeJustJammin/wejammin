import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * FE03 Page and Route Definitions for the DEC-108 protected review route and
 * the version-page POST allowlist. Astro pages are asserted as source, the
 * convention of `content-schema-registry-routes.test.ts`, because the page
 * shell cannot be executed outside the Astro runtime.
 */

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

const REVIEW_PAGE = fromHere(
  '../pages/app/cms-content-modeling/schema-reviews/[reviewId].astro',
);
const VERSION_PAGE = fromHere(
  '../pages/app/cms-content-modeling/[contentTypeId]/versions/[versionId].astro',
);

const requireSource = (path: string): string => {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new Error(`RED: expected Astro page ${path} (FE03 DEC-108)`);
  }
};

describe('[DEC-108] protected review route page', () => {
  it('is server-rendered, no-store and rendered through the bounded workbench island', () => {
    const source = requireSource(REVIEW_PAGE);
    expect(source).toContain('export const prerender = false');
    expect(source).toContain(
      "Astro.response.headers.set('Cache-Control', 'no-store')",
    );
    expect(source).toContain('resolveContentSchemaReviewPage');
    expect(source).toContain('ContentSchemaRegistryWorkbenchIsland');
    expect(source).toContain('client:load');
    expect(source).not.toContain('client:visible');
    expect(source).toContain('Astro.params.reviewId');
  });

  it('redirects an unauthenticated visitor with a safe relative returnTo', () => {
    const source = requireSource(REVIEW_PAGE);
    expect(source).toContain('Astro.redirect');
    expect(source).toContain('/auth/sign-in?returnTo=');
    expect(source).toContain('303');
    expect(source).toContain('safeContentSchemaRegistryReturnPath');
  });

  it.each([
    ['invalid_record', '400'],
    ['not_found', '404'],
    ['forbidden', '403'],
  ])('answers %s with %s and a no-store header', (kind, status) => {
    const source = requireSource(REVIEW_PAGE);
    const branch = source.slice(source.indexOf(`'${kind}'`));
    expect(branch).toContain(`status: ${status}`);
    expect(branch.slice(0, 300)).toContain("'cache-control': 'no-store'");
  });

  it('moves focus to the single h1 on navigation through the shared focus script', () => {
    const source = requireSource(REVIEW_PAGE);
    expect(source).toContain('id="page-title"');
    expect(source).toContain('tabindex="-1"');
    expect(source).toContain('route-heading-focus.ts');
    expect(source.match(/<h1\b/gu)).toHaveLength(1);
    expect(source).toContain('id="content-schema-registry-main"');
  });

  it('accepts only the review-scoped decision and assignment commands as native POSTs', () => {
    const source = requireSource(REVIEW_PAGE);
    expect(source).toContain("Astro.request.method === 'POST'");
    expect(source).toContain(
      'contentSchemaRegistryMutationOperationFromRequest',
    );
    expect(source).toContain('forwardContentSchemaRegistryMutation');
    expect(source).toContain('CMS-03A-12');
    expect(source).toContain('CMS-03A-14');
    for (const foreign of [
      'CMS-03A-01',
      'CMS-03A-02',
      'CMS-03A-03',
      'CMS-03A-04',
      'CMS-03A-09',
      'CMS-03A-10',
      'CMS-03A-11',
    ])
      expect(source).not.toContain(foreign);
    expect(source).toContain('reviewId');
  });

  it('redirects a successful command back to the review route carrying only the review id', () => {
    const source = requireSource(REVIEW_PAGE);
    expect(source).toContain('/app/cms-content-modeling/schema-reviews/');
    expect(source).toContain('encodeURIComponent(reviewId');
    expect(source).not.toMatch(/reviewerPersonId|actorId|actingPartyId/u);
  });

  it('routes a native 401 STEP_UP_REQUIRED to the step-up page instead of returning JSON', () => {
    const source = requireSource(REVIEW_PAGE);
    expect(source).toContain('STEP_UP_REQUIRED');
    expect(source).toContain('/step-up?returnTo=');
  });
});

describe('[DEC-108] version page native POST allowlist', () => {
  it('admits the successor, dry-run and submit-review commands alongside field, relation and activation', () => {
    const source = requireSource(VERSION_PAGE);
    for (const operation of [
      'CMS-03A-02',
      'CMS-03A-03',
      'CMS-03A-04',
      'CMS-03A-09',
      'CMS-03A-10',
      'CMS-03A-11',
    ])
      expect(source).toContain(operation);
  });

  it('keeps the review-scoped commands off the version page', () => {
    const source = requireSource(VERSION_PAGE);
    expect(source).toContain('CMS-03A-09');
    expect(source).not.toContain('CMS-03A-12');
    expect(source).not.toContain('CMS-03A-14');
  });

  it('routes a native 401 STEP_UP_REQUIRED activation to the step-up page', () => {
    const source = requireSource(VERSION_PAGE);
    expect(source).toContain('STEP_UP_REQUIRED');
    expect(source).toContain('/step-up?returnTo=');
  });

  it('sends a submitted review to the protected review route', () => {
    expect(requireSource(VERSION_PAGE)).toContain('/schema-reviews/');
  });
});
