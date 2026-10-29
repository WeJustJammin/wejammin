import { expect, test, type Locator, type Page } from '@playwright/test';

import { psql } from '../postgrest/support/stack';
import {
  expectNoHorizontalScroll,
  requireLoopbackOrigin,
  tabTo,
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
  TAXONOMY_PAGE,
  approveGovernedViaApi,
  assignGovernedViaApi,
  defineTaxonomyViaApi,
  grantReviewerViaApi,
  prepareGovernedCast,
  readGovernedReview,
  submitGovernedViaApi,
  type GovernedCast,
} from './support/s12-governed-world';
import { expectNothingIdentifying, trace } from './support/s12-pw5-trace';
import {
  PATTERN_PAGE,
  TAXONOMY_NEW_PAGE,
  definePatternViaApi,
  provisionDesigner,
} from './support/s12-pw5-world';

/*
 * P2-S12-AC-273 (V11 section 5), the part of the end-to-end journeys that the real-route harness can drive today, through
 * the REAL composition (production-built Astro routes -> web proxy -> production Worker -> production RPC adapter -> Kong
 * -> PostgREST -> the Slice 12 SQL), with several people:
 *
 *   J1  a vocabulary: the curator DEFINES it in the browser form and SUBMITS it from its page; the owner ASSIGNS the
 *       reviewer in the browser; the reviewer DECIDES in the browser (keyboard only, in a 200% layout); the owner
 *       SCHEDULES its activation in the browser. A second vocabulary is taken the same way to the owner's ACTIVATION and
 *       RETIREMENT.
 *   J2  a pattern: the designer saves it (CMS-03C-12 through the first-party route; the tree editor is the subject of the
 *       pattern designer's own suites), SUBMITS it from its page; the owner assigns through the first-party route; the
 *       reviewer decides in the browser; the owner ACTIVATES and RETIRES it in the browser.
 *   Both journeys record every URL, console line, request and storage value of every page and assert that no person id
 *   and no content hash travels in a URL, query, storage or console line. (The pattern-update diff VALUES are the subject
 *   of the linked-update journey, which this file does not drive.)
 *
 * NOT covered here, by design of this wave (see the lane report): the template journey (the template routes are
 * test-owned fixtures, not the production composition), a dependency invalidation, a linked pattern update accepted and
 * detached, a term merged with convergence, a locale variant with a `no_fallback` block, and related content pinned and
 * excluded. This file therefore does not close the AC-273 clause on its own.
 *
 * Written without a running stack (the lane may not run one): selectors follow the component sources and the governed
 * review real-route spec's flows (T1, T3, T6, T8). Local loopback only; never hosted evidence.
 */

let cast: GovernedCast;
let curator: SignedIn;
let owner: SignedIn;
let reviewer: SignedIn;
let designerActor: S11Actor;
let designer: SignedIn;
let ownerActor: S11Actor;
let typeKey: string;

const within = { timeout: 30_000 };

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  requireLoopbackOrigin(test.info().project.use.baseURL);
  cast = await prepareGovernedCast();
  // The owner also holds the pattern subject-kind capability the activation command checks.
  psql(`
    insert into identity_private.organization_actor_grant(
      organization_id, person_id, capability_code, valid_from, valid_through, active)
    values ('${cast.world.owner.organizationId}', '${cast.world.owner.personId}', 'cms.template_designer',
            current_date, current_date + 400, true)
    on conflict (organization_id, person_id, capability_code)
    do update set active = true, valid_through = excluded.valid_through`);
  ownerActor = {
    ...cast.owner,
    capabilities: ['cms.taxonomy_curator', 'cms.template_designer'],
  };
  typeKey = psql(
    `select type_key from platform_private.cms_content_types where id = '${cast.world.contentTypeId}'`,
  );
  curator = await signInS11(browser, cast.world, cast.curator, null);
  owner = await signInS11(browser, cast.world, ownerActor, null);
  reviewer = await signInS11(browser, cast.world, cast.reviewer, null);
  designerActor = provisionDesigner(cast.world);
  designer = await signInS11(browser, cast.world, designerActor, null);
  // The reviewer's cms.reviewer grant through the real producer (CMS-03A-15): what the assignment form lists.
  await completeStepUp(owner.context, cast.world, ownerActor);
  const granted = await grantReviewerViaApi(
    owner.client,
    cast.reviewer.principal.personId,
  );
  expect(granted.status, granted.text).toBe(201);
});

