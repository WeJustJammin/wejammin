import { expect, test, type Page } from '@playwright/test';

import { authenticateLocalSession as authenticate } from './support/local-signed-session';
// No root workspace link to `@wejammin/contracts`; import the constant module.
import { CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER } from '../../packages/contracts/src/content-schema-registry/route-policy-base';

/**
 * AC250 - the high-risk activation confirmation must expose consequence,
 * affected scope, expected version, acting context, and step-up. Inline
 * presentation is authoritative here, so the modal-only containment rule does
 * not apply; this spec checks heading focus, a normal Tab flow with no trap,
 * and Escape-to-cancel. Local fixture, production-built Astro route only: not
 * real MFA, identity-provider, or hosted acceptance, and it never fabricates a
 * successful activation. The fixture's private freshness header is asserted
 * absent from the browser-facing response.
 */

test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' });

const TYPE_ID = '30000000-0000-4000-8000-000000000003';
const VERSION_ID = '40000000-0000-4000-8000-000000000004';
const PARTY_ID = '20000000-0000-4000-8000-000000000002';
const VERIFIED_SESSION_ID = '80000000-0000-4000-8000-000000000010';
const REQUIRED_SESSION_ID = '80000000-0000-4000-8000-000000000011';
const UNAVAILABLE_SESSION_ID = '80000000-0000-4000-8000-000000000012';
const LABEL = 'Northwind Collective';
const FALLBACK_LABEL = 'Server-verified acting context unavailable';
const DETAIL_PATH = `/app/cms-content-modeling/${TYPE_ID}/versions/${VERSION_ID}`;
const AFFECTED_SCOPE = `Content type ${TYPE_ID}, version ${VERSION_ID}`;
const CONFIRMATION = 'section.content-schema-registry-confirmation';
const ACTIVATION_SUBMIT = 'Save schema activation';
const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;

const CONFIRMATION_TERMS = [
  'Consequence',
  'Affected scope',
  'Expected version',
  'Acting context',
  'Step-up',
] as const;

/** Production-built detail route, tolerating the local Worker's first-boot 503. */
const gotoDetail = async (
  page: Page,
): Promise<import('@playwright/test').Response | null> => {
  let response = await page.goto(DETAIL_PATH, { waitUntil: 'networkidle' });
  if (response?.status() !== 503) return response;
  await expect
    .poll(
      async () => {
        response = await page.goto(DETAIL_PATH, { waitUntil: 'networkidle' });
        return response?.status() ?? 0;
      },
      { timeout: 5_000, intervals: [100, 250, 500] },
    )
    .toBe(200);
  return response;
};

const waitForHydration = async (page: Page): Promise<void> => {
  await expect(
    page.locator('[data-workbench="content-schema-registry"]'),
  ).toHaveAttribute('data-content-schema-registry-hydrated', 'true', {
    timeout: 10_000,
  });
};

/** Resolve the <dd> that follows a named <dt> inside the confirmation step. */
const termValue = (page: Page, term: string) =>
  page
    .locator(CONFIRMATION)
    .locator(
      `xpath=.//dt[normalize-space(.)=${JSON.stringify(term)}]/following-sibling::dd[1]`,
    );

interface WatchedPage {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly failedRequests: string[];
  readonly postedRequests: string[];
  readonly expectClean: () => void;
}

/** Capture unexpected browser errors, failed requests, and any POST attempts. */
const watchPage = (page: Page): WatchedPage => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const postedRequests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) =>
    failedRequests.push(
      `${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`,
    ),
  );
  page.on('request', (request) => {
    if (request.method() !== 'GET')
      postedRequests.push(`${request.method()} ${request.url()}`);
  });
  return {
    consoleErrors,
    pageErrors,
    failedRequests,
    postedRequests,
    expectClean: () => {
      expect(pageErrors, 'unexpected page errors').toEqual([]);
      expect(failedRequests, 'unexpected failed browser requests').toEqual([]);
      expect(consoleErrors, 'unexpected console errors').toEqual([]);
    },
  };
};

interface ActiveElement {
  readonly id: string;
  readonly tag: string;
  readonly text: string;
  readonly inConfirmation: boolean;
}

const activeElement = (page: Page): Promise<ActiveElement> =>
  page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (element === null)
      return { id: '', tag: '', text: '', inConfirmation: false };
    return {
      id: element.id,
      tag: element.tagName.toLowerCase(),
      text: (element.textContent ?? '').trim().slice(0, 60),
      inConfirmation:
        element.closest('section.content-schema-registry-confirmation') !==
        null,
    };
  });

