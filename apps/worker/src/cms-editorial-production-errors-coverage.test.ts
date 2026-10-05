import { describe, it } from 'vitest';

import {
  codeFromRpcError,
  contextUnavailable,
  deadlineExceeded,
  errorResult,
  internalError,
  invalidResponse,
  isAbortError,
  knownEditorialFailure,
  mapAuthenticationFailure,
  rpcNameFor,
  safeDetails,
  sessionUnavailable,
  statusIsSupported,
  unavailable,
} from './cms-editorial-production-errors';
import {
  compose,
  expect,
  json,
  portInput,
  vi,
} from './cms-editorial-production.test-support';

const viaRpc = async (status: number, payload: unknown) => {
  const fetchImpl = vi.fn(async () => json(payload, status));
  const dependencies = compose(fetchImpl as unknown as typeof fetch);
  return dependencies.ports.appendRevision(
    portInput(),
    new AbortController().signal,
  );
};

const RPC_NAMES = [
  ['CMS-03B-01', 'cms_create_revision'],
  ['CMS-03B-10', 'cms_create_entry'],
  ['CMS-03B-11', 'cms_get_entry_draft'],
] as const;

describe('cms editorial error mapping', () => {
  it('binds every declared operation to its named RPC', () => {
    for (const [operationId, rpc] of RPC_NAMES)
      expect(rpcNameFor(operationId)).toBe(rpc);
  });

  it('gates the statuses the contract can emit', () => {
    for (const status of [
      400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504,
    ])
      expect(statusIsSupported(status)).toBe(true);
    expect(statusIsSupported(413)).toBe(false);
    expect(statusIsSupported(418)).toBe(false);
  });

  it('maps every known editorial failure code to its status', () => {
    const expected = {
      INVALID_REQUEST: 400,
      UNSUPPORTED_MEDIA_TYPE: 415,
      UNAUTHENTICATED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      IDEMPOTENCY_MISMATCH: 409,
      IDEMPOTENCY_CONFLICT: 409,
      VERSION_MISMATCH: 409,
      CONFLICT: 409,
      VALIDATION_FAILED: 422,
      RATE_LIMITED: 429,
    } as const;
    for (const [code, status] of Object.entries(expected))
      expect(knownEditorialFailure(code)?.status).toBe(status);
    expect(knownEditorialFailure('NO_SUCH_CODE')).toBeNull();
  });

  it('extracts only an exact allowlisted structured failure token', () => {
    expect(codeFromRpcError({ code: 'VERSION_MISMATCH' })).toBe(
      'VERSION_MISMATCH',
    );
    expect(codeFromRpcError({ code: ' version_mismatch ' })).toBe(
      'VERSION_MISMATCH',
    );
    expect(codeFromRpcError({ code: 'NOT_A_DECLARED_CODE' })).toBe('');
    expect(codeFromRpcError({ code: 409 })).toBe('');
    expect(codeFromRpcError({ message: 'violates RATE_LIMITED policy' })).toBe(
      '',
    );
    expect(codeFromRpcError({ error: 'forbidden' })).toBe('');
    expect(codeFromRpcError({ detail: 'not_found' })).toBe('');
    expect(codeFromRpcError('a bare string')).toBe('');
    expect(codeFromRpcError({})).toBe('');
    expect(codeFromRpcError(undefined)).toBe('');
  });

  it('does not let prose in a mixed payload remap a trusted token', () => {
    expect(
      codeFromRpcError({
        code: 'CONFLICT',
        detail: 'entry NOT_FOUND for assignment',
      }),
    ).toBe('CONFLICT');
    expect(
      codeFromRpcError({ code: 'VERSION_MISMATCH', message: 'RATE_LIMITED' }),
    ).toBe('VERSION_MISMATCH');
    expect(codeFromRpcError({ error: 'FORBIDDEN', message: 'NOT_FOUND' })).toBe(
      '',
    );
  });

  it('accepts an exact uppercase token from a P0001 PostgREST envelope', () => {
    expect(codeFromRpcError({ code: 'P0001', message: 'CONFLICT' })).toBe(
      'CONFLICT',
    );
    expect(codeFromRpcError({ code: 'P0001', message: 'NOT_FOUND' })).toBe(
      'NOT_FOUND',
    );
    expect(
      codeFromRpcError({ code: 'P0001', message: 'VALIDATION_FAILED' }),
    ).toBe('VALIDATION_FAILED');
    expect(
      codeFromRpcError({ code: 'p0001', message: 'VERSION_MISMATCH' }),
    ).toBe('VERSION_MISMATCH');
  });

  it('refuses prose, lowercase, or a foreign SQLSTATE in the P0001 message', () => {
    expect(codeFromRpcError({ code: 'P0001', message: 'conflict' })).toBe('');
    expect(
      codeFromRpcError({
        code: 'P0001',
        message: 'entry NOT_FOUND for one row',
      }),
    ).toBe('');
    expect(codeFromRpcError({ code: 'P0001', message: 'no such record' })).toBe(
      '',
    );
    expect(codeFromRpcError({ code: 'P0001' })).toBe('');
    expect(codeFromRpcError({ code: 'P0001', message: 409 })).toBe('');
    expect(codeFromRpcError({ code: '23505', message: 'CONFLICT' })).toBe('');
    expect(
      codeFromRpcError({
        code: 'P0001',
        message: 'CONFLICT',
        detail: 'NOT_FOUND',
      }),
    ).toBe('CONFLICT');
  });

  it('recovers 404/409/422 from a P0001 PostgREST envelope', async () => {
    await expect(
      viaRpc(400, { code: 'P0001', message: 'NOT_FOUND' }),
    ).resolves.toMatchObject({ ok: false, status: 404, code: 'NOT_FOUND' });
    await expect(
      viaRpc(400, { code: 'P0001', message: 'CONFLICT' }),
    ).resolves.toMatchObject({ ok: false, status: 409, code: 'CONFLICT' });
    await expect(
      viaRpc(400, { code: 'P0001', message: 'VALIDATION_FAILED' }),
    ).resolves.toMatchObject({
      ok: false,
      status: 422,
      code: 'VALIDATION_FAILED',
    });
  });

  it('carries a retry hint only when one is supplied', () => {
    expect(errorResult(429, 'RATE_LIMITED', 'slow down', {}, 60)).toMatchObject(
      {
        retryAfterSeconds: 60,
      },
    );
    expect(
      errorResult(400, 'INVALID_REQUEST', 'bad').retryAfterSeconds,
    ).toBeUndefined();
  });

  it('detects abort errors across runtime shapes', () => {
    expect(isAbortError(new DOMException('stop', 'AbortError'))).toBe(true);
    expect(isAbortError({ name: 'AbortError' })).toBe(true);
    expect(isAbortError(new DOMException('stop', 'TimeoutError'))).toBe(false);
    expect(isAbortError(new Error('plain'))).toBe(false);
    expect(isAbortError('abort')).toBe(false);
  });

  it('keeps 404 and 500 details completely empty', () => {
    expect(
      safeDetails(404, { reasonCode: 'leak', dependencyClass: 'x' }),
    ).toEqual({});
    expect(safeDetails(500, { retryable: true })).toEqual({});
    expect(safeDetails(400, 'not-a-record')).toEqual({});
  });

  it('forwards only redaction-safe detail keys', () => {
    expect(
      safeDetails(403, {
        details: {
          reasonCode: 'entry_not_assigned',
          secret: 'leak',
          expectedVersion: '3',
          currentHash: 'f'.repeat(64),
        },
      }),
    ).toEqual({
      reasonCode: 'entry_not_assigned',
      expectedVersion: '3',
      currentHash: 'f'.repeat(64),
    });
    expect(safeDetails(422, { retryable: true })).toEqual({ retryable: true });
  });

  it('caps validation violations at the contract bound and drops non-strings', () => {
    const violations = [
      ...Array.from({ length: 60 }, (_value, index) => `/field/${index}`),
      17,
      null,
    ];
    const details = safeDetails(422, { violations });
    const kept = details.violations as readonly string[];
    expect(kept).toHaveLength(50);
    expect(kept.every((entry) => typeof entry === 'string')).toBe(true);
    expect(
      safeDetails(422, { violations: 'not-an-array' }).violations,
    ).toBeUndefined();
  });

  it('maps recognized RPC failure codes through the transport', async () => {
    for (const [code, status, expected] of [
      ['INVALID_REQUEST', 400, 400],
      ['UNSUPPORTED_MEDIA_TYPE', 415, 415],
      ['UNAUTHENTICATED', 401, 401],
      ['IDEMPOTENCY_MISMATCH', 409, 409],
      ['IDEMPOTENCY_CONFLICT', 409, 409],
      ['CONFLICT', 409, 409],
      ['VALIDATION_FAILED', 422, 422],
    ] as const) {
      const result = await viaRpc(status, { code });
      expect(result).toMatchObject({ ok: false, status: expected });
    }
    expect(await viaRpc(429, { code: 'RATE_LIMITED' })).toMatchObject({
      ok: false,
      status: 429,
      retryAfterSeconds: 60,
    });
  });

  it('falls back to the status table for codeless RPC rejections', async () => {
    for (const [status, expectedStatus, expectedCode] of [
      [401, 401, 'UNAUTHENTICATED'],
      [403, 403, 'FORBIDDEN'],
      [404, 404, 'NOT_FOUND'],
      [409, 409, 'CONFLICT'],
      [415, 415, 'UNSUPPORTED_MEDIA_TYPE'],
      [422, 422, 'VALIDATION_FAILED'],
      [429, 429, 'RATE_LIMITED'],
      [413, 400, 'INVALID_REQUEST'],
      [400, 400, 'INVALID_REQUEST'],
      [418, 503, 'DEPENDENCY_UNAVAILABLE'],
    ] as const) {
      const result = await viaRpc(status, {});
      expect(result).toMatchObject({
        ok: false,
        status: expectedStatus,
        code: expectedCode,
      });
    }
  });

  it('distinguishes deadline, bad gateway, and unavailable dependencies', async () => {
    expect(await viaRpc(504, {})).toMatchObject({ status: 504 });
    expect(await viaRpc(502, {})).toMatchObject({
      status: 502,
      code: 'BAD_GATEWAY',
    });
    expect(await viaRpc(503, {})).toMatchObject({
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('builds the shared dependency error envelopes', () => {
    expect(unavailable()).toMatchObject({ status: 503, retryAfterSeconds: 5 });
    expect(unavailable('authentication')).toMatchObject({
      details: { dependencyClass: 'authentication', retryable: true },
    });
    expect(deadlineExceeded()).toMatchObject({
      status: 504,
      code: 'GATEWAY_TIMEOUT',
    });
    expect(invalidResponse()).toMatchObject({
      status: 502,
      code: 'BAD_GATEWAY',
      details: { retryable: false },
    });
    expect(sessionUnavailable()).toMatchObject({
      details: { dependencyClass: 'authentication' },
    });
    expect(contextUnavailable()).toMatchObject({
      details: { dependencyClass: 'request_context' },
    });
    expect(internalError()).toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
      details: {},
    });
  });

  it('maps authentication failures and reclassifies out-of-band statuses', () => {
    expect(
      mapAuthenticationFailure({
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'The action is not allowed.',
      }),
    ).toMatchObject({ ok: false, status: 403, code: 'FORBIDDEN' });
    expect(
      mapAuthenticationFailure({
        ok: false,
        status: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: 'too large',
      }),
    ).toMatchObject({ ok: false, status: 503 });
  });
});
