import { describe, expect, it } from 'vitest';

import { forwardCmsPatternVersionWrite } from './cms-pattern-platform-write';
import {
  CSRF,
  KEY,
  WRITE_PATH,
  bindingFor,
  jsonResponse,
  patternApiError,
  patternRequestBody,
  patternResourceFixture,
  writeRequest,
} from './cms-pattern-platform.test-support';

const created = (overrides: Readonly<Record<string, unknown>> = {}) =>
  jsonResponse(201, patternResourceFixture(overrides), {
    etag: `"${String(overrides.version ?? '1')}"`,
  });
const run = (request: Request, ...queue: (Response | Error)[]) => {
  const binding = bindingFor(...queue);
  return { binding, done: forwardCmsPatternVersionWrite(request, binding) };
};
const errorOf = async (response: Response) =>
  (await response.json()) as {
    code: string;
    details: Record<string, unknown>;
  };

describe('CMS-03C-12 pattern version write proxy: forwarding', () => {
  it('forwards a first version with only the approved headers and returns the verified draft', async () => {
    const { binding, done } = run(writeRequest(), created());
    const response = await done;
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBe('"1"');
    expect(await response.json()).toEqual(patternResourceFixture());
    const sent = binding.requests()[0] as Request;
    expect(sent.method).toBe('POST');
    expect(sent.url).toBe(`https://platform-api.internal${WRITE_PATH}`);
    expect(sent.headers.get('cookie')).toBe(`wj_access=a; wj_csrf=${CSRF}`);
    expect(sent.headers.get('x-csrf-token')).toBe(CSRF);
    expect(sent.headers.get('idempotency-key')).toBe(KEY);
    expect(sent.headers.get('if-match')).toBeNull();
    expect(sent.headers.get('content-type')).toBe('application/json');
    expect(await sent.json()).toEqual(patternRequestBody());
  });

  it('forwards a successor with the exact strong If-Match', async () => {
    const body = patternRequestBody({ expectedVersion: '3' });
    const { binding, done } = run(
      writeRequest({}, body),
      created({ version: '4', patternVersion: 4 }),
    );
    expect((await done).status).toBe(201);
    expect((binding.requests()[0] as Request).headers.get('if-match')).toBe(
      '"3"',
    );
  });

  it('re-serializes the strict body: nothing the parse dropped is forwarded', async () => {
    const { binding, done } = run(writeRequest(), created());
    await done;
    expect(
      Object.keys(await (binding.requests()[0] as Request).json()),
    ).toEqual([
      'patternKey',
      'compatibleTypeIds',
      'blockTree',
      'expectedVersion',
    ]);
  });
});

