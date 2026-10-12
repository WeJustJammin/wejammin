/**
 * An approved review for a fresh entry, made through the first-party routes, for the Slice 11 real-route
 * specs that need the publisher's schedule and publish forms on the workflow page: the cast (author,
 * reviewer, publisher, owner) on the Slice 10 world and the submit, assign and approve chain. Nothing is
 * seeded by a direct write; step-up is the signed session's completed-MFA instant (the ceremony itself is
 * the Slice 09 suites' subject).
 */
import { expect, type Browser } from '@playwright/test';

import { seedEntry, type SeededEntry } from './s10-real-api';
import type { SignedIn } from './s10-real-browser';
import {
  prepareS10World,
  provisionAuthor,
  type S10World,
} from './s10-real-world';
import { completeStepUp, signInS11, type S11Actor } from './s11-real-browser';
import {
  approveViaApi,
  assignReviewerViaApi,
  submitReviewViaApi,
} from './s11-real-flow';
import { ownerPrincipal, provisionMember } from './s11-real-world';

/** Longer than the 366 day schedule horizon (CMS-03B-07). */
const PUBLISHER_GRANT_DAYS = 400;

export type ApprovedEntryCast = Readonly<{
  world: S10World;
  author: S11Actor;
  reviewer: S11Actor;
  publisher: S11Actor;
  owner: S11Actor;
  authorSession: SignedIn;
  ownerSession: SignedIn;
  reviewerSession: SignedIn;
}>;

const actor = (
  principal: S11Actor['principal'],
  capabilities: readonly string[],
): S11Actor => ({ principal, capabilities });

/** The world and the three signed-in sessions the approval chain needs (the owner and reviewer start with no step-up). */
export const prepareApprovedEntryCast = async (
  browser: Browser,
): Promise<ApprovedEntryCast> => {
  const world = await prepareS10World();
  const author = actor(provisionAuthor(world, 's11-author'), [
    'cms.author',
    'cms.editor',
  ]);
  const reviewer = actor(
    provisionMember(world, 's11-reviewer', ['cms.reviewer']),
    ['cms.reviewer'],
  );
  const publisher = actor(
    provisionMember(
      world,
      's11-publisher',
      ['cms.publisher'],
      PUBLISHER_GRANT_DAYS,
    ),
    ['cms.publisher'],
  );
  const owner = actor(ownerPrincipal(world), ['cms.editorial_review.assign']);
  return {
    world,
    author,
    reviewer,
    publisher,
    owner,
    authorSession: await signInS11(browser, world, author, null),
    ownerSession: await signInS11(browser, world, owner, null),
    reviewerSession: await signInS11(browser, world, reviewer, null),
  };
};

/** A fresh entry submitted, assigned and approved through the first-party routes. */
export const approvedEntry = async (
  cast: ApprovedEntryCast,
  title: string,
): Promise<SeededEntry> => {
  const entry = await seedEntry(cast.authorSession.client, cast.world, title);
  const review = await submitReviewViaApi(cast.authorSession.client, entry);
  await completeStepUp(cast.ownerSession.context, cast.world, cast.owner);
  const assigned = await assignReviewerViaApi(
    cast.ownerSession.client,
    review,
    cast.reviewer.principal.personId,
  );
  expect(assigned.status, assigned.text).toBe(201);
  await completeStepUp(cast.reviewerSession.context, cast.world, cast.reviewer);
  const decided = await approveViaApi(cast.reviewerSession.client, review);
  expect(decided.status, decided.text).toBe(200);
  return entry;
};
