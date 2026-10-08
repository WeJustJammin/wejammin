import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const entryId = '123e4567-e89b-42d3-a456-426614174000';
const root = '/app/cms-content-modeling/entries';

test.describe('Phase 2 Slice 10 protected revision history', () => {
  test('a malformed entry id is an accessible, no-store 400 invalid request without history disclosure', async ({
    page,
  }) => {
    const response = await page.goto(`${root}/not-a-uuid/revisions`, {
      waitUntil: 'domcontentloaded',
    });
    // DEC-145 / BE03b:172: a structurally malformed id is an invalid request,
    // never a not-found state.
    expect(response?.status()).toBe(400);
    expect(response?.headers()['cache-control']).toBe('no-store');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Invalid request',
    );
    await expect(page.getByRole('main')).toContainText(
      'This request could not be read.',
    );
    await expect(page.getByRole('main')).not.toContainText(entryId);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter(
        ({ impact }) => impact === 'serious' || impact === 'critical',
      ),
    ).toEqual([]);
  });

  test('without a verified service, a well-formed URL does not fabricate revision data', async ({
    page,
  }) => {
    const response = await page.goto(`${root}/${entryId}/revisions`, {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.status()).toBe(503);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Temporarily unavailable',
    );
    await expect(page.getByRole('main')).toContainText('Nothing was loaded');
    await expect(page.locator('main ol')).toHaveCount(0);
    await page.setViewportSize({ width: 320, height: 720 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
});
