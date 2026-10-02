import { expect, test, type Page } from '@playwright/test';

import { authenticateLocalSession as authenticate } from './support/local-signed-session';

const APP_ROUTE = '/app/cms-content-modeling';

type BrowserVitals = Readonly<{
  lcpMs: number | null;
  cls: number;
  inpMs: number | null;
  longTaskCount: number;
  longTaskWindowStartedAtMs: number | null;
  observers: Readonly<{
    lcp: boolean;
    cls: boolean;
    event: boolean;
    longtask: boolean;
  }>;
}>;

const installVitalsObserver = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const vitals: {
      lcpMs: number | null;
      cls: number;
      inpMs: number | null;
      longTaskCount: number;
      longTaskWindowStartedAtMs: number | null;
      observers: {
        lcp: boolean;
        cls: boolean;
        event: boolean;
        longtask: boolean;
      };
    } = {
      lcpMs: null,
      cls: 0,
      inpMs: null,
      longTaskCount: 0,
      longTaskWindowStartedAtMs: null,
      observers: { lcp: false, cls: false, event: false, longtask: false },
    };
    Reflect.set(globalThis, '__s09RealRouteVitals', vitals);

    try {
      new PerformanceObserver((list) => {
        const latest = list.getEntries().at(-1);
        if (latest !== undefined) vitals.lcpMs = latest.startTime;
      }).observe({ buffered: true, type: 'largest-contentful-paint' });
      vitals.observers.lcp = true;
    } catch {
      // Keep unsupported browser capabilities explicit in the test result.
    }

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            hadRecentInput?: boolean;
            value?: number;
          };
          if (shift.hadRecentInput !== true && typeof shift.value === 'number')
            vitals.cls += shift.value;
        }
      }).observe({ buffered: true, type: 'layout-shift' });
      vitals.observers.cls = true;
    } catch {
      // Keep unsupported browser capabilities explicit in the test result.
    }

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if ('interactionId' in entry && entry.duration > 0)
            vitals.inpMs =
              vitals.inpMs === null
                ? entry.duration
                : Math.max(vitals.inpMs, entry.duration);
        }
      }).observe({ buffered: true, durationThreshold: 0, type: 'event' });
      vitals.observers.event = true;
    } catch {
      // Keep unsupported browser capabilities explicit in the test result.
    }

    try {
      new PerformanceObserver((list) => {
        const windowStartedAtMs = vitals.longTaskWindowStartedAtMs;
        if (windowStartedAtMs === null) return;
        vitals.longTaskCount += list
          .getEntries()
          .filter((entry) => entry.startTime >= windowStartedAtMs).length;
      }).observe({ buffered: true, type: 'longtask' });
      vitals.observers.longtask = true;
    } catch {
      // Keep unsupported browser capabilities explicit in the test result.
    }
  });
};

const gotoRegistry = async (
  page: Page,
  path = APP_ROUTE,
): Promise<import('@playwright/test').Response | null> => {
  let response = await page.goto(path, { waitUntil: 'networkidle' });
  if (response?.status() !== 503) return response;
  await expect
    .poll(
      async () => {
        response = await page.goto(path, { waitUntil: 'networkidle' });
        return response?.status() ?? 0;
      },
      { timeout: 5_000, intervals: [100, 250, 500] },
    )
    .toBe(200);
  return response;
};

