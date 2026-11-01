import type { TaxonomyTermActionRequest } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  CANONICAL_ID,
  CSRF,
  KEY,
  PARENT_ID,
  SURVIVOR_ID,
  TAXONOMY_ID,
  TERM_ID,
  jsonResponse,
  taxonomyApiError,
  termActionBody,
  termResourceFixture,
} from '../../server/cms-taxonomy-platform.test-support';
import { submitTermAction } from './term-action-submit';

const OTHER_ID = '90000000-0000-4000-8000-000000000099';
const request = (overrides: Readonly<Record<string, unknown>> = {}) =>
  termActionBody(overrides) as unknown as TaxonomyTermActionRequest;
const ok = (overrides: Readonly<Record<string, unknown>> = {}, etag?: string) =>
  jsonResponse(200, termResourceFixture(overrides), {
    etag: etag ?? `"${String(overrides.version ?? '1')}"`,
  });
const send = async (response: Response | Error, body = request()) => {
  const fetcher = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const result = await submitTermAction(
    body,
    CSRF,
    KEY,
    fetcher as unknown as typeof fetch,
  );
  return { result, fetcher };
};

describe('submitTermAction: the request', () => {
  it('posts the exact body to the vocabulary path with the active version as If-Match', async () => {
    const { fetcher } = await send(ok());
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`/api/v1/cms/taxonomies/${TAXONOMY_ID}/terms/actions`);
    expect(init.body).toBe(JSON.stringify(request()));
    expect(init.headers).toEqual({
      'content-type': 'application/json',
      'x-csrf-token': CSRF,
      'idempotency-key': KEY,
      'if-match': '"2"',
    });
  });
});

describe('submitTermAction: a verified term', () => {
  it('is done with the facts the form shows', async () => {
    expect((await send(ok())).result).toEqual({
      kind: 'done',
      term: {
        termId: TERM_ID,
        termKey: 'guitar',
        lifecycle: 'active',
        parentId: null,
        successorId: null,
        version: '1',
      },
    });
  });

  it('binds a rename and an alias to a later version of an active or deprecated term', async () => {
    for (const action of ['rename', 'alias'] as const) {
      expect(
        (await send(ok({ version: '3' }), request({ action }))).result.kind,
      ).toBe('done');
      expect(
        (
          await send(
            ok({ version: '3', lifecycle: 'deprecated' }),
            request({ action }),
          )
        ).result.kind,
      ).toBe('done');
      expect(
        (await send(ok({ version: '1' }), request({ action }))).result.kind,
      ).toBe('uncertain');
    }
    expect(
      (
        await send(
          ok({ version: '3', parentId: PARENT_ID }),
          request({ action: 'rename', parentId: null }),
        )
      ).result.kind,
    ).toBe('uncertain');
    expect(
      (
        await send(
          ok({ version: '3', parentId: PARENT_ID }),
          request({ action: 'alias', parentId: null }),
        )
      ).result.kind,
    ).toBe('done');
  });

  it('binds a deprecate to a deprecated term and a merge to a merged term redirecting to the survivor', async () => {
    const deprecate = request({ action: 'deprecate' });
    expect(
      (await send(ok({ version: '2', lifecycle: 'deprecated' }), deprecate))
        .result.kind,
    ).toBe('done');
    expect((await send(ok({ version: '2' }), deprecate)).result.kind).toBe(
      'uncertain',
    );
    const merge = request({ action: 'merge', survivorId: SURVIVOR_ID });
    expect(
      (
        await send(
          ok({ version: '3', lifecycle: 'merged', successorId: SURVIVOR_ID }),
          merge,
        )
      ).result,
    ).toEqual({
      kind: 'done',
      term: {
        termId: TERM_ID,
        termKey: 'guitar',
        lifecycle: 'merged',
        parentId: null,
        successorId: SURVIVOR_ID,
        version: '3',
      },
    });
    expect(
      (
        await send(
          ok({ version: '3', lifecycle: 'merged', successorId: OTHER_ID }),
          merge,
        )
      ).result.kind,
    ).toBe('uncertain');
    expect((await send(ok({ version: '3' }), merge)).result.kind).toBe(
      'uncertain',
    );
  });

  it.each([
    ['a create at a later version', ok({ version: '2' })],
    ['a create that is not active', ok({ lifecycle: 'deprecated' })],
    ['another key', ok({ termKey: 'other' })],
    ['another vocabulary', ok({ taxonomyId: OTHER_ID })],
    ['a create with another parent', ok({ parentId: PARENT_ID })],
    ['a term whose id differs from its term id', ok({ id: SURVIVOR_ID })],
    ['a 201', jsonResponse(201, termResourceFixture(), { etag: '"1"' })],
    ['an ETag that is not the version', ok({}, '"9"')],
    ['a missing ETag', jsonResponse(200, termResourceFixture())],
    [
      'a malformed term id',
      jsonResponse(
        200,
        { ...termResourceFixture(), termId: 'x' },
        { etag: '"1"' },
      ),
    ],
    [
      'an unknown lifecycle',
      jsonResponse(
        200,
        { ...termResourceFixture(), lifecycle: 'gone' },
        { etag: '"1"' },
      ),
    ],
    [
      'a body that is not JSON',
      new Response('x', { status: 200, headers: { etag: '"1"' } }),
    ],
    [
      'a body that is not the resource',
      jsonResponse(200, { id: 'x' }, { etag: '"1"' }),
    ],
  ])('treats %s as an unknown outcome', async (_name, response) => {
    expect((await send(response)).result).toEqual({ kind: 'uncertain' });
  });
});

describe('submitTermAction: definite answers', () => {
  it('reports the typed refusals with their members', async () => {
    const refusal = (status: number, details: Record<string, unknown>) =>
      jsonResponse(status, taxonomyApiError('CMS-03C-03', status, details));
    expect(
      (await send(refusal(409, { reasonCode: 'taxonomy_not_active' }))).result,
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
      ).result,
    ).toEqual({
      kind: 'refused',
      status: 422,
      reason: 'canonical_overlap',
      domain: 'role',
      canonicalId: CANONICAL_ID,
    });
    expect((await send(refusal(409, { currentVersion: '5' }))).result).toEqual({
      kind: 'conflict',
      currentVersion: '5',
    });
    expect((await send(refusal(404, {}))).result).toEqual({
      kind: 'rejected',
      status: 404,
    });
    expect((await send(new Error('offline'))).result).toEqual({
      kind: 'uncertain',
    });
  });
});
