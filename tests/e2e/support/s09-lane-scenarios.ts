import type { Browser, BrowserContext, Page } from '@playwright/test';

import { newLaneContext, newTestId, type LaneRole } from './s09-lane-browser';
import {
  assignReviewerViaUi,
  createTypeViaUi,
  enrollFactorViaUi,
  startDryRunViaUi,
  submitReviewViaUi,
  waitForSealedDryRun,
  type CreatedVersion,
} from './s09-lane-flows';

/**
 * Reusable multi-actor stages. Each stage only clicks through the production
 * pages; nothing is written to the lane world except by a producer port.
 */

export type Actor = Readonly<{ context: BrowserContext; page: Page }>;

export const actor = async (
  browser: Browser,
  role: LaneRole,
  testId: string,
): Promise<Actor> => {
  const context = await newLaneContext(browser, role, testId);
  return { context, page: await context.newPage() };
};

export type OpenReview = Readonly<{
  testId: string;
  owner: Actor;
  /** Manual key of the owner's enrolled authenticator (genuine TOTP source). */
  ownerSecret: string;
  created: CreatedVersion;
  reviewPath: string;
}>;

/** Owner drafts a type, runs the dry run to its sealed pass and submits it. */
export const openReview = async (browser: Browser): Promise<OpenReview> => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  // Assigning and activating require a recent proof; enrolling the first
  // authenticator through the real wizard leaves a fresh one for ten minutes.
  const ownerSecret = await enrollFactorViaUi(owner.page, 'Owner phone');
  const created = await createTypeViaUi(owner.page);
  await startDryRunViaUi(owner.page);
  await waitForSealedDryRun(owner.page);
  const reviewPath = await submitReviewViaUi(owner.page);
  return { testId, owner, ownerSecret, created, reviewPath };
};

/** Owner assigns `reviewer` to the open review through the review route. */
export const assignReviewer = async (
  stage: OpenReview,
  reviewer: LaneRole = 'reviewer',
): Promise<void> => {
  await stage.owner.page.goto(stage.reviewPath, { waitUntil: 'networkidle' });
  await assignReviewerViaUi(stage.owner.page, reviewer);
};

/** The reviewer enrolls a TOTP factor (a verified proof is then fresh). */
export const enrollReviewer = async (
  browser: Browser,
  testId: string,
  role: LaneRole = 'reviewer',
): Promise<Actor & { secret: string }> => {
  const person = await actor(browser, role, testId);
  const secret = await enrollFactorViaUi(person.page);
  return { ...person, secret };
};
