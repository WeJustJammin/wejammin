import { describe, expect, it } from 'vitest';

import {
  governedActivationFixture,
  governedRetiredFixture,
  governedScheduledFixture,
} from '../../server/cms-governed-review-fixtures.test-support';
import { ok, send } from './governed-activation-transport.test-support';
import {
  activateInput,
  retireInput,
  scheduleInput,
} from './governed-review-transport.test-support';

/*
 * DEC-191 in the browser's CMS-03C-09 commit verification: `supersededVersion`
 * reaches the form as the proxy parsed it, and an answer the contract would
 * refuse is an unknown outcome, never a committed one.
 */
describe('CMS-03C-09 supersededVersion verification', () => {
  it('carries the superseded version, or null for a first activation, to the form (DEC-191)', async () => {
    for (const supersededVersion of [1, 7, null]) {
      const { result } = send(
        activateInput,
        ok(200, governedActivationFixture({ supersededVersion }), '"3"'),
      );
      expect(await result).toMatchObject({
        kind: 'committed',
        resource: { supersededVersion },
      });
    }
    for (const [input, response] of [
      [scheduleInput, ok(202, governedScheduledFixture(), '"2"')],
      [retireInput, ok(200, governedRetiredFixture(), '"3"')],
    ] as const)
      expect(await send(input, response).result).toMatchObject({
        kind: 'committed',
        resource: { supersededVersion: null },
      });
  });

  const NO_SUPERSEDED: ReadonlyArray<readonly [string, unknown, Response]> = [
    [
      'an activation without its superseded version member',
      activateInput,
      ok(
        200,
        { ...governedActivationFixture(), supersededVersion: undefined },
        '"3"',
      ),
    ],
    ...['2', 0, -1, 1.5, true, {}].map(
      (supersededVersion): readonly [string, unknown, Response] => [
        `an activation whose superseded version is ${JSON.stringify(supersededVersion)}`,
        activateInput,
        ok(200, { ...governedActivationFixture(), supersededVersion }, '"3"'),
      ],
    ),
    [
      'a retirement that names a superseded version',
      retireInput,
      ok(200, { ...governedRetiredFixture(), supersededVersion: 1 }, '"3"'),
    ],
    [
      'a schedule that names a superseded version',
      scheduleInput,
      ok(202, { ...governedScheduledFixture(), supersededVersion: 1 }, '"2"'),
    ],
  ];

  it.each(NO_SUPERSEDED)(
    'treats %s as an unknown outcome (DEC-191)',
    async (_name, input, response) => {
      const { result } = send(input, response);
      expect(await result).toEqual({ kind: 'unknown', requestId: null });
    },
  );
});