const regionOf = (page: Page, name: string): Locator =>
  page.locator(`[data-cms-lazy-region="${name}"]`);

/** The owner assigns the reviewer in the browser (CMS-03C-08), as the governed spec's T6 does. */
const assignInBrowser = async (reviewId: string): Promise<void> => {
  await completeStepUp(owner.context, cast.world, ownerActor);
  const { page } = owner;
  await page.goto(REVIEW_PAGE(reviewId), { waitUntil: 'domcontentloaded' });
  await waitForIslands(page);
  const assignment = regionOf(page, 'governed-assignment');
  await assignment.first().hover();
  const list = assignment.getByLabel('Reviewer').first();
  await expect(assignment.getByText('Reviewer choices loaded.')).toBeVisible(
    within,
  );
  await expect(list).not.toHaveAttribute('aria-busy', 'true');
  await list.selectOption({ value: cast.reviewer.principal.personId });
  await assignment
    .getByLabel('Assignment ends')
    .fill(new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16));
  await assignment.getByRole('button', { name: 'Assign reviewer' }).click();
  await expect(page.getByText(/Reviewer assigned/u)).toBeVisible();
};

/** The reviewer approves in the browser; `keyboard` drives it by key presses only, at a 200% layout. */
const approveInBrowser = async (
  reviewId: string,
  reason: string,
  keyboard: boolean,
): Promise<void> => {
  await completeStepUp(reviewer.context, cast.world, cast.reviewer);
  const { page } = reviewer;
  if (keyboard) await page.setViewportSize({ width: 640, height: 400 });
  await page.goto(REVIEW_PAGE(reviewId), { waitUntil: 'domcontentloaded' });
  await waitForIslands(page);
  const region = regionOf(page, 'governed-decision');
  if (keyboard) {
    await expectNoHorizontalScroll(page, 'decision form at 200%');
    await tabTo(page, /^input:Approve/u);
    await page.keyboard.press('Space');
    await tabTo(page, /^textarea:Reason/u);
    await page.keyboard.type(reason);
    // The choice made before hydration is in the form's state once the control is worded for it.
    await expect(
      region.getByRole('button', { name: /Record approval/u }),
    ).toBeVisible(within);
    await tabTo(page, /^button:Record approval/u);
    await page.keyboard.press('Enter');
  } else {
    await region.getByLabel('Approve').check();
    await region.getByLabel('Reason').fill(reason);
    await expect(
      region.getByRole('button', { name: /Record approval/u }),
    ).toBeVisible();
    await region.getByRole('button', { name: /Record approval/u }).click();
  }
  await expect(page.getByText('Decision recorded.')).toBeVisible(within);
  if (keyboard) await page.setViewportSize({ width: 1280, height: 720 });
};

type OwnerAction = 'activate' | 'schedule' | 'retire';
const ACTIONS: Readonly<
  Record<OwnerAction, { radio: RegExp; commit: string; done: RegExp }>
> = {
  activate: {
    radio: /Activate now/u,
    commit: 'Activate this version',
    done: /Activated, not published/u,
  },
  schedule: {
    radio: /Schedule activation/u,
    commit: 'Schedule activation',
    done: /Scheduled, not active:/u,
  },
  retire: {
    radio: /Retire this version/u,
    commit: 'Retire this version',
    done: /Retired:/u,
  },
};

/** 30 days ahead at 10:00 local time, a wall time that is never skipped or repeated by a clock change. */
const scheduleLocal = (): string =>
  `${new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)}T10:00`;

