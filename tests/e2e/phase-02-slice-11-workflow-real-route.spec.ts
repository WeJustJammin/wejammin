import { expect, test, type Page } from '@playwright/test';

import { seedEntry } from './support/s10-real-api';
import {
  gotoHydrated,
  requireLoopbackOrigin,
  type SignedIn,
} from './support/s10-real-browser';
import {
  prepareS10World,
  provisionAuthor,
  type S10Principal,
  type S10World,
} from './support/s10-real-world';
import {
  assignReviewerViaApi,
  approveViaApi,
  readWorkflow,
  submitReviewViaApi,
} from './support/s11-real-flow';
import {
  completeStepUp,
  signInS11,
  type S11Actor,
} from './support/s11-real-browser';
import { nextSpringForwardGap } from './support/s11-dst-gap';
import {
  expectStatusAnnounced,
  recordedStatusTexts,
  startRecordingStatusTexts,
} from './support/s11-status-recorder';
import { ownerPrincipal, provisionMember } from './support/s11-real-world';

/*
 * Slice 11 workflow surfaces through the REAL composition (production-built
 * Astro routes -> web proxy -> private binding -> production Worker ->
 * production RPC adapter -> Kong -> PostgREST -> the Slice 11 SQL). Entries,
 * reviews, assignments and decisions are made through the browser or the
 * first-party routes, never seeded. Step-up is the signed session's completed-MFA
 * instant (the ceremony itself is the Slice 09 suites' subject). Local loopback
 * only; never hosted evidence.
 */

/** Longer than the 366 day schedule horizon (CMS-03B-07). */
const PUBLISHER_GRANT_DAYS = 400;

const ENTRY_PAGE = (entryId: string): string =>
  `/app/cms-content-modeling/entries/${entryId}/workflow`;
const REVIEW_PAGE = (reviewId: string): string =>
  `/app/cms-content-modeling/reviews/${reviewId}`;

type Cast = Readonly<{
  world: S10World;
  author: S11Actor;
  reviewer: S11Actor;
  publisher: S11Actor;
  owner: S11Actor;
}>;

let cast: Cast;
let authorSession: SignedIn;
let ownerSession: SignedIn;
let reviewerSession: SignedIn;

const actor = (
  principal: S10Principal,
  capabilities: readonly string[],
): S11Actor => ({ principal, capabilities });

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  requireLoopbackOrigin(test.info().project.use.baseURL);
  const world = await prepareS10World();
  cast = {
    world,
    author: actor(provisionAuthor(world, 's11-author'), [
      'cms.author',
      'cms.editor',
    ]),
    reviewer: actor(provisionMember(world, 's11-reviewer', ['cms.reviewer']), [
      'cms.reviewer',
    ]),
    // A schedule is refused when the publisher's grant ends before the day it
    // takes effect, and S11-RR-07 schedules months ahead: this publisher holds
    // the grant for longer than the 366 day schedule horizon.
    publisher: actor(
      provisionMember(
        world,
        's11-publisher',
        ['cms.publisher'],
        PUBLISHER_GRANT_DAYS,
      ),
      ['cms.publisher'],
    ),
    owner: actor(ownerPrincipal(world), ['cms.editorial_review.assign']),
  };
  authorSession = await signInS11(browser, world, cast.author, null);
  // The owner and the reviewer start with NO completed step-up.
  ownerSession = await signInS11(browser, world, cast.owner, null);
  reviewerSession = await signInS11(browser, world, cast.reviewer, null);
});

/** An approved review for a fresh entry, made through the first-party routes. */
const approvedEntry = async (title: string) => {
  const entry = await seedEntry(authorSession.client, cast.world, title);
  const review = await submitReviewViaApi(authorSession.client, entry);
  await completeStepUp(ownerSession.context, cast.world, cast.owner);
  const assigned = await assignReviewerViaApi(
    ownerSession.client,
    review,
    cast.reviewer.principal.personId,
  );
  expect(assigned.status, assigned.text).toBe(201);
  await completeStepUp(reviewerSession.context, cast.world, cast.reviewer);
  const decided = await approveViaApi(reviewerSession.client, review);
  expect(decided.status, decided.text).toBe(200);
  return { entry, review };
};

test('[S11-RR-PROBE] the first-party chain submits, assigns and approves a review', async () => {
  const flow = await approvedEntry('Probe entry');
  const view = await readWorkflow(authorSession.client, flow.entry.entryId);
  expect(view.reviewState, view.text).toBe('approved');
});

/** The collapsed section whose summary reads `summary` (each form owns an Audience field). */
const disclosure = (page: Page, summary: string) =>
  page
    .locator('details')
    .filter({ has: page.locator('summary', { hasText: summary }) });

const readoutAfter = async (page: Page): Promise<string> =>
  (await page.locator('main').innerText()).replaceAll(/\s+/gu, ' ');

