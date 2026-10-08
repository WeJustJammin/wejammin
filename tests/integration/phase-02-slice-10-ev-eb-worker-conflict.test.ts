import { describe, expect, it } from 'vitest';

import {
  CONFLICT_ID,
  fetchFailing,
  postgrestRaise,
  readError,
  resolveRequest,
  wiredApp,
} from '../../apps/worker/src/cms-editorial-production-app.test-support';
import {
  ENTRY_ID,
  PARTY_ID,
  REQUEST_ID,
  REVISION_ID,
  SCHEMA_VERSION_ID,
  USER_ID,
  captureInit,
  json,
  revisionResource,
} from '../../apps/worker/src/cms-editorial-production.test-support';

/**
 * Evidence lane EB (AC-053, AC-054): CMS-03B-02 conflict resolution through the real route composition with only the
 * PostgREST fetch and the session/rate seams faked. Replaces the evidence of the production-conflict suite whose
 * duplicate it.each titles the evidence guard cannot cite.
 */

const BASE_ID = '41000000-0000-4000-8000-000000000004';
const resolved = {
  ...revisionResource,
  entryId: ENTRY_ID,
  revisionNumber: '3',
  entryVersion: '3',
  parentRevisionIds: [BASE_ID, SCHEMA_VERSION_ID],
  conflictId: CONFLICT_ID,
};

const run = async (response: () => Response) => {
  const fetchImpl = fetchFailing(response);
  const result = await resolveRequest(wiredApp(fetchImpl));
  return { fetchImpl, result, body: await result.clone().json() };
};

describe('EB conflict resolve 201: server-derived context and a closed resource', () => {
  it('EB conflict resolve: the route binds to the named RPC with the session context and no actor, owner or capability member in the body', async () => {
    const { fetchImpl, result } = await run(() => json(resolved));
    expect(result.status).toBe(201);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const { url, init } = captureInit(fetchImpl);
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_resolve_conflict',
    );
    const { p_request: request } = JSON.parse(String(init.body)) as {
      p_request: Record<string, unknown> & { context: Record<string, unknown> };
    };
    expect(request.context).toMatchObject({
      authUserId: USER_ID,
      actingPartyId: PARTY_ID,
      requestId: REQUEST_ID,
    });
    const { context: _context, ...members } = request;
    void _context;
    expect(Object.keys(members).sort()).toEqual(
      [
        'baseRevision',
        'choices',
        'conflictId',
        'entryId',
        'expectedVersion',
        'idempotencyKey',
        'ifMatch',
      ].sort(),
    );
    expect(JSON.stringify(members)).not.toContain(USER_ID);
    expect(JSON.stringify(members)).not.toContain(PARTY_ID);
  });

  it('EB conflict resolve: a 201 relays exactly the strong-ETag resolution resource with both immutable parents and the closed conflict', async () => {
    const { result, body } = await run(() => json(resolved));
    expect(result.status).toBe(201);
    expect(result.headers.get('etag')).toBe('"3"');
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual(resolved);
    expect(body.parentRevisionIds).toHaveLength(2);
    expect(body.conflictId).toBe(CONFLICT_ID);
  });

  for (const [member, value] of [
    ['resolverPersonId', USER_ID],
    ['resolverAuthUserId', USER_ID],
    ['actingPartyId', PARTY_ID],
    ['ownerId', PARTY_ID],
    ['capability', 'cms.editor'],
  ] as const)
    it(`EB conflict resolve: a resolution resource carrying the identity member ${member} is not relayed (502) and the value never reaches the caller`, async () => {
      const { result, body } = await run(() =>
        json({ ...resolved, [member]: value }),
      );
      expect(result.status).toBe(502);
      expect(JSON.stringify(body)).not.toContain(String(value));
    });

  it('EB conflict resolve: a resolution resource without its closed conflict identity is not relayed (502)', async () => {
    const { conflictId: _dropped, ...withoutConflict } = resolved;
    void _dropped;
    const { result } = await run(() => json(withoutConflict));
    expect(result.status).toBe(502);
  });
});

