import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createPupHarness,
  pgRaise,
  pupAuthentication,
  sentOf,
} from './cms-composition-production-pattern-update.test-support';
import {
  puId,
  PU_PARTY_ID,
  PU_REQUEST_ID,
  PU_TYPE_ID,
  PU_USER_ID,
  selectorItem,
  selectorPage,
} from './cms-composition/pattern-update.test-support';

/**
 * cmsPatternNestableRead production adapter (DEC-196) over `platform_api.cms_list_pattern_nestable`: ONE named call (no
 * retry), the designer capability proved again on a fresh resolution of the very Request, the exact request grammar of
 * the SQL reader (`contentTypeId` as an ARRAY), the real PostgREST token forms, and an answer that must honour the
 * request.
 */
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const OTHER_TYPE = 'a9120000-0000-4000-8000-0000000000b2';
const NESTABLE = `/api/v1/cms/patterns/nestable?contentTypeId=${PU_TYPE_ID}&contentTypeId=${OTHER_TYPE}`;
const DESIGNER = { resolveCapabilities: ['cms.template_designer'] } as const;
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('cmsPatternNestableRead over platform_api.cms_list_pattern_nestable', () => {
  it('sends the exact grammar: the contentTypeId array in request order, the defaulted limit, the server context, nothing else', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(selectorPage()));
    const response = await createPupHarness(fetchImpl, DESIGNER).request(
      NESTABLE,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"1790000000000000"');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const { url, init, p_request } = sentOf(fetchImpl);
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_list_pattern_nestable',
    );
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('content-profile')).toBe('platform_api');
    expect(headers.get('accept-profile')).toBe('platform_api');
    expect(headers.get('x-operation-id')).toBe('cmsPatternNestableRead');
    expect(headers.get('x-request-id')).toBe(PU_REQUEST_ID);
    expect(headers.get('apikey')).toBe('sb_secret_test_only');
    expect(headers.get('if-match')).toBeNull();
    expect(headers.get('x-idempotency-key')).toBeNull();
    expect(headers.get('cookie')).toBeNull();
    expect(Object.keys(p_request).sort()).toEqual(
      ['contentTypeId', 'context', 'correlationId', 'limit'].sort(),
    );
    expect(p_request).toMatchObject({
      contentTypeId: [PU_TYPE_ID, OTHER_TYPE],
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
    const response = await createPupHarness(fetchImpl, DESIGNER).request(
      `${NESTABLE}&limit=1&cursor=${encodeURIComponent(cursor)}`,
    );
    expect(response.status).toBe(200);
    expect(sentOf(fetchImpl).p_request).toMatchObject({ limit: 1, cursor });
  });

  it('proves the designer capability again: an author-only session is a 403 and no network call is made', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(selectorPage()));
    const response = await createPupHarness(fetchImpl, {
      resolveCapabilities: ['cms.author', 'cms.editor'],
    }).request(NESTABLE);
    expect(response.status).toBe(403);
    expect(((await response.json()) as { details: object }).details).toEqual({
      reasonCode: 'capability_missing',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('never lets the browser name the actor, party or capability', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(selectorPage()));
    const response = await createPupHarness(fetchImpl, DESIGNER).request(
      `${NESTABLE}&actorId=${PU_USER_ID}`,
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
    const response = await createPupHarness(fetchImpl, DESIGNER).request(
      `${NESTABLE}${extra}`,
    );
    expect(response.status).toBe(502);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['NOT_FOUND', 'COMPOSITION_NOT_FOUND', 404],
    ['capability_missing', 'COMPOSITION_FORBIDDEN', 403],
    ['INVALID_REQUEST', 'INVALID_REQUEST', 400],
    ['CONFLICT', 'INTERNAL_ERROR', 500],
    ['DEPENDENCY_UNAVAILABLE', 'DEPENDENCY_UNAVAILABLE', 503],
  ])('the SQL token %s is $2 ($1)', async (token, code, status) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => pgRaise(token));
    const response = await createPupHarness(fetchImpl, DESIGNER).request(
      NESTABLE,
    );
    expect(response.status).toBe(status);
    expect(((await response.json()) as { code: string }).code).toBe(code);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['/limit', '["/limit"]'],
    ['/contentTypeId', '["/contentTypeId"]'],
  ])(
    'a VALIDATION_FAILED raise with the real DETAIL pointer %s is the 422 naming it',
    async (path, detail) => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        pgRaise('VALIDATION_FAILED', detail),
      );
      const response = await createPupHarness(fetchImpl, DESIGNER).request(
        NESTABLE,
      );
      expect(response.status).toBe(422);
      expect(((await response.json()) as { details: unknown }).details).toEqual(
        {
          violations: [
            { path, code: 'invalid', message: 'The value is invalid.' },
          ],
        },
      );
    },
  );

  it.each([
    ['a pointer the grammar does not own', '["/cursor"]'],
    ['no pointer', null],
  ])(
    'a VALIDATION_FAILED raise with %s names no member',
    async (_n, detail) => {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        pgRaise('VALIDATION_FAILED', detail),
      );
      const response = await createPupHarness(fetchImpl, DESIGNER).request(
        NESTABLE,
      );
      expect(response.status).toBe(422);
      expect(((await response.json()) as { details: unknown }).details).toEqual(
        {},
      );
    },
  );

  it('a token of another operation or an unknown one is the scrubbed 500', async () => {
    for (const token of ['pattern_cycle', 'IDEMPOTENCY_CONFLICT', 'WHATEVER']) {
      const fetchImpl = vi.fn<typeof fetch>(async () => pgRaise(token));
      const response = await createPupHarness(fetchImpl, DESIGNER).request(
        NESTABLE,
      );
      expect(response.status, token).toBe(500);
    }
  });

  it('refuses a hand-built port input (wrong operation, query that breaks the contract) with a 400 and no network call', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json(selectorPage()));
    const { dependencies } = createPupHarness(fetchImpl, DESIGNER);
    const signal = new AbortController().signal;
    const unique = (count: number): string[] =>
      Array.from({ length: count }, (_unused, index) => puId(1000 + index));
    const base = {
      request: new Request('https://api.example.test/x'),
      requestId: PU_REQUEST_ID,
    };
    for (const input of [
      // another operation's id with a valid query
      {
        ...base,
        operationId: 'CMS-03C-13',
        query: { contentTypeId: [PU_TYPE_ID], limit: 25 },
      },
      // the query breaks PatternNestableQuery: 65 types, a duplicate, a non-UUID, an empty set, a limit of 0
      {
        ...base,
        operationId: 'cmsPatternNestableRead',
        query: { contentTypeId: unique(65), limit: 25 },
      },
      {
        ...base,
        operationId: 'cmsPatternNestableRead',
        query: { contentTypeId: [PU_TYPE_ID, PU_TYPE_ID], limit: 25 },
      },
      {
        ...base,
        operationId: 'cmsPatternNestableRead',
        query: { contentTypeId: ['nope'], limit: 25 },
      },
      {
        ...base,
        operationId: 'cmsPatternNestableRead',
        query: { contentTypeId: [], limit: 25 },
      },
      {
        ...base,
        operationId: 'cmsPatternNestableRead',
        query: { contentTypeId: [PU_TYPE_ID], limit: 0 },
      },
    ])
      expect(
        await dependencies.readNestable(input as never, signal),
      ).toMatchObject({
        ok: false,
        status: 400,
      });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
