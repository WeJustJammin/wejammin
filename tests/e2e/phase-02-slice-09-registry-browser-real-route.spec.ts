import { expect, test, type Page } from '@playwright/test';

import { STEP_UP_PAGE_HEADINGS } from '../../apps/web/src/components/identity-authority/step-up-mfa/step-up-page-headings';
import { newTestId, closeLaneContexts } from './support/s09-lane-browser';
import {
  REGISTRY,
  WEB_ORIGIN,
  WORKER_ORIGIN,
  decideViaUi,
  enrollFactorViaUi,
  expireStepUp,
  horizontalOverflow,
  readWorkerJson,
  smallControls,
  uuidIn,
  versionApiPath,
  waitForWorkbench,
} from './support/s09-lane-flows';
import {
  actor,
  assignReviewer,
  enrollReviewer,
  openReview,
} from './support/s09-lane-scenarios';

/**
 * Slice 09 browser-only remainders for the registry list, the create flow, the
 * activation result and the /step-up and /settings/security/mfa routes,
 * observed on the production-built Astro routes in Google Chrome (loopback
 * stateful lane; not database, provider or hosted evidence).
 */

test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' });

test.afterEach(closeLaneContexts);

const tabStops = async (
  page: Page,
  scope: string,
  limit = 80,
): Promise<string[]> => {
  const stops: string[] = [];
  for (let step = 0; step < limit; step += 1) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate((selector) => {
      const element = document.activeElement as HTMLElement | null;
      if (element === null || element === document.body) return null;
      if (element.closest(selector) === null)
        return { inside: false, label: '' };
      const style = getComputedStyle(element);
      const ring =
        (style.outlineStyle !== 'none' &&
          Number.parseFloat(style.outlineWidth) > 0) ||
        style.boxShadow !== 'none';
      return {
        inside: true,
        label: `${element.tagName.toLowerCase()}|${(element.getAttribute('aria-label') ?? element.innerText ?? element.getAttribute('name') ?? '').trim().slice(0, 40)}|${ring ? 'ring' : 'none'}`,
      };
    }, scope);
    if (stop === null || !stop.inside) break;
    stops.push(stop.label);
  }
  return stops;
};

test('[P2-S09-AC-219] [P2-S09-AC-247] [P2-S09-AC-249] the registry list reflows at 320 px and 200% zoom, has one h1 and a skip link, and every control is keyboard reachable at 24 px or more', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  await enrollFactorViaUi(page, 'Owner phone');

  // 200% zoom of a 1280 px window is a 640 CSS px layout; 400% (320) is the floor.
  for (const [width, height] of [
    [1280, 900],
    [640, 900],
    [320, 900],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(REGISTRY, { waitUntil: 'networkidle' });
    await waitForWorkbench(page);
    expect(
      await horizontalOverflow(page),
      `overflow at ${String(width)}`,
    ).toBeLessThanOrEqual(1);
    expect(await page.locator('h1').count()).toBe(1);
    expect(await page.title()).not.toBe('');
    if (width !== 640)
      expect(
        await smallControls(page, 'main', 24),
        `targets at ${String(width)}`,
      ).toEqual([]);
  }

  // Initial load keeps the browser's default focus destination (the h1 is
  // focused on client route changes, which this app performs as full page loads),
  // so a skip link is the first Tab stop and targets the main landmark.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(REGISTRY, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  await page.keyboard.press('Tab');
  const skipTarget = await page.evaluate(() => {
    const element = document.activeElement as HTMLAnchorElement | null;
    return {
      text: element?.textContent?.trim(),
      href: element?.getAttribute('href'),
    };
  });
  expect(skipTarget.text).toBe('Skip to main content');
  await expect(page.locator(skipTarget.href ?? '#missing')).toHaveCount(1);

  // AC219 named landmarks: one main, and every navigation or region is named.
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(
    page.getByRole('navigation', { name: 'Skip navigation' }),
  ).toHaveCount(1);
  const unnamed = await page
    .locator('nav, section, aside, form')
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const labelledBy = element.getAttribute('aria-labelledby');
          const named =
            (element.getAttribute('aria-label') ?? '').trim() !== '' ||
            (labelledBy !== null &&
              labelledBy
                .split(' ')
                .some(
                  (id) =>
                    (document.getElementById(id)?.textContent ?? '').trim() !==
                    '',
                ));
          // A bare section or form is not a landmark; only nav is always one.
          return element.tagName === 'NAV' && !named;
        })
        .map((element) => element.outerHTML.slice(0, 80)),
    );
  expect(unnamed).toEqual([]);
  // AC219 route h1 focus: an in-app route change (tab state) lands on the h1.
  await page.goto(`${REGISTRY}?tab=list`, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.goto(REGISTRY, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);

  // Real Tab traversal through every control in main: visible focus ring on each
  // stop and no trap (focus leaves main at the end).
  await page.getByRole('heading', { level: 1 }).focus();
  const stops = await tabStops(page, 'main');
  expect(stops.length).toBeGreaterThan(5);
  for (const stop of stops) expect(stop.endsWith('|ring'), stop).toBe(true);
});

