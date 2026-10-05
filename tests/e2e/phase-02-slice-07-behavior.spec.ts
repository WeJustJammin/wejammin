import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { openReadOnlyPage, readOnlyCookie } from './support/config-sessions';

const APP_ROUTE = '/app/platform-configuration-admin';
const SESSION_COOKIE = {
  name: 'wj_access',
  value: 'slice-07-e2e-session',
  domain: '127.0.0.1',
  path: '/',
  httpOnly: true,
  secure: false,
  sameSite: 'Lax' as const,
};
const authenticate = async (context: BrowserContext): Promise<void> => {
  await context.addCookies([SESSION_COOKIE]);
};
const openConfiguration = async (
  page: Page,
  key = 'web.theme',
  suffix = '',
): Promise<void> => {
  await page.goto(`${APP_ROUTE}?key=${encodeURIComponent(key)}${suffix}`);
  await expect(page).toHaveURL(
    new RegExp(`${APP_ROUTE.replaceAll('/', '\\/')}`),
  );
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Platform configuration',
  );
};
test.describe('Phase 2 Slice 07 production browser behavior', () => {
  test.beforeEach(async ({ context }) => authenticate(context));

  test('[P2-S07-AC-096, P2-S07-AC-134, P2-S07-AC-141] server route owns URL state, landmarks, title, and focus', async ({
    page,
  }) => {
    await openConfiguration(
      page,
      'web.theme',
      '&query=runtime&tab=provenance&selected=018f0c45-73fe-7dc2-9c09-68f7ecf132d8',
    );
    await expect(page.locator('main')).toHaveCount(1);
    await expect(
      page.getByRole('navigation', { name: 'Primary navigation' }),
    ).toHaveCount(1);
    await expect(
      page.getByRole('link', { name: 'Platform configuration' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      page.getByRole('link', { name: 'Provenance' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveTitle(
      'Platform configuration (ready) | Platform configuration | WeJammin',
    );
    await page.evaluate(() => {
      document.dispatchEvent(new Event('astro:page-load'));
      document.dispatchEvent(new Event('astro:page-load'));
    });
    await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await skip.focus();
    await expect(skip).toBeFocused();
    await skip.press('Enter');
    await expect(page).toHaveURL(/#platform-configuration-main$/u);
  });

  test('[P2-S07-AC-099..P2-S07-AC-130, P2-S07-AC-151] URL roles never grant authority; trusted capabilities do', async ({
    page,
  }) => {
    test.slow();
    const roles =
      'free paid creator guardian junior business staff admin'.split(' ');
    await page.context().addCookies([readOnlyCookie]);
    for (const role of roles) {
      await openConfiguration(page, 'web.theme', `&role=${role}`);
      const workbench = page.locator(
        '[data-workbench="settings-flags-runtime"]',
      );
      await expect(workbench).toHaveAttribute('data-access', 'read-only');
      await expect(workbench).toHaveAttribute('data-variant', 'adminStepUp');
      await expect(page.locator('main')).toHaveAttribute(
        'data-capability-count',
        '1',
      );
      await expect(
        page.getByRole('button', { name: 'Save draft' }),
      ).toHaveCount(0);
    }

    await page.context().addCookies([SESSION_COOKIE]);
    await openConfiguration(page, 'web.theme', '&role=free');
    await expect(
      page.locator('[data-workbench="settings-flags-runtime"]'),
    ).toHaveAttribute('data-access', 'full');
    await expect(page.locator('main')).toHaveAttribute(
      'data-capability-count',
      '5',
    );
    await expect(
      page.getByRole('button', { name: 'Save draft' }).first(),
    ).toBeVisible();
  });

  test('[P2-S07-AC-097, P2-S07-AC-098] detail concealment and degraded reads remove protected content', async ({
    page,
  }) => {
    await openConfiguration(page, 'web.missing');
    await expect(
      page.getByRole('heading', { name: 'Access is limited' }),
    ).toBeVisible();
    await expect(
      page.locator('[data-workbench="settings-flags-runtime"]'),
    ).toHaveCount(0);

    await openConfiguration(page, 'web.rate-limited');
    await expect(
      page.locator('#platform-configuration-degraded-heading'),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Only the safe shell and verified public metadata remain visible.',
      ),
    ).toBeVisible();
    await expect(
      page.locator('[data-workbench="settings-flags-runtime"]'),
    ).toHaveAttribute('data-access', 'disabled');
    await expect(page.getByRole('button', { name: 'Save draft' })).toHaveCount(
      0,
    );
  });

  test('[P2-S07-AC-083, P2-S07-AC-091, P2-S07-AC-135, P2-S07-AC-138] filter and selection state are usable and restorable', async ({
    page,
  }) => {
    await openConfiguration(page);
    const ready = page.locator('[data-workbench="settings-flags-runtime"]');
    await expect(ready).toHaveAttribute('data-hydrated', 'true');
    const filter = page.getByRole('searchbox', {
      name: 'Search configuration',
    });
    await filter.fill('theme');
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await expect(page).toHaveURL(/query=theme/u);
    await expect(page.getByText('1 record shown')).toBeVisible();

    await page
      .getByRole('link', { name: 'web.theme', exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(
      /selected=018f0c45-73fe-7dc2-9c09-68f7ecf132d8/u,
    );
    await expect(
      page.getByRole('heading', { name: 'Selected configuration detail' }),
    ).toBeVisible();
    await expect(
      page.getByText('web.theme', { exact: true }).first(),
    ).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/query=theme/u);
    await expect(filter).toHaveValue('theme');

    await page.getByRole('button', { name: 'Reset filters' }).click();
    await expect(page).not.toHaveURL(/query=/u);
    await expect(filter).toHaveValue('');
  });

  test('[P2-S07-AC-136, P2-S07-AC-153, P2-S07-AC-158] invalid form input remains local and focuses linked errors', async ({
    page,
  }) => {
    await openConfiguration(page);
    await page.getByLabel('Typed value (JSON)').fill('{invalid-json');
    await page.getByLabel('Impact manifest (JSON)').fill('{}');
    await page.getByLabel('Rollback candidate (JSON, optional)').fill('null');
    await page.getByLabel('Effective from').fill('2026-09-03T10:00');
    await page
      .getByLabel('Consumer keys (comma-separated)')
      .fill('web.platform-configuration');
    await page.getByLabel('Reason').fill('Behavioral validation evidence');
    const proposalForm = page.locator(
      'form#platform-configuration-propose-change-form',
    );
    expect(
      await proposalForm.evaluate((form: HTMLFormElement) =>
        [...form.elements]
          .filter(
            (
              element,
            ): element is
              HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
              'validity' in element && !element.validity.valid,
          )
          .map((element) => `${element.name}:${element.validationMessage}`),
      ),
    ).toEqual([]);
    const [validationResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes('/api/v1/admin/settings/'),
      ),
      proposalForm.getByRole('button', { name: 'Save draft' }).click(),
    ]);
    const validationPayload = (await validationResponse.json()) as Record<
      string,
      unknown
    >;
    expect(validationPayload).toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Check the highlighted fields.',
      requestId: '018f0c45-73fe-7dc2-9c09-68f7ecf132db',
      details: {
        violations: [
          {
            path: '/typedValue',
            code: 'invalid_json',
            message: 'Enter valid JSON.',
          },
        ],
      },
    });
    expect(validationResponse.status()).toBe(422);

    const summary = page.locator('#platform-configuration-validation-summary');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('Check the highlighted fields');
    await expect(page.getByLabel('Typed value (JSON)')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(page.getByLabel('Typed value (JSON)')).toBeFocused();
  });

  test('[P2-S07-AC-154, P2-S07-AC-155] untrusted values use text bindings and authority secrets never serialize', async ({
    page,
  }) => {
    await openConfiguration(page, 'web.untrusted');
    await expect(
      page.locator('script:has-text("untrusted-value")'),
    ).toHaveCount(0);
    await expect(page.locator('[onerror], [onclick], [onload]')).toHaveCount(0);
    await expect(
      page.getByText('<script>untrusted-value</script>', { exact: true }),
    ).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain('slice-07-e2e-session');
    expect(html).not.toContain('wj_access');
    expect(
      await page.evaluate(() =>
        Reflect.get(window, '__untrustedValueExecuted'),
      ),
    ).toBeUndefined();
  });

  test('[P2-S07-AC-131..P2-S07-AC-133, P2-S07-AC-146..P2-S07-AC-150] reflows at locked breakpoints and 200 percent zoom', async ({
    page,
  }) => {
    for (const width of [320, 800, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await openConfiguration(page);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const minTarget = await page
        .getByRole('button', { name: 'Apply filters' })
        .evaluate((element) =>
          Math.min(
            element.getBoundingClientRect().width,
            element.getBoundingClientRect().height,
          ),
        );
      expect(minTarget).toBeGreaterThanOrEqual(44);
    }
    await page.setViewportSize({ width: 640, height: 800 });
    await openConfiguration(page);
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test('[P2-S07-AC-137, P2-S07-AC-172] reconnect, stale tabs, auth expiry, and outage recover safely', async ({
    browser,
    context,
    page,
  }) => {
    await openConfiguration(page);
    const second = await openReadOnlyPage(browser);
    await openConfiguration(second);
    await expect(second.locator('[data-access="read-only"]')).toBeVisible();
    await expect(page.locator('[data-access="full"]')).toBeVisible();
    await second.context().close();

    await context.setOffline(true);
    await expect(page.reload()).rejects.toThrow();
    await context.setOffline(false);
    await page.reload();
    await expect(page.locator('[data-access="full"]')).toBeVisible();

    await context.clearCookies();
    await page.reload();
    await expect(page).toHaveURL(/\/auth\/sign-in\?returnTo=/u);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Sign in',
    );
  });

  test('[P2-S07-AC-140, P2-S07-AC-173] reduced motion and automated accessibility have no serious violations', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openConfiguration(page);
    const motion = await page
      .locator('[data-reduced-motion]')
      .getAttribute('data-reduced-motion');
    expect(motion).toContain('prefers-reduced-motion');
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(
        ({ impact }) => impact === 'serious' || impact === 'critical',
      ),
    ).toEqual([]);
  });
});
test('[P2-S07-AC-151, P2-S07-AC-157] unauthenticated role spoofing receives a safe relative sign-in return target', async ({
  context,
  page,
}) => {
  await context.clearCookies();
  await page.goto(`${APP_ROUTE}?role=admin&returnTo=https://evil.example`);
  await expect(page).toHaveURL(/\/auth\/sign-in\?returnTo=/u);
  const returnTo = new URL(page.url()).searchParams.get('returnTo');
  expect(returnTo).toBe(
    `${APP_ROUTE}?role=admin&returnTo=https://evil.example`,
  );
  expect(returnTo?.startsWith('/')).toBe(true);
});
test('[P2-S07-AC-174] server-first route renders canonical facts without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await authenticate(context);
  const page = await context.newPage();
  await openConfiguration(page);
  await expect(
    page.getByText('web.theme', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.locator('[data-workbench="settings-flags-runtime"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-workbench="settings-flags-runtime"]'),
  ).toHaveAttribute('data-composition', 'list-detail-action-rail');
  await context.close();
});
test('[P2-S07-AC-174] authenticated route stays within locked LCP and CLS budgets', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await authenticate(context);
  const page = await context.newPage();
  await page.addInitScript(() => {
    const vitals = { cls: 0, lcp: 0 };
    Reflect.set(globalThis, '__s07Vitals', vitals);
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const latest = entries.at(-1);
      if (latest !== undefined) vitals.lcp = latest.startTime;
    }).observe({ buffered: true, type: 'largest-contentful-paint' });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          hadRecentInput?: boolean;
          value?: number;
        };
        if (shift.hadRecentInput !== true) vitals.cls += shift.value ?? 0;
      }
    }).observe({ buffered: true, type: 'layout-shift' });
  });

  await openConfiguration(page);
  await page.waitForLoadState('networkidle');
  const vitals = await page.evaluate(
    () =>
      Reflect.get(globalThis, '__s07Vitals') as { cls: number; lcp: number },
  );
  expect(vitals.lcp).toBeGreaterThan(0);
  expect(vitals.lcp).toBeLessThan(2_500);
  expect(vitals.cls).toBeLessThan(0.1);
  await context.close();
});
