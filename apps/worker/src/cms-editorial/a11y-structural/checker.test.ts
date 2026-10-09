import { describe, expect, it } from 'vitest';

import {
  blockNode,
  checkerInput,
  fieldIdOf,
  fieldNode,
  heading,
  httpsLink,
  paragraph,
  richText,
  singleField,
  span,
} from './a11y-structural.test-support';
import { runAccessibilityChecker } from './checker';
import { accessibilityInputHash } from './hashes';

/** The checker end to end: states, rule groups, ordering and determinism. */

const run = async (input: Parameters<typeof runAccessibilityChecker>[0]) => {
  const result = await runAccessibilityChecker(input);
  if (result.state === 'stopped') throw new Error('unexpected stop');
  return result;
};

const summary = (
  findings: readonly { ruleId: string; location: { pointer: string } }[],
) => findings.map((finding) => `${finding.ruleId} ${finding.location.pointer}`);

const at = (seed: number, tail: string): string =>
  `/fields/${fieldIdOf(seed)}${tail}`;

describe('runAccessibilityChecker: run states', () => {
  it('is healthy with no findings for a clean revision', async () => {
    const input = checkerInput([
      fieldNode(
        1,
        richText(
          heading(2, span('Plan')),
          paragraph(
            span('Read the ', undefined),
            span('guide', httpsLink(), ['bold']),
          ),
        ),
      ),
      blockNode(1, { nameRequired: true, accessibleName: 'Main navigation' }),
    ]);
    expect(await run(input)).toEqual({
      checkerKey: 'cms.a11y.structural',
      checkerVersion: '1',
      state: 'healthy',
      findings: [],
      blockingCount: 0,
      warningCount: 0,
      truncated: false,
      inputHash: await accessibilityInputHash(input),
    });
  });

  it('is healthy when only warnings exist', async () => {
    const result = await run(
      singleField(
        heading(2, span('Plan')),
        paragraph(span('https://example.org/guide', httpsLink())),
      ),
    );
    expect(result).toMatchObject({
      state: 'healthy',
      blockingCount: 0,
      warningCount: 1,
    });
    expect(summary(result.findings)).toEqual([
      `link.text_is_url ${at(1, '/blocks/1/spans/0')}`,
    ]);
  });

  it('is blocked as soon as one blocking finding exists', async () => {
    const result = await run(singleField(heading(3, span('Plan'))));
    expect(result).toMatchObject({
      state: 'blocked',
      blockingCount: 1,
      warningCount: 0,
    });
  });

  it('is healthy for a revision with no nodes', async () => {
    expect(await run(checkerInput([]))).toMatchObject({
      state: 'healthy',
      findings: [],
    });
  });
});

describe('runAccessibilityChecker: rule groups and ordering', () => {
  it('reports every group, blocking first, then render order, ruleId and pointer', async () => {
    const input = checkerInput([
      fieldNode(
        1,
        richText(
          heading(3, span('Start')),
          paragraph(span('click here', httpsLink())),
          heading(2, span(' ')),
        ),
      ),
      fieldNode(2, 'not rich text'),
      blockNode(1, { nameRequired: true, accessibleName: null }),
      blockNode(2, { lifecycle: 'withdrawn', accessibleName: 'Dup' }),
      fieldNode(
        3,
        richText(
          heading(4, span('Deep')),
          paragraph(span('https://example.org/guide', httpsLink())),
        ),
      ),
      blockNode(3, { accessibleName: 'dup' }),
    ]);
    const result = await run(input);
    expect(summary(result.findings)).toEqual([
      `heading.first_level ${at(1, '/blocks/0')}`,
      `link.text_generic ${at(1, '/blocks/1/spans/0')}`,
      `heading.empty ${at(1, '/blocks/2')}`,
      `structure.rich_text_invalid ${at(2, '')}`,
      'landmark.name_missing /composition/1',
      'structure.block_unregistered /composition/2',
      `heading.level_skipped ${at(3, '/blocks/0')}`,
      'landmark.name_duplicate /composition/2',
      `link.text_is_url ${at(3, '/blocks/1/spans/0')}`,
      'landmark.name_duplicate /composition/3',
    ]);
    expect(result).toMatchObject({
      state: 'blocked',
      blockingCount: 7,
      warningCount: 3,
    });
  });

  it('never produces a media rule', async () => {
    const result = await run(
      checkerInput([
        fieldNode(
          1,
          richText(heading(4, span(' ')), paragraph(span(' ', httpsLink()))),
        ),
        blockNode(1, { nameRequired: true }),
        blockNode(2, { lifecycle: 'unregistered' }),
      ]),
    );
    const ids = result.findings.map((finding) => finding.ruleId);
    expect(ids.length).toBeGreaterThan(0);
    expect(
      ids.filter((id) => id.startsWith('alt.') || id.startsWith('media.')),
    ).toEqual([]);
  });
});

