import { afterEach, describe, expect, it, vi } from 'vitest';

import { boundedBytes, TAXONOMY_BYTES } from './taxonomy-definition-shared';
import { taxonomyRpcFailure } from './taxonomy-definition-response';
import {
  createTaxonomyRouteHarness,
  taxonomyDefinitionVersionsPath,
  taxonomyDefinitionWriteRequest,
  taxonomyResource,
} from './taxonomy-definition.test-support';

/*
 * BE03c taxonomy definition routes (CMS-03C-16 and cmsTaxonomyVersionsRead): every refusal is a typed catalog
 * envelope built from closed members, a dead deadline never reaches a port, and telemetry cannot change a response.
 */

afterEach(() => {
  vi.restoreAllMocks();
});
const writePath = '/api/v1/cms/taxonomies/versions';
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const body = (response: Response) =>
  response.json() as Promise<{
    code: string;
    details: Record<string, unknown>;
  }>;

describe('boundedBytes', () => {
  it.each([
    ['an omitted ceiling', undefined, TAXONOMY_BYTES],
    ['a smaller positive integer', 1_024, 1_024],
    ['the ceiling itself', TAXONOMY_BYTES, TAXONOMY_BYTES],
    [
      'a larger value (clamped, never raised)',
      TAXONOMY_BYTES + 1,
      TAXONOMY_BYTES,
    ],
    ['zero', 0, TAXONOMY_BYTES],
    ['a negative value', -1, TAXONOMY_BYTES],
    ['a fraction', 1.5, TAXONOMY_BYTES],
    ['NaN', Number.NaN, TAXONOMY_BYTES],
  ])('%s yields %s bytes', (_label, value, expected) => {
    expect(boundedBytes(value)).toBe(expected);
  });
});

describe('cmsTaxonomyVersionsRead route faults', () => {
  it('answers 502 for a session envelope that is not an envelope, calling no port', async () => {
    const h = createTaxonomyRouteHarness();
    h.resolveSession.mockResolvedValue(undefined as never);
    const response = await h.request(taxonomyDefinitionVersionsPath());
    expect(response.status).toBe(502);
    expect((await body(response)).code).toBe('DEPENDENCY_UNAVAILABLE');
    expect(h.rateLimit).not.toHaveBeenCalled();
    expect(h.readVersions).not.toHaveBeenCalled();
  });

  it('relays a session refusal without charging quota', async () => {
    const h = createTaxonomyRouteHarness();
    h.resolveSession.mockResolvedValue({
      ok: false,
      status: 401,
      code: 'UNAUTHENTICATED',
      message: 'The session is invalid.',
      details: {},
    } as never);
    const response = await h.request(taxonomyDefinitionVersionsPath());
    expect(response.status).toBe(401);
    expect((await body(response)).details).toEqual({
      recoveryAction: 'reauthenticate',
    });
    expect(h.rateLimit).not.toHaveBeenCalled();
  });

  it('answers 401 for a session whose identity is malformed, charging no quota', async () => {
    const h = createTaxonomyRouteHarness();
    h.resolveSession.mockResolvedValue({
      ok: true,
      value: {
        userId: 'not-a-uuid',
        actingPartyId: null,
        capabilities: [],
        mfaFresh: false,
      },
    } as never);
    const response = await h.request(taxonomyDefinitionVersionsPath());
    expect(response.status).toBe(401);
    expect((await body(response)).details).toEqual({
      recoveryAction: 'reauthenticate',
    });
    expect(h.rateLimit).not.toHaveBeenCalled();
    expect(h.readVersions).not.toHaveBeenCalled();
  });

  it('relays a limiter refusal and never reads', async () => {
    const h = createTaxonomyRouteHarness();
    h.rateLimit.mockResolvedValue({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'The rate limiter is unavailable.',
      details: {},
      retryAfterSeconds: 7,
    } as never);
    const response = await h.request(taxonomyDefinitionVersionsPath());
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('7');
    expect(h.readVersions).not.toHaveBeenCalled();
  });

  it('answers 504 and never reads when the request is aborted while the last quota bucket answers', async () => {
    const h = createTaxonomyRouteHarness();
    const controller = new AbortController();
    let charged = 0;
    h.rateLimit.mockImplementation(async (input: { limit: number }) => {
      // Both buckets are charged; the deadline passes while the last one answers.
      if (++charged === 2) controller.abort();
      return {
        ok: true as const,
        value: {
          allowed: true,
          limit: input.limit,
          remaining: input.limit - 1,
          resetAt: 60,
        },
      };
    });
    const response = await h.request(taxonomyDefinitionVersionsPath(), {
      signal: controller.signal,
    });
    expect(response.status).toBe(504);
    expect(response.headers.get('retry-after')).toBe('5');
    // The aborted work resumes after the answer left: let it end before asserting what it did.
    await settle();
    expect(h.rateLimit).toHaveBeenCalledTimes(2);
    expect(h.readVersions).not.toHaveBeenCalled();
  });

  it('answers 502 for a reader answer that is not an envelope', async () => {
    const h = createTaxonomyRouteHarness();
    h.readVersions.mockResolvedValue(null as never);
    const response = await h.request(taxonomyDefinitionVersionsPath());
    expect(response.status).toBe(502);
    expect(response.headers.get('etag')).toBeNull();
  });
});

