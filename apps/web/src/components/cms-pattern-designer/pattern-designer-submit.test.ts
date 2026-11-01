import type { PatternVersionRequest } from '@wejammin/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  CSRF,
  KEY,
  jsonResponse,
  patternApiError,
  patternRequestBody,
  patternResourceFixture,
} from '../../server/cms-pattern-platform.test-support';
import { PATTERN_WRITE_REASONS } from './pattern-designer-reasons';
import { submitPatternVersion } from './pattern-designer-submit';

const first = patternRequestBody() as unknown as PatternVersionRequest;
const successor = patternRequestBody({
  expectedVersion: '3',
}) as unknown as PatternVersionRequest;
const created = (
  overrides: Readonly<Record<string, unknown>> = {},
  etag?: string,
) =>
  jsonResponse(201, patternResourceFixture(overrides), {
    etag: etag ?? `"${String(overrides.version ?? '1')}"`,
  });
const send = async (
  response: Response | Error,
  request: PatternVersionRequest = first,
) => {
  const fetcher = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const result = await submitPatternVersion(
    request,
    CSRF,
    KEY,
    fetcher as unknown as typeof fetch,
  );
  return { result, fetcher };
};

describe('submitPatternVersion: the request', () => {
  it('posts the exact body with the CSRF token and key and no If-Match on a first version', async () => {
    const { fetcher } = await send(created());
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/v1/cms/patterns/versions');
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    });
    expect(init.headers).toEqual({
      'content-type': 'application/json',
      'x-csrf-token': CSRF,
      'idempotency-key': KEY,
    });
    expect(init.body).toBe(JSON.stringify(first));
  });

  it('sends the strong If-Match that names expectedVersion on a successor', async () => {
    const { fetcher } = await send(
      created({ version: '4', patternVersion: 4 }),
      successor,
    );
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ 'if-match': '"3"' });
  });
});

describe('submitPatternVersion: a verified draft', () => {
  it('is created with the facts the form shows', async () => {
    const { result } = await send(created({ nodeCount: 5 }));
    expect(result).toEqual({
      kind: 'created',
      resource: {
        id: patternResourceFixture().id,
        patternKey: 'profile-hero',
        patternVersion: 1,
        version: '1',
        nodeCount: 5,
        blockRegistryDigest: 'b'.repeat(64),
      },
    });
  });

  it.each([
    ['a 200', jsonResponse(200, patternResourceFixture(), { etag: '"1"' })],
    ['an active resource', created({ state: 'active' })],
    ['another key', created({ patternKey: 'other-key' })],
    [
      'a version that is not parent + 1',
      created({ version: '2', patternVersion: 2 }),
    ],
    ['a version that differs from its number', created({ patternVersion: 2 })],
    [
      'other compatible types',
      created({ compatibleTypeIds: ['30000000-0000-4000-8000-000000000099'] }),
    ],
    ['an ETag that is not the version', created({}, '"9"')],
    ['a missing ETag', jsonResponse(201, patternResourceFixture())],
    ['a node count below the written nodes', created({ nodeCount: 1 })],
    [
      'no registry digest',
      jsonResponse(
        201,
        { ...patternResourceFixture(), blockRegistryDigest: 'nope' },
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

describe('submitPatternVersion: uncertainty', () => {
  it('is uncertain when the network fails', async () => {
    expect((await send(new Error('offline'))).result).toEqual({
      kind: 'uncertain',
    });
  });

  it.each([502, 503, 504, 500])(
    'is uncertain for a %i the proxy marked unknown',
    async (status) => {
      const response = jsonResponse(
        status,
        patternApiError('CMS-03C-12', status),
        {
          'x-cms-editorial-outcome': 'unknown',
        },
      );
      expect((await send(response)).result).toEqual({ kind: 'uncertain' });
    },
  );

  it('is uncertain for a refusal that is not the catalog code of its status', async () => {
    const wrong = {
      ...patternApiError('CMS-03C-12', 404),
      code: 'TEMPLATE_NOT_FOUND',
    };
    expect((await send(jsonResponse(404, wrong))).result).toEqual({
      kind: 'uncertain',
    });
    expect(
      (await send(new Response('<html>', { status: 404 }))).result,
    ).toEqual({
      kind: 'uncertain',
    });
  });
});

describe('submitPatternVersion: definite answers', () => {
  it('reports a plain compare-and-set conflict with the current version', async () => {
    const response = jsonResponse(
      409,
      patternApiError('CMS-03C-12', 409, {
        expectedVersion: '3',
        currentVersion: '5',
      }),
    );
    expect((await send(response, successor)).result).toEqual({
      kind: 'conflict',
      currentVersion: '5',
    });
    expect(
      (
        await send(
          jsonResponse(409, patternApiError('CMS-03C-12', 409)),
          successor,
        )
      ).result,
    ).toEqual({ kind: 'conflict', currentVersion: null });
    expect(
      (
        await send(
          jsonResponse(
            409,
            patternApiError('CMS-03C-12', 409, {
              currentVersion: '9223372036854775808',
            }),
          ),
          successor,
        )
      ).result,
    ).toEqual({ kind: 'conflict', currentVersion: null });
  });

  it.each(Object.entries(PATTERN_WRITE_REASONS))(
    'reports the typed refusal %s at status %i',
    async (token, status) => {
      const response = jsonResponse(
        status,
        patternApiError('CMS-03C-12', status, { reasonCode: token }),
      );
      expect((await send(response)).result).toEqual({
        kind: 'refused',
        status,
        reason: token,
      });
    },
  );

  it('does not read a token at another status as a refusal', async () => {
    const response = jsonResponse(
      422,
      patternApiError('CMS-03C-12', 422, { reasonCode: 'pattern_cycle' }),
    );
    expect((await send(response)).result).toEqual({
      kind: 'rejected',
      status: 422,
    });
  });

  it.each([400, 401, 403, 404, 415, 422, 500, 502, 503, 504])(
    'reports a plain %i as rejected',
    async (status) => {
      const response = jsonResponse(
        status,
        patternApiError('CMS-03C-12', status),
      );
      expect((await send(response)).result).toEqual({
        kind: 'rejected',
        status,
      });
    },
  );

  it('reports a rate limit with its wait, and is uncertain without a usable one', async () => {
    const limited = jsonResponse(
      429,
      patternApiError('CMS-03C-12', 429, { retryAfterSeconds: 12 }),
      { 'retry-after': '12' },
    );
    expect((await send(limited)).result).toEqual({
      kind: 'rejected',
      status: 429,
      retryAfterSeconds: 12,
    });
    const disagree = jsonResponse(
      429,
      patternApiError('CMS-03C-12', 429, { retryAfterSeconds: 99 }),
      { 'retry-after': '12' },
    );
    expect((await send(disagree)).result).toEqual({ kind: 'uncertain' });
    expect(
      (await send(jsonResponse(429, patternApiError('CMS-03C-12', 429))))
        .result,
    ).toEqual({ kind: 'uncertain' });
  });
});
