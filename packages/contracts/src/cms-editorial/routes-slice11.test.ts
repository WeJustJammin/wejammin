import { describe, expect, it } from 'vitest';

import {
  CMS_EDITORIAL_OPERATION_IDS,
  CMS_SLICE_11_OPERATION_REASONS,
  assertCmsEditorialRouteRegistry,
  cmsEditorialRouteAdmitsPrincipal,
  cmsEditorialRoutePolicies,
  editorialReviewQueueErrors,
  editorialStepUpCommandErrors,
  editorialWorkflowReadErrors,
  policyShapeSchema,
} from './index';

const byOperation = (operationId: string) => {
  const found = cmsEditorialRoutePolicies.find(
    (policy) => policy.operationId === operationId,
  );
  if (found === undefined)
    throw new Error(`Missing cms editorial operation: ${operationId}`);
  return found;
};

const tier2Slo = {
  tier: 2,
  commandP95Ms: 1_200,
  protectedRpcP95Ms: 300,
  acceptanceP99Ms: 1_000,
} as const;
const tier1Slo = {
  tier: 1,
  commandP95Ms: 750,
  protectedRpcP95Ms: 300,
  acceptanceP99Ms: 1_000,
} as const;

const commandCodes = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  BAD_GATEWAY: 502,
  DEPENDENCY_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
} as const;

const boundedReadCodes = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  BAD_GATEWAY: 502,
  DEPENDENCY_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  INTERNAL_ERROR: 500,
} as const;

const slice11 = [
  ['CMS-03B-05', 'POST', '/api/v1/cms/entries/{entryId}/reviews'],
  ['CMS-03B-06', 'POST', '/api/v1/cms/reviews/{reviewId}/decision'],
  ['CMS-03B-07', 'POST', '/api/v1/cms/publication-schedules'],
  ['CMS-03B-08', 'POST', '/api/v1/cms/previews'],
  ['CMS-03B-09', 'POST', '/api/v1/cms/publications'],
  ['CMS-03B-15', 'GET', '/api/v1/cms/entries/{entryId}/workflow'],
  ['CMS-03B-16', 'GET', '/api/v1/cms/reviews/{reviewId}'],
  ['CMS-03B-17', 'GET', '/api/v1/cms/reviews'],
  ['CMS-03B-18', 'POST', '/api/v1/cms/reviews/{reviewId}/assignments'],
] as const;

/** The shared envelope of every Slice 11 browser row. */
const shared = {
  audience: 'browser',
  cors: 'cms-console',
  rawBodySignature: 'none',
  maxBodyBytes: 262_144,
  rateWindowSeconds: 60,
  rateScope: 'user',
  cacheControl: 'no-store',
} as const;

describe('[P2-S11-AC-005][P2-S11-AC-049] the 18-operation editorial route registry', () => {
  it('appends the nine Slice 11 browser operations after the nine Slice 10 operations', () => {
    expect(
      cmsEditorialRoutePolicies
        .slice(9)
        .map(({ operationId, method, path }) => [operationId, method, path]),
    ).toEqual(slice11);
    expect(cmsEditorialRoutePolicies).toHaveLength(18);
    expect([...CMS_EDITORIAL_OPERATION_IDS].slice(9)).toEqual(
      slice11.map(([id]) => id),
    );
    expect(assertCmsEditorialRouteRegistry(cmsEditorialRoutePolicies)).toBe(
      cmsEditorialRoutePolicies,
    );
  });

  it('keeps every method+path and operation id unique across the 18 rows', () => {
    const methodPaths = cmsEditorialRoutePolicies.map(
      ({ method, path }) => `${method} ${path}`,
    );
    expect(new Set(methodPaths).size).toBe(18);
    expect(
      new Set(cmsEditorialRoutePolicies.map(({ operationId }) => operationId))
        .size,
    ).toBe(18);
  });

  it('gives every Slice 11 row the shared browser envelope', () => {
    for (const [operationId] of slice11) {
      const row = byOperation(operationId);
      expect(row, operationId).toMatchObject(shared);
      expect(policyShapeSchema.safeParse(row).success, operationId).toBe(true);
    }
  });
});

