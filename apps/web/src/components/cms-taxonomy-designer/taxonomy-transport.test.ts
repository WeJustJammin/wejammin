import { describe, expect, it, vi } from 'vitest';

import {
  CANONICAL_ID,
  CSRF,
  KEY,
  TAXONOMY_ID,
  jsonResponse,
  taxonomyApiError,
} from '../../server/cms-taxonomy-platform.test-support';
import { sendTaxonomyMutation } from './taxonomy-transport';

const send = async (
  response: Response | Error | 'not-a-response',
  operation: 'CMS-03C-16' | 'CMS-03C-03' = 'CMS-03C-03',
  ifMatch: string | null = '"2"',
) => {
  const fetcher = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response as Response;
  });
  const outcome = await sendTaxonomyMutation({
    operation,
    url: `/api/v1/cms/taxonomies/${TAXONOMY_ID}/terms/actions`,
    body: '{"a":1}',
    csrfToken: CSRF,
    idempotencyKey: KEY,
    ifMatch,
    successStatus: 200,
    fetcher: fetcher as unknown as typeof fetch,
  });
  return { outcome, fetcher };
};
const refusal = (
  status: number,
  details: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) =>
  jsonResponse(
    status,
    taxonomyApiError('CMS-03C-03', status, details),
    headers,
  );

describe('sendTaxonomyMutation: the request', () => {
  it('posts the exact body with the CSRF token, the key and the strong If-Match', async () => {
    const { fetcher } = await send(jsonResponse(200, {}, { etag: '"1"' }));
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`/api/v1/cms/taxonomies/${TAXONOMY_ID}/terms/actions`);
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      body: '{"a":1}',
    });
    expect(init.headers).toEqual({
      'content-type': 'application/json',
      'x-csrf-token': CSRF,
      'idempotency-key': KEY,
      'if-match': '"2"',
    });
  });

  it('sends no If-Match on a first version', async () => {
    const { fetcher } = await send(
      jsonResponse(200, {}, { etag: '"1"' }),
      'CMS-03C-16',
      null,
    );
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('if-match');
  });
});

describe('sendTaxonomyMutation: success and uncertainty', () => {
  it('hands the success body and ETag to the caller to verify', async () => {
    const { outcome } = await send(
      jsonResponse(200, { x: 1 }, { etag: '"4"' }),
    );
    expect(outcome).toEqual({ kind: 'success', body: { x: 1 }, etag: '"4"' });
  });

  it.each([
    ['another success status', jsonResponse(201, {}, { etag: '"1"' })],
    ['a body that is not JSON', new Response('x', { status: 200 })],
    ['a network failure', new Error('offline')],
    ['a non-Response', 'not-a-response' as const],
    ['a status outside the catalog', new Response('x', { status: 418 })],
    [
      'a refusal that is not the catalog code of its status',
      jsonResponse(404, {
        ...taxonomyApiError('CMS-03C-03', 404),
        code: 'TEMPLATE_NOT_FOUND',
      }),
    ],
    [
      'a refusal body that is not JSON',
      new Response('<html>', { status: 404 }),
    ],
    [
      'a refusal without details',
      jsonResponse(404, { code: 'TAXONOMY_NOT_FOUND' }),
    ],
  ])('is uncertain for %s', async (_name, response) => {
    expect((await send(response)).outcome).toEqual({ kind: 'uncertain' });
  });

  it.each([500, 502, 503, 504])(
    'is uncertain for a %i the proxy marked unknown',
    async (status) => {
      expect(
        (
          await send(
            refusal(status, {}, { 'x-cms-editorial-outcome': 'unknown' }),
          )
        ).outcome,
      ).toEqual({ kind: 'uncertain' });
    },
  );

  it('reports a 5xx without the marker as a definite rejection', async () => {
    expect((await send(refusal(503))).outcome).toEqual({
      kind: 'rejected',
      status: 503,
    });
  });
});

