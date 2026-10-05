import { describe, expect, it } from 'vitest';

import {
  buildContentSchemaRegistryBrowserOpenApiDocument,
  buildContentSchemaRegistryOpenApiDocument,
  contentSchemaRegistryRoutePolicies,
} from './index';
import { platformRegistrySet } from '../platform-registries.ts';

type Operation = {
  operationId: string;
  parameters: { name: string; required: boolean; schema: unknown }[];
  responses: Record<string, { description: string; content?: unknown }>;
  requestBody?: unknown;
  'x-auth': string;
  'x-step-up': string;
  'x-idempotency': string;
  'x-if-match': string;
  'x-rate-limit': Record<string, unknown>;
  'x-capability'?: string;
  'x-capabilities'?: string[];
};

const grantRoutes = contentSchemaRegistryRoutePolicies.filter(
  ({ operationId }) =>
    ['CMS-03A-15', 'CMS-03A-16', 'CMS-03A-17', 'CMS-03A-18'].includes(
      operationId,
    ),
);

const operation = (
  document: ReturnType<typeof buildContentSchemaRegistryOpenApiDocument>,
  path: string,
  method: 'get' | 'post',
): Operation =>
  (document.paths[path] as Record<string, Operation>)[method] as Operation;

describe('CMS-03A-15..18 route policies (BE03a Route Registry)', () => {
  it('registers four owner-only routes without a capability key', () => {
    expect(grantRoutes.map(({ operationId }) => operationId)).toEqual([
      'CMS-03A-15',
      'CMS-03A-16',
      'CMS-03A-17',
      'CMS-03A-18',
    ]);
    for (const route of grantRoutes) {
      expect(route).toMatchObject({
        auth: 'cms_owner',
        audience: 'browser',
        cors: 'cms-console',
        rawBodySignature: 'none',
        timeoutMs: 15_000,
        cacheControl: 'no-store',
        rateWindowSeconds: 60,
        rateScope: 'user',
      });
      expect(Object.hasOwn(route, 'capability')).toBe(false);
      expect(Object.hasOwn(route, 'capabilities')).toBe(false);
    }
  });

  it.each([
    [
      'CMS-03A-15',
      '/api/v1/cms/capability-grants',
      'CapabilityGrantRequestSchema',
      201,
      'none',
    ],
    [
      'CMS-03A-16',
      '/api/v1/cms/capability-grants/{grantId}/renewals',
      'CapabilityGrantRenewalRequestSchema',
      200,
      'required',
    ],
    [
      'CMS-03A-17',
      '/api/v1/cms/capability-grants/{grantId}/revocations',
      'CapabilityGrantRevocationRequestSchema',
      200,
      'required',
    ],
  ])('%s is a step-up owner mutation', (id, path, request, status, ifMatch) => {
    const route = grantRoutes.find(({ operationId }) => operationId === id);
    expect(route).toMatchObject({
      method: 'POST',
      path,
      requestSchema: request,
      successSchema: 'CmsCapabilityGrantResourceSchema',
      successStatus: status,
      csrf: 'required',
      stepUp: 'required',
      idempotency: 'required',
      ifMatch,
      rateClass: 'cms-activation',
      rateLimit: 10,
      partyRateLimit: 20,
    });
    expect(route?.errors).toEqual({
      INVALID_REQUEST: 400,
      UNAUTHENTICATED: 401,
      STEP_UP_REQUIRED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      UNSUPPORTED_MEDIA_TYPE: 415,
      VALIDATION_FAILED: 422,
      RATE_LIMITED: 429,
      BAD_GATEWAY: 502,
      DEPENDENCY_UNAVAILABLE: 503,
      GATEWAY_TIMEOUT: 504,
      INTERNAL_ERROR: 500,
    });
  });

  it('CMS-03A-18 is a no-store owner read without step-up', () => {
    expect(grantRoutes[3]).toMatchObject({
      method: 'GET',
      path: '/api/v1/cms/capability-grants',
      requestSchema: 'CmsCapabilityGrantListQuerySchema',
      successSchema: 'CmsCapabilityGrantListPageSchema',
      successStatus: 200,
      csrf: 'none',
      stepUp: 'none',
      idempotency: 'none',
      ifMatch: 'none',
      rateClass: 'cms-definition-read',
      rateLimit: 120,
      partyRateLimit: 240,
    });
    expect(grantRoutes[3]?.errors).not.toHaveProperty('STEP_UP_REQUIRED');
    expect(grantRoutes[3]?.errors).not.toHaveProperty('NOT_FOUND');
  });

  it('does not define a self-grant limit error', () => {
    for (const route of grantRoutes)
      expect(JSON.stringify(route.errors)).not.toContain('SELF_GRANT');
    expect(
      JSON.stringify(buildContentSchemaRegistryOpenApiDocument()),
    ).not.toContain('OWNER_SELF_GRANT_LIMITED');
  });
});