describe('[P2-S11-AC-005][P2-S11-AC-008] CMS-03B-05 submit review row', () => {
  const row = byOperation('CMS-03B-05');
  it('binds the submission contracts, 201, a strong review ETag and Location', () => {
    expect(row).toMatchObject({
      requestSchema: 'ReviewSubmissionRequestSchema',
      pathParamsSchema: 'CmsEditorialReviewSubmissionPathParamsSchema',
      headersSchema: 'CmsEditorialReviewSubmissionHeadersSchema',
      successSchema: 'EditorialReviewResourceSchema',
      successStatus: 201,
      outcome: 'created',
      etag: 'strong',
      location: 'required',
      eventType: 'cms.entry.review-changed.v1',
    });
    expect('querySchema' in row).toBe(false);
  });
  it('gates author or editor, key plus the entry-version If-Match, no step-up', () => {
    expect(row).toMatchObject({
      auth: 'editorial_author',
      capabilities: ['cms.author', 'cms.editor'],
      capabilityMode: 'any_of',
      gate: 'capability',
      stepUp: 'none',
      csrf: 'required',
      idempotency: 'required',
      ifMatch: 'required',
    });
  });
  it('limits 30/60 per minute in the review class, 15 s, Tier 2', () => {
    expect(row).toMatchObject({
      rateClass: 'cms-review-write',
      rateLimit: 30,
      partyRateLimit: 60,
      timeoutMs: 15_000,
      responseTargetMs: 2_000,
      slo: tier2Slo,
    });
    expect(row.errors).toEqual(commandCodes);
    expect(row.reasonCodes).toEqual(
      CMS_SLICE_11_OPERATION_REASONS['CMS-03B-05'],
    );
  });
});

describe('[P2-S11-AC-011][P2-S11-AC-014] CMS-03B-06 decision row', () => {
  const row = byOperation('CMS-03B-06');
  it('binds the decision contracts, 200 on the existing review and no Location', () => {
    expect(row).toMatchObject({
      requestSchema: 'EditorialDecisionRequestSchema',
      pathParamsSchema: 'CmsEditorialDecisionPathParamsSchema',
      headersSchema: 'CmsEditorialDecisionHeadersSchema',
      successSchema: 'EditorialReviewResourceSchema',
      successStatus: 200,
      outcome: 'updated',
      etag: 'strong',
      location: 'none',
      eventType: 'cms.entry.review-changed.v1',
    });
  });
  it('requires the reviewer capability and unconditional step-up', () => {
    expect(row).toMatchObject({
      auth: 'editorial_reviewer',
      capabilities: ['cms.reviewer'],
      capabilityMode: 'any_of',
      gate: 'capability',
      stepUp: 'required',
      csrf: 'required',
      idempotency: 'required',
      ifMatch: 'required',
    });
    expect(row.errors).toEqual({ ...commandCodes, STEP_UP_REQUIRED: 401 });
    expect(row.errors).toEqual(editorialStepUpCommandErrors);
  });
  it('limits 30/60 per minute in the review class, 15 s, Tier 2', () => {
    expect(row).toMatchObject({
      rateClass: 'cms-review-write',
      rateLimit: 30,
      partyRateLimit: 60,
      timeoutMs: 15_000,
      slo: tier2Slo,
    });
    expect(row.reasonCodes).toEqual(
      CMS_SLICE_11_OPERATION_REASONS['CMS-03B-06'],
    );
  });
});

