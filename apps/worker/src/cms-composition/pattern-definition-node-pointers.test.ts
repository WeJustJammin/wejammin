import { describe, expect, it } from 'vitest';

import {
  expectError,
  jsonReply,
  patternHarness,
  writeRequest,
} from './pattern-definition.test-support';

/*
 * DEC-228 (BE03c field matrix CMS-03C-12 `blockTree` row; P2-S12-AC-105): a cycle, depth or node-count refusal of the
 * pattern definition names the offending request node's `/blockTree/{i}(/children/{j})*` pointer. The SQL raises the token as
 * the PostgREST message and the pointer array as the DETAIL text, exactly as the DEC-210 block-rules refusal does; the
 * Worker relays the one pointer the operation's own request grammar allows and nothing else.
 */
const REASONS = [
  ['pattern_cycle', 409, 'COMPOSITION_VERSION_CONFLICT'],
  ['pattern_depth_exceeded', 422, 'COMPOSITION_VALIDATION_FAILED'],
  ['pattern_nodes_exceeded', 422, 'COMPOSITION_VALIDATION_FAILED'],
] as const;

describe.each(REASONS)(
  'CMS-03C-12 %s names the offending node (DEC-228)',
  (reason, status, code) => {
    const refuse = async (detail: unknown) => {
      const harness = patternHarness({
        reply: () =>
          jsonReply({ code: 'P0001', message: reason, details: detail }, 400),
      });
      return expectError(await harness.send(writeRequest()), status, code);
    };

    it.each([
      '/blockTree/0',
      '/blockTree/31/children/0',
      '/blockTree/1/children/1/children/0/children/0/children/0/children/0/children/0/children/0/children/0',
    ])(
      'relays the node pointer %s as one bounded violation',
      async (pointer) => {
        const error = await refuse(JSON.stringify([pointer]));
        expect(error.details).toEqual({
          reasonCode: reason,
          violations: [
            { path: pointer, code: reason, message: 'The value is invalid.' },
          ],
        });
      },
    );

    it('still relays the root /blockTree pointer, which the same grammar allows', async () => {
      const error = await refuse(JSON.stringify(['/blockTree']));
      expect(error.details).toEqual({
        reasonCode: reason,
        violations: [
          {
            path: '/blockTree',
            code: reason,
            message: 'The value is invalid.',
          },
        ],
      });
    });

    it.each([
      ['a foreign pointer', '["/secret-pointer"]'],
      ['a placement pointer', '["/roots"]'],
      ['a ten-level pointer', `["/blockTree/0${'/children/0'.repeat(9)}"]`],
      ['a three-digit root index', '["/blockTree/100"]'],
      ['prose', 'private provider'],
      ['a null DETAIL', null],
    ])('keeps only the reasonCode and drops %s', async (_label, detail) => {
      const error = await refuse(detail);
      expect(error.details).toEqual({ reasonCode: reason });
      expect(JSON.stringify(error)).not.toContain('secret-pointer');
    });

    it('relays at most one pointer, the first the grammar allows', async () => {
      const error = await refuse(
        JSON.stringify(['/secret', '/blockTree/2', '/blockTree/3']),
      );
      expect(error.details).toEqual({
        reasonCode: reason,
        violations: [
          {
            path: '/blockTree/2',
            code: reason,
            message: 'The value is invalid.',
          },
        ],
      });
    });
  },
);