describe('CMS-03C-12 pattern version write proxy: admission (nothing reaches the Worker)', () => {
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
      'COMPOSITION_FORBIDDEN',
    ],
    [
      'a missing CSRF header',
      writeRequest({ headers: { 'x-csrf-token': null } }),
      403,
      'COMPOSITION_FORBIDDEN',
    ],
    [
      'a mismatched CSRF header',
      writeRequest({ headers: { 'x-csrf-token': 'other-token-1234567' } }),
      403,
      'COMPOSITION_FORBIDDEN',
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
        patternRequestBody({ expectedVersion: '3' }),
      ),
      400,
      'INVALID_REQUEST',
    ],
    [
      'an If-Match that differs from expectedVersion',
      writeRequest(
        { headers: { 'if-match': '"2"' } },
        patternRequestBody({ expectedVersion: '3' }),
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
    const response = await forwardCmsPatternVersionWrite(
      writeRequest(),
      undefined,
    );
    expect(response.status).toBe(503);
    expect((await errorOf(response)).details).toEqual({
      dependencyClass: 'cms_composition',
      retryable: true,
    });
  });

  it('answers a body the contract refuses with a 422 naming only a request member', async () => {
    const { binding, done } = run(
      writeRequest(
        {},
        patternRequestBody({ blockTree: [], tricky: 'echo-me' }),
      ),
    );
    const response = await done;
    expect(response.status).toBe(422);
    const body = await errorOf(response);
    expect(body.code).toBe('COMPOSITION_VALIDATION_FAILED');
    const text = JSON.stringify(body);
    expect(text).not.toContain('echo-me');
    expect(text).not.toContain('tricky');
    expect(body.details).toEqual({
      violations: [
        {
          path: '/blockTree',
          code: 'invalid',
          message: 'The value is invalid.',
        },
        { path: '/', code: 'invalid', message: 'The value is invalid.' },
      ],
    });
    expect(binding.fetch).not.toHaveBeenCalled();
  });

  it.each(['/blockTree/0', '/blockTree/2/children/1/children/0'])(
    'DEC-210 relays block_rules_violated with its one bounded violation %s and nothing else',
    async (path) => {
      const { binding, done } = run(
        writeRequest(),
        jsonResponse(
          422,
          patternApiError('CMS-03C-12', 422, {
            reasonCode: 'block_rules_violated',
            violations: [
              { path, code: 'block_rules_violated', message: 'private text' },
              { path: '/secret-pointer', code: 'x', message: 'x' },
            ],
            secret: 'x',
          }),
        ),
      );
      const response = await done;
      expect(response.status).toBe(422);
      expect((await errorOf(response)).details).toEqual({
        reasonCode: 'block_rules_violated',
        violations: [
          {
            path,
            code: 'block_rules_violated',
            message: 'The value is invalid.',
          },
        ],
      });
      expect(binding.fetch).toHaveBeenCalledTimes(1);
    },
  );

  it('answers a reserved key as the typed key_reserved refusal at /patternKey', async () => {
    for (const patternKey of ['context', 'versions', 'selector', 'new']) {
      const { binding, done } = run(
        writeRequest({}, patternRequestBody({ patternKey })),
      );
      const response = await done;
      expect(response.status).toBe(422);
      expect((await errorOf(response)).details).toEqual({
        reasonCode: 'key_reserved',
        violations: [
          {
            path: '/patternKey',
            code: 'key_reserved',
            message: 'The value is invalid.',
          },
        ],
      });
      expect(binding.fetch).not.toHaveBeenCalled();
    }
  });
});

describe('CMS-03C-12 pattern version write proxy: an upstream success must be this request', () => {
  const unverifiable: ReadonlyArray<readonly [string, Response]> = [
    [
      'a 200 instead of 201',
      jsonResponse(200, patternResourceFixture(), { etag: '"1"' }),
    ],
    ['an active draft', created({ state: 'active' })],
    ['another key', created({ patternKey: 'other-key' })],
    [
      'a version that is not parent + 1',
      created({ version: '2', patternVersion: 2 }),
    ],
    [
      'a version that differs from the numbered version',
      created({ patternVersion: 2 }),
    ],
    [
      'other compatible types',
      created({ compatibleTypeIds: ['30000000-0000-4000-8000-000000000099'] }),
    ],
    [
      'an ETag that is not the version',
      jsonResponse(201, patternResourceFixture(), { etag: '"2"' }),
    ],
    ['a missing ETag', jsonResponse(201, patternResourceFixture())],
    [
      'a weak ETag',
      jsonResponse(201, patternResourceFixture(), { etag: 'W/"1"' }),
    ],
    [
      'a body that is not the resource',
      jsonResponse(
        201,
        { ...patternResourceFixture(), owner: 'x' },
        { etag: '"1"' },
      ),
    ],
    [
      'a body that is not JSON',
      new Response('nope', { status: 201, headers: { etag: '"1"' } }),
    ],
    ['a node count below the written nodes', created({ nodeCount: 1 })],
  ];
  it.each(unverifiable)(
    'is an unknown outcome for %s',
    async (_name, upstream) => {
      const { done } = run(writeRequest(), upstream);
      const response = await done;
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
    const { done } = run(writeRequest(), new Error('connection reset'));
    const response = await done;
    expect(response.status).toBe(503);
    expect(response.headers.get('x-cms-editorial-outcome')).toBe('unknown');
  });
});