test('[P2-S09-AC-251] a degraded registry state under prefers-reduced-motion runs no animation and keeps a text status cue', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const degraded = await page.request.post(
    `${WORKER_ORIGIN}/_s09/lane/degrade-reads`,
    {
      data: { testId, on: true },
    },
  );
  expect(degraded.status()).toBe(200);

  await page.goto(REGISTRY, { waitUntil: 'networkidle' });
  await expect(page.locator('.content-schema-registry')).toBeVisible();
  // A text cue (not colour or motion alone) states the degraded condition.
  const cue = page.locator(
    '.content-schema-registry [role="status"], .content-schema-registry [role="alert"]',
  );
  await expect(
    cue.filter({ hasText: /temporarily unavailable/iu }).first(),
  ).toBeVisible();
  const motion = await page.evaluate(() => {
    const root = document.querySelector(
      '.content-schema-registry',
    ) as HTMLElement;
    const running = document.getAnimations().length;
    const offenders = [root, ...root.querySelectorAll<HTMLElement>('*')].filter(
      (element) => {
        const style = getComputedStyle(element);
        const longest = Math.max(
          ...style.transitionDuration
            .split(',')
            .map(
              (value) =>
                Number.parseFloat(value) * (value.includes('ms') ? 1 : 1000),
            ),
        );
        return style.animationName !== 'none' || longest > 1;
      },
    ).length;
    return {
      running,
      offenders,
      scroll: getComputedStyle(root).scrollBehavior,
    };
  });
  expect(motion.running).toBe(0);
  expect(motion.offenders).toBe(0);
  expect(motion.scroll).toBe('auto');
});

