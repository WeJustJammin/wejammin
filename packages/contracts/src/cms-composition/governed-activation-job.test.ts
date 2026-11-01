import { describe, expect, it } from 'vitest';

import {
  hash,
  instant,
  isRefused,
  issuePaths,
  uid,
  without,
} from './composition-fixtures.test-support';
import {
  CMS_GOVERNED_ACTIVATION_JOB_TYPE,
  CMS_GOVERNED_SCHEDULE_BLOCK_REASONS,
  ClaimedGovernedActivationSchema,
  GovernedActivationClaimRequestSchema,
  GovernedActivationExecutionRequestSchema,
  GovernedActivationExecutionResultSchema,
} from './governed-activation-job';

const claimed = {
  scheduleId: uid(80),
  reviewId: uid(81),
  subjectKind: 'template_version',
  subjectId: uid(82),
  scheduleVersion: '2',
  expectedVersion: '7',
  leaseId: uid(83),
  correlationId: uid(84),
} as const;

const completed = {
  scheduleId: uid(80),
  outcome: 'completed',
  reasonCode: null,
  actualUtc: instant,
  deviationSeconds: 3,
} as const;

describe('CMS-03C-19 scheduled governed activation (OD-6)', () => {
  it('[P2-S12-AC-142] names the BE00 job type the Worker scheduled sweep runs', () => {
    expect(CMS_GOVERNED_ACTIVATION_JOB_TYPE).toBe(
      'cms.governed_activation.execute',
    );
  });

  it('[P2-S12-AC-142] takes a claim batch of 1 to 100', () => {
    for (const batch of [1, 25, 100])
      expect(GovernedActivationClaimRequestSchema.parse({ batch })).toEqual({
        batch,
      });
    for (const batch of [0, 101, -1, 1.5, '25', null, undefined])
      expect(isRefused(GovernedActivationClaimRequestSchema, { batch })).toBe(
        true,
      );
    expect(isRefused(GovernedActivationClaimRequestSchema, {})).toBe(true);
    expect(
      isRefused(GovernedActivationClaimRequestSchema, { batch: 5, lease: 1 }),
    ).toBe(true);
  });

  it('[P2-S12-AC-142] accepts a claimed record with the schedule, review, subject, versions, lease and correlation ids', () => {
    expect(ClaimedGovernedActivationSchema.parse(claimed)).toEqual(claimed);
    for (const subjectKind of [
      'template_version',
      'pattern_version',
      'taxonomy_version',
    ])
      expect(
        ClaimedGovernedActivationSchema.safeParse({ ...claimed, subjectKind })
          .success,
      ).toBe(true);
  });

  it('[P2-S12-AC-142] refuses a claimed record with a missing member, a bad id or version, or any extra member', () => {
    for (const candidate of [
      without(claimed, 'leaseId'),
      without(claimed, 'correlationId'),
      without(claimed, 'expectedVersion'),
      without(claimed, 'scheduleVersion'),
      { ...claimed, scheduleId: 'x' },
      { ...claimed, leaseId: 'x' },
      { ...claimed, scheduleVersion: '0' },
      { ...claimed, expectedVersion: 7 },
      { ...claimed, subjectKind: 'navigation_version' },
      { ...claimed, ownerId: uid(1) },
      { ...claimed, activateAt: instant },
      { ...claimed, actorPersonId: uid(1) },
    ])
      expect(isRefused(ClaimedGovernedActivationSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-143] takes the claimed schedule id, its expected version and the lease it holds', () => {
    const request = {
      scheduleId: uid(80),
      expectedVersion: '7',
      leaseId: uid(83),
    };
    expect(GovernedActivationExecutionRequestSchema.parse(request)).toEqual(
      request,
    );
    for (const candidate of [
      without(request, 'leaseId'),
      without(request, 'expectedVersion'),
      without(request, 'scheduleId'),
      { ...request, leaseId: 'x' },
      { ...request, expectedVersion: '0' },
      { ...request, reviewId: uid(1) },
    ])
      expect(
        isRefused(GovernedActivationExecutionRequestSchema, candidate),
      ).toBe(true);
  });

  it('[P2-S12-AC-142] closes the execution outcome to completed, blocked, failed_retryable and already_completed', () => {
    for (const outcome of ['completed', 'already_completed'] as const)
      expect(
        GovernedActivationExecutionResultSchema.safeParse({
          ...completed,
          outcome,
        }).success,
      ).toBe(true);
    expect(
      GovernedActivationExecutionResultSchema.safeParse({
        scheduleId: uid(80),
        outcome: 'failed_retryable',
        reasonCode: 'dependency_unavailable',
        actualUtc: null,
        deviationSeconds: null,
      }).success,
    ).toBe(true);
    for (const outcome of ['cancelled', 'pending', 'retry', 'Completed', ''])
      expect(
        isRefused(GovernedActivationExecutionResultSchema, {
          ...completed,
          outcome,
        }),
      ).toBe(true);
  });

  it('[P2-S12-AC-147] records the actual instant and deviation of a completed execution', () => {
    expect(
      issuePaths(GovernedActivationExecutionResultSchema, {
        ...completed,
        actualUtc: null,
      }),
    ).toEqual(['actualUtc']);
    expect(
      issuePaths(GovernedActivationExecutionResultSchema, {
        ...completed,
        deviationSeconds: null,
      }),
    ).toEqual(['deviationSeconds']);
    // A late run activates and records its deviation; an early one is negative.
    for (const deviationSeconds of [0, 59, 3600, -2])
      expect(
        GovernedActivationExecutionResultSchema.safeParse({
          ...completed,
          deviationSeconds,
        }).success,
      ).toBe(true);
    for (const deviationSeconds of [1.5, '3', Number.NaN])
      expect(
        isRefused(GovernedActivationExecutionResultSchema, {
          ...completed,
          deviationSeconds,
        }),
      ).toBe(true);
    expect(
      isRefused(GovernedActivationExecutionResultSchema, {
        ...completed,
        actualUtc: '2026-10-13T12:00:00',
      }),
    ).toBe(true);
  });

  it('[P2-S12-AC-143] closes a blocked schedule reason to the five terminal reasons', () => {
    expect([...CMS_GOVERNED_SCHEDULE_BLOCK_REASONS]).toEqual([
      'approval_invalidated',
      'dependency_changed',
      'activation_authority_ended',
      'canonical_source_unavailable',
      'retries_exhausted',
    ]);
    for (const reasonCode of CMS_GOVERNED_SCHEDULE_BLOCK_REASONS)
      expect(
        GovernedActivationExecutionResultSchema.safeParse({
          scheduleId: uid(80),
          outcome: 'blocked',
          reasonCode,
          actualUtc: null,
          deviationSeconds: null,
        }).success,
      ).toBe(true);
    for (const reasonCode of [
      null,
      'preflight_failed',
      'Dependency_Changed',
      '',
    ]) {
      expect(
        isRefused(GovernedActivationExecutionResultSchema, {
          scheduleId: uid(80),
          outcome: 'blocked',
          reasonCode,
          actualUtc: null,
          deviationSeconds: null,
        }),
      ).toBe(true);
    }
  });

  it('[P2-S12-AC-142] bounds the reason code grammar and refuses any extra member', () => {
    for (const reasonCode of ['a', 'a'.repeat(64)])
      expect(
        GovernedActivationExecutionResultSchema.safeParse({
          scheduleId: uid(80),
          outcome: 'failed_retryable',
          reasonCode,
          actualUtc: null,
          deviationSeconds: null,
        }).success,
      ).toBe(true);
    for (const candidate of [
      { ...completed, reasonCode: 'Bad Code' },
      { ...completed, reasonCode: 'a'.repeat(65) },
      { ...completed, reasonCode: '9starts_with_digit' },
      { ...completed, reviewId: uid(1) },
      { ...completed, subjectHash: hash },
      without(completed, 'actualUtc'),
      without(completed, 'deviationSeconds'),
      without(completed, 'reasonCode'),
      { ...completed, scheduleId: 'x' },
    ])
      expect(
        isRefused(GovernedActivationExecutionResultSchema, candidate),
      ).toBe(true);
  });
});
