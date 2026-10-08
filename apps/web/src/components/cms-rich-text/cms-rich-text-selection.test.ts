import { describe, expect, it } from 'vitest';

import { parseInlineMarkup, serializeSpans } from './cms-rich-text-markup';
import {
  formatAtSelection,
  setLinkInMarkup,
  toggleMarkInMarkup,
} from './cms-rich-text-selection';
import {
  jcs,
  randomSpans,
  seeded,
} from './cms-rich-text-roundtrip.test-support';

/**
 * AC-086: the constrained editor exposes semantic MARK and LINK controls. They act on the
 * author's selection in the block's markup, but through the canonical spans, never by splicing
 * marker characters: the selection is mapped to text offsets, the marks or link are applied to
 * exactly that text range, and the block is serialized back to the lossless markup. So a control
 * can never produce markup the parser reads differently, and it never changes the text.
 */

const textOf = (markup: string): string => {
  const parsed = parseInlineMarkup(markup);
  if (!parsed.ok) throw new Error(markup);
  return parsed.spans.map((span) => span.text).join('');
};

describe('toggleMarkInMarkup', () => {
  it('turns a mark on for exactly the selected text, and the selection follows the text', () => {
    const result = toggleMarkInMarkup(
      'plain text',
      { start: 6, end: 10 },
      'bold',
    );
    expect(result).toEqual({
      ok: true,
      markup: 'plain **text**',
      selection: { start: 8, end: 12 },
    });
  });

  it('turns it off again when every selected character has it', () => {
    const result = toggleMarkInMarkup(
      'plain **text**',
      { start: 8, end: 12 },
      'bold',
    );
    expect(result).toEqual({
      ok: true,
      markup: 'plain text',
      selection: { start: 6, end: 10 },
    });
  });

  it('turns it on for the whole selection when only part of it has the mark', () => {
    const result = toggleMarkInMarkup('**ab**cd', { start: 3, end: 7 }, 'bold');
    expect(result).toMatchObject({ ok: true, markup: '**abc**d' });
  });

  it('leaves the other marks of the text alone and keeps the canonical mark order', () => {
    const result = toggleMarkInMarkup('_it_', { start: 1, end: 3 }, 'bold');
    expect(result).toMatchObject({ ok: true });
    const parsed = parseInlineMarkup(result.ok ? result.markup : '');
    expect(parsed).toEqual({
      ok: true,
      spans: [{ text: 'it', marks: ['bold', 'italic'] }],
    });
  });

  it('works on text that holds literal markup characters', () => {
    const result = toggleMarkInMarkup(
      'snake\\_case',
      { start: 7, end: 11 },
      'bold',
    );
    expect(result).toMatchObject({ ok: true, markup: 'snake\\_**case**' });
  });

  it('keeps a link when its text is formatted', () => {
    const markup = '[site](https://example.com/)';
    const result = toggleMarkInMarkup(markup, { start: 1, end: 5 }, 'italic');
    expect(result.ok && parseInlineMarkup(result.markup)).toEqual({
      ok: true,
      spans: [
        {
          text: 'site',
          marks: ['italic'],
          link: { kind: 'https', href: 'https://example.com/' },
        },
      ],
    });
  });

  it('refuses an empty selection with a typed reason and changes nothing', () => {
    expect(toggleMarkInMarkup('text', { start: 2, end: 2 }, 'bold')).toEqual({
      ok: false,
      error: { code: 'rich_text_selection_empty', detail: null },
    });
  });

  it('refuses markup that is not canonical', () => {
    expect(
      toggleMarkInMarkup('oops [[', { start: 0, end: 3 }, 'bold'),
    ).toMatchObject({
      ok: false,
      error: { code: 'rich_text_not_canonical' },
    });
  });
});

