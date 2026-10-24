import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import {
  expect,
  test,
  type Locator,
  type Page,
  type Request,
  type Response,
} from '@playwright/test';

import { BUNDLE_BUDGETS } from '../../scripts/verify-bundle-budget.mjs';
import {
  expectNoHorizontalScroll,
  expectNoSeriousAxeFindings,
  requireLoopbackOrigin,
  tabTo,
  waitForIslands,
  type SignedIn,
} from './support/s10-real-browser';
import { completeStepUp, signInS11 } from './support/s11-real-browser';
import {
  GOVERNED_REVIEWS_API,
  REVIEW_PAGE,
  TAXONOMY_PAGE,
  assignGovernedViaApi,
  defineTaxonomyViaApi,
  grantReviewerViaApi,
  governedEffects,
  prepareGovernedCast,
  readGovernedReview,
  submitGovernedViaApi,
  type GovernedCast,
  type OpenReview,
} from './support/s12-governed-world';

/*
 * P2-S12-AC-273 / V11 section 5: the governed definition-review surfaces through the REAL
 * composition (production-built Astro routes -> web proxy -> private binding -> production Worker
 * -> production RPC adapter -> Kong -> PostgREST -> the Slice 12 SQL), driven by two or three
 * people. The subject is a vocabulary version; the review is made through the first-party routes
 * (never seeded) except where a test drives the very form it is about. Step-up is the signed
 * session's completed-MFA instant (the ceremony itself is the Slice 09 suites' subject).
 *
 * The decision form, the assignment forms, the activation form and the panel's submit form load on
 * the first pointer, touch, focus or key in their region (`cms-lazy-intent.ts`). The tests hold
 * those chunks (`page.route`) so the window before hydration is OBSERVED, not assumed: `fill` and
 * `click` would otherwise wait for an enabled control and pass without ever seeing it.
 * Local loopback only; never hosted evidence.
 *
 * Written without a running stack (the lane may not start one): the selectors and labels follow
 * the component sources, so a first run may need an exact label adjusted. T6 names buttons by
 * pattern where the source offers a choice of wording. The API Worker serves the governed and
 * vocabulary-definition routes from the production composition (`support/s12-real-governed.ts`,
 * wired in `support/content-schema-registry-api.ts`); the template and locale routes keep their
 * fixtures.
 */
const GOVERNED_CHUNKS = {
  decision: '**/_astro/CmsGovernedDecisionForm*.js',
  submit: '**/_astro/CmsGovernedSubmitForm*.js',
  /**
   * Matches the chunk with or without a query: the page retries a failed chunk under a
   * `?wj_retry=N` marker (a browser never re-requests a failed URL), and a chunk that "cannot be
   * fetched" must stay unreachable under every marker. One object, so `unroute` finds it.
   */
  transport: /\/_astro\/governed-review-command-transport[^/]*\.js(?:\?.*)?$/u,
} as const;
const ZOD_OR_VALIDATORS = /\/(?:contracts|validators)\.[\w-]+\.m?js$/u;
const GOVERNED_FORM_CHUNK =
  /\/CmsGoverned(?:Decision|Assignment|Activation|Submit)Form\.[\w-]+\.m?js$/u;

test.describe.configure({ mode: 'serial' });

let cast: GovernedCast;
let curator: SignedIn;
let owner: SignedIn;
let reviewer: SignedIn;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  requireLoopbackOrigin(test.info().project.use.baseURL);
  cast = await prepareGovernedCast();
  curator = await signInS11(browser, cast.world, cast.curator, null);
  owner = await signInS11(browser, cast.world, cast.owner, null);
  reviewer = await signInS11(browser, cast.world, cast.reviewer, null);
});

