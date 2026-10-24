import type { TaxonomyVersionRequest } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  CSRF,
  KEY,
  ROW_ID,
  TAXONOMY_ID,
  jsonResponse,
  taxonomyApiError,
  versionFixture,
  versionRequestBody,
} from '../../server/cms-taxonomy-platform.test-support';
import { submitTaxonomyVersion } from './taxonomy-designer-submit';

const first = versionRequestBody() as unknown as TaxonomyVersionRequest;
const successor = versionRequestBody({
  expectedVersion: '3',
}) as unknown as TaxonomyVersionRequest;
const created = (
  overrides: Readonly<Record<string, unknown>> = {},
  etag?: string,
) =>
  jsonResponse(201, versionFixture(overrides), {
    etag: etag ?? `"${String(overrides.version ?? '1')}"`,
  });
const send = async (
  response: Response | Error,
  request: TaxonomyVersionRequest = first,
) => {
  const fetcher = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const result = await submitTaxonomyVersion(
    request,
    CSRF,
    KEY,
    fetcher as unknown as typeof fetch,
  );
  return { result, fetcher };
};

describe('submitTaxonomyVersion: the request', () => {
  it('posts the exact body to the version path without If-Match on a first version', async () => {
    const { fetcher } = await send(created());
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/v1/cms/taxonomies/versions');
    expect(init.body).toBe(JSON.stringify(first));
    expect(init.headers).toEqual({
      'content-type': 'application/json',
      'x-csrf-token': CSRF,
      'idempotency-key': KEY,
    });
  });

  it('sends the strong If-Match that names expectedVersion on a successor', async () => {
    const { fetcher } = await send(
      created({ version: '4', taxonomyVersion: 4 }),
      successor,
    );
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ 'if-match': '"3"' });
  });
});

describe('submitTaxonomyVersion: a verified draft', () => {
  it('is created with the facts the form shows', async () => {
    expect((await send(created())).result).toEqual({
      kind: 'created',
      resource: {
        id: ROW_ID,
        taxonomyId: TAXONOMY_ID,
        taxonomyKey: 'instruments',
        taxonomyVersion: 1,
        version: '1',
      },
    });
    expect(
      (await send(created({ version: '4', taxonomyVersion: 4 }), successor))
        .result,
    ).toMatchObject({
      kind: 'created',
      resource: { taxonomyVersion: 4, version: '4' },
    });
  });

  it.each([
    ['a 200', jsonResponse(200, versionFixture(), { etag: '"1"' })],
    ['an active resource', created({ state: 'active' })],
    ['another key', created({ taxonomyKey: 'other-key' })],
    [
      'a version that is not parent + 1',
      created({ version: '2', taxonomyVersion: 2 }),
    ],
    ['a version that differs from its number', created({ taxonomyVersion: 2 })],
    ['another shape', created({ shape: 'flat' })],
    ['other type keys', created({ allowedTypeKeys: ['article'] })],
    [
      'type keys in another order',
      created({ allowedTypeKeys: ['profile', 'article'] }),
    ],
    ['other field keys', created({ allowedFieldKeys: ['topics'] })],
    ['other declared domains', created({ canonicalOverlapDomains: [] })],
    ['an ETag that is not the version', created({}, '"9"')],
    ['a missing ETag', jsonResponse(201, versionFixture())],
    [
      'a malformed id',
      jsonResponse(201, { ...versionFixture(), id: 'x' }, { etag: '"1"' }),
    ],
    [
      'a malformed lineage id',
      jsonResponse(
        201,
        { ...versionFixture(), taxonomyId: 'x' },
        { etag: '"1"' },
      ),
    ],
    [
      'a body that is not JSON',
      new Response('x', { status: 201, headers: { etag: '"1"' } }),
    ],
    [
      'a body that is not the resource',
      jsonResponse(201, { id: 'x' }, { etag: '"1"' }),
    ],
  ])('treats %s as an unknown outcome', async (_name, response) => {
    expect((await send(response)).result).toEqual({ kind: 'uncertain' });
  });
});

describe('submitTaxonomyVersion: definite answers', () => {
  it('reports a conflict, the typed capability refusal, a rejection and a wait', async () => {
    expect(
      (
        await send(
          jsonResponse(
            409,
            taxonomyApiError('CMS-03C-16', 409, { currentVersion: '5' }),
          ),
          successor,
        )
      ).result,
    ).toEqual({ kind: 'conflict', currentVersion: '5' });
    expect(
      (
        await send(
          jsonResponse(
            403,
            taxonomyApiError('CMS-03C-16', 403, {
              reasonCode: 'capability_missing',
            }),
          ),
        )
      ).result,
    ).toEqual({ kind: 'refused', status: 403, reason: 'capability_missing' });
    expect(
      (await send(jsonResponse(422, taxonomyApiError('CMS-03C-16', 422))))
        .result,
    ).toEqual({ kind: 'rejected', status: 422 });
    expect(
      (
        await send(
          jsonResponse(
            429,
            taxonomyApiError('CMS-03C-16', 429, { retryAfterSeconds: 3 }),
            { 'retry-after': '3' },
          ),
        )
      ).result,
    ).toEqual({ kind: 'rejected', status: 429, retryAfterSeconds: 3 });
  });

  it('is uncertain when the network fails', async () => {
    expect((await send(new Error('offline'))).result).toEqual({
      kind: 'uncertain',
    });
  });
});
