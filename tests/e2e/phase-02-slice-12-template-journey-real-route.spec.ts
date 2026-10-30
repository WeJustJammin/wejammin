import { expect, test } from '@playwright/test';

import { waitForIslands } from './support/s10-real-browser';
import { completeStepUp } from './support/s11-real-browser';
import {
  approveGovernedViaApi,
  assignGovernedViaApi,
  readGovernedReview,
} from './support/s12-governed-world';
import { expectNothingIdentifying, trace } from './support/s12-pw5-trace';
import {
  approveInBrowser,
  assignInBrowser,
  ownerAction,
  prepareJourneyCast,
  submitFromPage,
  within,
  type JourneyCast,
} from './support/s12-pw7-flow';
import {
  TEMPLATE_VERSIONS_API,
  defineTemplateViaApi,
} from './support/s12-pw7-tagged';
import { submitSubjectViaApi, typeKeyOf } from './support/s12-pw7-world';

/*
 * P2-S12-AC-273 (V11 section 5), the TEMPLATE journey that `phase-02-slice-12-definition-journeys-real-route.spec.ts`
 * could not drive while the template routes were test-owned fixtures. A signed session carrying the Slice 11/12 claims
 * now reaches the PRODUCTION composition for CMS-03C-01 and its reads (`support/s12-real-template-locale.ts`), so a
 * template version is a real governed subject:
 *
 *   J3  the designer DEFINES a template in the browser form and SUBMITS it from its page; the owner ASSIGNS the reviewer in
 *       the browser; the reviewer DECIDES in the browser; the owner SCHEDULES its activation in the browser. A second
 *       template (defined through the first-party route) is decided by the reviewer and then ACTIVATED and RETIRED by the
 *       owner in the browser.
 *   Every URL, request, console line and storage value of the four pages is scanned for a person id and a content hash.
 *
 * Written without a running stack (the lane may not run one): selectors follow the component sources, so a first run may
 * need an exact label adjusted. Local loopback only; never hosted evidence.
 */
const NEW_PAGE = '/app/cms-content-modeling/templates/new';
let journey: JourneyCast;
let typeKey: string;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);
  journey = await prepareJourneyCast(
    browser,
    test.info().project.use.baseURL,
    'template',
  );
  typeKey = typeKeyOf(journey.cast.world);
});

/** The designer defines a template in the browser form and returns the address its own link opens. */
const defineTemplateInBrowser = async (): Promise<string> => {
  const { page } = journey.designer;
  const key = `s12-jrn-tpl-${crypto.randomUUID().slice(0, 8).replaceAll('-', '')}`;
  await page.goto(NEW_PAGE, { waitUntil: 'domcontentloaded' });
  await waitForIslands(page);
  await page.getByLabel('Template key', { exact: true }).fill(key);
  await page
    .getByRole('checkbox', { name: new RegExp(`^${typeKey} · version`, 'u') })
    .check();
  await page.getByLabel('Locale', { exact: true }).fill('en-US');
  await page.getByLabel('Audience', { exact: true }).fill('public');
  const command = page.waitForResponse(
    (response) =>
      response.url().endsWith(TEMPLATE_VERSIONS_API) &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create draft' }).click();
  const answered = await command;
  expect(answered.status()).toBe(201);
  expect(answered.headers()['etag']).toBe('"1"');
  await expect(
    page.getByRole('heading', { name: 'Draft created.' }),
  ).toBeVisible(within);
  const href = await page
    .getByRole('link', { name: 'Open latest draft' })
    .getAttribute('href');
  expect(href).toBe(`/app/cms-content-modeling/templates/${key}`);
  return href ?? '';
};

test('[P2-S12-AC-273] J3 a template is defined, submitted, assigned, decided and scheduled in the browser by three people, and a second one is activated and retired', async () => {
  test.setTimeout(600_000);
  const { cast, designer, owner, reviewer } = journey;
  const pages = [designer.page, owner.page, reviewer.page];
  const gathered = trace(...pages);

  // Template one: define (browser), submit (browser), assign (browser), decide (browser), schedule (browser).
  const pageOne = await defineTemplateInBrowser();
  const reviewOne = await submitFromPage(designer.page, pageOne);
  await assignInBrowser(journey, reviewOne);
  await approveInBrowser(
    journey,
    reviewOne,
    'Template journey reason one is specific to this run.',
    false,
  );
  expect((await readGovernedReview(reviewer.client, reviewOne)).state).toBe(
    'approved',
  );
  await ownerAction(journey, reviewOne, 'schedule');
  await owner.page.reload({ waitUntil: 'domcontentloaded' });
  await waitForIslands(owner.page);
  await expect(
    owner.page.getByText(/Scheduled activation: pending\./u),
  ).toBeVisible(within);

  // Template two: defined and submitted through the first-party routes, decided, then activated and retired in the browser.
  const second = await defineTemplateViaApi(designer.client, cast.world);
  const reviewTwo = await submitSubjectViaApi(
    designer.client,
    'template_version',
    {
      versionId: second.versionId,
      contentHash: second.contentHash,
    },
  );
  await completeStepUp(owner.context, cast.world, journey.ownerActor);
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
    'Template journey reason two is specific to this run.',
  );
  expect(decided.status, decided.text).toBe(200);
  await ownerAction(journey, reviewTwo.reviewId, 'activate');
  await ownerAction(journey, reviewTwo.reviewId, 'retire');

  // The second template's own page states its lifecycle in words after the journey.
  await designer.page.goto(
    `/app/cms-content-modeling/templates/${second.templateKey}`,
    { waitUntil: 'domcontentloaded' },
  );
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
    journey.designerActor.principal.personId,
    journey.designerActor.principal.authUserId,
    cast.reviewer.principal.personId,
    cast.reviewer.principal.authUserId,
    second.contentHash,
  ]);
});
