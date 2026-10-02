import { describe, expect, it, vi } from 'vitest';

import { createProductionCmsTemplateDependencies } from './cms-composition-production';
import {
  compose,
  environment,
  input,
  json,
  PARTY_ID,
  REQUEST_ID,
  TEMPLATE_ID,
  TYPE_ID,
  USER_ID,
} from './cms-composition-production.test-support';

describe('CMS-03C-01 production template adapter', () => {
  it('reads only the named protected context RPC with server-derived identity', async () => {
    const context = {
      contentTypes: [
        {
          id: TYPE_ID,
          typeKey: 'profile',
          activeVersionId: TEMPLATE_ID,
          activeVersion: 1,
          sourceLocale: 'en-US',
        },
      ],
      registeredBlocks: [],
    };
    const fetchImpl = vi.fn(async () => json(context));
    const dependencies = compose(fetchImpl as typeof fetch);
    const portInput = input();
    const result = await dependencies.readContext(
      { ...portInput, operationId: 'cmsTemplateContextRead' },
      new AbortController().signal,
    );
    expect(result).toEqual({ ok: true, value: context });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_template_context',
    );
    expect(JSON.parse(String(init.body))).toMatchObject({
      p_request: { context: { authUserId: USER_ID, actingPartyId: PARTY_ID } },
    });
    expect(JSON.parse(String(init.body)).p_request).not.toHaveProperty(
      'templateKey',
    );
    const rejected = await dependencies.readContext(
      {
        ...portInput,
        operationId: 'cmsTemplateContextRead',
        session: { ...portInput.session, capabilities: [] },
      },
      new AbortController().signal,
    );
    expect(rejected).toMatchObject({ ok: false, status: 403 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await dependencies.telemetry({
      operationId: 'cmsTemplateContextRead',
      requestId: REQUEST_ID,
      status: 200,
      outcome: 'success',
      actorClass: 'human',
      durationMs: 1,
    });
  });

  it('rejects invalid context operation and mismatched verified session before transport', async () => {
    const fetchImpl = vi.fn(async () =>
      json({ contentTypes: [], registeredBlocks: [] }),
    );
    const dependencies = compose(fetchImpl as typeof fetch);
    const portInput = {
      operationId: 'cmsTemplateContextRead' as const,
      request: input().request,
      requestId: REQUEST_ID,
      session: input().session,
    };
    expect(
      await dependencies.readContext(
        { ...portInput, operationId: 'wrong' as 'cmsTemplateContextRead' },
        new AbortController().signal,
      ),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      await dependencies.readContext(
        {
          ...portInput,
          session: { ...portInput.session, actingPartyId: null },
        },
        new AbortController().signal,
      ),
    ).toMatchObject({ ok: false, status: 403 });
    expect(fetchImpl).not.toHaveBeenCalled();

    const verified = createProductionCmsTemplateDependencies({
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
      resolveCapabilities: ['cms.template_designer'],
    });
    const req = input().request;
    const resolved = await verified.resolveSession(
      req,
      new AbortController().signal,
    );
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(
      await verified.readContext(
        {
          ...portInput,
          request: req,
          session: {
            ...resolved.value,
            userId: '80000000-0000-4000-8000-000000000008',
          },
        },
        new AbortController().signal,
      ),
    ).toMatchObject({ ok: false, status: 401 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps context RPC denial and refuses malformed or unavailable projections', async () => {
    const portInput = {
      ...input(),
      operationId: 'cmsTemplateContextRead' as const,
    };
    const signal = new AbortController().signal;
    const denied = await compose(
      vi.fn(async () =>
        json({ code: 'P0001', message: 'FORBIDDEN' }, 400),
      ) as typeof fetch,
    ).readContext(portInput, signal);
    expect(denied).toMatchObject({ ok: false, status: 403 });
    const malformed = await compose(
      vi.fn(async () =>
        json({ contentTypes: [], registeredBlocks: [], ownerId: PARTY_ID }),
      ) as typeof fetch,
    ).readContext(portInput, signal);
    expect(malformed).toMatchObject({ ok: false, status: 502 });
    const invalidJson = await compose(
      vi.fn(
        async () =>
          new Response('<private>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
      ) as typeof fetch,
    ).readContext(portInput, signal);
    expect(invalidJson).toMatchObject({ ok: false, status: 502 });
    const offline = await compose(
      vi.fn(async () => {
        throw new Error('private');
      }) as typeof fetch,
    ).readContext(portInput, signal);
    expect(offline).toMatchObject({ ok: false, status: 503 });
    const controller = new AbortController();
    controller.abort();
    expect(
      await compose(vi.fn() as typeof fetch).readContext(
        portInput,
        controller.signal,
      ),
    ).toMatchObject({ ok: false, status: 504 });
    const malformedTransport = await compose(
      vi.fn(async () => undefined) as unknown as typeof fetch,
    ).readContext(portInput, signal);
    expect(malformedTransport).toMatchObject({ ok: false, status: 503 });
  });

  it.each([200, 400])(
    'bounds a stalled context RPC body at status %i',
    async (status) => {
      vi.useFakeTimers();
      try {
        const fetchImpl = vi.fn(
          async () =>
            new Response(new ReadableStream({ pull: () => undefined }), {
              status,
              headers: { 'content-type': 'application/json' },
            }),
        );
        const dependencies = createProductionCmsTemplateDependencies({
          environment,
          fetchImpl: fetchImpl as typeof fetch,
          deadlineMs: 20,
        });
        const pending = dependencies.readContext(
          { ...input(), operationId: 'cmsTemplateContextRead' },
          new AbortController().signal,
        );
        await vi.advanceTimersByTimeAsync(20);
        await expect(pending).resolves.toMatchObject({
          ok: false,
          status: 504,
        });
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it('rejects invalid configuration and accepts a default fetch binding without using it', () => {
    expect(
      createProductionCmsTemplateDependencies({ environment }).humanOrigins,
    ).toEqual([]);
    for (const overrides of [
      { deadlineMs: 0 },
      { deadlineMs: 15_001 },
      { deadlineMs: 1.5 },
      { maxResponseBytes: 0 },
      { maxResponseBytes: 1.5 },
    ]) {
      expect(() =>
        createProductionCmsTemplateDependencies({ environment, ...overrides }),
      ).toThrow('Invalid CMS composition production configuration');
    }
  });
});
