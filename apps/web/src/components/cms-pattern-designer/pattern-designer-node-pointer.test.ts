import type { PatternVersionRequest } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  CSRF,
  KEY,
  jsonResponse,
  patternApiError,
  patternRequestBody,
} from '../../server/cms-pattern-platform.test-support';
import { PATTERN_ISSUE_COPY } from './pattern-designer-copy';
import { refusalItems } from './pattern-designer-refusal-items';
import { submitPatternVersion } from './pattern-designer-submit';
import type { EditableNode } from './pattern-tree-state';

/*
 * DEC-228 (BE03c field matrix CMS-03C-12 `blockTree` row; FE03 885, P2-S12-AC-105): a cycle, depth or node-count refusal
 * carries the offending request node's `/blockTree/{i}(/children/{j})*` pointer; the designer reads it as child indices and
 * links the error summary to that node. A pointer that names no node of the tree on screen falls back to the tree.
 */
const request = patternRequestBody() as unknown as PatternVersionRequest;
const refuse = async (
  status: 409 | 422,
  reason: string,
  violations?: readonly unknown[],
) => {
  const fetcher = vi.fn(async () =>
    jsonResponse(
      status,
      patternApiError('CMS-03C-12', status, {
        reasonCode: reason,
        ...(violations === undefined ? {} : { violations }),
      }),
    ),
  );
  return submitPatternVersion(
    request,
    CSRF,
    KEY,
    fetcher as unknown as typeof fetch,
  );
};
const at = (path: string) => [
  { path, code: 'pattern_cycle', message: 'The value is invalid.' },
];

describe('submitPatternVersion: the offending node of a DEC-228 refusal', () => {
  it.each([
    [409, 'pattern_cycle', '/blockTree/1/children/0', [1, 0]],
    [422, 'pattern_depth_exceeded', '/blockTree/0', [0]],
    [422, 'pattern_nodes_exceeded', '/blockTree/15/children/30', [15, 30]],
  ] as const)(
    'reads %i %s at %s as child indices',
    async (status, reason, pointer, nodePath) => {
      expect(await refuse(status, reason, at(pointer))).toEqual({
        kind: 'refused',
        status,
        reason,
        nodePath,
      });
    },
  );

  it.each([
    ['the root pointer', at('/blockTree')],
    ['a pointer outside the tree', at('/patternKey')],
    [
      'a pointer deeper than the tree allows',
      at(`/blockTree/0${'/children/0'.repeat(9)}`),
    ],
    ['no violation', undefined],
    ['a violation without a path', [{ code: 'x' }]],
  ])('has no node for %s', async (_label, violations) => {
    expect(await refuse(422, 'pattern_depth_exceeded', violations)).toEqual({
      kind: 'refused',
      status: 422,
      reason: 'pattern_depth_exceeded',
    });
  });

  it('reads no pointer for a reason DEC-228 does not move', async () => {
    expect(
      await refuse(422, 'nested_pattern_not_active', at('/blockTree/0')),
    ).toEqual({
      kind: 'refused',
      status: 422,
      reason: 'nested_pattern_not_active',
    });
  });
});

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
const tree = [
  node('a'),
  node('b', { children: [node('c'), node('d', { children: [node('e')] })] }),
];

describe('refusalItems: a DEC-228 refusal links its node', () => {
  it.each([
    ['pattern_cycle', 409, PATTERN_ISSUE_COPY.pattern_cycle],
    ['pattern_depth_exceeded', 422, PATTERN_ISSUE_COPY.pattern_depth_exceeded],
    ['pattern_nodes_exceeded', 422, PATTERN_ISSUE_COPY.pattern_nodes_exceeded],
  ] as const)(
    'puts %s at the node its pointer names and nowhere else',
    (reason, status, message) => {
      expect(
        refusalItems(
          { kind: 'refused', status, reason, nodePath: [1, 1, 0] },
          tree,
        ),
      ).toEqual([
        { message, target: { kind: 'node', uiId: 'id-e', member: null } },
      ]);
    },
  );

  it('falls back to the tree when the pointer names a node the tree on screen no longer has', () => {
    const items = refusalItems(
      {
        kind: 'refused',
        status: 422,
        reason: 'pattern_depth_exceeded',
        nodePath: [5, 0],
      },
      tree,
    );
    expect(items.map((item) => item.target)).toEqual([
      { kind: 'field', field: 'tree' },
    ]);
  });
});
