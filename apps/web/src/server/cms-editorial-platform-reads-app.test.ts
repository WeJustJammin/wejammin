import { describe, expect, it, vi, type Mock } from 'vitest';

import {
  forwardCmsEditorialAuthoringContextRead,
  forwardCmsEditorialConflictDetailRead,
  forwardCmsEditorialEntryListRead,
} from './cms-editorial-platform-reads';

const origin = 'https://app.example.test';
const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const hash = 'a'.repeat(64);
const instant = '2026-09-26T00:00:00Z';

type Handler = (input: Request) => Promise<Response>;

const bindingWith = (handler: Handler): { fetch: Mock<Handler> } => ({
  fetch: vi.fn(handler),
});

const get = (path: string, query = ''): Request =>
  new Request(origin + path + query, { method: 'GET' });

const jsonResponse = (body: unknown, init: ResponseInit): Response =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });

const representationEtag = async (resource: unknown): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(resource)),
  );
  return (
    '"sha256:' +
    [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('') +
    '"'
  );
};

const listPage = { items: [], nextCursor: null, pageVersion: '2' } as const;

const validConflictDetail = {
  conflict: {
    id: uuid2,
    version: '3',
    createdAt: instant,
    updatedAt: instant,
    state: 'open',
    changedPaths: [`/fields/${uuid2}`],
    conflictHash: hash,
  },
  entry: { id: uuid, version: '4', createdAt: instant, updatedAt: instant },
  base: {
    revisionId: uuid2,
    revisionNumber: '2',
    schemaVersionId: uuid,
    contentHash: hash,
  },
  theirs: {
    revisionId: uuid2,
    revisionNumber: '3',
    schemaVersionId: uuid,
    contentHash: hash,
  },
  yours: { source: 'revision', revisionId: uuid2, contentHash: hash },
  paths: [
    {
      path: `/fields/${uuid2}`,
      base: { value: 'base', provenance: 'authored', valueHash: null },
      theirs: { value: 'theirs', provenance: 'authored', valueHash: null },
      yours: { value: 'yours', provenance: 'authored', valueHash: null },
    },
  ],
  resolvedRevisionId: null,
} as const;

