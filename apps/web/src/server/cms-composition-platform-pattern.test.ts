import { describe, expect, it } from 'vitest';

import { forwardCmsPatternInstanceMutation } from './cms-composition-platform-pattern';
import {
  binding,
  body,
  error,
  path,
  patternId,
  request,
  resource,
  revisionId,
  success,
} from './cms-composition-platform-pattern.test-support';

describe('CMS-03C-02 first-party private forwarding', () => {
  it('rejects invalid binding, admission, and body before any Worker call', async () => {
    expect(
      (await forwardCmsPatternInstanceMutation(request(), null)).status,
    ).toBe(503);
    const b = binding(success());
    for (const [candidate, status] of [
      [request({ method: 'GET' }), 400],
      [request({ path: `${path}?admin=1` }), 400],
      [request({ headers: { origin: 'https://evil.test' } }), 403],
      [request({ headers: { 'x-csrf-token': '' } }), 403],
      [request({ headers: { 'content-type': 'text/plain' } }), 415],
      [request({ headers: { 'idempotency-key': '' } }), 400],
      [request({ rawBody: '{' }), 400],
      [request({ body: { ...body, ownerId: resource.id } }), 422],
      [request({ body: { ...body, expectedVersion: '2' } }), 400],
    ] as const) {
      const response = await forwardCmsPatternInstanceMutation(candidate, b);
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    for (const header of ['idempotency-key', 'if-match']) {
      const missing = request();
      missing.headers.delete(header);
      expect((await forwardCmsPatternInstanceMutation(missing, b)).status).toBe(
        400,
      );
    }
    expect(b.fetch).not.toHaveBeenCalled();
  });

  it('fails closed on transport and malformed upstream success', async () => {
    for (const [result, status] of [
      [new Error('private endpoint'), 503],
      [{ bad: true }, 503],
      [success(resource, 200), 502],
      [new Response('{', { status: 201 }), 502],
      [success({ ...resource, ownerId: revisionId }), 502],
      [success({ ...resource, revisionId: patternId }), 502],
      [success({ ...resource, path: '/other' }), 502],
      [success({ ...resource, patternId: revisionId }), 502],
      [success({ ...resource, patternVersion: 2 }), 502],
      [success({ ...resource, linkMode: 'copied' }), 502],
      // A weak ETag is invalid (BE00); a different strong entry ETag is not.
      [success(resource, 201, 'W/"2"'), 502],
    ] as const) {
      const response = await forwardCmsPatternInstanceMutation(
        request(),
        binding(result),
      );
      expect(response.status).toBe(status);
      expect(JSON.stringify(await response.json())).not.toContain(
        'private endpoint',
      );
    }
    expect(
      (
        await forwardCmsPatternInstanceMutation(
          request({ body: { ...body, blockRegistryDigest: 'c'.repeat(64) } }),
          binding(success()),
        )
      ).status,
    ).toBe(502);
  });

  it('requires a typed upstream error and strips private fields by status', async () => {
    for (const response of [
      new Response('{}', { status: 418 }),
      new Response('{', { status: 409 }),
      error(409, 'WRONG_CODE'),
      new Response(
        JSON.stringify({
          code: 'COMPOSITION_VERSION_CONFLICT',
          message: 'private provider text',
          requestId: 'd3000000-0000-4000-8000-000000000014',
          details: {},
        }),
        { status: 409 },
      ),
    ]) {
      const result = await forwardCmsPatternInstanceMutation(
        request(),
        binding(response),
      );
      expect(result.status).toBe(502);
    }
    for (const [status, code, details, expected] of [
      [
        401,
        'UNAUTHENTICATED',
        { secret: 'private' },
        { recoveryAction: 'reauthenticate' },
      ],
      [
        403,
        'COMPOSITION_FORBIDDEN',
        { reasonCode: 'capability_missing', secret: 'private' },
        { reasonCode: 'capability_missing' },
      ],
      [
        403,
        'COMPOSITION_FORBIDDEN',
        { reasonCode: 'OTHER', secret: 'private' },
        {},
      ],
      [
        409,
        'COMPOSITION_VERSION_CONFLICT',
        { expectedVersion: '1', currentVersion: '2', secret: 'private' },
        { expectedVersion: '1', currentVersion: '2' },
      ],
      [
        409,
        'COMPOSITION_VERSION_CONFLICT',
        { expectedVersion: '-1', currentVersion: {}, secret: 'private' },
        {},
      ],
      [
        429,
        'RATE_LIMITED',
        {
          retryAfterSeconds: 12,
          limit: 120,
          resetAt: '12345',
          secret: 'private',
        },
        { retryAfterSeconds: 12, limit: 120, resetAt: '12345' },
      ],
      [
        429,
        'RATE_LIMITED',
        {
          retryAfterSeconds: -1,
          limit: 'bad',
          resetAt: 'NaN',
          secret: 'private',
        },
        {},
      ],
      [
        502,
        'DEPENDENCY_UNAVAILABLE',
        { secret: 'private' },
        { dependencyClass: 'cms_composition', retryable: true },
      ],
      [
        503,
        'DEPENDENCY_UNAVAILABLE',
        { secret: 'private' },
        { dependencyClass: 'cms_composition', retryable: true },
      ],
      [
        504,
        'DEPENDENCY_UNAVAILABLE',
        { secret: 'private' },
        { dependencyClass: 'cms_composition', retryable: true },
      ],
      [400, 'INVALID_REQUEST', { secret: 'private' }, {}],
    ] as const) {
      const upstream = error(status, code, details as Record<string, unknown>, {
        'retry-after': '12',
      });
      const result = await forwardCmsPatternInstanceMutation(
        request(),
        binding(upstream),
      );
      expect(result.status).toBe(status);
      expect((await result.json()) as { details: unknown }).toHaveProperty(
        'details',
        expected,
      );
      expect(result.headers.get('retry-after')).toBe(
        status === 429 || status === 503 || status === 504 ? '12' : null,
      );
    }
    for (const retryAfter of ['0', '3601', 'NaN']) {
      const result = await forwardCmsPatternInstanceMutation(
        request(),
        binding(error(429, 'RATE_LIMITED', {}, { 'retry-after': retryAfter })),
      );
      expect(result.status).toBe(429);
      expect(result.headers.get('retry-after')).toBeNull();
    }
  });

  it('forwards a valid list response with the entry ETag without disclosing cookies or authority', async () => {
    const b = binding(success(resource, 201, '"42"'));
    const response = await forwardCmsPatternInstanceMutation(request(), b);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ items: [resource] });
    // The ETag is the entry aggregate version, distinct from the row version.
    expect(response.headers.get('etag')).toBe('"42"');
    const forwarded = b.fetch.mock.calls[0]?.[0] as Request;
    expect(forwarded.url).toBe(`https://platform-api.internal${path}`);
    expect(await forwarded.json()).toEqual(body);
    expect(forwarded.headers.get('cookie')).toContain('wj_csrf=csrf-token-123');
    expect(forwarded.headers.get('cookie')).not.toContain('unrelated=');
  });

  it('relays a 429 resetAt only as a valid RFC 3339 UTC instant (BE00 RATE_LIMITED)', async () => {
    const respond = async (details: Record<string, unknown>) => {
      const result = await forwardCmsPatternInstanceMutation(
        request(),
        binding(error(429, 'RATE_LIMITED', details)),
      );
      expect(result.status).toBe(429);
      return ((await result.json()) as { details: unknown }).details;
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
