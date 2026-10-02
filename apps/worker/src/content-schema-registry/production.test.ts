import { describe, expect, it, vi } from 'vitest';

import {
  CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS,
  RequestContextSchema,
} from '@wejammin/contracts';

import type { WorkerBindings } from '../index';
import type { AuthenticationDependencies } from '../authentication/types';
import type { ContentSchemaRegistryPortInput } from './types';
import {
  CMS_SCHEMA_REGISTRY_RPC,
  createProductionContentSchemaRegistryDependencies,
} from './production';

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-09-production',
  SUPABASE_SECRET_KEY: 'sb_secret_slice_09_production',
  SUPABASE_URL: 'https://supabase.example.test///',
};

const USER_ID = '10000000-0000-4000-8000-000000000001';
const PARTY_ID = '20000000-0000-4000-8000-000000000002';
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CORRELATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NONCE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const HASH = 'a'.repeat(64);

const request = new Request(
  'https://api.example.test/api/v1/cms/content-types',
  {
    headers: {
      'x-request-id': REQUEST_ID,
      'x-correlation-id': CORRELATION_ID,
    },
  },
);

const json = (value: unknown, status = 200, headers?: HeadersInit): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const rpcName = (input: string | URL | Request): string =>
  new URL(String(input)).pathname.split('/').at(-1) ?? '';

const session = {
  userId: USER_ID,
  actingPartyId: PARTY_ID,
  capabilities: ['cms.schema_designer', 'cms.schema_registry.read'],
  mfaFresh: true,
  stepUpFreshUntil: '2026-09-02T12:05:00.000Z',
} as const;

const releasePrincipal = {
  principalId: 'release-worker-01',
  keyId: 'release-key-01',
  capabilities: ['release.block_registry.write'],
  verifiedAt: '2026-09-02T12:00:00.000Z',
  rawBodyHash: HASH,
  signatureHash: HASH,
  nonceHash: HASH,
} as const;

const releaseHeaders = {
  keyId: releasePrincipal.keyId,
  issuedAt: '2026-09-02T12:00:00.000Z',
  nonce: NONCE,
  signature: 'A'.repeat(86) + '==',
} as const;

const auth = (): Pick<AuthenticationDependencies, 'resolveSession'> => ({
  resolveSession: vi.fn(async () => ({
    ok: true as const,
    value: {
      authUserId: USER_ID,
      sessionId: '30000000-0000-4000-8000-000000000003',
      accountState: 'active' as const,
      personId: '40000000-0000-4000-8000-000000000004',
      actingPartyId: PARTY_ID,
      expiresAt: '2099-09-02T12:00:00.000Z',
      stepUpAt: '2026-09-02T11:55:00.000Z',
    },
  })),
});

const requestContext = RequestContextSchema.parse({
  requestId: REQUEST_ID,
  correlationId: CORRELATION_ID,
  causationId: null,
  traceId: `worker-${REQUEST_ID}`,
  userId: USER_ID,
  actingPartyId: PARTY_ID,
  capabilities: ['cms.schema_designer', 'cms.schema_registry.read'],
  locale: 'en-US',
  clientVersion: 'worker',
});

const options = (
  fetchImpl: typeof fetch,
  overrides: Readonly<Record<string, unknown>> = {},
) => ({
  environment,
  fetchImpl,
  auth: auth(),
  resolveRequestContext: vi.fn(async () => requestContext),
  verifyRelease: vi.fn(async () => ({
    ok: true as const,
    value: releasePrincipal,
  })),
  rateLimit: vi.fn(async () => ({
    ok: true as const,
    value: { allowed: true, limit: 20, remaining: 19, resetAt: 1_757_000_000 },
  })),
  humanOrigins: ['https://cms.example.test'],
  releaseOrigins: ['https://release.example.test'],
  ...overrides,
});

