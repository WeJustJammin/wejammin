import AxeBuilder from '@axe-core/playwright';

import { expect, test } from '@playwright/test';

import { authenticateLocalSession } from './support/local-signed-session';

const ENTRY_ID = '30000000-0000-4000-8000-000000000030';
const VISIBLE_UNASSIGNED_ENTRY_ID = '30000000-0000-4000-8000-000000000032';
const PATH = `/app/cms-content-modeling/entries/${ENTRY_ID}/revisions`;

test('CMS-07 keeps revision history protected and renders only authorized safe summaries', async ({
  context,
  page,
}) => {
  const denied = await page.goto(PATH);
  expect(denied?.status()).toBe(200);
  await expect(page).toHaveURL(/\/auth\/sign-in\?/);
  await expect(page.getByText('Revision 2')).toHaveCount(0);

  await authenticateLocalSession(context);
  const response = await page.goto(PATH);
  expect(response?.status()).toBe(200);
  expect(response?.headers()['cache-control']).toBe('no-store');
  await expect(
    page.getByRole('heading', { name: 'Revision history' }),
  ).toBeVisible();
  await expect(page.getByText(/Revision 2 · submitted/)).toBeVisible();
  await expect(page.getByText(/Revision 1 · draft/)).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await expect(page.getByRole('listitem').first()).toContainText(
    'Locale: en-US',
  );
  await expect(page.getByRole('listitem').first()).toContainText(
    `Content hash: ${'a'.repeat(64)}`,
  );
  await expect(page.getByText('<img src=x onerror=alert(1)>')).toBeVisible();
  await expect(page.locator('img')).toHaveCount(0);

  await page.getByLabel('State').selectOption('draft');
  await page.getByLabel('Locale').fill('en-US');
  await page.getByRole('button', { name: 'Filter history' }).click();
  await expect(page.locator('#history-list-title')).toBeFocused();
  await expect(page.getByText(/Revision 1 · draft/)).toBeVisible();
  await expect(page.getByText(/Revision 2 · submitted/)).toHaveCount(0);
  const compare = page.getByRole('link', { name: 'Compare with latest' });
  await compare.click();
  await expect(page.locator('#history-compare-title')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Comparison' })).toBeVisible();
  await expect(page.getByText('/title: changed')).toBeVisible();
  const comparison = page.locator(
    'section[aria-labelledby="history-compare-title"]',
  );
  await expect(comparison).toContainText(`Before hash: ${'b'.repeat(64)}`);
  await expect(comparison).toContainText(`After hash: ${'c'.repeat(64)}`);
  expect(new URL(page.url()).searchParams.get('compareRevisionId')).toBe(
    '40000000-0000-4000-8000-000000000001',
  );
  const axe = await new AxeBuilder({ page }).analyze();
  expect(
    axe.violations.filter(
      ({ impact }) => impact === 'serious' || impact === 'critical',
    ),
  ).toEqual([]);
});

test('CMS-07 rejects stale cursors and non-owned entries without leaking summaries', async ({
  context,
  page,
}) => {
  await authenticateLocalSession(context);
  const stale = await page.goto(`${PATH}?cursor=stale`);
  expect(stale?.status()).toBe(409);
  await expect(
    page.getByText('This history cursor is no longer valid.'),
  ).toBeVisible();
  await expect(page.getByText(/Revision 2 · submitted/)).toHaveCount(0);
  await page.getByRole('link', { name: 'Start from the first page' }).click();
  await expect(page.getByText(/Revision 2 · submitted/)).toBeVisible();

  const other = await page.goto(
    '/app/cms-content-modeling/entries/30000000-0000-4000-8000-000000000031/revisions',
  );
  expect(other?.status()).toBe(404);
  await expect(page.getByText('This entry is not available.')).toBeVisible();
  await expect(page.getByText(/Revision 2 · submitted/)).toHaveCount(0);
});

test('CMS-07 keeps a filtered history window, URL cursor, and list focus through native pagination', async ({
  context,
  page,
}) => {
  await authenticateLocalSession(context);
  const first = await page.goto(`${PATH}?limit=1&locale=en-US`);
  expect(first?.status()).toBe(200);
  await expect(page.getByText(/Revision 2 · submitted/)).toBeVisible();
  await expect(page.getByText(/Revision 1 · draft/)).toHaveCount(0);

  await expect(page.getByRole('link', { name: 'Next page' })).toBeVisible();
  await page.getByRole('link', { name: 'Next page' }).click();
  await expect(page.locator('#history-list-title')).toBeFocused();
  await expect(page.getByText(/Revision 1 · draft/)).toBeVisible();
  await expect(page.getByText(/Revision 2 · submitted/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Next page' })).toHaveCount(0);
  const query = new URL(page.url()).searchParams;
  expect(query.get('limit')).toBe('1');
  expect(query.get('locale')).toBe('en-US');
  expect(query.get('cursor')).toBeTruthy();
});

test('CMS-05 and CMS-07 preserve visible 403 denial and hidden 404 without draft or history values', async ({
  context,
  page,
}) => {
  await authenticateLocalSession(context);
  for (const suffix of ['', '/revisions']) {
    const visible = await page.goto(
      `/app/cms-content-modeling/entries/${VISIBLE_UNASSIGNED_ENTRY_ID}${suffix}`,
    );
    expect(visible?.status()).toBe(403);
    expect(visible?.headers()['cache-control']).toBe('no-store');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Access denied',
    );
    await expect(page.getByText('This entry is not available.')).toBeVisible();
    await expect(page.getByText(/Revision 2 · submitted/)).toHaveCount(0);
    // Wrangler's local ProxyWorker treats an abandoned in-flight subresource
    // during rapid navigation as a fatal "Network connection lost" error.
    await page.waitForLoadState('networkidle');

    const hidden = await page.goto(
      `/app/cms-content-modeling/entries/30000000-0000-4000-8000-000000000031${suffix}`,
    );
    expect(hidden?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Not found',
    );
    await expect(page.getByText('This entry is not available.')).toBeVisible();
    await page.waitForLoadState('networkidle');
  }
});
