import { expect, test, type Page } from '@playwright/test';

import { newTestId, closeLaneContexts } from './support/s09-lane-browser';
import { lanePersonId } from './support/s09-lane-ids';
import {
  REGISTRY,
  completeStepUpViaUi,
  enrollFactorViaUi,
  expireStepUp,
  horizontalOverflow,
  readWorkerJson,
  smallControls,
} from './support/s09-lane-flows';
import { actor } from './support/s09-lane-scenarios';

/**
 * Slice 09 CMS capability grant console on the production-built route in
 * Google Chrome: owner-only navigation and guard, grant / renew / revoke through
 * the real forms and Worker routes, the stale-proof step-up round trip, and the
 * responsive layouts. Persistence is the loopback stateful lane, so this is not
 * database, RLS or hosted evidence.
 */

test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' });

test.afterEach(closeLaneContexts);

const CONSOLE = `${REGISTRY}/capability-grants`;
const isoDate = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const grantForm = (page: Page) =>
  page.getByRole('group', { name: 'Grant a capability' });

const openConsole = async (page: Page, path = CONSOLE): Promise<void> => {
  await page.goto(path, { waitUntil: 'networkidle' });
  await expect(
    page.getByRole('heading', { level: 1, name: 'CMS access' }),
  ).toBeVisible();
  // The island must be live before values are typed into its controlled fields.
  await expect(
    page.locator('[data-workbench="cms-capability-grants"]'),
  ).toBeVisible();
  await page.waitForTimeout(400);
};

const grantViaUi = async (
  page: Page,
  options: Readonly<{
    person?: string;
    validThrough?: string;
    reason?: string;
  }> = {},
): Promise<void> => {
  const group = grantForm(page);
  await group
    .getByRole('textbox', { name: 'Person ID' })
    .fill(options.person ?? lanePersonId('reader'));
  await group
    .getByRole('combobox', { name: 'Capability' })
    .selectOption('cms.schema_registry.read');
  await group
    .getByRole('textbox', { name: 'Valid through (UTC)' })
    .fill(options.validThrough ?? isoDate(30));
  await group
    .getByRole('textbox', { name: 'Reason (optional)' })
    .fill(options.reason ?? 'New schema reader');
  await page.getByRole('button', { name: 'Grant capability' }).click();
};

test('[P2-S09-AC-1022] shows the CMS access navigation only to the owner and guards the console', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  await owner.page.goto(REGISTRY, { waitUntil: 'networkidle' });
  await expect(
    owner.page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'CMS access' }),
  ).toBeVisible();

  const designer = await actor(browser, 'designer', testId);
  await designer.page.goto(REGISTRY, { waitUntil: 'networkidle' });
  await expect(
    designer.page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'CMS access' }),
  ).toHaveCount(0);
  // A non-owner who types the address learns nothing: no console, no grants.
  const refused = await designer.page.goto(CONSOLE);
  expect([403, 404]).toContain(refused?.status());
  await expect(
    designer.page.getByRole('heading', { level: 1, name: 'CMS access' }),
  ).toHaveCount(0);

  // Unauthenticated: the allowlisted sign-in redirect carrying only the route.
  const anonymous = await browser.newContext({
    baseURL: 'http://127.0.0.1:4324',
  });
  const anonymousPage = await anonymous.newPage();
  await anonymousPage.goto(CONSOLE);
  expect(new URL(anonymousPage.url()).pathname).toBe('/auth/sign-in');
  expect(new URL(anonymousPage.url()).searchParams.get('returnTo')).toBe(
    CONSOLE,
  );
  await anonymous.close();
  await owner.context.close();
  await designer.context.close();
});

test('[P2-S09-AC-1042] [P2-S09-AC-1043] [P2-S09-AC-1044] the owner grants, renews and revokes a capability with specific action names', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  await enrollFactorViaUi(page, 'Owner phone');
  await openConsole(page);
  const urls: string[] = [];
  page.on('framenavigated', (frame) => urls.push(frame.url()));

  await grantViaUi(page);
  const table = page.getByRole('table', { name: 'CMS capability grants' });
  await expect(table).toContainText('cms.schema_registry.read', {
    timeout: 15_000,
  });
  await expect(table).toContainText('Active');
  const through = isoDate(30);
  // Specific accessible names on the row actions.
  const renew = page.getByRole('button', {
    name: `Renew View schema registry grant ending ${through}`,
  });
  const revoke = page.getByRole('button', {
    name: `Revoke View schema registry grant ending ${through}`,
  });
  await expect(renew).toBeVisible();
  await expect(revoke).toBeVisible();

  await renew.click();
  const renewalDate = isoDate(60);
  const row = page.getByRole('group', {
    name: 'Renew View schema registry grant',
  });
  await row
    .getByRole('textbox', { name: 'Valid through (UTC)' })
    .fill(renewalDate);
  await page.getByRole('button', { name: 'Renew grant' }).click();
  await expect(table).toContainText(renewalDate, { timeout: 15_000 });

  await page
    .getByRole('button', {
      name: `Revoke View schema registry grant ending ${renewalDate}`,
    })
    .click();
  // The revoke confirmation commits only after the explicit acknowledgement.
  const commit = page.getByRole('button', { name: /^Revoke grant/u });
  await expect(commit).toBeDisabled();
  await page
    .getByRole('checkbox', {
      name: 'I understand this revokes access immediately.',
    })
    .check();
  await commit.click();
  await expect(table).toContainText('Revoked', { timeout: 15_000 });

  const api = (await readWorkerJson(page, '/api/v1/cms/capability-grants')) as {
    items: {
      state: string;
      validThrough: string;
      lastAction: string;
      subjectPersonId: string;
    }[];
  };
  expect(api.items).toHaveLength(1);
  expect(api.items[0]).toMatchObject({
    state: 'revoked',
    lastAction: 'revoked',
    validThrough: renewalDate,
  });
  // Person identifiers stay inside the island: never in an address.
  for (const url of urls) expect(url).not.toContain(lanePersonId('reader'));
});

