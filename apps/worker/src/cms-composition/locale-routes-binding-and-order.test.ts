import { describe, expect, it, vi } from 'vitest';
import {
  createCmsLocaleApp,
  type CmsLocaleDependencies,
} from './locale-routes';
import {
  entryId,
  sourceRevisionId,
  revisionId,
  fieldId,
  origin,
  path,
  body,
  resource,
  request,
  deps,
} from './locale-routes.test-support';
import {
  httpAdapter,
  httpFresh,
  httpRequest,
  registerOrderTests,
  standardMutationSteps,
  type HttpState,
} from '../be00-order.test-support';
import { headersBeforeAuthorization } from '../be00-header-order.test-support';

describe('CMS-03C-04 locale authoring route', () => {
  it('publishes the BE00 429 contract with second-granularity reset and matching headers', async () => {
    const response = await createCmsLocaleApp(
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

  it('does not accept success for another state, entry, locale, source or fallback', async () => {
    const wrong = [
      { ...resource, state: 'approved' },
      { ...resource, entryId: sourceRevisionId },
      { ...resource, locale: 'de-DE' },
      { ...resource, sourceRevisionId: revisionId },
      { ...resource, fallbackChain: [] },
      { ...resource, noFallbackFieldIds: [fieldId] },
    ];
    for (const value of wrong) {
      const response = await createCmsLocaleApp(
        deps({
          authorLocale: async () => ({ ok: true, value: value as never }),
        }),
      ).request(request());
      expect(response.status).toBe(502);
    }
  });

  it('[P2-S09-AC-1166] hands the per-variant no_fallback set to the authoring port and returns the stored set', async () => {
    const requested = { ...body, noFallbackFieldIds: [fieldId] };
    const stored = { ...resource, noFallbackFieldIds: [fieldId] };
    const authorLocale = vi.fn(async () => ({
      ok: true as const,
      value: stored,
    }));
    const response = await createCmsLocaleApp(deps({ authorLocale })).request(
      request({ body: requested }),
    );
    expect(response.status).toBe(201);
    const calls = authorLocale.mock.calls as unknown as Array<
      [{ body: { noFallbackFieldIds: string[] } }]
    >;
    expect(calls[0]?.[0].body.noFallbackFieldIds).toEqual([fieldId]);
    expect(
      ((await response.json()) as { noFallbackFieldIds: string[] })
        .noFallbackFieldIds,
    ).toEqual([fieldId]);
  });

  it('[P2-S09-AC-1166] refuses a success whose stored no_fallback set differs from the requested one in either direction', async () => {
    const cases = [
      { requested: [fieldId], stored: [] },
      { requested: [], stored: [fieldId] },
    ];
    for (const { requested, stored } of cases) {
      const response = await createCmsLocaleApp(
        deps({
          authorLocale: async () => ({
            ok: true,
            value: { ...resource, noFallbackFieldIds: stored },
          }),
        }),
      ).request(request({ body: { ...body, noFallbackFieldIds: requested } }));
      expect(response.status).toBe(502);
    }
  });

  it('[P2-S09-AC-1166] refuses a duplicated or non-UUID no_fallback member with 422 before persistence', async () => {
    const statuses: number[] = [];
    for (const noFallbackFieldIds of [[fieldId, fieldId], ['not-a-uuid']]) {
      const authorLocale = vi.fn();
      const response = await createCmsLocaleApp(
        deps({ authorLocale: authorLocale as never }),
      ).request(request({ body: { ...body, noFallbackFieldIds } }));
      statuses.push(response.status);
      expect(authorLocale).not.toHaveBeenCalled();
    }
    expect(statuses).toEqual([422, 422]);
  });

  it('fences rejected ports, thrown ports, and a deadline without provider prose', async () => {
    for (const authorLocale of [
      async () => {
        throw new Error('private provider prose');
      },
      async () => null as never,
      async () => ({ ok: false, status: 599 }) as never,
      async () => ({ ok: true }) as never,
    ]) {
      const response = await createCmsLocaleApp(deps({ authorLocale })).request(
        request(),
      );
      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(JSON.stringify(await response.json())).not.toContain(
        'private provider prose',
      );
    }
    vi.useFakeTimers();
    try {
      const pending = createCmsLocaleApp(
        deps({
          resolveSession: async () => new Promise(() => undefined),
        }),
      ).request(request());
      await vi.advanceTimersByTimeAsync(15_000);
      const response = await pending;
      expect(response.status).toBe(504);
    } finally {
      vi.useRealTimers();
    }
  });

  it('handles an abort between rate buckets and telemetry failures after response', async () => {
    vi.useFakeTimers();
    try {
      const pending = createCmsLocaleApp(
        deps({
          rateLimit: async (input) => {
            await new Promise((resolve) => setTimeout(resolve, 15_001));
            return {
              ok: true,
              value: {
                allowed: true,
                limit: input.limit,
                remaining: input.limit - 1,
                resetAt: 20_000,
              },
            };
          },
        }),
      ).request(request());
      await vi.advanceTimersByTimeAsync(15_001);
      expect((await pending).status).toBe(504);
    } finally {
      vi.useRealTimers();
    }
    const telemetry = vi.fn(async () => {
      throw new Error('telemetry is down');
    });
    const response = await createCmsLocaleApp(deps({ telemetry })).request(
      request(),
    );
    expect(response.status).toBe(201);
    expect(telemetry).toHaveBeenCalledOnce();
    const throwingTelemetry = await createCmsLocaleApp(
      deps({
        telemetry: () => {
          throw new Error('sync telemetry');
        },
      }),
    ).request(request());
    expect(throwingTelemetry.status).toBe(201);
  });

  it('normalizes unexpected execution exceptions to a scrubbed 500', async () => {
    const response = await createCmsLocaleApp(
      deps({
        resolveSession: async () => ({
          ok: true,
          value: {
            userId: entryId,
            actingPartyId: sourceRevisionId,
            get capabilities(): readonly string[] {
              throw new Error('private session value');
            },
            mfaFresh: true,
          },
        }),
      }),
    ).request(request());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain(
      'private session value',
    );
  });
});

describe('BE00 middleware order on the CMS locale authoring route', () => {
  const overridesFor = (state: HttpState): Partial<CmsLocaleDependencies> => ({
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
              userId: 'd1000000-0000-4000-8000-000000000006',
              actingPartyId: 'd1000000-0000-4000-8000-000000000007',
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
    family: 'cms-locale',
    fresh: () =>
      httpFresh(path, body, {
        origin,
        'content-type': 'application/json',
        'idempotency-key': 'locale-command-0001',
        'if-match': '"1"',
      }),
    steps: headersBeforeAuthorization(
      standardMutationSteps(
        httpAdapter({
          codes: {
            forbidden: 'LOCALE_FORBIDDEN',
            badRequest: 'INVALID_REQUEST',
            unauthenticated: 'UNAUTHENTICATED',
            validation: 'LOCALE_VALIDATION_FAILED',
            rateLimited: 'RATE_LIMITED',
          },
          oversize: { status: 400, code: 'INVALID_REQUEST' },
          badPath: `/api/v1/cms/entries/not-a-uuid/locales/fr-FR/variants`,
          badBody: {},
        }),
      ),
    ),
    send: (state) =>
      Promise.resolve(
        createCmsLocaleApp(deps(overridesFor(state))).request(
          httpRequest(state, 'https://api.example.test'),
        ),
      ),
    accepted: (response) => expect(response.status).toBe(201),
  });
});

describe('BE00 step 2 body ceiling on the CMS locale route', () => {
  it('refuses a streamed body over the ceiling that declared no length', async () => {
    const authorLocale = vi.fn(deps().authorLocale);
    const response = await createCmsLocaleApp(deps({ authorLocale })).request(
      request({ body: { ...body, pad: 'x'.repeat(300_000) } }),
    );
    expect(response.status).toBe(400);
    expect(authorLocale).not.toHaveBeenCalled();
  });
});
