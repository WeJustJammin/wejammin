import { describe, expect, it } from 'vitest';

import {
  GRANT_ERROR_COPY,
  grantTermFieldError,
  validateGrantFields,
  validateRenewalFields,
  validateRevocationFields,
  violationFieldErrors,
} from './cms-capability-grant-validation';

const WINDOW = { minDate: '2026-10-02', maxDate: '2026-12-30' } as const;
const UUID = 'f08a3c62-91d4-7b5e-a620-4c7e1d9b08f3';
const valid = {
  subjectPersonId: UUID,
  capability: 'cms.author',
  validThrough: '2026-12-30',
  reason: '',
};

describe('[DEC-119/120] grant form validation', () => {
  it('accepts a complete form and the window ends inclusively', () => {
    expect(validateGrantFields(valid, WINDOW)).toStrictEqual({});
    expect(
      validateGrantFields({ ...valid, validThrough: WINDOW.minDate }, WINDOW),
    ).toStrictEqual({});
  });

  it('uses the exact FE03 copy for each field', () => {
    expect(GRANT_ERROR_COPY.person).toBe("Enter the person's ID as a UUID.");
    expect(GRANT_ERROR_COPY.capability).toBe(
      'Choose a capability from the list.',
    );
    expect(GRANT_ERROR_COPY.reason).toBe('Keep the reason to 256 characters.');
    expect(GRANT_ERROR_COPY.serverTerm).toBe(
      'Choose an end date no more than 90 days from today (UTC).',
    );
    expect(grantTermFieldError(WINDOW)).toBe(
      'Choose an end date from 2026-10-02 through 2026-12-30 (UTC).',
    );
  });

  it.each([
    ['person', { subjectPersonId: 'abc' }, 'person'],
    ['person (blank)', { subjectPersonId: '' }, 'person'],
    ['capability (blank)', { capability: '' }, 'capability'],
    [
      'capability (assignment-only)',
      { capability: 'cms.schema_review' },
      'capability',
    ],
    ['valid through (blank)', { validThrough: '' }, 'validThrough'],
    [
      'valid through (yesterday)',
      { validThrough: '2026-10-01' },
      'validThrough',
    ],
    [
      'valid through (today + 90)',
      { validThrough: '2026-12-31' },
      'validThrough',
    ],
    [
      'valid through (not a real date)',
      { validThrough: '2026-02-30' },
      'validThrough',
    ],
    [
      'valid through (wrong shape)',
      { validThrough: '30/12/2026' },
      'validThrough',
    ],
    ['reason (257 chars)', { reason: 'x'.repeat(257) }, 'reason'],
  ])('flags %s', (_name, patch, field) => {
    const errors = validateGrantFields(
      { ...valid, ...patch },
      WINDOW,
    ) as Record<string, string>;
    expect(Object.keys(errors)).toStrictEqual([field]);
  });

  it('accepts a 256-character reason', () => {
    expect(
      validateGrantFields({ ...valid, reason: 'x'.repeat(256) }, WINDOW),
    ).toStrictEqual({});
  });

  it('trims the person id before validating it', () => {
    expect(
      validateGrantFields({ ...valid, subjectPersonId: ` ${UUID} ` }, WINDOW),
    ).toStrictEqual({});
  });
});

describe('renew and revoke validation', () => {
  it('validates only term and reason for renewal', () => {
    expect(
      validateRenewalFields({ validThrough: '2026-11-01', reason: '' }, WINDOW),
    ).toStrictEqual({});
    expect(
      Object.keys(
        validateRenewalFields(
          { validThrough: '2027-02-01', reason: '' },
          WINDOW,
        ),
      ),
    ).toStrictEqual(['validThrough']);
  });

  it('validates only the reason for revocation', () => {
    expect(validateRevocationFields({ reason: 'x'.repeat(256) })).toStrictEqual(
      {},
    );
    expect(
      Object.keys(validateRevocationFields({ reason: 'x'.repeat(257) })),
    ).toStrictEqual(['reason']);
  });
});

describe('[DEC-120] server violation mapping', () => {
  it('maps the 90-day term code to its exact field copy', () => {
    expect(
      violationFieldErrors(
        [
          {
            pointer: '/validThrough',
            code: 'grant_term_spans_at_most_ninety_utc_days',
          },
        ],
        WINDOW,
      ),
    ).toStrictEqual({ validThrough: GRANT_ERROR_COPY.serverTerm });
  });

  it('maps other pointers to the field copy and ignores unknown pointers', () => {
    expect(
      violationFieldErrors(
        [
          { pointer: '/subjectPersonId', code: 'x' },
          { pointer: '/capability', code: 'y' },
          { pointer: '/validThrough', code: 'z' },
          { pointer: '/reason', code: 'w' },
          { pointer: '/somethingElse', code: 'v' },
        ],
        WINDOW,
      ),
    ).toStrictEqual({
      person: GRANT_ERROR_COPY.person,
      capability: GRANT_ERROR_COPY.capability,
      validThrough: grantTermFieldError(WINDOW),
      reason: GRANT_ERROR_COPY.reason,
    });
  });
});
