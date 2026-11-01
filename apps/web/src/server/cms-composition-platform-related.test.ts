import { describe, expect, it, vi } from 'vitest';

import { forwardCmsRelatedContentMutation } from './cms-composition-platform-related';

const origin = 'https://app.example.test';
const entryId = '10000000-0000-4000-8000-000000000001';
const pinA = '20000000-0000-4000-8000-000000000002';
const pinB = '30000000-0000-4000-8000-000000000003';
const ruleId = '40000000-0000-4000-8000-000000000004';
const path = `/api/v1/cms/entries/${entryId}/related-content`;
const body = {
  entryId,
  pins: [pinA],
  exclusions: [pinB],
  derivedRule: {
    key: 'similar-genre',
    version: '2',
    reasonCode: 'genre_match',
    maxCandidates: 20,
  },
  expectedVersion: '1',
};
const resource = {
  id: ruleId,
  version: '2',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'active',
  sourceEntryId: entryId,
  pins: [pinA],
  exclusions: [pinB],
  derivedRule: { key: 'similar-genre', version: '2' },
  eligibleCount: 1,
};
const request = (
  payload: unknown = body,
  headers: Record<string, string> = {},
  url = `${origin}${path}`,
) =>
  new Request(url, {
    method: 'POST',
    headers: {
      origin,
      cookie:
        'wj_access=protected; wj_csrf=csrf-token-123; private=do-not-forward',
      'x-csrf-token': 'csrf-token-123',
      'content-type': 'application/json',
      'idempotency-key': 'related-content-0001',
      'if-match': '"1"',
      ...headers,
    },
    body: JSON.stringify(payload),
  });
const success = (value: unknown = resource, etag = '"2"') =>
  new Response(JSON.stringify(value), {
    status: 201,
    headers: { 'content-type': 'application/json', etag },
  });

