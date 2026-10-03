import { expect, test, type Page } from '@playwright/test';

import { newTestId, closeLaneContexts } from './support/s09-lane-browser';
import { lanePersonId } from './support/s09-lane-ids';
import {
  columnEdges,
  enrollFactorViaUi,
  horizontalOverflow,
  smallControls,
} from './support/s09-lane-flows';
import { actor } from './support/s09-lane-scenarios';

/**
 * Slice 09 admin MFA factor reset (/app/platform-configuration-admin/mfa-reset)
 * on the production-built Astro route in Google Chrome. The reset is produced
 * through the real form and the real CFG-05B-06 Worker route; the persistence
 * port is the loopback stateful lane, so this is not database or hosted
 * evidence.
 */

test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' });

test.afterEach(closeLaneContexts);

const RESET = '/app/platform-configuration-admin/mfa-reset';

const openReset = async (page: Page): Promise<void> => {
  await page.goto(RESET, { waitUntil: 'networkidle' });
  await expect(page.getByRole('textbox', { name: 'Person ID' })).toBeVisible();
  // The island must be live before values are typed into its controlled fields.
  await page.waitForTimeout(500);
};

for (const [width, height] of [
  [320, 700],
  [768, 1000],
  [1280, 900],
] as const)
  test(`[P2-S09-AC-1126] the reset form at ${String(width)} px has 44 px targets, persistent labels and one column`, async ({
    browser,
  }) => {
    const admin = await actor(browser, 'admin', newTestId());
    const page = admin.page;
    await enrollFactorViaUi(page, 'Admin phone');
    await page.setViewportSize({ width, height });
    await openReset(page);

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    expect(await smallControls(page, 'main', 44)).toEqual([]);
    // Persistent labels: both fields have a visible label that stays in place.
    for (const name of ['Person ID', 'Reason']) {
      const field = page.getByRole('textbox', { name });
      await expect(field).toBeVisible();
      const label = await field.evaluate((element) => {
        const labelElement = (element as HTMLInputElement).labels?.[0];
        return labelElement === undefined
          ? null
          : {
              visible: labelElement.getBoundingClientRect().height > 0,
              above:
                labelElement.getBoundingClientRect().bottom <=
                element.getBoundingClientRect().top + 1,
            };
      });
      expect(label).toEqual({ visible: true, above: true });
    }
    // One column: every field shares the same left edge at every width.
    const edges = await columnEdges(page, 'main form');
    expect(new Set(edges).size).toBe(1);
    // Helper text and the live character count are linked to the field.
    const describedBy = await page
      .getByRole('textbox', { name: 'Reason' })
      .getAttribute('aria-describedby');
    expect(describedBy ?? '').not.toBe('');
  });

test('[P2-S09-AC-1126] the admin resets another person through the real form: linked error summary, confirmation focus, Escape cancel, then the reset', async ({
  browser,
}) => {
  const testId = newTestId();
  const reader = await actor(browser, 'reader', testId);
  await enrollFactorViaUi(reader.page, 'Reader phone');

  const admin = await actor(browser, 'admin', testId);
  const page = admin.page;
  await enrollFactorViaUi(page, 'Admin phone');
  await openReset(page);

  // Empty submit: a linked error summary moves focus to the first invalid field.
  await page.getByRole('button', { name: 'Review reset' }).click();
  const summary = page
    .getByRole('alert')
    .filter({ has: page.getByRole('link') });
  await expect(summary).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Person ID' })).toBeFocused();
  const target = await summary.getByRole('link').first().getAttribute('href');
  expect(target).toBe('#admin-mfa-reset-person');

  await page
    .getByRole('textbox', { name: 'Person ID' })
    .fill(lanePersonId('reader'));
  await page
    .getByRole('textbox', { name: 'Reason' })
    .fill('Lost every authenticator; identity checked by phone.');
  await page.getByRole('button', { name: 'Review reset' }).click();
  const heading = page.getByRole('heading', { name: 'Confirm reset' });
  await expect(heading).toBeFocused();

  // Escape cancels before commit and returns to the draft.
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Review reset' }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Person ID' })).toHaveValue(
    lanePersonId('reader'),
  );

  await page.getByRole('button', { name: 'Review reset' }).click();
  await expect(heading).toBeFocused();
  // Confirmation controls meet the 44 px target before the commit.
  expect(await smallControls(page, 'main', 44)).toEqual([]);
  await page.getByRole('button', { name: 'Reset factors' }).click();
  await expect(
    page.getByRole('heading', { name: 'Reset complete' }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Authenticators removed: 1.')).toBeVisible();

  // The reader's authenticators are gone (observed through the reader's own page).
  await reader.page.goto('/settings/security/mfa', {
    waitUntil: 'networkidle',
  });
  await expect(
    reader.page.getByText('No authenticator is set up.'),
  ).toBeVisible({ timeout: 15_000 });
});
