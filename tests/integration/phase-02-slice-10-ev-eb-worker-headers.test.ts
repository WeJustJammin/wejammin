import { describe, expect, it } from 'vitest';

import {
  conflictBody,
  conflictPath,
  createBody,
  createPath,
  harness,
  idempotencyKey,
  origin,
  requestId,
  restoreBody,
  restorePath,
  revisionBody,
  revisionPath,
} from '../../apps/worker/src/cms-editorial/route-fixtures.test-support';

/**
 * Evidence lane EB (AC-049): the mutation-header admission of every Slice 10 command route, driven through
 * the real Hono route composition with the ports faked. Each case sends ONE otherwise valid request whose
 * single header differs, and asserts the exact status and ApiError code plus whether the port was reached.
 */

type Port =
  'appendRevision' | 'resolveConflict' | 'restoreRevision' | 'createEntry';

type Route = Readonly<{
  name: string;
  path: string;
  body: unknown;
  ifMatch: string | null;
  port: Port;
}>;

const ROUTES: readonly Route[] = [
  {
    name: 'CMS-03B-01 revision',
    path: revisionPath,
    body: revisionBody,
    ifMatch: '"1"',
    port: 'appendRevision',
  },
  {
    name: 'CMS-03B-02 conflict resolution',
    path: conflictPath,
    body: conflictBody,
    ifMatch: '"2"',
    port: 'resolveConflict',
  },
  {
    name: 'CMS-03B-04 restore',
    path: restorePath,
    body: restoreBody,
    ifMatch: '"2"',
    port: 'restoreRevision',
  },
  {
    name: 'CMS-03B-10 entry create',
    path: createPath,
    body: createBody,
    ifMatch: null,
    port: 'createEntry',
  },
];

const printable = (length: number): string => 'k'.repeat(length - 1) + '~';

const send = async (route: Route, headers: Record<string, string | null>) => {
  const rig = harness();
  const base: Record<string, string> = {
    origin,
    'content-type': 'application/json',
    'idempotency-key': idempotencyKey,
    'x-request-id': requestId,
    ...(route.ifMatch === null ? {} : { 'if-match': route.ifMatch }),
  };
  const merged: Record<string, string> = { ...base };
  for (const [name, value] of Object.entries(headers)) {
    if (value === null) delete merged[name];
    else merged[name] = value;
  }
  const response = await rig.app.request(route.path, {
    method: 'POST',
    headers: merged,
    body: JSON.stringify(route.body),
  });
  const body = (await response
    .clone()
    .json()
    .catch(() => ({}))) as Record<string, unknown>;
  return { response, body, port: rig[route.port] };
};

const REFUSED_KEYS: readonly (readonly [string, string | null])[] = [
  ['missing', null],
  ['empty', ''],
  ['7 characters', printable(7)],
  ['129 characters', printable(129)],
  ['a control character', 'idempotency\u0007key-0001'],
  ['a DEL character', 'idempotency\u007fkey-0001'],
  ['a non-ASCII character', 'idempotency-clé-0001'],
];

const ACCEPTED_KEYS: readonly (readonly [string, string])[] = [
  ['exactly 8 characters', printable(8)],
  ['exactly 128 characters', printable(128)],
  ['printable punctuation and spaces inside', 'key with ~!@#$%^&*()_+ 0001'],
];

describe('EB mutation headers: Idempotency-Key 8-128 printable ASCII on every command route', () => {
  for (const route of ROUTES) {
    for (const [label, key] of REFUSED_KEYS)
      it(`EB idempotency key ${route.name}: a ${label} key is 400 INVALID_REQUEST and the port is never reached`, async () => {
        const { response, body, port } = await send(route, {
          'idempotency-key': key,
        });
        expect({ status: response.status, code: body.code }).toEqual({
          status: 400,
          code: 'INVALID_REQUEST',
        });
        expect(port).not.toHaveBeenCalled();
      });
    for (const [label, key] of ACCEPTED_KEYS)
      it(`EB idempotency key ${route.name}: a key of ${label} reaches the port`, async () => {
        const { response, port } = await send(route, {
          'idempotency-key': key,
        });
        expect(response.status).toBeLessThan(300);
        expect(port).toHaveBeenCalledTimes(1);
      });
  }
});

describe('EB mutation headers: Content-Type application/json on every command route', () => {
  const MEDIA: readonly (readonly [string, string | null])[] = [
    ['text/plain', 'text/plain'],
    ['application/x-www-form-urlencoded', 'application/x-www-form-urlencoded'],
    ['multipart/form-data', 'multipart/form-data; boundary=x'],
    ['a missing content type', null],
  ];
  for (const route of ROUTES) {
    for (const [label, media] of MEDIA)
      it(`EB content type ${route.name}: ${label} is 415 UNSUPPORTED_MEDIA_TYPE naming application/json and the port is never reached`, async () => {
        const { response, body, port } = await send(route, {
          'content-type': media,
        });
        expect({ status: response.status, code: body.code }).toEqual({
          status: 415,
          code: 'UNSUPPORTED_MEDIA_TYPE',
        });
        expect(body.details).toEqual({
          allowedMediaTypes: ['application/json'],
        });
        expect(port).not.toHaveBeenCalled();
      });
    it(`EB content type ${route.name}: application/json with a charset parameter reaches the port`, async () => {
      const { response, port } = await send(route, {
        'content-type': 'application/json; charset=utf-8',
      });
      expect(response.status).toBeLessThan(300);
      expect(port).toHaveBeenCalledTimes(1);
    });
  }
});

describe('EB mutation headers: exact strong If-Match on existing resources, none on the initial create', () => {
  const EXISTING = ROUTES.filter((route) => route.ifMatch !== null);
  const BAD_MATCH: readonly (readonly [string, string | null])[] = [
    ['missing', null],
    ['a weak validator', 'W/"1"'],
    ['an unquoted version', '1'],
    ['the wildcard', '*'],
    ['a non-positive version', '"0"'],
    ['a non-numeric version', '"abc"'],
  ];
  for (const route of EXISTING) {
    for (const [label, value] of BAD_MATCH)
      it(`EB if-match ${route.name}: ${label} is 400 INVALID_REQUEST and the port is never reached`, async () => {
        const { response, body, port } = await send(route, {
          'if-match': value,
        });
        expect({ status: response.status, code: body.code }).toEqual({
          status: 400,
          code: 'INVALID_REQUEST',
        });
        expect(port).not.toHaveBeenCalled();
      });
    it(`EB if-match ${route.name}: the exact strong validator of the body version reaches the port`, async () => {
      const { response, port } = await send(route, {});
      expect(response.status).toBeLessThan(300);
      expect(port).toHaveBeenCalledTimes(1);
    });
  }
  const create = ROUTES[3] as Route;
  it('EB if-match CMS-03B-10 entry create: an initial create needs no If-Match and no fabricated version', async () => {
    const { response, port } = await send(create, {});
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"1"');
    expect(port).toHaveBeenCalledTimes(1);
  });
  it('EB if-match CMS-03B-10 entry create: a supplied If-Match is 400 INVALID_REQUEST and the port is never reached', async () => {
    const { response, body, port } = await send(create, { 'if-match': '"1"' });
    expect({ status: response.status, code: body.code }).toEqual({
      status: 400,
      code: 'INVALID_REQUEST',
    });
    expect(port).not.toHaveBeenCalled();
  });
});
