import { expect, test, type Locator, type Page } from '@playwright/test';

import { waitForIslands, type SignedIn } from './support/s10-real-browser';
import {
  completeStepUp,
  signInS11,
  type S11Actor,
} from './support/s11-real-browser';
import {
  REVIEW_PAGE,
  governedEffects,
  grantReviewerViaApi,
  readGovernedReview,
} from './support/s12-governed-world';
import { trace } from './support/s12-pw5-trace';
import {
  createProtectedType,
  provisionBaseReviewer,
  provisionSpecialistReviewer,
} from './support/s12-pw5-world';
import {
  approveAs,
  assignReviewerInBrowser,
  defineVocabularyOver,
} from './support/s12-pw9-flow';
import { expectNothingLeaked } from './support/s12-pw9-scan';
import { marker } from './support/s12-pw9-world';
import {
  ownerAction,
  prepareJourneyCast,
  submitFromPage,
  within,
  type JourneyCast,
} from './support/s12-pw7-flow';

/*
 * P2-S12-AC-273 (V11 section 5) and AC-075: the PROTECTED DECISION inside a journey, through the REAL composition, with five
 * people. The vocabulary names a content type under the DEC-110 `cms.disclosure.policy` workflow policy, so its review is
 * `protected`: two decisions, slots `cms.reviewer` then the specialist slot `cms.reviewer.policy`
 * (BE03c "Governed policy basis"). Unlike `phase-02-slice-12-protected-decision-real-route.spec.ts`, which defines, submits and
 * assigns through the first-party routes, every step here is taken in the browser:
 *
 *   J9  the curator DEFINES the vocabulary in the form and SUBMITS it from its page; the owner ASSIGNS the base reviewer and
 *       then the specialist in the browser; the base reviewer approves (the page says 1 of 2 decisions are recorded and the
 *       review is still open, so the vocabulary is not approvable yet); the specialist approves (2 of 2, the review is
 *       approved); the owner ACTIVATES it in the browser and the vocabulary page states `Active`.
 *
 * Written without a running stack (the lane may not run one): selectors follow the component sources and the AC-075 spec.
 * Local loopback only; never hosted evidence.
 */
let journey: JourneyCast;
let baseActor: S11Actor;
let specialistActor: S11Actor;
let base: SignedIn;
let specialist: SignedIn;
let protectedTypeKey: string;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);
  journey = await prepareJourneyCast(
    browser,
    test.info().project.use.baseURL,
    'protected',
  );
  const { cast, owner, ownerActor } = journey;
  baseActor = provisionBaseReviewer(cast.world);
  specialistActor = provisionSpecialistReviewer(cast.world);
  base = await signInS11(browser, cast.world, baseActor, null);
  specialist = await signInS11(browser, cast.world, specialistActor, null);
  protectedTypeKey = await createProtectedType(cast.world);
  // The assignment form lists the owner's `cms.reviewer` grants (CMS-03A-18), so each reviewer holds one through the producer.
  for (const actor of [baseActor, specialistActor]) {
    await completeStepUp(owner.context, cast.world, ownerActor);
    const granted = await grantReviewerViaApi(
      owner.client,
      actor.principal.personId,
    );
    expect(granted.status, granted.text).toBe(201);
  }
});

const detailOf = (page: Page): Locator =>
  page.locator('[data-cms-governed-review-detail]');