/** The owner takes one action on the review in the browser: choose, name the consequence, confirm (CMS-03C-09). */
const ownerAction = async (
  reviewId: string,
  action: OwnerAction,
): Promise<void> => {
  await completeStepUp(owner.context, cast.world, ownerActor);
  const { page } = owner;
  await page.goto(REVIEW_PAGE(reviewId), { waitUntil: 'domcontentloaded' });
  await waitForIslands(page);
  const activation = regionOf(page, 'governed-activation');
  const spec = ACTIONS[action];
  await expect(activation).toHaveCount(1, within);
  await activation.first().hover();
  await activation.getByRole('radio', { name: spec.radio }).check(within);
  if (action === 'schedule') {
    await activation.getByLabel('Time zone').fill('America/New_York');
    await activation.getByLabel('Local date and time').fill(scheduleLocal());
    await expect(
      activation.locator('[data-cms-schedule-status]'),
    ).toContainText(/^Resolved to /u, within);
  }
  await activation.getByRole('button', { name: 'Continue' }).click(within);
  await activation.getByRole('button', { name: spec.commit }).click(within);
  await expect(page.getByText(spec.done)).toBeVisible(within);
};

/** The owner's panel on the subject page: submit the draft for review and read the review id from its link. */
const submitFromPage = async (page: Page, path: string): Promise<string> => {
  await page.goto(path, { waitUntil: 'networkidle' });
  await waitForIslands(page);
  await regionOf(page, 'governed-submit').first().hover();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expect(
    page.getByRole('heading', { name: 'Submitted for review' }),
  ).toBeVisible(within);
  // The page names the review once it is loaded again; the link is the only place the browser learns the id.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForIslands(page);
  const href = await page
    .getByRole('link', { name: 'Open the review' })
    .getAttribute('href');
  const reviewId = href?.split('/').pop();
  if (reviewId === undefined || reviewId === '')
    throw new Error('The subject page did not link its review.');
  return decodeURIComponent(reviewId);
};

/** The curator defines a new vocabulary in the browser form and follows the link to submit it. */
const defineVocabularyInBrowser = async (): Promise<string> => {
  const { page } = curator;
  const key = `s12-jrn-${crypto.randomUUID().slice(0, 8).replaceAll('-', '')}`;
  await page.goto(TAXONOMY_NEW_PAGE, { waitUntil: 'domcontentloaded' });
  await waitForIslands(page);
  await page.getByLabel('Vocabulary key', { exact: true }).fill(key);
  await page.getByLabel('Flat: terms form one list.').check();
  await page.getByLabel('Content type keys', { exact: true }).fill(typeKey);
  await page.getByLabel('Content type keys', { exact: true }).press('Enter');
  await page.getByLabel('Field keys', { exact: true }).fill('title');
  await page.getByLabel('Field keys', { exact: true }).press('Enter');
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(
    page.getByRole('heading', { name: 'Vocabulary draft saved' }),
  ).toBeVisible(within);
  return page
    .getByRole('link', { name: 'Open the vocabulary to submit it for review' })
    .getAttribute('href')
    .then((href) => {
      if (href === null)
        throw new Error('The saved vocabulary was not linked.');
      return href;
    });
};

