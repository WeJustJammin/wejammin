import { describe, expect, it } from 'vitest';

import { authError, responseForAuthError } from './boundary';
import { canonicalMfaError } from './mfa-error-boundary';
import { bareVersion } from './mfa-service-support';
import { classifyProviderFailure } from './production-mfa-provider-errors';
import type { AuthenticationError } from './types';

const NOW = Date.parse('2026-10-02T14:00:00Z');

describe('canonicalMfaError: strict details rows per status', () => {
  it('adds the reauthenticate recovery only to an UNAUTHENTICATED 401', () => {
    expect(
      canonicalMfaError(
        'AUTH-API-16',
        authError(401, 'UNAUTHENTICATED', 'Sign in.'),
      ).details,
    ).toEqual({ recoveryAction: 'reauthenticate' });
    const stepUp = authError(401, 'STEP_UP_REQUIRED', 'Step up.', {
      recoveryAction: 'step_up',
    });
    expect(canonicalMfaError('AUTH-API-16', stepUp)).toBe(stepUp);
  });

  it('keeps a 403 that already carries a reason code and fills the CSRF reason otherwise', () => {
    const reasoned = authError(403, 'FORBIDDEN', 'No.', {
      reasonCode: 'account_not_eligible',
    });
    expect(canonicalMfaError('AUTH-API-17', reasoned)).toBe(reasoned);
    expect(
      canonicalMfaError(
        'AUTH-API-17',
        authError(403, 'FORBIDDEN', 'No.', { extra: true }),
      ).details,
    ).toEqual({ extra: true, reasonCode: 'origin_csrf_required' });
    const bare: AuthenticationError = {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'No.',
    };
    expect(canonicalMfaError('AUTH-API-17', bare).details).toEqual({
      reasonCode: 'origin_csrf_required',
    });
  });

  it.each([
    ['VERSION_MISMATCH', 'version_mismatch'],
    ['IDEMPOTENCY_MISMATCH', 'idempotency_mismatch'],
  ] as const)('maps a 409 %s to the conflict row', (code, reasonCode) => {
    const mapped = canonicalMfaError(
      'AUTH-API-19',
      authError(409, code, 'Conflict.'),
    );
    expect(mapped).toMatchObject({
      code: 'CONFLICT',
      details: { conflict: code, reasonCode, recoveryAction: 'refetch' },
    });
  });

  it('passes any other 409 through untouched', () => {
    const other = authError(409, 'CONFLICT', 'Other.', {
      conflict: 'TRANSITION_CONFLICT',
    });
    expect(canonicalMfaError('AUTH-API-19', other)).toBe(other);
  });

  it('serializes the fixed rows for 413, 415 and 500', () => {
    expect(
      canonicalMfaError('AUTH-API-18', authError(413, 'PAYLOAD_TOO_LARGE', 'x'))
        .details,
    ).toEqual({ maxBytes: 262_144 });
    expect(
      canonicalMfaError('AUTH-API-18', authError(415, 'UNSUPPORTED', 'x'))
        .details,
    ).toEqual({ allowedMediaTypes: ['application/json'] });
    expect(
      canonicalMfaError(
        'AUTH-API-18',
        authError(500, 'INTERNAL_ERROR', 'x', { leak: 'secret' }),
      ).details,
    ).toEqual({});
  });

  it('leaves statuses outside the matrix unchanged', () => {
    const invalid = authError(400, 'INVALID_REQUEST', 'x');
    expect(canonicalMfaError('AUTH-API-18', invalid)).toBe(invalid);
  });

  it('keeps provider-supplied 429 details and fills only the missing ones', () => {
    const kept = canonicalMfaError(
      'AUTH-API-18',
      authError(429, 'RATE_LIMITED', 'x', {
        retryAfterSeconds: 7,
        limit: 3,
        resetAt: '2026-10-02T14:00:07.000Z',
      }),
      NOW,
    );
    expect(kept.details).toEqual({
      retryAfterSeconds: 7,
      limit: 3,
      resetAt: '2026-10-02T14:00:07.000Z',
    });
    const fromError = canonicalMfaError(
      'AUTH-API-18',
      { ...authError(429, 'RATE_LIMITED', 'x', {}), retryAfterSeconds: 30 },
      NOW,
    );
    expect(fromError.details).toMatchObject({
      retryAfterSeconds: 30,
      resetAt: '2026-10-02T14:00:30.000Z',
    });
    expect(typeof (fromError.details as { limit: unknown }).limit).toBe(
      'number',
    );
  });

  it('defaults a bare 429 to a one second retry from the supplied clock', () => {
    const bare: AuthenticationError = {
      ok: false,
      status: 429,
      code: 'RATE_LIMITED',
      message: 'x',
    };
    expect(canonicalMfaError('AUTH-API-18', bare, NOW).details).toMatchObject({
      retryAfterSeconds: 1,
      resetAt: '2026-10-02T14:00:01.000Z',
    });
  });

  it('uses the current clock when none is supplied', () => {
    const bare: AuthenticationError = {
      ok: false,
      status: 429,
      code: 'RATE_LIMITED',
      message: 'x',
    };
    const before = Date.now();
    const { resetAt } = canonicalMfaError('AUTH-API-18', bare).details as {
      resetAt: string;
    };
    expect(Date.parse(resetAt)).toBeGreaterThanOrEqual(before + 1000);
  });

  it.each([502, 503, 504] as const)(
    'maps a %i to the shared DEPENDENCY_UNAVAILABLE row',
    (status) => {
      const bare: AuthenticationError = {
        ok: false,
        status,
        code: 'PROVIDER_INVALID_RESPONSE',
        message: 'x',
      };
      expect(canonicalMfaError('AUTH-API-20', bare)).toMatchObject({
        code: 'DEPENDENCY_UNAVAILABLE',
        details: { dependencyClass: 'identity_persistence', retryable: true },
      });
    },
  );

  it('keeps a typed dependency class and carries retryAfterSeconds only on a 503', () => {
    const provider = authError(503, 'DEPENDENCY_UNAVAILABLE', 'x', {
      dependencyClass: 'identity_provider',
    });
    expect(
      canonicalMfaError('AUTH-API-20', {
        ...provider,
        retryAfterSeconds: 12,
      }).details,
    ).toEqual({
      dependencyClass: 'identity_provider',
      retryable: true,
      retryAfterSeconds: 12,
    });
    expect(
      canonicalMfaError('AUTH-API-20', {
        ...authError(504, 'DEPENDENCY_TIMEOUT', 'x'),
        retryAfterSeconds: 12,
      }).details,
    ).toEqual({ dependencyClass: 'identity_persistence', retryable: true });
  });
});

