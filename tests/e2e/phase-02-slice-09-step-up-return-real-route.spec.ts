import { expect, test, type Page } from '@playwright/test';

import { lanePersonId } from './support/s09-lane-ids';

import {
  authenticateLane,
  newTestId,
  closeLaneContexts,
} from './support/s09-lane-browser';
import {
  completeStepUpViaUi,
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
 * Slice 09 step-up return routing on the production-built Astro routes in
 * Google Chrome (BE00 / FE01): an interrupted form computes `returnTo` from its
 * current path and query (path alone when the combination is unusable), and the
 * /step-up page itself refuses any unsafe `returnTo`, continuing at /app. The
 * proof is the loopback TOTP seam, so this is not hosted or provider evidence.
 */

test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' });

test.afterEach(closeLaneContexts);

const LONG = 'a'.repeat(600);

/** [query appended to the current page, whether the query survives in returnTo]. */
const FORM_VARIANTS: readonly (readonly [string, boolean])[] = [
  ['?x=1', true],
  ['?x=%5C', false],
  ['?x=%2F', false],
  ['?next=https%3A%2F%2Fevil.example', false],
  [`?x=${LONG}`, false],
];

const interruptDecision = async (
  page: Page,
  target: string,
  testId: string,
): Promise<URL> => {
  await expireStepUp(page, testId, 'reviewer');
  await page.goto(target, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  await page.waitForTimeout(300);
  await page
    .getByRole('radio', { name: 'Approve the frozen evidence' })
    .check();
  await page.getByRole('button', { name: 'Save review decision' }).click();
  await page.waitForURL(/\/step-up\?returnTo=/u, { timeout: 15_000 });
  return new URL(page.url());
};

test('[P2-S09-AC-910] an interrupted form returns to its path and query when safe and to the path alone when the query is unusable', async ({
  browser,
}) => {
  const stage = await openReview(browser);
  await assignReviewer(stage);
  const reviewer = await actor(browser, 'reviewer', stage.testId);
  const page = reviewer.page;
  const secret = await enrollFactorViaUi(page);

  for (const [query, survives] of FORM_VARIANTS) {
    const url = await interruptDecision(
      page,
      `${stage.reviewPath}${query}`,
      stage.testId,
    );
    const returnTo = url.searchParams.get('returnTo') ?? '';
    expect(url.pathname).toBe('/step-up');
    expect(returnTo.startsWith('/app/cms-content-modeling/')).toBe(true);
    expect(returnTo.length).toBeLessThanOrEqual(512);
    if (survives) expect(returnTo).toBe(`${stage.reviewPath}${query}`);
    else expect(returnTo).toBe(stage.reviewPath);
    // The proof returns the reviewer to exactly that target.
    await completeStepUpViaUi(
      page,
      secret,
      (target) => `${target.pathname}${target.search}` === returnTo,
    );
  }
});

test('[P2-S09-AC-911][P2-S09-AC-1032] after logout a different signed-in user in the same tab restores nothing of the interrupted decision', async ({
  browser,
}) => {
  const stage = await openReview(browser);
  await assignReviewer(stage);
  await expect(
    stage.owner.page.getByText(/Reviewer assignment is active/u),
  ).toBeVisible({ timeout: 45_000 });
  // The helper's Reason locator is ambiguous once a first assignment shows its
  // revoke form, so the second reviewer is assigned inside the assign group.
  const assign = stage.owner.page.getByRole('group', {
    name: 'Assign a reviewer',
  });
  await assign
    .getByRole('textbox', { name: 'Reviewer person ID' })
    .fill(lanePersonId('reviewer2'));
  await assign
    .getByRole('textbox', { name: /Expires at/u })
    .fill(new Date(Date.now() + 24 * 3_600_000).toISOString());
  await assign
    .getByRole('textbox', { name: /Reason/u })
    .fill('Second reviewer for the same review');
  await stage.owner.page
    .locator('button[form="content-schema-registry-review-assignment-form"]')
    .click();
  await expect(
    stage.owner.page.getByRole('region', { name: 'Reviewer assignments' }),
  ).toContainText('Reviewer reviewer2', { timeout: 45_000 });
  const first = await actor(browser, 'reviewer', stage.testId);
  const page = first.page;
  await enrollFactorViaUi(page);
  await interruptDecision(page, stage.reviewPath, stage.testId);

  // The interrupted decision is held in this tab, bound to the first reviewer.
  const drafts = () =>
    page.evaluate(() =>
      Object.keys(window.sessionStorage).filter((key) =>
        key.startsWith('wj-step-up-draft:'),
      ),
    );
  expect(await drafts()).toHaveLength(1);
  const firstScope = (await first.context.cookies()).find(
    (cookie) => cookie.name === 'wj_step_up_scope',
  )?.value;
  expect(firstScope).toMatch(/^[A-Za-z0-9_-]{32}$/u);

  // Logout leaves the tab (and its sessionStorage) in place and drops every
  // session cookie; a second reviewer then signs in on the same tab.
  await first.context.clearCookies();
  await authenticateLane(first.context, 'reviewer2', stage.testId);
  await page.goto(stage.reviewPath, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  await page.waitForTimeout(500);

  const secondScope = (await first.context.cookies()).find(
    (cookie) => cookie.name === 'wj_step_up_scope',
  )?.value;
  expect(secondScope).toMatch(/^[A-Za-z0-9_-]{32}$/u);
  expect(secondScope).not.toBe(firstScope);
  // Nothing of the first reviewer's decision restores, and the draft is gone.
  await expect(
    page.getByRole('radio', { name: 'Approve the frozen evidence' }),
  ).not.toBeChecked();
  await expect(
    page.getByText('Verification complete. Review and confirm to continue.'),
  ).toHaveCount(0);
  expect(await drafts()).toHaveLength(0);
});

/** returnTo values /step-up must refuse: the fallback is /app on the same origin. */
const UNSAFE_RETURN_TO: readonly (readonly [string, string])[] = [
  ['scheme', 'https://evil.example/app'],
  ['authority', '//evil.example/app'],
  ['backslash', '/app\\evil'],
  ['control character', '/app/\u0001x'],
  ['percent-encoded slash', '/app%2Fx'],
  ['over 512 characters', `/app/${'b'.repeat(520)}`],
  ['the step-up route itself', '/step-up'],
  ['an auth route', '/auth/sign-in'],
];

test('[P2-S09-AC-910] /step-up refuses every unsafe returnTo and continues at /app on the same origin', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  const secret = await enrollFactorViaUi(page, 'Owner phone');

  for (const [label, raw] of UNSAFE_RETURN_TO) {
    await expireStepUp(page, testId, 'owner');
    await page.goto(`/step-up?returnTo=${encodeURIComponent(raw)}`, {
      waitUntil: 'networkidle',
    });
    await expect(
      page.getByRole('heading', { level: 1, name: "Verify it's you" }),
      label,
    ).toBeVisible();
    await completeStepUpViaUi(
      page,
      secret,
      (target) =>
        target.origin === 'http://127.0.0.1:4324' &&
        target.pathname.startsWith('/app'),
    );
    const landed = new URL(page.url());
    expect(landed.origin, label).toBe('http://127.0.0.1:4324');
    expect(landed.pathname.startsWith('/step-up'), label).toBe(false);
    expect(landed.pathname.startsWith('/auth'), label).toBe(false);
    expect(landed.pathname.startsWith('/app'), label).toBe(true);
    expect(landed.href, label).not.toContain('evil.example');
  }
});
