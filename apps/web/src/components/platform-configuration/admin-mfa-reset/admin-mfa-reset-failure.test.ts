import { describe, expect, it } from 'vitest';

import {
  networkFailure,
  type MfaFailure,
} from '../../identity-authority/step-up-mfa/mfa-failure';
import { ADMIN_RESET_COPY } from './admin-mfa-reset-values';
import { resetFailureView } from './admin-mfa-reset-failure';

const failure = (
  status: number,
  code: string,
  extra: Partial<MfaFailure> = {},
): MfaFailure => ({
  status,
  code,
  reason: null,
  recoveryAction: null,
  allowedMethods: [],
  violationFields: [],
  requestId: '0195b6f0-0000-7000-8000-000000000001',
  retryAfterSeconds: null,
  ...extra,
});

/** BE05b CFG-05B-06 error matrix rendered with the exact FE05 copy. */
describe('resetFailureView', () => {
  it('routes 401 STEP_UP_REQUIRED to step-up with no message', () => {
    expect(resetFailureView(failure(401, 'STEP_UP_REQUIRED'))).toMatchObject({
      kind: 'step-up',
      message: '',
    });
  });

  it('routes any other 401 to sign-in', () => {
    expect(resetFailureView(failure(401, 'UNAUTHENTICATED'))).toMatchObject({
      kind: 'sign-in',
      message: ADMIN_RESET_COPY.sessionEnded,
    });
  });

  it.each([
    [403, 'FORBIDDEN', 'forbidden', ADMIN_RESET_COPY.forbidden],
    [404, 'TARGET_NOT_FOUND', 'not-found', ADMIN_RESET_COPY.notFound],
    [409, 'MFA_RESET_IN_PROGRESS', 'in-progress', ADMIN_RESET_COPY.inProgress],
    [409, 'IDEMPOTENCY_CONFLICT', 'refresh', ADMIN_RESET_COPY.refresh],
    [422, 'MFA_RESET_INVALID', 'self', ADMIN_RESET_COPY.selfTarget],
  ] as const)('maps %i %s', (status, code, kind, message) => {
    expect(resetFailureView(failure(status, code))).toMatchObject({
      kind,
      message,
    });
  });

  it('adds schema field errors from violations on 400 and 422', () => {
    const view = resetFailureView(
      failure(422, 'VALIDATION_FAILED', {
        violationFields: ['targetPersonId', 'reason', 'other'],
      }),
    );
    expect(view.kind).toBe('invalid');
    expect(view.fieldErrors).toEqual({
      targetPersonId: ADMIN_RESET_COPY.personInvalid,
      reason: ADMIN_RESET_COPY.reasonInvalid,
    });
    expect(resetFailureView(failure(400, 'INVALID_REQUEST')).kind).toBe(
      'invalid',
    );
  });

  it('carries the retry delay for 429 with a safe default', () => {
    expect(
      resetFailureView(
        failure(429, 'RATE_LIMITED', { retryAfterSeconds: 120 }),
      ),
    ).toMatchObject({
      kind: 'locked',
      retryAfterSeconds: 120,
    });
    expect(
      resetFailureView(failure(429, 'RATE_LIMITED')).retryAfterSeconds,
    ).toBeGreaterThan(0);
  });

  it('shows degraded with the request ID for 502, 503 and IDENTITY_UNAVAILABLE', () => {
    for (const [status, code] of [
      [503, 'IDENTITY_UNAVAILABLE'],
      [503, 'DEPENDENCY_UNAVAILABLE'],
      [502, 'UPSTREAM_FAILURE'],
    ] as const) {
      expect(resetFailureView(failure(status, code))).toMatchObject({
        kind: 'degraded',
        showRequestId: true,
        message: ADMIN_RESET_COPY.degraded,
      });
    }
  });

  it('treats a network failure or 504 as an unknown outcome, never as reset', () => {
    for (const f of [networkFailure(), failure(504, 'GATEWAY_TIMEOUT')]) {
      const view = resetFailureView(f);
      expect(view.kind).toBe('unknown');
      expect(view.message).toBe(ADMIN_RESET_COPY.unknown);
      expect(view.message).not.toMatch(/was reset/u);
    }
  });
});
