import { describe, expect, it } from 'vitest';

import { opFor } from './phase-02-slice-09-be03a-evidence-support';
import {
  composeProduction,
  raised,
  type AuthRateModel,
  type RpcHandler,
} from './phase-02-slice-09-r2-support';
import { json } from './production-test-support';
import {
  API_ORIGIN,
  CMS_ORIGIN,
  REQUEST_ID,
  TYPE_ID,
  VERSION_ID,
  validActivation,
  validDraft,
  validField,
  validRelation,
} from './phase-02-slice-09-test-values';

/**
 * AC032: the exhaustive 400, 401, 403, 404, 409, 413, 415, 422, 429, 502, 503
 * and 504 mapping of the four original human mutations A01-A04, produced the
 * way production produces each status: the real CMS RPC adapter maps the
 * PostgREST answer, the real limiter adapter counts the bucket, and the Worker
 * serializes the BE00 envelope with that status's exact details row. Only the
 * PostgREST HTTP boundary is faked, and it answers exactly what a database
 * function raises (`P0001` with the closed code in `message`), never a status
 * the Worker was told to return.
 */
const versionPath = `/api/v1/cms/content-types/${TYPE_ID}/versions/${VERSION_ID}`;
const OPERATIONS = [
  ['CMS-03A-01', '/api/v1/cms/content-types', validDraft, false],
  ['CMS-03A-02', `${versionPath}/fields`, validField, true],
  ['CMS-03A-03', `${versionPath}/relations`, validRelation, true],
  ['CMS-03A-04', `${versionPath}/activate`, validActivation, true],
] as const;

const requestFor = (
  path: string,
  body: unknown,
  ifMatch: boolean,
  headers: Record<string, string> = {},
): Request =>
  new Request(`${API_ORIGIN}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: CMS_ORIGIN,
      authorization: 'Bearer verified-session',
      'idempotency-key': 'cms-test-key-001',
      'x-request-id': REQUEST_ID,
      ...(ifMatch ? { 'if-match': '"1"' } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });

const EXHAUSTED: AuthRateModel = {
  calls: [],
  handler: (_rpc, body) =>
    json({
      allowed: false,
      limit: Number(body.p_limit),
      remaining: 0,
      resetAt: Math.floor(1_788_345_600_000 / 1000) + 43,
    }),
};

type Row = Readonly<{
  status: number;
  code: string;
  details: unknown;
  cms?: RpcHandler;
  rate?: AuthRateModel;
  deadlineMs?: number;
  headers?: Record<string, string>;
}>;

const rows: readonly Row[] = [
  {
    status: 400,
    code: 'INVALID_REQUEST',
    details: {},
    cms: () => raised('INVALID_REQUEST'),
  },
  {
    status: 401,
    code: 'UNAUTHENTICATED',
    details: { recoveryAction: 'reauthenticate' },
    cms: () => raised('UNAUTHENTICATED'),
  },
  {
    status: 403,
    code: 'FORBIDDEN',
    details: { reasonCode: 'CAPABILITY_REQUIRED' },
    cms: () => raised('FORBIDDEN'),
  },
  {
    status: 404,
    code: 'NOT_FOUND',
    details: {},
    cms: () => raised('NOT_FOUND'),
  },
  {
    status: 409,
    code: 'CONFLICT',
    details: {
      conflict: 'VERSION_MISMATCH',
      recoveryAction: 'reload',
      expectedVersion: '1',
      currentVersion: '2',
    },
    cms: () =>
      raised(
        'VERSION_MISMATCH',
        JSON.stringify({ expectedVersion: '1', currentVersion: '2' }),
      ),
  },
  {
    status: 413,
    code: 'PAYLOAD_TOO_LARGE',
    details: {},
    headers: { 'content-length': String(256 * 1024 + 1) },
  },
  {
    status: 415,
    code: 'UNSUPPORTED_MEDIA_TYPE',
    details: { allowedMediaTypes: ['application/json'] },
    headers: { 'content-type': 'text/plain' },
  },
  {
    status: 422,
    code: 'VALIDATION_FAILED',
    details: {
      violations: [{ path: '/typeKey', message: 'typeKey is taken' }],
    },
    cms: () =>
      raised(
        'VALIDATION_FAILED',
        JSON.stringify({
          violations: [{ pointer: '/typeKey', message: 'typeKey is taken' }],
        }),
      ),
  },
  {
    status: 429,
    code: 'RATE_LIMITED',
    details: expect.objectContaining({ retryAfterSeconds: 43 }),
    rate: EXHAUSTED,
  },
  {
    status: 502,
    code: 'DEPENDENCY_UNAVAILABLE',
    details: { dependencyClass: 'cms_registry', retryable: true },
    cms: () => new Response('not json', { status: 200 }),
  },
  {
    status: 503,
    code: 'DEPENDENCY_UNAVAILABLE',
    details: {
      dependencyClass: 'cms_registry',
      retryable: true,
      retryAfterSeconds: 5,
    },
    cms: () => raised('boom', null, 500),
  },
  {
    status: 504,
    code: 'DEPENDENCY_UNAVAILABLE',
    details: {
      dependencyClass: 'cms_registry',
      retryable: true,
      retryAfterSeconds: 5,
    },
    cms: (_rpc, _body, signal) =>
      new Promise<Response>((_resolve, reject) => {
        signal.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      }),
    deadlineMs: 20,
  },
];

describe('A01-A04 error rows produced through the production adapters (AC032)', () => {
  for (const [id, path, body, ifMatch] of OPERATIONS)
    for (const row of rows)
      it(`[P2-S09-AC-032] ${id} ${row.status} ${row.code} carries the BE00 envelope and exactly its details row`, async () => {
        const stack = composeProduction(opFor('CMS-03A-09'), {
          ...(row.cms === undefined ? {} : { cms: row.cms }),
          ...(row.rate === undefined ? {} : { rate: row.rate }),
          ...(row.deadlineMs === undefined
            ? {}
            : { deadlineMs: row.deadlineMs }),
        });
        const response = await stack.send(
          requestFor(path, body, ifMatch, row.headers),
        );
        expect(response.status).toBe(row.status);
        const payload = (await response.json()) as Record<string, unknown>;
        expect(Object.keys(payload).sort()).toStrictEqual([
          'code',
          'details',
          'message',
          'requestId',
        ]);
        expect(payload.code).toBe(row.code);
        expect(payload.requestId).toBe(REQUEST_ID);
        expect(payload.details).toStrictEqual(row.details);
        expect(JSON.stringify(payload)).not.toMatch(
          /SQLSTATE|P0001|stack|boom|not json/u,
        );
      });
});
