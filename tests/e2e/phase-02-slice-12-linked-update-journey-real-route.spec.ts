import { expect, test } from '@playwright/test';

import { seedEntry } from './support/s10-real-api';
import { COMPOSITION_PAGE } from './support/s12-pw5-world';
import { trace } from './support/s12-pw5-trace';
import {
  UPDATE,
  openPage,
  placeLinkedInBrowser,
  posted,
} from './support/s12-pw9-flow';
import { runLinkedScan } from './support/s12-pw9-jobs';
import { expectNothingLeaked } from './support/s12-pw9-scan';
import {
  latencyRoot,
  marker,
  newPatternKey,
  newestInstance,
  savePatternVersion,
} from './support/s12-pw9-world';
import {
  activateViaApi,
  prepareJourneyCast,
  within,
  type JourneyCast,
} from './support/s12-pw7-flow';

/*
 * P2-S12-AC-273 (V11 section 5), the LINKED PATTERN UPDATE journey, through the REAL composition, with three people (the
 * author, the designer, the owner and the reviewer who activate the successor).
 *
 *   J8  a pattern (version 1) is active and an author places it, linked, in two entries from the instance-insert form. The
 *       designer saves version 2 (a changed `title` prop) and it is activated through the governed chain. The system job
 *       `cms.pattern.linked_update_scan` appends a `pending_diff` row to each placement (BE03c "Linked update"; DEC-193).
 *       The author reviews the update on the composition page of the first entry (the three-way diff shows the new text, no
 *       collision) and ACCEPTS it: the placement is pinned to version 2. On the second entry the author reviews the same
 *       update and DETACHES the block as a local copy (DEC-193: the author decides). A fresh load shows both outcomes.
 *
 * The scan job is the one step the browser cannot take: the real-route harness has no queue consumer, so the job body is run
 * through its production `platform_api` RPC as the Worker service credential (`support/s12-pw9-jobs.ts`); what it appends is
 * what the page then reads. The diff VALUES (the version 1 and version 2 `title` texts) are run-unique markers and are scanned
 * for in URLs, storage, console, the outbox and the audit rows (FE03 line 895).
 *
 * Written without a running stack (the lane may not run one): labels and sentences follow `CmsCompositionInstanceRow`,
 * `CmsPatternUpdateDiff`, `CmsDiffPath`, `composition-rows.ts` and `use-composition-updates.ts`. Local loopback only.
 */
let journey: JourneyCast;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(300_000);
  journey = await prepareJourneyCast(
    browser,
    test.info().project.use.baseURL,
    'linked',
  );
});

