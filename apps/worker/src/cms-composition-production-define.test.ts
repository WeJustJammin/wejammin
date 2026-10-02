import { describe, expect, it, vi } from 'vitest';
import type { TemplateVersionRequest } from '@wejammin/contracts';

import { createProductionCmsTemplateDependencies } from './cms-composition-production';
import type { CmsTemplatePortInput } from './cms-composition/template-routes';
import {
  BODY,
  compose,
  environment,
  input,
  json,
  PARTY_ID,
  RESOURCE,
  request,
  REQUEST_ID,
  USER_ID,
} from './cms-composition-production.test-support';

describe('CMS-03C-01 production template adapter', () => {
  it('rejects forged operation, authority, headers, and session before any RPC', async () => {
    const fetchImpl = vi.fn(async () => json(RESOURCE));
    const dependencies = compose(fetchImpl as typeof fetch);
    const signal = new AbortController().signal;
    const badInputs: CmsTemplatePortInput[] = [
      input({ operationId: 'CMS-03B-01' as 'CMS-03C-01' }),
      input({ body: { ...BODY, ownerId: PARTY_ID } as TemplateVersionRequest }),
      input({ idempotencyKey: 'short' }),
      input({ ifMatch: '1' }),
      input({ body: { ...BODY, expectedVersion: '1' }, ifMatch: '2' }),
      input({ session: { ...input().session, actingPartyId: null } }),
      input({ session: { ...input().session, capabilities: [] } }),
    ];
    for (const candidate of badInputs) {
      const result = await dependencies.defineTemplate(candidate, signal);
      expect(result.ok).toBe(false);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('detects a port session that disagrees with the verified auth context', async () => {
    const fetchImpl = vi.fn(async () => json(RESOURCE));
    const dependencies = createProductionCmsTemplateDependencies({
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
    const req = request();
    const resolved = await dependencies.resolveSession(
      req,
      new AbortController().signal,
    );
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const forged = await dependencies.defineTemplate(
      input({
        request: req,
        session: {
          ...resolved.value,
          userId: '80000000-0000-4000-8000-000000000008',
        },
      }),
      new AbortController().signal,
    );
    expect(forged).toMatchObject({ ok: false, status: 401 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('calls only the named protected RPC with server session context and an opaque secret', async () => {
    const fetchImpl = vi.fn(async () => json(RESOURCE));
    const dependencies = compose(fetchImpl as typeof fetch);
    const portInput = input();
    const result = await dependencies.defineTemplate(
      portInput,
      new AbortController().signal,
    );
    expect(result).toEqual({ ok: true, value: RESOURCE });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_define_template',
    );
    const headers = init.headers as Record<string, string>;
    expect(headers['Accept-Profile']).toBe('platform_api');
    expect(headers['Content-Profile']).toBe('platform_api');
    expect(headers['X-Operation-Id']).toBe('CMS-03C-01');
    expect(headers.apikey).toBe('sb_secret_slice_10_production');
    expect(headers.authorization).toBeUndefined();
    const payload = JSON.parse(String(init.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(payload.p_request).toMatchObject({
      templateKey: 'profile-header',
      idempotencyKey: 'template-create-0001',
      expectedVersion: null,
      context: {
        authUserId: USER_ID,
        actingPartyId: PARTY_ID,
        requestId: REQUEST_ID,
      },
    });
    expect(payload.p_request).not.toHaveProperty('ifMatch');
  });

  it('quotes successor If-Match once and projects no browser authority key', async () => {
    const fetchImpl = vi.fn(async () =>
      json({ ...RESOURCE, version: '2', templateVersion: 2 }),
    );
    const dependencies = compose(fetchImpl as typeof fetch);
    const result = await dependencies.defineTemplate(
      input({
        body: { ...BODY, expectedVersion: '1' },
        ifMatch: '1',
      }),
      new AbortController().signal,
    );
    expect(result.ok).toBe(true);
    const init = (
      fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    )[1];
    const headers = init.headers as Record<string, string>;
    expect(headers['If-Match']).toBe('"1"');
    expect(
      (JSON.parse(String(init.body)) as { p_request: Record<string, unknown> })
        .p_request.ifMatch,
    ).toBe('1');
    const invalid = await dependencies.defineTemplate(
      input({
        body: { ...BODY, ownerId: PARTY_ID } as TemplateVersionRequest,
      }),
      new AbortController().signal,
    );
    expect(invalid).toMatchObject({ ok: false, status: 422 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps exact SQL tokens and scrubs prose, but rejects malformed success', async () => {
    const tokenFetch = vi.fn(async () =>
      json({ code: 'P0001', message: 'CONFLICT', details: 'private' }, 400),
    );
    const conflict = await compose(tokenFetch as typeof fetch).defineTemplate(
      input(),
      new AbortController().signal,
    );
    expect(conflict).toMatchObject({ ok: false, status: 409 });
    expect(JSON.stringify(conflict)).not.toContain('private');
    const badFetch = vi.fn(async () =>
      json({ ...RESOURCE, ownerId: PARTY_ID }),
    );
    const malformed = await compose(badFetch as typeof fetch).defineTemplate(
      input(),
      new AbortController().signal,
    );
    expect(malformed).toMatchObject({ ok: false, status: 502 });
    const htmlFetch = vi.fn(
      async () =>
        new Response('<html>private</html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    );
    const html = await compose(htmlFetch as typeof fetch).defineTemplate(
      input(),
      new AbortController().signal,
    );
    expect(html).toMatchObject({ ok: false, status: 502 });
  });

  it('fails closed for unavailable and expired transport without leaking a response', async () => {
    const unavailable = vi.fn(async () => {
      throw new Error('private transport');
    });
    const lost = await compose(unavailable as typeof fetch).defineTemplate(
      input(),
      new AbortController().signal,
    );
    expect(lost).toMatchObject({ ok: false, status: 503 });
    expect(JSON.stringify(lost)).not.toContain('private transport');
    const controller = new AbortController();
    controller.abort();
    const expired = await compose(vi.fn() as typeof fetch).defineTemplate(
      input(),
      controller.signal,
    );
    expect(expired).toMatchObject({ ok: false, status: 504 });
    const malformedTransport = vi.fn(async () => undefined);
    const rejected = await compose(
      malformedTransport as unknown as typeof fetch,
    ).defineTemplate(input(), new AbortController().signal);
    expect(rejected).toMatchObject({ ok: false, status: 503 });
  });

  it.each([200, 400])(
    'enforces the deadline while reading a stalled %i RPC body',
    async (status) => {
      vi.useFakeTimers();
      try {
        const fetchImpl = vi.fn(
          async () =>
            new Response(
              new ReadableStream({
                pull: () => undefined,
              }),
              { status, headers: { 'content-type': 'application/json' } },
            ),
        );
        const dependencies = createProductionCmsTemplateDependencies({
          environment,
          fetchImpl: fetchImpl as typeof fetch,
          deadlineMs: 20,
        });
        const pending = dependencies.defineTemplate(
          input(),
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
});
