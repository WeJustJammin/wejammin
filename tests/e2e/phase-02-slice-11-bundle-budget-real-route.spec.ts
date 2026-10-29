import { gzipSync } from 'node:zlib';

import {
  expect,
  test,
  type Locator,
  type Page,
  type Response,
} from '@playwright/test';

import { BUNDLE_BUDGETS } from '../../scripts/verify-bundle-budget.mjs';
import {
  gotoHydrated,
  requireLoopbackOrigin,
} from './support/s10-real-browser';
import {
  approvedEntry,
  prepareApprovedEntryCast,
  type ApprovedEntryCast,
} from './support/s11-approved-entry';
import { seedEntry } from './support/s10-real-api';
import { signInS11 } from './support/s11-real-browser';

/*
 * P2-S11-AC-106 (FE03 "Performance budgets and loading strategy", E8): the workflow route stays within the
 * bundle-budget thresholds, and the shared Time authority module is lazy-loaded when the schedule form
 * opens. Measured on the PRODUCTION-built Astro route that Chrome really loads cold: every JavaScript
 * response is gzipped exactly as `pnpm bundle:check` gzips a built asset and compared with the
 * thresholds that script declares (`BUNDLE_BUDGETS`, imported, never copied). `bundle:check` measures the
 * same route from the build output (the `CMS entry workflow` row of its route table); this spec proves
 * the browser agrees: the route's initial JavaScript (island, Astro and React runtimes, document-shell
 * scripts) is within the initial-route threshold, no contract-schema (zod) chunk is fetched before a
 * form needs it, and the Time authority chunk is withheld until the form opens and then fetched once
 * within the lazy-chunk threshold. The entry, review and approval come from the first-party routes of
 * the real stack (see s11-approved-entry.ts). Local loopback only; never hosted evidence.
 */

const ENTRY_PAGE = (entryId: string): string =>
  `/app/cms-content-modeling/entries/${entryId}/workflow`;

/** The lazy chunk and the tiny module that loads it; both belong to `@wejammin/contracts/time-authority`. */
const TIME_AUTHORITY = /\/(?:contracts-)?time-authority\.[\w-]+\.m?js$/u;
const TIME_AUTHORITY_SNAPSHOT = /\/contracts-time-authority\.[\w-]+\.m?js$/u;
/** The lazy chunk of the contract schemas (zod): the islands load it on the first check that needs it. */
const CONTRACT_SCHEMAS = /\/contracts\.[\w-]+\.m?js$/u;

type LoadedScript = Readonly<{ path: string; gzipBytes: number }>;

/** Every JavaScript response of `page` from now on, with the gzip size `bundle:check` would charge it. */
const recordScripts = (page: Page) => {
  const loaded: LoadedScript[] = [];
  const pending: Promise<void>[] = [];
  const onResponse = (response: Response): void => {
    const { pathname } = new URL(response.url());
    if (!/\.m?js$/u.test(pathname)) return;
    pending.push(
      response.body().then((body) => {
        loaded.push({ path: pathname, gzipBytes: gzipSync(body).length });
      }),
    );
  };
  page.on('response', onResponse);
  return {
    /** What was loaded since the last call, every body read to the end. */
    drain: async (): Promise<readonly LoadedScript[]> => {
      await Promise.all(pending.splice(0));
      return loaded.splice(0);
    },
    stop: (): void => {
      page.off('response', onResponse);
    },
  };
};

const gzipTotal = (scripts: readonly LoadedScript[]): number =>
  scripts.reduce((sum, script) => sum + script.gzipBytes, 0);

const disclosure = (page: Page, summary: string): Locator =>
  page
    .locator('details')
    .filter({ has: page.locator('summary', { hasText: summary }) });

test.describe.configure({ mode: 'serial' });

let cast: ApprovedEntryCast;
let entryId: string;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  requireLoopbackOrigin(test.info().project.use.baseURL);
  cast = await prepareApprovedEntryCast(browser);
  entryId = (await approvedEntry(cast, 'Bundle budget entry')).entryId;
});

