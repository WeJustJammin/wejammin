import { describe, expect, it, vi } from 'vitest';

import { forwardCmsCompositionPatternUpdate } from './cms-composition-instances-update';
import {
  acceptBody,
  apiError,
  binding,
  forwardedOf,
  instanceId,
  instanceId2,
  json,
  request,
  rowOf,
} from './cms-composition-instances.test-support';

/*
 * CMS-03C-15 first-party mutation proxy (FE03 887, 1616, 1745; BE03c 179; P2-S12-AC-123): JSON, CSRF, origin,
 * Idempotency-Key and an If-Match equal to the entry version in the body, relayed only as the strict resource that is
 * the answer to THIS request.
 */
const path = '/api/v1/cms/compositions/pattern-updates';
const post = (
  options: {
    body?: unknown;
    rawBody?: string;
    headers?: Record<string, string>;
    url?: string;
  } = {},
) => request({ url: options.url ?? path, method: 'POST', ...options });
const accepted = (
  items = [rowOf(instanceId, '4', { linkMode: 'linked' })],
  etag = '"10"',
) => json({ items }, 200, { etag });
const detachBody = {
  action: 'detach',
  instances: [{ instanceId, expectedVersion: '3', choices: [] }],
  expectedVersion: '9',
};
const twoBody = {
  action: 'accept',
  targetPatternVersion: 2,
  instances: [
    { instanceId, expectedVersion: '3', choices: [] },
    { instanceId: instanceId2, expectedVersion: '5', choices: [] },
  ],
  expectedVersion: '9',
};

describe('CMS-03C-15 update proxy: forwarding', () => {
  it('forwards the exact JSON with the transport headers and the session only, and relays the answer', async () => {
    const stub = binding(accepted());
    const response = await forwardCmsCompositionPatternUpdate(post(), stub);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [rowOf(instanceId, '4', { linkMode: 'linked' })],
    });
    expect(response.headers.get('etag')).toBe('"10"');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const forwarded = forwardedOf(stub);
    expect(forwarded.method).toBe('POST');
    expect(forwarded.url).toBe(`https://platform-api.internal${path}`);
    expect(await forwarded.json()).toEqual(acceptBody);
    expect(forwarded.headers.get('idempotency-key')).toBe(
      'composition-update-0001',
    );
    expect(forwarded.headers.get('if-match')).toBe('"9"');
    expect(forwarded.headers.get('x-csrf-token')).toBe('csrf-token-123');
    expect(forwarded.headers.get('cookie')).toBe(
      'wj_access=protected; wj_csrf=csrf-token-123',
    );
  });

  it('relays a bulk accept of two instances in request order and a detach as detached active rows', async () => {
    const bulk = await forwardCmsCompositionPatternUpdate(
      post({ body: twoBody }),
      binding(
        accepted([
          rowOf(instanceId, '4', { linkMode: 'linked' }),
          rowOf(instanceId2, '6', { linkMode: 'linked' }),
        ]),
      ),
    );
    expect(bulk.status).toBe(200);
    const detach = await forwardCmsCompositionPatternUpdate(
      post({ body: detachBody }),
      binding(accepted([rowOf(instanceId, '4', { linkMode: 'detached' })])),
    );
    expect(detach.status).toBe(200);
  });
});

