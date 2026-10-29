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

const EXPECTED: readonly ExpectedOperation[] = [
  {
    id: 'CMS-03C-06',
    marker: 'P2-S12-AC-064',
    method: 'POST',
    path: '/api/v1/cms/governed-reviews',
    authClass: 'definition_owner',
    capabilities: ['cms.template_designer', 'cms.taxonomy_curator'],
    capabilityMode: 'any_of',
    stepUp: 'none',
    owner: 'ContentSchema',
    csrf: 'required',
    idempotency: 'required',
    ifMatch: 'none',
    rateClass: 'cms-governed-review-write',
    limit: 30,
    partyLimit: 60,
    timeoutMs: 15_000,
    sloTier: 'tier_2',
    request: 'GovernedReviewSubmissionApiRequestSchema',
    success: 'GovernedReviewResourceSchema',
    params: ['header:Idempotency-Key*'],
    statuses: withErrors(['201'], ALL),
    successStatuses: ['201'],
    hasBody: true,
  },
  {
    id: 'CMS-03C-07',
    marker: 'P2-S12-AC-070',
    method: 'POST',
    path: '/api/v1/cms/governed-reviews/{reviewId}/decision',
    authClass: 'definition_reviewer',
    capabilities: ['cms.reviewer'],
    capabilityMode: 'any_of',
    stepUp: 'required',
    owner: 'ContentSchema',
    csrf: 'required',
    idempotency: 'required',
    ifMatch: 'required',
    rateClass: 'cms-governed-decision',
    limit: 30,
    partyLimit: 60,
    timeoutMs: 15_000,
    sloTier: 'tier_2',
    request: 'GovernedDecisionApiRequestSchema',
    success: 'GovernedReviewResourceSchema',
    params: ['path:reviewId*', 'header:Idempotency-Key*', 'header:If-Match*'],
    statuses: withErrors(['200'], ALL),
    successStatuses: ['200'],
    hasBody: true,
  },
  {
    id: 'CMS-03C-08',
    marker: 'P2-S12-AC-076',
    method: 'POST',
    path: '/api/v1/cms/governed-reviews/{reviewId}/assignments',
    authClass: 'definition_owner',
    capabilities: ['cms.definition_review.assign'],
    capabilityMode: 'all_of',
    stepUp: 'required',
    owner: 'ContentSchema',
    csrf: 'required',
    idempotency: 'required',
    ifMatch: 'required',
    rateClass: 'cms-governed-assignment',
    limit: 10,
    partyLimit: 20,
    timeoutMs: 15_000,
    sloTier: 'tier_2',
    request: 'GovernedReviewAssignmentApiRequestSchema',
    success: 'GovernedReviewAssignmentResourceSchema',
    params: ['path:reviewId*', 'header:Idempotency-Key*', 'header:If-Match*'],
    statuses: withErrors(['200', '201'], ALL),
    successStatuses: ['200', '201'],
    hasBody: true,
  },
  {
    id: 'CMS-03C-09',
    marker: 'P2-S12-AC-082',
    method: 'POST',
    path: '/api/v1/cms/governed-reviews/{reviewId}/activation',
    authClass: 'definition_owner',
    capabilities: ['cms.template_designer', 'cms.taxonomy_curator'],
    capabilityMode: 'any_of',
    stepUp: 'required',
    owner: 'ContentSchema',
    csrf: 'required',
    idempotency: 'required',
    ifMatch: 'required',
    rateClass: 'cms-governed-activation',
    limit: 20,
    partyLimit: 40,
    timeoutMs: 15_000,
    sloTier: 'tier_2',
    request: 'GovernedActivationApiRequestSchema',
    success: 'GovernedActivationResourceSchema',
    params: ['path:reviewId*', 'header:Idempotency-Key*', 'header:If-Match*'],
    statuses: withErrors(['200', '202'], ALL),
    successStatuses: ['200', '202'],
    hasBody: true,
  },
  {
    id: 'CMS-03C-10',
    marker: 'P2-S12-AC-088',
    method: 'GET',
    path: '/api/v1/cms/governed-reviews/{reviewId}',
    authClass: 'definition_review_reader',
    capabilities: [
      'cms.template_designer',
      'cms.taxonomy_curator',
      'cms.reviewer',
      'cms.definition_review.assign',
    ],
    capabilityMode: 'any_of',
    stepUp: 'none',
    owner: 'ContentSchema',
    csrf: 'none',
    idempotency: 'none',
    ifMatch: 'none',
    rateClass: 'cms-governed-review-read',
    limit: 300,
    partyLimit: 600,
    timeoutMs: 8_000,
    sloTier: 'tier_1',
    request: 'GovernedReviewDetailApiRequestSchema',
    success: 'GovernedReviewDetailResourceSchema',
    params: ['path:reviewId*'],
    statuses: withErrors(
      ['200'],
      ['400', '401', '403', '404', '415', '429', '500', '502', '503', '504'],
    ),
    successStatuses: ['200'],
    hasBody: false,
  },
  {
    id: 'CMS-03C-11',
    marker: 'P2-S12-AC-094',
    method: 'GET',
    path: '/api/v1/cms/governed-reviews',
    authClass: 'definition_review_queue',
    capabilityMode: 'any_of',
    stepUp: 'none',
    owner: 'ContentSchema',
    csrf: 'none',
    idempotency: 'none',
    ifMatch: 'none',
    rateClass: 'cms-governed-review-read',
    limit: 300,
    partyLimit: 600,
    timeoutMs: 8_000,
    sloTier: 'tier_1',
    request: 'GovernedReviewQueueApiRequestSchema',
    success: 'GovernedReviewQueuePageSchema',
    params: [
      'query:cursor',
      'query:limit',
      'query:scope',
      'query:state',
      'query:subjectKind',
    ],
    statuses: withErrors(
      ['200'],
      ['400', '401', '409', '415', '422', '429', '500', '502', '503', '504'],
    ),
    successStatuses: ['200'],
    hasBody: false,
  },
];

