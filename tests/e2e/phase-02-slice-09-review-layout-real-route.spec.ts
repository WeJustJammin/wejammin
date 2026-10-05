import { expect, test, type Page } from '@playwright/test';
import { closeLaneContexts } from './support/s09-lane-browser';

import {
  columnEdges,
  horizontalOverflow,
  labelsAbove,
  readWorkerJson,
  reviewApiPath,
  smallControls,
  waitForWorkbench,
} from './support/s09-lane-flows';
import {
  assignReviewer,
  enrollReviewer,
  openReview,
  type Actor,
  type OpenReview,
} from './support/s09-lane-scenarios';

/**
 * Slice 09 schema-review route and version page layouts on the production-built
 * Astro routes in Google Chrome, measured from computed layout at 375, 768 and
 * 1280 px. Every record is produced through the real forms and Worker routes;
 * persistence is the loopback stateful lane, so this is not database or hosted
 * evidence. The virtual keyboard is emulated by shrinking the viewport height.
 */

test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' });

test.afterEach(closeLaneContexts);

// The schema-review command forms (the registry filter grid is a different surface).
const FORMS = '.content-schema-registry-command-stack';

type Stage = Readonly<{ stage: OpenReview; reviewer: Actor }>;

const stageWithReviewer = async (
  browser: import('@playwright/test').Browser,
): Promise<Stage> => {
  const stage = await openReview(browser);
  await assignReviewer(stage);
  const reviewer = await enrollReviewer(browser, stage.testId);
  return { stage, reviewer };
};

const openAt = async (
  page: Page,
  path: string,
  width: number,
  height: number,
): Promise<void> => {
  await page.setViewportSize({ width, height });
  await page.goto(path, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  await page.waitForTimeout(300);
};

const fixedAncestors = (page: Page, buttonName: string): Promise<string[]> =>
  page.evaluate((label) => {
    const out: string[] = [];
    let element: HTMLElement | null =
      [...document.querySelectorAll<HTMLElement>('main button')].find(
        (button) => (button.textContent ?? '').trim() === label,
      ) ?? null;
    while (element !== null && element !== document.body) {
      const position = getComputedStyle(element).position;
      if (position === 'fixed' || position === 'sticky') out.push(position);
      element = element.parentElement;
    }
    return out;
  }, buttonName);

test('[P2-S09-AC-1033] the review route and version page at 375 px are single column with labels above, a visible step-up confirmation, an action bar clear of the keyboard and 44 px controls', async ({
  browser,
}) => {
  const { stage, reviewer } = await stageWithReviewer(browser);
  const page = reviewer.page;

  // Reviewer decision form.
  await openAt(page, stage.reviewPath, 375, 800);
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
  expect(await smallControls(page, 'main', 44)).toEqual([]);
  await expect(
    page
      .getByRole('definition')
      .filter({ hasText: /^Verified until \d{2}:\d{2} UTC$/u }),
  ).toBeVisible();
  const decision = page.getByRole('group', { name: 'Record your decision' });
  const radios = decision.getByRole('radio');
  const firstRadio = await radios
    .nth(0)
    .evaluate(
      (element) => element.closest('label')?.getBoundingClientRect().left ?? 0,
    );
  const secondRadio = await radios
    .nth(1)
    .evaluate(
      (element) => element.closest('label')?.getBoundingClientRect().left ?? 0,
    );
  expect(Math.abs(firstRadio - secondRadio)).toBeLessThanOrEqual(1);

  // Virtual keyboard open: the viewport loses its lower half while a control
  // holds focus; the action bar is not pinned over the page and stays reachable.
  await page.setViewportSize({ width: 375, height: 380 });
  await radios.nth(0).focus();
  const save = page.getByRole('button', { name: 'Save review decision' });
  await save.scrollIntoViewIfNeeded();
  expect(await fixedAncestors(page, 'Save review decision')).toEqual([]);
  expect(
    await save.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    }),
  ).toBe(true);

  // Owner assignment form on the same route: one column, labels above.
  await openAt(stage.owner.page, stage.reviewPath, 375, 800);
  const owner = stage.owner.page;
  expect(await horizontalOverflow(owner)).toBeLessThanOrEqual(1);
  expect(await smallControls(owner, 'main', 44)).toEqual([]);
  expect(await labelsAbove(owner, FORMS)).toEqual([]);
  // The assignment form (first fieldset) is one column: a single left edge.
  expect(new Set(await columnEdges(owner, 'main fieldset')).size).toBe(1);

  // Version page forms (field schema, relation, dry run, review submission).
  await openAt(owner, stage.created.path, 375, 800);
  expect(await horizontalOverflow(owner)).toBeLessThanOrEqual(1);
  expect(await smallControls(owner, 'main', 44)).toEqual([]);
  expect(await labelsAbove(owner, FORMS)).toEqual([]);
  expect(new Set(await columnEdges(owner, FORMS)).size).toBeLessThanOrEqual(1);
});

