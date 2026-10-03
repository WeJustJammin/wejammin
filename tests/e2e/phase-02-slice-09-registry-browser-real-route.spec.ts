import { expect, test, type Page } from '@playwright/test';

import { STEP_UP_PAGE_HEADINGS } from '../../apps/web/src/components/identity-authority/step-up-mfa/step-up-page-headings';
import {
  newTestId,
  closeLaneContexts,
  newLaneContext,
} from './support/s09-lane-browser';
import { laneSessionId } from './support/s09-lane-ids';
import {
  REGISTRY,
  WEB_ORIGIN,
  WORKER_ORIGIN,
  createTypeViaUi,
  decideViaUi,
  fillCreateTypeForm,
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
  const cue = page.locator('.content-schema-registry [role="status"]');
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

/**
 * AC233 on a REAL offline/online cycle (Chrome `context.setOffline`), not an
 * in-memory retry: while offline the world changes on the server, and when the
 * `online` event fires the island refetches the canonical read and the real
 * Worker revalidates identity (401), authority (403) and version (fresh state).
 * Nothing the person typed is stored or replayed by the browser.
 */
const OFFLINE_CUE = '[data-cms-offline-status]';

const goOffline = async (page: Page): Promise<void> => {
  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.locator(OFFLINE_CUE)).toBeVisible();
};

test('[P2-S09-AC-233] reconnect revalidates identity: a session revoked while offline sends the page to sign-in', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  await page.goto(REGISTRY, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  await goOffline(page);
  const revoked = await page.request.post(`${WORKER_ORIGIN}/_s09/revoke`, {
    data: { sessionId: laneSessionId('owner', testId, 0) },
  });
  expect(revoked.status()).toBe(200);
  await page.context().setOffline(false);
  await page.waitForURL(/\/auth\/sign-in/u, { timeout: 20_000 });
  await expect(
    page.locator('[data-workbench="content-schema-registry"]'),
  ).toHaveCount(0);
});

test('[P2-S09-AC-233] reconnect revalidates authority: a capability removed while offline disables the workbench and removes the create form', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  await page.goto(REGISTRY, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  await goOffline(page);
  for (const capability of [
    'cms.schema_registry.read',
    'cms.schema_designer',
  ]) {
    const removed = await page.request.post(
      `${WORKER_ORIGIN}/_s09/lane/remove-capability`,
      { data: { testId, role: 'owner', capability } },
    );
    expect(removed.status()).toBe(200);
  }
  await page.context().setOffline(false);
  await expect(
    page.getByRole('heading', { name: 'Schema changes unavailable' }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByRole('button', { name: 'Save content type draft' }),
  ).toHaveCount(0);
  // The gate states a typed code, never how the page had been presented.
  const gate = page
    .getByRole('status')
    .filter({ hasText: 'Schema changes unavailable' });
  await expect(gate).toContainText('Reason: SCHEMA_REGISTRY_UNAVAILABLE');
  await expect(gate).not.toContainText('ownerFull');
});

test('[P2-S09-AC-233] reconnect revalidates version: a record created elsewhere while offline appears after reconnect', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  await enrollFactorViaUi(page, 'Owner phone');
  await createTypeViaUi(page);
  await page.goto(REGISTRY, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  const rows = page.locator('.content-schema-registry tbody tr');
  const before = await rows.count();
  expect(before).toBeGreaterThan(0);
  await goOffline(page);
  // The first proof rotated the owner's session to generation 1; a second
  // browser signs in at that generation (the same person on another device).
  const otherContext = await newLaneContext(browser, 'owner', testId, {
    generation: 1,
  });
  const other = { page: await otherContext.newPage() };
  await createTypeViaUi(other.page, {
    typeKey: 'second_note',
    label: 'Second note',
  });
  await page.context().setOffline(false);
  await expect
    .poll(() => rows.count(), { timeout: 20_000 })
    .toBeGreaterThan(before);
});

test('[P2-S09-AC-233] nothing typed is persisted or replayed across an offline submit and reconnect', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  await enrollFactorViaUi(page, 'Owner phone');
  await page.goto(REGISTRY, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url());
  });
  await page
    .getByRole('textbox', { name: 'Type key' })
    .fill('offline_secret_key');
  await goOffline(page);
  await page.getByRole('button', { name: 'Save content type draft' }).click();
  await page.waitForTimeout(1_000);
  const stored = await page.evaluate(async () => ({
    local: window.localStorage.length,
    session: Object.keys(window.sessionStorage).filter((key) =>
      window.sessionStorage.getItem(key)?.includes('offline_secret_key'),
    ).length,
    databases: (await indexedDB.databases()).length,
    caches: (await caches.keys()).length,
  }));
  expect(stored).toEqual({ local: 0, session: 0, databases: 0, caches: 0 });
  const whileOffline = posts.length;
  await page.context().setOffline(false);
  await page.waitForTimeout(2_000);
  // The reconnect refetch is a GET; no queued write is ever replayed.
  expect(posts.length).toBe(whileOffline);
});

