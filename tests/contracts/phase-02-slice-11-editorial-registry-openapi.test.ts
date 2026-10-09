import { existsSync, readFileSync } from 'node:fs';

import {
  CMS_EDITORIAL_INTERNAL_OPERATIONS,
  cmsEditorialRoutePolicies,
  platformRegistrySet,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { buildOpenApiDocument } from '../../infra/openapi-document.mjs';

type Operation = Readonly<{
  operationId: string;
  'x-auth-class': string;
  'x-capabilities'?: readonly string[];
  'x-capability-mode'?: string;
  'x-step-up'?: string;
  'x-csrf': string;
  'x-idempotency': string;
  'x-if-match': string;
  'x-rate-limit': Readonly<Record<string, unknown>>;
  'x-timeout-ms': number;
  'x-slo-tier': string;
  'x-runbook': string;
  parameters?: readonly Readonly<{
    name: string;
    in: string;
    required: boolean;
  }>[];
  requestBody?: Readonly<{
    content: Readonly<{
      'application/json': Readonly<{ schema: Record<string, unknown> }>;
    }>;
  }>;
  responses: Readonly<
    Record<
      string,
      Readonly<{
        headers?: Readonly<Record<string, unknown>>;
        content?: Readonly<{
          'application/json'?: Readonly<{ schema?: Record<string, unknown> }>;
        }>;
      }>
    >
  >;
}>;

type Document = Readonly<{
  paths: Readonly<Record<string, Readonly<Record<string, Operation>>>>;
  components: Readonly<{ schemas: Readonly<Record<string, unknown>> }>;
}>;

const SLICE_11 = [
  'CMS-03B-05',
  'CMS-03B-06',
  'CMS-03B-07',
  'CMS-03B-08',
  'CMS-03B-09',
  'CMS-03B-15',
  'CMS-03B-16',
  'CMS-03B-17',
  'CMS-03B-18',
] as const;

const requestSchemaNames: Readonly<Record<(typeof SLICE_11)[number], string>> =
  {
    'CMS-03B-05': 'ReviewSubmissionApiRequestSchema',
    'CMS-03B-06': 'EditorialDecisionApiRequestSchema',
    'CMS-03B-07': 'PublicationScheduleApiRequestSchema',
    'CMS-03B-08': 'PreviewApiRequestSchema',
    'CMS-03B-09': 'PublicationApiRequestSchema',
    'CMS-03B-15': 'EntryWorkflowApiRequestSchema',
    'CMS-03B-16': 'EditorialReviewDetailApiRequestSchema',
    'CMS-03B-17': 'ReviewQueueApiRequestSchema',
    'CMS-03B-18': 'EditorialReviewAssignmentApiRequestSchema',
  };

const document = buildOpenApiDocument() as Document;
const operationOf = (path: string, method: string): Operation => {
  const found = document.paths[path]?.[method.toLowerCase()];
  if (found === undefined)
    throw new Error(`No OpenAPI operation ${method} ${path}`);
  return found;
};
const registryRow = (operationId: string) => {
  const found = platformRegistrySet.routes.find(
    (row) => row.operationId === operationId,
  );
  if (found === undefined) throw new Error(`No registry row ${operationId}`);
  return found;
};
const policyRow = (operationId: string) => {
  const found = cmsEditorialRoutePolicies.find(
    (row) => row.operationId === operationId,
  );
  if (found === undefined) throw new Error(`No policy row ${operationId}`);
  return found;
};
const names = (operation: Operation, place: string): readonly string[] =>
  (operation.parameters ?? [])
    .filter(({ in: where }) => where === place)
    .map(({ name }) => name);

describe('[P2-S11-AC-005][P2-S11-AC-049] Slice 11 platform registry rows mirror the editorial route policy', () => {
  it('registers the nine browser operations contiguously after CMS-03B-14', () => {
    const ids = platformRegistrySet.routes.map(
      ({ operationId }) => operationId,
    );
    const start = ids.indexOf('CMS-03B-14');
    expect(ids.slice(start, start + 10)).toEqual(['CMS-03B-14', ...SLICE_11]);
  });

  it('carries the same policy fields as the package route registry for every row', () => {
    for (const operationId of SLICE_11) {
      const row = registryRow(operationId);
      const policy = policyRow(operationId);
      expect(
        {
          method: row.method,
          path: row.path,
          authClass: row.authClass,
          capabilityMode: row.capabilityMode,
          stepUp: row.stepUp,
          corsClass: row.corsClass,
          audience: row.audience,
          csrf: row.csrf,
          rawBodySignature: row.rawBodySignature,
          idempotency: row.idempotency,
          ifMatch: row.ifMatch,
          rateClass: row.rateClass,
          rateLimit: row.rateLimit,
          partyRateLimit: row.partyRateLimit,
          rateWindowSeconds: row.rateWindowSeconds,
          rateScope: row.rateScope,
          timeoutMs: row.timeoutMs,
          sloTier: row.sloTier,
          successSchema: row.successSchema,
          cacheControl: row.cacheControl,
          cacheClass: row.cacheClass,
        },
        operationId,
      ).toEqual({
        method: policy.method,
        path: policy.path,
        authClass: policy.auth,
        capabilityMode: policy.capabilityMode,
        stepUp: policy.stepUp,
        corsClass: policy.cors,
        audience: policy.audience,
        csrf: policy.csrf,
        rawBodySignature: policy.rawBodySignature,
        idempotency: policy.idempotency,
        ifMatch: policy.ifMatch,
        rateClass: policy.rateClass,
        rateLimit: policy.rateLimit,
        partyRateLimit: policy.partyRateLimit,
        rateWindowSeconds: policy.rateWindowSeconds,
        rateScope: policy.rateScope,
        timeoutMs: policy.timeoutMs,
        sloTier: `tier_${policy.slo.tier}`,
        successSchema: policy.successSchema,
        cacheControl: policy.cacheControl,
        cacheClass: 'no_store',
      });
      expect(row.requestSchema, operationId).toBe(
        requestSchemaNames[operationId],
      );
      if (policy.capabilities.length > 0)
        expect(row.capabilities, operationId).toEqual(policy.capabilities);
      else expect(row.capabilities, operationId).toBeUndefined();
    }
  });

  it('names the cms-publication runbook and the Editorial owner on every row, and the file exists and covers every operation', () => {
    for (const operationId of SLICE_11) {
      expect(registryRow(operationId).runbook).toBe(
        'docs/runbooks/platform/cms-publication.md',
      );
      expect(registryRow(operationId).owner).toBe('Editorial');
    }
    expect(existsSync('docs/runbooks/platform/cms-publication.md')).toBe(true);
    const runbook = readFileSync(
      'docs/runbooks/platform/cms-publication.md',
      'utf8',
    );
    for (const operationId of [
      ...SLICE_11,
      ...Object.keys(CMS_EDITORIAL_INTERNAL_OPERATIONS),
    ])
      expect(runbook, operationId).toContain(operationId);
  });

  it('keeps the internal operations out of the browser route registry', () => {
    for (const operationId of Object.keys(CMS_EDITORIAL_INTERNAL_OPERATIONS))
      expect(
        platformRegistrySet.routes.some(
          (row) => row.operationId === operationId,
        ),
      ).toBe(false);
    for (const rpc of Object.values(CMS_EDITORIAL_INTERNAL_OPERATIONS).flatMap(
      ({ rpcs }) => rpcs,
    ))
      expect(
        platformRegistrySet.routes.some((row) => row.path.includes(rpc)),
      ).toBe(false);
  });
});

describe('[P2-S11-AC-049] generated OpenAPI documents each Slice 11 operation', () => {
  it('publishes path, header and query parameters per route', () => {
    const cases: readonly [string, string, string[], string[], string[]][] = [
      [
        'POST',
        '/api/v1/cms/entries/{entryId}/reviews',
        ['entryId'],
        ['Idempotency-Key', 'If-Match'],
        [],
      ],
      [
        'POST',
        '/api/v1/cms/reviews/{reviewId}/decision',
        ['reviewId'],
        ['Idempotency-Key', 'If-Match'],
        [],
      ],
      [
        'POST',
        '/api/v1/cms/publication-schedules',
        [],
        ['Idempotency-Key', 'If-Match'],
        [],
      ],
      ['POST', '/api/v1/cms/previews', [], ['Idempotency-Key', 'If-Match'], []],
      [
        'POST',
        '/api/v1/cms/publications',
        [],
        ['Idempotency-Key', 'If-Match'],
        [],
      ],
      [
        'GET',
        '/api/v1/cms/entries/{entryId}/workflow',
        ['entryId'],
        [],
        ['revisionId'],
      ],
      ['GET', '/api/v1/cms/reviews/{reviewId}', ['reviewId'], [], []],
      [
        'GET',
        '/api/v1/cms/reviews',
        [],
        [],
        ['cursor', 'limit', 'scope', 'state'],
      ],
      [
        'POST',
        '/api/v1/cms/reviews/{reviewId}/assignments',
        ['reviewId'],
        ['Idempotency-Key', 'If-Match'],
        [],
      ],
    ];
    for (const [method, path, pathNames, headerNames, queryNames] of cases) {
      const operation = operationOf(path, method);
      expect(names(operation, 'path'), path).toEqual(pathNames);
      expect(names(operation, 'header'), path).toEqual(headerNames);
      expect(names(operation, 'query'), path).toEqual(queryNames);
      if (method === 'GET') expect(operation.requestBody, path).toBeUndefined();
      else
        expect(
          operation.requestBody?.content['application/json'].schema,
          path,
        ).toBeDefined();
    }
  });

  // The discriminated assignment body (branches, properties, required members,
  // reason constraints) is asserted structurally in
  // phase-02-slice-11-openapi-refinements.test.ts, not by substring here.
  it('documents the typed time and decision members', () => {
    const schedule = operationOf('/api/v1/cms/publication-schedules', 'POST');
    expect(
      Object.keys(
        (schedule.requestBody?.content['application/json'].schema
          .properties as Record<string, unknown>) ?? {},
      ),
    ).toEqual(
      expect.arrayContaining([
        'revisionId',
        'action',
        'localDateTime',
        'timezone',
        'resolvedUtc',
        'tzdbVersion',
        'disambiguation',
        'audience',
        'expectedVersion',
      ]),
    );
    const decision = operationOf(
      '/api/v1/cms/reviews/{reviewId}/decision',
      'POST',
    );
    const decisionProps = Object.keys(
      (decision.requestBody?.content['application/json'].schema
        .properties as Record<string, unknown>) ?? {},
    );
    expect(decisionProps).toEqual(
      expect.arrayContaining([
        'reviewId',
        'decision',
        'reason',
        'expectedVersion',
      ]),
    );
    expect(decisionProps).not.toContain('capability');
    expect(decisionProps).not.toContain('stepUpAt');
  });

  it('answers each route with its success status, validators and error statuses', () => {
    for (const operationId of SLICE_11) {
      const policy = policyRow(operationId);
      const operation = operationOf(policy.path, policy.method);
      expect(operation.operationId).toBe(operationId);
      const successStatuses = [
        policy.successStatus,
        ...(('additionalSuccessStatuses' in policy
          ? policy.additionalSuccessStatuses
          : undefined) ?? []),
      ].map(String);
      for (const status of successStatuses)
        expect(
          operation.responses[status],
          `${operationId} ${status}`,
        ).toBeDefined();
      const errorStatuses = [...new Set(Object.values(policy.errors))].map(
        String,
      );
      for (const status of errorStatuses)
        expect(
          operation.responses[status],
          `${operationId} ${status}`,
        ).toBeDefined();
      const documented = Object.keys(operation.responses).sort();
      expect(documented, operationId).toEqual(
        [...new Set([...successStatuses, ...errorStatuses])].sort(),
      );
      const primary = operation.responses[String(policy.successStatus)];
      expect(
        primary?.headers !== undefined && 'ETag' in primary.headers,
        `${operationId} ETag`,
      ).toBe(policy.etag === 'strong');
      expect(
        primary?.headers !== undefined && 'Location' in primary.headers,
        `${operationId} Location`,
      ).toBe(policy.location === 'required' || policy.location === 'on_create');
      expect(operation['x-timeout-ms']).toBe(policy.timeoutMs);
      expect(operation['x-rate-limit']).toEqual({
        class: policy.rateClass,
        limit: policy.rateLimit,
        partyLimit: policy.partyRateLimit,
        windowSeconds: 60,
        scope: 'user',
      });
    }
  });

  it('does not give a revoke a Location and publishes the 401 step-up union on the four step-up routes only', () => {
    const assignment = operationOf(
      '/api/v1/cms/reviews/{reviewId}/assignments',
      'POST',
    );
    expect('Location' in (assignment.responses['201']?.headers ?? {})).toBe(
      true,
    );
    expect('ETag' in (assignment.responses['200']?.headers ?? {})).toBe(true);
    expect('Location' in (assignment.responses['200']?.headers ?? {})).toBe(
      false,
    );
    for (const operationId of SLICE_11) {
      const policy = policyRow(operationId);
      const operation = operationOf(policy.path, policy.method);
      expect(operation['x-step-up'], operationId).toBe(policy.stepUp);
      const unauthorized = JSON.stringify(
        operation.responses['401']?.content?.['application/json']?.schema ?? {},
      );
      expect(unauthorized.includes('CmsStepUpRequiredError'), operationId).toBe(
        policy.stepUp === 'required',
      );
    }
  });

  it('publishes the resource components and never the internal RPC contracts', () => {
    for (const component of [
      'EditorialReviewResource',
      'PublicationScheduleResource',
      'PreviewTokenResource',
      'PublicationResource',
      'EntryWorkflowResource',
      'EditorialReviewDetailResource',
      'ReviewQueuePage',
      'EditorialReviewAssignmentResource',
      'ReviewSubmissionApiRequest',
      'EditorialDecisionApiRequest',
      'PublicationScheduleApiRequest',
      'PreviewApiRequest',
      'PublicationApiRequest',
      'EntryWorkflowApiRequest',
      'EditorialReviewDetailApiRequest',
      'ReviewQueueApiRequest',
      'EditorialReviewAssignmentApiRequest',
    ])
      expect(document.components.schemas, component).toHaveProperty(component);
    for (const internal of [
      'PreviewVerificationRequest',
      'PreviewVerificationResult',
      'ClaimedSchedule',
      'ExecuteScheduleRequest',
      'ScheduleExecutionResult',
      'PreflightEvidence',
    ])
      expect(document.components.schemas, internal).not.toHaveProperty(
        internal,
      );
    const paths = Object.keys(document.paths);
    // The only publication or preview paths are the three browser commands: no RPC route exists.
    expect(
      paths.filter((path) => /publication|preview/u.test(path)).sort(),
    ).toEqual([
      '/api/v1/cms/previews',
      '/api/v1/cms/publication-schedules',
      '/api/v1/cms/publications',
    ]);
    expect(
      paths.some(
        (path) =>
          path.includes('cms_verify_preview_token') ||
          path.includes('cms_claim_due') ||
          path.includes('cms_execute_publication'),
      ),
    ).toBe(false);
    const operationIds = Object.values(document.paths).flatMap((item) =>
      Object.values(item).map(({ operationId }) => operationId),
    );
    expect(operationIds).not.toContain('CMS-03B-19');
    expect(operationIds).not.toContain('CMS-03B-20');
  });

  it('has a response definition for every registered operation (no drift)', () => {
    const documented = Object.values(document.paths).flatMap((item) =>
      Object.values(item).map(({ operationId }) => operationId),
    );
    expect(documented).toHaveLength(platformRegistrySet.routes.length);
  });
});
