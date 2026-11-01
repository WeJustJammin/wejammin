import { expect, test } from '@playwright/test';

import { waitForIslands } from './support/s10-real-browser';
import { readGovernedReview } from './support/s12-governed-world';
import { trace } from './support/s12-pw5-trace';
import { PATTERN_PAGE } from './support/s12-pw5-world';
import {
  activateExpectingInvalidation,
  approveAs,
  assignReviewerInBrowser,
  expectInvalidatedPage,
} from './support/s12-pw9-flow';
import { runGovernedRecheck } from './support/s12-pw9-jobs';
import { expectNothingLeaked } from './support/s12-pw9-scan';
import {
  approveViaApi,
  latencyRoot,
  marker,
  nestedRef,
  newPatternKey,
  patternEventCount,
  patternState,
  reviewRow,
  savePatternVersion,
} from './support/s12-pw9-world';
import {
  activateViaApi,
  prepareJourneyCast,
  submitFromPage,
  within,
  type JourneyCast,
} from './support/s12-pw7-flow';

/*
 * P2-S12-AC-273 (V11 section 5), the DEPENDENCY INVALIDATION journey, through the REAL composition (production-built Astro
 * routes -> web proxy -> production Worker -> production RPC adapter -> Kong -> PostgREST -> the Slice 12 SQL), with three
 * people (the designer, the owner, the reviewer).
 *
 * The rule (BE03c "Invalidation", "Governed activation ..." step 4, DEC-227; pgTAP `governed_recheck_pattern`,
 * `gaps_pattern/040-activation-recheck`): a review freezes the identities its subject depends on; a pattern that nests another
 * pattern depends on the NESTED VERSION. When the nested pattern gets an activated successor, the nested version is superseded
 * and every live review that froze it is stale. A stored review still reads `approved` until something rechecks it, and two
 * things do, each returning the subject to `draft` and the review to `invalidated` / `dependency_changed`:
 *
 *   1. the owner's activate or schedule command (CMS-03C-09 step 4 rechecks every dependency under its locks), answered 409
 *      with `details.reasonCode` `dependency_changed` and the invalidation committed (driven in the browser below);
 *   2. the system job `cms.governed_review.recheck` that the activation event enqueues (driven through the production RPCs,
 *      `support/s12-pw9-jobs.ts`: the real-route harness has no queue consumer).
 *
 * J7  the designer saves a child pattern and two patterns that each nest it (the first is submitted from its page, assigned
 *     and approved in the browser, the second through the first-party routes); the child gets an activated successor; the owner
 *     presses Activate on the second in the browser and the page says the review was invalidated; the recheck job then returns
 *     the first the same way; each review page, loaded afresh, states the invalidation, the subject is `draft`, and neither
 *     activation committed an event.
 *
 * Written without a running stack (the lane may not run one): every label and sentence is taken from the component sources
 * (`governed-activation-refusal.ts` MOVED.dependency_changed, `governed-review-labels.ts` GOVERNED_INVALIDATED_COPY,
 * `CmsGovernedReviewDetail`). Local loopback only; never hosted evidence.
 */
let journey: JourneyCast;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);
  journey = await prepareJourneyCast(
    browser,
    test.info().project.use.baseURL,
    'dependency',
  );
});

