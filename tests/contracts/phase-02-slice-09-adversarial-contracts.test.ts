import { describe, expect, it } from 'vitest';

import {
  BlockLifecycleAdvanceRequestSchema,
  BlockRegistrationRequestSchema,
  ContentSchemaRegistryListQuerySchema,
  ContentTypeDraftRequestSchema,
  FieldSchemaChangeRequestSchema,
  platformRegistrySet,
  RelationBindingRequestSchema,
  buildContentSchemaRegistryOpenApiDocument,
  buildContentSchemaRegistryBrowserOpenApiDocument,
  contentSchemaRegistryRoutePolicies,
} from '@wejammin/contracts';
import { buildOpenApiDocument } from '../../infra/openapi-document.mjs';
import {
  validBlock,
  validDraft,
  validFieldChange,
  validLifecycle,
  validRelation,
} from './phase-02-slice-09-adversarial-fixtures';

const resultOperation = (
  document: ReturnType<typeof buildContentSchemaRegistryOpenApiDocument>,
  path: string,
  method: 'get' | 'post',
): Record<string, unknown> => {
  const pathItem = document.paths[path];
  const operation = pathItem?.[method];
  expect(
    operation,
    `${method.toUpperCase()} ${path} is documented`,
  ).toBeDefined();
  return operation as Record<string, unknown>;
};

const responseKeys = (operation: Record<string, unknown>): string[] =>
  Object.keys(operation.responses as Record<string, unknown>).sort(
    (left, right) => Number(left) - Number(right),
  );