/** A review that is open, with `cast.reviewer` assigned; the reviewer has a fresh step-up. */
const assignedReview = async (): Promise<OpenReview> => {
  const subject = await defineTaxonomyViaApi(curator.client, cast.world);
  const review = await submitGovernedViaApi(curator.client, subject);
  await completeStepUp(owner.context, cast.world, cast.owner);
  const assigned = await assignGovernedViaApi(
    owner.client,
    review,
    cast.reviewer.principal.personId,
  );
  expect(assigned.status, assigned.text).toBe(201);
  await completeStepUp(reviewer.context, cast.world, cast.reviewer);
  const read = await readGovernedReview(reviewer.client, review.reviewId);
  return { reviewId: review.reviewId, reviewVersion: read.version };
};

/** A held request: every matching chunk waits until `release` is called. */
const hold = async (page: Page, pattern: string) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(pattern, async (route) => {
    await gate;
    await route.continue();
  });
  return { release };
};

const decisionPosts = (page: Page, reviewId: string): Request[] => {
  const seen: Request[] = [];
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url().endsWith(`${GOVERNED_REVIEWS_API}/${reviewId}/decision`)
    )
      seen.push(request);
  });
  return seen;
};

/**
 * What a region shows when a step fails: its accessible snapshot and its text, written under a
 * directory of its own (later specs reuse `test-results/`) and attached to the test.
 */
const keepRegionEvidence = async (
  page: Page,
  region: Locator,
  name: string,
): Promise<void> => {
  const directory = join(process.cwd(), 'test-results-governed-evidence');
  mkdirSync(directory, { recursive: true });
  const present = await region.count().catch(() => 0);
  const snapshot = await region
    .ariaSnapshot({ timeout: 5_000 })
    .catch((error: unknown) => String(error));
  const text = await region.innerText({ timeout: 5_000 }).catch(() => '');
  // A region that is not on the page is itself the finding: keep what the page does show.
  const main = await page
    .locator('main')
    .first()
    .ariaSnapshot({ timeout: 5_000 })
    .catch((error: unknown) => String(error));
  const body = `url: ${page.url()}\nregion count: ${String(present)}\n\n${snapshot}\n\n--- region text ---\n${text}\n\n--- main ---\n${main}\n`;
  const file = join(directory, `${name}-${String(Date.now())}.txt`);
  writeFileSync(file, body);
  console.log(`[governed evidence] ${file}\n${body}`);
  await test.info().attach(name, { body, contentType: 'text/plain' });
};

/** Runs one step; when it fails, keeps the page URL, the region and the main landmark first. */
const evidenceStep = async (
  page: Page,
  region: Locator,
  name: string,
  run: () => Promise<void>,
): Promise<void> => {
  try {
    await run();
  } catch (error) {
    await keepRegionEvidence(page, region, name);
    throw error;
  }
};

const decisionRegion = (page: Page) =>
  page.locator('[data-cms-lazy-region="governed-decision"]');

test('[T1] a decision typed and pressed before its chunk arrives is kept, held, and sent exactly once', async () => {
  const review = await assignedReview();
  const { page } = reviewer;
  const posts = decisionPosts(page, review.reviewId);
  const navigations: string[] = [];
  page.on('framenavigated', (frame) => navigations.push(frame.url()));
  const chunk = await hold(page, GOVERNED_CHUNKS.decision);

  await page.goto(REVIEW_PAGE(review.reviewId), {
    waitUntil: 'domcontentloaded',
  });
  await waitForIslands(page);
  // The server markup carries the region, and its controls are native and enabled: nothing is
  // locked, so a person can type and choose at once.
  await expect(decisionRegion(page)).toHaveCount(1);
  const reason = decisionRegion(page).getByLabel('Reason');
  await expect(reason).toBeEditable();
  const approve = decisionRegion(page).getByLabel('Approve');
  await expect(approve).toBeEnabled();

  const before = navigations.length;
  await reason.pressSequentially('Checked against the frozen evidence.');
  await approve.check();
  await decisionRegion(page)
    // The server markup cannot know the choice, so before hydration the control reads "Record
    // decision"; it reads "Record approval" once the choice is in the form's state.
    .getByRole('button', { name: /Record (?:decision|approval)/u })
    .click({ force: true });
  await page.waitForTimeout(500);
  // A press before hydration is cancelled (it would be a native GET of the fields): the page
  // stayed where it was and nothing was sent.
  expect(navigations.length).toBe(before);
  expect(posts).toHaveLength(0);
  await expect(reason).toHaveValue('Checked against the frozen evidence.');

  chunk.release();
  await expect.poll(() => posts.length, { timeout: 30_000 }).toBe(1);
  const sent = posts[0] as Request;
  expect(sent.headers()['idempotency-key']).toMatch(/^[\w-]{16,}$/u);
  expect(sent.headers()['if-match']).toBe(`"${review.reviewVersion}"`);
  const body = sent.postDataJSON() as Record<string, unknown>;
  expect(body).toMatchObject({
    decision: 'approve',
    reason: 'Checked against the frozen evidence.',
    expectedVersion: review.reviewVersion,
  });
  expect(Object.keys(body)).not.toContain('capability');
  expect(Object.keys(body)).not.toContain('stepUpAt');
  await expect(page.getByText('Decision recorded.')).toBeVisible();
  expect(governedEffects(review.reviewId).decisions).toBe(1);
  expect(reviewer.browserErrors).toEqual([]);
});

