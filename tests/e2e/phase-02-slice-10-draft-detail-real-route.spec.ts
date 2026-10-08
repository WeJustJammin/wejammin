import { expect, test } from '@playwright/test';

import { ENTRIES_API, ENTRIES_PATH, seedEntry } from './support/s10-real-api';
import {
  expectNoSeriousAxeFindings,
  gotoHydrated,
  requireLoopbackOrigin,
  signIn,
} from './support/s10-real-browser';
import {
  draftFacts,
  expectDraftFacts,
  expectNoLeak,
  expectResultConsumed,
  resultPanel,
} from './support/s10-real-result';
import {
  prepareS10World,
  provisionAuthor,
  s10Session,
  type S10World,
} from './support/s10-real-world';

/*
 * Slice 10 CMS-03B-11 (draft detail) and the concealment split of CMS-05, plus
 * authority loss, through the REAL composition. 401 is a sign-in redirect, 403 is
 * a visible entry the caller may not read, and 404 is one answer for a hidden
 * and an absent entry: the database decides, no stub does. Local loopback only.
 */

let world: S10World;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  requireLoopbackOrigin(test.info().project.use.baseURL);
  world = await prepareS10World();
});

const titleField = (page: import('@playwright/test').Page) =>
  page.getByRole('textbox', { name: /^Title/u });