describe('[P2-S11-AC-017][P2-S11-AC-020] CMS-03B-07 schedule row', () => {
  const row = byOperation('CMS-03B-07');
  it('accepts with 202, a strong schedule ETag and Location, and emits no event at acceptance', () => {
    expect(row).toMatchObject({
      requestSchema: 'PublicationScheduleRequestSchema',
      headersSchema: 'CmsPublicationScheduleHeadersSchema',
      successSchema: 'PublicationScheduleResourceSchema',
      successStatus: 202,
      outcome: 'accepted',
      etag: 'strong',
      location: 'required',
      eventType: 'none',
    });
    expect('pathParamsSchema' in row).toBe(false);
  });
  it('requires the owner-party publisher capability, the approved-review If-Match and step-up', () => {
    expect(row).toMatchObject({
      auth: 'editorial_publisher',
      capabilities: ['cms.publisher'],
      capabilityMode: 'any_of',
      gate: 'capability',
      stepUp: 'required',
      idempotency: 'required',
      ifMatch: 'required',
    });
    expect(row.errors).toEqual(editorialStepUpCommandErrors);
  });
  it('limits 20/40 per minute in the schedule class, 15 s acceptance, Tier 2', () => {
    expect(row).toMatchObject({
      rateClass: 'cms-schedule-write',
      rateLimit: 20,
      partyRateLimit: 40,
      timeoutMs: 15_000,
      responseTargetMs: 2_000,
      slo: tier2Slo,
    });
    expect(row.reasonCodes).toEqual(
      CMS_SLICE_11_OPERATION_REASONS['CMS-03B-07'],
    );
  });
});

describe('[P2-S11-AC-023][P2-S11-AC-026] CMS-03B-08 preview row', () => {
  const row = byOperation('CMS-03B-08');
  it('mints with 201, no public ETag, no Location and no event', () => {
    expect(row).toMatchObject({
      requestSchema: 'PreviewRequestSchema',
      headersSchema: 'CmsPreviewRequestHeadersSchema',
      successSchema: 'PreviewTokenResourceSchema',
      successStatus: 201,
      outcome: 'created',
      etag: 'none',
      location: 'none',
      eventType: 'none',
    });
    expect('pathParamsSchema' in row).toBe(false);
  });
  it('resolves preview scope in the RPC, requires the entry-version If-Match and no step-up', () => {
    expect(row).toMatchObject({
      auth: 'editorial_preview',
      gate: 'rpc_scope',
      stepUp: 'none',
      csrf: 'required',
      idempotency: 'required',
      ifMatch: 'required',
    });
    expect(row.capabilities).toEqual([
      'cms.author',
      'cms.editor',
      'cms.reviewer',
      'cms.publisher',
    ]);
    expect(row.errors).toEqual(commandCodes);
  });
  it('limits 60/120 per minute in the preview class, 8 s, Tier 1', () => {
    expect(row).toMatchObject({
      rateClass: 'cms-preview-write',
      rateLimit: 60,
      partyRateLimit: 120,
      timeoutMs: 8_000,
      responseTargetMs: 750,
      slo: tier1Slo,
    });
    expect(row.reasonCodes).toEqual(
      CMS_SLICE_11_OPERATION_REASONS['CMS-03B-08'],
    );
  });
});

describe('[P2-S11-AC-029][P2-S11-AC-032] CMS-03B-09 publication row', () => {
  const row = byOperation('CMS-03B-09');
  it('accepts with 202, a strong lineage ETag and Location, and emits the publication event', () => {
    expect(row).toMatchObject({
      requestSchema: 'PublicationRequestSchema',
      headersSchema: 'CmsPublicationRequestHeadersSchema',
      successSchema: 'PublicationResourceSchema',
      successStatus: 202,
      outcome: 'accepted',
      etag: 'strong',
      location: 'required',
      eventType: 'cms.publication.changed.v1',
    });
  });
  it('requires the owner-party publisher capability, the approved-review If-Match and step-up', () => {
    expect(row).toMatchObject({
      auth: 'editorial_publisher',
      capabilities: ['cms.publisher'],
      capabilityMode: 'any_of',
      gate: 'capability',
      stepUp: 'required',
      idempotency: 'required',
      ifMatch: 'required',
    });
    expect(row.errors).toEqual(editorialStepUpCommandErrors);
  });
  it('limits 20/40 per minute in the publish class, 15 s acceptance, Tier 2', () => {
    expect(row).toMatchObject({
      rateClass: 'cms-publish-write',
      rateLimit: 20,
      partyRateLimit: 40,
      timeoutMs: 15_000,
      responseTargetMs: 2_000,
      slo: tier2Slo,
    });
    expect(row.reasonCodes).toEqual(
      CMS_SLICE_11_OPERATION_REASONS['CMS-03B-09'],
    );
  });
});

