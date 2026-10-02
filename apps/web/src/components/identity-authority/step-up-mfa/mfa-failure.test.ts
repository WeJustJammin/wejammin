import { describe, expect, it } from 'vitest';

import { networkFailure, parseMfaFailure } from './mfa-failure';

const REQUEST_ID = '0195b6f0-0000-7000-8000-000000000001';

const respond = (
  status: number,
  code: string,
  details: Record<string, unknown>,
  headers: Record<string, string> = {},
): Response =>
  new Response(
    JSON.stringify({
      code,
      message: 'Safe message.',
      details,
      requestId: REQUEST_ID,
    }),
    { status, headers: { 'content-type': 'application/json', ...headers } },
  );

/** BE01a Error Response Matrix as consumed by the browser. */
describe('parseMfaFailure', () => {
  it('reads STEP_UP_REQUIRED recovery and allowed methods', async () => {
    const failure = await parseMfaFailure(
      respond(401, 'STEP_UP_REQUIRED', {
        recoveryAction: 'step_up',
        allowedMethods: ['totp'],
      }),
    );
    expect(failure).toMatchObject({
      status: 401,
      code: 'STEP_UP_REQUIRED',
      recoveryAction: 'step_up',
      allowedMethods: ['totp'],
      requestId: REQUEST_ID,
    });
  });

  it('reads UNAUTHENTICATED reauthenticate recovery', async () => {
    const failure = await parseMfaFailure(
      respond(401, 'UNAUTHENTICATED', { recoveryAction: 'reauthenticate' }),
    );
    expect(failure).toMatchObject({
      code: 'UNAUTHENTICATED',
      recoveryAction: 'reauthenticate',
    });
  });

  it('uses the conflict reasonCode and recovery action', async () => {
    const failure = await parseMfaFailure(
      respond(409, 'CONFLICT', {
        conflict: 'INVALID_TRANSITION',
        reasonCode: 'last_factor_required',
        recoveryAction: 'enroll_factor',
      }),
    );
    expect(failure.reason).toBe('last_factor_required');
    expect(failure.recoveryAction).toBe('enroll_factor');
  });

  it('falls back to the conflict kind for a stale version', async () => {
    const failure = await parseMfaFailure(
      respond(409, 'CONFLICT', {
        conflict: 'VERSION_MISMATCH',
        recoveryAction: 'refetch',
      }),
    );
    expect(failure.reason).toBe('VERSION_MISMATCH');
  });

  it('uses the first violation code for 422', async () => {
    const failure = await parseMfaFailure(
      respond(422, 'VALIDATION_FAILED', {
        violations: [{ field: 'code', code: 'code_incorrect' }],
      }),
    );
    expect(failure.reason).toBe('code_incorrect');
  });

  it('reads the 403 reasonCode', async () => {
    const failure = await parseMfaFailure(
      respond(403, 'FORBIDDEN', { reasonCode: 'account_not_eligible' }),
    );
    expect(failure.reason).toBe('account_not_eligible');
  });

  it('prefers the Retry-After header, then the detail, for 429', async () => {
    const withHeader = await parseMfaFailure(
      respond(
        429,
        'RATE_LIMITED',
        { retryAfterSeconds: 60, limit: 10, resetAt: '2026-10-02T10:00:00Z' },
        { 'retry-after': '900' },
      ),
    );
    expect(withHeader.retryAfterSeconds).toBe(900);
    const detailOnly = await parseMfaFailure(
      respond(429, 'RATE_LIMITED', { retryAfterSeconds: 60 }),
    );
    expect(detailOnly.retryAfterSeconds).toBe(60);
  });

  it('bounds an absurd Retry-After to one day', async () => {
    const failure = await parseMfaFailure(
      respond(429, 'RATE_LIMITED', {}, { 'retry-after': '99999999' }),
    );
    expect(failure.retryAfterSeconds).toBe(86_400);
  });

  it('keeps the request id for dependency failures', async () => {
    const failure = await parseMfaFailure(
      respond(503, 'DEPENDENCY_UNAVAILABLE', {
        dependencyClass: 'provider',
        retryable: true,
      }),
    );
    expect(failure).toMatchObject({ status: 503, requestId: REQUEST_ID });
  });

  it('is safe for a non-JSON or malformed body', async () => {
    const failure = await parseMfaFailure(
      new Response('<html>', { status: 502 }),
    );
    expect(failure).toMatchObject({
      status: 502,
      code: 'HTTP_502',
      reason: null,
      recoveryAction: null,
      allowedMethods: [],
      requestId: null,
      retryAfterSeconds: null,
    });
  });

  it('drops unknown allowed methods and caps the list', async () => {
    const failure = await parseMfaFailure(
      respond(401, 'STEP_UP_REQUIRED', {
        recoveryAction: 'step_up',
        allowedMethods: ['totp', 7, 'sms', 'x'.repeat(100)],
      }),
    );
    expect(failure.allowedMethods).toEqual(['totp', 'sms']);
  });

  it('lists only short violation field names, capped at eight', async () => {
    const failure = await parseMfaFailure(
      respond(422, 'VALIDATION_FAILED', {
        violations: [
          { field: 'targetPersonId', code: 'invalid_uuid' },
          { field: 7, code: 'x' },
          { field: 'f'.repeat(100), code: 'x' },
          ...Array.from({ length: 12 }, (_, i) => ({
            field: `f${i}`,
            code: 'x',
          })),
        ],
      }),
    );
    expect(failure.violationFields).toHaveLength(8);
    expect(failure.violationFields[0]).toBe('targetPersonId');
    expect(failure.violationFields).not.toContain('f'.repeat(100));
  });

  it('has no violation fields without violations', async () => {
    expect(
      (await parseMfaFailure(respond(409, 'CONFLICT', {}))).violationFields,
    ).toEqual([]);
    expect(networkFailure().violationFields).toEqual([]);
  });

  it('describes a network failure without a status', () => {
    expect(networkFailure()).toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      requestId: null,
    });
  });
});