describe('CMS-03C-05 first-party related-content proxy', () => {
  it('forwards a bounded command and returns only the bound rule resource', async () => {
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      expect(input).toBeInstanceOf(Request);
      return success();
    });
    const response = await forwardCmsRelatedContentMutation(
      request(),
      entryId,
      { fetch },
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(resource);
    expect(response.headers.get('etag')).toBe('"2"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(fetch).toHaveBeenCalledTimes(1);
    const forwarded = fetch.mock.calls[0]?.[0] as Request;
    expect(forwarded.url).toBe(`https://platform-api.internal${path}`);
    expect(forwarded.headers.get('cookie')).toBe(
      'wj_access=protected; wj_csrf=csrf-token-123',
    );
    expect(forwarded.headers.get('idempotency-key')).toBe(
      'related-content-0001',
    );
    expect(forwarded.headers.get('if-match')).toBe('"1"');
    expect(await forwarded.json()).toEqual(body);
  });

  it('refuses cross-origin, CSRF mismatch, and invalid path before forwarding', async () => {
    const fetch = vi.fn(async () => success());
    const crossOrigin = await forwardCmsRelatedContentMutation(
      request(body, { origin: 'https://evil.example.test' }),
      entryId,
      { fetch },
    );
    expect(crossOrigin.status).toBe(403);
    expect(await crossOrigin.json()).toMatchObject({
      code: 'RELATED_CONTENT_FORBIDDEN',
    });
    const csrfMismatch = await forwardCmsRelatedContentMutation(
      request(body, { 'x-csrf-token': 'wrong' }),
      entryId,
      { fetch },
    );
    expect(csrfMismatch.status).toBe(403);
    const invalidPath = await forwardCmsRelatedContentMutation(
      request(),
      'not-a-uuid',
      { fetch },
    );
    expect(invalidPath.status).toBe(400);
    expect(await invalidPath.json()).toMatchObject({
      code: 'INVALID_REQUEST',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses an oversize declared body at the bounded read cap', async () => {
    const fetch = vi.fn(async () => success());
    for (const input of [request({ ...body, padding: 'x'.repeat(300_000) })]) {
      const response = await forwardCmsRelatedContentMutation(input, entryId, {
        fetch,
      });
      expect(response.status).toBe(400);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects mismatched body, mutation precondition, and query before forwarding', async () => {
    const fetch = vi.fn(async () => success());
    const invalid = [
      request({ ...body, entryId: '20000000-0000-4000-8000-000000000002' }),
      request(body, { 'if-match': '"2"' }),
      request(body, {}, `${origin}${path}?ownerId=${entryId}`),
    ];
    for (const input of invalid) {
      const response = await forwardCmsRelatedContentMutation(input, entryId, {
        fetch,
      });
      expect(response.status).toBe(400);
    }
    const overlap = await forwardCmsRelatedContentMutation(
      request({ ...body, exclusions: [pinA] }),
      entryId,
      { fetch },
    );
    expect(overlap.status).toBe(422);
    expect(await overlap.json()).toMatchObject({
      code: 'RELATED_CONTENT_VALIDATION_FAILED',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects invalid media and oversized input without forwarding', async () => {
    const fetch = vi.fn(async () => success());
    const media = await forwardCmsRelatedContentMutation(
      request(body, { 'content-type': 'text/plain' }),
      entryId,
      { fetch },
    );
    expect(media.status).toBe(415);
    expect(await media.json()).toMatchObject({
      code: 'UNSUPPORTED_MEDIA_TYPE',
    });
    const overBounds = await forwardCmsRelatedContentMutation(
      request({ ...body, pins: [pinA, pinA] }),
      entryId,
      { fetch },
    );
    expect(overBounds.status).toBe(422);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails closed on forged upstream resource, ETag, or excess response bytes', async () => {
    const values = [
      success({ ...resource, sourceEntryId: pinA }),
      success({ ...resource, state: 'hidden' }),
      success({ ...resource, ownerId: entryId }),
      success(resource, '"3"'),
      success({ ...resource, padding: 'x'.repeat(262_145) }),
    ];
    for (const upstream of values) {
      const fetch = vi.fn(async () => upstream);
      const response = await forwardCmsRelatedContentMutation(
        request(),
        entryId,
        { fetch },
      );
      expect(response.status).toBe(502);
      expect(await response.json()).toMatchObject({
        code: 'DEPENDENCY_UNAVAILABLE',
      });
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });

  it('refuses a next aggregate version outside the wire contract', async () => {
    const maximum = '9223372036854775807';
    const fetch = vi.fn(async () => success(resource, '"9223372036854775808"'));
    const response = await forwardCmsRelatedContentMutation(
      request(
        { ...body, expectedVersion: maximum },
        { 'if-match': `"${maximum}"` },
      ),
      entryId,
      { fetch },
    );
    expect(response.status).toBe(502);
    expect(response.headers.get('x-cms-editorial-outcome')).toBe('unknown');
    expect(await response.json()).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('sanitizes provider errors and preserves only bounded reconciliation fields', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: 'RELATED_CONTENT_VERSION_CONFLICT',
            message: 'private provider text',
            requestId: '10000000-0000-4000-8000-000000000006',
            details: {
              expectedVersion: '1',
              currentVersion: '2',
              secret: 'do-not-disclose',
            },
          }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        ),
    );
    const response = await forwardCmsRelatedContentMutation(
      request(),
      entryId,
      { fetch },
    );
    expect(response.status).toBe(409);
    const error = await response.json();
    expect(error).toMatchObject({
      code: 'RELATED_CONTENT_VERSION_CONFLICT',
      details: { expectedVersion: '1', currentVersion: '2' },
    });
    expect(JSON.stringify(error)).not.toContain('private provider text');
    expect(JSON.stringify(error)).not.toContain('do-not-disclose');
  });

  describe('the CMS-03C-05 typed 422 (BE03c 385-387, 1417)', () => {
    const refusal = (details: Record<string, unknown>) =>
      new Response(
        JSON.stringify({
          code: 'RELATED_CONTENT_VALIDATION_FAILED',
          message: 'private provider text',
          requestId: '10000000-0000-4000-8000-000000000008',
          details,
        }),
        { status: 422, headers: { 'content-type': 'application/json' } },
      );
    const relay = async (details: Record<string, unknown>) => {
      const response = await forwardCmsRelatedContentMutation(
        request(),
        entryId,
        { fetch: vi.fn(async () => refusal(details)) },
      );
      expect(response.status).toBe(422);
      const error = (await response.json()) as {
        code: string;
        details: Record<string, unknown>;
      };
      expect(error.code).toBe('RELATED_CONTENT_VALIDATION_FAILED');
      return error.details;
    };

    it('relays related_target_ineligible with its row pointers and a fixed message', async () => {
      expect(
        await relay({
          reasonCode: 'related_target_ineligible',
          violations: [
            {
              path: '/pins/1',
              code: 'related_target_ineligible',
              message: 'x',
            },
            {
              path: '/exclusions/0',
              code: 'related_target_ineligible',
              message: 'private target text',
            },
          ],
          secret: 'do-not-disclose',
        }),
      ).toEqual({
        reasonCode: 'related_target_ineligible',
        violations: [
          {
            path: '/pins/1',
            code: 'related_target_ineligible',
            message: 'The value is invalid.',
          },
          {
            path: '/exclusions/0',
            code: 'related_target_ineligible',
            message: 'The value is invalid.',
          },
        ],
      });
    });

    it('relays derived_rule_unknown with its pointer', async () => {
      expect(
        await relay({
          reasonCode: 'derived_rule_unknown',
          violations: [
            { path: '/derivedRule/key', code: 'derived_rule_unknown' },
          ],
        }),
      ).toEqual({
        reasonCode: 'derived_rule_unknown',
        violations: [
          {
            path: '/derivedRule/key',
            code: 'derived_rule_unknown',
            message: 'The value is invalid.',
          },
        ],
      });
    });

    it('relays a token without pointers as the token alone', async () => {
      expect(await relay({ reasonCode: 'related_target_ineligible' })).toEqual({
        reasonCode: 'related_target_ineligible',
      });
    });

    it('drops a token this operation does not publish, or one on another status, and any other member', async () => {
      for (const reasonCode of [
        'pattern_incompatible',
        'pattern_cycle',
        'capability_missing',
        'RELATED_TARGET_INELIGIBLE',
        'unknown_token',
      ])
        expect(await relay({ reasonCode, secret: 'do-not-disclose' })).toEqual(
          {},
        );
    });

    it('relays no token on a 400, which carries no typed refusal', async () => {
      const response = await forwardCmsRelatedContentMutation(
        request(),
        entryId,
        {
          fetch: vi.fn(
            async () =>
              new Response(
                JSON.stringify({
                  code: 'INVALID_REQUEST',
                  message: 'private provider text',
                  requestId: '10000000-0000-4000-8000-000000000009',
                  details: {
                    reasonCode: 'related_target_ineligible',
                    violations: [
                      { path: '/pins/0', code: 'related_target_ineligible' },
                    ],
                  },
                }),
                {
                  status: 400,
                  headers: { 'content-type': 'application/json' },
                },
              ),
          ),
        },
      );
      expect(response.status).toBe(400);
      expect(((await response.json()) as { details: unknown }).details).toEqual(
        {},
      );
    });

    it('relays no pointer at all without a token this operation publishes', async () => {
      const violations = [
        { path: '/pins/0', code: 'related_target_ineligible' },
      ];
      expect(await relay({ violations })).toEqual({});
      expect(
        await relay({ reasonCode: 'pattern_incompatible', violations }),
      ).toEqual({});
    });

    it('keeps at most 16 pointers and drops malformed ones', async () => {
      const violations = Array.from({ length: 20 }, (_, index) => ({
        path: `/pins/${index}`,
        code: 'related_target_ineligible',
      }));
      const details = (await relay({
        reasonCode: 'related_target_ineligible',
        violations: [
          { path: 'pins/0', code: 'related_target_ineligible' },
          { path: '/pins/0', code: 'Not A Token' },
          { path: '/pins/0' },
          'text',
          ...violations,
        ],
      })) as { violations: { path: string }[] };
      expect(details.violations).toHaveLength(16);
      expect(details.violations[0]?.path).toBe('/pins/0');
      expect(details.violations[15]?.path).toBe('/pins/15');
    });
  });

  it('answers an upstream success it cannot verify as an unknown outcome the browser can replay', async () => {
    // The write may have committed (BE03c 1502), so the key must survive: the unknown-outcome marker.
    const unverifiable = [
      success({ ...resource, sourceEntryId: pinA }),
      success(resource, '"3"'),
      success({ ...resource, padding: 'x'.repeat(262_145) }),
      new Response('not json', {
        status: 201,
        headers: { etag: '"2"' },
      }),
      new Response(JSON.stringify(resource), { status: 200 }),
    ];
    for (const upstream of unverifiable) {
      const response = await forwardCmsRelatedContentMutation(
        request(),
        entryId,
        { fetch: vi.fn(async () => upstream) },
      );
      expect(response.status).toBe(502);
      expect(response.headers.get('x-cms-editorial-outcome')).toBe('unknown');
    }
    // A refusal before any write, or a definite upstream answer, is never marked.
    const definite = await forwardCmsRelatedContentMutation(
      request(),
      entryId,
      { fetch: vi.fn(async () => success()) },
    );
    expect(definite.headers.get('x-cms-editorial-outcome')).toBeNull();
  });

  it('relays DEPENDENCY_UNAVAILABLE retryable true on every 502/503/504, forged or upstream (BE00 172)', async () => {
    // Each row pins the status the relay must answer: an upstream 502/503/504 keeps its own status, an
    // oversized 201 is a local 502 (BE03c 408).
    const responses: ReadonlyArray<readonly [Response, number]> = [
      ...([502, 503, 504] as const).map(
        (status) =>
          [
            new Response(
              JSON.stringify({
                code: 'DEPENDENCY_UNAVAILABLE',
                message: 'private provider text',
                requestId: '10000000-0000-4000-8000-000000000007',
                details: { dependencyClass: 'private', retryable: false },
              }),
              { status, headers: { 'content-type': 'application/json' } },
            ),
            status,
          ] as const,
      ),
      [success({ ...resource, padding: 'x'.repeat(262_145) }), 502],
    ];
    for (const [upstream, expectedStatus] of responses) {
      const response = await forwardCmsRelatedContentMutation(
        request(),
        entryId,
        { fetch: vi.fn(async () => upstream) },
      );
      expect(response.status).toBe(expectedStatus);
      expect(await response.json()).toMatchObject({
        code: 'DEPENDENCY_UNAVAILABLE',
        details: { dependencyClass: 'cms_composition', retryable: true },
      });
    }
  });

  it('fails closed 503 without binding or when the upstream call throws', async () => {
    const unbound = await forwardCmsRelatedContentMutation(
      request(),
      entryId,
      undefined,
    );
    expect(unbound.status).toBe(503);
    expect(await unbound.json()).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
    });
    const fetch = vi.fn(async () => {
      throw new Error('upstream down');
    });
    const thrown = await forwardCmsRelatedContentMutation(request(), entryId, {
      fetch,
    });
    expect(thrown.status).toBe(503);
    expect(await thrown.json()).toMatchObject({
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('relays a 429 resetAt only as a valid RFC 3339 UTC instant (BE00 RATE_LIMITED)', async () => {
    const respond = async (details: Record<string, unknown>) => {
      const fetch = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 'RATE_LIMITED',
              message: 'private provider text',
              requestId: '10000000-0000-4000-8000-000000000006',
              details,
            }),
            { status: 429, headers: { 'content-type': 'application/json' } },
          ),
      );
      const response = await forwardCmsRelatedContentMutation(
        request(),
        entryId,
        { fetch },
      );
      expect(response.status).toBe(429);
      return ((await response.json()) as { details: unknown }).details;
    };
    expect(
      await respond({
        retryAfterSeconds: 43,
        limit: 60,
        resetAt: '2026-09-02T10:41:00.000Z',
        secret: 'do-not-disclose',
      }),
    ).toEqual({
      retryAfterSeconds: 43,
      limit: 60,
      resetAt: '2026-09-02T10:41:00.000Z',
    });
    for (const unsafe of [
      '2026-02-30T10:41:00.000Z',
      '2026-09-02T10:41:00+02:00',
      'private',
    ])
      expect(
        await respond({ retryAfterSeconds: 43, limit: 60, resetAt: unsafe }),
      ).toEqual({ retryAfterSeconds: 43, limit: 60 });
  });
});
