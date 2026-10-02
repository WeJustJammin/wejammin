import { describe, expect, it } from 'vitest';

import {
  buildContentSchemaRegistryBrowserOpenApiDocument,
  buildContentSchemaRegistryOpenApiDocument,
  contentSchemaRegistryRoutePolicies,
  getContentSchemaRegistryBrowserOpenApiComponentSchemas,
  getContentSchemaRegistryOpenApiComponentSchemas,
} from './index';
import { platformRegistrySet } from '../platform-registries.ts';

type RouteLike = Readonly<{
  operationId: string;
  method: string;
  path: string;
  auth: string;
  capability: string;
  cors: string;
  audience: string;
  csrf: string;
  stepUp: string;
  rawBodySignature: string;
  idempotency: string;
  ifMatch: string;
  rateClass: string;
  rateLimit: number;
  rateWindowSeconds: number;
  rateScope: string;
  timeoutMs: number;
  requestSchema: string;
  successSchema: string;
  cacheControl: string;
  capabilities?: readonly string[];
  successStatus: number;
  successStatuses?: readonly number[];
  partyRateLimit?: number;
  errors: Readonly<Record<string, number>>;
}>;

const routes = contentSchemaRegistryRoutePolicies as readonly RouteLike[];

const policy = (operationId: string): RouteLike => {
  const route = routes.find(
    (candidate) => candidate.operationId === operationId,
  );
  if (!route) throw new Error(`missing ${operationId}`);
  return route;
};

const designerWrite = {
  method: 'POST',
  auth: 'schema_designer',
  capability: 'cms.schema_designer',
  csrf: 'required',
  stepUp: 'none',
  idempotency: 'required',
  ifMatch: 'required',
  rateClass: 'cms-definition-write',
  rateLimit: 30,
  partyRateLimit: 60,
  rateScope: 'user',
  rateWindowSeconds: 60,
  audience: 'browser',
  cors: 'cms-console',
  rawBodySignature: 'none',
  timeoutMs: 15_000,
  cacheControl: 'no-store',
} as const;

const successorBase =
  '/api/v1/cms/content-types/{contentTypeId}/versions/{versionId}';

