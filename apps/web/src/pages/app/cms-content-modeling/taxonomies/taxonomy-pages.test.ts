import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const read = (name: string): string =>
  readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8');

/*
 * The vocabulary pages are a tested loader plus tested islands
 * (`load-taxonomy-page.test.ts`, `CmsTaxonomyVersionDesigner*.test.tsx`,
 * `CmsTaxonomyTermForm*.test.tsx`); this suite reads each Astro file for the response
 * invariants no other test can.
 */
describe.each([
  ['new.astro', 'taxonomyId: null'],
  ['[taxonomyId].astro', "taxonomyId: Astro.params.taxonomyId ?? ''"],
])('%s', (name, idArgument) => {
  const source = read(name);

  it('renders on demand with no-store headers and answers only GET', () => {
    expect(source).toContain('export const prerender = false');
    expect(source).toContain(
      "Astro.response.headers.set('Cache-Control', 'no-store')",
    );
    expect(source).toContain("Astro.request.method !== 'GET'");
    expect(source).toContain("allow: 'GET'");
  });

  it('delegates to the loader with the page request and the server binding only', () => {
    expect(source).toContain('loadTaxonomyPage');
    expect(source).toContain(idArgument);
    expect(source).toContain('createTaxonomyPageReads(env.PLATFORM_API)');
    expect(source).not.toContain('service_role');
    expect(source).not.toContain('Astro.request.headers');
  });

  it('redirects an expired session with a 303 and takes its status from the loader', () => {
    expect(source).toContain(
      "if (outcome.kind === 'redirect') return cmsRedirectResponse(outcome.location)",
    );
    expect(source).toContain(
      "outcome.kind === 'view' ? outcome.status : outcome.notice.status",
    );
  });

  it('hydrates the designer only from a verified view and shows a closed notice otherwise', () => {
    expect(source).toMatch(/outcome\.kind === 'view' \?/u);
    expect(source).toContain('<CmsTaxonomyVersionDesigner');
    expect(source).toContain('csrfToken={outcome.view.csrfToken}');
    expect(source).toContain('client:load');
    expect(source).toContain(
      '<CmsEditorialPageNotice notice={outcome.notice} />',
    );
  });

  it('keeps the response under the 200-line page cap', () => {
    expect(source.split('\n').length).toBeLessThanOrEqual(200);
  });
});

describe('the new-vocabulary page', () => {
  const source = read('new.astro');

  it('starts without a saved version and carries no term form or review panel', () => {
    expect(source).toContain('latest={null}');
    expect(source).not.toContain('CmsTaxonomyTermForm');
    expect(source).not.toContain('Governed');
  });
});

describe('the saved-vocabulary page', () => {
  const source = read('[taxonomyId].astro');

  it('prefills the designer from the verified newest version and its history', () => {
    expect(source).toContain('latest={outcome.view.latest}');
    expect(source).toContain('versions={outcome.view.versions}');
  });

  it('mounts the term form only from a verified vocabulary and term page', () => {
    expect(source).toMatch(
      /\{\s*outcome\.view\.vocabulary !== null && outcome\.view\.terms !== null \?\s*\(\s*<CmsTaxonomyTermForm/u,
    );
    for (const prop of [
      'vocabulary={outcome.view.vocabulary}',
      'terms={outcome.view.terms}',
      'query={outcome.view.query}',
      'basePath={outcome.view.basePath}',
      'reviewHref={taxonomyReviewHref(panelReview)}',
    ])
      expect(source).toContain(prop);
  });
});
