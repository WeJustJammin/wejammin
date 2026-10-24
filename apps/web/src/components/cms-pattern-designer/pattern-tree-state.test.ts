import { PatternBlockTreeSchema, type PatternNode } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  addNode,
  canAddChild,
  canAddRoot,
  fromWireTree,
  locateNode,
  moveNode,
  newBlockNode,
  removeNode,
  toWireTree,
  updateNode,
  type EditableNode,
} from './pattern-tree-state';

let counter = 0;
const makeId = (): string => `ui-${(counter += 1)}`;
const UUID = '90000000-0000-4000-8000-000000000009';

const node = (
  key: string,
  extra: Partial<EditableNode> = {},
): EditableNode => ({
  uiId: `id-${key}`,
  kind: 'block',
  key,
  blockRef: 'profile.header@1',
  propsText: '{}',
  patternId: '',
  patternVersion: 0,
  children: [],
  ...extra,
});
const keys = (nodes: readonly EditableNode[]): string[] =>
  nodes.map((entry) => entry.key);

describe('newBlockNode', () => {
  it('starts with no block chosen and a key unused among its siblings', () => {
    const created = newBlockNode([node('node-1'), node('node-3')], makeId);
    expect(created).toMatchObject({
      kind: 'block',
      key: 'node-2',
      blockRef: '',
      propsText: '{}',
      children: [],
    });
    expect(created.uiId).toMatch(/^ui-/u);
  });
});

describe('tree edits are pure and addressed by uiId', () => {
  const tree: readonly EditableNode[] = [
    node('a', { children: [node('x'), node('y'), node('z')] }),
    node('b'),
  ];

  it('adds a root at the end and a child under its parent', () => {
    expect(keys(addNode(tree, null, node('c')))).toEqual(['a', 'b', 'c']);
    const withChild = addNode(tree, 'id-a', node('w'));
    expect(keys(withChild[0]?.children ?? [])).toEqual(['x', 'y', 'z', 'w']);
    expect(tree[0]?.children).toHaveLength(3);
  });

  it('removes a node with its subtree', () => {
    expect(keys(removeNode(tree, 'id-a'))).toEqual(['b']);
    expect(keys(removeNode(tree, 'id-y')[0]?.children ?? [])).toEqual([
      'x',
      'z',
    ]);
  });

  it('moves a node earlier or later among its siblings only', () => {
    expect(keys(moveNode(tree, 'id-b', -1))).toEqual(['b', 'a']);
    expect(keys(moveNode(tree, 'id-y', 1)[0]?.children ?? [])).toEqual([
      'x',
      'z',
      'y',
    ]);
    expect(moveNode(tree, 'id-a', -1)).toBe(tree);
    expect(moveNode(tree, 'id-z', 1)).toBe(tree);
  });

  it('updates one node and leaves the others identical', () => {
    const next = updateNode(tree, 'id-y', { key: 'renamed' });
    expect(keys(next[0]?.children ?? [])).toEqual(['x', 'renamed', 'z']);
    expect(next[1]).toBe(tree[1]);
  });

  it('locates a node with its path, depth and sibling position', () => {
    expect(locateNode(tree, 'id-y')).toEqual({
      path: [0, 1],
      level: 2,
      index: 1,
      siblingCount: 3,
    });
    expect(locateNode(tree, 'missing')).toBeNull();
  });
});

