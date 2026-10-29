import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  requireLoopbackOrigin,
  waitForIslands,
  type SignedIn,
} from './support/s10-real-browser';
import {
  completeStepUp,
  signInS11,
  type S11Actor,
} from './support/s11-real-browser';
import {
  REVIEW_PAGE,
  assignGovernedViaApi,
  governedEffects,
  prepareGovernedCast,
  readGovernedReview,
  submitGovernedViaApi,
  type GovernedCast,
} from './support/s12-governed-world';
import {
  createProtectedType,
  defineTaxonomyForTypeViaApi,
  provisionBaseReviewer,
  provisionSpecialistReviewer,
} from './support/s12-pw5-world';

/*
 * P2-S12-AC-075 "protected decision paths": the two-decision, specialist-slot review through the REAL composition
 * (production-built Astro review page -> web proxy -> production Worker -> production RPC adapter -> Kong -> PostgREST ->
 * the Slice 12 SQL), driven by three people. The vocabulary version is bound to a content type under the DEC-110
 * `cms.disclosure.policy` workflow policy, so its review is `protected` (two decisions, slots `cms.reviewer` then the
 * specialist slot `cms.reviewer.policy`). The base-slot reviewer approves in the browser: the review stays open and the
 * page states how many of the two decisions are recorded and which slots the policy requires; the specialist then
 * approves in the browser and the review completes. The database proof of the same path is
 * `supabase/tests/phase_02_slice_12_governed_decision/040-flows.sqlinc` (R3, R4).
 *
 * Written without a running stack (the lane may not run one): selectors follow the component sources
 * (`CmsGovernedReviewDetail`, `CmsGovernedDecisionForm`) and the governed-review real-route spec's flows (T1, T5, T6).
 * Local loopback only; never hosted evidence.
 */

let cast: GovernedCast;
let curator: SignedIn;
let owner: SignedIn;
let baseActor: S11Actor;
let specialistActor: S11Actor;
let base: SignedIn;
let specialist: SignedIn;
let protectedTypeKey: string;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  requireLoopbackOrigin(test.info().project.use.baseURL);
  cast = await prepareGovernedCast();
  curator = await signInS11(browser, cast.world, cast.curator, null);
  owner = await signInS11(browser, cast.world, cast.owner, null);
  baseActor = provisionBaseReviewer(cast.world);
  specialistActor = provisionSpecialistReviewer(cast.world);
  base = await signInS11(browser, cast.world, baseActor, null);
  specialist = await signInS11(browser, cast.world, specialistActor, null);
  protectedTypeKey = await createProtectedType(cast.world);
});

const detailOf = (page: Page): Locator =>
  page.locator('[data-cms-governed-review-detail]');

/** The reviewer opens the review page and records an approval in the decision form. */
const approveInBrowser = async (
  who: SignedIn,
  actor: S11Actor,
  reviewId: string,
  reason: string,
): Promise<void> => {
  await completeStepUp(who.context, cast.world, actor);
  const { page } = who;
  const response = await page.goto(REVIEW_PAGE(reviewId), {
    waitUntil: 'domcontentloaded',
  });
  expect(response?.status()).toBe(200);
  await waitForIslands(page);
  const region = page.locator('[data-cms-lazy-region="governed-decision"]');
  await region.getByLabel('Approve').check();
  await region.getByLabel('Reason').fill(reason);
  await expect(
    region.getByRole('button', { name: /Record approval/u }),
  ).toBeVisible();
  await region.getByRole('button', { name: /Record approval/u }).click();
  await expect(page.getByText('Decision recorded.')).toBeVisible({
    timeout: 30_000,
  });
};

test('[P2-S12-AC-075] a protected review stays open after the base-slot approval, names the next required slot, and completes with the specialist approval', async () => {
  test.setTimeout(240_000);
  const subject = await defineTaxonomyForTypeViaApi(
    curator.client,
    protectedTypeKey,
  );
  const review = await submitGovernedViaApi(curator.client, subject);

  // The owner assigns both reviewers through the real command (the review version never advances on a create).
  await completeStepUp(owner.context, cast.world, cast.owner);
  for (const actor of [baseActor, specialistActor]) {
    const assigned = await assignGovernedViaApi(
      owner.client,
      review,
      actor.principal.personId,
    );
    expect(assigned.status, assigned.text).toBe(201);
  }

  // 1. The base-slot reviewer approves: the review is protected, still open, and one of two decisions is recorded.
  await approveInBrowser(
    base,
    baseActor,
    review.reviewId,
    'Base slot is satisfied.',
  );
  const afterBase = await readGovernedReview(base.client, review.reviewId);
  expect(afterBase.state, afterBase.text).toBe('open');
  const baseDetail = detailOf(base.page);
  await expect(baseDetail).toContainText('Risk class: Protected');
  await expect(baseDetail).toContainText('State: Open');
  await expect(baseDetail).toContainText('Subject: In review');
  await expect(baseDetail).toContainText('1 of 2 decisions recorded.');
  // The policy names both slots; the recorded decision fills the first, so the next required slot is the specialist's.
  await expect(baseDetail).toContainText('cms.reviewer.policy');
  const mine = baseDetail.locator('[data-cms-review-decision]');
  await expect(mine).toHaveCount(1);
  await expect(mine).toContainText('Your decision: Approved');
  await expect(mine).toContainText('Slot cms.reviewer');
  await expect(mine).not.toContainText('cms.reviewer.policy');
  expect(governedEffects(review.reviewId).decisions).toBe(1);

  // 2. The specialist sees the review still open with one decision recorded, approves, and the review completes.
  await approveInBrowser(
    specialist,
    specialistActor,
    review.reviewId,
    'Policy slot is satisfied.',
  );
  const done = await readGovernedReview(specialist.client, review.reviewId);
  expect(done.state, done.text).toBe('approved');
  const specialistDetail = detailOf(specialist.page);
  await expect(specialistDetail).toContainText('State: Approved');
  await expect(specialistDetail).toContainText('Subject: Approved');
  await expect(specialistDetail).toContainText('2 of 2 decisions recorded.');
  const decisions = specialistDetail.locator('[data-cms-review-decision]');
  await expect(decisions).toHaveCount(2);
  await expect(
    decisions.filter({ hasText: 'Your decision: Approved' }),
  ).toContainText('cms.reviewer.policy');
  expect(governedEffects(review.reviewId).decisions).toBe(2);
  expect(base.browserErrors).toEqual([]);
  expect(specialist.browserErrors).toEqual([]);
});
