/**
 * OD-4 RPC error DETAIL mapping (BE03a CMS-03A-01 / CMS-03A-09). PostgREST
 * returns a raised exception as `{ code, message, details, hint }` where
 * `details` is the machine DETAIL text. The adapter parses the bounded OD-4
 * shapes and nothing else: 422 `{"violations":[{"pointer","message"}]}` and
 * the 409 `reasonCode` only (the active chain belongs to BE03c, never BE03a).
 */
import { describe, expect, it, vi } from 'vitest';

import { createProductionContentSchemaRegistryDependencies } from './production';
import { mapRpcFailure } from './production-errors';
import {
  json,
  options,
  request,
  REQUEST_ID,
  session,
} from './production-test-support';

const violation = (pointer: string, message: string) => ({ pointer, message });
const postgrest = (message: string, details: unknown) => ({
  code: 'P0001',
  message,
  details,
  hint: null,
});

describe('registry RPC error DETAIL mapping', () => {
  it('carries 422 violations from the DETAIL JSON text in order', () => {
    const violations = [
      violation(
        '/supportedLocales',
        'supportedLocales must include sourceLocale',
      ),
      violation(
        '/fallbackChains/fr-CA/0',
        'fallback chain locale must be a supported locale',
      ),
    ];
    const result = mapRpcFailure(
      400,
      postgrest('VALIDATION_FAILED', JSON.stringify({ violations })),
    );
    expect(result).toMatchObject({
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      details: { violations },
    });
  });

  it('accepts DETAIL already parsed as an object and a plain 422 status fallback', () => {
    const violations = [violation('/defaultLocale', 'must be canonical case')];
    expect(
      mapRpcFailure(422, postgrest('VALIDATION_FAILED', { violations })),
    ).toMatchObject({ status: 422, details: { violations } });
    expect(
      mapRpcFailure(422, {
        code: 'P0001',
        message: 'something else',
        details: JSON.stringify({ violations }),
      }),
    ).toMatchObject({ status: 422, details: { violations } });
  });

  it('bounds violations to 50 entries and drops unsafe pointers, messages and shapes', () => {
    const many = Array.from({ length: 60 }, (_, index) =>
      violation(`/supportedLocales/${index}`, `bad locale ${index}`),
    );
    const bounded = mapRpcFailure(
      422,
      postgrest('VALIDATION_FAILED', JSON.stringify({ violations: many })),
    );
    expect(bounded.details?.violations).toEqual(many.slice(0, 50));

    const mixed = mapRpcFailure(
      422,
      postgrest(
        'VALIDATION_FAILED',
        JSON.stringify({
          violations: [
            violation('/ok', 'fine'),
            violation('/bad\npointer', 'newline pointer'),
            violation('/long', 'x'.repeat(501)),
            violation('/' + 'p'.repeat(300), 'long pointer'),
            'not-an-object',
            null,
            { pointer: 7, message: 8 },
            { pointer: '/extra', message: 'kept', secret: 'hide' },
          ],
        }),
      ),
    );
    expect(mixed.details?.violations).toEqual([
      violation('/ok', 'fine'),
      { pointer: '/extra', message: 'kept' },
    ]);
    expect(JSON.stringify(mixed)).not.toContain('hide');
  });

  it('never invents violations from malformed, non-object or non-422 DETAIL', () => {
    for (const details of [
      'not json',
      '[1,2]',
      '"text"',
      '{"violations":"nope"}',
      null,
      7,
    ])
      expect(
        mapRpcFailure(422, postgrest('VALIDATION_FAILED', details)).details,
      ).not.toHaveProperty('violations');
    const conflict = mapRpcFailure(
      409,
      postgrest(
        'CONFLICT',
        JSON.stringify({ violations: [violation('/a', 'leak')] }),
      ),
    );
    expect(conflict.details).not.toHaveProperty('violations');
  });

  it('keeps no reasonCode and never the active chain on a 409, and ignores plain-text DETAIL', () => {
    const mismatch = mapRpcFailure(
      409,
      postgrest(
        'VERSION_MISMATCH',
        JSON.stringify({
          reasonCode: 'FALLBACK_CHAIN_MISMATCH',
          activeFallbackChain: ['en'],
        }),
      ),
    );
    expect(mismatch).toMatchObject({ status: 409, code: 'VERSION_MISMATCH' });
    // BE03a: a 409 carries only expectedVersion/currentVersion.
    expect(mismatch.details).toEqual({});
    expect(
      mapRpcFailure(409, postgrest('CONFLICT', 'MIGRATION_SOURCE_DRIFT')),
    ).toMatchObject({ status: 409, code: 'CONFLICT', details: {} });
  });

  it('surfaces a 422 from the RPC transport as VALIDATION_FAILED with its violations at the port', async () => {
    const violations = [
      violation(
        '/supportedLocales',
        'supportedLocales must contain 1 to 32 locales',
      ),
    ];
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      json(postgrest('VALIDATION_FAILED', JSON.stringify({ violations })), 400),
    );
    const dependencies = createProductionContentSchemaRegistryDependencies(
      options(fetchImpl),
    );
    const result = await dependencies.ports.createTypeDraft(
      {
        operationId: 'CMS-03A-01',
        request,
        requestId: REQUEST_ID,
        body: { typeKey: 'article' } as never,
        session,
        idempotencyKey: 'cms-create-detail-001',
      },
      new AbortController().signal,
    );
    expect(result).toMatchObject({
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
      details: { violations },
    });
  });
});
