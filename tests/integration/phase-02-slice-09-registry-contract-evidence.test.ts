import { describe, expect, it, vi } from 'vitest';

import {
  BlockDefinitionVersionResourceSchema,
  BlockLifecycleAdvanceRequestSchema,
  BlockLifecycleEventResourceSchema,
  BlockRegistrationRequestSchema,
  ContentSchemaRegistryDetailParamsSchema,
  ContentSchemaRegistryDetailSchema,
  ContentSchemaRegistryListPageSchema,
  ContentSchemaRegistryListQuerySchema,
  ContentTypeDraftRequestSchema,
  ContentTypeVersionResourceSchema,
  FieldDefinitionVersionResourceSchema,
  FieldSchemaChangeRequestSchema,
  RelationBindingRequestSchema,
  RelationDefinitionResourceSchema,
  SchemaActivationRequestSchema,
  SchemaActivationResourceSchema,
  contentSchemaRegistryRoutePolicies,
  CONTENT_SCHEMA_REGISTRY_OPERATION_IDS,
} from '../../packages/contracts/src/content-schema-registry';
import { ApiErrorSchema } from '../../packages/contracts/src/api-error';
import {
  CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS,
  forwardContentSchemaRegistryMutation,
} from '../../apps/web/src/server/content-schema-registry-platform-api';
import { CONTENT_SCHEMA_REGISTRY_SAFE_ERROR_MESSAGES } from '../../apps/web/src/components/content-schema-registry/content-schema-registry-types';
import { executeContentSchemaRegistryMutation } from '../../apps/web/src/components/content-schema-registry/content-schema-registry-runtime';
import {
  bindContentSchemaRegistryRealtimeInvalidation,
  createContentSchemaRegistryInvalidationHint,
} from '../../apps/web/src/components/content-schema-registry/content-schema-registry-invalidation';
import {
  activation as sharedActivation,
  block,
  detail as sharedDetail,
  field,
  lifecycleEvent,
  relation,
  resource as sharedResource,
  safeBlock,
  validActivation,
  validBlock,
  validDraft as sharedValidDraft,
  validField,
  validLifecycle,
  validRelation,
} from '../../apps/worker/src/content-schema-registry/phase-02-slice-09-test-values';

// BE03a OD-4 (2026-10-02) added the locale configuration to
// ContentTypeDraftRequest, ContentTypeVersionResource and SchemaActivationResource.
// The shared fixtures predate it, so this file supplies a valid configuration; the
// shared worker fixtures and the producers that must emit these members stay tracked
// by the reopened P2-S09-AC-264.
const localeConfig = {
  supportedLocales: ['en-US'],
  fallbackChains: {},
} as const;
const localeConfigHash = 'a'.repeat(64);
const validDraft = { ...sharedValidDraft, ...localeConfig };
const resource = { ...sharedResource, ...localeConfig, localeConfigHash };
const activation = { ...sharedActivation, localeConfigHash };
const detail = { ...sharedDetail, resource };

const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TYPE_ID = '30000000-0000-4000-8000-000000000003';
const VERSION_ID = '40000000-0000-4000-8000-000000000004';
const IDEMPOTENCY_KEY = 's09-contract-operation-001';

const requestFixtures = {
  ContentTypeDraftRequestSchema: validDraft,
  FieldSchemaChangeRequestSchema: validField,
  RelationBindingRequestSchema: validRelation,
  SchemaActivationRequestSchema: validActivation,
  BlockRegistrationRequestSchema: validBlock,
  ContentSchemaRegistryListQuerySchema: {},
  ContentSchemaRegistryDetailParamsSchema: {
    contentTypeId: TYPE_ID,
    versionId: VERSION_ID,
  },
  BlockLifecycleAdvanceRequestSchema: validLifecycle,
} as const;

const successFixtures = {
  ContentTypeVersionResourceSchema: resource,
  FieldDefinitionVersionResourceSchema: field,
  RelationDefinitionResourceSchema: relation,
  SchemaActivationResourceSchema: activation,
  BlockDefinitionVersionResourceSchema: block,
  ContentSchemaRegistryListPageSchema: {
    items: [resource, safeBlock],
    nextCursor: null,
  },
  // The shared worker fixture predates the DEC-108 required activationPreparation
  // member, so the contract-evidence fixture supplies a valid empty projection.
  ContentSchemaRegistryDetailSchema: {
    ...detail,
    activationPreparation: {
      dryRunRef: null,
      jobRef: null,
      reviewRef: null,
      permittedNextActions: [],
    },
  },
  BlockLifecycleEventResourceSchema: lifecycleEvent,
} as const;

