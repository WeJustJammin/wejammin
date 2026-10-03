import { expect, test, type Browser, type Page } from '@playwright/test';

import { closeLaneContexts, newTestId } from './support/s09-lane-browser';
import {
  REGISTRY,
  columnEdges,
  createTypeViaUi,
  enrollFactorViaUi,
  horizontalOverflow,
  labelsAbove,
  readWorkerJson,
  smallControls,
  versionApiPath,
  waitForWorkbench,
  type CreatedVersion,
} from './support/s09-lane-flows';
import { actor } from './support/s09-lane-scenarios';

/**
 * FE03 Responsive Behavior for the registry route (P2-S09-AC-245 tablet and
 * P2-S09-AC-246 desktop), read from computed layout on the production-built
 * Astro routes in Google Chrome at 769, 1024, 1025 and 1440 px (and 1920 px
 * for the 1440 px maximum). Every record is created through the real form and
 * Worker routes; persistence is the loopback stateful lane, so this is not
 * database or hosted evidence.
 */

test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' });

test.afterEach(closeLaneContexts);

const SIDEBAR = 'aside[aria-label="Registry sidebar"]';
const NAV = `${SIDEBAR} nav[aria-label="Registry section links"]`;
const GRID = '.content-schema-registry-grid';
const ROOT = '.content-schema-registry';
const FORMS = '.content-schema-registry-command-stack';

type Seeded = Readonly<{ page: Page; created: CreatedVersion }>;

const seed = async (browser: Browser): Promise<Seeded> => {
  const owner = await actor(browser, 'owner', newTestId());
  await enrollFactorViaUi(owner.page, 'Owner phone');
  const created = await createTypeViaUi(owner.page);
  return { page: owner.page, created };
};

const openAt = async (
  page: Page,
  path: string,
  width: number,
  height = 900,
): Promise<void> => {
  await page.setViewportSize({ width, height });
  await page.goto(path, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  await page.waitForTimeout(300);
};

type GridMetrics = Readonly<{
  columns: number;
  gutter: string;
  marginStart: string;
  marginEnd: string;
  rootWidth: number;
  gridWidth: number;
}>;

const gridMetrics = (page: Page): Promise<GridMetrics> =>
  page.evaluate(
    ([rootSelector, gridSelector]) => {
      const root = document.querySelector<HTMLElement>(rootSelector as string);
      const grid = document.querySelector<HTMLElement>(gridSelector as string);
      if (root === null || grid === null) throw new Error('no registry grid');
      const rootStyle = getComputedStyle(root);
      const gridStyle = getComputedStyle(grid);
      return {
        // Computed grid-template-columns resolves to one pixel track per column.
        columns: gridStyle.gridTemplateColumns.split(' ').length,
        gutter: gridStyle.columnGap,
        marginStart: rootStyle.paddingLeft,
        marginEnd: rootStyle.paddingRight,
        rootWidth: root.getBoundingClientRect().width,
        gridWidth: grid.getBoundingClientRect().width,
      };
    },
    [ROOT, GRID],
  );

const sidebarState = (page: Page) =>
  page.evaluate(
    ([sidebarSelector, navSelector]) => {
      const visible = (selector: string): boolean => {
        const element = document.querySelector<HTMLElement>(selector);
        if (element === null) return false;
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          box.width > 0 &&
          box.height > 0
        );
      };
      const toggle = document.querySelector<HTMLElement>(
        `${sidebarSelector as string} button`,
      );
      return {
        sidebar: visible(sidebarSelector as string),
        nav: visible(navSelector as string),
        toggle: visible(`${sidebarSelector as string} button`),
        expanded: toggle?.getAttribute('aria-expanded') ?? null,
        collapsedAttr:
          document
            .querySelector(sidebarSelector as string)
            ?.getAttribute('data-collapsed') ?? null,
      };
    },
    [SIDEBAR, NAV],
  );

const TABLET_WIDTHS = [769, 1024] as const;
const DESKTOP_WIDTHS = [1025, 1440] as const;

