import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const fromHere = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

const page = (relative: string): string =>
  readFileSync(
    fromHere(`../../pages/app/cms-content-modeling/${relative}`),
    'utf8',
  );

/*
 * Reachability and mounting guards (vertical-slices rule: every new route is
 * reachable from an existing navigation element; FE03 :1066 mounts the bounded
 * governed panel on the template designer page). Read as text, like the other
 * Astro route guards.
 */
describe('definition reviews are reachable from the content-modeling registry', () => {
  const index = page('index.astro');
  const primary = index.match(
    /<nav aria-label="Primary navigation">[\s\S]*?<\/nav>/u,
  );

  it('places a link to the queue in the primary navigation landmark', () => {
    expect(primary, 'no primary navigation landmark').not.toBeNull();
    expect(primary?.[0]).toContain(
      'href="/app/cms-content-modeling/definition-reviews"',
    );
    expect(primary?.[0]).toContain('Definition reviews');
  });

  it('keeps the editorial reviewer queue link beside it', () => {
    expect(primary?.[0]).toContain('href="/app/cms-content-modeling/reviews"');
  });
});

describe('the template designer page mounts the bounded governed panel', () => {
  const source = page('templates/[templateKey].astro');

  it('hydrates the panel only from a verified detail, and passes it only the served facts', () => {
    expect(source).toContain('CmsGovernedTemplatePanel');
    expect(source).toMatch(
      /detail !== null \?\s*\(\s*<CmsGovernedTemplatePanel/u,
    );
    for (const fact of [
      'id: detail.id',
      'contentHash: detail.contentHash',
      'templateKey: detail.templateKey',
      'templateVersion: detail.templateVersion',
      'state: detail.state',
    ])
      expect(source).toContain(fact);
  });

  it('serializes no content, slot or binding of the template into the panel island', () => {
    const mount = source.slice(source.indexOf('<CmsGovernedTemplatePanel'));
    const props = mount.slice(0, mount.indexOf('client:load'));
    for (const forbidden of [
      'slots',
      'bindings',
      'compatibleTypeIds',
      'csrfToken',
    ])
      expect(props).not.toContain(forbidden);
  });

  it("resolves the version's review on the server and hands the panel only its summary (FE03 :877, :1066)", () => {
    expect(source).toContain('loadGovernedSubjectReview');
    expect(source).toContain("kind: 'template_version'");
    expect(source).toContain('review={panelReview}');
  });

  it('does not add a script of its own', () => {
    expect(source.match(/<script/gu)).toHaveLength(2);
  });
});

describe('the pattern designer is reachable from the content-modeling registry', () => {
  const primary = page('index.astro').match(
    /<nav aria-label="Primary navigation">[\s\S]*?<\/nav>/u,
  );

  it('places a link to the pattern designer in the primary navigation landmark', () => {
    expect(primary, 'no primary navigation landmark').not.toBeNull();
    expect(primary?.[0]).toContain(
      'href="/app/cms-content-modeling/patterns/new"',
    );
    expect(primary?.[0]).toContain('Pattern designer');
  });
});

describe('the pattern designer page mounts the bounded governed panel', () => {
  const source = page('patterns/[patternKey].astro');

  it('hydrates the panel only from a verified view, and passes it only the served facts', () => {
    expect(source).toContain('CmsGovernedPatternPanel');
    expect(source).toMatch(
      /outcome\.view\.panel !== null \?\s*\(\s*<CmsGovernedPatternPanel\s+detail=\{outcome\.view\.panel\}/u,
    );
  });

  it('serializes no tree, props or token into the panel island', () => {
    const mount = source.slice(source.indexOf('<CmsGovernedPatternPanel'));
    const props = mount.slice(0, mount.indexOf('client:load'));
    for (const forbidden of ['blockTree', 'csrfToken', 'latest', 'context'])
      expect(props).not.toContain(forbidden);
  });

  it("resolves the version's review on the server and hands the panel only its summary (FE03 :877, :1066)", () => {
    expect(source).toContain('loadGovernedSubjectReview');
    expect(source).toContain("kind: 'pattern_version'");
    expect(source).toContain('review={panelReview}');
  });

  it('is mounted on the saved-pattern page only, never on the new-pattern page', () => {
    expect(page('patterns/new.astro')).not.toContain('Governed');
  });
});

describe('the vocabulary designer is reachable from the content-modeling registry', () => {
  const primary = page('index.astro').match(
    /<nav aria-label="Primary navigation">[\s\S]*?<\/nav>/u,
  );

  it('places a link to the new-vocabulary page in the primary navigation landmark', () => {
    expect(primary, 'no primary navigation landmark').not.toBeNull();
    expect(primary?.[0]).toContain(
      'href="/app/cms-content-modeling/taxonomies/new"',
    );
    expect(primary?.[0]).toContain('Vocabularies');
  });
});

describe('the vocabulary page mounts the bounded governed panel', () => {
  const source = page('taxonomies/[taxonomyId].astro');

  it('hydrates the panel only from a verified view, and passes it only the served facts', () => {
    expect(source).toContain('CmsGovernedTaxonomyPanel');
    expect(source).toMatch(
      /outcome\.view\.panel !== null \?\s*\(\s*<CmsGovernedTaxonomyPanel\s+detail=\{outcome\.view\.panel\}/u,
    );
  });

  it('serializes no rules, terms or token into the panel island', () => {
    const mount = source.slice(source.indexOf('<CmsGovernedTaxonomyPanel'));
    const props = mount.slice(0, mount.indexOf('client:load'));
    for (const forbidden of ['latest', 'terms', 'csrfToken', 'versions'])
      expect(props).not.toContain(forbidden);
  });

  it("resolves the version's review on the server and hands the panel only its summary (FE03 :877, :1066)", () => {
    expect(source).toContain('loadGovernedSubjectReview');
    expect(source).toContain("kind: 'taxonomy_version'");
    expect(source).toContain('review={panelReview}');
  });

  it('is mounted on the saved-vocabulary page only, never on the new-vocabulary page', () => {
    expect(page('taxonomies/new.astro')).not.toContain('Governed');
  });
});

describe('the definition-review detail mounts the activation form (FE03 :1069, DEC-190)', () => {
  const here = (relative: string): string =>
    readFileSync(fromHere(relative), 'utf8');

  it('renders CmsGovernedActivationForm inside the detail island from the verified review only', () => {
    // FE03 :1736-1745 (island budget): the form is a lazily loaded view of the same component.
    const island = here('./CmsGovernedReviewDetailIsland.tsx');
    expect(here('./governed-review-form-views.ts')).toContain(
      "import('./CmsGovernedActivationForm')",
    );
    expect(island).toMatch(
      /<GovernedActivationFormView\s+\{\.\.\.shared\}\s+review=\{review\}/u,
    );
  });

  it('keeps the activation proxy at the registry path, a POST-only endpoint', () => {
    const route = here(
      '../../pages/api/v1/cms/governed-reviews/[reviewId]/activation.ts',
    );
    expect(route).toContain("'CMS-03C-09'");
    expect(route).toContain('export const POST');
    expect(route).not.toMatch(/export const (GET|PUT|PATCH|DELETE)/u);
  });

  it('no longer tells the owner that activation is unavailable', () => {
    for (const file of [
      './CmsGovernedReviewPanel.tsx',
      './governed-review-labels.ts',
      './CmsGovernedReviewDetailIsland.tsx',
    ])
      expect(here(file)).not.toContain('not available from this panel');
  });
});
