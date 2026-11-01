import { describe, expect, it } from 'vitest';

import {
  REVIEW_ID,
  governedDetailFixture,
  jsonResponse,
} from './cms-governed-review-fixtures.test-support';
import { forwardCmsGovernedReviewRead } from './cms-governed-review-platform-reads';
import {
  bindingFor,
  ORIGIN,
} from './cms-workflow-platform-command.test-support';

/*
 * DEC-191: the CMS-03C-10 proxy relays `activationSchedule` only when the strict
 * contract accepts it (`{state, reasonCode}` or null, a reason exactly for a
 * blocked or cancelled schedule) and refuses everything else as the 502.
 */
const read = (body: unknown) =>
  forwardCmsGovernedReviewRead(
    'CMS-03C-10',
    new Request(`${ORIGIN}/api/v1/cms/governed-reviews/${REVIEW_ID}`, {
      method: 'GET',
      headers: { cookie: 'wj_access=a; wj_csrf=csrf-token-000000000001' },
    }),
    { reviewId: REVIEW_ID },
    bindingFor(jsonResponse(200, body, { etag: '"2"' })),
  );

describe('CMS-03C-10 activationSchedule proxy (DEC-191)', () => {
  it.each([
    null,
    { state: 'executing', reasonCode: null },
    { state: 'blocked', reasonCode: 'activation_authority_ended' },
    { state: 'cancelled', reasonCode: 'approval_invalidated' },
  ])('relays a detail whose activation schedule is %j', async (schedule) => {
    const response = await read(
      governedDetailFixture({ activationSchedule: schedule }),
    );
    expect(response.status).toBe(200);
    expect(
      ((await response.json()) as { activationSchedule: unknown })
        .activationSchedule,
    ).toEqual(schedule);
  });

  it.each([
    ['a missing member', undefined],
    ['a string', 'blocked'],
    ['an unknown state', { state: 'mystery', reasonCode: null }],
    [
      'a blocked schedule without a reason',
      { state: 'blocked', reasonCode: null },
    ],
    ['an unknown reason', { state: 'blocked', reasonCode: 'mystery' }],
    [
      'a reason on a pending schedule',
      { state: 'pending', reasonCode: 'retries_exhausted' },
    ],
    [
      'a member beyond state and reasonCode',
      { state: 'pending', reasonCode: null, attemptCount: 1 },
    ],
  ])('answers 502 for %s', async (_name, activationSchedule) => {
    const response = await read({
      ...governedDetailFixture(),
      activationSchedule,
    });
    expect(response.status).toBe(502);
  });
});
