import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTaxonomyProductionHarness,
  taxonomyAuthentication,
  taxonomyDefinitionWriteRequest,
  taxonomyDefinitionVersionsPath,
  taxonomyResource,
  taxonomySession,
  taxonomyDefinitionRequestId,
} from './taxonomy-definition.test-support';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const path = '/api/v1/cms/taxonomies/versions';
describe('taxonomy fixed production RPC boundary', () => {
  it.each([
    ['TAXONOMY_FORBIDDEN', 403],
    ['TAXONOMY_NOT_FOUND', 404],
    ['TAXONOMY_VERSION_CONFLICT', 409],
    ['TAXONOMY_VALIDATION_FAILED', 422],
  ] as const)(
    'preserves exact taxonomy catalog RPC code %s without prose',
    async (code, status) => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        Response.json(
          { code: 'P0001', message: code, details: 'private SQL owner' },
          { status: 400 },
        ),
      );
      const h = createTaxonomyProductionHarness(fetchImpl);
      const response = await h.request(path, taxonomyDefinitionWriteRequest());
      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({
        code,
        message: `${code}: taxonomy operation rejected or unavailable.`,
      });
    },
  );
  it('rejects budgets too small for a typed fail-closed envelope', () => {
    expect(() =>
      createTaxonomyProductionHarness(vi.fn<typeof fetch>(), {
        maxResponseBytes: 1,
      }),
    ).toThrow();
  });
  it('bounds refreshed authority even when the resolver ignores abort', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>();
    const h = createTaxonomyProductionHarness(fetchImpl, { deadlineMs: 5 });
    const request = new Request(
      'https://api.example.test' + path,
      taxonomyDefinitionWriteRequest(),
    );
    const body = JSON.parse(await request.clone().text());
    await h.dependencies.resolveSession(request, new AbortController().signal);
    h.auth.resolveSession.mockImplementation(() => new Promise(() => {}));
    const settled = vi.fn();
    void h.dependencies
      .createVersion(
        {
          operationId: 'CMS-03C-16',
          request,
          requestId: taxonomyDefinitionRequestId,
          session: taxonomySession,
          body,
          idempotencyKey: request.headers.get('idempotency-key')!,
          ifMatch: null,
        },
        new AbortController().signal,
      )
      .then(settled);
    await vi.advanceTimersByTimeAsync(6);
    expect(settled).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, status: 504 }),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('uses named create RPC, server context and unbuilt declaration with no MFA', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json(taxonomyResource()),
    );
    const h = createTaxonomyProductionHarness(fetchImpl);
    expect(
      (await h.request(path, taxonomyDefinitionWriteRequest())).status,
    ).toBe(201);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_create_taxonomy_version',
    );
    const headers = new Headers(init?.headers);
    expect(headers.get('content-profile')).toBe('platform_api');
    expect(headers.get('x-operation-id')).toBe('CMS-03C-16');
    expect(headers.get('if-match')).toBeNull();
    expect(headers.get('cookie')).toBeNull();
    expect(JSON.parse(String(init?.body))).toMatchObject({
      p_request: {
        expectedVersion: null,
        canonicalOverlapDomains: ['instrument'],
        context: {
          authUserId: taxonomyAuthentication.authUserId,
          sessionId: taxonomyAuthentication.sessionId,
          actingPartyId: taxonomyAuthentication.actingPartyId,
          stepUpVerified: false,
        },
      },
    });
    expect(JSON.parse(String(init?.body)).p_request).not.toHaveProperty(
      'ifMatch',
    );
  });
  it('quotes the successor HTTP header but sends a decoded RPC operand', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json(taxonomyResource(8)),
    );
    const h = createTaxonomyProductionHarness(fetchImpl);
    expect(
      (await h.request(path, taxonomyDefinitionWriteRequest('7'))).status,
    ).toBe(201);
    const init = fetchImpl.mock.calls[0]![1];
    expect(new Headers(init?.headers).get('if-match')).toBe('"7"');
    expect(JSON.parse(String(init?.body)).p_request.ifMatch).toBe('7');
  });
  it.each([262144, 262145])(
    'caps valid typed RPC error JSON at %i bytes despite a 1MiB option',
    async (bytes) => {
      const payload = {
        code: 'P0001',
        message: 'capability_missing',
        details: '',
      };
      payload.details = 'x'.repeat(
        bytes - new TextEncoder().encode(JSON.stringify(payload)).byteLength,
      );
      const wire = JSON.stringify(payload);
      expect(new TextEncoder().encode(wire).byteLength).toBe(bytes);
      const fetchImpl = vi.fn<typeof fetch>(
        async () =>
          new Response(wire, {
            status: 400,
            headers: {
              'content-type': 'application/json',
              'content-length': '1',
            },
          }),
      );
      const h = createTaxonomyProductionHarness(fetchImpl, {
        maxResponseBytes: 1048576,
      });
      expect(
        (await h.request(path, taxonomyDefinitionWriteRequest())).status,
      ).toBe(bytes === 262144 ? 403 : 502);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );
  it('honors tighter success budget', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json(taxonomyResource()),
    );
    const h = createTaxonomyProductionHarness(fetchImpl, {
      maxResponseBytes: 256,
    });
    expect(
      (await h.request(path, taxonomyDefinitionWriteRequest())).status,
    ).toBe(502);
  });
  it('scrubs a valid capability token and answers a create canonical-source refusal as a foreign reason (500)', async () => {
    for (const [token, status] of [
      ['capability_missing', 403],
      ['canonical_source_unavailable', 500],
    ] as const) {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        Response.json(
          { code: 'P0001', message: token, details: 'private SQL personId' },
          { status: 400 },
        ),
      );
      const h = createTaxonomyProductionHarness(fetchImpl);
      const response = await h.request(path, taxonomyDefinitionWriteRequest());
      expect(response.status).toBe(status);
      expect(await response.text()).not.toMatch(
        /private SQL|personId|canonical_source_unavailable/,
      );
    }
  });
  it('rejects authority revoked between admission and RPC', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    let calls = 0;
    const h = createTaxonomyProductionHarness(fetchImpl, {
      resolveCapabilities: () =>
        ++calls === 1 ? ['cms.taxonomy_curator'] : [],
    });
    expect(
      (await h.request(path, taxonomyDefinitionWriteRequest())).status,
    ).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('rejects expired refreshed session before RPC', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const h = createTaxonomyProductionHarness(fetchImpl);
    h.auth.resolveSession.mockResolvedValueOnce({
      ok: true,
      value: taxonomyAuthentication,
    });
    h.auth.resolveSession.mockResolvedValue({
      ok: true,
      value: { ...taxonomyAuthentication, expiresAt: '2026-10-11T00:00:00Z' },
    });
    expect(
      (await h.request(path, taxonomyDefinitionWriteRequest())).status,
    ).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('preserves hidden 404 instead of returning an empty versions page', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json(
        { code: 'NOT_FOUND', message: 'private taxonomy' },
        { status: 404 },
      ),
    );
    const h = createTaxonomyProductionHarness(fetchImpl);
    const response = await h.request(taxonomyDefinitionVersionsPath());
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'TAXONOMY_NOT_FOUND' });
  });
  it('aborts a nonsettling transport without retrying the mutation', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise(() => {}));
    const h = createTaxonomyProductionHarness(fetchImpl, { deadlineMs: 5 });
    const pending = h.request(path, taxonomyDefinitionWriteRequest());
    await vi.advanceTimersByTimeAsync(6);
    expect((await pending).status).toBe(504);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });
});
