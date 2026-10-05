import { describe, expect, it, vi } from 'vitest';

import type {
  ContentSchemaRegistryOperationId,
  ContentSchemaRegistryPortInput,
} from './types';
import {
  CMS_SCHEMA_REGISTRY_RPC,
  createProductionContentSchemaRegistryDependencies,
} from './production';
import {
  USER_ID,
  PARTY_ID,
  SESSION_ID,
  PERSON_ID,
  ACTING_CONTEXT_ID,
  REQUEST_ID,
  CORRELATION_ID,
  STEP_UP_AT,
  NOW,
  environment,
  newRequest,
  requestContext,
  authSession,
  json,
  releasePrincipal,
  releaseHeaders,
  rpcName,
} from './production-private-context-test-support';

describe('content registry private acting-context RPC projection', () => {
  it('keeps the binding private and projects it only into the activation RPC context among the original eight operations (review and grant operations have their own suites)', async () => {
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
      Partial<
        Record<
          ContentSchemaRegistryOperationId,
          (
            input: ContentSchemaRegistryPortInput,
            signal: AbortSignal,
          ) => Promise<unknown>
        >
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
    for (const input of inputs)
      await portFor[input.operationId]?.(input, signal);

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
});
