import { expect, test, type Page } from '@playwright/test';

import { authenticateLocalSession } from './support/local-signed-session';
import {
  expectNoSeriousAxeFindings,
  requireLoopbackOrigin,
  signIn,
} from './support/s10-real-browser';
import {
  ENTRIES_PATH,
  createClient,
  seedEntry,
  type SeededEntry,
} from './support/s10-real-api';
import {
  prepareS10World,
  provisionAuthor,
  s10Session,
  type S10Principal,
  type S10World,
} from './support/s10-real-world';

/*
 * Slice 10 CMS-03B-13 (entry list, DEC-140 cursor classes, DEC-145 item shape)
 * through the REAL composition: the production-built Astro route, the web
 * proxy, the production Worker, the production RPC adapter, Kong, PostgREST and
 * the newest SQL. Entries are created by the real create command; nothing is
 * stubbed. Local loopback only: a non-loopback origin is refused so this can
 * never be mistaken for hosted evidence.
 */

let world: S10World;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  requireLoopbackOrigin(test.info().project.use.baseURL);
  world = await prepareS10World();
});

/** Provision a fresh author, sign in, and create `count` entries as that author. */
const authorWithEntries = async (
  context: Parameters<typeof authenticateLocalSession>[0],
  label: string,
  count: number,
): Promise<{ author: S10Principal; entries: SeededEntry[] }> => {
  const author = provisionAuthor(world, label);
  await authenticateLocalSession(context, s10Session(world, author));
  const client = createClient(context, world, author);
  const entries: SeededEntry[] = [];
  for (let index = 0; index < count; index += 1)
    entries.push(await seedEntry(client, world, `${label} entry ${index + 1}`));
  return { author, entries };
};

const listedEntryIds = async (page: Page): Promise<string[]> =>
  page
    .locator('main ul > li > a')
    .evaluateAll((links) =>
      links.map((link) => (link.textContent ?? '').replace(/^Entry /u, '')),
    );