describe('CMS-03A-09..14 route policies (BE03a Route Registry)', () => {
  it.each([
    [
      'CMS-03A-09',
      `${successorBase}/successors`,
      'SchemaSuccessorRequestSchema',
      'ContentTypeVersionResourceSchema',
      201,
    ],
    [
      'CMS-03A-10',
      `${successorBase}/dry-runs`,
      'SchemaDryRunRequestSchema',
      'SchemaDryRunResourceSchema',
      202,
    ],
    [
      'CMS-03A-11',
      `${successorBase}/reviews`,
      'SchemaReviewSubmissionRequestSchema',
      'SchemaReviewResourceSchema',
      201,
    ],
  ])(
    '%s is a schema-designer CAS mutation',
    (id, path, request, success, status) => {
      expect(policy(id)).toMatchObject({
        ...designerWrite,
        path,
        requestSchema: request,
        successSchema: success,
        successStatus: status,
      });
      expect(policy(id).capabilities).toBeUndefined();
    },
  );

  it('CMS-03A-12 is the step-up assigned-reviewer decision', () => {
    expect(policy('CMS-03A-12')).toMatchObject({
      method: 'POST',
      path: '/api/v1/cms/schema-reviews/{reviewId}/decisions',
      requestSchema: 'SchemaReviewDecisionRequestSchema',
      successSchema: 'SchemaReviewDecisionResourceSchema',
      successStatus: 201,
      auth: 'schema_reviewer',
      capability: 'cms.schema_review',
      csrf: 'required',
      stepUp: 'required',
      idempotency: 'required',
      ifMatch: 'required',
      rateClass: 'cms-activation',
      rateLimit: 30,
      partyRateLimit: 60,
    });
  });

  it('CMS-03A-13 is a no-store zero-header protected read', () => {
    expect(policy('CMS-03A-13')).toMatchObject({
      method: 'GET',
      path: '/api/v1/cms/schema-reviews/{reviewId}',
      requestSchema: 'SchemaReviewDetailParamsSchema',
      successSchema: 'SchemaReviewResourceSchema',
      successStatus: 200,
      auth: 'review_reader',
      capability: 'cms.schema_designer',
      capabilities: ['cms.schema_designer', 'cms.schema_review'],
      csrf: 'none',
      stepUp: 'none',
      idempotency: 'none',
      ifMatch: 'none',
      rateClass: 'cms-definition-read',
      rateLimit: 120,
      partyRateLimit: 240,
      cacheControl: 'no-store',
    });
    expect(policy('CMS-03A-13').capabilities).not.toContain(
      'cms.schema_registry.read',
    );
  });

  it('CMS-03A-14 is the owner-only step-up assignment with 200/201 outcomes', () => {
    expect(policy('CMS-03A-14')).toMatchObject({
      method: 'POST',
      path: '/api/v1/cms/schema-reviews/{reviewId}/assignments',
      requestSchema: 'SchemaReviewAssignmentRequestSchema',
      successSchema: 'SchemaReviewAssignmentResourceSchema',
      successStatus: 201,
      successStatuses: [200, 201],
      auth: 'review_assigner',
      capability: 'cms.schema_review.assign',
      csrf: 'required',
      stepUp: 'required',
      idempotency: 'required',
      ifMatch: 'required',
      rateClass: 'cms-activation',
      rateLimit: 10,
      partyRateLimit: 20,
    });
  });

  it('flags step-up on exactly activation, decision, and assignment', () => {
    expect(
      routes
        .filter(({ stepUp }) => stepUp === 'required')
        .map(({ operationId }) => operationId),
    ).toEqual(['CMS-03A-04', 'CMS-03A-12', 'CMS-03A-14']);
  });

  it('declares the matrix error statuses, with 401 STEP_UP_REQUIRED where required', () => {
    for (const id of ['CMS-03A-09', 'CMS-03A-10', 'CMS-03A-11'])
      expect(Object.values(policy(id).errors).sort()).toEqual(
        [400, 401, 403, 404, 409, 415, 422, 429, 500, 502, 503, 504].sort(),
      );
    for (const id of ['CMS-03A-04', 'CMS-03A-12', 'CMS-03A-14'])
      expect(policy(id).errors).toMatchObject({
        UNAUTHENTICATED: 401,
        STEP_UP_REQUIRED: 401,
        NOT_FOUND: 404,
        UNSUPPORTED_MEDIA_TYPE: 415,
      });
    for (const id of ['CMS-03A-09', 'CMS-03A-10', 'CMS-03A-11', 'CMS-03A-13'])
      expect(policy(id).errors).not.toHaveProperty('STEP_UP_REQUIRED');
    expect(policy('CMS-03A-13').errors).toEqual({
      INVALID_REQUEST: 400,
      UNAUTHENTICATED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      RATE_LIMITED: 429,
      BAD_GATEWAY: 502,
      DEPENDENCY_UNAVAILABLE: 503,
      GATEWAY_TIMEOUT: 504,
      INTERNAL_ERROR: 500,
    });
  });
});