test('[P2-S09-AC-233] reconnect revalidates input: an invalid draft survives the offline cycle untouched, nothing is replayed, and the server validates the explicit resubmission', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  await enrollFactorViaUi(page, 'Owner phone');
  await page.goto(REGISTRY, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  // Valid locale configuration, but a type key the server refuses.
  await fillCreateTypeForm(page, { typeKey: 'Bad Key' });
  const posts: string[] = [];
  const reads: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url());
    else if (request.method() === 'GET' && request.url().includes('/app/'))
      reads.push(request.url());
  });
  await goOffline(page);
  await page.getByRole('button', { name: 'Save content type draft' }).click();
  await page.waitForTimeout(1_000);
  const postsWhileOffline = posts.length;
  const readsWhileOffline = reads.length;
  await page.context().setOffline(false);
  // The online event refetches the canonical read (a GET): the revalidation.
  await expect
    .poll(() => reads.length, { timeout: 20_000 })
    .toBeGreaterThan(readsWhileOffline);
  await page.waitForTimeout(1_500);
  // Nothing is replayed by the browser, and nothing typed is lost or altered.
  expect(posts.length).toBe(postsWhileOffline);
  await expect(page.getByRole('textbox', { name: 'Type key' })).toHaveValue(
    'Bad Key',
  );
  await expect(
    page.getByRole('textbox', { name: 'Display label' }),
  ).toHaveValue('Release note');
  await expect(
    page
      .getByRole('textbox', { name: 'Language tags' })
      .or(page.getByText('fr-CA').first()),
  ).toBeVisible();
  // The person resubmits explicitly: the server (not the browser) validates the
  // input and names the field, and the draft is still there to correct.
  const refusal = page.waitForResponse(
    (candidate) => candidate.request().method() === 'POST',
    { timeout: 15_000 },
  );
  await page.getByRole('button', { name: 'Save content type draft' }).click();
  const response = await refusal;
  expect(response.status()).toBe(422);
  expect(await response.json()).toMatchObject({
    code: 'VALIDATION_FAILED',
    details: { violations: [{ path: '/typeKey' }] },
  });
  await expect(
    page.getByRole('link', { name: /typeKey|Type key/u }).first(),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('textbox', { name: 'Type key' })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
  await expect(page.getByRole('textbox', { name: 'Type key' })).toHaveValue(
    'Bad Key',
  );
  expect(posts.length).toBe(postsWhileOffline + 1);
  // Correcting the field and confirming is accepted by the same server.
  await page.getByRole('textbox', { name: 'Type key' }).fill('after_reconnect');
  await page.getByRole('button', { name: 'Save content type draft' }).click();
  await page.waitForURL(/\/versions\//u, { timeout: 20_000 });
});

test('[P2-S09-AC-233] reconnect revalidates input against the refetched registry: a key typed offline is refused by the server once another person has taken it, and nothing is overwritten', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  await enrollFactorViaUi(page, 'Owner phone');
  await page.goto(REGISTRY, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  await fillCreateTypeForm(page, {
    typeKey: 'shared_key',
    label: 'My shared note',
  });
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') posts.push(request.url());
  });
  await goOffline(page);
  // While this person is offline, another person (the same owner on a second
  // device) creates a type with the same key.
  const otherContext = await newLaneContext(browser, 'owner', testId, {
    generation: 1,
  });
  const other = await otherContext.newPage();
  await createTypeViaUi(other, {
    typeKey: 'shared_key',
    label: 'Their shared note',
  });
  const before = posts.length;
  await page.context().setOffline(false);
  // The refetched registry now lists the other person's record.
  await expect(
    page.getByRole('table').getByText('shared_key').first(),
  ).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1_000);
  // Reconnect only revalidates by reading: the typed draft was not replayed,
  // and it is still exactly what the person typed.
  expect(posts.length).toBe(before);
  await expect(page.getByRole('textbox', { name: 'Type key' })).toHaveValue(
    'shared_key',
  );
  await expect(
    page.getByRole('textbox', { name: 'Display label' }),
  ).toHaveValue('My shared note');
  // The person confirms explicitly; the server revalidates that input against
  // the registry it now holds and refuses it. Nothing is overwritten.
  const refusal = page.waitForResponse(
    (candidate) => candidate.request().method() === 'POST',
    { timeout: 15_000 },
  );
  await page.getByRole('button', { name: 'Save content type draft' }).click();
  expect((await refusal).status()).toBe(409);
  await expect(
    page.getByRole('heading', { name: /Review the current registry version/u }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/app\/cms-content-modeling(?:\?|$)/u);
  await expect(page.getByRole('textbox', { name: 'Type key' })).toHaveValue(
    'shared_key',
  );
  await expect(
    page.getByRole('textbox', { name: 'Display label' }),
  ).toHaveValue('My shared note');
});

