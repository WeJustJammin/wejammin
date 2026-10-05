import { describe, expect, it, vi } from 'vitest';

import {
  createCmsRelatedContentApp,
  registerCmsRelatedContentRoutes,
} from './related-content-routes';
import {
  body,
  dependencies,
  ENTRY_ID,
  PATH,
  request,
  TARGET_A,
  validResource,
} from './related-content-routes.test-support';
import { PARTY_ID, USER_ID } from '../cms-editorial-production.test-support';
import type { CmsRelatedContentDependencies } from './related-content-routes';
import {
  httpAdapter,
  httpFresh,
  httpRequest,
  registerOrderTests,
  standardMutationSteps,
  type HttpState,
} from '../be00-order.test-support';

describe('CMS-03C-05 admission gate', () => {
  it('enforces origin, path binding, media, validators, and CSRF before the port', async () => {
    const actRelatedContent = vi.fn(async () => ({
      ok: false as const,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'curated authority unavailable',
    }));
    const app = createCmsRelatedContentApp(
      dependencies({
        actRelatedContent: async () => {
          await actRelatedContent();
          return {
            ok: false as const,
            status: 503,
            code: 'DEPENDENCY_UNAVAILABLE',
            message: 'curated authority unavailable',
          };
        },
      }),
    );
    const cases: Array<[Request, number, string]> = [
      [
        new Request(`https://api.example.test${PATH}`, {
          method: 'POST',
          headers: {
            origin: 'https://evil.example.test',
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        }),
        403,
        'RELATED_CONTENT_FORBIDDEN',
      ],
      [request({}, { ...body, entryId: TARGET_A }), 400, 'INVALID_REQUEST'],
      [
        request({ 'content-type': 'text/plain' }, 'bad'),
        415,
        'UNSUPPORTED_MEDIA_TYPE',
      ],
      [request({ 'if-match': 'W/"1"' }), 400, 'INVALID_REQUEST'],
      [request({ 'idempotency-key': 'short' }), 400, 'INVALID_REQUEST'],
    ];
    for (const [candidate, status, code] of cases) {
      const response = await app.request(candidate);
      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ code });
    }
    expect(actRelatedContent).not.toHaveBeenCalled();
  });

  it('requires a CSRF double-submit when a session cookie is present', async () => {
    const response = await createCmsRelatedContentApp(dependencies()).request(
      request({ cookie: 'wj_session_ref=protected' }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: 'RELATED_CONTENT_FORBIDDEN',
    });
  });

  it('rejects requests with a query string or missing required admission headers', async () => {
    const app = createCmsRelatedContentApp(dependencies());
    const withQuery = await app.request(
      `https://api.example.test${PATH}?trace=1`,
      {
        method: 'POST',
        headers: {
          origin: 'https://cms.example.test',
          'content-type': 'application/json',
          'idempotency-key': 'related-content-0001',
          'if-match': '"1"',
        },
        body: JSON.stringify(body),
      },
    );
    expect(withQuery.status).toBe(400);
    expect(await withQuery.json()).toMatchObject({ code: 'INVALID_REQUEST' });
    const noIfMatch = await app.request(
      new Request(`https://api.example.test${PATH}`, {
        method: 'POST',
        headers: {
          origin: 'https://cms.example.test',
          'content-type': 'application/json',
          'idempotency-key': 'related-content-0001',
        },
        body: JSON.stringify(body),
      }),
    );
    expect(noIfMatch.status).toBe(400);
  });

  it('returns 400 when admission headers are missing entirely', async () => {
    const app = createCmsRelatedContentApp(dependencies());
    const noIdempotency = await app.request(
      new Request(`https://api.example.test${PATH}`, {
        method: 'POST',
        headers: {
          origin: 'https://cms.example.test',
          'content-type': 'application/json',
          'if-match': '"1"',
        },
        body: JSON.stringify(body),
      }),
    );
    expect(noIdempotency.status).toBe(400);
  });

  it('admits the options preflight only for allowed human origins', async () => {
    const { Hono } = await import('hono');
    const app = new Hono();
    registerCmsRelatedContentRoutes(app, dependencies());
    const allowed = await app.request(`https://api.example.test${PATH}`, {
      method: 'OPTIONS',
      headers: { origin: 'https://cms.example.test' },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe(
      'https://cms.example.test',
    );
    const denied = await app.request(`https://api.example.test${PATH}`, {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example.test' },
    });
    expect(denied.status).toBe(403);
  });

  it('denies an options preflight without any origin header', async () => {
    const app = createCmsRelatedContentApp(dependencies());
    const response = await app.request(`https://api.example.test${PATH}`, {
      method: 'OPTIONS',
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: 'RELATED_CONTENT_FORBIDDEN',
    });
  });

  it('validates the body before admission and forwards only contract violations', async () => {
    const response = await createCmsRelatedContentApp(dependencies()).request(
      request({}, { ...body, pins: [TARGET_A, TARGET_A] }),
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: 'RELATED_CONTENT_VALIDATION_FAILED',
    });
  });

  it('enforces two distinct rate buckets keyed by user and party', async () => {
    const rateLimit = vi.fn(dependencies().rateLimit);
    const response = await createCmsRelatedContentApp(
      dependencies({ rateLimit }),
    ).request(request());
    expect(response.status).toBe(503);
    const inputs = rateLimit.mock.calls.map((call) => call[0]);
    expect(inputs.map((input) => input.rateScope)).toEqual(['user', 'party']);
    expect(inputs.map((input) => input.actorId)).toEqual([USER_ID, PARTY_ID]);
    expect(inputs.map((input) => input.limit)).toEqual([60, 120]);
  });

  it('keeps the session port as the only authority source for a browser request', async () => {
    const session = await dependencies().resolveSession(
      new Request(`https://api.example.test${PATH}`),
      new AbortController().signal,
    );
    expect(session).toMatchObject({
      ok: true,
      value: {
        userId: USER_ID,
        capabilities: ['cms.author'],
      },
    });
  });
});

