import { randomUUID } from 'node:crypto';

import { expect, test, type BrowserContext, type Page } from '@playwright/test';

import { authenticateLocalSession } from './support/local-signed-session';

/*
 * Page-level template proofs on the PRODUCTION-BUILT Astro routes through the real Worker route and the test-owned
 * template port (`support/cms-template-fixture.ts`), the same boundary as `phase-02-slice-12-template-real-route.spec.ts`:
 *
 *  - P2-S12-AC-042 (FE03 CMS-11 row): after a SUCCESSFUL successor save, the named result takes focus, states the
 *    authoritative version and the next action, and the next action leads to the saved latest draft;
 *  - P2-S12-AC-164: a template page / form with the session missing, denied or degraded shows the corresponding sign-in,
 *    capability, rate-wait or retry state, and a missing form session leaves submission disabled;
 *  - P2-S12-AC-265: the missing / expired session is the allowlisted 303 sign-in redirect on both template pages, `new`
 *    is the create page and never a `:templateKey`, and Back restores the form without serializing a definition.
 *
 * The file name sorts AFTER `template-real-route` on purpose: its two save tests move the port's latest version, which
 * that spec reads as version 1. Every test here reads the base version from the page and never assumes a number.
 */
const KEY = 'release-note';
const PATH = `/app/cms-content-modeling/templates/${KEY}`;
const NEW_PATH = '/app/cms-content-modeling/templates/new';
const CSRF = 's12-local-csrf-token';
const SUBMIT_URL = '**/api/v1/cms/templates/versions';
const SUBMIT_SUFFIX = '/api/v1/cms/templates/versions';
const EDIT_ISLAND = 'astro-island[component-url*="CmsTemplateEditDesigner"]';

const signedIn = (context: BrowserContext): Promise<void> =>
  authenticateLocalSession(context, { csrfToken: CSRF });

/** Opens the successor page hydrated and returns the base version its notice names. */
const openEdit = async (page: Page): Promise<string> => {
  const loaded = await page.goto(PATH, { waitUntil: 'domcontentloaded' });
  expect(loaded?.status()).toBe(200);
  await expect(page.locator(EDIT_ISLAND)).not.toHaveAttribute('ssr', '');
  await expect(
    page.getByRole('button', { name: 'Save successor draft' }),
  ).toBeEnabled();
  const notice = await page.getByText(/^Editing version \d+\./u).textContent();
  const base = notice?.match(/Editing version (\d+)\./u)?.[1];
  if (base === undefined)
    throw new Error('The template page did not identify its base version.');
  return base;
};

const apiError = (
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): string =>
  JSON.stringify({ code, message, details, requestId: randomUUID() });

const savedStatus = (page: Page) =>
  page.getByRole('status').filter({ hasText: 'Draft version saved.' });

type CreatedResource = {
  id: string;
  version: string;
  templateKey: string;
  state: string;
};

/** Saves the successor once, holding the POST so the pending window is observed; returns the 201 resource. */
const saveHeld = async (
  page: Page,
  audience: string,
  whilePending: () => Promise<void>,
): Promise<CreatedResource> => {
  const commit = page.getByRole('button', { name: 'Save successor draft' });
  await page.getByRole('textbox', { name: 'Audience' }).fill(audience);
  let release = (): void => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(SUBMIT_URL, async (route) => {
    await gate;
    await route.continue();
  });
  try {
    const answered = page.waitForResponse(
      (response) =>
        response.url().endsWith(SUBMIT_SUFFIX) &&
        response.request().method() === 'POST',
    );
    await commit.click();
    await expect(commit).toHaveAttribute('aria-busy', 'true');
    await whilePending();
    release();
    const response = await answered;
    expect(response.status()).toBe(201);
    return (await response.json()) as CreatedResource;
  } finally {
    release();
    await page.unroute(SUBMIT_URL);
  }
};

test('[P2-S12-AC-042] a successful successor save keeps focus off every other control while pending, then moves it to the named result', async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);
  await signedIn(context);
  const base = await openEdit(page);
  const resource = await saveHeld(page, 'focus-result', async () => {
    // While the save is pending focus has not moved to a field, a link or another control of the form.
    await expect(
      page.locator('input:focus, select:focus, textarea:focus, a:focus'),
    ).toHaveCount(0);
  });
  expect(resource.version).toBe(String(BigInt(base) + 1n));
  // The named result heading (FE03 CMS-11 row: "focus stays until navigation or named result heading") takes focus,
  // inside the polite status region that states the saved draft.
  await expect(savedStatus(page)).toHaveCount(1);
  const resultHeading = savedStatus(page).getByRole('heading', {
    name: 'Draft version saved.',
  });
  await expect(resultHeading).toBeFocused();
  // It stays there: nothing in the page moves focus again until the person navigates.
  await page.waitForTimeout(500);
  await expect(resultHeading).toBeFocused();
});

