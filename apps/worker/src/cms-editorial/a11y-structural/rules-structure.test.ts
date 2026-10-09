import { describe, expect, it } from 'vitest';

import {
  blockNode,
  fieldIdOf,
  fieldNode,
  heading,
  paragraph,
  richText,
  span,
} from './a11y-structural.test-support';
import { createFindingCollector } from './findings';
import { evaluateStructure } from './rules-structure';

/**
 * structure.rich_text_invalid and structure.block_unregistered (BE05c):
 * the structure group runs first and decides which fields the heading and link
 * groups may read.
 */

const evaluate = (node: Parameters<typeof evaluateStructure>[0], index = 0) => {
  const collector = createFindingCollector();
  const parsed = evaluateStructure(node, index, collector);
  return { parsed, ...collector.result() };
};

describe('structure.rich_text_invalid', () => {
  it('yields the parsed field and no finding for a valid value', () => {
    const { parsed, findings } = evaluate(
      fieldNode(
        7,
        richText(heading(2, span('Title')), paragraph(span('Body'))),
      ),
      4,
    );
    expect(findings).toEqual([]);
    expect(parsed).toMatchObject({ nodeIndex: 4, fieldId: fieldIdOf(7) });
    expect(parsed?.document.blocks).toHaveLength(2);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'plain text'],
    ['an empty object', {}],
    ['an unknown format', { format: 'rich_text.v2', blocks: [paragraph()] }],
    ['no blocks', richText()],
    [
      'a level 1 heading',
      richText({ type: 'heading', level: 1, spans: [span('T')] }),
    ],
    ['an unknown block type', richText({ type: 'table', spans: [] })],
    ['an extra member', { ...richText(paragraph()), extra: true }],
    ['a span with a control character', richText(paragraph(span('a\u0007b')))],
    [
      'an unmerged adjacent span pair',
      richText(paragraph(span('a'), span('b'))),
    ],
  ])('reports %s once, at the field, and skips the field', (_name, value) => {
    const { parsed, findings, blockingCount } = evaluate(
      fieldNode(3, value),
      2,
    );
    expect(parsed).toBeNull();
    expect(blockingCount).toBe(1);
    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: 'structure.rich_text_invalid',
        severity: 'blocking',
        location: {
          kind: 'field',
          pointer: `/fields/${fieldIdOf(3)}`,
          fieldId: fieldIdOf(3),
          blockPath: null,
        },
      }),
    ]);
  });
});

describe('structure.block_unregistered', () => {
  it.each(['supported', 'deprecated'] as const)(
    'accepts a %s block',
    (lifecycle) => {
      const { parsed, findings } = evaluate(blockNode(1, { lifecycle }));
      expect(parsed).toBeNull();
      expect(findings).toEqual([]);
    },
  );

  it.each(['withdrawn', 'unregistered'] as const)(
    'reports a %s block at its composition pointer',
    (lifecycle) => {
      const { findings } = evaluate(
        blockNode(5, { lifecycle, pointer: '/composition/5/children/0' }),
        3,
      );
      expect(findings).toEqual([
        expect.objectContaining({
          ruleId: 'structure.block_unregistered',
          severity: 'blocking',
          location: {
            kind: 'block',
            pointer: '/composition/5/children/0',
            fieldId: null,
            blockPath: '/composition/5/children/0',
          },
        }),
      ]);
    },
  );
});