test('[P2-S09-AC-248] blur feedback on the real create form is inline and linked, never blocks the submit, and the server answer that follows is authoritative', async ({
  browser,
}) => {
  const owner = await actor(browser, 'owner', newTestId());
  const page = owner.page;
  await enrollFactorViaUi(page, 'Owner phone');
  await page.goto(REGISTRY, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  await fillCreateTypeForm(page, { typeKey: 'Bad Key' });
  const typeKey = page.getByRole('textbox', { name: 'Type key' });
  const label = page.getByRole('textbox', { name: 'Display label' });
  const rule =
    'Use 2 to 64 lowercase letters, numbers, or underscores, starting with a letter.';
  // The value was typed programmatically (no blur yet): leaving the field now
  // is the first blur, so the error is shown there and not before.
  await label.focus();
  await typeKey.focus();
  await label.focus();
  await expect(typeKey).toHaveAttribute('aria-invalid', 'true');
  const error = page.locator('#content-schema-registry-type-key-blur-error');
  await expect(error).toHaveText(rule);
  await expect(typeKey).toHaveAttribute(
    'aria-describedby',
    /content-schema-registry-type-key-blur-error/u,
  );
  // The other fields were fine: no error appears on them.
  await expect(label).not.toHaveAttribute('aria-invalid', 'true');
  // The blur error never blocks: Save still sends it, and the server decides.
  const refusal = page.waitForResponse(
    (candidate) => candidate.request().method() === 'POST',
    { timeout: 15_000 },
  );
  await page.getByRole('button', { name: 'Save content type draft' }).click();
  const response = await refusal;
  expect(response.status()).toBe(422);
  expect(await response.json()).toMatchObject({
    details: { violations: [{ path: '/typeKey' }] },
  });
  await expect(
    page.locator('[data-cms-validation-summary] a', { hasText: /typeKey/u }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(error).toHaveText(rule);
  // Correcting the value clears the inline error as the person types.
  await typeKey.fill('after_blur');
  await expect(error).toHaveCount(0);
  await page.getByRole('button', { name: 'Save content type draft' }).click();
  await page.waitForURL(/\/versions\//u, { timeout: 20_000 });
});

test('[P2-S09-AC-248] a value that passes blur is still refused by the server when it is already taken', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  await enrollFactorViaUi(page, 'Owner phone');
  await createTypeViaUi(page, { typeKey: 'taken_key' });
  await page.goto(REGISTRY, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  await fillCreateTypeForm(page, { typeKey: 'taken_key', label: 'Another' });
  const typeKey = page.getByRole('textbox', { name: 'Type key' });
  await typeKey.focus();
  await page.getByRole('textbox', { name: 'Display label' }).focus();
  await expect(typeKey).not.toHaveAttribute('aria-invalid', 'true');
  await expect(
    page.locator('#content-schema-registry-type-key-blur-error'),
  ).toHaveCount(0);
  const refusal = page.waitForResponse(
    (candidate) => candidate.request().method() === 'POST',
    { timeout: 15_000 },
  );
  await page.getByRole('button', { name: 'Save content type draft' }).click();
  expect((await refusal).status()).toBe(409);
  await expect(typeKey).toHaveValue('taken_key');
});

test('[P2-S09-AC-234] the rendered registry list and version responses are no-store and noindex, with no sitemap, analytics request or browser storage', async ({
  browser,
}) => {
  const owner = await actor(browser, 'owner', newTestId());
  const page = owner.page;
  await enrollFactorViaUi(page, 'Owner phone');
  const created = await createTypeViaUi(page);
  const origins = new Set<string>();
  page.on('request', (request) => origins.add(new URL(request.url()).origin));
  for (const path of [REGISTRY, created.path]) {
    const response = await page.goto(path, { waitUntil: 'networkidle' });
    await waitForWorkbench(page);
    expect(response?.status()).toBe(200);
    expect(response?.headers()['cache-control'] ?? '').toContain('no-store');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/u,
    );
    await expect(page.locator('link[rel="sitemap"]')).toHaveCount(0);
    const storage = await page.evaluate(async () => ({
      local: Object.keys(window.localStorage).filter(
        (key) => key !== 'wj_client_binding_id_v1',
      ).length,
      databases: (await indexedDB.databases()).length,
      caches: (await caches.keys()).length,
    }));
    expect(storage).toEqual({ local: 0, databases: 0, caches: 0 });
  }
  expect([...origins]).toEqual([WEB_ORIGIN]);
});
