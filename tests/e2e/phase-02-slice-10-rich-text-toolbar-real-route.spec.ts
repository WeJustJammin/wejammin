import { expect, test, type Locator, type Page } from '@playwright/test';

import {
  ENTRIES_API,
  ENTRIES_PATH,
  seedEntry,
  type S10Client,
} from './support/s10-real-api';
import {
  expectNoSeriousAxeFindings,
  focusedName,
  gotoHydrated,
  requireLoopbackOrigin,
  signIn,
  tabTo,
} from './support/s10-real-browser';
import {
  prepareS10World,
  provisionAuthor,
  type S10World,
} from './support/s10-real-world';

/*
 * Slice 10 CMS-05 rich-text semantic controls (AC-086, FE03 CmsRichTextEditor)
 * through the REAL composition: the built, server-rendered, hydrated editor, the
 * first-party proxy, the production Worker and the real database. Every
 * interaction is a key press (Tab / Shift+Tab to reach a control, Enter or Space
 * to operate it, arrow keys and Shift+arrow keys to select text, Escape to
 * close): no click and no programmatic focus. The proof of "canonical" is the
 * stored draft read back from the database through the draft detail read, not
 * the editor's own preview. Local loopback only; never hosted evidence.
 */

let world: S10World;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  requireLoopbackOrigin(test.info().project.use.baseURL);
  world = await prepareS10World();
});

const span = (
  text: string,
  marks: string[] = [],
  link?: Record<string, string>,
) => ({ text, marks, ...(link === undefined ? {} : { link }) });
const paragraph = (...spans: unknown[]) => ({
  format: 'rich_text.v1',
  blocks: [{ type: 'paragraph', spans }],
});

/** The stored Body AST as the draft detail read serves it. */
const storedBody = async (
  client: S10Client,
  entryId: string,
): Promise<unknown> => {
  const detail = await client.get(`${ENTRIES_API}/${entryId}`);
  expect(detail.status, detail.text).toBe(200);
  const field = (
    detail.body.fields as readonly { fieldId: string; value: unknown }[]
  ).find((candidate) => candidate.fieldId === world.fields.body);
  return field?.value ?? null;
};

/** Autosave persists the canonical AST: poll the database until it equals `expected`. */
const expectStored = async (
  client: S10Client,
  entryId: string,
  expected: unknown,
): Promise<void> => {
  await expect
    .poll(() => storedBody(client, entryId), {
      message: 'autosave persists the canonical rich_text.v1 AST',
      timeout: 45_000,
      intervals: [500, 1_000, 2_000],
    })
    .toEqual(expected);
};

const bodyEditor = (page: Page): Locator =>
  page.getByRole('group', { name: 'Body' });
const toolbar = (page: Page): Locator =>
  bodyEditor(page).getByRole('toolbar', { name: 'Text formatting' });
const markButton = (page: Page, name: string): Locator =>
  toolbar(page).getByRole('button', { name, exact: true });
const blockText = (page: Page): Locator =>
  bodyEditor(page).getByLabel('Block text');
const preview = (page: Page): Locator =>
  page.getByRole('region', { name: 'Body preview' });
const linkForm = (page: Page): Locator =>
  toolbar(page).getByRole('group', { name: 'Link' });

/** The characters currently selected in the Body textarea. */
const selectedText = (page: Page): Promise<string> =>
  blockText(page).evaluate((node) => {
    const area = node as HTMLTextAreaElement;
    return area.value.slice(area.selectionStart, area.selectionEnd);
  });

/** Reach the Body textarea with Tab alone, from the top of the page. */
const tabToBlockText = (page: Page): Promise<void> =>
  tabTo(page, /^textarea:Block text/u);

/** Operate a toolbar control with the keyboard: Shift+Tab to it, then one key. */
const press = async (
  page: Page,
  name: string,
  key: 'Enter' | 'Space',
): Promise<void> => {
  await tabTo(page, new RegExp(`^button:${name}$`, 'u'), 12, 'backward');
  await page.keyboard.press(key);
};

/** Count `submit` events of the editor form: Enter in the link field must add none. */
const watchFormSubmits = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const form = document.querySelector(
      'form[data-cms-editorial-entry-editor]',
    ) as HTMLFormElement;
    const holder = window as unknown as { __submits: number };
    holder.__submits = 0;
    form.addEventListener(
      'submit',
      () => {
        holder.__submits += 1;
      },
      true,
    );
  });
const formSubmits = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __submits: number }).__submits);

const openEditor = async (
  browser: Parameters<typeof signIn>[0],
  label: string,
) => {
  const author = provisionAuthor(world, label);
  const signed = await signIn(browser, world, author);
  const entry = await seedEntry(signed.client, world, 'Toolbar entry');
  await gotoHydrated(signed.page, `${ENTRIES_PATH}/${entry.entryId}`);
  return { ...signed, entry };
};