test('[T2] the panel submit pressed three times before its chunk arrives sends one create, without If-Match', async () => {
  const subject = await defineTaxonomyViaApi(curator.client, cast.world);
  const { page } = curator;
  const posts: Request[] = [];
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url().endsWith(GOVERNED_REVIEWS_API)
    )
      posts.push(request);
  });
  const chunk = await hold(page, GOVERNED_CHUNKS.submit);
  await page.goto(TAXONOMY_PAGE(subject.taxonomyId), {
    waitUntil: 'domcontentloaded',
  });
  await waitForIslands(page);
  const submit = page.getByRole('button', { name: 'Submit for review' });
  for (let press = 0; press < 3; press += 1)
    await submit.click({ force: true });
  await page.waitForTimeout(500);
  expect(posts).toHaveLength(0);
  chunk.release();
  await expect.poll(() => posts.length, { timeout: 30_000 }).toBe(1);
  const sent = posts[0] as Request;
  expect(sent.headers()['idempotency-key']).toBeTruthy();
  expect(sent.headers()['if-match']).toBeUndefined();
  expect(sent.postDataJSON()).toMatchObject({
    subjectKind: 'taxonomy_version',
    subjectId: subject.versionId,
  });
  await expect(page.locator('h3:focus, h2:focus')).toHaveCount(1);
  expect(curator.browserErrors).toEqual([]);
});

test('[T3] keyboard only, in a 200% layout, with zero serious axe findings before and after the chunk arrives', async () => {
  const review = await assignedReview();
  const { page } = reviewer;
  const posts = decisionPosts(page, review.reviewId);
  const chunk = await hold(page, GOVERNED_CHUNKS.decision);
  // 200% zoom of a 1280x800 window reflows as a 640x400 layout.
  await page.setViewportSize({ width: 640, height: 400 });
  await page.goto(REVIEW_PAGE(review.reviewId), {
    waitUntil: 'domcontentloaded',
  });
  await waitForIslands(page);
  await expectNoSeriousAxeFindings(page, 'decision form before its chunk');
  await expectNoHorizontalScroll(page, 'decision form at 200%');

  await tabTo(page, /^input:Approve/u);
  await page.keyboard.press('Space');
  await tabTo(page, /^textarea:Reason/u);
  await page.keyboard.type('Keyboard only.');
  chunk.release();
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  // The choice made before hydration is in the form's state once the control is worded for it.
  await expect(
    decisionRegion(page).getByRole('button', { name: /Record approval/u }),
  ).toBeVisible();
  await expectNoSeriousAxeFindings(page, 'decision form after its chunk');
  await tabTo(page, /^button:Record approval/u);
  await page.keyboard.press('Enter');
  await expect.poll(() => posts.length, { timeout: 30_000 }).toBe(1);
  expect(posts[0]?.postDataJSON()).toMatchObject({
    decision: 'approve',
    reason: 'Keyboard only.',
  });
  await expect(page.getByText('Decision recorded.')).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(reviewer.browserErrors).toEqual([]);
});

