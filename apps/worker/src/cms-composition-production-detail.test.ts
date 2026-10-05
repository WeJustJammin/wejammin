import type { TemplateVersionDetail } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createProductionCmsTemplateDependencies } from './cms-composition-production';
import { createTemplateDetailReader } from './cms-composition-production-detail';
import type { CmsTemplateDetailPortInput } from './cms-composition/template-routes';
import {
  environment,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from './cms-editorial-production.test-support';

const detail: TemplateVersionDetail = {
  id: '40000000-0000-4000-8000-000000000004',
  version: '2',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'draft',
  templateKey: 'profile-header',
  templateVersion: 2,
  compatibleTypeIds: ['30000000-0000-4000-8000-000000000003'],
  reservedRegions: ['header', 'now', 'record', 'detail', 'provenance'],
  blockRegistryDigest: 'b'.repeat(64),
  slots: [],
  bindings: {},
  locale: 'en-US',
  audience: 'public',
};
const input = (): CmsTemplateDetailPortInput => ({
  operationId: 'cmsTemplateLatestRead',
  request: new Request(
    'https://api.example.test/api/v1/cms/templates/profile-header',
    {
      headers: { 'x-correlation-id': REQUEST_ID },
    },
  ),
  requestId: REQUEST_ID,
  session: {
    userId: USER_ID,
    actingPartyId: PARTY_ID,
    capabilities: ['cms.template_designer'],
    mfaFresh: false,
  },
  templateKey: 'profile-header',
});
const compose = (fetchImpl: typeof fetch) =>
  createProductionCmsTemplateDependencies({
    environment,
    fetchImpl,
    humanOrigins: ['https://cms.example.test'],
    resolveSession: async () => ({ ok: true, value: input().session }),
  });

describe('CMS-11 protected latest-template production adapter', () => {
  it('labels current-read telemetry as a read rather than a template mutation', () => {
    const info = vi.fn();
    const dependencies = createProductionCmsTemplateDependencies({
      environment,
      fetchImpl: vi.fn(async () => Response.json(detail)) as typeof fetch,
      logger: { info } as never,
      humanOrigins: ['https://cms.example.test'],
      resolveSession: async () => ({ ok: true, value: input().session }),
    });
    dependencies.telemetry({
      operationId: 'cmsTemplateLatestRead',
      requestId: REQUEST_ID,
      status: 200,
      outcome: 'success',
      actorClass: 'human',
      durationMs: 1,
    });
    expect(info.mock.calls[0]?.[0]).toMatchObject({
      operation: 'cms.composition.template.read_latest',
    });
  });
  it('rejects invalid operation, key, and both missing authority cases before transport', async () => {
    const fetchImpl = vi.fn(async () => Response.json(detail));
    const dependencies = compose(fetchImpl as typeof fetch);
    const signal = new AbortController().signal;
    expect(
      await dependencies.readLatest(
        { ...input(), operationId: 'wrong' as 'cmsTemplateLatestRead' },
        signal,
      ),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      await dependencies.readLatest(
        { ...input(), templateKey: 'Bad_Key' },
        signal,
      ),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      await dependencies.readLatest(
        { ...input(), session: { ...input().session, actingPartyId: null } },
        signal,
      ),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      await dependencies.readLatest(
        { ...input(), session: { ...input().session, capabilities: [] } },
        signal,
      ),
    ).toMatchObject({ ok: false, status: 403 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects server context mismatch for either actor or acting party', async () => {
    const request = input().request;
    const contexts = new WeakMap();
    const server = {
      authUserId: USER_ID,
      sessionId: '60000000-0000-4000-8000-000000000006',
      actorPersonId: null,
      actingPartyId: PARTY_ID,
      stepUpAt: null,
    };
    const fetchImpl = vi.fn(async () => Response.json(detail));
    const read = createTemplateDetailReader(
      {
        baseUrl: 'https://supabase.example.test',
        secret: 'test',
        fetchImpl: fetchImpl as typeof fetch,
        maxResponseBytes: 16384,
        now: () => 0,
      },
      contexts,
      15000,
      16384,
    );
    contexts.set(request, {
      ...server,
      authUserId: '90000000-0000-4000-8000-000000000009',
    });
    expect(
      await read({ ...input(), request }, new AbortController().signal),
    ).toMatchObject({ ok: false, status: 401 });
    contexts.set(request, {
      ...server,
      actingPartyId: '90000000-0000-4000-8000-000000000009',
    });
    expect(
      await read({ ...input(), request }, new AbortController().signal),
    ).toMatchObject({ ok: false, status: 401 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('uses only the named RPC and server-derived acting context', async () => {
    const fetchImpl = vi.fn(async () => Response.json(detail));
    const dependencies = compose(fetchImpl as typeof fetch);
    const result = await dependencies.readLatest(
      input(),
      new AbortController().signal,
    );
    expect(result).toEqual({ ok: true, value: detail });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_template_latest',
    );
    expect(JSON.parse(String(init.body))).toMatchObject({
      p_request: {
        templateKey: 'profile-header',
        context: {
          authUserId: USER_ID,
          actingPartyId: PARTY_ID,
        },
      },
    });
  });

  it('blocks invalid authority before transport and malformed provider data after it', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ ...detail, ownerId: PARTY_ID }),
    );
    const dependencies = compose(fetchImpl as typeof fetch);
    expect(
      await dependencies.readLatest(
        { ...input(), session: { ...input().session, capabilities: [] } },
        new AbortController().signal,
      ),
    ).toMatchObject({ ok: false, status: 403 });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(
      await dependencies.readLatest(input(), new AbortController().signal),
    ).toMatchObject({ ok: false, status: 502 });
  });

  it('maps concealed not-found and transport failure without provider prose', async () => {
    const missing = compose(
      vi.fn(async () =>
        Response.json(
          { code: 'P0001', message: 'NOT_FOUND', details: 'private' },
          { status: 404 },
        ),
      ) as typeof fetch,
    );
    expect(
      await missing.readLatest(input(), new AbortController().signal),
    ).toMatchObject({ ok: false, status: 404 });
    const offline = compose(
      vi.fn(async () => {
        throw new Error('private');
      }) as typeof fetch,
    );
    expect(
      await offline.readLatest(input(), new AbortController().signal),
    ).toMatchObject({ ok: false, status: 503 });
  });

  it('rejects wrong-key and non-JSON provider bodies', async () => {
    const wrong = compose(
      vi.fn(async () =>
        Response.json({ ...detail, templateKey: 'other-template' }),
      ) as typeof fetch,
    );
    expect(
      await wrong.readLatest(input(), new AbortController().signal),
    ).toMatchObject({ ok: false, status: 502 });
    const nonJson = compose(
      vi.fn(async () => new Response('opaque')) as typeof fetch,
    );
    expect(
      await nonJson.readLatest(input(), new AbortController().signal),
    ).toMatchObject({ ok: false, status: 502 });
  });

  it.each([200, 404])(
    'terminates a stalled %i response body at the shared deadline',
    async (status) => {
      vi.useFakeTimers();
      try {
        const fetchImpl = vi.fn(
          async () =>
            new Response(new ReadableStream({ start() {} }), {
              status,
              headers: { 'content-type': 'application/json' },
            }),
        );
        const dependencies = createProductionCmsTemplateDependencies({
          environment,
          fetchImpl: fetchImpl as typeof fetch,
          deadlineMs: 100,
          humanOrigins: ['https://cms.example.test'],
          resolveSession: async () => ({ ok: true, value: input().session }),
        });
        const pending = dependencies.readLatest(
          input(),
          new AbortController().signal,
        );
        await vi.advanceTimersByTimeAsync(100);
        expect(await pending).toMatchObject({ ok: false, status: 504 });
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('scrubs unexpected body-reader failures', async () => {
    const broken = Response.json(detail);
    Object.defineProperty(broken, 'body', {
      get: () => {
        throw new Error('private');
      },
    });
    const dependencies = compose(vi.fn(async () => broken) as typeof fetch);
    expect(
      await dependencies.readLatest(input(), new AbortController().signal),
    ).toMatchObject({ ok: false, status: 503 });
  });
});
