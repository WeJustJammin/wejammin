import { describe, expect, it } from 'vitest';

import {
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
