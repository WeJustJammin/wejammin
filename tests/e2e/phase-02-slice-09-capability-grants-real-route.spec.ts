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

const GRANTS_TABLE = 'CMS capability grants';

/**
 * Enrols the owner, creates one grant through the real form, then reloads the
 * console at the requested viewport so every responsive clause below is read
 * from the production-built page at that width.
 */
const seedConsoleAt = async (
  browser: Parameters<typeof actor>[0],
  width: number,
  height: number,
): Promise<Page> => {
  const owner = await actor(browser, 'owner', newTestId());
  const page = owner.page;
  await enrollFactorViaUi(page, 'Owner phone');
  await openConsole(page);
  await grantViaUi(page);
  await expect(page.getByRole('table', { name: GRANTS_TABLE })).toContainText(
    'Active',
    { timeout: 15_000 },
  );
  await page.setViewportSize({ width, height });
  await openConsole(page);
  return page;
};

const rect = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        width: box.width,
      };
    });

const GRANT_ROW = 'tbody tr[data-grant-id]';

test.describe('[P2-S09-AC-1036] mobile grant console at 375 px', () => {
  const open = (browser: Parameters<typeof actor>[0]) =>
    seedConsoleAt(browser, 375, 700);

  test('[P2-S09-AC-1036] shows capability, state and valid-through on each row and keeps the other facts out of view', async ({
    browser,
  }) => {
    const page = await open(browser);
    const row = page.locator(GRANT_ROW).first();
    await expect(row.locator('[data-capability-cell]')).toBeVisible();
    await expect(row.locator('[data-state-cell]')).toBeVisible();
    await expect(row.locator('[data-term-cell]')).toBeVisible();
    await expect(row.locator('[data-state-cell]')).toContainText('Active');
    await expect(row.locator('[data-term-cell]')).toContainText(
      `Valid through ${isoDate(30)}`,
    );
    await expect(row.locator('[data-person-cell]')).toBeHidden();
    await expect(row.locator('[data-updated-cell]')).toBeHidden();
  });

  test('[P2-S09-AC-1036] orders the visible row cells capability, then state, then valid-through, one per line', async ({
    browser,
  }) => {
    const page = await open(browser);
    const row = page.locator(GRANT_ROW).first();
    const tops = await row
      .locator('[data-capability-cell], [data-state-cell], [data-term-cell]')
      .evaluateAll((cells) =>
        cells.map((cell) => ({
          key: Object.keys((cell as HTMLElement).dataset)[0],
          top: cell.getBoundingClientRect().top,
        })),
      );
    expect(tops.map((cell) => cell.key)).toEqual([
      'capabilityCell',
      'stateCell',
      'termCell',
    ]);
    expect(tops[0]!.top).toBeLessThan(tops[1]!.top);
    expect(tops[1]!.top).toBeLessThan(tops[2]!.top);
  });

  test('[P2-S09-AC-1036] expands the person and last-updated facts from a labelled row toggle and collapses them again', async ({
    browser,
  }) => {
    const page = await open(browser);
    const row = page.locator(GRANT_ROW).first();
    const toggle = row.getByRole('button', {
      name: /^Show details for View schema registry grant ending /u,
    });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    const hide = row.getByRole('button', {
      name: /^Hide details for View schema registry grant ending /u,
    });
    await expect(hide).toHaveAttribute('aria-expanded', 'true');
    await expect(row.locator('[data-person-cell]')).toBeVisible();
    await expect(row.locator('[data-person-cell]')).toContainText(
      lanePersonId('reader'),
    );
    await expect(row.locator('[data-updated-cell]')).toBeVisible();
    await hide.click();
    await expect(row.locator('[data-person-cell]')).toBeHidden();
    await expect(row.locator('[data-updated-cell]')).toBeHidden();
  });

  test('[P2-S09-AC-1036] lays the grant form out as one column of full-width stacked controls below the list', async ({
    browser,
  }) => {
    const page = await open(browser);
    const table = await rect(page, 'table');
    const form = await rect(page, '#cms-grant-form');
    expect(form.top).toBeGreaterThanOrEqual(table.bottom - 1);
    const controls = await page
      .locator(
        '#cms-grant-form input:not([type=hidden]), #cms-grant-form select, #cms-grant-form textarea',
      )
      .evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return { left: box.left, top: box.top, bottom: box.bottom };
        }),
      );
    expect(controls.length).toBeGreaterThanOrEqual(4);
    for (const control of controls)
      expect(Math.abs(control.left - controls[0]!.left)).toBeLessThanOrEqual(1);
    for (let index = 1; index < controls.length; index += 1)
      expect(controls[index]!.top).toBeGreaterThanOrEqual(
        controls[index - 1]!.bottom - 1,
      );
  });

  test('[P2-S09-AC-1036] opens revoke confirmation as its own review block below the row, committed only after acknowledgement', async ({
    browser,
  }) => {
    const page = await open(browser);
    const row = page.locator(GRANT_ROW).first();
    await row.getByRole('button', { name: /^Revoke View schema/u }).click();
    const review = page.locator('tr[data-row-form]');
    await expect(
      review.getByRole('heading', { name: 'Confirm revoke' }),
    ).toBeVisible();
    await expect(review.locator('[data-capability-cell]')).toHaveCount(0);
    const rowBox = await rect(page, GRANT_ROW);
    const reviewBox = await rect(page, 'tr[data-row-form]');
    expect(reviewBox.top).toBeGreaterThanOrEqual(rowBox.bottom - 1);
    expect(reviewBox.width).toBeGreaterThanOrEqual(375 - 40);
    await expect(
      review.getByRole('button', { name: /^Revoke grant/u }),
    ).toBeDisabled();
    await review
      .getByRole('checkbox', {
        name: 'I understand this revokes access immediately.',
      })
      .check();
    await expect(
      review.getByRole('button', { name: /^Revoke grant/u }),
    ).toBeEnabled();
  });

  test('[P2-S09-AC-1036] gives every main-region control a 44 px hit area and never scrolls the page sideways', async ({
    browser,
  }) => {
    const page = await open(browser);
    await page
      .locator(GRANT_ROW)
      .first()
      .getByRole('button', { name: /^Show details for/u })
      .click();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    expect(await smallControls(page, 'main', 44)).toEqual([]);
  });
});

