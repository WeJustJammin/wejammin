import { platformRegistrySet } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../infra/openapi-document.mjs';

type Operation = Readonly<{
  operationId: string;
  'x-auth-class': string;
  'x-capabilities': readonly string[];
  'x-capability-mode': string;
  'x-csrf': string;
  'x-idempotency': string;
  'x-if-match': string;
  'x-rate-limit': Readonly<Record<string, unknown>>;
  'x-timeout-ms': number;
  parameters?: readonly Readonly<{
    name: string;
    in: string;
    required: boolean;
  }>[];
  requestBody?: Readonly<{
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

describe('Slice 10 CMS-03B-10/11 canonical OpenAPI authority', () => {
  it('registers only the served create and draft-read policies', () => {
    const routes = platformRegistrySet.routes.filter(({ operationId }) =>
      ['CMS-03B-10', 'CMS-03B-11'].includes(operationId),
    );
    expect(routes).toEqual([
      expect.objectContaining({
        method: 'POST',
        path: '/api/v1/cms/entries',
        operationId: 'CMS-03B-10',
        authClass: 'editorial_author',
        capabilities: ['cms.author', 'cms.editor'],
        capabilityMode: 'any_of',
        csrf: 'required',
        idempotency: 'required',
        ifMatch: 'none',
        rateLimit: 120,
        partyRateLimit: 240,
        timeoutMs: 15_000,
      }),
      expect.objectContaining({
        method: 'GET',
        path: '/api/v1/cms/entries/{entryId}',
        operationId: 'CMS-03B-11',
        authClass: 'editorial_reader',
        capabilities: ['cms.author', 'cms.editor'],
        capabilityMode: 'any_of',
        csrf: 'none',
        idempotency: 'none',
        ifMatch: 'none',
        rateLimit: 300,
        partyRateLimit: 600,
        timeoutMs: 8_000,
      }),
    ]);
  });

  it('documents create without If-Match and draft read with UUID/locale parameters', () => {
    const document = buildOpenApiDocument() as Readonly<{
      paths: Readonly<Record<string, Readonly<Record<string, Operation>>>>;
      components: Readonly<{
        schemas: Readonly<Record<string, unknown>>;
      }>;
    }>;
    const create = document.paths['/api/v1/cms/entries']?.post;
    const detail = document.paths['/api/v1/cms/entries/{entryId}']?.get;

    expect(create?.operationId).toBe('CMS-03B-10');
    expect(create?.['x-capability-mode']).toBe('any_of');
    expect(create?.['x-if-match']).toBe('none');
    expect(create?.parameters).toEqual([
      expect.objectContaining({
        name: 'Idempotency-Key',
        in: 'header',
        required: true,
      }),
    ]);
    expect(
      create?.requestBody?.content['application/json'].schema.properties,
    ).toEqual(
      expect.objectContaining({
        contentTypeId: expect.any(Object),
        workflowPolicy: expect.any(Object),
      }),
    );
    expect(
      create?.responses['201']?.content?.['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/EntryCreateResource' });
    expect(
      create?.responses['409']?.content?.['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/ApiError' });

    expect(detail?.operationId).toBe('CMS-03B-11');
    expect(detail?.['x-capability-mode']).toBe('any_of');
    expect(detail?.requestBody).toBeUndefined();
    expect(detail?.parameters).toEqual([
      expect.objectContaining({
        name: 'entryId',
        in: 'path',
        required: true,
      }),
      expect.objectContaining({
        name: 'locale',
        in: 'query',
        required: false,
      }),
    ]);
    expect(
      detail?.responses['200']?.content?.['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/EntryDraftDetailResource' });
    expect(detail?.responses['409']).toBeUndefined();
    expect(document.components.schemas).toHaveProperty('EntryCreateResource');
    expect(document.components.schemas).toHaveProperty(
      'EntryDraftDetailResource',
    );
  });
});
