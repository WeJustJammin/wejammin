/**
 * Browser steps of the Slice 12 wave-9 journeys, taken with the page's own controls and read from the component sources
 * (`CmsPatternInsertForm`, `CmsPatternUpdateDiff`, `CmsGovernedAssignmentForm`, `CmsGovernedDecisionForm`,
 * `CmsGovernedActivationForm`, `CmsTaxonomyDesigner`, `CmsPatternVersionDesigner`). The mouse flows share the journey cast
 * of `s12-pw7-flow.ts`; the keyboard-only flows are in `s12-pw9-keys.ts`. Not type-checked by `pnpm type-check`.
 */
import { expect, type Locator, type Page } from '@playwright/test';

import { waitForIslands, type SignedIn } from './s10-real-browser';
import { completeStepUp, type S11Actor } from './s11-real-browser';
import { REVIEW_PAGE } from './s12-governed-world';
import {
  COMPOSITION_PAGE,
  PATTERN_NEW_PAGE,
  PATTERN_VERSIONS_API,
  TAXONOMY_NEW_PAGE,
} from './s12-pw5-world';
import type { OwnedBlock } from './s12-pw7-block';
import { regionOf, within, type JourneyCast } from './s12-pw7-flow';

/** The POST a click is about to send: register before clicking. */
export const posted = (page: Page, suffix: string) =>
  page.waitForResponse(
    (response) =>
      response.url().endsWith(suffix) && response.request().method() === 'POST',
  );

/** A no-store 200 page whose route heading is `heading`, with every island hydrated. */
export const openPage = async (
  signedIn: SignedIn,
  path: string,
  heading: string,
): Promise<void> => {
  const response = await signedIn.page.goto(path, {
    waitUntil: 'domcontentloaded',
  });
  expect(response?.status(), path).toBe(200);
  await waitForIslands(signedIn.page);
  await expect(signedIn.page.getByRole('heading', { level: 1 })).toHaveText(
    heading,
  );
};

const SELECTOR = 'select#cms-composition-pattern';
const PLACEMENT = '/api/v1/cms/compositions/pattern-instances';
export const UPDATE = '/api/v1/cms/compositions/pattern-updates';

/** Loads more patterns until `option` is listed (the selector pages its list). */
const listUntil = async (
  insert: Locator,
  selector: Locator,
  option: Locator,
): Promise<void> => {
  for (let guard = 0; guard < 50 && (await option.count()) === 0; guard += 1) {
    const more = insert.getByRole('button', { name: 'Load more patterns' });
    if (!(await more.isVisible())) break;
    const before = await selector.locator('option').count();
    await more.click();
    await expect
      .poll(() => selector.locator('option').count(), within)
      .toBeGreaterThan(before);
  }
};

/** The author places the pattern, linked at slot `/`, from the instance-insert form of the entry's composition page. */
export const placeLinkedInBrowser = async (
  author: SignedIn,
  entryId: string,
  patternKey: string,
  patternVersion: number,
): Promise<void> => {
  const { page } = author;
  await openPage(author, COMPOSITION_PAGE(entryId), 'Composition');
  const insert = page.getByRole('region', { name: 'Insert a pattern' });
  const selector = insert.locator(SELECTOR);
  const option = selector.locator('option', {
    hasText: `${patternKey} version ${String(patternVersion)} (1 node)`,
  });
  await listUntil(insert, selector, option);
  await expect(option).toHaveCount(1);
  await selector.selectOption({
    value: (await option.getAttribute('value')) ?? '',
  });
  await insert
    .getByRole('radio', { name: /^Linked: receives pattern updates/u })
    .check();
  await insert.getByLabel('Slot path').fill('/');
  const command = posted(page, PLACEMENT);
  await insert.getByRole('button', { name: 'Place pattern' }).click();
  expect((await command).status()).toBe(201);
  await expect(
    page.getByRole('heading', { name: 'Pattern placed' }),
  ).toBeVisible(within);
};

/** The owner assigns `reviewer` to the review in the browser (CMS-03C-08); the review page is loaded afresh. */
export const assignReviewerInBrowser = async (
  journey: JourneyCast,
  reviewId: string,
  reviewerPersonId: string,
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
  await list.selectOption({ value: reviewerPersonId });
  await assignment
    .getByLabel('Assignment ends')
    .fill(new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16));
  await assignment.getByRole('button', { name: 'Assign reviewer' }).click();
  await expect(page.getByText(/Reviewer assigned/u)).toBeVisible(within);
};

