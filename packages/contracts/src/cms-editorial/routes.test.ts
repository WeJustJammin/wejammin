import { describe, expect, it } from 'vitest';

import {
  assertCmsEditorialRouteRegistry,
  cmsEditorialCapabilitiesSatisfied,
  cmsEditorialRoutePolicies,
  editorialDraftDetailErrors,
  editorialEntryCreateErrors,
  editorialRevisionErrors,
  policyShapeSchema,
} from './index';

const [route, , , , createRoute, detailRoute] = cmsEditorialRoutePolicies;

const expected = [
  ['CMS-03B-01', 'POST', '/api/v1/cms/entries/{entryId}/revisions'],
  [
    'CMS-03B-02',
    'POST',
    '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve',
  ],
  ['CMS-03B-03', 'GET', '/api/v1/cms/entries/{entryId}/revisions'],
  [
    'CMS-03B-04',
    'POST',
    '/api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore',
  ],
  ['CMS-03B-10', 'POST', '/api/v1/cms/entries'],
  ['CMS-03B-11', 'GET', '/api/v1/cms/entries/{entryId}'],
  ['CMS-03B-12', 'GET', '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}'],
  ['CMS-03B-13', 'GET', '/api/v1/cms/entries'],
  ['CMS-03B-14', 'GET', '/api/v1/cms/entries/authoring-context'],
] as const;

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