test('[P2-S09-AC-250] renders the inline confirmation with a server-verified acting context and fresh step-up', async ({
  context,
  page,
}) => {
  const watched = watchPage(page);
  await authenticate(context, { sessionId: VERIFIED_SESSION_ID });

  // Deterministic browser clock so the disclosure timer can be advanced.
  await page.clock.install();
  const response = await gotoDetail(page);
  expect(response?.status()).toBe(200);
  await waitForHydration(page);

  const confirmation = page.locator(CONFIRMATION);
  await expect(confirmation).toBeVisible();
  // Inline first: this is a plain region, never a modal dialog.
  await expect(
    page.locator('[role="dialog"], [aria-modal="true"]'),
  ).toHaveCount(0);

  // Heading receives focus when the confirmation mounts.
  await expect(
    page.getByRole('heading', {
      level: 3,
      name: 'Confirm schema activation',
    }),
  ).toBeFocused({ timeout: 10_000 });

  // Ordered clause labels.
  expect(
    (await confirmation.locator('dt').allInnerTexts()).slice(0, 5),
  ).toEqual([...CONFIRMATION_TERMS]);

  // Five required clauses.
  await expect(termValue(page, 'Consequence')).toContainText(
    'Activation affects the selected content type version and future entry validation.',
  );
  await expect(termValue(page, 'Affected scope')).toHaveText(AFFECTED_SCOPE);
  await expect(termValue(page, 'Expected version')).toHaveText('1');
  // Exact bounded claim: an indefinite or malformed value cannot pass.
  await expect(termValue(page, 'Step-up')).toHaveText(
    /^Verified until \d{2}:\d{2} UTC$/,
  );

  // Acting context is the resolved human label, never a private identifier.
  const actingContext = termValue(page, 'Acting context');
  await expect(actingContext).toHaveText(LABEL);
  await expect(actingContext).not.toContainText(PARTY_ID);
  expect(await actingContext.innerText()).not.toMatch(UUID_PATTERN);

  // Public scope identifiers are expected in the disclosure.
  await expect(termValue(page, 'Affected scope')).toContainText(TYPE_ID);
  await expect(termValue(page, 'Affected scope')).toContainText(VERSION_ID);

  // The private freshness header never crosses to the browser-facing response.
  const browserResponse = await page.request.get(DETAIL_PATH);
  expect(
    browserResponse.headers()[
      CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER
    ],
  ).toBeUndefined();
  expect(await browserResponse.text()).not.toContain('actingContextId');

  // Browser-clock expiry only: the mounted disclosure timer must drop the
  // claim without a submit or navigation. Not real MFA/server revocation.
  await page.clock.fastForward(11 * 60_000);
  await expect(termValue(page, 'Step-up')).toHaveText(
    'Step-up required before commit',
  );
  expect(new URL(page.url()).pathname).toBe(DETAIL_PATH);
  expect(
    watched.postedRequests.filter((request) => request.includes('/activate')),
  ).toEqual([]);

  watched.expectClean();
});

test('[P2-S09-AC-250] reports required step-up without an indefinite claim when freshness is absent', async ({
  context,
  page,
}) => {
  const watched = watchPage(page);
  await authenticate(context, { sessionId: REQUIRED_SESSION_ID });

  const response = await gotoDetail(page);
  expect(response?.status()).toBe(200);
  await waitForHydration(page);

  // The label read still resolves; only the step-up window is not fresh.
  await expect(termValue(page, 'Acting context')).toHaveText(LABEL);
  await expect(termValue(page, 'Step-up')).toContainText(
    'Step-up required before commit',
  );
  await expect(termValue(page, 'Step-up')).not.toContainText('Verified until');

  watched.expectClean();
});

test('[P2-S09-AC-250] fails closed to a server-rendered acting-context disclosure when the label read is unavailable', async ({
  context,
  page,
}) => {
  const watched = watchPage(page);
  await authenticate(context, { sessionId: UNAVAILABLE_SESSION_ID });

  // The fallback is SSR-private: it must be present in the raw server HTML,
  // proving a server-rendered disclosure rather than a browser outage.
  const ssr = await page.request.get(DETAIL_PATH);
  const ssrHtml = await ssr.text();
  expect(ssrHtml).toContain('Confirm schema activation');
  expect(ssrHtml).toContain(FALLBACK_LABEL);
  expect(ssrHtml).toContain('Step-up required before commit');

  const response = await gotoDetail(page);
  expect(response?.status()).toBe(200);
  await waitForHydration(page);

  await expect(termValue(page, 'Acting context')).toHaveText(FALLBACK_LABEL);
  await expect(termValue(page, 'Acting context')).not.toContainText(PARTY_ID);
  expect(await termValue(page, 'Acting context').innerText()).not.toMatch(
    UUID_PATTERN,
  );
  await expect(termValue(page, 'Expected version')).toHaveText('1');
  await expect(termValue(page, 'Step-up')).toContainText(
    'Step-up required before commit',
  );

  watched.expectClean();
});

