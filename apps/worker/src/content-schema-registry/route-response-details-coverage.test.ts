import { describe, expect, it } from 'vitest';

import type { ContentSchemaRegistryError } from './types';
import { safeDetails } from './route-response-details';

const failure = (
  status: ContentSchemaRegistryError['status'],
  code = 'BAD_REQUEST',
  message = 'safe message',
  details?: Readonly<Record<string, unknown>>,
  retryAfterSeconds?: number,
): ContentSchemaRegistryError => ({
  ok: false,
  status,
  code,
  message,
  ...(details === undefined ? {} : { details }),
  ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
});

describe('content schema registry safe error details', () => {
  it('keeps only bounded printable validation details', () => {
    const valid = { path: '/title', message: 'Required', code: 'REQUIRED' };
    const invalid = {
      path: 'x'.repeat(257),
      message: 'bad\nmessage',
      code: 'bad-code',
    };
    expect(
      safeDetails(
        failure(400, 'INVALID_REQUEST', 'safe', {
          expectedVersion: '7',
          currentVersion: '8',
          reason: 'conflict',
          violations: [
            valid,
            invalid,
            { path: '/only-pointer', message: null, code: null },
            { path: null, message: 'Only message', code: null },
            { path: null, message: null, code: 'ONLY_CODE' },
            null,
            'text',
            {},
          ],
        }),
      ),
    ).toEqual({
      violations: [
        { path: '/title', message: 'Required', code: 'REQUIRED' },
        { path: '/only-pointer' },
        { message: 'Only message' },
        { code: 'ONLY_CODE' },
      ],
    });
    expect(
      safeDetails(
        failure(422, 'INVALID_REQUEST', 'safe', { violations: 'not-an-array' }),
      ),
    ).toEqual({});
    expect(
      safeDetails(
        failure(400, 'INVALID_REQUEST', 'safe', {
          violations: [{ path: null, message: null, code: null }],
        }),
      ),
    ).toEqual({});
    expect(safeDetails(failure(400, 'INVALID_REQUEST'))).toEqual({});
  });

  it('maps authentication, conflict, rate, dependency, and unknown statuses', () => {
    expect(safeDetails(failure(404))).toEqual({});
    expect(safeDetails(failure(500))).toEqual({});
    expect(
      safeDetails(
        failure(401, 'AUTH', 'safe', { recoveryAction: 'reauthenticate' }),
      ),
    ).toEqual({ recoveryAction: 'reauthenticate' });
    expect(
      safeDetails(failure(401, 'AUTH', 'safe', { recoveryAction: 'retry' })),
    ).toEqual({});
    expect(safeDetails(failure(401))).toEqual({});
    expect(
      safeDetails(failure(403, 'AUTH', 'safe', { reasonCode: 'MFA_REQUIRED' })),
    ).toEqual({ reasonCode: 'MFA_REQUIRED' });
    // BE00 makes reasonCode required on a 403: an unregistered value is
    // replaced by the registered value that names the missing authority.
    expect(
      safeDetails(failure(403, 'AUTH', 'safe', { reasonCode: 7 })),
    ).toEqual({ reasonCode: 'CAPABILITY_REQUIRED' });
    expect(safeDetails(failure(403, 'AUTH', 'safe', {}), 'CMS-03A-16')).toEqual(
      { reasonCode: 'OWNER_REQUIRED' },
    );
    expect(safeDetails(failure(403, 'AUTH', 'safe', {}), 'CMS-03A-05')).toEqual(
      { reasonCode: 'POLICY_NOT_MET' },
    );
    expect(
      safeDetails(
        failure(409, 'CONFLICT', 'safe', {
          expectedVersion: '7',
          currentVersion: '8',
          reason: 'stale',
          secret: 'hide',
        }),
      ),
    ).toEqual({
      conflict: 'INVALID_TRANSITION',
      recoveryAction: 'refresh',
      expectedVersion: '7',
      currentVersion: '8',
    });
    expect(safeDetails(failure(409))).toEqual({
      conflict: 'INVALID_TRANSITION',
      recoveryAction: 'refresh',
    });
    expect(
      safeDetails(failure(409, 'VERSION_MISMATCH', 'safe', { conflict: 'x' })),
    ).toEqual({ conflict: 'VERSION_MISMATCH', recoveryAction: 'reload' });
    expect(
      safeDetails(
        failure(409, 'CONFLICT', 'safe', { conflict: 'IDEMPOTENCY_MISMATCH' }),
      ),
    ).toEqual({
      conflict: 'IDEMPOTENCY_MISMATCH',
      recoveryAction: 'use_new_idempotency_key',
    });
    expect(
      safeDetails(
        failure(429, 'RATE', 'safe', {
          limit: 10,
          resetAt: '2026-09-02T10:41:00.000Z',
          retryAfterSeconds: 3,
          ignored: 'x',
        }),
      ),
    ).toEqual({
      limit: 10,
      resetAt: '2026-09-02T10:41:00.000Z',
      retryAfterSeconds: 3,
    });
    // BE00 types resetAt as a string: a number or a non-RFC 3339 text is dropped.
    expect(
      safeDetails(failure(429, 'RATE', 'safe', { limit: 10, resetAt: 20 })),
    ).toEqual({ limit: 10 });
    expect(
      safeDetails(
        failure(429, 'RATE', 'safe', { limit: 10, resetAt: 'tomorrow' }),
      ),
    ).toEqual({ limit: 10 });
    expect(safeDetails(failure(429, 'RATE', 'safe', { limit: '10' }))).toEqual(
      {},
    );
    expect(safeDetails(failure(429))).toEqual({});
    expect(
      safeDetails(
        failure(
          502,
          'DEPENDENCY',
          'safe',
          { dependencyClass: 'release_verifier', retryable: true },
          4,
        ),
      ),
    ).toEqual({
      dependencyClass: 'release_verifier',
      retryable: true,
      retryAfterSeconds: 4,
    });
    expect(
      safeDetails(
        failure(503, 'DEPENDENCY', 'safe', {
          dependencyClass: 7,
          retryable: 'yes',
        }),
      ),
    ).toEqual({ dependencyClass: 'cms_registry', retryable: true });
    expect(safeDetails(failure(504))).toEqual({
      dependencyClass: 'cms_registry',
      retryable: true,
    });
    expect(safeDetails(failure(415))).toEqual({
      allowedMediaTypes: ['application/json'],
    });
  });
});
