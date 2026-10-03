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

const checkResetFormAtWidth = async (
  browser: Parameters<typeof actor>[0],
  width: number,
  height: number,
): Promise<void> => {
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
};

test('[P2-S09-AC-1126] the reset form at 320 px has 44 px targets, persistent labels and one column', async ({
  browser,
}) => {
  await checkResetFormAtWidth(browser, 320, 700);
});

test('[P2-S09-AC-1126] the reset form at 768 px has 44 px targets, persistent labels and one column', async ({
  browser,
}) => {
  await checkResetFormAtWidth(browser, 768, 1000);
});

test('[P2-S09-AC-1126] the reset form at 1280 px has 44 px targets, persistent labels and one column', async ({
  browser,
}) => {
  await checkResetFormAtWidth(browser, 1280, 900);
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

const SELF_TARGET =
  'You cannot reset your own two-step verification. Ask another administrator.';

// P2-S09-AC-1122, branch one: the real CFG-05B-06 Worker route refuses a
// self-target with 422 MFA_RESET_INVALID (and no field details), and the real
// form shows the self-target copy.
test('[P2-S09-AC-1122] a self-target answers 422 MFA_RESET_INVALID from the real Worker and the form shows the self-target copy', async ({
  browser,
}) => {
  const admin = await actor(browser, 'admin', newTestId());
  const page = admin.page;
  await enrollFactorViaUi(page, 'Admin phone');
  await openReset(page);
  await page
    .getByRole('textbox', { name: 'Person ID' })
    .fill(lanePersonId('admin'));
  await page
    .getByRole('textbox', { name: 'Reason' })
    .fill('Resetting my own factors by mistake.');
  await page.getByRole('button', { name: 'Review reset' }).click();
  await expect(
    page.getByRole('heading', { name: 'Confirm reset' }),
  ).toBeFocused();
  const refusal = page.waitForResponse(
    (candidate) => candidate.request().method() === 'POST',
    { timeout: 15_000 },
  );
  await page.getByRole('button', { name: 'Reset factors' }).click();
  const response = await refusal;
  expect(response.status()).toBe(422);
  const body = (await response.json()) as {
    code: string;
    details: Record<string, unknown>;
  };
  expect(body.code).toBe('MFA_RESET_INVALID');
  expect(body.details.violations).toBeUndefined();
  await expect(page.getByText(SELF_TARGET)).toBeVisible();
  // Self-targeting is not a field problem: no field error is rendered.
  await expect(
    page.getByRole('alert').filter({ has: page.getByRole('link') }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('textbox', { name: 'Person ID' }),
  ).not.toHaveAttribute('aria-invalid', 'true');
});

// P2-S09-AC-1122, branch two: a schema-invalid request. The form never sends
// one, so the browser's request is altered in flight to carry a malformed
// person ID; the answer is the real Worker route's own refusal, and the form
// maps it to field errors from the schema, not to the self-target copy.
test('[P2-S09-AC-1122] a schema-invalid request is refused by the real Worker with field details and the form shows field errors, not the self-target copy', async ({
  browser,
}) => {
  const admin = await actor(browser, 'admin', newTestId());
  const page = admin.page;
  await enrollFactorViaUi(page, 'Admin phone');
  await openReset(page);
  await page.route('**/api/v1/admin/identity/mfa-factor-resets', (route) =>
    route.continue({
      postData: JSON.stringify({
        targetPersonId: 'not-a-person-id',
        reason: 'Altered in flight.',
      }),
    }),
  );
  await page
    .getByRole('textbox', { name: 'Person ID' })
    .fill(lanePersonId('reader'));
  await page
    .getByRole('textbox', { name: 'Reason' })
    .fill('Lost every authenticator; identity checked by phone.');
  await page.getByRole('button', { name: 'Review reset' }).click();
  await expect(
    page.getByRole('heading', { name: 'Confirm reset' }),
  ).toBeFocused();
  const refusal = page.waitForResponse(
    (candidate) => candidate.request().method() === 'POST',
    { timeout: 15_000 },
  );
  await page.getByRole('button', { name: 'Reset factors' }).click();
  const response = await refusal;
  expect([400, 422]).toContain(response.status());
  const body = (await response.json()) as {
    code: string;
    details: { violations?: { path: string }[] };
  };
  expect(body.code).not.toBe('MFA_RESET_INVALID');
  expect(body.details.violations?.map((violation) => violation.path)).toContain(
    '/targetPersonId',
  );
  await expect(page.getByText(SELF_TARGET)).toHaveCount(0);
  await expect(
    page
      .getByText(
        'Enter the 36-character person ID, for example from the admin directory.',
      )
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Person ID' }),
  ).toHaveAttribute('aria-invalid', 'true');
  await expect(
    page.getByRole('alert').getByRole('link').first(),
  ).toHaveAttribute('href', '#admin-mfa-reset-person');
});

const ADMIN_INDEX = '/app/platform-configuration-admin';
const SECTIONS = 'nav[aria-label="Platform configuration sections"]';

// P2-S09-AC-1108 on the production-built routes: the reset is a section of the
// admin workbench that only an actor whose server projection holds
// admin.identity.mfa_reset is shown. Every other actor sees no navigation entry
// and a direct request gets the bare disclosure-safe 404.
test('[P2-S09-AC-1108] the admin sees the reset entry in the workbench sections and follows it to the form', async ({
  browser,
}) => {
  const admin = await actor(browser, 'admin', newTestId());
  const page = admin.page;
  await enrollFactorViaUi(page, 'Admin phone');
  await page.goto(ADMIN_INDEX, { waitUntil: 'networkidle' });
  const entry = page
    .locator(SECTIONS)
    .getByRole('link', { name: 'Reset two-step verification' });
  await expect(entry).toBeVisible();
  await expect(entry).toHaveAttribute(
    'href',
    '/app/platform-configuration-admin/mfa-reset',
  );
  await entry.click();
  await page.waitForURL(/\/mfa-reset$/u);
  await expect(page.getByRole('textbox', { name: 'Person ID' })).toBeVisible();
});

test('[P2-S09-AC-1108] an actor without the capability sees no entry and a direct request answers the bare 404', async ({
  browser,
}) => {
  const owner = await actor(browser, 'owner', newTestId());
  const page = owner.page;
  await enrollFactorViaUi(page, 'Owner phone');
  await page.goto(ADMIN_INDEX, { waitUntil: 'networkidle' });
  await expect(
    page.locator(SECTIONS).getByRole('link', { name: 'Task inbox' }),
  ).toBeVisible();
  await expect(
    page.locator(SECTIONS).getByRole('link', {
      name: 'Reset two-step verification',
    }),
  ).toHaveCount(0);
  await expect(page.locator('a[href$="/mfa-reset"]')).toHaveCount(0);
  const direct = await page.request.get(RESET, { maxRedirects: 0 });
  expect(direct.status()).toBe(404);
  expect(await direct.text()).toBe('Not found');
});
