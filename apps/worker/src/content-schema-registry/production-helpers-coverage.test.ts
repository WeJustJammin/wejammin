import { describe, expect, it, vi } from 'vitest';

import type { WorkerBindings } from '../index';
import type { AuthenticationSession } from '../authentication/types';
import type { ContentSchemaRegistryPortInput } from './types';
import {
  codeFromRpcError,
  contextUnavailable,
  errorResult,
  isAbortError,
  isRecord,
  knownFailure,
  mapAuthResult,
  mapRpcFailure,
  safeDetails,
  sessionUnavailable,
  statusIsSupported,
} from './production-errors';
import { canonicalVerifierFailure } from './production-verifier-errors';
import {
  capabilitiesFromResolver,
  configuredOriginList,
  contextFor,
  correlationFor,
  rpcBodyFor,
  validateOriginList,
} from './production-context';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const PARTY_ID = '20000000-0000-4000-8000-000000000002';
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CORRELATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const HASH = 'a'.repeat(64);
const environment = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'helpers',
  SUPABASE_SECRET_KEY: 'sb_secret_helpers',
  SUPABASE_URL: 'https://supabase.example.test',
} as WorkerBindings;
const request = new Request('https://api.example.test/cms', {
  headers: { 'x-correlation-id': CORRELATION_ID },
});
const signal = new AbortController().signal;
const session = {
  authUserId: USER_ID,
  sessionId: '30000000-0000-4000-8000-000000000003',
  accountState: 'active',
  personId: '40000000-0000-4000-8000-000000000004',
  actingPartyId: PARTY_ID,
  expiresAt: '2099-01-01T00:00:00.000Z',
  stepUpAt: '2026-09-02T11:55:00.000Z',
} as const satisfies AuthenticationSession;
const registrySession = {
  userId: USER_ID,
  actingPartyId: PARTY_ID,
  capabilities: ['cms.schema_registry.read'],
  mfaFresh: true,
} as const;
const portInput = (overrides: Readonly<Record<string, unknown>> = {}) =>
  ({
    operationId: 'CMS-03A-01',
    request,
    requestId: REQUEST_ID,
    ...overrides,
  }) as unknown as ContentSchemaRegistryPortInput;
const contexts = new WeakMap<
  Request,
  import('./production-types').ServerSessionContext
>();

