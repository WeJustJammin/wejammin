import { expect, test } from '@playwright/test';

import {
  ENTRIES_API,
  ENTRIES_PATH,
  appendTitle,
  seedEntry,
} from './support/s10-real-api';
import {
  focusedName,
  gotoHydrated,
  requireLoopbackOrigin,
  signIn,
  tabTo,
  waitForIslands,
} from './support/s10-real-browser';
import {
  expectFocusOnResultHeading,
  resultPanel,
} from './support/s10-real-result';
import {
  effectCounts,
  prepareS10World,
  provisionAuthor,
  type S10World,
} from './support/s10-real-world';

/*
 * Slice 10 keyboard-only flows through the REAL composition. Every interaction
 * after the page loads is a key press: Tab / Shift+Tab to reach a control, Enter
 * or Space to operate it, Escape to cancel, arrow keys for a select and radio
 * group. No click, no programmatic focus, no hover. Each flow ends at the
 * database's own committed effect. Local loopback only; never hosted evidence.
 */

let world: S10World;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  requireLoopbackOrigin(test.info().project.use.baseURL);
  world = await prepareS10World();
});

test.describe('Phase 2 Slice 10 keyboard-only real route', () => {
  test('the skip link is the first stop and moves focus into the main landmark', async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const author = provisionAuthor(world, 'keys-skip');
    const { page } = await signIn(browser, world, author);
    await page.goto(ENTRIES_PATH, { waitUntil: 'domcontentloaded' });
    await page.keyboard.press('Tab');
    expect(await focusedName(page)).toMatch(/^a:Skip to main content/u);
    await page.keyboard.press('Enter');
    await expect(page.locator('#cms-editorial-main')).toBeFocused();
  });

  test('list -> create -> type -> Enter creates one entry without a pointer', async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const author = provisionAuthor(world, 'keys-create');
    const { page } = await signIn(browser, world, author);
    await page.goto(ENTRIES_PATH, { waitUntil: 'domcontentloaded' });

    await tabTo(page, /^a:Create entry/u);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${ENTRIES_PATH}/new$`, 'u'));
    await expect(
      page.getByRole('heading', { level: 1, name: 'Create entry' }),
    ).toBeVisible();

    // The native selector is operated with the arrow key and the Load button
    // with Enter; the URL then owns the chosen type.
    await tabTo(page, /^select:Content type/u);
    await page.keyboard.press('ArrowDown');
    await tabTo(page, /^button:Load fields/u);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(
      new RegExp(`contentTypeVersionId=${world.contentTypeVersionId}`, 'u'),
    );
    await waitForIslands(page);

    await tabTo(page, /^input:Title/u);
    await page.keyboard.type('Typed with the keyboard');
    const created = page.waitForResponse(
      (response) =>
        response.url().endsWith(ENTRIES_API) &&
        response.request().method() === 'POST',
    );
    // Enter inside a text field submits the form, exactly as the button does.
    await page.keyboard.press('Enter');
    expect((await created).status()).toBe(201);
    await expect(page).toHaveURL(
      new RegExp(`${ENTRIES_PATH}/[0-9a-f-]{36}$`, 'u'),
    );
    await expect(page.getByRole('textbox', { name: /^Title/u })).toHaveValue(
      'Typed with the keyboard',
    );
    // The result of the keyboard-made create takes keyboard focus on its heading.
    await expectFocusOnResultHeading(page);
    await expect(
      resultPanel(page).getByRole('heading', { level: 2 }),
    ).toHaveText('Entry created');
  });

  test('edit: Tab to the title, type, and Tab to Save draft with Enter saves under If-Match', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const author = provisionAuthor(world, 'keys-edit');
    const { page, client } = await signIn(browser, world, author);
    const entry = await seedEntry(client, world, 'Keyboard base');
    await gotoHydrated(page, `${ENTRIES_PATH}/${entry.entryId}`);

    await tabTo(page, /^input:Title/u);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Keyboard edit');
    await tabTo(page, /^button:Save draft/u);
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith(`${ENTRIES_API}/${entry.entryId}/revisions`) &&
        response.request().method() === 'POST',
    );
    await page.keyboard.press('Enter');
    const response = await saved;
    expect(response.status()).toBe(201);
    expect(response.request().headers()['if-match']).toBe('"1"');
    // An explicit save leaves focus where the author put it.
    expect(await focusedName(page)).toMatch(/^button:Save draft/u);
    await expect(page.getByRole('status').first()).toContainText(
      'All changes saved.',
    );
  });

  test('conflict: the three-way choice is made with arrow keys and Space, and Enter on Resolve commits it', async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const author = provisionAuthor(world, 'keys-conflict');
    const first = await signIn(browser, world, author, 1);
    const second = await signIn(browser, world, author, 2);
    const entry = await seedEntry(
      first.client,
      world,
      'Keyboard conflict base',
    );
    // Session one moves the entry (version 2); a second device of the same
    // author then writes the same field holding the CURRENT entry version but
    // the old base revision, which records the durable open conflict.
    const moved = await appendTitle(
      first.client,
      world,
      entry,
      'Theirs by key',
    );
    const stale = await second.client.post(
      `${ENTRIES_API}/${entry.entryId}/revisions`,
      {
        entryId: entry.entryId,
        baseRevision: entry.revision,
        changedPaths: [`/fields/${world.fields.title}`],
        values: { [world.fields.title]: 'Mine by key' },
        locale: 'en-US',
        expectedVersion: moved.version,
      },
      { ifMatch: moved.version },
    );
    expect(stale.status, stale.text).toBe(409);
    const detail = await second.client.get(`${ENTRIES_API}/${entry.entryId}`);
    const conflictId = (detail.body.openConflict as { conflictId: string })
      .conflictId;

    await gotoHydrated(
      second.page,
      `${ENTRIES_PATH}/${entry.entryId}/conflicts/${conflictId}`,
    );
    await expect(
      second.page.getByRole('heading', { name: 'Resolve edit conflict' }),
    ).toBeVisible();
    const resolved = second.page.waitForResponse(
      (response) =>
        response.url().endsWith(`/conflicts/${conflictId}/resolve`) &&
        response.request().method() === 'POST',
    );
    // Reach the first radio of the group, then move with the arrow keys.
    await tabTo(second.page, /^input:Keep base/u);
    await second.page.keyboard.press('ArrowDown');
    await second.page.keyboard.press('ArrowDown');
    await expect(
      second.page.getByRole('radio', { name: 'Keep your version' }),
    ).toBeFocused();
    await second.page.keyboard.press('Space');
    await expect(
      second.page.getByRole('radio', { name: 'Keep your version' }),
    ).toBeChecked();
    await tabTo(second.page, /^button:Resolve conflict/u);
    await second.page.keyboard.press('Enter');
    expect((await resolved).status()).toBe(201);
    await expect(second.page).toHaveURL(
      new RegExp(`${ENTRIES_PATH}/${entry.entryId}$`, 'u'),
    );
    expect(effectCounts(entry.entryId)).toMatchObject({ openConflicts: 0 });
  });

  test('history: compare with Enter, open the restore review with Enter, cancel with Escape, then confirm with Enter', async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const author = provisionAuthor(world, 'keys-restore');
    const { page, client } = await signIn(browser, world, author);
    const one = await seedEntry(client, world, 'Restore me');
    const two = await appendTitle(client, world, one, 'Newer title');
    await page.goto(`${ENTRIES_PATH}/${one.entryId}/revisions`, {
      waitUntil: 'domcontentloaded',
    });

    await tabTo(page, /^a:Compare with latest revision 1/u);
    await page.keyboard.press('Enter');
    await expect(page.locator('#history-compare-title')).toBeFocused();

    await tabTo(page, /^summary:Restore this revision/u);
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('heading', { name: 'Confirm restore' }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('heading', { name: 'Confirm restore' }),
    ).toBeHidden();
    expect(effectCounts(one.entryId).revisions).toBe(2);

    await tabTo(page, /^summary:Restore this revision/u);
    await page.keyboard.press('Enter');
    // Wait for the review to be open and focused before tabbing on, so the key
    // sequence never races the page script that moves focus into it.
    await expect(
      page.getByRole('heading', { name: 'Confirm restore' }),
    ).toBeFocused();
    await tabTo(page, /^button:Confirm restore/u);
    const restored = page.waitForResponse(
      (response) =>
        response.url().includes('/restore') &&
        response.request().method() === 'POST',
    );
    await page.keyboard.press('Enter');
    const response = await restored;
    expect(response.status()).toBe(201);
    expect(response.request().headers()['if-match']).toBe(`"${two.version}"`);
    await expect(page).toHaveURL(
      new RegExp(`${ENTRIES_PATH}/${one.entryId}$`, 'u'),
    );
    expect(effectCounts(one.entryId).revisions).toBe(3);
  });
});
