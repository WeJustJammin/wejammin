import {
  CMS_PATTERN_MAX_CHILDREN,
  CMS_PATTERN_MAX_DEPTH,
  CMS_PATTERN_MAX_NODES,
  CMS_PATTERN_MAX_PROPS_DEPTH,
  CMS_PATTERN_MAX_PROPS_KEYS,
  CMS_PATTERN_MAX_ROOTS,
  CMS_RESERVED_PATTERN_KEYS,
  CmsPatternKeySchema,
  PatternBlockTreeSchema,
  type PatternNode,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  PATTERN_LIMITS,
  PATTERN_RESERVED_KEYS,
  countWrittenNodes,
  parseWireTree,
  patternKeyIssue,
  validatePatternTree,
} from './pattern-tree-rules';

type BlockNode = Extract<PatternNode, { kind: 'block' }>;

const UUID = '90000000-0000-4000-8000-000000000009';
const block = (
  key: string,
  children: PatternNode[] = [],
  props: BlockNode['props'] = {},
): BlockNode => ({
  kind: 'block',
  key,
  blockKey: 'profile.header',
  blockVersion: 1,
  props,
  children,
});
const reference = (key = 'shared'): PatternNode => ({
  kind: 'pattern',
  key,
  patternId: UUID,
  patternVersion: 2,
});
/** A chain of `depth` nested block nodes, root first. */
const chain = (depth: number): PatternNode => {
  let node = block(`n${depth}`);
  for (let level = depth - 1; level >= 1; level -= 1)
    node = block(`n${level}`, [node]);
  return node;
};
const wide = (count: number): PatternNode[] =>
  Array.from({ length: count }, (_, index) => block(`n${index}`));
const nested = (depth: number): Record<string, unknown> => {
  let value: Record<string, unknown> = {};
  for (let level = 1; level < depth; level += 1) value = { v: value };
  return value;
};

describe('pattern tree limits mirror the contract (drift guard)', () => {
  it('has the contract constants', () => {
    expect(PATTERN_LIMITS).toEqual({
      roots: CMS_PATTERN_MAX_ROOTS,
      children: CMS_PATTERN_MAX_CHILDREN,
      depth: CMS_PATTERN_MAX_DEPTH,
      nodes: CMS_PATTERN_MAX_NODES,
      propsKeys: CMS_PATTERN_MAX_PROPS_KEYS,
      propsDepth: CMS_PATTERN_MAX_PROPS_DEPTH,
    });
    expect([...PATTERN_RESERVED_KEYS]).toEqual([...CMS_RESERVED_PATTERN_KEYS]);
  });
});

describe('patternKeyIssue agrees with CmsPatternKeySchema', () => {
  const keys = [
    'a',
    'ab',
    'profile-header',
    'Ab',
    '1ab',
    'a_b',
    'a'.repeat(64),
    'a'.repeat(65),
    '',
    ...CMS_RESERVED_PATTERN_KEYS,
  ];
  it.each(keys)('classifies %j exactly as the contract does', (key) => {
    const parsed = CmsPatternKeySchema.safeParse(key);
    const issue = patternKeyIssue(key);
    expect(issue === null).toBe(parsed.success);
    if (!parsed.success)
      expect(issue).toBe(
        parsed.error.issues[0]?.message === 'key_reserved'
          ? 'key_reserved'
          : 'pattern_key_invalid',
      );
  });
});

describe('validatePatternTree agrees with PatternBlockTreeSchema', () => {
  const cases: ReadonlyArray<readonly [string, readonly unknown[]]> = [
    ['one block', [block('hero')]],
    ['block and reference', [block('hero', [block('title')]), reference()]],
    ['empty forest', []],
    ['33 roots', wide(33)],
    ['32 roots', wide(32)],
    ['33 children', [block('a', wide(33))]],
    ['32 children', [block('a', wide(32))]],
    ['duplicate sibling key', [block('a'), block('a')]],
    [
      'same key under different parents',
      [block('a', [block('x')]), block('b', [block('x')])],
    ],
    ['bad node key', [block('Hero')]],
    ['node key too long', [block('a'.repeat(65))]],
    ['depth 8', [chain(8)]],
    ['depth 9', [chain(9)]],
    ['bad block key', [{ ...block('a'), blockKey: 'Bad Key' }]],
    ['block version 0', [{ ...block('a'), blockVersion: 0 }]],
    [
      'block version past int32',
      [{ ...block('a'), blockVersion: 2_147_483_648 }],
    ],
    ['reference with bad id', [{ ...reference(), patternId: 'nope' }]],
    ['reference version 0', [{ ...reference(), patternVersion: 0 }]],
    [
      '64 props keys',
      [block('a', [], Object.fromEntries(wide(64).map((n) => [n.key, 1])))],
    ],
    [
      '65 props keys',
      [block('a', [], Object.fromEntries(wide(65).map((n) => [n.key, 1])))],
    ],
    ['props depth 8', [block('a', [], nested(8) as BlockNode['props'])]],
    ['props depth 9', [block('a', [], nested(9) as BlockNode['props'])]],
    [
      'props array of 129',
      [block('a', [], { list: Array.from({ length: 129 }, () => 0) })],
    ],
    [
      'props array of 128',
      [block('a', [], { list: Array.from({ length: 128 }, () => 0) })],
    ],
    ['props key of 129 chars', [block('a', [], { ['k'.repeat(129)]: 1 })]],
  ];
  it.each(cases)('%s', (_name, tree) => {
    const accepted = PatternBlockTreeSchema.safeParse(tree).success;
    expect(validatePatternTree(tree as PatternNode[]).length === 0).toBe(
      accepted,
    );
  });

  it('counts written nodes the way the contract does', () => {
    expect(
      countWrittenNodes([block('a', [block('b'), reference()]), block('c')]),
    ).toBe(4);
  });

  it('refuses a forest of exactly 513 written nodes and accepts 512', () => {
    const fill = (total: number): PatternNode[] => {
      const roots: PatternNode[] = [];
      let remaining = total;
      while (remaining > 0) {
        const take = Math.min(remaining, 17);
        roots.push(block(`r${roots.length}`, wide(take - 1)));
        remaining -= take;
      }
      return roots;
    };
    for (const total of [512, 513]) {
      const tree = fill(total);
      expect(countWrittenNodes(tree)).toBe(total);
      expect(PatternBlockTreeSchema.safeParse(tree).success).toBe(total <= 512);
      expect(validatePatternTree(tree).length === 0).toBe(total <= 512);
    }
  });
});

