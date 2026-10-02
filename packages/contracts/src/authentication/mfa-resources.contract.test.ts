import { describe, expect, it } from 'vitest';

import {
  AUTH_ROUTE_POLICIES,
  AuthOperationIdSchema,
  MfaFactorsResourceSchema,
  StepUpChallengeSchema,
  StepUpResultSchema,
  TotpEnrollmentStartSchema,
  authRoutePolicies,
} from './index';

const id = '018f0c45-73fe-7dc2-9c09-68f7ecf132d4';
const id2 = '018f0c45-73fe-7dc2-9c09-68f7ecf132d5';
const time = '2026-10-02T14:00:00Z';

const factor = {
  id,
  method: 'totp',
  friendlyName: 'Phone authenticator',
  state: 'verified',
  verifiedAt: time,
  lastUsedAt: null,
  pendingExpiresAt: null,
} as const;

describe('MFA resource contracts', () => {
  const factors = {
    factors: [factor],
    allowedMethods: ['totp'],
    stepUp: { fresh: true, freshUntil: '2026-10-02T14:15:00Z' },
    version: '3',
  };

  it('describes the factor list and a fresh or absent step-up proof', () => {
    expect(MfaFactorsResourceSchema.safeParse(factors).success).toBe(true);
    expect(
      MfaFactorsResourceSchema.safeParse({
        ...factors,
        factors: [],
        stepUp: { fresh: false, freshUntil: null },
      }).success,
    ).toBe(true);
    for (const state of ['pending', 'reconciling'])
      expect(
        MfaFactorsResourceSchema.safeParse({
          ...factors,
          factors: [{ ...factor, state }],
        }).success,
      ).toBe(true);
  });

  it.each([
    ['removed state', { factors: [{ ...factor, state: 'removed' }] }],
    ['expired state', { factors: [{ ...factor, state: 'expired' }] }],
    ['eleven factors', { factors: Array.from({ length: 11 }, () => factor) }],
    [
      'provider factor id key',
      { factors: [{ ...factor, providerFactorId: id }] },
    ],
    [
      'stale proof with an expiry',
      { stepUp: { fresh: false, freshUntil: time } },
    ],
    [
      'fresh proof without an expiry',
      { stepUp: { fresh: true, freshUntil: null } },
    ],
    ['unknown method', { allowedMethods: ['sms'] }],
    ['zero version', { version: '0' }],
    ['extra key', { secret: 'x' }],
  ])('rejects %s', (_label, patch) => {
    expect(
      MfaFactorsResourceSchema.safeParse({ ...factors, ...patch }).success,
    ).toBe(false);
  });

  it('returns the one-time enrollment secret only within bounds', () => {
    const start = {
      factorId: id,
      method: 'totp',
      friendlyName: 'Phone authenticator',
      otpauthUri: 'otpauth://totp/WeJammin:artist?secret=ABC&issuer=WeJammin',
      manualEntryKey: 'A'.repeat(26),
      expiresAt: time,
      version: '4',
    };
    expect(TotpEnrollmentStartSchema.safeParse(start).success).toBe(true);
    expect(
      TotpEnrollmentStartSchema.safeParse({
        ...start,
        manualEntryKey: 'A2'.repeat(64),
      }).success,
    ).toBe(true);
    for (const patch of [
      { manualEntryKey: 'A'.repeat(25) },
      { manualEntryKey: 'A'.repeat(129) },
      { manualEntryKey: 'a'.repeat(26) },
      { manualEntryKey: '1'.repeat(26) },
      { otpauthUri: 'https://example.com/totp/x' },
      { otpauthUri: `otpauth://totp/${'x'.repeat(2048)}` },
      { friendlyName: '' },
    ])
      expect(
        TotpEnrollmentStartSchema.safeParse({ ...start, ...patch }).success,
      ).toBe(false);
  });

  it('describes the challenge and the token-free step-up result', () => {
    const challenge = {
      challengeId: id,
      method: 'totp',
      factorId: id2,
      friendlyName: 'Phone authenticator',
      expiresAt: time,
    };
    expect(StepUpChallengeSchema.safeParse(challenge).success).toBe(true);
    expect(
      StepUpChallengeSchema.safeParse({ ...challenge, providerChallengeId: id })
        .success,
    ).toBe(false);
    const result = {
      verified: true,
      method: 'totp',
      stepUpAt: time,
      freshUntil: '2026-10-02T14:10:00Z',
    };
    expect(StepUpResultSchema.safeParse(result).success).toBe(true);
    expect(
      StepUpResultSchema.safeParse({ ...result, verified: false }).success,
    ).toBe(false);
    expect(
      StepUpResultSchema.safeParse({ ...result, accessToken: 'secret' })
        .success,
    ).toBe(false);
  });
});

