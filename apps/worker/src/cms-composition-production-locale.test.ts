import { describe, expect, it, vi } from 'vitest';

import { createProductionCmsLocaleDependencies } from './cms-composition-production-locale';
import type { CmsLocalePortInput } from './cms-composition/locale-routes';
import {
  environment,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from './cms-editorial-production.test-support';

const entryId = 'd2000000-0000-4000-8000-000000000001';
const sourceRevisionId = 'd2000000-0000-4000-8000-000000000002';
const revisionId = 'd2000000-0000-4000-8000-000000000003';
const variantId = 'd2000000-0000-4000-8000-000000000004';
const fieldId = 'd2000000-0000-4000-8000-000000000005';
const input = (): CmsLocalePortInput => ({
  operationId: 'CMS-03C-04',
  request: new Request(
    `https://api.example.test/api/v1/cms/entries/${entryId}/locales/fr-FR/variants`,
    {
      headers: { 'x-correlation-id': REQUEST_ID },
    },
  ),
  requestId: REQUEST_ID,
  session: {
    userId: USER_ID,
    actingPartyId: PARTY_ID,
    capabilities: ['cms.author'],
    mfaFresh: false,
  },
  path: { entryId, locale: 'fr-FR' },
  body: {
    entryId,
    locale: 'fr-FR',
    sourceRevisionId,
    fields: [{ fieldId, value: 'Titre traduit' }],
    fallbackChain: ['en-US'],
    noFallbackFieldIds: [],
    sourceHash: 'a'.repeat(64),
    expectedVersion: '1',
  },
  idempotencyKey: 'locale-command-0001',
  ifMatch: '1',
});
const resource = {
  id: variantId,
  version: '1',
  contentHash: 'b'.repeat(64),
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'draft',
  entryId,
  revisionId,
  locale: 'fr-FR',
  sourceRevisionId,
  fallbackChain: ['en-US'],
  noFallbackFieldIds: [],
};
const create = (fetchImpl: typeof fetch) =>
  createProductionCmsLocaleDependencies({
    environment,
    fetchImpl,
    humanOrigins: ['https://cms.example.test'],
    resolveSession: async () => ({ ok: true, value: input().session }),
  });

describe('CMS-03C-04 production locale adapter', () => {
  it('calls only the named server RPC with server-bound context', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify(resource), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const result = await create(fetchImpl as typeof fetch).authorLocale(
      input(),
      new AbortController().signal,
    );
    expect(result).toEqual({ ok: true, value: resource });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_author_locale_variant',
    );
    expect(init.method).toBe('POST');
    const sent = JSON.parse(String(init.body));
    expect(sent.p_request).toMatchObject({
      ...input().body,
      idempotencyKey: 'locale-command-0001',
      ifMatch: '1',
      context: { authUserId: USER_ID, actingPartyId: PARTY_ID },
    });
    expect(sent.p_request).not.toHaveProperty('ownerId');
    expect((init.headers as Record<string, string>)['X-Operation-Id']).toBe(
      'CMS-03C-04',
    );
  });

  it('rejects path/body mismatch and malformed RPC success before returning it', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ ...resource, ownerId: PARTY_ID }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const dependencies = create(fetchImpl as typeof fetch);
    const mismatched = await dependencies.authorLocale(
      { ...input(), path: { entryId, locale: 'de-DE' } },
      new AbortController().signal,
    );
    expect(mismatched).toMatchObject({ ok: false, status: 400 });
    expect(fetchImpl).not.toHaveBeenCalled();
    const malformed = await dependencies.authorLocale(
      input(),
      new AbortController().signal,
    );
    expect(malformed).toMatchObject({ ok: false, status: 502 });
  });

  it('rejects malformed commands, headers, authority and acting context before transport', async () => {
    const fetchImpl = vi.fn(async () => Response.json(resource));
    const dependencies = create(fetchImpl as typeof fetch);
    const bad: Array<[CmsLocalePortInput, number]> = [
      [{ ...input(), operationId: 'wrong' as never }, 400],
      [{ ...input(), path: { entryId: 'invalid', locale: 'fr-FR' } }, 400],
      [{ ...input(), idempotencyKey: 'short' }, 400],
      [{ ...input(), body: { ...input().body, sourceHash: 'invalid' } }, 422],
      [{ ...input(), body: { ...input().body, entryId: variantId } }, 400],
      [{ ...input(), body: { ...input().body, locale: 'de-DE' } }, 400],
      [{ ...input(), body: { ...input().body, expectedVersion: '2' } }, 400],
      [
        { ...input(), session: { ...input().session, actingPartyId: null } },
        403,
      ],
      [{ ...input(), session: { ...input().session, capabilities: [] } }, 403],
    ];
    for (const [candidate, status] of bad) {
      expect(
        await dependencies.authorLocale(
          candidate,
          new AbortController().signal,
        ),
      ).toMatchObject({ ok: false, status });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    const editor = await dependencies.authorLocale(
      {
        ...input(),
        session: { ...input().session, capabilities: ['cms.editor'] },
      },
      new AbortController().signal,
    );
    expect(editor).toMatchObject({ ok: true });
  });

  it('rejects invalid production configuration and supports configured origins', () => {
    for (const overrides of [
      { deadlineMs: 0 },
      { deadlineMs: 15_001 },
      { deadlineMs: 1.5 },
      { maxResponseBytes: 0 },
      { maxResponseBytes: 1.5 },
    ]) {
      expect(() =>
        createProductionCmsLocaleDependencies({
          environment,
          fetchImpl: vi.fn() as typeof fetch,
          ...overrides,
        }),
      ).toThrow('Invalid CMS locale production configuration');
    }
    expect(
      createProductionCmsLocaleDependencies({ environment }).humanOrigins,
    ).toEqual([]);
  });

  it('pins the resolved server identity even when an input claims another user', async () => {
    const fetchImpl = vi.fn(async () => Response.json(resource));
    const dependencies = createProductionCmsLocaleDependencies({
      environment,
      fetchImpl: fetchImpl as typeof fetch,
      now: () => Date.parse('2026-09-27T12:00:00Z'),
      auth: {
        resolveSession: async () => ({
          ok: true,
          value: {
            authUserId: USER_ID,
            sessionId: '60000000-0000-4000-8000-000000000006',
            accountState: 'active',
            personId: '70000000-0000-4000-8000-000000000007',
            actingPartyId: PARTY_ID,
            expiresAt: '2026-09-27T13:00:00Z',
            stepUpAt: null,
          },
        }),
      },
      resolveCapabilities: ['cms.author'],
    });
    const original = input();
    const resolved = await dependencies.resolveSession(
      original.request,
      new AbortController().signal,
    );
    expect(resolved.ok).toBe(true);
    const denied = await dependencies.authorLocale(
      {
        ...original,
        session: { ...original.session, userId: variantId },
      },
      new AbortController().signal,
    );
    expect(denied).toMatchObject({ ok: false, status: 401 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps failed fetches, RPC refusals, malformed bodies and provider exceptions', async () => {
    const cases: Array<[typeof fetch, number]> = [
      [
        vi.fn(async () => {
          throw new Error('provider internal');
        }) as typeof fetch,
        503,
      ],
      [
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({ code: 'P0001', message: 'VERSION_MISMATCH' }),
              {
                status: 400,
                headers: { 'content-type': 'application/json' },
              },
            ),
        ) as typeof fetch,
        409,
      ],
      [
        vi.fn(
          async () =>
            new Response('not-json', {
              status: 200,
              headers: { 'content-type': 'text/plain' },
            }),
        ) as typeof fetch,
        502,
      ],
      [
        vi.fn(
          async () =>
            new Response('{', {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
        ) as typeof fetch,
        502,
      ],
      [
        vi.fn(
          async () =>
            new Proxy(Response.json(resource), {
              get(target, property, receiver) {
                if (property === 'headers')
                  throw new Error('provider private header');
                return Reflect.get(target, property, receiver);
              },
            }),
        ) as typeof fetch,
        503,
      ],
    ];
    for (const [fetchImpl, status] of cases) {
      const result = await create(fetchImpl).authorLocale(
        input(),
        new AbortController().signal,
      );
      expect(result).toMatchObject({ ok: false, status });
      expect(JSON.stringify(result)).not.toContain('provider private');
    }
  });

  it('maps port refusals to exact locked CMS-03C-04 catalog codes', async () => {
    const catalogCases: Array<[string, number, string]> = [
      ['NOT_FOUND', 404, 'LOCALE_SOURCE_NOT_FOUND'],
      ['FORBIDDEN', 403, 'LOCALE_FORBIDDEN'],
      ['VERSION_MISMATCH', 409, 'LOCALE_VERSION_CONFLICT'],
      ['VALIDATION_FAILED', 422, 'LOCALE_VALIDATION_FAILED'],
    ];
    for (const [token, status, code] of catalogCases) {
      const fetchImpl = vi.fn(
        async () =>
          new Response(JSON.stringify({ code: 'P0001', message: token }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          }),
      );
      const result = await create(fetchImpl as typeof fetch).authorLocale(
        input(),
        new AbortController().signal,
      );
      expect(result).toMatchObject({ ok: false, status, code });
      expect((result as { code: string }).code).not.toBe(token);
    }
    const uncapable = await create(
      vi.fn(async () => Response.json(resource)) as typeof fetch,
    ).authorLocale(
      { ...input(), session: { ...input().session, capabilities: [] } },
      new AbortController().signal,
    );
    expect(uncapable).toMatchObject({
      ok: false,
      status: 403,
      code: 'LOCALE_FORBIDDEN',
    });
    const providerRefusal = await create(
      vi.fn(
        async () =>
          new Response(JSON.stringify({ code: 'P0001', message: 'X_NOPE' }), {
            status: 503,
            headers: { 'content-type': 'application/json' },
          }),
      ) as typeof fetch,
    ).authorLocale(input(), new AbortController().signal);
    expect(providerRefusal).toMatchObject({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
    const malformedProvider = await create(
      vi.fn(
        async () =>
          new Response('not-json', {
            status: 200,
            headers: { 'content-type': 'text/plain' },
          }),
      ) as typeof fetch,
    ).authorLocale(input(), new AbortController().signal);
    expect(malformedProvider).toMatchObject({
      ok: false,
      status: 502,
      code: 'BAD_GATEWAY',
    });
  });

  it('emits scrubbed telemetry for every outcome class', async () => {
    const dependencies = create(
      vi.fn(async () => Response.json(resource)) as typeof fetch,
    );
    for (const outcome of ['success', 'failure', 'rejected'] as const) {
      await expect(
        Promise.resolve(
          dependencies.telemetry({
            operationId: 'CMS-03C-04',
            requestId: REQUEST_ID,
            status: outcome === 'success' ? 201 : 503,
            outcome,
            actorClass: 'human',
            durationMs: 3,
          }),
        ),
      ).resolves.toBeUndefined();
    }
  });

  it('distinguishes an expired error body and an expired success body', async () => {
    vi.useFakeTimers();
    try {
      for (const status of [409, 200]) {
        const fetchImpl = vi.fn(
          async () =>
            new Response(
              new ReadableStream({
                start: () => undefined,
              }),
              { status, headers: { 'content-type': 'application/json' } },
            ),
        );
        const pending = createProductionCmsLocaleDependencies({
          environment,
          fetchImpl: fetchImpl as typeof fetch,
          deadlineMs: 1,
          resolveSession: async () => ({ ok: true, value: input().session }),
        }).authorLocale(input(), new AbortController().signal);
        await vi.advanceTimersByTimeAsync(2);
        expect(await pending).toMatchObject({ ok: false, status: 504 });
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
