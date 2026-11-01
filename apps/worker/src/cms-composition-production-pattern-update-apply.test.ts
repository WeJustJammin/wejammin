import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createPupHarness,
  pgRaise,
  sentOf,
} from './cms-composition-production-pattern-update.test-support';
import {
  acceptBody,
  acceptResource,
  detachBody,
  detachResource,
  PU_ENTRY_ETAG,
  PU_REQUEST_ID,
  PU_UPDATE_PATH,
  puId,
  updateRow,
} from './cms-composition/pattern-update.test-support';

/**
 * CMS-03C-15 production adapter over `platform_api.cms_apply_pattern_update`: ONE named call, the exact request grammar of
 * the SQL command (the decoded entry operand and key beside the body, the server context), the forwarded committed
 * ETag, and an answer that must bind the request. A command is never retried here.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const KEY = 'pattern-update-0001';
const post = (
  harness: ReturnType<typeof createPupHarness>,
  body: unknown = acceptBody(1),
  headers: Record<string, string> = {},
) =>
  harness.request(PU_UPDATE_PATH, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': KEY,
      'if-match': '"7"',
      ...headers,
    },
    body: JSON.stringify(body),
  });
const rpcOk = (value: unknown, etag: string | null = PU_ENTRY_ETAG) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      ...(etag === null ? {} : { etag }),
    },
  });

describe('CMS-03C-15 over platform_api.cms_apply_pattern_update', () => {
  it('sends the exact accept grammar, the key and If-Match as headers, and forwards the committed ETag', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => rpcOk(acceptResource(1)));
    const response = await post(createPupHarness(fetchImpl));
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe(PU_ENTRY_ETAG);
    expect(await response.json()).toEqual(acceptResource(1));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const { url, init, p_request } = sentOf(fetchImpl);
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_apply_pattern_update',
    );
    const headers = new Headers(init.headers);
    expect(headers.get('x-operation-id')).toBe('CMS-03C-15');
    expect(headers.get('x-idempotency-key')).toBe(KEY);
    expect(headers.get('if-match')).toBe('"7"');
    expect(headers.get('content-profile')).toBe('platform_api');
    expect(Object.keys(p_request).sort()).toEqual(
      [
        'action',
        'context',
        'correlationId',
        'expectedVersion',
        'idempotencyKey',
        'ifMatch',
        'instances',
        'targetPatternVersion',
      ].sort(),
    );
    expect(p_request).toMatchObject({
      action: 'accept',
      targetPatternVersion: 2,
      instances: acceptBody(1).instances,
      expectedVersion: '7',
      ifMatch: '7',
      idempotencyKey: KEY,
      correlationId: PU_REQUEST_ID,
      context: { requestId: PU_REQUEST_ID },
    });
  });

  it('a detach carries no target version', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => rpcOk(detachResource(2)));
    const response = await post(createPupHarness(fetchImpl), detachBody(2));
    expect(response.status).toBe(200);
    const { p_request } = sentOf(fetchImpl);
    expect(p_request.action).toBe('detach');
    expect(p_request).not.toHaveProperty('targetPatternVersion');
  });

  it('forwards the choices of a single-instance accept', async () => {
    const choices = [
      { path: '/hero', choice: 'yours' },
      { path: '/hero/title', choice: 'theirs' },
    ];
    const body = {
      ...acceptBody(1),
      instances: [{ instanceId: puId(100), expectedVersion: '3', choices }],
    };
    const fetchImpl = vi.fn<typeof fetch>(async () => rpcOk(acceptResource(1)));
    await post(createPupHarness(fetchImpl), body);
    expect(
      (sentOf(fetchImpl).p_request.instances as { choices: unknown }[])[0]
        ?.choices,
    ).toEqual(choices);
  });

  it('never retries: a provider fault is one call and a 503', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response('bad gateway', { status: 502 }),
    );
    const response = await post(createPupHarness(fetchImpl));
    expect(response.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a missing ETag', null],
    ['a weak ETag', 'W/"8"'],
    ['the request entry version unchanged', '"7"'],
    ['a later entry version', '"9"'],
  ])('an answer with %s is a local 502', async (_n, etag) => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      rpcOk(acceptResource(1), etag),
    );
    const response = await post(createPupHarness(fetchImpl));
    expect(response.status).toBe(502);
    expect(response.headers.get('etag')).toBeNull();
  });

  it.each([
    ['rows for the wrong number of instances', acceptResource(2)],
    [
      'a row not pinned to the target',
      { items: [updateRow(0, { patternVersion: 9 })] },
    ],
    ['a row of the wrong version', { items: [updateRow(0, { version: '9' })] }],
    ['a field outside the contract', { items: [updateRow(0)], extra: true }],
    ['the legacy single row', updateRow(0)],
  ])('an answer with %s is a local 502', async (_n, value) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => rpcOk(value));
    expect((await post(createPupHarness(fetchImpl))).status).toBe(502);
  });

  it.each([
    [
      'VERSION_MISMATCH',
      JSON.stringify({
        expectedVersion: '7',
        currentVersion: '9',
        instanceId: puId(100),
      }),
      409,
      { expectedVersion: '7', currentVersion: '9' },
    ],
    ['CONFLICT', null, 409, {}],
    ['IDEMPOTENCY_MISMATCH', null, 409, {}],
    [
      'revision_not_editable',
      '["/instances/0/instanceId"]',
      409,
      { reasonCode: 'revision_not_editable' },
    ],
    [
      'diff_has_collisions',
      '["/instances/0/instanceId"]',
      409,
      { reasonCode: 'diff_has_collisions' },
    ],
    [
      'pattern_version_not_active',
      '["/targetPatternVersion"]',
      422,
      { reasonCode: 'pattern_version_not_active' },
    ],
    [
      'nested_pattern_not_active',
      '["/targetPatternVersion"]',
      422,
      { reasonCode: 'nested_pattern_not_active' },
    ],
    ['capability_missing', null, 403, { reasonCode: 'capability_missing' }],
    ['NOT_FOUND', null, 404, {}],
    ['INVALID_REQUEST', null, 400, {}],
    ['UNAUTHENTICATED', null, 401, { recoveryAction: 'reauthenticate' }],
  ])(
    'the SQL token %s is $2 with exactly its members',
    async (token, detail, status, details) => {
      const fetchImpl = vi.fn<typeof fetch>(async () => pgRaise(token, detail));
      const response = await post(createPupHarness(fetchImpl));
      expect(response.status).toBe(status);
      expect(((await response.json()) as { details: unknown }).details).toEqual(
        details,
      );
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it('a pointer-shaped VALIDATION_FAILED keeps the producer pointer', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      pgRaise('VALIDATION_FAILED', '["/instances/0/choices"]'),
    );
    const response = await post(createPupHarness(fetchImpl));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: 'COMPOSITION_VALIDATION_FAILED',
      details: {
        violations: [
          {
            path: '/instances/0/choices',
            code: 'invalid',
            message: 'The value is invalid.',
          },
        ],
      },
    });
  });

  it.each([
    'pattern_cycle',
    'pattern_depth_exceeded',
    'diff_too_large',
    'review_not_open',
  ])(
    'the token %s, which CMS-03C-15 does not publish, is the scrubbed 500',
    async (token) => {
      const fetchImpl = vi.fn<typeof fetch>(async () => pgRaise(token));
      const response = await post(createPupHarness(fetchImpl));
      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({
        code: 'INTERNAL_ERROR',
        details: {},
      });
    },
  );
});

describe('CMS-03C-15 port guards (a hand-built port input never reaches the network)', () => {
  const portInput = (overrides: Record<string, unknown> = {}) => ({
    operationId: 'CMS-03C-15' as const,
    request: new Request('https://api.example.test' + PU_UPDATE_PATH, {
      method: 'POST',
    }),
    requestId: PU_REQUEST_ID,
    session: {
      userId: puId(2),
      actingPartyId: puId(3),
      capabilities: ['cms.author'],
      mfaFresh: true,
    },
    body: acceptBody(1),
    idempotencyKey: KEY,
    ifMatch: '7',
    ...overrides,
  });
  it.each([
    ['another operation id', { operationId: 'CMS-03C-02' }],
    ['an If-Match that is not the body version', { ifMatch: '8' }],
    ['an invalid Idempotency-Key', { idempotencyKey: 'short' }],
    [
      'an unknown body member',
      { body: { ...acceptBody(1), actorId: puId(5) } },
    ],
  ])('refuses %s with a 400', async (_n, overrides) => {
    const fetchImpl = vi.fn<typeof fetch>();
    const dependencies = createPupHarness(fetchImpl).dependencies;
    const result = await dependencies.applyUpdate(
      portInput(overrides) as never,
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses a hand-built selector and diff input the same way', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const { dependencies } = createPupHarness(fetchImpl);
    const base = portInput();
    expect(
      await dependencies.readSelector(
        {
          ...base,
          operationId: 'CMS-03C-13',
          query: { contentTypeId: 'nope', limit: 25 },
        } as never,
        new AbortController().signal,
      ),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      await dependencies.readSelector(
        {
          ...base,
          operationId: 'CMS-03C-14',
          query: { contentTypeId: puId(1), limit: 25 },
        } as never,
        new AbortController().signal,
      ),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      await dependencies.readUpdateDiff(
        { ...base, operationId: 'CMS-03C-14', instanceId: 'nope' } as never,
        new AbortController().signal,
      ),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      await dependencies.readUpdateDiff(
        { ...base, operationId: 'CMS-03C-13', instanceId: puId(100) } as never,
        new AbortController().signal,
      ),
    ).toMatchObject({ ok: false, status: 400 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
