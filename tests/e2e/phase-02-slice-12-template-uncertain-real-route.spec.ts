import AxeBuilder from '@axe-core/playwright';

import { expect, test, type Page } from '@playwright/test';

import { authenticateLocalSession } from './support/local-signed-session';

const PATH = '/app/cms-content-modeling/templates/release-note';
const SUBMIT_URL = '**/api/v1/cms/templates/versions';

const collectBrowserErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
};

test.describe('Phase 2 Slice 12 uncertain template mutation', () => {
  test('an unknown outcome keeps values, reuses the idempotency key, and reconciles before retry', async ({
    context,
    page,
  }) => {
    test.setTimeout(90_000);
    await authenticateLocalSession(context, {
      csrfToken: 's12-local-csrf-token',
    });
    const browserErrors = collectBrowserErrors(page);
    const abortedPosts: string[] = [];
    page.on('requestfailed', (request) => {
      if (
        request.method() === 'POST' &&
        request.url().endsWith('/api/v1/cms/templates/versions')
      )
        abortedPosts.push(request.failure()?.errorText ?? 'failed');
    });
    const submittedKeys: string[] = [];
    const submittedIfMatch: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        request.url().endsWith('/api/v1/cms/templates/versions')
      ) {
        submittedKeys.push(request.headers()['idempotency-key'] ?? '');
        submittedIfMatch.push(request.headers()['if-match'] ?? '');
      }
    });

    const loaded = await page.goto(PATH, { waitUntil: 'domcontentloaded' });
    expect(loaded?.status()).toBe(200);
    expect(loaded?.headers()['cache-control']).toBe('no-store');
    await expect(
      page.locator('astro-island[component-url*="CmsTemplateEditDesigner"]'),
    ).not.toHaveAttribute('ssr', '');
    await expect(
      page.getByRole('button', { name: 'Save successor draft' }),
    ).toBeEnabled();
    const editNotice = await page
      .getByText(/^Editing version \d+\./u)
      .textContent();
    const baseVersion = editNotice?.match(/Editing version (\d+)\./u)?.[1];
    if (baseVersion === undefined)
      throw new Error('The template page did not identify its base version.');
    const nextVersion = String(BigInt(baseVersion) + 1n);

    // A lost response leaves the mutation outcome genuinely unknown: the
    // browser transport never receives a status for the first two attempts.
    const loseResponse = async (): Promise<void> => {
      await page.route(SUBMIT_URL, (route) => route.abort('connectionreset'));
    };
    await loseResponse();
    await page.getByRole('textbox', { name: 'Audience' }).fill('recovered');
    await page.getByRole('button', { name: 'Save successor draft' }).click();
    await expect(page.getByRole('alert')).toContainText(
      'The result is unknown.',
    );
    await expect(page.getByRole('alert')).toBeFocused();
    await expect(page.getByRole('textbox', { name: 'Audience' })).toHaveValue(
      'recovered',
    );

    // The unchanged retry must reuse the same idempotency key.
    await page.getByRole('button', { name: 'Save successor draft' }).click();
    await expect(page.getByRole('alert')).toContainText(
      'The result is unknown.',
    );
    expect(submittedKeys).toHaveLength(2);
    expect(submittedKeys[0]).not.toBe('');
    expect(submittedKeys[1]).toBe(submittedKeys[0]);
    expect(submittedIfMatch).toEqual([`"${baseVersion}"`, `"${baseVersion}"`]);

    // Reconciliation reads the real protected route; the observed parent is
    // still latest, so the guard permits a retry of the retained values.
    await page.unroute(SUBMIT_URL);
    await page.getByRole('button', { name: 'Check latest version' }).click();
    await expect(
      page.getByText('The current parent is still latest.'),
    ).toBeVisible();

    const realPost = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/cms/templates/versions') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Save successor draft' }).click();
    const result = await realPost;
    expect(result.status()).toBe(201);
    expect(submittedKeys).toHaveLength(3);
    expect(submittedKeys[2]).toBe(submittedKeys[0]);
    expect(submittedIfMatch[2]).toBe(`"${baseVersion}"`);
    await expect(page.getByRole('status')).toContainText(
      'Draft version saved.',
    );
    await expect(page.getByRole('status')).toContainText(
      `version ${nextVersion}`,
    );
    await expect(page.getByRole('textbox', { name: 'Audience' })).toHaveValue(
      'recovered',
    );

    const pageErrors = browserErrors.filter(
      (message) => !message.startsWith('Failed to load resource:'),
    );
    expect(pageErrors, 'no script or hydration errors').toEqual([]);
    const resetErrors = browserErrors.filter((message) =>
      message.includes('net::ERR_CONNECTION_RESET'),
    );
    expect(resetErrors, 'one console reset per lost response').toHaveLength(2);
    expect(abortedPosts, 'both lost responses failed at the transport').toEqual(
      expect.arrayContaining(['net::ERR_CONNECTION_RESET']),
    );
    expect(abortedPosts).toHaveLength(2);
    expect(
      browserErrors.filter(
        (message) =>
          !resetErrors.includes(message) &&
          message !==
            'Failed to load resource: the server responded with a status of 404 (Not Found)',
      ),
      'no console errors beyond the lost responses and optional dev-asset 404',
    ).toEqual([]);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter(
        ({ impact }) => impact === 'serious' || impact === 'critical',
      ),
    ).toEqual([]);
  });
});