test('[P2-S09-AC-910] [P2-S09-AC-1026] [P2-S09-AC-1024] a stale proof sends the grant to /step-up?returnTo with the query and returns an empty form', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  const secret = await enrollFactorViaUi(page, 'Owner phone');

  const posts: string[] = [];
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url().includes('/capability-grants')
    )
      posts.push(request.url());
  });
  const path = `${CONSOLE}?capability=cms.author`;
  // The page loads while the proof is fresh; the proof then ages out before the
  // owner submits, so the Worker answers 401 STEP_UP_REQUIRED to the real form.
  await openConsole(page, path);
  await expireStepUp(page, testId, 'owner');
  await grantViaUi(page, { reason: 'Step-up round trip' });
  // FE03: the 401 shows the step-up disclosure and a Verify identity action
  // that navigates to the shared step-up page (no automatic redirect).
  const alert = page.getByRole('alert');
  await expect(alert).toContainText(
    'Verify your identity to change CMS access.',
    { timeout: 15_000 },
  );
  await alert.getByRole('link', { name: 'Verify identity' }).click();
  await page.waitForURL(/\/step-up\?returnTo=/u, { timeout: 15_000 });
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(path);
  expect(page.url()).not.toContain(lanePersonId('reader'));
  expect(posts).toHaveLength(1);

  await completeStepUpViaUi(
    page,
    secret,
    new RegExp(`${CONSOLE}\\?capability=cms\\.author`, 'u'),
  );
  await expect(
    page.getByRole('heading', { level: 1, name: 'CMS access' }),
  ).toBeVisible();
  await page.waitForTimeout(600);
  // The person identifier was discarded: the form returns empty, not persisted.
  await expect(
    grantForm(page).getByRole('textbox', { name: 'Person ID' }),
  ).toHaveValue('');
  expect(posts).toHaveLength(1);
});

for (const [width, height, minimum, label] of [
  [375, 700, 44, '[P2-S09-AC-1036]'],
  [768, 1000, 24, '[P2-S09-AC-1037]'],
  [1280, 900, 24, '[P2-S09-AC-1038]'],
] as const)
  test(`${label} the grant console lays out at ${String(width)} px with ${String(minimum)} px targets`, async ({
    browser,
  }) => {
    const testId = newTestId();
    const owner = await actor(browser, 'owner', testId);
    const page = owner.page;
    await enrollFactorViaUi(page, 'Owner phone');
    await openConsole(page);
    await grantViaUi(page);
    await expect(
      page.getByRole('table', { name: 'CMS capability grants' }),
    ).toContainText('Active', {
      timeout: 15_000,
    });
    await page.setViewportSize({ width, height });
    await openConsole(page);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    expect(await smallControls(page, 'main', minimum)).toEqual([]);

    const box = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((element) => {
          const rect = element.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
          };
        });
    const table = await box('table');
    const form = await box('#cms-grant-form');
    if (width === 375) {
      // Stacked priority rows: capability, state and valid-through per row, and
      // the form is one column below the list.
      expect(table.right).toBeLessThanOrEqual(width + 1);
      await expect(page.locator('tbody tr').first()).toContainText('Active');
      await expect(page.locator('tbody tr').first()).toContainText(
        'Valid through',
      );
      expect(form.top).toBeGreaterThanOrEqual(table.bottom - 1);
    } else if (width === 768) {
      // Tablet: the caption table keeps its row actions; the form sits below.
      await expect(
        page
          .getByRole('table', { name: 'CMS capability grants' })
          .locator('caption'),
      ).toBeVisible();
      expect(form.top).toBeGreaterThanOrEqual(table.bottom - 1);
    } else {
      // Desktop: compact semantic table with sortable headers beside the form.
      expect(form.left).toBeGreaterThanOrEqual(table.right - 1);
      await expect(
        page
          .getByRole('columnheader', { name: 'Valid through' })
          .getByRole('button'),
      ).toBeVisible();
      await page
        .getByRole('button', { name: /^Renew View schema registry grant/u })
        .click();
      const inline = await page
        .getByRole('group', { name: 'Renew View schema registry grant' })
        .evaluate((element) => element.closest('tr') !== null);
      expect(inline).toBe(true);
    }
  });
