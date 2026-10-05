import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../../../infra/openapi-document.mjs';
import {
  CmsStepUpRequiredErrorSchema,
  CmsUnauthenticatedErrorSchema,
  buildContentSchemaRegistryOpenApiDocument,
  contentSchemaRegistryRoutePolicies,
  routeCapabilitiesSatisfied,
} from './index';
import { apiErrorResponses, schemaContracts } from './openapi-support';

type RouteLike = Readonly<{
  operationId: string;
  audience: string;
  stepUp: string;
  capability?: string;
  capabilities?: readonly string[];
  capabilityMode?: 'any_of' | 'all_of';
}>;

const routes = contentSchemaRegistryRoutePolicies as readonly RouteLike[];

const requestId = '123e4567-e89b-42d3-a456-426614174000';
const stepUpOperations = [
  'CMS-03A-04',
  'CMS-03A-12',
  'CMS-03A-14',
  'CMS-03A-15',
  'CMS-03A-16',
  'CMS-03A-17',
] as const;
const unionRefs = [
  { $ref: '#/components/schemas/CmsUnauthenticatedError' },
  { $ref: '#/components/schemas/CmsStepUpRequiredError' },
];

type Operation = Record<string, unknown> & {
  responses: Record<
    string,
    {
      description: string;
      content: { 'application/json': { schema: unknown } };
    }
  >;
};
type Document = {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, Record<string, unknown>> };
};

const operationFor = (document: Document, operationId: string): Operation => {
  for (const methods of Object.values(document.paths))
    for (const candidate of Object.values(methods))
      if (candidate.operationId === operationId) return candidate;
  throw new Error(`missing ${operationId}`);
};

const unauthorizedSchema = (operation: Operation): unknown =>
  operation.responses['401']?.content['application/json'].schema;

describe('401 error schemas', () => {
  it('accepts the exact step-up body and the exact reauthenticate body', () => {
    expect(
      CmsStepUpRequiredErrorSchema.safeParse({
        code: 'STEP_UP_REQUIRED',
        details: { recoveryAction: 'step_up', allowedMethods: ['totp'] },
        message: 'Recent verification is required.',
        requestId,
      }).success,
    ).toBe(true);
    expect(
      CmsUnauthenticatedErrorSchema.safeParse({
        code: 'UNAUTHENTICATED',
        details: { recoveryAction: 'reauthenticate' },
        message: 'Sign in again.',
        requestId,
      }).success,
    ).toBe(true);
  });

  it('never lets one 401 body stand in for the other', () => {
    expect(
      CmsUnauthenticatedErrorSchema.safeParse({
        code: 'UNAUTHENTICATED',
        details: { recoveryAction: 'step_up' },
        message: 'Sign in again.',
        requestId,
      }).success,
    ).toBe(false);
    expect(
      CmsUnauthenticatedErrorSchema.safeParse({
        code: 'STEP_UP_REQUIRED',
        details: { recoveryAction: 'reauthenticate' },
        message: 'Sign in again.',
        requestId,
      }).success,
    ).toBe(false);
    expect(
      CmsUnauthenticatedErrorSchema.safeParse({
        code: 'UNAUTHENTICATED',
        details: { recoveryAction: 'reauthenticate', allowedMethods: [] },
        message: 'Sign in again.',
        requestId,
      }).success,
    ).toBe(false);
    expect(
      CmsStepUpRequiredErrorSchema.safeParse({
        code: 'STEP_UP_REQUIRED',
        details: { recoveryAction: 'reauthenticate', allowedMethods: ['totp'] },
        message: 'Recent verification is required.',
        requestId,
      }).success,
    ).toBe(false);
  });
});

describe('package OpenAPI step-up contract', () => {
  const internal =
    buildContentSchemaRegistryOpenApiDocument() as unknown as Document;

  it('publishes the unauthenticated/step-up union and x-step-up for step-up routes', () => {
    for (const operationId of stepUpOperations) {
      const operation = operationFor(internal, operationId);
      expect(operation['x-step-up'], operationId).toBe('required');
      expect(unauthorizedSchema(operation), operationId).toEqual({
        oneOf: unionRefs,
      });
      expect(operation.responses['401']?.description).toBe(
        'STEP_UP_REQUIRED, UNAUTHENTICATED',
      );
    }
  });

  it('keeps the generic envelope for routes without step-up', () => {
    for (const route of routes) {
      if (route.stepUp === 'required' || route.audience !== 'browser') continue;
      const operation = operationFor(internal, route.operationId);
      expect(operation['x-step-up']).toBe('none');
      expect(
        (unauthorizedSchema(operation) as { $ref?: string } | undefined)?.$ref,
      ).toBe('#/components/schemas/ApiError');
    }
  });

  it('describes the exact step-up and reauthenticate details', () => {
    const stepUp = internal.components.schemas.CmsStepUpRequiredError;
    expect(stepUp?.required).toEqual([
      'code',
      'details',
      'message',
      'requestId',
    ]);
    expect((stepUp?.properties as Record<string, unknown>).code).toEqual({
      type: 'string',
      const: 'STEP_UP_REQUIRED',
    });
    const details = internal.components.schemas.CmsStepUpRequiredDetails;
    expect(details?.required).toEqual(['recoveryAction', 'allowedMethods']);
    expect(details?.additionalProperties).toBe(false);
    const unauthenticated = internal.components.schemas.CmsUnauthenticatedError;
    expect(
      (unauthenticated?.properties as Record<string, unknown>).details,
    ).toMatchObject({
      required: ['recoveryAction'],
      properties: { recoveryAction: { const: 'reauthenticate' } },
    });
  });

  it('emits only the step-up body when a route has no unauthenticated code', () => {
    const responses = apiErrorResponses(
      { errors: { STEP_UP_REQUIRED: 401, FORBIDDEN: 403 } } as never,
      schemaContracts,
    ) as Record<
      string,
      { content: { 'application/json': { schema: unknown } } }
    >;
    expect(responses['401']?.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/CmsStepUpRequiredError',
    });
    expect(responses['403']?.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/ApiError',
    });
  });
});