describe('EB conflict resolve refusals: hidden records are concealed and typed values are preserved by the typed errors', () => {
  it('EB conflict resolve 404: the NOT_FOUND token is a 404 with empty details whether the conflict is hidden, closed, foreign or absent', async () => {
    const hidden = await run(() => postgrestRaise('NOT_FOUND'));
    const withText = await run(() =>
      postgrestRaise('NOT_FOUND', 'P0001', 400, {
        details: 'closed by resolver 1000',
        hint: 'owner party 2000',
      }),
    );
    for (const { result, body } of [hidden, withText]) {
      expect(result.status).toBe(404);
      expect(body).toMatchObject({
        code: 'NOT_FOUND',
        requestId: REQUEST_ID,
        details: {},
      });
      expect(JSON.stringify(body)).not.toMatch(/resolver|owner|closed by/u);
    }
    expect(hidden.body).toEqual(withText.body);
  });

  it('EB conflict resolve 403: the FORBIDDEN token is a 403 that names no assignment, capability or resolver', async () => {
    const { result, body } = await run(() => postgrestRaise('FORBIDDEN'));
    expect(result.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
    expect(JSON.stringify(body)).not.toMatch(
      /assign|capabilit|resolver|cms\./iu,
    );
  });

  it('EB conflict resolve 409: the VERSION_MISMATCH token is a 409 CONFLICT whose recovery is to reload', async () => {
    const { result, body } = await run(() =>
      postgrestRaise('VERSION_MISMATCH', '40001', 409),
    );
    expect(result.status).toBe(409);
    expect(body).toMatchObject({
      code: 'CONFLICT',
      details: { recoveryAction: 'reload' },
    });
  });

  it('EB conflict resolve 409: the INVALID_TRANSITION token for an already-closed conflict is a 409 CONFLICT that carries no resolver identity', async () => {
    const { result, body } = await run(() =>
      postgrestRaise('INVALID_TRANSITION'),
    );
    expect(result.status).toBe(409);
    expect(body.code).toBe('CONFLICT');
    expect(JSON.stringify(body)).not.toMatch(
      new RegExp(`${USER_ID}|${PARTY_ID}|${REVISION_ID}`, 'u'),
    );
  });

  it('EB conflict resolve 422: the VALIDATION_FAILED token keeps its safe violation pointer and nothing else', async () => {
    const { result, body } = await run(() =>
      postgrestRaise('VALIDATION_FAILED', 'P0001', 400, {
        details: '["/choices/0/path"]',
      }),
    );
    expect(result.status).toBe(422);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(JSON.stringify(body)).toContain('/choices/0/path');
  });

  it('EB conflict resolve 500: the INTERNAL_ERROR token is a scrubbed 500 with empty details and no database text', async () => {
    const { result, body } = await run(() =>
      postgrestRaise('INTERNAL_ERROR', 'P0001', 400, {
        details: 'relation platform_private.cms_conflict_records',
      }),
    );
    expect(result.status).toBe(500);
    expect(body).toMatchObject({ code: 'INTERNAL_ERROR', details: {} });
    expect(JSON.stringify(body)).not.toContain('platform_private');
  });

  it('EB conflict resolve 401: an anonymous caller is 401 UNAUTHENTICATED before the RPC is reached', async () => {
    const fetchImpl = fetchFailing(() => json(resolved));
    const result = await resolveRequest(
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

  it('EB conflict resolve 403: a session without edit capability is refused before the RPC is reached', async () => {
    const fetchImpl = fetchFailing(() => json(resolved));
    const result = await resolveRequest(
      wiredApp(fetchImpl, {
        resolveSession: async () => ({
          ok: true as const,
          value: {
            userId: USER_ID,
            actingPartyId: PARTY_ID,
            capabilities: ['cms.reviewer'],
            mfaFresh: true,
          },
        }),
      }),
    );
    expect(result.status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
