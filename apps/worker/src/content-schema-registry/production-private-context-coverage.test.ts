import { describe, expect, it, vi } from 'vitest';

import { RequestContextSchema } from '@wejammin/contracts';
import type { Logger } from '@wejammin/observability/logging';

import type { WorkerBindings } from '../index';
import { normalizeAuthProductionOptions } from '../authentication/production-configuration';
import type { AuthenticationSession } from '../authentication/types';
import type {
  ContentSchemaRegistryOperationId,
  ContentSchemaRegistryPortInput,
  ReleasePrincipal,
} from './types';
import { createSessionResolver } from './production-auth';
import {
  CMS_SCHEMA_REGISTRY_RPC,
  createProductionContentSchemaRegistryDependencies,
} from './production';
import { contextFor, rpcBodyFor } from './production-context';
import {
  DEFAULT_DEADLINE_MS,
  MAX_DEFAULT_RESPONSE_BYTES,
  type ProductionConfiguration,
  type ServerSessionContext,
} from './production-types';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const PARTY_ID = '20000000-0000-4000-8000-000000000002';
const SESSION_ID = '30000000-0000-4000-8000-000000000003';
const PERSON_ID = '40000000-0000-4000-8000-000000000004';
const ACTING_CONTEXT_ID = '90000000-0000-4000-8000-000000000009';
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CORRELATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NONCE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const HASH = 'a'.repeat(64);
const STEP_UP_AT = '2026-09-02T11:55:00.000Z';
const NOW = Date.parse('2026-09-02T12:00:00.000Z');

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'private-context-coverage',
  SUPABASE_SECRET_KEY: 'sb_secret_private_context_coverage',
  SUPABASE_URL: 'https://supabase.example.test',
};

const newRequest = (): Request =>
  new Request('https://api.example.test/api/v1/cms/content-types', {
    headers: {
      'x-request-id': REQUEST_ID,
      'x-correlation-id': CORRELATION_ID,
    },
  });

const requestContext = RequestContextSchema.parse({
  requestId: REQUEST_ID,
  correlationId: CORRELATION_ID,
  causationId: null,
  traceId: `worker-${REQUEST_ID}`,
  userId: USER_ID,
  actingPartyId: PARTY_ID,
  capabilities: ['cms.schema_registry.read'],
  locale: 'en-US',
  clientVersion: 'private-context-coverage',
});

const authSession = (
  overrides: Partial<AuthenticationSession> = {},
): AuthenticationSession =>
  ({
    authUserId: USER_ID,
    sessionId: SESSION_ID,
    accountState: 'active',
    personId: PERSON_ID,
    actingPartyId: PARTY_ID,
    expiresAt: '2099-01-01T00:00:00.000Z',
    stepUpAt: STEP_UP_AT,
    ...overrides,
  }) as AuthenticationSession;

const withoutPrivateBinding = (
  session: AuthenticationSession,
): AuthenticationSession => {
  const copy = { ...session } as unknown as Record<string, unknown>;
  delete copy.actingContextId;
  return copy as unknown as AuthenticationSession;
};

const configuration: ProductionConfiguration = {
  auth: normalizeAuthProductionOptions({ environment }),
  deadlineMs: DEFAULT_DEADLINE_MS,
  maxResponseBytes: MAX_DEFAULT_RESPONSE_BYTES,
  now: () => NOW,
};

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const releasePrincipal: ReleasePrincipal = {
  principalId: 'release-worker-01',
  keyId: 'release-key-01',
  capabilities: ['release.block_registry.write'],
  verifiedAt: '2026-09-02T12:00:00.000Z',
  rawBodyHash: HASH,
  signatureHash: HASH,
  nonceHash: HASH,
};

const releaseHeaders = {
  keyId: releasePrincipal.keyId,
  issuedAt: '2026-09-02T12:00:00.000Z',
  nonce: NONCE,
  signature: 'A'.repeat(86) + '==',
} as const;

const rpcName = (input: string | URL | Request): string =>
  new URL(String(input)).pathname.split('/').at(-1) ?? '';

