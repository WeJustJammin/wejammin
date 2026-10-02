import { expect, type Page } from '@playwright/test';

import { lanePersonId, type LaneRole } from './s09-lane-ids';
import { totpCode } from './s09-lane-totp';

/**
 * Browser-side drivers for the Slice 09 stateful lane. Every helper clicks and
 * types through the production-built pages; none writes a record directly.
 */

export const REGISTRY = '/app/cms-content-modeling';
export const WORKER_ORIGIN = 'http://127.0.0.1:8788';
export const WEB_ORIGIN = 'http://127.0.0.1:4324';

export const uuidIn = (url: string): string[] =>
  url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/giu) ?? [];

export const waitForWorkbench = async (page: Page): Promise<void> => {
  await expect(
    page.locator('[data-workbench="content-schema-registry"]'),
  ).toHaveAttribute('data-content-schema-registry-hydrated', 'true', {
    timeout: 15_000,
  });
};

export type CreatedVersion = Readonly<{
  contentTypeId: string;
  versionId: string;
  path: string;
}>;

/** Fill the real CMS-03A-01 form (including the locale fields) and save. */
export const createTypeViaUi = async (
  page: Page,
  options: Readonly<{ typeKey?: string; label?: string }> = {},
): Promise<CreatedVersion> => {
  await page.goto(REGISTRY, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  const tags = page.getByRole('textbox', { name: 'Add a language tag' });
  for (const tag of ['en-US', 'fr-CA', 'fr']) {
    await tags.fill(tag);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
  }
  await page.getByRole('combobox', { name: 'Source language' }).selectOption('en-US');
  await page.getByRole('combobox', { name: 'Default language' }).selectOption('en-US');
  await page
    .locator('#content-schema-registry-create-form-locale-chain-fr-CA-add')
    .selectOption('fr');
  await page.getByRole('button', { name: 'Add to the fallback order for fr-CA' }).click();
  await page.getByRole('textbox', { name: 'Type key' }).fill(options.typeKey ?? 'release_note');
  await page.getByRole('textbox', { name: 'Display label' }).fill(options.label ?? 'Release note');
  await page.getByRole('textbox', { name: 'Owner capability' }).fill('cms.content.article');
  await page.getByRole('textbox', { name: 'Workflow key' }).fill('editorial.default');
  await page.getByRole('textbox', { name: 'Workflow version' }).fill('1');
  await page.getByRole('button', { name: 'Save content type draft' }).click();
  await page.waitForURL(/\/versions\//u);
  await waitForWorkbench(page);
  const [contentTypeId, versionId] = uuidIn(page.url());
  if (contentTypeId === undefined || versionId === undefined)
    throw new Error('the created version path carries no identifiers');
  return { contentTypeId, versionId, path: new URL(page.url()).pathname };
};

export const startDryRunViaUi = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Save dry-run request' }).click();
  await expect(page.locator('[data-cms-dry-run-status]')).toContainText(
    /dry run is queued/iu,
    { timeout: 15_000 },
  );
};

export const waitForSealedDryRun = async (page: Page): Promise<void> => {
  await expect(page.locator('[data-cms-dry-run-status]')).toContainText(
    /sealed dry run passed/iu,
    { timeout: 20_000 },
  );
};

/** Submit the sealed dry run for review; resolves with the review route path. */
export const submitReviewViaUi = async (page: Page): Promise<string> => {
  await page.getByRole('button', { name: 'Save review submission' }).click();
  await page.waitForURL(/\/schema-reviews\//u, { timeout: 20_000 });
  await waitForWorkbench(page);
  return new URL(page.url()).pathname;
};

/** Owner assigns a reviewer person on the review route. */
export const assignReviewerViaUi = async (
  page: Page,
  reviewer: LaneRole,
  hours = 24,
): Promise<void> => {
  await page
    .getByRole('textbox', { name: 'Reviewer person ID' })
    .fill(lanePersonId(reviewer));
  await page
    .getByRole('textbox', { name: /Expires at/u })
    .fill(new Date(Date.now() + hours * 3_600_000).toISOString());
  await page.getByRole('textbox', { name: /Reason/u }).fill('Schema review for release notes');
  await page.getByRole('button', { name: /Save reviewer assignment|Assign/u }).click();
};

/** Open the authenticator name step, retrying until the island is hydrated. */
const openEnrollment = async (page: Page): Promise<void> => {
  await page.goto('/settings/security/mfa', { waitUntil: 'networkidle' });
  const name = page.getByRole('textbox', { name: 'Authenticator name' });
  await expect(async () => {
    await page.getByRole('button', { name: /Set up an authenticator|Add another authenticator/u }).click();
    await expect(name).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
};

/** The manual entry key as an authenticator app would take it (no spaces). */
export const readManualKey = async (page: Page): Promise<string> => {
  const code = page.locator('code').filter({ hasText: /^[A-Z2-7 ]{30,}$/u }).first();
  await expect(code).toBeVisible({ timeout: 15_000 });
  return (await code.innerText()).replaceAll(/\s/gu, '');
};

/** Enroll a TOTP factor on /settings/security/mfa; resolves with the manual key. */
export const enrollFactorViaUi = async (
  page: Page,
  friendlyName = 'Phone authenticator',
): Promise<string> => {
  await openEnrollment(page);
  await page.getByRole('textbox', { name: 'Authenticator name' }).fill(friendlyName);
  await page.getByRole('button', { name: 'Continue' }).click();
  const secret = await readManualKey(page);
  await page
    .getByRole('textbox', { name: '6-digit code from the app' })
    .fill(await totpCode(secret, Date.now()));
  await page.getByRole('button', { name: 'Verify and finish' }).click();
  await expect(page.getByRole('table')).toContainText(friendlyName, { timeout: 15_000 });
  return secret;
};

/** Age one role's step-up proof past its window (what time does in production). */
export const expireStepUp = async (
  page: Page,
  testId: string,
  role: LaneRole,
): Promise<void> => {
  const response = await page.request.post(`${WORKER_ORIGIN}/_s09/lane/expire-step-up`, {
    data: { testId, role },
  });
  expect(response.status()).toBe(200);
};

/** Enter a genuine TOTP code on /step-up and wait for the post-proof navigation. */
export const completeStepUpViaUi = async (
  page: Page,
  secret: string,
  expectUrl: RegExp | string,
): Promise<void> => {
  await page
    .getByRole('textbox', { name: '6-digit code' })
    .fill(await totpCode(secret, Date.now()));
  await page.getByRole('button', { name: 'Verify' }).click();
  await page.waitForURL(expectUrl, { timeout: 20_000 });
};

/** Read one JSON resource straight from the Worker API as the page's session. */
export const readWorkerJson = async (
  page: Page,
  path: string,
): Promise<Record<string, unknown>> => {
  const response = await page.request.get(`${WORKER_ORIGIN}${path}`, {
    headers: { origin: WEB_ORIGIN },
  });
  expect(response.status(), `GET ${path}`).toBe(200);
  return (await response.json()) as Record<string, unknown>;
};

export const reviewApiPath = (reviewPath: string): string =>
  `/api/v1/cms/schema-reviews/${reviewPath.split('/').at(-1) as string}`;

export const versionApiPath = (created: CreatedVersion): string =>
  `/api/v1/cms/content-types/${created.contentTypeId}/versions/${created.versionId}`;

/** The assigned reviewer records a decision on the review route. */
export const decideViaUi = async (
  page: Page,
  reviewPath: string,
  decision: 'approve' | 'reject',
): Promise<void> => {
  await page.goto(reviewPath, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  await page
    .getByRole('radio', {
      name: decision === 'approve' ? 'Approve the frozen evidence' : /^Reject/u,
    })
    .check();
  await page.getByRole('button', { name: 'Save review decision' }).click();
  await expect(page.getByText(/decision (was )?recorded/iu)).toBeVisible({ timeout: 15_000 });
};

export type SmallControl = Readonly<{ name: string; width: number; height: number }>;

/**
 * Interactive controls under `scope` smaller than `minimum` CSS px on either
 * axis, measured from computed layout. A radio or checkbox is measured by the
 * label that wraps or targets it (its real hit area).
 */
export const smallControls = async (
  page: Page,
  scope: string,
  minimum: number,
): Promise<readonly SmallControl[]> =>
  page.evaluate(
    ({ scopeSelector, min }) => {
      const root = document.querySelector(scopeSelector) ?? document.body;
      const visible = (element: Element): boolean => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return box.width > 0 && box.height > 0 && style.visibility !== 'hidden';
      };
      const label = (element: Element): string =>
        (
          element.getAttribute('aria-label') ??
          (element as HTMLElement).innerText ??
          element.getAttribute('name') ??
          element.tagName
        )
          .trim()
          .slice(0, 48);
      const hitArea = (element: Element): Element => {
        if (
          element instanceof HTMLInputElement &&
          (element.type === 'radio' || element.type === 'checkbox')
        )
          return element.closest('label') ?? element.labels?.[0] ?? element;
        return element;
      };
      const seen = new Set<Element>();
      const out: { name: string; width: number; height: number }[] = [];
      for (const element of root.querySelectorAll(
        'button, input:not([type="hidden"]), select, textarea, a[href], summary',
      )) {
        if (!visible(element)) continue;
        const target = hitArea(element);
        if (seen.has(target)) continue;
        seen.add(target);
        const box = target.getBoundingClientRect();
        if (box.width < min - 0.5 || box.height < min - 0.5)
          out.push({
            name: label(element) || label(target),
            width: Math.round(box.width * 10) / 10,
            height: Math.round(box.height * 10) / 10,
          });
      }
      return out;
    },
    { scopeSelector: scope, min: minimum },
  );

export const horizontalOverflow = async (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

/** Control left edges under `scope` (distinct, rounded) for single-column checks. */
export const columnEdges = async (page: Page, scope: string): Promise<number[]> =>
  page.evaluate((scopeSelector) => {
    const root = document.querySelector(scopeSelector) ?? document.body;
    const edges = new Set<number>();
    for (const element of root.querySelectorAll(
      'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), select, textarea',
    )) {
      const box = element.getBoundingClientRect();
      if (box.width > 0) edges.add(Math.round(box.left));
    }
    return [...edges].sort((a, b) => a - b);
  }, scope);

/** True when every labelled control has its label above (not beside) it. */
export const labelsAbove = async (page: Page, scope: string): Promise<string[]> =>
  page.evaluate((scopeSelector) => {
    const root = document.querySelector(scopeSelector) ?? document.body;
    const beside: string[] = [];
    for (const field of root.querySelectorAll(
      'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), select, textarea',
    )) {
      const label = (field as HTMLInputElement).labels?.[0];
      if (label === undefined) continue;
      const a = label.getBoundingClientRect();
      const b = field.getBoundingClientRect();
      if (a.bottom > b.top + 1) beside.push(label.innerText.trim().slice(0, 40));
    }
    return beside;
  }, scope);
