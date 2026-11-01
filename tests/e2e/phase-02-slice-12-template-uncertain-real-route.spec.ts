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
    // FE03 unknown-outcome cell (DEC-242): the island reads the latest version by itself before it
    // offers a retry, so each read is armed before the save that ends in an unknown outcome.
    const nextRead = () =>
      page.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          response.url().endsWith('/api/v1/cms/templates/release-note'),
      );
    const reconciled = async (
      read: ReturnType<typeof nextRead>,
    ): Promise<void> => {
      expect((await read).status()).toBe(200);
      await expect(
        page.getByText('The current parent is still latest.'),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Save successor draft' }),
      ).toBeEnabled();
    };

    // A lost response leaves the mutation outcome genuinely unknown: the
    // browser transport never receives a status for the first two attempts.
    const loseResponse = async (): Promise<void> => {
      await page.route(SUBMIT_URL, (route) => route.abort('connectionreset'));
    };
    await loseResponse();
    await page.getByRole('textbox', { name: 'Audience' }).fill('recovered');
    const firstRead = nextRead();
    await page.getByRole('button', { name: 'Save successor draft' }).click();
    await expect(page.getByRole('alert')).toContainText(
      'The result is unknown.',
    );
    await expect(page.getByRole('alert')).toBeFocused();
    await expect(page.getByRole('textbox', { name: 'Audience' })).toHaveValue(
      'recovered',
    );

    // The unchanged retry must reuse the same idempotency key.
    await reconciled(firstRead);
    const secondRead = nextRead();
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
    await reconciled(secondRead);

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
    const savedStatus = page
      .getByRole('status')
      .filter({ hasText: 'Draft version saved.' });
    await expect(savedStatus).toContainText('Draft version saved.');
    await expect(savedStatus).toContainText(`version ${nextVersion}`);
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

  for (const width of [375, 1280]) {
    test(`B-WIDTH-001 commit width stays within one pixel during a held POST at ${width}px`, async ({
      context,
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await authenticateLocalSession(context, {
        csrfToken: 's12-local-csrf-token',
      });
      const browserErrors = collectBrowserErrors(page);
      let release = (): void => undefined;
      let complete = (): void => undefined;
      let intercepted = false;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const completed = new Promise<void>((resolve) => {
        complete = resolve;
      });
      await page.route(SUBMIT_URL, async (route) => {
        intercepted = true;
        try {
          await held;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: '{}',
          });
        } finally {
          complete();
        }
      });
      try {
        const loaded = await page.goto(PATH, { waitUntil: 'domcontentloaded' });
        expect(loaded?.status()).toBe(200);
        await expect(
          page.locator(
            'astro-island[component-url*="CmsTemplateEditDesigner"]',
          ),
        ).not.toHaveAttribute('ssr', '');
        const form = page
          .getByRole('region', { name: 'Edit template draft' })
          .locator('form');
        const commit = form.getByRole('button', {
          name: 'Save successor draft',
        });
        const audience = form.getByRole('textbox', { name: 'Audience' });
        await expect(commit).toBeEnabled();
        await audience.fill('before-pending');
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        const idle = await commit.boundingBox();
        expect(
          idle,
          'idle action must have actual browser layout',
        ).not.toBeNull();
        const [post] = await Promise.all([
          page.waitForRequest(
            (request) =>
              request.method() === 'POST' &&
              request.url().endsWith('/api/v1/cms/templates/versions'),
          ),
          commit.click(),
        ]);
        await expect
          .poll(() => intercepted, {
            message: 'POST must be held at the browser transport',
          })
          .toBe(true);
        expect(post.postDataJSON()).toMatchObject({
          audience: 'before-pending',
        });
        await expect(commit).toBeDisabled();
        await expect(commit).toHaveAttribute('aria-busy', 'true');
        await expect(commit).toContainText('Saving successor draft');
        await expect(form.locator(':disabled')).toHaveCount(1);
        const fields = form.locator('input, select, textarea');
        expect(await fields.count()).toBeGreaterThan(0);
        for (const field of await fields.all())
          await expect(field).toBeEnabled();
        await expect(audience).toBeEditable();
        await audience.fill('during-pending');
        await expect(audience).toHaveValue('during-pending');
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        const pending = await commit.boundingBox();
        expect(
          pending,
          'pending action must have actual browser layout',
        ).not.toBeNull();
        if (idle === null || pending === null)
          throw new Error('Commit layout disappeared.');
        expect(
          Math.abs(pending.width - idle.width),
          `visible commit width at ${width}px`,
        ).toBeLessThanOrEqual(1);
        expect(
          browserErrors.filter(
            (message) =>
              message !==
              'Failed to load resource: the server responded with a status of 404 (Not Found)',
          ),
        ).toEqual([]);
      } finally {
        release();
        if (intercepted) await completed;
        await page.unroute(SUBMIT_URL);
      }
    });
  }
});