describe('content registry private acting-context capture', () => {
  it('captures the validated private binding id in the server session registry only', async () => {
    const request = newRequest();
    const contexts = new WeakMap<Request, ServerSessionContext>();
    const resolveSession = createSessionResolver(
      {
        environment,
        auth: {
          resolveSession: vi.fn(async () => ({
            ok: true as const,
            value: authSession({ actingContextId: ACTING_CONTEXT_ID }),
          })),
        },
        resolveRequestContext: vi.fn(async () => requestContext),
      },
      configuration,
      contexts,
    );

    const result = await resolveSession(request, new AbortController().signal);

    expect(result).toEqual({
      ok: true,
      value: {
        userId: USER_ID,
        actingPartyId: PARTY_ID,
        capabilities: ['cms.schema_registry.read'],
        mfaFresh: true,
        stepUpFreshUntil: '2026-09-02T12:05:00.000Z',
      },
    });
    expect(result.ok && result.value).not.toHaveProperty('actingContextId');
    expect(JSON.stringify(result)).not.toContain(ACTING_CONTEXT_ID);
    expect(contexts.get(request)).toEqual({
      authUserId: USER_ID,
      sessionId: SESSION_ID,
      actorPersonId: PERSON_ID,
      actingPartyId: PARTY_ID,
      stepUpAt: STEP_UP_AT,
      actingContextId: ACTING_CONTEXT_ID,
    });
    expect(JSON.stringify(contexts.get(request))).not.toContain('capabilities');
  });

  it.each([
    ['a missing', undefined],
    ['an explicit null', null],
  ] as const)(
    'normalizes %s private binding id to null',
    async (_label, privateBinding) => {
      const request = newRequest();
      const contexts = new WeakMap<Request, ServerSessionContext>();
      const session =
        privateBinding === undefined
          ? withoutPrivateBinding(
              authSession({ actingContextId: ACTING_CONTEXT_ID }),
            )
          : authSession({ actingContextId: privateBinding });
      const resolveSession = createSessionResolver(
        {
          environment,
          auth: {
            resolveSession: vi.fn(async () => ({
              ok: true as const,
              value: session,
            })),
          },
          resolveRequestContext: vi.fn(async () => requestContext),
        },
        configuration,
        contexts,
      );

      await expect(
        resolveSession(request, new AbortController().signal),
      ).resolves.toMatchObject({ ok: true, value: { userId: USER_ID } });
      expect(contexts.get(request)).toMatchObject({ actingContextId: null });
    },
  );

  it('keeps the binding private and projects it only into the activation RPC context', async () => {
    const request = newRequest();
    const fetchImpl = vi.fn<typeof fetch>(async () => json({ ok: true }));
    const dependencies = createProductionContentSchemaRegistryDependencies({
      environment,
      fetchImpl,
      auth: {
        resolveSession: vi.fn(async () => ({
          ok: true as const,
          value: authSession({ actingContextId: ACTING_CONTEXT_ID }),
        })),
      },
      resolveRequestContext: vi.fn(async () => requestContext),
      verifyRelease: vi.fn(async () => ({
        ok: true as const,
        value: releasePrincipal,
      })),
      humanOrigins: ['https://cms.example.test'],
      releaseOrigins: ['https://release.example.test'],
      now: () => NOW,
    });
    const signal = new AbortController().signal;

    await expect(dependencies.resolveSession(request, signal)).resolves.toEqual(
      {
        ok: true,
        value: {
          userId: USER_ID,
          actingPartyId: PARTY_ID,
          capabilities: ['cms.schema_registry.read'],
          mfaFresh: true,
          stepUpFreshUntil: '2026-09-02T12:05:00.000Z',
        },
      },
    );

    const inputs = [
      {
        operationId: 'CMS-03A-01',
        request,
        requestId: REQUEST_ID,
        session: {
          userId: USER_ID,
          actingPartyId: PARTY_ID,
          capabilities: ['cms.schema_registry.read'],
          mfaFresh: true,
        },
        body: { typeKey: 'article' },
        idempotencyKey: 'cms-create-001',
      },
      {
        operationId: 'CMS-03A-02',
        request,
        requestId: REQUEST_ID,
        path: { contentTypeId: USER_ID, versionId: PARTY_ID },
        body: { key: 'title' },
        idempotencyKey: 'cms-field-001',
        ifMatch: '7',
      },
      {
        operationId: 'CMS-03A-03',
        request,
        requestId: REQUEST_ID,
        path: { contentTypeId: USER_ID, versionId: PARTY_ID },
        body: { fieldId: USER_ID },
        idempotencyKey: 'cms-relation-001',
        ifMatch: '7',
      },
      {
        operationId: 'CMS-03A-04',
        request,
        requestId: REQUEST_ID,
        path: { contentTypeId: USER_ID, versionId: PARTY_ID },
        body: { expectedVersion: '7' },
        idempotencyKey: 'cms-activate-001',
        ifMatch: '7',
      },
      {
        operationId: 'CMS-03A-05',
        request,
        requestId: REQUEST_ID,
        body: { blockKey: 'hero.banner' },
        principal: releasePrincipal,
        idempotencyKey: 'cms-register-001',
        release: {
          headers: releaseHeaders,
          rawBody: new Uint8Array([1, 2, 3]),
        },
      },
      {
        operationId: 'CMS-03A-06',
        request,
        requestId: REQUEST_ID,
        query: { limit: 25, sort: 'key', direction: 'asc' },
      },
      {
        operationId: 'CMS-03A-07',
        request,
        requestId: REQUEST_ID,
        path: { contentTypeId: USER_ID, versionId: PARTY_ID },
      },
      {
        operationId: 'CMS-03A-08',
        request,
        requestId: REQUEST_ID,
        path: { blockDefinitionVersionId: USER_ID },
        body: { fromLifecycle: 'supported', toLifecycle: 'deprecated' },
        principal: releasePrincipal,
        idempotencyKey: 'cms-lifecycle-001',
        ifMatch: '7',
        release: { headers: releaseHeaders, rawBody: new Uint8Array([4, 5]) },
      },
    ] as unknown as readonly ContentSchemaRegistryPortInput[];
    const portFor: Readonly<
      Record<
        ContentSchemaRegistryOperationId,
        (
          input: ContentSchemaRegistryPortInput,
          signal: AbortSignal,
        ) => Promise<unknown>
      >
    > = {
      'CMS-03A-01': dependencies.ports.createTypeDraft,
      'CMS-03A-02': dependencies.ports.addFieldDefinition,
      'CMS-03A-03': dependencies.ports.bindRelation,
      'CMS-03A-04': dependencies.ports.activateSchema,
      'CMS-03A-05': dependencies.ports.registerBlock,
      'CMS-03A-06': dependencies.ports.listContentTypes,
      'CMS-03A-07': dependencies.ports.getContentTypeVersion,
      'CMS-03A-08': dependencies.ports.advanceBlockLifecycle,
    };
    for (const input of inputs) await portFor[input.operationId](input, signal);

    expect(fetchImpl.mock.calls.map(([input]) => rpcName(input))).toEqual(
      Object.values(CMS_SCHEMA_REGISTRY_RPC),
    );
    const rpcBodyAt = (index: number): { p_request: Record<string, unknown> } =>
      JSON.parse(String(fetchImpl.mock.calls[index]?.[1]?.body)) as {
        p_request: Record<string, unknown>;
      };
    const serverContext = {
      authUserId: USER_ID,
      sessionId: SESSION_ID,
      actorPersonId: PERSON_ID,
      actingPartyId: PARTY_ID,
      stepUpVerified: true,
      stepUpAt: STEP_UP_AT,
      requestId: REQUEST_ID,
      correlationId: CORRELATION_ID,
    };
    for (const [index, input] of inputs.entries()) {
      const body = rpcBodyAt(index);
      expect(body.p_request.context, input.operationId).toEqual(
        input.operationId === 'CMS-03A-04'
          ? { ...serverContext, actingContextId: ACTING_CONTEXT_ID }
          : input.principal === undefined
            ? serverContext
            : { ...serverContext, releasePrincipalId: releasePrincipal.keyId },
      );
      expect(body.p_request, input.operationId).not.toHaveProperty(
        'actingContextId',
      );
    }
    const serialized = fetchImpl.mock.calls
      .filter((_, index) => inputs[index]?.operationId !== 'CMS-03A-04')
      .map(([, init]) => String(init?.body))
      .join('\n');
    expect(serialized).not.toContain(ACTING_CONTEXT_ID);
    expect(serialized).not.toContain('actingContextId');
  });

  it('keeps the default telemetry projection free of the private binding id for every operation', async () => {
    const info = vi.fn();
    const dependencies = createProductionContentSchemaRegistryDependencies({
      environment,
      fetchImpl: vi.fn<typeof fetch>(),
      logger: { info } as unknown as Logger,
    });
    for (const operationId of Object.keys(
      CMS_SCHEMA_REGISTRY_RPC,
    ) as ContentSchemaRegistryOperationId[])
      dependencies.telemetry?.({
        operationId,
        requestId: REQUEST_ID,
        correlationId: CORRELATION_ID,
        outcome: 'success',
        status: 200,
        durationMs: 1,
        actorClass: 'human',
      });
    expect(info.mock.calls.length).toBeGreaterThanOrEqual(8);
    expect(JSON.stringify(info.mock.calls)).not.toContain(ACTING_CONTEXT_ID);
    expect(JSON.stringify(info.mock.calls)).not.toContain('actingContextId');
  });

  it('never projects a captured private binding id into non-activation context or RPC bodies', () => {
    const request = newRequest();
    const contexts = new WeakMap<Request, ServerSessionContext>();
    const captured = {
      authUserId: USER_ID,
      sessionId: SESSION_ID,
      actorPersonId: PERSON_ID,
      actingPartyId: PARTY_ID,
      stepUpAt: STEP_UP_AT,
      actingContextId: ACTING_CONTEXT_ID,
    } as ServerSessionContext;
    contexts.set(request, captured);
    const input = {
      operationId: 'CMS-03A-06',
      request,
      requestId: REQUEST_ID,
    } as unknown as ContentSchemaRegistryPortInput;
    const expected = {
      authUserId: USER_ID,
      sessionId: SESSION_ID,
      actorPersonId: PERSON_ID,
      actingPartyId: PARTY_ID,
      stepUpVerified: true,
      stepUpAt: STEP_UP_AT,
      requestId: REQUEST_ID,
      correlationId: CORRELATION_ID,
    };

    expect(contextFor(input, contexts, () => NOW)).toEqual(expected);
    expect(rpcBodyFor(input, contexts, () => NOW)).toEqual({
      context: expected,
    });
    expect(
      JSON.stringify(rpcBodyFor(input, contexts, () => NOW)),
    ).not.toContain(ACTING_CONTEXT_ID);
  });
});