describe('S09 production content schema registry adapter', () => {
  it('maps all eight ports to named Supabase RPCs and forwards only server context', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json([]));
    const dependencies = createProductionContentSchemaRegistryDependencies(
      options(fetchImpl),
    );
    const signal = new AbortController().signal;
    await dependencies.resolveSession(request, signal);
    const inputs = [
      {
        operationId: 'CMS-03A-01' as const,
        body: { typeKey: 'article' },
        session,
        idempotencyKey: 'cms-create-001',
      },
      {
        operationId: 'CMS-03A-02' as const,
        path: { contentTypeId: USER_ID, versionId: PARTY_ID },
        body: { key: 'title' },
        session,
        idempotencyKey: 'cms-field-001',
        ifMatch: '7',
      },
      {
        operationId: 'CMS-03A-03' as const,
        path: { contentTypeId: USER_ID, versionId: PARTY_ID },
        body: { fieldId: USER_ID },
        session,
        idempotencyKey: 'cms-relation-001',
        ifMatch: '7',
      },
      {
        operationId: 'CMS-03A-04' as const,
        path: { contentTypeId: USER_ID, versionId: PARTY_ID },
        body: { expectedVersion: '7' },
        session,
        idempotencyKey: 'cms-activate-001',
        ifMatch: '7',
      },
      {
        operationId: 'CMS-03A-05' as const,
        body: { blockKey: 'hero.banner' },
        principal: releasePrincipal,
        idempotencyKey: 'cms-register-001',
        release: {
          headers: releaseHeaders,
          rawBody: new Uint8Array([1, 2, 3]),
        },
      },
      {
        operationId: 'CMS-03A-06' as const,
        query: { limit: 25, sort: 'key', direction: 'asc' },
        session,
      },
      {
        operationId: 'CMS-03A-07' as const,
        path: { contentTypeId: USER_ID, versionId: PARTY_ID },
        session,
      },
      {
        operationId: 'CMS-03A-08' as const,
        path: { blockDefinitionVersionId: USER_ID },
        body: { fromLifecycle: 'supported', toLifecycle: 'deprecated' },
        principal: releasePrincipal,
        idempotencyKey: 'cms-lifecycle-001',
        ifMatch: '7',
        release: { headers: releaseHeaders, rawBody: new Uint8Array([4, 5]) },
      },
    ] as const;

    for (const input of inputs) {
      const port = {
        'CMS-03A-01': dependencies.ports.createTypeDraft,
        'CMS-03A-02': dependencies.ports.addFieldDefinition,
        'CMS-03A-03': dependencies.ports.bindRelation,
        'CMS-03A-04': dependencies.ports.activateSchema,
        'CMS-03A-05': dependencies.ports.registerBlock,
        'CMS-03A-06': dependencies.ports.listContentTypes,
        'CMS-03A-07': dependencies.ports.getContentTypeVersion,
        'CMS-03A-08': dependencies.ports.advanceBlockLifecycle,
      }[input.operationId];
      await port(
        {
          ...input,
          request,
          requestId: REQUEST_ID,
        } as unknown as ContentSchemaRegistryPortInput,
        signal,
      );
    }

    expect(fetchImpl.mock.calls.map(([input]) => rpcName(input))).toEqual([
      CMS_SCHEMA_REGISTRY_RPC.createTypeDraft,
      CMS_SCHEMA_REGISTRY_RPC.addFieldDefinition,
      CMS_SCHEMA_REGISTRY_RPC.bindRelation,
      CMS_SCHEMA_REGISTRY_RPC.activateSchema,
      CMS_SCHEMA_REGISTRY_RPC.registerBlock,
      CMS_SCHEMA_REGISTRY_RPC.listContentTypes,
      CMS_SCHEMA_REGISTRY_RPC.getContentTypeVersion,
      CMS_SCHEMA_REGISTRY_RPC.advanceBlockLifecycle,
    ]);
    const rpcHeaders = new Headers(fetchImpl.mock.calls[0]?.[1]?.headers);
    expect(rpcHeaders.get('apikey')).toBe(environment.SUPABASE_SECRET_KEY);
    expect(rpcHeaders.has('authorization')).toBe(false);
    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toMatchObject({
      'X-Idempotency-Key': 'cms-field-001',
      'If-Match': '"7"',
      'X-Request-Id': REQUEST_ID,
      'X-Correlation-Id': CORRELATION_ID,
    });
    const humanBody = JSON.parse(
      String(fetchImpl.mock.calls[0]?.[1]?.body),
    ) as { p_request: Record<string, unknown> };
    expect(humanBody.p_request).toMatchObject({
      typeKey: 'article',
      idempotencyKey: 'cms-create-001',
      context: {
        authUserId: USER_ID,
        actingPartyId: PARTY_ID,
        sessionId: '30000000-0000-4000-8000-000000000003',
        requestId: REQUEST_ID,
        correlationId: CORRELATION_ID,
      },
    });
    expect(humanBody.p_request).not.toHaveProperty('operationId');
    expect(humanBody.p_request).not.toHaveProperty('ownerId');
    const releaseBody = JSON.parse(
      String(fetchImpl.mock.calls[4]?.[1]?.body),
    ) as { p_request: Record<string, unknown> };
    expect(releaseBody.p_request).toMatchObject({
      blockKey: 'hero.banner',
      releaseKeyId: releasePrincipal.keyId,
      releaseNonce: NONCE,
      releaseIssuedAt: releaseHeaders.issuedAt,
      releaseRawBodyHash: HASH,
      releaseSignatureHash: HASH,
      releaseSignature: releaseHeaders.signature,
      context: { releasePrincipalId: releasePrincipal.keyId },
    });
    expect(releaseBody.p_request).not.toHaveProperty('operationId');
    expect(releaseBody.p_request).not.toHaveProperty('releaseNonceHash');
    expect(JSON.stringify(releaseBody.p_request)).not.toContain('ownerId');
  });

  it('derives authenticated capabilities and fresh step-up state from server authorities', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json([]));
    const resolveRequestContext = vi.fn(async () => requestContext);
    const dependencies = createProductionContentSchemaRegistryDependencies(
      options(fetchImpl, {
        resolveRequestContext,
        now: () => Date.parse('2026-09-02T12:00:00.000Z'),
      }),
    );

    await expect(
      dependencies.resolveSession(request, new AbortController().signal),
    ).resolves.toEqual({ ok: true, value: session });
    expect(resolveRequestContext).toHaveBeenCalledWith(
      request,
      environment,
      expect.any(AbortSignal),
      expect.objectContaining({ authUserId: USER_ID, actingPartyId: PARTY_ID }),
    );
  });

  it.each(CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS)(
    'propagates the trusted server presentation scope %s without browser role input',
    async (presentationVariant) => {
      const fetchImpl = vi.fn<typeof fetch>(async () => json([]));
      const resolvePresentationVariant = vi.fn(async () => presentationVariant);
      const dependencies = createProductionContentSchemaRegistryDependencies(
        options(fetchImpl, { resolvePresentationVariant }),
      );

      await expect(
        dependencies.resolveSession(request, new AbortController().signal),
      ).resolves.toMatchObject({
        ok: true,
        value: { capabilities: session.capabilities, presentationVariant },
      });
      expect(resolvePresentationVariant).toHaveBeenCalledWith(
        expect.objectContaining({ authUserId: USER_ID }),
        request,
        environment,
        expect.any(AbortSignal),
      );
    },
  );

  it('keeps release verification injectable and preserves the exact rejected-principal boundary', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json([]));
    const verifier = vi.fn(async () => ({
      ok: false as const,
      status: 401 as const,
      code: 'INVALID_SIGNATURE',
      message: 'invalid signature',
      details: { sql: 'private' },
    }));
    const dependencies = createProductionContentSchemaRegistryDependencies(
      options(fetchImpl, { verifyRelease: verifier }),
    );
    const input = {
      operationId: 'CMS-03A-05' as const,
      request,
      requestId: REQUEST_ID,
      rawBody: new Uint8Array([1, 2, 3]),
      headers: releaseHeaders,
    };
    await expect(
      dependencies.verifyRelease(input, new AbortController().signal),
    ).resolves.toMatchObject({ ok: false, status: 401 });
    expect(verifier).toHaveBeenCalledWith(input, expect.any(AbortSignal));

    const unavailable = createProductionContentSchemaRegistryDependencies(
      options(fetchImpl, { verifyRelease: undefined }),
    );
    await expect(
      unavailable.verifyRelease(input, new AbortController().signal),
    ).resolves.toMatchObject({
      ok: false,
      status: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
    });
  });

  it('rejects injected release evidence that is not bound to the exact request bytes and headers', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json([]));
    const verifier = vi.fn(async () => ({
      ok: true as const,
      value: releasePrincipal,
    }));
    const dependencies = createProductionContentSchemaRegistryDependencies(
      options(fetchImpl, { verifyRelease: verifier }),
    );
    const input = {
      operationId: 'CMS-03A-05' as const,
      request,
      requestId: REQUEST_ID,
      rawBody: new Uint8Array([1, 2, 3]),
      headers: releaseHeaders,
    };
    await expect(
      dependencies.verifyRelease(input, new AbortController().signal),
    ).resolves.toMatchObject({
      ok: false,
      status: 502,
      code: 'DEPENDENCY_INVALID_RESPONSE',
    });
  });

  it('canonicalizes non-authentication verifier failures and never exposes verifier text', async () => {
    const dependencies = createProductionContentSchemaRegistryDependencies(
      options(
        vi.fn<typeof fetch>(async () => json([])),
        {
          verifyRelease: vi.fn(async () => ({
            ok: false as const,
            status: 403 as const,
            code: 'PRIVATE_POLICY_ERROR',
            message: 'private key registry and SQL details',
            details: { sql: 'secret' },
          })),
        },
      ),
    );
    const result = await dependencies.verifyRelease(
      {
        operationId: 'CMS-03A-05',
        request,
        requestId: REQUEST_ID,
        rawBody: new Uint8Array([1, 2, 3]),
        headers: releaseHeaders,
      },
      new AbortController().signal,
    );
    expect(result).toMatchObject({ ok: false, status: 403, code: 'FORBIDDEN' });
    expect(JSON.stringify(result)).not.toContain('private key registry');
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});
