import { expect, test, type Page } from '@playwright/test';

import { newLaneContext } from './support/s09-lane-browser';
import { lanePersonId } from './support/s09-lane-ids';
import {
  REGISTRY,
  completeStepUpViaUi,
  enrollFactorViaUi,
  expireStepUp,
  readWorkerJson,
  reviewApiPath,
  uuidIn,
  waitForWorkbench,
} from './support/s09-lane-flows';
import { actor, assignReviewer, openReview } from './support/s09-lane-scenarios';

/**
 * Slice 09 schema review and assignment on the production-built Astro routes in
 * Google Chrome. Every record is produced by clicking through the real forms and
 * the real Worker routes; the Worker's persistence ports are the loopback
 * stateful lane (tests/e2e/support/s09-lane-*.ts). This is not database, RLS,
 * identity-provider or hosted evidence.
 */

test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' });

const REVIEWS = `${REGISTRY}/schema-reviews`;

test('[P2-S09-AC-1016] [P2-S09-AC-1017] [P2-S09-AC-1018] guards the review route: sign-in redirect, 400, concealed 404 and 403', async ({
  browser,
}) => {
  const stage = await openReview(browser);
  const reviewId = uuidIn(stage.reviewPath).at(-1) as string;

  // Unauthenticated: the same safe sign-in redirect, carrying only the route.
  const anonymous = await browser.newContext({ baseURL: 'http://127.0.0.1:4324' });
  const anonPage = await anonymous.newPage();
  await anonPage.goto(stage.reviewPath);
  expect(new URL(anonPage.url()).pathname).toBe('/auth/sign-in');
  expect(new URL(anonPage.url()).searchParams.get('returnTo')).toBe(stage.reviewPath);
  await anonymous.close();

  // Expired session (access token already past `exp`): same redirect. The
  // owner enrolled an authenticator, so its live session is a later generation.
  const expired = await newLaneContext(browser, 'reviewer', stage.testId, {
    expiresAt: Math.floor(Date.now() / 1_000) - 60,
  });
  const expiredPage = await expired.newPage();
  await expiredPage.goto(stage.reviewPath);
  expect(new URL(expiredPage.url()).pathname).toBe('/auth/sign-in');
  await expired.close();

  const statusAs = async (role: 'reviewer' | 'outsider' | 'reader', path: string) => {
    const context = await newLaneContext(browser, role, stage.testId);
    const response = await (await context.newPage()).goto(path);
    const status = response?.status();
    await context.close();
    return status;
  };
  const ownerStatus = async (path: string) =>
    (await stage.owner.page.goto(path))?.status();
  // Malformed identifier: 400 before any read.
  expect(await ownerStatus(`${REVIEWS}/not-a-uuid`)).toBe(400);
  // Well-formed but unknown: disclosure-safe 404.
  expect(await ownerStatus(`${REVIEWS}/00000000-0000-4000-8000-000000000000`)).toBe(404);
  // A reviewer with no assignment to this review cannot learn it exists.
  expect(await statusAs('reviewer', stage.reviewPath)).toBe(404);
  // Visible review without the review scope: 403.
  expect(await statusAs('outsider', stage.reviewPath)).toBe(403);
  expect(await statusAs('reader', stage.reviewPath)).toBe(403);
  // The owner reads it, and the API agrees about the identifier.
  expect(await ownerStatus(stage.reviewPath)).toBe(200);
  const api = await readWorkerJson(stage.owner.page, reviewApiPath(stage.reviewPath));
  expect(api.id).toBe(reviewId);
  await stage.owner.context.close();
});

const assignmentRegion = (page: Page) =>
  page.getByRole('region', { name: 'Reviewer assignments' });