/** One named reviewer records an approval in the browser (fresh step-up) and the page confirms it. */
export const approveAs = async (
  who: SignedIn,
  actor: S11Actor,
  journey: JourneyCast,
  reviewId: string,
  reason: string,
): Promise<void> => {
  await completeStepUp(who.context, journey.cast.world, actor);
  const { page } = who;
  await page.goto(REVIEW_PAGE(reviewId), { waitUntil: 'domcontentloaded' });
  await waitForIslands(page);
  const region = regionOf(page, 'governed-decision');
  await region.getByLabel('Approve').check();
  await region.getByLabel('Reason').fill(reason);
  await expect(
    region.getByRole('button', { name: /Record approval/u }),
  ).toBeVisible();
  await region.getByRole('button', { name: /Record approval/u }).click();
  await expect(page.getByText('Decision recorded.')).toBeVisible(within);
};

/** The curator defines a vocabulary over `typeKey` in the browser form; returns the address its own link opens. */
export const defineVocabularyOver = async (
  curator: SignedIn,
  typeKey: string,
): Promise<string> => {
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
  const href = await page
    .getByRole('link', { name: 'Open the vocabulary to submit it for review' })
    .getAttribute('href');
  if (href === null) throw new Error('The saved vocabulary was not linked.');
  return href;
};

/** The designer creates a pattern in the browser form over one registered block; returns the pattern key. */
export const definePatternInBrowser = async (
  designer: SignedIn,
  typeKey: string,
  block: OwnedBlock,
  title: string,
): Promise<string> => {
  const { page } = designer;
  const patternKey = `s12-pw9-form-${crypto.randomUUID().slice(0, 8).replaceAll('-', '')}`;
  await openPage(designer, PATTERN_NEW_PAGE, 'Pattern designer');
  const form = page.getByRole('group', { name: 'Pattern definition' });
  await form.getByLabel('Pattern key').fill(patternKey);
  await form.getByRole('checkbox', { name: typeKey, exact: true }).check();
  await form.getByRole('button', { name: 'Add a top-level block' }).click();
  await expect(
    form.getByLabel('Node 1 block').locator(`option[value="${block.ref}"]`),
  ).toHaveCount(1);
  await form.getByLabel('Node 1 block').selectOption(block.ref);
  await form
    .getByLabel('Node 1 props (JSON object)')
    .fill(JSON.stringify({ title }));
  const command = posted(page, PATTERN_VERSIONS_API);
  await form.getByRole('button', { name: 'Create draft' }).click();
  const response = await command;
  expect(response.status()).toBe(201);
  expect(response.headers()['etag']).toBe('"1"');
  await expect(
    page.getByRole('heading', { name: 'Pattern draft saved' }),
  ).toBeVisible(within);
  return patternKey;
};

/**
 * The owner presses Activate on an approved review whose dependency has changed: the command is refused as a committed
 * invalidation and the page says so (CMS-03C-09 step 4; the refusal copy is `governed-activation-refusal.ts`).
 */
export const activateExpectingInvalidation = async (
  journey: JourneyCast,
  reviewId: string,
): Promise<void> => {
  const { owner, ownerActor, cast } = journey;
  await completeStepUp(owner.context, cast.world, ownerActor);
  const { page } = owner;
  await page.goto(REVIEW_PAGE(reviewId), { waitUntil: 'domcontentloaded' });
  await waitForIslands(page);
  const activation = regionOf(page, 'governed-activation');
  await expect(activation).toHaveCount(1, within);
  await activation.first().hover();
  await activation.getByRole('radio', { name: /Activate now/u }).check(within);
  await activation.getByRole('button', { name: 'Continue' }).click(within);
  await activation
    .getByRole('button', { name: 'Activate this version' })
    .click(within);
  await expect(
    page.getByText(
      'A dependency of this version changed, so its review was invalidated and the version is back to draft. Nothing was activated or scheduled.',
    ),
  ).toBeVisible(within);
};

/** The review page, loaded afresh, states the invalidation in words and offers no activation. */
export const expectInvalidatedPage = async (
  signedIn: SignedIn,
  reviewId: string,
): Promise<void> => {
  const { page } = signedIn;
  await page.goto(REVIEW_PAGE(reviewId), { waitUntil: 'domcontentloaded' });
  await waitForIslands(page);
  const detail = page.locator('[data-cms-governed-review-detail]');
  await expect(detail).toContainText('State: Invalidated');
  await expect(detail).toContainText('Subject: Draft');
  await expect(detail).toContainText(
    'This review was invalidated because a dependency changed after it was submitted. The version is back to draft.',
  );
  await expect(page.getByRole('radio', { name: /Activate now/u })).toHaveCount(
    0,
  );
};
