import { describe, expect, it } from 'vitest';

import {
  STANDARD_ERROR_STATUSES,
  openApiDocument,
  openApiOperation,
  registerAgreementTests,
  registryRow,
  successRef,
  withErrors,
  type ExpectedOperation,
} from './phase-02-slice-12-openapi.test-support';

const ALL = [...STANDARD_ERROR_STATUSES];
const BOUNDED = [
  '400',
  '401',
  '403',
  '404',
  '415',
  '429',
  '500',
  '502',
  '503',
  '504',
];

const EXPECTED: readonly ExpectedOperation[] = [
  {
    id: 'CMS-03C-12',
    marker: 'P2-S12-AC-100',
    method: 'POST',
    path: '/api/v1/cms/patterns/versions',
    authClass: 'template_designer',
    capabilities: ['cms.template_designer'],
    stepUp: 'none',
    owner: 'ContentSchema',
    csrf: 'required',
    idempotency: 'required',
    ifMatch: 'conditional',
    rateClass: 'cms-pattern-write',
    limit: 30,
    partyLimit: 60,
    timeoutMs: 15_000,
    sloTier: 'tier_2',
    request: 'PatternVersionApiRequestSchema',
    success: 'PatternVersionResourceSchema',
    params: ['header:Idempotency-Key*', 'header:If-Match'],
    statuses: withErrors(['201'], ALL),
    successStatuses: ['201'],
    hasBody: true,
  },
  {
    id: 'cmsPatternLatestRead',
    marker: 'P2-S12-AC-171',
    method: 'GET',
    path: '/api/v1/cms/patterns/{patternKey}',
    authClass: 'template_designer',
    capabilities: ['cms.template_designer'],
    stepUp: 'none',
    owner: 'ContentSchema',
    csrf: 'none',
    idempotency: 'none',
    ifMatch: 'none',
    rateClass: 'cms-pattern-read',
    limit: 60,
    partyLimit: 60,
    timeoutMs: 15_000,
    sloTier: 'tier_2',
    request: 'PatternLatestApiRequestSchema',
    success: 'PatternVersionDetailSchema',
    params: ['path:patternKey*'],
    statuses: withErrors(['200'], BOUNDED),
    successStatuses: ['200'],
    hasBody: false,
  },
  {
    id: 'CMS-03C-13',
    marker: 'P2-S12-AC-106',
    method: 'GET',
    path: '/api/v1/cms/patterns/selector',
    authClass: 'editorial_author',
    capabilities: ['cms.author', 'cms.editor'],
    capabilityMode: 'any_of',
    stepUp: 'none',
    owner: 'Editorial',
    csrf: 'none',
    idempotency: 'none',
    ifMatch: 'none',
    rateClass: 'cms-pattern-selector-read',
    limit: 300,
    partyLimit: 600,
    timeoutMs: 8_000,
    sloTier: 'tier_1',
    request: 'PatternSelectorApiRequestSchema',
    success: 'PatternSelectorPageSchema',
    params: ['query:contentTypeId*', 'query:cursor', 'query:limit'],
    statuses: withErrors(['200'], ALL),
    successStatuses: ['200'],
    hasBody: false,
  },
  {
    id: 'CMS-03C-14',
    marker: 'P2-S12-AC-112',
    method: 'GET',
    path: '/api/v1/cms/compositions/instances/{instanceId}/update-diff',
    authClass: 'editorial_author',
    capabilities: ['cms.author', 'cms.editor'],
    capabilityMode: 'any_of',
    stepUp: 'none',
    owner: 'Editorial',
    csrf: 'none',
    idempotency: 'none',
    ifMatch: 'none',
    rateClass: 'cms-composition-read',
    limit: 300,
    partyLimit: 600,
    timeoutMs: 8_000,
    sloTier: 'tier_1',
    request: 'CompositionUpdateDiffApiRequestSchema',
    success: 'CompositionUpdateDiffResourceSchema',
    params: ['path:instanceId*'],
    statuses: withErrors(
      ['200'],
      [
        '400',
        '401',
        '403',
        '404',
        '415',
        '422',
        '429',
        '500',
        '502',
        '503',
        '504',
      ],
    ),
    successStatuses: ['200'],
    hasBody: false,
  },
  {
    id: 'CMS-03C-15',
    marker: 'P2-S12-AC-118',
    method: 'POST',
    path: '/api/v1/cms/compositions/pattern-updates',
    authClass: 'editorial_author',
    capabilities: ['cms.author', 'cms.editor'],
    capabilityMode: 'any_of',
    stepUp: 'none',
    owner: 'Editorial',
    csrf: 'required',
    idempotency: 'required',
    ifMatch: 'required',
    rateClass: 'cms-composition-update',
    limit: 60,
    partyLimit: 120,
    timeoutMs: 15_000,
    sloTier: 'tier_2',
    request: 'CompositionUpdateApiRequestSchema',
    success: 'CompositionUpdateResourceSchema',
    params: ['header:Idempotency-Key*', 'header:If-Match*'],
    statuses: withErrors(['200'], ALL),
    successStatuses: ['200'],
    hasBody: true,
  },
];

