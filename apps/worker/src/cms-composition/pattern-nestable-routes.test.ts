import { ApiErrorSchema, PatternSelectorPageSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { failure } from './pattern-instance-contracts';
import {
  createPatternUpdateHarness,
  puSession,
} from './pattern-update-routes.test-support';
import {
  PU_ORIGIN,
  PU_REQUEST_ID,
  PU_TYPE_ID,
  selectorItem,
  selectorPage,
} from './pattern-update.test-support';

/**
 * cmsPatternNestableRead (DEC-196; BE03c 184, 413, 1427, 1528, 1665): the designer-only list behind the nested-pattern
 * picker. A strict repeated-key query, the designer capability (an author or editor alone is a 403), the signed cursor
 * passed through byte for byte, a page that must honour the request, and the page version as the ETag.
 */
const PATH = '/api/v1/cms/patterns/nestable';
const OTHER_TYPE = 'a9120000-0000-4000-8000-0000000000b2';
const QUERY = `contentTypeId=${PU_TYPE_ID}&contentTypeId=${OTHER_TYPE}`;
const designer = puSession(['cms.template_designer']);
const harnessFor = (
  overrides: Parameters<typeof createPatternUpdateHarness>[0] = {},
) =>
  createPatternUpdateHarness({
    resolveSession: async () => ({ ok: true, value: designer }),
    ...overrides,
  });
const get = (
  harness: ReturnType<typeof createPatternUpdateHarness>,
  query = QUERY,
) => harness.request(`${PATH}?${query}`);

describe('cmsPatternNestableRead route', () => {
  it('serves the strict page with the quoted page-version ETag and hands the port every requested type', async () => {
    const harness = harnessFor();
    const response = await get(harness);
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"1790000000000000"');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(PatternSelectorPageSchema.parse(await response.json())).toEqual(
      selectorPage(),
    );
    expect(harness.readNestable.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'cmsPatternNestableRead',
      requestId: PU_REQUEST_ID,
      query: { contentTypeId: [PU_TYPE_ID, OTHER_TYPE], limit: 25 },
    });
    expect(harness.readNestable.mock.calls[0]?.[0].query).not.toHaveProperty(
      'cursor',
    );
    expect(harness.readSelector).not.toHaveBeenCalled();
  });

  it('passes the signed cursor and the limit through unchanged', async () => {
    const cursor = 'eyJxdWVyeUhhc2giOiJ4In0=.c2ln';
    const harness = harnessFor({
      readNestable: async () => ({
        ok: true,
        value: selectorPage(0, {
          items: [selectorItem(1)],
          nextCursor: 'next.sig',
        }),
      }),
    });
    const response = await get(
      harness,
      `${QUERY}&limit=1&cursor=${encodeURIComponent(cursor)}`,
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as { nextCursor: string }).nextCursor).toBe(
      'next.sig',
    );
  });

  it('requires the designer capability: an author or an editor alone is 403 capability_missing and consumes no quota', async () => {
    for (const capabilities of [
      ['cms.author'],
      ['cms.editor'],
      ['cms.author', 'cms.editor'],
      [],
    ]) {
      const harness = harnessFor({
        resolveSession: async () => ({
          ok: true,
          value: puSession(capabilities),
        }),
      });
      const response = await get(harness);
      expect(response.status).toBe(403);
      expect(ApiErrorSchema.parse(await response.json()).details).toEqual({
        reasonCode: 'capability_missing',
      });
      expect(harness.rateLimit).not.toHaveBeenCalled();
      expect(harness.readNestable).not.toHaveBeenCalled();
    }
  });

  it('a session with no acting party is 403 before any quota', async () => {
    const harness = harnessFor({
      resolveSession: async () => ({
        ok: true,
        value: { ...designer, actingPartyId: null },
      }),
    });
    expect((await get(harness)).status).toBe(403);
    expect(harness.rateLimit).not.toHaveBeenCalled();
  });

  it('asks the user bucket then the party bucket of cmsPatternNestableRead (300 / 600 per 60 seconds)', async () => {
    const harness = harnessFor();
    await get(harness);
    expect(
      harness.rateLimit.mock.calls.map(([input]) => [
        input.operationId,
        input.rateClass,
        input.rateScope,
        input.limit,
        input.windowSeconds,
      ]),
    ).toEqual([
      ['cmsPatternNestableRead', 'cms-pattern-nestable-read', 'user', 300, 60],
      ['cmsPatternNestableRead', 'cms-pattern-nestable-read', 'party', 600, 60],
    ]);
  });

  it.each([
    ['no query', '', 400],
    ['a missing contentTypeId', 'limit=5', 400],
    ['a malformed contentTypeId', 'contentTypeId=nope', 400],
    ['a duplicated contentTypeId', `${QUERY}&contentTypeId=${PU_TYPE_ID}`, 400],
    ['an unknown key', `${QUERY}&x=1`, 400],
    ['a duplicated cursor', `${QUERY}&cursor=a&cursor=b`, 400],
    ['an oversize cursor', `${QUERY}&cursor=${'a'.repeat(513)}`, 400],
    ['a non-numeric limit', `${QUERY}&limit=abc`, 400],
    ['a limit above the maximum', `${QUERY}&limit=51`, 422],
    ['a limit of zero', `${QUERY}&limit=0`, 422],
  ])('%s is $2 before any quota or port', async (_name, query, status) => {
    const harness = harnessFor();
    const response = await get(harness, query);
    expect(response.status).toBe(status);
    const body = ApiErrorSchema.parse(await response.json());
    expect(body.code).toBe(
      status === 422 ? 'COMPOSITION_VALIDATION_FAILED' : 'INVALID_REQUEST',
    );
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.readNestable).not.toHaveBeenCalled();
  });

  it('65 content types is the 422 naming /contentTypeId; 64 is served', async () => {
    const types = (count: number) =>
      Array.from(
        { length: count },
        (_unused, index) =>
          `contentTypeId=a9120000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      ).join('&');
    const harness = harnessFor();
    const refused = await get(harness, types(65));
    expect(refused.status).toBe(422);
    expect(ApiErrorSchema.parse(await refused.json()).details).toEqual({
      violations: [
        {
          path: '/contentTypeId',
          code: 'invalid',
          message: 'The value is invalid.',
        },
      ],
    });
    expect(harness.readNestable).not.toHaveBeenCalled();
    expect((await get(harness, types(64))).status).toBe(200);
  });

  it.each([
    ['an Idempotency-Key', { 'idempotency-key': 'pattern-update-0001' }, 400],
    ['an If-Match', { 'if-match': '"1"' }, 400],
    ['a request media type', { 'content-type': 'application/json' }, 415],
    ['a declared body', { 'content-length': '5' }, 400],
    ['a transfer encoding', { 'transfer-encoding': 'chunked' }, 400],
  ])('a read carrying %s is $2', async (_name, headers, status) => {
    const harness = harnessFor();
    const response = await harness.request(`${PATH}?${QUERY}`, { headers });
    expect(response.status).toBe(status);
    expect(harness.readNestable).not.toHaveBeenCalled();
  });

  it('a malformed query is answered after authentication, never before', async () => {
    const harness = harnessFor({
      resolveSession: async () => ({
        ok: false,
        status: 401,
        code: 'U',
        message: 'u',
      }),
    });
    expect((await get(harness, 'x=1')).status).toBe(401);
  });

  it('publishes the hidden content type as 404 and folds a 409 from the port (matrix: not applicable, DEC-232) to the scrubbed 500', async () => {
    const hidden = harnessFor({ readNestable: async () => failure(404) });
    expect((await get(hidden)).status).toBe(404);
    const conflict = harnessFor({
      readNestable: async () =>
        failure(409, { reasonCode: 'revision_not_editable' }),
    });
    const response = await get(conflict);
    expect(response.status).toBe(500);
    expect(ApiErrorSchema.parse(await response.json()).details).toEqual({});
  });

  it.each([
    ['more rows than the limit', selectorPage(3), '&limit=2'],
    [
      'a cursor after a short page',
      selectorPage(1, { nextCursor: 'x.y' }),
      '&limit=2',
    ],
    [
      'rows out of keyset order',
      { ...selectorPage(0), items: [selectorItem(2), selectorItem(1)] },
      '',
    ],
    [
      'a field outside the contract',
      { ...selectorPage(1), items: [{ ...selectorItem(1), extra: 1 }] },
      '',
    ],
  ])(
    'an answer with %s is a local 502, never a page',
    async (_name, value, extra) => {
      const harness = harnessFor({
        readNestable: async () => ({ ok: true, value: value as never }),
      });
      const response = await get(harness, `${QUERY}${extra}`);
      expect(response.status).toBe(502);
      expect(response.headers.get('etag')).toBeNull();
    },
  );

  it('a port that throws is a retryable 503', async () => {
    const harness = harnessFor({
      readNestable: async () => {
        throw new Error('boom');
      },
    });
    expect((await get(harness)).status).toBe(503);
  });

  it('answers the preflight for an allowed human origin only', async () => {
    const harness = harnessFor();
    const allowed = await harness.request(PATH, { method: 'OPTIONS' });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-methods')).toBe(
      'GET, OPTIONS',
    );
    expect(allowed.headers.get('access-control-allow-origin')).toBe(PU_ORIGIN);
    const denied = await harness.request(PATH, {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example.test' },
    });
    expect(denied.status).toBe(403);
  });
});
