import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTaxonomyRouteHarness,
  taxonomyDefinitionWriteRequest,
  taxonomyResource,
  taxonomySession,
} from './taxonomy-definition.test-support';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
const path = '/api/v1/cms/taxonomies/versions';

describe('taxonomy definition write isolated boundary', () => {
  it('cancels an unread request stream after preflight refusal', async () => {
    const cancel = vi.fn();
    const h = createTaxonomyRouteHarness();
    const init = taxonomyDefinitionWriteRequest();
    const headers = new Headers(init.headers);
    headers.set('content-length', '262145');
    const body = new ReadableStream<Uint8Array>({ cancel });
    expect(
      (
        await h.request(path, {
          ...init,
          headers,
          body,
          duplex: 'half',
        } as RequestInit)
      ).status,
    ).toBe(400);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(h.resolveSession).not.toHaveBeenCalled();
  });
  it.each([262144, 262145])(
    'bounds valid JSON request bytes at %i',
    async (bytes) => {
      const h = createTaxonomyRouteHarness();
      const init = taxonomyDefinitionWriteRequest();
      const json = String(init.body);
      const body =
        json + ' '.repeat(bytes - new TextEncoder().encode(json).byteLength);
      expect(new TextEncoder().encode(body).byteLength).toBe(bytes);
      expect((await h.request(path, { ...init, body })).status).toBe(
        bytes === 262144 ? 201 : 400,
      );
      expect(h.createVersion).toHaveBeenCalledTimes(bytes === 262144 ? 1 : 0);
    },
  );
  it.each([0, 1])(
    'enforces each quota before mutation: denied scope index %i',
    async (denied) => {
      const h = createTaxonomyRouteHarness();
      let index = 0;
      h.rateLimit.mockImplementation(async (input) => ({
        ok: true,
        value: {
          allowed: index++ !== denied,
          limit: input.limit,
          remaining: 0,
          resetAt: 60,
        },
      }));
      const response = await h.request(path, taxonomyDefinitionWriteRequest());
      expect(response.status).toBe(429);
      expect(response.headers.get('retry-after')).toBe('60');
      expect(response.headers.get('ratelimit-limit')).toBe(
        denied === 0 ? '30' : '60',
      );
      expect(h.createVersion).not.toHaveBeenCalled();
      expect(h.rateLimit).toHaveBeenCalledTimes(denied + 1);
    },
  );
  it('rejects malformed identity before parsing malformed JSON', async () => {
    const h = createTaxonomyRouteHarness();
    h.resolveSession.mockResolvedValue({
      ok: true,
      value: null as unknown as typeof taxonomySession,
    });
    const init = taxonomyDefinitionWriteRequest();
    expect((await h.request(path, { ...init, body: '{' })).status).toBe(401);
    expect(h.rateLimit).not.toHaveBeenCalled();
  });
  it('creates a first draft with unbuilt declared domain and stale MFA allowed', async () => {
    const h = createTaxonomyRouteHarness();
    const response = await h.request(path, taxonomyDefinitionWriteRequest());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(taxonomyResource());
    expect(response.headers.get('etag')).toBe('"1"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(h.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: 'CMS-03C-16',
        session: taxonomySession,
        ifMatch: null,
      }),
      expect.any(AbortSignal),
    );
    expect(h.rateLimit.mock.calls.map(([input]) => input.limit)).toEqual([
      30, 60,
    ]);
  });
  it('passes an unquoted exact successor operand and accepts definition version 8', async () => {
    const h = createTaxonomyRouteHarness();
    h.createVersion.mockResolvedValue({ ok: true, value: taxonomyResource(8) });
    const response = await h.request(path, taxonomyDefinitionWriteRequest('7'));
    expect(response.status).toBe(201);
    expect(response.headers.get('etag')).toBe('"8"');
    expect(h.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({ ifMatch: '7' }),
      expect.any(AbortSignal),
    );
  });
  it.each([
    { name: 'no capability', capabilities: [] },
    { name: 'only cms.author', capabilities: ['cms.author'] },
  ])(
    'denies absent curator before quotas and mutation (caller holds $name)',
    async ({ capabilities }) => {
      const h = createTaxonomyRouteHarness();
      h.resolveSession.mockResolvedValue({
        ok: true,
        value: { ...taxonomySession, capabilities },
      });
      const response = await h.request(path, taxonomyDefinitionWriteRequest());
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        code: 'TAXONOMY_FORBIDDEN',
        details: { reasonCode: 'capability_missing' },
      });
      expect(h.rateLimit).not.toHaveBeenCalled();
      expect(h.createVersion).not.toHaveBeenCalled();
    },
  );
  it('requires an acting party before quota', async () => {
    const h = createTaxonomyRouteHarness();
    h.resolveSession.mockResolvedValue({
      ok: true,
      value: { ...taxonomySession, actingPartyId: null },
    });
    expect(
      (await h.request(path, taxonomyDefinitionWriteRequest())).status,
    ).toBe(403);
    expect(h.rateLimit).not.toHaveBeenCalled();
  });
  it.each(['W/"7"', '*', '"6"', '"7", "8"', null])(
    'rejects successor If-Match %s',
    async (header) => {
      const h = createTaxonomyRouteHarness();
      const init = taxonomyDefinitionWriteRequest('7');
      const headers = new Headers(init.headers);
      if (header === null) headers.delete('if-match');
      else headers.set('if-match', header);
      expect((await h.request(path, { ...init, headers })).status).toBe(400);
      expect(h.createVersion).not.toHaveBeenCalled();
      // BE03c 408, 1502: header parse precedes capability and quota.
      expect(h.rateLimit).not.toHaveBeenCalled();
    },
  );
  it.each([
    { state: 'active' },
    { version: '99' },
    { taxonomyVersion: 2 },
    { taxonomyKey: 'other-key' },
    { shape: 'hierarchical' },
    { allowedFieldKeys: ['other'] },
    { allowedTypeKeys: ['other'] },
    { canonicalOverlapDomains: [] },
    { ownerId: 'private' },
  ])('refuses malformed or request-unbound draft %j', async (patch) => {
    const h = createTaxonomyRouteHarness();
    h.createVersion.mockResolvedValue({
      ok: true,
      value: { ...taxonomyResource(), ...patch } as ReturnType<
        typeof taxonomyResource
      >,
    });
    const response = await h.request(path, taxonomyDefinitionWriteRequest());
    expect(response.status).toBe(502);
    expect(response.headers.get('etag')).toBeNull();
    expect(await response.text()).not.toContain('private');
  });
  it.each([
    ['content-type', 'text/plain', 415],
    ['origin', 'https://evil.example', 403],
    ['cookie', 'wj_session_ref=fake; wj_csrf=one', 403],
    ['content-length', '262145', 400],
  ] as const)(
    'refuses preflight %s before auth',
    async (key, value, status) => {
      const h = createTaxonomyRouteHarness();
      const init = taxonomyDefinitionWriteRequest();
      const headers = new Headers(init.headers);
      headers.set(key, value);
      expect((await h.request(path, { ...init, headers })).status).toBe(status);
      expect(h.resolveSession).not.toHaveBeenCalled();
    },
  );
  it('bounds actual request bytes even with understated length', async () => {
    const h = createTaxonomyRouteHarness();
    const init = taxonomyDefinitionWriteRequest();
    const headers = new Headers(init.headers);
    headers.set('content-length', '1');
    expect(
      (await h.request(path, { ...init, headers, body: ' '.repeat(262145) }))
        .status,
    ).toBe(400);
    expect(h.resolveSession).not.toHaveBeenCalled();
  });
  it('strictly rejects caller authority and query keys', async () => {
    const h = createTaxonomyRouteHarness();
    const init = taxonomyDefinitionWriteRequest();
    const body = JSON.parse(String(init.body));
    expect(
      (
        await h.request(path, {
          ...init,
          body: JSON.stringify({ ...body, ownerId: 'private' }),
        })
      ).status,
    ).toBe(422);
    expect(
      (
        await h.request(
          path + '?ownerId=private',
          taxonomyDefinitionWriteRequest(),
        )
      ).status,
    ).toBe(400);
    expect(h.createVersion).not.toHaveBeenCalled();
  });
});
