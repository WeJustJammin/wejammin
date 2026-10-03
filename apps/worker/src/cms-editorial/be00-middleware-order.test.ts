import { describe, expect, it } from 'vitest';

import { registerOrderTests, type OrderStep } from '../be00-order.test-support';
import {
  conflictBody,
  conflictPath,
  createBody,
  createPath,
  entryId,
  harness,
  idempotencyKey,
  post,
  origin,
  requestId,
  restoreBody,
  restorePath,
  revisionBody,
  revisionPath,
  type HarnessOverrides,
} from './route-fixtures.test-support';

/*
 * BE00 "Hono Middleware Order" is executable contract. Each CMS editorial
 * command is probed with one request that fails every step from N onward; the
 * response must be the step N refusal.
 */

type State = Readonly<{
  path: string;
  query: string;
  headers: Readonly<Record<string, string>>;
  body: unknown;
  overrides: HarnessOverrides;
}>;

type Operation = Readonly<{
  name: string;
  path: string;
  badPath: string | null;
  body: unknown;
  ifMatch: string | null;
}>;

const OPERATIONS: readonly Operation[] = [
  {
    name: 'CMS-03B-01 revision',
    path: revisionPath,
    badPath: '/api/v1/cms/entries/not-a-uuid/revisions',
    body: revisionBody,
    ifMatch: '"1"',
  },
  {
    name: 'CMS-03B-02 conflict resolution',
    path: conflictPath,
    badPath: conflictPath.replace(entryId, 'not-a-uuid'),
    body: conflictBody,
    ifMatch: '"2"',
  },
  {
    name: 'CMS-03B-10 entry create',
    path: createPath,
    badPath: null,
    body: createBody,
    ifMatch: null,
  },
  {
    name: 'CMS-03B-04 restore',
    path: restorePath,
    badPath: restorePath.replace(entryId, 'not-a-uuid'),
    body: restoreBody,
    ifMatch: '"2"',
  },
];

const withHeaders = (state: State, headers: Record<string, string>): State => ({
  ...state,
  headers: { ...state.headers, ...headers },
});

const stepsFor = (operation: Operation): readonly OrderStep<State>[] => [
  {
    name: 'CORS origin allowlist',
    status: 403,
    code: 'FORBIDDEN',
    break: (state) =>
      withHeaders(state, { origin: 'https://evil.example.test' }),
  },
  {
    name: 'body size ceiling',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) =>
      withHeaders(state, { 'content-length': String(256 * 1024 + 1) }),
    check: (_response, body) =>
      expect(body.message).toBe('The request body is too large.'),
  },
  {
    name: 'content type',
    status: 415,
    code: 'UNSUPPORTED_MEDIA_TYPE',
    break: (state) => withHeaders(state, { 'content-type': 'text/plain' }),
    check: (_response, body) =>
      expect(body.details).toEqual({ allowedMediaTypes: ['application/json'] }),
  },
  {
    name: 'session-bound CSRF',
    status: 403,
    code: 'FORBIDDEN',
    break: (state) => withHeaders(state, { cookie: 'wj_session_ref=ref-1' }),
  },
  {
    name: 'authentication',
    status: 401,
    code: 'UNAUTHENTICATED',
    break: (state) => ({
      ...state,
      overrides: { ...state.overrides, unauthenticated: true },
    }),
  },
  {
    name: 'strict query validation',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => ({ ...state, query: '?unexpected=1' }),
    check: (_response, body) =>
      expect(body.message).toBe(
        'The command route does not accept query parameters.',
      ),
  },
  ...(operation.badPath === null
    ? []
    : [
        {
          name: 'strict path validation',
          status: 400,
          code: 'INVALID_REQUEST',
          break: (state: State): State => ({
            ...state,
            path: operation.badPath as string,
          }),
          check: (_response: Response, body: Record<string, unknown>) =>
            expect(body.message).toBe('The path parameters are invalid.'),
        },
      ]),
  {
    name: 'strict body validation',
    status: 422,
    code: 'VALIDATION_FAILED',
    break: (state) => ({ ...state, body: {} }),
  },
  {
    name: 'capability',
    status: 403,
    code: 'FORBIDDEN',
    break: (state) => ({
      ...state,
      overrides: { ...state.overrides, capabilities: [] },
    }),
  },
  {
    name: 'rate limit',
    status: 429,
    code: 'RATE_LIMITED',
    break: (state) => ({
      ...state,
      overrides: { ...state.overrides, rateAllowed: false },
    }),
  },
  {
    name: 'idempotency key',
    status: 400,
    code: 'INVALID_REQUEST',
    break: (state) => withHeaders(state, { 'idempotency-key': 'short' }),
  },
];