describe('runAccessibilityChecker: state across fields', () => {
  it('carries the heading level from one field to the next, in node order', async () => {
    const result = await run(
      checkerInput([
        fieldNode(5, richText(heading(2, span('One')))),
        fieldNode(
          1,
          richText(paragraph(span('between')), heading(4, span('Two'))),
        ),
        fieldNode(9, richText(heading(3, span('Three')))),
      ]),
    );
    expect(summary(result.findings)).toEqual([
      `heading.level_skipped ${at(1, '/blocks/1')}`,
    ]);
  });

  it('skips an invalid field for the heading and link rules', async () => {
    const result = await run(
      checkerInput([
        fieldNode(
          1,
          richText(
            { type: 'heading', level: 1, spans: [span('Bad')] },
            paragraph(span('click', httpsLink())),
          ),
        ),
        fieldNode(2, richText(heading(3, span('First valid heading')))),
      ]),
    );
    expect(summary(result.findings)).toEqual([
      `structure.rich_text_invalid ${at(1, '')}`,
      `heading.first_level ${at(2, '/blocks/0')}`,
    ]);
  });

  it('raises the language warning once across fields', async () => {
    const link = httpsLink();
    const result = await run(
      checkerInput(
        [
          fieldNode(1, richText(paragraph(span('Guide', link)))),
          fieldNode(2, richText(paragraph(span('Other', link)))),
        ],
        { locale: 'de-AT' },
      ),
    );
    expect(summary(result.findings)).toEqual([
      `link.text_unchecked_language ${at(1, '/blocks/0/spans/0')}`,
    ]);
    expect(result.state).toBe('healthy');
  });

  it('judges the same revision by its primary language', async () => {
    const nodes = [
      fieldNode(1, richText(paragraph(span('click here', httpsLink())))),
    ];
    const english = await run(checkerInput(nodes, { locale: 'en-US' }));
    const german = await run(checkerInput(nodes, { locale: 'de' }));
    expect(english.findings.map((f) => f.ruleId)).toEqual([
      'link.text_generic',
    ]);
    expect(german.findings.map((f) => f.ruleId)).toEqual([
      'link.text_unchecked_language',
    ]);
  });
});

describe('runAccessibilityChecker: determinism', () => {
  const nodes = () => [
    fieldNode(
      1,
      richText(heading(3, span('A')), paragraph(span('here', httpsLink()))),
    ),
    blockNode(1, { nameRequired: true }),
    blockNode(2, { accessibleName: 'Same' }),
    blockNode(3, { accessibleName: 'same' }),
  ];

  it('yields byte-identical output for identical input', async () => {
    const first = JSON.stringify(await run(checkerInput(nodes())));
    const second = JSON.stringify(await run(checkerInput(nodes())));
    expect(second).toBe(first);
    expect(
      JSON.stringify(await run(structuredClone(checkerInput(nodes())))),
    ).toBe(first);
  });

  it('does not mutate its input', async () => {
    const input = checkerInput(nodes());
    const before = JSON.stringify(input);
    await run(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});
