import {
  expect,
  test,
  type CDPSession,
  type Page,
  type TestInfo,
} from '@playwright/test';

import { closeLaneContexts, newTestId } from './support/s09-lane-browser';
import {
  REGISTRY,
  enrollFactorViaUi,
  waitForWorkbench,
} from './support/s09-lane-flows';
import { actor, openReview, type Actor } from './support/s09-lane-scenarios';

/**
 * P2-S09-AC-262: Core Web Vitals and main-thread budgets measured in Google
 * Chrome on the production-built registry, schema-review and capability-grant
 * routes with the PerformanceObserver largest-contentful-paint, layout-shift,
 * event (Event Timing, INP) and longtask entry types.
 *
 * Throttling profile (fixed, applied through the Chrome DevTools Protocol to
 * the measured page only; the records are created before it is applied):
 *   - CPU: 4x slowdown (Lighthouse mobile reference).
 *   - Network: 1.6 Mbit/s down, 750 kbit/s up, 150 ms round trip (Lighthouse
 *     "slow 4G"), cache disabled.
 *   - Viewport: 412 by 823 CSS px at device scale factor 1, and 1280 by 900.
 *
 * Budgets: LCP < 2500 ms, INP < 200 ms, CLS < 0.1, and no long task (a task
 * over 50 ms) overlapping the input window. Persistence is the loopback
 * stateful lane, so this is not hosted evidence.
 */

test.use({ screenshot: 'off', trace: 'off' });

test.afterEach(closeLaneContexts);

const THROTTLE = {
  cpuSlowdown: 4,
  downloadBytesPerSecond: (1.6 * 1024 * 1024) / 8,
  uploadBytesPerSecond: (750 * 1024) / 8,
  latencyMs: 150,
} as const;

const VIEWPORTS = [
  { name: 'mobile', width: 412, height: 823 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;

type Vitals = Readonly<{
  lcpMs: number | null;
  cls: number;
  interactions: readonly Readonly<{
    durationMs: number;
    startMs: number;
    interactionId: number;
  }>[];
  longTasks: readonly Readonly<{ startMs: number; durationMs: number }>[];
  observers: Readonly<Record<'lcp' | 'cls' | 'event' | 'longtask', boolean>>;
  inputWindow: readonly [number, number] | null;
}>;

const observeVitals = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const vitals = {
      lcpMs: null as number | null,
      cls: 0,
      interactions: [] as {
        durationMs: number;
        startMs: number;
        interactionId: number;
      }[],
      longTasks: [] as { startMs: number; durationMs: number }[],
      observers: { lcp: false, cls: false, event: false, longtask: false },
      inputWindow: null as [number, number] | null,
    };
    Reflect.set(globalThis, '__s09Vitals', vitals);
    const observe = (
      key: keyof typeof vitals.observers,
      options: PerformanceObserverInit,
      handle: (entries: PerformanceEntryList) => void,
    ): void => {
      try {
        new PerformanceObserver((list) => handle(list.getEntries())).observe(
          options,
        );
        vitals.observers[key] = true;
      } catch {
        // An unsupported entry type stays recorded as unavailable; no
        // synthetic value is substituted for a metric the browser withheld.
      }
    };
    observe(
      'lcp',
      { type: 'largest-contentful-paint', buffered: true },
      (entries) => {
        const latest = entries.at(-1);
        if (latest !== undefined) vitals.lcpMs = latest.startTime;
      },
    );
    observe('cls', { type: 'layout-shift', buffered: true }, (entries) => {
      for (const entry of entries) {
        const shift = entry as PerformanceEntry & {
          hadRecentInput?: boolean;
          value?: number;
        };
        if (shift.hadRecentInput !== true) vitals.cls += shift.value ?? 0;
      }
    });
    observe(
      'event',
      { type: 'event', buffered: true, durationThreshold: 16 },
      (entries) => {
        for (const entry of entries) {
          const timing = entry as PerformanceEntry & { interactionId?: number };
          if ((timing.interactionId ?? 0) > 0)
            vitals.interactions.push({
              durationMs: entry.duration,
              startMs: entry.startTime,
              interactionId: timing.interactionId ?? 0,
            });
        }
      },
    );
    observe('longtask', { type: 'longtask', buffered: true }, (entries) => {
      for (const entry of entries)
        vitals.longTasks.push({
          startMs: entry.startTime,
          durationMs: entry.duration,
        });
    });
  });
};

const throttle = async (page: Page): Promise<CDPSession> => {
  const session = await page.context().newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.setCacheDisabled', { cacheDisabled: true });
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: THROTTLE.latencyMs,
    downloadThroughput: THROTTLE.downloadBytesPerSecond,
    uploadThroughput: THROTTLE.uploadBytesPerSecond,
  });
  await session.send('Emulation.setCPUThrottlingRate', {
    rate: THROTTLE.cpuSlowdown,
  });
  return session;
};

const TEXT_FIELD =
  'main input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="submit"]):not([type="button"]), main textarea';

/** Pointer then keyboard input on the route's first text control, without navigating. */
const exerciseInput = async (page: Page): Promise<void> => {
  const field = page.locator(TEXT_FIELD).first();
  await expect(
    field,
    'the route exposes a text control to exercise',
  ).toBeVisible();
  await field.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const vitals = Reflect.get(globalThis, '__s09Vitals') as {
      inputWindow: [number, number] | null;
    };
    vitals.inputWindow = [performance.now(), performance.now()];
  });
  await field.click();
  await page.keyboard.type('registry', { delay: 25 });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const vitals = Reflect.get(globalThis, '__s09Vitals') as {
      inputWindow: [number, number];
    };
    vitals.inputWindow[1] = performance.now();
  });
};

