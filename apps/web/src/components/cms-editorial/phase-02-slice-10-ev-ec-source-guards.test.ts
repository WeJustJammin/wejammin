import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Slice 10 evidence lane EC (P2-S10-AC-087, AC-099). Two structural guarantees that
 * are about what the source CANNOT do, so they read the source: the typed rich-text
 * renderer has no raw-HTML escape hatch, and the server-first entry list holds no
 * client state, effect or request that could add an optimistic row. (The behaviour
 * of both is proven in the sibling jsdom suites.)
 */

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Source with block and line comments removed, so prose cannot satisfy or trip a rule. */
const code = (relative: string): string =>
  read(relative)
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/^\s*\/\/.*$/gmu, '');

describe('EC-087 the typed rich-text renderer has no raw-HTML escape hatch', () => {
  const renderer = code('../cms-rich-text/CmsRichTextRenderer.tsx');

  it('never sets inner HTML in any form', () => {
    expect(renderer).not.toMatch(/dangerouslySetInnerHTML/u);
    expect(renderer).not.toMatch(
      /\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write|set:html/u,
    );
  });

  it('only parses a document through the shared canonical schema before it builds an element', () => {
    expect(renderer).toMatch(/RichTextV1DocumentSchema\.safeParse\(value\)/u);
    expect(renderer).toMatch(/role="note"/u);
  });
});

describe('EC-099 the server-first entry list holds no client behaviour', () => {
  const list = code('./CmsEditorialEntryList.tsx');

  it('has no state, effect, optimistic hook, request or storage', () => {
    expect(list).not.toMatch(
      /\buse(State|Effect|LayoutEffect|Optimistic|Reducer|Transition|SyncExternalStore)\b/u,
    );
    expect(list).not.toMatch(
      /\bfetch\(|XMLHttpRequest|addEventListener|localStorage|sessionStorage/u,
    );
  });

  it('posts nothing: its only form is a native GET filter', () => {
    expect(list).toMatch(/method="get"/u);
    expect(list).not.toMatch(/method="post"/iu);
    expect(list).not.toMatch(/\bonSubmit\b|\bonClick\b|\bonChange\b/u);
  });
});

describe('EC-081 the Astro create route hands the loaded projection to the island unchanged', () => {
  const page = read('../../pages/app/cms-content-modeling/entries/new.astro');
  const form = read('./CmsEditorialEntryCreateForm.astro');

  it('passes the loader view (types, selected type, fields) to the create form', () => {
    expect(page).toMatch(/loadEntryCreatePage/u);
    expect(page).toMatch(/types=\{outcome\.view\.types\}/u);
    expect(page).toMatch(/selected=\{outcome\.view\.selected\}/u);
    expect(page).toMatch(/fields=\{outcome\.view\.fields\}/u);
  });

  it('passes the selected type and the projected fields to the island, with no field of its own', () => {
    expect(form).toMatch(
      /<CmsEditorialEntryCreateIsland\s+type=\{selected\}\s+fields=\{fields\}\s+client:load/u,
    );
    expect(form).not.toMatch(
      /objectStructure|properties\.map|JSON\.stringify/u,
    );
  });
});
