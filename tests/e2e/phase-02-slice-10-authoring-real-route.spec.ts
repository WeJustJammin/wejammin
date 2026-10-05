import { expect, test, type Page } from '@playwright/test';

import { authenticateLocalSession } from './support/local-signed-session';

/*
 * Slice 10 WP-S10-2d: CMS-05/CMS-06/CMS-07 end-to-end authoring journey over
 * the production-built Astro routes and the protected Worker API.
 *
 * One journey: create -> autosave -> two-tab same-field conflict -> resolve ->
 * compare -> restore. It runs only against the local real-route harness (the
 * loopback web origin the `wrangler dev` child owns) and fails closed: a page
 * or port that is not implemented locally is a hard failure, never a skip, and
 * a non-loopback origin is refused so this can never be mistaken for hosted
 * evidence.
 *
 * Expected RED until WP-S10-3/4/5 land the pages, proxies, and ports.
 */

const ENTRIES_PATH = '/app/cms-content-modeling/entries';
const ENTRY_ID = '30000000-0000-4000-8000-000000000030';
const CONFLICT_ID = '40000000-0000-4000-8000-000000000001';

test.beforeAll(() => {
  const origin = test.info().project.use.baseURL;
  // Fail closed: these checks are local-only. A configured non-loopback
  // origin means the run is mis-targeted and must not be treated as evidence.
  expect(origin, 'real-route baseURL must target loopback').toMatch(
    /^http:\/\/127\.0\.0\.1:\d+$/u,
  );
});

const collectBrowserErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
};

test.describe('Phase 2 Slice 10 entry authoring real route', () => {
  test('create, autosave, two-tab conflict, resolve, compare, and restore', async ({
    context,
    page,
  }) => {
    test.setTimeout(120_000);
    await authenticateLocalSession(context, {
      csrfToken: 's10-local-csrf-token',
    });
    const stalePage = await context.newPage();
    const browserErrors = collectBrowserErrors(page);
    collectBrowserErrors(stalePage);

    // 1. Create: the authoring-context preparation loads, the frozen request
    //    evidence is prefilled, and create bootstraps the entry plus its first
    //    draft revision.
    const create = await page.goto(`${ENTRIES_PATH}/new`, {
      waitUntil: 'domcontentloaded',
    });
    expect(create?.status()).toBe(200);
    expect(create?.headers()['cache-control']).toBe('no-store');
    await expect(
      page.getByRole('heading', { name: 'Create entry' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Create entry' }),
    ).toBeEnabled();
    const createPost = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/cms/entries') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Create entry' }).click();
    const created = await createPost;
    expect(created.status()).toBe(201);
    expect(created.request().headers()['idempotency-key']).toBeTruthy();
    // An initial create must not send an update-only If-Match.
    expect(created.request().headers()['if-match']).toBeUndefined();
    await expect(page.getByRole('status')).toContainText('Draft revision 1');

    // 2. Autosave: an edit is saved against the server-derived base revision.
    const draftPath = `${ENTRIES_PATH}/${ENTRY_ID}`;
    const both = await Promise.all([
      page.goto(draftPath, { waitUntil: 'domcontentloaded' }),
      stalePage.goto(draftPath, { waitUntil: 'domcontentloaded' }),
    ]);
    for (const loaded of both) expect(loaded?.status()).toBe(200);
    const titleField = page.getByRole('textbox', { name: 'Title' });
    const autosave = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/v1/cms/entries/${ENTRY_ID}/revisions`) &&
        response.request().method() === 'POST',
    );
    await titleField.fill('Release notes');
    await expect(titleField).toHaveValue('Release notes');
    const saved = await autosave;
    expect(saved.status()).toBe(201);
    expect(saved.request().headers()['if-match']).toBe('"1"');
    await expect(page.getByRole('status')).toContainText('Saved');

    // 3. Two-tab same-field conflict: the stale tab's same-field write is a
    //    truthful conflict, and no last-write-wins claim is made.
    const staleTitle = stalePage.getByRole('textbox', { name: 'Title' });
    await staleTitle.fill('Release notes (mine)');
    const stalePost = stalePage.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/v1/cms/entries/${ENTRY_ID}/revisions`) &&
        response.request().method() === 'POST',
    );
    await stalePage.getByRole('button', { name: 'Save draft' }).click();
    const conflicted = await stalePost;
    expect(conflicted.status()).toBe(409);
    await expect(stalePage.getByRole('alert')).toContainText(
      'The server reported a conflict.',
    );
    await expect(stalePage.getByRole('alert')).toBeFocused();
    // The unsent value is retained, never silently replaced.
    await expect(staleTitle).toHaveValue('Release notes (mine)');

    // 4. Resolve: the three-way conflict detail shows base/theirs/yours and a
    //    per-path choice, then commits a two-parent revision.
    const conflictPath = `${ENTRIES_PATH}/${ENTRY_ID}/conflicts/${CONFLICT_ID}`;
    const conflict = await stalePage.goto(conflictPath, {
      waitUntil: 'domcontentloaded',
    });
    expect(conflict?.status()).toBe(200);
    await expect(
      stalePage.getByRole('heading', { name: 'Resolve edit conflict' }),
    ).toBeVisible();
    await expect(stalePage.getByRole('group', { name: 'Base' })).toBeVisible();
    await expect(
      stalePage.getByRole('group', { name: 'Theirs' }),
    ).toBeVisible();
    await expect(stalePage.getByRole('group', { name: 'Yours' })).toBeVisible();
    const resolvePost = stalePage.waitForResponse(
      (response) =>
        response
          .url()
          .endsWith(
            `/api/v1/cms/entries/${ENTRY_ID}/conflicts/${CONFLICT_ID}/resolve`,
          ) && response.request().method() === 'POST',
    );
    await stalePage.getByRole('radio', { name: 'Keep yours' }).check();
    await stalePage.getByRole('button', { name: 'Resolve conflict' }).click();
    const resolved = await resolvePost;
    expect(resolved.status()).toBe(201);
    await expect(stalePage.getByRole('status')).toContainText(
      'Conflict resolved',
    );

    // 5. Compare: the history view groups changes by domain and names no
    //    target identity.
    const historyPath = `${draftPath}/revisions`;
    const history = await page.goto(historyPath, {
      waitUntil: 'domcontentloaded',
    });
    expect(history?.status()).toBe(200);
    await page
      .getByRole('link', { name: 'Compare with latest' })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: 'Comparison' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Field' })).toBeVisible();

    // 6. Restore: the D6 carrier drives a confirmation form that creates a new
    //    draft and leaves the source unchanged.
    await expect(
      page.getByRole('button', { name: 'Restore this revision' }),
    ).toBeEnabled();
    const restorePost = page.waitForResponse(
      (response) =>
        response.url().includes('/restore') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Restore this revision' }).click();
    const restored = await restorePost;
    expect(restored.status()).toBe(201);
    await expect(page.getByRole('status')).toContainText('Restored');

    expect(
      browserErrors.filter(
        (message) =>
          !message.startsWith('Failed to load resource:') &&
          !message.includes('net::ERR_'),
      ),
      'no script or hydration errors',
    ).toEqual([]);
  });
});