test('[P2-S12-AC-042] a successful successor save renders the authoritative version, the draft state and the next action, and the next action opens that very draft', async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);
  await signedIn(context);
  const base = await openEdit(page);
  const resource = await saveHeld(page, 'render-result', async () => undefined);
  expect(resource).toMatchObject({
    templateKey: KEY,
    state: 'draft',
    version: String(BigInt(base) + 1n),
  });
  const status = savedStatus(page);
  // The response, not the form, is what is rendered: its server-assigned id and version, and that it is only a draft.
  await expect(status).toContainText(
    `Template ID ${resource.id}, version ${resource.version}.`,
  );
  await expect(status).toContainText('This is not a published template.');
  const next = status.getByRole('link', { name: 'Open latest draft' });
  await expect(next).toHaveAttribute('href', PATH);
  // The link addresses the page that is open: a full navigation, so the version below proves the reload.
  await next.click();
  await expect(page.locator(EDIT_ISLAND)).not.toHaveAttribute('ssr', '');
  // The next action reaches the authoritative latest: the page now edits the saved version and shows what was saved.
  await expect(
    page.getByText(`Editing version ${resource.version}.`),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Audience' })).toHaveValue(
    'render-result',
  );
  const latest = await page.evaluate(async (path) => {
    const read = await fetch(path, { credentials: 'same-origin' });
    return (await read.json()) as { id: string; version: string };
  }, `/api/v1/cms/templates/${KEY}`);
  expect(latest).toMatchObject({ id: resource.id, version: resource.version });
});

test('[P2-S12-AC-164] without a protected form session the successor form is shown with submission disabled and says so', async ({
  context,
  page,
}) => {
  // A valid signed session but no readable CSRF cookie: the context is missing, so the form must not submit.
  await authenticateLocalSession(context);
  await openDisabled(page);
  await expect(
    page.getByText('Reload to restore the protected form session.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save successor draft' }),
  ).toBeDisabled();
});

/** The successor page hydrated; the commit control may be disabled. */
const openDisabled = async (page: Page): Promise<void> => {
  const loaded = await page.goto(PATH, { waitUntil: 'domcontentloaded' });
  expect(loaded?.status()).toBe(200);
  await expect(page.locator(EDIT_ISLAND)).not.toHaveAttribute('ssr', '');
};

const refusedStates = [
  {
    label: 'sign-in',
    status: 401,
    code: 'UNAUTHENTICATED',
    copy: 'Your session expired. Sign in again before submitting.',
  },
  {
    label: 'capability',
    status: 403,
    code: 'TEMPLATE_FORBIDDEN',
    copy: 'Template designer access is required for this acting context.',
  },
  {
    label: 'retry',
    status: 503,
    code: 'DEPENDENCY_UNAVAILABLE',
    copy: 'The template service is unavailable. Your form values remain here for a later retry.',
  },
] as const;

for (const state of refusedStates)
  test(`[P2-S12-AC-164] a ${String(state.status)} answer shows the ${state.label} state, keeps the values and names the way on`, async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);
    await signedIn(context);
    await openEdit(page);
    const posts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith(SUBMIT_SUFFIX))
        posts.push(request.headers()['idempotency-key'] ?? '');
    });
    await page.route(SUBMIT_URL, (route) =>
      route.fulfill({
        status: state.status,
        contentType: 'application/json',
        body: apiError(state.code, 'Refused for the browser proof.'),
      }),
    );
    await page.getByRole('textbox', { name: 'Audience' }).fill('kept-values');
    await page.getByRole('button', { name: 'Save successor draft' }).click();
    await expect(page.getByRole('alert')).toContainText(state.copy);
    await expect(page.getByRole('alert')).toBeFocused();
    await expect(page.getByRole('textbox', { name: 'Audience' })).toHaveValue(
      'kept-values',
    );
    if (state.status === 401)
      await expect(
        page.getByRole('alert').getByRole('link', { name: 'Sign in' }),
      ).toHaveAttribute(
        'href',
        `/auth/sign-in?returnTo=${encodeURIComponent(PATH)}`,
      );
    // Nothing was created: a refused attempt is retried, and a second press sends again.
    await expect(
      page.getByRole('button', { name: 'Save successor draft' }),
    ).toBeEnabled();
    await page.getByRole('button', { name: 'Save successor draft' }).click();
    await expect.poll(() => posts.length).toBe(2);
    await page.unroute(SUBMIT_URL);
  });

