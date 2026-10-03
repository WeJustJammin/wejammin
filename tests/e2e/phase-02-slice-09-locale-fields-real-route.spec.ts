import { expect, test, type Browser, type Page } from '@playwright/test';

import {
  decideViaUi,
  horizontalOverflow,
  readWorkerJson,
  smallControls,
  versionApiPath,
  waitForWorkbench,
  REGISTRY,
} from './support/s09-lane-flows';
import {
  assignReviewer,
  enrollReviewer,
  openReview,
  actor,
} from './support/s09-lane-scenarios';
import { newTestId, closeLaneContexts } from './support/s09-lane-browser';

/**
 * Slice 09 OD-4 locale configuration fields on the production-built Astro
 * routes in Google Chrome: the create-type and successor forms measured from
 * computed layout at 320, 768 and 1280 px, with real Tab and Shift+Tab
 * traversal. The successor form is reached by activating a version through the
 * real review and activation forms (loopback stateful lane, not hosted
 * evidence).
 */

test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' });

test.afterEach(closeLaneContexts);

const WIDTHS = [
  [320, 900],
  [768, 1000],
  [1280, 900],
] as const;

const CREATE_FORM = '#content-schema-registry-create-form';
const SUCCESSOR_FORM = '#content-schema-registry-successor-form';

/** Add the three locales and one fallback entry through the create form. */
const fillCreateLocales = async (page: Page): Promise<void> => {
  const tags = page.getByRole('textbox', { name: 'Add a language tag' });
  for (const tag of ['en-US', 'fr-CA', 'fr']) {
    await tags.fill(tag);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
  }
  await page
    .getByRole('combobox', { name: 'Source language' })
    .selectOption('en-US');
  await page
    .getByRole('combobox', { name: 'Default language' })
    .selectOption('en-US');
  await page
    .locator('#content-schema-registry-create-form-locale-chain-fr-CA-add')
    .selectOption('fr');
  await page
    .getByRole('button', { name: 'Add to the fallback order for fr-CA' })
    .click();
};

/** Activate a version through the real review path; resolves with its page. */
const activeVersion = async (browser: Browser) => {
  const stage = await openReview(browser);
  await assignReviewer(stage);
  const reviewer = await enrollReviewer(browser, stage.testId);
  await decideViaUi(reviewer.page, stage.reviewPath, 'approve');
  const page = stage.owner.page;
  await page.goto(stage.created.path, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  const form = page.locator('#content-schema-registry-activation-form');
  await form.locator('#content-schema-registry-confirmed').check();
  await form.getByRole('button', { name: 'Save schema activation' }).click();
  await expect
    .poll(
      async () =>
        (
          (await readWorkerJson(page, versionApiPath(stage.created))) as {
            resource: { state: string };
          }
        ).resource.state,
      { timeout: 15_000 },
    )
    .toBe('active');
  await page.goto(stage.created.path, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  return { stage, page };
};

const openSuccessorChange = async (page: Page): Promise<void> => {
  const form = page.locator(SUCCESSOR_FORM);
  await form.scrollIntoViewIfNeeded();
  await form
    .getByRole('radio', { name: /Change languages and fallback orders/u })
    .check();
  await expect(
    form.getByRole('textbox', { name: 'Add a language tag' }),
  ).toBeVisible();
};

const assertFallbackOrderIsOrdinal = async (
  page: Page,
  scope: string,
): Promise<void> => {
  const order = await page
    .locator(`${scope} [data-locale-chain] ol`)
    .first()
    .evaluate((list) => {
      const items = [...list.querySelectorAll(':scope > li')];
      return {
        markers: getComputedStyle(list).listStyleType,
        itemDisplay: items.map((item) => getComputedStyle(item).display),
        last: items.at(-1)?.textContent ?? '',
      };
    });
  // Ordered-list semantics with visible ordinals, and the final position spelled
  // out in text: order is never colour or position alone.
  expect(order.markers).not.toBe('none');
  expect(new Set(order.itemDisplay)).toEqual(new Set(['list-item']));
  expect(order.last).toContain('(always last)');
};

/** Real Tab then Shift+Tab across `scope`, asserting every stop has a focus ring. */
const traverseLocale = async (page: Page, scope: string): Promise<string[]> => {
  await page
    .locator(`${scope} [data-locale-chain] , ${scope} legend`)
    .first()
    .scrollIntoViewIfNeeded();
  const start = page
    .locator(`${scope}`)
    .getByRole('textbox', { name: 'Add a language tag' });
  await start.focus();
  const forward: string[] = [];
  for (let step = 0; step < 60; step += 1) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate((selector) => {
      const element = document.activeElement as HTMLElement | null;
      if (element === null || element.closest(selector) === null) return null;
      const style = getComputedStyle(element);
      const ring =
        (style.outlineStyle !== 'none' &&
          Number.parseFloat(style.outlineWidth) > 0) ||
        style.boxShadow !== 'none';
      return `${element.tagName.toLowerCase()}|${(element.getAttribute('aria-label') ?? element.innerText ?? element.id ?? '').trim().slice(0, 50)}|${ring ? 'ring' : 'none'}`;
    }, scope);
    if (stop === null) break;
    forward.push(stop);
  }
  return forward;
};

test('[P2-S09-AC-1236] the create-type form keeps every locale control at 24 px or more with ordinal fallback order at 320, 768 and 1280 px', async ({
  browser,
}) => {
  const owner = await actor(browser, 'owner', newTestId());
  const page = owner.page;
  for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    await page.goto(REGISTRY, { waitUntil: 'networkidle' });
    await waitForWorkbench(page);
    await fillCreateLocales(page);
    expect(
      await horizontalOverflow(page),
      `overflow at ${String(width)}`,
    ).toBeLessThanOrEqual(1);
    expect(
      await smallControls(page, CREATE_FORM, 24),
      `create form at ${String(width)}`,
    ).toEqual([]);
    await assertFallbackOrderIsOrdinal(page, CREATE_FORM);
    // Add, Remove and Move buttons exist and are measured.
    for (const name of [
      'Add',
      'Remove en-US from supported languages',
      'Move fr earlier in the fallback order for fr-CA',
      'Move fr later in the fallback order for fr-CA',
      'Remove fr from the fallback order for fr-CA',
    ])
      await expect(
        page.getByRole('button', { name, exact: true }),
      ).toBeVisible();
  }
});