test('[P2-S09-AC-222] [P2-S09-AC-219] [P2-S09-AC-1232] creating a type with two languages continues at the created version address, focuses the heading and shows the read-only locale configuration', async ({
  browser,
}) => {
  const owner = await actor(browser, 'owner', newTestId());
  const page = owner.page;
  await page.goto(REGISTRY, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  const tags = page.getByRole('textbox', { name: 'Add a language tag' });
  for (const tag of ['en-US', 'fr']) {
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
    .getByRole('textbox', { name: 'Type key' })
    .fill('two_language_type');
  await page
    .getByRole('textbox', { name: 'Display label' })
    .fill('Two language type');
  await page
    .getByRole('textbox', { name: 'Owner capability' })
    .fill('cms.content.article');
  await page
    .getByRole('textbox', { name: 'Workflow key' })
    .fill('editorial.default');
  await page.getByRole('textbox', { name: 'Workflow version' }).fill('1');
  await page.getByRole('button', { name: 'Save content type draft' }).click();
  await page.waitForURL(/\/versions\//u, { timeout: 15_000 });
  const pathname = new URL(page.url()).pathname;
  const [typeId, versionId] = uuidIn(pathname);
  expect(pathname).toBe(`${REGISTRY}/${typeId}/versions/${versionId}`);
  expect(new URL(page.url()).search).toBe('');
  await waitForWorkbench(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Two language type',
  );
  // AC219: the document title carries the heading and the version state.
  const headingText = (await page.locator('h1').textContent()) ?? '';
  expect(headingText).toContain('(draft)');
  expect(await page.title()).toBe(`${headingText} | WeJammin`);
  // AC1232: the committed configuration is read-only text, led by the focused h1.
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  const languages = page.locator('#content-schema-registry-locales-heading');
  await expect(languages).toHaveText('Languages');
  await expect(
    page.locator('#content-schema-registry-locales-heading + p'),
  ).toHaveText('en-US, fr');
  await expect(page.locator('[data-locale-chains] li')).toHaveText([
    'fr: en-US',
  ]);
});

test('[P2-S09-AC-225] activating an approved version focuses the result region and its link opens the refreshed version', async ({
  browser,
}) => {
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

  const result = page.locator('[data-cms-activation-result]');
  await expect(result).toBeVisible({ timeout: 15_000 });
  await expect(result.getByRole('heading', { level: 3 })).toBeFocused();
  await expect(result).toContainText('The server activated this version.');
  const link = result.getByRole('link', { name: 'Open the refreshed version' });
  await expect(link).toBeVisible();
  await link.click();
  await page.waitForURL(new RegExp(`${stage.created.path}$`, 'u'));
  await waitForWorkbench(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '(active)',
  );
  const api = (await readWorkerJson(page, versionApiPath(stage.created))) as {
    resource: { state: string };
  };
  expect(api.resource.state).toBe('active');
});

test('[P2-S09-AC-1067] /step-up without a session answers a 303 to the sign-in route carrying the return target', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: WEB_ORIGIN });
  const request = context.request;
  const target = '/step-up?returnTo=%2Fapp%2Fcms-content-modeling%3Fx%3D1';
  const response = await request.get(target, { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  const location = new URL(response.headers().location ?? '', WEB_ORIGIN);
  expect(location.pathname).toBe('/auth/sign-in');
  expect(location.searchParams.get('returnTo')).toBe(target);
  expect(response.headers()['cache-control']).toContain('no-store');
  // The browser follows it to the sign-in page at that address.
  const page = await context.newPage();
  await page.goto(target);
  expect(new URL(page.url()).pathname).toBe('/auth/sign-in');
  await context.close();
});

test('[P2-S09-AC-1101] /step-up and /settings/security/mfa set the document title and focus the h1 on load', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  await enrollFactorViaUi(page, 'Owner phone');
  await expireStepUp(page, testId, 'owner');
  // Record every focus change from the first script of each document on.
  await page.addInitScript(() => {
    const log: string[] = [];
    (window as unknown as { __focusLog: string[] }).__focusLog = log;
    document.addEventListener(
      'focusin',
      (event) => {
        const target = event.target as HTMLElement;
        log.push(`${target.tagName.toLowerCase()}#${target.id}`);
      },
      true,
    );
  });
  const focusLog = (): Promise<string[]> =>
    page.evaluate(
      () => (window as unknown as { __focusLog: string[] }).__focusLog,
    );

  await page.goto('/step-up?returnTo=%2Fapp%2Fcms-content-modeling', {
    waitUntil: 'networkidle',
  });
  expect(await page.title()).toBe(
    STEP_UP_PAGE_HEADINGS['step-up'].documentTitle,
  );
  expect(await page.locator('h1').count()).toBe(1);
  // FE01: the h1 takes focus on route load, then the code field once the challenge exists.
  const stepUpLog = await focusLog();
  expect(stepUpLog[0]).toBe('h1#page-title');
  expect(stepUpLog).toContain('input#step-up-code-help-input');

  await page.goto('/settings/security/mfa', { waitUntil: 'networkidle' });
  expect(await page.title()).toBe(STEP_UP_PAGE_HEADINGS.mfa.documentTitle);
  expect(await page.locator('h1').count()).toBe(1);
  expect((await focusLog())[0]).toBe('h1#page-title');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
});

test('[P2-S09-AC-1065] a signed-in /step-up request is rendered on the server with no-store, the heading, the explanation and the verified factor', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  await enrollFactorViaUi(page, 'Owner phone');
  await expireStepUp(page, testId, 'owner');
  // The request context shares the signed-in cookies but never runs scripts, so
  // everything asserted here was produced by the server render alone.
  const response = await page
    .context()
    .request.get('/step-up?returnTo=%2Fapp%2Fcms-content-modeling', {
      maxRedirects: 0,
    });
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  // React escapes the apostrophe in the heading as a numeric entity.
  const html = (await response.text()).replaceAll('&#x27;', "'");
  expect(html).toContain(STEP_UP_PAGE_HEADINGS['step-up'].heading);
  expect(html).toContain(STEP_UP_PAGE_HEADINGS['step-up'].description);
  expect(html).toContain('Owner phone');
});

test('[P2-S09-AC-1098] /auth/sign-in?intent=recovery renders the recovery entry and plain /auth/sign-in does not', async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: WEB_ORIGIN });
  const page = await context.newPage();
  const intents = () =>
    page
      .locator('button[name="intent"]')
      .evaluateAll((buttons) =>
        buttons.map((button) => (button as HTMLButtonElement).value),
      );

  await page.goto('/auth/sign-in?intent=recovery&returnTo=%2Fapp', {
    waitUntil: 'networkidle',
  });
  await expect(
    page.getByRole('heading', { level: 2, name: 'Recover your account' }),
  ).toBeVisible();
  expect(await intents()).toEqual(['recovery']);

  await page.goto('/auth/sign-in?returnTo=%2Fapp', {
    waitUntil: 'networkidle',
  });
  await expect(
    page.getByRole('heading', { level: 2, name: 'Continue to your workspace' }),
  ).toBeVisible();
  expect(await intents()).toEqual(['sign_in', 'recovery']);
  await context.close();
});