test('[P2-S09-AC-250] keeps the confirmation inline with a normal Tab flow and no modal trap', async ({
  context,
  page,
}) => {
  const watched = watchPage(page);
  await authenticate(context, { sessionId: VERIFIED_SESSION_ID });

  const response = await gotoDetail(page);
  expect(response?.status()).toBe(200);
  await waitForHydration(page);

  const heading = page.getByRole('heading', {
    level: 3,
    name: 'Confirm schema activation',
  });
  await expect(heading).toBeFocused({ timeout: 10_000 });
  await expect(
    page.locator('[role="dialog"], [aria-modal="true"]'),
  ).toHaveCount(0);

  await heading.focus();
  const sequence: ActiveElement[] = [];
  for (let step = 0; step < 40; step += 1) {
    await page.keyboard.press('Tab');
    sequence.push(await activeElement(page));
  }

  const checkboxIndex = sequence.findIndex(
    (entry) => entry.id === 'content-schema-registry-confirmed',
  );
  expect(
    checkboxIndex,
    'acknowledgement control is reachable by Tab',
  ).toBeGreaterThanOrEqual(0);
  const exitIndex = sequence.findIndex((entry) => !entry.inConfirmation);
  expect(
    exitIndex,
    'focus leaves the confirmation region instead of trapping',
  ).toBeGreaterThan(checkboxIndex);
  const submitIndex = sequence.findIndex(
    (entry) =>
      entry.tag === 'button' && entry.text.startsWith(ACTIVATION_SUBMIT),
  );
  expect(submitIndex, 'activation submit is reachable by Tab').toBeGreaterThan(
    checkboxIndex,
  );

  // Escape behavior is asserted in the dedicated Escape test below.
  const checkbox = page.locator('#content-schema-registry-confirmed');
  await expect(checkbox).toHaveAttribute('required', '');
  await checkbox.scrollIntoViewIfNeeded();

  watched.expectClean();
});

test('[P2-S09-AC-250] Escape clears acknowledgement and retains draft fields without committing or navigating', async ({
  context,
  page,
}) => {
  const watched = watchPage(page);
  await authenticate(context, { sessionId: VERIFIED_SESSION_ID });

  const response = await gotoDetail(page);
  expect(response?.status()).toBe(200);
  await waitForHydration(page);

  const checkbox = page.locator('#content-schema-registry-confirmed');
  const dryRunId = page.locator('#content-schema-registry-dry-run-id');
  const approvalIds = page.locator('#content-schema-registry-approval-ids');

  await dryRunId.fill('90000000-0000-4000-8000-000000000009');
  await approvalIds.fill('["a0000000-0000-4000-8000-00000000000a"]');
  await checkbox.check();
  await expect(checkbox).toBeChecked();

  await checkbox.focus();
  await page.keyboard.press('Escape');

  await expect(checkbox).not.toBeChecked();
  await expect(dryRunId).toHaveValue('90000000-0000-4000-8000-000000000009');
  await expect(approvalIds).toHaveValue(
    '["a0000000-0000-4000-8000-00000000000a"]',
  );
  expect(new URL(page.url()).pathname).toBe(DETAIL_PATH);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  // No activation command left the browser.
  expect(
    watched.postedRequests.filter((request) => request.includes('/activate')),
  ).toEqual([]);

  watched.expectClean();
});

test('[P2-S09-AC-250] keeps the disclosure readable at 320, 768, and 1280 CSS px without horizontal overflow', async ({
  context,
  page,
}) => {
  const watched = watchPage(page);
  await authenticate(context, { sessionId: VERIFIED_SESSION_ID });

  for (const width of [320, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const response = await gotoDetail(page);
    expect(response?.status()).toBe(200);
    await waitForHydration(page);

    const confirmation = page.locator(CONFIRMATION);
    await expect(confirmation).toBeVisible();
    expect(
      (await confirmation.locator('dt').allInnerTexts()).slice(0, 5),
    ).toEqual([...CONFIRMATION_TERMS]);
    await expect(termValue(page, 'Acting context')).toHaveText(LABEL);
    await expect(termValue(page, 'Acting context')).not.toContainText(PARTY_ID);
    expect(await termValue(page, 'Acting context').innerText()).not.toMatch(
      UUID_PATTERN,
    );

    // Browser-width reflow only; this does not emulate browser zoom.
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(
      overflow.scrollWidth,
      `no horizontal overflow at ${String(width)}px`,
    ).toBeLessThanOrEqual(overflow.innerWidth + 1);
  }

  watched.expectClean();
});
