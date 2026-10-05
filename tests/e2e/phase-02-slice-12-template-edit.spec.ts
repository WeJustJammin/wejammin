import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Phase 2 Slice 12 protected template edit', () => {
  test('a malformed template key is a no-store, accessible 404 without disclosure', async ({
    page,
  }) => {
    const response = await page.goto(
      '/app/cms-content-modeling/templates/not_a_valid_key',
      { waitUntil: 'domcontentloaded' },
    );
    expect(response?.status()).toBe(404);
    expect(response?.headers()['cache-control']).toBe('no-store');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Not found',
    );
    await expect(page.getByRole('main')).not.toContainText('not_a_valid_key');
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter(
        ({ impact }) => impact === 'serious' || impact === 'critical',
      ),
    ).toEqual([]);
  });

  test('without validated protected projections, a valid key does not fabricate an editable draft', async ({
    page,
  }) => {
    const response = await page.goto(
      '/app/cms-content-modeling/templates/release-note',
      { waitUntil: 'domcontentloaded' },
    );
    expect([502, 503]).toContain(response?.status());
    expect(response?.headers()['cache-control']).toBe('no-store');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Edit template draft',
    );
    await expect(page.getByRole('main')).toContainText('Designer unavailable');
    await expect(page.getByRole('main').locator('form')).toHaveCount(0);
  });
});
