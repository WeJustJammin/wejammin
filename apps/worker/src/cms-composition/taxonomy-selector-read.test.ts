import { describe, expect, it } from 'vitest';
import {
  ApiErrorSchema,
  TaxonomySelectorPageSchema,
} from '@wejammin/contracts';

import {
  createReadsHarness,
  READS_REQUEST_ID,
  SELECTOR_PATH,
  SELECTOR_QUERY,
  selectorPage,
  selectorTerm,
} from './taxonomy-reads.test-support';
import { failure } from './taxonomy-definition-shared';
import { taxonomyDefinitionOrigin } from './taxonomy-definition.test-support';

/**
 * CMS-03C-17 (BE03c 179, 373, 403, 1478): the author-facing selector. `cms.author` or `cms.editor` in the owner party
 * (the curator capability alone is NOT enough); a strict query: an unknown, missing or duplicated key and unusable
 * cursor or limit syntax are 400, a key or locale outside its grammar and a limit outside 1-100 are 422 with the
 * member pointer (the SQL reader answers the same).
 */
const getSelector = (
  query = SELECTOR_QUERY,
  capabilities?: readonly string[],
) => {
  const h = createReadsHarness({}, capabilities);
  return { h, response: h.request(`${SELECTOR_PATH}?${query}`) };
};

