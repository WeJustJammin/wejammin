import { expect, test } from '@playwright/test';

import { authenticateLocalSession } from './support/local-signed-session';

/*
 * Slice 10 WP-S10-2d: CMS-03B-13 entry-list pagination and concealment over the
 * production-built Astro route and the protected Worker API.
 *
 * The list shows only the caller's assigned entries, owns its signed cursor in
 * the URL, paginates with a native link, and conceals scope it may not read
 * (no row, no count, no existence confirmation). Local loopback only; fails
 * closed when the page or port is absent, and never fabricates hosted evidence.
 *
 * Expected RED until WP-S10-3/4/5 land the page and list port.
 */

const ENTRIES_PATH = '/app/cms-content-modeling/entries';
const CONCEALED_ENTRY_ID = '30000000-0000-4000-8000-000000000031';

test.beforeAll(() => {
  const origin = test.info().project.use.baseURL;
  expect(origin, 'real-route baseURL must target loopback').toMatch(
    /^http:\/\/127\.0\.0\.1:\d+$/u,
  );
});

test.describe('Phase 2 Slice 10 entry list real route', () => {
  test('paginates the caller assigned entries with a URL-owned signed cursor', async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);
    await authenticateLocalSession(context, {
      csrfToken: 's10-local-csrf-token',
    });

    const first = await page.goto(`${ENTRIES_PATH}?limit=1`, {
      waitUntil: 'domcontentloaded',
    });
    expect(first?.status()).toBe(200);
    expect(first?.headers()['cache-control']).toBe('no-store');
    await expect(page.getByRole('heading', { name: 'Entries' })).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Next page' })).toBeVisible();

    await page.getByRole('link', { name: 'Next page' }).click();
    await expect(page.locator('#entry-list-title')).toBeFocused();
    const query = new URL(page.url()).searchParams;
    expect(query.get('limit')).toBe('1');
    expect(query.get('cursor')).toBeTruthy();

    // Filters are typed URL state; an excluded state yields the filter-miss
    // empty state rather than a silent no-op.
    await page.goto(`${ENTRIES_PATH}?state=published&limit=25`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByText('No entries match these filters.'),
    ).toBeVisible();
  });

  test('conceals out-of-scope entries without leaking a row, count, or existence', async ({
    context,
    page,
  }) => {
    test.setTimeout(60_000);
    await authenticateLocalSession(context, {
      csrfToken: 's10-local-csrf-token',
    });

    const list = await page.goto(ENTRIES_PATH, {
      waitUntil: 'domcontentloaded',
    });
    expect(list?.status()).toBe(200);
    // A concealed entry never appears, not even as a placeholder row.
    await expect(page.getByText(CONCEALED_ENTRY_ID)).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(CONCEALED_ENTRY_ID);

    // Direct addressing of a concealed entry stays disclosure-safe.
    const concealed = await page.goto(`${ENTRIES_PATH}/${CONCEALED_ENTRY_ID}`, {
      waitUntil: 'domcontentloaded',
    });
    expect(concealed?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { name: 'Not found' }),
    ).toBeVisible();
    await expect(page.getByText('This entry is not available.')).toBeVisible();
  });
});
