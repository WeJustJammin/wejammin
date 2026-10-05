import { platformRegistrySet } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../infra/openapi-document.mjs';

const PATH = '/api/v1/admin/identity/mfa-factor-resets';

type OperationShape = Readonly<{
  operationId: string;
  'x-step-up'?: string;
  'x-capability'?: string;
  'x-idempotency'?: string;
  'x-if-match'?: string;
  'x-csrf'?: string;
  'x-rate-limit'?: Record<string, unknown>;
  'x-timeout-ms'?: number;
  'x-success-schema'?: string;
  requestBody?: {
    required: boolean;
    content: { 'application/json': { schema: { $ref: string } } };
  };
  responses: Record<
    string,
    {
      content?: { 'application/json'?: { schema?: Record<string, unknown> } };
      headers?: Record<string, unknown>;
    }
  >;
}>;

const document = buildOpenApiDocument() as Readonly<{
  paths: Record<string, Record<string, OperationShape>>;
  components: { schemas: Record<string, { properties?: object }> };
}>;

describe('CFG-05B-06 canonical API authority', () => {
  it('registers the BE05b admin MFA reset in the platform registry', () => {
    const route = platformRegistrySet.routes.find(
      ({ operationId }) => operationId === 'CFG-05B-06',
    );
    expect(route).toEqual(
      expect.objectContaining({
        method: 'POST',
        path: PATH,
        authClass: 'admin_step_up',
        stepUp: 'required',
        capability: 'admin.identity.mfa_reset',
        capabilities: ['admin.identity.mfa_reset'],
        csrf: 'required',
        idempotency: 'required',
        ifMatch: 'none',
        rateClass: 'admin_mfa_factor_reset',
        rateLimit: 5,
        partyRateLimit: 10,
        rateWindowSeconds: 3600,
        rateScope: 'user',
        timeoutMs: 15_000,
        requestSchema: 'Cfg05b06MfaFactorResetRequestSchema',
        successSchema: 'Cfg05b06MfaFactorResetResponseSchema',
        owner: 'Identity',
      }),
    );
  });

  it('publishes step-up, capability, rate and idempotency metadata', () => {
    const operation = document.paths[PATH]?.post;
    expect(operation).toBeDefined();
    expect(operation?.operationId).toBe('CFG-05B-06');
    expect(operation?.['x-step-up']).toBe('required');
    expect(operation?.['x-capability']).toBe('admin.identity.mfa_reset');
    expect(operation?.['x-idempotency']).toBe('required');
    expect(operation?.['x-if-match']).toBe('none');
    expect(operation?.['x-csrf']).toBe('required');
    expect(operation?.['x-timeout-ms']).toBe(15_000);
    expect(operation?.['x-rate-limit']).toEqual({
      class: 'admin_mfa_factor_reset',
      limit: 5,
      partyLimit: 10,
      windowSeconds: 3600,
      scope: 'user',
    });
  });

  it('publishes the strict request body and the 200/202 resource', () => {
    const operation = document.paths[PATH]?.post;
    expect(operation?.requestBody?.required).toBe(true);
    expect(operation?.requestBody?.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/Cfg05b06MfaFactorResetRequest',
    });
    expect(
      Object.keys(
        document.components.schemas.Cfg05b06MfaFactorResetRequest?.properties ??
          {},
      ).sort(),
    ).toEqual(['reason', 'targetPersonId']);
    for (const status of ['200', '202']) {
      expect(
        operation?.responses[status]?.content?.['application/json']?.schema,
      ).toEqual({
        $ref: '#/components/schemas/Cfg05b06MfaFactorResetResponse',
      });
    }
  });

  it('publishes the exact unauthenticated or step-up 401 union and the other errors', () => {
    const responses = document.paths[PATH]?.post.responses ?? {};
    expect(responses['401']?.content?.['application/json']?.schema).toEqual({
      oneOf: [
        { $ref: '#/components/schemas/CmsUnauthenticatedError' },
        { $ref: '#/components/schemas/CmsStepUpRequiredError' },
      ],
    });
    for (const status of ['400', '403', '404', '409', '422', '429', '503']) {
      expect(responses[status]).toBeDefined();
    }
    expect(responses['429']?.headers).toBeDefined();
  });
});