describe('CMS-03C-17 selector route', () => {
  it('serves the strict page with a quoted page-version ETag and no-store', async () => {
    const { h, response } = getSelector();
    const reply = await response;
    expect(reply.status).toBe(200);
    expect(reply.headers.get('etag')).toBe('"1790000000000000"');
    expect(reply.headers.get('cache-control')).toBe('no-store');
    expect(reply.headers.get('access-control-allow-origin')).toBe(
      taxonomyDefinitionOrigin,
    );
    expect(reply.headers.get('x-request-id')).toBe(READS_REQUEST_ID);
    expect(TaxonomySelectorPageSchema.parse(await reply.json())).toEqual(
      selectorPage(),
    );
    expect(h.readSelector.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'CMS-03C-17',
      query: {
        typeKey: 'article',
        fieldKey: 'instruments',
        locale: 'en-US',
        limit: 50,
      },
    });
  });

  it('passes the cursor and the limit through and charges the selector buckets', async () => {
    const cursor = 'eyJxdWVyeUhhc2giOiJ4In0=';
    const { h, response } = getSelector(
      `${SELECTOR_QUERY}&limit=100&cursor=${encodeURIComponent(cursor)}`,
    );
    await response;
    expect(h.readSelector.mock.calls[0]?.[0]).toMatchObject({
      query: { limit: 100, cursor },
    });
    expect(h.rateLimit.mock.calls.map(([input]) => input)).toMatchObject([
      {
        operationId: 'CMS-03C-17',
        rateClass: 'cms-taxonomy-selector-read',
        rateScope: 'user',
        limit: 300,
        windowSeconds: 60,
      },
      {
        operationId: 'CMS-03C-17',
        rateClass: 'cms-taxonomy-selector-read',
        rateScope: 'party',
        limit: 600,
        windowSeconds: 60,
      },
    ]);
  });

  it.each([['cms.author'], ['cms.editor']])(
    'a caller holding only %s may read',
    async (capability) => {
      const { response } = getSelector(SELECTOR_QUERY, [capability]);
      expect((await response).status).toBe(200);
    },
  );

  it('the curator capability alone is 403 capability_missing with no quota and no port', async () => {
    const { h, response } = getSelector(SELECTOR_QUERY, [
      'cms.taxonomy_curator',
    ]);
    const reply = await response;
    expect(reply.status).toBe(403);
    expect(ApiErrorSchema.parse(await reply.json())).toMatchObject({
      code: 'TAXONOMY_FORBIDDEN',
      details: { reasonCode: 'capability_missing' },
    });
    expect(h.rateLimit).not.toHaveBeenCalled();
    expect(h.readSelector).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing typeKey', 'fieldKey=instruments&locale=en-US'],
    ['a missing fieldKey', 'typeKey=article&locale=en-US'],
    ['a missing locale', 'typeKey=article&fieldKey=instruments'],
    ['no query at all', ''],
    ['an unknown key', `${SELECTOR_QUERY}&x=1`],
    ['a duplicated locale', `${SELECTOR_QUERY}&locale=fr-FR`],
    ['a duplicated cursor', `${SELECTOR_QUERY}&cursor=a&cursor=b`],
    ['a non-numeric limit', `${SELECTOR_QUERY}&limit=abc`],
    ['a fractional limit', `${SELECTOR_QUERY}&limit=1.5`],
    ['an empty limit', `${SELECTOR_QUERY}&limit=`],
    ['a plus-signed limit', `${SELECTOR_QUERY}&limit=%2B5`],
    ['a zero-padded limit', `${SELECTOR_QUERY}&limit=007`],
    ['a negative zero limit', `${SELECTOR_QUERY}&limit=-0`],
    ['an empty cursor', `${SELECTOR_QUERY}&cursor=`],
    [
      'a cursor over 512 characters',
      `${SELECTOR_QUERY}&cursor=${'a'.repeat(513)}`,
    ],
    ['an empty typeKey value', 'typeKey=&fieldKey=instruments&locale=en-US'],
  ])(
    'refuses %s with a bare 400 before capability, quota and port',
    async (_name, query) => {
      const { h, response } = getSelector(query);
      const reply = await response;
      expect(reply.status).toBe(400);
      expect(ApiErrorSchema.parse(await reply.json())).toMatchObject({
        code: 'INVALID_REQUEST',
        details: {},
      });
      expect(h.rateLimit).not.toHaveBeenCalled();
      expect(h.readSelector).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      'typeKey',
      'an uppercase typeKey',
      'typeKey=Article&fieldKey=instruments&locale=en-US',
    ],
    [
      'typeKey',
      'a typeKey starting with a digit',
      'typeKey=1article&fieldKey=instruments&locale=en-US',
    ],
    [
      'fieldKey',
      'a fieldKey containing a space',
      'typeKey=article&fieldKey=has%20space&locale=en-US',
    ],
    [
      'fieldKey',
      'a 65-character fieldKey',
      `typeKey=article&fieldKey=${'a'.repeat(65)}&locale=en-US`,
    ],
    [
      'locale',
      'a locale with an underscore',
      'typeKey=article&fieldKey=instruments&locale=en_US',
    ],
    [
      'locale',
      'a one-letter locale',
      'typeKey=article&fieldKey=instruments&locale=e',
    ],
    ['limit', 'a limit of 0', `${SELECTOR_QUERY}&limit=0`],
    ['limit', 'a limit of 101', `${SELECTOR_QUERY}&limit=101`],
    // One class per BE03c 403: every canonical integer outside 1-100 is the same 422, whatever its digit count.
    ['limit', 'a six-digit limit', `${SELECTOR_QUERY}&limit=999999`],
    ['limit', 'a seven-digit limit', `${SELECTOR_QUERY}&limit=1000000`],
    [
      'limit',
      'a 23-digit limit',
      `${SELECTOR_QUERY}&limit=99999999999999999999999`,
    ],
    ['limit', 'a negative limit', `${SELECTOR_QUERY}&limit=-1`],
  ])(
    'refuses a %s outside its grammar with a 422 pointer, before quota and port (%s)',
    async (member, _name, query) => {
      const { h, response } = getSelector(query);
      const reply = await response;
      expect(reply.status).toBe(422);
      expect(ApiErrorSchema.parse(await reply.json())).toMatchObject({
        code: 'TAXONOMY_VALIDATION_FAILED',
        details: {
          violations: [
            {
              path: `/${member}`,
              code: 'invalid',
              message: 'The value is invalid.',
            },
          ],
        },
      });
      expect(h.rateLimit).not.toHaveBeenCalled();
      expect(h.readSelector).not.toHaveBeenCalled();
    },
  );

  it('a malformed query outranks a missing capability', async () => {
    const { response } = getSelector('typeKey=Article&fieldKey=f&locale=en', [
      'cms.taxonomy_curator',
    ]);
    expect((await response).status).toBe(422);
  });

  it('refuses a foreign origin, a content-type, a write header and a body', async () => {
    const h = createReadsHarness();
    expect(
      (
        await h.request(`${SELECTOR_PATH}?${SELECTOR_QUERY}`, {
          headers: { origin: 'https://evil.test' },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await h.request(`${SELECTOR_PATH}?${SELECTOR_QUERY}`, {
          headers: { 'content-type': 'x/y' },
        })
      ).status,
    ).toBe(415);
    for (const headers of [
      { 'if-match': '"1"' },
      { 'idempotency-key': 'taxonomy-read-0001' },
    ])
      expect(
        (await h.request(`${SELECTOR_PATH}?${SELECTOR_QUERY}`, { headers }))
          .status,
      ).toBe(400);
    expect(h.readSelector).not.toHaveBeenCalled();
  });

  it.each([
    [404, 'TAXONOMY_NOT_FOUND'],
    [409, 'TAXONOMY_VERSION_CONFLICT'],
    [503, 'DEPENDENCY_UNAVAILABLE'],
  ] as const)('relays the port refusal %i', async (status, code) => {
    const h = createReadsHarness({
      readSelector: async () => failure(status, { secret: 'x' }, 5),
    });
    const reply = await h.request(`${SELECTOR_PATH}?${SELECTOR_QUERY}`);
    expect(reply.status).toBe(status);
    expect(ApiErrorSchema.parse(await reply.json()).code).toBe(code);
  });

  it.each([
    ['more items than the limit', `${SELECTOR_QUERY}&limit=1`, selectorPage(2)],
    [
      'a duplicated term',
      SELECTOR_QUERY,
      selectorPage(2, { items: [selectorTerm(1), selectorTerm(1)] }),
    ],
    [
      'an out-of-order page',
      SELECTOR_QUERY,
      selectorPage(2, { items: [selectorTerm(2), selectorTerm(1)] }),
    ],
    [
      'a vocabulary key out of order',
      SELECTOR_QUERY,
      selectorPage(2, {
        items: [selectorTerm(1, 'zebra-tags'), selectorTerm(2, 'alpha-tags')],
      }),
    ],
    ['an unknown member', SELECTOR_QUERY, { ...selectorPage(1), extra: 1 }],
    ['a non-object', SELECTOR_QUERY, 'x'],
  ])('answers %s from the port as 502', async (_name, query, value) => {
    const h = createReadsHarness({
      readSelector: async () => ({ ok: true, value: value as never }),
    });
    const reply = await h.request(`${SELECTOR_PATH}?${query}`);
    expect(reply.status).toBe(502);
    expect(reply.headers.get('etag')).toBeNull();
  });

  it('accepts a page ordered by vocabulary key then term key, and the empty page', async () => {
    const ordered = selectorPage(3, {
      items: [
        selectorTerm(2, 'alpha-tags'),
        selectorTerm(1, 'beta-tags'),
        selectorTerm(3, 'beta-tags'),
      ],
    });
    const h = createReadsHarness({
      readSelector: async () => ({ ok: true, value: ordered }),
    });
    expect((await h.request(`${SELECTOR_PATH}?${SELECTOR_QUERY}`)).status).toBe(
      200,
    );
    const empty = createReadsHarness({
      readSelector: async () => ({
        ok: true,
        value: selectorPage(0, { pageVersion: '1' }),
      }),
    });
    const reply = await empty.request(`${SELECTOR_PATH}?${SELECTOR_QUERY}`);
    expect(reply.status).toBe(200);
    expect(reply.headers.get('etag')).toBe('"1"');
  });

  it('preflight advertises GET and the request-id header only', async () => {
    const h = createReadsHarness();
    const reply = await h.request(SELECTOR_PATH, { method: 'OPTIONS' });
    expect(reply.status).toBe(204);
    expect(reply.headers.get('access-control-allow-methods')).toBe(
      'GET, OPTIONS',
    );
    expect(reply.headers.get('access-control-allow-headers')).toBe(
      'X-Request-Id',
    );
  });

  it('records telemetry under the selector operation id', async () => {
    const { h, response } = getSelector();
    await response;
    expect(h.dependencies.telemetry).toHaveBeenCalledWith(
      expect.objectContaining({ operationId: 'CMS-03C-17', status: 200 }),
    );
  });
});
