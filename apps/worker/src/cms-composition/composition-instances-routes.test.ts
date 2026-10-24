import {
  ApiErrorSchema,
  CmsCompositionRefusalDetailsSchema,
  CompositionInstancePageSchema,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  CI_CURSOR,
  CI_ENTRY_ID,
  CI_PAGE_SIZE,
  ciPage,
  ciPath,
  ciRow,
} from './composition-instances.test-support';
import { failure } from './pattern-instance-contracts';
import {
  createPatternUpdateHarness,
  puSession,
} from './pattern-update-routes.test-support';
import { PU_ORIGIN, PU_REVISION_ID, puId } from './pattern-update.test-support';

/**
 * cmsCompositionInstancesRead (DEC-206; BE03c route registry, validation `entryId/cursor`, error matrix, authority): the
 * protected list of the instances of an entry's current draft revision. The path is a UUID and the only query key is an
 * opaque cursor; the answer is the strict page and is never cached.
 */
describe('cmsCompositionInstancesRead route', () => {
  it('serves the strict page, uncached, with no entity tag', async () => {
    const harness = createPatternUpdateHarness();
    const response = await harness.request(ciPath());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('etag')).toBeNull();
    expect(CompositionInstancePageSchema.parse(await response.json())).toEqual(
      ciPage(),
    );
    expect(harness.readInstances.mock.calls[0]?.[0]).toMatchObject({
      operationId: 'cmsCompositionInstancesRead',
      entryId: CI_ENTRY_ID,
      limit: 25,
    });
    expect(harness.readInstances.mock.calls[0]?.[0]).not.toHaveProperty(
      'cursor',
    );
  });

  it('passes the cursor byte for byte', async () => {
    const harness = createPatternUpdateHarness();
    const cursor = 'a+b/c=d==';
    const response = await harness.request(
      ciPath(CI_ENTRY_ID, `?cursor=${encodeURIComponent(cursor)}`),
    );
    expect(response.status).toBe(200);
    expect(harness.readInstances.mock.calls[0]?.[0]).toMatchObject({
      entryId: CI_ENTRY_ID,
      cursor,
    });
  });

  it('serves an empty page of an entry without a draft revision', async () => {
    const harness = createPatternUpdateHarness({
      readInstances: async () => ({
        ok: true,
        value: { revisionId: null, items: [], nextCursor: null },
      }),
    });
    const response = await harness.request(ciPath());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      revisionId: null,
      items: [],
      nextCursor: null,
    });
  });

  it('serves a full page with its cursor', async () => {
    const full = ciPage(CI_PAGE_SIZE, { nextCursor: CI_CURSOR });
    const harness = createPatternUpdateHarness({
      readInstances: async () => ({ ok: true, value: full }),
    });
    const response = await harness.request(ciPath());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(full);
  });

  it.each([
    ['a malformed entry id', ciPath('not-a-uuid')],
    ['any other query key', ciPath(CI_ENTRY_ID, '?offset=5')],
    ['an empty limit', ciPath(CI_ENTRY_ID, '?limit=')],
    ['a repeated limit', ciPath(CI_ENTRY_ID, '?limit=5&limit=5')],
    ['a zero limit', ciPath(CI_ENTRY_ID, '?limit=0')],
    ['a negative limit', ciPath(CI_ENTRY_ID, '?limit=-1')],
    ['a limit above 50', ciPath(CI_ENTRY_ID, '?limit=51')],
    ['a limit of 100', ciPath(CI_ENTRY_ID, '?limit=100')],
    ['a fractional limit', ciPath(CI_ENTRY_ID, '?limit=2.5')],
    ['an exponent limit', ciPath(CI_ENTRY_ID, '?limit=1e1')],
    ['a padded limit', ciPath(CI_ENTRY_ID, '?limit=05')],
    ['a signed limit', ciPath(CI_ENTRY_ID, '?limit=%2B5')],
    ['a non-numeric limit', ciPath(CI_ENTRY_ID, '?limit=abc')],
    [
      'a limit of any magnitude beyond 50',
      ciPath(CI_ENTRY_ID, `?limit=${'9'.repeat(40)}`),
    ],
    ['a revision key', ciPath(CI_ENTRY_ID, `?revisionId=${PU_REVISION_ID}`)],
    ['an empty cursor', ciPath(CI_ENTRY_ID, '?cursor=')],
    [
      'a repeated cursor',
      ciPath(CI_ENTRY_ID, `?cursor=${CI_CURSOR}&cursor=${CI_CURSOR}`),
    ],
    [
      'a cursor over 512 characters',
      ciPath(CI_ENTRY_ID, `?cursor=${'a'.repeat(513)}`),
    ],
    [
      'an unknown key beside the cursor',
      ciPath(CI_ENTRY_ID, `?cursor=${CI_CURSOR}&debug=1`),
    ],
  ])('%s is 400 before any quota or port', async (_name, path) => {
    const harness = createPatternUpdateHarness();
    const response = await harness.request(path);
    expect(response.status).toBe(400);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(
      'INVALID_REQUEST',
    );
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.readInstances).not.toHaveBeenCalled();
  });

  it('a cursor of exactly 512 characters is admitted', async () => {
    const harness = createPatternUpdateHarness();
    const response = await harness.request(
      ciPath(CI_ENTRY_ID, `?cursor=${'a'.repeat(512)}`),
    );
    expect(response.status).toBe(200);
  });

  it.each([
    ['an Idempotency-Key', { 'idempotency-key': 'pattern-update-0001' }, 400],
    ['an If-Match', { 'if-match': '"3"' }, 400],
    ['a request media type', { 'content-type': 'application/json' }, 415],
    ['a declared body', { 'content-length': '5' }, 400],
  ])('a read carrying %s is $2', async (_name, headers, status) => {
    const harness = createPatternUpdateHarness();
    const response = await harness.request(ciPath(), { headers });
    expect(response.status).toBe(status);
    expect(harness.readInstances).not.toHaveBeenCalled();
  });

  it('a malformed path is answered after authentication, never before', async () => {
    const harness = createPatternUpdateHarness({
      resolveSession: async () => ({
        ok: false,
        status: 401,
        code: 'U',
        message: 'u',
      }),
    });
    expect((await harness.request(ciPath('nope'))).status).toBe(401);
  });

  it('a caller with neither author nor editor capability is 403 and consumes no quota', async () => {
    const harness = createPatternUpdateHarness({
      resolveSession: async () => ({
        ok: true,
        value: puSession(['cms.template_designer']),
      }),
    });
    const response = await harness.request(ciPath());
    expect(response.status).toBe(403);
    expect(ApiErrorSchema.parse(await response.json())).toMatchObject({
      code: 'COMPOSITION_FORBIDDEN',
      details: { reasonCode: 'capability_missing' },
    });
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.readInstances).not.toHaveBeenCalled();
  });

  it('charges the user bucket then the party bucket of the registry row: 300 and 600 a minute', async () => {
    const harness = createPatternUpdateHarness();
    await harness.request(ciPath());
    expect(harness.rateLimit.mock.calls.map(([input]) => input)).toMatchObject([
      {
        operationId: 'cmsCompositionInstancesRead',
        rateClass: 'cms-composition-instances-read',
        rateScope: 'user',
        limit: 300,
        windowSeconds: 60,
      },
      {
        operationId: 'cmsCompositionInstancesRead',
        rateClass: 'cms-composition-instances-read',
        rateScope: 'party',
        limit: 600,
        windowSeconds: 60,
      },
    ]);
  });

  it.each([
    [404, 'COMPOSITION_NOT_FOUND', {}],
    [403, 'COMPOSITION_FORBIDDEN', { reasonCode: 'capability_missing' }],
  ] as const)('publishes %i %s', async (status, code, details) => {
    const harness = createPatternUpdateHarness({
      readInstances: async () =>
        failure(status, { ...details, violations: [{ path: '/entryId' }] }),
    });
    const response = await harness.request(ciPath());
    expect(response.status).toBe(status);
    const body = ApiErrorSchema.parse(await response.json());
    expect(body.code).toBe(code);
    expect(body.details).toEqual(details);
    if (status === 403)
      expect(
        CmsCompositionRefusalDetailsSchema.safeParse(body.details).success,
      ).toBe(true);
  });

  it('publishes a 400 from the database as INVALID_REQUEST', async () => {
    const harness = createPatternUpdateHarness({
      readInstances: async () => failure(400),
    });
    const response = await harness.request(
      ciPath(CI_ENTRY_ID, `?cursor=${CI_CURSOR}`),
    );
    expect(response.status).toBe(400);
    expect(ApiErrorSchema.parse(await response.json()).code).toBe(
      'INVALID_REQUEST',
    );
  });

  it.each([
    [409, { reasonCode: 'revision_not_editable' }],
    [422, { reasonCode: 'diff_too_large' }],
  ] as const)(
    'a %i from the port is not an answer of this read: the scrubbed internal error',
    async (status, details) => {
      const harness = createPatternUpdateHarness({
        readInstances: async () => failure(status, details),
      });
      const response = await harness.request(ciPath());
      expect(response.status).toBe(500);
      expect(ApiErrorSchema.parse(await response.json())).toMatchObject({
        code: 'INTERNAL_ERROR',
      });
    },
  );

  it.each([
    [
      'a row of another revision',
      ciPage(2, {
        items: [ciRow(0), ciRow(1, { revisionId: puId(999) })],
      }),
    ],
    [
      'a superseded row',
      ciPage(1, { items: [ciRow(0, { state: 'superseded' })] }),
    ],
    ['a retired row', ciPage(1, { items: [ciRow(0, { state: 'retired' })] })],
    ['a row twice', ciPage(2, { items: [ciRow(0), ciRow(0)] })],
    [
      'two rows on one path',
      ciPage(2, { items: [ciRow(0), ciRow(1, { path: ciRow(0).path })] }),
    ],
    ['a cursor on a short page', ciPage(3, { nextCursor: CI_CURSOR })],
    ['more than the default page of rows', ciPage(CI_PAGE_SIZE + 1)],
    [
      'a cursor over 512 characters',
      ciPage(CI_PAGE_SIZE, { nextCursor: 'c'.repeat(513) }),
    ],
    ['an empty cursor', ciPage(CI_PAGE_SIZE, { nextCursor: '' })],
    [
      'a null revision with rows',
      { revisionId: null, items: [ciRow(0)], nextCursor: null },
    ],
    ['a member outside the contract', { ...ciPage(1), pageVersion: '1' }],
  ])('an answer with %s is a local 502, never shown', async (_name, value) => {
    const harness = createPatternUpdateHarness({
      readInstances: async () => ({ ok: true, value: value as never }),
    });
    const response = await harness.request(ciPath());
    expect(response.status).toBe(502);
    expect(response.headers.get('etag')).toBeNull();
  });

  it('a null revision that still offers a next page is a local 502', async () => {
    const harness = createPatternUpdateHarness({
      readInstances: async () => ({
        ok: true,
        value: { revisionId: null, items: [], nextCursor: CI_CURSOR },
      }),
    });
    expect((await harness.request(ciPath())).status).toBe(502);
  });

  it('a cursor request answered with a null revision is a local 502: no cursor was issued for it', async () => {
    const harness = createPatternUpdateHarness({
      readInstances: async () => ({
        ok: true,
        value: { revisionId: null, items: [], nextCursor: null },
      }),
    });
    const response = await harness.request(
      ciPath(CI_ENTRY_ID, `?cursor=${CI_CURSOR}`),
    );
    expect(response.status).toBe(502);
  });

  it('the entry id is passed as received', async () => {
    const upper = CI_ENTRY_ID.toUpperCase();
    const harness = createPatternUpdateHarness();
    const response = await harness.request(ciPath(upper));
    expect(response.status).toBe(200);
    expect(harness.readInstances.mock.calls[0]?.[0].entryId).toBe(upper);
  });

  it('answers the preflight: allowed origin 204 GET only, bad origin 403, bad id 400', async () => {
    const harness = createPatternUpdateHarness();
    const allowed = await harness.request(ciPath(), { method: 'OPTIONS' });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-methods')).toBe(
      'GET, OPTIONS',
    );
    expect(allowed.headers.get('access-control-allow-origin')).toBe(PU_ORIGIN);
    const denied = await harness.request(ciPath(), {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example.test' },
    });
    expect(denied.status).toBe(403);
    const bad = await harness.request(ciPath('nope'), { method: 'OPTIONS' });
    expect(bad.status).toBe(400);
  });

  it('is the only operation on the compositions path: no write method is routed', async () => {
    const harness = createPatternUpdateHarness();
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'])
      expect(
        (await harness.request(ciPath(), { method })).status,
      ).toBeGreaterThanOrEqual(400);
    expect(harness.readInstances).not.toHaveBeenCalled();
  });
});
