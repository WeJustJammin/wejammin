import { expect, test } from '@playwright/test';

import { ENTRIES_API, ENTRIES_PATH, seedEntry } from './support/s10-real-api';
import {
  expectNoSeriousAxeFindings,
  gotoHydrated,
  requireLoopbackOrigin,
  signIn,
  waitForIslands,
} from './support/s10-real-browser';
import {
  effectCounts,
  prepareS10World,
  provisionAuthor,
  type S10World,
} from './support/s10-real-world';

/*
 * Slice 10 CMS-05 rich-text authoring (DEC-112 rich_text.v1) through the REAL
 * composition. The constrained native editor submits only the canonical AST; the
 * database validator (`cms_rich_text_v1_valid`) is the authority, so a document
 * the browser would never send is refused by the real SQL, not by a stub. Local
 * loopback only; never hosted evidence.
 */

let world: S10World;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  requireLoopbackOrigin(test.info().project.use.baseURL);
  world = await prepareS10World();
});

const span = (text: string, marks: string[] = []) => ({ text, marks });
const document = (...blocks: unknown[]) => ({
  format: 'rich_text.v1',
  blocks,
});

test.describe('Phase 2 Slice 10 rich-text real route', () => {
  test('authors a canonical rich_text.v1 value, refuses unsafe links inline, and round-trips the stored AST through the real database', async ({
    browser,
  }) => {
    test.setTimeout(150_000);
    const author = provisionAuthor(world, 'rich-text-author');
    const { page, client, browserErrors } = await signIn(
      browser,
      world,
      author,
    );
    const entry = await seedEntry(client, world, 'Rich text entry');
    const draftPath = `${ENTRIES_PATH}/${entry.entryId}`;

    const loaded = await gotoHydrated(page, draftPath);
    expect(loaded?.status()).toBe(200);
    expect(loaded?.headers()['cache-control']).toBe('no-store');

    const editor = page.getByRole('group', { name: 'Body' });
    await expect(editor).toBeVisible();
    const preview = page.getByRole('region', { name: 'Body preview' });

    // Canonical authoring: a constrained block plus a mark, previewed through the
    // typed renderer with no raw HTML.
    await editor.getByLabel('Block type').first().selectOption('paragraph');
    await editor.getByLabel('Block text').first().fill('Hello **world**');
    await expect(preview.locator('strong')).toHaveText('world');
    await expect(preview.locator('script')).toHaveCount(0);

    // Unsafe link schemes are refused inline, before any submit.
    for (const unsafe of ['[x](javascript:alert(1))', '[x](//evil.example)']) {
      await editor.getByLabel('Block text').first().fill(unsafe);
      await expect(editor.getByRole('alert')).toContainText(
        'That link is not allowed.',
      );
    }

    // A second block (a heading) and a third (a list item) make a document whose
    // structure the renderer and the database must both accept.
    await editor.getByLabel('Block text').first().fill('Hello **world**');
    await editor.getByRole('button', { name: 'Add block' }).click();
    const blockTypes = editor.getByLabel('Block type');
    await blockTypes.nth(1).selectOption('heading');
    await editor.getByLabel('Heading level').selectOption('2');
    await editor.getByLabel('Block text').nth(1).fill('A section');
    await editor.getByRole('button', { name: 'Add block' }).click();
    await blockTypes.nth(2).selectOption('list_item');
    await editor
      .getByLabel('Block text')
      .nth(2)
      .fill('An item with [a link](https://example.com/page)');

    const save = page.waitForResponse(
      (response) =>
        response.url().endsWith(`${ENTRIES_API}/${entry.entryId}/revisions`) &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Save draft' }).click();
    const saved = await save;
    expect(saved.status()).toBe(201);
    const sent = saved.request().postDataJSON() as {
      changedPaths: string[];
      values: Record<string, unknown>;
    };
    // Only the canonical AST reaches the wire, and only for the field changed.
    expect(sent.changedPaths).toEqual([`/fields/${world.fields.body}`]);
    expect(sent.values[world.fields.body]).toEqual(
      document(
        { type: 'paragraph', spans: [span('Hello '), span('world', ['bold'])] },
        { type: 'heading', level: 2, spans: [span('A section')] },
        {
          type: 'list_item',
          list: 'bulleted',
          depth: 1,
          spans: [
            span('An item with '),
            {
              text: 'a link',
              marks: [],
              link: { kind: 'https', href: 'https://example.com/page' },
            },
          ],
        },
      ),
    );
    await expect(page.getByRole('status').first()).toContainText(
      'All changes saved.',
    );

    // The stored value comes back from the database unchanged: the editor shows
    // the markup, the renderer shows typed elements only.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForIslands(page);
    const reloaded = page.getByRole('group', { name: 'Body' });
    await expect(reloaded.getByLabel('Block text').first()).toHaveValue(
      'Hello **world**',
    );
    const rendered = page.getByRole('region', { name: 'Body preview' });
    await expect(rendered.locator('strong')).toHaveText('world');
    await expect(rendered.getByRole('heading', { level: 2 })).toHaveText(
      'A section',
    );
    const link = rendered.getByRole('link', { name: 'a link' });
    await expect(link).toHaveAttribute('href', 'https://example.com/page');
    await expect(link).toHaveAttribute('rel', /noopener/u);
    await expect(rendered.locator('script, iframe, img')).toHaveCount(0);
    await expectNoSeriousAxeFindings(page, 'rich text editor');
    expect(effectCounts(entry.entryId)).toMatchObject({ revisions: 2 });
    expect(browserErrors, 'no script or hydration errors').toEqual([]);
  });

  test('the database refuses what the editor never sends: non-canonical and unsafe documents are typed 422s that mutate nothing', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const author = provisionAuthor(world, 'rich-text-refusal');
    const { client } = await signIn(browser, world, author);
    const entry = await seedEntry(client, world, 'Refusal entry');
    const before = effectCounts(entry.entryId);

    const refused = async (value: unknown, label: string) => {
      const response = await client.post(
        `${ENTRIES_API}/${entry.entryId}/revisions`,
        {
          entryId: entry.entryId,
          baseRevision: entry.revision,
          changedPaths: [`/fields/${world.fields.body}`],
          values: { [world.fields.body]: value },
          locale: 'en-US',
          expectedVersion: entry.version,
        },
        { ifMatch: entry.version },
      );
      expect(response.status, `${label}: ${response.text}`).toBe(422);
      expect(response.body.code, label).toBe('VALIDATION_FAILED');
      return response;
    };

    // Adjacent spans with equal marks and link must be merged: one normal form.
    const adjacent = await refused(
      document({
        type: 'paragraph',
        spans: [span('Hello '), span('world')],
      }),
      'adjacent equal spans',
    );
    expect(
      (adjacent.body.details as { reasonCode?: string }).reasonCode,
      adjacent.text,
    ).toBe('rich_text_not_canonical');
    // A plain string and an executable-looking AST are not rich text at all.
    await refused('<script>alert(1)</script>', 'raw string');
    await refused(
      { format: 'rich_text.v1', blocks: [{ type: 'script', spans: [] }] },
      'unknown block type',
    );
    // An unsafe link scheme is refused whatever the browser did.
    await refused(
      document({
        type: 'paragraph',
        spans: [
          {
            text: 'x',
            marks: [],
            link: { kind: 'https', href: 'javascript:alert(1)' },
          },
        ],
      }),
      'javascript: link',
    );

    // Nothing was committed by any of the refusals.
    expect(effectCounts(entry.entryId)).toEqual(before);
  });
});
