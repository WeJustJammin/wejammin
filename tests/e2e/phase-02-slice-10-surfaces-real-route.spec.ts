import { expect, test, type Page } from '@playwright/test';

import {
  ENTRIES_API,
  ENTRIES_PATH,
  appendTitle,
  seedEntry,
  type S10Client,
  type SeededEntry,
} from './support/s10-real-api';
import {
  expectNoHorizontalScroll,
  expectNoSeriousAxeFindings,
  requireLoopbackOrigin,
  signIn,
  type SignedIn,
} from './support/s10-real-browser';
import {
  prepareS10World,
  provisionAuthor,
  type S10Principal,
  type S10World,
} from './support/s10-real-world';

/*
 * Slice 10 viewport and accessibility smoke over every editorial surface,
 * through the REAL composition: the list, the create form, the draft editor, the
 * conflict resolution, the history with its comparison and restore review, and
 * the closed 403 / 404 states. Each surface is opened at 320, 768 and 1025 CSS
 * pixels and must have one h1, a main landmark, no horizontal document scroll
 * and no serious or critical axe finding (colour contrast included, since the
 * page is laid out in a real browser). Local loopback only; never hosted
 * evidence.
 */

const VIEWPORTS = [
  { name: '320', width: 320, height: 720 },
  { name: '768', width: 768, height: 1024 },
  { name: '1025', width: 1025, height: 768 },
] as const;

type Fixture = Readonly<{
  world: S10World;
  author: S10Principal;
  signed: SignedIn;
  entry: SeededEntry;
  conflictId: string;
  firstRevisionId: string;
}>;

let fixture: Fixture;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  requireLoopbackOrigin(test.info().project.use.baseURL);
  const world = await prepareS10World();
  const author = provisionAuthor(world, 'surfaces');
  const signed = await signIn(browser, world, author, 1);
  const second = await signIn(browser, world, author, 2);
  const base = await seedEntry(signed.client, world, 'Surface base');
  const moved = await appendTitle(signed.client, world, base, 'Surface theirs');
  // A same-field write holding the CURRENT entry version but the old base
  // revision records the durable open conflict.
  const stale = await second.client.post(
    `${ENTRIES_API}/${base.entryId}/revisions`,
    {
      entryId: base.entryId,
      baseRevision: base.revision,
      changedPaths: [`/fields/${world.fields.title}`],
      values: { [world.fields.title]: 'Surface mine' },
      locale: 'en-US',
      expectedVersion: moved.version,
    },
    { ifMatch: moved.version },
  );
  expect(stale.status, stale.text).toBe(409);
  const detail = await (signed.client as S10Client).get(
    `${ENTRIES_API}/${base.entryId}`,
  );
  const conflictId = (detail.body.openConflict as { conflictId: string })
    .conflictId;
  await second.context.close();
  fixture = {
    world,
    author,
    signed,
    entry: moved,
    conflictId,
    firstRevisionId: base.firstRevisionId,
  };
});

test.afterAll(async () => {
  await fixture?.signed.context.close();
});

const surfaces = (
  current: Fixture,
): readonly (readonly [string, string, number])[] => [
  ['entry list', ENTRIES_PATH, 200],
  [
    'create form',
    `${ENTRIES_PATH}/new?contentTypeVersionId=${current.world.contentTypeVersionId}`,
    200,
  ],
  ['draft editor', `${ENTRIES_PATH}/${current.entry.entryId}`, 200],
  [
    'conflict resolution',
    `${ENTRIES_PATH}/${current.entry.entryId}/conflicts/${current.conflictId}`,
    200,
  ],
  [
    'revision history',
    `${ENTRIES_PATH}/${current.entry.entryId}/revisions`,
    200,
  ],
  [
    'revision comparison',
    `${ENTRIES_PATH}/${current.entry.entryId}/revisions?compareRevisionId=${current.firstRevisionId}`,
    200,
  ],
];

const openAndCheck = async (
  page: Page,
  label: string,
  path: string,
  status: number,
): Promise<void> => {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response?.status(), label).toBe(status);
  expect(response?.headers()['cache-control'], label).toBe('no-store');
  await expect(page.getByRole('heading', { level: 1 }), label).toHaveCount(1);
  await expect(page.getByRole('main'), label).toBeVisible();
  // Wait for the hydrated islands before measuring layout or running axe.
  await page.waitForLoadState('networkidle');
  await expectNoHorizontalScroll(page, label);
  await expectNoSeriousAxeFindings(page, label);
};

for (const viewport of VIEWPORTS) {
  test(`every editorial surface is laid out and accessible at ${viewport.name}px`, async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    await fixture.signed.page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    for (const [label, path, status] of surfaces(fixture))
      await openAndCheck(
        fixture.signed.page,
        `${label} @${viewport.name}`,
        path,
        status,
      );

    // The closed states are surfaces too: 403 for a member, 404 for an outsider.
    for (const [principal, label, status] of [
      [fixture.world.otherAuthor, 'access denied', 403],
      [fixture.world.outsider, 'not found', 404],
    ] as const) {
      const other = await signIn(browser, fixture.world, principal);
      await other.page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await openAndCheck(
        other.page,
        `${label} @${viewport.name}`,
        `${ENTRIES_PATH}/${fixture.entry.entryId}`,
        status,
      );
      await other.context.close();
    }
    expect(fixture.signed.browserErrors, 'no script errors').toEqual([]);
  });
}