type LoadedScript = Readonly<{ path: string; gzipBytes: number }>;

/** Every JavaScript response of a page navigation, with the gzip size `bundle:check` charges it. */
const coldLoad = async (page: Page, path: string): Promise<LoadedScript[]> => {
  const loaded: LoadedScript[] = [];
  const pending: Promise<void>[] = [];
  const onResponse = (response: Response): void => {
    const { pathname } = new URL(response.url());
    if (!/\.m?js$/u.test(pathname)) return;
    pending.push(
      response.body().then((body) => {
        loaded.push({ path: pathname, gzipBytes: gzipSync(body).length });
      }),
    );
  };
  page.on('response', onResponse);
  await page.goto(path, { waitUntil: 'networkidle' });
  await waitForIslands(page);
  await Promise.all(pending);
  page.off('response', onResponse);
  return loaded;
};

test('[T4] the cold load of each role fetches no governed form, no contract schema, and fits the initial-route budget', async () => {
  const review = await assignedReview();
  const subject = await defineTaxonomyViaApi(curator.client, cast.world);
  const roles = [
    ['reviewer', reviewer, REVIEW_PAGE(review.reviewId)],
    ['owner', owner, REVIEW_PAGE(review.reviewId)],
    ['curator panel', curator, TAXONOMY_PAGE(subject.taxonomyId)],
  ] as const;
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1280, height: 1000 },
  ])
    for (const [label, actor, path] of roles) {
      await actor.page.setViewportSize(viewport);
      const scripts = await coldLoad(actor.page, path);
      const where = `${label} at ${String(viewport.height)} px`;
      expect(
        scripts.filter((script) => GOVERNED_FORM_CHUNK.test(script.path)),
        `${where}: a governed form chunk loaded with no interaction`,
      ).toEqual([]);
      expect(
        scripts.filter((script) => ZOD_OR_VALIDATORS.test(script.path)),
        `${where}: the contract schemas loaded with no interaction`,
      ).toEqual([]);
      const total = scripts.reduce((sum, script) => sum + script.gzipBytes, 0);
      expect(total, where).toBeLessThanOrEqual(
        BUNDLE_BUDGETS.initialRouteGzipBytes,
      );
    }
});

test('[T5] a governed command chunk that cannot be fetched says nothing was sent, keeps the form, and sends after the network is back', async () => {
  const review = await assignedReview();
  const { page } = reviewer;
  const posts = decisionPosts(page, review.reviewId);
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.route(GOVERNED_CHUNKS.transport, (route) => route.abort());
  await page.goto(REVIEW_PAGE(review.reviewId), {
    waitUntil: 'domcontentloaded',
  });
  await waitForIslands(page);
  const region = decisionRegion(page);
  await region.getByLabel('Approve').check();
  await region.getByLabel('Reason').fill('Retry after a dropped chunk.');
  await expect(
    region.getByRole('button', { name: /Record approval/u }),
  ).toBeVisible();
  await region.getByRole('button', { name: /Record approval/u }).click();
  await expect(region.getByRole('alert')).toContainText('nothing was sent');
  expect(posts).toHaveLength(0);
  await expect(region.getByLabel('Reason')).toHaveValue(
    'Retry after a dropped chunk.',
  );
  await page.unroute(GOVERNED_CHUNKS.transport);
  await region.getByRole('button', { name: /Record approval/u }).click();
  await expect.poll(() => posts.length, { timeout: 30_000 }).toBe(1);
  await expect(page.getByText('Decision recorded.')).toBeVisible();
});

