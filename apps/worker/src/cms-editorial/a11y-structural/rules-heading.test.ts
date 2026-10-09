import { describe, expect, it } from 'vitest';

import {
  fieldIdOf,
  heading,
  paragraph,
  parsedField,
  span,
} from './a11y-structural.test-support';
import { createFindingCollector } from './findings';
import { createHeadingRule } from './rules-heading';
import type { ParsedField } from './rules-structure';

/** Heading rules (BE05c): empty, first level, level skipped, state across fields. */

const headingFindings = (...fields: ParsedField[]) => {
  const collector = createFindingCollector();
  const rule = createHeadingRule(collector);
  for (const field of fields) rule.evaluate(field);
  return collector.result().findings.map((finding) => ({
    ruleId: finding.ruleId,
    pointer: finding.location.pointer,
  }));
};

const at = (seed: number, blockIndex: number): string =>
  `/fields/${fieldIdOf(seed)}/blocks/${blockIndex}`;

describe('heading.empty', () => {
  it.each([
    ['a space', [span(' ')]],
    ['mixed whitespace', [span(' \u2003\n ')]],
    ['a no-break space', [span(' ')]],
    ['an ideographic space', [span('　')]],
    [
      'several whitespace-only spans',
      [span(' ', undefined, ['bold']), span('  ', undefined, ['italic'])],
    ],
  ])('flags a heading made of %s', (_name, spans) => {
    expect(headingFindings(parsedField(1, 0, heading(2, ...spans)))).toEqual([
      { ruleId: 'heading.empty', pointer: at(1, 0) },
    ]);
  });

  it.each([
    ['one visible character', [span('A')]],
    [
      'whitespace then text in a second span',
      [span(' ', undefined, ['bold']), span('x')],
    ],
    ['punctuation only', [span('?')]],
  ])('accepts a heading with %s', (_name, spans) => {
    expect(headingFindings(parsedField(1, 0, heading(2, ...spans)))).toEqual(
      [],
    );
  });

  it('addresses the heading block by index, in any block position', () => {
    const field = parsedField(
      4,
      2,
      paragraph(span('Intro')),
      heading(2, span('Fine')),
      heading(3, span('   ')),
    );
    expect(headingFindings(field)).toEqual([
      { ruleId: 'heading.empty', pointer: at(4, 2) },
    ]);
  });

  it('ignores whitespace-only paragraphs and quotes', () => {
    expect(
      headingFindings(
        parsedField(1, 0, paragraph(span(' ')), {
          type: 'quote',
          spans: [span(' ')],
        }),
      ),
    ).toEqual([]);
  });
});

describe('heading.first_level', () => {
  it.each([3, 4] as const)('flags a first heading at level %i', (level) => {
    expect(
      headingFindings(parsedField(1, 0, heading(level, span('T')))),
    ).toEqual([{ ruleId: 'heading.first_level', pointer: at(1, 0) }]);
  });

  it('accepts a first heading at level 2', () => {
    expect(headingFindings(parsedField(1, 0, heading(2, span('T'))))).toEqual(
      [],
    );
  });

  it('checks only the first heading in document order, across fields', () => {
    const lead = parsedField(1, 0, paragraph(span('No heading here')));
    const next = parsedField(
      2,
      1,
      paragraph(span('x')),
      heading(3, span('First')),
      heading(2, span('Then')),
    );
    expect(headingFindings(lead, next)).toEqual([
      { ruleId: 'heading.first_level', pointer: at(2, 1) },
    ]);
  });

  it('reports nothing for a document without headings', () => {
    expect(headingFindings(parsedField(1, 0, paragraph(span('Body'))))).toEqual(
      [],
    );
    expect(headingFindings()).toEqual([]);
  });

  it('also reports an empty heading that opens the document at the wrong level', () => {
    expect(headingFindings(parsedField(1, 0, heading(4, span(' '))))).toEqual([
      { ruleId: 'heading.empty', pointer: at(1, 0) },
      { ruleId: 'heading.first_level', pointer: at(1, 0) },
    ]);
  });
});

describe('heading.level_skipped', () => {
  it('flags a heading more than one level deeper than the previous one', () => {
    expect(
      headingFindings(
        parsedField(1, 0, heading(2, span('A')), heading(4, span('B'))),
      ),
    ).toEqual([{ ruleId: 'heading.level_skipped', pointer: at(1, 1) }]);
  });

  it('allows steps of one and any decrease', () => {
    expect(
      headingFindings(
        parsedField(
          1,
          0,
          heading(2, span('A')),
          heading(3, span('B')),
          heading(4, span('C')),
          heading(2, span('D')),
          heading(3, span('E')),
          heading(3, span('F')),
        ),
      ),
    ).toEqual([]);
  });

  it('compares with the previous heading, not the previous valid level', () => {
    expect(
      headingFindings(
        parsedField(
          1,
          0,
          heading(2, span('A')),
          heading(4, span('B')),
          heading(4, span('C')),
        ),
      ),
    ).toEqual([{ ruleId: 'heading.level_skipped', pointer: at(1, 1) }]);
  });

  it('carries the previous level across fields and over other blocks', () => {
    const first = parsedField(1, 0, heading(2, span('A')));
    const second = parsedField(
      2,
      1,
      paragraph(span('between')),
      heading(4, span('B')),
    );
    expect(headingFindings(first, second)).toEqual([
      { ruleId: 'heading.level_skipped', pointer: at(2, 1) },
    ]);
  });

  it('counts an empty heading as the previous heading', () => {
    expect(
      headingFindings(
        parsedField(1, 0, heading(2, span(' ')), heading(4, span('B'))),
      ),
    ).toEqual([
      { ruleId: 'heading.empty', pointer: at(1, 0) },
      { ruleId: 'heading.level_skipped', pointer: at(1, 1) },
    ]);
  });

  it('does not report a skip for the first heading (first_level covers it)', () => {
    expect(headingFindings(parsedField(1, 0, heading(4, span('A'))))).toEqual([
      { ruleId: 'heading.first_level', pointer: at(1, 0) },
    ]);
  });
});
