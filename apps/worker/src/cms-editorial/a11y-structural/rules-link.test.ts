import { describe, expect, it } from 'vitest';

import {
  fieldIdOf,
  heading,
  httpsLink,
  paragraph,
  parsedField,
  span,
  type TestLink,
} from './a11y-structural.test-support';
import { createFindingCollector } from './findings';
import { createLinkRule } from './rules-link';
import type { ParsedField } from './rules-structure';

/** Link rules (BE05c): empty, generic, is-URL and the unchecked-language warning. */

const linkFindings = (locale: string, ...fields: ParsedField[]) => {
  const collector = createFindingCollector();
  const rule = createLinkRule(collector, locale);
  for (const field of fields) rule.evaluate(field);
  rule.finish();
  return collector.result().findings.map((finding) => ({
    ruleId: finding.ruleId,
    pointer: finding.location.pointer,
  }));
};

const at = (seed: number, block: number, spanIndex: number): string =>
  `/fields/${fieldIdOf(seed)}/blocks/${block}/spans/${spanIndex}`;

const only = (text: string, link: TestLink = httpsLink()): ParsedField =>
  parsedField(1, 0, paragraph(span(text, link)));

describe('link.text_empty', () => {
  it.each([' ', ' ', '  \n '])('flags a link whose text is %j', (text) => {
    expect(linkFindings('en', only(text))).toEqual([
      { ruleId: 'link.text_empty', pointer: at(1, 0, 0) },
    ]);
  });

  it('is reported even when the language has no generic list', () => {
    expect(linkFindings('de', only(' '))).toEqual([
      { ruleId: 'link.text_empty', pointer: at(1, 0, 0) },
      { ruleId: 'link.text_unchecked_language', pointer: at(1, 0, 0) },
    ]);
  });

  it('flags a link only when all of its spans are whitespace, once, at its first span', () => {
    const link = httpsLink();
    const field = parsedField(
      1,
      0,
      paragraph(span(' ', link, ['bold']), span(' ', link, ['italic'])),
    );
    expect(linkFindings('en', field)).toEqual([
      { ruleId: 'link.text_empty', pointer: at(1, 0, 0) },
    ]);
  });
});

describe('link grouping: adjacent spans with the same target are one link', () => {
  const link = httpsLink('https://example.org/a');

  it('reads the text of the whole link, not of a single span', () => {
    const field = parsedField(
      1,
      0,
      paragraph(span(' ', link, ['bold']), span('Guide', link, ['italic'])),
    );
    expect(linkFindings('en', field)).toEqual([]);
  });

  it('judges "More" + "about jamming" as one link, so it is not generic', () => {
    const field = parsedField(
      1,
      0,
      paragraph(span('More', link, ['bold']), span(' about jamming', link)),
    );
    expect(linkFindings('en', field)).toEqual([]);
  });

  it('flags "Click" + " here" as one generic link at its first span', () => {
    const field = parsedField(
      1,
      0,
      paragraph(span('Click', link, ['bold']), span(' here', link)),
    );
    expect(linkFindings('en', field)).toEqual([
      { ruleId: 'link.text_generic', pointer: at(1, 0, 0) },
    ]);
  });

  it('keeps links with different targets, or separated by other text, apart', () => {
    const other = httpsLink('https://example.org/b');
    const adjacent = parsedField(
      1,
      0,
      paragraph(span('Click', link, ['bold']), span('here', other)),
    );
    expect(linkFindings('en', adjacent)).toEqual([
      { ruleId: 'link.text_generic', pointer: at(1, 0, 0) },
      { ruleId: 'link.text_generic', pointer: at(1, 0, 1) },
    ]);
    const separated = parsedField(
      1,
      0,
      paragraph(
        span('Click', link),
        span(' and ', undefined, ['bold']),
        span('here', link),
      ),
    );
    expect(linkFindings('en', separated)).toEqual([
      { ruleId: 'link.text_generic', pointer: at(1, 0, 0) },
      { ruleId: 'link.text_generic', pointer: at(1, 0, 2) },
    ]);
  });

  it('splits adjacent links of different kinds', () => {
    const field = parsedField(
      1,
      0,
      paragraph(
        span('Click', { kind: 'internal', route: '/same' }, ['bold']),
        span('here', { kind: 'https', href: 'https://same.example/' }),
      ),
    );
    expect(linkFindings('en', field)).toHaveLength(2);
  });
});

