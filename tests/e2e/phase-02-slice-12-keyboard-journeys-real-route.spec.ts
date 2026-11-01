import { expect, test, type Page } from '@playwright/test';

import { psql } from '../postgrest/support/stack';
import {
  expectNoHorizontalScroll,
  waitForIslands,
} from './support/s10-real-browser';
import { readGovernedReview } from './support/s12-governed-world';
import { trace } from './support/s12-pw5-trace';
import { PATTERN_PAGE } from './support/s12-pw5-world';
import {
  DESKTOP_VIEWPORT,
  KEY_VIEWPORT,
  assignByKeyboard,
  defineTemplateByKeyboard,
  scheduleByKeyboard,
  submitByKeyboard,
} from './support/s12-pw9-keys';
import { expectNothingLeaked } from './support/s12-pw9-scan';
import { marker, patternState, uuid } from './support/s12-pw9-world';
import {
  definePatternWithBlock,
  ownedPatternBlock,
  type OwnedBlock,
} from './support/s12-pw7-block';
import {
  approveInBrowser,
  prepareJourneyCast,
  within,
  type JourneyCast,
} from './support/s12-pw7-flow';
import { typeKeyOf } from './support/s12-pw7-world';

/*
 * P2-S12-AC-273 (V11 section 5): "runs keyboard-only and at 200% zoom". A 640x400 viewport is a 1280x800 layout at 200%
 * zoom. Through the REAL composition, with three people, every control of the journey is reached with Tab and operated with
 * Space, Enter, the arrow keys and typed text (`support/s12-pw9-keys.ts`); the page never scrolls sideways.
 *
 *   J11  TEMPLATE: the designer defines a template (key, content type, locale, audience, Create draft, the page's link),
 *        submits it from its page, the owner assigns the reviewer, the reviewer decides, the owner schedules its activation.
 *   J12  PATTERN: a saved pattern (the tree editor is the subject of the pattern designer's own suites and of J10) is
 *        submitted from its page, assigned, decided and scheduled the same way.
 *
 * The vocabulary decision is already keyboard-only in J1 (`definition-journeys`). Written without a running stack (the lane
 * may not run one): the date-time fields are typed in en-US segment order and checked by value (see the keys module's header).
 * Local loopback only; never hosted evidence.
 */
let journey: JourneyCast;
let typeKey: string;
let block: OwnedBlock;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);
  journey = await prepareJourneyCast(
    browser,
    test.info().project.use.baseURL,
    'keyboard',
  );
  typeKey = typeKeyOf(journey.cast.world);
  block = await ownedPatternBlock(journey.cast.world);
});

const people = (): Page[] => [
  journey.designer.page,
  journey.owner.page,
  journey.reviewer.page,
];

test.beforeEach(async () => {
  for (const page of people()) await page.setViewportSize(KEY_VIEWPORT);
});

test.afterEach(async () => {
  for (const page of people()) await page.setViewportSize(DESKTOP_VIEWPORT);
});

/** Submit, assign, decide and schedule the subject on `subjectPage`, by key presses only; returns the review id. */
const journeyByKeyboard = async (
  subjectPage: string,
  reason: string,
): Promise<string> => {
  const { designer, owner, reviewer } = journey;
  const reviewId = await submitByKeyboard(designer.page, subjectPage);
  await assignByKeyboard(journey, reviewId);
  await approveInBrowser(journey, reviewId, reason, true);
  expect((await readGovernedReview(reviewer.client, reviewId)).state).toBe(
    'approved',
  );
  await scheduleByKeyboard(journey, reviewId);
  await owner.page.reload({ waitUntil: 'domcontentloaded' });
  await waitForIslands(owner.page);
  await expectNoHorizontalScroll(owner.page, 'scheduled review at 200%');
  await expect(
    owner.page.getByText(/Scheduled activation: pending\./u),
  ).toBeVisible(within);
  expect(
    psql(
      `select count(*)::text || '|' || min(state) from platform_private.cms_governed_activation_schedules
        where review_id = '${uuid(reviewId)}'`,
    ),
  ).toBe('1|pending');
  return reviewId;
};

const forbiddenOf = (tag: string, reason: string) => ({
  persons: [
    journey.cast.owner.principal.personId,
    journey.cast.owner.principal.authUserId,
    journey.designerActor.principal.personId,
    journey.designerActor.principal.authUserId,
    journey.cast.reviewer.principal.personId,
    journey.cast.reviewer.principal.authUserId,
  ],
  values: [tag, reason],
});

test('[P2-S12-AC-273] J11 a template is defined, submitted, assigned, decided and scheduled by keyboard alone at a 640x400 viewport', async () => {
  test.setTimeout(900_000);
  const { designer, owner, reviewer } = journey;
  const pages = [designer.page, owner.page, reviewer.page];
  const gathered = trace(...pages);
  const tag = marker('kbd-template');
  const reason = `${tag} template approved by keyboard.`;

  const templateKey = await defineTemplateByKeyboard(designer.page, typeKey);
  await journeyByKeyboard(
    `/app/cms-content-modeling/templates/${templateKey}`,
    reason,
  );
  await designer.page.goto(
    `/app/cms-content-modeling/templates/${templateKey}`,
    { waitUntil: 'domcontentloaded' },
  );
  await waitForIslands(designer.page);
  await expect(
    designer.page.locator('[data-governed-lifecycle]'),
  ).toContainText('Lifecycle: Scheduled', within);
  for (const person of [designer, owner, reviewer])
    expect(person.browserErrors).toEqual([]);
  await expectNothingLeaked(gathered, pages, forbiddenOf(tag, reason));
});

test('[P2-S12-AC-273] J12 a pattern is submitted, assigned, decided and scheduled by keyboard alone at a 640x400 viewport', async () => {
  test.setTimeout(900_000);
  const { cast, designer, owner, reviewer } = journey;
  const pages = [designer.page, owner.page, reviewer.page];
  const gathered = trace(...pages);
  const tag = marker('kbd-pattern');
  const reason = `${tag} pattern approved by keyboard.`;

  const saved = await definePatternWithBlock(
    designer.client,
    cast.world,
    block,
    tag,
  );
  await journeyByKeyboard(PATTERN_PAGE(saved.patternKey), reason);
  expect(patternState(saved.versionId)).toBe('scheduled');
  await designer.page.goto(PATTERN_PAGE(saved.patternKey), {
    waitUntil: 'domcontentloaded',
  });
  await waitForIslands(designer.page);
  await expect(
    designer.page.locator('[data-governed-lifecycle]'),
  ).toContainText('Lifecycle: Scheduled', within);
  for (const person of [designer, owner, reviewer])
    expect(person.browserErrors).toEqual([]);
  await expectNothingLeaked(gathered, pages, forbiddenOf(tag, reason));
});
