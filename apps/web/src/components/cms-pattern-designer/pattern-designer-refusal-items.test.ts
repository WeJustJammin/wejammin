import { describe, expect, it } from 'vitest';

import { refusalItems } from './pattern-designer-refusal-items';
import { PATTERN_ISSUE_COPY } from './pattern-designer-copy';
import { PATTERN_REFUSAL_COPY } from './pattern-designer-reasons';
import type { PatternSubmitResult } from './pattern-designer-submit';
import type { EditableNode } from './pattern-tree-state';

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
const nested = (key: string): EditableNode =>
  node(key, {
    kind: 'pattern',
    blockRef: '',
    patternId: 'p',
    patternVersion: 2,
  });
const refused = (
  status: 403 | 409 | 422,
  reason: Extract<PatternSubmitResult, { kind: 'refused' }>['reason'],
): PatternSubmitResult => ({ kind: 'refused', status, reason });

describe('refusalItems', () => {
  const tree = [
    node('a', { children: [nested('inner')] }),
    nested('shared'),
    node('b'),
  ];

  it('puts a reserved key at the key field', () => {
    expect(refusalItems(refused(422, 'key_reserved'), tree)).toEqual([
      {
        message: PATTERN_ISSUE_COPY.key_reserved,
        target: { kind: 'field', field: 'patternKey' },
      },
    ]);
  });

  it('has no linked item for a missing capability or a result that is not a refusal', () => {
    expect(refusalItems(refused(403, 'capability_missing'), tree)).toEqual([]);
    for (const result of [
      { kind: 'uncertain' },
      { kind: 'conflict', currentVersion: null },
      { kind: 'rejected', status: 422 },
    ] as const)
      expect(refusalItems(result, tree)).toEqual([]);
  });

  it('puts an expansion bound and a block composition rule violation (DEC-210) at the tree and names no node', () => {
    for (const reason of [
      'pattern_depth_exceeded',
      'pattern_nodes_exceeded',
      'block_rules_violated',
    ] as const)
      expect(refusalItems(refused(422, reason), tree)).toEqual([
        {
          message: PATTERN_REFUSAL_COPY[reason],
          target: { kind: 'field', field: 'tree' },
        },
      ]);
  });

  it.each([
    ['pattern_cycle', 409],
    ['nested_pattern_not_active', 422],
    ['pattern_incompatible', 422],
    ['pattern_version_not_active', 422],
    ['block_registry_digest_mismatch', 409],
  ] as const)(
    'for %s links the tree and, when the server cannot say which, every nested pattern',
    (reason, status) => {
      const items = refusalItems(refused(status, reason), tree);
      const nodes = items.filter((item) => item.target.kind === 'node');
      expect(items[0]?.target).toEqual({ kind: 'field', field: 'tree' });
      if (reason === 'block_registry_digest_mismatch') {
        expect(nodes).toEqual([]);
        return;
      }
      expect(nodes.map((item) => item.target)).toEqual([
        { kind: 'node', uiId: 'id-inner', member: null },
        { kind: 'node', uiId: 'id-shared', member: null },
      ]);
      expect(nodes[0]?.message).toBe(PATTERN_ISSUE_COPY.nested_pattern_suspect);
    },
  );

  it('links only the tree when there is no nested pattern to suspect', () => {
    expect(
      refusalItems(refused(409, 'pattern_cycle'), [node('a')]),
    ).toHaveLength(1);
  });
});
