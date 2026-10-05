import { platformRegistrySet } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../infra/openapi-document.mjs';

describe('Slice 12 CMS-03C-03 canonical API authority', () => {
  it('registers the served taxonomy-term operation with its declared protections', () => {
    const route = platformRegistrySet.routes.find(
      ({ operationId }) => operationId === 'CMS-03C-03',
    );
    expect(route).toEqual(
      expect.objectContaining({
        method: 'POST',
        path: '/api/v1/cms/taxonomies/{taxonomyId}/terms/actions',
        authClass: 'taxonomy_curator',
        capabilities: ['cms.taxonomy_curator'],
        corsClass: 'cms-console',
        csrf: 'required',
        idempotency: 'required',
        ifMatch: 'required',
        rateClass: 'cms-taxonomy-write',
        rateLimit: 60,
        partyRateLimit: 120,
        timeoutMs: 15_000,
        sloTier: 'tier_2',
        requestSchema: 'TaxonomyTermActionApiRequestSchema',
        successSchema: 'TaxonomyTermResourceSchema',
      }),
    );
  });

  it('publishes the path, strong headers, action body, 200 resource, and safe errors', () => {
    const document = buildOpenApiDocument() as Readonly<{
      paths: Readonly<
        Record<
          string,
          Readonly<
            Record<
              string,
              {
                operationId: string;
                parameters: readonly {
                  name: string;
                  in: string;
                  required: boolean;
                }[];
                requestBody: {
                  content: {
                    'application/json': {
                      schema: { properties: Record<string, unknown> };
                    };
                  };
                };
                responses: Record<
                  string,
                  {
                    content?: {
                      'application/json'?: { schema?: { $ref: string } };
                    };
                  }
                >;
              }
            >
          >
        >
      >;
      components: { schemas: Record<string, unknown> };
    }>;
    const operation =
      document.paths['/api/v1/cms/taxonomies/{taxonomyId}/terms/actions']?.post;
    expect(operation?.operationId).toBe('CMS-03C-03');
    expect(operation?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'taxonomyId',
          in: 'path',
          required: true,
        }),
        expect.objectContaining({
          name: 'Idempotency-Key',
          in: 'header',
          required: true,
        }),
        expect.objectContaining({
          name: 'If-Match',
          in: 'header',
          required: true,
        }),
      ]),
    );
    expect(
      operation?.requestBody.content['application/json'].schema.properties,
    ).toEqual(
      expect.objectContaining({
        taxonomyId: expect.any(Object),
        action: expect.any(Object),
        termKey: expect.any(Object),
        expectedVersion: expect.any(Object),
      }),
    );
    expect(Object.keys(operation?.responses ?? {}).sort()).toEqual(
      [
        '200',
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
      operation?.responses['200']?.content?.['application/json']?.schema,
    ).toEqual({ $ref: '#/components/schemas/TaxonomyTermResource' });
    expect(document.components.schemas).toHaveProperty('TaxonomyTermResource');
  });
});