describe('CMS-03A-09..14 OpenAPI parity', () => {
  const internal = buildContentSchemaRegistryOpenApiDocument();
  const browser = buildContentSchemaRegistryBrowserOpenApiDocument();

  it('documents every new operation with its success and error statuses', () => {
    for (const id of [
      'CMS-03A-09',
      'CMS-03A-10',
      'CMS-03A-11',
      'CMS-03A-12',
      'CMS-03A-13',
      'CMS-03A-14',
    ]) {
      const route = policy(id);
      const operation = (
        internal.paths[route.path] as Record<string, Record<string, unknown>>
      )[route.method.toLowerCase()] as Record<string, unknown>;
      expect(operation.operationId).toBe(id);
      expect(operation['x-auth']).toBe(route.auth);
      expect(operation['x-step-up']).toBe(route.stepUp);
      const statuses = Object.keys(operation.responses as object).sort();
      expect(statuses).toEqual(
        [
          ...new Set([
            ...(route.successStatuses ?? [route.successStatus]),
            ...Object.values(route.errors),
          ]),
        ]
          .map(String)
          .sort(),
      );
      const browserPath = browser.paths[route.path] as
        Record<string, unknown> | undefined;
      expect(browserPath?.[route.method.toLowerCase()]).toBeDefined();
    }
  });

  it('describes a step-up 401 and path parameters for review routes', () => {
    const decision = (
      internal.paths['/api/v1/cms/schema-reviews/{reviewId}/decisions'] as {
        post: {
          responses: Record<string, { description: string }>;
          parameters: { name: string }[];
        };
      }
    ).post;
    expect(decision.responses['401']?.description).toBe(
      'STEP_UP_REQUIRED, UNAUTHENTICATED',
    );
    expect(decision.parameters.map(({ name }) => name)).toEqual([
      'reviewId',
      'Idempotency-Key',
      'If-Match',
    ]);
    const read = (
      internal.paths['/api/v1/cms/schema-reviews/{reviewId}'] as {
        get: { parameters: { name: string }[]; requestBody?: unknown };
      }
    ).get;
    expect(read.parameters.map(({ name }) => name)).toEqual(['reviewId']);
    expect(read.requestBody).toBeUndefined();
  });

  it('pins the fixed read/decide tuple with a length-bounded JSON schema', () => {
    for (const schemas of [
      getContentSchemaRegistryOpenApiComponentSchemas(),
      getContentSchemaRegistryBrowserOpenApiComponentSchemas(),
    ]) {
      const assignment = schemas.SchemaReviewAssignmentResource as {
        properties: { actions: Record<string, unknown> };
      };
      expect(assignment.properties.actions).toEqual({
        type: 'array',
        prefixItems: [
          { type: 'string', const: 'read' },
          { type: 'string', const: 'decide' },
        ],
        items: false,
        minItems: 2,
        maxItems: 2,
      });
    }
  });

  it('publishes the new schemas without identity or worker evidence fields', () => {
    const schemas = getContentSchemaRegistryBrowserOpenApiComponentSchemas();
    for (const name of [
      'SchemaSuccessorRequest',
      'SchemaDryRunRequest',
      'SchemaReviewSubmissionRequest',
      'SchemaReviewDecisionRequest',
      'SchemaReviewDetailParams',
      'SchemaReviewAssignmentRequest',
      'SchemaDryRunResource',
      'SchemaReviewResource',
      'SchemaReviewDecisionResource',
      'SchemaReviewAssignmentResource',
    ])
      expect(schemas).toHaveProperty(name);
    const serialized = JSON.stringify(schemas.SchemaReviewResource);
    expect(serialized).not.toMatch(
      /actorId|reviewerPersonId|actingPartyId|bindingId/u,
    );
  });
});

describe('platform registry rows for CMS-03A-01..14', () => {
  it('mirrors every route policy in the canonical platform registry', () => {
    const rows = platformRegistrySet.routes.filter(({ operationId }) =>
      operationId.startsWith('CMS-03A-'),
    );
    expect(rows.map(({ operationId }) => operationId)).toEqual(
      routes.map(({ operationId }) => operationId),
    );
    for (const route of routes) {
      const row = rows.find(
        ({ operationId }) => operationId === route.operationId,
      );
      expect(row, route.operationId).toMatchObject({
        method: route.method,
        path: route.path,
        authClass: route.auth,
        capability: route.capability,
        capabilities: route.capabilities ?? [route.capability],
        corsClass: route.cors,
        audience: route.audience,
        csrf: route.csrf,
        rawBodySignature: route.rawBodySignature,
        idempotency: route.idempotency,
        ifMatch: route.ifMatch,
        rateClass: route.rateClass,
        rateLimit: route.rateLimit,
        rateWindowSeconds: route.rateWindowSeconds,
        rateScope: route.rateScope,
        timeoutMs: route.timeoutMs,
        requestSchema: route.requestSchema,
        successSchema: route.successSchema,
        cacheControl: route.cacheControl,
      });
      expect(row?.partyRateLimit).toBe(route.partyRateLimit);
    }
  });
});