describe('[P2-S11-AC-049][P2-S11-AC-052] CMS-03B-15 workflow read row', () => {
  const row = byOperation('CMS-03B-15');
  it('binds the workflow query, 200, a strong composite ETag and no event', () => {
    expect(row).toMatchObject({
      requestSchema: 'EntryWorkflowQuerySchema',
      pathParamsSchema: 'EntryWorkflowPathParamsSchema',
      querySchema: 'EntryWorkflowQuerySchema',
      successSchema: 'EntryWorkflowResourceSchema',
      successStatus: 200,
      outcome: 'read',
      etag: 'strong',
      location: 'none',
      eventType: 'none',
    });
    expect('headersSchema' in row).toBe(false);
  });
  it('is a safe read: no key, no If-Match, no step-up, scope resolved by the RPC', () => {
    expect(row).toMatchObject({
      auth: 'editorial_workflow_reader',
      gate: 'rpc_scope',
      stepUp: 'none',
      csrf: 'none',
      idempotency: 'none',
      ifMatch: 'none',
    });
    expect(row.errors).toEqual(boundedReadCodes);
    expect(row.errors).toEqual(editorialWorkflowReadErrors);
  });
  it('limits 300/600 per minute, 8 s and the Tier 2 p95 target', () => {
    expect(row).toMatchObject({
      rateClass: 'cms-entry-read',
      rateLimit: 300,
      partyRateLimit: 600,
      timeoutMs: 8_000,
      responseTargetMs: 1_200,
      slo: tier2Slo,
    });
  });
});

describe('[P2-S11-AC-055][P2-S11-AC-058] CMS-03B-16 review detail row', () => {
  const row = byOperation('CMS-03B-16');
  it('binds the detail path, 200 and the review-version ETag', () => {
    expect(row).toMatchObject({
      requestSchema: 'EditorialReviewDetailQuerySchema',
      pathParamsSchema: 'EditorialReviewDetailPathParamsSchema',
      querySchema: 'EditorialReviewDetailQuerySchema',
      successSchema: 'EditorialReviewDetailResourceSchema',
      successStatus: 200,
      outcome: 'read',
      etag: 'strong',
      eventType: 'none',
    });
  });
  it('is a safe Tier 1 read resolved by the RPC scope', () => {
    expect(row).toMatchObject({
      auth: 'editorial_review_reader',
      gate: 'rpc_scope',
      stepUp: 'none',
      csrf: 'none',
      idempotency: 'none',
      ifMatch: 'none',
      rateClass: 'cms-entry-read',
      rateLimit: 300,
      partyRateLimit: 600,
      timeoutMs: 8_000,
      responseTargetMs: 750,
      slo: tier1Slo,
    });
    expect(row.errors).toEqual(editorialWorkflowReadErrors);
  });
});

describe('[P2-S11-AC-061][P2-S11-AC-064] CMS-03B-17 reviewer queue row', () => {
  const row = byOperation('CMS-03B-17');
  it('binds the queue query and page, 200 and an authenticated page ETag', () => {
    expect(row).toMatchObject({
      requestSchema: 'ReviewQueueQuerySchema',
      querySchema: 'ReviewQueueQuerySchema',
      successSchema: 'ReviewQueuePageSchema',
      successStatus: 200,
      outcome: 'read',
      etag: 'strong',
      eventType: 'none',
    });
    expect('pathParamsSchema' in row).toBe(false);
  });
  it('lists only the caller scopes: no 403 or 404, and a cursor 409', () => {
    expect(row).toMatchObject({
      auth: 'editorial_review_queue',
      gate: 'rpc_scope',
      stepUp: 'none',
      rateClass: 'cms-entry-read',
      rateLimit: 300,
      partyRateLimit: 600,
      timeoutMs: 8_000,
      responseTargetMs: 750,
      slo: tier1Slo,
    });
    expect(row.capabilities).toEqual([]);
    expect(row.errors).toEqual(editorialReviewQueueErrors);
    expect(row.errors).toHaveProperty('CONFLICT', 409);
    expect(row.errors).not.toHaveProperty('FORBIDDEN');
    expect(row.errors).not.toHaveProperty('NOT_FOUND');
    expect(row.reasonCodes).toEqual([]);
  });
});

