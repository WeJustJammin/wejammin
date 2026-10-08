import { describe, expect, it } from 'vitest';

import {
  IDEMPOTENCY_KEY,
  ORIGIN,
  draftDetailPayload,
  fetchFailing,
  postgrestRaise,
  readError,
  wiredApp,
} from '../../apps/worker/src/cms-editorial-production-app.test-support';
import {
  ENTRY_ID,
  PARTY_ID,
  REQUEST_ID,
  REVISION_ID,
  USER_ID,
  captureInit,
  json,
} from '../../apps/worker/src/cms-editorial-production.test-support';

/**
 * Evidence lane EB (AC-067..AC-070): CMS-03B-11 draft-detail read through the real route composition
 * `createCmsEditorialApp(createProductionCmsEditorialDependencies(...))` with only the PostgREST fetch and the
 * session/rate seams faked. Replaces the evidence of the production-detail suite whose duplicate it.each
 * titles the evidence guard cannot cite.
 */

const entryPath = `/api/v1/cms/entries/${ENTRY_ID}`;
const readHeaders = { origin: ORIGIN, 'x-request-id': REQUEST_ID };
const OTHER_PARTY = '21000000-0000-4000-8000-000000000002';
const sessionOf =
  (actingPartyId: string, capabilities: readonly string[] = ['cms.author']) =>
  async () => ({
    ok: true as const,
    value: { userId: USER_ID, actingPartyId, capabilities, mfaFresh: true },
  });

const read = (
  app: ReturnType<typeof wiredApp>,
  path = entryPath,
  init: RequestInit = {},
) => app.request(path, { headers: readHeaders, ...init });

const rpcBody = (fetchImpl: ReturnType<typeof fetchFailing>) =>
  JSON.parse(String(captureInit(fetchImpl).init.body)) as {
    p_request: Record<string, unknown> & { context: Record<string, unknown> };
  };

describe('EB draft detail 200: protected, bound to the current versions, never cacheable across contexts', () => {
  it('EB draft detail read: a 200 is the strict resource with no-store and a strong ETag, and no Set-Cookie or Vary that widens caching', async () => {
    const fetchImpl = fetchFailing(() => json(draftDetailPayload));
    const response = await read(wiredApp(fetchImpl));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(draftDetailPayload);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toMatch(/^"[^"]+"$/u);
    expect(response.headers.get('etag')).not.toMatch(/^W\//u);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('vary') ?? '').not.toMatch(/\*/u);
  });

  it('EB draft detail read: the ETag changes when the entry version or the revision version changes', async () => {
    const etagFor = async (patch: { entry?: string; revision?: string }) => {
      const payload = {
        ...draftDetailPayload,
        entry: {
          ...draftDetailPayload.entry,
          version: patch.entry ?? draftDetailPayload.entry.version,
        },
        revision: {
          ...draftDetailPayload.revision,
          version: patch.revision ?? draftDetailPayload.revision.version,
        },
      };
      const response = await read(wiredApp(fetchFailing(() => json(payload))));
      expect(response.status).toBe(200);
      return response.headers.get('etag');
    };
    const base = await etagFor({});
    expect(await etagFor({})).toBe(base);
    expect(await etagFor({ entry: '4' })).not.toBe(base);
    expect(await etagFor({ revision: '6' })).not.toBe(base);
  });

  it('EB draft detail read: the same entry read by a different acting party never shares an ETag', async () => {
    const etagFor = async (actingPartyId: string) =>
      (
        await read(
          wiredApp(
            fetchFailing(() => json(draftDetailPayload)),
            { resolveSession: sessionOf(actingPartyId) },
          ),
        )
      ).headers.get('etag');
    const own = await etagFor(PARTY_ID);
    const other = await etagFor(OTHER_PARTY);
    expect(own).toMatch(/^"[^"]+"$/u);
    expect(other).toMatch(/^"[^"]+"$/u);
    expect(other).not.toBe(own);
  });

  it('EB draft detail read: the named read RPC is called once with the session context and without any mutation header or body member', async () => {
    const fetchImpl = fetchFailing(() => json(draftDetailPayload));
    await read(wiredApp(fetchImpl));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const { url, init } = captureInit(fetchImpl);
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_get_entry_draft',
    );
    const headers = init.headers as Record<string, string>;
    expect(headers['If-Match']).toBeUndefined();
    expect(headers['X-Idempotency-Key']).toBeUndefined();
    const { p_request: request } = rpcBody(fetchImpl);
    expect(request.entryId).toBe(ENTRY_ID);
    expect(request.context).toMatchObject({
      actingPartyId: PARTY_ID,
      requestId: REQUEST_ID,
    });
    expect(JSON.stringify(request)).not.toMatch(/capabilit|ownerId|assignee/iu);
  });
});

