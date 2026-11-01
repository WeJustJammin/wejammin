import { platformRegistrySet } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../infra/openapi-document.mjs';
import {
  openApiOperation,
  registerAgreementTests,
  withErrors,
  type ExpectedOperation,
} from './phase-02-slice-12-openapi.test-support';

describe('Slice 12 CMS-03C-05 canonical API authority', () => {
  it('registers the served related-content operation with exact protection', () => {
    const route = platformRegistrySet.routes.find(
      ({ operationId }) => operationId === 'CMS-03C-05',
    );
    expect(route).toEqual(
      expect.objectContaining({
        method: 'POST',
        path: '/api/v1/cms/entries/{entryId}/related-content',
        authClass: 'editorial_author',
        capabilities: ['cms.author', 'cms.editor'],
        capabilityMode: 'any_of',
        corsClass: 'cms-console',
        csrf: 'required',
        idempotency: 'required',
        ifMatch: 'required',
        rateClass: 'cms-related-content-write',
        rateLimit: 60,
        partyRateLimit: 120,
        timeoutMs: 15_000,
        requestSchema: 'RelatedContentApiRequestSchema',
        successSchema: 'RelatedContentResourceSchema',
      }),
    );
  });

  it('publishes required path, headers, body, 201 resource, and safe errors', () => {
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
      document.paths['/api/v1/cms/entries/{entryId}/related-content']?.post;
    expect(operation?.operationId).toBe('CMS-03C-05');
    expect(operation?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'entryId',
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
        pins: expect.any(Object),
        exclusions: expect.any(Object),
        derivedRule: expect.any(Object),
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
    ).toEqual({ $ref: '#/components/schemas/RelatedContentResource' });
    expect(document.components.schemas).toHaveProperty(
      'RelatedContentResource',
    );
  });
});

/** DEC-195: the protected read of the saved rule, authorized as CMS-03C-05 (BE03c route registry, catalog and authority rows). */
const READ: ExpectedOperation = {
  id: 'cmsRelatedContentRead',
  marker: 'P2-S12-AC-062',
  method: 'GET',
  path: '/api/v1/cms/entries/{entryId}/related-content',
  authClass: 'editorial_author',
  capabilities: ['cms.author', 'cms.editor'],
  capabilityMode: 'any_of',
  stepUp: 'none',
  owner: 'Editorial',
  csrf: 'none',
  idempotency: 'none',
  ifMatch: 'none',
  rateClass: 'cms-related-content-read',
  limit: 300,
  partyLimit: 600,
  timeoutMs: 8_000,
  sloTier: 'tier_1',
  request: 'RelatedContentReadApiRequestSchema',
  success: 'RelatedContentRuleReadSchema',
  params: ['path:entryId*'],
  statuses: withErrors(
    ['200'],
    ['400', '401', '403', '404', '415', '429', '500', '502', '503', '504'],
  ),
  successStatuses: ['200'],
  hasBody: false,
};

describe('Slice 12 cmsRelatedContentRead canonical API authority (DEC-195)', () => {
  registerAgreementTests([READ]);

  it('[P2-S12-AC-062] shares the CMS-03C-05 path and keeps the write as the only mutation', () => {
    const paths = platformRegistrySet.routes.filter(
      ({ path }) => path === '/api/v1/cms/entries/{entryId}/related-content',
    );
    expect(paths.map(({ method }) => method).sort()).toEqual(['GET', 'POST']);
    expect(
      openApiOperation('cmsRelatedContentRead').requestBody,
    ).toBeUndefined();
  });

  it('[P2-S12-AC-062] answers 200 with the nullable-rule read, not the bare resource', () => {
    const operation = openApiOperation('cmsRelatedContentRead');
    expect(
      operation.responses['200']?.content?.['application/json']?.schema,
    ).toEqual({
      $ref: '#/components/schemas/RelatedContentRuleRead',
    });
    expect(operation.responses['409']).toBeUndefined();
    expect(operation.responses['422']).toBeUndefined();
  });
});
