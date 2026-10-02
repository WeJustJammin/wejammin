import { describe, expect, it } from 'vitest';

import {
  AuthMfaFriendlyNameSchema,
  AuthMfaMethodSchema,
  AuthTotpCodeSchema,
  MfaFactorRemoveApiRequestSchema,
  MfaFactorRemoveRequestSchema,
  MfaFactorVerifyApiRequestSchema,
  MfaFactorVerifyRequestSchema,
  StepUpChallengeApiRequestSchema,
  StepUpChallengeRequestSchema,
  StepUpVerifyApiRequestSchema,
  StepUpVerifyRequestSchema,
  TotpEnrollmentStartApiRequestSchema,
  TotpEnrollmentStartRequestSchema,
} from './index';

const id = '018f0c45-73fe-7dc2-9c09-68f7ecf132d4';
const csrf = 'c'.repeat(32);
const strongVersion = '"3"';

describe('MFA primitives', () => {
  it('registers exactly the totp method at launch', () => {
    expect(AuthMfaMethodSchema.options).toEqual(['totp']);
    expect(AuthMfaMethodSchema.safeParse('webauthn').success).toBe(false);
    expect(AuthMfaMethodSchema.safeParse('phone').success).toBe(false);
  });

  it('trims then bounds the friendly name at 1-80 NFC characters', () => {
    expect(AuthMfaFriendlyNameSchema.parse('  Phone authenticator  ')).toBe(
      'Phone authenticator',
    );
    expect(AuthMfaFriendlyNameSchema.safeParse('a'.repeat(80)).success).toBe(
      true,
    );
    for (const bad of [
      '',
      '   ',
      'a'.repeat(81),
      'line\nbreak',
      'tab\there',
      'nul\u0000',
      'del\u007f',
      'é',
    ])
      expect(AuthMfaFriendlyNameSchema.safeParse(bad).success, bad).toBe(false);
    expect(AuthMfaFriendlyNameSchema.safeParse('é').success).toBe(true);
  });

  it('accepts exactly six ASCII digits as a code', () => {
    expect(AuthTotpCodeSchema.safeParse('123456').success).toBe(true);
    expect(AuthTotpCodeSchema.safeParse('000000').success).toBe(true);
    for (const bad of [
      '12345',
      '1234567',
      '123 456',
      '123-456',
      'abcdef',
      '12345\n',
      '١٢٣٤٥٦',
      '',
    ])
      expect(AuthTotpCodeSchema.safeParse(bad).success, bad).toBe(false);
  });
});

