import { describe, expect, it, vi } from 'vitest';

import { forwardCmsPatternInstanceMutation } from './cms-composition-platform-pattern';

const path = '/api/v1/cms/compositions/pattern-instances';
const revisionId = 'd3000000-0000-4000-8000-000000000011';
const patternId = 'd3000000-0000-4000-8000-000000000012';
const body = {
  revisionId,
  patternId,
  patternVersion: 1,
  linkMode: 'linked',
  slotPath: '/primary',
  overrides: {},
  expectedVersion: '1',
};
const resource = {
  id: 'd3000000-0000-4000-8000-000000000013',
  version: '1',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-28T14:00:00.000Z',
  updatedAt: '2026-09-28T14:00:00.000Z',
  state: 'draft',
  revisionId,
  path: '/primary',
  blockKey: 'profile.header',
  blockVersion: 1,
  patternId,
  patternVersion: 1,
  blockRegistryDigest: 'b'.repeat(64),
  linkMode: 'linked',
  conflictState: 'none',
};
const request = (
  options: {
    path?: string;
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
    rawBody?: string;
  } = {},
): Request =>
  new Request(`https://app.example.test${options.path ?? path}`, {
    method: options.method ?? 'POST',
    headers: {
      origin: 'https://app.example.test',
      cookie: 'wj_access=protected; wj_csrf=csrf-token-123; unrelated=private',
      'x-csrf-token': 'csrf-token-123',
      'content-type': 'application/json',
      'idempotency-key': 'pattern-command-0001',
      'if-match': '"1"',
      ...options.headers,
    },
    ...(options.method === 'GET'
      ? {}
      : { body: options.rawBody ?? JSON.stringify(options.body ?? body) }),
  });
const binding = (result: Response | unknown | Error) => {
  const fetch = vi.fn(async (request: Request) => {
    if (!(request instanceof Request))
      throw new Error('Expected a forwarded Request.');
    if (result instanceof Error) throw result;
    return result;
  });
  return { fetch };
};
const success = (value: unknown = resource, status = 201, etag = '"1"') =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', etag },
  });
const error = (
  status: number,
  code: string,
  details: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) =>
  new Response(
    JSON.stringify({
      code,
      message: `${code}: composition operation rejected or unavailable.`,
      requestId: 'd3000000-0000-4000-8000-000000000014',
      details,
    }),
    { status, headers },
  );

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
      [success(resource, 201, '"2"'), 502],
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
        { reasonCode: 'CAPABILITY_REQUIRED', secret: 'private' },
        { reasonCode: 'CAPABILITY_REQUIRED' },
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
        'DEPENDENCY_INVALID_RESPONSE',
        { secret: 'private' },
        { dependencyClass: 'cms_composition', retryable: false },
      ],
      [
        503,
        'DEPENDENCY_UNAVAILABLE',
        { secret: 'private' },
        { dependencyClass: 'cms_composition', retryable: true },
      ],
      [
        504,
        'DEPENDENCY_DEADLINE_EXCEEDED',
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

  it('forwards a valid response without disclosing local cookies or caller authority', async () => {
    const b = binding(success());
    const response = await forwardCmsPatternInstanceMutation(request(), b);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(resource);
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