const requestSchemas = {
  ContentTypeDraftRequestSchema,
  FieldSchemaChangeRequestSchema,
  RelationBindingRequestSchema,
  SchemaActivationRequestSchema,
  BlockRegistrationRequestSchema,
  ContentSchemaRegistryListQuerySchema,
  ContentSchemaRegistryDetailParamsSchema,
  BlockLifecycleAdvanceRequestSchema,
} as const;

const successSchemas = {
  ContentTypeVersionResourceSchema,
  FieldDefinitionVersionResourceSchema,
  RelationDefinitionResourceSchema,
  SchemaActivationResourceSchema,
  BlockDefinitionVersionResourceSchema,
  ContentSchemaRegistryListPageSchema,
  ContentSchemaRegistryDetailSchema,
  BlockLifecycleEventResourceSchema,
} as const;

const ORIGINAL_OPERATION_IDS = [
  'CMS-03A-01',
  'CMS-03A-02',
  'CMS-03A-03',
  'CMS-03A-04',
  'CMS-03A-05',
  'CMS-03A-06',
  'CMS-03A-07',
  'CMS-03A-08',
] as const;

describe('P2-S09 generated contract integration evidence', () => {
  it('[P2-S09-AC-264] validates generated request and success fixtures for the eight original operations', () => {
    const originalPolicies = contentSchemaRegistryRoutePolicies.filter(
      ({ operationId }) =>
        (ORIGINAL_OPERATION_IDS as readonly string[]).includes(operationId),
    );
    expect(originalPolicies.map(({ operationId }) => operationId)).toEqual([
      ...ORIGINAL_OPERATION_IDS,
    ]);
    for (const route of originalPolicies) {
      expect(
        requestSchemas[route.requestSchema].safeParse(
          requestFixtures[route.requestSchema],
        ).success,
      ).toBe(true);
      expect(
        successSchemas[route.successSchema].safeParse(
          successFixtures[route.successSchema],
        ).success,
      ).toBe(true);
      for (const [code, status] of Object.entries(route.errors)) {
        expect(status).toBeGreaterThanOrEqual(400);
        expect(status).toBeLessThanOrEqual(599);
        expect(
          ApiErrorSchema.safeParse({
            code,
            message: 'safe operation error',
            requestId: REQUEST_ID,
            details: {},
          }).success,
        ).toBe(true);
      }
    }
  });

  it('[P2-S09-AC-264] forwards every browser mutation with its generated fields, ETag, and idempotency contract', async () => {
    const cases = [
      ['CMS-03A-01', validDraft, resource, 201, {}],
      ['CMS-03A-02', validField, field, 201, { ifMatch: '"1"' }],
      ['CMS-03A-03', validRelation, relation, 201, { ifMatch: '"1"' }],
      [
        'CMS-03A-04',
        validActivation,
        activation,
        202,
        { ifMatch: '"1"', stepUp: 'fresh-step-up-token' },
      ],
    ] as const;

    for (const [operationId, payload, responseBody, status, options] of cases) {
      let forwarded: Request | null = null;
      const binding = {
        fetch: vi.fn(async (input: RequestInfo | URL) => {
          forwarded = input instanceof Request ? input : new Request(input);
          return new Response(JSON.stringify(responseBody), {
            status,
            headers: {
              'content-type': 'application/json',
              etag: '"2"',
              'x-request-id': REQUEST_ID,
            },
          });
        }),
      };
      const request = new Request('https://app.test/app/cms-content-modeling', {
        method: 'POST',
        headers: {
          cookie: 'wj_access=session; wj_csrf=csrf',
          origin: 'https://app.test',
          'content-type': 'application/json',
          'x-csrf-token': 'csrf',
          'idempotency-key': IDEMPOTENCY_KEY,
          'x-client-binding-id': 'tab:cms-mutation-01',
          ...(options.ifMatch === undefined
            ? {}
            : { 'if-match': options.ifMatch }),
          ...(options.stepUp === undefined
            ? {}
            : { 'x-step-up-token': options.stepUp }),
        },
        body: JSON.stringify(payload),
      });
      const response = await forwardContentSchemaRegistryMutation(
        request,
        binding,
        {
          operationId,
          ...(operationId === 'CMS-03A-01'
            ? {}
            : { contentTypeId: TYPE_ID, versionId: VERSION_ID }),
        },
      );
      expect(response.status).toBe(status);
      expect(response.headers.get('etag')).toBe('"2"');
      expect(forwarded?.headers.get('idempotency-key')).toBe(IDEMPOTENCY_KEY);
      expect(forwarded?.headers.get('x-client-binding-id')).toBe(
        'tab:cms-mutation-01',
      );
      expect(forwarded?.headers.get('cache-control')).toBe('no-store');
      expect(
        CONTENT_SCHEMA_REGISTRY_MUTATION_OPERATIONS[operationId],
      ).toBeDefined();
    }
  });

  it('preserves a trusted structured mutation error and its recovery headers', async () => {
    const request = new Request('https://app.test/app/cms-content-modeling', {
      method: 'POST',
      headers: {
        cookie: 'wj_access=session; wj_csrf=csrf',
        origin: 'https://app.test',
        'content-type': 'application/json',
        'x-csrf-token': 'csrf',
        'idempotency-key': IDEMPOTENCY_KEY,
      },
      body: JSON.stringify(validDraft),
    });
    const binding = {
      fetch: vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              code: 'VALIDATION_FAILED',
              message: 'Check the highlighted schema fields.',
              requestId: REQUEST_ID,
              details: {
                violations: [
                  { pointer: '/label', message: 'Label is required' },
                ],
                currentVersion: '7',
                ownerId: 'must-not-cross-boundary',
              },
            }),
            {
              status: 422,
              headers: {
                'content-type': 'application/json',
                etag: '"7"',
                'retry-after': '11',
                'x-request-id': REQUEST_ID,
              },
            },
          ),
      ),
    };

    const response = await forwardContentSchemaRegistryMutation(
      request,
      binding,
      { operationId: 'CMS-03A-01' },
    );

    expect(response.status).toBe(422);
    expect(response.headers.get('etag')).toBe('"7"');
    expect(response.headers.get('retry-after')).toBe('11');
    await expect(response.json()).resolves.toEqual({
      code: 'VALIDATION_FAILED',
      message: 'Check the highlighted schema fields.',
      requestId: REQUEST_ID,
      details: {
        currentVersion: '7',
        violations: [{ pointer: '/label', message: 'Label is required' }],
      },
    });
  });

  it('[P2-S09-AC-264] maps rate limiting to the UI while retaining the idempotent form input', async () => {
    const formData = new FormData();
    formData.set('idempotency-key', IDEMPOTENCY_KEY);
    formData.set('typeKey', 'article');
    const result = await executeContentSchemaRegistryMutation({
      action: '/app/cms-content-modeling',
      operationId: 'CMS-03A-01',
      formData,
      reconciliationUrl: '/app/cms-content-modeling',
      fetcher: vi.fn(
        async () =>
          new Response('{}', { status: 429, headers: { 'retry-after': '9' } }),
      ),
    });
    expect(result).toMatchObject({
      outcome: 'rate-limited',
      attempts: 1,
      retryAfterSeconds: 9,
    });
    expect(result.formData.get('idempotency-key')).toBe(IDEMPOTENCY_KEY);
  });

  it('[P2-S09-AC-264] treats Realtime as an invalidation-only hint and keeps browser error copy bounded', () => {
    const messages: unknown[] = [];
    let listener: ((event: { readonly data: unknown }) => void) | undefined;
    const channel = {
      postMessage: (message: unknown) => messages.push(message),
      addEventListener: (_type: 'message', next: typeof listener) => {
        listener = next;
      },
      removeEventListener: () => undefined,
    };
    const invalidate = vi.fn();
    const unbind = bindContentSchemaRegistryRealtimeInvalidation(
      channel,
      invalidate,
    );
    const hint = createContentSchemaRegistryInvalidationHint();
    channel.postMessage(hint);
    listener?.({ data: hint });
    listener?.({ data: { ...hint, payload: resource } });
    unbind();

    expect(messages).toEqual([hint]);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(Object.keys(CONTENT_SCHEMA_REGISTRY_SAFE_ERROR_MESSAGES)).toEqual([
      'INVALID_REQUEST',
      'UNAUTHENTICATED',
      'FORBIDDEN',
      'NOT_FOUND',
      'VALIDATION_FAILED',
      'RATE_LIMITED',
      'DEPENDENCY_INVALID_RESPONSE',
      'DEPENDENCY_UNAVAILABLE',
      'DEPENDENCY_DEADLINE_EXCEEDED',
      'INTERNAL_ERROR',
    ]);
  });

  it('[P2-S09-AC-284] registers all eighteen operation policies with request and success schemas and valid error codes', () => {
    expect(CONTENT_SCHEMA_REGISTRY_OPERATION_IDS).toHaveLength(18);
    expect(
      contentSchemaRegistryRoutePolicies.map(({ operationId }) => operationId),
    ).toEqual([...CONTENT_SCHEMA_REGISTRY_OPERATION_IDS]);
    for (const route of contentSchemaRegistryRoutePolicies) {
      expect(route.requestSchema.length, route.operationId).toBeGreaterThan(0);
      expect(route.successSchema.length, route.operationId).toBeGreaterThan(0);
      for (const [code, status] of Object.entries(route.errors)) {
        expect(status, `${route.operationId} ${code}`).toBeGreaterThanOrEqual(
          400,
        );
        expect(status, `${route.operationId} ${code}`).toBeLessThanOrEqual(599);
      }
    }
  });
});
