import { describe, expect, it } from 'vitest';
import {
  ApiErrorSchema,
  TaxonomyTermListPageSchema,
} from '@wejammin/contracts';

import {
  createReadsHarness,
  READS_REQUEST_ID,
  termItem,
  termsPage,
  TERMS_PATH,
} from './taxonomy-reads.test-support';
import {
  failure,
  type CmsTaxonomyDefinitionError,
} from './taxonomy-definition-shared';
import {
  taxonomyDefinitionId,
  taxonomyDefinitionOrigin,
} from './taxonomy-definition.test-support';

/**
 * cmsTaxonomyTermsRead (BE03c 167, 371, 406-407): the curator's term list. BE00 order: origin, media, session, headers,
 * strict path and query (400), capability, quota, port; ETag = page version; no-store; a query fault is a 400 (the
 * validation row answers 400/policy-safe 404/502 only).
 */
const getTerms = (query = '', headers: Record<string, string> = {}) => {
  const h = createReadsHarness();
  return {
    h,
    response: h.request(`${TERMS_PATH}${query}`, { headers }),
  };
};

describe('cmsTaxonomyTermsRead route', () => {
  it('serves the page with a quoted page-version ETag, no-store and the CORS echo', async () => {
    const { h, response } = getTerms();
    const reply = await response;
    expect(reply.status).toBe(200);
    expect(reply.headers.get('etag')).toBe('"1790000000000000"');
    expect(reply.headers.get('cache-control')).toBe('no-store');
    expect(reply.headers.get('access-control-allow-origin')).toBe(
      taxonomyDefinitionOrigin,
    );
    expect(reply.headers.get('x-request-id')).toBe(READS_REQUEST_ID);
    expect(TaxonomyTermListPageSchema.parse(await reply.json())).toEqual(
      termsPage(),
    );
    expect(h.readTerms).toHaveBeenCalledTimes(1);
    expect(h.readTerms.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'cmsTaxonomyTermsRead',
      taxonomyId: taxonomyDefinitionId,
      query: { limit: 25 },
    });
  });

  it('applies the limit default, passes lifecycle and the opaque cursor through verbatim', async () => {
    const cursor = 'eyJxdWVyeUhhc2giOiJ4In0=';
    const { h, response } = getTerms(
      `?lifecycle=deprecated&limit=7&cursor=${encodeURIComponent(cursor)}`,
    );
    const reply = await response;
    expect(h.readTerms).toHaveBeenCalledTimes(1);
    expect(h.readTerms.mock.calls[0]?.[0]).toMatchObject({
      query: { lifecycle: 'deprecated', limit: 7, cursor },
    });
    // the fixture's active terms break the lifecycle filter the request named: an unbound answer is a 502
    expect(reply.status).toBe(502);
  });

  it('charges the user then the party bucket of the terms read class', async () => {
    const { h, response } = getTerms();
    await response;
    expect(h.rateLimit.mock.calls.map(([input]) => input)).toMatchObject([
      {
        operationId: 'cmsTaxonomyTermsRead',
        rateClass: 'cms-taxonomy-terms-read',
        rateScope: 'user',
        limit: 120,
        windowSeconds: 60,
      },
      {
        operationId: 'cmsTaxonomyTermsRead',
        rateClass: 'cms-taxonomy-terms-read',
        rateScope: 'party',
        limit: 240,
        windowSeconds: 60,
      },
    ]);
  });

  it.each([
    ['an unknown key', '?x=1'],
    ['a duplicated limit', '?limit=1&limit=2'],
    ['a duplicated cursor', '?cursor=a&cursor=b'],
    ['an unknown lifecycle', '?lifecycle=retired'],
    ['an empty lifecycle', '?lifecycle='],
    ['limit 0', '?limit=0'],
    ['limit 51', '?limit=51'],
    ['limit 1000000', '?limit=1000000'],
    ['an astronomically large limit', `?limit=${'9'.repeat(400)}`],
    ['a negative limit', '?limit=-1'],
    ['a fractional limit', '?limit=1.5'],
    ['a non-numeric limit', '?limit=abc'],
    ['a signed limit', '?limit=%2B5'],
    ['an empty limit', '?limit='],
    ['an empty cursor', '?cursor='],
    ['a cursor over 512 characters', `?cursor=${'a'.repeat(513)}`],
    ['a key in the wrong case', '?Limit=5'],
  ])(
    'refuses %s with a bare 400 before capability, quota and port',
    async (_name, query) => {
      const { h, response } = getTerms(query);
      const reply = await response;
      expect(reply.status).toBe(400);
      expect(ApiErrorSchema.parse(await reply.json())).toMatchObject({
        code: 'INVALID_REQUEST',
        details: {},
      });
      expect(h.rateLimit).not.toHaveBeenCalled();
      expect(h.readTerms).not.toHaveBeenCalled();
    },
  );

  it('accepts a 512-character cursor and limit 50', async () => {
    const cursor = 'a'.repeat(512);
    const h = createReadsHarness({
      readTerms: async () => ({
        ok: true,
        value: termsPage(1, { nextCursor: cursor }),
      }),
    });
    const reply = await h.request(`${TERMS_PATH}?limit=50&cursor=${cursor}`);
    expect(reply.status).toBe(200);
  });

  it('refuses a malformed vocabulary id and any request that carries a body or write header', async () => {
    const h = createReadsHarness();
    expect(
      (await h.request('/api/v1/cms/taxonomies/not-a-uuid/terms')).status,
    ).toBe(400);
    for (const headers of [
      { 'if-match': '"1"' },
      { 'idempotency-key': 'taxonomy-read-0001' },
      { 'transfer-encoding': 'chunked' },
    ])
      expect((await h.request(TERMS_PATH, { headers })).status).toBe(400);
    expect(
      (await h.request(TERMS_PATH, { headers: { 'content-type': 'x/y' } }))
        .status,
    ).toBe(415);
    expect(h.readTerms).not.toHaveBeenCalled();
    expect(h.rateLimit).not.toHaveBeenCalled();
  });

  it('refuses a foreign origin before the session is resolved', async () => {
    const h = createReadsHarness();
    const reply = await h.request(TERMS_PATH, {
      headers: { origin: 'https://evil.test' },
    });
    expect(reply.status).toBe(403);
    expect(h.resolveSession).not.toHaveBeenCalled();
  });

  it('a caller without cms.taxonomy_curator is 403 capability_missing and consumes no quota', async () => {
    const h = createReadsHarness({}, ['cms.author', 'cms.editor']);
    const reply = await h.request(TERMS_PATH);
    expect(reply.status).toBe(403);
    expect(ApiErrorSchema.parse(await reply.json())).toMatchObject({
      code: 'TAXONOMY_FORBIDDEN',
      details: { reasonCode: 'capability_missing' },
    });
    expect(h.rateLimit).not.toHaveBeenCalled();
    expect(h.readTerms).not.toHaveBeenCalled();
  });

  it('a malformed query outranks a missing capability (strict query is BE00 step 6, capability step 7)', async () => {
    const h = createReadsHarness({}, ['cms.author']);
    expect((await h.request(`${TERMS_PATH}?limit=0`)).status).toBe(400);
  });

  it('relays the quota refusal with its headers and never reaches the port', async () => {
    const h = createReadsHarness({
      rateLimit: async (input) => ({
        ok: true,
        value: {
          allowed: false,
          limit: input.limit,
          remaining: 0,
          resetAt: 61,
        },
      }),
    });
    const reply = await h.request(TERMS_PATH);
    expect(reply.status).toBe(429);
    expect(reply.headers.get('retry-after')).toBe('61');
    expect(h.readTerms).not.toHaveBeenCalled();
  });

  it.each([
    [404, 'TAXONOMY_NOT_FOUND', {}],
    [403, 'TAXONOMY_FORBIDDEN', { reasonCode: 'capability_missing' }],
    [409, 'TAXONOMY_VERSION_CONFLICT', {}],
    [400, 'INVALID_REQUEST', {}],
    [
      503,
      'DEPENDENCY_UNAVAILABLE',
      { dependencyClass: 'cms_composition', retryable: true },
    ],
    [
      504,
      'DEPENDENCY_UNAVAILABLE',
      { dependencyClass: 'cms_composition', retryable: true },
    ],
  ] as const)(
    'relays the port refusal %i as %s',
    async (status, code, details) => {
      const error: CmsTaxonomyDefinitionError = failure(
        status,
        status === 403 ? { reasonCode: 'capability_missing' } : { secret: 'x' },
        status >= 503 ? 5 : undefined,
      );
      const h = createReadsHarness({ readTerms: async () => error });
      const reply = await h.request(TERMS_PATH);
      expect(reply.status).toBe(status);
      const body = ApiErrorSchema.parse(await reply.json());
      expect(body.code).toBe(code);
      expect(body.details).toEqual(details);
    },
  );

  it.each([
    ['more items than the limit', '?limit=1', termsPage(2)],
    [
      'a duplicated term',
      '',
      termsPage(2, { items: [termItem(1), termItem(1)] }),
    ],
    [
      'an out-of-order page',
      '',
      termsPage(2, { items: [termItem(2), termItem(1)] }),
    ],
    [
      'a term of another lifecycle than asked',
      '?lifecycle=merged',
      termsPage(1),
    ],
    ['a page over the schema', '', { ...termsPage(1), extra: true }],
    ['a non-object', '', 'x'],
  ])('answers %s from the port as 502', async (_name, query, value) => {
    const h = createReadsHarness({
      readTerms: async () => ({ ok: true, value: value as never }),
    });
    const reply = await h.request(`${TERMS_PATH}${query}`);
    expect(reply.status).toBe(502);
    expect(await reply.json()).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      details: { dependencyClass: 'cms_composition', retryable: true },
    });
    expect(reply.headers.get('etag')).toBeNull();
  });

  it('accepts the merged term with its successor when the lifecycle filter names merged', async () => {
    const merged = termItem(1, {
      lifecycle: 'merged',
      successorId: 'aaaaaaaa-0000-4000-8000-0000000000ff',
    });
    const h = createReadsHarness({
      readTerms: async () => ({
        ok: true,
        value: termsPage(1, { items: [merged] }),
      }),
    });
    expect((await h.request(`${TERMS_PATH}?lifecycle=merged`)).status).toBe(
      200,
    );
  });

  it('answers the empty page of a visible vocabulary as 200 with page version 1', async () => {
    const h = createReadsHarness({
      readTerms: async () => ({
        ok: true,
        value: termsPage(0, { pageVersion: '1' }),
      }),
    });
    const reply = await h.request(TERMS_PATH);
    expect(reply.status).toBe(200);
    expect(reply.headers.get('etag')).toBe('"1"');
  });

  it('preflight advertises GET and the request-id header only', async () => {
    const h = createReadsHarness();
    const reply = await h.request(TERMS_PATH, { method: 'OPTIONS' });
    expect(reply.status).toBe(204);
    expect(reply.headers.get('access-control-allow-methods')).toBe(
      'GET, OPTIONS',
    );
    expect(reply.headers.get('access-control-allow-headers')).toBe(
      'X-Request-Id',
    );
  });

  it('records telemetry under the terms read operation id', async () => {
    const { h, response } = getTerms();
    await response;
    expect(h.dependencies.telemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'cmsTaxonomyTermsRead',
        status: 200,
        outcome: 'success',
      }),
    );
  });
});

describe('cmsTaxonomyTermsRead keyset order tie-break (termKey, then termId)', () => {
  const tie = (first: number, second: number) =>
    termsPage(2, {
      items: [
        termItem(first, { termKey: 'same-key' }),
        termItem(second, { termKey: 'same-key' }),
      ],
    });
  it('accepts equal keys in ascending term id order and refuses descending', async () => {
    const ok = createReadsHarness({
      readTerms: async () => ({ ok: true, value: tie(1, 2) }),
    });
    expect((await ok.request(TERMS_PATH)).status).toBe(200);
    const bad = createReadsHarness({
      readTerms: async () => ({ ok: true, value: tie(2, 1) }),
    });
    expect((await bad.request(TERMS_PATH)).status).toBe(502);
  });
});
