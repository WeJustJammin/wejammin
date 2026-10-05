import { platformRegistrySet } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../infra/openapi-document.mjs';

const PATH = '/api/v1/admin/capability-snapshot';

type OperationShape = Readonly<{
  operationId: string;
  'x-capability'?: string;
  'x-step-up'?: string;
  'x-csrf'?: string;
  'x-cache-control'?: string;
  'x-timeout-ms'?: number;
  'x-success-schema'?: string;
  requestBody?: unknown;
  parameters?: unknown;
  responses: Record<string, unknown>;
}>;

const document = buildOpenApiDocument() as Readonly<{
  paths: Record<string, Record<string, OperationShape>>;
  components: { schemas: Record<string, { properties?: object }> };
}>;

describe('CFG-05B-07 canonical API authority', () => {
  it('registers a no-input, no-store session GET in the platform registry', () => {
    const route = platformRegistrySet.routes.find(
      ({ operationId }) => operationId === 'CFG-05B-07',
    );
    expect(route).toEqual(
      expect.objectContaining({
        method: 'GET',
        path: PATH,
        authClass: 'authenticated',
        cacheControl: 'no-store',
        requestSchema: 'EmptyRequestSchema',
        successSchema: 'Cfg05b07CapabilitySnapshotResponseSchema',
        rateLimit: 120,
        rateWindowSeconds: 60,
        rateScope: 'user',
        timeoutMs: 8_000,
      }),
    );
    // No named capability: the route projects the caller's own capabilities.
    expect(route).not.toHaveProperty('capability');
    expect(route).not.toHaveProperty('capabilities');
  });

  it('publishes the operation with only the success and safe error responses', () => {
    const operation = document.paths[PATH]?.get;
    expect(operation?.operationId).toBe('CFG-05B-07');
    expect(operation?.['x-success-schema']).toBe(
      'Cfg05b07CapabilitySnapshotResponseSchema',
    );
    expect(operation?.requestBody).toBeUndefined();
    expect(operation?.parameters).toBeUndefined();
    expect(Object.keys(operation?.responses ?? {})).toEqual([
      '200',
      '401',
      '403',
      '429',
      '500',
      '503',
      '504',
    ]);
  });

  it('exposes capability names only in the response component', () => {
    const properties = document.components.schemas
      .Cfg05b07CapabilitySnapshotResponse?.properties as Record<
      string,
      unknown
    >;
    expect(Object.keys(properties)).toEqual(['capabilities']);
  });
});