test('[P2-S11-AC-106] a cold load of the production workflow route fetches no Time authority byte', async ({
  browser,
}) => {
  const publisher = await signInS11(
    browser,
    cast.world,
    cast.publisher,
    new Date(),
  );
  const scripts = recordScripts(publisher.page);
  await gotoHydrated(publisher.page, ENTRY_PAGE(entryId));
  // The schedule form is rendered (closed) for this publisher: the chunk is withheld, not the form.
  await expect(disclosure(publisher.page, 'Schedule publication')).toHaveCount(
    1,
  );
  const initial = await scripts.drain();
  scripts.stop();
  expect(
    initial.some((script) => /CmsEditorialWorkflowIsland/u.test(script.path)),
    'the workflow island is part of the cold load',
  ).toBe(true);
  expect(
    initial.filter((script) => TIME_AUTHORITY.test(script.path)),
    'no Time authority module is fetched before the form opens',
  ).toEqual([]);
  expect(publisher.browserErrors).toEqual([]);
  await publisher.context.close();
});

test('[P2-S11-AC-106] a cold load of the production workflow route stays within the initial-route JavaScript threshold and fetches no contract schema', async ({
  browser,
}) => {
  const publisher = await signInS11(
    browser,
    cast.world,
    cast.publisher,
    new Date(),
  );
  const scripts = recordScripts(publisher.page);
  await gotoHydrated(publisher.page, ENTRY_PAGE(entryId));
  await expect(disclosure(publisher.page, 'Schedule publication')).toHaveCount(
    1,
  );
  await publisher.page.waitForLoadState('networkidle');
  const initial = await scripts.drain();
  scripts.stop();
  const threshold = BUNDLE_BUDGETS.initialRouteGzipBytes;
  expect(
    initial.some((script) => /CmsEditorialWorkflowIsland/u.test(script.path)),
    'the workflow island is part of the cold load',
  ).toBe(true);
  expect(
    gzipTotal(initial),
    `the initial JavaScript of the route (${JSON.stringify(initial)}) stays within the ${String(threshold)} gzip byte initial-route threshold`,
  ).toBeLessThanOrEqual(threshold);
  expect(
    initial.filter((script) => CONTRACT_SCHEMAS.test(script.path)),
    'no contract schema chunk is fetched before a form check needs it',
  ).toEqual([]);
  expect(publisher.browserErrors).toEqual([]);
  await publisher.context.close();
});

test('[P2-S11-AC-106] opening the schedule form fetches the Time authority chunk once, within the lazy-chunk bundle threshold', async ({
  browser,
}) => {
  const publisher = await signInS11(
    browser,
    cast.world,
    cast.publisher,
    new Date(),
  );
  const page = publisher.page;
  await gotoHydrated(page, ENTRY_PAGE(entryId));
  const scripts = recordScripts(page);
  await scripts.drain();
  const snapshotLoaded = page.waitForResponse((response) =>
    TIME_AUTHORITY_SNAPSHOT.test(new URL(response.url()).pathname),
  );
  const schedule = disclosure(page, 'Schedule publication');
  await schedule.locator('summary').click();
  await snapshotLoaded;
  await expect(schedule.getByLabel('Time zone')).toBeVisible();
  await page.waitForLoadState('networkidle');
  const opened = await scripts.drain();
  const snapshotChunks = opened.filter((script) =>
    TIME_AUTHORITY_SNAPSHOT.test(script.path),
  );
  expect(
    snapshotChunks.length,
    `the pinned tz snapshot chunk is fetched exactly once: ${JSON.stringify(opened)}`,
  ).toBe(1);
  const threshold = BUNDLE_BUDGETS.lazyChunkGzipBytes;
  for (const script of opened)
    expect(
      script.gzipBytes,
      `${script.path} stays within the ${String(threshold)} gzip byte lazy-chunk threshold`,
    ).toBeLessThanOrEqual(threshold);
  expect(
    gzipTotal(opened),
    `everything the open fetched (${JSON.stringify(opened)}) stays within the ${String(threshold)} gzip byte lazy-chunk threshold`,
  ).toBeLessThanOrEqual(threshold);
  // Closing and reopening the form fetches nothing more: the module is loaded once.
  await schedule.locator('summary').click();
  await schedule.locator('summary').click();
  await page.waitForLoadState('networkidle');
  expect(await scripts.drain(), 'a second open fetches no script').toEqual([]);
  scripts.stop();
  expect(publisher.browserErrors).toEqual([]);
  await publisher.context.close();
});

