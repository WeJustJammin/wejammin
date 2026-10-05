import { describe, expect, it } from 'vitest';

import {
  Cfg05b06IdempotencyKeySchema,
  Cfg05b06MfaFactorResetRequestSchema,
  Cfg05b06MfaFactorResetResponseSchema,
} from './admin-mfa-reset.ts';

const uuid = '66666666-6666-4666-8666-666666666666';
const response = {
  resetId: '77777777-7777-4777-8777-777777777777',
  targetPersonId: uuid,
  state: 'completed',
  removedFactorCount: 2,
  mfaVersion: '8',
  outboxEventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
} as const;

describe('CFG-05B-06 MFA factor reset contract', () => {
  it('accepts exactly one target person and a trimmed reason', () => {
    expect(
      Cfg05b06MfaFactorResetRequestSchema.parse({
        targetPersonId: uuid,
        reason: '  Lost every authenticator, identity verified by phone.  ',
      }),
    ).toEqual({
      targetPersonId: uuid,
      reason: 'Lost every authenticator, identity verified by phone.',
    });
  });

  it.each([
    ['unknown operator key', { operatorPersonId: uuid }],
    ['organization key', { organizationId: uuid }],
    ['factor list', { factorIds: [uuid] }],
    ['step-up token', { stepUpToken: 'x'.repeat(24) }],
    ['target list', { targetPersonId: [uuid] }],
    ['malformed target', { targetPersonId: 'not-a-uuid' }],
    ['blank reason', { reason: '   ' }],
    ['oversized reason', { reason: 'r'.repeat(513) }],
  ])('rejects %s', (_label, patch) => {
    expect(
      Cfg05b06MfaFactorResetRequestSchema.safeParse({
        targetPersonId: uuid,
        reason: 'Lost every authenticator.',
        ...patch,
      }).success,
    ).toBe(false);
  });

  it('accepts both reset states and bounds the removed count at ten', () => {
    for (const state of ['completed', 'reconciling'] as const)
      expect(
        Cfg05b06MfaFactorResetResponseSchema.parse({ ...response, state }),
      ).toMatchObject({ state });
    for (const removedFactorCount of [0, 10])
      expect(
        Cfg05b06MfaFactorResetResponseSchema.safeParse({
          ...response,
          removedFactorCount,
        }).success,
      ).toBe(true);
    for (const removedFactorCount of [-1, 11, 1.5])
      expect(
        Cfg05b06MfaFactorResetResponseSchema.safeParse({
          ...response,
          removedFactorCount,
        }).success,
      ).toBe(false);
  });

  it('is strict so provider and Auth identifiers can never be echoed', () => {
    for (const extra of [
      { providerFactorIds: [uuid] },
      { targetAuthUserId: uuid },
      { factorCount: 1 },
    ])
      expect(
        Cfg05b06MfaFactorResetResponseSchema.safeParse({
          ...response,
          ...extra,
        }).success,
      ).toBe(false);
    expect(
      Cfg05b06MfaFactorResetResponseSchema.safeParse({
        ...response,
        mfaVersion: '0',
      }).success,
    ).toBe(false);
  });
});

describe('[P2-S09-AC-945] CFG-05B-06 idempotency key length (BE05b 16..128)', () => {
  it.each([
    ['16 characters', 'k'.repeat(16), true],
    ['128 characters', 'k'.repeat(128), true],
    ['15 characters', 'k'.repeat(15), false],
    ['8 characters', 'k'.repeat(8), false],
    ['129 characters', 'k'.repeat(129), false],
    ['leading space', ` ${'k'.repeat(16)}`, false],
    ['non printable', `${'k'.repeat(16)}\u0007`, false],
    ['null header', null, false],
  ])('%s', (_label, key, accepted) => {
    expect(Cfg05b06IdempotencyKeySchema.safeParse(key).success).toBe(accepted);
  });
});
