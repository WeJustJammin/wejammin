import { describe, expect, it } from 'vitest';

import {
  MFA_SETTINGS_ROUTE,
  STEP_UP_ROUTE,
  computeStepUpReturnTo,
  mfaSettingsHref,
  resolveStepUpReturnTo,
  stepUpHref,
  stepUpSignInHref,
} from './step-up-return';

/** FE01 `/step-up`: returnTo is a server-validated relative first-party path. */
describe('resolveStepUpReturnTo', () => {
  it.each([
    ['/app', '/app'],
    ['/app/cms-content-modeling?tab=versions', '/app/cms-content-modeling?tab=versions'],
    ['/settings/security', '/settings/security'],
    ['/settings/security/mfa?step=name', '/settings/security/mfa?step=name'],
  ])('keeps the safe path %s', (raw, expected) => {
    expect(resolveStepUpReturnTo(raw)).toBe(expected);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['scheme', 'https://evil.example/app'],
    ['protocol-relative', '//evil.example/app'],
    ['backslash', '/app\\evil'],
    ['control character', '/app\u0007x'],
    ['encoded slash', '/app%2fevil'],
    ['encoded percent', '/app%252fevil'],
    ['unknown family', '/billing/anything'],
    ['nested redirect', '/app?next=https://evil.example'],
    ['the step-up page itself', '/step-up?returnTo=%2Fapp'],
    ['the auth family', '/auth/sign-in'],
    ['over 512 characters', `/app/${'a'.repeat(510)}`],
  ])('falls back to /app for %s', (_name, raw) => {
    expect(resolveStepUpReturnTo(raw)).toBe('/app');
  });

  it('accepts exactly 512 characters', () => {
    const exact = `/app/${'a'.repeat(507)}`;
    expect(exact).toHaveLength(512);
    expect(resolveStepUpReturnTo(exact)).toBe(exact);
  });
});

describe('computeStepUpReturnTo', () => {
  it('joins the current path and query', () => {
    expect(computeStepUpReturnTo('/app/x', '?a=1')).toBe('/app/x?a=1');
    expect(computeStepUpReturnTo('/app/x')).toBe('/app/x');
  });

  it('keeps the path only when path plus query exceeds 512 characters', () => {
    const search = `?q=${'b'.repeat(520)}`;
    expect(computeStepUpReturnTo('/app/x', search)).toBe('/app/x');
  });

  it('drops a query whose nested encoded target is ambiguous', () => {
    expect(
      computeStepUpReturnTo('/settings/security/mfa', '?returnTo=%2Fapp'),
    ).toBe('/settings/security/mfa');
  });

  it('uses /app when even the path alone is invalid', () => {
    expect(computeStepUpReturnTo('/billing', '?a=1')).toBe('/app');
    expect(computeStepUpReturnTo('//evil.example', '')).toBe('/app');
  });
});

describe('step-up navigation targets', () => {
  it('names the two routes', () => {
    expect(STEP_UP_ROUTE).toBe('/step-up');
    expect(MFA_SETTINGS_ROUTE).toBe('/settings/security/mfa');
  });

  it('builds /step-up?returnTo= with the encoded current location', () => {
    expect(stepUpHref('/app/x', '?tab=a&b=1')).toBe(
      '/step-up?returnTo=%2Fapp%2Fx%3Ftab%3Da%26b%3D1',
    );
  });

  it('builds the enrollment link with and without a return target', () => {
    expect(mfaSettingsHref('/app/x')).toBe(
      '/settings/security/mfa?returnTo=%2Fapp%2Fx',
    );
    expect(mfaSettingsHref(null)).toBe('/settings/security/mfa');
  });

  it('wraps /step-up in the sign-in return target', () => {
    expect(stepUpSignInHref('/app/x')).toBe(
      `/auth/sign-in?returnTo=${encodeURIComponent('/step-up?returnTo=%2Fapp%2Fx')}`,
    );
  });

  it('drops the nested returnTo when the combined sign-in value exceeds 512 characters', () => {
    const long = `/app/${'a'.repeat(495)}`;
    expect(stepUpSignInHref(long)).toBe(
      `/auth/sign-in?returnTo=${encodeURIComponent('/step-up')}`,
    );
  });
});