test('[P2-S09-AC-1020] [P2-S09-AC-1049] the owner assigns and revokes a reviewer and the reviewer gains and loses the decision form', async ({
  browser,
}) => {
  const stage = await openReview(browser);
  await assignReviewer(stage);
  const owner = stage.owner.page;
  await expect(owner.getByText(/Reviewer assignment is active/u)).toBeVisible({
    timeout: 15_000,
  });
  await expect(assignmentRegion(owner)).toContainText('Reviewer reviewer');

  // The assigned reviewer reaches the native decision form on the review route.
  const reviewer = await actor(browser, 'reviewer', stage.testId);
  await reviewer.page.goto(stage.reviewPath, { waitUntil: 'networkidle' });
  await expect(
    reviewer.page.getByRole('radio', { name: 'Approve the frozen evidence' }),
  ).toBeVisible();
  // ...and never the owner-only assignment surfaces or any private identifier.
  await expect(reviewer.page.getByRole('region', { name: 'Reviewer assignments' })).toHaveCount(0);
  expect(await reviewer.page.content()).not.toContain(lanePersonId('reviewer'));

  // Revoke through the row's own form; the owner view records the revocation.
  await owner.goto(stage.reviewPath, { waitUntil: 'networkidle' });
  await waitForWorkbench(owner);
  await assignmentRegion(owner)
    .getByRole('button', { name: 'Save reviewer assignment' })
    .click();
  await expect(owner.getByText(/Reviewer assignment (was )?revoked/iu)).toBeVisible({
    timeout: 15_000,
  });

  // The reviewer still sees the review but now the missing-prerequisite copy.
  await reviewer.page.goto(stage.reviewPath, { waitUntil: 'networkidle' });
  await expect(
    reviewer.page.getByText(/your assignment to decide it is missing or has ended/u),
  ).toBeVisible();
  await expect(
    reviewer.page.getByRole('radio', { name: 'Approve the frozen evidence' }),
  ).toHaveCount(0);
});

test('[P2-S09-AC-910] [P2-S09-AC-911] [P2-S09-AC-1027] [P2-S09-AC-1029] [P2-S09-AC-1069] [P2-S09-AC-1127] a stale proof sends the decision to /step-up and back with the draft and the original Idempotency-Key', async ({
  browser,
}) => {
  const stage = await openReview(browser);
  await assignReviewer(stage);
  const reviewer = await actor(browser, 'reviewer', stage.testId);
  const page = reviewer.page;
  const secret = await enrollFactorViaUi(page);
  // The ten-minute window lapses (server-side proof age), a factor stays.
  await expireStepUp(page, stage.testId, 'reviewer');

  const decisionPosts: { body: string }[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/schema-reviews/'))
      decisionPosts.push({ body: request.postData() ?? '' });
  });
  await page.goto(stage.reviewPath, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  const approve = page.getByRole('radio', { name: 'Approve the frozen evidence' });
  await expect(page.getByText('Step-up required before commit')).toBeVisible();
  const key = await page.locator('input[name="idempotency-key"]').first().inputValue();
  expect(key.length).toBeGreaterThanOrEqual(8);

  await approve.check();
  await page.getByRole('button', { name: 'Save review decision' }).click();
  await page.waitForURL(/\/step-up\?returnTo=/u, { timeout: 15_000 });
  expect(new URL(page.url()).searchParams.get('returnTo')).toBe(stage.reviewPath);
  expect(decisionPosts).toHaveLength(1);

  await completeStepUpViaUi(page, secret, stage.reviewPath);
  await waitForWorkbench(page);
  // Back on the originating form: nothing was replayed for the user, the draft
  // choice is restored with the original Idempotency-Key, and the notice says so.
  await expect(page.getByText('Verification complete. Review and confirm to continue.')).toBeVisible();
  await expect(approve).toBeChecked();
  expect(await page.locator('input[name="idempotency-key"]').first().inputValue()).toBe(key);
  await page.waitForTimeout(750);
  expect(decisionPosts).toHaveLength(1);

  await page.getByRole('button', { name: 'Save review decision' }).click();
  await expect.poll(() => decisionPosts.length, { timeout: 15_000 }).toBe(2);
  expect(decisionPosts[1]?.body).toContain(key);
  await expect(page.getByRole('definition').filter({ hasText: /^approved$/u }).first()).toBeVisible({
    timeout: 15_000,
  });
  const api = await readWorkerJson(page, reviewApiPath(stage.reviewPath));
  expect(api.state).toBe('approved');
});
