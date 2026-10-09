import { describe, expect, it, vi } from 'vitest';

import { ApiErrorSchema } from '@wejammin/contracts';

import type { CmsEditorialDependencies } from './cms-editorial';
import {
  idempotencyKey,
  previewBody,
  previewResource,
  publicationBody,
} from './cms-editorial/workflow-fixtures.test-support';
import {
  ORIGIN,
  fullSession,
  raised,
  rpcEdge,
  workflowApp,
  type RpcCall,
} from './cms-editorial-production-workflow.test-support';
import {
  CORRELATION_ID,
  REQUEST_ID,
  USER_ID,
  json,
} from './cms-editorial-production.test-support';

// BE03b:136,160-161,2019,2167; FE03:1104,1833; BE00:533.
// Exercise public Hono responses over the production adapter. Only the existing
// session/rate seams and PostgREST edge are faked; response assembly stays real.
const NOW_MS = Date.parse('2026-10-08T12:00:00Z');
const RESET_AT = 1_791_460_843;
const REMAINING = 13;

const personalSession: CmsEditorialDependencies['resolveSession'] =
  async () => {
    const session = await fullSession();
    return { ...session, value: { ...session.value, actingPartyId: null } };
  };

const appWithQuota = (fetchImpl: typeof fetch, allowed = true) => {
  const rateLimit = vi.fn<CmsEditorialDependencies['rateLimit']>(
    async (input) => ({
      ok: true,
      value: {
        allowed,
        limit: input.limit,
        remaining: allowed ? REMAINING : 0,
        resetAt: RESET_AT,
      },
    }),
  );
  const app = workflowApp(fetchImpl, {
    resolveSession: personalSession,
    rateLimit,
    now: () => NOW_MS,
  });
  return { app, rateLimit };
};

const send = (
  app: ReturnType<typeof workflowApp>,
  path: string,
  body: unknown,
): Promise<Response> =>
  Promise.resolve(
    app.request(path, {
      method: 'POST',
      headers: {
        origin: ORIGIN,
        'content-type': 'application/json',
        'idempotency-key': idempotencyKey,
        'if-match': '"2"',
        'x-request-id': REQUEST_ID,
        'x-correlation-id': CORRELATION_ID,
      },
      body: JSON.stringify(body),
    }),
  );

const expectCommonHeaders = (response: Response): void => {
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('content-type')).toBe(
    'application/json; charset=UTF-8',
  );
  expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
  expect(response.headers.get('access-control-allow-origin')).toBe(ORIGIN);
  expect(response.headers.get('access-control-allow-credentials')).toBe('true');
};

const expectError = async (
  response: Response,
  expected: Readonly<{ status: number; code: string; details: object }>,
): Promise<void> => {
  expect(response.status).toBe(expected.status);
  expectCommonHeaders(response);
  const body = ApiErrorSchema.parse(await response.json());
  expect(Object.keys(body).sort()).toEqual([
    'code',
    'details',
    'message',
    'requestId',
  ]);
  expect(body).toMatchObject({ code: expected.code, requestId: REQUEST_ID });
  expect(body.details).toEqual(expected.details);
};

const expectRequestContext = (call: RpcCall): void => {
  expect(call.headers).toMatchObject({
    'X-Request-Id': REQUEST_ID,
    'X-Correlation-Id': CORRELATION_ID,
  });
  expect(call.request.context).toEqual({
    authUserId: USER_ID,
    actingPartyId: null,
    stepUpVerified: true,
    requestId: REQUEST_ID,
    correlationId: CORRELATION_ID,
  });
};

const expectPublishAdmission = (
  rateLimit: ReturnType<typeof appWithQuota>['rateLimit'],
): void => {
  // One user bucket makes the required quota tuple unambiguous: no party
  // aggregation policy is invented by this response-header witness.
  expect(rateLimit).toHaveBeenCalledTimes(1);
  expect(rateLimit.mock.calls[0]?.[0]).toMatchObject({
    operationId: 'CMS-03B-09',
    actorId: USER_ID,
    actingPartyId: null,
    principalClass: 'human',
    rateScope: 'user',
    rateClass: 'cms-publish-write',
    limit: 20,
    windowSeconds: 60,
  });
};

const expectNullPublishEvidence = (calls: readonly RpcCall[]): void => {
  expect(calls.map((call) => call.name)).toEqual([
    'cms_load_quality_gate_input',
    'cms_publish_revision',
  ]);
  for (const call of calls) expectRequestContext(call);
  const command = calls[1]!;
  expect(Object.hasOwn(command.request, 'evidence')).toBe(true);
  expect(command.request.evidence).toBeNull();
  expect(command.request).toMatchObject({
    ...publicationBody,
    idempotencyKey,
    expectedVersion: '2',
    ifMatch: '2',
  });
};