describe('AUTH-API-16..21 route policies (BE01a Route Registry)', () => {
  const policy = (operationId: string) =>
    authRoutePolicies.find((route) => route.operationId === operationId);

  it('registers the six operations after AUTH-API-15', () => {
    expect(AuthOperationIdSchema.options.slice(15)).toEqual([
      'AUTH-API-16',
      'AUTH-API-17',
      'AUTH-API-18',
      'AUTH-API-19',
      'AUTH-API-20',
      'AUTH-API-21',
    ]);
    expect(AUTH_ROUTE_POLICIES).toHaveLength(21);
    expect(authRoutePolicies).toHaveLength(21);
  });

  it.each([
    [
      'AUTH-API-16',
      'GET',
      '/api/v1/account/mfa/factors',
      'session',
      300,
      60,
      8_000,
      'none',
      'none',
    ],
    [
      'AUTH-API-17',
      'POST',
      '/api/v1/account/mfa/factors',
      'session_conditional_step_up',
      5,
      3600,
      15_000,
      'none',
      'required',
    ],
    [
      'AUTH-API-18',
      'POST',
      '/api/v1/account/mfa/factors/:factorId/verify',
      'session',
      10,
      900,
      15_000,
      'none',
      'required',
    ],
    [
      'AUTH-API-19',
      'DELETE',
      '/api/v1/account/mfa/factors/:factorId',
      'session_conditional_step_up',
      5,
      3600,
      15_000,
      'required',
      'required',
    ],
    [
      'AUTH-API-20',
      'POST',
      '/api/v1/auth/step-up/challenges',
      'session',
      10,
      900,
      8_000,
      'none',
      'none',
    ],
    [
      'AUTH-API-21',
      'POST',
      '/api/v1/auth/step-up/challenges/:challengeId/verify',
      'session',
      10,
      900,
      8_000,
      'none',
      'none',
    ],
  ])(
    '%s is %s %s',
    (
      operationId,
      method,
      path,
      auth,
      rateLimit,
      rateWindowSeconds,
      timeoutMs,
      idempotency,
      ifMatch,
    ) => {
      expect(policy(operationId)).toEqual({
        operationId,
        method,
        path,
        auth,
        rateLimit,
        rateWindowSeconds,
        // BE01a rate column: 16, 17 and 19 are "per user"; 18, 20 and 21 are
        // "IP+account".
        rateScope: ['AUTH-API-16', 'AUTH-API-17', 'AUTH-API-19'].includes(
          operationId,
        )
          ? 'user'
          : 'client',
        timeoutMs,
        cacheControl: 'no-store',
        idempotency,
        ifMatch,
      });
    },
  );

  it('keeps client idempotency keys off every MFA command except removal', () => {
    const keyed = authRoutePolicies
      .filter(
        ({ operationId, idempotency }) =>
          operationId >= 'AUTH-API-16' && idempotency === 'required',
      )
      .map(({ operationId }) => operationId);
    expect(keyed).toEqual(['AUTH-API-19']);
  });
});
