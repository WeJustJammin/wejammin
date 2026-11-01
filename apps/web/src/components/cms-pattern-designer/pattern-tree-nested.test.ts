import { describe, expect, it } from 'vitest';

import { PATTERN_ID } from '../../server/cms-pattern-platform.test-support';
import { newPatternNode } from './pattern-tree-nested';
import {
  addNode,
  newBlockNode,
  toWireTree,
  type EditableTree,
} from './pattern-tree-state';

/** A nested pattern node authored from a picker choice (DEC-196): a reference by lineage id and version, never an edit. */
const choice = {
  patternId: PATTERN_ID,
  patternKey: 'profile-hero',
  patternVersion: 4,
};
let counter = 0;
const makeId = (): string => `ui-${(counter += 1)}`;

describe('newPatternNode', () => {
  it('references the chosen lineage and version, keyed by the pattern key', () => {
    expect(newPatternNode([], makeId, choice)).toEqual({
      uiId: expect.any(String),
      kind: 'pattern',
      key: 'profile-hero',
      blockRef: '',
      propsText: '{}',
      patternId: PATTERN_ID,
      patternVersion: 4,
      children: [],
    });
  });

  it('serialises to exactly the wire pattern node and nothing else', () => {
    const tree: EditableTree = [newPatternNode([], makeId, choice)];
    expect(toWireTree(tree)).toEqual({
      ok: true,
      nodes: [
        {
          kind: 'pattern',
          key: 'profile-hero',
          patternId: PATTERN_ID,
          patternVersion: 4,
        },
      ],
    });
  });

  it('keeps the key unique among its siblings with a numeric suffix', () => {
    let tree: EditableTree = [];
    for (let times = 0; times < 3; times += 1)
      tree = addNode(tree, null, newPatternNode(tree, makeId, choice));
    expect(tree.map((node) => node.key)).toEqual([
      'profile-hero',
      'profile-hero-2',
      'profile-hero-3',
    ]);
  });

  it('avoids a key a block sibling already uses and trims a 64-character key to fit its suffix', () => {
    const sibling = { ...newBlockNode([], makeId), key: 'profile-hero' };
    expect(newPatternNode([sibling], makeId, choice).key).toBe(
      'profile-hero-2',
    );
    const long = { ...choice, patternKey: `a${'b'.repeat(63)}` };
    const first = newPatternNode([], makeId, long);
    const second = newPatternNode([first], makeId, long);
    expect(first.key).toHaveLength(64);
    expect(second.key).toHaveLength(64);
    expect(second.key.endsWith('-2')).toBe(true);
    expect(second.key).toMatch(/^[a-z][a-z0-9_-]{0,63}$/u);
  });
});
