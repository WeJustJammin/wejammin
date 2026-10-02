import { describe, expect, it, vi } from 'vitest';
import type { TaxonomyTermResource } from '@wejammin/contracts';
import { createLogger } from '@wejammin/observability/logging';

import { createWorkerApp } from '../index';

import {
  createCmsTaxonomyApp,
  type CmsTaxonomyDependencies,
  type CmsTaxonomyError,
} from './taxonomy-routes';

const taxonomyId = 'd1200000-0000-4000-8000-000000000001';
const termId = 'd1200000-0000-4000-8000-000000000002';
const origin = 'https://cms.example.test';
const path = `/api/v1/cms/taxonomies/${taxonomyId}/terms/actions`;
const body = {
  taxonomyId,
  action: 'create',
  termKey: 'jazz-fusion',
  parentId: null,
  survivorId: null,
  labels: [{ locale: 'en-US', label: 'Jazz fusion' }],
  aliases: [],
  expectedVersion: '1',
} as const;
const resource: TaxonomyTermResource = {
  id: termId,
  version: '1',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-28T04:00:00.000Z',
  updatedAt: '2026-09-28T04:00:00.000Z',
  lifecycle: 'active',
  taxonomyId,
  termId,
  termKey: 'jazz-fusion',
  parentId: null,
  successorId: null,
};

const request = (
  overrides: {
    path?: string;
    body?: unknown;
    rawBody?: string;
    headers?: Record<string, string>;
  } = {},
): Request =>
  new Request(`https://api.example.test${overrides.path ?? path}`, {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      'idempotency-key': 'taxonomy-action-0001',
      'if-match': '"1"',
      ...overrides.headers,
    },
    body: overrides.rawBody ?? JSON.stringify(overrides.body ?? body),
  });

const deps = (
  overrides: Partial<CmsTaxonomyDependencies> = {},
): CmsTaxonomyDependencies => ({
  humanOrigins: [origin],
  now: () => 1_000,
  resolveSession: async () => ({
    ok: true,
    value: {
      userId: 'd1200000-0000-4000-8000-000000000003',
      actingPartyId: 'd1200000-0000-4000-8000-000000000004',
      capabilities: ['cms.taxonomy_curator'],
      mfaFresh: true,
    },
  }),
  rateLimit: async (input) => ({
    ok: true,
    value: {
      allowed: true,
      limit: input.limit,
      remaining: input.limit - 1,
      resetAt: 2_000,
    },
  }),
  actTerm: async () => ({ ok: true, value: resource }),
  telemetry: () => undefined,
  ...overrides,
});

const portError = (
  status: CmsTaxonomyError['status'],
  details?: Record<string, unknown>,
): CmsTaxonomyError => ({
  ok: false,
  status,
  code: 'UNTRUSTED',
  message: 'private provider text must not escape',
  ...(details === undefined ? {} : { details }),
});

const readDetails = async (response: Response): Promise<unknown> =>
  ((await response.json()) as { details: unknown }).details;