describe('final OpenAPI document step-up contract', () => {
  const document = buildOpenApiDocument() as unknown as Document;

  it('declares x-step-up required and the 401 union on every step-up operation', () => {
    for (const operationId of stepUpOperations) {
      const operation = operationFor(document, operationId);
      expect(operation['x-step-up'], operationId).toBe('required');
      expect(unauthorizedSchema(operation), operationId).toEqual({
        oneOf: unionRefs,
      });
      expect(operation.responses['401']?.description).toBe(
        'Authentication or recent step-up verification is required',
      );
    }
  });

  it('declares x-step-up none, with the generic 401, elsewhere in CMS-03A', () => {
    for (const route of routes) {
      if (route.stepUp === 'required') continue;
      const operation = operationFor(document, route.operationId);
      expect(operation['x-step-up'], route.operationId).toBe('none');
      expect(JSON.stringify(unauthorizedSchema(operation))).not.toContain(
        'CmsStepUpRequiredError',
      );
    }
  });

  it('contains the 401 body components with their exact literals', () => {
    const schemas = document.components.schemas;
    expect(JSON.stringify(schemas.CmsStepUpRequiredError)).toContain(
      '"const":"STEP_UP_REQUIRED"',
    );
    expect(JSON.stringify(schemas.CmsStepUpRequiredDetails)).toContain(
      '"const":"step_up"',
    );
    expect(JSON.stringify(schemas.CmsUnauthenticatedError)).toContain(
      '"const":"UNAUTHENTICATED"',
    );
    expect(JSON.stringify(schemas.CmsUnauthenticatedError)).toContain(
      '"const":"reauthenticate"',
    );
  });

  it('generates a nullable, optional templateCompatibility projection', () => {
    const preparation = document.components.schemas
      .SchemaActivationPreparation as {
      required: string[];
      properties: { templateCompatibility: { anyOf: { type?: string }[] } };
    };
    expect(preparation.required).not.toContain('templateCompatibility');
    expect(
      preparation.properties.templateCompatibility.anyOf.some(
        ({ type }) => type === 'null',
      ),
    ).toBe(true);
  });
});

describe('CMS-03A-13 alternative-capability semantics', () => {
  const route = routes.find(({ operationId }) => operationId === 'CMS-03A-13');

  it('declares any_of in the route policy, the registry row, and both documents', () => {
    expect(route?.capabilityMode).toBe('any_of');
    expect(route?.capabilities).toEqual([
      'cms.schema_designer',
      'cms.schema_review',
    ]);
    const internal =
      buildContentSchemaRegistryOpenApiDocument() as unknown as Document;
    expect(operationFor(internal, 'CMS-03A-13')['x-capability-mode']).toBe(
      'any_of',
    );
    const canonical = buildOpenApiDocument() as unknown as Document;
    const operation = operationFor(canonical, 'CMS-03A-13');
    expect(operation['x-capability-mode']).toBe('any_of');
    expect(operation['x-capabilities']).toEqual([
      'cms.schema_designer',
      'cms.schema_review',
    ]);
  });

  it('keeps review-only and designer-only callers authorized', () => {
    expect(route).toBeDefined();
    if (route === undefined) return;
    expect(routeCapabilitiesSatisfied(route, ['cms.schema_review'])).toBe(true);
    expect(routeCapabilitiesSatisfied(route, ['cms.schema_designer'])).toBe(
      true,
    );
    expect(
      routeCapabilitiesSatisfied(route, [
        'cms.schema_review',
        'cms.schema_designer',
      ]),
    ).toBe(true);
    expect(
      routeCapabilitiesSatisfied(route, ['cms.schema_registry.read']),
    ).toBe(false);
    expect(routeCapabilitiesSatisfied(route, [])).toBe(false);
  });

  it('requires every listed capability when the mode is all_of or absent', () => {
    const capabilities = ['cms.author', 'cms.editor'];
    expect(routeCapabilitiesSatisfied({ capabilities }, ['cms.author'])).toBe(
      false,
    );
    expect(
      routeCapabilitiesSatisfied({ capabilities }, [
        'cms.author',
        'cms.editor',
      ]),
    ).toBe(true);
    expect(
      routeCapabilitiesSatisfied(
        { capabilities, capabilityMode: 'all_of' },
        new Set(['cms.editor']),
      ),
    ).toBe(false);
    expect(
      routeCapabilitiesSatisfied({ capability: 'cms.author' }, ['cms.author']),
    ).toBe(true);
  });

  it('never opens an owner-only route by capability', () => {
    const owner = routes.find(
      ({ operationId }) => operationId === 'CMS-03A-15',
    );
    expect(owner).toBeDefined();
    if (owner === undefined) return;
    expect(routeCapabilitiesSatisfied(owner, ['cms.schema_designer'])).toBe(
      false,
    );
    expect(routeCapabilitiesSatisfied({}, ['cms.author'])).toBe(false);
  });
});
