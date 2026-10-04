import { expect, test, type Page } from '@playwright/test';

import {
  authenticateLane,
  closeLaneContexts,
} from './support/s09-lane-browser';
import {
  enrollFactorViaUi,
  expireStepUp,
  waitForWorkbench,
} from './support/s09-lane-flows';
import {
  actor,
  assignReviewer,
  openReview,
} from './support/s09-lane-scenarios';

/**
 * Cross-tab auth scope on the production-built Astro routes in Google Chrome
 * (Codex R14c2 #4). The session cookies are shared by every tab, so signing out
 * or signing in as someone else in tab B must leave tab A holding nothing of the
 * previous person: its step-up storage is cleared, the mounted page is replaced
 * by a reload under the current session, and the retained command cannot be
 * submitted in between. The proof is the loopback session seam, so this is not
 * hosted or provider evidence.
 */

test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' });

test.afterEach(closeLaneContexts);

const DECISIONS = /\/api\/v1\/cms\/schema-reviews\/[^/]+\/decisions/u;

const drafts = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    Object.keys(window.sessionStorage).filter((key) =>
      key.startsWith('wj-step-up-draft:'),
    ),
  );

/** True while the document that set the marker is still the one on screen. */
const sameDocument = (page: Page): Promise<boolean> =>
  page
    .evaluate(
      () => (window as unknown as { __tabA?: string }).__tabA === 'mounted',
    )
    .catch(() => false);

const markDocument = (page: Page): Promise<void> =>
  page.evaluate(() => {
    (window as unknown as { __tabA?: string }).__tabA = 'mounted';
  });

const interruptDecision = async (
  page: Page,
  target: string,
  testId: string,
): Promise<void> => {
  await expireStepUp(page, testId, 'reviewer');
  await page.goto(target, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  await page.waitForTimeout(300);
  await page
    .getByRole('radio', { name: 'Approve the frozen evidence' })
    .check();
  await page.getByRole('button', { name: 'Save review decision' }).click();
  await page.waitForURL(/\/step-up\?returnTo=/u, { timeout: 15_000 });
};

const reviewerOnStepUp = async (browser: Parameters<typeof openReview>[0]) => {
  const stage = await openReview(browser);
  await assignReviewer(stage);
  const first = await actor(browser, 'reviewer', stage.testId);
  await enrollFactorViaUi(first.page);
  await interruptDecision(first.page, stage.reviewPath, stage.testId);
  expect(await drafts(first.page)).toHaveLength(1);
  await markDocument(first.page);
  return { stage, first, page: first.page };
};

test('the interrupted decision in tab A is cleared and replaced when tab B signs in as someone else', async ({
  browser,
}) => {
  const { stage, first, page } = await reviewerOnStepUp(browser);
  const sent: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' && DECISIONS.test(request.url()))
      sent.push(request.url());
  });

  // Tab B: the cookie jar now belongs to another person and tab B loads a page.
  const tabB = await first.context.newPage();
  await first.context.clearCookies();
  await authenticateLane(first.context, 'reviewer2', stage.testId);
  await tabB.goto('/step-up', { waitUntil: 'networkidle' });

  // Tab A is told (BroadcastChannel) and reloads; nothing it held survives.
  await expect.poll(() => sameDocument(page), { timeout: 20_000 }).toBe(false);
  await page.waitForLoadState('networkidle');
  expect(await drafts(page)).toHaveLength(0);
  expect(sent).toEqual([]);
});

test('tab A swallows a submit that arrives before any signal once the session changed under it', async ({
  browser,
}) => {
  const stage = await openReview(browser);
  await assignReviewer(stage);
  const first = await actor(browser, 'reviewer', stage.testId);
  const page = first.page;
  await enrollFactorViaUi(page);
  await page.goto(stage.reviewPath, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  await page.waitForTimeout(300);
  // The retained command: a decision chosen in the mounted form.
  await page
    .getByRole('radio', { name: 'Approve the frozen evidence' })
    .check();
  await markDocument(page);
  const sent: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET' && DECISIONS.test(request.url()))
      sent.push(request.url());
  });

  // No other tab loads a page, so no broadcast is sent: only the shared cookie
  // jar changes. The first interaction in tab A is the only thing that can notice.
  await first.context.clearCookies();
  await authenticateLane(first.context, 'reviewer2', stage.testId);
  await page
    .getByRole('button', { name: 'Save review decision' })
    .click({ noWaitAfter: true })
    .catch(() => undefined);

  await expect.poll(() => sameDocument(page), { timeout: 20_000 }).toBe(false);
  await page.waitForLoadState('networkidle');
  expect(sent).toEqual([]);
  expect(await drafts(page)).toHaveLength(0);
});

test('signing out in tab B sends tab A to sign-in and leaves no draft behind', async ({
  browser,
}) => {
  const { first, page } = await reviewerOnStepUp(browser);

  const tabB = await first.context.newPage();
  await first.context.clearCookies();
  await tabB.goto('/auth/sign-in', { waitUntil: 'networkidle' });

  await page.waitForURL(/\/auth\/sign-in/u, { timeout: 20_000 });
  expect(await drafts(page)).toHaveLength(0);
});
