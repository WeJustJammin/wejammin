import { describe, expect, it, vi } from 'vitest';

import { readCmsCompositionUpdateDiff } from './cms-composition-instances-diff';
import {
  apiError,
  binding,
  diffResource,
  forwardedOf,
  instanceId,
  instanceId2,
  json,
  request,
} from './cms-composition-instances.test-support';

/*
 * CMS-03C-14 first-party read proxy (FE03 887, 1615; BE03c 176; P2-S12-AC-117): addressed by the instance UUID alone,
 * relayed only as the strict diff resource of THAT instance whose strong ETag is the instance version.
 */
const path = (id = instanceId) =>
  `/api/v1/cms/compositions/instances/${id}/update-diff`;
const get = (
  id = instanceId,
  suffix = '',
  headers: Record<string, string> = {},
) => request({ url: `${path(id)}${suffix}`, headers });
const ok = (value: unknown = diffResource(), etag = '"3"') =>
  json(value, 200, { etag });

describe('CMS-03C-14 diff proxy: forwarding', () => {
  it('forwards a bodiless GET with the session only and relays the diff with its instance-version ETag', async () => {
    const stub = binding(ok());
    const response = await readCmsCompositionUpdateDiff(
      get(instanceId, '', { 'if-none-match': '"3"' }),
      instanceId,
      stub,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(diffResource());
    expect(response.headers.get('etag')).toBe('"3"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const forwarded = forwardedOf(stub);
    expect(forwarded.method).toBe('GET');
    expect(forwarded.url).toBe(`https://platform-api.internal${path()}`);
    expect(forwarded.headers.get('cookie')).toBe(
      'wj_access=protected; wj_csrf=csrf-token-123',
    );
    expect(forwarded.headers.has('if-none-match')).toBe(false);
    expect(forwarded.body).toBeNull();
  });

  it('relays the no-update answer: the pin is the target and the diff is empty', async () => {
    const empty = diffResource({
      targetPatternVersion: 1,
      paths: [],
      newRoots: [],
      collisionCount: 0,
      bulkEligible: false,
    });
    const response = await readCmsCompositionUpdateDiff(
      get(),
      instanceId,
      binding(ok(empty)),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(empty);
  });
});

describe('CMS-03C-14 diff proxy: admission before any upstream call', () => {
  const refused: Array<[string, Request, string | undefined, number]> = [
    ['a POST', request({ url: path(), method: 'POST' }), instanceId, 400],
    ['any query, even an empty one', get(instanceId, '?'), instanceId, 400],
    ['a query key', get(instanceId, '?cursor=x'), instanceId, 400],
    ['a malformed id', get('not-a-uuid'), 'not-a-uuid', 400],
    ['a missing id', get(), undefined, 400],
    [
      'an Idempotency-Key',
      get(instanceId, '', { 'idempotency-key': 'composition-key-0001' }),
      instanceId,
      400,
    ],
    [
      'an If-Match',
      get(instanceId, '', { 'if-match': '"3"' }),
      instanceId,
      400,
    ],
    [
      'request media',
      get(instanceId, '', { 'content-type': 'application/json' }),
      instanceId,
      415,
    ],
    [
      'a foreign origin',
      get(instanceId, '', { origin: 'https://evil.test' }),
      instanceId,
      403,
    ],
  ];
  it.each(refused)('refuses %s', async (_name, built, id, status) => {
    const fetch = vi.fn();
    const response = await readCmsCompositionUpdateDiff(built, id, { fetch });
    expect(response.status).toBe(status);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('is unavailable without a platform binding', async () => {
    expect(
      (await readCmsCompositionUpdateDiff(get(), instanceId, undefined)).status,
    ).toBe(503);
  });
});

describe('CMS-03C-14 diff proxy: the answer is verified before it is relayed', () => {
  const run = (upstream: Response, id = instanceId) =>
    readCmsCompositionUpdateDiff(get(id), id, binding(upstream));

  it.each([
    [
      'a body that is not the strict diff',
      ok({ ...diffResource(), extra: 1 }),
      instanceId,
    ],
    ['the diff of another instance', ok(diffResource(), '"3"'), instanceId2],
    [
      'an ETag that is not the instance version',
      ok(diffResource(), '"4"'),
      instanceId,
    ],
    ['a missing ETag', json(diffResource()), instanceId],
    [
      'a collision count that disagrees with the paths',
      ok(diffResource({ collisionCount: 0, bulkEligible: true })),
      instanceId,
    ],
    [
      'an undeclared 409',
      apiError(409, 'COMPOSITION_VERSION_CONFLICT'),
      instanceId,
    ],
  ])('answers 502 for %s', async (_name, upstream, id) => {
    expect((await run(upstream, id)).status).toBe(502);
  });

  it('refuses a diff of more than 128 paths', async () => {
    const plain = (index: number) => ({
      path: `/p${String(index).padStart(3, '0')}`,
      base: null,
      theirs: null,
      yours: null,
      collision: false,
      collisionKind: null,
    });
    const many = diffResource({
      paths: Array.from({ length: 129 }, (_, index) => plain(index)),
      collisionCount: 0,
      bulkEligible: true,
    });
    expect((await run(ok(many))).status).toBe(502);
    const limit = diffResource({
      paths: Array.from({ length: 128 }, (_, index) => plain(index)),
      collisionCount: 0,
      bulkEligible: true,
    });
    expect((await run(ok(limit))).status).toBe(200);
  });

  it('refuses a diff whose body exceeds 256 KiB without reading past the cap', async () => {
    const big = new Response('x'.repeat(262_145), {
      status: 200,
      headers: { 'content-type': 'application/json', etag: '"3"' },
    });
    expect((await run(big)).status).toBe(502);
  });
});

describe('CMS-03C-14 diff proxy: refusals', () => {
  const run = (upstream: Response) =>
    readCmsCompositionUpdateDiff(get(), instanceId, binding(upstream));
  const detailsOf = async (response: Response) =>
    ((await response.json()) as { details: unknown }).details;

  it('relays the typed diff_too_large 422 and drops a token of another operation or status', async () => {
    const typed = await run(
      apiError(422, 'COMPOSITION_VALIDATION_FAILED', {
        reasonCode: 'diff_too_large',
      }),
    );
    expect(typed.status).toBe(422);
    expect(await detailsOf(typed)).toEqual({ reasonCode: 'diff_too_large' });
    const other = await run(
      apiError(422, 'COMPOSITION_VALIDATION_FAILED', {
        reasonCode: 'pattern_incompatible',
      }),
    );
    expect(await detailsOf(other)).toEqual({});
  });

  it('relays 403 with the capability token, 404 and 401 with a sign-in recovery', async () => {
    const denied = await run(
      apiError(403, 'COMPOSITION_FORBIDDEN', {
        reasonCode: 'capability_missing',
      }),
    );
    expect(await detailsOf(denied)).toEqual({
      reasonCode: 'capability_missing',
    });
    expect((await run(apiError(404, 'COMPOSITION_NOT_FOUND'))).status).toBe(
      404,
    );
    const unauthenticated = await run(apiError(401, 'UNAUTHENTICATED'));
    expect(await detailsOf(unauthenticated)).toEqual({
      recoveryAction: 'reauthenticate',
    });
  });

  it('relays 429 with its bounded wait and a dependency failure as retryable', async () => {
    const limited = await run(
      apiError(
        429,
        'RATE_LIMITED',
        { retryAfterSeconds: 7, limit: 300 },
        { 'retry-after': '7' },
      ),
    );
    expect(limited.headers.get('retry-after')).toBe('7');
    expect(await detailsOf(limited)).toEqual({
      retryAfterSeconds: 7,
      limit: 300,
    });
    const down = await run(
      apiError(503, 'DEPENDENCY_UNAVAILABLE', { raw: 'x' }),
    );
    expect(await detailsOf(down)).toEqual({
      dependencyClass: 'cms_composition',
      retryable: true,
    });
    expect(
      (
        await readCmsCompositionUpdateDiff(
          get(),
          instanceId,
          binding(new Error('x')),
        )
      ).status,
    ).toBe(503);
  });
});