describe('S09 adversarial generated contract surfaces', () => {
  it('[P2-S09-AC-214] keeps route, OpenAPI, request, response, auth, CORS, rate, timeout, cache, and error metadata aligned', () => {
    const document = buildContentSchemaRegistryOpenApiDocument();
    const expectedMethods = new Set(['GET', 'POST']);

    for (const route of contentSchemaRegistryRoutePolicies) {
      expect(expectedMethods.has(route.method)).toBe(true);
      const operation = resultOperation(
        document,
        route.path,
        route.method.toLowerCase() as 'get' | 'post',
      );
      const response = operation.responses as Record<string, unknown>;
      const successStatuses = route.successStatuses ?? [route.successStatus];
      for (const status of successStatuses)
        expect(response[String(status)]).toBeDefined();
      for (const status of new Set(Object.values(route.errors)))
        expect(response[String(status)]).toBeDefined();

      expect(operation.operationId).toBe(route.operationId);
      expect(operation['x-auth']).toBe(route.auth);
      expect(operation['x-capability']).toBe(route.capability);
      expect(operation['x-capabilities']).toEqual(
        route.capabilities ??
          (route.capability === undefined ? undefined : [route.capability]),
      );
      expect(operation['x-capability-mode']).toBe(route.capabilityMode);
      expect(operation['x-step-up']).toBe(route.stepUp);
      expect(operation['x-cors']).toBe(route.cors);
      expect(operation['x-cache-control']).toBe(route.cacheControl);
      expect(operation['x-timeout-ms']).toBe(route.timeoutMs);
      expect(operation['x-slo']).toEqual(route.slo);
      expect(operation['x-idempotency']).toBe(route.idempotency);
      expect(operation['x-if-match']).toBe(route.ifMatch);
      expect(operation['x-raw-body-signature']).toBe(route.rawBodySignature);
      expect(operation['x-rate-limit']).toMatchObject({
        class: route.rateClass,
        limit: route.rateLimit,
        partyLimit: route.partyRateLimit,
        windowSeconds: route.rateWindowSeconds,
        scope: route.rateScope,
      });

      const requestRef = operation['x-request-schema'] as { $ref: string };
      expect(requestRef.$ref).toBe(
        `#/components/schemas/${route.requestSchema.replace(/Schema$/u, '')}`,
      );
      expect(responseKeys(operation)).toEqual(
        [...new Set([...successStatuses, ...Object.values(route.errors)])]
          .map(String)
          .sort((left, right) => Number(left) - Number(right)),
      );
    }

    const canonical = buildOpenApiDocument();
    const canonicalRoutes = platformRegistrySet.routes.filter(
      ({ operationId }) => operationId.startsWith('CMS-03A-'),
    );
    expect(canonicalRoutes).toHaveLength(18);
    expect(canonicalRoutes.map(({ operationId }) => operationId)).toEqual(
      contentSchemaRegistryRoutePolicies.map(({ operationId }) => operationId),
    );
    for (const route of canonicalRoutes) {
      const operation = resultOperation(
        canonical,
        route.path,
        route.method.toLowerCase() as 'get' | 'post',
      );
      expect(operation.operationId).toBe(route.operationId);
      expect(operation['x-capability']).toBe(route.capability);
      expect(operation['x-capabilities']).toEqual(route.capabilities);
      expect(operation['x-capability-mode']).toBe(route.capabilityMode);
      expect(operation['x-step-up']).toBe(route.stepUp);
      expect(operation['x-cors']).toBe(route.corsClass);
      expect(operation['x-audience']).toBe(route.audience);
      expect(operation['x-timeout-ms']).toBe(route.timeoutMs);
      expect(operation['x-slo']).toEqual(route.slo);
      expect(operation['x-cache-class']).toBe(route.cacheClass);
      expect(operation['x-cache-control']).toBe(route.cacheControl);
      expect(operation['x-rate-class']).toBe(route.rateClass);
      expect(operation['x-rate-limit']).toEqual({
        class: route.rateClass,
        limit: route.rateLimit,
        ...(route.partyRateLimit !== undefined
          ? { partyLimit: route.partyRateLimit }
          : {}),
        windowSeconds: route.rateWindowSeconds,
        scope: route.rateScope,
      });
      expect(operation['x-auth-class']).toBe(route.authClass);
      expect(operation['x-csrf']).toBe(route.csrf);
      expect(operation['x-idempotency']).toBe(route.idempotency);
      expect(operation['x-if-match']).toBe(route.ifMatch);
      expect(operation['x-raw-body-signature']).toBe(route.rawBodySignature);
      expect(operation['x-success-schema']).toBe(
        route.openApiSuccessSchema ?? route.successSchema,
      );
    }
    expect(JSON.stringify(canonical)).not.toMatch(
      /BlockDefinitionVersionResource|BlockLifecycleEventResource/iu,
    );

    const browser = buildContentSchemaRegistryBrowserOpenApiDocument();
    expect(browser['x-audience']).toBe('browser');
    expect(JSON.stringify(browser)).not.toMatch(
      /CMS-03A-05|CMS-03A-08|X-WeJammin-Release-|BlockDefinitionVersionResource|BlockLifecycleEventResource|BlockLifecycleEventReceipt|PropsSchemaSnapshot|PropsSnapshotAttestation|CmsEd25519Signature|release-worker/iu,
    );
  });

  it('[P2-S09-AC-216] rejects unknown keys and executable, SQL-like, regex, and arbitrary projection inputs without mutating input', () => {
    const cases: readonly [
      string,
      { safeParse: (value: unknown) => { success: boolean } },
      unknown,
    ][] = [
      [
        'draft unknown key',
        ContentTypeDraftRequestSchema,
        { ...validDraft, __unexpected: '<script>alert(1)</script>' },
      ],
      [
        'field unknown constraint',
        FieldSchemaChangeRequestSchema,
        { ...validFieldChange, constraints: { pattern: '.*' } },
      ],
      [
        'relation projection SQL',
        RelationBindingRequestSchema,
        { ...validRelation, projectionKey: 'users;DROP TABLE users' },
      ],
      [
        'block renderer script URL',
        BlockRegistrationRequestSchema,
        { ...validBlock, rendererRef: 'javascript:import("evil")' },
      ],
      [
        'lifecycle unknown key',
        BlockLifecycleAdvanceRequestSchema,
        { ...validLifecycle, expression: '${process.env.SECRET}' },
      ],
      [
        'list arbitrary projection',
        ContentSchemaRegistryListQuerySchema,
        { resourceKind: 'relation_definition', projection: 'users.*' },
      ],
    ];

    for (const [label, schema, value] of cases) {
      const before = structuredClone(value);
      expect(schema.safeParse(value).success, label).toBe(false);
      expect(value, `${label} input was mutated`).toEqual(before);
    }

    const unicodeKey = { ...validFieldChange, key: 'cafe\u0301' };
    expect(FieldSchemaChangeRequestSchema.safeParse(unicodeKey).success).toBe(
      false,
    );
    expect(
      RelationBindingRequestSchema.safeParse({
        ...validRelation,
        targetType: '../private_records',
      }).success,
    ).toBe(false);
    expect(
      BlockRegistrationRequestSchema.safeParse({
        ...validBlock,
        propsSchemaRef: 'schemas/../private.json',
      }).success,
    ).toBe(false);
  });
});
