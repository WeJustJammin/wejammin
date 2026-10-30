import { expect, test, type Locator, type Page } from '@playwright/test';

import { psql } from '../postgrest/support/stack';
import { waitForIslands, type SignedIn } from './support/s10-real-browser';
import { seedEntry } from './support/s10-real-api';
import {
  COMPOSITION_PAGE,
  LOCALE_PAGE,
  PATTERN_NEW_PAGE,
  PATTERN_PAGE,
  PATTERN_VERSIONS_API,
  definePatternViaApi,
  localizedWorld,
} from './support/s12-pw5-world';
import {
  activateViaApi,
  prepareJourneyCast,
  within,
  type JourneyCast,
} from './support/s12-pw7-flow';
import {
  definePatternWithBlock,
  ownedPatternBlock,
  type OwnedBlock,
} from './support/s12-pw7-block';
import { typeKeyOf } from './support/s12-pw7-world';

/*
 * P2-S12 page-level OPERATIONS (DEC-241 reading 6: a mount-only page test does not close "consumed by <island> at
 * /app/..."; a test must PERFORM the operation from the page). Each test opens the PRODUCTION-BUILT Astro route of the
 * clause through the REAL composition (web proxy -> private binding -> production Worker -> production RPC adapter ->
 * Kong -> PostgREST -> the Slice 12 SQL), does the operation with the page's own controls, and then checks what the
 * database committed and what a fresh load of the page shows. The page's own HTTP answer is asserted too (status,
 * strong ETag, If-Match), so the test cannot pass on a form that never reached the command.
 *
 *   AC-058  CMS-03C-04 saves a translation from /entries/:entryId/locales/:locale
 *   AC-105  CMS-03C-12 saves a first version from /patterns/new and a successor from /patterns/:patternKey
 *   AC-111  CMS-03C-13 lists an active compatible pattern in the instance-insert form of /entries/:entryId/composition,
 *           and the pattern chosen there is placed (CMS-03C-02)
 *
 * Written without a running stack (the lane may not run one): selectors follow the component sources, so a first run may
 * need an exact label adjusted. Local loopback only; never hosted evidence.
 */
const SELECTOR = 'select#cms-composition-pattern';
const PLACEMENT = '/api/v1/cms/compositions/pattern-instances';

let journey: JourneyCast;
let typeKey: string;
let block: OwnedBlock;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);
  journey = await prepareJourneyCast(
    browser,
    test.info().project.use.baseURL,
    'ops',
  );
  typeKey = typeKeyOf(journey.cast.world);
  // The designer's chooser lists only blocks the acting party registered (see support/s12-pw7-block.ts).
  block = await ownedPatternBlock(journey.cast.world);
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

const posted = (page: Page, suffix: string) =>
  page.waitForResponse(
    (response) =>
      response.url().endsWith(suffix) && response.request().method() === 'POST',
  );

test('[P2-S12-AC-058] saves a translation from /entries/:entryId/locales/:locale: the command is sent, one draft variant is committed, and a fresh load shows the stored translation', async () => {
  test.setTimeout(180_000);
  const { author } = journey;
  const localized = await localizedWorld(journey.cast.world);
  const entry = await seedEntry(author.client, localized, 'Source title');
  const { page } = author;
  await openPage(author, LOCALE_PAGE(entry.entryId, 'fr-FR'), 'Translate');
  const row = page.getByRole('group', { name: 'Title translation' });
  const field = row.getByRole('textbox', { name: 'Title' });
  await expect(field).toHaveValue('');
  await expect(page.locator('.cms-locale-facts')).toContainText('Untranslated');
  await field.fill('Titre traduit');

  const command = posted(
    page,
    `/api/v1/cms/entries/${entry.entryId}/locales/fr-FR/variants`,
  );
  await page.getByRole('button', { name: 'Save translation' }).click();
  const response = await command;
  expect(response.status()).toBe(201);
  expect(response.request().headers()['if-match']).toBe(`"${entry.version}"`);
  expect(response.headers()['etag']).toBe(
    `"${String(BigInt(entry.version) + 1n)}"`,
  );
  expect(response.headers()['cache-control']).toBe('no-store');

  // The page states the outcome in words, and the row says it was saved in this draft.
  await expect(
    page.getByRole('heading', { name: 'Translation saved as a draft' }),
  ).toBeVisible(within);
  await expect(row).toContainText('Saved in this draft.');
  await expect(page.locator('.cms-locale-status')).toContainText(
    '1 field saved in fr-FR',
  );

  // The database holds exactly one draft variant of that entry and language.
  expect(
    psql(
      `select count(*) || '|' || min(state) from platform_private.cms_locale_variants
        where entry_id = '${entry.entryId}' and locale = 'fr-FR'`,
    ),
  ).toBe('1|draft');

  // A fresh load of the page starts from the stored translation and names the derived state.
  await openPage(author, LOCALE_PAGE(entry.entryId, 'fr-FR'), 'Translate');
  await expect(
    page
      .getByRole('group', { name: 'Title translation' })
      .getByRole('textbox', { name: 'Title' }),
  ).toHaveValue('Titre traduit');
  await expect(page.locator('.cms-locale-facts')).toContainText('Draft');
  expect(author.browserErrors).toEqual([]);
});