test('[P2-S12-AC-273] J7 a dependency change returns approved patterns to draft: the owner is refused in the browser, the recheck job invalidates the other, and each review page says so', async () => {
  test.setTimeout(900_000);
  const { cast, designer, owner, reviewer } = journey;
  const pages = [designer.page, owner.page, reviewer.page];
  const gathered = trace(...pages);
  const tag = marker('dep');
  const reasons = {
    first: `${tag} first nesting pattern approved.`,
    second: `${tag} second nesting pattern approved.`,
    child: `${tag} child pattern approved.`,
    successor: `${tag} successor approved.`,
  };

  // The child pattern is active; two patterns nest its version 1.
  const child = await savePatternVersion(
    designer.client,
    cast.world,
    newPatternKey('dep-child'),
    [latencyRoot('root1', `${tag} child one`)],
    null,
  );
  await activateViaApi(
    journey,
    designer,
    'pattern_version',
    child,
    reasons.child,
  );
  expect(patternState(child.versionId)).toBe('active');
  const first = await savePatternVersion(
    designer.client,
    cast.world,
    newPatternKey('dep-first'),
    [nestedRef('nested1', child)],
    null,
  );
  const second = await savePatternVersion(
    designer.client,
    cast.world,
    newPatternKey('dep-second'),
    [nestedRef('nested1', child)],
    null,
  );

  // The first is submitted from its page, assigned and decided in the browser; the second is approved through the routes.
  const firstReview = await submitFromPage(
    designer.page,
    PATTERN_PAGE(first.patternKey),
  );
  await assignReviewerInBrowser(
    journey,
    firstReview,
    cast.reviewer.principal.personId,
  );
  await approveAs(reviewer, cast.reviewer, journey, firstReview, reasons.first);
  const secondReview = await approveViaApi(
    journey,
    designer,
    'pattern_version',
    second,
    reasons.second,
  );
  expect((await readGovernedReview(reviewer.client, firstReview)).state).toBe(
    'approved',
  );
  expect(patternState(first.versionId)).toBe('approved');
  expect(patternState(second.versionId)).toBe('approved');

  // The dependency changes: the child gets an activated successor, so the version both patterns froze is superseded.
  const successor = await savePatternVersion(
    designer.client,
    cast.world,
    child.patternKey,
    [latencyRoot('root1', `${tag} child two`)],
    child,
  );
  await activateViaApi(
    journey,
    designer,
    'pattern_version',
    successor,
    reasons.successor,
  );
  expect(patternState(child.versionId)).toBe('superseded');
  expect(patternState(successor.versionId)).toBe('active');
  // Control: nothing has rechecked yet, so both stored reviews still read approved.
  expect(reviewRow(firstReview)).toMatch(/^approved\|\|/u);
  expect(reviewRow(secondReview.reviewId)).toMatch(/^approved\|\|/u);

  // 1. The owner presses Activate on the second in the browser: refused, committed as an invalidation, said in words.
  await activateExpectingInvalidation(journey, secondReview.reviewId);
  expect(reviewRow(secondReview.reviewId)).toMatch(
    /^invalidated\|dependency_changed\|/u,
  );
  expect(patternState(second.versionId)).toBe('draft');
  expect(patternEventCount(second.versionId)).toBe(0);
  await expectInvalidatedPage(owner, secondReview.reviewId);

  // 2. The recheck job returns the first one: the second is already invalidated, so exactly one review changes.
  const run = await runGovernedRecheck(successor.versionId);
  expect(run.invalidated, JSON.stringify(run)).toBe(1);
  expect(run.dependencyChanged, JSON.stringify(run)).toBe(1);
  expect(run.unavailable, JSON.stringify(run)).toBe(0);
  expect(reviewRow(firstReview)).toMatch(/^invalidated\|dependency_changed\|/u);
  expect(patternState(first.versionId)).toBe('draft');
  expect(patternEventCount(first.versionId)).toBe(0);
  await expectInvalidatedPage(owner, firstReview);

  // The designer's own page for the first pattern states the lifecycle in words again.
  await designer.page.goto(PATTERN_PAGE(first.patternKey), {
    waitUntil: 'domcontentloaded',
  });
  await waitForIslands(designer.page);
  await expect(
    designer.page.locator('[data-governed-lifecycle]'),
  ).toContainText('Lifecycle: Draft', within);

  expect(designer.browserErrors).toEqual([]);
  expect(owner.browserErrors).toEqual([]);
  expect(reviewer.browserErrors).toEqual([]);
  await expectNothingLeaked(gathered, pages, {
    persons: [
      cast.owner.principal.personId,
      cast.owner.principal.authUserId,
      journey.designerActor.principal.personId,
      journey.designerActor.principal.authUserId,
      cast.reviewer.principal.personId,
      cast.reviewer.principal.authUserId,
    ],
    values: [tag, ...Object.values(reasons)],
  });
});