describe('CMS-03C-16 route faults', () => {
  it('answers 502 for a session envelope that is not an envelope, calling no port', async () => {
    const h = createTaxonomyRouteHarness();
    h.resolveSession.mockResolvedValue('nope' as never);
    const response = await h.request(
      writePath,
      taxonomyDefinitionWriteRequest(),
    );
    expect(response.status).toBe(502);
    expect(h.rateLimit).not.toHaveBeenCalled();
    expect(h.createVersion).not.toHaveBeenCalled();
  });

  it('answers 502 for a writer answer that is not an envelope', async () => {
    const h = createTaxonomyRouteHarness();
    h.createVersion.mockResolvedValue(undefined as never);
    const response = await h.request(
      writePath,
      taxonomyDefinitionWriteRequest(),
    );
    expect(response.status).toBe(502);
    expect(response.headers.get('etag')).toBeNull();
  });

  it('answers 504 and never writes when the request is aborted while the last quota bucket answers', async () => {
    const h = createTaxonomyRouteHarness();
    const controller = new AbortController();
    let charged = 0;
    h.rateLimit.mockImplementation(async (input: { limit: number }) => {
      // Both buckets are charged; the deadline passes while the last one answers.
      if (++charged === 2) controller.abort();
      return {
        ok: true as const,
        value: {
          allowed: true,
          limit: input.limit,
          remaining: input.limit - 1,
          resetAt: 60,
        },
      };
    });
    const response = await h.request(writePath, {
      ...taxonomyDefinitionWriteRequest(),
      signal: controller.signal,
    });
    expect(response.status).toBe(504);
    expect(response.headers.get('retry-after')).toBe('5');
    await settle();
    expect(h.createVersion).not.toHaveBeenCalled();
  });

  it('answers 504 and resolves nothing when the request aborts while its body is being read', async () => {
    const h = createTaxonomyRouteHarness();
    const controller = new AbortController();
    const init = taxonomyDefinitionWriteRequest();
    const payload = new TextEncoder().encode(String(init.body));
    const stream = new ReadableStream<Uint8Array>({
      pull(sink) {
        controller.abort();
        sink.enqueue(payload);
        sink.close();
      },
    });
    const response = await h.request(writePath, {
      ...init,
      body: stream,
      duplex: 'half',
      signal: controller.signal,
    } as RequestInit);
    expect(response.status).toBe(504);
    expect(h.resolveSession).not.toHaveBeenCalled();
    expect(h.createVersion).not.toHaveBeenCalled();
  });

  it('refuses a write without an Idempotency-Key header as a 400 before capability and quota', async () => {
    const h = createTaxonomyRouteHarness();
    const init = taxonomyDefinitionWriteRequest();
    const headers = new Headers(init.headers);
    headers.delete('idempotency-key');
    const response = await h.request(writePath, { ...init, headers });
    expect(response.status).toBe(400);
    expect(h.rateLimit).not.toHaveBeenCalled();
    expect(h.createVersion).not.toHaveBeenCalled();
  });
});