describe('content registry production error helpers', () => {
  it('keeps errors typed and strips unsafe details', () => {
    expect(errorResult(400, 'BAD', 'message', {}, 3)).toMatchObject({
      ok: false,
      retryAfterSeconds: 3,
    });
    expect(safeDetails(null)).toEqual({});
    const hostile = {
      details: {
        dependencyClass: 'rpc',
        retryable: true,
        recoveryAction: 'retry',
        reasonCode: 'R',
        expectedVersion: '7',
        currentVersion: 8,
        limit: 9,
        resetAt: 10,
        retryAfterSeconds: 11,
        reason: 'private',
        secret: 'remove',
        object: {},
      },
    };
    // Each status keeps only its BE00 row; no status carries `reason`.
    expect(safeDetails(hostile)).toEqual({});
    expect(safeDetails(hostile, 400)).toEqual({});
    expect(safeDetails(hostile, 422)).toEqual({});
    expect(safeDetails(hostile, 401)).toEqual({ recoveryAction: 'retry' });
    expect(safeDetails(hostile, 403)).toEqual({
      reasonCode: 'R',
      recoveryAction: 'retry',
    });
    expect(safeDetails(hostile, 409)).toEqual({
      expectedVersion: '7',
      currentVersion: 8,
    });
    expect(safeDetails(hostile, 429)).toEqual({
      limit: 9,
      resetAt: 10,
      retryAfterSeconds: 11,
    });
    for (const status of [502, 503, 504])
      expect(safeDetails(hostile, status)).toEqual({
        dependencyClass: 'rpc',
        retryable: true,
        retryAfterSeconds: 11,
      });
    expect(safeDetails(hostile, 404)).toEqual({});
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isAbortError(new DOMException('aborted', 'AbortError'))).toBe(true);
    expect(isAbortError({ name: 'AbortError' })).toBe(true);
    expect(isAbortError(new Error('other'))).toBe(false);
    expect(sessionUnavailable()).toMatchObject({ status: 503 });
    expect(contextUnavailable()).toMatchObject({ status: 503 });
  });

  it('maps known RPC codes, statuses, unknown payloads, and auth failures', () => {
    const codes = [
      'INVALID_REQUEST',
      'UNSUPPORTED_MEDIA_TYPE',
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'IDEMPOTENCY_MISMATCH',
      'IDEMPOTENCY_CONFLICT',
      'VERSION_MISMATCH',
      'CONFLICT',
      'VALIDATION_FAILED',
      'RATE_LIMITED',
    ];
    for (const code of codes) expect(knownFailure(code)).not.toBeNull();
    expect(knownFailure('unknown')).toBeNull();
    expect(codeFromRpcError(null)).toBe('');
    expect(codeFromRpcError({ detail: 'validation_failed' })).toBe(
      'VALIDATION_FAILED',
    );
    expect(codeFromRpcError({ error: 1 })).toBe('');
    expect(mapRpcFailure(504, null)).toMatchObject({ status: 504 });
    expect(mapRpcFailure(502, null)).toMatchObject({ status: 502 });
    expect(mapRpcFailure(500, null)).toMatchObject({ status: 503 });
    expect(mapRpcFailure(499, null)).toMatchObject({ status: 503 });
    for (const status of [400, 401, 403, 404, 409, 413, 415, 422, 429, 503])
      expect(mapRpcFailure(status, null)).toMatchObject({ status });
    expect(
      mapRpcFailure(400, {
        code: 'VERSION_MISMATCH',
        details: { sql: 'hide' },
      }),
    ).toMatchObject({ status: 409, code: 'VERSION_MISMATCH' });
    const okAuth = { ok: true as const, value: 'ok' };
    expect(mapAuthResult(okAuth)).toEqual(okAuth);
    expect(
      mapAuthResult({
        ok: false,
        status: 418 as never,
        code: 'AUTH_FAILURE',
        message: 'safe',
        details: { dependencyClass: 'auth', limit: 2, secret: 'hide' },
      }),
    ).toMatchObject({
      status: 503,
      code: 'AUTH_FAILURE',
      details: { dependencyClass: 'auth' },
    });
    expect(statusIsSupported(400)).toBe(true);
    expect(statusIsSupported(418)).toBe(false);
  });

  it('canonicalizes every verifier status to the public boundary', () => {
    for (const status of [401, 403, 404, 409, 415, 422, 429, 504, 502, 500]) {
      const result = canonicalVerifierFailure({
        ok: false,
        status: status as 401,
        code: 'PRIVATE',
        message: 'private details',
        ...(status === 429 ? { retryAfterSeconds: 8 } : {}),
      });
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain('private details');
    }
    expect(
      canonicalVerifierFailure({
        ok: false,
        status: 400,
        code: 'PRIVATE',
        message: 'private',
      }),
    ).toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
  });
});