describe('MFA request contracts', () => {
  it('validates the strict bodies', () => {
    expect(
      TotpEnrollmentStartRequestSchema.parse({
        method: 'totp',
        friendlyName: 'Phone authenticator',
      }),
    ).toEqual({ method: 'totp', friendlyName: 'Phone authenticator' });
    expect(MfaFactorVerifyRequestSchema.parse({ code: '123456' })).toEqual({
      code: '123456',
    });
    expect(
      MfaFactorRemoveRequestSchema.safeParse({ reason: 'user_request' })
        .success,
    ).toBe(true);
    expect(
      MfaFactorRemoveRequestSchema.safeParse({ reason: 'factor_compromise' })
        .success,
    ).toBe(true);
    expect(StepUpChallengeRequestSchema.parse({ method: 'totp' })).toEqual({
      method: 'totp',
    });
    expect(
      StepUpChallengeRequestSchema.parse({ method: 'totp', factorId: id }),
    ).toEqual({ method: 'totp', factorId: id });
    expect(StepUpVerifyRequestSchema.parse({ code: '654321' })).toEqual({
      code: '654321',
    });
  });

  it.each([
    [
      'enrollment method',
      TotpEnrollmentStartRequestSchema,
      { method: 'sms', friendlyName: 'x' },
    ],
    [
      'enrollment extra key',
      TotpEnrollmentStartRequestSchema,
      { method: 'totp', friendlyName: 'x', secret: 'y' },
    ],
    [
      'enrollment missing name',
      TotpEnrollmentStartRequestSchema,
      { method: 'totp' },
    ],
    ['verify code', MfaFactorVerifyRequestSchema, { code: '12' }],
    [
      'verify extra key',
      MfaFactorVerifyRequestSchema,
      { code: '123456', factorId: id },
    ],
    ['remove reason', MfaFactorRemoveRequestSchema, { reason: 'other' }],
    ['remove missing reason', MfaFactorRemoveRequestSchema, {}],
    ['challenge method', StepUpChallengeRequestSchema, { method: 'phone' }],
    [
      'challenge factor id',
      StepUpChallengeRequestSchema,
      { method: 'totp', factorId: 'x' },
    ],
    [
      'challenge extra key',
      StepUpChallengeRequestSchema,
      { method: 'totp', sessionId: id },
    ],
    ['step-up verify code', StepUpVerifyRequestSchema, { code: 'abcdef' }],
  ])('rejects %s', (_label, schema, body) => {
    expect(schema.safeParse(body).success).toBe(false);
  });

  it('requires the strong MFA version on 17, 18, and 19 and the key only on 19', () => {
    const body = { method: 'totp', friendlyName: 'Phone' } as const;
    const base = { xCsrfToken: csrf };
    expect(
      TotpEnrollmentStartApiRequestSchema.safeParse({
        headers: { ...base, ifMatch: strongVersion },
        body,
      }).success,
    ).toBe(true);
    for (const ifMatch of [
      '3',
      'W/"3"',
      '"0"',
      '"03"',
      '*',
      '"3", "4"',
      '"9223372036854775808"',
    ])
      expect(
        TotpEnrollmentStartApiRequestSchema.safeParse({
          headers: { ...base, ifMatch },
          body,
        }).success,
        ifMatch,
      ).toBe(false);
    expect(
      TotpEnrollmentStartApiRequestSchema.safeParse({
        headers: {
          ...base,
          ifMatch: strongVersion,
          idempotencyKey: 'key-12345',
        },
        body,
      }).success,
    ).toBe(false);
    expect(
      MfaFactorVerifyApiRequestSchema.safeParse({
        factorId: id,
        headers: { ...base, ifMatch: strongVersion },
        body: { code: '123456' },
      }).success,
    ).toBe(true);
    expect(
      MfaFactorVerifyApiRequestSchema.safeParse({
        factorId: 'x',
        headers: { ...base, ifMatch: strongVersion },
        body: { code: '123456' },
      }).success,
    ).toBe(false);
    const remove = {
      factorId: id,
      headers: {
        ...base,
        ifMatch: strongVersion,
        idempotencyKey: 'remove-20261002-01',
      },
      body: { reason: 'user_request' },
    };
    expect(MfaFactorRemoveApiRequestSchema.safeParse(remove).success).toBe(
      true,
    );
    expect(
      MfaFactorRemoveApiRequestSchema.safeParse({
        ...remove,
        headers: { ...base, ifMatch: strongVersion },
      }).success,
    ).toBe(false);
  });

  it('carries only the CSRF header on the challenge and verify commands', () => {
    expect(
      StepUpChallengeApiRequestSchema.safeParse({
        headers: { xCsrfToken: csrf },
        body: { method: 'totp' },
      }).success,
    ).toBe(true);
    expect(
      StepUpChallengeApiRequestSchema.safeParse({
        headers: { xCsrfToken: csrf, ifMatch: strongVersion },
        body: { method: 'totp' },
      }).success,
    ).toBe(false);
    expect(
      StepUpVerifyApiRequestSchema.safeParse({
        challengeId: id,
        headers: { xCsrfToken: csrf },
        body: { code: '123456' },
      }).success,
    ).toBe(true);
    expect(
      StepUpVerifyApiRequestSchema.safeParse({
        challengeId: 'x',
        headers: { xCsrfToken: csrf },
        body: { code: '123456' },
      }).success,
    ).toBe(false);
    expect(
      StepUpVerifyApiRequestSchema.safeParse({
        challengeId: id,
        headers: { xCsrfToken: 'short' },
        body: { code: '123456' },
      }).success,
    ).toBe(false);
  });
});
