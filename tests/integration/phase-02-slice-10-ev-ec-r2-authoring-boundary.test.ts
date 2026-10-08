import { describe, expect, it } from 'vitest';

import {
  authoringContextRequest,
  fetchFailing,
  postgrestRaise,
  readError,
  wiredApp,
} from '../../apps/worker/src/cms-editorial-production-app.test-support';
import {
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from '../../apps/worker/src/cms-editorial-production.test-support';

/**
 * Slice 10 evidence lane EC, remediation R2 (P2-S10-AC-101, AC-102, AC-104). CMS-03B-14 through
 * the REAL route -> production adapter chain with only the PostgREST edge and the session/rate
 * seams faked:
 *
 *   - AC-101: a request that carries a body is not the declared GET read - the literal route is
 *     never served to a write method, and the database edge is never called;
 *   - AC-102: the actor and acting party sent to the database are the VERIFIED SESSION's, a
 *     different session changes them, and a caller-supplied identity has no effect;
 *   - AC-104: an internal failure and a dependency outage are answered with the declared safe
 *     typed envelope (closed code, request id, no upstream text), never the database's words.
 */

const ORIGIN = 'https://cms.example.test';
const PATH = '/api/v1/cms/entries/authoring-context';

type Edge = ReturnType<typeof fetchFailing>;
const calls = (edge: Edge): unknown[][] =>
  (edge as unknown as { mock: { calls: unknown[][] } }).mock.calls;

const sentRequest = (edge: Edge): Record<string, unknown> => {
  const init = calls(edge)[0]?.[1] as { body: string };
  return (JSON.parse(init.body) as { p_request: Record<string, unknown> })
    .p_request;
};

const get = (
  app: ReturnType<typeof wiredApp>,
  headers: Record<string, string> = {},
  query = '',
) =>
  app.request(`${PATH}${query}`, {
    method: 'GET',
    headers: { origin: ORIGIN, 'x-request-id': REQUEST_ID, ...headers },
  });

describe('EC-101 CMS-03B-14 is the declared GET read and nothing that carries a body', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'a %s with a JSON body is not served and never reaches the database',
    async (method) => {
      const edge = fetchFailing(
        () => new Response('{}', { status: 200 }),
      ) as Edge;
      const response = await wiredApp(edge).request(PATH, {
        method,
        headers: {
          origin: ORIGIN,
          'x-request-id': REQUEST_ID,
          'content-type': 'application/json',
          'idempotency-key': 'idempotency-key-0001',
        },
        body: JSON.stringify({ contentTypeVersionId: 'x', schema: 'caller' }),
      });
      expect([400, 404, 405, 415]).toContain(response.status);
      expect(calls(edge)).toHaveLength(0);
    },
  );

  it('the same literal read is served as a plain GET, so the refusals above are the method and body alone', async () => {
    const edge = fetchFailing(
      () => new Response('{}', { status: 200 }),
    ) as Edge;
    await get(wiredApp(edge));
    expect(calls(edge)).toHaveLength(1);
  });
});

describe('EC-102 CMS-03B-14 sends the verified session as actor and acting party', () => {
  it('a different verified session changes the actor and party the database receives', async () => {
    const otherUser = '10000000-0000-4000-8000-0000000000aa';
    const otherParty = '20000000-0000-4000-8000-0000000000bb';
    const edge = fetchFailing(
      () => new Response('{}', { status: 200 }),
    ) as Edge;
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
    await get(app);
    expect(sentRequest(edge).context).toMatchObject({
      authUserId: otherUser,
      actingPartyId: otherParty,
    });
    expect(JSON.stringify(sentRequest(edge))).not.toContain(USER_ID);
    expect(JSON.stringify(sentRequest(edge))).not.toContain(PARTY_ID);
  });

  it('a caller-supplied identity header or query has no effect on the context sent', async () => {
    const edge = fetchFailing(
      () => new Response('{}', { status: 200 }),
    ) as Edge;
    await get(
      wiredApp(edge),
      {
        'x-acting-party-id': '20000000-0000-4000-8000-0000000000cc',
        'x-actor-id': '10000000-0000-4000-8000-0000000000cc',
      },
      '?contentTypeVersionId=30000000-0000-4000-8000-000000000003',
    );
    const request = sentRequest(edge);
    expect(request.context).toMatchObject({
      authUserId: USER_ID,
      actingPartyId: PARTY_ID,
    });
    expect(Object.keys(request).sort()).toEqual([
      'contentTypeVersionId',
      'context',
    ]);
    expect(JSON.stringify(request)).not.toContain('0000000000cc');
  });

  it('an undeclared identity query key is refused before the session is used or the database is called', async () => {
    const edge = fetchFailing(
      () => new Response('{}', { status: 200 }),
    ) as Edge;
    const response = await get(
      wiredApp(edge),
      {},
      '?actingPartyId=20000000-0000-4000-8000-0000000000cc',
    );
    expect(response.status).toBe(400);
    expect(calls(edge)).toHaveLength(0);
  });
});

describe('EC-104 CMS-03B-14 answers failures with the declared safe typed envelope', () => {
  const UPSTREAM = 'relation "platform_private.cms_schema_artifacts" is down';

  const envelopeOf = async (response: Response) => {
    const body = await readError(response);
    expect(Object.keys(body).sort()).toEqual([
      'code',
      'details',
      'message',
      'requestId',
    ]);
    expect(body.requestId).toBe(REQUEST_ID);
    expect(response.headers.get('content-type')).toContain('application/json');
    return body;
  };

  it('an internal database failure is a 500 INTERNAL_ERROR with the fixed message and no database words', async () => {
    const edge = fetchFailing(() => postgrestRaise('INTERNAL_ERROR')) as Edge;
    const response = await authoringContextRequest(wiredApp(edge));
    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await envelopeOf(response);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.message).toBe('An unexpected error occurred.');
    expect(body.details).toEqual({});
  });

  it.each([
    [
      'a database that raises an unrecognised failure',
      () => postgrestRaise(UPSTREAM, '57P01', 503),
    ],
    [
      'an unreachable database',
      () => {
        throw new TypeError(UPSTREAM);
      },
    ],
  ])(
    '%s is a retryable 503 DEPENDENCY_UNAVAILABLE that names no upstream text',
    async (_name, failure) => {
      const edge = fetchFailing(failure as () => Response) as Edge;
      const response = await authoringContextRequest(wiredApp(edge));
      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('5');
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = await envelopeOf(response);
      expect(body.code).toBe('DEPENDENCY_UNAVAILABLE');
      expect(body.details).toEqual({
        dependencyClass: 'cms_editorial',
        retryable: true,
      });
      expect(JSON.stringify(body)).not.toContain('platform_private');
      expect(JSON.stringify(body)).not.toContain('cms_schema_artifacts');
    },
  );

  it('a 200 that is not the strict projection is refused rather than fabricated into preparation evidence', async () => {
    const edge = fetchFailing(
      () =>
        new Response(JSON.stringify({ creatableTypes: [{ nonsense: true }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ) as Edge;
    const response = await authoringContextRequest(wiredApp(edge));
    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain('nonsense');
    expect(text).not.toContain('creatableTypes');
  });
});
