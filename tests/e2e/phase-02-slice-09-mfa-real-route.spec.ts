import { expect, test, type Page } from '@playwright/test';

import { newTestId, closeLaneContexts } from './support/s09-lane-browser';
import {
  WORKER_ORIGIN,
  awaitIslandsHydrated,
  completeStepUpViaUi,
  enrollFactorViaUi,
  expireStepUp,
  horizontalOverflow,
  readManualKey,
  smallControls,
} from './support/s09-lane-flows';
import { totpCode } from './support/s09-lane-totp';
import { actor } from './support/s09-lane-scenarios';

/**
 * Slice 09 /step-up and /settings/security/mfa on the production-built Astro
 * routes in Google Chrome: computed-layout assertions at the stated widths,
 * target-size measurements, real Tab/Shift+Tab traversal and the factor table
 * with a reconciling row. Persistence and the identity provider are the
 * loopback stateful lane (test TOTP seam), so this is not hosted evidence.
 */

test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' });

test.afterEach(closeLaneContexts);

const MFA = '/settings/security/mfa';
const STEP_UP = '/step-up?returnTo=%2Fapp%2Fcms-content-modeling';

const settle = async (page: Page, path: string): Promise<void> => {
  await page.goto(path, { waitUntil: 'networkidle' });
  await awaitIslandsHydrated(page);
  await page.waitForTimeout(400);
};

/** Open the enrollment wizard to the QR step (islands hydrate asynchronously). */
const openQrStep = async (page: Page, name: string): Promise<void> => {
  await settle(page, MFA);
  const nameField = page.getByRole('textbox', { name: 'Authenticator name' });
  await expect(async () => {
    await page
      .getByRole('button', {
        name: /Set up an authenticator|Add another authenticator/u,
      })
      .click();
    await expect(nameField).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await nameField.fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();
  await readManualKey(page);
};

type Box = Readonly<{
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
}>;
const box = (page: Page, selector: string): Promise<Box> =>
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
        width: rect.width,
      };
    });

const KEY = 'main code';

type Direction = 'forward' | 'backward';

/**
 * Real Tab / Shift+Tab traversal. Forward starts from the page heading (the
 * route-load focus target) and records every stop inside `scope` until focus
 * leaves it; backward starts from the last stop of the forward pass. Each stop
 * records its element and whether a visible focus ring is computed.
 */
const traverse = async (
  page: Page,
  scope: string,
  direction: Direction,
  limit = 40,
): Promise<string[]> => {
  const key = direction === 'forward' ? 'Tab' : 'Shift+Tab';
  const stops: string[] = [];
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press(key);
    const stop = await page.evaluate((selector) => {
      const element = document.activeElement as HTMLElement | null;
      if (element === null || element === document.body) return null;
      if (element.closest(selector) === null)
        return { inside: false, label: '' };
      const style = getComputedStyle(element);
      const ring =
        (style.outlineStyle !== 'none' &&
          Number.parseFloat(style.outlineWidth) > 0) ||
        style.boxShadow !== 'none'
          ? 'ring'
          : 'none';
      return {
        inside: true,
        label: `${element.tagName.toLowerCase()}:${(element.getAttribute('aria-label') ?? element.innerText ?? element.getAttribute('name') ?? '').trim().slice(0, 40)}:${ring}`,
      };
    }, scope);
    if (stop === null || !stop.inside) break;
    stops.push(stop.label);
  }
  return stops;
};

test('[P2-S09-AC-1104] /step-up and /settings/security/mfa controls meet the 44 px mobile and 24 px desktop target sizes with real Tab traversal', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  await enrollFactorViaUi(page, 'Owner phone');
  await expireStepUp(page, testId, 'owner');

  for (const [width, height, minimum] of [
    [375, 800, 44],
    [1280, 900, 24],
  ] as const) {
    await page.setViewportSize({ width, height });
    await settle(page, STEP_UP);
    await expect(
      page.getByRole('heading', { level: 1, name: "Verify it's you" }),
    ).toBeVisible();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    expect(
      await smallControls(page, 'main', minimum),
      `/step-up at ${String(width)}`,
    ).toEqual([]);
    // Real Tab / Shift+Tab from the page heading: the code field, Verify and the
    // recovery link are reachable in order with a visible focus indicator, and
    // Shift+Tab retraces the same stops: no trap.
    await page.getByRole('heading', { level: 1 }).focus();
    const forward = await traverse(page, 'main', 'forward');
    expect(forward.map((entry) => entry.split(':')[0])).toEqual([
      'input',
      'button',
      'a',
    ]);
    for (const stop of forward) expect(stop.endsWith(':ring'), stop).toBe(true);
    const backward = await traverse(page, 'main', 'backward');
    expect(backward.slice(0, 3).map((entry) => entry.split(':')[0])).toEqual([
      'a',
      'button',
      'input',
    ]);

    await settle(page, MFA);
    await expect(
      page.getByRole('table', { name: 'Your authenticators' }),
    ).toContainText('Owner phone');
    expect(
      await smallControls(page, 'main', minimum),
      `/settings/security/mfa at ${String(width)}`,
    ).toEqual([]);
  }
});

