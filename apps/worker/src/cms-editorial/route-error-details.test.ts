import { describe, expect, it } from 'vitest';

import { safeDetails } from './route-error-details';
import type { CmsEditorialError } from './types';

const error = (
  status: CmsEditorialError['status'],
  details: Record<string, unknown>,
): CmsEditorialError => ({
  ok: false,
  status,
  code: 'CONFLICT',
  message: 'x',
  details,
});

describe('write-route error details are an allowlist', () => {
  it('keeps a registered recoveryAction and drops free text', () => {
    expect(safeDetails(error(409, { recoveryAction: 'reload' }))).toEqual({
      recoveryAction: 'reload',
    });
    expect(
      safeDetails(
        error(409, { recoveryAction: 'restart the database', retryable: true }),
      ),
    ).toEqual({ retryable: true });
  });

  it('keeps 404 and 500 details empty', () => {
    expect(safeDetails(error(404, { reasonCode: 'x' }))).toEqual({});
    expect(safeDetails(error(500, { retryable: true }))).toEqual({});
  });
});
