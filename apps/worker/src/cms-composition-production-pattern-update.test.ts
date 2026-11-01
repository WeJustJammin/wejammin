import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createPupHarness,
  jsonbText,
  pgRaise,
  pupAuthentication,
  sentOf,
} from './cms-composition-production-pattern-update.test-support';
import {
  diffNodeValue,
  diffResource,
  emptyDiff,
  PU_INSTANCE_ID,
  PU_PARTY_ID,
  PU_REQUEST_ID,
  PU_SELECTOR_PATH,
  PU_TYPE_ID,
  PU_USER_ID,
  puDiffPath,
  selectorItem,
  selectorPage,
} from './cms-composition/pattern-update.test-support';

/**
 * CMS-03C-13 and -14 production adapters: ONE named `platform_api` call each (no retry), the server-built context, the
 * exact request grammar of the SQL readers, and an answer that must honour the request.
 */
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const SELECTOR = `${PU_SELECTOR_PATH}?contentTypeId=${PU_TYPE_ID}`;
const json = (
  value: unknown,
  status = 200,
  extra: Record<string, string> = {},
) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', ...extra },
  });

describe('CMS-03C-13 over platform_api.cms_list_pattern_selector', () => {
  it('sends the exact grammar: contentTypeId, the defaulted limit, the server context, nothing else', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(selectorPage()));
    const response = await createPupHarness(fetchImpl).request(SELECTOR);
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"1790000000000000"');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const { url, init, p_request } = sentOf(fetchImpl);
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_list_pattern_selector',
    );
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('content-profile')).toBe('platform_api');
    expect(headers.get('accept-profile')).toBe('platform_api');
    expect(headers.get('x-operation-id')).toBe('CMS-03C-13');
    expect(headers.get('x-request-id')).toBe(PU_REQUEST_ID);
    expect(headers.get('apikey')).toBe('sb_secret_test_only');
    expect(headers.get('if-match')).toBeNull();
    expect(headers.get('x-idempotency-key')).toBeNull();
    expect(headers.get('cookie')).toBeNull();
    expect(Object.keys(p_request).sort()).toEqual(
      ['contentTypeId', 'context', 'correlationId', 'limit'].sort(),
    );
    expect(p_request).toMatchObject({
      contentTypeId: PU_TYPE_ID,
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

  it('passes the signed cursor and the limit byte for byte', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json(selectorPage(0, { items: [selectorItem(1)], nextCursor: 'n.s' })),
    );
    const cursor = 'eyJxdWVyeUhhc2giOiJ4In0=.c2ln';
    const response = await createPupHarness(fetchImpl).request(
      `${SELECTOR}&limit=1&cursor=${encodeURIComponent(cursor)}`,
    );
    expect(response.status).toBe(200);
    expect(sentOf(fetchImpl).p_request).toMatchObject({ limit: 1, cursor });
  });

  it('never lets the browser name the actor, party or capability', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(selectorPage()));
    const response = await createPupHarness(fetchImpl).request(
      `${SELECTOR}&actorId=${PU_USER_ID}`,
    );
    expect(response.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ['more rows than the limit', selectorPage(3), '&limit=2'],
    [
      'rows out of keyset order',
      { ...selectorPage(0), items: [selectorItem(2), selectorItem(1)] },
      '',
    ],
    ['a field outside the contract', { ...selectorPage(0), extra: true }, ''],
  ])('an answer with %s is a local 502', async (_n, page, extra) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(page));
    const response = await createPupHarness(fetchImpl).request(
      `${SELECTOR}${extra}`,
    );
    expect(response.status).toBe(502);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['CONFLICT', 'COMPOSITION_VERSION_CONFLICT', 409],
    ['NOT_FOUND', 'COMPOSITION_NOT_FOUND', 404],
    ['capability_missing', 'COMPOSITION_FORBIDDEN', 403],
    ['INVALID_REQUEST', 'INVALID_REQUEST', 400],
    ['DEPENDENCY_UNAVAILABLE', 'DEPENDENCY_UNAVAILABLE', 503],
  ])('the SQL token %s is $2 ($1)', async (token, code, status) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => pgRaise(token));
    const response = await createPupHarness(fetchImpl).request(SELECTOR);
    expect(response.status).toBe(status);
    expect(((await response.json()) as { code: string }).code).toBe(code);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('CMS-03C-14 over platform_api.cms_get_instance_update_diff', () => {
  it('sends only the instance id and the server context; the ETag is the instance version', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(diffResource()));
    const response = await createPupHarness(fetchImpl).request(puDiffPath());
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"3"');
    const { url, init, p_request } = sentOf(fetchImpl);
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_get_instance_update_diff',
    );
    expect(new Headers(init.headers).get('x-operation-id')).toBe('CMS-03C-14');
    expect(Object.keys(p_request).sort()).toEqual([
      'context',
      'correlationId',
      'instanceId',
    ]);
    expect(p_request.instanceId).toBe(PU_INSTANCE_ID);
  });

  it('serves the empty diff of an instance with no newer version', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(emptyDiff()));
    const response = await createPupHarness(fetchImpl).request(puDiffPath());
    expect(response.status).toBe(200);
  });

  it('accepts a near-maximum diff whose database text carries the JSONB spacing', async () => {
    const wide = (letter: string) =>
      Object.fromEntries(
        Array.from({ length: 64 }, (_, index) => [
          `k${String(index).padStart(3, '0')}`,
          letter.repeat(3),
        ]),
      );
    const fat = diffResource({
      paths: Array.from({ length: 128 }, (_, index) => ({
        path: `/node-${index}`,
        base: diffNodeValue(wide('a')),
        theirs: diffNodeValue(wide('b')),
        yours: null,
        collision: false,
        collisionKind: null,
      })),
    });
    const compact = new TextEncoder().encode(JSON.stringify(fat)).byteLength;
    const spaced = jsonbText(fat);
    // within the 262,144-octet resource bound as compact text, yet wider than it as PostgreSQL jsonb text
    expect(compact).toBeLessThanOrEqual(262_144);
    expect(new TextEncoder().encode(spaced).byteLength).toBeGreaterThan(
      262_144,
    );
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(spaced, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const response = await createPupHarness(fetchImpl).request(puDiffPath());
    expect(response.status).toBe(200);
    const served = await response.text();
    expect(new TextEncoder().encode(served).byteLength).toBe(compact);
  });

  it('refuses a diff body beyond the transport ceiling', async () => {
    const huge = `{"pad":"${'x'.repeat(524_288)}"}`;
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(huge, {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    expect(
      (await createPupHarness(fetchImpl).request(puDiffPath())).status,
    ).toBe(502);
  });

  it.each([
    [
      'diff_too_large',
      422,
      'COMPOSITION_VALIDATION_FAILED',
      { reasonCode: 'diff_too_large' },
    ],
    ['NOT_FOUND', 404, 'COMPOSITION_NOT_FOUND', {}],
    [
      'capability_missing',
      403,
      'COMPOSITION_FORBIDDEN',
      { reasonCode: 'capability_missing' },
    ],
  ])('the SQL token %s is %i', async (token, status, code, details) => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      pgRaise(token, '["/instanceId"]'),
    );
    const response = await createPupHarness(fetchImpl).request(puDiffPath());
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ code, details });
  });

  it('a diff of another instance is a local 502', async () => {
    const other = diffResource({
      instance: { ...diffResource().instance, id: PU_PARTY_ID },
    });
    const fetchImpl = vi.fn<typeof fetch>(async () => json(other));
    expect(
      (await createPupHarness(fetchImpl).request(puDiffPath())).status,
    ).toBe(502);
  });
});