const versionsOf = (patternKey: string): string =>
  psql(
    `select coalesce(string_agg(version::text || ':' || state, ',' order by version), '')
       from platform_private.cms_pattern_versions where pattern_key = '${patternKey}'`,
  );

test('[P2-S12-AC-105] saves a first pattern version from /patterns/new: the form sends CMS-03C-12, a draft is committed, and the page links the saved pattern', async () => {
  test.setTimeout(180_000);
  const { designer } = journey;
  const { page } = designer;
  const patternKey = `s12-ops-${crypto.randomUUID().slice(0, 8).replaceAll('-', '')}`;
  await openPage(designer, PATTERN_NEW_PAGE, 'Pattern designer');
  const form = page.getByRole('group', { name: 'Pattern definition' });
  await form.getByLabel('Pattern key').fill(patternKey);
  await form.getByRole('checkbox', { name: typeKey, exact: true }).check();
  await form.getByRole('button', { name: 'Add a top-level block' }).click();
  // The chooser lists the blocks this acting party registered; name the absence instead of waiting out the test.
  await expect(
    form.getByLabel('Node 1 block').locator(`option[value="${block.ref}"]`),
  ).toHaveCount(1);
  await form.getByLabel('Node 1 block').selectOption(block.ref);
  await form
    .getByLabel('Node 1 props (JSON object)')
    .fill(JSON.stringify({ title: 'Saved from the new-pattern page' }));

  const command = posted(page, PATTERN_VERSIONS_API);
  await form.getByRole('button', { name: 'Create draft' }).click();
  const response = await command;
  expect(response.status()).toBe(201);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(response.headers()['etag']).toBe('"1"');
  await expect(
    page.getByRole('heading', { name: 'Pattern draft saved' }),
  ).toBeVisible(within);
  expect(versionsOf(patternKey)).toBe('1:draft');

  // The saved pattern is what the page's own link opens: the successor page, from version 1.
  await page
    .getByRole('link', {
      name: 'Open the latest draft to submit it for review',
    })
    .click();
  await waitForIslands(page);
  await expect(page).toHaveURL(new RegExp(`${PATTERN_PAGE(patternKey)}$`, 'u'));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Edit pattern draft',
  );
  await expect(page.getByText(/^Editing from version 1\./u)).toBeVisible();
  await expect(page.getByLabel('Pattern key')).toHaveValue(patternKey);
  expect(designer.browserErrors).toEqual([]);
});

test('[P2-S12-AC-105] saves a successor version from /patterns/:patternKey: the form sends version 1 as If-Match, version 2 is committed beside it', async () => {
  test.setTimeout(180_000);
  const { designer } = journey;
  const { page } = designer;
  const saved = await definePatternWithBlock(
    designer.client,
    journey.cast.world,
    block,
    'pw7 successor base',
  );
  expect(versionsOf(saved.patternKey)).toBe('1:draft');
  await openPage(
    designer,
    PATTERN_PAGE(saved.patternKey),
    'Edit pattern draft',
  );
  await expect(page.getByLabel('Node 1 block')).toHaveValue(block.ref);
  const props = page.getByLabel('Node 1 props (JSON object)');
  await expect(props).toHaveValue(/pw7 successor base/u);
  await props.fill(JSON.stringify({ title: 'Successor saved from the page' }));

  const command = posted(page, PATTERN_VERSIONS_API);
  await page.getByRole('button', { name: 'Save successor draft' }).click();
  const response = await command;
  expect(response.status()).toBe(201);
  expect(response.request().headers()['if-match']).toBe('"1"');
  expect(response.headers()['etag']).toBe('"2"');
  await expect(
    page.getByRole('heading', { name: 'Pattern draft saved' }),
  ).toBeVisible(within);
  expect(versionsOf(saved.patternKey)).toBe('1:draft,2:draft');

  // A fresh load edits from the newest version and shows its saved props.
  await openPage(
    designer,
    PATTERN_PAGE(saved.patternKey),
    'Edit pattern draft',
  );
  await expect(page.getByText(/^Editing from version 2\./u)).toBeVisible();
  await expect(page.getByLabel('Node 1 props (JSON object)')).toHaveValue(
    /Successor saved from the page/u,
  );
  expect(designer.browserErrors).toEqual([]);
});