describe('CMS-03A-15..18 OpenAPI', () => {
  const internal = buildContentSchemaRegistryOpenApiDocument();
  const browser = buildContentSchemaRegistryBrowserOpenApiDocument();

  it('documents path parameters and the mutation precondition headers', () => {
    const create = operation(internal, '/api/v1/cms/capability-grants', 'post');
    expect(create.parameters.map(({ name }) => name)).toEqual([
      'Idempotency-Key',
    ]);
    const renew = operation(
      internal,
      '/api/v1/cms/capability-grants/{grantId}/renewals',
      'post',
    );
    expect(renew.parameters.map(({ name }) => name)).toEqual([
      'grantId',
      'Idempotency-Key',
      'If-Match',
    ]);
    const revoke = operation(
      internal,
      '/api/v1/cms/capability-grants/{grantId}/revocations',
      'post',
    );
    expect(revoke.parameters.map(({ name }) => name)).toEqual([
      'grantId',
      'Idempotency-Key',
      'If-Match',
    ]);
    for (const mutation of [create, renew, revoke]) {
      expect(mutation['x-auth']).toBe('cms_owner');
      expect(mutation['x-step-up']).toBe('required');
      expect(mutation).not.toHaveProperty('x-capability');
      expect(mutation).not.toHaveProperty('x-capabilities');
    }
  });

  it('documents the list query without a request body', () => {
    const list = operation(internal, '/api/v1/cms/capability-grants', 'get');
    expect(list.parameters.map(({ name }) => name)).toEqual([
      'subjectPersonId',
      'capability',
      'state',
      'limit',
      'cursor',
      'sort',
      'direction',
    ]);
    expect(list.parameters.every(({ required }) => !required)).toBe(true);
    expect(list.requestBody).toBeUndefined();
    expect(list.parameters[1]?.schema).toEqual({
      $ref: '#/components/schemas/GrantableCmsCapability',
    });
    expect(list.parameters[2]?.schema).toEqual({
      $ref: '#/components/schemas/CmsCapabilityGrantState',
    });
    expect(Object.keys(list.responses).sort()).toEqual([
      '200',
      '400',
      '401',
      '403',
      '422',
      '429',
      '500',
      '502',
      '503',
      '504',
    ]);
  });

  it('publishes the same four operations in the browser view', () => {
    for (const route of grantRoutes)
      expect(
        (browser.paths[route.path] as Record<string, unknown>)[
          route.method.toLowerCase()
        ],
      ).toBeDefined();
  });
});

describe('platform registry rows for CMS-03A-15..18', () => {
  it('carry the owner auth class and no capability key', () => {
    const rows = platformRegistrySet.routes.filter(({ operationId }) =>
      grantRoutes.some((route) => route.operationId === operationId),
    );
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.authClass).toBe('cms_owner');
      expect(row.capability).toBeUndefined();
      expect(row.capabilities).toBeUndefined();
      expect(row.capabilityMode).toBeUndefined();
    }
    expect(rows.map(({ stepUp }) => stepUp)).toEqual([
      'required',
      'required',
      'required',
      'none',
    ]);
  });
});
