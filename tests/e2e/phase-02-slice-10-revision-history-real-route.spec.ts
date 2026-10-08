import { expect, test, type Page } from '@playwright/test';

import {
  ENTRIES_API,
  ENTRIES_PATH,
  appendTitle,
  seedEntry,
  type S10Client,
  type SeededEntry,
} from './support/s10-real-api';
import {
  expectNoHorizontalScroll,
  expectNoSeriousAxeFindings,
  requireLoopbackOrigin,
  signIn,
  waitForIslands,
} from './support/s10-real-browser';
import {
  draftFacts,
  expectFocusOnResultHeading,
  expectNoLeak,
  expectResultConsumed,
  expectResultPanel,
  resultPanel,
} from './support/s10-real-result';
import {
  effectCounts,
  prepareS10World,
  provisionAuthor,
  revisionLineage,
  type S10World,
} from './support/s10-real-world';

/*
 * Slice 10 CMS-03B-03 (history and compare), CMS-03B-04 (restore) and the
 * CMS-05/07 concealment split through the REAL composition: production-built
 * routes, web proxy, production Worker and RPC adapter, Kong, PostgREST and the
 * newest SQL. Revisions are made by the real create and append commands; the
 * restore chain is the one the history read serves, never a fixture. Local
 * loopback only; never hosted evidence.
 */

let world: S10World;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  requireLoopbackOrigin(test.info().project.use.baseURL);
  world = await prepareS10World();
});

const MARKUP_TITLE = '<img src=x onerror=alert(1)>';

/** An entry with three real revisions: r1 (markup title), r2, r3. */
const entryWithHistory = async (client: S10Client): Promise<SeededEntry> => {
  const one = await seedEntry(client, world, MARKUP_TITLE);
  const two = await appendTitle(client, world, one, 'Second title');
  return appendTitle(client, world, two, 'Third title');
};

type RevisionRow = Readonly<{ number: string; id: string; hash: string }>;

/**
 * The revisions as the history PAGE serves them (there is no browser JSON route
 * for CMS-03B-03; the page reads it server side): number, id and content hash
 * of every row, newest first.
 */
const readRevisionRows = async (
  page: Page,
  entryId: string,
): Promise<readonly RevisionRow[]> => {
  const response = await page.goto(`${historyPath(entryId)}?limit=50`, {
    waitUntil: 'domcontentloaded',
  });
  expect(response?.status()).toBe(200);
  return page.locator('main ol > li').evaluateAll((items) =>
    items.map((item) => {
      const text = item.textContent ?? '';
      const href = item.querySelector('a')?.getAttribute('href') ?? '';
      return {
        number: /^Revision (\d+)/u.exec(text)?.[1] ?? '',
        hash: /Content hash: ([0-9a-f]{64})/u.exec(text)?.[1] ?? '',
        id:
          new URL(href, 'http://local').searchParams.get('compareRevisionId') ??
          '',
      };
    }),
  );
};

const historyPath = (entryId: string): string =>
  `${ENTRIES_PATH}/${entryId}/revisions`;

const revisionRows = (page: Page) => page.locator('main ol > li');

