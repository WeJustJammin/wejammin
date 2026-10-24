import AxeBuilder from '@axe-core/playwright';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { authenticateLocalSession } from './support/local-signed-session';

const PATH = '/app/cms-content-modeling/templates/release-note';

test('CMS-11 keeps a stale tab’s unsent values through a real-route conflict and explicit rebase', async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);
  await authenticateLocalSession(context, {
    csrfToken: 's12-local-csrf-token',
  });
  const stalePage = await context.newPage();
  const browserErrors: string[] = [];
  for (const templatePage of [page, stalePage]) {
    templatePage.on('pageerror', (error) => browserErrors.push(error.message));
    templatePage.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    templatePage.on('requestfailed', (request) =>
      browserErrors.push(
        `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'failed'}`,
      ),
    );
  }
  const first = await page.goto(PATH, { waitUntil: 'domcontentloaded' });
  const second = await stalePage.goto(PATH, {
    waitUntil: 'domcontentloaded',
  });
  expect(first?.status()).toBe(200);
  expect(second?.status()).toBe(200);
  expect(first?.headers()['cache-control']).toBe('no-store');
  for (const templatePage of [page, stalePage])
    try {
      await expect(
        templatePage.locator(
          'astro-island[component-url*="CmsTemplateEditDesigner"]',
        ),
      ).not.toHaveAttribute('ssr', '');
    } catch (error) {
      throw new Error(
        `Template island did not hydrate: ${browserErrors.join(' | ')}`,
        { cause: error },
      );
    }
  await expect(
    page.getByRole('button', { name: 'Save successor draft' }),
  ).toBeEnabled();
  await expect(
    stalePage.getByRole('button', { name: 'Save successor draft' }),
  ).toBeEnabled();

  await page.getByRole('textbox', { name: 'Audience' }).fill('members');
  await stalePage
    .getByRole('textbox', { name: 'Audience' })
    .fill('collaborators');

  const firstPost = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/cms/templates/versions') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Save successor draft' }).click();
  const firstResult = await firstPost;
  expect(firstResult.status()).toBe(201);
  expect(firstResult.request().headers()['if-match']).toBe('"1"');
  // The page carries several polite status regions (the designer's, the template rate-limit notice and the
  // governed review panel's two), so the saved-draft announcement is found by its text, not by role alone.
  const savedStatus = (templatePage: Page): Locator =>
    templatePage
      .getByRole('status')
      .filter({ hasText: 'Draft version saved.' });
  await expect(savedStatus(page)).toHaveCount(1);
  await expect(savedStatus(page)).toContainText('Draft version saved.');
  await expect(savedStatus(page)).toContainText('version 2');

  const stalePost = stalePage.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/cms/templates/versions') &&
      response.request().method() === 'POST',
  );
  await stalePage.getByRole('button', { name: 'Save successor draft' }).click();
  const staleResult = await stalePost;
  expect(staleResult.status()).toBe(409);
  expect(staleResult.request().headers()['if-match']).toBe('"1"');
  await expect(stalePage.getByRole('alert')).toContainText(
    'The server reported a conflict.',
  );
  await expect(stalePage.getByRole('alert')).toBeFocused();
  await expect(
    stalePage.getByRole('textbox', { name: 'Audience' }),
  ).toHaveValue('collaborators');

  await stalePage.getByRole('button', { name: 'Check latest version' }).click();
  await expect(
    stalePage.getByRole('heading', { name: 'Latest version 2' }),
  ).toBeVisible();
  await expect(
    stalePage.getByRole('heading', { name: 'Your unsent values' }),
  ).toBeVisible();
  await expect(
    stalePage.getByRole('textbox', { name: 'Audience' }),
  ).toHaveValue('collaborators');
  await stalePage
    .getByRole('button', {
      name: 'Use version 2 as parent for my displayed values',
    })
    .click();
  await expect(stalePage.getByText('Editing version 2.')).toBeVisible();
  await expect(
    stalePage.getByRole('textbox', { name: 'Audience' }),
  ).toHaveValue('collaborators');

  const rebasedPost = stalePage.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/cms/templates/versions') &&
      response.request().method() === 'POST',
  );
  await stalePage.getByRole('button', { name: 'Save successor draft' }).click();
  const rebasedResult = await rebasedPost;
  expect(rebasedResult.status()).toBe(201);
  expect(rebasedResult.request().headers()['if-match']).toBe('"2"');
  await expect(savedStatus(stalePage)).toContainText('version 3');
  const axe = await new AxeBuilder({ page: stalePage }).analyze();
  expect(
    axe.violations.filter(
      ({ impact }) => impact === 'serious' || impact === 'critical',
    ),
  ).toEqual([]);
});
