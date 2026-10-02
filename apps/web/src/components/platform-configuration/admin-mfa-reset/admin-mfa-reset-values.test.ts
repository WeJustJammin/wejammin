import { describe, expect, it } from 'vitest';

import {
  ADMIN_RESET_COPY,
  REASON_MAX_LENGTH,
  buildResetRequest,
  validateResetValues,
} from './admin-mfa-reset-values';

const PERSON = '0195b6f0-0000-7000-8000-0000000000aa';

/** FE05 AdminMfaFactorResetForm field rules. */
describe('validateResetValues', () => {
  it('accepts a UUID and a trimmed reason of 1 to 512 characters', () => {
    expect(
      validateResetValues({ targetPersonId: PERSON, reason: 'Lost phone' }),
    ).toEqual({});
    expect(
      validateResetValues({
        targetPersonId: PERSON,
        reason: ` ${'a'.repeat(REASON_MAX_LENGTH)} `,
      }),
    ).toEqual({});
  });

  it('rejects a malformed or empty person ID', () => {
    for (const targetPersonId of [
      '',
      'not-a-uuid',
      `${PERSON} x`,
      PERSON.slice(1),
    ]) {
      expect(
        validateResetValues({ targetPersonId, reason: 'ok' }).targetPersonId,
      ).toBe(ADMIN_RESET_COPY.personInvalid);
    }
  });

  it('tolerates surrounding whitespace around the person ID', () => {
    expect(
      validateResetValues({ targetPersonId: `  ${PERSON}  `, reason: 'ok' }),
    ).toEqual({});
  });

  it('rejects an empty, blank or 513-character reason', () => {
    for (const reason of ['', '   ', 'a'.repeat(REASON_MAX_LENGTH + 1)]) {
      expect(
        validateResetValues({ targetPersonId: PERSON, reason }).reason,
      ).toBe(ADMIN_RESET_COPY.reasonInvalid);
    }
  });

  it('reports both fields together', () => {
    expect(validateResetValues({ targetPersonId: 'x', reason: '' })).toEqual({
      targetPersonId: ADMIN_RESET_COPY.personInvalid,
      reason: ADMIN_RESET_COPY.reasonInvalid,
    });
  });
});

describe('buildResetRequest', () => {
  it('builds a strict body of exactly targetPersonId and the trimmed reason', () => {
    expect(
      buildResetRequest({
        targetPersonId: ` ${PERSON} `,
        reason: '  Lost phone  ',
      }),
    ).toEqual({
      targetPersonId: PERSON,
      reason: 'Lost phone',
    });
  });

  it('returns null for invalid values', () => {
    expect(buildResetRequest({ targetPersonId: 'x', reason: 'ok' })).toBeNull();
    expect(
      buildResetRequest({ targetPersonId: PERSON, reason: '' }),
    ).toBeNull();
  });
});
