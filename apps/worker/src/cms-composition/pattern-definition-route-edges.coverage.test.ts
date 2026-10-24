import { describe, expect, it, vi } from 'vitest';

import { ApiErrorSchema } from '@wejammin/contracts';
import { failure } from './pattern-definition-ports';
import { patternErrorResponse } from './pattern-definition-response';
import {
  expectError,
  ORIGIN,
  patternBody,
  patternDetail,
  patternHarness,
  patternResource,
  READ_PATH,
  readRequest,
  REQUEST_ID,
  WRITE_PATH,
  writeRequest,
} from './pattern-definition.test-support';
import { abortAfterQuota } from './coverage-abort.test-support';

const errorOf = async (response: Response) =>
  ApiErrorSchema.parse(await response.json());

const URL_BASE = 'https://api.example.test';
const bareDependencies = () =>
  ({ humanOrigins: [ORIGIN], now: () => 1_000 }) as never;

describe('CMS-03C-12 route edges', () => {
  const preflight = (origin: string | null) =>
    new Request(`${URL_BASE}${WRITE_PATH}`, {
      method: 'OPTIONS',
      headers: origin === null ? {} : { origin },
    });

  it('answers the preflight for an allowed human origin only', async () => {
    const harness = patternHarness();
    const allowed = await harness.send(preflight(ORIGIN));
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-methods')).toBe(
      'POST, OPTIONS',
    );
    expect(allowed.headers.get('access-control-allow-headers')).toBe(
      'Content-Type, Idempotency-Key, If-Match, X-CSRF-Token, X-Request-Id',
    );
    expect(allowed.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    for (const origin of ['https://evil.example.test', null]) {
      const denied = await harness.send(preflight(origin));
      expect(denied.status).toBe(403);
      expect(denied.headers.get('access-control-allow-origin')).toBeNull();
    }
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses a query string with 400 before quota and RPC', async () => {
    const harness = patternHarness();
    const request = new Request(`${URL_BASE}${WRITE_PATH}?ownerPartyId=x`, {
      method: 'POST',
      headers: {
        origin: ORIGIN,
        'content-type': 'application/json',
        'idempotency-key': 'pattern-definition-0001',
        'x-request-id': REQUEST_ID,
      },
      body: JSON.stringify(patternBody()),
    });
    await expectError(await harness.send(request), 400, 'INVALID_REQUEST');
    expect(harness.rateLimit).not.toHaveBeenCalled();
    expect(harness.fetchImpl).not.toHaveBeenCalled();
  });

  it('answers 504 and never calls the port when the caller aborts after admission', async () => {
    const controller = new AbortController();
    const definePattern = vi.fn();
    const harness = patternHarness({
      dependencies: {
        definePattern,
        rateLimit: abortAfterQuota(controller) as never,
      },
    });
    const request = writeRequest();
    const aborting = new Request(request, { signal: controller.signal });
    await expectError(
      await harness.send(aborting),
      504,
      'DEPENDENCY_UNAVAILABLE',
    );
    expect(definePattern).not.toHaveBeenCalled();
  });

  it('answers 503 when the port throws', async () => {
    const harness = patternHarness({
      dependencies: {
        definePattern: async () => {
          throw new Error('port fault');
        },
      },
    });
    const response = await harness.send(writeRequest());
    await expectError(response, 503, 'DEPENDENCY_UNAVAILABLE');
    expect(response.headers.get('retry-after')).toBe('15');
  });

  it('answers 502 for a port answer that is not a result envelope', async () => {
    const harness = patternHarness({
      dependencies: { definePattern: (async () => 'created') as never },
    });
    await expectError(
      await harness.send(writeRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it('answers 502 for a created draft that does not honour the request', async () => {
    const harness = patternHarness({
      dependencies: {
        definePattern: async () => ({
          ok: true as const,
          value: patternResource(5),
        }),
      },
    });
    await expectError(
      await harness.send(writeRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });
});

describe('cmsPatternLatestRead route edges', () => {
  const preflight = (origin: string | null, path = READ_PATH) =>
    new Request(`${URL_BASE}${path}`, {
      method: 'OPTIONS',
      headers: origin === null ? {} : { origin },
    });

  it('answers the preflight for an allowed human origin only', async () => {
    const harness = patternHarness();
    const allowed = await harness.send(preflight(ORIGIN));
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-methods')).toBe(
      'GET, OPTIONS',
    );
    expect(allowed.headers.get('access-control-allow-headers')).toBe(
      'X-Request-Id',
    );
    expect(allowed.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    for (const origin of ['https://evil.example.test', null]) {
      const denied = await harness.send(preflight(origin));
      expect(denied.status).toBe(403);
      expect(denied.headers.get('access-control-allow-origin')).toBeNull();
    }
  });

  it('refuses a preflight for a malformed pattern key with 400', async () => {
    const harness = patternHarness();
    const response = await harness.send(
      preflight(ORIGIN, '/api/v1/cms/patterns/Invalid_Key'),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get('access-control-allow-methods')).toBeNull();
  });

  it('answers 503 when the port throws', async () => {
    const harness = patternHarness({
      dependencies: {
        readLatest: async () => {
          throw new Error('port fault');
        },
      },
    });
    await expectError(
      await harness.send(readRequest()),
      503,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it('answers 502 for a port answer that is not a result envelope', async () => {
    const harness = patternHarness({
      dependencies: { readLatest: (async () => null) as never },
    });
    await expectError(
      await harness.send(readRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });

  it('answers 502 for a detail of another pattern key', async () => {
    const harness = patternHarness({
      dependencies: {
        readLatest: async () => ({
          ok: true as const,
          value: { ...patternDetail(), patternKey: 'other-pattern' },
        }),
      },
    });
    await expectError(
      await harness.send(readRequest()),
      502,
      'DEPENDENCY_UNAVAILABLE',
    );
  });
});

describe('request identifiers and refusal details', () => {
  it.each([
    ['write', () => writeRequest(patternBody(), {}), 'x-request-id'],
    ['read', () => readRequest(READ_PATH, {}), 'x-request-id'],
  ])('mints a request id when a %s names none', async (_n, build, header) => {
    const original = build();
    const headers = new Headers(original.headers);
    headers.delete(header);
    const harness = patternHarness({ anonymous: true });
    const response = await harness.send(
      new Request(original.url, {
        method: original.method,
        headers,
        ...(original.method === 'POST' ? { body: await original.text() } : {}),
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('x-request-id')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    );
    expect(response.headers.get('x-request-id')).not.toBe(REQUEST_ID);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a string', 'private provider text'],
  ])('projects no members from %s details', async (_n, details) => {
    const response = patternErrorResponse(
      writeRequest(),
      bareDependencies(),
      REQUEST_ID,
      'CMS-03C-12',
      { ...failure(409), details } as never,
    );
    expect(response.status).toBe(409);
    expect((await errorOf(response)).details).toEqual({});
  });
});
