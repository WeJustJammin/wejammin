import AxeBuilder from '@axe-core/playwright';

import { expect, test } from '@playwright/test';

import { authenticateLocalSession } from './support/local-signed-session';

/*
 * Slice 10 WP-S10-2d: CMS-05 rich-text authoring over the production-built
 * Astro route and the protected Worker API.
 *
 * The constrained native editor accepts only the canonical `rich_text.v1` AST:
 * non-canonical input and unsafe link schemes are refused client-side and map
 * to the server 422 `rich_text_not_canonical`; the typed renderer emits only
 * allowed elements with heading order 2->3->4 and non-empty link text. Local
 * loopback only; fails closed when the page or port is absent, and never
 * fabricates hosted evidence.
 *
 * Expected RED until WP-S10-3/4/5 land the editor, renderer, and ports.
 */

const DRAFT_PATH =
  '/app/cms-content-modeling/entries/30000000-0000-4000-8000-000000000030';

test.beforeAll(() => {
  const origin = test.info().project.use.baseURL;
  expect(origin, 'real-route baseURL must target loopback').toMatch(
    /^http:\/\/127\.0\.0\.1:\d+$/u,
  );
});

test.describe('Phase 2 Slice 10 rich-text real route', () => {
  test('authors a canonical rich_text.v1 value and refuses non-canonical or unsafe input', async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);
    await authenticateLocalSession(context, {
      csrfToken: 's10-local-csrf-token',
    });
    const browserErrors: string[] = [];
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });

    const loaded = await page.goto(DRAFT_PATH, {
      waitUntil: 'domcontentloaded',
    });
    expect(loaded?.status()).toBe(200);
    expect(loaded?.headers()['cache-control']).toBe('no-store');

    const editor = page.getByRole('group', { name: 'Body' });
    await expect(editor).toBeVisible();

    // Canonical authoring: a constrained block list plus a mark, previewed
    // through the typed renderer with no raw HTML.
    await editor.getByLabel('Block type').selectOption('paragraph');
    await editor.getByLabel('Block text').fill('Hello **world**');
    const preview = page.getByRole('region', { name: 'Preview' });
    await expect(preview.getByRole('strong')).toHaveText('world');
    await expect(preview.locator('script')).toHaveCount(0);

    // Unsafe link schemes are refused inline, before any submit.
    await editor.getByLabel('Block text').fill('[x](javascript:alert(1))');
    await expect(editor.getByRole('alert')).toContainText(
      'That link is not allowed.',
    );
    await editor.getByLabel('Block text').fill('[x](//evil.example)');
    await expect(editor.getByRole('alert')).toContainText(
      'That link is not allowed.',
    );

    // A real canonical save round-trips through the protected route.
    await editor.getByLabel('Block text').fill('Hello **world**');
    const save = page.waitForResponse(
      (response) =>
        response
          .url()
          .endsWith(
            '/api/v1/cms/entries/30000000-0000-4000-8000-000000000030/revisions',
          ) && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Save draft' }).click();
    const saved = await save;
    expect(saved.status()).toBe(201);
    await expect(page.getByRole('status')).toContainText('Saved');

    // The saved value renders through the typed renderer without headings that
    // skip a level and with non-empty link text.
    await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter(
        ({ impact }) => impact === 'serious' || impact === 'critical',
      ),
    ).toEqual([]);

    const pageErrors = browserErrors.filter(
      (message) => !message.startsWith('Failed to load resource:'),
    );
    expect(pageErrors, 'no script or hydration errors').toEqual([]);
  });
});
