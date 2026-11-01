import { describe, expect, it } from 'vitest';

import { forwardCmsPatternVersionWrite } from './cms-pattern-platform-write';
import {
  bindingFor,
  jsonResponse,
  patternApiError,
  writeRequest,
} from './cms-pattern-platform.test-support';

/*
 * DEC-228 (BE03c field matrix CMS-03C-12 `blockTree` row; P2-S12-AC-105): the first-party pattern write proxy keeps the one
 * offending-node pointer of a cycle, depth or node-count refusal and nothing else the upstream carried.
 */
const REASONS = [
  ['pattern_cycle', 409],
  ['pattern_depth_exceeded', 422],
  ['pattern_nodes_exceeded', 422],
] as const;

const refuse = async (
  reason: (typeof REASONS)[number][0],
  status: 409 | 422,
  violations: readonly unknown[] | undefined,
) => {
  const binding = bindingFor(
    jsonResponse(
      status,
      patternApiError('CMS-03C-12', status, {
        reasonCode: reason,
        ...(violations === undefined ? {} : { violations }),
        secret: 'x',
      }),
    ),
  );
  const response = await forwardCmsPatternVersionWrite(writeRequest(), binding);
  expect(response.status).toBe(status);
  return ((await response.json()) as { details: Record<string, unknown> })
    .details;
};

describe.each(REASONS)('%s names the offending node', (reason, status) => {
  it.each(['/blockTree/0', '/blockTree/2/children/1/children/0'])(
    'keeps the node pointer %s as one bounded violation',
    async (path) => {
      expect(
        await refuse(reason, status, [
          { path, code: reason, message: 'private text' },
          { path: '/blockTree/3', code: reason, message: 'second' },
        ]),
      ).toEqual({
        reasonCode: reason,
        violations: [{ path, code: reason, message: 'The value is invalid.' }],
      });
    },
  );

  it.each([
    ['no violation', undefined],
    [
      'a foreign pointer',
      [{ path: '/secret-pointer', code: 'x', message: 'x' }],
    ],
    ['a placement pointer', [{ path: '/roots', code: 'x', message: 'x' }]],
    ['a non-record entry', ['/blockTree/0']],
  ])('keeps only the reasonCode for %s', async (_label, violations) => {
    expect(await refuse(reason, status, violations)).toEqual({
      reasonCode: reason,
    });
  });
});
