import { describe, expect, it } from 'vitest';

import {
  conflictDetailRequest,
  fetchFailing,
  listRequest,
  postgrestRaise,
  readError,
  wiredApp,
} from '../../apps/worker/src/cms-editorial-production-app.test-support';
import { REQUEST_ID } from '../../apps/worker/src/cms-editorial-production.test-support';

/**
 * Slice 10 evidence lane EC, remediation R3 (P2-S10-AC-092 and AC-098). The error mapping of the
 * safe reads CMS-03B-12 (conflict detail) and CMS-03B-13 (entry list) through the REAL route ->
 * production adapter chain, with only the PostgREST edge and the session/rate seams faked: a
 * database refusal token, or an unreachable database, is answered with the closed (status, code,
 * fixed message, details) the operation declares and NEVER with the database's own words. Each case
 * would fail if the mapping were removed (the unmapped token would surface as a different status,
 * relay its text, or be served as a success).
 */

const UPSTREAM = 'relation "platform_private.cms_conflict_records" is down';

type Send = (app: ReturnType<typeof wiredApp>) => Promise<Response> | Response;

const OPERATIONS: ReadonlyArray<readonly [string, Send]> = [
  ['CMS-03B-12', conflictDetailRequest],
  ['CMS-03B-13', (app) => listRequest(app)],
];

type Declared = readonly [string, number, string, Record<string, unknown>];

/** Tokens both reads declare, with the closed answer each one has. */
const DECLARED: readonly Declared[] = [
  [
    'UNAUTHENTICATED',
    401,
    'Sign in again to edit this entry.',
    { recoveryAction: 'reauthenticate' },
  ],
  ['FORBIDDEN', 403, 'The CMS editorial action is not allowed.', {}],
  ['NOT_FOUND', 404, 'The requested CMS editorial resource was not found.', {}],
  ['INVALID_REQUEST', 400, 'The CMS editorial request is invalid.', {}],
  ['INTERNAL_ERROR', 500, 'An unexpected error occurred.', {}],
];

const envelope = async (response: Response) => {
  const body = await readError(response);
  expect(Object.keys(body).sort()).toEqual([
    'code',
    'details',
    'message',
    'requestId',
  ]);
  expect(body.requestId).toBe(REQUEST_ID);
  expect(response.headers.get('cache-control')).toBe('no-store');
  return body;
};

describe.each(OPERATIONS)(
  'EC-092/EC-098 %s answers a database refusal with its declared safe typed error',
  (operation, send) => {
    it.each(DECLARED)(
      `${operation} maps the %s token to %i with the fixed message and details`,
      async (token, status, message, details) => {
        const response = await send(
          wiredApp(fetchFailing(() => postgrestRaise(token))),
        );
        expect(response.status).toBe(status);
        const body = await envelope(response);
        expect(body.code).toBe(token);
        expect(body.message).toBe(message);
        expect(body.details).toEqual(details);
      },
    );

    it(`${operation} never relays a database message: an unrecognised token is a scrubbed 500 INTERNAL_ERROR`, async () => {
      const response = await send(
        wiredApp(fetchFailing(() => postgrestRaise(UPSTREAM))),
      );
      expect(response.status).toBe(500);
      const body = await envelope(response);
      expect(body.code).toBe('INTERNAL_ERROR');
      expect(body.message).toBe('An unexpected error occurred.');
      expect(JSON.stringify(body)).not.toContain('platform_private');
      expect(JSON.stringify(body)).not.toContain('cms_conflict_records');
    });

    it(`${operation} answers an unreachable database as the retryable 503 DEPENDENCY_UNAVAILABLE, naming no upstream text`, async () => {
      const response = await send(
        wiredApp(
          fetchFailing(() => {
            throw new TypeError(UPSTREAM);
          }),
        ),
      );
      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('5');
      const body = await envelope(response);
      expect(body.code).toBe('DEPENDENCY_UNAVAILABLE');
      expect(body.details).toEqual({
        dependencyClass: 'cms_editorial',
        retryable: true,
      });
      expect(JSON.stringify(body)).not.toContain('platform_private');
    });

    it(`${operation} answers a database that reports itself unavailable as the same retryable 503`, async () => {
      const response = await send(
        wiredApp(fetchFailing(() => postgrestRaise('DEPENDENCY_UNAVAILABLE'))),
      );
      expect(response.status).toBe(503);
      expect(response.headers.get('retry-after')).toBe('5');
      expect((await envelope(response)).details).toEqual({
        dependencyClass: 'cms_editorial',
        retryable: true,
      });
    });

    it(`${operation} states the retry window of a rate limit and marks nothing else retryable`, async () => {
      const limited = await send(
        wiredApp(fetchFailing(() => postgrestRaise('RATE_LIMITED'))),
      );
      expect(limited.status).toBe(429);
      expect((await envelope(limited)).details).toEqual({
        retryAfterSeconds: 60,
      });
      const internal = await send(
        wiredApp(fetchFailing(() => postgrestRaise('INTERNAL_ERROR'))),
      );
      expect(internal.headers.get('retry-after')).toBeNull();
      expect((await envelope(internal)).details).toEqual({});
    });
  },
);

describe('EC-092 CMS-03B-12 maps ONLY its declared errors', () => {
  it.each(['CONFLICT', 'INVALID_TRANSITION'])(
    'a %s token (not declared for the conflict detail read) is a scrubbed 500, never a 409',
    async (token) => {
      const response = await conflictDetailRequest(
        wiredApp(fetchFailing(() => postgrestRaise(token))),
      );
      expect(response.status).toBe(500);
      const body = await envelope(response);
      expect(body.code).toBe('INTERNAL_ERROR');
      expect(body.details).toEqual({});
      expect(JSON.stringify(body)).not.toContain('INVALID_TRANSITION');
    },
  );
});

describe('EC-098 CMS-03B-13 publishes the cursor refusal as its declared 409 with a safe restart', () => {
  it.each(['CONFLICT', 'INVALID_TRANSITION'])(
    'a %s token is the declared 409 CONFLICT with the refresh recovery action and no database text',
    async (token) => {
      const response = await listRequest(
        wiredApp(fetchFailing(() => postgrestRaise(token))),
        '?cursor=expired',
      );
      expect(response.status).toBe(409);
      const body = await envelope(response);
      expect(body.code).toBe('CONFLICT');
      expect(body.details).toEqual({
        recoveryAction: 'refresh',
        conflict: 'INVALID_TRANSITION',
      });
      expect(body.message).toBe(
        'The CMS editorial resource changed; reload and try again.',
      );
    },
  );
});
