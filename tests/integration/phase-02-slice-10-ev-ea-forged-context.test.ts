/**
 * Slice 10 evidence lane EA (AC-006, AC-012, AC-018, AC-024): the actor and the acting context of
 * CMS-03B-01..04 are derived server-side from the verified session ONLY. A request that forges an
 * actor, an acting party, an owner or a capability in a header, a cookie, a query member or a body
 * member either never reaches the RPC (strict body and query admission) or reaches it carrying
 * exactly the session's user and party and none of the forged values. Production Hono app and
 * production RPC adapter; only fetch, the session and the rate limiter are supplied.
 */
import { describe, expect, it, vi } from 'vitest';

import {
  OPERATIONS,
  ORIGIN,
  PARTY,
  USER,
  build,
  read,
  rpcError,
} from './support/ev-ea-editorial-app';

const FORGED_PARTY = '99999999-9999-4999-8999-999999999999';
const FORGED_USER = '88888888-8888-4888-8888-888888888888';
const FORGED_HEADERS: Readonly<Record<string, string>> = {
  'x-acting-party-id': FORGED_PARTY,
  'x-acting-context-id': FORGED_PARTY,
  'x-user-id': FORGED_USER,
  'x-actor-id': FORGED_USER,
  'x-owner-id': FORGED_PARTY,
  'x-capabilities': 'cms.admin,cms.publisher',
  cookie: `wj_acting_party=${FORGED_PARTY}; wj_user=${FORGED_USER}`,
};

const request = (
  operation: (typeof OPERATIONS)[number],
  overrides: {
    body?: Record<string, unknown>;
    query?: string;
    headers?: Record<string, string>;
  } = {},
): Request =>
  new Request(
    `https://api.example.test${operation.path}${overrides.query ?? ''}`,
    {
      method: operation.method,
      headers: {
        origin: ORIGIN,
        'x-request-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        ...(operation.method === 'POST'
          ? {
              'content-type': 'application/json',
              'idempotency-key': 'ev-ea-idempotency-0001',
              'if-match': operation.ifMatch ?? '"1"',
            }
          : {}),
        ...(overrides.headers ?? {}),
      },
      ...(operation.body === undefined
        ? {}
        : {
            body: JSON.stringify({
              ...operation.body,
              ...(overrides.body ?? {}),
            }),
          }),
    },
  );

describe.each(OPERATIONS)(
  '$id derives the actor and acting context from the verified session only',
  (operation) => {
    it(`${operation.id} sends the RPC the session user and party and none of the forged header or cookie identities`, async () => {
      const fetchImpl = vi.fn(async () => rpcError('NOT_FOUND'));
      const app = build(fetchImpl as unknown as typeof fetch);
      await app.request(request(operation, { headers: { ...FORGED_HEADERS } }));
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [, init] = fetchImpl.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      const sent = JSON.parse(String(init.body)) as {
        p_request: { context: Record<string, unknown> };
      };
      expect(sent.p_request.context).toMatchObject({
        authUserId: USER,
        actingPartyId: PARTY,
      });
      const wire = `${String(init.body)} ${JSON.stringify(init.headers)}`;
      for (const forged of [
        FORGED_PARTY,
        FORGED_USER,
        'cms.admin',
        'cms.publisher',
      ])
        expect(wire).not.toContain(forged);
    });

    it(`${operation.id} refuses a query member naming an actor, party, owner or capability before any RPC call`, async () => {
      const fetchImpl = vi.fn(async () => rpcError('NOT_FOUND'));
      const app = build(fetchImpl as unknown as typeof fetch);
      for (const member of [
        'actingPartyId',
        'ownerId',
        'actorId',
        'capability',
      ]) {
        const response = await app.request(
          request(operation, { query: `?${member}=${FORGED_PARTY}` }),
        );
        expect(response.status).toBe(400);
        expect((await read(response)).code).toBe('INVALID_REQUEST');
      }
      expect(fetchImpl).not.toHaveBeenCalled();
    });
  },
);

describe.each(OPERATIONS.filter((operation) => operation.method === 'POST'))(
  '$id refuses forged authority in the request body',
  (operation) => {
    it.each([
      'context',
      'actingPartyId',
      'actingContextId',
      'actorId',
      'authUserId',
      'ownerId',
      'capabilities',
    ])(
      `${operation.id} refuses a body member named %s as an unknown field and never calls the RPC`,
      async (member) => {
        const fetchImpl = vi.fn(async () => rpcError('NOT_FOUND'));
        const app = build(fetchImpl as unknown as typeof fetch);
        const response = await app.request(
          request(operation, { body: { [member]: FORGED_PARTY } }),
        );
        expect(response.status).toBe(422);
        const body = await read(response);
        expect(body.code).toBe('VALIDATION_FAILED');
        expect(body.details).toMatchObject({
          violations: [{ path: `/${member}`, code: 'unknown_field' }],
        });
        expect(JSON.stringify(body)).not.toContain(FORGED_PARTY);
        expect(fetchImpl).not.toHaveBeenCalled();
      },
    );
  },
);
