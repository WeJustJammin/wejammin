import { describe, expect, it } from 'vitest';

import { mapRpcFailure } from './production-errors';
import { safeDetails } from './route-response-details';
import type { ContentSchemaRegistryError } from './types';

const BE00_DETAILS_CEILING_BYTES = 8 * 1024;
const SQL_TEXT =
  'relation "cms_private.schema_reviews" does not exist; SELECT * FROM auth.users';

const failure = (
  status: ContentSchemaRegistryError['status'],
  details?: Readonly<Record<string, unknown>>,
  retryAfterSeconds?: number,
): ContentSchemaRegistryError => ({
  ok: false,
  status,
  code: 'X',
  message: 'safe',
  ...(details === undefined ? {} : { details }),
  ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
});

const bytes = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value)).byteLength;

const rpcPayload = (details: Record<string, unknown>) => ({
  code: 'P0001',
  message: 'raise',
  details: JSON.stringify(details),
});

describe('[P2-S09-AC-035] [P2-S09-AC-600] [P2-S09-AC-623] registered detail values at the wire boundary', () => {
  it.each([
    ['oversized token', 'A'.repeat(10_000)],
    ['SQL text', SQL_TEXT],
    ['lowercase token', 'capability_required'],
    ['unregistered token', 'SOMETHING_UNREGISTERED'],
    ['empty string', ''],
  ])('drops a 403 reasonCode that is a %s', (_name, reasonCode) => {
    expect(safeDetails(failure(403, { reasonCode }))).toEqual({});
  });

  it.each(['CAPABILITY_REQUIRED', 'OWNER_REQUIRED', 'MFA_REQUIRED'])(
    'keeps the registered 403 reasonCode %s',
    (reasonCode) => {
      expect(safeDetails(failure(403, { reasonCode }))).toEqual({ reasonCode });
    },
  );

  it.each([
    ['oversized token', 'a'.repeat(10_000)],
    ['SQL text', SQL_TEXT],
    ['provider name', 'supabase'],
    ['unregistered token', 'billing_ledger'],
  ])(
    'replaces a 502/503/504 dependencyClass that is a %s with the canonical class',
    (_name, dependencyClass) => {
      for (const status of [502, 503, 504] as const)
        expect(safeDetails(failure(status, { dependencyClass }))).toEqual({
          dependencyClass: 'cms_registry',
          retryable: true,
        });
    },
  );

  it.each([
    'cms_registry',
    'authentication',
    'request_context',
    'release_verifier',
    'rate_limiter',
  ])('keeps the registered dependencyClass %s', (dependencyClass) => {
    expect(safeDetails(failure(503, { dependencyClass }))).toEqual({
      dependencyClass,
      retryable: true,
    });
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['negative', -1],
    ['fractional', 1.5],
    ['beyond one day', 86_401],
  ])('drops a %s retryAfterSeconds on 429 and on 5xx', (_name, value) => {
    expect(safeDetails(failure(429, { retryAfterSeconds: value }))).toEqual({});
    expect(safeDetails(failure(503, {}, value))).toEqual({
      dependencyClass: 'cms_registry',
      retryable: true,
    });
  });

  it.each([0, -3, 2.5, Number.NaN, 2_000_000])(
    'drops an out-of-range 429 limit %s',
    (limit) => {
      expect(safeDetails(failure(429, { limit }))).toEqual({});
    },
  );

  it('keeps the serialized 400/422 details at or under the BE00 ceiling', () => {
    const violations = Array.from({ length: 80 }, (_unused, index) => ({
      pointer: `/${'p'.repeat(250)}${index}`.slice(0, 256),
      message: 'm'.repeat(500),
      code: 'REQUIRED',
    }));
    for (const status of [400, 422] as const) {
      const details = safeDetails(failure(status, { violations }));
      expect(bytes(details)).toBeLessThanOrEqual(BE00_DETAILS_CEILING_BYTES);
      expect((details.violations as readonly unknown[]).length).toBeGreaterThan(
        0,
      );
    }
  });

  it('applies the same registered values in the production adapter', () => {
    const forbidden = mapRpcFailure(
      403,
      rpcPayload({ reasonCode: SQL_TEXT, code: 'FORBIDDEN' }),
    );
    expect(forbidden.details).toEqual({});
    const oversized = mapRpcFailure(
      403,
      rpcPayload({ reasonCode: 'A'.repeat(10_000) }),
    );
    expect(oversized.details).toEqual({});
    const registered = mapRpcFailure(
      403,
      rpcPayload({ reasonCode: 'OWNER_REQUIRED' }),
    );
    expect(registered.details).toEqual({ reasonCode: 'OWNER_REQUIRED' });
    const dependency = mapRpcFailure(
      429,
      rpcPayload({ retryAfterSeconds: -5, limit: 0 }),
    );
    expect(dependency.details).toEqual({});
  });
});

describe('[P2-S09-AC-600] wire boundary: details and Retry-After share one bound', () => {
  it('never writes a non-finite or oversized Retry-After and keeps wire details under 8 KiB', async () => {
    const { errorResponse } = await import('./route-response');
    const headers = new Map<string, string>();
    let sent: unknown;
    const context = {
      header: (name: string, value: string) => headers.set(name, value),
      json: (body: unknown, status: number) => {
        sent = body;
        return new Response(JSON.stringify(body), { status });
      },
    };
    for (const bad of [Number.NaN, -1, 1.5, 1e9]) {
      headers.clear();
      errorResponse(
        context as never,
        {
          ...failure(503, { dependencyClass: SQL_TEXT }),
          retryAfterSeconds: bad,
        },
        'req',
      );
      expect(headers.has('retry-after')).toBe(false);
      expect(bytes(sent)).toBeLessThanOrEqual(BE00_DETAILS_CEILING_BYTES);
      expect((sent as { details: unknown }).details).toEqual({
        dependencyClass: 'cms_registry',
        retryable: true,
      });
    }
    headers.clear();
    errorResponse(context as never, failure(503, {}, 5), 'req');
    expect(headers.get('retry-after')).toBe('5');
  });
});
