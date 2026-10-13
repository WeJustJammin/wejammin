import { describe, expect, it } from 'vitest';

import {
  isRefused,
  issueMessages,
  issuePaths,
  uid,
  without,
} from './composition-fixtures.test-support';
import {
  CMS_PATTERN_MAX_DEPTH,
  CMS_PATTERN_MAX_NODES,
  CMS_PATTERN_MAX_ROOTS,
  PatternBlockTreeSchema,
  PatternNodePropsSchema,
  PatternNodeSchema,
  countPatternNodes,
  type PatternNode,
} from './pattern-node';

type BlockNode = Extract<PatternNode, { kind: 'block' }>;

const block = (key: string, children: PatternNode[] = []): BlockNode => ({
  kind: 'block',
  key,
  blockKey: 'profile.header',
  blockVersion: 1,
  props: {},
  children,
});
const reference: PatternNode = {
  kind: 'pattern',
  key: 'shared',
  patternId: uid(90),
  patternVersion: 2,
};

/** A chain of `depth` nested block nodes, root first. */
const chain = (depth: number): PatternNode => {
  let node = block(`n${depth}`);
  for (let level = depth - 1; level >= 1; level -= 1)
    node = block(`n${level}`, [node]);
  return node;
};

describe('pattern node schema (D9, OD-2, DEC-175)', () => {
  it('[P2-S12-AC-100] pins the structural bounds of a pattern tree', () => {
    expect(CMS_PATTERN_MAX_ROOTS).toBe(32);
    expect(CMS_PATTERN_MAX_DEPTH).toBe(8);
    expect(CMS_PATTERN_MAX_NODES).toBe(512);
  });

  it('[P2-S12-AC-100] accepts a block node with props and children and a nested pattern reference', () => {
    const tree: PatternNode = block('hero', [
      { ...block('title'), props: { text: { value: 'Hello' }, level: 1 } },
      reference,
    ]);
    expect(PatternNodeSchema.parse(tree)).toEqual(tree);
    expect(PatternNodeSchema.parse(reference)).toEqual(reference);
  });

  it('[P2-S12-AC-101] bounds the node key to ^[a-z][a-z0-9_-]{0,63}$ on both node kinds', () => {
    for (const key of ['a', 'a'.repeat(64), 'row_1', 'a-b'])
      expect(PatternNodeSchema.safeParse(block(key)).success).toBe(true);
    for (const key of ['', '1a', 'A', 'a b', 'a/b', 'a'.repeat(65), '_a']) {
      expect(isRefused(PatternNodeSchema, block(key))).toBe(true);
      expect(isRefused(PatternNodeSchema, { ...reference, key })).toBe(true);
    }
  });

  it('[P2-S12-AC-101] requires a canonical BlockKey and a positive int32 block version on a block node', () => {
    for (const blockKey of ['profile.header', 'a', `a${'b'.repeat(95)}`])
      expect(
        PatternNodeSchema.safeParse({ ...block('n'), blockKey }).success,
      ).toBe(true);
    for (const blockKey of ['', 'Bad', '1x', 'has space', `a${'b'.repeat(96)}`])
      expect(isRefused(PatternNodeSchema, { ...block('n'), blockKey })).toBe(
        true,
      );
    for (const blockVersion of [1, 2_147_483_647])
      expect(
        PatternNodeSchema.safeParse({ ...block('n'), blockVersion }).success,
      ).toBe(true);
    for (const blockVersion of [0, -1, 1.5, 2_147_483_648, '1', null])
      expect(
        isRefused(PatternNodeSchema, { ...block('n'), blockVersion }),
      ).toBe(true);
  });

  it('[P2-S12-AC-100] requires a lineage UUID and a positive int32 version on a pattern reference', () => {
    for (const patternVersion of [1, 2_147_483_647])
      expect(
        PatternNodeSchema.safeParse({ ...reference, patternVersion }).success,
      ).toBe(true);
    for (const candidate of [
      { ...reference, patternVersion: 0 },
      { ...reference, patternVersion: 2_147_483_648 },
      { ...reference, patternVersion: 1.5 },
      { ...reference, patternId: 'shared-pattern' },
      without(reference, 'patternId'),
      without(reference, 'patternVersion'),
      // A reference has no block of its own and no children or props.
      { ...reference, blockKey: 'profile.header' },
      { ...reference, children: [] },
      { ...reference, props: {} },
    ])
      expect(isRefused(PatternNodeSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-100] refuses an unknown kind, a missing children list and a member the kind does not name', () => {
    for (const candidate of [
      { ...block('n'), kind: 'slot' },
      { ...block('n'), kind: undefined },
      without(
        block('n') as Extract<PatternNode, { kind: 'block' }>,
        'children',
      ),
      without(block('n'), 'props'),
      { ...block('n'), patternId: uid(1) },
      { ...block('n'), rendererRef: 'private' },
      { ...block('n'), script: 'alert(1)' },
    ])
      expect(isRefused(PatternNodeSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-101] bounds node props at 64 keys of at most 128 characters and JSON depth 8', () => {
    const keys = (count: number) =>
      Object.fromEntries(Array.from({ length: count }, (_, i) => [`k${i}`, i]));
    expect(PatternNodePropsSchema.safeParse(keys(64)).success).toBe(true);
    expect(PatternNodePropsSchema.safeParse(keys(65)).success).toBe(false);
    expect(
      PatternNodePropsSchema.safeParse({ ['k'.repeat(128)]: 1 }).success,
    ).toBe(true);
    expect(
      PatternNodePropsSchema.safeParse({ ['k'.repeat(129)]: 1 }).success,
    ).toBe(false);
    // The props object is level 1, so seven further nested levels reach 8.
    let allowed: unknown = 'leaf';
    for (let level = 0; level < 7; level += 1) allowed = { child: allowed };
    expect(PatternNodePropsSchema.safeParse({ nested: allowed }).success).toBe(
      true,
    );
    expect(
      PatternNodePropsSchema.safeParse({ nested: { child: allowed } }).success,
    ).toBe(false);
    for (const props of [
      { bad: Number.NaN },
      { bad: undefined },
      { bad: () => 1 },
      { bad: new Date(0) },
    ])
      expect(PatternNodePropsSchema.safeParse(props).success).toBe(false);
  });

  it('[P2-S12-AC-101] bounds the children of one node at 32', () => {
    const many = (count: number) =>
      block(
        'root',
        Array.from({ length: count }, (_, index) => block(`c${index}`)),
      );
    expect(PatternNodeSchema.safeParse(many(32)).success).toBe(true);
    expect(PatternNodeSchema.safeParse(many(33)).success).toBe(false);
  });
});

describe('pattern block tree (CMS-03C-12 blockTree)', () => {
  it('[P2-S12-AC-101] requires 1 to 32 root nodes', () => {
    expect(PatternBlockTreeSchema.safeParse([block('a')]).success).toBe(true);
    expect(
      PatternBlockTreeSchema.safeParse(
        Array.from({ length: 32 }, (_, index) => block(`r${index}`)),
      ).success,
    ).toBe(true);
    expect(PatternBlockTreeSchema.safeParse([]).success).toBe(false);
    expect(
      PatternBlockTreeSchema.safeParse(
        Array.from({ length: 33 }, (_, index) => block(`r${index}`)),
      ).success,
    ).toBe(false);
  });

  it('[P2-S12-AC-101] refuses duplicate sibling keys at every level and reports the repeated key', () => {
    expect(
      issuePaths(PatternBlockTreeSchema, [block('a'), block('a')]),
    ).toEqual(['1.key']);
    expect(
      issuePaths(PatternBlockTreeSchema, [
        block('a', [block('x'), block('y'), block('x')]),
      ]),
    ).toEqual(['0.children.2.key']);
    expect(
      issueMessages(PatternBlockTreeSchema, [block('a'), block('a')]),
    ).toEqual(['node_key_duplicate']);
    // The same key under different parents is not a sibling collision.
    expect(
      PatternBlockTreeSchema.safeParse([
        block('a', [block('x')]),
        block('b', [block('x')]),
      ]).success,
    ).toBe(true);
    // A reference node's key collides with a block node's key among siblings.
    expect(
      issuePaths(PatternBlockTreeSchema, [block('shared'), reference]),
    ).toEqual(['1.key']);
  });

  it('[P2-S12-AC-101] allows depth 8 and refuses the ninth level with pattern_depth_exceeded at that node', () => {
    expect(PatternBlockTreeSchema.safeParse([chain(8)]).success).toBe(true);
    const tooDeep = [chain(9)];
    expect(issueMessages(PatternBlockTreeSchema, tooDeep)).toEqual([
      'pattern_depth_exceeded',
    ]);
    // The offending node is the ninth level: the root, then eight child hops.
    expect(issuePaths(PatternBlockTreeSchema, tooDeep)).toEqual([
      ['0', ...Array.from({ length: 8 }, () => 'children.0')].join('.'),
    ]);
  });

  it('[P2-S12-AC-101] allows 512 nodes and refuses the 513th with pattern_nodes_exceeded', () => {
    const roots = (childrenPerRoot: (index: number) => number) =>
      Array.from({ length: 32 }, (_, index) =>
        block(
          `r${index}`,
          Array.from({ length: childrenPerRoot(index) }, (_, child) =>
            block(`c${child}`),
          ),
        ),
      );
    const full = roots(() => 15);
    expect(countPatternNodes(full)).toBe(512);
    expect(PatternBlockTreeSchema.safeParse(full).success).toBe(true);
    const over = roots((index) => (index === 0 ? 16 : 15));
    expect(countPatternNodes(over)).toBe(513);
    expect(issueMessages(PatternBlockTreeSchema, over)).toEqual([
      'pattern_nodes_exceeded',
    ]);
    expect(issuePaths(PatternBlockTreeSchema, over)).toEqual(['']);
  });

  it('[P2-S12-AC-101] counts a nested pattern reference as one node before expansion', () => {
    expect(countPatternNodes([block('a', [reference]), reference])).toBe(3);
    expect(countPatternNodes([])).toBe(0);
  });
});