describe('BE00 middleware order on the CMS related-content route', () => {
  const overridesFor = (
    state: HttpState,
  ): Partial<CmsRelatedContentDependencies> => ({
    actRelatedContent: async () => ({
      ok: true as const,
      value: validResource(),
    }),
    ...(state.unauthenticated
      ? {
          resolveSession: async () => ({
            ok: false as const,
            status: 401 as const,
            code: 'UNAUTHENTICATED',
            message: 'No session.',
          }),
        }
      : {}),
    ...(state.capabilityDropped && !state.unauthenticated
      ? {
          resolveSession: async () => ({
            ok: true as const,
            value: {
              userId: USER_ID,
              actingPartyId: PARTY_ID,
              capabilities: [],
              mfaFresh: true,
            },
          }),
        }
      : {}),
    ...(state.rateExhausted
      ? {
          rateLimit: async (input: { limit: number }) => ({
            ok: true as const,
            value: {
              allowed: false,
              limit: input.limit,
              remaining: 0,
              resetAt: 2_000,
            },
          }),
        }
      : {}),
  });
  registerOrderTests<HttpState>({
    family: 'cms-related-content',
    fresh: () =>
      httpFresh(PATH, body, {
        origin: 'https://cms.example.test',
        'content-type': 'application/json',
        'idempotency-key': 'related-content-0001',
        'if-match': '"1"',
      }),
    steps: standardMutationSteps(
      httpAdapter({
        codes: {
          forbidden: 'RELATED_CONTENT_FORBIDDEN',
          badRequest: 'INVALID_REQUEST',
          unauthenticated: 'UNAUTHENTICATED',
          validation: 'RELATED_CONTENT_VALIDATION_FAILED',
          rateLimited: 'RATE_LIMITED',
        },
        oversize: { status: 400, code: 'INVALID_REQUEST' },
        badPath: PATH.replace(ENTRY_ID, 'not-a-uuid'),
        badBody: {},
      }),
    ),
    send: (state) =>
      Promise.resolve(
        createCmsRelatedContentApp(dependencies(overridesFor(state))).request(
          httpRequest(state, 'https://api.example.test'),
        ),
      ),
    accepted: (response) => expect(response.status).toBe(201),
  });
});

describe('BE00 steps 2 and 8 on the CMS related-content route', () => {
  it('refuses a streamed body over the ceiling that declared no length', async () => {
    const actRelatedContent = vi.fn(async () => ({
      ok: true as const,
      value: validResource(),
    }));
    const response = await createCmsRelatedContentApp(
      dependencies({ actRelatedContent }),
    ).request(request({}, { ...body, pad: 'x'.repeat(300_000) } as never));
    expect(response.status).toBe(400);
    expect(actRelatedContent).not.toHaveBeenCalled();
  });

  it('refuses a body expectedVersion that differs from If-Match once headers are checked', async () => {
    const actRelatedContent = vi.fn(async () => ({
      ok: true as const,
      value: validResource(),
    }));
    const response = await createCmsRelatedContentApp(
      dependencies({ actRelatedContent }),
    ).request(request({ 'if-match': '"2"' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_REQUEST' });
    expect(actRelatedContent).not.toHaveBeenCalled();
  });
});