describe('add limits', () => {
  it('stops a root at 32 roots or 512 nodes and a child at depth 8 or 32 children', () => {
    const roots = Array.from({ length: 32 }, (_, i) => node(`r${i}`));
    expect(canAddRoot(roots)).toBe(false);
    expect(canAddRoot(roots.slice(1))).toBe(true);
    const full: EditableNode[] = [];
    for (let i = 0; i < 30; i += 1)
      full.push(
        node(`r${i}`, {
          children: Array.from({ length: 16 }, (_, c) => node(`c${c}`)),
        }),
      );
    expect(canAddRoot(full)).toBe(true);
    full.push(
      node('x', {
        children: Array.from({ length: 2 }, (_, c) => node(`c${c}`)),
      }),
    );
    expect(canAddRoot(full)).toBe(false);

    const deep = (levels: number): EditableNode =>
      levels === 1
        ? node('leaf')
        : node(`l${levels}`, { children: [deep(levels - 1)] });
    const tree = [deep(8)];
    let leaf = tree[0] as EditableNode;
    while (leaf.children.length > 0) leaf = leaf.children[0] as EditableNode;
    expect(canAddChild(tree, leaf.uiId)).toBe(false);
    expect(canAddChild([deep(7)], 'id-l7')).toBe(true);
    const crowded = [
      node('p', {
        children: Array.from({ length: 32 }, (_, c) => node(`c${c}`)),
      }),
    ];
    expect(canAddChild(crowded, 'id-p')).toBe(false);
    expect(canAddChild([node('p', { kind: 'pattern' })], 'id-p')).toBe(false);
  });
});

describe('toWireTree', () => {
  const editable: readonly EditableNode[] = [
    node('hero', {
      propsText: '{"title":"Hello","tags":["a"]}',
      children: [node('sub', { blockRef: 'profile.text@3' })],
    }),
    node('shared', {
      kind: 'pattern',
      blockRef: '',
      patternId: UUID,
      patternVersion: 2,
    }),
  ];

  it('builds the exact wire nodes, parsing props and splitting the block reference', () => {
    const result = toWireTree(editable);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.nodes).toEqual([
      {
        kind: 'block',
        key: 'hero',
        blockKey: 'profile.header',
        blockVersion: 1,
        props: { title: 'Hello', tags: ['a'] },
        children: [
          {
            kind: 'block',
            key: 'sub',
            blockKey: 'profile.text',
            blockVersion: 3,
            props: {},
            children: [],
          },
        ],
      },
      { kind: 'pattern', key: 'shared', patternId: UUID, patternVersion: 2 },
    ]);
    expect(PatternBlockTreeSchema.safeParse(result.nodes).success).toBe(true);
  });

  it.each([
    ['not json', '{', 'props_not_json'],
    ['an array', '[]', 'props_not_object'],
    ['null', 'null', 'props_not_object'],
    ['a string', '"x"', 'props_not_object'],
  ])('names the node whose props are %s', (_name, propsText, code) => {
    const result = toWireTree([node('a'), node('b', { propsText })]);
    expect(result).toEqual({
      ok: false,
      issues: [{ uiId: 'id-b', code, member: 'props' }],
    });
  });

  it('names a node with no block chosen', () => {
    expect(toWireTree([node('a', { blockRef: '' })])).toEqual({
      ok: false,
      issues: [{ uiId: 'id-a', code: 'block_required', member: 'blockRef' }],
    });
  });

  it('keeps a blank props box as an empty object', () => {
    const result = toWireTree([node('a', { propsText: '  ' })]);
    expect(result.ok && result.nodes[0]).toMatchObject({ props: {} });
  });
});

describe('fromWireTree', () => {
  const wire: PatternNode[] = [
    {
      kind: 'block',
      key: 'hero',
      blockKey: 'profile.header',
      blockVersion: 1,
      props: { title: 'Hello' },
      children: [],
    },
    { kind: 'pattern', key: 'shared', patternId: UUID, patternVersion: 2 },
  ];

  it('round-trips through the editable model', () => {
    const editable = fromWireTree(wire, makeId);
    expect(editable[0]).toMatchObject({
      kind: 'block',
      blockRef: 'profile.header@1',
      propsText: '{\n  "title": "Hello"\n}',
    });
    expect(editable[1]).toMatchObject({
      kind: 'pattern',
      patternId: UUID,
      patternVersion: 2,
    });
    const back = toWireTree(editable);
    expect(back.ok && back.nodes).toEqual(wire);
    expect(new Set([editable[0]?.uiId, editable[1]?.uiId]).size).toBe(2);
  });
});
