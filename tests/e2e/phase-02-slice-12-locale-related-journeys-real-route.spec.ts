import { expect, test, type Locator, type Page } from '@playwright/test';

import { psql } from '../postgrest/support/stack';
import { seedEntry } from './support/s10-real-api';
import { waitForIslands, type SignedIn } from './support/s10-real-browser';
import { LOCALE_PAGE } from './support/s12-pw5-world';
import {
  prepareJourneyCast,
  within,
  type JourneyCast,
} from './support/s12-pw7-flow';
import { mixedLocaleWorld } from './support/s12-pw7-world';

/*
 * P2-S12-AC-273 (V11 section 5), two more of the end-to-end journeys, through the REAL composition (production-built
 * Astro routes -> web proxy -> private binding -> production Worker -> production RPC adapter -> Kong -> PostgREST -> the
 * Slice 12 SQL) with the page's own controls:
 *
 *   J4  a locale variant with a `no_fallback` block: an entry of a type with a fallback-allowed `Title` and a `no_fallback`
 *       `Legal notice`. The page states, in words, that the legal field never shows another language and that publishing
 *       the language is blocked while it is missing; a first save translates the title only and leaves the legal notice
 *       missing; a second save translates it and the page then says so. The database holds the `no_fallback` field id on
 *       the stored variant.
 *   J5  related content pinned and excluded: an author pins two entries (and reorders them) and excludes a third from the
 *       related-content page, saves, and a fresh load of the page and the database both hold exactly that rule.
 *
 * Written without a running stack (the lane may not run one): selectors and copy follow the component sources, so a first
 * run may need an exact label adjusted. Local loopback only; never hosted evidence.
 */
let journey: JourneyCast;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);
  journey = await prepareJourneyCast(
    browser,
    test.info().project.use.baseURL,
    'locale-related',
  );
});

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

const FALLBACK_RULE =
  'Fallback allowed: untranslated, it follows the fallback order.';
const NO_FALLBACK_RULE =
  'No fallback: this field is never shown in another language, and publishing this language needs it.';
const NO_FALLBACK_NOTE =
  'The source text is not shown for a no-fallback field.';
const NO_FALLBACK_MISSING =
  'Missing. This field never uses another language, so publishing this language is blocked until you translate it.';
const TRANSLATED = 'Translated in this language.';

test('[P2-S12-AC-273] J4 a locale variant with a no_fallback block: the page names the rule and the missing field, a save translates the title only, and a second save translates the legal notice', async () => {
  test.setTimeout(300_000);
  const { author } = journey;
  const { page } = author;
  const mixed = await mixedLocaleWorld(journey.cast.world);
  const entry = await seedEntry(author.client, mixed, 'Source title');
  const path = LOCALE_PAGE(entry.entryId, 'fr-FR');
  const url = `/api/v1/cms/entries/${entry.entryId}/locales/fr-FR/variants`;
  const title = (): Locator =>
    page.getByRole('group', { name: 'Title translation' });
  const legal = (): Locator =>
    page.getByRole('group', { name: 'Legal notice translation' });

  await openPage(author, path, 'Translate');
  await expect(page.locator('.cms-locale-order')).toContainText('fr-FR: en-US');
  // The fallback-allowed field shows its source and follows the fallback order while untranslated.
  await expect(title()).toContainText('Source text (en-US)');
  await expect(title()).toContainText('Source title');
  await expect(title()).toContainText(FALLBACK_RULE);
  await expect(title()).toContainText(
    /Not translated yet\. Readers see the en-US version through the fallback order\./u,
  );
  // The no_fallback field never shows another language's text and says publishing needs it.
  await expect(legal()).toContainText(NO_FALLBACK_NOTE);
  await expect(legal()).toContainText(NO_FALLBACK_RULE);
  await expect(legal()).toContainText(NO_FALLBACK_MISSING);
  await expect(legal()).not.toContainText('Source title');

  // First save: the title only. The legal notice stays missing and stays blocking.
  await title().getByRole('textbox', { name: 'Title' }).fill('Titre traduit');
  const first = posted(page, url);
  await page.getByRole('button', { name: 'Save translation' }).click();
  expect((await first).status()).toBe(201);
  await expect(
    page.getByRole('heading', { name: 'Translation saved as a draft' }),
  ).toBeVisible(within);
  expect(
    psql(
      `select count(*)::text || '|' || bool_and(no_fallback_field_ids @> '["${mixed.noFallbackFieldId}"]'::jsonb)::text
         from platform_private.cms_locale_variants where entry_id = '${entry.entryId}' and locale = 'fr-FR'`,
    ),
  ).toBe('1|true');
  await openPage(author, path, 'Translate');
  await expect(title()).toContainText(TRANSLATED);
  await expect(legal()).toContainText(NO_FALLBACK_MISSING);
  await expect(page.locator('.cms-locale-facts')).toContainText('Draft');

  // Second save: the legal notice too. The page no longer says it is missing.
  await legal()
    .getByRole('textbox', { name: 'Legal notice' })
    .fill('Mentions légales traduites');
  const second = posted(page, url);
  await page.getByRole('button', { name: 'Save translation' }).click();
  expect((await second).status()).toBe(201);
  await expect(
    page.getByRole('heading', { name: 'Translation saved as a draft' }),
  ).toBeVisible(within);
  await openPage(author, path, 'Translate');
  await expect(legal()).toContainText(TRANSLATED);
  await expect(legal()).not.toContainText(NO_FALLBACK_MISSING);
  await expect(title()).toContainText(TRANSLATED);
  expect(
    psql(
      `select count(*)::text from platform_private.cms_locale_variants
        where entry_id = '${entry.entryId}' and locale = 'fr-FR'`,
    ),
  ).toBe('2');
  expect(author.browserErrors).toEqual([]);
});

