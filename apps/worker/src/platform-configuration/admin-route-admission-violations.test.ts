import { describe, expect, it } from 'vitest';

import {
  GENERIC_VIOLATION_CODE,
  constraintViolations,
} from './admin-route-admission';

describe('constraintViolations (BE00 FieldViolation.code)', () => {
  it('[P2-S09-AC-942] keeps a lowercase constraint token the contract supplied', () => {
    expect(
      constraintViolations({
        violations: [{ path: '/reason', code: 'reason_invalid', message: 'x' }],
      }),
    ).toStrictEqual({
      violations: [{ path: '/reason', code: 'reason_invalid', message: 'x' }],
    });
  });

  it('[P2-S09-AC-942] replaces library text that could echo a caller-supplied key with the generic code', () => {
    expect(
      constraintViolations({
        violations: [
          { path: '/', code: 'Unrecognized key: "secretKey"', message: 'x' },
        ],
      }),
    ).toStrictEqual({
      violations: [{ path: '/', code: GENERIC_VIOLATION_CODE, message: 'x' }],
    });
  });

  it('[P2-S09-AC-942] replaces a code longer than 64 characters or starting with a digit', () => {
    const rows = constraintViolations({
      violations: [
        { path: '/a', code: 'a'.repeat(65), message: 'x' },
        { path: '/b', code: '1abc', message: 'x' },
      ],
    })?.violations as { code: string }[];
    expect(rows.map((row) => row.code)).toStrictEqual([
      GENERIC_VIOLATION_CODE,
      GENERIC_VIOLATION_CODE,
    ]);
  });

  it('[P2-S09-AC-942] leaves details without violations untouched', () => {
    expect(constraintViolations(undefined)).toBeUndefined();
    expect(constraintViolations({})).toStrictEqual({});
    expect(
      constraintViolations({ allowedMediaTypes: ['application/json'] }),
    ).toStrictEqual({ allowedMediaTypes: ['application/json'] });
  });
});
