import { describe, expect, it } from 'vitest';

import {
  detailRequest,
  detailResource,
  expectError,
  governedHarness,
  jsonReply,
  reviewerSession,
  without,
} from './governed-review-ops.test-support';

/*
 * DEC-191: GovernedReviewDetailResource.activationSchedule is the review's most recent schedule as
 * `{state, reasonCode}` or null, with reasonCode set exactly when the state is blocked or cancelled.
 * The Worker relays a strict-valid detail unchanged; a 200 that lacks the member, types it wrongly,
 * invents a state or reason, or breaks the state/reason relation is the local 502.
 */
const make = (reply: () => Promise<Response>) =>
  governedHarness({ session: reviewerSession, reply });

const REASONS = [
  'approval_invalidated',
  'dependency_changed',
  'activation_authority_ended',
  'canonical_source_unavailable',
  'retries_exhausted',
] as const;

const RELAYED: ReadonlyArray<
  readonly [string, Record<string, unknown> | null]
> = [
  ['no schedule', null],
  ['a pending schedule', { state: 'pending', reasonCode: null }],
  ['an executing schedule', { state: 'executing', reasonCode: null }],
  ['a completed schedule', { state: 'completed', reasonCode: null }],
  [
    'a failed_retryable schedule',
    { state: 'failed_retryable', reasonCode: null },
  ],
  ...REASONS.map(
    (reasonCode) =>
      [
        `a blocked schedule (${reasonCode})`,
        { state: 'blocked', reasonCode },
      ] as const,
  ),
  [
    'a cancelled schedule (approval_invalidated)',
    { state: 'cancelled', reasonCode: 'approval_invalidated' },
  ],
];

describe('CMS-03C-10 activationSchedule (DEC-191)', () => {
  it.each(RELAYED)('relays %s unchanged', async (_name, activationSchedule) => {
    const detail = detailResource({ activationSchedule });
    const response = await make(() => jsonReply(detail)).send(detailRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(detail);
  });

  it('answers a 200 without the member as a local 502', async () => {
    const error = await expectError(
      await make(() =>
        jsonReply(without(detailResource(), 'activationSchedule')),
      ).send(detailRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
    expect(error.details).toEqual({
      dependencyClass: 'cms_composition',
      retryable: true,
    });
  });

  it.each([
    ['a string', 'pending'],
    ['an array', []],
    ['a number', 1],
    ['an unknown state', { state: 'running', reasonCode: null }],
    ['an unknown reason', { state: 'blocked', reasonCode: 'network_down' }],
    ['a missing reasonCode', { state: 'pending' }],
    ['a missing state', { reasonCode: null }],
    [
      'an extra member',
      { state: 'pending', reasonCode: null, attemptCount: 1 },
    ],
    [
      'a reason on a live schedule',
      { state: 'failed_retryable', reasonCode: 'retries_exhausted' },
    ],
    [
      'a blocked schedule without a reason',
      { state: 'blocked', reasonCode: null },
    ],
    [
      'a cancelled schedule without a reason',
      { state: 'cancelled', reasonCode: null },
    ],
  ])('answers %s as a local 502', async (_name, activationSchedule) => {
    await expectError(
      await make(() =>
        jsonReply({ ...detailResource(), activationSchedule }),
      ).send(detailRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });
});