describe('sendTaxonomyMutation: typed refusals', () => {
  it('reports capability_missing, taxonomy_not_active and the term refusals with their members', async () => {
    expect(
      (await send(refusal(403, { reasonCode: 'capability_missing' }))).outcome,
    ).toEqual({ kind: 'refused', status: 403, reason: 'capability_missing' });
    expect(
      (await send(refusal(409, { reasonCode: 'taxonomy_not_active' }))).outcome,
    ).toEqual({ kind: 'refused', status: 409, reason: 'taxonomy_not_active' });
    expect(
      (
        await send(
          refusal(422, {
            reasonCode: 'canonical_overlap',
            domain: 'role',
            canonicalId: CANONICAL_ID,
          }),
        )
      ).outcome,
    ).toEqual({
      kind: 'refused',
      status: 422,
      reason: 'canonical_overlap',
      domain: 'role',
      canonicalId: CANONICAL_ID,
    });
    expect(
      (
        await send(
          refusal(422, {
            reasonCode: 'canonical_source_unavailable',
            domain: 'gear',
          }),
        )
      ).outcome,
    ).toEqual({
      kind: 'refused',
      status: 422,
      reason: 'canonical_source_unavailable',
      domain: 'gear',
    });
  });

  it('does not read a token of another operation or status as a refusal', async () => {
    expect(
      (
        await send(
          refusal(409, { reasonCode: 'taxonomy_not_active' }),
          'CMS-03C-16',
        )
      ).outcome,
    ).toEqual({ kind: 'conflict', currentVersion: null });
    expect(
      (await send(refusal(422, { reasonCode: 'taxonomy_not_active' }))).outcome,
    ).toEqual({ kind: 'rejected', status: 422 });
  });

  it.each([
    [
      'no domain',
      { reasonCode: 'canonical_overlap', canonicalId: CANONICAL_ID },
    ],
    [
      'an unknown domain',
      {
        reasonCode: 'canonical_overlap',
        domain: 'planet',
        canonicalId: CANONICAL_ID,
      },
    ],
    ['no canonical id', { reasonCode: 'canonical_overlap', domain: 'role' }],
    [
      'a malformed canonical id',
      { reasonCode: 'canonical_overlap', domain: 'role', canonicalId: 'x' },
    ],
    [
      'no domain on source unavailable',
      { reasonCode: 'canonical_source_unavailable' },
    ],
  ])(
    'treats a canonical refusal with %s as a plain rejection',
    async (_name, details) => {
      expect((await send(refusal(422, details))).outcome).toEqual({
        kind: 'rejected',
        status: 422,
      });
    },
  );
});

describe('sendTaxonomyMutation: conflicts, rejections and the rate limit', () => {
  it('reports a plain conflict with a well-formed current version', async () => {
    expect((await send(refusal(409, { currentVersion: '5' }))).outcome).toEqual(
      { kind: 'conflict', currentVersion: '5' },
    );
    expect((await send(refusal(409))).outcome).toEqual({
      kind: 'conflict',
      currentVersion: null,
    });
    expect(
      (await send(refusal(409, { currentVersion: '9223372036854775808' })))
        .outcome,
    ).toEqual({ kind: 'conflict', currentVersion: null });
    expect(
      (await send(refusal(409, { currentVersion: '05' }))).outcome,
    ).toEqual({ kind: 'conflict', currentVersion: null });
  });

  it.each([400, 401, 403, 404, 415, 422, 500, 502, 503, 504])(
    'reports a plain %i as rejected',
    async (status) => {
      expect((await send(refusal(status))).outcome).toEqual({
        kind: 'rejected',
        status,
      });
    },
  );

  it('reports a rate limit with its wait and is uncertain without a usable one', async () => {
    expect(
      (
        await send(
          refusal(429, { retryAfterSeconds: 12 }, { 'retry-after': '12' }),
        )
      ).outcome,
    ).toEqual({ kind: 'rejected', status: 429, retryAfterSeconds: 12 });
    expect(
      (await send(refusal(429, {}, { 'retry-after': '12' }))).outcome,
    ).toEqual({ kind: 'rejected', status: 429, retryAfterSeconds: 12 });
    expect(
      (
        await send(
          refusal(429, { retryAfterSeconds: 99 }, { 'retry-after': '12' }),
        )
      ).outcome,
    ).toEqual({ kind: 'uncertain' });
    expect((await send(refusal(429))).outcome).toEqual({ kind: 'uncertain' });
    expect(
      (await send(refusal(429, {}, { 'retry-after': '0' }))).outcome,
    ).toEqual({ kind: 'uncertain' });
    expect(
      (await send(refusal(429, {}, { 'retry-after': '86401' }))).outcome,
    ).toEqual({ kind: 'uncertain' });
  });
});
