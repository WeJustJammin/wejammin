import { describe, expect, it } from 'vitest';

import { createSchemaMigrationWorker } from './migration-worker-engine';
import { MigrationPlanRecordSchema } from './migration-worker-plan-record-schema';
import type { MigrationPlanRecord } from './migration-worker-plan-types';
import { isSafeToken, isUuid } from './migration-worker-schema-core';
import { basePlan } from './migration-worker-test-support';
import { readAcquired } from './migration-worker-validation';

const NUMERIC_UUIDS = [...'0123456789'].map((digit) => ({
  label: `numeric-leading UUID ${digit}`,
  token: `${digit}2345678-1234-4abc-8def-123456789abc`,
}));
const VALID_TOKENS = [
  ...NUMERIC_UUIDS,
  {
    label: 'letter-leading UUID a',
    token: 'abcdefab-1234-4abc-8def-123456789abc',
  },
  {
    label: 'letter-leading UUID f',
    token: 'fedcbafe-1234-4abc-8def-123456789abc',
  },
  { label: 'legacy opaque token', token: 'token' },
  { label: 'legacy hyphenated token', token: 'lease-1' },
  { label: 'legacy punctuation token', token: 'Lease_1.part:resume-1' },
  { label: 'maximum-length opaque token', token: 'L'.repeat(200) },
];
const INVALID_TOKENS: ReadonlyArray<
  Readonly<{ label: string; token: unknown }>
> = [
  { label: 'numeric-leading opaque token', token: '1lease' },
  { label: 'numeric string', token: '0' },
  {
    label: 'UUID with nonhex digit',
    token: '1234567g-1234-4abc-8def-123456789abc',
  },
  { label: 'truncated UUID', token: '12345678-1234-4abc-8def-123456789ab' },
  {
    label: 'invalid UUID variant',
    token: '12345678-1234-4abc-7def-123456789abc',
  },
  { label: 'UUID without hyphens', token: '1234567812344abc8def123456789abc' },
  {
    label: 'leading whitespace',
    token: ' 12345678-1234-4abc-8def-123456789abc',
  },
  {
    label: 'trailing whitespace',
    token: '12345678-1234-4abc-8def-123456789abc ',
  },
  { label: 'unsafe slash', token: 'lease/token' },
  { label: 'newline', token: 'lease\ntoken' },
  { label: 'empty token', token: '' },
  { label: 'over-budget token', token: 'L'.repeat(201) },
  { label: 'undefined token', token: undefined },
  { label: 'zero scalar', token: 0 },
  { label: 'numeric scalar', token: 1 },
  { label: 'false scalar', token: false },
  { label: 'true scalar', token: true },
  { label: 'array', token: ['lease-1'] },
  { label: 'object', token: { leaseToken: 'lease-1' } },
];

// Deterministic transport shapes, not SQL lease ownership or activation proof.
// UUID lease fixtures are distinct from the schema/version identities in basePlan.
const leasedPlan = (leaseToken: string | null): MigrationPlanRecord =>
  basePlan({
    state: 'dry_running',
    version: '8',
    leaseOwner: 'worker-lease',
    leaseToken,
    leaseExpiresAt: '2026-09-02T12:00:30.000Z',
  });

const expectInvalidAcquisition = (input: unknown): void => {
  let failure: unknown;
  try {
    readAcquired(input);
  } catch (error) {
    failure = error;
  }
  expect(failure).toEqual({
    code: 'DEPENDENCY_INVALID_RESPONSE',
    retryable: false,
  });
};