// FE03 breakpoints: mobile is <= 768 px and tablet starts at 769 px.
test.describe('[P2-S09-AC-1037] tablet grant console at 769 px', () => {
  const open = (browser: Parameters<typeof actor>[0]) =>
    seedConsoleAt(browser, 769, 1000);

  test('[P2-S09-AC-1037] renders the grants as a captioned table with a visible header row', async ({
    browser,
  }) => {
    const page = await open(browser);
    const table = page.getByRole('table', { name: GRANTS_TABLE });
    await expect(table.locator('caption')).toBeVisible();
    for (const name of [
      'Capability',
      'Person ID',
      'State',
      'Valid through',
      'Last updated',
      'Actions',
    ])
      await expect(table.getByRole('columnheader', { name })).toBeVisible();
  });

  test('[P2-S09-AC-1037] shows person and last-updated cells without a facts toggle', async ({
    browser,
  }) => {
    const page = await open(browser);
    const row = page.locator(GRANT_ROW).first();
    await expect(row.locator('[data-person-cell]')).toBeVisible();
    await expect(row.locator('[data-updated-cell]')).toBeVisible();
    await expect(row.locator('[data-facts-toggle]')).toBeHidden();
  });

  test('[P2-S09-AC-1037] expands renew as a detail row directly under the grant row, spanning the table width', async ({
    browser,
  }) => {
    const page = await open(browser);
    const row = page.locator(GRANT_ROW).first();
    await row.getByRole('button', { name: /^Renew View schema/u }).click();
    const detail = page.locator('tr[data-row-form]');
    await expect(detail).toHaveCount(1);
    await expect(
      detail.getByRole('group', { name: 'Renew View schema registry grant' }),
    ).toBeVisible();
    const sibling = await row.evaluate((element) =>
      element.nextElementSibling?.hasAttribute('data-row-form'),
    );
    expect(sibling).toBe(true);
    const table = await rect(page, 'table');
    const detailBox = await rect(page, 'tr[data-row-form]');
    expect(Math.abs(detailBox.width - table.width)).toBeLessThanOrEqual(2);
  });

  test('[P2-S09-AC-1037] places the grant form below the table, not beside it', async ({
    browser,
  }) => {
    const page = await open(browser);
    const table = await rect(page, 'table');
    const form = await rect(page, '#cms-grant-form');
    expect(form.top).toBeGreaterThanOrEqual(table.bottom - 1);
  });

  test('[P2-S09-AC-1037] keeps the page free of sideways scroll with 24 px targets', async ({
    browser,
  }) => {
    const page = await open(browser);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    expect(await smallControls(page, 'main', 24)).toEqual([]);
  });
});

