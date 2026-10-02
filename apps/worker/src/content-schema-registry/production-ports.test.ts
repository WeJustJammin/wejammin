import { describe, expect, it, vi } from 'vitest';

import type { ContentSchemaRegistryPortInput } from './types';
import {
  CMS_SCHEMA_REGISTRY_RPC,
  createProductionContentSchemaRegistryDependencies,
} from './production';
import {
  environment,
  USER_ID,
  PARTY_ID,
  REQUEST_ID,
  CORRELATION_ID,
  NONCE,
  HASH,
  request,
  json,
  rpcName,
  session,
  releasePrincipal,
  releaseHeaders,
  options,
} from './production-test-support';

describe('S09 production content schema registry ports', () => {
  it('maps all eighteen ports to named Supabase RPCs and forwards only server context', async () => {
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
      {
        operationId: 'CMS-03A-09' as const,
        path: { contentTypeId: USER_ID, versionId: PARTY_ID },
        body: { expectedVersion: '7' },
        session,
        idempotencyKey: 'cms-successor-001',
        ifMatch: '7',
      },
      {
        operationId: 'CMS-03A-10' as const,
        path: { contentTypeId: USER_ID, versionId: PARTY_ID },
        body: {
          expectedVersion: '7',
          transformKey: null,
          transformVersion: null,
        },
        session,
        idempotencyKey: 'cms-dry-run-001',
        ifMatch: '7',
      },
      {
        operationId: 'CMS-03A-11' as const,
        path: { contentTypeId: USER_ID, versionId: PARTY_ID },
        body: { expectedVersion: '7', dryRunId: USER_ID },
        session,
        idempotencyKey: 'cms-submit-001',
        ifMatch: '7',
      },
      {
        operationId: 'CMS-03A-12' as const,
        path: { reviewId: USER_ID },
        body: { expectedVersion: '7', decision: 'approve' },
        session,
        idempotencyKey: 'cms-decide-001',
        ifMatch: '7',
      },
      {
        operationId: 'CMS-03A-13' as const,
        path: { reviewId: USER_ID },
        session,
      },
      {
        operationId: 'CMS-03A-14' as const,
        path: { reviewId: USER_ID },
        body: {
          action: 'revoke',
          expectedVersion: '7',
          assignmentId: PARTY_ID,
        },
        session,
        idempotencyKey: 'cms-assign-001',
        ifMatch: '7',
      },
      {
        operationId: 'CMS-03A-15' as const,
        body: {
          subjectPersonId: PARTY_ID,
          capability: 'cms.author',
          validThrough: '2026-09-08',
        },
        session,
        idempotencyKey: 'cms-grant-001',
      },
      {
        operationId: 'CMS-03A-16' as const,
        path: { grantId: USER_ID },
        body: { expectedVersion: '7', validThrough: '2026-09-08' },
        session,
        idempotencyKey: 'cms-renew-001',
        ifMatch: '7',
      },
      {
        operationId: 'CMS-03A-17' as const,
        path: { grantId: USER_ID },
        body: { expectedVersion: '7' },
        session,
        idempotencyKey: 'cms-revoke-001',
        ifMatch: '7',
      },
      {
        operationId: 'CMS-03A-18' as const,
        query: { limit: 25, sort: 'updatedAt', direction: 'desc' },
        session,
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
        'CMS-03A-09': dependencies.ports.createSchemaSuccessor,
        'CMS-03A-10': dependencies.ports.startSchemaDryRun,
        'CMS-03A-11': dependencies.ports.submitSchemaReview,
        'CMS-03A-12': dependencies.ports.decideSchemaReview,
        'CMS-03A-13': dependencies.ports.getSchemaReview,
        'CMS-03A-14': dependencies.ports.assignSchemaReview,
        'CMS-03A-15': dependencies.ports.grantCapability,
        'CMS-03A-16': dependencies.ports.renewCapabilityGrant,
        'CMS-03A-17': dependencies.ports.revokeCapabilityGrant,
        'CMS-03A-18': dependencies.ports.listCapabilityGrants,
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
      CMS_SCHEMA_REGISTRY_RPC.createSchemaSuccessor,
      CMS_SCHEMA_REGISTRY_RPC.startSchemaDryRun,
      CMS_SCHEMA_REGISTRY_RPC.submitSchemaReview,
      CMS_SCHEMA_REGISTRY_RPC.decideSchemaReview,
      CMS_SCHEMA_REGISTRY_RPC.getSchemaReview,
      CMS_SCHEMA_REGISTRY_RPC.assignSchemaReview,
      CMS_SCHEMA_REGISTRY_RPC.grantCapability,
      CMS_SCHEMA_REGISTRY_RPC.renewCapabilityGrant,
      CMS_SCHEMA_REGISTRY_RPC.revokeCapabilityGrant,
      CMS_SCHEMA_REGISTRY_RPC.listCapabilityGrants,
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
});