describe('setLinkInMarkup', () => {
  it('links the selected text with a https address', () => {
    const result = setLinkInMarkup(
      'read the docs now',
      { start: 9, end: 13 },
      'https://example.com/docs',
    );
    expect(result).toMatchObject({
      ok: true,
      markup: 'read the [docs](https://example.com/docs) now',
    });
  });

  it('accepts a mailto address and a safe internal route', () => {
    expect(
      setLinkInMarkup(
        'mail us',
        { start: 0, end: 4 },
        'mailto:team@example.com',
      ),
    ).toMatchObject({ ok: true, markup: '[mail](mailto:team@example.com) us' });
    expect(
      setLinkInMarkup('home', { start: 0, end: 4 }, '/app/home'),
    ).toMatchObject({
      ok: true,
      markup: '[home](/app/home)',
    });
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    '//evil.example',
    'http://insecure.example',
    'https://',
    'mailto:nobody',
  ])('refuses the unsafe address %s and names it', (href) => {
    expect(setLinkInMarkup('text', { start: 0, end: 4 }, href)).toEqual({
      ok: false,
      error: { code: 'rich_text_unsafe_link', detail: href },
    });
  });

  it('refuses an empty address and an empty selection with their own reasons', () => {
    expect(setLinkInMarkup('text', { start: 0, end: 4 }, '  ')).toEqual({
      ok: false,
      error: { code: 'rich_text_link_empty', detail: null },
    });
    expect(
      setLinkInMarkup('text', { start: 1, end: 1 }, 'https://example.com/'),
    ).toEqual({
      ok: false,
      error: { code: 'rich_text_selection_empty', detail: null },
    });
  });

  it('replaces the address of an existing link', () => {
    const result = setLinkInMarkup(
      '[docs](https://example.com/old)',
      { start: 1, end: 5 },
      'https://example.com/new',
    );
    expect(result).toMatchObject({
      ok: true,
      markup: '[docs](https://example.com/new)',
    });
  });

  it('removes a link and keeps its text and marks', () => {
    const result = setLinkInMarkup(
      '**[docs](https://example.com/)**',
      { start: 3, end: 7 },
      null,
    );
    expect(result).toMatchObject({ ok: true, markup: '**docs**' });
  });

  it('links only the selected part of a longer span', () => {
    const result = setLinkInMarkup(
      '**bold text**',
      { start: 2, end: 6 },
      'https://example.com/',
    );
    expect(result.ok && parseInlineMarkup(result.markup)).toEqual({
      ok: true,
      spans: [
        {
          text: 'bold',
          marks: ['bold'],
          link: { kind: 'https', href: 'https://example.com/' },
        },
        { text: ' text', marks: ['bold'] },
      ],
    });
  });
});

describe('formatAtSelection', () => {
  it('reports the marks every selected character has and the link they share', () => {
    expect(formatAtSelection('plain **bold**', { start: 8, end: 12 })).toEqual({
      marks: ['bold'],
      link: null,
    });
    expect(formatAtSelection('plain **bold**', { start: 2, end: 10 })).toEqual({
      marks: [],
      link: null,
    });
    expect(
      formatAtSelection('[site](https://example.com/)', { start: 1, end: 5 }),
    ).toEqual({
      marks: [],
      link: { kind: 'https', href: 'https://example.com/' },
    });
  });

  it('describes the character at the caret when nothing is selected', () => {
    expect(formatAtSelection('**bold** plain', { start: 4, end: 4 })).toEqual({
      marks: ['bold'],
      link: null,
    });
  });

  it('reads markup that is not canonical as having no format', () => {
    expect(formatAtSelection('oops [[', { start: 0, end: 3 })).toEqual({
      marks: [],
      link: null,
    });
  });
});

describe('the controls never change the text and always leave canonical markup', () => {
  it('holds for 300 seeded random blocks, selections and operations', () => {
    const random = seeded(0xf0a4);
    let applied = 0;
    for (let round = 0; round < 600 && applied < 300; round += 1) {
      const spans = randomSpans(random, undefined, 4);
      if (spans.length === 0) continue;
      const markup = serializeSpans(spans);
      const total = spans.reduce((sum, span) => sum + span.text.length, 0);
      const a = Math.floor(random() * (total + 1));
      const b = Math.floor(random() * (total + 1));
      // Selection offsets are markup offsets; probe the whole markup length.
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      const mark = (['bold', 'italic', 'code'] as const)[
        Math.floor(random() * 3)
      ]!;
      const result = toggleMarkInMarkup(markup, { start, end }, mark);
      if (!result.ok) continue;
      applied += 1;
      const reparsed = parseInlineMarkup(result.markup);
      expect(reparsed.ok, markup).toBe(true);
      if (!reparsed.ok) continue;
      expect(reparsed.spans.map((s) => s.text).join(''), markup).toBe(
        textOf(markup),
      );
      expect(serializeSpans(reparsed.spans), markup).toBe(result.markup);
      expect(
        jcs(parseInlineMarkup(serializeSpans(reparsed.spans))),
        markup,
      ).toBe(jcs(reparsed));
      // A second toggle of the same mark over the same text is the inverse or a full add.
      const again = toggleMarkInMarkup(result.markup, result.selection, mark);
      expect(again.ok, markup).toBe(true);
    }
    expect(applied).toBeGreaterThan(100);
  });
});

