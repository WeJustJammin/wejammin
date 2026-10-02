import { describe, expect, it, vi } from 'vitest';

import {
  EntryDraftDetailEtagSchema,
  type EntryDraftDetailResource,
} from '@wejammin/contracts';

import { executeCmsEditorialEntryDraftDetailRead } from '../../apps/web/src/components/cms-editorial/cms-editorial-entry-draft-detail-transport';
import { forwardCmsEditorialEntryDraftDetailRead } from '../../apps/web/src/server/cms-editorial-platform-reads';
import {
  createCmsEditorialApp,
  type CmsEditorialDependencies,
  type CmsEditorialDraftPortInput,
} from '../../apps/worker/src/cms-editorial';

const entryId = '30000000-0000-4000-8000-000000000003';
const revisionId = '40000000-0000-4000-8000-000000000004';
const instant = '2026-09-26T12:00:00.000Z';
const resource: EntryDraftDetailResource = {
  entry: {
    id: entryId,
    version: '3',
    createdAt: instant,
    updatedAt: instant,
  },
  revision: {
    id: revisionId,
    version: '1',
    createdAt: instant,
    updatedAt: instant,
  },
  lifecycle: 'active',
  state: 'draft',
  locale: 'en-US',
  contentHash: 'a'.repeat(64),
  validationState: 'valid',
  fields: [
    {
      fieldId: '50000000-0000-4000-8000-000000000005',
      fieldDefinitionId: '60000000-0000-4000-8000-000000000006',
      locale: 'en-US',
      value: 'Draft title',
      provenance: 'authored',
      valueHash: 'b'.repeat(64),
    },
  ],
  relations: [],
};

const appWith = (overrides: Partial<CmsEditorialDependencies> = {}) => {
  const getEntryDraft = vi.fn(
    async (_input: CmsEditorialDraftPortInput, _signal: AbortSignal) => {
      void _input;
      void _signal;
      return { ok: true as const, value: resource };
    },
  );
  const dependencies: CmsEditorialDependencies = {
    ports: {
      appendRevision: async () => ({
        ok: false,
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Unavailable.',
      }),
      getEntryDraft,
    },
    resolveSession: async () => ({
      ok: true,
      value: {
        userId: '10000000-0000-4000-8000-000000000001',
        actingPartyId: '20000000-0000-4000-8000-000000000002',
        capabilities: ['cms.author'],
        mfaFresh: true,
      },
    }),
    rateLimit: async () => ({
      ok: true,
      value: { allowed: true, limit: 300, remaining: 299, resetAt: 60_000 },
    }),
    humanOrigins: ['https://app.example.test'],
    now: () => 0,
    ...overrides,
  };
  return { app: createCmsEditorialApp(dependencies), getEntryDraft };
};

const throughBothReads = async (
  app: ReturnType<typeof createCmsEditorialApp>,
) => {
  let proxyStatus: number | null = null;
  let proxyEtag: string | null = null;
  let proxyCacheControl: string | null = null;
  let upstreamOrigin: string | null = null;
  const result = await executeCmsEditorialEntryDraftDetailRead({
    basePath: '/api/v1/cms/entries',
    entryId,
    fetcher: async (input, init) => {
      const request = new Request(
        `https://app.example.test${String(input)}`,
        init,
      );
      const response = await forwardCmsEditorialEntryDraftDetailRead(
        request,
        {
          fetch: (upstream: Request) => {
            upstreamOrigin = upstream.headers.get('origin');
            return app.fetch(upstream);
          },
        },
        entryId,
      );
      proxyStatus = response.status;
      proxyEtag = response.headers.get('etag');
      proxyCacheControl = response.headers.get('cache-control');
      return response;
    },
  });
  return { result, proxyStatus, proxyEtag, proxyCacheControl, upstreamOrigin };
};

describe('CMS-03B-11 local Worker → web proxy → browser read', () => {
  it('serves a first-party draft when the Worker allowlist contains the app origin, not an internal binding host', async () => {
    const { app, getEntryDraft } = appWith({
      humanOrigins: ['https://app.example.test'],
    });
    const { result, proxyStatus, upstreamOrigin } = await throughBothReads(app);

    expect(proxyStatus).toBe(200);
    expect(upstreamOrigin).toBeNull();
    expect(result).toMatchObject({
      outcome: 'success',
      status: 200,
      resource,
    });
    expect(getEntryDraft).toHaveBeenCalledTimes(1);
  });

  it('delivers the authorized canonical draft with the same composite ETag', async () => {
    const { app, getEntryDraft } = appWith();
    const { result, proxyStatus, proxyEtag, proxyCacheControl } =
      await throughBothReads(app);

    expect(proxyStatus).toBe(200);
    expect(proxyCacheControl).toBe('no-store');
    expect(EntryDraftDetailEtagSchema.safeParse(proxyEtag).success).toBe(true);
    expect(proxyEtag).toMatch(
      new RegExp(`^"${entryId}:3:${revisionId}:1:[a-f0-9]{64}"$`),
    );
    expect(result).toMatchObject({
      outcome: 'success',
      status: 200,
      retryable: false,
      resource,
      etag: proxyEtag,
    });
    expect(getEntryDraft).toHaveBeenCalledTimes(1);
    expect(getEntryDraft.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'CMS-03B-11',
      path: { entryId },
      query: { entryId },
    });
  });

  it('carries an authentication refusal without calling the draft port', async () => {
    const { app, getEntryDraft } = appWith({
      resolveSession: async () => ({
        ok: false,
        status: 401,
        code: 'UNAUTHENTICATED',
        message: 'Sign in is required.',
      }),
    });
    const { result, proxyStatus, proxyEtag } = await throughBothReads(app);

    expect(proxyStatus).toBe(401);
    expect(proxyEtag).toBeNull();
    expect(result.outcome).toBe('unauthenticated');
    expect(result.resource).toBeNull();
    expect(result.etag).toBeNull();
    expect(getEntryDraft).not.toHaveBeenCalled();
  });

  it('never asks the draft port for values when the principal has no CMS read capability', async () => {
    const { app, getEntryDraft } = appWith({
      resolveSession: async () => ({
        ok: true,
        value: {
          userId: '10000000-0000-4000-8000-000000000001',
          actingPartyId: '20000000-0000-4000-8000-000000000002',
          capabilities: [],
          mfaFresh: true,
        },
      }),
    });
    const { result, proxyStatus, proxyEtag } = await throughBothReads(app);

    expect(proxyStatus).toBe(403);
    expect(proxyEtag).toBeNull();
    expect(result.outcome).toBe('forbidden');
    expect(result.resource).toBeNull();
    expect(result.etag).toBeNull();
    expect(getEntryDraft).not.toHaveBeenCalled();
  });
});