test('[T6] two people: the owner assigns, the reviewer decides across a lost answer, the owner activates and retires', async () => {
  test.setTimeout(240_000);
  // The reviewer's cms.reviewer grant is issued by the owner through the real producer
  // (CMS-03A-15, fresh step-up): that is what the owner's grant list holds.
  await completeStepUp(owner.context, cast.world, cast.owner);
  const issued = await grantReviewerViaApi(
    owner.client,
    cast.reviewer.principal.personId,
  );
  expect(issued.status, issued.text).toBe(201);
  const subject = await defineTaxonomyViaApi(curator.client, cast.world);
  const submitted = await submitGovernedViaApi(curator.client, subject);

  // The reviewer-options read is the owner-only CMS-03A-18 grant list. Record what it answers
  // (URL, status, body) so a failure names the cause, not only "could not be loaded".
  let grantItems = -1;
  owner.page.on('response', async (response) => {
    if (!response.url().includes('/api/v1/cms/capability-grants')) return;
    const text = await response.text().catch(() => '');
    if (response.status() === 200)
      grantItems = ((JSON.parse(text) as { items?: unknown[] }).items ?? [])
        .length;
    const note = JSON.stringify({
      url: response.url(),
      status: response.status(),
      items: grantItems,
      body: text.slice(0, 600),
    });
    console.log(`[T6 reviewer-options read] ${note}`);
    await test
      .info()
      .attach('reviewer-options-read', {
        body: note,
        contentType: 'application/json',
      })
      .catch(() => undefined);
  });

  // The owner assigns the reviewer in the browser (CMS-03C-08).
  await completeStepUp(owner.context, cast.world, cast.owner);
  await owner.page.goto(REVIEW_PAGE(submitted.reviewId), {
    waitUntil: 'domcontentloaded',
  });
  await waitForIslands(owner.page);
  const assignment = owner.page.locator(
    '[data-cms-lazy-region="governed-assignment"]',
  );
  // As a person does: move over the form (the earliest sign of intent; the reviewer list is read
  // from then on), see the list say it is loading, then choose once the choices have arrived.
  await assignment.first().hover();
  const reviewerList = assignment.getByLabel('Reviewer').first();
  await expect(assignment.getByText('Reviewer choices loaded.')).toBeVisible({
    timeout: 30_000,
  });
  await expect(reviewerList).not.toHaveAttribute('aria-busy', 'true');
  expect(
    grantItems,
    'the owner’s grant list (CMS-03A-18) must hold the reviewer’s cms.reviewer grant: -1 means no 200 answer, 0 an empty list',
  ).toBeGreaterThan(0);
  await reviewerList.selectOption({ value: cast.reviewer.principal.personId });
  await assignment
    .getByLabel('Assignment ends')
    .fill(new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16));
  await assignment.getByRole('button', { name: 'Assign reviewer' }).click();
  await expect(owner.page.getByText(/Reviewer assigned/u)).toBeVisible();

  // The reviewer decides; the first answer is lost after the server committed it, and the
  // identical request under the same Idempotency-Key is replayed, not repeated.
  await completeStepUp(reviewer.context, cast.world, cast.reviewer);
  const { page } = reviewer;
  const posts = decisionPosts(page, submitted.reviewId);
  let lost = false;
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.route(`**${GOVERNED_REVIEWS_API}/*/decision`, async (route) => {
    if (lost) return route.continue();
    lost = true;
    await route.fetch();
    return route.abort('connectionreset');
  });
  await page.goto(REVIEW_PAGE(submitted.reviewId), {
    waitUntil: 'domcontentloaded',
  });
  await waitForIslands(page);
  const region = decisionRegion(page);
  await region.getByLabel('Approve').check();
  await region.getByLabel('Reason').fill('Approved across a lost answer.');
  await region.getByRole('button', { name: /Record approval/u }).click();
  await expect.poll(() => posts.length, { timeout: 30_000 }).toBeGreaterThan(0);
  // A lost answer is an UNKNOWN outcome (FE03 governed reconciliation, DEC-113 and DEC-137): the
  // page reads the current state by itself and never guesses. The server committed the decision,
  // so the canonical read carries the reviewer's own decision, the form is no longer offered, and
  // the page says the decision is recorded. It does not invite the same request again, and it
  // is a polite status, not an alert. Every step keeps the region's evidence if it fails.
  const step = (name: string, run: () => Promise<void>) =>
    evidenceStep(page, region, `lost-answer-${name}`, run);
  await step('status', async () => {
    await expect(region.locator('[data-cms-workflow-status]')).toHaveText(
      'Decision recorded.',
      { timeout: 30_000 },
    );
  });
  await step('no-retry-offered', async () => {
    await expect(
      region.getByRole('button', { name: 'Retry the same request' }),
    ).toHaveCount(0);
    await expect(region.getByLabel('Reason')).toHaveCount(0);
    await expect(region.getByRole('alert')).toHaveCount(0);
  });
  await step('decided-state', async () => {
    await expect(page.getByText(/Your decision:/u)).toBeVisible();
    await expect
      .poll(() =>
        readGovernedReview(reviewer.client, submitted.reviewId).then(
          (r) => r.state,
        ),
      )
      .toBe('approved');
  });
  // Idempotency is proved where the form no longer exists: the identical request, replayed under
  // the same key through the API, answers with the stored result and adds no second row.
  await step('same-key-replay', async () => {
    expect(posts).toHaveLength(1);
    const first = posts[0] as Request;
    const key = first.headers()['idempotency-key'];
    const match = first.headers()['if-match'];
    expect(key).toBeTruthy();
    expect(match).toBeTruthy();
    const replay = await reviewer.client.post(
      `${GOVERNED_REVIEWS_API}/${submitted.reviewId}/decision`,
      JSON.parse(first.postData() ?? '{}') as unknown,
      { idempotencyKey: key ?? '', ifMatch: (match ?? '').replaceAll('"', '') },
    );
    expect(replay.status, replay.text).toBe(200);
    expect(replay.body.state).toBe('approved');
    expect(governedEffects(submitted.reviewId).decisions).toBe(1);
  });

  // The owner activates, then retires (CMS-03C-09). The form offers the permitted actions as
  // radios, names the consequence, and sends nothing until the inline confirmation is pressed.
  await completeStepUp(owner.context, cast.world, cast.owner);
  await owner.page.goto(REVIEW_PAGE(submitted.reviewId), {
    waitUntil: 'domcontentloaded',
  });
  await waitForIslands(owner.page);
  const activation = owner.page.locator(
    '[data-cms-lazy-region="governed-activation"]',
  );
  const ownerStep = (name: string, run: () => Promise<void>) =>
    evidenceStep(owner.page, activation, `owner-${name}`, run);
  const within = { timeout: 30_000 };
  await ownerStep('activate-choose', async () => {
    await expect(activation).toHaveCount(1, within);
    await activation.first().hover();
    await activation
      .getByRole('radio', { name: /Activate now/u })
      .check(within);
    await activation.getByRole('button', { name: 'Continue' }).click(within);
  });
  await ownerStep('activate-confirm', async () => {
    await activation
      .getByRole('button', { name: 'Activate this version' })
      .click(within);
    await expect(owner.page.getByText(/Activated, not published/u)).toBeVisible(
      within,
    );
  });
  await ownerStep('retire-choose', async () => {
    await owner.page.reload({ waitUntil: 'domcontentloaded' });
    await waitForIslands(owner.page);
    await expect(activation).toHaveCount(1, within);
    await activation.first().hover();
    await activation
      .getByRole('radio', { name: /Retire this version/u })
      .check(within);
    await activation.getByRole('button', { name: 'Continue' }).click(within);
  });
  await ownerStep('retire-confirm', async () => {
    await activation
      .getByRole('button', { name: 'Retire this version' })
      .click(within);
    await expect(owner.page.getByText(/Retired:/u)).toBeVisible(within);
  });
  expect(owner.browserErrors).toEqual([]);
});