describe('link.text_generic (en list, normalized)', () => {
  it.each([
    'click here',
    'click',
    'here',
    'more',
    'read more',
    'learn more',
    'link',
    'this link',
    'this page',
    'tap here',
  ])('flags the listed phrase "%s"', (phrase) => {
    expect(linkFindings('en', only(phrase))).toEqual([
      { ruleId: 'link.text_generic', pointer: at(1, 0, 0) },
    ]);
  });

  it.each([
    'Click HERE!',
    '  read   more… ',
    'LINK',
    'This Page.',
    'Tap here',
    'ＣＬＩＣＫ',
    'Learn more »',
  ])('flags the variant %j after normalization', (text) => {
    expect(linkFindings('en-US', only(text)).map((f) => f.ruleId)).toEqual([
      'link.text_generic',
    ]);
  });

  it.each([
    'Click here for the guide',
    'More about jamming',
    'Read the policy',
    'Links',
    'Open the schedule',
  ])('does not flag the descriptive text %j', (text) => {
    expect(linkFindings('en', only(text))).toEqual([]);
  });

  it('does not judge text that is not a link', () => {
    expect(
      linkFindings('en', parsedField(1, 0, paragraph(span('click here')))),
    ).toEqual([]);
  });

  it('judges links in headings and other block types too', () => {
    const field = parsedField(
      1,
      0,
      heading(2, span('here', httpsLink())),
      { type: 'quote', spans: [span('more', httpsLink())] },
      {
        type: 'list_item',
        list: 'bulleted',
        depth: 1,
        spans: [span('link', httpsLink())],
      },
    );
    expect(linkFindings('en', field)).toEqual([
      { ruleId: 'link.text_generic', pointer: at(1, 0, 0) },
      { ruleId: 'link.text_generic', pointer: at(1, 1, 0) },
      { ruleId: 'link.text_generic', pointer: at(1, 2, 0) },
    ]);
  });
});

describe('link.text_is_url (warning)', () => {
  const https = httpsLink('https://example.org/guide');
  const mailto: TestLink = { kind: 'mailto', address: 'band@example.org' };
  const internal: TestLink = { kind: 'internal', route: '/pricing' };

  it.each([
    ['https text equal to its href', 'https://example.org/guide', https],
    [
      'the same in other case and padding',
      '  HTTPS://Example.org/Guide ',
      https,
    ],
    ['an https prefix on another address', 'https://elsewhere.example/', https],
    ['a mailto prefix on any link', 'mailto:someone@example.org', https],
    ['the bare mailto address', 'band@example.org', mailto],
    ['the mailto address with its prefix', 'mailto:band@example.org', mailto],
    ['an internal route', '/pricing', internal],
  ])('flags %s', (_name, text, link) => {
    expect(linkFindings('en', only(text, link))).toEqual([
      { ruleId: 'link.text_is_url', pointer: at(1, 0, 0) },
    ]);
  });

  it.each([
    ['a descriptive text', 'Guide', https],
    ['a host name without a scheme', 'example.org/guide', https],
    ['a plain http prefix', 'http://example.org/guide', https],
    ['a different internal route', '/other', internal],
    ['a bare address on an https link', 'band@example.org', https],
  ])('does not flag %s', (_name, text, link) => {
    expect(linkFindings('en', only(text, link))).toEqual([]);
  });

  it('is evaluated in a language without a list, next to the language warning', () => {
    expect(linkFindings('de', only('https://example.org/guide'))).toEqual([
      { ruleId: 'link.text_is_url', pointer: at(1, 0, 0) },
      { ruleId: 'link.text_unchecked_language', pointer: at(1, 0, 0) },
    ]);
  });
});

describe('link.text_unchecked_language (warning)', () => {
  it.each(['de', 'de-AT', 'fr-CA', 'ja'])(
    'warns once for %s with a link',
    (locale) => {
      const first = parsedField(1, 0, paragraph(span('Guide', httpsLink())));
      const second = parsedField(
        2,
        1,
        paragraph(
          span('Other', httpsLink('https://example.org/b')),
          span(' x'),
          span('Third', httpsLink()),
        ),
      );
      expect(linkFindings(locale, first, second)).toEqual([
        { ruleId: 'link.text_unchecked_language', pointer: at(1, 0, 0) },
      ]);
    },
  );

  it('does not evaluate the generic list for such a language', () => {
    expect(linkFindings('de', only('click here')).map((f) => f.ruleId)).toEqual(
      ['link.text_unchecked_language'],
    );
  });

  it('is silent without any link', () => {
    expect(
      linkFindings('de', parsedField(1, 0, paragraph(span('Text')))),
    ).toEqual([]);
    expect(linkFindings('de')).toEqual([]);
  });

  it.each(['en', 'en-US', 'EN-gb'])(
    'is silent for %s, which has a list',
    (locale) => {
      expect(linkFindings(locale, only('Guide'))).toEqual([]);
    },
  );
});
