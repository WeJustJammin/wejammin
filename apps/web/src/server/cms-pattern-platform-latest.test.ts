import { describe, expect, it } from 'vitest';

import { readCmsPatternLatest } from './cms-pattern-platform-latest';
import {
  ORIGIN,
  bindingFor,
  jsonResponse,
  latestRequest,
  patternDetailFixture,
} from './cms-pattern-platform.test-support';

const served = (overrides: Readonly<Record<string, unknown>> = {}) =>
  jsonResponse(200, patternDetailFixture(overrides), { etag: '"1"' });
const run = (
  request: Request,
  key: string | undefined,
  ...queue: (Response | Error)[]
) => {
  const binding = bindingFor(...queue);
  return { binding, done: readCmsPatternLatest(request, binding, key) };
};
const codeOf = async (response: Response): Promise<string> =>
  ((await response.json()) as { code: string }).code;

describe('cmsPatternLatestRead proxy: forwarding', () => {
  it('forwards a bare GET with the session cookies only and returns the verified detail', async () => {
    const { binding, done } = run(latestRequest(), 'profile-hero', served());
    const response = await done;
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBe('"1"');
    expect(await response.json()).toEqual(patternDetailFixture());
    const sent = binding.requests()[0] as Request;
    expect(sent.method).toBe('GET');
    expect(sent.url).toBe(
      'https://platform-api.internal/api/v1/cms/patterns/profile-hero',
    );
    expect(sent.headers.get('cookie')).toBe('wj_access=a');
    expect(sent.headers.get('idempotency-key')).toBeNull();
    expect(sent.headers.get('if-match')).toBeNull();
    expect(sent.body).toBeNull();
  });
});

describe('cmsPatternLatestRead proxy: admission (nothing reaches the Worker)', () => {
  const cases: ReadonlyArray<
    readonly [string, Request, string | undefined, number, string]
  > = [
    [
      'a malformed key',
      latestRequest('Bad_Key'),
      'Bad_Key',
      400,
      'INVALID_REQUEST',
    ],
    ['no key', latestRequest(), undefined, 400, 'INVALID_REQUEST'],
    [
      'the reserved key selector',
      latestRequest('selector'),
      'selector',
      400,
      'INVALID_REQUEST',
    ],
    [
      'the reserved key new',
      latestRequest('new'),
      'new',
      400,
      'INVALID_REQUEST',
    ],
    [
      'the reserved key context',
      latestRequest('context'),
      'context',
      400,
      'INVALID_REQUEST',
    ],
    [
      'the reserved key versions',
      latestRequest('versions'),
      'versions',
      400,
      'INVALID_REQUEST',
    ],
    [
      'a query string',
      latestRequest('profile-hero', {}, '?ownerId=x'),
      'profile-hero',
      400,
      'INVALID_REQUEST',
    ],
    [
      'an Idempotency-Key',
      latestRequest('profile-hero', {
        'idempotency-key': 'idem-key-000000000001',
      }),
      'profile-hero',
      400,
      'INVALID_REQUEST',
    ],
    [
      'an If-Match',
      latestRequest('profile-hero', { 'if-match': '"1"' }),
      'profile-hero',
      400,
      'INVALID_REQUEST',
    ],
    [
      'a content type',
      latestRequest('profile-hero', { 'content-type': 'application/json' }),
      'profile-hero',
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    ],
    [
      'a cross-origin request',
      latestRequest('profile-hero', { origin: 'https://evil.test' }),
      'profile-hero',
      403,
      'COMPOSITION_FORBIDDEN',
    ],
  ];
  it.each(cases)('refuses %s', async (_name, request, key, status, code) => {
    const { binding, done } = run(request, key);
    const response = await done;
    expect(response.status).toBe(status);
    expect(await codeOf(response)).toBe(code);
    expect(binding.fetch).not.toHaveBeenCalled();
  });

  it('refuses a non-GET and a missing binding', async () => {
    const post = new Request(`${ORIGIN}/api/v1/cms/patterns/profile-hero`, {
      method: 'POST',
    });
    const { binding, done } = run(post, 'profile-hero');
    expect((await done).status).toBe(400);
    expect(binding.fetch).not.toHaveBeenCalled();
    expect(
      (await readCmsPatternLatest(latestRequest(), undefined, 'profile-hero'))
        .status,
    ).toBe(503);
  });
});

describe('cmsPatternLatestRead proxy: an upstream success must be this key at this version', () => {
  const invalid: ReadonlyArray<readonly [string, Response]> = [
    ['a 201', jsonResponse(201, patternDetailFixture(), { etag: '"1"' })],
    ['another key', served({ patternKey: 'other-key' })],
    [
      'a version that is not the numbered version',
      served({ patternVersion: 2 }),
    ],
    ['a missing ETag', jsonResponse(200, patternDetailFixture())],
    [
      'an ETag that is not the version',
      jsonResponse(200, patternDetailFixture(), { etag: '"9"' }),
    ],
    [
      'a weak ETag',
      jsonResponse(200, patternDetailFixture(), { etag: 'W/"1"' }),
    ],
    [
      'a body with an ownership member',
      jsonResponse(
        200,
        { ...patternDetailFixture(), ownerId: 'x' },
        { etag: '"1"' },
      ),
    ],
    [
      'a tree that breaks the contract',
      jsonResponse(
        200,
        { ...patternDetailFixture(), blockTree: [] },
        { etag: '"1"' },
      ),
    ],
    [
      'a body that is not JSON',
      new Response('x', { status: 200, headers: { etag: '"1"' } }),
    ],
  ];
  it.each(invalid)('is a retryable 502 for %s', async (_name, upstream) => {
    const { done } = run(latestRequest(), 'profile-hero', upstream);
    const response = await done;
    expect(response.status).toBe(502);
    expect(await codeOf(response)).toBe('DEPENDENCY_UNAVAILABLE');
    expect(response.headers.get('x-cms-editorial-outcome')).toBeNull();
  });

  it('is a 503 when the upstream cannot be reached', async () => {
    const { done } = run(latestRequest(), 'profile-hero', new Error('reset'));
    expect((await done).status).toBe(503);
  });
});
