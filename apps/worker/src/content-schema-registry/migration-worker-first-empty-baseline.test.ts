import { describe, expect, it, vi } from 'vitest';

import {
  MIGRATION_STATES,
  SCHEMA_MIGRATION_RPC,
} from './migration-worker-constants';
import { createSchemaMigrationWorker } from './migration-worker-engine';
import { MigrationPlanRecordSchema } from './migration-worker-plan-record-schema';
import type { MigrationPlanRecord } from './migration-worker-plan-types';
import type { MigrationWorkerPort } from './migration-worker-types';
import {
  basePlan,
  HASH,
  job,
  NOW,
  OLD_VERSION_ID,
  PLAN_ID,
  TARGET_VERSION_ID,
} from './migration-worker-test-support';

const ZERO_HASH = '0'.repeat(64);
const LATER_VERSION_ID = '80000000-0000-4000-8000-000000000008';
const COUNTERS = [
  'cursor',
  'sourceCount',
  'targetCount',
  'rowErrorCount',
  'migratedCount',
  'failedCount',
] as const;
const ACTIVE_VARIANTS = [
  { label: 'target active', activeVersionId: TARGET_VERSION_ID },
  { label: 'later scoped version active', activeVersionId: LATER_VERSION_ID },
  { label: 'awaiting reviewed activation', activeVersionId: null },
] as const;

// These records test shape only. Provisional zeros do not prove firstness,
// candidate version/type/owner authority, SQL emptiness, or scanner/seal fences.
const firstPlan = (
  overrides: Partial<MigrationPlanRecord> = {},
): MigrationPlanRecord =>
  basePlan({
    fromVersionId: null,
    activeVersionId: null,
    state: 'draft',
    classification: 'additive',
    transformKey: null,
    transformVersion: null,
    sourceHash: ZERO_HASH,
    sourceCount: '0',
    targetCount: '0',
    rowErrorCount: '0',
    migratedCount: '0',
    failedCount: '0',
    cursor: '0',
    ...overrides,
  });