test('[P2-S12-AC-273] J9 a protected vocabulary is defined, submitted, assigned to two reviewers, decided by the base reviewer and then its specialist, and activated, all in the browser', async () => {
  test.setTimeout(900_000);
  const { cast, curator, owner } = journey;
  const pages = [curator.page, owner.page, base.page, specialist.page];
  const gathered = trace(...pages);
  const tag = marker('protected');
  const reasons = {
    base: `${tag} base slot is satisfied.`,
    specialist: `${tag} policy slot is satisfied.`,
  };

  // The curator defines the vocabulary over the protected type and submits it from its page.
  const vocabularyPage = await defineVocabularyOver(curator, protectedTypeKey);
  const reviewId = await submitFromPage(curator.page, vocabularyPage);

  // The review is protected and still waiting for two decisions.
  await completeStepUp(owner.context, cast.world, journey.ownerActor);
  await owner.page.goto(REVIEW_PAGE(reviewId), {
    waitUntil: 'domcontentloaded',
  });
  await waitForIslands(owner.page);
  await expect(detailOf(owner.page)).toContainText('Risk class: Protected');
  await expect(detailOf(owner.page)).toContainText('State: Open');
  await expect(detailOf(owner.page)).toContainText(
    '0 of 2 decisions recorded.',
  );
  await expect(detailOf(owner.page)).toContainText('cms.reviewer.policy');

  // The owner assigns both reviewers in the browser.
  await assignReviewerInBrowser(
    journey,
    reviewId,
    baseActor.principal.personId,
  );
  await assignReviewerInBrowser(
    journey,
    reviewId,
    specialistActor.principal.personId,
  );
  expect(governedEffects(reviewId).assignments).toBe(2);

  // The base reviewer approves: one of two decisions, the review stays open.
  await approveAs(base, baseActor, journey, reviewId, reasons.base);
  expect((await readGovernedReview(base.client, reviewId)).state).toBe('open');
  await base.page.goto(REVIEW_PAGE(reviewId), {
    waitUntil: 'domcontentloaded',
  });
  await waitForIslands(base.page);
  await expect(detailOf(base.page)).toContainText('State: Open');
  await expect(detailOf(base.page)).toContainText('Subject: In review');
  await expect(detailOf(base.page)).toContainText('1 of 2 decisions recorded.');
  await expect(
    detailOf(base.page).locator('[data-cms-review-decision]'),
  ).toContainText('Slot cms.reviewer');
  expect(governedEffects(reviewId).decisions).toBe(1);

  // The owner cannot activate yet: the review is open, so no activation form is offered.
  await owner.page.goto(REVIEW_PAGE(reviewId), {
    waitUntil: 'domcontentloaded',
  });
  await waitForIslands(owner.page);
  await expect(
    owner.page.getByRole('radio', { name: /Activate now/u }),
  ).toHaveCount(0);

  // The specialist approves: two of two, the review is approved.
  await approveAs(
    specialist,
    specialistActor,
    journey,
    reviewId,
    reasons.specialist,
  );
  expect((await readGovernedReview(specialist.client, reviewId)).state).toBe(
    'approved',
  );
  await specialist.page.goto(REVIEW_PAGE(reviewId), {
    waitUntil: 'domcontentloaded',
  });
  await waitForIslands(specialist.page);
  await expect(detailOf(specialist.page)).toContainText('State: Approved');
  await expect(detailOf(specialist.page)).toContainText('Subject: Approved');
  await expect(detailOf(specialist.page)).toContainText(
    '2 of 2 decisions recorded.',
  );
  await expect(
    detailOf(specialist.page).locator('[data-cms-review-decision]'),
  ).toHaveCount(2);
  expect(governedEffects(reviewId).decisions).toBe(2);

  // The owner activates in the browser, and the vocabulary page states the lifecycle in words.
  await ownerAction(journey, reviewId, 'activate');
  await curator.page.goto(vocabularyPage, { waitUntil: 'domcontentloaded' });
  await waitForIslands(curator.page);
  await expect(curator.page.locator('[data-governed-lifecycle]')).toContainText(
    'Lifecycle: Active',
    within,
  );

  for (const person of [curator, owner, base, specialist])
    expect(person.browserErrors).toEqual([]);
  await expectNothingLeaked(gathered, pages, {
    persons: [
      cast.owner.principal.personId,
      cast.owner.principal.authUserId,
      cast.curator.principal.personId,
      cast.curator.principal.authUserId,
      baseActor.principal.personId,
      baseActor.principal.authUserId,
      specialistActor.principal.personId,
      specialistActor.principal.authUserId,
    ],
    values: [tag, reasons.base, reasons.specialist],
  });
});