test('[P2-S12-AC-164] a 429 answer shows the rate-wait state, disables submission for the stated wait and then offers it again', async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);
  await signedIn(context);
  await openEdit(page);
  await page.route(SUBMIT_URL, (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      headers: { 'retry-after': '3' },
      body: apiError('RATE_LIMITED', 'Too many requests.', {
        retryAfterSeconds: 3,
      }),
    }),
  );
  const commit = page.getByRole('button', { name: 'Save successor draft' });
  await page.getByRole('textbox', { name: 'Audience' }).fill('rate-wait');
  await commit.click();
  await expect(page.getByRole('alert')).toContainText(
    'The request was rate-limited. Wait at least 3 seconds before retrying.',
  );
  await expect(commit).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Audience' })).toHaveValue(
    'rate-wait',
  );
  await expect(commit).toBeEnabled({ timeout: 15_000 });
  await page.unroute(SUBMIT_URL);
});

test('[P2-S12-AC-164] a template key the protected read does not know is a closed page with no form', async ({
  context,
  page,
}) => {
  await signedIn(context);
  const response = await page.goto(
    '/app/cms-content-modeling/templates/no-such-template',
    { waitUntil: 'domcontentloaded' },
  );
  expect(response?.status()).toBe(404);
  expect(response?.headers()['cache-control']).toBe('no-store');
  const main = page.getByRole('main');
  await expect(main).toContainText('Designer unavailable');
  await expect(main).toContainText(
    'This template is unavailable to the current acting context.',
  );
  await expect(main.locator('form')).toHaveCount(0);
  await expect(page.locator(EDIT_ISLAND)).toHaveCount(0);
});

const baseOrigin = (): string => {
  const base = test.info().project.use.baseURL;
  if (base === undefined) throw new Error('baseURL is not configured');
  return base;
};

for (const [label, path] of [
  ['successor', PATH],
  ['create', NEW_PATH],
] as const)
  for (const [session, article] of [
    ['missing', 'a'],
    ['expired', 'an'],
  ] as const)
    test(`[P2-S12-AC-265] [P2-S12-AC-164] ${article} ${session} session on the ${label} template page is the allowlisted 303 sign-in redirect and shows no form`, async ({
      context,
      page,
    }) => {
      if (session === 'expired')
        await authenticateLocalSession(context, {
          csrfToken: CSRF,
          expiresAt: Math.floor(Date.now() / 1_000) - 60,
        });
      const response = await context.request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(303);
      const location = new URL(response.headers().location ?? '', baseOrigin());
      expect(location.pathname).toBe('/auth/sign-in');
      expect(location.searchParams.get('returnTo')).toBe(path);
      expect(response.headers()['cache-control']).toContain('no-store');
      // The browser follows it to the sign-in page, and no template island was rendered on the way.
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(new URL(page.url()).pathname).toBe('/auth/sign-in');
      await expect(
        page.locator('astro-island[component-url*="CmsTemplate"]'),
      ).toHaveCount(0);
    });

test('[P2-S12-AC-265] /templates/new is the create page and never resolves as a template key', async ({
  context,
  page,
}) => {
  await signedIn(context);
  const keyReads: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/v1/cms/templates/new'))
      keyReads.push(request.url());
  });
  const response = await page.goto(NEW_PATH, { waitUntil: 'domcontentloaded' });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Template designer',
  );
  await expect(page.getByRole('main')).not.toContainText('Not found');
  await expect(
    page.locator('astro-island[component-url*="CmsTemplateDesigner"]'),
  ).not.toHaveAttribute('ssr', '');
  await expect(page.locator(EDIT_ISLAND)).toHaveCount(0);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Define template draft' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Create draft' }),
  ).toBeEnabled();
  expect(keyReads, 'no latest read was made for the key "new"').toEqual([]);
});

test('[P2-S12-AC-265] Back restores the template form without serializing a definition into the URL, history or storage', async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);
  await signedIn(context);
  const visited: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) visited.push(frame.url());
  });
  await openEdit(page);
  const marker = `back-${randomUUID().slice(0, 8)}`;
  await page.getByRole('textbox', { name: 'Audience' }).fill(marker);
  await page.goto('/system/degraded', { waitUntil: 'domcontentloaded' });
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForURL((url) => url.pathname === PATH);
  // The form is back and usable: restored by the browser, not rebuilt from an address.
  await expect(page.locator(EDIT_ISLAND)).not.toHaveAttribute('ssr', '');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Edit template draft' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save successor draft' }),
  ).toBeEnabled();
  const place = await page.evaluate(() => ({
    search: window.location.search,
    hash: window.location.hash,
    state: JSON.stringify(window.history.state),
    local: JSON.stringify({ ...window.localStorage }),
    session: JSON.stringify({ ...window.sessionStorage }),
  }));
  expect(place.search).toBe('');
  expect(place.hash).toBe('');
  expect(place.state).not.toContain(marker);
  expect(place.local).not.toContain(marker);
  expect(place.session).not.toContain(marker);
  for (const url of visited) {
    expect(url).not.toContain(marker);
    expect(new URL(url).search).toBe('');
    expect(new URL(url).hash).toBe('');
  }
});
