import { describe, expect, it, vi } from 'vitest';

import {
  environment,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from './cms-editorial-production.test-support';
import {
  authenticationSession,
  NOW,
} from './cms-editorial-production-session-test-support';
import { createProductionCmsPatternInstanceDependencies } from './cms-composition-production-pattern';
import type { CmsPatternInstancePortInput } from './cms-composition/pattern-instance-routes';

const revisionId = 'd2000000-0000-4000-8000-000000000011';
const patternId = 'd2000000-0000-4000-8000-000000000012';
const instanceId = 'd2000000-0000-4000-8000-000000000013';
const input = (): CmsPatternInstancePortInput => ({
  operationId: 'CMS-03C-02',
  request: new Request(
    'https://api.example.test/api/v1/cms/compositions/pattern-instances',
    { headers: { 'x-correlation-id': REQUEST_ID } },
  ),
  requestId: REQUEST_ID,
  session: {
    userId: USER_ID,
    actingPartyId: PARTY_ID,
    capabilities: ['cms.author'],
    mfaFresh: false,
  },
  body: {
    revisionId,
    patternId,
    patternVersion: 1,
    linkMode: 'linked',
    slotPath: '/primary',
    overrides: {},
    expectedVersion: '1',
  },
  idempotencyKey: 'pattern-command-0001',
  ifMatch: '1',
});
const resource = {
  id: instanceId,
  version: '1',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-28T14:00:00Z',
  updatedAt: '2026-09-28T14:00:00Z',
  state: 'draft',
  revisionId,
  path: '/primary',
  blockKey: 'profile.header',
  blockVersion: 1,
  patternId,
  patternVersion: 1,
  blockRegistryDigest: 'b'.repeat(64),
  linkMode: 'linked',
  conflictState: 'none',
};
const create = (fetchImpl: typeof fetch) =>
  createProductionCmsPatternInstanceDependencies({
    environment,
    fetchImpl,
    humanOrigins: ['https://cms.example.test'],
    resolveSession: async () => ({ ok: true, value: input().session }),
  });

describe('CMS-03C-02 production pattern adapter', () => {
  it('calls only the named private RPC with server-bound context', async () => {
    const fetchImpl = vi.fn(async () => Response.json(resource));
    const result = await create(fetchImpl as typeof fetch).insertPattern(
      input(),
      new AbortController().signal,
    );
    expect(result).toEqual({ ok: true, value: resource });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_insert_pattern_instance',
    );
    expect(init.method).toBe('POST');
    const sent = JSON.parse(String(init.body));
    expect(sent.p_request).toMatchObject({
      ...input().body,
      idempotencyKey: 'pattern-command-0001',
      ifMatch: '1',
      context: { authUserId: USER_ID, actingPartyId: PARTY_ID },
    });
    expect(sent.p_request).not.toHaveProperty('ownerId');
    expect((init.headers as Record<string, string>)['X-Operation-Id']).toBe(
      'CMS-03C-02',
    );
  });

  it('rejects malformed request, authority and provider success before disclosure', async () => {
    const fetchImpl = vi.fn(async () => Response.json(resource));
    const dependencies = create(fetchImpl as typeof fetch);
    for (const [candidate, status] of [
      [{ ...input(), operationId: 'wrong' as never }, 400],
      [{ ...input(), body: { ...input().body, patternVersion: 0 } }, 422],
      [{ ...input(), ifMatch: '2' }, 400],
      [{ ...input(), idempotencyKey: 'short' }, 400],
      [{ ...input(), session: { ...input().session, capabilities: [] } }, 403],
    ] as const)
      expect(
        await dependencies.insertPattern(
          candidate,
          new AbortController().signal,
        ),
      ).toMatchObject({ ok: false, status });
    expect(fetchImpl).not.toHaveBeenCalled();

    const malformed = create(
      vi.fn(async () =>
        Response.json({ ...resource, ownerId: PARTY_ID }),
      ) as typeof fetch,
    );
    expect(
      await malformed.insertPattern(input(), new AbortController().signal),
    ).toMatchObject({ ok: false, status: 502 });
  });

  it('treats a missing private RPC as unavailable rather than a hidden composition', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        {
          code: 'PGRST202',
          message:
            'Could not find the function platform_api.cms_insert_pattern_instance',
        },
        { status: 404 },
      ),
    );
    const result = await create(fetchImpl as typeof fetch).insertPattern(
      input(),
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      details: { dependencyClass: 'cms_composition', retryable: true },
    });
    expect(JSON.stringify(result)).not.toContain('Could not find');
  });

  it('validates production configuration and supports configured origins without an injected fetch', () => {
    const options = {
      environment,
      fetchImpl: vi.fn(async () => Response.json(resource)) as typeof fetch,
      humanOrigins: ['https://cms.example.test'],
    };
    expect(() =>
      createProductionCmsPatternInstanceDependencies({
        ...options,
        deadlineMs: 0,
      }),
    ).toThrow();
    expect(() =>
      createProductionCmsPatternInstanceDependencies({
        ...options,
        maxResponseBytes: 0,
      }),
    ).toThrow();
    const configured = createProductionCmsPatternInstanceDependencies({
      environment: {
        ...environment,
        CMS_HUMAN_ORIGINS: 'https://cms.example.test',
      },
      resolveSession: async () => ({ ok: true, value: input().session }),
    });
    expect(configured.humanOrigins).toContain('https://cms.example.test');
  });

  it('isolates the cached server context from a later caller session and permits editor role', async () => {
    const fetchImpl = vi.fn(async () => Response.json(resource));
    const dependencies = createProductionCmsPatternInstanceDependencies({
      environment,
      fetchImpl: fetchImpl as typeof fetch,
      humanOrigins: ['https://cms.example.test'],
      now: () => NOW,
      auth: {
        resolveSession: (async () => ({
          ok: true,
          value: authenticationSession(),
        })) as never,
      },
      resolveCapabilities: ['cms.author'],
    });
    const first = input();
    const resolved = await dependencies.resolveSession(
      first.request,
      new AbortController().signal,
    );
    expect(resolved).toMatchObject({ ok: true });
    expect(
      await dependencies.insertPattern(
        {
          ...first,
          session: {
            ...first.session,
            userId: 'd2000000-0000-4000-8000-000000000099',
          },
        },
        new AbortController().signal,
      ),
    ).toMatchObject({ ok: false, status: 401 });
    expect(
      await create(fetchImpl as typeof fetch).insertPattern(
        {
          ...input(),
          session: { ...input().session, capabilities: ['cms.editor'] },
        },
        new AbortController().signal,
      ),
    ).toMatchObject({ ok: true });
  });

  it('maps private domain failures and transport failures without exposing provider content', async () => {
    for (const [response, expectedStatus, expectedCode] of [
      [
        Response.json(
          { code: 'NOT_FOUND', message: 'private' },
          { status: 404 },
        ),
        404,
        'COMPOSITION_NOT_FOUND',
      ],
      [
        Response.json(
          { code: 'VERSION_MISMATCH', message: 'private' },
          { status: 409 },
        ),
        409,
        'COMPOSITION_VERSION_CONFLICT',
      ],
      [
        Response.json(
          { code: 'VALIDATION_FAILED', message: 'private' },
          { status: 422 },
        ),
        422,
        'COMPOSITION_VALIDATION_FAILED',
      ],
      [
        Response.json(
          { code: 'RATE_LIMITED', message: 'private' },
          { status: 429 },
        ),
        429,
        'RATE_LIMITED',
      ],
      [
        Response.json({ code: 'OTHER', message: 'private' }, { status: 500 }),
        503,
        'DEPENDENCY_UNAVAILABLE',
      ],
      [
        new Response('{', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
        502,
        'BAD_GATEWAY',
      ],
    ] as const) {
      const result = await create(
        vi.fn(async () => response) as typeof fetch,
      ).insertPattern(input(), new AbortController().signal);
      expect(result).toMatchObject({
        ok: false,
        status: expectedStatus,
        code: expectedCode,
      });
      expect(JSON.stringify(result)).not.toContain('private');
    }
    expect(
      await create(
        vi.fn(async () => {
          throw new Error('private');
        }) as typeof fetch,
      ).insertPattern(input(), new AbortController().signal),
    ).toMatchObject({ ok: false, status: 503 });
    expect(
      await create(
        vi.fn(async () => ({ bad: true })) as unknown as typeof fetch,
      ).insertPattern(input(), new AbortController().signal),
    ).toMatchObject({ ok: false, status: 503 });
  });

  it('applies the total deadline to both private error and success body reads', async () => {
    for (const status of [200, 409]) {
      const fetchImpl = vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              pull() {
                /* intentionally stalled */
              },
            }),
            {
              status,
              headers: { 'content-type': 'application/json' },
            },
          ),
      );
      const dependencies = createProductionCmsPatternInstanceDependencies({
        environment,
        fetchImpl: fetchImpl as typeof fetch,
        humanOrigins: ['https://cms.example.test'],
        resolveSession: async () => ({ ok: true, value: input().session }),
        deadlineMs: 10,
      });
      const result = await dependencies.insertPattern(
        input(),
        new AbortController().signal,
      );
      expect(result).toMatchObject({ ok: false, status: 504 });
    }
  });

  it('emits a redacted operational telemetry event', () => {
    const logger = { info: vi.fn() };
    const dependencies = createProductionCmsPatternInstanceDependencies({
      environment,
      fetchImpl: vi.fn(async () => Response.json(resource)) as typeof fetch,
      humanOrigins: ['https://cms.example.test'],
      resolveSession: async () => ({ ok: true, value: input().session }),
      logger: logger as never,
    });
    dependencies.telemetry({
      operationId: 'CMS-03C-02',
      requestId: REQUEST_ID,
      status: 503,
      outcome: 'failure',
      actorClass: 'human',
      durationMs: 8,
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'cms.composition.pattern.request',
        requestId: REQUEST_ID,
      }),
      { samplingClass: 'always', highRisk: true },
    );
  });
});