test('[P2-S09-AC-262] measures the real production-built route workload', async ({
  context,
  page,
}) => {
  await authenticate(context);
  // Prime one-time local Workerd route initialization without populating the
  // browser cache. The measured navigation still fetches production assets.
  const warmupResponse = await page.request.get(APP_ROUTE);
  expect(warmupResponse.status()).toBe(200);
  await installVitalsObserver(page);

  const response = await gotoRegistry(page);
  expect(response).not.toBeNull();
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Content schema registry' }),
  ).toBeVisible();
  await expect(
    page.getByRole('table').getByText('article', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(100);
  await expect(
    page.locator('[data-workbench="content-schema-registry"]'),
  ).toHaveAttribute('data-role-policy', 'server-authoritative');
  await expect(page.locator('body')).not.toContainText(
    'temporarily unavailable',
  );
  await expect(
    page.locator('[data-workbench="content-schema-registry"]'),
  ).toHaveAttribute('data-content-schema-registry-hydrated', 'true', {
    timeout: 10_000,
  });

  await page.evaluate(() => {
    const vitals = Reflect.get(
      globalThis,
      '__s09RealRouteVitals',
    ) as BrowserVitals;
    Reflect.set(vitals, 'longTaskWindowStartedAtMs', performance.now());
  });
  await page.getByRole('link', { name: 'Skip to main content' }).click();
  await expect(page.locator('#content-schema-registry-main')).toBeFocused();
  await page.waitForFunction(
    () => {
      const vitals = Reflect.get(
        globalThis,
        '__s09RealRouteVitals',
      ) as BrowserVitals;
      return vitals.lcpMs !== null && vitals.inpMs !== null;
    },
    undefined,
    { timeout: 2_000 },
  );
  const vitals = await page.evaluate(
    () => Reflect.get(globalThis, '__s09RealRouteVitals') as BrowserVitals,
  );
  expect(vitals.observers).toEqual({
    lcp: true,
    cls: true,
    event: true,
    longtask: true,
  });
  expect(vitals.lcpMs).not.toBeNull();
  expect(vitals.inpMs).not.toBeNull();
  if (vitals.lcpMs === null || vitals.inpMs === null)
    throw new Error('LCP and INP observers must report non-null measurements');
  expect(vitals.lcpMs).toBeLessThan(2_500);
  expect(vitals.inpMs).toBeLessThan(200);
  expect(vitals.cls).toBeLessThan(0.1);
  expect(vitals.longTaskCount).toBe(0);
});

test('[P2-S09-AC-265] exercises real server-authorized list, detail, and sign-in flows', async ({
  context,
  page,
}) => {
  const unauthenticated = await page.goto(APP_ROUTE, {
    waitUntil: 'domcontentloaded',
  });
  expect(unauthenticated).not.toBeNull();
  expect(page.url()).toContain(
    '/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling',
  );

  await context.clearCookies();
  await authenticate(context);
  const listResponse = await gotoRegistry(page);
  expect(listResponse?.status()).toBe(200);
  const workbench = page.locator('[data-workbench="content-schema-registry"]');
  await expect(workbench).toHaveAttribute('data-variant', 'ownerFull');
  await expect(workbench).toHaveAttribute('data-access', 'full');
  await expect(page.getByRole('table')).toBeVisible();
  const detailLinks = page
    .locator('a[href*="/versions/"]')
    .filter({ hasText: 'View details' });
  await expect(detailLinks).toHaveCount(2);
  const detailLink = detailLinks.first();
  await expect(detailLink).toHaveCount(1);

  const detailPath = await detailLink.getAttribute('href');
  expect(detailPath).toMatch(
    /\/app\/cms-content-modeling\/[^/]+\/versions\/[^/]+$/u,
  );
  const detailResponse = await gotoRegistry(page, detailPath as string);
  expect(detailResponse?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Article', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('title', { exact: true })).toBeVisible();
  await expect(
    page.locator('[data-workbench="content-schema-registry"]'),
  ).toHaveAttribute('data-role-policy', 'server-authoritative');
  await expect(
    page.locator(
      'section[aria-labelledby="content-schema-registry-fields-heading"] li',
    ),
  ).toHaveCount(128);
});

test('[P2-S09-AC-265] rejects a forged access token on the real route', async ({
  context,
  page,
}) => {
  await authenticate(context, { forged: true });
  await page.goto(APP_ROUTE, { waitUntil: 'domcontentloaded' });
  expect(page.url()).toContain(
    '/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling',
  );
  await expect(
    page.locator('[data-workbench="content-schema-registry"]'),
  ).toHaveCount(0);
});

test('[P2-S09-AC-265] rejects an expired signed access token on the real route', async ({
  context,
  page,
}) => {
  await authenticate(context, {
    expiresAt: Math.floor(Date.now() / 1_000) - 1,
  });
  await page.goto(APP_ROUTE, { waitUntil: 'domcontentloaded' });
  expect(page.url()).toContain(
    '/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling',
  );
  await expect(
    page.locator('[data-workbench="content-schema-registry"]'),
  ).toHaveCount(0);
});

test('[P2-S09-AC-265] rejects a revoked signed session on the real route', async ({
  context,
  page,
}) => {
  const sessionId = '80000000-0000-4000-8000-000000000099';
  await authenticate(context, { sessionId });
  const revokeResponse = await page.request.post('/_s09/revoke', {
    data: { sessionId },
  });
  expect(revokeResponse.status()).toBe(200);
  await page.goto(APP_ROUTE, { waitUntil: 'domcontentloaded' });
  expect(page.url()).toContain(
    '/auth/sign-in?returnTo=%2Fapp%2Fcms-content-modeling',
  );
  await expect(
    page.locator('[data-workbench="content-schema-registry"]'),
  ).toHaveCount(0);
});
