import { describe, expect, it } from 'vitest';

import {
  entryListPayload,
  fetchFailing,
  listRequest,
  wiredApp,
} from '../../apps/worker/src/cms-editorial-production-app.test-support';
import {
  ENTRY_ID,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from '../../apps/worker/src/cms-editorial-production.test-support';
import { ok } from '../../apps/worker/src/cms-editorial-production-telemetry.test-support';

/**
 * Slice 10 evidence lane EC, remediation R1 (P2-S10-AC-095, AC-096). The whole HTTP boundary of
 * the safe reads through the REAL route -> production adapter chain with only the PostgREST edge
 * and the session/rate seams faked:
 *
 *   - a request body, a mutation header or an undeclared media type is refused before the
 *     database edge is ever called (the fetch spy records zero calls);
 *   - the actor and acting party sent to the database are the VERIFIED SESSION's, never a value
 *     the caller supplied, and a caller-supplied identity has no slot at all.
 *
 * A GET cannot carry a body in the fetch model, so "body" is exactly what the Worker can see of
 * one: a declared Content-Length, a Transfer-Encoding, or a Content-Type.
 */

const ORIGIN = 'https://cms.example.test';
const LIST_PATH = '/api/v1/cms/entries';
const READS = ['CMS-03B-11', 'CMS-03B-12', 'CMS-03B-13', 'CMS-03B-14'] as const;

const PATHS: Readonly<Record<string, string>> = {
  'CMS-03B-11': `${LIST_PATH}/${ENTRY_ID}`,
  'CMS-03B-12': `${LIST_PATH}/${ENTRY_ID}/conflicts/31000000-0000-4000-8000-000000000003`,
  'CMS-03B-13': LIST_PATH,
  'CMS-03B-14': `${LIST_PATH}/authoring-context`,
};

const BODY_AND_MUTATION_HEADERS: ReadonlyArray<
  readonly [string, Record<string, string>, number]
> = [
  ['a declared request body (Content-Length)', { 'content-length': '2' }, 400],
  [
    'a chunked request body (Transfer-Encoding)',
    { 'transfer-encoding': 'chunked' },
    400,
  ],
  [
    'a request media type (Content-Type)',
    { 'content-type': 'application/json' },
    415,
  ],
  ['an Idempotency-Key', { 'idempotency-key': 'abcdefgh' }, 400],
  ['an If-Match', { 'if-match': '"1"' }, 400],
];

const send = (
  app: ReturnType<typeof wiredApp>,
  path: string,
  headers: Record<string, string> = {},
): Promise<Response> | Response =>
  app.request(path, {
    method: 'GET',
    headers: { origin: ORIGIN, 'x-request-id': REQUEST_ID, ...headers },
  });

describe('EC-095 the safe reads refuse a body and mutation headers before any database call', () => {
  for (const operation of READS) {
    it.each(BODY_AND_MUTATION_HEADERS)(
      `${operation} refuses %s without calling the database`,
      async (_name, headers, status) => {
        const edge = fetchFailing(ok(entryListPayload));
        const response = await send(
          wiredApp(edge),
          PATHS[operation] as string,
          headers,
        );
        expect(response.status).toBe(status);
        expect(
          (edge as unknown as { mock: { calls: unknown[] } }).mock.calls,
        ).toHaveLength(0);
      },
    );
  }

  it('CMS-03B-13 refuses an undeclared query key, a bad limit and a repeated filter without calling the database', async () => {
    for (const query of [
      '?ownerId=x',
      '?sort=asc',
      '?actingPartyId=x',
      '?limit=0',
      '?limit=51',
      '?state=draft&state=approved',
      '?contentTypeId=not-a-uuid',
    ]) {
      const edge = fetchFailing(ok(entryListPayload));
      const response = await listRequest(wiredApp(edge), query);
      expect(response.status, query).toBe(400);
      expect(
        (edge as unknown as { mock: { calls: unknown[] } }).mock.calls,
      ).toHaveLength(0);
    }
  });

  it('still serves the declared read, so the refusals above are caused by the header or key and nothing else', async () => {
    const edge = fetchFailing(ok(entryListPayload));
    const response = await listRequest(wiredApp(edge), '?limit=5&state=draft');
    expect(response.status).toBe(200);
    expect(
      (edge as unknown as { mock: { calls: unknown[] } }).mock.calls,
    ).toHaveLength(1);
  });
});

describe('EC-096 the database receives the verified session as actor and acting party', () => {
  const sentContext = (edge: unknown): Record<string, unknown> => {
    const calls = (edge as { mock: { calls: [unknown, { body: string }][] } })
      .mock.calls;
    const body = JSON.parse(String(calls[0]?.[1].body)) as {
      p_request: Record<string, unknown>;
    };
    return body.p_request;
  };

  it('CMS-03B-13 sends exactly the declared query members plus the server-derived context', async () => {
    const edge = fetchFailing(ok(entryListPayload));
    const response = await listRequest(wiredApp(edge), '?limit=5&state=draft');
    expect(response.status).toBe(200);
    const request = sentContext(edge);
    expect(Object.keys(request).sort()).toEqual(['context', 'limit', 'state']);
    expect(request.context).toMatchObject({
      authUserId: USER_ID,
      actingPartyId: PARTY_ID,
      requestId: REQUEST_ID,
    });
  });

  it('a different verified session changes the actor and party the database receives', async () => {
    const otherUser = '10000000-0000-4000-8000-0000000000aa';
    const otherParty = '20000000-0000-4000-8000-0000000000bb';
    const edge = fetchFailing(ok(entryListPayload));
    const app = wiredApp(edge, {
      resolveSession: async () => ({
        ok: true as const,
        value: {
          userId: otherUser,
          actingPartyId: otherParty,
          capabilities: ['cms.author'],
          mfaFresh: false,
        },
      }),
    });
    await listRequest(app);
    expect(sentContext(edge).context).toMatchObject({
      authUserId: otherUser,
      actingPartyId: otherParty,
    });
    expect(JSON.stringify(sentContext(edge))).not.toContain(USER_ID);
    expect(JSON.stringify(sentContext(edge))).not.toContain(PARTY_ID);
  });

  it('a caller-supplied identity header or query has no effect on the context sent', async () => {
    const edge = fetchFailing(ok(entryListPayload));
    const response = await send(wiredApp(edge), LIST_PATH, {
      'x-acting-party-id': '20000000-0000-4000-8000-0000000000cc',
      'x-actor-id': '10000000-0000-4000-8000-0000000000cc',
    });
    expect(response.status).toBe(200);
    const context = sentContext(edge).context as Record<string, unknown>;
    expect(context.actingPartyId).toBe(PARTY_ID);
    expect(context.authUserId).toBe(USER_ID);
    expect(JSON.stringify(sentContext(edge))).not.toContain('0000000000cc');
  });

  it.each([
    [
      'CMS-03B-12',
      `${LIST_PATH}/${ENTRY_ID}/conflicts/31000000-0000-4000-8000-000000000003`,
    ],
    ['CMS-03B-14', `${LIST_PATH}/authoring-context`],
  ] as const)(
    '%s sends the same server-derived context',
    async (_operation, path) => {
      const edge = fetchFailing(() => new Response('{}', { status: 200 }));
      await send(wiredApp(edge), path);
      expect(sentContext(edge).context).toMatchObject({
        authUserId: USER_ID,
        actingPartyId: PARTY_ID,
      });
    },
  );
});