test('[P2-S09-AC-1034] the review route at 768 px shares a row only between independent fields and keeps the evidence summary and step-up disclosure with the forms', async ({
  browser,
}) => {
  const { stage, reviewer } = await stageWithReviewer(browser);
  const owner = stage.owner.page;
  await openAt(owner, stage.reviewPath, 768, 1000);
  expect(await horizontalOverflow(owner)).toBeLessThanOrEqual(1);
  expect(await smallControls(owner, 'main', 24)).toEqual([]);

  // FE03: two columns only for independent fields. The assignment fields are
  // independent of one another; whatever layout is used, they never overlap,
  // never overflow the form, and no dependent control shares a row with one.
  const assignment = owner.getByRole('group', { name: 'Assign a reviewer' });
  const rects = await assignment.evaluate((group) =>
    [...group.querySelectorAll('input:not([type="hidden"]), textarea')].map(
      (field) => {
        const rect = field.getBoundingClientRect();
        return {
          name: field.getAttribute('name'),
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      },
    ),
  );
  expect(rects.map((rect) => rect.name)).toEqual([
    'reviewerPersonId',
    'expiresAt',
    'reason',
  ]);
  const container = await assignment.evaluate((group) => {
    const rect = group.getBoundingClientRect();
    return { left: rect.left, right: rect.right };
  });
  for (const rect of rects) {
    expect(rect.left).toBeGreaterThanOrEqual(container.left - 1);
    expect(rect.right).toBeLessThanOrEqual(container.right + 1);
  }
  // Two columns are allowed only between independent fields. Every field of
  // the assignment form is independent of the others, so a shared row is fine
  // there; the dependent pairs are checked on the decision form below.
  const INDEPENDENT = new Set(['reviewerPersonId', 'expiresAt', 'reason']);
  for (let index = 1; index < rects.length; index += 1) {
    const previous = rects[index - 1]!;
    const current = rects[index]!;
    const sameRow = Math.abs(previous.top - current.top) <= 2;
    if (sameRow) {
      expect(INDEPENDENT.has(previous.name ?? '')).toBe(true);
      expect(INDEPENDENT.has(current.name ?? '')).toBe(true);
      expect(current.left).toBeGreaterThanOrEqual(previous.right - 1);
    } else expect(current.top).toBeGreaterThanOrEqual(previous.bottom - 1);
  }

  // The evidence summary stays with the form: same review region, summary above
  // the form in the same column, and the form begins where the summary ends.
  const summary = await owner.evaluate(() => {
    const form = [...document.querySelectorAll('main fieldset')].find(
      (candidate) =>
        (candidate.textContent ?? '').includes('Assign a reviewer'),
    );
    const region = form?.closest('section') ?? null;
    const term = [...document.querySelectorAll('main dt')].find(
      (candidate) => candidate.textContent === 'Review version',
    );
    const list = term?.closest('dl') ?? null;
    if (form === undefined || region === null || list === null) return null;
    const summaryRect = list.getBoundingClientRect();
    const formRect = form.getBoundingClientRect();
    return {
      sameRegion:
        region.contains(list) &&
        region.querySelector('h3')?.textContent === 'Schema review',
      summaryLeft: summaryRect.left,
      formLeft: formRect.left,
      summaryBottomBeforeForm: summaryRect.bottom <= formRect.top + 1,
    };
  });
  expect(summary).not.toBeNull();
  expect(summary?.sameRegion).toBe(true);
  expect(
    Math.abs((summary?.summaryLeft ?? 0) - (summary?.formLeft ?? 999)),
  ).toBeLessThanOrEqual(48);
  expect(summary?.summaryBottomBeforeForm).toBe(true);

  await openAt(reviewer.page, stage.reviewPath, 768, 1000);
  const disclosure = reviewer.page
    .getByRole('group', { name: 'Record your decision' })
    .getByRole('definition')
    .filter({ hasText: /^Verified until \d{2}:\d{2} UTC$/u });
  await expect(disclosure).toBeVisible();
  // The prior step-up disclosure sits inside the decision form itself, and the
  // evidence summary is in the same review region directly above that form.
  const decision = await reviewer.page.evaluate(() => {
    const group = [...document.querySelectorAll('main fieldset')].find(
      (candidate) =>
        (candidate.textContent ?? '').includes('Record your decision'),
    );
    const verified = [...(group?.querySelectorAll('dd') ?? [])].find(
      (candidate) =>
        /^Verified until \d{2}:\d{2} UTC$/u.test(candidate.textContent ?? ''),
    );
    const region = group?.closest('section') ?? null;
    const term = [...document.querySelectorAll('main dt')].find(
      (candidate) => candidate.textContent === 'Review version',
    );
    const list = term?.closest('dl') ?? null;
    if (!group || !verified || !region || !list) return null;
    const groupRect = group.getBoundingClientRect();
    const verifiedRect = verified.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    // Dependent fields: the decision choice and the reason it explains.
    const fields = [
      ...group.querySelectorAll('input:not([type="hidden"]), textarea'),
    ].map((field) => ({
      name: field.getAttribute('name'),
      top: field.getBoundingClientRect().top,
      left: field.getBoundingClientRect().left,
    }));
    return {
      disclosureInsideForm:
        verifiedRect.top >= groupRect.top - 1 &&
        verifiedRect.bottom <= groupRect.bottom + 1,
      summaryInRegion:
        region.contains(list) &&
        region.querySelector('h3')?.textContent === 'Schema review',
      summaryAboveForm: listRect.bottom <= groupRect.top + 1,
      dependentSharedRow: fields.some((first, index) =>
        fields
          .slice(index + 1)
          .some(
            (second) =>
              first.name !== second.name &&
              Math.abs(first.top - second.top) <= 2 &&
              Math.abs(first.left - second.left) > 2,
          ),
      ),
    };
  });
  expect(decision).toEqual({
    disclosureInsideForm: true,
    summaryInRegion: true,
    summaryAboveForm: true,
    dependentSharedRow: false,
  });
  expect(await smallControls(reviewer.page, 'main', 24)).toEqual([]);
});

test('[P2-S09-AC-1035] the review route at 1280 px groups the forms with the summary and cites the frozen review version and the server-permitted next actions', async ({
  browser,
}) => {
  const { stage, reviewer } = await stageWithReviewer(browser);
  await openAt(reviewer.page, stage.reviewPath, 1280, 900);
  expect(await horizontalOverflow(reviewer.page)).toBeLessThanOrEqual(1);
  expect(await smallControls(reviewer.page, 'main', 24)).toEqual([]);

  const review = await readWorkerJson(
    reviewer.page,
    reviewApiPath(stage.reviewPath),
  );
  const permitted = review.permittedNextActions as string[];
  const version = String(review.version);

  // The decision form sits in the same region as the summary and states the
  // frozen review version it will be recorded against.
  const grouped = await reviewer.page.evaluate(() => {
    const summary = [...document.querySelectorAll('main dt')].find(
      (term) => term.textContent === 'Review version',
    );
    const form = [...document.querySelectorAll('main fieldset')].find((group) =>
      (group.textContent ?? '').includes('Record your decision'),
    );
    const region = form?.closest('section') ?? null;
    return Boolean(
      summary &&
      form &&
      region?.contains(summary) &&
      region.querySelector('h3')?.textContent === 'Schema review',
    );
  });
  expect(grouped).toBe(true);
  await expect(
    reviewer.page.getByText(`Expected version:`).locator('..'),
  ).toContainText(version);
  await expect(
    reviewer.page
      .getByRole('definition')
      .filter({ hasText: new RegExp(`^${version}$`, 'u') })
      .first(),
  ).toBeVisible();

  // Server-permitted next actions: the reviewer's API view lists the decision as
  // permitted and the page offers exactly that form, never the owner's.
  expect(permitted.length).toBeGreaterThan(0);
  await expect(
    reviewer.page.getByRole('button', { name: 'Save review decision' }),
  ).toBeVisible();
  await expect(
    reviewer.page.getByRole('button', { name: 'Save reviewer assignment' }),
  ).toHaveCount(0);

  const ownerReview = await readWorkerJson(
    stage.owner.page,
    reviewApiPath(stage.reviewPath),
  );
  await openAt(stage.owner.page, stage.reviewPath, 1280, 900);
  expect((ownerReview.permittedNextActions as string[]).length).toBeGreaterThan(
    0,
  );
  await expect(
    stage.owner.page
      .getByRole('button', { name: 'Save reviewer assignment' })
      .first(),
  ).toBeVisible();
  await expect(
    stage.owner.page.getByRole('button', { name: 'Save review decision' }),
  ).toHaveCount(0);
  expect(await smallControls(stage.owner.page, 'main', 24)).toEqual([]);
});