describe('DEC-162 first-empty migration plan boundary', () => {
  it('DEC-162 preserves own null IDs and canonical provisional zeros in a pending additive plan', () => {
    const input = firstPlan();
    const parsed = MigrationPlanRecordSchema.parse(input);

    expect(parsed).toEqual(input);
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(input).sort());
    expect(Object.hasOwn(parsed, 'fromVersionId')).toBe(true);
    expect(Object.hasOwn(parsed, 'activeVersionId')).toBe(true);
    expect(parsed.fromVersionId).toBeNull();
    expect(parsed.activeVersionId).toBeNull();
    expect(parsed.sourceHash).toBe(ZERO_HASH);
    expect(parsed.transformKey).toBeNull();
    expect(parsed.transformVersion).toBeNull();
    for (const field of COUNTERS) expect(parsed[field]).toBe('0');
  });

  it.each(MIGRATION_STATES.filter((state) => state !== 'completed'))(
    'DEC-162 requires null active for noncompleted first-null state %s',
    (state) => {
      expect(
        MigrationPlanRecordSchema.parse(firstPlan({ state })).activeVersionId,
      ).toBeNull();
      for (const activeVersionId of [TARGET_VERSION_ID, LATER_VERSION_ID]) {
        expect(
          MigrationPlanRecordSchema.safeParse(
            firstPlan({ state, activeVersionId }),
          ).success,
        ).toBe(false);
      }
    },
  );

  it.each(ACTIVE_VARIANTS)(
    'DEC-162 accepts completed first-null shape with $label',
    ({ activeVersionId }) => {
      const input = firstPlan({
        state: 'completed',
        progress: 1,
        activeVersionId,
      });
      const parsed = MigrationPlanRecordSchema.parse(input);

      expect(parsed).toEqual(input);
      expect(Object.hasOwn(parsed, 'fromVersionId')).toBe(true);
      expect(Object.hasOwn(parsed, 'activeVersionId')).toBe(true);
      expect(parsed.fromVersionId).toBeNull();
      expect(parsed.activeVersionId).toBe(activeVersionId);
    },
  );

  it.each(['conditional', 'breaking'] as const)(
    'DEC-162 rejects first-null %s classification even with a valid transform pair',
    (classification) => {
      for (const state of ['draft', 'completed'] as const) {
        expect(
          MigrationPlanRecordSchema.safeParse(
            firstPlan({
              state,
              classification,
              transformKey: 'identity.revalidate',
              transformVersion: '1',
            }),
          ).success,
        ).toBe(false);
      }
    },
  );

  it.each([
    { transformKey: 'identity.revalidate', transformVersion: '1' },
    { transformKey: 'identity.revalidate', transformVersion: null },
    { transformKey: null, transformVersion: '1' },
  ])('DEC-162 rejects first-null transform pair %j', (pair) => {
    for (const state of ['draft', 'completed'] as const) {
      expect(
        MigrationPlanRecordSchema.safeParse(firstPlan({ state, ...pair }))
          .success,
      ).toBe(false);
    }
  });

  it.each(COUNTERS)(
    'DEC-162 rejects nonzero or noncanonical first-null %s',
    (field) => {
      for (const state of ['draft', 'completed'] as const) {
        for (const value of ['1', '01', '-1', 0, undefined]) {
          expect(
            MigrationPlanRecordSchema.safeParse({
              ...firstPlan({ state }),
              [field]: value,
            }).success,
          ).toBe(false);
        }
      }
    },
  );

  it.each([HASH, '0'.repeat(63), 'G'.repeat(64), undefined])(
    'DEC-162 rejects nonzero or malformed first-null source fingerprint %s',
    (sourceHash) => {
      for (const state of ['draft', 'completed'] as const) {
        expect(
          MigrationPlanRecordSchema.safeParse({
            ...firstPlan({ state }),
            sourceHash,
          }).success,
        ).toBe(false);
      }
    },
  );

  it.each([
    'id',
    'contentTypeId',
    'fromVersionId',
    'toVersionId',
    'activeVersionId',
  ])('DEC-162 retains strict UUID validation for %s', (field) => {
    for (const value of ['invalid-uuid', '', undefined, 1]) {
      expect(
        MigrationPlanRecordSchema.safeParse({
          ...firstPlan({ state: 'completed' }),
          [field]: value,
        }).success,
      ).toBe(false);
    }
  });

  it.each(['id', 'contentTypeId', 'toVersionId'])(
    'DEC-162 does not extend nullability to %s',
    (field) => {
      expect(
        MigrationPlanRecordSchema.safeParse({
          ...firstPlan(),
          [field]: null,
        }).success,
      ).toBe(false);
    },
  );

  it.each(Object.keys(firstPlan()))(
    'DEC-162 requires own plan key %s',
    (field) => {
      const missing = Object.fromEntries(
        Object.entries(firstPlan()).filter(([key]) => key !== field),
      );
      expect(MigrationPlanRecordSchema.safeParse(missing).success).toBe(false);
    },
  );

  it('DEC-162 rejects unknown keys and malformed unchanged hash/version fields', () => {
    expect(
      MigrationPlanRecordSchema.safeParse({ ...firstPlan(), extra: true })
        .success,
    ).toBe(false);
    for (const field of ['compilerHash', 'targetHash']) {
      for (const value of ['0'.repeat(63), 'A'.repeat(64), undefined]) {
        expect(
          MigrationPlanRecordSchema.safeParse({
            ...firstPlan(),
            [field]: value,
          }).success,
        ).toBe(false);
      }
    }
    for (const version of ['0', '01', undefined]) {
      expect(
        MigrationPlanRecordSchema.safeParse({ ...firstPlan(), version })
          .success,
      ).toBe(false);
    }
  });

  it.each(['additive', 'conditional', 'breaking'] as const)(
    'DEC-162 preserves regular %s successor acceptance and rejects null active or source equal to target',
    (classification) => {
      const plan = basePlan({
        classification,
        transformKey:
          classification === 'additive' ? null : 'identity.revalidate',
        transformVersion: classification === 'additive' ? null : '1',
      });
      expect(MigrationPlanRecordSchema.parse(plan)).toEqual(plan);
      expect(plan.fromVersionId).toBe(OLD_VERSION_ID);
      expect(
        MigrationPlanRecordSchema.safeParse({ ...plan, activeVersionId: null })
          .success,
      ).toBe(false);
      expect(
        MigrationPlanRecordSchema.safeParse({
          ...plan,
          fromVersionId: TARGET_VERSION_ID,
        }).success,
      ).toBe(false);
    },
  );

  it.each(ACTIVE_VARIANTS)(
    'DEC-162 completed first-null job replay with $label only reads the plan',
    async ({ activeVersionId }) => {
      const plan = firstPlan({
        state: 'completed',
        version: '8',
        progress: 1,
        activeVersionId,
      });
      // A controlled transport response is not real producer or SQL evidence.
      const call = vi.fn<MigrationWorkerPort['call']>(async (rpc) => {
        if (rpc !== SCHEMA_MIGRATION_RPC.readPlan)
          throw new Error(`Unexpected RPC: ${rpc}`);
        return plan;
      });
      const worker = createSchemaMigrationWorker({
        port: { call },
        workerId: 'worker-first-empty',
        now: () => NOW,
      });
      const signal = new AbortController().signal;

      const result = await worker.process(job, { replay: true, signal });

      expect(call.mock.calls).toEqual([
        [
          SCHEMA_MIGRATION_RPC.readPlan,
          {
            migrationPlanId: PLAN_ID,
            schemaVersionId: TARGET_VERSION_ID,
            expectedVersion: job.expectedVersion,
          },
          signal,
        ],
      ]);
      expect(result).toEqual({
        outcome: 'completed',
        migrationPlanId: PLAN_ID,
        schemaVersionId: TARGET_VERSION_ID,
        eventId: null,
        state: 'completed',
        cursor: '0',
        progress: 1,
        retryAfterMs: null,
        reasonCode: null,
        activationSwitched: false,
      });
      expect(plan.fromVersionId).toBeNull();
      expect(plan.activeVersionId).toBe(activeVersionId);
    },
  );
});