test.describe('Phase 2 Slice 10 entry list real route', () => {
  test('paginates exactly the author entries with a URL-owned signed cursor', async ({
    context,
    page,
  }) => {
    test.setTimeout(120_000);
    const { entries } = await authorWithEntries(context, 'list-pages', 3);

    const first = await page.goto(`${ENTRIES_PATH}?limit=1`, {
      waitUntil: 'domcontentloaded',
    });
    expect(first?.status()).toBe(200);
    expect(first?.headers()['cache-control']).toBe('no-store');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Entries');
    expect(await listedEntryIds(page)).toHaveLength(1);
    await expect(page.getByRole('status')).toContainText('1 entry loaded.');

    // Every page is a native link; the cursor lives in the URL, and the list
    // heading takes focus on arrival so keyboard users keep their place.
    const seen = [...(await listedEntryIds(page))];
    for (let hops = 0; hops < 5; hops += 1) {
      const next = page.getByRole('link', { name: 'Next page' });
      if ((await next.count()) === 0) break;
      await next.click();
      await expect(page.locator('#entry-list-title')).toBeFocused();
      const query = new URL(page.url()).searchParams;
      expect(query.get('limit')).toBe('1');
      expect(query.get('cursor')).toBeTruthy();
      seen.push(...(await listedEntryIds(page)));
    }
    // Three entries, one per page, none repeated, none missing, and no other
    // author's entry anywhere on the way.
    expect([...seen].sort()).toEqual(
      entries.map((entry) => entry.entryId).sort(),
    );
    await expect(page.getByRole('link', { name: 'Next page' })).toHaveCount(0);
  });

  test('typed filters are URL state and an excluded state is the filter-miss empty state', async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);
    const { entries } = await authorWithEntries(context, 'list-filters', 2);

    await page.goto(`${ENTRIES_PATH}?state=draft&limit=25`, {
      waitUntil: 'domcontentloaded',
    });
    expect((await listedEntryIds(page)).sort()).toEqual(
      entries.map((entry) => entry.entryId).sort(),
    );
    await expect(page.getByLabel('State')).toHaveValue('draft');

    await page.goto(`${ENTRIES_PATH}?state=published&limit=25`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByText('No entries match these filters.'),
    ).toBeVisible();
    expect(await listedEntryIds(page)).toEqual([]);
    await expect(
      page.getByRole('link', { name: 'Reset filters' }),
    ).toBeVisible();
  });

  test('a tampered, foreign or malformed cursor is a typed restart state, never a leak', async ({
    browser,
    context,
    page,
  }) => {
    test.setTimeout(120_000);
    await authorWithEntries(context, 'list-cursor', 2);

    await page.goto(`${ENTRIES_PATH}?limit=1`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByRole('link', { name: 'Next page' }).click();
    const cursor = new URL(page.url()).searchParams.get('cursor') as string;
    expect(cursor).toBeTruthy();

    // Tampered: the cursor is a base64 JSON envelope; one character of its
    // signature changed leaves it well formed but unverifiable (DEC-140: 409).
    const envelope = JSON.parse(
      Buffer.from(cursor, 'base64').toString('utf8'),
    ) as { signature: string };
    envelope.signature = `${envelope.signature.slice(0, -1)}${
      envelope.signature.endsWith('0') ? '1' : '0'
    }`;
    const tamperedCursor = Buffer.from(JSON.stringify(envelope)).toString(
      'base64',
    );
    const tampered = await page.goto(
      `${ENTRIES_PATH}?limit=1&cursor=${encodeURIComponent(tamperedCursor)}`,
      { waitUntil: 'domcontentloaded' },
    );
    // FE03:574 (DEC-140): a cursor 409 drops only the cursor, keeps the filters
    // (here `limit`) and loads the FIRST page with a polite announcement.
    expect(tampered?.status()).toBe(200);
    const restarted = new URL(page.url());
    expect(restarted.pathname).toBe(ENTRIES_PATH);
    expect(restarted.searchParams.has('cursor')).toBe(false);
    expect(restarted.searchParams.get('limit')).toBe('1');
    await expect(
      page.locator('[data-cms-editorial-list-status]'),
    ).toContainText('The list changed, so it restarted from the first page.');
    await expect(page.getByRole('link', { name: 'Next page' })).toBeVisible();

    // Structurally malformed: a bad request, not a stale position (DEC-140: 400).
    const malformed = await page.goto(
      `${ENTRIES_PATH}?limit=1&cursor=${encodeURIComponent('not a cursor!')}`,
      { waitUntil: 'domcontentloaded' },
    );
    expect(malformed?.status()).toBe(400);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Invalid request',
    );

    // Foreign: a real cursor of another author is not honoured for this one.
    const otherContext = await browser.newContext();
    try {
      const other = await authorWithEntries(otherContext, 'list-foreign', 2);
      const otherPage = await otherContext.newPage();
      await otherPage.goto(`${ENTRIES_PATH}?limit=1`, {
        waitUntil: 'domcontentloaded',
      });
      await otherPage.getByRole('link', { name: 'Next page' }).click();
      const foreign = new URL(otherPage.url()).searchParams.get(
        'cursor',
      ) as string;
      const reused = await page.goto(
        `${ENTRIES_PATH}?limit=1&cursor=${encodeURIComponent(foreign)}`,
        { waitUntil: 'domcontentloaded' },
      );
      expect(reused?.status()).toBe(200);
      await expect(
        page.locator('[data-cms-editorial-list-status]'),
      ).toContainText('The list changed, so it restarted from the first page.');
      // Nothing of the other author's list is rendered to this author.
      for (const entry of other.entries)
        await expect(page.locator('main')).not.toContainText(entry.entryId);
    } finally {
      await otherContext.close();
    }
  });

  test('conceals other authors entries, and a member with no grant is assigned nothing', async ({
    browser,
    context,
    page,
  }) => {
    test.setTimeout(120_000);
    const mine = await authorWithEntries(context, 'list-conceal', 1);
    const otherContext = await browser.newContext();
    let theirs: SeededEntry;
    try {
      theirs = (await authorWithEntries(otherContext, 'list-conceal-other', 1))
        .entries[0] as SeededEntry;
    } finally {
      await otherContext.close();
    }

    const list = await page.goto(ENTRIES_PATH, {
      waitUntil: 'domcontentloaded',
    });
    expect(list?.status()).toBe(200);
    expect(await listedEntryIds(page)).toEqual([mine.entries[0]?.entryId]);
    // A concealed entry never appears, not even as a placeholder row or count.
    await expect(page.locator('main')).not.toContainText(theirs.entryId);
    await expect(page.getByRole('status')).toContainText('1 entry loaded.');

    await expectNoSeriousAxeFindings(page, 'entry list');

    // A confirmed member who holds no author or editor grant is assigned
    // nothing: the list is scoped, so the database answers an empty list (there
    // is no 403 on a scoped list) and no row, count or id of anyone else leaks.
    const member = await signIn(browser, world, world.member);
    const empty = await member.page.goto(ENTRIES_PATH, {
      waitUntil: 'domcontentloaded',
    });
    expect(empty?.status()).toBe(200);
    await expect(member.page.getByRole('status')).toContainText(
      'You have no assigned entries yet.',
    );
    expect(await listedEntryIds(member.page)).toEqual([]);
    await expect(member.page.locator('main')).not.toContainText(
      mine.entries[0]?.entryId as string,
    );
    await member.context.close();
  });
});