describe('[P2-S11-AC-067][P2-S11-AC-070] CMS-03B-18 reviewer assignment row', () => {
  const row = byOperation('CMS-03B-18');
  it('answers 201 with Location for create and 200 for revoke on the same row', () => {
    expect(row).toMatchObject({
      requestSchema: 'EditorialReviewAssignmentRequestSchema',
      pathParamsSchema: 'EditorialReviewAssignmentPathParamsSchema',
      headersSchema: 'CmsEditorialReviewAssignmentHeadersSchema',
      successSchema: 'EditorialReviewAssignmentResourceSchema',
      successStatus: 201,
      additionalSuccessStatuses: [200],
      outcome: 'created',
      etag: 'strong',
      location: 'on_create',
      eventType: 'cms.entry.review-changed.v1',
    });
  });
  it('is owner-only by the non-grantable capability with unconditional step-up', () => {
    expect(row).toMatchObject({
      auth: 'editorial_owner',
      capabilities: ['cms.editorial_review.assign'],
      capabilityMode: 'all_of',
      gate: 'rpc_scope',
      stepUp: 'required',
      idempotency: 'required',
      ifMatch: 'required',
    });
    expect(row.errors).toEqual(editorialStepUpCommandErrors);
  });
  it('limits 10/20 per minute in the assignment class, 15 s, Tier 2', () => {
    expect(row).toMatchObject({
      rateClass: 'cms-review-assignment',
      rateLimit: 10,
      partyRateLimit: 20,
      timeoutMs: 15_000,
      responseTargetMs: 2_000,
      slo: tier2Slo,
    });
    expect(row.reasonCodes).toEqual(
      CMS_SLICE_11_OPERATION_REASONS['CMS-03B-18'],
    );
  });
});

