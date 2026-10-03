import { describe, expect, it } from 'vitest';

import { ADMIN_RESET_COPY } from '../../platform-configuration/admin-mfa-reset/admin-mfa-reset-values';
import { MFA_COPY } from './mfa-failure-view';
import { ONE_TIME_CODE_COPY } from './one-time-code';
import { STEP_UP_COPY } from './step-up-failure';

/**
 * IA01 "Every verified factor is lost": recovery is the existing account
 * recovery or an audited administrative reset. The product never offers
 * recovery codes or a self-service bypass, so no user-facing copy for the
 * step-up, enrollment or reset surfaces mentions one.
 */

const collect = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : typeof value === 'object' && value !== null
      ? Object.values(value).flatMap(collect)
      : [];

describe('[P2-S09-AC-1142] no recovery codes or self-service bypass', () => {
  const copy = [
    ADMIN_RESET_COPY,
    MFA_COPY,
    ONE_TIME_CODE_COPY,
    STEP_UP_COPY,
  ].flatMap(collect);

  it('[P2-S09-AC-1142] has user-facing copy to inspect', () => {
    expect(copy.length).toBeGreaterThan(20);
  });

  it('[P2-S09-AC-1142] never mentions recovery or backup codes', () => {
    expect(
      copy.filter((text) => /recovery codes?|backup codes?/iu.test(text)),
    ).toEqual([]);
  });

  it('[P2-S09-AC-1142] never offers a bypass or skip', () => {
    expect(
      copy.filter((text) => /bypass|skip (?:verification|mfa)/iu.test(text)),
    ).toEqual([]);
  });
});