test.describe('Phase 2 Slice 10 rich-text toolbar real route', () => {
  test('Bold, Italic and Code toggle from the keyboard, aria-pressed follows the selection, focus returns to the same text, and autosave stores the canonical AST', async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const { page, client, entry, browserErrors } = await openEditor(
      browser,
      'toolbar-marks',
    );

    await tabToBlockText(page);
    await page.keyboard.type('one two three four');
    // Select "two" with the keyboard: Home, four Right, three Shift+Right.
    await page.keyboard.press('Home');
    for (let step = 0; step < 4; step += 1)
      await page.keyboard.press('ArrowRight');
    for (let step = 0; step < 3; step += 1)
      await page.keyboard.press('Shift+ArrowRight');
    expect(await selectedText(page)).toBe('two');

    // The toolbar is a named landmark of native buttons, none pressed yet.
    await expect(toolbar(page)).toBeVisible();
    for (const name of ['Bold', 'Italic', 'Code', 'Link'])
      await expect(markButton(page, name)).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    await expectNoSeriousAxeFindings(page, 'rich-text toolbar');

    // Bold with Space: pressed, focus back on the text, the same text selected.
    await press(page, 'Bold', 'Space');
    await expect(markButton(page, 'Bold')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(blockText(page)).toBeFocused();
    expect(await selectedText(page)).toBe('two');
    await expect(preview(page).locator('strong')).toHaveText('two');

    // Italic with Enter on the same selection.
    await press(page, 'Italic', 'Enter');
    await expect(markButton(page, 'Italic')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(blockText(page)).toBeFocused();
    expect(await selectedText(page)).toBe('two');

    // Code with Space; the three marks are on the one word.
    await press(page, 'Code', 'Space');
    await expect(markButton(page, 'Code')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(preview(page).locator('code')).toHaveText('two');
    await expect(preview(page).locator('em')).toHaveText('two');
    expect(await selectedText(page)).toBe('two');

    // Toggling Bold again takes only Bold off.
    await press(page, 'Bold', 'Enter');
    await expect(markButton(page, 'Bold')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(markButton(page, 'Italic')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(preview(page).locator('strong')).toHaveCount(0);

    // A second selection, "four", takes Code alone.
    await page.keyboard.press('End');
    for (let step = 0; step < 4; step += 1)
      await page.keyboard.press('Shift+ArrowLeft');
    expect(await selectedText(page)).toBe('four');
    await press(page, 'Code', 'Enter');
    await expect(markButton(page, 'Code')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(markButton(page, 'Bold')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(await selectedText(page)).toBe('four');

    // Autosave (no Save click) stores the canonical AST: marks in the fixed
    // bold, italic, code order, equal neighbours merged, no markup characters.
    await expectStored(
      client,
      entry.entryId,
      paragraph(
        span('one '),
        span('two', ['italic', 'code']),
        span(' three '),
        span('four', ['code']),
      ),
    );
    await expect(blockText(page)).toBeFocused();
    await expect(page.getByRole('status').first()).toContainText(
      'All changes saved.',
    );
    expect(browserErrors, 'no script or hydration errors').toEqual([]);
  });

  test('a collapsed selection formats nothing and links nothing, and says so', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const { page, client, entry } = await openEditor(
      browser,
      'toolbar-empty-selection',
    );
    await tabToBlockText(page);
    await page.keyboard.type('plain text');
    // The caret sits at the end with nothing selected.
    expect(await selectedText(page)).toBe('');
    await press(page, 'Bold', 'Enter');
    await expect(
      toolbar(page).getByText('Select the text to format first.'),
    ).toBeVisible();
    await expect(markButton(page, 'Bold')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(preview(page).locator('strong')).toHaveCount(0);

    // Focus stayed on Bold (nothing changed); Link is the third control after it.
    await tabTo(page, /^button:Link$/u, 6);
    await page.keyboard.press('Enter');
    await expect(
      toolbar(page).getByText('Select the text to link first.'),
    ).toBeVisible();
    await expect(linkForm(page)).toHaveCount(0);
    await expectStored(client, entry.entryId, paragraph(span('plain text')));
  });

  test('Link inserts an https address, refuses javascript:, data:, protocol-relative and plain-http addresses inline, edits, cancels with Escape and removes - all from the keyboard, Enter never submits the form', async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const { page, client, entry, browserErrors } = await openEditor(
      browser,
      'toolbar-links',
    );
    await tabToBlockText(page);
    await page.keyboard.type('visit site now');
    await page.keyboard.press('Home');
    for (let step = 0; step < 6; step += 1)
      await page.keyboard.press('ArrowRight');
    for (let step = 0; step < 4; step += 1)
      await page.keyboard.press('Shift+ArrowRight');
    expect(await selectedText(page)).toBe('site');
    await watchFormSubmits(page);

    // Open the inline address field: it takes focus and is labelled.
    await expect(markButton(page, 'Link')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await press(page, 'Link', 'Enter');
    await expect(linkForm(page)).toBeVisible();
    expect(await focusedName(page)).toBe('input:Link address');
    await expectNoSeriousAxeFindings(page, 'link address field');

    // Unsafe addresses are refused inline, named, and change nothing; the field
    // keeps focus and the surrounding form is never submitted by Enter.
    const address = linkForm(page).getByLabel('Link address');
    for (const unsafe of [
      'javascript:alert(1)',
      'data:text/html,<b>x</b>',
      '//evil.example/x',
      'http://plain.example/',
    ]) {
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type(unsafe);
      await page.keyboard.press('Enter');
      await expect(
        linkForm(page).getByRole('alert'),
        `${unsafe} is refused`,
      ).toContainText('That link is not allowed.');
      await expect(address).toHaveAttribute('aria-invalid', 'true');
      await expect(address).toBeFocused();
      await expect(preview(page).locator('a')).toHaveCount(0);
    }
    // Editing the address clears the refusal.
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('https://example.com/page');
    await expect(linkForm(page).getByRole('alert')).toHaveCount(0);
    await page.keyboard.press('Enter');

    // Accepted: the field closes, focus returns to the same selected text, Link
    // reads as pressed, and the preview shows a safe anchor.
    await expect(linkForm(page)).toHaveCount(0);
    await expect(blockText(page)).toBeFocused();
    expect(await selectedText(page)).toBe('site');
    await expect(markButton(page, 'Link')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const anchor = preview(page).getByRole('link', { name: 'site' });
    await expect(anchor).toHaveAttribute('href', 'https://example.com/page');
    await expect(anchor).toHaveAttribute('rel', /noopener/u);
    await expect(anchor).toHaveAttribute('rel', /noreferrer/u);
    expect(await formSubmits(page)).toBe(0);
    await expectStored(
      client,
      entry.entryId,
      paragraph(
        span('visit '),
        span('site', [], { kind: 'https', href: 'https://example.com/page' }),
        span(' now'),
      ),
    );

    // Edit: the field is prefilled with the current address; a mailto: address
    // and then an in-app path replace it.
    await press(page, 'Link', 'Enter');
    await expect(address).toHaveValue('https://example.com/page');
    await expect(
      linkForm(page).getByRole('button', { name: 'Remove link' }),
    ).toBeVisible();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('mailto:me@example.com');
    await page.keyboard.press('Enter');
    await expect(linkForm(page)).toHaveCount(0);
    await expect(
      preview(page).getByRole('link', { name: 'site' }),
    ).toHaveAttribute('href', 'mailto:me@example.com');
    expect(await selectedText(page)).toBe('site');
    await press(page, 'Link', 'Enter');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('/app/cms-content-modeling/entries');
    await page.keyboard.press('Enter');
    await expect(
      preview(page).getByRole('link', { name: 'site' }),
    ).toHaveAttribute('href', '/app/cms-content-modeling/entries');
    await expectStored(
      client,
      entry.entryId,
      paragraph(
        span('visit '),
        span('site', [], {
          kind: 'internal',
          route: '/app/cms-content-modeling/entries',
        }),
        span(' now'),
      ),
    );

    // Escape closes the field without a change and returns focus to Link.
    await press(page, 'Link', 'Enter');
    await expect(address).toBeFocused();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('https://never-applied.example/');
    await page.keyboard.press('Escape');
    await expect(linkForm(page)).toHaveCount(0);
    await expect(markButton(page, 'Link')).toBeFocused();
    await expect(
      preview(page).getByRole('link', { name: 'site' }),
    ).toHaveAttribute('href', '/app/cms-content-modeling/entries');

    // Remove link: Tab inside the field to the button, Enter; the text stays.
    await page.keyboard.press('Enter');
    await tabTo(page, /^button:Remove link/u);
    await page.keyboard.press('Enter');
    await expect(linkForm(page)).toHaveCount(0);
    await expect(blockText(page)).toBeFocused();
    expect(await selectedText(page)).toBe('site');
    await expect(markButton(page, 'Link')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(preview(page).locator('a')).toHaveCount(0);
    await expectStored(
      client,
      entry.entryId,
      paragraph(span('visit site now')),
    );

    // No Enter in any of that submitted the editor form ...
    expect(await formSubmits(page)).toBe(0);
    // ... and the counter is live: Enter in the Title field (implicit
    // submission) is the one control that does submit it.
    await tabTo(page, /^input:Title/u, 30, 'backward');
    await page.keyboard.press('Enter');
    expect(await formSubmits(page)).toBe(1);
    expect(browserErrors, 'no script or hydration errors').toEqual([]);
  });

  test('an empty address is refused inline and a link needs a selection', async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const { page } = await openEditor(browser, 'toolbar-empty-address');
    await tabToBlockText(page);
    await page.keyboard.type('select me');
    await page.keyboard.press('Home');
    for (let step = 0; step < 6; step += 1)
      await page.keyboard.press('Shift+ArrowRight');
    expect(await selectedText(page)).toBe('select');
    await press(page, 'Link', 'Enter');
    await expect(linkForm(page)).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(linkForm(page).getByRole('alert')).toContainText(
      'Enter a link address.',
    );
    await expect(linkForm(page).getByLabel('Link address')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(markButton(page, 'Link')).toBeFocused();
    await expect(preview(page).locator('a')).toHaveCount(0);
  });
});