describe('Slice 12 pattern registry rows and generated OpenAPI (CMS-03C-12 to CMS-03C-15)', () => {
  registerAgreementTests(EXPECTED);

  it('[P2-S12-AC-010] answers CMS-03C-02 with the PatternPlacementResource items list, not a single row', () => {
    const row = registryRow('CMS-03C-02');
    expect(row?.successSchema).toBe('PatternPlacementResourceSchema');
    const operation = openApiOperation('CMS-03C-02');
    expect(operation['x-success-schema']).toBe(
      'PatternPlacementResourceSchema',
    );
    expect(successRef(operation, '201')).toEqual({
      $ref: '#/components/schemas/PatternPlacementResource',
    });
    const placement = openApiDocument().components.schemas[
      'PatternPlacementResource'
    ] as {
      additionalProperties: boolean;
      required: string[];
      properties: { items: { minItems: number; maxItems: number } };
    };
    expect(placement.additionalProperties).toBe(false);
    expect(placement.required).toEqual(['items']);
    expect(placement.properties.items.minItems).toBe(1);
    expect(placement.properties.items.maxItems).toBe(512);
  });

  it('[P2-S12-AC-218] documents the placement row with its authored position and the node-path override keys', () => {
    const rows = (
      openApiDocument().components.schemas['PatternPlacementResource'] as {
        properties: {
          items: {
            items: {
              required: string[];
              properties: { position: { type: string; minimum: number } };
            };
          };
        };
      }
    ).properties.items.items;
    expect(rows.required).toContain('position');
    expect(rows.properties.position).toEqual(
      expect.objectContaining({ type: 'integer', minimum: 0 }),
    );
    const request = openApiDocument().components.schemas[
      'PatternInstanceApiRequest'
    ] as {
      properties: {
        body: {
          properties: {
            overrides: {
              propertyNames: { pattern: string; maxLength: number };
            };
          };
        };
      };
    };
    expect(request.properties.body.properties.overrides.propertyNames).toEqual({
      pattern: '^/[a-z][a-z0-9_-]{0,63}(/[a-z][a-z0-9_-]{0,63})*$',
      maxLength: 512,
    });
  });

  it('[P2-S12-AC-101] documents the pattern block tree as a recursive node definition of blocks and nested pattern references', () => {
    const body = openApiOperation('CMS-03C-12').requestBody?.content[
      'application/json'
    ].schema as {
      properties: {
        blockTree: { minItems: number; maxItems: number };
        expectedVersion: unknown;
      };
      required: string[];
      additionalProperties: boolean;
    };
    expect(body.additionalProperties).toBe(false);
    expect(body.properties.blockTree.minItems).toBe(1);
    expect(body.properties.blockTree.maxItems).toBe(32);
    expect(body.required).toEqual(
      expect.arrayContaining([
        'patternKey',
        'compatibleTypeIds',
        'blockTree',
        'expectedVersion',
      ]),
    );
    expect(body.required).not.toContain('blockRegistryDigest');
    const serialized = JSON.stringify(
      openApiDocument().components.schemas['PatternVersionDetail'],
    );
    expect(serialized).toContain('"const":"block"');
    expect(serialized).toContain('"const":"pattern"');
    expect(serialized).toContain('"$ref"');
  });

  it('[P2-S12-AC-112] documents the diff paths as bounded to 128 with null-able three-way values', () => {
    const diff = openApiDocument().components.schemas[
      'CompositionUpdateDiffResource'
    ] as {
      required: string[];
      properties: {
        paths: { maxItems: number };
        collisionCount: { maximum: number };
      };
    };
    expect(diff.required).toEqual(
      expect.arrayContaining([
        'instance',
        'targetPatternVersion',
        'paths',
        'collisionCount',
        'bulkEligible',
      ]),
    );
    expect(diff.properties.paths.maxItems).toBe(128);
    expect(diff.properties.collisionCount.maximum).toBe(128);
  });

  it('[P2-S12-AC-118] documents the update body as a closed accept or detach choice of 1 to 32 instances', () => {
    const body = openApiOperation('CMS-03C-15').requestBody?.content[
      'application/json'
    ].schema as {
      oneOf: {
        properties: {
          action: { const: string };
          instances: { minItems: number; maxItems: number };
        };
        additionalProperties: boolean;
      }[];
    };
    expect(
      body.oneOf.map((variant) => variant.properties.action.const),
    ).toEqual(['accept', 'detach']);
    for (const variant of body.oneOf) {
      expect(variant.additionalProperties).toBe(false);
      expect(variant.properties.instances.minItems).toBe(1);
      expect(variant.properties.instances.maxItems).toBe(32);
    }
  });

  it('[P2-S12-AC-106] keeps the fixed pattern routes distinct from the latest-read path', () => {
    const paths = Object.keys(openApiDocument().paths).filter((path) =>
      path.startsWith('/api/v1/cms/patterns/'),
    );
    expect(paths.sort()).toEqual([
      '/api/v1/cms/patterns/nestable',
      '/api/v1/cms/patterns/selector',
      '/api/v1/cms/patterns/versions',
      '/api/v1/cms/patterns/{patternKey}',
    ]);
  });
});