/**
 * FE03 "announce status": the confirmation of a committed command is kept by
 * the island in one persistent polite line, not by the form the canonical
 * refetch removes. So it is still on the page AFTER that refetch (a plain
 * assertion, not the recorder's), it is a polite atomic live region, and no form
 * repeats it in a second live region.
 */
const expectConfirmationStays = async (
  page: Page,
  expected: string | RegExp,
): Promise<void> => {
  const line = page.locator('[data-cms-workflow-status="island"]');
  await expect(line).toHaveText(expected);
  await expect(line).toHaveAttribute('role', 'status');
  await expect(line).toHaveAttribute('aria-live', 'polite');
  await expect(line).toHaveAttribute('aria-atomic', 'true');
  await expect(
    page
      .locator('[data-cms-workflow-form] [data-cms-workflow-status]')
      .filter({ hasText: /\S/u }),
  ).toHaveCount(0);
};

test('[S11-RR-05] the author submits the current draft from the workflow page and the open review is canonical', async () => {
  const entry = await seedEntry(authorSession.client, cast.world, 'Submit me');
  const page = authorSession.page;
  await gotoHydrated(page, ENTRY_PAGE(entry.entryId));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await startRecordingStatusTexts(page);
  await page.getByRole('button', { name: /^Submit for review/u }).click();
  // The recorder proves the confirmation was announced when it appeared; the
  // canonical read that follows removes the submit form, and the island's own
  // line must still read it after that.
  await expectStatusAnnounced(
    page,
    'Review submitted. It is open for decisions.',
  );
  await expect(
    page.getByRole('region', { name: 'Review', exact: true }),
  ).toContainText('Open. Risk class:');
  await expectConfirmationStays(
    page,
    'Review submitted. It is open for decisions.',
  );
  const view = await readWorkflow(authorSession.client, entry.entryId);
  expect(view.reviewState, view.text).toBe('open');
  expect(authorSession.browserErrors).toEqual([]);
});

test('[S11-RR-18] a reviewer assignment needs a completed step-up, then answers 201; an ineligible person is refused', async ({
  browser,
}) => {
  const entry = await seedEntry(authorSession.client, cast.world, 'Assign me');
  const review = await submitReviewViaApi(authorSession.client, entry);
  // No completed step-up: the Worker refuses before anything is read or written.
  const staleOwner = await signInS11(browser, cast.world, cast.owner, null);
  const stale = await assignReviewerViaApi(
    staleOwner.client,
    review,
    cast.reviewer.principal.personId,
  );
  expect(stale.status, stale.text).toBe(401);
  expect(stale.text).toContain('STEP_UP_REQUIRED');
  await staleOwner.context.close();
  await completeStepUp(ownerSession.context, cast.world, cast.owner);
  const ineligible = await assignReviewerViaApi(
    ownerSession.client,
    review,
    cast.author.principal.personId,
  );
  expect(ineligible.status, ineligible.text).toBe(409);
  expect(ineligible.text).toContain('reviewer_not_eligible');
  const created = await assignReviewerViaApi(
    ownerSession.client,
    review,
    cast.reviewer.principal.personId,
  );
  expect(created.status, created.text).toBe(201);
  const view = await readWorkflow(authorSession.client, entry.entryId);
  expect(view.reviewVersion, 'assignment never advances the review').toBe(
    review.reviewVersion,
  );
});

