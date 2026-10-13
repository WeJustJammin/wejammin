import { describe, expect, it } from 'vitest';

import {
  STANDARD_ERROR_STATUSES,
  openApiDocument,
  openApiOperation,
  registerAgreementTests,
  successRef,
  withErrors,
  type ExpectedOperation,
} from './phase-02-slice-12-openapi.test-support';

const ALL = [...STANDARD_ERROR_STATUSES];

const EXPECTED: readonly ExpectedOperation[] = [
  {
    id: 'CMS-03C-16',
    marker: 'P2-S12-AC-124',
    method: 'POST',
    path: '/api/v1/cms/taxonomies/versions',
    authClass: 'taxonomy_curator',
    capabilities: ['cms.taxonomy_curator'],
    stepUp: 'none',
    owner: 'ContentSchema',
    csrf: 'required',
    idempotency: 'required',
    ifMatch: 'conditional',
    rateClass: 'cms-taxonomy-version-write',
    limit: 30,
    partyLimit: 60,
    timeoutMs: 15_000,
    sloTier: 'tier_2',
    request: 'TaxonomyVersionApiRequestSchema',
    success: 'TaxonomyVersionResourceSchema',
    params: ['header:Idempotency-Key*', 'header:If-Match'],
    statuses: withErrors(['201'], ALL),
    successStatuses: ['201'],
    hasBody: true,
  },
  {
    id: 'CMS-03C-17',
    marker: 'P2-S12-AC-130',
    method: 'GET',
    path: '/api/v1/cms/taxonomies/selector',
    authClass: 'editorial_author',
    capabilities: ['cms.author', 'cms.editor'],
    capabilityMode: 'any_of',
    stepUp: 'none',
    owner: 'Editorial',
    csrf: 'none',
    idempotency: 'none',
    ifMatch: 'none',
    rateClass: 'cms-taxonomy-selector-read',
    limit: 300,
    partyLimit: 600,
    timeoutMs: 8_000,
    sloTier: 'tier_1',
    request: 'TaxonomySelectorApiRequestSchema',
    success: 'TaxonomySelectorPageSchema',
    params: [
      'query:typeKey*',
      'query:fieldKey*',
      'query:locale*',
      'query:cursor',
      'query:limit',
    ],
    statuses: withErrors(['200'], ALL),
    successStatuses: ['200'],
    hasBody: false,
  },
  {
    id: 'cmsTaxonomyVersionsRead',
    marker: 'P2-S12-AC-177',
    method: 'GET',
    path: '/api/v1/cms/taxonomies/{taxonomyId}/versions',
    authClass: 'taxonomy_curator',
    capabilities: ['cms.taxonomy_curator'],
    stepUp: 'none',
    owner: 'ContentSchema',
    csrf: 'none',
    idempotency: 'none',
    ifMatch: 'none',
    rateClass: 'cms-taxonomy-read',
    limit: 60,
    partyLimit: 60,
    timeoutMs: 8_000,
    sloTier: 'tier_1',
    request: 'TaxonomyVersionsApiRequestSchema',
    success: 'TaxonomyVersionsPageSchema',
    params: ['path:taxonomyId*'],
    statuses: withErrors(['200'], ALL),
    successStatuses: ['200'],
    hasBody: false,
  },
  {
    id: 'cmsTaxonomyTermsRead',
    marker: 'P2-S12-AC-183',
    method: 'GET',
    path: '/api/v1/cms/taxonomies/{taxonomyId}/terms',
    authClass: 'taxonomy_curator',
    capabilities: ['cms.taxonomy_curator'],
    stepUp: 'none',
    owner: 'ContentSchema',
    csrf: 'none',
    idempotency: 'none',
    ifMatch: 'none',
    rateClass: 'cms-taxonomy-terms-read',
    limit: 120,
    partyLimit: 240,
    timeoutMs: 8_000,
    sloTier: 'tier_1',
    request: 'TaxonomyTermListApiRequestSchema',
    success: 'TaxonomyTermListPageSchema',
    params: [
      'path:taxonomyId*',
      'query:lifecycle',
      'query:cursor',
      'query:limit',
    ],
    statuses: withErrors(['200'], ALL),
    successStatuses: ['200'],
    hasBody: false,
  },
];

describe('Slice 12 taxonomy registry rows and generated OpenAPI (CMS-03C-16, CMS-03C-17 and the vocabulary reads)', () => {
  registerAgreementTests(EXPECTED);

  it('[P2-S12-AC-124] documents the taxonomy version body with bounded allowlists and the six canonical domains', () => {
    const body = openApiOperation('CMS-03C-16').requestBody?.content[
      'application/json'
    ].schema as {
      additionalProperties: boolean;
      required: string[];
      properties: {
        allowedTypeKeys: { minItems: number; maxItems: number };
        allowedFieldKeys: { minItems: number; maxItems: number };
        canonicalOverlapDomains: {
          maxItems: number;
          items: { enum: string[] };
        };
        shape: { enum: string[] };
      };
    };
    expect(body.additionalProperties).toBe(false);
    expect(body.properties.allowedTypeKeys).toEqual(
      expect.objectContaining({ minItems: 1, maxItems: 64 }),
    );
    expect(body.properties.allowedFieldKeys).toEqual(
      expect.objectContaining({ minItems: 1, maxItems: 64 }),
    );
    expect(body.properties.canonicalOverlapDomains.maxItems).toBe(6);
    expect(body.properties.canonicalOverlapDomains.items.enum).toEqual([
      'role',
      'instrument',
      'gear',
      'place',
      'rights',
      'jurisdiction',
    ]);
    expect(body.properties.shape.enum).toEqual(['flat', 'hierarchical']);
    expect(body.required).toContain('expectedVersion');
  });

  it('[P2-S12-AC-185] answers the term list and the version list with an ETag and the rate headers', () => {
    for (const id of ['cmsTaxonomyVersionsRead', 'cmsTaxonomyTermsRead']) {
      const operation = openApiOperation(id);
      expect(Object.keys(operation.responses['200']?.headers ?? {})).toEqual(
        expect.arrayContaining(['ETag', 'RateLimit-Limit']),
      );
      expect(successRef(operation, '502')).toEqual({
        $ref: '#/components/schemas/ApiError',
      });
    }
  });

  it('[P2-S12-AC-184] bounds the term page at 50 items and the selector page at 100', () => {
    const schemas = openApiDocument().components.schemas as Record<
      string,
      { properties: { items: { maxItems: number } } }
    >;
    expect(schemas['TaxonomyTermListPage']?.properties.items.maxItems).toBe(50);
    expect(schemas['TaxonomySelectorPage']?.properties.items.maxItems).toBe(
      100,
    );
    expect(schemas['TaxonomyVersionsPage']?.properties.items.maxItems).toBe(50);
  });

  it('[P2-S12-AC-130] keeps the vocabulary routes distinct from the selector path', () => {
    const paths = Object.keys(openApiDocument().paths).filter((path) =>
      path.startsWith('/api/v1/cms/taxonomies/'),
    );
    expect(paths.sort()).toEqual([
      '/api/v1/cms/taxonomies/selector',
      '/api/v1/cms/taxonomies/versions',
      '/api/v1/cms/taxonomies/{taxonomyId}/terms',
      '/api/v1/cms/taxonomies/{taxonomyId}/terms/actions',
      '/api/v1/cms/taxonomies/{taxonomyId}/versions',
    ]);
  });
});