test('[P2-S09-AC-1105] enrollment at 375 px is one column with the QR above the key and field, a full-width field and 44 px buttons clear of the virtual keyboard', async ({
  browser,
}) => {
  const owner = await actor(browser, 'owner', newTestId());
  const page = owner.page;
  await page.setViewportSize({ width: 375, height: 800 });
  await openQrStep(page, 'Phone');

  const qr = await box(page, 'main .mfa-qr');
  const key = await box(page, KEY);
  const field = await box(
    page,
    'main input[name], main input[type="text"], main input[inputmode]',
  );
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  // One column: QR, then key, then the code field, each starting below the last.
  expect(key.top).toBeGreaterThanOrEqual(qr.bottom - 1);
  const code = page.getByRole('textbox', { name: '6-digit code from the app' });
  const codeBox = await code.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top,
      left: rect.left,
      right: rect.right,
      width: rect.width,
    };
  });
  expect(codeBox.top).toBeGreaterThanOrEqual(key.bottom - 1);
  void field;
  // Full-width: the field spans its form (within 1 px of the form's content box).
  const formWidth = await code.evaluate((element) => {
    const form = element.closest('form') as HTMLElement;
    const style = getComputedStyle(form);
    return (
      form.getBoundingClientRect().width -
      Number.parseFloat(style.paddingLeft) -
      Number.parseFloat(style.paddingRight)
    );
  });
  expect(codeBox.width).toBeGreaterThanOrEqual(formWidth - 1);
  expect(await smallControls(page, 'main', 44)).toEqual([]);

  // Virtual keyboard open: the viewport loses roughly half its height. Focus the
  // field; the actions must be reachable (not fixed under the keyboard).
  await page.setViewportSize({ width: 375, height: 380 });
  await code.focus();
  await code.scrollIntoViewIfNeeded();
  const verify = page.getByRole('button', { name: 'Verify and finish' });
  await verify.scrollIntoViewIfNeeded();
  const positions = await page.evaluate(() => {
    const out: string[] = [];
    for (const label of ['Verify and finish', 'Cancel setup']) {
      let element: HTMLElement | null =
        [...document.querySelectorAll<HTMLElement>('main button')].find(
          (button) => (button.textContent ?? '').trim() === label,
        ) ?? null;
      while (element !== null && element !== document.body) {
        out.push(getComputedStyle(element).position);
        element = element.parentElement;
      }
    }
    return out;
  });
  expect(
    positions.filter(
      (position) => position === 'fixed' || position === 'sticky',
    ),
  ).toEqual([]);
  const inView = await verify.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  });
  expect(inView).toBe(true);
  await code.focus();
  await expect(code).toBeFocused();
});

test('[P2-S09-AC-1106] enrollment at 768 px places the QR and the manual key side by side', async ({
  browser,
}) => {
  const owner = await actor(browser, 'owner', newTestId());
  const page = owner.page;
  await page.setViewportSize({ width: 768, height: 1000 });
  await openQrStep(page, 'Phone');
  const qr = await box(page, 'main .mfa-qr');
  const key = await box(page, KEY);
  expect(key.left).toBeGreaterThanOrEqual(qr.right - 1);
  // Vertical ranges overlap: they are on the same row, not stacked.
  expect(key.top).toBeLessThan(qr.bottom);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  expect(await smallControls(page, 'main', 24)).toEqual([]);
});

