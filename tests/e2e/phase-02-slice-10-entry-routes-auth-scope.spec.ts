import { expect, test, type Page } from '@playwright/test';

/**
 * The CMS entry routes answer from frontmatter, so their document shell must be
 * processed Astro markup for its `<script src>` tags to be bundled. A shell
 * built as a runtime HTML string ships unbuilt relative `.ts` URLs, the module
 * never runs, and a tab keeps the previous account's protected metadata after
 * an account change in another tab (Codex R14f #1). Each route below is
 * answered without an upstream call (no database or API dependency): the
 * proof is that the cross-tab auth-scope guard actually executes there.
 */
// A structurally malformed id is 400 "Invalid request" (DEC-145, BE03b:172),
// never a not-found state, and is answered without an upstream call; the create
// page needs its CMS-03B-14 preparation read, which has no upstream here and is
// the 503 degraded state.
const ROUTES: readonly (readonly [string, number])[] = [
  ['/app/cms-content-modeling/entries/new', 503],
  ['/app/cms-content-modeling/entries/not-a-uuid', 400],
  ['/app/cms-content-modeling/entries/not-a-uuid/revisions', 400],
  [
    '/app/cms-content-modeling/entries/not-a-uuid/conflicts/also-not-a-uuid',
    400,
  ],
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

const markDocument = (page: Page): Promise<void> =>
  page.evaluate(() => {
    (window as unknown as { __tabA?: string }).__tabA = 'mounted';
  });

const sameDocument = (page: Page): Promise<boolean> =>
  page
    .evaluate(
      () => (window as unknown as { __tabA?: string }).__tabA === 'mounted',
    )
    .catch(() => false);

for (const [route, status] of ROUTES) {
  test(`[R14f-1] ${route} loads working scripts and the auth-scope guard reloads a stale tab`, async ({
    page,
  }) => {
    await page.context().addCookies([
      {
        name: 'wj_session_ref',
        value: 'r14f-session',
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

    const response = await page.goto(route, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(status);

    // Every script the document names was served as JavaScript, not a 404.
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

    // The guard executes: the scope changes under this tab, the tab is told to
    // re-read (focus), and it replaces itself with a reload.
    await markDocument(page);
    expect(await sameDocument(page)).toBe(true);
    await setScope(page, SCOPE_B);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect
      .poll(() => sameDocument(page), { timeout: 20_000 })
      .toBe(false);
  });
}