describe('CMS-03C-03 taxonomy term actions route', () => {
  it('allows only configured-origin preflight without revealing a term', async () => {
    const app = createCmsTaxonomyApp(deps());
    const allowed = await app.request(
      new Request(`https://api.example.test${path}`, {
        method: 'OPTIONS',
        headers: { origin },
      }),
    );
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-origin')).toBe(origin);
    expect(allowed.headers.get('access-control-allow-methods')).toBe(
      'POST, OPTIONS',
    );
    expect(allowed.headers.get('cache-control')).toBe('no-store');
    const denied = await app.request(
      new Request(`https://api.example.test${path}`, {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.test' },
      }),
    );
    expect(denied.status).toBe(403);
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('mounts the protected route in the Worker composition only when injected', async () => {
    const worker = createWorkerApp({
      captureException: () => undefined,
      createLogger: () =>
        createLogger(
          {
            environment: 'staging',
            release: 'slice-12',
            service: 'wejammin-api',
          },
          {
            now: () => new Date('2026-09-28T04:00:00.000Z'),
            random: () => 0,
            sink: () => undefined,
          },
        ),
      now: () => 1_000,
      cmsTaxonomy: deps(),
    });
    const response = await worker.request(request(), undefined, {
      APP_ENVIRONMENT: 'staging',
      APP_RELEASE: 'slice-12',
      SUPABASE_SECRET_KEY: 'sb_secret_test_only',
      SUPABASE_URL: 'https://supabase.example.test',
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(resource);
  });

  it('serves a validated term from the protected port with both rate buckets', async () => {
    const rateLimit = vi.fn(deps().rateLimit);
    const actTerm = vi.fn(deps().actTerm);
    const response = await createCmsTaxonomyApp(
      deps({ rateLimit, actTerm }),
    ).request(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(resource);
    expect(response.headers.get('etag')).toBe('"1"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(
      rateLimit.mock.calls.map(([input]) => [input.rateScope, input.limit]),
    ).toEqual([
      ['user', 60],
      ['party', 120],
    ]);
    expect(actTerm).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'CMS-03C-03',
        path: { taxonomyId },
        body,
        ifMatch: '1',
        idempotencyKey: 'taxonomy-action-0001',
      }),
      expect.any(AbortSignal),
    );
  });

  it('rejects malformed path, body, media, and strong preconditions before the port', async () => {
    const actTerm = vi.fn(deps().actTerm);
    const app = createCmsTaxonomyApp(deps({ actTerm }));
    const cases = [
      [
        request({ path: '/api/v1/cms/taxonomies/not-a-uuid/terms/actions' }),
        400,
      ],
      [request({ path: `${path}?debug=1` }), 400],
      [request({ body: { ...body, taxonomyId: termId } }), 400],
      [request({ headers: { 'if-match': 'W/"1"' } }), 400],
      [request({ headers: { 'if-match': '"2"' } }), 400],
      [request({ headers: { 'content-type': 'text/plain' } }), 415],
      [request({ headers: { 'content-type': '' } }), 415],
      [request({ headers: { 'idempotency-key': '' } }), 400],
      [request({ headers: { 'if-match': '' } }), 400],
      [request({ rawBody: '{' }), 400],
      [request({ body: { ...body, injectedOwner: termId } }), 422],
    ] as const;
    for (const [input, status] of cases) {
      const response = await app.request(input);
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    const absentHeaders = [
      { origin, 'content-type': 'application/json', 'if-match': '"1"' },
      {
        origin,
        'content-type': 'application/json',
        'idempotency-key': 'taxonomy-action-0001',
      },
    ];
    for (const headers of absentHeaders) {
      const response = await app.request(
        new Request(`https://api.example.test${path}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        }),
      );
      expect(response.status).toBe(400);
    }
    const fieldError = await app.request(
      request({ body: { ...body, injectedOwner: termId } }),
    );
    const detail = (await fieldError.json()) as {
      details: { violations: { path: string; message: string }[] };
    };
    expect(detail.details.violations).toEqual([
      {
        path: '/injectedOwner',
        code: 'unknown_field',
        message: 'The value is invalid.',
      },
    ]);
    expect(actTerm).not.toHaveBeenCalled();
  });

  it('enforces origin, CSRF, human session, and curator capability', async () => {
    const actTerm = vi.fn(deps().actTerm);
    const app = createCmsTaxonomyApp(deps({ actTerm }));
    expect(
      (await app.request(request({ headers: { origin: 'https://evil.test' } })))
        .status,
    ).toBe(403);
    expect(
      (await app.request(request({ headers: { cookie: 'wj_session_ref=a' } })))
        .status,
    ).toBe(403);
    expect(
      (
        await app.request(
          request({
            headers: {
              cookie: 'wj_session_ref=a; wj_csrf=b',
              'x-csrf-token': 'b',
            },
          }),
        )
      ).status,
    ).toBe(200);
    const missingSession = createCmsTaxonomyApp(
      deps({ resolveSession: async () => portError(401) }),
    );
    expect((await missingSession.request(request())).status).toBe(401);
    const noCurator = createCmsTaxonomyApp(
      deps({
        resolveSession: async () => ({
          ok: true,
          value: {
            userId: termId,
            actingPartyId: taxonomyId,
            capabilities: ['cms.editor'],
            mfaFresh: true,
          },
        }),
      }),
    );
    expect((await noCurator.request(request())).status).toBe(403);
    expect(actTerm).toHaveBeenCalledTimes(1);
  });

  it('sanitizes conflict details and rejects invalid port output', async () => {
    const conflict = await createCmsTaxonomyApp(
      deps({
        actTerm: async () =>
          portError(409, { currentVersion: '2', privateLabel: 'Secret' }),
      }),
    ).request(request());
    expect(conflict.status).toBe(409);
    expect(await conflict.text()).not.toContain('Secret');
    const privateViolation = await createCmsTaxonomyApp(
      deps({
        actTerm: async () =>
          portError(422, {
            violations: [
              {
                path: '/termKey',
                code: 'term_key_invalid',
                message: 'secret SQL',
              },
            ],
            privateLabel: 'Secret',
          }),
      }),
    ).request(request());
    expect(privateViolation.status).toBe(422);
    expect(await privateViolation.json()).toEqual(
      expect.objectContaining({
        details: {
          violations: [
            {
              path: '/termKey',
              code: 'term_key_invalid',
              message: 'The value is invalid.',
            },
          ],
        },
      }),
    );
    const malformed = await createCmsTaxonomyApp(
      deps({
        actTerm: async () => ({
          ok: true,
          value: { ...resource, taxonomyId: termId },
        }),
      }),
    ).request(request());
    expect(malformed.status).toBe(502);
  });

  it('honors rate refusal, dependency failure, and the 15-second deadline', async () => {
    const refused = await createCmsTaxonomyApp(
      deps({
        rateLimit: async (input) => ({
          ok: true,
          value: {
            allowed: false,
            limit: input.limit,
            remaining: 0,
            resetAt: 2,
          },
        }),
      }),
    ).request(request());
    expect(refused.status).toBe(429);
    expect(refused.headers.get('retry-after')).toBe('1');
    const thrown = await createCmsTaxonomyApp(
      deps({
        actTerm: async () => {
          throw new Error('secret');
        },
      }),
    ).request(request());
    expect(thrown.status).toBe(503);
    expect(await thrown.text()).not.toContain('secret');
    vi.useFakeTimers();
    try {
      const pending = createCmsTaxonomyApp(
        deps({ actTerm: async () => new Promise(() => undefined) }),
      ).request(request());
      await vi.advanceTimersByTimeAsync(15_000);
      expect((await pending).status).toBe(504);
    } finally {
      vi.useRealTimers();
    }
  });

  it('publishes the BE00 429 contract with second-granularity reset and matching headers', async () => {
    const response = await createCmsTaxonomyApp(
      deps({
        now: () => 1_000,
        rateLimit: async (input) => ({
          ok: true,
          value: {
            allowed: input.rateScope === 'user',
            limit: input.limit,
            remaining: 0,
            resetAt: 2,
          },
        }),
      }),
    ).request(request());
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('1');
    expect(response.headers.get('ratelimit-limit')).toBe('120');
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
    expect(response.headers.get('ratelimit-reset')).toBe('2');
    expect(await response.json()).toMatchObject({
      code: 'RATE_LIMITED',
      details: { limit: 120, retryAfterSeconds: 1, resetAt: '2' },
    });
  });

  it('fails closed on invalid session and limiter dependency responses', async () => {
    const actTerm = vi.fn(deps().actTerm);
    const invalidSession = await createCmsTaxonomyApp(
      deps({
        actTerm,
        resolveSession: async () =>
          ({ ok: true, value: { userId: 'bad' } }) as never,
      }),
    ).request(request());
    expect(invalidSession.status).toBe(401);
    const invalidSessionEnvelope = await createCmsTaxonomyApp(
      deps({ actTerm, resolveSession: async () => undefined as never }),
    ).request(request());
    expect(invalidSessionEnvelope.status).toBe(502);
    const sessionException = await createCmsTaxonomyApp(
      deps({
        actTerm,
        resolveSession: async () => {
          throw new Error('private auth error');
        },
      }),
    ).request(request());
    expect(sessionException.status).toBe(503);
    expect(await sessionException.text()).not.toContain('private auth error');
    const invalidRate = await createCmsTaxonomyApp(
      deps({
        actTerm,
        rateLimit: async () => ({
          ok: true,
          value: { allowed: true, limit: 999, remaining: 999, resetAt: 0 },
        }),
      }),
    ).request(request());
    expect(invalidRate.status).toBe(502);
    const invalidRateEnvelope = await createCmsTaxonomyApp(
      deps({ actTerm, rateLimit: async () => null as never }),
    ).request(request());
    expect(invalidRateEnvelope.status).toBe(502);
    const refusedRate = await createCmsTaxonomyApp(
      deps({
        actTerm,
        rateLimit: async () => portError(503, { providerToken: 'secret' }),
      }),
    ).request(request());
    expect(refusedRate.status).toBe(503);
    expect(await refusedRate.text()).not.toContain('secret');
    const rateException = await createCmsTaxonomyApp(
      deps({
        actTerm,
        rateLimit: async () => {
          throw new Error('private limiter error');
        },
      }),
    ).request(request());
    expect(rateException.status).toBe(503);
    expect(actTerm).not.toHaveBeenCalled();
  });

  it('checks successful port output and scrubs provider-private failure details', async () => {
    const variants = [
      { ...resource, id: taxonomyId },
      { ...resource, termKey: 'wrong-key' },
      { ...resource, version: '2' },
      { ...resource, parentId: termId },
      { ...resource, successorId: taxonomyId },
      { ...resource, lifecycle: 'merged' },
      { ...resource, ownerId: taxonomyId },
    ];
    for (const value of variants) {
      const response = await createCmsTaxonomyApp(
        deps({
          actTerm: async () => ({
            ok: true,
            value: value as TaxonomyTermResource,
          }),
        }),
      ).request(request());
      expect(response.status).toBe(502);
    }
    const missing = await createCmsTaxonomyApp(
      deps({ actTerm: async () => portError(404, { hiddenName: 'secret' }) }),
    ).request(request());
    expect(missing.status).toBe(404);
    expect(await missing.text()).not.toContain('secret');
    const invalidEnvelope = await createCmsTaxonomyApp(
      deps({ actTerm: async () => ({ ok: 'yes', value: resource }) as never }),
    ).request(request());
    expect(invalidEnvelope.status).toBe(502);
    const unknownStatus = await createCmsTaxonomyApp(
      deps({ actTerm: async () => portError(418 as never) }),
    ).request(request());
    expect(unknownStatus.status).toBe(500);
    const missingDetails = await createCmsTaxonomyApp(
      deps({ actTerm: async () => portError(422, null as never) }),
    ).request(request());
    expect(missingDetails.status).toBe(422);
    expect(await readDetails(missingDetails)).toEqual({});
    const malformedViolations = await createCmsTaxonomyApp(
      deps({
        actTerm: async () =>
          portError(422, {
            violations: [null, { path: 'not-a-pointer', code: 'private' }],
          }),
      }),
    ).request(request());
    expect(malformedViolations.status).toBe(422);
    expect(await readDetails(malformedViolations)).toEqual({});
    const noViolations = await createCmsTaxonomyApp(
      deps({ actTerm: async () => portError(422, { violations: [] }) }),
    ).request(request());
    expect(await readDetails(noViolations)).toEqual({});
    const invalidRateDetails = await createCmsTaxonomyApp(
      deps({
        actTerm: async () =>
          portError(429, {
            retryAfterSeconds: -1,
            limit: 'secret',
            resetAt: 'secret',
          }),
      }),
    ).request(request());
    expect(invalidRateDetails.status).toBe(429);
    expect(await readDetails(invalidRateDetails)).toEqual({});
  });

  it('accepts a version-advanced non-create response without changing term identity', async () => {
    const rename = { ...body, action: 'rename' } as const;
    const response = await createCmsTaxonomyApp(
      deps({
        actTerm: async () => ({
          ok: true,
          value: { ...resource, version: '2' },
        }),
      }),
    ).request(request({ body: rename }));
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"2"');
  });

  it('aborts before rate or mutation if admission completes only after the deadline', async () => {
    vi.useFakeTimers();
    try {
      const rateLimit = vi.fn(deps().rateLimit);
      const actTerm = vi.fn(deps().actTerm);
      let notifySignal!: () => void;
      const signalCaptured = new Promise<void>((resolve) => {
        notifySignal = resolve;
      });
      const responsePromise = createCmsTaxonomyApp(
        deps({
          rateLimit,
          actTerm,
          resolveSession: async (_request, signal) => {
            notifySignal();
            return new Promise((resolve) =>
              signal.addEventListener('abort', () =>
                resolve({
                  ok: true,
                  value: {
                    userId: termId,
                    actingPartyId: taxonomyId,
                    capabilities: ['cms.taxonomy_curator'],
                    mfaFresh: true,
                  },
                }),
              ),
            );
          },
        }),
      ).request(request());
      await signalCaptured;
      await vi.advanceTimersByTimeAsync(15_000);
      expect((await responsePromise).status).toBe(504);
      await Promise.resolve();
      expect(rateLimit).not.toHaveBeenCalled();
      expect(actTerm).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns a safe internal error if unexpected execution fails and ignores telemetry failure', async () => {
    let nowCalls = 0;
    const internal = await createCmsTaxonomyApp(
      deps({
        now: () => {
          nowCalls += 1;
          if (nowCalls === 2) throw new Error('private clock failure');
          return 1_000;
        },
        rateLimit: async (input) => ({
          ok: true,
          value: {
            allowed: false,
            limit: input.limit,
            remaining: 0,
            resetAt: 2_000,
          },
        }),
      }),
    ).request(request());
    expect(internal.status).toBe(500);
    expect(await internal.text()).not.toContain('private clock failure');
    const successful = await createCmsTaxonomyApp(
      deps({
        telemetry: () => Promise.reject(new Error('private telemetry failure')),
      }),
    ).request(request());
    expect(successful.status).toBe(200);
  });
});
