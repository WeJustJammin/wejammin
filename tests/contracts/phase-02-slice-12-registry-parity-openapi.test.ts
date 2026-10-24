import { getOpenApiSchemaJson } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  BROWSER_OPERATIONS,
  INTERNAL_OPERATIONS,
  NUMBERED_IDS,
  SUPPORTING_READ_IDS,
  type SpecOperation,
} from './phase-02-slice-12-registry-parity-fixture';
import {
  openApiDocument,
  type OpenApiOperation,
} from './phase-02-slice-12-openapi.test-support';

/*
 * P2-S12-AC-275, part 2: the generated OpenAPI documents every Slice 12 browser operation on
 * method and path, request, success and error schemas, auth, CORS, rate, timeout, cache,
 * idempotency, ETag and SLO, and documents none of CMS-03C-18 to CMS-03C-21.
 */

const API_ERROR = { $ref: '#/components/schemas/ApiError' };
const STEP_UP_UNION = {
  oneOf: [
    { $ref: '#/components/schemas/CmsUnauthenticatedError' },
    { $ref: '#/components/schemas/CmsStepUpRequiredError' },
  ],
};

const operationOf = (expected: SpecOperation): OpenApiOperation | undefined =>
  openApiDocument().paths[expected.path]?.[expected.method.toLowerCase()];

const jsonSchema = (operation: OpenApiOperation, status: string): unknown =>
  operation.responses[status]?.content?.['application/json']?.schema;

const parameterSummary = (operation: OpenApiOperation): string[] =>
  (operation.parameters ?? [])
    .map(
      (parameter) =>
        `${parameter.in}:${parameter.name}${parameter.required ? '*' : ''}`,
    )
    .sort();

describe.each(
  BROWSER_OPERATIONS.map((operation) => [operation.id, operation] as const),
)('[P2-S12-AC-275] OpenAPI %s', (id, expected) => {
  it('[P2-S12-AC-275] is generated at its BE03c method and path with its operation id', () => {
    const operation = operationOf(expected);
    expect(operation, `${expected.method} ${expected.path}`).toBeDefined();
    expect(operation?.operationId).toBe(id);
  });

  it('[P2-S12-AC-275] publishes auth, CORS, CSRF, idempotency, If-Match, rate, timeout, cache and SLO extensions equal to the fixture', () => {
    const operation = operationOf(expected) as Record<string, unknown>;
    expect(operation).toEqual(
      expect.objectContaining({
        'x-auth-class': expected.authClass,
        'x-cors': 'cms-console',
        'x-audience': 'browser',
        'x-csrf': expected.csrf,
        'x-idempotency': expected.idempotency,
        'x-if-match': expected.ifMatch,
        'x-timeout-ms': expected.timeoutMs,
        'x-rate-class': expected.rateClass,
        'x-rate-limit': {
          class: expected.rateClass,
          limit: expected.user,
          partyLimit: expected.party,
          windowSeconds: 60,
          scope: 'user',
        },
        'x-slo-tier': `tier_${expected.tier}`,
        'x-cache-class': 'no_store',
        'x-cache-control': 'no-store',
        'x-request-schema': expected.apiRequest,
        'x-success-schema': expected.success,
        'x-error-schemas': ['ApiErrorSchema'],
      }),
    );
    expect(operation['x-step-up'] ?? 'none').toBe(expected.stepUp);
    expect(operation['x-capabilities']).toEqual(expected.capabilities);
    if (expected.capabilityMode !== undefined)
      expect(operation['x-capability-mode']).toBe(expected.capabilityMode);
  });

  it('[P2-S12-AC-275] documents the BE03c parameters, and a JSON body exactly for a write', () => {
    const operation = operationOf(expected);
    expect(parameterSummary(operation as OpenApiOperation)).toEqual(
      [...expected.params].sort(),
    );
    if (expected.method === 'GET') {
      expect(operation?.requestBody).toBeUndefined();
      return;
    }
    const wrapper = getOpenApiSchemaJson(expected.apiRequest) as {
      properties: { body: unknown };
    };
    expect(operation?.requestBody?.content['application/json'].schema).toEqual(
      wrapper.properties.body,
    );
  });

  it('[P2-S12-AC-275] answers exactly its success statuses and its BE03c error matrix statuses', () => {
    const operation = operationOf(expected) as OpenApiOperation;
    expect(Object.keys(operation.responses).sort()).toEqual(
      [...expected.successStatuses, ...expected.errors.map(String)].sort(),
    );
  });

  it('[P2-S12-AC-275] references the success resource component and the BE00 ApiError for every error', () => {
    const operation = operationOf(expected) as OpenApiOperation;
    const component = expected.success.slice(0, -'Schema'.length);
    for (const status of expected.successStatuses)
      expect(jsonSchema(operation, status)).toEqual({
        $ref: `#/components/schemas/${component}`,
      });
    expect(openApiDocument().components.schemas).toHaveProperty(component);
    expect(openApiDocument().components.schemas).toHaveProperty('ApiError');
    for (const status of expected.errors) {
      const expectedSchema =
        status === 401 && expected.stepUp === 'required'
          ? STEP_UP_UNION
          : API_ERROR;
      expect(jsonSchema(operation, String(status)), `${id} ${status}`).toEqual(
        expectedSchema,
      );
    }
  });

  it('[P2-S12-AC-275] declares the ETag exactly as BE03c states it, and the rate-limit headers on 429', () => {
    const operation = operationOf(expected) as OpenApiOperation;
    const success = operation.responses[expected.successStatuses[0] ?? ''];
    const hasEtag = success?.headers !== undefined && 'ETag' in success.headers;
    if (expected.etag === 'strong' || expected.etag === 'page')
      expect(hasEtag, `${id} ETag`).toBe(true);
    if (expected.etag === 'none') expect(hasEtag, `${id} ETag`).toBe(false);
    expect(Object.keys(operation.responses['429']?.headers ?? {})).toEqual(
      expect.arrayContaining(['Retry-After', 'RateLimit-Limit']),
    );
  });
});

describe('[P2-S12-AC-275] OpenAPI inventory', () => {
  const documented = Object.entries(openApiDocument().paths).flatMap(
    ([path, item]) =>
      Object.entries(item).map(([method, operation]) => ({
        path,
        method: method.toUpperCase(),
        id: operation.operationId,
      })),
  );

  it('[P2-S12-AC-275] documents exactly the 25 browser operations, CMS-03C-01 to CMS-03C-17 and the eight supporting reads', () => {
    const s12 = documented
      .filter(
        ({ id }) => /^CMS-03C-/u.test(id) || SUPPORTING_READ_IDS.includes(id),
      )
      .map(({ id }) => id)
      .sort();
    expect(s12).toEqual([...NUMBERED_IDS, ...SUPPORTING_READ_IDS].sort());
  });

  it('[P2-S12-AC-275] documents none of CMS-03C-18 to CMS-03C-21, their RPCs, providers or contracts', () => {
    const ids = documented.map(({ id }) => id);
    const paths = documented.map(({ path }) => path).join('\n');
    for (const [id, names] of Object.entries(INTERNAL_OPERATIONS)) {
      expect(ids, id).not.toContain(id);
      for (const name of names) expect(paths, name).not.toContain(name);
    }
    for (const internal of [
      'CanonicalTaxonomyMatchRequest',
      'CanonicalTaxonomyMatchResult',
      'ClaimedGovernedActivation',
      'GovernedActivationExecutionResult',
    ])
      expect(openApiDocument().components.schemas, internal).not.toHaveProperty(
        internal,
      );
  });
});
