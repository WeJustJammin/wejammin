import { ApiErrorSchema, PatternSelectorPageSchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { failure } from './pattern-instance-contracts';
import { createPatternUpdateHarness } from './pattern-update-routes.test-support';
import {
  PU_ORIGIN,
  PU_REQUEST_ID,
  PU_SELECTOR_PATH,
  PU_TYPE_ID,
  selectorItem,
  selectorPage,
} from './pattern-update.test-support';

/**
 * CMS-03C-13 (BE03c 175, 398, 1266, 1363, 1474): the author-facing pattern selector. A strict query, the signed
 * cursor passed through byte for byte, a page that must honour the request, and the page version as the strong ETag.
 */
const QUERY = `contentTypeId=${PU_TYPE_ID}`;
const get = (
  harness: ReturnType<typeof createPatternUpdateHarness>,
  query = QUERY,
) => harness.request(`${PU_SELECTOR_PATH}?${query}`);

describe('CMS-03C-13 selector route', () => {
  it('serves the strict page with the quoted page-version ETag', async () => {
    const harness = createPatternUpdateHarness();
    const response = await get(harness);
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"1790000000000000"');
    expect(PatternSelectorPageSchema.parse(await response.json())).toEqual(
      selectorPage(),
    );
    expect(harness.readSelector.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'CMS-03C-13',
      requestId: PU_REQUEST_ID,
      query: { contentTypeId: PU_TYPE_ID, limit: 25 },
    });
    expect(harness.readSelector.mock.calls[0]?.[0].query).not.toHaveProperty(
      'cursor',
    );
  });

  it('passes the signed cursor and the limit through unchanged', async () => {
    const cursor = 'eyJxdWVyeUhhc2giOiJ4In0=.c2ln';
    const harness = createPatternUpdateHarness({
      readSelector: async () => ({
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

  it('hands the port the cursor it was given', async () => {
    const harness = createPatternUpdateHarness();
    await get(harness, `${QUERY}&limit=3&cursor=abc.def`);
    expect(harness.readSelector.mock.calls[0]?.[0]).toMatchObject({
      query: { contentTypeId: PU_TYPE_ID, limit: 3, cursor: 'abc.def' },
    });
  });

  it.each([
    ['no query', '', 400],
    ['a missing contentTypeId', 'limit=5', 400],
    ['a malformed contentTypeId', 'contentTypeId=nope', 400],
    ['an unknown key', `${QUERY}&x=1`, 400],
    ['a duplicated cursor', `${QUERY}&cursor=a&cursor=b`, 400],
    ['an empty cursor', `${QUERY}&cursor=`, 400],
    ['an oversize cursor', `${QUERY}&cursor=${'a'.repeat(513)}`, 400],
    ['a non-numeric limit', `${QUERY}&limit=abc`, 400],
    ['a limit above the maximum', `${QUERY}&limit=51`, 422],
    ['a limit of zero', `${QUERY}&limit=0`, 422],
  ])('%s is $2 before any quota or port', async (_name, query, status) => {
    const harness = createPatternUpdateHarness();
    const response = await get(harness, query);
    expect(response.status).toBe(status);
    const body = ApiErrorSchema.parse(await response.json());
    expect(body.code).toBe(
      status === 422 ? 'COMPOSITION_VALIDATION_FAILED' : 'INVALID_REQUEST',
    );
    if (status === 422)
      expect(body.details).toEqual({
        violations: [
          { path: '/limit', code: 'invalid', message: 'The value is invalid.' },
        ],
      });
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.readSelector).not.toHaveBeenCalled();
  });

  it.each([
    ['an Idempotency-Key', { 'idempotency-key': 'pattern-update-0001' }, 400],
    ['an If-Match', { 'if-match': '"1"' }, 400],
    ['a request media type', { 'content-type': 'application/json' }, 415],
    ['a declared body', { 'content-length': '5' }, 400],
    ['a transfer encoding', { 'transfer-encoding': 'chunked' }, 400],
  ])('a read carrying %s is $2', async (_name, headers, status) => {
    const harness = createPatternUpdateHarness();
    const response = await harness.request(`${PU_SELECTOR_PATH}?${QUERY}`, {
      headers,
    });
    expect(response.status).toBe(status);
    if (status === 415)
      expect((await response.json()) as object).toMatchObject({
        details: { allowedMediaTypes: [] },
      });
    expect(harness.readSelector).not.toHaveBeenCalled();
  });

  it('a malformed query is answered after authentication, never before', async () => {
    const harness = createPatternUpdateHarness({
      resolveSession: async () => ({
        ok: false,
        status: 401,
        code: 'U',
        message: 'u',
      }),
    });
    expect((await get(harness, 'x=1')).status).toBe(401);
  });

  it('publishes the cursor conflict (409) with no member and the hidden content type as 404', async () => {
    const conflict = createPatternUpdateHarness({
      readSelector: async () =>
        failure(409, { reasonCode: 'revision_not_editable' }),
    });
    const response = await get(conflict);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: 'COMPOSITION_VERSION_CONFLICT',
      message:
        'COMPOSITION_VERSION_CONFLICT: composition operation rejected or unavailable.',
      requestId: PU_REQUEST_ID,
      details: {},
    });
    const hidden = createPatternUpdateHarness({
      readSelector: async () => failure(404),
    });
    expect((await get(hidden)).status).toBe(404);
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
    [
      'a repeated version row',
      {
        ...selectorPage(0),
        items: [
          selectorItem(1),
          { ...selectorItem(1), patternKey: 'pattern-009' },
        ],
      },
      '',
    ],
  ])(
    'an answer with %s is a local 502, never a page',
    async (_name, value, extra) => {
      const harness = createPatternUpdateHarness({
        readSelector: async () => ({ ok: true, value: value as never }),
      });
      const response = await get(harness, `${QUERY}${extra}`);
      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({
        code: 'DEPENDENCY_UNAVAILABLE',
        details: { dependencyClass: 'cms_composition', retryable: true },
      });
      expect(response.headers.get('etag')).toBeNull();
    },
  );

  it('answers the preflight for an allowed human origin only', async () => {
    const harness = createPatternUpdateHarness();
    const allowed = await harness.request(PU_SELECTOR_PATH, {
      method: 'OPTIONS',
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-methods')).toBe(
      'GET, OPTIONS',
    );
    expect(allowed.headers.get('access-control-allow-headers')).toBe(
      'X-Request-Id',
    );
    expect(allowed.headers.get('access-control-allow-origin')).toBe(PU_ORIGIN);
    const denied = await harness.request(PU_SELECTOR_PATH, {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example.test' },
    });
    expect(denied.status).toBe(403);
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
    const bare = await harness.request(PU_SELECTOR_PATH, {
      method: 'OPTIONS',
      headers: { origin: '' },
    });
    expect(bare.status).toBe(403);
  });
});
