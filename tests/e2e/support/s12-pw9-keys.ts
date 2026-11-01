/**
 * Keyboard-only steps of the Slice 12 journeys at a 640x400 viewport (a 1280x800 layout at 200% zoom): every control is
 * reached with Tab (Shift+Tab to come back) and operated with Space, Enter, the arrow keys and typed text. No click, no hover
 * and no programmatic focus; a control is found by what it is called (`focusedName` of `s10-real-browser.ts`), so a control
 * that cannot be reached by key fails with the path Tab visited. Not type-checked by `pnpm type-check`.
 *
 * First-run risks (written without a running stack): (a) the date-time field types in the en-US order (month, day, year,
 * hour, minute, AM/PM) and is checked by its value, with two ways of leaving the year segment; (b) a closed `<select>`
 * changes its value on ArrowDown in Chromium; (c) the radio group of the activation form is entered at its checked or first
 * radio and left on the wanted one with the arrow keys.
 */
import { expect, type Page } from '@playwright/test';

import {
  expectNoHorizontalScroll,
  focusedName,
  tabTo,
  waitForIslands,
} from './s10-real-browser';
import { completeStepUp } from './s11-real-browser';
import { REVIEW_PAGE } from './s12-governed-world';
import { regionOf, within, type JourneyCast } from './s12-pw7-flow';

export const KEY_VIEWPORT = { width: 640, height: 400 } as const;
export const DESKTOP_VIEWPORT = { width: 1280, height: 720 } as const;

/** Tab forward to the control called `pattern`; if forward never finds it, Shift+Tab back from where focus is. */
export const reach = async (
  page: Page,
  pattern: RegExp,
  budget = 80,
): Promise<void> => {
  try {
    await tabTo(page, pattern, budget);
  } catch {
    await tabTo(page, pattern, budget, 'backward');
  }
};

export const typeInto = async (
  page: Page,
  pattern: RegExp,
  text: string,
): Promise<void> => {
  await reach(page, pattern);
  await page.keyboard.type(text);
};

export const pressOn = async (
  page: Page,
  pattern: RegExp,
  key: 'Enter' | 'Space',
): Promise<void> => {
  await reach(page, pattern);
  await page.keyboard.press(key);
};

/** The focused `<select>` is moved with ArrowDown until it holds `wanted`. */
export const chooseValue = async (
  page: Page,
  wanted: string,
): Promise<void> => {
  for (let step = 0; step < 80; step += 1) {
    const held = await page.evaluate(
      () => (document.activeElement as HTMLSelectElement | null)?.value ?? '',
    );
    if (held === wanted) return;
    await page.keyboard.press('ArrowDown');
  }
  throw new Error('The focused list never held the wanted option.');
};

/** Enter a radio group at any of its radios and move with the arrow keys to the one called `wanted`; then check it. */
export const chooseRadio = async (
  page: Page,
  anyOfGroup: RegExp,
  wanted: RegExp,
): Promise<void> => {
  await reach(page, anyOfGroup);
  for (let step = 0; step < 6; step += 1) {
    if (wanted.test(await focusedName(page))) {
      await page.keyboard.press('Space');
      return;
    }
    await page.keyboard.press('ArrowDown');
  }
  throw new Error(`The radio group never reached ${String(wanted)}.`);
};

const heldValue = (page: Page): Promise<string> =>
  page.evaluate(
    () => (document.activeElement as HTMLInputElement | null)?.value ?? '',
  );

/**
 * Types `local` (`YYYY-MM-DDTHH:mm`, 24-hour) into the date-time field called `pattern`, segment by segment, and checks the
 * field's value. Two ways of leaving the year segment are tried in turn (the year may or may not advance by itself).
 */
export const typeLocalDateTime = async (
  page: Page,
  pattern: RegExp,
  local: string,
): Promise<void> => {
  const [date = '', time = ''] = local.split('T');
  const [year = '', month = '', day = ''] = date.split('-');
  const [hour24 = '0', minute = '00'] = time.split(':');
  const hour = Number(hour24);
  const hour12 = String(hour % 12 === 0 ? 12 : hour % 12).padStart(2, '0');
  const meridiem = hour < 12 ? 'A' : 'P';
  const attempts = [
    async () => {
      await page.keyboard.type(`${month}${day}${year}`);
      await page.keyboard.press('ArrowRight');
      await page.keyboard.type(`${hour12}${minute}${meridiem}`);
    },
    async () => {
      await page.keyboard.type(
        `${month}${day}${year}${hour12}${minute}${meridiem}`,
      );
    },
  ];
  for (const attempt of attempts) {
    await reach(page, pattern);
    await attempt();
    if ((await heldValue(page)) === local) return;
  }
  throw new Error(`The date-time field never held ${local}.`);
};

/** 30 days ahead at 10:00 local time, a wall time that a clock change never skips or repeats. */
export const scheduleLocal = (): string =>
  `${new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)}T10:00`;

