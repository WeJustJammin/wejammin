import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

import { createLogger as makeLogger } from '@wejammin/observability/logging';
import {
  IdentityCommandHeadersSchema,
  RequestIdSchema,
  type IdentityOperationId,
} from '@wejammin/contracts';

import { createWorkerApp, type WorkerApp, type WorkerContext } from '../index';
import type {
  AuthenticationDependencies,
  AuthenticationResult,
} from '../authentication/types';
import {
  CSRF,
  ORIGIN,
  REQUEST_ID,
} from '../authentication/phase-02-slice-02.test-fixtures';
import {
  createApp,
  success,
} from '../authentication/phase-02-slice-02.test-support';
import { evaluateIaPolicy } from './ia-policy';
import {
  identityPolicy,
  parseIdentityCommandHeaders,
  parseIdentityJsonBody,
  rejectUnexpectedIdentityQuery,
} from './route-parse';
import {
  callIdentityPort,
  enforceIdentityRate,
  identityResponse,
  requireIdentitySession,
  safeApiError,
} from './route-runtime';

const ALIAS_ID = '66666666-6666-4666-8666-666666666666';
const PARTY_ID = '88888888-8888-4888-8888-888888888888';
const BRANDED_REQUEST_ID = RequestIdSchema.parse(REQUEST_ID);

const invokeRuntime = async (
  handler: (context: WorkerContext) => Promise<Response> | Response,
  auth?: AuthenticationDependencies,
): Promise<Response> => {
  const app: WorkerApp = new Hono();
  app.all('*', (context) => {
    context.set('requestId', BRANDED_REQUEST_ID);
    if (auth !== undefined) context.set('identityAuth', auth);
    return handler(context);
  });
  return app.request(requestFor('/runtime'));
};

const requestFor = (
  path: string,
  method: 'GET' | 'POST' | 'PATCH' = 'GET',
  body?: unknown,
  extra: Record<string, string> = {},
): Request => {
  const headers = new Headers({
    origin: ORIGIN,
    cookie: `wj_session_ref=slice02-session-ref; wj_csrf=${CSRF}`,
    'x-csrf-token': CSRF,
    'idempotency-key': 'slice03-coverage',
    'if-match': '"1"',
    'x-request-id': REQUEST_ID,
    ...extra,
  });
  if (body !== undefined) headers.set('content-type', 'application/json');
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(`${ORIGIN}${path}`, init);
};

