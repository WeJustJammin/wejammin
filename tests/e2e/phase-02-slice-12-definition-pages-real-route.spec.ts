import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  requireLoopbackOrigin,
  waitForIslands,
  type SignedIn,
} from './support/s10-real-browser';
import { seedEntry } from './support/s10-real-api';
import { provisionAuthor } from './support/s10-real-world';
import { signInS11, type S11Actor } from './support/s11-real-browser';
import {
  REVIEW_PAGE,
  TAXONOMY_PAGE,
  defineTaxonomyViaApi,
  prepareGovernedCast,
  submitGovernedViaApi,
  type GovernedCast,
} from './support/s12-governed-world';
import {
  COMPOSITION_PAGE,
  LOCALE_PAGE,
  PATTERN_NEW_PAGE,
  PATTERN_PAGE,
  TAXONOMY_NEW_PAGE,
  definePatternViaApi,
  localizedWorld,
  provisionDesigner,
} from './support/s12-pw5-world';

/*
 * P2-S12 page-level proofs (DEC-226 rule 3: "consumed by <island> at /app/..." needs page-level behaviour): each test
 * opens the PRODUCTION-BUILT Astro route of the clause through the REAL composition (web proxy -> private binding ->
 * production Worker -> production RPC adapter -> Kong -> PostgREST -> the Slice 12 SQL) and asserts that the page mounts
 * the island the clause names, hydrated, with the facts the protected read supplied. The component, loader and source-
 * text suites cannot show that the PAGE mounts the island. The template and locale routes keep their test-owned
 * fixtures (support/s12-real-governed.ts); this file does not use them except where it says so.
 *
 * Written without a running stack (the lane may not run one): selectors follow the component sources, so a first run may
 * need an exact label adjusted. Local loopback only; never hosted evidence.
 */
const island = (page: Page, component: string): Locator =>
  page.locator(`astro-island[component-url*="${component}"]`);

let cast: GovernedCast;
let curator: SignedIn;
let owner: SignedIn;
let reviewer: SignedIn;
let designerActor: S11Actor;
let designer: SignedIn;
let author: SignedIn;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  requireLoopbackOrigin(test.info().project.use.baseURL);
  cast = await prepareGovernedCast();
  curator = await signInS11(browser, cast.world, cast.curator, null);
  owner = await signInS11(browser, cast.world, cast.owner, null);
  reviewer = await signInS11(browser, cast.world, cast.reviewer, null);
  designerActor = provisionDesigner(cast.world);
  designer = await signInS11(browser, cast.world, designerActor, null);
  const authorActor: S11Actor = {
    principal: provisionAuthor(cast.world, 's12-pw5-author'),
    capabilities: ['cms.author', 'cms.editor'],
  };
  author = await signInS11(browser, cast.world, authorActor, null);
});

/** A no-store 200 page whose route heading is `heading`; returns once every island has hydrated. */
const openPage = async (
  signedIn: SignedIn,
  path: string,
  heading: string,
): Promise<void> => {
  signedIn.browserErrors.length = 0;
  const response = await signedIn.page.goto(path, {
    waitUntil: 'domcontentloaded',
  });
  expect(response?.status(), path).toBe(200);
  expect(response?.headers()['cache-control']).toBe('no-store');
  await waitForIslands(signedIn.page);
  await expect(signedIn.page.getByRole('heading', { level: 1 })).toHaveText(
    heading,
  );
};

test('[P2-S12-AC-129] opens /taxonomies/new and mounts the CmsTaxonomyVersionDesigner form for a curator', async () => {
  const { page } = curator;
  await openPage(curator, TAXONOMY_NEW_PAGE, 'Vocabulary designer');
  await expect(island(page, 'CmsTaxonomyVersionDesigner')).toHaveCount(1);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Define a vocabulary' }),
  ).toBeVisible();
  const form = page.getByRole('group', { name: 'Vocabulary rules' });
  await expect(form).toBeVisible();
  await expect(form.getByLabel('Vocabulary key')).toBeEditable();
  await expect(
    form.getByRole('button', { name: 'Create draft' }),
  ).toBeEnabled();
  // A new vocabulary has no version history, no review panel and no term form.
  await expect(island(page, 'CmsGovernedTaxonomyPanel')).toHaveCount(0);
  await expect(island(page, 'CmsTaxonomyTermForm')).toHaveCount(0);
  expect(curator.browserErrors).toEqual([]);
});

