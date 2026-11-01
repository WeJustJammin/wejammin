import { platformRegistrySet } from '@wejammin/contracts';
import { expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../infra/openapi-document.mjs';

/*
 * Shared lookups for the Slice 12 OpenAPI/registry agreement tests: one row
 * of the platform route registry and the generated operation it produces.
 */

export type OpenApiParameter = Readonly<{
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
}>;

export type OpenApiOperation = Readonly<{
  operationId: string;
  'x-auth-class': string;
  'x-capabilities'?: readonly string[];
  'x-capability-mode'?: string;
  'x-step-up'?: string;
  'x-csrf'?: string;
  'x-idempotency'?: string;
  'x-if-match'?: string;
  'x-owner': string;
  'x-rate-limit': Readonly<Record<string, unknown>>;
  'x-timeout-ms': number;
  'x-slo-tier': string;
  'x-request-schema': string;
  'x-success-schema': string;
  parameters?: readonly OpenApiParameter[];
  requestBody?: Readonly<{
    content: Readonly<{ 'application/json': Readonly<{ schema: unknown }> }>;
  }>;
  responses: Readonly<
    Record<
      string,
      Readonly<{
        headers?: Readonly<Record<string, unknown>>;
        content?: Readonly<{
          'application/json'?: Readonly<{ schema?: unknown }>;
        }>;
      }>
    >
  >;
}>;

type OpenApiDocument = Readonly<{
  paths: Readonly<Record<string, Readonly<Record<string, OpenApiOperation>>>>;
  components: Readonly<{ schemas: Readonly<Record<string, unknown>> }>;
}>;

let cached: OpenApiDocument | undefined;

export const openApiDocument = (): OpenApiDocument => {
  cached ??= buildOpenApiDocument() as OpenApiDocument;
  return cached;
};

export const registryRow = (operationId: string) =>
  platformRegistrySet.routes.find((route) => route.operationId === operationId);

/** The generated operation of a registry row, found by its method and path. */
export const openApiOperation = (operationId: string): OpenApiOperation => {
  const row = registryRow(operationId);
  if (row === undefined) throw new Error(`${operationId} is not registered.`);
  const operation =
    openApiDocument().paths[row.path]?.[row.method.toLowerCase()];
  if (operation === undefined)
    throw new Error(`${operationId} has no generated operation.`);
  return operation;
};

export const successRef = (
  operation: OpenApiOperation,
  status: string,
): unknown =>
  operation.responses[status]?.content?.['application/json']?.schema;

/** The status codes a generated operation answers, sorted. */
export const responseStatuses = (operation: OpenApiOperation): string[] =>
  Object.keys(operation.responses).sort();

export const parameterSummary = (operation: OpenApiOperation): string[] =>
  (operation.parameters ?? []).map(
    (parameter) =>
      `${parameter.in}:${parameter.name}${parameter.required ? '*' : ''}`,
  );

export const STANDARD_ERROR_STATUSES = [
  '400',
  '401',
  '403',
  '404',
  '409',
  '415',
  '422',
  '429',
  '500',
  '502',
  '503',
  '504',
] as const;

/** The registry row and generated operation a Slice 12 operation must produce. */
export type ExpectedOperation = Readonly<{
  id: string;
  marker: string;
  method: 'GET' | 'POST';
  path: string;
  authClass: string;
  capabilities?: readonly string[];
  capabilityMode?: string;
  stepUp: string;
  csrf: string;
  idempotency: string;
  ifMatch: string;
  owner: string;
  rateClass: string;
  limit: number;
  partyLimit: number;
  timeoutMs: number;
  sloTier: string;
  request: string;
  success: string;
  params: readonly string[];
  statuses: readonly string[];
  successStatuses: readonly string[];
  hasBody: boolean;
}>;

export const withErrors = (
  success: readonly string[],
  errors: readonly string[],
): string[] => [...success, ...errors].sort();

/** Registers the two agreement tests of each expected operation under the caller's describe. */
export const registerAgreementTests = (
  rows: readonly ExpectedOperation[],
): void => {
  for (const expected of rows) {
    it(`[${expected.marker}] ${expected.id} registers ${expected.method} ${expected.path} with its auth, step-up, concurrency, rate and SLO policy`, () => {
      const row = registryRow(expected.id);
      expect(row).toEqual(
        expect.objectContaining({
          method: expected.method,
          path: expected.path,
          authClass: expected.authClass,
          stepUp: expected.stepUp,
          csrf: expected.csrf,
          idempotency: expected.idempotency,
          ifMatch: expected.ifMatch,
          owner: expected.owner,
          corsClass: 'cms-console',
          audience: 'browser',
          rateClass: expected.rateClass,
          rateLimit: expected.limit,
          partyRateLimit: expected.partyLimit,
          rateWindowSeconds: 60,
          rateScope: 'user',
          timeoutMs: expected.timeoutMs,
          sloTier: expected.sloTier,
          requestSchema: expected.request,
          successSchema: expected.success,
          cacheClass: 'no_store',
          cacheControl: 'no-store',
        }),
      );
      expect(row?.capabilities).toEqual(expected.capabilities);
      expect(row?.capabilityMode).toBe(expected.capabilityMode);
      expect((row?.bolaTest ?? '').length).toBeGreaterThan(0);
    });

    it(`[${expected.marker}] ${expected.id} generates the documented parameters, request body, success statuses and error matrix`, () => {
      const operation = openApiOperation(expected.id);
      expect(operation.operationId).toBe(expected.id);
      expect(operation['x-step-up']).toBe(expected.stepUp);
      expect(operation['x-request-schema']).toBe(expected.request);
      expect(operation['x-success-schema']).toBe(expected.success);
      expect(operation['x-rate-limit']).toEqual({
        class: expected.rateClass,
        limit: expected.limit,
        partyLimit: expected.partyLimit,
        windowSeconds: 60,
        scope: 'user',
      });
      expect(operation['x-timeout-ms']).toBe(expected.timeoutMs);
      expect(parameterSummary(operation)).toEqual(expected.params);
      expect(operation.requestBody !== undefined).toBe(expected.hasBody);
      expect(responseStatuses(operation)).toEqual([...expected.statuses]);
      const component = expected.success.slice(0, -'Schema'.length);
      for (const status of expected.successStatuses)
        expect(successRef(operation, status)).toEqual({
          $ref: `#/components/schemas/${component}`,
        });
      expect(openApiDocument().components.schemas).toHaveProperty(component);
      expect(successRef(operation, '404')).toEqual(
        expected.statuses.includes('404')
          ? { $ref: '#/components/schemas/ApiError' }
          : undefined,
      );
    });
  }
};
