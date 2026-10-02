import { describe, expect, it } from 'vitest';

import {
  freshUntilFor,
  isFreshProof,
  MFA_METHOD_REGISTRY,
  reauthenticateError,
  STEP_UP_FORWARD_TOLERANCE_SECONDS,
  STEP_UP_FRESHNESS_SECONDS,
  stepUpRequiredError,
} from './step-up';

const NOW = Date.parse('2026-10-02T14:00:00Z');
const at = (offsetSeconds: number): string =>
  new Date(NOW + offsetSeconds * 1000).toISOString();

describe('DEC-111 step-up proof window', () => {
  it('locks the 600 s freshness window, the 30 s tolerance and the method registry', () => {
    expect(STEP_UP_FRESHNESS_SECONDS).toBe(600);
    expect(STEP_UP_FORWARD_TOLERANCE_SECONDS).toBe(30);
    expect(MFA_METHOD_REGISTRY).toEqual(['totp']);
  });

  it.each([
    ['just minted', 0, true],
    ['one minute old', -60, true],
    ['exactly 600 s old', -600, true],
    ['601 s old', -601, false],
    ['30 s ahead (tolerated skew)', 30, true],
    ['31 s ahead (future dated beyond the bound)', 31, false],
  ] as const)('%s', (_name, offset, expected) => {
    expect(isFreshProof(at(offset), NOW)).toBe(expected);
  });

  it('treats an absent or malformed proof as stale', () => {
    expect(isFreshProof(null, NOW)).toBe(false);
    expect(isFreshProof('not-a-time', NOW)).toBe(false);
  });

  it('derives freshUntil as proof time plus 600 s in UTC', () => {
    expect(freshUntilFor('2026-10-02T14:05:00Z')).toBe(
      '2026-10-02T14:15:00.000Z',
    );
  });

  it('builds the exact STEP_UP_REQUIRED 401 from the registry, never a 403', () => {
    expect(stepUpRequiredError()).toEqual({
      ok: false,
      status: 401,
      code: 'STEP_UP_REQUIRED',
      message: 'Recent verification is required.',
      details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
    });
  });

  it('builds the reauthenticate 401 without MFA method detail', () => {
    expect(reauthenticateError()).toMatchObject({
      ok: false,
      status: 401,
      code: 'UNAUTHENTICATED',
      details: { recoveryAction: 'reauthenticate' },
    });
  });
});