/** The subject page's panel: Tab to Submit for review, press Enter, and read the review id from the page's own link. */
export const submitByKeyboard = async (
  page: Page,
  path: string,
): Promise<string> => {
  await page.goto(path, { waitUntil: 'networkidle' });
  await waitForIslands(page);
  await expectNoHorizontalScroll(page, `${path} at 200%`);
  await pressOn(page, /^button:Submit for review/u, 'Enter');
  await expect(
    page.getByRole('heading', { name: 'Submitted for review' }),
  ).toBeVisible(within);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForIslands(page);
  const href = await page
    .getByRole('link', { name: 'Open the review' })
    .getAttribute('href');
  const reviewId = href?.split('/').pop();
  if (reviewId === undefined || reviewId === '')
    throw new Error('The subject page did not link its review.');
  return decodeURIComponent(reviewId);
};

/** The owner picks the reviewer, types the end of the assignment and presses Assign reviewer, by key presses only. */
export const assignByKeyboard = async (
  journey: JourneyCast,
  reviewId: string,
): Promise<void> => {
  const { owner, ownerActor, cast } = journey;
  await completeStepUp(owner.context, cast.world, ownerActor);
  const { page } = owner;
  await page.goto(REVIEW_PAGE(reviewId), { waitUntil: 'domcontentloaded' });
  await waitForIslands(page);
  await expectNoHorizontalScroll(page, 'assignment form at 200%');
  await reach(page, /^select:Reviewer/u);
  const assignment = regionOf(page, 'governed-assignment');
  await expect(assignment.getByText('Reviewer choices loaded.')).toBeVisible(
    within,
  );
  await expect(assignment.getByLabel('Reviewer').first()).not.toHaveAttribute(
    'aria-busy',
    'true',
  );
  await chooseValue(page, cast.reviewer.principal.personId);
  await typeLocalDateTime(
    page,
    /^input:Assignment ends/u,
    new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 16),
  );
  await pressOn(page, /^button:Assign reviewer/u, 'Enter');
  await expect(page.getByText(/Reviewer assigned/u)).toBeVisible(within);
};

/** The owner schedules the approved review: choose the radio, type the zone and the local time, continue, confirm. */
export const scheduleByKeyboard = async (
  journey: JourneyCast,
  reviewId: string,
): Promise<void> => {
  const { owner, ownerActor, cast } = journey;
  await completeStepUp(owner.context, cast.world, ownerActor);
  const { page } = owner;
  await page.goto(REVIEW_PAGE(reviewId), { waitUntil: 'domcontentloaded' });
  await waitForIslands(page);
  await expectNoHorizontalScroll(page, 'activation form at 200%');
  const activation = regionOf(page, 'governed-activation');
  await expect(activation).toHaveCount(1, within);
  await chooseRadio(
    page,
    /^input:.*(Activate now|Schedule activation|Retire this version)/u,
    /^input:.*Schedule activation/u,
  );
  await typeInto(page, /^input:Time zone/u, 'America/New_York');
  await typeLocalDateTime(page, /^input:Local date and time/u, scheduleLocal());
  await expect(activation.locator('[data-cms-schedule-status]')).toContainText(
    /^Resolved to /u,
    within,
  );
  await pressOn(page, /^button:Continue/u, 'Enter');
  await pressOn(page, /^button:Schedule activation/u, 'Enter');
  await expect(page.getByText(/Scheduled, not active:/u)).toBeVisible(within);
};

const TEMPLATE_NEW_PAGE = '/app/cms-content-modeling/templates/new';

/**
 * The designer defines a template with key presses only (the form of `CmsTemplateDesigner`: key, one content type, locale,
 * audience, Create draft) and follows the page's own link; returns the template key.
 */
export const defineTemplateByKeyboard = async (
  page: Page,
  typeKey: string,
): Promise<string> => {
  const key = `s12-jrn-tpl-${crypto.randomUUID().slice(0, 8).replaceAll('-', '')}`;
  await page.goto(TEMPLATE_NEW_PAGE, { waitUntil: 'domcontentloaded' });
  await waitForIslands(page);
  await expectNoHorizontalScroll(page, 'template form at 200%');
  await typeInto(page, /^input:Template key/u, key);
  await pressOn(page, new RegExp(`^input:${typeKey} · version`, 'u'), 'Space');
  await typeInto(page, /^input:Locale/u, 'en-US');
  await typeInto(page, /^input:Audience/u, 'public');
  await pressOn(page, /^button:Create draft/u, 'Enter');
  await expect(
    page.getByRole('heading', { name: 'Draft created.' }),
  ).toBeVisible(within);
  await pressOn(page, /^a:Open latest draft/u, 'Enter');
  await page.waitForURL(`**/templates/${key}`);
  await waitForIslands(page);
  return key;
};