/** Loads more patterns until `option` is listed (the selector pages its list). */
const listUntil = async (
  insert: Locator,
  selector: Locator,
  option: Locator,
): Promise<void> => {
  for (let guard = 0; guard < 50 && (await option.count()) === 0; guard += 1) {
    const more = insert.getByRole('button', { name: 'Load more patterns' });
    if (!(await more.isVisible())) break;
    const before = await selector.locator('option').count();
    await more.click();
    await expect
      .poll(() => selector.locator('option').count(), within)
      .toBeGreaterThan(before);
  }
};

test('[P2-S12-AC-111] lists an active compatible pattern in the instance-insert form of /entries/:entryId/composition and places the pattern chosen there', async () => {
  test.setTimeout(300_000);
  const { author, designer } = journey;
  const { page } = author;
  const saved = await definePatternViaApi(
    designer.client,
    journey.cast.world,
    'pw7 placed pattern',
  );
  await activateViaApi(
    journey,
    designer,
    'pattern_version',
    saved,
    'Approved so that the pattern is listed in the selector.',
  );
  expect(versionsOf(saved.patternKey)).toBe('1:active');
  const entry = await seedEntry(
    author.client,
    journey.cast.world,
    'pw7 composition',
  );

  await openPage(author, COMPOSITION_PAGE(entry.entryId), 'Composition');
  const insert = page.getByRole('region', { name: 'Insert a pattern' });
  const selector = insert.locator(SELECTOR);
  await expect(selector).toHaveValue('');
  const option = selector.locator('option', {
    hasText: `${saved.patternKey} version 1 (1 node)`,
  });
  await listUntil(insert, selector, option);
  // CMS-03C-13 listed the activated pattern for this entry's content type; the chooser is never preselected.
  await expect(option).toHaveCount(1);
  await expect(
    page.getByText('No pattern instances are listed yet.'),
  ).toBeVisible();

  await selector.selectOption({
    value: (await option.getAttribute('value')) ?? '',
  });
  await insert
    .getByRole('radio', { name: /^Linked: receives pattern updates/u })
    .check();
  await insert.getByLabel('Slot path').fill('/');
  const command = posted(page, PLACEMENT);
  await insert.getByRole('button', { name: 'Place pattern' }).click();
  const response = await command;
  expect(response.status()).toBe(201);
  expect(response.request().headers()['if-match']).toBe(`"${entry.version}"`);
  expect(response.headers()['etag']).toBe(
    `"${String(BigInt(entry.version) + 1n)}"`,
  );

  // The named result takes the page, and the placed block root is listed as a row of the entry's draft.
  await expect(
    page.getByRole('heading', { name: 'Pattern placed' }),
  ).toBeVisible(within);
  await expect(page.locator('[data-row-count]')).toHaveText('1 row');
  await expect(page.locator('.cms-instance-row code')).toHaveText('/root1');

  // The database holds exactly that placement, linked and active, on the entry's draft revision.
  expect(
    psql(
      `select count(*)::text || '|' || min(path) || '|' || min(link_mode) || '|' || min(state)
         from platform_private.cms_composition_instances
        where revision_id = '${entry.firstRevisionId}' and pattern_id = '${saved.patternId}'`,
    ),
  ).toBe('1|/root1|linked|active');

  // A fresh load lists the stored row (the read is the protected instances read, not the page's memory).
  await openPage(author, COMPOSITION_PAGE(entry.entryId), 'Composition');
  await expect(page.locator('[data-row-count]')).toHaveText('1 row');
  await expect(page.locator('.cms-instance-row code')).toHaveText('/root1');
  expect(author.browserErrors).toEqual([]);
});
