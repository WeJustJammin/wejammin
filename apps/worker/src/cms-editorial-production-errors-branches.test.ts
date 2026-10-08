import { describe, it } from 'vitest';

import {
  codeFromRpcError,
  safeDetails,
} from './cms-editorial-production-errors';
import { expect } from './cms-editorial-production.test-support';

describe('cms editorial error mapping: token and detail branches', () => {
  it('ignores a P0001 envelope whose message is not text, and an unregistered recoveryAction', () => {
    expect(codeFromRpcError({ code: 'P0001', message: 42 })).toBe('');
    // A serialization failure (40001) names only the two CAS tokens.
    expect(
      codeFromRpcError({ code: '40001', message: 'VERSION_MISMATCH' }),
    ).toBe('VERSION_MISMATCH');
    expect(
      codeFromRpcError({ code: '40001', message: 'STALE_EDIT_PRESENCE' }),
    ).toBe('STALE_EDIT_PRESENCE');
    expect(codeFromRpcError({ code: '40001', message: 'RATE_LIMITED' })).toBe(
      '',
    );
    expect(codeFromRpcError({ code: 'P0001' })).toBe('');
    // `recoveryAction` is a closed vocabulary: free text from the database is
    // dropped, a registered action is kept.
    expect(
      safeDetails(409, {
        details: { recoveryAction: 'restart the database', retryable: true },
      }),
    ).toEqual({ retryable: true });
    expect(safeDetails(409, { details: { recoveryAction: 'reload' } })).toEqual(
      { recoveryAction: 'reload' },
    );
  });
});