describe('validatePatternTree names the node', () => {
  it('points at the second of two equal sibling keys', () => {
    expect(
      validatePatternTree([block('a', [block('x'), block('y'), block('y')])]),
    ).toEqual([
      { code: 'node_key_duplicate', nodePath: [0, 2], member: 'key' },
    ]);
  });

  it('points at the first node nested deeper than 8 levels and does not descend', () => {
    expect(validatePatternTree([chain(10)])).toEqual([
      {
        code: 'pattern_depth_exceeded',
        nodePath: [0, 0, 0, 0, 0, 0, 0, 0, 0],
        member: null,
      },
    ]);
  });

  it('names the invalid member of a block and of a reference', () => {
    expect(
      validatePatternTree([
        { ...block('a'), blockKey: 'Bad Key' },
        { ...reference('r'), patternVersion: 0 } as PatternNode,
      ]),
    ).toEqual([
      { code: 'block_key_invalid', nodePath: [0], member: 'blockKey' },
      {
        code: 'pattern_version_invalid',
        nodePath: [1],
        member: 'patternVersion',
      },
    ]);
  });

  it('points at the first node beyond 512 written nodes, in document order', () => {
    // 30 roots of 17 nodes = 510; `x` is the 511th, `c0` the 512th and `c1` the 513th.
    const roots: PatternNode[] = [];
    for (let index = 0; index < 30; index += 1)
      roots.push(block(`r${index}`, wide(16)));
    roots.push(block('x', wide(3)));
    expect(countWrittenNodes(roots)).toBe(514);
    expect(validatePatternTree(roots)).toEqual([
      { code: 'pattern_nodes_exceeded', nodePath: [30, 1], member: null },
    ]);
  });

  it('reports tree-level limits with an empty node path', () => {
    expect(validatePatternTree([])).toEqual([
      { code: 'tree_empty', nodePath: [], member: null },
    ]);
    expect(validatePatternTree(wide(33))[0]).toEqual({
      code: 'roots_exceeded',
      nodePath: [],
      member: null,
    });
  });

  it('reports a children overflow at the parent and a props overflow at the node', () => {
    expect(validatePatternTree([block('a', wide(33))])).toEqual([
      { code: 'children_exceeded', nodePath: [0], member: 'children' },
    ]);
    expect(
      validatePatternTree([
        block('a', [], Object.fromEntries(wide(65).map((n) => [n.key, 1]))),
      ]),
    ).toEqual([{ code: 'props_key_limit', nodePath: [0], member: 'props' }]);
    expect(
      validatePatternTree([block('a', [], nested(9) as BlockNode['props'])]),
    ).toEqual([{ code: 'props_depth_limit', nodePath: [0], member: 'props' }]);
  });
});

describe('parseWireTree', () => {
  it('returns a verified tree', () => {
    const tree = [block('a', [block('b')]), reference()];
    expect(parseWireTree(JSON.parse(JSON.stringify(tree)))).toEqual(tree);
  });

  it.each([
    ['not an array', {}],
    ['an unknown kind', [{ kind: 'text', key: 'a' }]],
    ['a block without children', [{ ...block('a'), children: undefined }]],
    ['an extra member', [{ ...block('a'), extra: 1 }]],
    ['a reference with a block member', [{ ...reference(), props: {} }]],
    ['a rule violation', [chain(9)]],
  ])('refuses %s', (_name, value) => {
    expect(parseWireTree(value)).toBeNull();
  });
});