const measure = async (
  owner: Actor,
  path: string,
  viewport: (typeof VIEWPORTS)[number],
  testInfo: TestInfo,
  ready: (page: Page) => Promise<void>,
): Promise<Vitals> => {
  const page = await owner.context.newPage();
  await observeVitals(page);
  await throttle(page);
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height,
  });
  await page.goto(path, { waitUntil: 'networkidle' });
  await ready(page);
  // Let LCP settle before any input; INP is read from the input window only.
  await page.waitForTimeout(500);
  await exerciseInput(page);
  const vitals = await page.evaluate(
    () => Reflect.get(globalThis, '__s09Vitals') as Vitals,
  );
  await testInfo.attach(`vitals-${viewport.name}.json`, {
    body: JSON.stringify(
      { path, viewport, throttle: THROTTLE, vitals },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  return vitals;
};

const expectBudgets = (vitals: Vitals, label: string): void => {
  expect(vitals.observers, `${label} observers`).toEqual({
    lcp: true,
    cls: true,
    event: true,
    longtask: true,
  });
  expect(vitals.lcpMs, `${label} LCP recorded`).not.toBeNull();
  expect(vitals.lcpMs ?? Number.POSITIVE_INFINITY, `${label} LCP`).toBeLessThan(
    2_500,
  );
  expect(vitals.cls, `${label} CLS`).toBeLessThan(0.1);

  const window_ = vitals.inputWindow;
  expect(window_, `${label} input window`).not.toBeNull();
  const [from, to] = window_ ?? [0, 0];
  const inWindow = vitals.interactions.filter(
    (entry) => entry.startMs >= from - 50 && entry.startMs <= to,
  );
  expect(inWindow.length, `${label} recorded interactions`).toBeGreaterThan(0);
  expect(
    Math.max(...inWindow.map((entry) => entry.durationMs)),
    `${label} INP`,
  ).toBeLessThan(200);
  const longDuringInput = vitals.longTasks.filter(
    (task) => task.startMs + task.durationMs >= from && task.startMs <= to,
  );
  expect(longDuringInput, `${label} long tasks during input`).toEqual([]);
};

const grantsReady = async (page: Page): Promise<void> => {
  await expect(
    page.locator('[data-workbench="cms-capability-grants"]'),
  ).toBeVisible();
};

type Viewport = (typeof VIEWPORTS)[number];
const MOBILE: Viewport = VIEWPORTS[0];
const DESKTOP: Viewport = VIEWPORTS[1];

const registryBudgets = async (
  browser: Parameters<typeof actor>[0],
  testInfo: TestInfo,
  viewport: Viewport,
): Promise<void> => {
  const review = await openReview(browser);
  const vitals = await measure(
    review.owner,
    REGISTRY,
    viewport,
    testInfo,
    waitForWorkbench,
  );
  expectBudgets(vitals, `registry ${viewport.name}`);
};

const reviewBudgets = async (
  browser: Parameters<typeof actor>[0],
  testInfo: TestInfo,
  viewport: Viewport,
): Promise<void> => {
  const review = await openReview(browser);
  const vitals = await measure(
    review.owner,
    review.reviewPath,
    viewport,
    testInfo,
    waitForWorkbench,
  );
  expectBudgets(vitals, `review ${viewport.name}`);
};

const grantsBudgets = async (
  browser: Parameters<typeof actor>[0],
  testInfo: TestInfo,
  viewport: Viewport,
): Promise<void> => {
  const owner = await actor(browser, 'owner', newTestId());
  await enrollFactorViaUi(owner.page, 'Owner phone');
  const vitals = await measure(
    owner,
    `${REGISTRY}/capability-grants`,
    viewport,
    testInfo,
    grantsReady,
  );
  expectBudgets(vitals, `grants ${viewport.name}`);
};

test('[P2-S09-AC-262] the registry route meets the LCP, INP, CLS and long-task budgets on mobile', async ({
  browser,
}, testInfo) => {
  await registryBudgets(browser, testInfo, MOBILE);
});

test('[P2-S09-AC-262] the registry route meets the LCP, INP, CLS and long-task budgets on desktop', async ({
  browser,
}, testInfo) => {
  await registryBudgets(browser, testInfo, DESKTOP);
});

test('[P2-S09-AC-262] the schema-review route meets the LCP, INP, CLS and long-task budgets on mobile', async ({
  browser,
}, testInfo) => {
  await reviewBudgets(browser, testInfo, MOBILE);
});

test('[P2-S09-AC-262] the schema-review route meets the LCP, INP, CLS and long-task budgets on desktop', async ({
  browser,
}, testInfo) => {
  await reviewBudgets(browser, testInfo, DESKTOP);
});

test('[P2-S09-AC-262] the capability-grant route meets the LCP, INP, CLS and long-task budgets on mobile', async ({
  browser,
}, testInfo) => {
  await grantsBudgets(browser, testInfo, MOBILE);
});

test('[P2-S09-AC-262] the capability-grant route meets the LCP, INP, CLS and long-task budgets on desktop', async ({
  browser,
}, testInfo) => {
  await grantsBudgets(browser, testInfo, DESKTOP);
});
