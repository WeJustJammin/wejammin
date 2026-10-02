import { describe, expect, it } from 'vitest';

import type { MfaFailure } from './mfa-failure';
import { stepUpFailureView } from './step-up-failure';

const failure = (partial: Partial<MfaFailure> & Pick<MfaFailure, 'status' | 'code'>): MfaFailure => ({
  reason: null,
  recoveryAction: null,
  allowedMethods: [],
  requestId: '0195b6f0-0000-7000-8000-000000000001',
  retryAfterSeconds: null,
  ...partial,
});

/** FE01 "Error copy and routing" for AUTH-API-20 and AUTH-API-21. */
describe('stepUpFailureView', () => {
  it('keeps the field and clears the value for a wrong code', () => {
    expect(
      stepUpFailureView(failure({ status: 422, code: 'VALIDATION_FAILED', reason: 'code_incorrect' }), 'verify'),
    ).toMatchObject({
      phase: 'awaiting-code',
      fieldError: "That code didn't work. Check the code and try again.",
      clearCode: true,
    });
  });

  it('shows the six-digit copy when the server reports a malformed code', () => {
    expect(
      stepUpFailureView(failure({ status: 422, code: 'VALIDATION_FAILED', reason: 'code_invalid' }), 'verify'),
    ).toMatchObject({
      phase: 'awaiting-code',
      fieldError: 'Enter the 6-digit code from your authenticator app.',
    });
  });

  it.each([
    [409, 'challenge_expired'],
    [409, 'challenge_consumed'],
    [404, null],
  ])('treats %i %s as a challenge that is no longer valid', (status, reason) => {
    expect(
      stepUpFailureView(failure({ status, code: status === 404 ? 'NOT_FOUND' : 'CONFLICT', reason }), 'verify'),
    ).toMatchObject({
      phase: 'challenge-expired',
      message: 'This code request is no longer valid.',
      retryLabel: 'Get a new code request',
    });
  });

  it('switches to no-factor when the account has no verified factor', () => {
    expect(
      stepUpFailureView(failure({ status: 409, code: 'CONFLICT', reason: 'no_verified_factor' }), 'challenge'),
    ).toMatchObject({ phase: 'no-factor' });
  });

  it('gates an ineligible account with a reason', () => {
    expect(
      stepUpFailureView(failure({ status: 403, code: 'FORBIDDEN', reason: 'account_not_eligible' }), 'challenge'),
    ).toMatchObject({
      phase: 'degraded',
      message: 'Two-step verification is not available for this account.',
      needsReload: false,
    });
  });

  it('asks for a reload on a CSRF or origin refusal', () => {
    expect(
      stepUpFailureView(failure({ status: 403, code: 'FORBIDDEN', reason: 'csrf_invalid' }), 'verify'),
    ).toMatchObject({
      message: 'Your session changed. Reload to continue.',
      needsReload: true,
    });
  });

  it('locks with a countdown from Retry-After', () => {
    expect(
      stepUpFailureView(failure({ status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 900 }), 'verify'),
    ).toMatchObject({ phase: 'locked', retryAfterSeconds: 900 });
  });

  it('defaults a missing Retry-After to the 900 second lock', () => {
    expect(
      stepUpFailureView(failure({ status: 429, code: 'RATE_LIMITED' }), 'verify'),
    ).toMatchObject({ phase: 'locked', retryAfterSeconds: 900 });
  });

  it.each([502, 503, 504])('is degraded with the request id for %i', (status) => {
    expect(
      stepUpFailureView(failure({ status, code: 'DEPENDENCY_UNAVAILABLE' }), 'verify'),
    ).toMatchObject({
      phase: 'degraded',
      message: 'Verification is temporarily unavailable.',
      showRequestId: true,
      retryLabel: 'Retry',
    });
  });

  it('is degraded when the network fails', () => {
    expect(stepUpFailureView(failure({ status: 0, code: 'NETWORK_ERROR', requestId: null }), 'challenge')).toMatchObject({
      phase: 'degraded',
      message: 'Verification is temporarily unavailable.',
    });
  });

  it('signs out on 401 UNAUTHENTICATED', () => {
    expect(
      stepUpFailureView(failure({ status: 401, code: 'UNAUTHENTICATED', recoveryAction: 'reauthenticate' }), 'verify'),
    ).toMatchObject({ phase: 'signed-out', signIn: true });
  });

  it('never leaks server wording or codes into the copy', () => {
    const view = stepUpFailureView(failure({ status: 500, code: 'INTERNAL_ERROR' }), 'verify');
    expect(JSON.stringify(view)).not.toMatch(/INTERNAL_ERROR|stack|provider/iu);
  });
});