test('[P2-S12-AC-129] [P2-S12-AC-182] opens /taxonomies/:taxonomyId and mounts the designer and the review panel from the versions read', async () => {
  const subject = await defineTaxonomyViaApi(curator.client, cast.world);
  const { page } = curator;
  await openPage(
    curator,
    TAXONOMY_PAGE(subject.taxonomyId),
    'Govern a vocabulary',
  );
  // cmsTaxonomyVersionsRead supplies the designer (key, base version, version table) and the panel (lifecycle).
  await expect(island(page, 'CmsTaxonomyVersionDesigner')).toHaveCount(1);
  await expect(island(page, 'CmsGovernedTaxonomyPanel')).toHaveCount(1);
  await expect(
    page.getByRole('heading', {
      level: 2,
      name: /^Rules of s12-gov-[a-z0-9]+$/u,
    }),
  ).toBeVisible();
  await expect(page.getByText(/^Editing from version 1\./u)).toBeVisible();
  await expect(
    page.getByRole('table', {
      name: /^Versions of this vocabulary, newest first \(1\)$/u,
    }),
  ).toBeVisible();
  await expect(page.getByLabel('Vocabulary key')).toHaveAttribute(
    'readonly',
    '',
  );
  await expect(
    page.getByRole('button', { name: 'Save successor draft' }),
  ).toBeEnabled();
  await expect(
    page.getByRole('heading', { level: 2, name: 'Definition review' }),
  ).toBeVisible();
  await expect(page.locator('[data-governed-lifecycle]')).toContainText(
    'Lifecycle: Draft',
  );
  await expect(
    page.getByRole('button', { name: 'Submit for review' }),
  ).toBeVisible();
  expect(curator.browserErrors).toEqual([]);
});

test('[P2-S12-AC-093] opens /definition-reviews/:reviewId and mounts the CmsGovernedReviewDetail evidence for the owner', async () => {
  const subject = await defineTaxonomyViaApi(curator.client, cast.world);
  const review = await submitGovernedViaApi(curator.client, subject);
  const { page } = owner;
  await openPage(owner, REVIEW_PAGE(review.reviewId), 'Definition review');
  await expect(island(page, 'CmsGovernedReviewDetailIsland')).toHaveCount(1);
  const detail = page.locator('[data-cms-governed-review-detail]');
  await expect(detail).toBeVisible();
  // CMS-03C-10 supplies the evidence: the subject in words, the state line, the frozen hash and the policy slots.
  await expect(
    detail.getByRole('heading', {
      level: 2,
      name: /^Vocabulary s12-gov-[a-z0-9]+, version 1$/u,
    }),
  ).toBeVisible();
  await expect(detail).toContainText('State: Open');
  await expect(detail).toContainText('Subject: In review');
  await expect(detail).toContainText('Risk class: Ordinary');
  await expect(detail).toContainText(`Subject hash: ${subject.contentHash}`);
  await expect(
    detail.getByRole('heading', { level: 2, name: 'Frozen version' }),
  ).toBeVisible();
  await expect(
    detail.getByRole('heading', { level: 2, name: 'Review policy' }),
  ).toBeVisible();
  await expect(detail).toContainText('No decisions recorded yet.');
  expect(owner.browserErrors).toEqual([]);
});

test('[P2-S12-AC-105] opens /patterns/new and mounts the CmsPatternVersionDesigner form for a template designer', async () => {
  const { page } = designer;
  await openPage(designer, PATTERN_NEW_PAGE, 'Pattern designer');
  await expect(island(page, 'CmsPatternVersionDesigner')).toHaveCount(1);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Define a pattern' }),
  ).toBeVisible();
  const form = page.getByRole('group', { name: 'Pattern definition' });
  await expect(form).toBeVisible();
  await expect(form.getByLabel('Pattern key')).toBeEditable();
  await expect(
    page.getByRole('heading', { level: 3, name: 'Block tree' }),
  ).toBeVisible();
  // A new pattern has no saved version, so no review panel.
  await expect(island(page, 'CmsGovernedPatternPanel')).toHaveCount(0);
  expect(designer.browserErrors).toEqual([]);
});