describe('Slice 03 identity helper coverage boundaries', () => {
  it('passes the optional public-link-only alias patch through its port', async () => {
    const { app, identity } = createApp();
    const response = await app.request(
      requestFor(`/api/v1/aliases/${ALIAS_ID}`, 'PATCH', {
        publicLinkState: 'private',
      }),
    );

    expect(response.status).toBe(200);
    expect(identity.patchAlias).toHaveBeenCalled();
  });

  it.each([
    '/api/v1/aliases/not-an-alias/handle-changes',
    '/api/v1/aliases/not-an-alias/retire',
    '/api/v1/aliases/not-an-alias/transfer-offers',
  ])('rejects malformed alias route parameters: %s', async (path) => {
    const { app } = createApp();
    const body = path.endsWith('transfer-offers')
      ? { recipientPersonId: PARTY_ID }
      : path.endsWith('handle-changes')
        ? { handle: 'neon-harbor' }
        : {};
    const response = await app.request(requestFor(path, 'POST', body));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: 'INVALID_REQUEST',
    });
  });

  it('maps a malformed public projection from persistence to 502', async () => {
    const { app, identity } = createApp();
    vi.mocked(identity.readPublicProjection!).mockResolvedValue(
      success({ malformed: true }) as never,
    );

    const response = await app.request(
      requestFor(`/api/v1/identity/parties/${PARTY_ID}/projection`),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      code: 'DEPENDENCY_INVALID_RESPONSE',
    });
  });

  it('reports a missing public projection dependency', async () => {
    const { app, identity } = createApp();
    delete (identity as unknown as Record<string, unknown>)
      .readPublicProjection;

    const response = await app.request(
      requestFor(`/api/v1/identity/parties/${PARTY_ID}/projection`),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('returns the cursor when the acting-context query is valid', async () => {
    const { app } = createApp();
    const response = await app.request(
      requestFor('/api/v1/me/acting-contexts?cursor=next-page'),
    );

    expect(response.status).toBe(200);
  });

  it('fails closed when the identity dependency collection is absent', async () => {
    const dependencies = {
      captureException: vi.fn(),
      createLogger: () =>
        makeLogger({
          environment: 'staging',
          release: 'coverage-test',
          service: 'worker',
        }),
      now: () => Date.now(),
    };
    const noIdentityApp = createWorkerApp(dependencies);
    const response = await noIdentityApp.request(
      requestFor('/api/v1/me/identity'),
    );

    expect(response.status).toBe(503);
    const publicResponse = await noIdentityApp.request(
      requestFor(`/api/v1/identity/parties/${PARTY_ID}/projection`),
    );
    expect(publicResponse.status).toBe(503);
  });

  it('uses the explicit unsupported edge policy fallback', () => {
    expect(
      evaluateIaPolicy({ kind: 'edge', name: 'unknown-edge' } as never),
    ).toEqual({ decision: 'unsupported', outcome: 'fail-closed' });
  });

  it('fails closed when session and rate-limit dependencies are unavailable', async () => {
    const missingSession = await invokeRuntime(async (context) => {
      const result = await requireIdentitySession(context);
      return safeApiError(
        context,
        result.ok ? 'UNEXPECTED_SUCCESS' : result.code,
        result.ok ? 'Unexpected success.' : result.message,
        result.ok ? 500 : result.status,
      );
    });
    expect(missingSession.status).toBe(503);

    const { auth: throwingSession } = createApp({
      resolveSession: vi.fn(async () => {
        throw new Error('session dependency failed');
      }),
    });
    const failedSession = await invokeRuntime(async (context) => {
      const result = await requireIdentitySession(context);
      return safeApiError(
        context,
        result.ok ? 'UNEXPECTED_SUCCESS' : result.code,
        result.ok ? 'Unexpected success.' : result.message,
        result.ok ? 500 : result.status,
      );
    }, throwingSession);
    expect(failedSession.status).toBe(503);

    const { auth: rejectedRate } = createApp({
      rateLimit: vi.fn(async () => ({
        ok: false as const,
        status: 503 as const,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Rate dependency unavailable.',
      })),
    });
    const rejected = await invokeRuntime(
      async (context) =>
        (await enforceIdentityRate(context, 'BE01b-02', null)) ??
        safeApiError(context, 'UNEXPECTED_SUCCESS', 'Unexpected success.', 500),
      rejectedRate,
    );
    expect(rejected.status).toBe(503);

    const { auth: throwingRate } = createApp({
      rateLimit: vi.fn(async () => {
        throw new Error('rate dependency failed');
      }),
    });
    const unavailable = await invokeRuntime(
      async (context) =>
        (await enforceIdentityRate(context, 'BE01b-02', null)) ??
        safeApiError(context, 'UNEXPECTED_SUCCESS', 'Unexpected success.', 500),
      throwingRate,
    );
    expect(unavailable.status).toBe(503);
  });

  it('maps every identity-port rejection boundary', async () => {
    const aborted = await callIdentityPort('BE01b-02', async () => {
      throw new DOMException('aborted', 'AbortError');
    });
    expect(aborted).toMatchObject({ ok: false, status: 504 });

    const portError: AuthenticationResult<never> = {
      ok: false,
      status: 409,
      code: 'VERSION_CONFLICT',
      message: 'Version conflict.',
    };
    const preserved = await callIdentityPort('BE01b-02', async () => {
      throw portError;
    });
    expect(preserved).toEqual(portError);

    const unavailable = await callIdentityPort('BE01b-02', async () => {
      throw new Error('persistence failed');
    });
    expect(unavailable).toMatchObject({ ok: false, status: 503 });

    vi.useFakeTimers();
    try {
      const timedOut = callIdentityPort(
        'BE01b-02',
        (signal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              reject(new DOMException('aborted', 'AbortError'));
            });
          }),
      );
      await vi.advanceTimersByTimeAsync(identityPolicy('BE01b-02').timeoutMs);
      await expect(timedOut).resolves.toMatchObject({ ok: false, status: 504 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('covers invalid policy, cursor, persistence, and safe-error responses', async () => {
    expect(() => identityPolicy('BE01b-99' as IdentityOperationId)).toThrow(
      'Missing identity policy BE01b-99',
    );
    const invalidCursor = rejectUnexpectedIdentityQuery(
      new Request(`${ORIGIN}/runtime?cursor=${'x'.repeat(2048)}`),
      true,
    );
    expect(invalidCursor).toMatchObject({ ok: false, status: 400 });

    const unsupportedBody = await parseIdentityJsonBody(
      new Request(`${ORIGIN}/runtime`, { method: 'POST' }),
      {
        safeParse: (value: unknown) => ({
          success: true as const,
          data: value,
        }),
      },
    );
    expect(unsupportedBody).toMatchObject({
      ok: false,
      status: 415,
      details: { allowedMediaTypes: ['application/json'] },
    });

    const emptyIssues = vi
      .spyOn(IdentityCommandHeadersSchema, 'safeParse')
      .mockReturnValueOnce({
        success: false,
        error: { issues: [] },
      } as never);
    try {
      const invalidHeaders = parseIdentityCommandHeaders(
        new Request(`${ORIGIN}/runtime`),
        false,
      );
      expect(invalidHeaders).toMatchObject({
        ok: false,
        details: {
          violations: [{ path: '/headers', code: 'header_invalid' }],
        },
      });
    } finally {
      emptyIssues.mockRestore();
    }

    const invalidPersistence = await invokeRuntime((context) =>
      identityResponse(
        context,
        success({ value: 'invalid' }),
        { safeParse: () => ({ success: false }) },
        200,
      ),
    );
    expect(invalidPersistence.status).toBe(502);

    const safeError = await invokeRuntime((context) =>
      safeApiError(context, 'SAFE_FAILURE', 'Safe failure.', 400),
    );
    expect(safeError.status).toBe(400);
    await expect(safeError.json()).resolves.toMatchObject({
      code: 'SAFE_FAILURE',
      details: {},
      requestId: REQUEST_ID,
    });
  });
});