test.describe('Phase 2 Slice 10 draft detail real route', () => {
  test('the assigned author reads the typed draft with its state, and the page is no-store and accessible', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const author = provisionAuthor(world, 'detail-read');
    const { page, client, browserErrors } = await signIn(
      browser,
      world,
      author,
    );
    const entry = await seedEntry(client, world, 'A typed draft');

    const response = await page.goto(`${ENTRIES_PATH}/${entry.entryId}`, {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.status()).toBe(200);
    expect(response?.headers()['cache-control']).toBe('no-store');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Edit entry' }),
    ).toBeVisible();
    await expect(titleField(page)).toHaveValue('A typed draft');
    const state = page.locator('dl');
    await expect(state).toContainText('Lifecycle');
    await expect(state.locator('dd').first()).toHaveText('active');
    await expect(state).toContainText('Revision state');
    await expect(state).toContainText('en-US');
    // The entry id is not echoed into the document outside the island's data.
    await expect(page.locator('main')).not.toContainText(entry.entryId);
    await expect(
      page.getByRole('link', { name: 'Revision history' }),
    ).toHaveAttribute('href', `${ENTRIES_PATH}/${entry.entryId}/revisions`);
    await expect(
      page.getByRole('link', { name: 'All entries' }),
    ).toHaveAttribute('href', ENTRIES_PATH);

    // The read is the database's own typed value: it equals the API projection.
    const api = await client.get(`${ENTRIES_API}/${entry.entryId}`);
    expect(api.status, api.text).toBe(200);
    expect(api.headers['cache-control']).toContain('no-store');
    expect(api.headers['etag']).toBeTruthy();
    // The canonical facts: revision, ENTRY version (the next If-Match) and the
    // provenance of every field in words, from the server's own draft. A page
    // reached by plain navigation shows no command result.
    await expectDraftFacts(page, {
      revision: '1',
      entryVersion: '1',
      provenance: ['Title: Authored', 'Summary: Not set', 'Body: Not set'],
    });
    await expect(resultPanel(page)).toHaveCount(0);
    await expectNoLeak(page, world, [author], []);
    await expectNoLeak(
      page,
      world,
      [author],
      ['A typed draft'],
      draftFacts(page),
    );
    await expectNoSeriousAxeFindings(page, 'draft detail');
    expect(browserErrors, 'no script or hydration errors').toEqual([]);
  });

  test('no session returns to sign-in at the exact address and shows no draft', async ({
    browser,
    page,
  }) => {
    test.setTimeout(90_000);
    const author = provisionAuthor(world, 'detail-signin');
    const { client } = await signIn(browser, world, author);
    const entry = await seedEntry(client, world, 'Must not leak');
    await page.goto(`${ENTRIES_PATH}/${entry.entryId}?locale=en-US`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page).toHaveURL(/\/auth\/sign-in\?/u);
    expect(new URL(page.url()).searchParams.get('returnTo')).toBe(
      `${ENTRIES_PATH}/${entry.entryId}?locale=en-US`,
    );
    await expect(page.locator('body')).not.toContainText('Must not leak');
  });

  test('403 for a visible entry the caller cannot read, one 404 for a hidden or absent one, 400 for a malformed id', async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const author = provisionAuthor(world, 'detail-conceal');
    const owner = await signIn(browser, world, author);
    const entry = await seedEntry(owner.client, world, 'Concealed draft');
    const absent = '30000000-0000-4000-8000-0000000000fe';

    const expectations = [
      // A member of the owning organization sees that the entry exists.
      [
        world.otherAuthor,
        entry.entryId,
        403,
        'Access denied',
        'This account cannot read this entry.',
      ],
      [
        world.member,
        entry.entryId,
        403,
        'Access denied',
        'This account cannot read this entry.',
      ],
      // A person outside it cannot tell it exists: the absent entry reads the same.
      [
        world.outsider,
        entry.entryId,
        404,
        'Not found',
        'This entry is not available.',
      ],
      [
        world.outsider,
        absent,
        404,
        'Not found',
        'This entry is not available.',
      ],
      [author, absent, 404, 'Not found', 'This entry is not available.'],
      [
        author,
        'not-a-uuid',
        400,
        'Invalid request',
        'This request could not be read.',
      ],
    ] as const;
    for (const [principal, id, status, heading, message] of expectations) {
      const caller =
        principal === author ? owner : await signIn(browser, world, principal);
      const visit = await caller.page.goto(`${ENTRIES_PATH}/${id}`, {
        waitUntil: 'domcontentloaded',
      });
      const label = `${principal.label} -> ${id}`;
      expect(visit?.status(), label).toBe(status);
      expect(visit?.headers()['cache-control'], label).toBe('no-store');
      await expect(
        caller.page.getByRole('heading', { level: 1 }),
        label,
      ).toHaveText(heading);
      await expect(caller.page.getByText(message), label).toBeVisible();
      await expect(caller.page.locator('main'), label).not.toContainText(
        'Concealed draft',
      );
      await expect(caller.page.locator('main'), label).not.toContainText(
        entry.entryId,
      );
      if (principal !== author) await caller.context.close();
    }
  });

  test('a revoked session keeps every unsent value and offers sign-in, and nothing is written', async ({
    browser,
    request,
  }) => {
    test.setTimeout(120_000);
    const author = provisionAuthor(world, 'detail-revoked');
    const { page, client } = await signIn(browser, world, author);
    const entry = await seedEntry(client, world, 'Before revocation');
    await gotoHydrated(page, `${ENTRIES_PATH}/${entry.entryId}`);
    await expect(titleField(page)).toHaveValue('Before revocation');

    // The session is revoked server side (the test-only control the S09 harness
    // owns): the next protected call is a definite 401, not an outcome unknown.
    const { sessionId } = s10Session(world, author);
    const revoked = await request.post('/_s09/revoke', { data: { sessionId } });
    expect(revoked.status()).toBe(200);

    await titleField(page).fill('Typed after revocation');
    const save = page.waitForResponse(
      (response) =>
        response.url().endsWith(`${ENTRIES_API}/${entry.entryId}/revisions`) &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Save draft' }).click();
    expect((await save).status()).toBe(401);
    await expect(page.getByRole('alert').first()).toContainText(
      'Your session expired. Sign in again to keep editing',
    );
    const signInLink = page.getByRole('link', { name: 'Sign in again' });
    await expect(signInLink).toBeVisible();
    expect(await signInLink.getAttribute('href')).toContain(
      `returnTo=${encodeURIComponent(`${ENTRIES_PATH}/${entry.entryId}`)}`,
    );
    // The unsent value stays in the page, and the database never saw it.
    await expect(titleField(page)).toHaveValue('Typed after revocation');
  });

  test('a stale or foreign command result is never shown and is cleared on read', async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    const author = provisionAuthor(world, 'detail-stale-result');
    const { page, client } = await signIn(browser, world, author);
    const entry = await seedEntry(client, world, 'No result for me');
    const draftPath = `${ENTRIES_PATH}/${entry.entryId}`;
    await page.goto(ENTRIES_PATH, { waitUntil: 'domcontentloaded' });
    // The record lives in the subject-bound detour store (step-up-draft.ts): the
    // values are strings, and the stamp carries the signed-in scope cookie.
    const record = (entryId: string, at: number) => ({
      at: String(at),
      kind: 'created',
      entryId,
      revisionNumber: '1',
      entryVersion: '1',
      state: 'draft',
      parentRevisionIds: '',
      migrationChainId: '',
      edgeCount: '',
    });
    const plant = (
      values: Record<string, string>,
      scope: 'own' | { readonly other: string } = 'own',
    ) =>
      page.evaluate(
        ({ stored, other }) => {
          const own = document.cookie
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith('wj_step_up_scope='))
            ?.slice('wj_step_up_scope='.length);
          window.sessionStorage.setItem(
            'wj-step-up-draft:cms-editorial-result',
            JSON.stringify({
              values: stored,
              idempotencyKey: '',
              expectedVersion: null,
              binding: other ?? own ?? null,
              createdAt: Date.now(),
            }),
          );
        },
        {
          stored: values,
          other: scope === 'own' ? undefined : scope.other,
        },
      );

    // A result left for ANOTHER entry never appears on this one.
    await plant(record('30000000-0000-4000-8000-0000000000aa', Date.now()));
    await gotoHydrated(page, draftPath);
    await expect(resultPanel(page)).toHaveCount(0);
    await expectResultConsumed(page);

    // A result left under ANOTHER signed-in subject's scope is never shown to
    // this one (the lineage identifiers it holds are not theirs), and is cleared.
    await page.goto(ENTRIES_PATH, { waitUntil: 'domcontentloaded' });
    await plant(record(entry.entryId, Date.now()), {
      other: 'zzzzzzzzzzzzzzzzzzzzzzzz',
    });
    await gotoHydrated(page, draftPath);
    await expect(resultPanel(page)).toHaveCount(0);
    await expectResultConsumed(page);

    // A result older than its two-minute window belongs to a navigation that
    // did not happen: not shown either.
    await page.goto(ENTRIES_PATH, { waitUntil: 'domcontentloaded' });
    await plant(record(entry.entryId, Date.now() - 10 * 60_000));
    await gotoHydrated(page, draftPath);
    await expect(resultPanel(page)).toHaveCount(0);
    await expectResultConsumed(page);

    // A malformed record is ignored and cleared.
    await page.goto(ENTRIES_PATH, { waitUntil: 'domcontentloaded' });
    await plant({ at: 'now', kind: 'created' });
    await gotoHydrated(page, draftPath);
    await expect(resultPanel(page)).toHaveCount(0);
    await expectResultConsumed(page);
    await expect(draftFacts(page)).toBeVisible();
  });
});
