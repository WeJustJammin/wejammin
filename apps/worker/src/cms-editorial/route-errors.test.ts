import { describe, expect, it } from 'vitest';

import { ApiErrorSchema, cmsEditorialRoutePolicies } from '@wejammin/contracts';

import {
  commonHeaders,
  errorResponse,
  sanitizeReadError,
} from './route-errors';
import type { CmsEditorialDependencies, CmsEditorialError } from './types';

/*
 * The safe-read error boundary of CMS-03B-12/13/14: a private port is
 * untrusted, so its status must be a declared matrix cell, its text is replaced
 * by the canonical route message, and its details are projected per status
 * rather than copied. A concealed 404 keeps empty details.
 */

const policy = cmsEditorialRoutePolicies.find(
  (item) => item.operationId === 'CMS-03B-13',
) as (typeof cmsEditorialRoutePolicies)[number];

const failure = (
  status: number,
  extra: Partial<Omit<CmsEditorialError, 'ok' | 'status'>> = {},
): CmsEditorialError =>
  ({
    ok: false,
    status,
    code: 'PRIVATE_CODE',
    message: 'private dependency text that must never be published',
    ...extra,
  }) as CmsEditorialError;

describe('safe-read error projection', () => {
  it('replaces dependency text with the canonical message for the status', () => {
    const projected = sanitizeReadError(failure(503), policy);
    expect(projected).toMatchObject({
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'The CMS editorial dependency is temporarily unavailable.',
      details: { dependencyClass: 'cms_editorial', retryable: true },
      retryAfterSeconds: 5,
    });
    expect(JSON.stringify(projected)).not.toContain('private');
  });

  it('publishes a cursor conflict as the declared 409 with only the closed conflict and recovery details', () => {
    const projected = sanitizeReadError(
      failure(409, {
        details: {
          conflict: 'INVALID_TRANSITION',
          recoveryAction: 'refresh',
          reasonCode: 'private reason',
          violations: [
            { path: '/cursor', code: 'cursor_expired', message: 'x' },
          ],
        },
      }),
      policy,
    );
    expect(projected).toMatchObject({
      status: 409,
      code: 'CONFLICT',
      message: 'The CMS editorial resource changed; reload and try again.',
      details: { conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' },
    });
    expect(projected.details).not.toHaveProperty('reasonCode');
    expect(projected.details).not.toHaveProperty('violations');
    const unknownConflict = sanitizeReadError(
      failure(409, {
        details: {
          conflict: 'private-injected',
          recoveryAction: 'format_disk',
        },
      }),
      policy,
    );
    expect(unknownConflict.details).toEqual({});
  });

  it('keeps a structural 400 and its bounded violations', () => {
    const projected = sanitizeReadError(
      failure(400, {
        details: {
          violations: [
            { path: '/cursor', code: 'cursor_expired', message: 'x' },
          ],
        },
      }),
      policy,
    );
    expect(projected).toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST',
      details: {
        violations: [{ path: '/cursor', code: 'cursor_expired' }],
      },
    });
  });

  it('refuses a 409 on a read whose matrix row declares none (CMS-03B-12) as a scrubbed 500', () => {
    const conflictDetail = cmsEditorialRoutePolicies.find(
      (item) => item.operationId === 'CMS-03B-12',
    ) as (typeof cmsEditorialRoutePolicies)[number];
    expect(sanitizeReadError(failure(409), conflictDetail)).toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
      details: {},
    });
  });

  it('publishes a registered typed 422 reason on a read and drops an unregistered one', () => {
    for (const reasonCode of ['comparison_too_large', 'comparison_unavailable'])
      expect(
        sanitizeReadError(failure(422, { details: { reasonCode } }), policy)
          .details,
      ).toEqual({ reasonCode });
    expect(
      sanitizeReadError(
        failure(422, { details: { reasonCode: 'private_reason' } }),
        policy,
      ).details,
    ).toEqual({});
  });

  it('refuses an undeclared status by reporting an internal error', () => {
    expect(sanitizeReadError(failure(418), policy)).toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
      details: {},
    });
  });

  it('keeps a bounded 403 reason code and drops any other', () => {
    const kept = sanitizeReadError(
      failure(403, { details: { reasonCode: 'ASSIGNMENT_REQUIRED' } }),
      policy,
    );
    expect(kept.details).toEqual({ reasonCode: 'ASSIGNMENT_REQUIRED' });
    for (const reasonCode of ['private_reason', 7, null])
      expect(
        sanitizeReadError(failure(403, { details: { reasonCode } }), policy)
          .details,
      ).toEqual({});
  });

  it('states that a read accepts no media on a 415', () => {
    expect(sanitizeReadError(failure(415), policy).details).toEqual({
      allowedMediaTypes: [],
    });
  });

  it('reauthenticates on a 401 and states the dependency class on 502/503/504', () => {
    expect(sanitizeReadError(failure(401), policy).details).toEqual({
      recoveryAction: 'reauthenticate',
    });
    expect(sanitizeReadError(failure(502), policy).details).toEqual({
      dependencyClass: 'cms_editorial',
      retryable: false,
    });
    for (const status of [503, 504])
      expect(sanitizeReadError(failure(status), policy)).toMatchObject({
        details: { dependencyClass: 'cms_editorial', retryable: true },
        retryAfterSeconds: 5,
      });
  });

  it('projects a bounded 429 envelope from the limit, reset and retry hints', () => {
    const full = sanitizeReadError(
      failure(429, {
        details: { limit: 300, resetAt: '1760000000' },
        retryAfterSeconds: 12,
      }),
      policy,
    );
    expect(full).toMatchObject({
      status: 429,
      details: { limit: 300, resetAt: '1760000000', retryAfterSeconds: 12 },
      retryAfterSeconds: 12,
    });

    const fromDetails = sanitizeReadError(
      failure(429, { details: { retryAfterSeconds: 9 } }),
      policy,
    );
    expect(fromDetails.retryAfterSeconds).toBe(9);

    const bare = sanitizeReadError(failure(429), policy);
    expect(bare.details).toEqual({ retryAfterSeconds: 1 });
    expect(bare.retryAfterSeconds).toBe(1);

    for (const limit of [0, 10_001, 1.5, '300', Number.NaN])
      expect(
        sanitizeReadError(failure(429, { details: { limit } }), policy).details,
      ).not.toHaveProperty('limit');
    for (const resetAt of ['soon', '1234567890123', 5])
      expect(
        sanitizeReadError(failure(429, { details: { resetAt } }), policy)
          .details,
      ).not.toHaveProperty('resetAt');
  });

  it('without a route policy, still re-words the message and conceals a 404', () => {
    expect(
      sanitizeReadError(failure(404, { details: { secret: 'x' } })),
    ).toMatchObject({
      status: 404,
      message: 'The requested CMS editorial resource was not found.',
      details: {},
    });
    expect(
      sanitizeReadError(
        failure(409, { details: { conflict: 'VERSION_MISMATCH' } }),
      ),
    ).toMatchObject({
      message: 'The CMS editorial resource changed; reload and try again.',
      details: { conflict: 'VERSION_MISMATCH' },
    });
    expect(sanitizeReadError(failure(418)).message).toBe(
      'The CMS editorial request could not be completed.',
    );
  });
});

