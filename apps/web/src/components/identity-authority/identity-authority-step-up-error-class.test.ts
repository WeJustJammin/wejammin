import { describe, expect, it } from 'vitest';

import { presentIdentityAuthorityState } from './identity-authority-state';

/**
 * FE00 error-per-class mapping (DEC-111): a 401 STEP_UP_REQUIRED routes to
 * `/step-up?returnTo=<current relative path>`, is never rendered as a 403
 * capability gate and is never collapsed to reauthentication. The other
 * classes keep their recovery.
 */

const error = (code: string) => ({
  code,
  message: 'Refused.',
  requestId: 'req-1',
  details: null,
});

const present = (code: string, extra: Record<string, unknown> = {}) =>
  presentIdentityAuthorityState({
    status: 'error',
    error: error(code),
    retryable: false,
    ...extra,
  });

describe('FE00 error per class', () => {
  it('[P2-S09-AC-1127] routes 401 STEP_UP_REQUIRED to /step-up with the current relative path and no gate', () => {
    const value = present('STEP_UP_REQUIRED', {
      currentPath: '/app/identity-authority?tab=security',
    });
    expect(value).toMatchObject({
      status: 'error',
      recoveryAction: 'step-up',
      recoveryHref: `/step-up?returnTo=${encodeURIComponent('/app/identity-authority?tab=security')}`,
    });
    expect(value.recoveryAction).not.toBe('capability-gate');
    expect(value.recoveryAction).not.toBe('reauthenticate');
  });

  it('[P2-S09-AC-1127] falls back to /app when the current path is not a usable relative path', () => {
    for (const currentPath of [
      undefined,
      '',
      'https://evil.example/x',
      '//evil',
    ]) {
      expect(
        present(
          'STEP_UP_REQUIRED',
          currentPath === undefined ? {} : { currentPath },
        ),
      ).toMatchObject({ recoveryHref: '/step-up?returnTo=%2Fapp' });
    }
  });

  it('[P2-S09-AC-1127] keeps 403 as a capability gate and 401 UNAUTHENTICATED as reauthentication', () => {
    expect(present('FORBIDDEN')).toMatchObject({
      recoveryAction: 'capability-gate',
    });
    expect(present('UNAUTHENTICATED')).toMatchObject({
      recoveryAction: 'reauthenticate',
    });
  });
});