const revisionErrors = {
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

describe('cms editorial route registry', () => {
  it('registers exactly the nine locked operations and method/path pairs', () => {
    // Slice 11 (DEC-148) appends its nine operations after these nine rows;
    // routes-slice11.test.ts asserts the full eighteen-row registry.
    expect(
      cmsEditorialRoutePolicies
        .slice(0, expected.length)
        .map(({ operationId, method, path }) => [operationId, method, path]),
    ).toEqual(expected);
  });

  it('binds CMS-03B-01 to its revision schemas, 201, and the Tier 2 SLO', () => {
    expect(route.requestSchema).toBe('EntryRevisionRequestSchema');
    expect(route.pathParamsSchema).toBe('EntryRevisionPathParamsSchema');
    expect(route.headersSchema).toBe('EntryRevisionHeadersSchema');
    expect(route.successSchema).toBe('EntryRevisionResourceSchema');
    expect(route.successStatus).toBe(201);
    expect(route.outcome).toBe('created');
    expect(route.etag).toBe('strong');
    expect(route.location).toBe('required');
    expect(route.auth).toBe('editorial_author');
    expect(route.capabilities).toEqual(['cms.author', 'cms.editor']);
    expect(route.capabilityMode).toBe('any_of');
    expect(route).not.toHaveProperty('capability');
    expect(route.csrf).toBe('required');
    expect(route.idempotency).toBe('required');
    expect(route.ifMatch).toBe('required');
    expect(route.maxBodyBytes).toBe(262_144);
    expect(route.cacheControl).toBe('no-store');
    expect(route.rateClass).toBe('cms-entry-write');
    expect(route.rateLimit).toBe(120);
    expect(route.partyRateLimit).toBe(240);
    expect(route.timeoutMs).toBe(15_000);
    expect(route.responseTargetMs).toBe(2_000);
    expect(route.slo).toEqual(tier2Slo);
    expect(route.errors).toEqual(revisionErrors);
    expect(route.eventType).toBe('cms.entry.revision-created.v1');
  });

  it('grants CMS-03B-01 to author OR editor with explicit any-of semantics', () => {
    expect(
      cmsEditorialCapabilitiesSatisfied(
        route.capabilities,
        route.capabilityMode,
        ['cms.author'],
      ),
    ).toBe(true);
    expect(
      cmsEditorialCapabilitiesSatisfied(
        route.capabilities,
        route.capabilityMode,
        ['cms.editor'],
      ),
    ).toBe(true);
    expect(
      cmsEditorialCapabilitiesSatisfied(
        route.capabilities,
        route.capabilityMode,
        ['cms.reviewer'],
      ),
    ).toBe(false);
  });

  it('guards route count and operation identity at runtime', () => {
    expect(assertCmsEditorialRouteRegistry(cmsEditorialRoutePolicies)).toBe(
      cmsEditorialRoutePolicies,
    );
    expect(() => assertCmsEditorialRouteRegistry([])).toThrow(/route count/u);
    expect(() =>
      assertCmsEditorialRouteRegistry([
        route,
        route,
      ] as unknown as typeof cmsEditorialRoutePolicies),
    ).toThrow(/Duplicate cms editorial operation/u);
    expect(() =>
      assertCmsEditorialRouteRegistry([
        { ...route, operationId: 'CMS-03B-07' },
        route,
      ] as unknown as typeof cmsEditorialRoutePolicies),
    ).toThrow(/Duplicate cms editorial route/u);
    // One row with a non-member id swapped in: count and uniqueness hold, so
    // only the missing-operation check can fail. (Slice 11 made CMS-03B-07 a
    // member, so a still-unassigned id stands in for the non-member.)
    expect(() =>
      assertCmsEditorialRouteRegistry([
        { ...route, operationId: 'CMS-03B-99' },
        ...cmsEditorialRoutePolicies.slice(1),
      ] as unknown as typeof cmsEditorialRoutePolicies),
    ).toThrow(/Missing cms editorial operation/u);
  });

  it('keeps every command row on headers and every read row on query', () => {
    // The nine Slice 10 rows; the Slice 11 commands and reads are asserted in
    // routes-slice11.test.ts (they add step-up, 202/200 outcomes and new classes).
    const slice10Rows = cmsEditorialRoutePolicies.slice(0, expected.length);
    const commandRows = slice10Rows.filter(({ method }) => method === 'POST');
    const readRows = slice10Rows.filter(({ method }) => method === 'GET');
    expect(commandRows).toHaveLength(4);
    expect(readRows).toHaveLength(5);
    for (const candidate of commandRows) {
      expect('headersSchema' in candidate).toBe(true);
      expect('querySchema' in candidate).toBe(false);
      expect(candidate.idempotency).toBe('required');
    }
    for (const candidate of readRows) {
      expect('querySchema' in candidate).toBe(true);
      expect('headersSchema' in candidate).toBe(false);
      expect(candidate.idempotency).toBe('none');
      expect(candidate.ifMatch).toBe('none');
    }
    // Create is the single command with no prior version to match.
    expect(
      commandRows
        .filter(({ ifMatch }) => ifMatch === 'none')
        .map(({ operationId }) => operationId),
    ).toEqual(['CMS-03B-10']);
    expect(Object.keys(createRoute.errors)).toHaveLength(12);
    expect(Object.keys(detailRoute.errors)).toHaveLength(11);
  });

  it('enforces the nine-operation discriminants', () => {
    for (const candidate of cmsEditorialRoutePolicies)
      expect(policyShapeSchema.safeParse(candidate).success).toBe(true);
    const readRow = {
      operationId: 'CMS-03B-11',
      method: 'GET',
      path: '/api/v1/cms/entries/{entryId}',
      requestSchema: 'EntryDraftDetailQuerySchema',
      successSchema: 'EntryDraftDetailResourceSchema',
      successStatus: 200,
      outcome: 'read',
      rateClass: 'cms-entry-read',
      timeoutMs: 8_000,
      eventType: 'none',
    };
    expect(policyShapeSchema.safeParse(readRow).success).toBe(true);
    expect(
      policyShapeSchema.safeParse({ ...readRow, rateClass: 'cms-entry-write' })
        .success,
    ).toBe(false);
    expect(
      policyShapeSchema.safeParse({ ...readRow, timeoutMs: 15_000 }).success,
    ).toBe(false);
    const { eventType: _eventType, ...withoutEventType } = readRow;
    void _eventType;
    expect(policyShapeSchema.safeParse(withoutEventType).success).toBe(false);
    expect(
      policyShapeSchema.safeParse({ ...readRow, method: 'PUT' }).success,
    ).toBe(false);
    expect(
      policyShapeSchema.safeParse({ ...readRow, successStatus: 202 }).success,
    ).toBe(false);
    expect(
      policyShapeSchema.safeParse({ ...readRow, operationId: 'CMS-03B-09' })
        .success,
    ).toBe(false);
    expect(
      policyShapeSchema.safeParse({
        ...readRow,
        eventType: 'cms.entry.review-changed.v1',
      }).success,
    ).toBe(false);
    expect(
      policyShapeSchema.safeParse({
        ...readRow,
        operationId: 'CMS-03B-03',
        path: '/api/v1/cms/entries/{entryId}/revisions',
        requestSchema: 'RevisionHistoryQuerySchema',
        successSchema: 'RevisionHistoryPageSchema',
      }).success,
    ).toBe(true);
  });
});

describe('CMS-03B-10 entry create route row', () => {
  it('binds create schemas, 201, a strong ETag, and Location', () => {
    expect(createRoute.method).toBe('POST');
    expect(createRoute.path).toBe('/api/v1/cms/entries');
    expect(createRoute.requestSchema).toBe('EntryCreateRequestSchema');
    expect(createRoute.headersSchema).toBe('EntryCreateHeadersSchema');
    expect(createRoute.successSchema).toBe('EntryCreateResourceSchema');
    expect(createRoute.successStatus).toBe(201);
    expect(createRoute.etag).toBe('strong');
    expect(createRoute.location).toBe('required');
  });

  it('requires Idempotency-Key, never If-Match, and the Tier 2 command SLO', () => {
    expect(createRoute.auth).toBe('editorial_author');
    expect(createRoute.capabilities).toEqual(['cms.author', 'cms.editor']);
    expect(createRoute.capabilityMode).toBe('any_of');
    expect(createRoute.idempotency).toBe('required');
    expect(createRoute.ifMatch).toBe('none');
    expect(createRoute.rateClass).toBe('cms-entry-write');
    expect(createRoute.rateLimit).toBe(120);
    expect(createRoute.timeoutMs).toBe(15_000);
    expect(createRoute.slo).toEqual(tier2Slo);
  });

  it('emits exactly one revision-created event and keeps the 409 conflict', () => {
    expect(createRoute.eventType).toBe('cms.entry.revision-created.v1');
    expect(createRoute.errors).toEqual(editorialEntryCreateErrors);
    expect(editorialEntryCreateErrors.CONFLICT).toBe(409);
  });
});

describe('CMS-03B-11 draft detail route row', () => {
  it('binds the query read, 200, and a strong no-store ETag without Location', () => {
    expect(detailRoute.method).toBe('GET');
    expect(detailRoute.path).toBe('/api/v1/cms/entries/{entryId}');
    expect(detailRoute.requestSchema).toBe('EntryDraftDetailQuerySchema');
    expect(detailRoute.querySchema).toBe('EntryDraftDetailQuerySchema');
    expect(detailRoute.successSchema).toBe('EntryDraftDetailResourceSchema');
    expect(detailRoute.successStatus).toBe(200);
    expect(detailRoute.etag).toBe('strong');
    expect(detailRoute.location).toBe('none');
  });

  it('accepts no mutation guard and reuses the Tier 1 read SLO', () => {
    expect(detailRoute.auth).toBe('editorial_reader');
    expect(detailRoute.csrf).toBe('none');
    expect(detailRoute.idempotency).toBe('none');
    expect(detailRoute.ifMatch).toBe('none');
    expect(detailRoute.rateClass).toBe('cms-entry-read');
    expect(detailRoute.rateLimit).toBe(300);
    expect(detailRoute.timeoutMs).toBe(8_000);
    expect(detailRoute.slo).toEqual(tier1Slo);
  });

  it('declares no event and drops the 409 the read cannot produce', () => {
    expect(detailRoute.eventType).toBe('none');
    expect(detailRoute.errors).toEqual(editorialDraftDetailErrors);
    expect(detailRoute.errors).not.toHaveProperty('CONFLICT');
    expect(editorialRevisionErrors.CONFLICT).toBe(409);
  });
});
