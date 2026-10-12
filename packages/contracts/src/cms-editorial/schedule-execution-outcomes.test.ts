import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  ScheduleExecutionResultSchema,
  ScheduleReasonCodeSchema,
} from './index';
import { uid, validExecutionCompleted } from './workflow-fixtures.test-support';

/**
 * P2-S11-AC-079 as ratified by DEC-177 (2026-10-12): the Worker `scheduled` sweep's execution result has exactly five
 * outcomes. `cancelled` is the executor's own outcome for a schedule whose entry is no longer `active` (BE03b
 * CMS-03B-20 over DEC-158(d), implemented by DEC-173) and carries only the reason `entry_unavailable`.
 */

/** The five outcomes of AC-079 as DEC-177 lists them, in the order the criterion names them. */
const FIVE_OUTCOMES = [
  'completed',
  'blocked',
  'failed_retryable',
  'cancelled',
  'already_completed',
] as const;

/** A result with no publication evidence, the shape of every outcome except `completed` and `already_completed`. */
const noEvidence = {
  scheduleId: uid(1),
  publicationVersionId: null,
  actualUtc: null,
  deviationSeconds: null,
} as const;

/** The canonical, valid result of each outcome. */
const canonical = {
  completed: validExecutionCompleted,
  blocked: {
    ...noEvidence,
    outcome: 'blocked',
    reasonCode: 'approval_invalidated',
  },
  failed_retryable: {
    ...noEvidence,
    outcome: 'failed_retryable',
    reasonCode: null,
  },
  cancelled: {
    ...noEvidence,
    outcome: 'cancelled',
    reasonCode: 'entry_unavailable',
  },
  already_completed: {
    ...noEvidence,
    outcome: 'already_completed',
    reasonCode: null,
  },
} as const;

const accepted = (value: unknown): boolean =>
  ScheduleExecutionResultSchema.safeParse(value).success;

/** The cancelled result without one member (the lint-clean way to build a result missing a key). */
const without = (key: string): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(canonical.cancelled).filter(([name]) => name !== key),
  );

describe('[P2-S11-AC-079] ScheduleExecutionResult outcomes (CMS-03B-20, DEC-177)', () => {
  it('parses each of exactly five outcomes: completed, blocked, failed_retryable, cancelled and already_completed', () => {
    for (const outcome of FIVE_OUTCOMES) {
      const value = canonical[outcome];
      expect(
        ScheduleExecutionResultSchema.parse(value),
        `${outcome} parses unchanged`,
      ).toEqual(value);
    }
  });

  it('declares exactly those five outcome members in the schema the Worker and the database share', () => {
    const declared = z.toJSONSchema(ScheduleExecutionResultSchema, {
      io: 'input',
    }) as { properties: { outcome: { enum: readonly string[] } } };
    expect([...declared.properties.outcome.enum].sort()).toEqual(
      [...FIVE_OUTCOMES].sort(),
    );
    expect(Object.keys(canonical).sort()).toEqual([...FIVE_OUTCOMES].sort());
  });

  it('refuses every other outcome, including the schedule states that are not execution outcomes', () => {
    // The probe is the reasonless, evidence-free result of `failed_retryable`: it satisfies every coupling rule, so an
    // outcome name the schema wrongly admitted would be accepted, and only the closed outcome list can refuse it.
    for (const outcome of [
      // the other states of a publication schedule
      'pending',
      'executing',
      'failed',
      'failed_permanent',
      // near misses of the five names
      'canceled',
      'cancel',
      'complete',
      'block',
      'blocked_retryable',
      'retryable',
      'already_complete',
      'Completed',
      'CANCELLED',
      ' cancelled',
      'cancelled ',
      // invented outcomes
      'queued',
      'skipped',
      'expired',
      'deferred',
      'superseded',
      'rejected',
      'unknown',
      '',
    ])
      expect(
        accepted({ ...canonical.failed_retryable, outcome }),
        `reasonless, evidence-free result with outcome ${JSON.stringify(outcome)}`,
      ).toBe(false);
    for (const outcome of [null, undefined, 0, 1, true, {}, ['cancelled']])
      expect(
        accepted({ ...canonical.failed_retryable, outcome }),
        `non-string outcome ${JSON.stringify(outcome)}`,
      ).toBe(false);
    expect(accepted(without('outcome'))).toBe(false);
  });

  it('accepts cancelled only with the reason entry_unavailable', () => {
    expect(accepted(canonical.cancelled)).toBe(true);
    for (const reasonCode of ScheduleReasonCodeSchema.options.filter(
      (reason) => reason !== 'entry_unavailable',
    ))
      expect(
        accepted({ ...canonical.cancelled, reasonCode }),
        `cancelled with ${reasonCode}`,
      ).toBe(false);
    for (const reasonCode of [
      null,
      undefined,
      '',
      'made_up',
      'ENTRY_UNAVAILABLE',
    ])
      expect(
        accepted({ ...canonical.cancelled, reasonCode }),
        `cancelled with ${String(reasonCode)}`,
      ).toBe(false);
  });

  it('keeps entry_unavailable out of every other outcome and publication evidence out of cancelled', () => {
    for (const outcome of FIVE_OUTCOMES.filter((name) => name !== 'cancelled'))
      expect(
        accepted({ ...canonical[outcome], reasonCode: 'entry_unavailable' }),
        `${outcome} with entry_unavailable`,
      ).toBe(false);
    for (const evidence of [
      { publicationVersionId: uid(3) },
      { actualUtc: '2026-11-01T14:30:07Z' },
      { deviationSeconds: 7 },
    ])
      expect(
        accepted({ ...canonical.cancelled, ...evidence }),
        `cancelled carrying ${Object.keys(evidence)[0]}`,
      ).toBe(false);
  });
});
