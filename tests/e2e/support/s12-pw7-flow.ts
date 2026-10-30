/**
 * The people and the browser steps of the Slice 12 wave-7 journeys: a cast of five signed-in people over the governed
 * world, and the shared steps of a governed definition review (submit from the subject page, assign, decide, activate,
 * schedule, retire), each driven through the page exactly as `phase-02-slice-12-definition-journeys-real-route.spec.ts`
 * drives them for a vocabulary and a pattern. That spec keeps its own copies (it belongs to a finished lane); this module
 * is the one the wave-7 specs share. Not type-checked by `pnpm type-check`.
 */
import {
  expect,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test';

import {
  expectNoHorizontalScroll,
  requireLoopbackOrigin,
  tabTo,
  waitForIslands,
  type SignedIn,
} from './s10-real-browser';
import { provisionAuthor } from './s10-real-world';
import { completeStepUp, signInS11, type S11Actor } from './s11-real-browser';
import {
  REVIEW_PAGE,
  approveGovernedViaApi,
  assignGovernedViaApi,
  activateGovernedViaApi,
  grantReviewerViaApi,
  prepareGovernedCast,
  type GovernedCast,
} from './s12-governed-world';
import { provisionDesigner } from './s12-pw5-world';
import {
  grantOwnerCapabilities,
  submitSubjectViaApi,
  type SubjectKind,
} from './s12-pw7-world';

export const within = { timeout: 30_000 } as const;

export type JourneyCast = Readonly<{
  cast: GovernedCast;
  /** Holds `cms.taxonomy_curator`: defines and submits a vocabulary and curates its terms. */
  curator: SignedIn;
  /** The receipt owner with the curator and template-designer capabilities: assigns, activates, schedules, retires. */
  owner: SignedIn;
  ownerActor: S11Actor;
  /** Holds `cms.reviewer`. */
  reviewer: SignedIn;
  /** Holds `cms.template_designer`. */
  designer: SignedIn;
  designerActor: S11Actor;
  /** Holds `cms.author` and `cms.editor`. */
  author: SignedIn;
}>;

/** Five signed-in people and the reviewer's real `cms.reviewer` grant (CMS-03A-15). */
export const prepareJourneyCast = async (
  browser: Browser,
  baseURL: string | undefined,
  label: string,
): Promise<JourneyCast> => {
  requireLoopbackOrigin(baseURL);
  const cast = await prepareGovernedCast();
  grantOwnerCapabilities(cast.world, ['cms.template_designer']);
  const ownerActor: S11Actor = {
    ...cast.owner,
    capabilities: ['cms.taxonomy_curator', 'cms.template_designer'],
  };
  const designerActor = provisionDesigner(cast.world);
  const authorActor: S11Actor = {
    principal: provisionAuthor(cast.world, `s12-pw7-${label}-author`),
    capabilities: ['cms.author', 'cms.editor'],
  };
  const owner = await signInS11(browser, cast.world, ownerActor, null);
  const journey: JourneyCast = {
    cast,
    curator: await signInS11(browser, cast.world, cast.curator, null),
    owner,
    ownerActor,
    reviewer: await signInS11(browser, cast.world, cast.reviewer, null),
    designer: await signInS11(browser, cast.world, designerActor, null),
    designerActor,
    author: await signInS11(browser, cast.world, authorActor, null),
  };
  await completeStepUp(owner.context, cast.world, ownerActor);
  const granted = await grantReviewerViaApi(
    owner.client,
    cast.reviewer.principal.personId,
  );
  expect(granted.status, granted.text).toBe(201);
  return journey;
};

export const regionOf = (page: Page, name: string): Locator =>
  page.locator(`[data-cms-lazy-region="${name}"]`);

/** The panel on a subject page: submit the draft for review and read the review id from the page's own link. */
export const submitFromPage = async (
  page: Page,
  path: string,
): Promise<string> => {
  await page.goto(path, { waitUntil: 'networkidle' });
  await waitForIslands(page);
  await regionOf(page, 'governed-submit').first().hover();
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expect(
    page.getByRole('heading', { name: 'Submitted for review' }),
  ).toBeVisible(within);
  // The id is learned only from the link the page shows once it is loaded again.
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

/** The owner assigns the reviewer in the browser (CMS-03C-08). */
export const assignInBrowser = async (
  journey: JourneyCast,
  reviewId: string,
): Promise<void> => {
  const { owner, ownerActor, cast } = journey;
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

/** The reviewer approves in the browser; `keyboard` drives it by key presses only, in a 200% layout. */
export const approveInBrowser = async (
  journey: JourneyCast,
  reviewId: string,
  reason: string,
  keyboard: boolean,
): Promise<void> => {
  const { reviewer, cast } = journey;
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

export type OwnerAction = 'activate' | 'schedule' | 'retire';
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

/** 30 days ahead at 10:00 local time, a wall time that a clock change never skips or repeats. */
const scheduleLocal = (): string =>
  `${new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)}T10:00`;

/** The owner takes one action on the review in the browser: choose, name the consequence, confirm (CMS-03C-09). */
export const ownerAction = async (
  journey: JourneyCast,
  reviewId: string,
  action: OwnerAction,
): Promise<void> => {
  const { owner, ownerActor, cast } = journey;
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

/**
 * One saved version taken to `active` through the first-party routes (the same commands the browser sends): the
 * submitter opens the review, the owner assigns the reviewer, the reviewer approves, the owner activates. Each person has
 * a fresh step-up.
 */
export const activateViaApi = async (
  journey: JourneyCast,
  submitter: SignedIn,
  kind: SubjectKind,
  subject: Readonly<{ versionId: string; contentHash: string }>,
  reason: string,
): Promise<string> => {
  const { owner, ownerActor, reviewer, cast } = journey;
  const review = await submitSubjectViaApi(submitter.client, kind, subject);
  await completeStepUp(owner.context, cast.world, ownerActor);
  const assigned = await assignGovernedViaApi(
    owner.client,
    review,
    cast.reviewer.principal.personId,
  );
  expect(assigned.status, assigned.text).toBe(201);
  await completeStepUp(reviewer.context, cast.world, cast.reviewer);
  const approved = await approveGovernedViaApi(
    reviewer.client,
    review.reviewId,
    reason,
  );
  expect(approved.status, approved.text).toBe(200);
  await completeStepUp(owner.context, cast.world, ownerActor);
  const activated = await activateGovernedViaApi(owner.client, review.reviewId);
  expect(activated.status, activated.text).toBe(200);
  return review.reviewId;
};
