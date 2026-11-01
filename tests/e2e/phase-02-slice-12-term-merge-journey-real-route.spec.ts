import { expect, test, type Page } from '@playwright/test';

import { psql } from '../postgrest/support/stack';
import { waitForIslands } from './support/s10-real-browser';
import { completeStepUp } from './support/s11-real-browser';
import { TAXONOMY_PAGE } from './support/s12-governed-world';
import {
  activateViaApi,
  prepareJourneyCast,
  within,
  type JourneyCast,
} from './support/s12-pw7-flow';
import {
  defineTagsVocabularyViaApi,
  seedTaggedEntry,
  taggedWorld,
  type TaggedWorld,
} from './support/s12-pw7-tagged';

/*
 * P2-S12-AC-273 (V11 section 5), the TERM MERGE journey: "a term merged with convergence", through the REAL composition
 * (production-built Astro routes -> web proxy -> private binding -> production Worker -> production RPC adapter -> Kong ->
 * PostgREST -> the Slice 12 SQL) with two people:
 *
 *   J6  an author's entry names the term `brass` in its `tags` field (CMS-03B-10, which commits the term assignment).
 *       The curator creates both terms in the vocabulary page's term form, then MERGES `brass` into `wind` in the browser
 *       (action, survivor choice, the separate review step, the permanent confirmation). The page names the redirect in
 *       words; the database then holds `brass` as `merged` with `wind` as its successor, the entry's assignment of `brass`
 *       superseded and an active assignment of `wind` in its place, and no merge work left (the same-transaction
 *       convergence of CMS-03C-03, BE03c "Term actions and merge convergence").
 *
 * The vocabulary is defined, submitted, assigned, decided and activated through the first-party routes (the vocabulary
 * journey J1 drives those through the browser); the subject of this test is the merge.
 *
 * Written without a running stack (the lane may not run one): selectors and copy follow the component sources, so a first
 * run may need an exact label adjusted. Local loopback only; never hosted evidence.
 */
let journey: JourneyCast;
let tagged: TaggedWorld;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);
  journey = await prepareJourneyCast(
    browser,
    test.info().project.use.baseURL,
    'merge',
  );
  tagged = await taggedWorld(journey.cast.world);
});

/** The curator creates one term in the vocabulary page's term form and waits for its row. */
const createTerm = async (
  page: Page,
  key: string,
  label: string,
): Promise<void> => {
  await page.getByRole('button', { name: 'Create a term' }).click();
  await page.getByLabel('Term key').fill(key);
  await page.getByLabel('Label 1', { exact: true }).fill(label);
  await page.getByRole('button', { name: 'Create term' }).click();
  await expect(
    page.getByRole('button', { name: `Rename term ${key}` }),
  ).toBeVisible(within);
};

const termId = (taxonomyId: string, termKey: string): string =>
  psql(
    `select id from platform_private.cms_terms
      where taxonomy_id = '${taxonomyId}' and term_key = '${termKey}' order by version desc limit 1`,
  );

test('[P2-S12-AC-273] J6 a term is merged into another in the browser and the entry that carried it converges: the retired term redirects, its assignment is superseded and the survivor holds an active one', async () => {
  test.setTimeout(480_000);
  const { cast, curator, author } = journey;
  const { page } = curator;

  const vocabulary = await defineTagsVocabularyViaApi(
    curator.client,
    tagged.typeKey,
  );
  await activateViaApi(
    journey,
    curator,
    'taxonomy_version',
    vocabulary,
    'Approved so that the vocabulary has terms to merge.',
  );

  // The curator creates the two terms in the browser form.
  await completeStepUp(curator.context, cast.world, cast.curator);
  const path = TAXONOMY_PAGE(vocabulary.taxonomyId);
  await page.goto(path, { waitUntil: 'networkidle' });
  await waitForIslands(page);
  await createTerm(page, 'brass', 'Brass');
  await createTerm(page, 'wind', 'Wind');
  const brassId = termId(vocabulary.taxonomyId, 'brass');
  const windId = termId(vocabulary.taxonomyId, 'wind');
  expect(brassId).not.toBe('');
  expect(windId).not.toBe('');

  // The author's entry carries `brass`: the term assignment is committed with the revision.
  const entry = await seedTaggedEntry(
    author.client,
    tagged,
    'Tagged with brass',
    brassId,
  );
  const assignmentState = (term: string): string =>
    psql(
      `select coalesce(string_agg(state, ',' order by version), '') from platform_private.cms_term_assignments
        where revision_id = '${entry.firstRevisionId}' and term_id = '${term}'`,
    );
  expect(assignmentState(brassId)).toBe('active');
  expect(assignmentState(windId)).toBe('');

  // Merge `brass` into `wind` with the page's own controls: action, survivor, review, permanent confirmation.
  await completeStepUp(curator.context, cast.world, cast.curator);
  await page.goto(path, { waitUntil: 'networkidle' });
  await waitForIslands(page);
  await page
    .getByRole('button', { name: 'Merge term brass into another' })
    .click();
  const survivor = page.getByLabel('Merge into');
  const wind = survivor.locator('option', { hasText: 'wind' }).first();
  await expect(wind).toHaveCount(1);
  await survivor.selectOption({
    value: (await wind.getAttribute('value')) ?? '',
  });
  await page.getByRole('button', { name: 'Review the merge' }).click();
  await expect(
    page.getByRole('heading', { name: 'Confirm the merge' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Merge permanently' }).click();
  await expect(
    page.getByRole('heading', { name: 'Term brass merged' }),
  ).toBeVisible(within);
  await expect(page.locator('.cms-term-status')).toContainText(
    'brass now redirects permanently to wind. Every use of it moved there.',
  );
  const row = page.getByRole('row', { name: /^brass/u });
  await expect(row).toContainText('Merged');
  await expect(row).toContainText('Redirects permanently to wind.');

  // The database: the retired term redirects, the assignment converged, no merge work is left.
  expect(
    psql(
      `select lifecycle || '|' || successor_id::text from platform_private.cms_terms
        where id = '${brassId}' order by version desc limit 1`,
    ),
  ).toBe(`merged|${windId}`);
  expect(assignmentState(brassId)).toBe('active,superseded');
  expect(assignmentState(windId)).toBe('active');
  expect(
    psql(
      `select count(*) from platform_private.cms_taxonomy_merge_work('${cast.world.owner.organizationId}', '${brassId}')`,
    ),
  ).toBe('0');

  // A fresh load of the page still names the redirect.
  await page.goto(path, { waitUntil: 'networkidle' });
  await waitForIslands(page);
  const reloaded = page.getByRole('row', { name: /^brass/u });
  await expect(reloaded).toContainText('Merged');
  await expect(reloaded).toContainText('Redirects permanently to wind.');
  expect(curator.browserErrors).toEqual([]);
});