describe('Slice 12 governed review registry rows and generated OpenAPI (CMS-03C-06 to CMS-03C-11)', () => {
  registerAgreementTests(EXPECTED);

  it('[P2-S12-AC-072] publishes the exact step-up 401 union only for the decision, assignment and activation commands', () => {
    for (const id of ['CMS-03C-07', 'CMS-03C-08', 'CMS-03C-09'])
      expect(successRef(openApiOperation(id), '401')).toEqual({
        oneOf: [
          { $ref: '#/components/schemas/CmsUnauthenticatedError' },
          { $ref: '#/components/schemas/CmsStepUpRequiredError' },
        ],
      });
    for (const id of ['CMS-03C-06', 'CMS-03C-10', 'CMS-03C-11'])
      expect(successRef(openApiOperation(id), '401')).toEqual({
        $ref: '#/components/schemas/ApiError',
      });
  });

  it('[P2-S12-AC-076] answers 201 with an ETag and no Location for a created assignment and 200 for a revoked one (DEC-239)', () => {
    const operation = openApiOperation('CMS-03C-08');
    expect(Object.keys(operation.responses['201']?.headers ?? {})).toContain(
      'ETag',
    );
    expect(operation.responses['201']?.headers).not.toHaveProperty('Location');
    expect(Object.keys(operation.responses['200']?.headers ?? {})).toContain(
      'ETag',
    );
    expect(operation.responses['200']?.headers).not.toHaveProperty('Location');
  });

  it('[P2-S12-AC-082] answers 202 with a Location for a scheduled activation and 200 for an activation or retirement', () => {
    const operation = openApiOperation('CMS-03C-09');
    expect(Object.keys(operation.responses['202']?.headers ?? {})).toEqual(
      expect.arrayContaining(['ETag', 'Location']),
    );
    expect(Object.keys(operation.responses['200']?.headers ?? {})).toEqual(
      expect.arrayContaining(['ETag', 'Location']),
    );
  });

  it('[P2-S12-AC-070] documents the decision body as strict with no capability or stepUpAt member', () => {
    const body = openApiOperation('CMS-03C-07').requestBody?.content[
      'application/json'
    ].schema as {
      additionalProperties: boolean;
      required: string[];
      properties: Record<string, unknown>;
    };
    expect(body.additionalProperties).toBe(false);
    expect([...body.required].sort()).toEqual([
      'decision',
      'expectedVersion',
      'reason',
      'reviewId',
    ]);
    expect(Object.keys(body.properties).sort()).toEqual([
      'decision',
      'expectedVersion',
      'reason',
      'reviewId',
    ]);
  });

  it('[P2-S12-AC-082] documents the activation body as a closed three-way choice of activate, schedule and retire', () => {
    const body = openApiOperation('CMS-03C-09').requestBody?.content[
      'application/json'
    ].schema as {
      oneOf: {
        properties: { action: { const: string } };
        required: string[];
        additionalProperties: boolean;
      }[];
    };
    expect(
      body.oneOf.map((variant) => variant.properties.action.const),
    ).toEqual(['activate', 'schedule', 'retire']);
    expect(body.oneOf.every((variant) => !variant.additionalProperties)).toBe(
      true,
    );
    expect(body.oneOf[1]?.required).toEqual([
      'action',
      'expectedVersion',
      'activateAt',
    ]);
  });

  it('[P2-S12-AC-095] documents the queue query keys with the default scope and limit and no body or path', () => {
    const operation = openApiOperation('CMS-03C-11');
    const query = (operation.parameters ?? []).filter(
      (parameter) => parameter.in === 'query',
    );
    expect(query.map((parameter) => parameter.name).sort()).toEqual([
      'cursor',
      'limit',
      'scope',
      'state',
      'subjectKind',
    ]);
    expect(query.every((parameter) => !parameter.required)).toBe(true);
    expect(operation.requestBody).toBeUndefined();
  });

  it('[P2-S12-AC-136] keeps the internal CMS-03C-18 to CMS-03C-21 operations and their records out of the browser inventory and OpenAPI', () => {
    for (const id of ['CMS-03C-18', 'CMS-03C-19', 'CMS-03C-20', 'CMS-03C-21'])
      expect(registryRow(id)).toBeUndefined();
    const document = openApiDocument();
    const operations = Object.values(document.paths).flatMap((methods) =>
      Object.values(methods).map((operation) => operation.operationId),
    );
    for (const id of ['CMS-03C-18', 'CMS-03C-19', 'CMS-03C-20', 'CMS-03C-21'])
      expect(operations).not.toContain(id);
    for (const component of [
      'CanonicalTaxonomyMatchRequest',
      'CanonicalTaxonomyMatchResult',
      'ClaimedGovernedActivation',
      'GovernedActivationExecutionResult',
      'LocaleFieldResolution',
      'RelatedPublicTarget',
    ])
      expect(document.components.schemas).not.toHaveProperty(component);
  });
});