test.describe('Phase 2 Slice 10 revision history real route', () => {
  test('history is protected, lists only safe summaries newest first, and never renders a draft value', async ({
    browser,
    page,
  }) => {
    test.setTimeout(120_000);
    const author = provisionAuthor(world, 'history-list');
    const signed = await signIn(browser, world, author);
    const entry = await entryWithHistory(signed.client);

    // Without a session the route returns the author to sign-in and shows nothing.
    const denied = await page.goto(historyPath(entry.entryId));
    expect(denied?.status()).toBe(200);
    await expect(page).toHaveURL(/\/auth\/sign-in\?/u);
    await expect(page.getByText(/Revision 3/u)).toHaveCount(0);

    const response = await signed.page.goto(historyPath(entry.entryId), {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.status()).toBe(200);
    expect(response?.headers()['cache-control']).toBe('no-store');
    await expect(
      signed.page.getByRole('heading', { level: 1, name: 'Revision history' }),
    ).toBeVisible();
    await expect(revisionRows(signed.page)).toHaveCount(3);
    const rows = await revisionRows(signed.page).allTextContents();
    expect(rows[0]).toMatch(/^Revision 3 · draft · Locale: en-US/u);
    expect(rows[1]).toMatch(/^Revision 2 · draft/u);
    expect(rows[2]).toMatch(/^Revision 1 · draft/u);
    for (const row of rows) expect(row).toMatch(/Content hash: [0-9a-f]{64}/u);
    // A summary carries no draft value: not the escaped markup, not any title.
    const main = signed.page.locator('main');
    for (const value of [MARKUP_TITLE, 'Second title', 'Third title'])
      await expect(main).not.toContainText(value);
    await expect(signed.page.locator('img')).toHaveCount(0);
    await expectNoSeriousAxeFindings(signed.page, 'revision history');
    expect(signed.browserErrors, 'no script errors').toEqual([]);
  });

  test('filters are native GET state and an excluded state is the filter-miss empty state', async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const author = provisionAuthor(world, 'history-filter');
    const { page, client } = await signIn(browser, world, author);
    const entry = await entryWithHistory(client);

    await page.goto(historyPath(entry.entryId), {
      waitUntil: 'domcontentloaded',
    });
    await page.getByLabel('State').selectOption('draft');
    await page.getByLabel('Locale').fill('en-US');
    await page.getByRole('button', { name: 'Filter history' }).click();
    await expect(page.locator('#history-list-title')).toBeFocused();
    await expect(revisionRows(page)).toHaveCount(3);
    const query = new URL(page.url()).searchParams;
    expect(query.get('state')).toBe('draft');
    expect(query.get('locale')).toBe('en-US');

    await page.getByLabel('State').selectOption('published');
    await page.getByRole('button', { name: 'Filter history' }).click();
    await expect(
      page.getByText('No revisions match these filters.'),
    ).toBeVisible();
    await expect(revisionRows(page)).toHaveCount(0);
    await page.getByRole('link', { name: 'Reset filters' }).click();
    await expect(revisionRows(page)).toHaveCount(3);
  });

  test('native pagination keeps the filtered window, the signed cursor and list focus; a stale or tampered cursor restarts safely', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const author = provisionAuthor(world, 'history-pages');
    const { page, client } = await signIn(browser, world, author);
    const entry = await entryWithHistory(client);

    const first = await page.goto(
      `${historyPath(entry.entryId)}?limit=1&locale=en-US`,
      { waitUntil: 'domcontentloaded' },
    );
    expect(first?.status()).toBe(200);
    await expect(revisionRows(page)).toHaveCount(1);
    await expect(revisionRows(page).first()).toContainText('Revision 3');

    const seen = ['3'];
    for (let hop = 0; hop < 3; hop += 1) {
      const next = page.getByRole('link', { name: 'Next page' });
      if ((await next.count()) === 0) break;
      await next.click();
      await expect(page.locator('#history-list-title')).toBeFocused();
      const query = new URL(page.url()).searchParams;
      expect(query.get('limit')).toBe('1');
      expect(query.get('locale')).toBe('en-US');
      expect(query.get('cursor')).toBeTruthy();
      const text = (await revisionRows(page).first().textContent()) ?? '';
      seen.push(/^Revision (\d+)/u.exec(text)?.[1] ?? '');
    }
    expect(seen).toEqual(['3', '2', '1']);
    await expect(page.getByRole('link', { name: 'Next page' })).toHaveCount(0);

    // A cursor bound to another window is refused as a stale position.
    const cursor = new URL(page.url()).searchParams.get('cursor') as string;
    const stale = await page.goto(
      `${historyPath(entry.entryId)}?limit=1&locale=fr-FR&cursor=${encodeURIComponent(cursor)}`,
      { waitUntil: 'domcontentloaded' },
    );
    expect(stale?.status()).toBe(409);
    await expect(
      page.getByText('This position can no longer be reopened.'),
    ).toBeVisible();
    await expect(page.getByText(/Revision \d+ ·/u)).toHaveCount(0);
    // Starting again drops the cursor and keeps the rest of the URL-owned state:
    // fr-FR has no revision, so the truthful answer is the filter-miss state,
    // and one native link resets to the full list.
    await page.getByRole('link', { name: 'Start from the first page' }).click();
    await expect(
      page.getByText('No revisions match these filters.'),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.has('cursor')).toBe(false);
    await page.getByRole('link', { name: 'Reset filters' }).click();
    await expect(revisionRows(page).first()).toContainText('Revision 3');
  });

  test('compare names the changed field with side hashes only, and restore recreates the LEFT revision under the served chain id', async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const author = provisionAuthor(world, 'history-restore');
    const { page, client, browserErrors } = await signIn(
      browser,
      world,
      author,
    );
    const entry = await entryWithHistory(client);
    const path = historyPath(entry.entryId);
    const rows = await readRevisionRows(page, entry.entryId);
    const left = rows.find((row) => row.number === '1') as RevisionRow;
    const latest = rows.find((row) => row.number === '3') as RevisionRow;
    expect(left.id).toMatch(/^[0-9a-f-]{36}$/u);

    await page
      .getByRole('link', { name: 'Compare with latest revision 1' })
      .click();
    await expect(page.locator('#history-compare-title')).toBeFocused();
    await expect(
      page.getByRole('heading', { name: 'Comparison' }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get('compareRevisionId')).toBe(
      left.id,
    );
    const comparison = page.locator(
      'section[aria-labelledby="history-compare-title"]',
    );
    await expect(comparison.getByRole('status')).toContainText(
      '1 change: 1 field.',
    );
    const change = comparison.locator('li', { hasText: world.fields.title });
    await expect(change).toContainText(': changed');
    const hashes = (await change.textContent()) ?? '';
    const before = /Before hash: ([0-9a-f]{64})/u.exec(hashes)?.[1];
    const after = /After hash: ([0-9a-f]{64})/u.exec(hashes)?.[1];
    expect(before).toBeTruthy();
    expect(after).toBeTruthy();
    expect(before).not.toBe(after);
    // The comparison reveals hashes, never the values or their markup.
    await expect(comparison).not.toContainText(MARKUP_TITLE);
    await expect(comparison).not.toContainText('Third title');
    await expectNoSeriousAxeFindings(page, 'revision comparison');

    // The chain the history read served for the LEFT revision rides in the
    // confirmation as hidden carrier fields.
    const carrier = await page
      .locator('form[data-cms-editorial-restore]')
      .evaluate((form) => {
        const read = (name: string): string =>
          (
            form.querySelector(
              `input[type="hidden"][name="${name}"]`,
            ) as HTMLInputElement
          ).value;
        return {
          revisionId: read('revisionId'),
          migrationChainId: read('migrationChainId'),
          edgeCount: read('edgeCount'),
          availability: read('availability'),
          expectedVersion: read('expectedVersion'),
        };
      });
    expect(carrier).toMatchObject({
      revisionId: left.id,
      availability: 'available',
      expectedVersion: entry.version,
    });
    expect(carrier.migrationChainId).toMatch(/^[0-9a-f-]{36}$/u);
    expect(carrier.edgeCount).toMatch(/^\d+$/u);

    // The restore confirmation is an inline review: it moves focus to its
    // heading and Escape cancels before any commit.
    const restoreUrl = new RegExp(
      `${ENTRIES_API}/${entry.entryId}/revisions/[0-9a-f-]+/restore$`,
      'u',
    );
    const restorePosts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && restoreUrl.test(request.url()))
        restorePosts.push(request.url());
    });
    await page.getByText('Restore this revision').click();
    await expect(
      page.getByRole('heading', { name: 'Confirm restore' }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('heading', { name: 'Confirm restore' }),
    ).toBeHidden();
    expect(restorePosts).toEqual([]);
    const beforeRestore = effectCounts(entry.entryId);

    await page.getByText('Restore this revision').click();
    const restorePost = page.waitForResponse(
      (response) =>
        restoreUrl.test(response.url()) &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Confirm restore' }).click();
    const restored = await restorePost;
    expect(restored.status()).toBe(201);
    const request = restored.request();
    // The command names the LEFT revision, the chain the read served, and the
    // entry version the page read; the idempotency key and If-Match ride along.
    expect(request.postDataJSON()).toEqual({
      entryId: entry.entryId,
      revisionId: left.id,
      migrationChainId: carrier.migrationChainId,
      expectedVersion: entry.version,
    });
    expect(request.headers()['if-match']).toBe(`"${entry.version}"`);
    expect(request.headers()['idempotency-key']).toBeTruthy();
    expect(request.url()).toContain(`/revisions/${left.id}/restore`);
    const nextVersion = String(Number(entry.version) + 1);
    expect(restored.headers()['etag']).toBe(`"${nextVersion}"`);

    // Success opens the restored draft on its APP route and shows the left value.
    await expect(page).toHaveURL(
      new RegExp(`${ENTRIES_PATH}/${entry.entryId}$`, 'u'),
    );
    await waitForIslands(page);
    await expect(page.getByRole('textbox', { name: /^Title/u })).toHaveValue(
      MARKUP_TITLE,
    );
    await expect(page.locator('img')).toHaveCount(0);

    // The canonical result of the restore: the committed revision and entry
    // version, the lineage the database stored for the new head - [previous
    // draft, restored source], in that order (CMS-03B-04) - and the migration
    // chain the restore crossed, with focus on the result heading.
    const stored = revisionLineage(entry.entryId);
    const newHead = stored.at(-1);
    expect(newHead?.number).toBe('4');
    expect(newHead?.parents).toEqual([
      stored.find((row) => row.number === '3')?.id,
      left.id,
    ]);
    await expectResultPanel(page, {
      heading: 'Revision restored',
      sentence:
        'A new draft was created as revision 4 (entry version 4). The source revision is unchanged.',
      parents: [
        ['Previous draft', newHead?.parents[0] ?? ''],
        ['Restored source', left.id],
      ],
      migration: {
        chainId: carrier.migrationChainId,
        edges: Number(carrier.edgeCount),
      },
      nextAction:
        'Review the restored draft below and keep editing; changes save automatically.',
      historyHref: `${path}`,
    });
    await expectFocusOnResultHeading(page);
    await expect(draftFacts(page).locator('[data-fact="revision"]')).toHaveText(
      '4',
    );
    await expect(
      draftFacts(page).locator('[data-fact="entry-version"]'),
    ).toHaveText('4');
    // The provenance on the page is the server's: a reload reads it back.
    const provenance = await draftFacts(page)
      .locator('[data-cms-editorial-provenance] > li')
      .allTextContents();
    expect(provenance[0]).toMatch(
      /^Title: (Authored|Inherited|Default value)$/u,
    );
    await expectNoLeak(page, world, [author], []);
    await expectNoLeak(
      page,
      world,
      [author],
      [MARKUP_TITLE, 'Second title', 'Third title'],
      resultPanel(page),
    );
    await expectResultConsumed(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForIslands(page);
    await expect(resultPanel(page)).toHaveCount(0);
    await expect(
      draftFacts(page).locator('[data-cms-editorial-provenance] > li'),
    ).toHaveText(provenance);

    // Exactly one new revision, one audit row and the two locked events; the
    // source revision is unchanged and the new head carries the left content.
    const afterRestore = effectCounts(entry.entryId);
    expect(afterRestore.revisions).toBe(beforeRestore.revisions + 1);
    expect(afterRestore.audit).toBe(beforeRestore.audit + 1);
    expect(afterRestore.outbox).toBe(beforeRestore.outbox + 2);
    const refreshed = await readRevisionRows(page, entry.entryId);
    expect(refreshed).toHaveLength(4);
    const head = refreshed[0] as RevisionRow;
    expect(head.number).toBe('4');
    expect(head.id).not.toBe(left.id);
    expect(head.hash).toBe(left.hash);
    expect(head.hash).not.toBe(latest.hash);
    expect(refreshed.find((row) => row.number === '1')).toEqual(left);
    expect(path).toContain(entry.entryId);
    expect(browserErrors, 'no script errors').toEqual([]);
  });

  test('a restore against a stale entry version is a definite refusal that changes nothing', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const author = provisionAuthor(world, 'history-stale-restore');
    const { page, client } = await signIn(browser, world, author);
    const entry = await entryWithHistory(client);
    const rows = await readRevisionRows(page, entry.entryId);
    const left = rows.find((row) => row.number === '1') as RevisionRow;
    await page.goto(
      `${historyPath(entry.entryId)}?compareRevisionId=${left.id}`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.getByText('Restore this revision').click();
    // Another session moves the entry while the review is open.
    await appendTitle(client, world, entry, 'Moved on elsewhere');
    const before = effectCounts(entry.entryId);

    const restorePost = page.waitForResponse(
      (response) =>
        response.url().includes('/restore') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Confirm restore' }).click();
    expect((await restorePost).status()).toBe(409);
    await expect(
      page.locator('p[data-cms-editorial-restore-status]'),
    ).toContainText('The entry changed or the chain no longer matches.');
    expect(effectCounts(entry.entryId)).toEqual(before);
  });

  test('concealment: another member is denied (403), an outsider and an absent entry are one 404, and neither sees a revision', async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const author = provisionAuthor(world, 'history-conceal');
    const owner = await signIn(browser, world, author);
    const entry = await entryWithHistory(owner.client);
    const absent = '30000000-0000-4000-8000-0000000000ff';

    for (const [principal, status, heading, message] of [
      [
        world.otherAuthor,
        403,
        'Access denied',
        'This account cannot read this entry history.',
      ],
      [
        world.member,
        403,
        'Access denied',
        'This account cannot read this entry history.',
      ],
      [world.outsider, 404, 'Not found', 'This entry is not available.'],
    ] as const) {
      const other = await signIn(browser, world, principal);
      const visit = await other.page.goto(historyPath(entry.entryId), {
        waitUntil: 'domcontentloaded',
      });
      expect(visit?.status(), principal.label).toBe(status);
      expect(visit?.headers()['cache-control']).toBe('no-store');
      await expect(other.page.getByRole('heading', { level: 1 })).toHaveText(
        heading,
      );
      await expect(other.page.getByText(message)).toBeVisible();
      await expect(other.page.getByText(/Revision \d+ ·/u)).toHaveCount(0);
      await expectNoSeriousAxeFindings(other.page, `${principal.label} notice`);
      await other.context.close();
    }
    // An absent entry is indistinguishable from the outsider's hidden one.
    const outsider = await signIn(browser, world, world.outsider);
    const gone = await outsider.page.goto(historyPath(absent), {
      waitUntil: 'domcontentloaded',
    });
    expect(gone?.status()).toBe(404);
    await expect(
      outsider.page.getByText('This entry is not available.'),
    ).toBeVisible();
    await expectNoHorizontalScroll(outsider.page, 'notice');
  });
});