describe('CMS-03B-08 public preview response headers', () => {
  it.each([false, true])(
    'returns the accepted 201 token no-store/noindex (RPC replay=%s)',
    async (replayed) => {
      const edge = rpcEdge({
        cms_mint_preview: () =>
          json(previewResource, 200, {
            'x-cms-idempotent-replay': String(replayed),
          }),
      });
      const { app } = appWithQuota(edge.fetchImpl);
      const response = await send(app, '/api/v1/cms/previews', previewBody);
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(previewResource);
      expectCommonHeaders(response);
      expect(response.headers.get('etag')).toBeNull();
      expect(edge.calls.map((call) => call.name)).toEqual(['cms_mint_preview']);
      expectRequestContext(edge.calls[0]!);
      expect(Object.hasOwn(edge.calls[0]!.request, 'evidence')).toBe(false);
      expect(response.headers.get('x-robots-tag')).toBe('noindex');
    },
  );

  it('refuses a mismatched token binding with a scrubbed 502', async () => {
    const edge = rpcEdge({
      cms_mint_preview: () => json({ ...previewResource, audience: 'public' }),
    });
    const { app } = appWithQuota(edge.fetchImpl);
    const response = await send(app, '/api/v1/cms/previews', previewBody);
    expect(edge.calls.map((call) => call.name)).toEqual(['cms_mint_preview']);
    await expectError(response, {
      status: 502,
      code: 'BAD_GATEWAY',
      details: { dependencyClass: 'cms_editorial', retryable: false },
    });
    expect(response.headers.get('retry-after')).toBeNull();
    // No universal noindex assertion on error statuses: FE03 binds it to 201.
  });
});

describe('CMS-03B-09 public publication response headers', () => {
  it.each([
    { dependencyClass: 'preflight', retryAfter: '17' },
    { dependencyClass: 'cms_editorial', retryAfter: '5' },
  ] as const)(
    'retains admitted quota on retryable 503 $dependencyClass',
    async ({ dependencyClass, retryAfter }) => {
      const edge = rpcEdge({
        cms_load_quality_gate_input: () => raised('NOT_FOUND'),
        cms_publish_revision: () =>
          dependencyClass === 'preflight'
            ? raised('DEPENDENCY_UNAVAILABLE', {
                dependencyClass: 'preflight',
                retryAfterSeconds: 17,
              })
            : json({}, 503),
      });
      const { app, rateLimit } = appWithQuota(edge.fetchImpl);
      const response = await send(
        app,
        '/api/v1/cms/publications',
        publicationBody,
      );
      await expectError(response, {
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        details: {
          dependencyClass,
          retryable: true,
          ...(dependencyClass === 'preflight' ? { retryAfterSeconds: 17 } : {}),
        },
      });
      expectPublishAdmission(rateLimit);
      expectNullPublishEvidence(edge.calls);
      expect.soft(response.headers.get('retry-after')).toBe(retryAfter);
      expect.soft(response.headers.get('ratelimit-limit')).toBe('20');
      expect.soft(response.headers.get('ratelimit-remaining')).toBe('13');
      expect.soft(response.headers.get('ratelimit-reset')).toBe('1791460843');
    },
  );

  it('returns the exact 429 quota tuple before any RPC', async () => {
    const edge = rpcEdge({});
    const { app, rateLimit } = appWithQuota(edge.fetchImpl, false);
    const response = await send(
      app,
      '/api/v1/cms/publications',
      publicationBody,
    );
    await expectError(response, {
      status: 429,
      code: 'RATE_LIMITED',
      details: { retryAfterSeconds: 43, limit: 20, resetAt: '1791460843' },
    });
    expectPublishAdmission(rateLimit);
    expect(edge.calls).toEqual([]);
    expect(response.headers.get('retry-after')).toBe('43');
    expect(response.headers.get('ratelimit-limit')).toBe('20');
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
    expect(response.headers.get('ratelimit-reset')).toBe('1791460843');
  });

  it.each([
    { status: 502, code: 'BAD_GATEWAY', malformed: true },
    { status: 500, code: 'INTERNAL_ERROR', malformed: false },
  ] as const)(
    'does not advertise Retry-After on nonretryable $status',
    async ({ status, code, malformed }) => {
      const edge = rpcEdge({
        cms_load_quality_gate_input: () => raised('NOT_FOUND'),
        cms_publish_revision: () =>
          malformed ? json({}) : raised('INTERNAL_ERROR'),
      });
      const { app, rateLimit } = appWithQuota(edge.fetchImpl);
      const response = await send(
        app,
        '/api/v1/cms/publications',
        publicationBody,
      );
      await expectError(response, {
        status,
        code,
        details: malformed
          ? { dependencyClass: 'cms_editorial', retryable: false }
          : {},
      });
      expectPublishAdmission(rateLimit);
      expectNullPublishEvidence(edge.calls);
      expect(response.headers.get('retry-after')).toBeNull();
      expect(response.headers.get('x-cms-editorial-retryable')).toBe('false');
    },
  );
});
