import { describe, expect, it } from 'vitest';

import {
  isRefused,
  issuePaths,
  uid,
  without,
} from './composition-fixtures.test-support';
import { GovernedReviewDetailResourceSchema } from './governed-review-read';
import { detail } from './governed-review-read.test-support';

describe('CMS-03C-10 governed review detail: activationSchedule (DEC-191)', () => {
  it('[P2-S12-AC-088] projects the most recent activation schedule as state and closed reason, or null (DEC-191)', () => {
    const states = [
      'pending',
      'executing',
      'completed',
      'failed_retryable',
      'blocked',
      'cancelled',
    ] as const;
    const reasons = [
      'approval_invalidated',
      'dependency_changed',
      'activation_authority_ended',
      'canonical_source_unavailable',
      'retries_exhausted',
    ] as const;
    expect(
      GovernedReviewDetailResourceSchema.parse(detail).activationSchedule,
    ).toBeNull();
    for (const state of states.filter(
      (candidate) => candidate !== 'blocked' && candidate !== 'cancelled',
    ))
      expect(
        GovernedReviewDetailResourceSchema.parse({
          ...detail,
          activationSchedule: { state, reasonCode: null },
        }).activationSchedule,
      ).toEqual({ state, reasonCode: null });
    for (const state of ['blocked', 'cancelled'] as const)
      for (const reasonCode of reasons)
        expect(
          GovernedReviewDetailResourceSchema.parse({
            ...detail,
            activationSchedule: { state, reasonCode },
          }).activationSchedule,
        ).toEqual({ state, reasonCode });
  });

  it('[P2-S12-AC-088] has a reasonCode exactly when the schedule is blocked or cancelled (DEC-191, the table CHECK)', () => {
    for (const state of [
      'pending',
      'executing',
      'completed',
      'failed_retryable',
    ] as const)
      expect(
        issuePaths(GovernedReviewDetailResourceSchema, {
          ...detail,
          activationSchedule: { state, reasonCode: 'retries_exhausted' },
        }),
      ).toEqual(['activationSchedule.reasonCode']);
    for (const state of ['blocked', 'cancelled'] as const)
      expect(
        issuePaths(GovernedReviewDetailResourceSchema, {
          ...detail,
          activationSchedule: { state, reasonCode: null },
        }),
      ).toEqual(['activationSchedule.reasonCode']);
  });

  it('[P2-S12-AC-088] closes the activation schedule to its two members, six states and five reasons', () => {
    for (const activationSchedule of [
      { state: 'running', reasonCode: null },
      { state: 'blocked', reasonCode: 'network_down' },
      { state: 'blocked', reasonCode: '' },
      { state: 'blocked', reasonCode: 'Retries_Exhausted' },
      { state: 'pending' },
      { reasonCode: null },
      { state: 'pending', reasonCode: null, attemptCount: 1 },
      {
        state: 'blocked',
        reasonCode: 'dependency_changed',
        scheduleId: uid(1),
      },
      { state: 'pending', reasonCode: undefined },
      [],
      'pending',
    ])
      expect(
        isRefused(GovernedReviewDetailResourceSchema, {
          ...detail,
          activationSchedule,
        }),
      ).toBe(true);
    expect(
      isRefused(
        GovernedReviewDetailResourceSchema,
        without(detail, 'activationSchedule'),
      ),
    ).toBe(true);
  });
});