test('[P2-S12-AC-273] J1 a vocabulary is defined, submitted, assigned, decided and scheduled in the browser by three people, and a second one is activated and retired', async () => {
  test.setTimeout(480_000);
  const pages = [curator.page, owner.page, reviewer.page];
  const gathered = trace(...pages);
  const reasonOne = 'Journey reason one is specific to this run.';
  const reasonTwo = 'Journey reason two is specific to this run.';

  // Vocabulary one: define (browser), submit (browser), assign (browser), decide (browser, keyboard, 200%), schedule (browser).
  const pageOne = await defineVocabularyInBrowser();
  expect(pageOne).toMatch(
    /^\/app\/cms-content-modeling\/taxonomies\/[0-9a-f-]{36}$/u,
  );
  const reviewOne = await submitFromPage(curator.page, pageOne);
  await assignInBrowser(reviewOne);
  await approveInBrowser(reviewOne, reasonOne, true);
  expect((await readGovernedReview(reviewer.client, reviewOne)).state).toBe(
    'approved',
  );
  await ownerAction(reviewOne, 'schedule');
  await owner.page.reload({ waitUntil: 'domcontentloaded' });
  await waitForIslands(owner.page);
  await expect(
    owner.page.getByText(/Scheduled activation: pending\./u),
  ).toBeVisible(within);

  // Vocabulary two: defined and submitted through the first-party routes, decided by the reviewer, then activated and retired.
  const second = await defineTaxonomyViaApi(curator.client, cast.world);
  const reviewTwo = await submitGovernedViaApi(curator.client, second);
  await completeStepUp(owner.context, cast.world, ownerActor);
  const assigned = await assignGovernedViaApi(
    owner.client,
    reviewTwo,
    cast.reviewer.principal.personId,
  );
  expect(assigned.status, assigned.text).toBe(201);
  await completeStepUp(reviewer.context, cast.world, cast.reviewer);
  const decided = await approveGovernedViaApi(
    reviewer.client,
    reviewTwo.reviewId,
    reasonTwo,
  );
  expect(decided.status, decided.text).toBe(200);
  await ownerAction(reviewTwo.reviewId, 'activate');
  await ownerAction(reviewTwo.reviewId, 'retire');
  expect(owner.browserErrors).toEqual([]);
  expect(curator.browserErrors).toEqual([]);
  expect(reviewer.browserErrors).toEqual([]);

  await expectNothingIdentifying(gathered, pages, [
    cast.owner.principal.personId,
    cast.owner.principal.authUserId,
    cast.curator.principal.personId,
    cast.curator.principal.authUserId,
    cast.reviewer.principal.personId,
    cast.reviewer.principal.authUserId,
    second.contentHash,
  ]);
  // The second vocabulary's page still states its lifecycle in words after the journey.
  await curator.page.goto(TAXONOMY_PAGE(second.taxonomyId), {
    waitUntil: 'domcontentloaded',
  });
  await waitForIslands(curator.page);
  await expect(curator.page.locator('[data-governed-lifecycle]')).toContainText(
    'Lifecycle: Retired',
  );
});

test('[P2-S12-AC-273] J2 a pattern is saved, submitted, assigned, decided, activated and retired by the designer, the owner and the reviewer', async () => {
  test.setTimeout(480_000);
  const pages = [designer.page, owner.page, reviewer.page];
  const gathered = trace(...pages);
  const reason = 'Pattern journey reason specific to this run.';

  const saved = await definePatternViaApi(designer.client, cast.world);
  const reviewId = await submitFromPage(
    designer.page,
    PATTERN_PAGE(saved.patternKey),
  );
  await completeStepUp(owner.context, cast.world, ownerActor);
  const assigned = await assignGovernedViaApi(
    owner.client,
    {
      reviewId,
      reviewVersion: (await readGovernedReview(owner.client, reviewId)).version,
    },
    cast.reviewer.principal.personId,
  );
  expect(assigned.status, assigned.text).toBe(201);
  await approveInBrowser(reviewId, reason, false);
  expect((await readGovernedReview(reviewer.client, reviewId)).state).toBe(
    'approved',
  );
  await ownerAction(reviewId, 'activate');
  await ownerAction(reviewId, 'retire');
  // The pattern page now states the lifecycle in words.
  await designer.page.goto(PATTERN_PAGE(saved.patternKey), {
    waitUntil: 'domcontentloaded',
  });
  await waitForIslands(designer.page);
  await expect(
    designer.page.locator('[data-governed-lifecycle]'),
  ).toContainText('Lifecycle: Retired');
  expect(designer.browserErrors).toEqual([]);
  expect(owner.browserErrors).toEqual([]);
  expect(reviewer.browserErrors).toEqual([]);
  await expectNothingIdentifying(gathered, pages, [
    cast.owner.principal.personId,
    cast.owner.principal.authUserId,
    designerActor.principal.personId,
    designerActor.principal.authUserId,
    cast.reviewer.principal.personId,
    cast.reviewer.principal.authUserId,
    saved.contentHash,
  ]);
});