describe('CMS-03C-15 update proxy: admission before any upstream call', () => {
  const refused: Array<[string, Request, number]> = [
    ['a GET', request({ url: path }), 400],
    ['a query', post({ url: `${path}?x=1` }), 400],
    [
      'a foreign origin',
      post({ headers: { origin: 'https://evil.test' } }),
      403,
    ],
    [
      'a CSRF token that is not the cookie',
      post({ headers: { 'x-csrf-token': 'other-token-9' } }),
      403,
    ],
    ['other media', post({ headers: { 'content-type': 'text/plain' } }), 415],
    [
      'a missing Idempotency-Key',
      post({ headers: { 'idempotency-key': '' } }),
      400,
    ],
    [
      'an If-Match that is not the body entry version',
      post({ headers: { 'if-match': '"8"' } }),
      400,
    ],
    ['a body that is not JSON', post({ rawBody: '{nope' }), 400],
    [
      'an unknown body member',
      post({ body: { ...acceptBody, extra: true } }),
      422,
    ],
    [
      'choices on a bulk request',
      post({
        body: {
          ...twoBody,
          instances: [
            {
              instanceId,
              expectedVersion: '3',
              choices: [{ path: '/a', choice: 'yours' }],
            },
            { instanceId: instanceId2, expectedVersion: '5', choices: [] },
          ],
        },
      }),
      422,
    ],
    [
      'more than 32 instances',
      post({
        body: {
          action: 'detach',
          instances: Array.from({ length: 33 }, (_, i) => ({
            instanceId: `d4000000-0000-4000-8000-0000000002${String(i).padStart(2, '0')}`,
            expectedVersion: '1',
            choices: [],
          })),
          expectedVersion: '9',
        },
      }),
      422,
    ],
  ];
  it.each(refused)('refuses %s', async (_name, built, status) => {
    const fetch = vi.fn();
    const response = await forwardCmsCompositionPatternUpdate(built, { fetch });
    expect(response.status).toBe(status);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('is unavailable without a platform binding', async () => {
    expect(
      (await forwardCmsCompositionPatternUpdate(post(), undefined)).status,
    ).toBe(503);
  });
});

describe('CMS-03C-15 update proxy: an unverifiable success is an unknown outcome', () => {
  const run = async (upstream: Response, body: unknown = acceptBody) =>
    forwardCmsCompositionPatternUpdate(post({ body }), binding(upstream));

  it.each([
    [
      'a body that is not the strict resource',
      json({ items: [rowOf(instanceId, '4')], extra: 1 }, 200, {
        etag: '"10"',
      }),
    ],
    [
      'an ETag that is not the entry version plus one',
      accepted(undefined, '"11"'),
    ],
    ['a missing ETag', json({ items: [rowOf(instanceId, '4')] })],
    [
      'a row that is not the next instance version',
      accepted([rowOf(instanceId, '7')]),
    ],
    [
      'a different number of rows than instances',
      accepted([rowOf(instanceId, '4'), rowOf(instanceId2, '6')]),
    ],
    [
      'a linked row pinned to another version',
      accepted([rowOf(instanceId, '4', { patternVersion: 1 })]),
    ],
    ['a 201', json({ items: [rowOf(instanceId, '4')] }, 201, { etag: '"10"' })],
  ])(
    'marks %s as an unknown outcome behind a local 502',
    async (_name, upstream) => {
      const response = await run(upstream);
      expect(response.status).toBe(502);
      expect(response.headers.get('x-cms-editorial-outcome')).toBe('unknown');
    },
  );

  it('refuses a bulk accept answered with fewer rows than instances', async () => {
    const response = await run(accepted([rowOf(instanceId, '4')]), twoBody);
    expect(response.status).toBe(502);
    expect(response.headers.get('x-cms-editorial-outcome')).toBe('unknown');
  });

  it('refuses a detach answered with a still-linked row', async () => {
    const response = await run(
      accepted([rowOf(instanceId, '4', { linkMode: 'linked' })]),
      detachBody,
    );
    expect(response.status).toBe(502);
  });

  it('accepts a detached local copy that keeps an earlier pin only when the author chose to keep it', async () => {
    const kept = await run(
      accepted([
        rowOf(instanceId, '4', { linkMode: 'detached', patternVersion: 1 }),
      ]),
      {
        ...acceptBody,
        instances: [
          {
            instanceId,
            expectedVersion: '3',
            choices: [{ path: '/hero', choice: 'yours' }],
          },
        ],
      },
    );
    expect(kept.status).toBe(200);
    const unchosen = await run(
      accepted([
        rowOf(instanceId, '4', { linkMode: 'detached', patternVersion: 1 }),
      ]),
    );
    expect(unchosen.status).toBe(502);
  });

  it('accepts a retired row only when the author took the new structure', async () => {
    const taken = await run(
      accepted([
        rowOf(instanceId, '4', { state: 'retired', patternVersion: 1 }),
      ]),
    );
    expect(taken.status).toBe(200);
    const kept = await run(
      accepted([
        rowOf(instanceId, '4', { state: 'retired', patternVersion: 1 }),
      ]),
      {
        ...acceptBody,
        instances: [
          {
            instanceId,
            expectedVersion: '3',
            choices: [{ path: '/hero', choice: 'yours' }],
          },
        ],
      },
    );
    expect(kept.status).toBe(502);
  });
});

describe('CMS-03C-15 update proxy: refusals', () => {
  const run = (upstream: Response) =>
    forwardCmsCompositionPatternUpdate(post(), binding(upstream));
  const detailsOf = async (response: Response) =>
    ((await response.json()) as { details: unknown }).details;

  it.each([
    [409, 'COMPOSITION_VERSION_CONFLICT', 'diff_has_collisions'],
    [409, 'COMPOSITION_VERSION_CONFLICT', 'revision_not_editable'],
    [422, 'COMPOSITION_VALIDATION_FAILED', 'pattern_version_not_active'],
    [422, 'COMPOSITION_VALIDATION_FAILED', 'pattern_incompatible'],
    [403, 'COMPOSITION_FORBIDDEN', 'capability_missing'],
  ])(
    'relays the typed %s reason %s alone',
    async (status, code, reasonCode) => {
      const response = await run(
        apiError(status, code, { reasonCode, secret: 'x' }),
      );
      expect(response.status).toBe(status);
      expect(await detailsOf(response)).toEqual({ reasonCode });
    },
  );

  it.each(['/instances/0/choices', '/instances/3', '/instances/31/choices'])(
    'DEC-210 relays block_rules_violated with its one bounded violation %s and nothing else',
    async (path) => {
      const response = await run(
        apiError(422, 'COMPOSITION_VALIDATION_FAILED', {
          reasonCode: 'block_rules_violated',
          violations: [
            { path, code: 'block_rules_violated', message: 'private text' },
            { path: '/secret-pointer', code: 'x', message: 'x' },
          ],
          secret: 'x',
        }),
      );
      expect(response.status).toBe(422);
      expect(await detailsOf(response)).toEqual({
        reasonCode: 'block_rules_violated',
        violations: [
          {
            path,
            code: 'block_rules_violated',
            message: 'The value is invalid.',
          },
        ],
      });
    },
  );

  it('drops a token of another status or operation', async () => {
    const wrongStatus = await run(
      apiError(422, 'COMPOSITION_VALIDATION_FAILED', {
        reasonCode: 'diff_has_collisions',
      }),
    );
    expect(await detailsOf(wrongStatus)).toEqual({});
    const wrongOperation = await run(
      apiError(422, 'COMPOSITION_VALIDATION_FAILED', {
        reasonCode: 'diff_too_large',
      }),
    );
    expect(await detailsOf(wrongOperation)).toEqual({});
  });

  it('relays an untyped 409 as its version pair and an untyped 422 as bounded fixed-message violations', async () => {
    const conflict = await run(
      apiError(409, 'COMPOSITION_VERSION_CONFLICT', {
        expectedVersion: '9',
        currentVersion: '12',
      }),
    );
    expect(await detailsOf(conflict)).toEqual({
      expectedVersion: '9',
      currentVersion: '12',
    });
    const invalid = await run(
      apiError(422, 'COMPOSITION_VALIDATION_FAILED', {
        violations: [
          {
            path: '/instances/0/choices',
            code: 'invalid',
            message: 'private text',
          },
        ],
      }),
    );
    expect(await detailsOf(invalid)).toEqual({
      violations: [
        {
          path: '/instances/0/choices',
          code: 'invalid',
          message: 'The value is invalid.',
        },
      ],
    });
  });

  it('relays 404, 429 with a wait, a dependency failure, and turns a thrown binding into 503', async () => {
    expect((await run(apiError(404, 'COMPOSITION_NOT_FOUND'))).status).toBe(
      404,
    );
    const limited = await run(
      apiError(
        429,
        'RATE_LIMITED',
        { retryAfterSeconds: 9, limit: 60 },
        { 'retry-after': '9' },
      ),
    );
    expect(limited.headers.get('retry-after')).toBe('9');
    const down = await run(
      apiError(502, 'DEPENDENCY_UNAVAILABLE', { raw: 'x' }),
    );
    expect(await detailsOf(down)).toEqual({
      dependencyClass: 'cms_composition',
      retryable: true,
    });
    const thrown = await forwardCmsCompositionPatternUpdate(
      post(),
      binding(new Error('down')),
    );
    expect(thrown.status).toBe(503);
    expect(thrown.headers.get('x-cms-editorial-outcome')).toBe('unknown');
  });
});
