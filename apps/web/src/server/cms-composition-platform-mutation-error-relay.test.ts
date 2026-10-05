import { describe, expect, it, vi } from 'vitest';

import { forwardCmsTemplateDefineMutation } from './cms-composition-platform-mutation';
import {
  REQUEST_ID,
  failure,
  request,
} from './cms-composition-platform-mutation-test-support';

describe('CMS-11 first-party template mutation boundary', () => {
  it('relays only the exact safe template error matrix and scrubs foreign details', async () => {
    const fetch = vi.fn(async () =>
      failure(409, 'TEMPLATE_VERSION_CONFLICT', {
        expectedVersion: '1',
        currentVersion: '2',
        privateData: 'private',
      }),
    );
    const response = await forwardCmsTemplateDefineMutation(request(), {
      fetch,
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: 'TEMPLATE_VERSION_CONFLICT',
      message:
        'TEMPLATE_VERSION_CONFLICT: template operation rejected or unavailable.',
      requestId: REQUEST_ID,
      details: { expectedVersion: '1', currentVersion: '2' },
    });
    const wrong = await forwardCmsTemplateDefineMutation(request(), {
      fetch: vi.fn(async () =>
        failure(409, 'TEMPLATE_NOT_FOUND', { secret: 'private' }),
      ),
    });
    expect(wrong.status).toBe(502);
    expect(JSON.stringify(await wrong.json())).not.toContain('private');
  });

  it('does not relay a dependency-invented validation code or private value', async () => {
    const response = await forwardCmsTemplateDefineMutation(request(), {
      fetch: vi.fn(async () =>
        failure(422, 'TEMPLATE_VALIDATION_FAILED', {
          violations: [
            {
              path: '/slots/0/key',
              code: 'slot_key_invalid',
              privateValue: 'private',
            },
            { path: '/slots/0', code: 'private', message: 'private' },
          ],
        }),
      ),
    });
    expect(response.status).toBe(422);
    expect((await response.json()) as Record<string, unknown>).toMatchObject({
      details: {
        violations: [
          {
            path: '/slots/0/key',
            code: 'slot_key_invalid',
            message: 'The value is invalid.',
          },
          {
            path: '/slots/0',
            code: 'invalid',
            message: 'The value is invalid.',
          },
        ],
      },
    });
  });

  it('projects only documented fields for every Worker error family', async () => {
    const cases: readonly [number, string, unknown, unknown][] = [
      [400, 'INVALID_REQUEST', { violations: 'private' }, {}],
      [
        401,
        'UNAUTHENTICATED',
        { recoveryAction: 'private' },
        { recoveryAction: 'reauthenticate' },
      ],
      [
        403,
        'TEMPLATE_FORBIDDEN',
        { reasonCode: 'CAPABILITY_REQUIRED', secret: 'private' },
        { reasonCode: 'CAPABILITY_REQUIRED' },
      ],
      [403, 'TEMPLATE_FORBIDDEN', { reasonCode: 'private' }, {}],
      [404, 'TEMPLATE_NOT_FOUND', { secret: 'private' }, {}],
      [
        409,
        'TEMPLATE_VERSION_CONFLICT',
        { expectedVersion: '0', currentVersion: '2', secret: 'private' },
        { currentVersion: '2' },
      ],
      [415, 'UNSUPPORTED_MEDIA_TYPE', { secret: 'private' }, {}],
      [
        429,
        'RATE_LIMITED',
        { retryAfterSeconds: 5, limit: 10, resetAt: 100, secret: 'private' },
        { retryAfterSeconds: 5, limit: 10, resetAt: 100 },
      ],
      [
        429,
        'RATE_LIMITED',
        { retryAfterSeconds: -1, limit: 1.5, resetAt: 'private' },
        {},
      ],
      [500, 'INTERNAL_ERROR', { secret: 'private' }, {}],
      [
        502,
        'DEPENDENCY_INVALID_RESPONSE',
        { dependencyClass: 'private', retryable: true },
        { dependencyClass: 'cms_composition', retryable: false },
      ],
      [
        503,
        'DEPENDENCY_UNAVAILABLE',
        { dependencyClass: 'private', retryable: false },
        { dependencyClass: 'cms_composition', retryable: true },
      ],
      [
        504,
        'DEPENDENCY_DEADLINE_EXCEEDED',
        { dependencyClass: 'private' },
        { dependencyClass: 'cms_composition', retryable: true },
      ],
    ];
    for (const [status, code, details, projected] of cases) {
      const response = await forwardCmsTemplateDefineMutation(request(), {
        fetch: vi.fn(async () => failure(status, code, details)),
      });
      expect(response.status).toBe(status);
      expect((await response.json()) as Record<string, unknown>).toMatchObject({
        code,
        details: projected,
      });
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('bounds validation violations, replaces unknown paths and codes, and drops non-objects', async () => {
    const violations = Array.from({ length: 49 }, () => null);
    const response = await forwardCmsTemplateDefineMutation(request(), {
      fetch: vi.fn(async () =>
        failure(422, 'TEMPLATE_VALIDATION_FAILED', {
          violations: [
            ...violations,
            { path: 12, code: 12, secret: 'private' },
            { path: '/not-forwarded', code: 'slot_key_invalid' },
          ],
        }),
      ),
    });
    expect(response.status).toBe(422);
    expect((await response.json()) as Record<string, unknown>).toMatchObject({
      details: {
        violations: [
          { path: '/', code: 'invalid', message: 'The value is invalid.' },
        ],
      },
    });
    const longPath = await forwardCmsTemplateDefineMutation(request(), {
      fetch: vi.fn(async () =>
        failure(400, 'INVALID_REQUEST', {
          violations: [
            [],
            'private',
            { path: '/' + 'x'.repeat(400), code: 'slot_key_invalid' },
          ],
        }),
      ),
    });
    const body = (await longPath.json()) as {
      details: { violations: { path: string }[] };
    };
    expect(body.details.violations).toHaveLength(1);
    expect(body.details.violations[0]?.path).toHaveLength(256);
  });

  it('rejects undocumented or malformed upstream errors and sanitizes retry headers', async () => {
    const invalid = [
      new Response('{}', { status: 418 }),
      new Response('{', { status: 409 }),
      new Response('x'.repeat(270_000), { status: 409 }),
      new Response(
        JSON.stringify({
          code: 'INVALID_REQUEST',
          message: 'private',
          requestId: REQUEST_ID,
          details: {},
        }),
        { status: 400 },
      ),
      failure(409, 'TEMPLATE_NOT_FOUND', { secret: 'private' }),
    ];
    for (const upstream of invalid) {
      const response = await forwardCmsTemplateDefineMutation(request(), {
        fetch: vi.fn(async () => upstream),
      });
      expect(response.status).toBe(502);
      expect(JSON.stringify(await response.json())).not.toContain('private');
    }
    const retryCases: readonly [number, string, string, string | null][] = [
      [429, 'RATE_LIMITED', '7', '7'],
      [429, 'RATE_LIMITED', 'private', null],
      [503, 'DEPENDENCY_UNAVAILABLE', '0', null],
      [504, 'DEPENDENCY_DEADLINE_EXCEEDED', '9', '9'],
      [409, 'TEMPLATE_VERSION_CONFLICT', '9', null],
    ];
    for (const [status, code, retryAfter, expected] of retryCases) {
      const upstream = failure(status, code);
      upstream.headers.set('retry-after', retryAfter);
      const response = await forwardCmsTemplateDefineMutation(request(), {
        fetch: vi.fn(async () => upstream),
      });
      expect(response.headers.get('retry-after')).toBe(expected);
    }
  });

  it('relays a 429 resetAt only as a valid RFC 3339 UTC instant (BE00 RATE_LIMITED)', async () => {
    const respond = async (details: Record<string, unknown>) => {
      const response = await forwardCmsTemplateDefineMutation(request(), {
        fetch: vi.fn(async () => failure(429, 'RATE_LIMITED', details)),
      });
      expect(response.status).toBe(429);
      return ((await response.json()) as { details: unknown }).details;
    };
    expect(
      await respond({
        retryAfterSeconds: 43,
        limit: 60,
        resetAt: '2026-09-02T10:41:00.000Z',
        secret: 'private',
      }),
    ).toEqual({
      retryAfterSeconds: 43,
      limit: 60,
      resetAt: '2026-09-02T10:41:00.000Z',
    });
    for (const unsafe of [
      '2026-02-30T10:41:00.000Z',
      '2026-09-02T10:41:00+02:00',
      'private',
    ])
      expect(
        await respond({ retryAfterSeconds: 43, limit: 60, resetAt: unsafe }),
      ).toEqual({ retryAfterSeconds: 43, limit: 60 });
  });
});