/**
 * Codex final review (s10-final-4): every link, https included, goes through the SHARED link
 * schema, so the toolbar and the markup parser can never admit an address that validation or
 * PostgreSQL later refuses (more than 2048 characters, DEL or C1 control characters).
 */
describe('link admission is the shared schema, https included', () => {
  const tooLong = 'https://example.com/' + 'a'.repeat(2048);
  const del = 'https://example.com/a\u007fb';
  const c1 = 'https://example.com/a\u0085b';

  it.each([
    ['longer than 2048 characters', tooLong],
    ['containing DEL', del],
    ['containing a C1 control', c1],
  ])('the toolbar refuses a https address %s', (_name, href) => {
    expect(setLinkInMarkup('text', { start: 0, end: 4 }, href)).toEqual({
      ok: false,
      error: { code: 'rich_text_unsafe_link', detail: href },
    });
  });

  it.each([
    ['longer than 2048 characters', tooLong],
    ['containing DEL', del],
    ['containing a C1 control', c1],
  ])('the markup parser refuses a https destination %s', (_name, href) => {
    expect(parseInlineMarkup(`[x](${href})`)).toMatchObject({
      ok: false,
      error: { code: 'rich_text_unsafe_link' },
    });
  });

  it('still admits a https address at exactly 2048 characters', () => {
    const exact = 'https://example.com/' + 'a'.repeat(2048 - 20);
    expect(exact).toHaveLength(2048);
    expect(setLinkInMarkup('text', { start: 0, end: 4 }, exact)).toMatchObject({
      ok: true,
    });
  });
});

/**
 * Codex final review (s10-final-4, LOW): a selection that cuts an astral character in half (a
 * programmatic or IME selection between the surrogate halves) is widened to the whole character, so
 * the rebuilt text never holds a lone surrogate.
 */
describe('a selection never splits an astral character', () => {
  const hasLoneSurrogate = (text: string): boolean => /\p{Cs}/u.test(text);

  it('widens a selection that starts between the halves', () => {
    // markup '\u{1F600}x': the emoji is UTF-16 units 0-1, x is unit 2.
    const result = toggleMarkInMarkup(
      '\u{1F600}x',
      { start: 1, end: 3 },
      'bold',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hasLoneSurrogate(result.markup)).toBe(false);
    expect(result.markup).toBe('**\u{1F600}x**');
  });

  it('widens a selection that ends between the halves', () => {
    const result = toggleMarkInMarkup(
      'a\u{1F600}',
      { start: 0, end: 2 },
      'italic',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(hasLoneSurrogate(result.markup)).toBe(false);
    expect(textOf(result.markup)).toBe('a\u{1F600}');
    expect(result.markup).toBe('_a\u{1F600}_');
  });

  it('keeps a link on a whole astral character', () => {
    const result = setLinkInMarkup(
      'a\u{1F600}b',
      { start: 2, end: 2 + 1 },
      'https://example.com/',
    );
    expect(result.ok && hasLoneSurrogate(result.markup)).toBe(false);
  });

  it('holds for random selections over astral text', () => {
    for (let start = 0; start <= 6; start += 1)
      for (let end = start + 1; end <= 6; end += 1) {
        const result = toggleMarkInMarkup(
          '\u{1F600}a\u{1F680}b',
          { start, end },
          'bold',
        );
        if (!result.ok) continue;
        expect(hasLoneSurrogate(result.markup), `${start}-${end}`).toBe(false);
        expect(textOf(result.markup)).toBe('\u{1F600}a\u{1F680}b');
      }
  });
});
