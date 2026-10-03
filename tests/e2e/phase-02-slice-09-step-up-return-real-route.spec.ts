import { expect, test, type Page } from '@playwright/test';

import { newTestId, closeLaneContexts } from './support/s09-lane-browser';
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