describe('taxonomy response projection of port refusals', () => {
  const refusal = (
    status: number,
    details: unknown,
    retryAfterSeconds?: number,
  ) =>
    ({
      ok: false,
      status,
      code: 'ANY',
      message: 'ignored',
      details,
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    }) as never;

  it('answers 503 with Retry-After 5 when the route itself throws, never the thrown message', async () => {
    const h = createTaxonomyRouteHarness();
    h.resolveSession.mockRejectedValue(new Error('provider private detail'));
    const response = await h.request(taxonomyDefinitionVersionsPath());
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
    expect(await response.text()).not.toContain('provider private');
  });

  it('answers 504 before any port when the request arrives already aborted', async () => {
    const h = createTaxonomyRouteHarness();
    const controller = new AbortController();
    controller.abort();
    const response = await h.request(taxonomyDefinitionVersionsPath(), {
      signal: controller.signal,
    });
    expect(response.status).toBe(504);
    expect(h.resolveSession).not.toHaveBeenCalled();
  });

  it('drops refusal details that are not a record', async () => {
    const h = createTaxonomyRouteHarness();
    h.createVersion.mockResolvedValue(refusal(403, null));
    const response = await h.request(
      writePath,
      taxonomyDefinitionWriteRequest(),
    );
    expect(response.status).toBe(403);
    expect((await body(response)).details).toEqual({});
  });

  it('carries only well-formed versions on a 409 conflict', async () => {
    const h = createTaxonomyRouteHarness();
    h.createVersion.mockResolvedValue(
      refusal(409, { expectedVersion: '1', currentVersion: 'three', extra: 1 }),
    );
    const response = await h.request(
      writePath,
      taxonomyDefinitionWriteRequest(),
    );
    expect(response.status).toBe(409);
    expect((await body(response)).details).toEqual({ expectedVersion: '1' });
  });

  it('carries only well-formed quota members on a 429 and sets only the headers it can prove', async () => {
    const h = createTaxonomyRouteHarness();
    h.createVersion.mockResolvedValue(
      refusal(429, { retryAfterSeconds: 'soon', limit: -1, resetAt: 20 }, 3),
    );
    const response = await h.request(
      writePath,
      taxonomyDefinitionWriteRequest(),
    );
    expect(response.status).toBe(429);
    expect((await body(response)).details).toEqual({});
    expect(response.headers.get('retry-after')).toBe('3');
    expect(response.headers.get('ratelimit-remaining')).toBe('0');
    expect(response.headers.get('ratelimit-limit')).toBeNull();
    expect(response.headers.get('ratelimit-reset')).toBeNull();
  });

  it('publishes a status outside the operation catalog as a 502', async () => {
    const h = createTaxonomyRouteHarness();
    h.createVersion.mockResolvedValue(refusal(418, {}));
    const response = await h.request(
      writePath,
      taxonomyDefinitionWriteRequest(),
    );
    expect(response.status).toBe(502);
  });

  it('keeps the response when telemetry rejects or throws', async () => {
    const h = createTaxonomyRouteHarness();
    h.telemetry.mockRejectedValueOnce(new Error('sink down'));
    const rejected = await h.request(taxonomyDefinitionVersionsPath());
    expect(rejected.status).toBe(200);
    h.telemetry.mockImplementationOnce(() => {
      throw new Error('sink down');
    });
    const thrown = await h.request(taxonomyDefinitionVersionsPath());
    expect(thrown.status).toBe(200);
    expect(h.telemetry).toHaveBeenCalledTimes(2);
  });

  it('swallows a failing cancel of the unread request body', async () => {
    const h = createTaxonomyRouteHarness();
    const cancel = vi.fn(async () => {
      throw new Error('cancel failed');
    });
    const init = taxonomyDefinitionWriteRequest();
    const headers = new Headers(init.headers);
    headers.set('content-length', '262145');
    const response = await h.request(writePath, {
      ...init,
      headers,
      body: new ReadableStream<Uint8Array>({ cancel }),
      duplex: 'half',
    } as RequestInit);
    expect(response.status).toBe(400);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('answers a draft that is a valid resource of another lineage as 502, not a 201', async () => {
    const h = createTaxonomyRouteHarness();
    h.createVersion.mockResolvedValue({
      ok: true as const,
      value: { ...taxonomyResource(), shape: 'hierarchical' as const },
    } as never);
    const response = await h.request(
      writePath,
      taxonomyDefinitionWriteRequest(),
    );
    expect(response.status).toBe(502);
  });
});

describe('taxonomyRpcFailure catalog tokens carry their typed details', () => {
  it.each([
    [
      'TAXONOMY_VERSION_CONFLICT',
      409,
      { expectedVersion: '1', currentVersion: '3' },
      { expectedVersion: '1', currentVersion: '3' },
    ],
    [
      'TAXONOMY_VALIDATION_FAILED',
      422,
      { violations: [{ path: '/shape' }] },
      {
        violations: [
          { path: '/shape', code: 'invalid', message: 'The value is invalid.' },
        ],
      },
    ],
    [
      'TAXONOMY_FORBIDDEN',
      403,
      { reasonCode: 'capability_missing' },
      { reasonCode: 'capability_missing' },
    ],
    ['TAXONOMY_NOT_FOUND', 404, { secret: 'x' }, {}],
  ])('%s keeps %s details closed', (token, status, details, expected) => {
    expect(
      taxonomyRpcFailure(400, { code: 'P0001', message: token, details }),
    ).toMatchObject({ ok: false, status, details: expected });
  });
});