const nameOf = (entryId: string): string => `entry ${entryId.slice(-12)}`;
const actionButton = (page: Page, verb: string, entryId: string): Locator =>
  page.getByRole('button', { name: `${verb} ${nameOf(entryId)}`, exact: true });

/** Loads more readable entries until the candidate's row is listed (the picker pages its list). */
const reveal = async (page: Page, entryId: string): Promise<void> => {
  const exclude = actionButton(page, 'Exclude', entryId);
  const rows = page.locator('.cms-related-table tbody tr');
  for (let guard = 0; guard < 50 && (await exclude.count()) === 0; guard += 1) {
    const more = page.getByRole('button', {
      name: /^(Load more entries|Reload the list)$/u,
    });
    if (!(await more.isVisible())) break;
    const before = await rows.count();
    await more.click();
    await expect.poll(() => rows.count(), within).toBeGreaterThan(before);
  }
  await expect(exclude).toHaveCount(1);
};

const ruleRows = (sourceEntryId: string, mode: 'pin' | 'exclude'): string =>
  psql(
    `select coalesce(string_agg(target_entry_id::text, ',' order by position nulls last, target_entry_id), '')
       from platform_private.cms_related_content_rules
      where source_entry_id = '${sourceEntryId}' and mode = '${mode}' and state = 'active'`,
  );

test('[P2-S12-AC-273] J5 related content is pinned and excluded from the entry page: two pins in the chosen order and one exclusion are sent, stored and shown again on a fresh load', async () => {
  test.setTimeout(300_000);
  const { author } = journey;
  const { page } = author;
  const world = journey.cast.world;
  const source = await seedEntry(author.client, world, 'J5 source');
  const first = await seedEntry(author.client, world, 'J5 first pin');
  const second = await seedEntry(author.client, world, 'J5 second pin');
  const excluded = await seedEntry(author.client, world, 'J5 excluded');
  const path = `/app/cms-content-modeling/entries/${source.entryId}/related-content`;

  await openPage(author, path, 'Related content');
  await expect(page.getByText('No entries are pinned.')).toBeVisible();
  await expect(page.getByText('No entries are excluded.')).toBeVisible();
  for (const id of [first.entryId, second.entryId, excluded.entryId])
    await reveal(page, id);
  await actionButton(page, 'Pin', first.entryId).click();
  await actionButton(page, 'Pin', second.entryId).click();
  await actionButton(page, 'Exclude', excluded.entryId).click();
  // Both pins are listed, in the order they were chosen.
  await expect(page.getByText(/^2 of \d+ pins used\./u)).toBeVisible();
  await expect(
    page.locator('ol.cms-related-rows li[data-entry-id]'),
  ).toHaveCount(2);
  // The order is a choice: move the second pin above the first.
  await page
    .getByRole('button', {
      name: new RegExp(
        `^Move up ${nameOf(second.entryId)}, now position 2 of 2$`,
        'u',
      ),
    })
    .click();
  await expect(
    page.locator('ol.cms-related-rows li[data-entry-id]').first(),
  ).toHaveAttribute('data-entry-id', second.entryId);

  const command = posted(
    page,
    `/api/v1/cms/entries/${source.entryId}/related-content`,
  );
  await page.getByRole('button', { name: 'Save related content' }).click();
  const response = await command;
  expect(response.ok(), String(response.status())).toBe(true);
  expect(response.request().headers()['if-match']).toBe(`"${source.version}"`);
  expect(response.headers()['cache-control']).toBe('no-store');
  await expect(
    page.getByRole('heading', { name: 'Related content saved' }),
  ).toBeVisible(within);
  await expect(page.locator('.cms-related-status')).toContainText(
    /2 pinned, 1 excluded, no derived rule\. \d+ entr(?:y is|ies are) eligible to be shown now\./u,
  );

  // The database holds the pins in the chosen order and the one exclusion.
  expect(ruleRows(source.entryId, 'pin')).toBe(
    `${second.entryId},${first.entryId}`,
  );
  expect(ruleRows(source.entryId, 'exclude')).toBe(excluded.entryId);

  // A fresh load starts from the stored rule: the same two pins in the same order, and the exclusion.
  await openPage(author, path, 'Related content');
  const pins = page.locator('ol.cms-related-rows li[data-entry-id]');
  await expect(pins).toHaveCount(2);
  await expect(pins.nth(0)).toHaveAttribute('data-entry-id', second.entryId);
  await expect(pins.nth(1)).toHaveAttribute('data-entry-id', first.entryId);
  await expect(
    page.getByRole('button', {
      name: `Remove exclusion ${nameOf(excluded.entryId)}`,
      exact: true,
    }),
  ).toBeVisible();
  expect(author.browserErrors).toEqual([]);
});
