import { expect, test } from '@playwright/test';

import { psql } from '../postgrest/support/stack';
import { waitForIslands } from './support/s10-real-browser';
import { trace } from './support/s12-pw5-trace';
import { PATTERN_PAGE } from './support/s12-pw5-world';
import { definePatternInBrowser } from './support/s12-pw9-flow';
import { expectNothingLeaked } from './support/s12-pw9-scan';
import {
  marker,
  patternEventCount,
  patternState,
  uuid,
} from './support/s12-pw9-world';
import { ownedPatternBlock, type OwnedBlock } from './support/s12-pw7-block';
import {
  approveInBrowser,
  assignInBrowser,
  ownerAction,
  prepareJourneyCast,
  submitFromPage,
  within,
  type JourneyCast,
} from './support/s12-pw7-flow';
import { typeKeyOf } from './support/s12-pw7-world';

/*
 * P2-S12-AC-273 (V11 section 5), the PATTERN journey that starts in the browser: the pattern is NOT seeded. Through the REAL
 * composition (production-built Astro routes -> web proxy -> production Worker -> production RPC adapter -> Kong -> PostgREST
 * -> the Slice 12 SQL), with three people:
 *
 *   J10  the designer CREATES a pattern in the /patterns/new form (key, content type, one top-level block, its props) and
 *        SUBMITS it from its page; the owner ASSIGNS the reviewer in the browser; the reviewer DECIDES in the browser; the
 *        owner SCHEDULES its activation in the browser (CMS-03C-09 `schedule`: 202, a `pending` schedule row, the subject
 *        `scheduled`, no event until execution). The pattern page and the review page state it in words.
 *
 * `phase-02-slice-12-definition-journeys-real-route.spec.ts` J2 saves its pattern through the first-party route and
 * activates/retires it; this journey is the browser creation and the schedule. Written without a running stack (the lane may
 * not run one): selectors follow the pw7 page-operations spec, which created a pattern from the same form. Local loopback only.
 */
let journey: JourneyCast;
let typeKey: string;
let block: OwnedBlock;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);
  journey = await prepareJourneyCast(
    browser,
    test.info().project.use.baseURL,
    'pattern',
  );
  typeKey = typeKeyOf(journey.cast.world);
  block = await ownedPatternBlock(journey.cast.world);
});

test('[P2-S12-AC-273] J10 a pattern is created in the browser, submitted, assigned, decided and scheduled by three people', async () => {
  test.setTimeout(600_000);
  const { cast, designer, owner, reviewer } = journey;
  const pages = [designer.page, owner.page, reviewer.page];
  const gathered = trace(...pages);
  const tag = marker('pattern');
  const reason = `${tag} approved for scheduling.`;

  const patternKey = await definePatternInBrowser(
    designer,
    typeKey,
    block,
    tag,
  );
  const versionId = psql(
    `select id from platform_private.cms_pattern_versions where pattern_key = '${patternKey.replaceAll("'", "''")}'`,
  );
  expect(patternState(versionId)).toBe('draft');

  const reviewId = await submitFromPage(
    designer.page,
    PATTERN_PAGE(patternKey),
  );
  expect(patternState(versionId)).toBe('review');
  await assignInBrowser(journey, reviewId);
  await approveInBrowser(journey, reviewId, reason, false);
  expect(patternState(versionId)).toBe('approved');
  await ownerAction(journey, reviewId, 'schedule');

  // Scheduled, not active: one pending schedule, the subject `scheduled`, no activation event yet.
  expect(patternState(versionId)).toBe('scheduled');
  expect(
    psql(
      `select count(*)::text || '|' || min(state) from platform_private.cms_governed_activation_schedules
        where review_id = '${uuid(reviewId)}'`,
    ),
  ).toBe('1|pending');
  expect(patternEventCount(versionId)).toBe(0);
  await owner.page.reload({ waitUntil: 'domcontentloaded' });
  await waitForIslands(owner.page);
  await expect(
    owner.page.getByText(/Scheduled activation: pending\./u),
  ).toBeVisible(within);
  await expect(
    owner.page.locator('[data-cms-governed-review-detail]'),
  ).toContainText('Subject: Scheduled, not active');

  // The pattern's own page states the lifecycle in words.
  await designer.page.goto(PATTERN_PAGE(patternKey), {
    waitUntil: 'domcontentloaded',
  });
  await waitForIslands(designer.page);
  await expect(
    designer.page.locator('[data-governed-lifecycle]'),
  ).toContainText('Lifecycle: Scheduled', within);

  for (const person of [designer, owner, reviewer])
    expect(person.browserErrors).toEqual([]);
  await expectNothingLeaked(gathered, pages, {
    persons: [
      cast.owner.principal.personId,
      cast.owner.principal.authUserId,
      journey.designerActor.principal.personId,
      journey.designerActor.principal.authUserId,
      cast.reviewer.principal.personId,
      cast.reviewer.principal.authUserId,
    ],
    values: [tag, reason],
  });
});
