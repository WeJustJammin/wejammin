import { platformRegistrySet } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../infra/openapi-document.mjs';

type Operation = Readonly<{
  operationId: string;
  'x-auth-class': string;
  'x-capability': string;
  'x-csrf': string;
  'x-idempotency': string;
  'x-if-match': string;
  'x-rate-limit': Readonly<Record<string, unknown>>;
  'x-timeout-ms': number;
  parameters: readonly Readonly<{
    name: string;
    in: string;
    required: boolean;
  }>[];
  requestBody: Readonly<{
    content: Readonly<{
      'application/json': Readonly<{
        schema: Readonly<{
          properties: Readonly<Record<string, unknown>>;
        }>;
      }>;
    }>;
  }>;
  responses: Readonly<
    Record<
      string,
      Readonly<{
        content?: Readonly<{
          'application/json'?: Readonly<{ schema?: { $ref: string } }>;
        }>;
      }>
    >
  >;
}>;

describe('Slice 12 CMS-03C-01 canonical OpenAPI authority', () => {
  it('registers a protected current-definition read for edit and conflict reconciliation', () => {
    const route = platformRegistrySet.routes.find(
      ({ operationId }) => operationId === 'cmsTemplateLatestRead',
    );
    expect(route).toEqual(
      expect.objectContaining({
        method: 'GET',
        path: '/api/v1/cms/templates/{templateKey}',
        authClass: 'template_designer',
        capability: 'cms.template_designer',
        csrf: 'none',
        idempotency: 'none',
        rateClass: 'cms-template-read',
        requestSchema: 'TemplateLatestApiRequestSchema',
        successSchema: 'TemplateVersionDetailSchema',
      }),
    );
    const document = buildOpenApiDocument() as Readonly<{
      paths: Readonly<Record<string, Readonly<Record<string, Operation>>>>;
    }>;
    const operation =
      document.paths['/api/v1/cms/templates/{templateKey}']?.get;
    expect(operation?.operationId).toBe('cmsTemplateLatestRead');
    expect(operation?.requestBody).toBeUndefined();
    expect(operation?.parameters).toEqual([
      expect.objectContaining({
        name: 'templateKey',
        in: 'path',
        required: true,
      }),
    ]);
    expect(
      operation?.responses['200']?.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/TemplateVersionDetail',
    });
  });
  it('registers a separate protected, no-store CMS-11 context read', () => {
    const route = platformRegistrySet.routes.find(
      ({ operationId }) => operationId === 'cmsTemplateContextRead',
    );
    expect(route).toEqual(
      expect.objectContaining({
        method: 'GET',
        path: '/api/v1/cms/templates/context',
        authClass: 'template_designer',
        capability: 'cms.template_designer',
        csrf: 'none',
        idempotency: 'none',
        rateClass: 'cms-template-read',
        successSchema: 'TemplateDesignerContextSchema',
      }),
    );
    const document = buildOpenApiDocument() as Readonly<{
      paths: Readonly<Record<string, Readonly<Record<string, Operation>>>>;
    }>;
    const operation = document.paths['/api/v1/cms/templates/context']?.get;
    expect(operation?.operationId).toBe('cmsTemplateContextRead');
    expect(operation?.requestBody).toBeUndefined();
    expect(
      operation?.responses['200']?.content?.['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/TemplateDesignerContext' });
  });
  it('registers the served template version route with conditional revision control', () => {
    const route = platformRegistrySet.routes.find(
      ({ operationId }) => operationId === 'CMS-03C-01',
    );
    expect(route).toEqual(
      expect.objectContaining({
        method: 'POST',
        path: '/api/v1/cms/templates/versions',
        authClass: 'template_designer',
        capability: 'cms.template_designer',
        csrf: 'required',
        idempotency: 'required',
        ifMatch: 'conditional',
        rateLimit: 30,
        partyRateLimit: 60,
        timeoutMs: 15_000,
      }),
    );
  });

  it('documents actual request headers, body, success, and safe errors', () => {
    const document = buildOpenApiDocument() as Readonly<{
      paths: Readonly<Record<string, Readonly<Record<string, Operation>>>>;
      components: Readonly<{
        schemas: Readonly<Record<string, unknown>>;
      }>;
    }>;
    const operation = document.paths['/api/v1/cms/templates/versions']?.post;

    expect(operation).toBeDefined();
    expect(operation?.operationId).toBe('CMS-03C-01');
    expect(operation?.['x-auth-class']).toBe('template_designer');
    expect(operation?.['x-capability']).toBe('cms.template_designer');
    expect(operation?.['x-csrf']).toBe('required');
    expect(operation?.['x-idempotency']).toBe('required');
    expect(operation?.['x-if-match']).toBe('conditional');
    expect(operation?.['x-rate-limit']).toEqual({
      class: 'cms-template-write',
      limit: 30,
      partyLimit: 60,
      windowSeconds: 60,
      scope: 'user',
    });
    expect(operation?.['x-timeout-ms']).toBe(15_000);
    expect(operation?.parameters).toEqual([
      expect.objectContaining({
        name: 'Idempotency-Key',
        in: 'header',
        required: true,
      }),
      expect.objectContaining({
        name: 'If-Match',
        in: 'header',
        required: false,
      }),
    ]);
    expect(
      operation?.requestBody.content['application/json'].schema.properties,
    ).toEqual(
      expect.objectContaining({
        templateKey: expect.any(Object),
        compatibleTypeIds: expect.any(Object),
        expectedVersion: expect.any(Object),
      }),
    );
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual(
      [
        '201',
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
      ].sort(),
    );
    expect(
      operation?.responses['201']?.content?.['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/TemplateVersionResource' });
    expect(
      operation?.responses['409']?.content?.['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/ApiError' });
    expect(document.components.schemas).toHaveProperty(
      'TemplateVersionResource',
    );
  });
});
