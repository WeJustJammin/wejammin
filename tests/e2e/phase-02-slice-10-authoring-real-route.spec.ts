import { expect, test, type Page, type Response } from '@playwright/test';

import {
  ENTRIES_API,
  ENTRIES_PATH,
  seedEntry,
  type SeededEntry,
} from './support/s10-real-api';
import {
  expectNoSeriousAxeFindings,
  gotoHydrated,
  requireLoopbackOrigin,
  signIn,
  waitForIslands,
} from './support/s10-real-browser';
import {
  draftFacts,
  expectDraftFacts,
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
 * Slice 10 CMS-05 / CMS-06 authoring through the REAL composition: the
 * production-built Astro routes, the first-party web proxy, the production
 * Worker, the production RPC adapter, Kong, PostgREST and the newest SQL. Only
 * the signed session and the always-allow rate limiter are supplied (as the
 * real-API gate suites do); entries, revisions and conflicts are produced by the
 * real commands, and the durable effects are read back from the database.
 *
 * Covers CMS-03B-14 -> CMS-03B-10 (create), CMS-03B-01 (edit/autosave with
 * If-Match and Idempotency-Key, including an outcome-unknown replay),
 * CMS-03B-12 / CMS-03B-02 (a same-field conflict from a second session, its
 * detail and its resolution). Local loopback only; never hosted evidence.
 */

let world: S10World;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  requireLoopbackOrigin(test.info().project.use.baseURL);
  world = await prepareS10World();
});

const isRevisionPost =
  (entryId: string) =>
  (response: Response): boolean =>
    response.url().endsWith(`${ENTRIES_API}/${entryId}/revisions`) &&
    response.request().method() === 'POST';

const titleField = (page: Page) =>
  page.getByRole('textbox', { name: /^Title/u });

