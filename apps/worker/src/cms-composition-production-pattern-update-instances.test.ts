import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createPupHarness,
  jsonbText,
  pgRaise,
  pupAuthentication,
  sentOf,
} from './cms-composition-production-pattern-update.test-support';
import {
  CI_CURSOR,
  CI_ENTRY_ID,
  CI_PAGE_SIZE,
  ciPage,
  ciPath,
  ciRow,
} from './cms-composition/composition-instances.test-support';
import {
  PU_PARTY_ID,
  PU_REQUEST_ID,
  PU_USER_ID,
} from './cms-composition/pattern-update.test-support';

/**
 * cmsCompositionInstancesRead production adapter (DEC-206): ONE named `platform_api.cms_list_composition_instances` call
 * (no retry), the server-built context, the exact request grammar of the SQL reader, and an answer that must honour the
 * request.
 */
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('cmsCompositionInstancesRead over platform_api.cms_list_composition_instances', () => {
  it('sends the entry id and the server context, nothing else, without a cursor', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(ciPage()));
    const response = await createPupHarness(fetchImpl).request(ciPath());
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const { url, init, p_request } = sentOf(fetchImpl);
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_list_composition_instances',
    );
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('content-profile')).toBe('platform_api');
    expect(headers.get('accept-profile')).toBe('platform_api');
    expect(headers.get('x-operation-id')).toBe('cmsCompositionInstancesRead');
    expect(headers.get('x-request-id')).toBe(PU_REQUEST_ID);
    expect(headers.get('apikey')).toBe('sb_secret_test_only');
    expect(headers.get('if-match')).toBeNull();
    expect(headers.get('x-idempotency-key')).toBeNull();
    expect(headers.get('cookie')).toBeNull();
    expect(Object.keys(p_request).sort()).toEqual([
      'context',
      'correlationId',
      'entryId',
      'limit',
    ]);
    expect(p_request).toMatchObject({
      entryId: CI_ENTRY_ID,
      limit: 25,
      correlationId: PU_REQUEST_ID,
      context: {
        authUserId: PU_USER_ID,
        actingPartyId: PU_PARTY_ID,
        sessionId: pupAuthentication.sessionId,
        requestId: PU_REQUEST_ID,
      },
    });
  });

  it('passes the cursor byte for byte', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(ciPage()));
    const cursor = 'a+b/c=d==';
    const response = await createPupHarness(fetchImpl).request(
      ciPath(CI_ENTRY_ID, `?cursor=${encodeURIComponent(cursor)}`),
    );
    expect(response.status).toBe(200);
    expect(sentOf(fetchImpl).p_request).toMatchObject({
      entryId: CI_ENTRY_ID,
      cursor,
    });
  });

  it('sends the requested limit and cursor, and refuses an answer that breaks the limit', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json(ciPage(3, { nextCursor: CI_CURSOR })),
    );
    const response = await createPupHarness(fetchImpl).request(
      ciPath(CI_ENTRY_ID, `?limit=3&cursor=${CI_CURSOR}`),
    );
    expect(response.status).toBe(200);
    expect(sentOf(fetchImpl).p_request).toMatchObject({
      entryId: CI_ENTRY_ID,
      cursor: CI_CURSOR,
      limit: 3,
    });
    const tooMany = vi.fn<typeof fetch>(async () => json(ciPage(4)));
    expect(
      (await createPupHarness(tooMany).request(ciPath(CI_ENTRY_ID, '?limit=3')))
        .status,
    ).toBe(502);
  });

  it('never lets the browser name the actor, party, revision or capability', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(ciPage()));
    for (const search of [
      `?actorId=${PU_USER_ID}`,
      `?actingPartyId=${PU_PARTY_ID}`,
      `?revisionId=${PU_PARTY_ID}`,
    ])
      expect(
        (await createPupHarness(fetchImpl).request(ciPath(CI_ENTRY_ID, search)))
          .status,
      ).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('accepts a full page whose database text carries the JSONB spacing, under the ordinary 256 KiB ceiling', async () => {
    const full = ciPage(CI_PAGE_SIZE, { nextCursor: CI_CURSOR });
    const spaced = jsonbText(full);
    expect(new TextEncoder().encode(spaced).byteLength).toBeLessThan(262_144);
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(spaced, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const response = await createPupHarness(fetchImpl).request(ciPath());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(full);
  });

  it('refuses an answer beyond the transport ceiling', async () => {
    const huge = `{"pad":"${'x'.repeat(262_144)}"}`;
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(huge, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    expect((await createPupHarness(fetchImpl).request(ciPath())).status).toBe(
      502,
    );
  });

  it.each([
    ['a member outside the contract', { ...ciPage(1), extra: true }],
    ['more than a page', ciPage(CI_PAGE_SIZE + 1)],
    ['a retired row', ciPage(1, { items: [ciRow(0, { state: 'retired' })] })],
    ['a cursor on a short page', ciPage(2, { nextCursor: CI_CURSOR })],
  ])('an answer with %s is a local 502 after one call', async (_n, value) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(value));
    const response = await createPupHarness(fetchImpl).request(ciPath());
    expect(response.status).toBe(502);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['NOT_FOUND', 404, 'COMPOSITION_NOT_FOUND', {}],
    [
      'capability_missing',
      403,
      'COMPOSITION_FORBIDDEN',
      { reasonCode: 'capability_missing' },
    ],
    ['INVALID_REQUEST', 400, 'INVALID_REQUEST', undefined],
    ['UNAUTHENTICATED', 401, 'UNAUTHENTICATED', undefined],
    ['DEPENDENCY_UNAVAILABLE', 503, 'DEPENDENCY_UNAVAILABLE', undefined],
  ])('the SQL token %s is %i', async (token, status, code, details) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => pgRaise(token));
    const response = await createPupHarness(fetchImpl).request(ciPath());
    expect(response.status).toBe(status);
    const body = (await response.json()) as { code: string; details?: unknown };
    expect(body.code).toBe(code);
    if (details !== undefined) expect(body.details).toEqual(details);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    'CONFLICT',
    'VALIDATION_FAILED',
    'revision_not_editable',
    'diff_too_large',
  ])(
    'the token %s is not one this read raises: the scrubbed internal error',
    async (token) => {
      const fetchImpl = vi.fn<typeof fetch>(async () => pgRaise(token));
      const response = await createPupHarness(fetchImpl).request(ciPath());
      expect(response.status).toBe(500);
    },
  );

  it('a database fault is a retryable 503 and is never retried', async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response('{}', { status: 503 }),
    );
    const response = await createPupHarness(fetchImpl).request(ciPath());
    expect(response.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