describe('SQL UUID lease-token compatibility', () => {
  it.each(VALID_TOKENS)(
    'lease decoder preserves $label without a nested plan',
    ({ token }) => {
      expect(readAcquired({ acquired: true, leaseToken: token })).toStrictEqual(
        {
          acquired: true,
          leaseToken: token,
          plan: null,
          reasonCode: null,
        },
      );
    },
  );

  it.each(VALID_TOKENS)(
    'lease decoder preserves $label and every nested plan field',
    ({ token }) => {
      const plan = leasedPlan(token);
      expect(
        readAcquired({ acquired: true, leaseToken: token, plan }),
      ).toStrictEqual({
        acquired: true,
        leaseToken: token,
        plan,
        reasonCode: null,
      });
    },
  );

  it.each(VALID_TOKENS)(
    'standalone plan preserves $label and every canonical field',
    ({ token }) => {
      const plan = leasedPlan(token);
      const parsed = MigrationPlanRecordSchema.parse(plan);
      expect(parsed).toStrictEqual(plan);
      expect(Object.hasOwn(parsed, 'leaseToken')).toBe(true);
      expect(parsed.leaseToken).toBe(token);
    },
  );

  it.each(INVALID_TOKENS)(
    'lease decoder rejects $label with the existing dependency failure',
    ({ token }) => {
      expectInvalidAcquisition({ acquired: true, leaseToken: token });
    },
  );

  it.each(INVALID_TOKENS)(
    'standalone plan rejects $label at its lease-token field',
    ({ token }) => {
      expect(
        MigrationPlanRecordSchema.safeParse({
          ...leasedPlan('lease-1'),
          leaseToken: token,
        }),
      ).toStrictEqual({
        success: false,
        error: {
          issues: [{ path: ['leaseToken'], message: 'leaseToken is invalid' }],
        },
      });
    },
  );

  it.each(INVALID_TOKENS)(
    'lease decoder rejects nested-plan $label despite a valid acquired token',
    ({ token }) => {
      expectInvalidAcquisition({
        acquired: true,
        leaseToken: 'lease-1',
        plan: { ...leasedPlan('lease-1'), leaseToken: token },
      });
    },
  );

  it('lease decoder rejects a null acquired token and an omitted acquired token', () => {
    expectInvalidAcquisition({ acquired: true, leaseToken: null });
    expectInvalidAcquisition({ acquired: true });
  });

  it('standalone plan preserves its nullable lease token before acquisition', () => {
    const plan = basePlan({ state: 'draft' });
    const parsed = MigrationPlanRecordSchema.parse(plan);
    expect(parsed).toStrictEqual(plan);
    expect(Object.hasOwn(parsed, 'leaseToken')).toBe(true);
    expect(parsed.leaseToken).toBeNull();
  });

  it.each(NUMERIC_UUIDS)(
    'lease compatibility does not widen nonlease lexical rules for $label',
    ({ token }) => {
      expect(isUuid(token)).toBe(true);
      expect(isSafeToken(token, 200)).toBe(false);
      for (const field of ['leaseOwner', 'transformKey']) {
        expect(
          MigrationPlanRecordSchema.safeParse({
            ...leasedPlan('lease-1'),
            [field]: token,
          }).success,
        ).toBe(false);
      }
      expect(() =>
        createSchemaMigrationWorker({
          workerId: token,
          port: {
            call: async () => {
              throw new Error('Unexpected RPC');
            },
          },
        }),
      ).toThrow('workerId must be a safe token');
    },
  );

  it('lease compatibility preserves strict plan keys, identities, hashes and counters', () => {
    const plan = leasedPlan('lease-1');
    const withoutToken = Object.fromEntries(
      Object.entries(plan).filter(([key]) => key !== 'leaseToken'),
    );
    const invalidPlans = [
      withoutToken,
      { ...plan, extra: true },
      { ...plan, id: 'not-a-uuid' },
      { ...plan, fromVersionId: plan.toVersionId },
      { ...plan, compilerHash: 'a'.repeat(63) },
      { ...plan, cursor: '01' },
      { ...plan, sourceCount: '-1' },
    ];
    for (const invalid of invalidPlans) {
      expect(MigrationPlanRecordSchema.safeParse(invalid).success).toBe(false);
      expectInvalidAcquisition({
        acquired: true,
        leaseToken: 'lease-1',
        plan: invalid,
      });
    }
  });
});
