import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaxonomyTermResourceSchema } from '@wejammin/contracts';

import {
  ACT_PARENT_ID,
  ACT_PATH,
  ACT_REQUEST_ID,
  ACT_TAXONOMY_ID,
  ACT_TERM_ID,
  actAuthentication,
  actBody,
  actRequest,
  createActHarness,
  termAnswer,
} from './cms-composition-production-taxonomy-act.test-support';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('CMS-03C-03 production port: the named RPC (BE03c 1447, 1506)', () => {
  it('calls platform_api.cms_act_taxonomy_term once with the exact request grammar', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json(termAnswer({ parentId: ACT_PARENT_ID })),
    );
    const h = createActHarness(fetchImpl);
    const response = await h.request(
      actRequest(actBody({ parentId: ACT_PARENT_ID })),
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_act_taxonomy_term',
    );
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('content-profile')).toBe('platform_api');
    expect(headers.get('accept-profile')).toBe('platform_api');
    expect(headers.get('x-operation-id')).toBe('CMS-03C-03');
    expect(headers.get('x-request-id')).toBe(ACT_REQUEST_ID);
    expect(headers.get('x-idempotency-key')).toBe('taxonomy-action-0001');
    expect(headers.get('if-match')).toBe('"7"');
    expect(headers.get('cookie')).toBeNull();
    expect(headers.get('apikey')).toBe('sb_secret_test_only');
    const sent = JSON.parse(String(init?.body)) as {
      p_request: Record<string, unknown>;
    };
    expect(Object.keys(sent)).toEqual(['p_request']);
    // the eight request members, the decoded operand and key, then the server blocks: nothing else
    expect(Object.keys(sent.p_request).sort()).toEqual(
      [
        'action',
        'aliases',
        'context',
        'correlationId',
        'expectedVersion',
        'idempotencyKey',
        'ifMatch',
        'labels',
        'parentId',
        'survivorId',
        'taxonomyId',
        'termKey',
      ].sort(),
    );
    expect(sent.p_request).toMatchObject({
      taxonomyId: ACT_TAXONOMY_ID,
      action: 'create',
      termKey: 'jazz-fusion',
      parentId: ACT_PARENT_ID,
      survivorId: null,
      labels: [{ locale: 'en-US', label: 'Jazz fusion' }],
      aliases: ['fusion'],
      expectedVersion: '7',
      ifMatch: '7',
      idempotencyKey: 'taxonomy-action-0001',
      correlationId: ACT_REQUEST_ID,
      context: {
        authUserId: actAuthentication.authUserId,
        sessionId: actAuthentication.sessionId,
        actorPersonId: actAuthentication.personId,
        actingPartyId: actAuthentication.actingPartyId,
        stepUpVerified: false,
        requestId: ACT_REQUEST_ID,
      },
    });
  });

  it('answers 200 with the strict term and a quoted ETag of the term version', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json(termAnswer({ version: '4', lifecycle: 'deprecated' })),
    );
    const response = await createActHarness(fetchImpl).request(
      actRequest(actBody({ action: 'alias' })),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"4"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(
      TaxonomyTermResourceSchema.safeParse(await response.json()).success,
    ).toBe(true);
  });

  it('replays the identical bytes and key on a repeated request (no retry, no regeneration)', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json(termAnswer()),
    );
    const h = createActHarness(fetchImpl);
    await h.request();
    await h.request();
    const [first, second] = fetchImpl.mock.calls;
    expect(String(first?.[1]?.body)).toBe(String(second?.[1]?.body));
    expect(new Headers(first?.[1]?.headers).get('x-idempotency-key')).toBe(
      new Headers(second?.[1]?.headers).get('x-idempotency-key'),
    );
  });

  it('never sends a mutation without a fresh curator proof of the same session', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    let calls = 0;
    const revoked = createActHarness(fetchImpl, {
      resolveCapabilities: () =>
        ++calls === 1 ? ['cms.taxonomy_curator'] : [],
    });
    const response = await revoked.request();
    expect(response.status).toBe(403);
    expect(((await response.json()) as { details: unknown }).details).toEqual({
      reasonCode: 'capability_missing',
    });
    const other = createActHarness(fetchImpl);
    other.auth.resolveSession
      .mockResolvedValueOnce({ ok: true, value: actAuthentication })
      .mockResolvedValue({
        ok: true,
        value: {
          ...actAuthentication,
          sessionId: '99999999-9999-4999-8999-999999999990',
        },
      });
    expect((await other.request()).status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('an unauthenticated direct port call fails closed without any network', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const h = createActHarness(fetchImpl);
    const result = await h.dependencies.actTerm(
      {
        operationId: 'CMS-03C-03',
        request: new Request(`https://api.example.test${ACT_PATH}`, {
          ...actRequest(),
          headers: {
            'idempotency-key': 'taxonomy-action-0001',
            'if-match': '"7"',
            'x-request-id': ACT_REQUEST_ID,
          },
        }),
        requestId: ACT_REQUEST_ID,
        session: {
          userId: actAuthentication.authUserId,
          actingPartyId: actAuthentication.actingPartyId,
          capabilities: ['cms.taxonomy_curator'],
          mfaFresh: true,
        },
        path: { taxonomyId: ACT_TAXONOMY_ID },
        body: actBody(),
        idempotencyKey: 'taxonomy-action-0001',
        ifMatch: '7',
      },
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('CMS-03C-03 production port: response contract and transport (BE00 172, 592)', () => {
  it.each([
    ['not an object', 'x'],
    ['another vocabulary', termAnswer({ taxonomyId: ACT_TERM_ID })],
    ['another term key', termAnswer({ termKey: 'other-key' })],
    ['a create that is not version 1', termAnswer({ version: '2' })],
    ['an unknown member', { ...termAnswer(), ownerId: ACT_TERM_ID }],
    ['a created term already merged', termAnswer({ lifecycle: 'merged' })],
  ])('a 200 with %s is a retryable 502', async (_name, value) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(value));
    const response = await createActHarness(fetchImpl).request();
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
      details: { dependencyClass: 'cms_composition', retryable: true },
    });
  });

  it('a body that is not JSON is a 502', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response('<html>', { status: 200 }),
    );
    expect((await createActHarness(fetchImpl).request()).status).toBe(502);
  });

  it.each([262144, 262145])(
    'caps a typed RPC refusal at %i bytes despite a 1 MiB option',
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
            headers: { 'content-type': 'application/json' },
          }),
      );
      const h = createActHarness(fetchImpl, { maxResponseBytes: 1_048_576 });
      expect((await h.request()).status).toBe(bytes === 262144 ? 403 : 502);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it('a dependency that throws is a retryable 503 and the mutation is not retried', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error('socket closed');
    });
    const response = await createActHarness(fetchImpl).request();
    expect(response.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('aborts a nonsettling transport at the deadline without retrying', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise(() => {}));
    const h = createActHarness(fetchImpl, { deadlineMs: 5 });
    const pending = h.request();
    await vi.advanceTimersByTimeAsync(6);
    expect((await pending).status).toBe(504);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it('refuses budgets too small for a typed envelope', () => {
    expect(() =>
      createActHarness(vi.fn<typeof fetch>(), { maxResponseBytes: 1 }),
    ).toThrow();
  });
});
