import { describe, expect, it } from 'vitest';
import { readCmsTaxonomyVersions } from './cms-taxonomy-platform-read';
import {
  TAXONOMY_ID,
  VERSIONS_PATH,
  bindingFor,
  jsonResponse,
  readRequest,
  taxonomyApiError,
  versionsPageFixture,
} from './cms-taxonomy-platform.test-support';

const OTHER_ID = '90000000-0000-4000-8000-000000000099';
const errorOf = async (response: Response) =>
  (await response.json()) as { code: string; details: Record<string, unknown> };

describe('cmsTaxonomyVersionsRead proxy', () => {
  const run = (
    request: Request,
    id: string | undefined,
    ...queue: (Response | Error)[]
  ) => {
    const binding = bindingFor(...queue);
    return { binding, done: readCmsTaxonomyVersions(request, binding, id) };
  };
  const served = (
    overrides: Readonly<Record<string, unknown>> = {},
    etag = '"3"',
  ) => jsonResponse(200, versionsPageFixture(overrides), { etag });

  it('forwards a bare GET with the session cookies only and returns the verified page', async () => {
    const { binding, done } = run(
      readRequest(VERSIONS_PATH),
      TAXONOMY_ID,
      served(),
    );
    const response = await done;
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBe('"3"');
    expect(await response.json()).toEqual(versionsPageFixture());
    const sent = binding.requests()[0] as Request;
    expect(sent.method).toBe('GET');
    expect(sent.url).toBe(`https://platform-api.internal${VERSIONS_PATH}`);
    expect(sent.headers.get('cookie')).toBe('wj_access=a');
    expect(sent.headers.get('idempotency-key')).toBeNull();
    expect(sent.body).toBeNull();
  });

  const refused: ReadonlyArray<
    readonly [string, Request, string | undefined, number]
  > = [
    ['a malformed id', readRequest(VERSIONS_PATH), 'not-a-uuid', 400],
    ['no id', readRequest(VERSIONS_PATH), undefined, 400],
    ['a query', readRequest(VERSIONS_PATH, {}, '?x=1'), TAXONOMY_ID, 400],
    [
      'an If-Match',
      readRequest(VERSIONS_PATH, { 'if-match': '"1"' }),
      TAXONOMY_ID,
      400,
    ],
    [
      'an Idempotency-Key',
      readRequest(VERSIONS_PATH, { 'idempotency-key': 'abcdefgh1' }),
      TAXONOMY_ID,
      400,
    ],
    [
      'a media type',
      readRequest(VERSIONS_PATH, { 'content-type': 'application/json' }),
      TAXONOMY_ID,
      415,
    ],
    [
      'a cross-origin read',
      readRequest(VERSIONS_PATH, { origin: 'https://evil.test' }),
      TAXONOMY_ID,
      403,
    ],
    [
      'a POST',
      new Request(`https://app.example.test${VERSIONS_PATH}`, {
        method: 'POST',
      }),
      TAXONOMY_ID,
      400,
    ],
  ];
  it.each(refused)(
    'refuses %s before the Worker',
    async (_name, request, id, status) => {
      const { binding, done } = run(request, id);
      const response = await done;
      expect(response.status).toBe(status);
      expect((await errorOf(response)).code).toMatch(/^[A-Z_]+$/u);
      expect(binding.fetch).not.toHaveBeenCalled();
    },
  );

  it('is 503 with no binding', async () => {
    expect(
      (
        await readCmsTaxonomyVersions(
          readRequest(VERSIONS_PATH),
          undefined,
          TAXONOMY_ID,
        )
      ).status,
    ).toBe(503);
  });

  it('relays typed refusals and drops an undeclared status', async () => {
    const forbidden = await run(
      readRequest(VERSIONS_PATH),
      TAXONOMY_ID,
      jsonResponse(
        403,
        taxonomyApiError('cmsTaxonomyVersionsRead', 403, {
          reasonCode: 'capability_missing',
        }),
      ),
    ).done;
    expect(forbidden.status).toBe(403);
    expect((await errorOf(forbidden)).details).toEqual({
      reasonCode: 'capability_missing',
    });
    const notFound = await run(
      readRequest(VERSIONS_PATH),
      TAXONOMY_ID,
      jsonResponse(404, taxonomyApiError('cmsTaxonomyVersionsRead', 404)),
    ).done;
    expect(notFound.status).toBe(404);
    const conflict = await run(
      readRequest(VERSIONS_PATH),
      TAXONOMY_ID,
      jsonResponse(409, taxonomyApiError('cmsTaxonomyVersionsRead', 409)),
    ).done;
    expect(conflict.status).toBe(502);
  });

  const unverifiable: ReadonlyArray<readonly [string, Response]> = [
    [
      'a page of another vocabulary',
      jsonResponse(
        200,
        versionsPageFixture({
          items: versionsPageFixture().items.map((item) => ({
            ...item,
            taxonomyId: OTHER_ID,
          })),
        }),
        { etag: '"3"' },
      ),
    ],
    ['an ETag that is not the page version', served({}, '"4"')],
    ['a missing ETag', jsonResponse(200, versionsPageFixture())],
    ['a weak ETag', served({}, 'W/"3"')],
    [
      'a row whose version differs from its number',
      jsonResponse(
        200,
        {
          ...versionsPageFixture(),
          items: versionsPageFixture().items.map((item, index) =>
            index === 0 ? { ...item, taxonomyVersion: 9 } : item,
          ),
        },
        { etag: '"3"' },
      ),
    ],
    [
      'an extra member',
      jsonResponse(
        200,
        { ...versionsPageFixture(), owner: 'x' },
        { etag: '"3"' },
      ),
    ],
    [
      'a body that is not JSON',
      new Response('nope', { status: 200, headers: { etag: '"3"' } }),
    ],
    ['a 201', jsonResponse(201, versionsPageFixture(), { etag: '"3"' })],
  ];
  it.each(unverifiable)(
    'answers a local 502 for %s',
    async (_name, upstream) => {
      const response = await run(
        readRequest(VERSIONS_PATH),
        TAXONOMY_ID,
        upstream,
      ).done;
      expect(response.status).toBe(502);
      expect((await errorOf(response)).code).toBe('DEPENDENCY_UNAVAILABLE');
    },
  );

  it('answers a transport loss as 503 and a non-Response as 503', async () => {
    expect(
      (
        await run(readRequest(VERSIONS_PATH), TAXONOMY_ID, new Error('reset'))
          .done
      ).status,
    ).toBe(503);
    expect(
      (
        await readCmsTaxonomyVersions(
          readRequest(VERSIONS_PATH),
          { fetch: () => Promise.resolve(1) },
          TAXONOMY_ID,
        )
      ).status,
    ).toBe(503);
  });
});