describe('cms-editorial entry-list read proxy (CMS-03B-13)', () => {
  it('forwards allowlisted query keys and validates the page ETag', async () => {
    const upstream = bindingWith(async () =>
      jsonResponse(listPage, { status: 200, headers: { etag: '"2"' } }),
    );
    const response = await forwardCmsEditorialEntryListRead(
      get('/api/v1/cms/entries', '?limit=25&state=draft'),
      upstream,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(listPage);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const forwarded = upstream.fetch.mock.calls[0]?.[0] as Request;
    expect(forwarded.url).toBe(
      'https://platform-api.internal/api/v1/cms/entries?limit=25&state=draft',
    );
  });

  it('rejects malformed or unknown query before fetch', async () => {
    const upstream = bindingWith(async () =>
      jsonResponse(listPage, { status: 200 }),
    );
    for (const [search, status] of [
      ['?limit=0', 400],
      ['?limit=51', 400],
      ['?limit=1&limit=2', 400],
      ['?cursor=', 400],
      ['?cursor=' + 'a'.repeat(513), 400],
      ['?other=1', 400],
      // DEC-145 / BE03b matrix: a malformed query value is 400, as at the Worker.
      ['?state=other', 400],
      ['?contentTypeId=bad', 400],
    ] as const) {
      const response = await forwardCmsEditorialEntryListRead(
        get('/api/v1/cms/entries', search),
        upstream,
      );
      expect(response.status).toBe(status);
    }
    expect(upstream.fetch).not.toHaveBeenCalled();
  });

  it('collapses an ETag-mismatched upstream page to 502', async () => {
    for (const etag of [null, 'W/"2"', '"3"']) {
      const response = await forwardCmsEditorialEntryListRead(
        get('/api/v1/cms/entries'),
        bindingWith(async () =>
          jsonResponse(listPage, {
            status: 200,
            headers: etag === null ? {} : { etag },
          }),
        ),
      );
      expect(response.status).toBe(502);
    }
  });

  it('relays a typed 403 without escalation and collapses a malformed one', async () => {
    const refusal = {
      code: 'FORBIDDEN',
      details: {},
      message: 'No entry permission.',
      requestId: '11111111-1111-4111-8111-111111111111',
    };
    const ok = await forwardCmsEditorialEntryListRead(
      get('/api/v1/cms/entries'),
      bindingWith(async () => jsonResponse(refusal, { status: 403 })),
    );
    expect(ok.status).toBe(403);
    // Canonical message, rebuilt details (Codex review M2).
    expect(await ok.json()).toEqual({
      ...refusal,
      message: 'You do not have permission for this entry.',
    });
    const malformed = await forwardCmsEditorialEntryListRead(
      get('/api/v1/cms/entries'),
      bindingWith(async () =>
        jsonResponse({ private: 'leak' }, { status: 403 }),
      ),
    );
    expect(malformed.status).toBe(403);
    expect(await malformed.text()).not.toContain('leak');
  });

  it('fails closed without a binding or on a non-GET request', async () => {
    expect(
      (
        await forwardCmsEditorialEntryListRead(
          get('/api/v1/cms/entries'),
          undefined,
        )
      ).status,
    ).toBe(503);
    expect(
      (
        await forwardCmsEditorialEntryListRead(
          new Request(origin + '/api/v1/cms/entries', { method: 'POST' }),
          bindingWith(async () => jsonResponse(listPage, { status: 200 })),
        )
      ).status,
    ).toBe(503);
  });
});

describe('cms-editorial authoring-context read proxy (CMS-03B-14)', () => {
  it('forwards the selector and relays the bounded resource', async () => {
    const resource = { creatableTypes: [], selectedType: null, fields: [] };
    const upstream = bindingWith(async () =>
      jsonResponse(resource, {
        status: 200,
        headers: { etag: await representationEtag(resource) },
      }),
    );
    const response = await forwardCmsEditorialAuthoringContextRead(
      get('/api/v1/cms/entries/authoring-context'),
      upstream,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      creatableTypes: [],
      selectedType: null,
      fields: [],
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
    const forwarded = upstream.fetch.mock.calls[0]?.[0] as Request;
    expect(forwarded.url).toBe(
      'https://platform-api.internal/api/v1/cms/entries/authoring-context',
    );
  });

  it('rejects malformed selector before fetch', async () => {
    const upstream = bindingWith(async () =>
      jsonResponse(
        { creatableTypes: [], selectedType: null, fields: [] },
        {
          status: 200,
        },
      ),
    );
    for (const [search, status] of [
      ['?contentTypeVersionId=bad', 400],
      ['?other=1', 400],
    ] as const) {
      const response = await forwardCmsEditorialAuthoringContextRead(
        get('/api/v1/cms/entries/authoring-context', search),
        upstream,
      );
      expect(response.status).toBe(status);
    }
    expect(upstream.fetch).not.toHaveBeenCalled();
  });

  it('collapses selection-contract violations to 502', async () => {
    const response = await forwardCmsEditorialAuthoringContextRead(
      get('/api/v1/cms/entries/authoring-context'),
      bindingWith(async () =>
        jsonResponse(
          { creatableTypes: [], selectedType: null, fields: [{}] },
          { status: 200, headers: { etag: '"sha256:bad"' } },
        ),
      ),
    );
    expect(response.status).toBe(502);
  });
});

describe('cms-editorial conflict-detail read proxy (CMS-03B-12)', () => {
  const conflictEtag = '"' + uuid2 + ':3:4:' + hash + '"';

  it('relays a bounded strict resource with its exact ETag', async () => {
    const upstream = bindingWith(async () =>
      jsonResponse(validConflictDetail, {
        status: 200,
        headers: { etag: conflictEtag },
      }),
    );
    const response = await forwardCmsEditorialConflictDetailRead(
      get('/api/v1/cms/entries/' + uuid + '/conflicts/' + uuid2),
      uuid,
      uuid2,
      upstream,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(validConflictDetail);
    expect(response.headers.get('etag')).toBe(conflictEtag);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const forwarded = upstream.fetch.mock.calls[0]?.[0] as Request;
    expect(forwarded.url).toBe(
      'https://platform-api.internal/api/v1/cms/entries/' +
        uuid +
        '/conflicts/' +
        uuid2,
    );
  });

  it('answers malformed addressing as 400 INVALID_REQUEST without an upstream call (DEC-145)', async () => {
    const upstream = bindingWith(async () =>
      jsonResponse(validConflictDetail, { status: 200 }),
    );
    for (const [entryId, conflictId] of [
      ['bad', uuid2],
      [uuid, 'bad'],
    ] as const) {
      const response = await forwardCmsEditorialConflictDetailRead(
        get('/api/v1/cms/entries/' + entryId + '/conflicts/' + conflictId),
        entryId,
        conflictId,
        upstream,
      );
      expect(response.status).toBe(400);
    }
    expect(upstream.fetch).not.toHaveBeenCalled();
  });

  it('refuses a query string and read mutation headers', async () => {
    const upstream = bindingWith(async () =>
      jsonResponse(validConflictDetail, { status: 200 }),
    );
    const withQuery = await forwardCmsEditorialConflictDetailRead(
      get('/api/v1/cms/entries/' + uuid + '/conflicts/' + uuid2, '?x=1'),
      uuid,
      uuid2,
      upstream,
    );
    expect(withQuery.status).toBe(400);
    const withIfMatch = await forwardCmsEditorialConflictDetailRead(
      new Request(
        origin + '/api/v1/cms/entries/' + uuid + '/conflicts/' + uuid2,
        { method: 'GET', headers: { 'if-match': '"1"' } },
      ),
      uuid,
      uuid2,
      upstream,
    );
    expect(withIfMatch.status).toBe(400);
    expect(upstream.fetch).not.toHaveBeenCalled();
  });

  it('collapses a cross-addressed or weak-ETag upstream success to 502', async () => {
    for (const etag of [
      null,
      'W/' + conflictEtag,
      '"' + uuid + ':3:4:' + hash + '"',
    ]) {
      const response = await forwardCmsEditorialConflictDetailRead(
        get('/api/v1/cms/entries/' + uuid + '/conflicts/' + uuid2),
        uuid,
        uuid2,
        bindingWith(async () =>
          jsonResponse(validConflictDetail, {
            status: 200,
            headers: etag === null ? {} : { etag },
          }),
        ),
      );
      expect(response.status).toBe(502);
    }
  });

  it('conceals an absent conflict as the typed upstream 404', async () => {
    const notFound = {
      code: 'NOT_FOUND',
      details: {},
      message: 'The requested entry is not available.',
      requestId: '11111111-1111-4111-8111-111111111111',
    };
    const response = await forwardCmsEditorialConflictDetailRead(
      get('/api/v1/cms/entries/' + uuid + '/conflicts/' + uuid2),
      uuid,
      uuid2,
      bindingWith(async () => jsonResponse(notFound, { status: 404 })),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual(notFound);
  });
});