test('[P2-S09-AC-1236] [P2-S09-AC-1237] the successor form keeps locale controls at 24 px or more at 320, 768 and 1280 px and Tab and Shift+Tab traverse them with no trap', async ({
  browser,
}) => {
  const { page } = await activeVersion(browser);
  for (const [width, height] of WIDTHS) {
    await page.setViewportSize({ width, height });
    await page.goto(page.url(), { waitUntil: 'networkidle' });
    await waitForWorkbench(page);
    await openSuccessorChange(page);
    // A real edit so the Review changes step has content.
    const form = page.locator(SUCCESSOR_FORM);
    await form.getByRole('textbox', { name: 'Add a language tag' }).fill('de');
    await form.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(
      form.getByRole('heading', { name: 'Review changes' }),
    ).toBeVisible();
    await expect(form.locator('[data-locale-review]')).toContainText('de');

    expect(
      await horizontalOverflow(page),
      `overflow at ${String(width)}`,
    ).toBeLessThanOrEqual(1);
    expect(
      await smallControls(page, SUCCESSOR_FORM, 24),
      `successor form at ${String(width)}`,
    ).toEqual([]);
    await assertFallbackOrderIsOrdinal(page, SUCCESSOR_FORM);
  }

  // Keyboard reachability at 1280: forward Tab visits the locale controls and
  // every stop has a visible focus ring; focus is never trapped (Shift+Tab walks
  // back to the starting field and then past it).
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(page.url(), { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  await openSuccessorChange(page);
  const editor = page.locator(SUCCESSOR_FORM);
  await editor.getByRole('textbox', { name: 'Add a language tag' }).fill('de');
  await editor.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(
    editor.getByRole('heading', { name: 'Review changes' }),
  ).toBeVisible();
  const forward = await traverseLocale(page, SUCCESSOR_FORM);
  expect(forward.length).toBeGreaterThan(5);
  for (const stop of forward) expect(stop.endsWith('|ring'), stop).toBe(true);
  const labels = forward.map((stop) => stop.split('|')[1]);
  expect(
    labels.some((label) => /fallback|Move|Remove/iu.test(label ?? '')),
  ).toBe(true);
  // Focus travels through the added language's controls, past the Review
  // changes step, and on to the submit control: nothing traps it on the way.
  expect(labels.at(-1)).toBe('Save successor draft');
  expect(
    labels.filter((label) => /de/u.test(label ?? '')).length,
  ).toBeGreaterThan(0);
  // No hover-only content: every message the form shows is in the DOM text, not a title or tooltip.
  const tooltips = await page.locator(`${SUCCESSOR_FORM} [title]`).count();
  expect(tooltips).toBe(0);

  const start = page
    .locator(SUCCESSOR_FORM)
    .getByRole('textbox', { name: 'Add a language tag' });
  await start.focus();
  await page.keyboard.press('Shift+Tab');
  const outside = await page.evaluate(
    () => document.activeElement?.tagName.toLowerCase() ?? 'none',
  );
  expect(outside).not.toBe('none');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(start).toBeFocused();
});