test('[S11-RR-06] a review decision interrupted by step-up returns to its draft, needs one confirmation and commits once', async ({
  browser,
}) => {
  const entry = await seedEntry(authorSession.client, cast.world, 'Decide me');
  const review = await submitReviewViaApi(authorSession.client, entry);
  await completeStepUp(ownerSession.context, cast.world, cast.owner);
  const assigned = await assignReviewerViaApi(
    ownerSession.client,
    review,
    cast.reviewer.principal.personId,
  );
  expect(assigned.status, assigned.text).toBe(201);
  const reviewer = await signInS11(browser, cast.world, cast.reviewer, null);
  const page = reviewer.page;
  await gotoHydrated(page, REVIEW_PAGE(review.reviewId));
  await page.getByLabel('Approve').check();
  await page.getByLabel('Reason').fill('Reads well and is ready to publish.');
  // The browser is sent to /step-up with the page it must return to. The MFA
  // ceremony and the /step-up page are the Slice 09 suites' subject, and the
  // loopback harness has no MFA-capable session behind that page (it redirects to
  // sign-in, which retires the tab's step-up scope), so a placeholder holds the
  // tab there: the navigation REQUEST is the evidence.
  await page.route(/\/step-up\?/u, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Step-up</title><p>Step-up placeholder</p>',
    }),
  );
  const stepUpNavigation = page.waitForRequest(
    (request) =>
      request.isNavigationRequest() &&
      new URL(request.url()).pathname === '/step-up',
    { timeout: 30_000 },
  );
  await page.getByRole('button', { name: 'Record approval' }).click();
  const returnTo =
    new URL((await stepUpNavigation).url()).searchParams.get('returnTo') ?? '';
  expect(returnTo).toBe(REVIEW_PAGE(review.reviewId));
  // Nothing was recorded by the refused attempt.
  const before = await readWorkflow(authorSession.client, entry.entryId);
  expect(before.reviewState).toBe('open');
  expect(before.reviewVersion).toBe(review.reviewVersion);
  await completeStepUp(reviewer.context, cast.world, cast.reviewer);
  await gotoHydrated(page, returnTo);
  // The draft returns; the decision is NOT replayed until the reviewer confirms.
  await expect(page.getByLabel('Approve')).toBeChecked();
  await expect(page.getByLabel('Reason')).toHaveValue(
    'Reads well and is ready to publish.',
  );
  const mid = await readWorkflow(authorSession.client, entry.entryId);
  expect(mid.reviewState, 'no automatic replay').toBe('open');
  await startRecordingStatusTexts(page);
  await page.getByRole('button', { name: 'Record approval' }).click();
  // The confirmation was announced when it appeared ...
  await expectStatusAnnounced(page, 'Decision recorded.');
  // ... the canonical read that followed shows the approved review with the
  // reviewer's own decision ...
  await expect(page.getByText(/State: Approved/u)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Decisions' })).toContainText(
    'Your decision: approve',
  );
  // ... and the confirmation is still on the page after that read, in the
  // island's persistent line, though the decision form is gone.
  await expect(
    page.getByRole('heading', { name: 'Record your decision' }),
  ).toHaveCount(0);
  await expectConfirmationStays(page, 'Decision recorded.');
  const after = await readWorkflow(authorSession.client, entry.entryId);
  expect(after.reviewState, after.text).toBe('approved');
  expect(reviewer.browserErrors).toEqual([]);
  await reviewer.context.close();
});

test('[S11-RR-09] publish now records a pending publication and never claims public visibility', async ({
  browser,
}) => {
  const flow = await approvedEntry('Publish me');
  const publisher = await signInS11(
    browser,
    cast.world,
    cast.publisher,
    new Date(),
  );
  const page = publisher.page;
  await gotoHydrated(page, ENTRY_PAGE(flow.entry.entryId));
  const publish = disclosure(page, 'Publish now');
  await publish.locator('summary').click();
  await publish.getByLabel('Audience').fill('public');
  await startRecordingStatusTexts(page);
  await publish.getByRole('button', { name: 'Confirm publish' }).click();
  const announced = await expectStatusAnnounced(
    page,
    /^Publication recorded as version/u,
  );
  expect(announced).toContain('not confirmed visible to readers');
  // The canonical read that follows lists the publication, still unconfirmed ...
  await expect(
    page.getByRole('region', { name: 'Publications', exact: true }),
  ).toContainText('not confirmed visible to readers');
  // ... and the island's line still says so after that read.
  await expectConfirmationStays(
    page,
    /^Publication recorded as version \d+\. .*not confirmed visible to readers/u,
  );
  const text = await readoutAfter(page);
  expect(text).not.toMatch(/now live|is live|publicly visible/iu);
  for (const shown of await recordedStatusTexts(page))
    expect(shown).not.toMatch(/now live|is live|publicly visible/iu);
  expect(publisher.browserErrors).toEqual([]);
  await publisher.context.close();
});

test('[S11-RR-07] a schedule resolves the local time, blocks a nonexistent one, and commits as scheduled, not published', async ({
  browser,
}) => {
  const flow = await approvedEntry('Schedule me');
  const publisher = await signInS11(
    browser,
    cast.world,
    cast.publisher,
    new Date(),
  );
  const page = publisher.page;
  await gotoHydrated(page, ENTRY_PAGE(flow.entry.entryId));
  const schedule = disclosure(page, 'Schedule publication');
  await schedule.locator('summary').click();
  // The next real spring-forward gap inside the schedule horizon, read from the
  // host's tz data: a fixed calendar date would go stale.
  const gap = nextSpringForwardGap(new Date());
  await schedule.getByLabel('Time zone').fill(gap.zone);
  await schedule.getByLabel('Audience').fill('public');
  // The skipped hour of a spring-forward day does not exist in that zone.
  await schedule.getByLabel('Local date and time').fill(gap.nonexistentLocal);
  await expect(
    page.getByText('That local time does not exist in this time zone.'),
  ).toBeVisible();
  await schedule.getByLabel('Local date and time').fill(gap.validLocal);
  await startRecordingStatusTexts(page);
  await schedule.getByRole('button', { name: 'Schedule', exact: true }).click();
  await expectStatusAnnounced(page, /^Scheduled, not published:/u);
  await expect(
    page.getByRole('region', { name: 'Schedules', exact: true }),
  ).toContainText('Scheduled, not published');
  // The island's line still reads it after the canonical read.
  await expectConfirmationStays(page, /^Scheduled, not published: /u);
  expect(publisher.browserErrors).toEqual([]);
  await publisher.context.close();
});