describe('content registry production context helpers', () => {
  it('normalizes configured origins and validates explicit origins', () => {
    expect(configuredOriginList(undefined)).toEqual([]);
    expect(configuredOriginList('')).toEqual([]);
    expect(configuredOriginList(' https://one.test,https://two.test ')).toEqual(
      ['https://one.test', 'https://two.test'],
    );
    class ConfigError extends Error {}
    expect(validateOriginList(undefined, ConfigError)).toEqual([]);
    expect(
      validateOriginList(['https://cms.example.test'], ConfigError),
    ).toEqual(['https://cms.example.test']);
    for (const value of [
      '*',
      '',
      'not a URL',
      'ftp://cms.example.test',
      'https://user:pass@cms.example.test',
      'https://cms.example.test/path',
      'https://cms.example.test/?q=1',
      'https://cms.example.test/#hash',
      `https://cms.example.test/${'a'.repeat(2048)}`,
      'https://cms.example.test/\n',
    ])
      expect(() => validateOriginList([value], ConfigError)).toThrow(
        ConfigError,
      );
    expect(() =>
      validateOriginList('https://cms.test' as never, ConfigError),
    ).toThrow(ConfigError);
  });

  it('binds server session context and optional release fields without trusting browser ids', () => {
    const noContext = contextFor(
      portInput({
        session: { userId: USER_ID, actingPartyId: PARTY_ID, mfaFresh: true },
      }),
      contexts,
      () => Date.parse('2026-09-02T12:00:00.000Z'),
    );
    expect(noContext).toMatchObject({
      authUserId: USER_ID,
      actingPartyId: PARTY_ID,
      stepUpVerified: true,
      correlationId: CORRELATION_ID,
    });
    const invalidCorrelation = new Request('https://api.example.test/cms', {
      headers: { 'x-correlation-id': 'invalid' },
    });
    const input = portInput({
      request: invalidCorrelation,
      session: registrySession,
      principal: {
        principalId: 'release-worker-01',
        keyId: 'release-key-v1',
        capabilities: ['release.block_registry.write'],
        verifiedAt: '2026-09-02T12:00:00.000Z',
        rawBodyHash: HASH,
        signatureHash: HASH,
        nonceHash: HASH,
      },
      body: { typeKey: 'article' },
      query: { limit: 10, sort: 'key', direction: 'asc' },
      path: { contentTypeId: USER_ID },
      idempotencyKey: 'idempotency',
      ifMatch: '7',
      release: {
        headers: {
          keyId: 'release-key-v1',
          issuedAt: '2026-09-02T12:00:00.000Z',
          nonce: 'nonce',
          signature: 'signature',
        },
        rawBody: new Uint8Array([1]),
      },
    });
    expect(correlationFor(input)).toBe(REQUEST_ID);
    expect(
      rpcBodyFor(input, contexts, () => Date.parse('2026-09-02T12:00:00.000Z')),
    ).toMatchObject({
      typeKey: 'article',
      limit: 10,
      contentTypeId: USER_ID,
      idempotencyKey: 'idempotency',
      expectedVersion: '7',
      ifMatch: '7',
      releaseKeyId: 'release-key-v1',
      releaseNonce: 'nonce',
      releaseIssuedAt: '2026-09-02T12:00:00.000Z',
      releaseRawBodyHash: HASH,
      releaseSignatureHash: HASH,
      releaseVerifiedAt: '2026-09-02T12:00:00.000Z',
      context: {
        authUserId: USER_ID,
        stepUpVerified: true,
        releasePrincipalId: 'release-key-v1',
      },
    });
    contexts.set(invalidCorrelation, {
      authUserId: USER_ID,
      sessionId: session.sessionId,
      actorPersonId: session.personId,
      actingPartyId: PARTY_ID,
      stepUpAt: null,
      actingContextId: null,
    });
    expect(
      contextFor(
        portInput({ request: invalidCorrelation }),
        contexts,
        Date.now,
      ),
    ).toMatchObject({ stepUpVerified: false, stepUpAt: null });
  });

  it('validates capability resolver output and abort/error recovery', async () => {
    expect(
      await capabilitiesFromResolver(
        vi.fn(async () => ['cms.schema_registry.read']),
        session,
        request,
        environment,
        signal,
      ),
    ).toEqual({ ok: true, value: ['cms.schema_registry.read'] });
    for (const values of [
      [''],
      Array.from({ length: 65 }, () => 'cms.schema_registry.read'),
      ['cms.schema_registry.read', 'cms.schema_registry.read'],
    ])
      await expect(
        capabilitiesFromResolver(
          vi.fn(async () => values),
          session,
          request,
          environment,
          signal,
        ),
      ).resolves.toMatchObject({ ok: false, status: 502 });
    await expect(
      capabilitiesFromResolver(
        vi.fn(async () => {
          throw new Error('offline');
        }),
        session,
        request,
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: false, status: 503 });
    await expect(
      capabilitiesFromResolver(
        vi.fn(async () => {
          throw new DOMException('abort', 'AbortError');
        }),
        session,
        request,
        environment,
        signal,
      ),
    ).resolves.toMatchObject({ ok: false, status: 504 });
    const controller = new AbortController();
    controller.abort();
    await expect(
      capabilitiesFromResolver(
        vi.fn(async () => {
          throw new Error('late');
        }),
        session,
        request,
        environment,
        controller.signal,
      ),
    ).resolves.toMatchObject({ ok: false, status: 504 });
  });
});
