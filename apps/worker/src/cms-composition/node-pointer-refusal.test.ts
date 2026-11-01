import { describe, expect, it } from 'vitest';

import {
  isNodePointerReason,
  nodePointerWireDetails,
} from './node-pointer-refusal';

// DEC-228 (BE03c field matrix CMS-03C-12 `blockTree`; P2-S12-AC-105): the response side relays at most one pointer of
// the operation's own request grammar `/blockTree/{i}(/children/{j})*`, rewritten to the fixed code and message, and
// falls back to the bare reason for anything else (review V13-03).
describe('nodePointerWireDetails (DEC-228) [P2-S12-AC-105]', () => {
  it('relays the first held pointer of the request blockTree grammar with the fixed code and message', () => {
    expect(
      nodePointerWireDetails(
        {
          violations: [
            { path: '/slots/0', code: 'x' },
            { path: '/blockTree/1/children/0', code: 'other', message: 'leak' },
          ],
        },
        'pattern_depth_exceeded',
      ),
    ).toEqual({
      reasonCode: 'pattern_depth_exceeded',
      violations: [
        {
          path: '/blockTree/1/children/0',
          code: 'pattern_depth_exceeded',
          message: 'The value is invalid.',
        },
      ],
    });
  });

  it.each([
    ['no violations member', {}],
    ['a non-array violations member', { violations: 'nope' }],
    ['a null entry', { violations: [null] }],
    ['a primitive entry', { violations: [7, 'str', true] }],
    ['an entry without a path', { violations: [{ code: 'pattern_cycle' }] }],
    ['an entry with a non-string path', { violations: [{ path: 3 }] }],
    [
      'a path outside the blockTree grammar',
      { violations: [{ path: '/patternId' }] },
    ],
  ])('falls back to the bare reason for %s', (_label, details) => {
    expect(
      nodePointerWireDetails(
        details as Readonly<Record<string, unknown>>,
        'pattern_cycle',
      ),
    ).toEqual({ reasonCode: 'pattern_cycle' });
  });

  it('recognises exactly the three node-pointer reasons', () => {
    expect(
      [
        'pattern_cycle',
        'pattern_depth_exceeded',
        'pattern_nodes_exceeded',
      ].every(isNodePointerReason),
    ).toBe(true);
    expect(isNodePointerReason('pattern_not_active')).toBe(false);
    expect(isNodePointerReason(undefined)).toBe(false);
  });
});