test.describe('[P2-S09-AC-1038] desktop grant console at 1280 px', () => {
  const open = (browser: Parameters<typeof actor>[0]) =>
    seedConsoleAt(browser, 1280, 900);

  test('[P2-S09-AC-1038] puts the compact table and the grant form side by side', async ({
    browser,
  }) => {
    const page = await open(browser);
    const table = await rect(page, 'table');
    const form = await rect(page, '#cms-grant-form');
    expect(form.left).toBeGreaterThanOrEqual(table.right - 1);
    expect(Math.abs(form.top - table.top)).toBeLessThanOrEqual(120);
  });

  test('[P2-S09-AC-1038] makes valid-through and last-updated sortable headers and sorts ascending then descending', async ({
    browser,
  }) => {
    const page = await open(browser);
    const validThrough = page.getByRole('columnheader', {
      name: 'Valid through',
    });
    const updated = page.getByRole('columnheader', { name: 'Last updated' });
    await expect(validThrough.getByRole('button')).toBeVisible();
    await expect(updated.getByRole('button')).toBeVisible();
    await expect(updated).toHaveAttribute('aria-sort', 'descending');
    await validThrough.getByRole('button').click();
    await expect(validThrough).toHaveAttribute('aria-sort', 'ascending');
    await validThrough.getByRole('button').click();
    await expect(validThrough).toHaveAttribute('aria-sort', 'descending');
  });

  test('[P2-S09-AC-1038] opens renew inline on the row, in the table', async ({
    browser,
  }) => {
    const page = await open(browser);
    const row = page.locator(GRANT_ROW).first();
    await row.getByRole('button', { name: /^Renew View schema/u }).click();
    const detail = page.locator('tr[data-row-form]');
    await expect(
      detail.getByRole('group', { name: 'Renew View schema registry grant' }),
    ).toBeVisible();
    expect(
      await row.evaluate((element) =>
        element.nextElementSibling?.hasAttribute('data-row-form'),
      ),
    ).toBe(true);
    expect(
      await detail.evaluate((element) => element.closest('table') !== null),
    ).toBe(true);
  });

  test('[P2-S09-AC-1038] opens revoke inline on the row, in the table', async ({
    browser,
  }) => {
    const page = await open(browser);
    const row = page.locator(GRANT_ROW).first();
    await row.getByRole('button', { name: /^Revoke View schema/u }).click();
    const detail = page.locator('tr[data-row-form]');
    await expect(
      detail.getByRole('heading', { name: 'Confirm revoke' }),
    ).toBeVisible();
    expect(
      await row.evaluate((element) =>
        element.nextElementSibling?.hasAttribute('data-row-form'),
      ),
    ).toBe(true);
    expect(
      await detail.evaluate((element) => element.closest('table') !== null),
    ).toBe(true);
  });

  test('[P2-S09-AC-1038] keeps the page free of sideways scroll with 24 px targets', async ({
    browser,
  }) => {
    const page = await open(browser);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    expect(await smallControls(page, 'main', 24)).toEqual([]);
  });
});
