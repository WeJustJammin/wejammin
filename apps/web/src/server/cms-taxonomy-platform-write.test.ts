import { describe, expect, it } from 'vitest';

import { forwardCmsTaxonomyVersionWrite } from './cms-taxonomy-platform-write';
import {
  CSRF,
  KEY,
  WRITE_PATH,
  bindingFor,
  jsonResponse,
  taxonomyApiError,
  versionFixture,
  versionRequestBody,
  writeRequest,
} from './cms-taxonomy-platform.test-support';

const created = (overrides: Readonly<Record<string, unknown>> = {}) =>
  jsonResponse(201, versionFixture(overrides), {
    etag: `"${String(overrides.version ?? '1')}"`,
  });
const run = (request: Request, ...queue: (Response | Error)[]) => {
  const binding = bindingFor(...queue);
  return { binding, done: forwardCmsTaxonomyVersionWrite(request, binding) };
};
const errorOf = async (response: Response) =>
  (await response.json()) as { code: string; details: Record<string, unknown> };

describe('CMS-03C-16 vocabulary version write proxy: forwarding', () => {
  it('forwards a first version with only the approved headers and returns the verified draft', async () => {
    const { binding, done } = run(writeRequest(), created());
    const response = await done;
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBe('"1"');
    expect(response.headers.get('location')).toBeNull();
    expect(await response.json()).toEqual(versionFixture());
    const sent = binding.requests()[0] as Request;
    expect(sent.method).toBe('POST');
    expect(sent.url).toBe(`https://platform-api.internal${WRITE_PATH}`);
    expect(sent.headers.get('cookie')).toBe(`wj_access=a; wj_csrf=${CSRF}`);
    expect(sent.headers.get('x-csrf-token')).toBe(CSRF);
    expect(sent.headers.get('idempotency-key')).toBe(KEY);
    expect(sent.headers.get('if-match')).toBeNull();
    expect(sent.headers.get('content-type')).toBe('application/json');
    expect(await sent.json()).toEqual(versionRequestBody());
  });

  it('forwards a successor with the exact strong If-Match', async () => {
    const body = versionRequestBody({ expectedVersion: '3' });
    const { binding, done } = run(
      writeRequest({}, body),
      created({ version: '4', taxonomyVersion: 4 }),
    );
    expect((await done).status).toBe(201);
    expect((binding.requests()[0] as Request).headers.get('if-match')).toBe(
      '"3"',
    );
  });

  it('re-serializes the strict body in contract order: nothing the parse dropped is forwarded', async () => {
    const { binding, done } = run(writeRequest(), created());
    await done;
    expect(
      Object.keys(await (binding.requests()[0] as Request).json()),
    ).toEqual([
      'taxonomyKey',
      'shape',
      'allowedTypeKeys',
      'allowedFieldKeys',
      'canonicalOverlapDomains',
      'expectedVersion',
    ]);
  });

  it('accepts a vocabulary that declares no canonical domain', async () => {
    const { binding, done } = run(
      writeRequest({}, versionRequestBody({ canonicalOverlapDomains: [] })),
      created({ canonicalOverlapDomains: [] }),
    );
    expect((await done).status).toBe(201);
    expect(binding.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('CMS-03C-16 vocabulary version write proxy: admission (nothing reaches the Worker)', () => {
  const cases: ReadonlyArray<readonly [string, Request, number, string]> = [
    ['a GET', writeRequest({ method: 'GET' }), 400, 'INVALID_REQUEST'],
    [
      'a query string',
      writeRequest({ url: `https://app.example.test${WRITE_PATH}?x=1` }),
      400,
      'INVALID_REQUEST',
    ],
    [
      'a cross-origin request',
      writeRequest({ headers: { origin: 'https://evil.test' } }),
      403,
      'TAXONOMY_FORBIDDEN',
    ],
    [
      'a missing CSRF header',
      writeRequest({ headers: { 'x-csrf-token': null } }),
      403,
      'TAXONOMY_FORBIDDEN',
    ],
    [
      'a mismatched CSRF header',
      writeRequest({ headers: { 'x-csrf-token': 'other-token-1234567' } }),
      403,
      'TAXONOMY_FORBIDDEN',
    ],
    [
      'a non-JSON body',
      writeRequest({ headers: { 'content-type': 'text/plain' } }),
      415,
      'UNSUPPORTED_MEDIA_TYPE',
    ],
    [
      'a missing Idempotency-Key',
      writeRequest({ headers: { 'idempotency-key': null } }),
      400,
      'INVALID_REQUEST',
    ],
    [
      'a short Idempotency-Key',
      writeRequest({ headers: { 'idempotency-key': 'short' } }),
      400,
      'INVALID_REQUEST',
    ],
    [
      'a malformed JSON body',
      writeRequest({ body: '{' }),
      400,
      'INVALID_REQUEST',
    ],
    [
      'an oversized body',
      writeRequest({ body: JSON.stringify({ x: 'y'.repeat(300_000) }) }),
      400,
      'INVALID_REQUEST',
    ],
    [
      'an If-Match on a first version',
      writeRequest({ headers: { 'if-match': '"1"' } }),
      400,
      'INVALID_REQUEST',
    ],
    [
      'a successor without If-Match',
      writeRequest(
        { headers: { 'if-match': null } },
        versionRequestBody({ expectedVersion: '3' }),
      ),
      400,
      'INVALID_REQUEST',
    ],
    [
      'an If-Match that differs from expectedVersion',
      writeRequest(
        { headers: { 'if-match': '"2"' } },
        versionRequestBody({ expectedVersion: '3' }),
      ),
      400,
      'INVALID_REQUEST',
    ],
    [
      'a weak If-Match',
      writeRequest(
        { headers: { 'if-match': 'W/"3"' } },
        versionRequestBody({ expectedVersion: '3' }),
      ),
      400,
      'INVALID_REQUEST',
    ],
  ];
  it.each(cases)('refuses %s', async (_name, request, status, code) => {
    const { binding, done } = run(request);
    const response = await done;
    expect(response.status).toBe(status);
    expect((await errorOf(response)).code).toBe(code);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(binding.fetch).not.toHaveBeenCalled();
  });

  it('is 503 with no binding and never reaches an upstream', async () => {
    const response = await forwardCmsTaxonomyVersionWrite(
      writeRequest(),
      undefined,
    );
    expect(response.status).toBe(503);
    expect((await errorOf(response)).details).toEqual({
      dependencyClass: 'cms_composition',
      retryable: true,
    });
  });

  const refused: ReadonlyArray<
    readonly [string, Record<string, unknown>, string]
  > = [
    [
      'a key outside the grammar',
      versionRequestBody({ taxonomyKey: 'Bad_Key' }),
      '/taxonomyKey',
    ],
    ['an unknown shape', versionRequestBody({ shape: 'graph' }), '/shape'],
    [
      'no type key',
      versionRequestBody({ allowedTypeKeys: [] }),
      '/allowedTypeKeys',
    ],
    [
      'a duplicate type key',
      versionRequestBody({ allowedTypeKeys: ['a1', 'a1'] }),
      '/allowedTypeKeys',
    ],
    [
      'a malformed field key',
      versionRequestBody({ allowedFieldKeys: ['Bad Key'] }),
      '/allowedFieldKeys',
    ],
    [
      '65 type keys',
      versionRequestBody({
        allowedTypeKeys: Array.from({ length: 65 }, (_, i) => `type_${i}`),
      }),
      '/allowedTypeKeys',
    ],
    [
      'an unknown domain',
      versionRequestBody({ canonicalOverlapDomains: ['planet'] }),
      '/canonicalOverlapDomains',
    ],
    [
      'a duplicate domain',
      versionRequestBody({ canonicalOverlapDomains: ['role', 'role'] }),
      '/canonicalOverlapDomains',
    ],
    [
      'a malformed parent version',
      versionRequestBody({ expectedVersion: '0' }),
      '/expectedVersion',
    ],
  ];
  it.each(refused)(
    'answers %s with a 422 naming only the request member',
    async (_name, body, pointer) => {
      const { binding, done } = run(
        writeRequest(
          { headers: { 'if-match': null } },
          { ...body, tricky: 'echo-me' },
        ),
      );
      const response = await done;
      expect(response.status).toBe(422);
      const parsed = await errorOf(response);
      expect(parsed.code).toBe('TAXONOMY_VALIDATION_FAILED');
      const text = JSON.stringify(parsed);
      expect(text).not.toContain('echo-me');
      expect(text).not.toContain('tricky');
      expect(parsed.details.violations).toContainEqual({
        path: pointer,
        code: 'invalid',
        message: 'The value is invalid.',
      });
      expect(binding.fetch).not.toHaveBeenCalled();
    },
  );
});

describe('CMS-03C-16 vocabulary version write proxy: upstream refusals', () => {
  it('relays a typed capability refusal and a plain conflict with its hints', async () => {
    const forbidden = await run(
      writeRequest(),
      jsonResponse(
        403,
        taxonomyApiError('CMS-03C-16', 403, {
          reasonCode: 'capability_missing',
        }),
      ),
    ).done;
    expect(forbidden.status).toBe(403);
    expect((await errorOf(forbidden)).details).toEqual({
      reasonCode: 'capability_missing',
    });
    expect(forbidden.headers.get('x-cms-editorial-outcome')).toBeNull();

    const conflict = await run(
      writeRequest({}, versionRequestBody({ expectedVersion: '2' })),
      jsonResponse(
        409,
        taxonomyApiError('CMS-03C-16', 409, {
          expectedVersion: '2',
          currentVersion: '4',
        }),
      ),
    ).done;
    expect(conflict.status).toBe(409);
    expect((await errorOf(conflict)).details).toEqual({
      expectedVersion: '2',
      currentVersion: '4',
    });
    expect(conflict.headers.get('x-cms-editorial-outcome')).toBeNull();
  });

  it('marks a 5xx refusal as an unknown outcome (the command may have committed)', async () => {
    for (const status of [500, 502, 503, 504]) {
      const response = await run(
        writeRequest(),
        jsonResponse(status, taxonomyApiError('CMS-03C-16', status)),
      ).done;
      expect(response.status).toBe(status);
      expect(response.headers.get('x-cms-editorial-outcome')).toBe('unknown');
    }
  });

  it('does not mark a definite 4xx refusal as unknown', async () => {
    for (const status of [400, 401, 404, 415, 422, 429]) {
      const response = await run(
        writeRequest(),
        jsonResponse(status, taxonomyApiError('CMS-03C-16', status)),
      ).done;
      expect(response.status).toBe(status);
      expect(response.headers.get('x-cms-editorial-outcome')).toBeNull();
    }
  });
});

describe('CMS-03C-16 vocabulary version write proxy: an upstream success must be this request', () => {
  const unverifiable: ReadonlyArray<readonly [string, Response]> = [
    [
      'a 200 instead of 201',
      jsonResponse(200, versionFixture(), { etag: '"1"' }),
    ],
    ['an active draft', created({ state: 'active' })],
    ['another key', created({ taxonomyKey: 'other-key' })],
    [
      'a version that is not parent + 1',
      created({ version: '2', taxonomyVersion: 2 }),
    ],
    [
      'a version that differs from the numbered version',
      created({ taxonomyVersion: 2 }),
    ],
    ['another shape', created({ shape: 'flat' })],
    ['other type keys', created({ allowedTypeKeys: ['article'] })],
    [
      'type keys in another order',
      created({ allowedTypeKeys: ['profile', 'article'] }),
    ],
    ['other field keys', created({ allowedFieldKeys: ['topics'] })],
    ['other declared domains', created({ canonicalOverlapDomains: [] })],
    [
      'an ETag that is not the version',
      jsonResponse(201, versionFixture(), { etag: '"2"' }),
    ],
    ['a missing ETag', jsonResponse(201, versionFixture())],
    ['a weak ETag', jsonResponse(201, versionFixture(), { etag: 'W/"1"' })],
    [
      'a body that is not the resource',
      jsonResponse(201, { ...versionFixture(), owner: 'x' }, { etag: '"1"' }),
    ],
    [
      'a body that is not JSON',
      new Response('nope', { status: 201, headers: { etag: '"1"' } }),
    ],
  ];
  it.each(unverifiable)(
    'is an unknown outcome for %s',
    async (_name, upstream) => {
      const response = await run(writeRequest(), upstream).done;
      expect(response.status).toBe(502);
      expect(response.headers.get('x-cms-editorial-outcome')).toBe('unknown');
      const body = await errorOf(response);
      expect(body.code).toBe('DEPENDENCY_UNAVAILABLE');
      expect(body.details).toEqual({
        dependencyClass: 'cms_composition',
        retryable: true,
      });
    },
  );

  it('treats a transport loss after dispatch as an unknown outcome', async () => {
    const response = await run(writeRequest(), new Error('connection reset'))
      .done;
    expect(response.status).toBe(503);
    expect(response.headers.get('x-cms-editorial-outcome')).toBe('unknown');
  });

  it('treats a binding that answers a non-Response as an unknown outcome', async () => {
    const binding = { fetch: () => Promise.resolve('nope') };
    const response = await forwardCmsTaxonomyVersionWrite(
      writeRequest(),
      binding,
    );
    expect(response.status).toBe(503);
    expect(response.headers.get('x-cms-editorial-outcome')).toBe('unknown');
  });
});