describe('EB draft detail refusals: stable ApiError and no fallback content', () => {
  const refusal = async (response: () => Response) => {
    const fetchImpl = fetchFailing(response);
    const result = await read(wiredApp(fetchImpl));
    return { result, fetchImpl, body: await readError(result.clone()) };
  };

  it('EB draft detail 404: the NOT_FOUND token is a 404 with empty details for both an absent and a concealed entry', async () => {
    const absent = await refusal(() => postgrestRaise('NOT_FOUND'));
    const concealed = await refusal(() =>
      postgrestRaise('NOT_FOUND', 'P0001', 400, {
        details: 'private owner text',
        hint: 'hint',
      }),
    );
    for (const { result, body } of [absent, concealed]) {
      expect(result.status).toBe(404);
      expect(body).toMatchObject({
        code: 'NOT_FOUND',
        requestId: REQUEST_ID,
        details: {},
      });
      expect(JSON.stringify(body)).not.toMatch(/private owner text|hint/u);
    }
    expect({ ...absent.body, message: '' }).toEqual({
      ...concealed.body,
      message: '',
    });
    expect(absent.body.message).toBe(concealed.body.message);
  });

  it('EB draft detail 403: the FORBIDDEN token for a visible entry is a 403 that names no assignment, capability or owner', async () => {
    const { result, body } = await refusal(() => postgrestRaise('FORBIDDEN'));
    expect(result.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
    expect(JSON.stringify(body)).not.toMatch(/assign|capabilit|owner|cms\./iu);
  });

  it('EB draft detail 401: an anonymous caller is 401 UNAUTHENTICATED before the RPC is reached', async () => {
    const fetchImpl = fetchFailing(() => json(draftDetailPayload));
    const result = await read(
      wiredApp(fetchImpl, {
        resolveSession: async () => ({
          ok: false as const,
          status: 401 as const,
          code: 'UNAUTHENTICATED',
          message: 'No session.',
        }),
      }),
    );
    expect(result.status).toBe(401);
    expect((await readError(result)).code).toBe('UNAUTHENTICATED');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('EB draft detail 403: a session without cms.author or cms.editor is refused before the RPC is reached', async () => {
    const fetchImpl = fetchFailing(() => json(draftDetailPayload));
    const result = await read(
      wiredApp(fetchImpl, {
        resolveSession: sessionOf(PARTY_ID, ['cms.reviewer']),
      }),
    );
    expect(result.status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  const BAD_REQUESTS: readonly (readonly [string, string, RequestInit])[] = [
    ['a malformed entry id', '/api/v1/cms/entries/not-a-uuid', {}],
    ['an unknown query key', `${entryPath}?hidden=probe`, {}],
    ['an invalid locale', `${entryPath}?locale=en_US`, {}],
    ['a duplicated locale key', `${entryPath}?locale=en-US&locale=fr-FR`, {}],
    [
      'an If-Match header',
      entryPath,
      { headers: { ...readHeaders, 'if-match': '"1"' } },
    ],
    [
      'an Idempotency-Key header',
      entryPath,
      { headers: { ...readHeaders, 'idempotency-key': IDEMPOTENCY_KEY } },
    ],
    [
      'a request body',
      entryPath,
      {
        method: 'POST',
        body: '{}',
        headers: { ...readHeaders, 'content-type': 'application/json' },
      },
    ],
  ];
  for (const [label, path, init] of BAD_REQUESTS)
    it(`EB draft detail request: ${label} is refused before the RPC is reached`, async () => {
      const fetchImpl = fetchFailing(() => json(draftDetailPayload));
      const result = await read(wiredApp(fetchImpl), path, init);
      expect(result.status).toBeGreaterThanOrEqual(400);
      expect(result.status).toBeLessThan(500);
      expect(fetchImpl).not.toHaveBeenCalled();
    });

  it('EB draft detail request: a malformed entry id, an unknown query key and an invalid locale are each 400 INVALID_REQUEST', async () => {
    for (const path of [
      '/api/v1/cms/entries/not-a-uuid',
      `${entryPath}?hidden=probe`,
      `${entryPath}?locale=en_US`,
    ]) {
      const result = await read(
        wiredApp(fetchFailing(() => json(draftDetailPayload))),
        path,
      );
      expect({
        status: result.status,
        code: (await readError(result)).code,
      }).toEqual({ status: 400, code: 'INVALID_REQUEST' });
    }
  });

  it('EB draft detail response: a resource carrying an extra member is not relayed (502) and no private value reaches the caller', async () => {
    const { result, body } = await refusal(() =>
      json({ ...draftDetailPayload, secret: 'private-draft-value' }),
    );
    expect(result.status).toBe(502);
    expect(JSON.stringify(body)).not.toContain('private-draft-value');
  });

  it('EB draft detail response: a placeholder relation that also names its target is not relayed (502)', async () => {
    const leaky = {
      ...draftDetailPayload,
      relations: [
        {
          fieldId: ENTRY_ID,
          fieldDefinitionId: REVISION_ID,
          position: 0,
          onUnavailable: 'placeholder',
          unavailable: { status: 'unavailable', reason: 'unavailable' },
          targetId: ENTRY_ID,
        },
      ],
    };
    const { result } = await refusal(() => json(leaky));
    expect(result.status).toBe(502);
  });

  it('EB draft detail response: a resource missing the server-derived revisionNumber, schemaVersionId or openConflict is not relayed (502)', async () => {
    for (const member of [
      'revisionNumber',
      'schemaVersionId',
      'openConflict',
    ] as const) {
      const { [member]: _dropped, ...rest } = draftDetailPayload;
      void _dropped;
      const { result } = await refusal(() => json(rest));
      expect(result.status, member).toBe(502);
    }
  });
});

describe('EB draft detail routing: the literal authoring-context segment is matched before the entry id', () => {
  it('EB draft detail routing: the literal authoring-context segment is never resolved as an entry id', async () => {
    const fetchImpl = fetchFailing(() => json(draftDetailPayload));
    await read(wiredApp(fetchImpl), '/api/v1/cms/entries/authoring-context');
    const calls = (
      fetchImpl as unknown as { mock: { calls: unknown[][] } }
    ).mock.calls.map((call) => String(call[0]));
    expect(calls.some((url) => url.endsWith('/rpc/cms_get_entry_draft'))).toBe(
      false,
    );
  });
});

describe('EB draft detail acting context: it is derived from the verified session and never from anything the caller sends', () => {
  const contextOf = async (
    patch: RequestInit,
    path = entryPath,
    party = PARTY_ID,
  ) => {
    const fetchImpl = fetchFailing(() => json(draftDetailPayload));
    const response = await read(
      wiredApp(fetchImpl, { resolveSession: sessionOf(party) }),
      path,
      patch,
    );
    return { response, fetchImpl };
  };

  it('EB draft detail context: spoofed acting-party, user and capability headers change nothing: the RPC context is the session', async () => {
    const { response, fetchImpl } = await contextOf({
      headers: {
        ...readHeaders,
        'x-acting-party-id': OTHER_PARTY,
        'x-acting-context-id': OTHER_PARTY,
        'x-user-id': OTHER_PARTY,
        'x-capabilities': 'cms.admin cms.publisher',
      },
    });
    expect(response.status).toBe(200);
    const { p_request: request } = rpcBody(fetchImpl);
    expect(request.context).toMatchObject({
      authUserId: USER_ID,
      actingPartyId: PARTY_ID,
    });
    expect(JSON.stringify(request)).not.toContain(OTHER_PARTY);
    expect(JSON.stringify(request)).not.toMatch(/cms\.admin|cms\.publisher/u);
  });

  for (const member of [
    'actingPartyId',
    'actingContextId',
    'userId',
    'ownerId',
    'capability',
  ])
    it(`EB draft detail context: a caller-supplied ${member} query member is 400 INVALID_REQUEST and the RPC is never reached`, async () => {
      const { response, fetchImpl } = await contextOf(
        {},
        `${entryPath}?${member}=${OTHER_PARTY}`,
      );
      expect({
        status: response.status,
        code: (await readError(response)).code,
      }).toEqual({ status: 400, code: 'INVALID_REQUEST' });
      expect(fetchImpl).not.toHaveBeenCalled();
    });

  it('EB draft detail context: the RPC context follows the verified session: two sessions of two parties send two different contexts for the same request', async () => {
    const first = await contextOf({}, entryPath, PARTY_ID);
    const second = await contextOf({}, entryPath, OTHER_PARTY);
    expect(rpcBody(first.fetchImpl).p_request.context).toMatchObject({
      actingPartyId: PARTY_ID,
    });
    expect(rpcBody(second.fetchImpl).p_request.context).toMatchObject({
      actingPartyId: OTHER_PARTY,
    });
  });
});