test('[P2-S12-AC-273] J8 a linked pattern update is accepted on one entry and detached on another: the scan job appends the update, the diff shows the new text, and a fresh load shows both outcomes', async () => {
  test.setTimeout(900_000);
  const { cast, author, designer, owner, reviewer } = journey;
  const pages = [author.page, designer.page, owner.page, reviewer.page];
  const gathered = trace(...pages);
  const tag = marker('linked');
  const textOne = `${tag} text one`;
  const textTwo = `${tag} text two`;
  const reasons = [`${tag} v1 approved.`, `${tag} v2 approved.`];

  // Version 1 is active and placed, linked, in two entries.
  const one = await savePatternVersion(
    designer.client,
    cast.world,
    newPatternKey('linked'),
    [latencyRoot('root1', textOne)],
    null,
  );
  await activateViaApi(
    journey,
    designer,
    'pattern_version',
    one,
    reasons[0] ?? '',
  );
  const accepted = await seedEntry(author.client, cast.world, `${tag} accepts`);
  const detached = await seedEntry(
    author.client,
    cast.world,
    `${tag} detaches`,
  );
  await placeLinkedInBrowser(author, accepted.entryId, one.patternKey, 1);
  await placeLinkedInBrowser(author, detached.entryId, one.patternKey, 1);
  expect(newestInstance(accepted.entryId, one.patternId, '/root1')).toMatch(
    /^active\|linked\|1\|/u,
  );
  expect(newestInstance(detached.entryId, one.patternId, '/root1')).toMatch(
    /^active\|linked\|1\|/u,
  );

  // Version 2 changes the text and is activated; the scan job appends a pending update to each placement.
  const two = await savePatternVersion(
    designer.client,
    cast.world,
    one.patternKey,
    [latencyRoot('root1', textTwo)],
    one,
  );
  await activateViaApi(
    journey,
    designer,
    'pattern_version',
    two,
    reasons[1] ?? '',
  );
  const scan = await runLinkedScan(two.patternId, two.versionId);
  expect(scan.appended, JSON.stringify(scan)).toBe(2);
  expect(newestInstance(accepted.entryId, one.patternId, '/root1')).toMatch(
    /^pending_diff\|linked\|1\|/u,
  );

  // Accept: the row says an update is available; the diff shows the new text and asks for no choice; Accept update applies it.
  const { page } = author;
  await openPage(author, COMPOSITION_PAGE(accepted.entryId), 'Composition');
  const row = page.locator('.cms-instance-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Update available');
  await expect(row).toContainText('Pinned to pattern version 1');
  await row.getByRole('button', { name: 'Review update for /root1' }).click();
  await expect(
    page.getByRole('heading', { name: 'Update for /root1' }),
  ).toBeVisible(within);
  await expect(
    page.getByText('Pinned to pattern version 1; version 2 is available.'),
  ).toBeVisible();
  await expect(page.locator('[data-diff-count]')).toHaveText(
    '1 changed path, 0 collisions',
  );
  await expect(page.locator('.cms-diff-path')).toContainText(
    'Changed in the new version. No choice is needed.',
  );
  await expect(page.getByRole('region', { name: /^Base for / })).toContainText(
    textOne,
  );
  await expect(
    page.getByRole('region', { name: /^Theirs for / }),
  ).toContainText(textTwo);
  const update = posted(page, UPDATE);
  await page.getByRole('button', { name: 'Accept update' }).click();
  const answered = await update;
  expect(answered.status(), await answered.text()).toBeLessThan(300);
  expect(answered.request().headers()['if-match']).toMatch(/^"\d+"$/u);
  await expect(
    page.getByRole('heading', { name: 'Update applied' }),
  ).toBeVisible(within);
  expect(newestInstance(accepted.entryId, one.patternId, '/root1')).toMatch(
    /^active\|linked\|2\|/u,
  );

  // Detach: the same update on the other entry is declined; the block becomes a local copy that no longer receives updates.
  await openPage(author, COMPOSITION_PAGE(detached.entryId), 'Composition');
  const other = page.locator('.cms-instance-row');
  await expect(other).toContainText('Update available');
  await other.getByRole('button', { name: 'Review update for /root1' }).click();
  await expect(
    page.getByRole('heading', { name: 'Update for /root1' }),
  ).toBeVisible(within);
  await expect(
    page.getByText(
      'Detaching makes this block a local copy that no longer receives updates.',
    ),
  ).toBeVisible();
  const detach = posted(page, UPDATE);
  await page.getByRole('button', { name: 'Detach as a local copy' }).click();
  const detachAnswer = await detach;
  expect(detachAnswer.status(), await detachAnswer.text()).toBeLessThan(300);
  await expect(page.getByRole('heading', { name: 'Detached' })).toBeVisible(
    within,
  );
  expect(newestInstance(detached.entryId, one.patternId, '/root1')).toMatch(
    /^[a-z_]+\|detached\|/u,
  );

  // A fresh load of each page shows what the database holds: pinned to version 2 and up to date; a local copy.
  await openPage(author, COMPOSITION_PAGE(accepted.entryId), 'Composition');
  await expect(page.locator('.cms-instance-row')).toContainText('Up to date');
  await expect(page.locator('.cms-instance-row')).toContainText(
    'Pinned to pattern version 2',
  );
  await openPage(author, COMPOSITION_PAGE(detached.entryId), 'Composition');
  await expect(page.locator('.cms-instance-row')).toContainText('Local copy');
  await expect(
    page.getByRole('button', { name: 'Review update for /root1' }),
  ).toHaveCount(0);

  for (const person of [author, designer, owner, reviewer])
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
    values: [textOne, textTwo, tag, ...reasons],
  });
});