test('[P2-S12-AC-105] [P2-S12-AC-176] opens /patterns/:patternKey and mounts the designer and the review panel from the latest read', async () => {
  const saved = await definePatternViaApi(designer.client, cast.world);
  const { page } = designer;
  await openPage(
    designer,
    PATTERN_PAGE(saved.patternKey),
    'Edit pattern draft',
  );
  // cmsPatternLatestRead supplies the designer (key, base version, facts) and the panel (lifecycle).
  await expect(island(page, 'CmsPatternVersionDesigner')).toHaveCount(1);
  await expect(island(page, 'CmsGovernedPatternPanel')).toHaveCount(1);
  await expect(
    page.getByRole('heading', { level: 2, name: `Edit ${saved.patternKey}` }),
  ).toBeVisible();
  await expect(page.getByText(/^Editing from version 1\./u)).toBeVisible();
  await expect(page.getByLabel('Pattern key')).toHaveAttribute('readonly', '');
  await expect(page.locator('.cms-pattern-facts')).toContainText(
    'Nodes after expansion',
  );
  await expect(
    page.getByRole('heading', { level: 2, name: 'Definition review' }),
  ).toBeVisible();
  await expect(page.locator('[data-governed-lifecycle]')).toContainText(
    'Lifecycle: Draft',
  );
  await expect(
    page.getByRole('button', { name: 'Submit for review' }),
  ).toBeVisible();
  expect(designer.browserErrors).toEqual([]);
});

test('[P2-S12-AC-176] a saved pattern is a 403 notice, not a form, for a session without the template designer capability', async () => {
  const saved = await definePatternViaApi(designer.client, cast.world);
  const { page } = reviewer;
  reviewer.browserErrors.length = 0;
  const response = await page.goto(PATTERN_PAGE(saved.patternKey), {
    waitUntil: 'domcontentloaded',
  });
  expect(response?.status()).toBe(403);
  expect(response?.headers()['cache-control']).toBe('no-store');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Access denied',
  );
  await expect(page.locator('[data-cms-editorial-notice="403"]')).toContainText(
    'Template designer access is required for the current acting context.',
  );
  await expect(island(page, 'CmsPatternVersionDesigner')).toHaveCount(0);
  await expect(island(page, 'CmsGovernedPatternPanel')).toHaveCount(0);
  await expect(page.getByRole('main').locator('form')).toHaveCount(0);
  await expect(page.getByRole('main')).not.toContainText(saved.patternKey);
  expect(reviewer.browserErrors).toEqual([]);
});

test('[P2-S12-AC-111] opens /entries/:entryId/composition and mounts the CmsPatternSelector in the instance-insert form', async () => {
  const entry = await seedEntry(author.client, cast.world, 'pw5 composition');
  const { page } = author;
  await openPage(author, COMPOSITION_PAGE(entry.entryId), 'Composition');
  await expect(island(page, 'CmsCompositionPage')).toHaveCount(1);
  const insert = page.getByRole('region', { name: 'Insert a pattern' });
  await expect(insert).toBeVisible();
  // CMS-03C-13 supplies the chooser: a native select labelled Pattern, never preselected, with its result count announced.
  const selector = insert.getByLabel('Pattern', { exact: true });
  await expect(selector).toBeVisible();
  await expect(selector).toHaveValue('');
  await expect(selector.locator('option').first()).toHaveText(
    'Choose a pattern',
  );
  await expect(insert.getByRole('status').first()).toHaveText(
    /^\d+ compatible patterns?$/u,
  );
  await expect(insert.getByLabel('Slot path')).toBeVisible();
  await expect(insert.getByRole('group', { name: 'Link mode' })).toBeVisible();
  expect(author.browserErrors).toEqual([]);
});

test('[P2-S12-AC-058] opens /entries/:entryId/locales/:locale and mounts the CmsLocaleVariantForm from the locale variant read', async () => {
  // An entry of a content type that supports fr-FR with a localized title (the CMS-03C-04 recipe of the API suites).
  const localized = await localizedWorld(cast.world);
  const entry = await seedEntry(author.client, localized, 'Source title');
  const { page } = author;
  await openPage(author, LOCALE_PAGE(entry.entryId, 'fr-FR'), 'Translate');
  await expect(island(page, 'CmsLocaleVariantForm')).toHaveCount(1);
  // cmsLocaleVariantRead supplies the variant, the resolutions and the fallback order; the entry read supplies the source.
  const fields = page.getByRole('group', { name: 'Localizable fields' });
  await expect(fields).toBeVisible();
  const row = fields.getByRole('group', { name: /translation$/iu });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Source text (en-US)');
  await expect(row).toContainText('Source title');
  await expect(
    page.getByRole('button', { name: 'Save translation' }),
  ).toBeEnabled();
  await expect(
    page.getByRole('link', { name: 'Back to the draft' }),
  ).toHaveAttribute(
    'href',
    `/app/cms-content-modeling/entries/${entry.entryId}`,
  );
  expect(author.browserErrors).toEqual([]);
});