/*
 * The entry editor (P2-S11-AC-106, P2-S10 CMS-05): the value validators (`cms-field-value*`) and the save flow are not part of
 * the cold load of `/entries/:id`; the first save that needs them fetches both, once. `bundle:check` measures this route from
 * the build (the `CMS entry editor` row); this is the browser's measurement of the same route, the first one.
 */
const EDITOR_PAGE = (entryId: string): string =>
  `/app/cms-content-modeling/entries/${entryId}`;
const FIELD_VALIDATORS = /\/cms-field-value\.[\w-]+\.m?js$/u;
const EDITOR_SAVE = /\/cms-editorial-entry-editor-save\.[\w-]+\.m?js$/u;

test('[P2-S11-AC-106] a cold load of the production entry editor fetches no validators and no save flow, and stays within the initial-route threshold', async ({
  browser,
}) => {
  const editor = await seedEntry(
    cast.authorSession.client,
    cast.world,
    'Editor budget entry',
  );
  const author = await signInS11(browser, cast.world, cast.author, null);
  const scripts = recordScripts(author.page);
  await gotoHydrated(author.page, EDITOR_PAGE(editor.entryId));
  await author.page.waitForLoadState('networkidle');
  const initial = await scripts.drain();
  scripts.stop();
  expect(
    initial.some((script) =>
      /CmsEditorialEntryEditorIsland/u.test(script.path),
    ),
    'the editor island is part of the cold load',
  ).toBe(true);
  expect(
    initial.filter(
      (script) =>
        FIELD_VALIDATORS.test(script.path) ||
        EDITOR_SAVE.test(script.path) ||
        CONTRACT_SCHEMAS.test(script.path),
    ),
    'no validator, save-flow or contract-schema chunk is fetched before a save needs it',
  ).toEqual([]);
  expect(
    gzipTotal(initial),
    `the initial JavaScript of the editor route (${JSON.stringify(initial)})`,
  ).toBeLessThanOrEqual(BUNDLE_BUDGETS.initialRouteGzipBytes);
  expect(author.browserErrors).toEqual([]);
  await author.context.close();
});

test('[P2-S11-AC-106] the first save of an invalid value fetches the validators and the save flow once, within the lazy threshold, and sends nothing', async ({
  browser,
}) => {
  const editor = await seedEntry(
    cast.authorSession.client,
    cast.world,
    'Editor refusal entry',
  );
  const author = await signInS11(browser, cast.world, cast.author, null);
  const { page } = author;
  await gotoHydrated(page, EDITOR_PAGE(editor.entryId));
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/revisions'))
      posts.push(request.url());
  });
  const scripts = recordScripts(page);
  await scripts.drain();
  // Title is required: clearing it is refused by the validators before anything is sent.
  await page.getByRole('textbox', { name: /^Title/u }).fill('');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('This field is required.').first()).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForLoadState('networkidle');
  const opened = await scripts.drain();
  scripts.stop();
  expect(
    opened.filter((script) => FIELD_VALIDATORS.test(script.path)),
    `the validators are fetched exactly once: ${JSON.stringify(opened)}`,
  ).toHaveLength(1);
  expect(opened.filter((script) => EDITOR_SAVE.test(script.path))).toHaveLength(
    1,
  );
  expect(gzipTotal(opened)).toBeLessThanOrEqual(
    BUNDLE_BUDGETS.lazyChunkGzipBytes,
  );
  expect(posts, 'a locally refused value sends nothing').toEqual([]);
  expect(author.browserErrors).toEqual([]);
  await author.context.close();
});
