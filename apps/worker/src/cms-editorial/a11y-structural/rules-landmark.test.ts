import { describe, expect, it } from 'vitest';

import { blockNode } from './a11y-structural.test-support';
import { createFindingCollector } from './findings';
import type { BlockNode } from './input-schema';
import { createLandmarkRule } from './rules-landmark';

/** Landmark rules (BE05c): name_missing (fail closed) and name_duplicate (warning). */

const landmarkFindings = (nodes: readonly BlockNode[]) => {
  const collector = createFindingCollector();
  const rule = createLandmarkRule(collector);
  nodes.forEach((node, index) => rule.evaluate(node, index));
  rule.finish();
  return collector.result().findings.map((finding) => ({
    ruleId: finding.ruleId,
    pointer: finding.location.pointer,
  }));
};

const required = (seed: number, accessibleName: string | null): BlockNode =>
  blockNode(seed, { nameRequired: true, accessibleName });

const missing = (seed: number) => ({
  ruleId: 'landmark.name_missing',
  pointer: `/composition/${seed}`,
});
const duplicate = (seed: number) => ({
  ruleId: 'landmark.name_duplicate',
  pointer: `/composition/${seed}`,
});

describe('landmark.name_missing', () => {
  it.each([
    ['null', null],
    ['empty', ''],
    ['blank', '    '],
  ])('flags a required name that is %s', (_name, name) => {
    expect(landmarkFindings([required(1, name)])).toEqual([missing(1)]);
  });

  it('flags a name longer than 160 characters after trimming, counting code points', () => {
    expect(landmarkFindings([required(1, 'n'.repeat(161))])).toEqual([
      missing(1),
    ]);
    expect(landmarkFindings([required(1, ` ${'n'.repeat(160)} `)])).toEqual([]);
    expect(landmarkFindings([required(1, '\u{1f3b8}'.repeat(160))])).toEqual(
      [],
    );
    expect(landmarkFindings([required(1, '\u{1f3b8}'.repeat(161))])).toEqual([
      missing(1),
    ]);
  });

  it.each(['n', 'Main navigation', 'n'.repeat(160)])(
    'accepts the name %j',
    (name) => {
      expect(landmarkFindings([required(1, name)])).toEqual([]);
    },
  );

  it('fails closed when the manifest defines no accessibleName field', () => {
    const node = blockNode(1, {
      nameRequired: true,
      accessibleNameFieldDefined: false,
      accessibleName: 'Looks fine',
    });
    expect(landmarkFindings([node])).toEqual([missing(1)]);
  });

  it('does not require a name when the manifest does not', () => {
    for (const accessibleName of [null, '', 'x'.repeat(500)])
      expect(
        landmarkFindings([
          blockNode(1, { nameRequired: false, accessibleName }),
          blockNode(2, {
            nameRequired: false,
            accessibleNameFieldDefined: false,
          }),
        ]),
      ).toEqual([]);
  });

  it('locates the finding at the block instance, as a block-kind location', () => {
    const collector = createFindingCollector();
    const rule = createLandmarkRule(collector);
    rule.evaluate(required(4, null), 6);
    rule.finish();
    expect(collector.result().findings[0]?.location).toEqual({
      kind: 'block',
      pointer: '/composition/4',
      fieldId: null,
      blockPath: '/composition/4',
    });
  });
});

describe('landmark.name_duplicate (warning)', () => {
  it('flags every instance of one block that shares a normalized name', () => {
    expect(
      landmarkFindings([
        required(1, 'Main Navigation'),
        required(2, 'Footer links'),
        required(3, '  main   NAVIGATION '),
      ]),
    ).toEqual([duplicate(1), duplicate(3)]);
  });

  it('flags all three instances of a triple', () => {
    expect(
      landmarkFindings([
        required(1, 'Nav'),
        required(2, 'Nav'),
        required(3, 'Nav'),
      ]),
    ).toEqual([duplicate(1), duplicate(2), duplicate(3)]);
  });

  it('compares names only within the same blockKey', () => {
    expect(
      landmarkFindings([
        blockNode(1, { blockKey: 'site.nav', accessibleName: 'Menu' }),
        blockNode(2, { blockKey: 'site.footer', accessibleName: 'Menu' }),
      ]),
    ).toEqual([]);
  });

  it('ignores absent and blank names (name_missing owns them)', () => {
    expect(
      landmarkFindings([
        required(1, null),
        required(2, null),
        required(3, ' '),
        required(4, ''),
      ]),
    ).toEqual([missing(1), missing(2), missing(3), missing(4)]);
  });

  it('reports a duplicate name even on blocks that do not require one', () => {
    expect(
      landmarkFindings([
        blockNode(1, { accessibleName: 'Same' }),
        blockNode(2, { accessibleName: 'same' }),
      ]),
    ).toEqual([duplicate(1), duplicate(2)]);
  });

  it('sorts the blocking name_missing ahead of the warnings', () => {
    expect(
      landmarkFindings([
        required(1, 'Same'),
        required(2, null),
        required(3, 'Same'),
      ]),
    ).toEqual([missing(2), duplicate(1), duplicate(3)]);
  });
});