test('[P2-S09-AC-245] the registry list and version routes use 8 columns, a 20 px gutter and 24 px margins at 769 and 1024 px', async ({
  browser,
}) => {
  const { page, created } = await seed(browser);
  for (const path of [REGISTRY, created.path]) {
    for (const width of TABLET_WIDTHS) {
      await openAt(page, path, width);
      const metrics = await gridMetrics(page);
      const label = `${path} at ${String(width)} px`;
      expect(metrics.columns, `${label} columns`).toBe(8);
      expect(metrics.gutter, `${label} gutter`).toBe('20px');
      expect(metrics.marginStart, `${label} start margin`).toBe('24px');
      expect(metrics.marginEnd, `${label} end margin`).toBe('24px');
      expect(await horizontalOverflow(page), label).toBeLessThanOrEqual(1);
      expect(await smallControls(page, 'main', 24), label).toEqual([]);
    }
  }
});

test('[P2-S09-AC-245] the tablet sidebar is a keyboard-operable disclosure that collapses, expands, returns focus and is remembered', async ({
  browser,
}) => {
  const { page, created } = await seed(browser);
  await openAt(page, created.path, 769);

  const toggle = page.locator(`${SIDEBAR} button`);
  await expect(toggle).toHaveAccessibleName('Registry sections');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toHaveAttribute(
    'aria-controls',
    'content-schema-registry-sidebar-nav',
  );
  await expect(page.locator(NAV)).toBeVisible();
  const expandedGrid = (await gridMetrics(page)).gridWidth;

  // Enter collapses; focus stays on the toggle; the grid takes the freed width.
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator(NAV)).toBeHidden();
  await expect(toggle).toBeFocused();
  const collapsedGrid = (await gridMetrics(page)).gridWidth;
  expect(collapsedGrid).toBeGreaterThan(expandedGrid + 100);
  expect((await gridMetrics(page)).columns).toBe(8);

  // Space expands again; the first link is the next Tab stop.
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator(NAV)).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.locator(`${NAV} a`).first()).toBeFocused();

  // Escape inside the open navigation collapses it and returns focus.
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();

  // The choice is remembered for the tab across a full page load.
  await page.reload({ waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator(NAV)).toBeHidden();
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
});

test('[P2-S09-AC-245] the sidebar is absent at 768 px and persistent without a toggle from 1025 px, even after a tablet collapse', async ({
  browser,
}) => {
  const { page, created } = await seed(browser);
  await openAt(page, created.path, 769);
  await page.locator(`${SIDEBAR} button`).click();
  await expect(page.locator(NAV)).toBeHidden();

  await page.setViewportSize({ width: 768, height: 900 });
  expect((await sidebarState(page)).sidebar).toBe(false);

  for (const width of DESKTOP_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    const state = await sidebarState(page);
    expect(state.sidebar, `sidebar at ${String(width)}`).toBe(true);
    expect(state.nav, `navigation at ${String(width)}`).toBe(true);
    expect(state.toggle, `toggle at ${String(width)}`).toBe(false);
  }
});

test('[P2-S09-AC-245] two columns are used only for independent fields and labels stay above their controls at 769 and 1024 px', async ({
  browser,
}) => {
  const { page, created } = await seed(browser);
  for (const width of TABLET_WIDTHS) {
    await openAt(page, created.path, width);
    const label = `${String(width)} px`;
    expect(
      new Set(await columnEdges(page, FORMS)).size,
      `${label} field columns`,
    ).toBeLessThanOrEqual(2);
    expect(await labelsAbove(page, FORMS), `${label} labels`).toEqual([]);
    expect(await smallControls(page, 'main', 24), label).toEqual([]);
  }
});

test('[P2-S09-AC-246] the registry route uses 12 columns, a 24 px gutter and a 1440 px maximum from 1025 px', async ({
  browser,
}) => {
  const { page, created } = await seed(browser);
  for (const path of [REGISTRY, created.path]) {
    for (const width of [...DESKTOP_WIDTHS, 1920]) {
      await openAt(page, path, width);
      const metrics = await gridMetrics(page);
      const label = `${path} at ${String(width)} px`;
      expect(metrics.columns, `${label} columns`).toBe(12);
      expect(metrics.gutter, `${label} gutter`).toBe('24px');
      expect(metrics.marginStart, `${label} start margin`).toBe('24px');
      expect(metrics.marginEnd, `${label} end margin`).toBe('24px');
      expect(metrics.rootWidth, `${label} maximum`).toBeLessThanOrEqual(1440);
      expect(await horizontalOverflow(page), label).toBeLessThanOrEqual(1);
    }
  }
  await openAt(page, REGISTRY, 1920);
  expect((await gridMetrics(page)).rootWidth).toBeCloseTo(1440, 0);
});