test('[P2-S09-AC-1107] enrollment at 1280 px is two columns with a compact factor table and at 320 px reflows with no horizontal page scroll', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  await enrollFactorViaUi(page, 'Owner phone');

  await page.setViewportSize({ width: 1280, height: 900 });
  await openQrStep(page, 'Backup phone');
  const qr = await box(page, 'main .mfa-qr');
  const steps = await box(page, 'main form');
  expect(steps.left).toBeGreaterThanOrEqual(qr.right - 1);
  const table = page.getByRole('table', { name: 'Your authenticators' });
  await expect(table).toBeVisible();
  const tableDisplay = await table.evaluate(
    (element) => getComputedStyle(element).display,
  );
  expect(tableDisplay).toBe('table');
  await expect(table.getByRole('columnheader')).toHaveCount(5);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 320, height: 700 });
  await settle(page, MFA);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  await openQrStep(page, 'Third phone');
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  const qr320 = await box(page, 'main .mfa-qr');
  expect(qr320.right).toBeLessThanOrEqual(320 + 1);
  expect(qr320.left).toBeGreaterThanOrEqual(-1);
});

test('[P2-S09-AC-1071] /settings/security/mfa at 375 px collapses the table to a priority list and a reconciling row keeps Checking status and its refresh control', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  await enrollFactorViaUi(page, 'Owner phone');
  await openQrStep(page, 'Work phone');
  // Finish the second factor normally.
  const secondSecret = await readManualKey(page);
  await page
    .getByRole('textbox', { name: '6-digit code from the app' })
    .fill(await totpCode(secondSecret, Date.now()));
  await page.getByRole('button', { name: 'Verify and finish' }).click();
  await expect(page.getByRole('table')).toContainText('Work phone', {
    timeout: 15_000,
  });

  // The third enrollment's verification times out at the provider: the real
  // service marks the factor as reconciling instead of guessing.
  const armed = await page.request.post(
    `${WORKER_ORIGIN}/_s09/lane/ambiguous-verify`,
    { data: { testId } },
  );
  expect(armed.status()).toBe(200);
  await openQrStep(page, 'Spare phone');
  const thirdSecret = await readManualKey(page);
  await page
    .getByRole('textbox', { name: '6-digit code from the app' })
    .fill(await totpCode(thirdSecret, Date.now()));
  await page.getByRole('button', { name: 'Verify and finish' }).click();

  await page.setViewportSize({ width: 375, height: 800 });
  await settle(page, MFA);
  const table = page.getByRole('table', { name: 'Your authenticators' });
  await expect(table).toContainText('Owner phone');
  await expect(table).toContainText('Work phone');
  const reconcilingRow = table
    .getByRole('row')
    .filter({ hasText: 'Spare phone' });
  await expect(reconcilingRow).toContainText('Checking status');
  await expect(
    reconcilingRow.getByRole('button', { name: /Refresh status/u }),
  ).toBeVisible();

  // Priority list: rows and cells are blocks, the header is visually removed,
  // and nothing scrolls horizontally.
  const layout = await table.evaluate((element) => {
    const tr = element.querySelector('tbody tr') as HTMLElement;
    const th = element.querySelector('thead') as HTMLElement;
    const head = th.getBoundingClientRect();
    return {
      table: getComputedStyle(element).display,
      row: getComputedStyle(tr).display,
      headerWidth: head.width,
      wrapScroll:
        (element.parentElement as HTMLElement).scrollWidth -
        (element.parentElement as HTMLElement).clientWidth,
    };
  });
  expect(layout.table).toBe('block');
  expect(layout.row).toBe('block');
  expect(layout.headerWidth).toBeLessThanOrEqual(1);
  expect(layout.wrapScroll).toBeLessThanOrEqual(1);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  expect(await smallControls(page, 'main', 44)).toEqual([]);

  // The refresh control re-reads the registry and the row keeps its status.
  const reads: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'GET' && request.url().includes('/mfa'))
      reads.push(request.url());
  });
  await reconcilingRow.getByRole('button', { name: /Refresh status/u }).click();
  await expect(reconcilingRow).toContainText('Checking status');
  await expect.poll(() => reads.length, { timeout: 10_000 }).toBeGreaterThan(0);
});

test('[P2-S09-AC-1104] the /step-up code field and Verify are keyboard-operable end to end', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  const secret = await enrollFactorViaUi(page, 'Owner phone');
  await expireStepUp(page, testId, 'owner');
  await settle(page, STEP_UP);
  await completeStepUpViaUi(page, secret, /\/app\/cms-content-modeling/u);
});
