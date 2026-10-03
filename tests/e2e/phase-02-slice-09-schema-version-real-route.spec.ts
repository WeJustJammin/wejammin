import { expect, test } from '@playwright/test';

import { newTestId, closeLaneContexts } from './support/s09-lane-browser';
import {
  REGISTRY,
  createTypeViaUi,
  decideViaUi,
  readWorkerJson,
  reviewApiPath,
  uuidIn,
  versionApiPath,
  waitForWorkbench,
} from './support/s09-lane-flows';
import {
  actor,
  assignReviewer,
  enrollReviewer,
  openReview,
} from './support/s09-lane-scenarios';

/**
 * Slice 09 version page: dry-run polling and sealed report, the activation
 * prefill after a real review, and list-selection restore on Back, driven in
 * Google Chrome against the production-built routes (loopback stateful lane).
 */

test.use({ trace: 'retain-on-failure', screenshot: 'only-on-failure' });

test.afterEach(closeLaneContexts);

const approvedStage = async (browser: import('@playwright/test').Browser) => {
  const stage = await openReview(browser);
  await assignReviewer(stage);
  const reviewer = await enrollReviewer(browser, stage.testId);
  await decideViaUi(reviewer.page, stage.reviewPath, 'approve');
  return { stage, reviewer };
};

test('[P2-S09-AC-963] [P2-S09-AC-1039] polls the dry-run job to its sealed report and shows the exact counts and hashes the API holds', async ({
  browser,
}) => {
  const testId = newTestId();
  const owner = await actor(browser, 'owner', testId);
  const page = owner.page;
  const created = await createTypeViaUi(page);
  // Focus a real control; polling and the sealed refetch must never take it.
  const fieldKey = page.getByRole('textbox', { name: 'Field key' });
  await page.getByRole('button', { name: 'Save dry-run request' }).click();
  const seen = new Set<string>();
  // The mutation outcome moves focus to its status region once; focus the real
  // control only after that, so polling and the sealed refetch are what the
  // assertion below measures.
  await expect(page.locator('[data-cms-dry-run-status]').first()).toContainText(
    /queued/iu,
    {
      timeout: 15_000,
    },
  );
  seen.add('queued');
  await page.waitForTimeout(300);
  await fieldKey.focus();
  await expect
    .poll(
      async () => {
        const text = (
          await page.locator('[data-cms-dry-run-status]').first().innerText()
        ).trim();
        seen.add(
          /queued/iu.test(text)
            ? 'queued'
            : /running/iu.test(text)
              ? 'running'
              : /sealed dry run passed/iu.test(text)
                ? 'sealed'
                : text,
        );
        return [...seen].includes('sealed');
      },
      { timeout: 25_000, intervals: [150] },
    )
    .toBe(true);
  expect([...seen]).toEqual(
    expect.arrayContaining(['queued', 'running', 'sealed']),
  );
  await expect(fieldKey).toBeFocused();

  const detail = await readWorkerJson(page, versionApiPath(created));
  const run = (
    detail.activationPreparation as { dryRunRef: Record<string, unknown> }
  ).dryRunRef;
  const liveText = await page
    .locator('[data-cms-dry-run-status]')
    .first()
    .innerText();
  const definition = (term: string) =>
    page
      .locator('dt', { hasText: new RegExp(`^${term}$`, 'u') })
      .locator('xpath=following-sibling::dd[1]');
  await expect(definition('Source rows')).toHaveText(String(run.sourceCount));
  await expect(definition('Target rows')).toHaveText(String(run.targetCount));
  await expect(definition('Row errors')).toHaveText(String(run.rowErrorCount));
  await expect(definition('Source hash')).toHaveText(String(run.sourceHash));
  await expect(definition('Target hash')).toHaveText(String(run.targetHash));
  await expect(definition('Report hash')).toHaveText(String(run.reportHash));
  for (const value of [run.sourceHash, run.targetHash, run.reportHash])
    expect(liveText).toContain(String(value));
  expect(liveText).toContain(`${String(run.sourceCount)} source rows`);
});

test('[P2-S09-AC-968] [P2-S09-AC-973] [P2-S09-AC-1020] the activation form is prefilled from the real approved review and activates the version', async ({
  browser,
}) => {
  const { stage } = await approvedStage(browser);
  const page = stage.owner.page;
  await page.goto(stage.created.path, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);

  const review = await readWorkerJson(page, reviewApiPath(stage.reviewPath));
  const detail = await readWorkerJson(page, versionApiPath(stage.created));
  const approveIds = (review.decisions as { id: string; decision: string }[])
    .filter((entry) => entry.decision === 'approve')
    .map((entry) => entry.id);
  expect(approveIds).toHaveLength(1);
  const dryRunId = (
    detail.activationPreparation as { dryRunRef: { id: string } }
  ).dryRunRef.id;

  const form = page.locator('#content-schema-registry-activation-form');
  await expect(
    form.getByRole('list', { name: 'Recorded approvals' }),
  ).toContainText(approveIds[0] as string);
  expect(
    JSON.parse(await form.locator('input[name="approvalIds"]').inputValue()),
  ).toEqual(approveIds);
  expect(await form.locator('input[name="dryRunId"]').inputValue()).toBe(
    dryRunId,
  );
  // The user never types identifiers or JSON: no editable field carries them.
  await expect(
    form
      .locator('input[type="text"], textarea')
      .filter({ hasText: approveIds[0] as string }),
  ).toHaveCount(0);

  await form.locator('#content-schema-registry-confirmed').check();
  await form.getByRole('button', { name: 'Save schema activation' }).click();
  await expect
    .poll(
      async () =>
        (
          (await readWorkerJson(page, versionApiPath(stage.created))) as {
            resource: { state: string };
          }
        ).resource.state,
      {
        timeout: 15_000,
      },
    )
    .toBe('active');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    '(active)',
  );
});

test('[P2-S09-AC-1019] Back restores the filtered list and the deep link carries only the review id', async ({
  browser,
}) => {
  const stage = await openReview(browser);
  const page = stage.owner.page;
  const visited: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) visited.push(frame.url());
  });
  const listUrl = `${REGISTRY}?keyPrefix=release&limit=25&sort=key&direction=asc`;
  await page.goto(listUrl, { waitUntil: 'networkidle' });
  await waitForWorkbench(page);
  await expect(page.getByRole('textbox', { name: 'Key prefix' })).toHaveValue(
    'release',
  );
  await page.getByRole('link', { name: 'View details' }).first().click();
  await page.waitForURL(/\/versions\//u);
  await waitForWorkbench(page);
  await page.getByRole('link', { name: 'Open the review' }).click();
  await page.waitForURL(/\/schema-reviews\//u);
  const reviewUrl = new URL(page.url());
  expect(reviewUrl.search).toBe('');
  expect(uuidIn(reviewUrl.pathname)).toHaveLength(1);

  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(
    new RegExp(`${REGISTRY}\\?keyPrefix=release`, 'u'),
  );
  await waitForWorkbench(page);
  await expect(page.getByRole('textbox', { name: 'Key prefix' })).toHaveValue(
    'release',
  );
  for (const url of visited)
    expect(url).not.toMatch(
      /person|reviewer|20000000-0000-4000-8000-0000000000/iu,
    );
});