test('[P2-S09-AC-246] the registry list and detail form a stable side-by-side split from 1025 px', async ({
  browser,
}) => {
  const { page } = await seed(browser);
  for (const width of [1025, 1440]) {
    await openAt(page, REGISTRY, width);
    const boxes = await page.evaluate(() => {
      const rect = (selector: string) => {
        const box = document.querySelector(selector)?.getBoundingClientRect();
        return box === undefined
          ? null
          : { x: box.x, y: box.y, width: box.width, right: box.right };
      };
      return {
        list: rect('.content-schema-registry-list-column'),
        detail: rect('.content-schema-registry-detail'),
      };
    });
    expect(boxes.list, `${String(width)} list`).not.toBeNull();
    expect(boxes.detail, `${String(width)} detail`).not.toBeNull();
    if (boxes.list === null || boxes.detail === null) continue;
    expect(boxes.detail.x).toBeGreaterThanOrEqual(boxes.list.right);
    expect(Math.abs(boxes.detail.y - boxes.list.y)).toBeLessThan(2);
  }
});

test('[P2-S09-AC-246] the version detail owns its heading and an action rail citing context, version and the server-permitted next actions', async ({
  browser,
}) => {
  const { page, created } = await seed(browser);
  const api = await readWorkerJson(page, versionApiPath(created));
  const resource = api.resource as { version: string };
  const permitted = (
    api.activationPreparation as { permittedNextActions: string[] }
  ).permittedNextActions;

  for (const width of [1025, 1280, 1440]) {
    await openAt(page, created.path, width);
    const label = `${String(width)} px`;
    const detail = page.locator('.content-schema-registry-detail');
    const rail = detail.locator('aside[aria-label="Version actions"]');
    await expect(rail).toBeVisible();
    // The detail, not the route chrome, owns the heading the rail belongs to.
    await expect(detail.locator('h3')).toHaveCount(1);
    await expect(rail.locator('h1, h2, h3')).toHaveCount(0);
    await expect(rail).toContainText('Context:');
    await expect(rail).toContainText(`Version cited: ${resource.version}`);
    // Exactly the server's permitted actions; the rail adds no authority.
    await expect(rail.locator('li')).toHaveCount(permitted.length);

    const placement = await page.evaluate(() => {
      const box = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect() ?? null;
      const rail = box('.content-schema-registry-action-rail');
      const facts = box(
        '.content-schema-registry-detail .content-schema-registry-summary',
      );
      const heading = box('#content-schema-registry-detail-heading');
      if (rail === null || facts === null || heading === null)
        throw new Error('detail structure missing');
      return {
        railLeft: rail.left,
        railTop: rail.top,
        factsRight: facts.right,
        headingBottom: heading.bottom,
      };
    });
    // A rail sits beside the body, to its right, below the heading.
    expect(
      placement.railLeft,
      `${label} rail beside body`,
    ).toBeGreaterThanOrEqual(placement.factsRight - 1);
    expect(
      placement.railTop,
      `${label} rail below heading`,
    ).toBeGreaterThanOrEqual(placement.headingBottom - 1);
    expect(await horizontalOverflow(page), label).toBeLessThanOrEqual(1);
  }
});

test('[P2-S09-AC-245] below the rail breakpoint the action rail stacks between the heading and the facts at 769 px', async ({
  browser,
}) => {
  const { page, created } = await seed(browser);
  await openAt(page, created.path, 769);
  const order = await page.evaluate(() => {
    const top = (selector: string) =>
      document.querySelector(selector)?.getBoundingClientRect().top ?? null;
    return {
      heading: top('#content-schema-registry-detail-heading'),
      rail: top('.content-schema-registry-action-rail'),
      facts: top(
        '.content-schema-registry-detail .content-schema-registry-summary',
      ),
    };
  });
  expect(order.heading).not.toBeNull();
  expect(order.rail ?? 0).toBeGreaterThan(order.heading ?? 0);
  expect(order.facts ?? 0).toBeGreaterThan(order.rail ?? 0);
});
