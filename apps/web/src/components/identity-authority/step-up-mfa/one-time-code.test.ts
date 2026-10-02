import { describe, expect, it } from 'vitest';

import {
  ONE_TIME_CODE_COPY,
  ONE_TIME_CODE_MAX_LENGTH,
  normalizeOneTimeCode,
  validateOneTimeCode,
} from './one-time-code';

/** FE01 one-time code semantics: strip spaces and hyphens, then six ASCII digits. */
describe('one-time code input semantics', () => {
  it('tolerates a pasted "123 456" within maxlength 12', () => {
    expect(ONE_TIME_CODE_MAX_LENGTH).toBe(12);
    expect('123 456'.length).toBeLessThanOrEqual(ONE_TIME_CODE_MAX_LENGTH);
  });

  it.each([
    ['123456', '123456'],
    ['123 456', '123456'],
    ['123-456', '123456'],
    [' 12 34-56 ', '123456'],
    ['1 2\t3\n4 5 6', '123456'],
  ])('normalizes %j', (raw, expected) => {
    expect(normalizeOneTimeCode(raw)).toBe(expected);
  });

  it('accepts exactly six ASCII digits', () => {
    expect(validateOneTimeCode('123 456')).toEqual({
      ok: true,
      code: '123456',
    });
  });

  it.each([
    '',
    '12345',
    '1234567',
    'abcdef',
    '12345a',
    '１２３４５６',
    '12.456',
  ])('rejects %j with the exact invalid copy and no request value', (raw) => {
    expect(validateOneTimeCode(raw)).toEqual({
      ok: false,
      message: 'Enter the 6-digit code from your authenticator app.',
    });
  });

  it('exports the exact copy for the server-reported wrong code', () => {
    expect(ONE_TIME_CODE_COPY.invalid).toBe(
      'Enter the 6-digit code from your authenticator app.',
    );
    expect(ONE_TIME_CODE_COPY.incorrect).toBe(
      "That code didn't work. Check the code and try again.",
    );
  });
});