describe('[P2-S11-AC-014][P2-S11-AC-026] cross-row registry invariants', () => {
  it('requires step-up exactly on CMS-03B-06, -07, -09 and -18 and nowhere else', () => {
    expect(
      cmsEditorialRoutePolicies
        .filter((row) => row.stepUp === 'required')
        .map(({ operationId }) => operationId),
    ).toEqual(['CMS-03B-06', 'CMS-03B-07', 'CMS-03B-09', 'CMS-03B-18']);
    for (const row of cmsEditorialRoutePolicies)
      expect('STEP_UP_REQUIRED' in row.errors, row.operationId).toBe(
        row.stepUp === 'required',
      );
  });

  it('keeps every command on a key plus If-Match, CSRF and JSON, and every read free of them', () => {
    for (const row of cmsEditorialRoutePolicies) {
      if (row.method === 'POST') {
        expect(row.csrf, row.operationId).toBe('required');
        expect(row.idempotency, row.operationId).toBe('required');
        expect(row.ifMatch, row.operationId).toBe(
          row.operationId === 'CMS-03B-10' ? 'none' : 'required',
        );
      } else {
        expect(row.csrf, row.operationId).toBe('none');
        expect(row.idempotency, row.operationId).toBe('none');
        expect(row.ifMatch, row.operationId).toBe('none');
        expect(row.eventType, row.operationId).toBe('none');
      }
    }
  });

  it('puts the Location only on creating and accepting commands', () => {
    expect(
      cmsEditorialRoutePolicies
        .filter((row) => row.location !== 'none')
        .map(({ operationId, location }) => [operationId, location]),
    ).toEqual([
      ['CMS-03B-01', 'required'],
      ['CMS-03B-02', 'required'],
      ['CMS-03B-04', 'required'],
      ['CMS-03B-10', 'required'],
      ['CMS-03B-05', 'required'],
      ['CMS-03B-07', 'required'],
      ['CMS-03B-09', 'required'],
      ['CMS-03B-18', 'on_create'],
    ]);
  });

  it('admits a principal by the declared capabilities or leaves the scope to the RPC', () => {
    expect(
      cmsEditorialRouteAdmitsPrincipal(byOperation('CMS-03B-06'), [
        'cms.reviewer',
      ]),
    ).toBe(true);
    expect(
      cmsEditorialRouteAdmitsPrincipal(byOperation('CMS-03B-06'), [
        'cms.author',
      ]),
    ).toBe(false);
    expect(
      cmsEditorialRouteAdmitsPrincipal(byOperation('CMS-03B-07'), [
        'cms.publisher',
      ]),
    ).toBe(true);
    expect(
      cmsEditorialRouteAdmitsPrincipal(byOperation('CMS-03B-07'), [
        'cms.editor',
      ]),
    ).toBe(false);
    expect(
      cmsEditorialRouteAdmitsPrincipal(byOperation('CMS-03B-05'), [
        'cms.editor',
      ]),
    ).toBe(true);
    // The RPC resolves the scope (reviewer assignee, owner by receipt, own submissions), so no coarse gate applies.
    for (const operationId of [
      'CMS-03B-08',
      'CMS-03B-15',
      'CMS-03B-16',
      'CMS-03B-17',
      'CMS-03B-18',
    ])
      expect(
        cmsEditorialRouteAdmitsPrincipal(byOperation(operationId), []),
        operationId,
      ).toBe(true);
  });

  it('fails closed on a registry whose rows contradict their own step-up, gate or command policy', () => {
    const rows = cmsEditorialRoutePolicies as unknown as readonly Record<
      string,
      unknown
    >[];
    const mutate = (operationId: string, patch: Record<string, unknown>) =>
      rows.map((row) =>
        row.operationId === operationId ? { ...row, ...patch } : row,
      );
    const build = (candidate: readonly Record<string, unknown>[]) =>
      assertCmsEditorialRouteRegistry(
        candidate as unknown as typeof cmsEditorialRoutePolicies,
      );
    expect(() => build(mutate('CMS-03B-06', { stepUp: 'none' }))).toThrow(
      /step-up/u,
    );
    expect(() => build(mutate('CMS-03B-05', { stepUp: 'required' }))).toThrow(
      /step-up/u,
    );
    expect(() => build(mutate('CMS-03B-05', { capabilities: [] }))).toThrow(
      /capability gate/u,
    );
    expect(() => build(mutate('CMS-03B-07', { idempotency: 'none' }))).toThrow(
      /command/u,
    );
    expect(() => build(mutate('CMS-03B-09', { csrf: 'none' }))).toThrow(
      /command/u,
    );
    expect(() =>
      build(mutate('CMS-03B-15', { idempotency: 'required' })),
    ).toThrow(/safe read/u);
  });

  it('accepts the new outcomes in the discriminant guard and refuses crossed members', () => {
    const accepted = byOperation('CMS-03B-09');
    expect(policyShapeSchema.safeParse(accepted).success).toBe(true);
    expect(
      policyShapeSchema.safeParse({ ...accepted, successStatus: 201 }).success,
    ).toBe(false);
    expect(
      policyShapeSchema.safeParse({ ...accepted, rateClass: 'cms-entry-read' })
        .success,
    ).toBe(false);
    expect(
      policyShapeSchema.safeParse({ ...accepted, eventType: 'none' }).success,
    ).toBe(false);
    expect(
      policyShapeSchema.safeParse({ ...accepted, operationId: 'CMS-03B-15' })
        .success,
    ).toBe(false);
    const updated = byOperation('CMS-03B-06');
    expect(
      policyShapeSchema.safeParse({ ...updated, successStatus: 201 }).success,
    ).toBe(false);
    const read = byOperation('CMS-03B-17');
    expect(
      policyShapeSchema.safeParse({ ...read, method: 'POST' }).success,
    ).toBe(false);
    expect(
      policyShapeSchema.safeParse({ ...read, timeoutMs: 15_000 }).success,
    ).toBe(false);
    expect(
      policyShapeSchema.safeParse({ ...read, operationId: 'CMS-03B-09' })
        .success,
    ).toBe(false);
  });
});