const dependencies = {
  humanOrigins: ['https://cms.example.test'],
} as unknown as CmsEditorialDependencies;
const request = (origin?: string): Request =>
  new Request('https://api.example.test/api/v1/cms/entries', {
    headers: origin === undefined ? {} : { origin },
  });
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('editorial error response', () => {
  it('emits no-store headers and allows only an allowlisted human origin', () => {
    const allowed = commonHeaders(
      request('https://cms.example.test'),
      dependencies,
      requestId,
    );
    expect(allowed.get('cache-control')).toBe('no-store');
    expect(allowed.get('access-control-allow-origin')).toBe(
      'https://cms.example.test',
    );
    expect(allowed.get('vary')).toBe('Origin');
    for (const origin of [undefined, 'https://evil.example.test'])
      expect(
        commonHeaders(request(origin), dependencies, requestId).has(
          'access-control-allow-origin',
        ),
      ).toBe(false);
  });

  it('publishes a typed ApiError with retry and rate-limit headers on a read 429', async () => {
    const response = errorResponse(
      request(),
      dependencies,
      requestId,
      failure(429, {
        details: { limit: 300, resetAt: '1760000000' },
        retryAfterSeconds: 7,
      }),
      new Headers({ 'x-extra': 'kept' }),
      policy,
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('7');
    expect(response.headers.get('ratelimit-limit')).toBe('300');
    expect(response.headers.get('ratelimit-reset')).toBe('1760000000');
    expect(response.headers.get('x-extra')).toBe('kept');
    expect(ApiErrorSchema.parse(await response.json())).toMatchObject({
      code: 'RATE_LIMITED',
      requestId,
    });
  });

  it('marks a 5xx retryable only when the dependency may recover', () => {
    const retryable = (status: number): string | null =>
      errorResponse(
        request(),
        dependencies,
        requestId,
        failure(status),
        undefined,
        policy,
      ).headers.get('x-cms-editorial-retryable');
    expect(retryable(502)).toBe('false');
    expect(retryable(500)).toBe('false');
    expect(retryable(503)).toBe('true');
    expect(retryable(504)).toBe('true');
    expect(retryable(404)).toBeNull();
  });

  it('uses the write-route projection when no policy is supplied', async () => {
    const response = errorResponse(
      request(),
      dependencies,
      requestId,
      failure(401),
    );
    expect(response.status).toBe(401);
    expect(ApiErrorSchema.parse(await response.json())).toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Sign in again to edit this entry.',
      details: { recoveryAction: 'reauthenticate' },
    });
  });
});
