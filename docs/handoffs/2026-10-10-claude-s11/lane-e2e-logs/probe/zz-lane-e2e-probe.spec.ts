import { appendFileSync } from 'node:fs';

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

/** The collapsed section whose summary reads `summary` (each form owns an Audience field). */
const disclosure = (page: Page, summary: string) =>
  page
    .locator('details')
    .filter({ has: page.locator('summary', { hasText: summary }) });

const OUT = process.env['PROBE_OUT'] ?? '/dev/null';
const note = (line: string): void => appendFileSync(OUT, `${line}\n`);

/** Records when each polite status text appears and when it leaves the page, in page milliseconds. */
const recordStatusLifetimes = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const lifetimes: Record<string, { appearedAt: number; goneAt: number | null }> = {};
    const marks: Record<string, number> = {};
    Reflect.set(window, '__lifetimes', lifetimes);
    Reflect.set(window, '__marks', marks);
    document.addEventListener('click', () => { marks['click'] ??= performance.now(); }, true);
    const sweep = (): void => {
      const present = new Set<string>();
      for (const status of document.querySelectorAll('[data-cms-workflow-status]')) {
        const text = (status.textContent ?? '').trim();
        if (text !== '') present.add(text);
      }
      const now = performance.now();
      for (const text of present) lifetimes[text] ??= { appearedAt: now, goneAt: null };
      for (const [text, life] of Object.entries(lifetimes))
        if (life.goneAt === null && !present.has(text)) life.goneAt = now;
    };
    new MutationObserver(sweep).observe(document.body, { childList: true, subtree: true, characterData: true });
    sweep();
  });

for (const attempt of [1, 2, 3, 4, 5]) {
  test(`[PROBE-RR-06-${attempt}] how long the decision confirmation stays on the page`, async ({ browser }) => {
    const entry = await seedEntry(authorSession.client, cast.world, `Decide me ${attempt}`);
    const review = await submitReviewViaApi(authorSession.client, entry);
    await completeStepUp(ownerSession.context, cast.world, cast.owner);
    const assigned = await assignReviewerViaApi(ownerSession.client, review, cast.reviewer.principal.personId);
    expect(assigned.status, assigned.text).toBe(201);
    const reviewer = await signInS11(browser, cast.world, cast.reviewer, new Date());
    const page = reviewer.page;
    await gotoHydrated(page, REVIEW_PAGE(review.reviewId));
    await page.getByLabel('Approve').check();
    await page.getByLabel('Reason').fill('Reads well and is ready to publish.');
    await recordStatusLifetimes(page);
    await page.getByRole('button', { name: 'Record approval' }).click();
    await expect(page.getByText(/State: Approved/u)).toBeVisible();
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => ({
      lifetimes: Reflect.get(window, '__lifetimes') as Record<string, { appearedAt: number; goneAt: number | null }>,
      marks: Reflect.get(window, '__marks') as Record<string, number>,
    }));
    const click = result.marks['click'] ?? 0;
    const rows = Object.entries(result.lifetimes).map(
      ([text, life]) => `${JSON.stringify(text)} appeared +${Math.round(life.appearedAt - click)}ms after the click, left ${life.goneAt === null ? 'never' : `+${Math.round(life.goneAt - click)}ms`}, visible ${life.goneAt === null ? 'still' : `${Math.round(life.goneAt - life.appearedAt)}ms`}`,
    );
    note(`PROBE-RR-06 attempt=${attempt}: ${rows.join(' | ')}`);
    await reviewer.context.close();
  });
}

test('[PROBE-RR-07] what the page says when a publisher whose grant ends in 30 days schedules 2027-03-15', async ({ browser }) => {
  const shortPublisher = actor(provisionMember(cast.world, 's11-publisher-30d', ['cms.publisher']), ['cms.publisher']);
  const flow = await approvedEntry('Schedule me, short grant');
  const publisher = await signInS11(browser, cast.world, shortPublisher, new Date());
  const page = publisher.page;
  await gotoHydrated(page, ENTRY_PAGE(flow.entry.entryId));
  const schedule = disclosure(page, 'Schedule publication');
  await schedule.locator('summary').click();
  await schedule.getByLabel('Time zone').fill('America/New_York');
  await schedule.getByLabel('Audience').fill('public');
  await schedule.getByLabel('Local date and time').fill('2027-03-15T10:00');
  await schedule.getByRole('button', { name: 'Schedule', exact: true }).click();
  await page.waitForTimeout(4_000);
  const text = (await page.locator('main').innerText()).replaceAll(/\s+/gu, ' ');
  const alerts = await page.locator('[role="alert"], [data-cms-workflow-status]').allInnerTexts();
  note(`PROBE-RR-07 status/alert texts: ${JSON.stringify(alerts)}`);
  note(`PROBE-RR-07 contains "Scheduled, not published": ${text.includes('Scheduled, not published')}`);
  await publisher.context.close();
});