describe('BE00 middleware order on the CMS editorial human routes', () => {
  for (const operation of OPERATIONS)
    describe(operation.name, () => {
      registerOrderTests<State>({
        family: 'cms-editorial',
        fresh: () => ({
          path: operation.path,
          query: '',
          headers: {
            origin,
            'content-type': 'application/json',
            'idempotency-key': idempotencyKey,
            'x-request-id': requestId,
            ...(operation.ifMatch === null
              ? {}
              : { 'if-match': operation.ifMatch }),
          },
          body: operation.body,
          overrides: {},
        }),
        steps: stepsFor(operation),
        send: (state) =>
          Promise.resolve(
            harness(state.overrides).app.request(
              `${state.path}${state.query}`,
              {
                method: 'POST',
                headers: state.headers,
                body: JSON.stringify(state.body),
              },
            ),
          ),
        accepted: (response) => expect(response.status).toBe(201),
      });
    });

  it('a read follows the same order: origin, media, session, strict path, capability', async () => {
    const readPath = `/api/v1/cms/entries/${entryId}/revisions`;
    const read = (
      path: string,
      headers: Record<string, string>,
      overrides: HarnessOverrides,
    ) =>
      Promise.resolve(
        harness(overrides).app.request(path, {
          method: 'GET',
          headers: { origin, 'x-request-id': requestId, ...headers },
        }),
      );
    const defects = {
      origin: { origin: 'https://evil.example.test' },
      media: { 'content-type': 'application/json' },
    };
    expect(
      (
        await read(
          '/api/v1/cms/entries/not-a-uuid/revisions',
          { ...defects.origin, ...defects.media },
          { unauthenticated: true },
        )
      ).status,
    ).toBe(403);
    const media = await read(
      '/api/v1/cms/entries/not-a-uuid/revisions',
      defects.media,
      { unauthenticated: true },
    );
    expect(media.status).toBe(415);
    expect(((await media.json()) as { details: unknown }).details).toEqual({
      allowedMediaTypes: [],
    });
    expect(
      (
        await read(
          '/api/v1/cms/entries/not-a-uuid/revisions',
          {},
          {
            unauthenticated: true,
          },
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await read(
          '/api/v1/cms/entries/not-a-uuid/revisions',
          {},
          { capabilities: [] },
        )
      ).status,
    ).toBe(400);
    expect((await read(readPath, {}, { capabilities: [] })).status).toBe(403);
  });
});

describe('UNSUPPORTED_MEDIA_TYPE details on the CMS editorial routes (BE00)', () => {
  it('a 415 answered by the persistence port still carries exactly the route allowlist', async () => {
    const response = await post(
      harness({
        appendRevisionFailure: {
          status: 415,
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'private provider text must not escape',
        },
      }).app,
      revisionPath,
      revisionBody,
      { 'if-match': '"1"' },
    );
    expect(response.status).toBe(415);
    const body = (await response.json()) as {
      details: unknown;
      message: string;
    };
    expect(body.details).toEqual({ allowedMediaTypes: ['application/json'] });
  });
});