test.describe('Phase 2 Slice 10 entry authoring real route', () => {
  test('create: the preparation loads, local validation sends nothing, and one create commits one entry with one revision, audit and outbox event', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const author = provisionAuthor(world, 'authoring-create');
    const { page, browserErrors } = await signIn(browser, world, author);

    const prepared = await gotoHydrated(page, `${ENTRIES_PATH}/new`);
    expect(prepared?.status()).toBe(200);
    expect(prepared?.headers()['cache-control']).toBe('no-store');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Create entry' }),
    ).toBeVisible();
    // The type is chosen with a native GET selector: the URL owns the choice and
    // the fields appear only for a compiled version the server projected.
    await page
      .getByLabel('Content type')
      .selectOption(world.contentTypeVersionId);
    await page.getByRole('button', { name: 'Load fields' }).click();
    await expect(page).toHaveURL(
      new RegExp(`contentTypeVersionId=${world.contentTypeVersionId}`, 'u'),
    );
    await waitForIslands(page);
    await expect(titleField(page)).toBeVisible();
    await expectNoSeriousAxeFindings(page, 'create form');

    // A required field left empty is refused locally: nothing is sent and the
    // linked summary takes focus.
    const posts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith(ENTRIES_API))
        posts.push(request.url());
    });
    await page.getByRole('button', { name: 'Create entry' }).click();
    await expect(
      page.getByRole('heading', {
        name: 'Check these fields before creating the entry',
      }),
    ).toBeVisible();
    expect(posts).toEqual([]);

    await titleField(page).fill('Release notes');
    const createPost = page.waitForResponse(
      (response) =>
        response.url().endsWith(ENTRIES_API) &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Create entry' }).click();
    const created = await createPost;
    expect(created.status()).toBe(201);
    const sent = created.request().headers();
    expect(sent['idempotency-key']).toBeTruthy();
    // A create has no prior version: an If-Match would be a lie.
    expect(sent['if-match']).toBeUndefined();
    // The body is gone once the page navigates, so the proof of identity is the
    // Location header (the created entry) and the strong ETag (its version 1).
    expect(created.headers()['etag']).toBe('"1"');
    const location = created.headers()['location'] ?? '';
    expect(location).toMatch(new RegExp(`^${ENTRIES_API}/[0-9a-f-]{36}$`, 'u'));
    const entryId = location.slice(`${ENTRIES_API}/`.length);

    // Success opens the new draft on its APP route, never the API URL.
    await expect(page).toHaveURL(
      new RegExp(`${ENTRIES_PATH}/${entryId}$`, 'u'),
    );
    await waitForIslands(page);
    await expect(titleField(page)).toHaveValue('Release notes');

    // The canonical result of the create: a status named by its heading with the
    // exact committed facts and the next action, focus on that heading, the
    // draft facts beside it, and nothing hidden anywhere in the document.
    await expectResultPanel(page, {
      heading: 'Entry created',
      sentence: 'The first draft is revision 1 (entry version 1).',
      parents: [],
      migration: null,
      nextAction: 'Fill in the fields below; changes save automatically.',
      historyHref: `${ENTRIES_PATH}/${entryId}/revisions`,
    });
    await expectFocusOnResultHeading(page);
    await expectDraftFacts(page, {
      revision: '1',
      entryVersion: '1',
      provenance: ['Title: Authored', 'Summary: Not set', 'Body: Not set'],
    });
    await expectNoLeak(page, world, [author], []);
    await expectNoLeak(
      page,
      world,
      [author],
      ['Release notes'],
      resultPanel(page),
    );
    await expectResultConsumed(page);
    // One-shot: a reload shows the facts again but never the result a second time.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForIslands(page);
    await expect(resultPanel(page)).toHaveCount(0);
    await expectDraftFacts(page, {
      revision: '1',
      entryVersion: '1',
      provenance: ['Title: Authored', 'Summary: Not set', 'Body: Not set'],
    });
    expect(effectCounts(entryId)).toEqual({
      entries: 1,
      revisions: 1,
      audit: 1,
      outbox: 1,
      conflicts: 0,
      openConflicts: 0,
    });
    expect(browserErrors, 'no script or hydration errors').toEqual([]);
  });

  test('edit: an explicit save and an autosave send the server-derived If-Match and base, each under its own key, and move focus nowhere', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const author = provisionAuthor(world, 'authoring-edit');
    const { page, client, browserErrors } = await signIn(
      browser,
      world,
      author,
    );
    const entry = await seedEntry(client, world, 'Draft one');

    const loaded = await gotoHydrated(page, `${ENTRIES_PATH}/${entry.entryId}`);
    expect(loaded?.status()).toBe(200);
    expect(loaded?.headers()['cache-control']).toBe('no-store');
    await expect(titleField(page)).toHaveValue('Draft one');

    // Explicit Save draft.
    await titleField(page).fill('Draft two');
    const explicit = page.waitForResponse(isRevisionPost(entry.entryId));
    await page.getByRole('button', { name: 'Save draft' }).click();
    const first = await explicit;
    expect(first.status()).toBe(201);
    const firstSent = first.request().headers();
    expect(firstSent['if-match']).toBe('"1"');
    expect(firstSent['idempotency-key']).toBeTruthy();
    expect(first.request().postDataJSON()).toMatchObject({
      entryId: entry.entryId,
      baseRevision: '1',
      expectedVersion: '1',
      changedPaths: [`/fields/${world.fields.title}`],
      values: { [world.fields.title]: 'Draft two' },
    });
    expect(
      ((await first.json()) as { entryVersion: string }).entryVersion,
    ).toBe('2');
    expect(first.headers()['etag']).toBe('"2"');
    await expect(page.getByRole('status').first()).toContainText(
      'All changes saved.',
    );

    // Autosave: a typed change is sent after the idle window without any click,
    // against the base the previous response established, and focus stays put.
    const auto = page.waitForResponse(isRevisionPost(entry.entryId), {
      timeout: 45_000,
    });
    await titleField(page).fill('Draft three');
    await expect(titleField(page)).toBeFocused();
    const second = await auto;
    expect(second.status()).toBe(201);
    const secondSent = second.request().headers();
    expect(secondSent['if-match']).toBe('"2"');
    expect(secondSent['idempotency-key']).not.toBe(
      firstSent['idempotency-key'],
    );
    expect(second.request().postDataJSON()).toMatchObject({
      baseRevision: '2',
      expectedVersion: '2',
    });
    await expect(titleField(page)).toBeFocused();
    await expect(page.getByRole('status').first()).toContainText(
      'All changes saved.',
    );

    expect(effectCounts(entry.entryId)).toMatchObject({
      entries: 1,
      revisions: 3,
      conflicts: 0,
    });

    // The canonical facts follow every verified save: the revision, the ENTRY
    // version (the next If-Match) and, per field, where the stored value came from.
    await expectDraftFacts(page, {
      revision: '3',
      entryVersion: '3',
      provenance: ['Title: Authored', 'Summary: Not set', 'Body: Not set'],
    });
    await page.getByLabel('Summary').fill('A note');
    const noteSave = page.waitForResponse(isRevisionPost(entry.entryId));
    await page.getByRole('button', { name: 'Save draft' }).click();
    expect((await noteSave).status()).toBe(201);
    await expectDraftFacts(page, {
      revision: '4',
      entryVersion: '4',
      provenance: ['Title: Authored', 'Summary: Authored', 'Body: Not set'],
    });
    // Clearing the field is written as a value too. What the page states right
    // after the save must be what the SERVER holds: a reload reads it back.
    await page.getByLabel('Summary').fill('');
    const clearSave = page.waitForResponse(isRevisionPost(entry.entryId));
    await page.getByRole('button', { name: 'Save draft' }).click();
    expect((await clearSave).status()).toBe(201);
    const facts = draftFacts(page);
    await expect(facts.locator('[data-fact="entry-version"]')).toHaveText('5');
    const summaryItem = facts.locator('[data-cms-editorial-provenance] > li', {
      hasText: 'Summary:',
    });
    const afterSave = (await summaryItem.textContent()) ?? '';
    expect(afterSave).toMatch(/^Summary: (Explicitly empty|Not set)$/u);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForIslands(page);
    await expect(summaryItem).toHaveText(afterSave);
    await expectDraftFacts(page, {
      revision: '5',
      entryVersion: '5',
      provenance: ['Title: Authored', afterSave, 'Body: Not set'],
    });
    await expectNoSeriousAxeFindings(page, 'draft editor');
    expect(browserErrors, 'no script or hydration errors').toEqual([]);
  });

  test('edit: a save whose response is lost is replayed byte for byte under the same key and commits exactly once', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const author = provisionAuthor(world, 'authoring-unknown');
    const { page, client } = await signIn(browser, world, author);
    const entry = await seedEntry(client, world, 'Before the lost response');
    await gotoHydrated(page, `${ENTRIES_PATH}/${entry.entryId}`);
    await expect(titleField(page)).toHaveValue('Before the lost response');
    const before = effectCounts(entry.entryId);

    // The first attempt reaches the server and commits; its response never
    // reaches the browser (an outcome-unknown loss). Later attempts pass.
    const attempts: { key: string; ifMatch: string; body: string }[] = [];
    let dropped = false;
    await page.route(
      `**${ENTRIES_API}/${entry.entryId}/revisions`,
      async (route) => {
        const request = route.request();
        attempts.push({
          key: request.headers()['idempotency-key'] ?? '',
          ifMatch: request.headers()['if-match'] ?? '',
          body: request.postData() ?? '',
        });
        if (dropped) {
          await route.continue();
          return;
        }
        dropped = true;
        await route.fetch();
        await route.abort('failed');
      },
    );

    await titleField(page).fill('Survives a lost response');
    const replayed = page.waitForResponse(
      (response) =>
        isRevisionPost(entry.entryId)(response) && response.status() === 201,
      { timeout: 45_000 },
    );
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByRole('status').first()).toContainText(
      /could not be confirmed|status unknown/u,
    );
    const outcome = await replayed;
    expect(outcome.status()).toBe(201);

    // The identical request was sent again: same key, same If-Match, same bytes.
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(attempts[0]);
    await expect(page.getByRole('status').first()).toContainText(
      'All changes saved.',
    );

    // Exactly one revision, one audit row and one outbox event were committed:
    // the replay returned the first outcome without a second effect.
    const after = effectCounts(entry.entryId);
    expect(after.revisions).toBe(before.revisions + 1);
    expect(after.audit).toBe(before.audit + 1);
    expect(after.outbox).toBe(before.outbox + 1);
    expect(after.conflicts).toBe(0);
  });

  test('conflict: a same-field save from a stale second session is a truthful 409 that overwrites nothing, and only an explicit discard loads the current version', async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const author = provisionAuthor(world, 'authoring-stale');
    const first = await signIn(browser, world, author, 1);
    const second = await signIn(browser, world, author, 2);
    const entry: SeededEntry = await seedEntry(
      first.client,
      world,
      'Base title',
    );
    const draftPath = `${ENTRIES_PATH}/${entry.entryId}`;
    const [mine, theirs] = await Promise.all([
      gotoHydrated(second.page, draftPath),
      gotoHydrated(first.page, draftPath),
    ]);
    expect(mine?.status()).toBe(200);
    expect(theirs?.status()).toBe(200);

    // Session one saves first (entry version 2).
    await titleField(first.page).fill('Their title');
    const firstSave = first.page.waitForResponse(isRevisionPost(entry.entryId));
    await first.page.getByRole('button', { name: 'Save draft' }).click();
    expect((await firstSave).status()).toBe(201);

    // Session two, still on version 1, changes the same field.
    await titleField(second.page).fill('My title');
    const stale = second.page.waitForResponse(isRevisionPost(entry.entryId));
    await second.page.getByRole('button', { name: 'Save draft' }).click();
    const conflicted = await stale;
    expect(conflicted.status()).toBe(409);
    expect(conflicted.request().headers()['if-match']).toBe('"1"');
    const alert = second.page.getByRole('alert').first();
    await expect(alert).toContainText(/nothing was overwritten/iu);
    await expect(alert).toContainText('Loaded version 1');
    await expect(alert).toContainText('current version 2');
    await expect(alert).toBeFocused();
    // The unsent value is retained, never silently replaced (no last write wins).
    await expect(titleField(second.page)).toHaveValue('My title');
    await expect(
      second.page.getByRole('link', {
        name: 'Open the current version in a new tab',
      }),
    ).toHaveAttribute('href', draftPath);
    await expectNoSeriousAxeFindings(second.page, 'stale-session conflict');
    // The stale version check refused the write before any conflict was
    // recorded: two revisions, no durable conflict, nothing from "My title".
    expect(effectCounts(entry.entryId)).toMatchObject({
      revisions: 2,
      conflicts: 0,
      openConflicts: 0,
    });

    // Only an explicit action drops the unsent edit and loads the current draft.
    await second.page
      .getByRole('button', {
        name: 'Discard my changes and load the current version',
      })
      .click();
    await expect(titleField(second.page)).toHaveValue('Their title');
    expect(first.browserErrors, 'session one: no script errors').toEqual([]);
    expect(second.browserErrors, 'session two: no script errors').toEqual([]);
  });

  test('conflict: a durable open conflict opens from the editor, shows the three preimages, and the explicit resolution closes it as a two-parent revision', async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const author = provisionAuthor(world, 'authoring-conflict');
    const first = await signIn(browser, world, author, 1);
    const second = await signIn(browser, world, author, 2);
    const entry: SeededEntry = await seedEntry(
      first.client,
      world,
      'Base title',
    );
    const draftPath = `${ENTRIES_PATH}/${entry.entryId}`;
    await Promise.all([
      gotoHydrated(second.page, draftPath),
      gotoHydrated(first.page, draftPath),
    ]);

    // Session one saves 'Their title' (entry version 2).
    await titleField(first.page).fill('Their title');
    const firstSave = first.page.waitForResponse(isRevisionPost(entry.entryId));
    await first.page.getByRole('button', { name: 'Save draft' }).click();
    expect((await firstSave).status()).toBe(201);

    // A second writer of the same author (another device) holds the current
    // entry version but a stale BASE revision and changes the same field: the
    // real command records exactly one durable open conflict (CMS-03B-01).
    const device = await second.client.post(
      `${ENTRIES_API}/${entry.entryId}/revisions`,
      {
        entryId: entry.entryId,
        baseRevision: entry.revision,
        changedPaths: [`/fields/${world.fields.title}`],
        values: { [world.fields.title]: 'My title' },
        locale: 'en-US',
        expectedVersion: '2',
      },
      { ifMatch: '2' },
    );
    expect(device.status, device.text).toBe(409);
    expect(effectCounts(entry.entryId)).toMatchObject({
      revisions: 2,
      conflicts: 1,
      openConflicts: 1,
    });

    // The author's own editor, saving from its stale view, is told the truth
    // and offered the durable conflict instead of a last-write-wins.
    await titleField(second.page).fill('Typed in the stale tab');
    const refused = second.page.waitForResponse(isRevisionPost(entry.entryId));
    await second.page.getByRole('button', { name: 'Save draft' }).click();
    expect((await refused).status()).toBe(409);
    await expect(second.page.getByRole('alert').first()).toContainText(
      /nothing was overwritten/iu,
    );
    await expect(
      second.page.getByRole('heading', {
        name: 'This entry has an open conflict',
      }),
    ).toBeVisible();
    // Leaving with an unsent change asks first, inline: the heading takes focus,
    // Escape keeps editing and keeps the value, and only an explicit choice goes.
    await second.page
      .getByRole('link', { name: 'Resolve the conflict' })
      .click();
    await expect(
      second.page.getByRole('heading', { name: 'Leave this entry?' }),
    ).toBeFocused();
    await expect(
      second.page.locator('[data-cms-editorial-leave]'),
    ).toContainText('You have 1 unsent change.');
    await second.page.keyboard.press('Escape');
    await expect(
      second.page.getByRole('heading', { name: 'Leave this entry?' }),
    ).toBeHidden();
    await expect(titleField(second.page)).toHaveValue('Typed in the stale tab');
    await second.page
      .getByRole('link', { name: 'Resolve the conflict' })
      .click();
    await second.page
      .getByRole('button', { name: 'Leave without saving' })
      .click();
    await waitForIslands(second.page);
    await expect(
      second.page.getByRole('heading', {
        level: 1,
        name: 'Resolve edit conflict',
      }),
    ).toBeVisible();
    for (const [group, value] of [
      ['Base', 'Base title'],
      ['Their version', 'Their title'],
      ['Your version', 'My title'],
    ] as const) {
      const side = second.page.getByRole('group', { name: group });
      await expect(side).toBeVisible();
      await expect(side).toContainText(value);
    }
    // Nothing is preselected: a winner is never inferred.
    for (const radio of await second.page.getByRole('radio').all())
      await expect(radio).not.toBeChecked();
    await expectNoSeriousAxeFindings(second.page, 'conflict resolution');

    // Resolving without a choice sends nothing and says what is missing.
    const resolveUrl = new RegExp(
      `${ENTRIES_API}/${entry.entryId}/conflicts/[0-9a-f-]+/resolve$`,
      'u',
    );
    const resolvePosts: string[] = [];
    second.page.on('request', (request) => {
      if (request.method() === 'POST' && resolveUrl.test(request.url()))
        resolvePosts.push(request.url());
    });
    await second.page.getByRole('button', { name: 'Resolve conflict' }).click();
    await expect(
      second.page.getByRole('heading', {
        name: 'Check these fields before resolving',
      }),
    ).toBeVisible();
    expect(resolvePosts).toEqual([]);

    const resolvePost = second.page.waitForResponse(
      (response) =>
        resolveUrl.test(response.url()) &&
        response.request().method() === 'POST',
    );
    await second.page.getByRole('radio', { name: 'Keep your version' }).check();
    await second.page.getByRole('button', { name: 'Resolve conflict' }).click();
    const resolved = await resolvePost;
    expect(resolved.status()).toBe(201);
    expect(resolved.request().headers()['if-match']).toBe('"2"');
    expect(resolved.request().headers()['idempotency-key']).toBeTruthy();
    const conflictId = new URL(resolved.url()).pathname.split('/')[7] as string;
    const etag = resolved.headers()['etag'];
    // The resolution is a new revision on top of both sides (entry version 3).
    expect(etag).toBe('"3"');
    await expect(second.page).toHaveURL(new RegExp(`${draftPath}$`, 'u'));
    await waitForIslands(second.page);
    await expect(titleField(second.page)).toHaveValue('My title');
    expect(effectCounts(entry.entryId)).toMatchObject({
      revisions: 3,
      conflicts: 1,
      openConflicts: 0,
    });

    // The canonical result of the resolution: the committed revision and entry
    // version, and the lineage - exactly the two parents the database stored for
    // the new head, in that order - with focus on the result heading.
    const head = revisionLineage(entry.entryId).at(-1);
    expect(head?.number).toBe('3');
    expect(head?.parents).toHaveLength(2);
    await expectResultPanel(second.page, {
      heading: 'Conflict resolved',
      sentence:
        'Your choices were saved as revision 3 (entry version 3). Both competing revisions stay in the history.',
      parents: [
        ['Parent revision 1', head?.parents[0] ?? ''],
        ['Parent revision 2', head?.parents[1] ?? ''],
      ],
      migration: null,
      nextAction:
        'Review the resolved draft below and keep editing; changes save automatically.',
      historyHref: `${draftPath}/revisions`,
    });
    await expectFocusOnResultHeading(second.page);
    await expectDraftFacts(second.page, {
      revision: '3',
      entryVersion: '3',
      provenance: ['Title: Authored', 'Summary: Not set', 'Body: Not set'],
    });
    await expectNoLeak(second.page, world, [author], []);
    await expectNoLeak(
      second.page,
      world,
      [author],
      ['Base title', 'Their title', 'My title'],
      resultPanel(second.page),
    );
    await expectResultConsumed(second.page);

    // A closed conflict is the same concealed 404 as an absent one (DEC-139).
    const closed = await second.page.goto(
      `${draftPath}/conflicts/${conflictId}`,
      { waitUntil: 'domcontentloaded' },
    );
    expect(closed?.status()).toBe(404);
    await expect(
      second.page.getByText('This conflict is not open.'),
    ).toBeVisible();

    expect(first.browserErrors, 'session one: no script errors').toEqual([]);
    expect(second.browserErrors, 'session two: no script errors').toEqual([]);
  });
});
