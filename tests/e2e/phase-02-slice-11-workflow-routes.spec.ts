import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The Slice 11 review, schedule, preview and publication routes answer from
 * frontmatter, so each one must (a) refuse a malformed identifier without an
 * upstream call, (b) fail closed as one accessible, no-store state when the
 * editorial service cannot be reached, and (c) load its bundled scripts so the
 * cross-tab auth-scope guard runs. None of this needs the database or the API
 * Worker; the real-route suites (the full command journeys against the real
 * stack) are separate.
 */
const UUID = '123e4567-e89b-42d3-a456-426614174000';
const ROOT = '/app/cms-content-modeling';

// A structurally malformed id is 400 "Invalid request" (DEC-145), never a
// not-found state; a well-formed one has no upstream here, so it is the 503
// degraded state and nothing is fabricated.
const ROUTES: readonly (readonly [string, number, string])[] = [
  [`${ROOT}/entries/not-a-uuid/workflow`, 400, 'Invalid request'],
  [`${ROOT}/reviews/not-a-uuid`, 400, 'Invalid request'],
  [`${ROOT}/entries/${UUID}/workflow`, 503, 'Temporarily unavailable'],
  [`${ROOT}/reviews/${UUID}`, 503, 'Temporarily unavailable'],
  [`${ROOT}/reviews`, 503, 'Temporarily unavailable'],
];

const SCOPE_A = 'A'.repeat(32);
const SCOPE_B = 'B'.repeat(32);

const setScope = (page: Page, value: string): Promise<void> =>
  page.context().addCookies([
    {
      name: 'wj_step_up_scope',
      value,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: false,
      secure: false,
    },
  ]);

const sameDocument = (page: Page): Promise<boolean> =>
  page
    .evaluate(
      () => (window as unknown as { __tabA?: string }).__tabA === 'mounted',
    )
    .catch(() => false);

for (const [route, status, heading] of ROUTES) {
  test.describe(route, () => {
    test(`[S11-WEB] answers ${String(status)} as one accessible, no-store state`, async ({
      page,
    }) => {
      const response = await page.goto(route, {
        waitUntil: 'domcontentloaded',
      });
      expect(response?.status()).toBe(status);
      expect(response?.headers()['cache-control']).toBe('no-store');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      await expect(page.getByRole('main')).not.toContainText(UUID);
      await expect(page.locator('main form')).toHaveCount(0);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(
        axe.violations.filter(
          ({ impact }) => impact === 'serious' || impact === 'critical',
        ),
      ).toEqual([]);
      await page.setViewportSize({ width: 320, height: 720 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    });

    test(`[S11-WEB] loads working scripts and the auth-scope guard reloads a stale tab`, async ({
      page,
    }) => {
      await page.context().addCookies([
        {
          name: 'wj_session_ref',
          value: 's11-session',
          domain: '127.0.0.1',
          path: '/',
          httpOnly: true,
          secure: false,
        },
      ]);
      await setScope(page, SCOPE_A);
      const scripts: { url: string; status: number; type: string }[] = [];
      page.on('response', (response) => {
        if (response.request().resourceType() === 'script')
          scripts.push({
            url: response.url(),
            status: response.status(),
            type: response.headers()['content-type'] ?? '',
          });
      });
      await page.goto(route, { waitUntil: 'networkidle' });
      const named = await page
        .locator('script[src]')
        .evaluateAll((nodes) =>
          nodes.map((node) => (node as HTMLScriptElement).src),
        );
      expect(named.length).toBeGreaterThanOrEqual(2);
      for (const src of named) {
        const served = scripts.find((script) => script.url === src);
        expect(served, `${src} was requested`).toBeDefined();
        expect(served?.status, `${src} status`).toBe(200);
        expect(served?.type, `${src} type`).toMatch(/javascript/u);
      }
      await page.evaluate(() => {
        (window as unknown as { __tabA?: string }).__tabA = 'mounted';
      });
      expect(await sameDocument(page)).toBe(true);
      await setScope(page, SCOPE_B);
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect
        .poll(() => sameDocument(page), { timeout: 20_000 })
        .toBe(false);
    });
  });
}

test.describe('first-party Slice 11 endpoints without a verified service', () => {
  const origin = (baseURL: string | undefined): string => {
    if (baseURL === undefined) throw new Error('baseURL is not configured');
    return baseURL;
  };

  test('[S11-WEB] a foreign-origin command is refused before any body is read', async ({
    request,
    baseURL,
  }) => {
    for (const [path, body] of [
      [`/api/v1/cms/reviews/${UUID}/decision`, '{"probe":true}'],
      ['/api/v1/cms/publication-schedules', '{"probe":true}'],
      ['/api/v1/cms/previews', '{"probe":true}'],
      ['/api/v1/cms/publications', '{"probe":true}'],
      [`/api/v1/cms/reviews/${UUID}/assignments`, '{"probe":true}'],
      [`/api/v1/cms/entries/${UUID}/reviews`, '{"probe":true}'],
    ] as const) {
      const response = await request.post(`${origin(baseURL)}${path}`, {
        data: body,
        headers: {
          origin: 'https://evil.example.test',
          'content-type': 'application/json',
          cookie: 'wj_session_ref=s; wj_csrf=forged',
          'idempotency-key': 'idem-key-s11-probe-0001',
        },
        failOnStatusCode: false,
        maxRedirects: 0,
      });
      expect(response.status(), path).toBeGreaterThanOrEqual(400);
      expect(response.headers()['cache-control'], path).toBe('no-store');
    }
  });

  test('[S11-WEB] the protected reads never answer without a verified service', async ({
    request,
    baseURL,
  }) => {
    for (const path of [
      `/api/v1/cms/entries/${UUID}/workflow`,
      `/api/v1/cms/reviews/${UUID}`,
      '/api/v1/cms/reviews',
    ]) {
      const response = await request.get(`${origin(baseURL)}${path}`, {
        failOnStatusCode: false,
        maxRedirects: 0,
      });
      expect([400, 401, 403, 502, 503]).toContain(response.status());
      expect(response.headers()['cache-control'], path).toBe('no-store');
    }
  });
});