describe('responseForAuthError: 429 without details', () => {
  it('sets no rate headers when the error carries no details', () => {
    const headers = new Headers();
    const context = {
      header: (name: string, value: string) => headers.set(name, value),
      set: () => undefined,
      get: () => '11111111-1111-4111-8111-111111111111',
      json: (payload: unknown, status: number) =>
        new Response(JSON.stringify(payload), { status }),
    };
    const bare: AuthenticationError = {
      ok: false,
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests.',
    };
    const response = responseForAuthError(context as never, bare);
    expect(response.status).toBe(429);
    expect(headers.has('ratelimit-limit')).toBe(false);
    expect(headers.has('retry-after')).toBe(false);
  });
});

describe('bareVersion', () => {
  it('strips the strong-ETag quotes and leaves a bare number alone', () => {
    expect(bareVersion('"7"')).toBe('7');
    expect(bareVersion('7')).toBe('7');
  });
});

describe('classifyProviderFailure', () => {
  const headers = (init: Record<string, string> = {}) => new Headers(init);

  it('reads the machine code from either `error_code` or `code`', () => {
    expect(
      classifyProviderFailure(
        400,
        { code: 'mfa_verification_failed' },
        headers(),
        NOW,
      ),
    ).toMatchObject({ status: 422, code: 'VALIDATION_FAILED' });
    expect(
      classifyProviderFailure(400, { code: 7 }, headers(), NOW),
    ).toMatchObject({ status: 502 });
    expect(classifyProviderFailure(400, null, headers(), NOW)).toMatchObject({
      status: 502,
    });
  });

  it('bounds the provider retry delay to 1..86400 seconds and defaults to 900', () => {
    const delay = (value: string) =>
      (
        classifyProviderFailure(
          429,
          null,
          headers({ 'retry-after': value }),
          NOW,
        ).details as { retryAfterSeconds: number }
      ).retryAfterSeconds;
    expect(delay('42')).toBe(42);
    expect(delay('0')).toBe(900);
    expect(delay('86401')).toBe(900);
    expect(delay('soon')).toBe(900);
  });

  it.each([
    ['mfa_factor_name_conflict', 'factor_name_taken'],
    ['too_many_enrolled_mfa_factors', 'mfa_factor_limit'],
    ['mfa_challenge_expired', 'challenge_expired'],
  ] as const)('maps %s to a 409 %s transition conflict', (code, reason) => {
    expect(
      classifyProviderFailure(422, { error_code: code }, headers(), NOW),
    ).toMatchObject({ status: 409, details: { reasonCode: reason } });
  });

  it('maps by status when no machine code applies', () => {
    expect(classifyProviderFailure(403, {}, headers(), NOW)).toMatchObject({
      status: 401,
    });
    expect(classifyProviderFailure(404, {}, headers(), NOW)).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
    expect(classifyProviderFailure(500, {}, headers(), NOW)).toMatchObject({
      status: 503,
    });
    expect(classifyProviderFailure(418, {}, headers(), NOW)).toMatchObject({
      status: 502,
    });
  });
});
