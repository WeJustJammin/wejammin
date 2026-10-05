import { describe, expect, it } from 'vitest';

import {
  AuthoringContextApiRequestSchema,
  ConflictDetailApiRequestSchema,
  EntryListApiRequestSchema,
  assertCmsEditorialRouteRegistry,
  cmsEditorialRoutePolicies,
  editorialAuthoringContextErrors,
  editorialConflictDetailErrors,
  editorialDraftDetailErrors,
  editorialEntryListErrors,
  policyShapeSchema,
} from './index';
import { platformRegistrySet } from '../platform-registries.ts';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';

const tier1Slo = {
  tier: 1,
  commandP95Ms: 750,
  protectedRpcP95Ms: 300,
  acceptanceP99Ms: 1_000,
} as const;

/** The nine locked operation rows in registry order. */
const expectedOrder = [
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

const byOperation = (operationId: string) => {
  const found = cmsEditorialRoutePolicies.find(
    (policy) => policy.operationId === operationId,
  );
  if (found === undefined)
    throw new Error('Missing cms editorial operation: ' + operationId);
  return found;
};

const conflictDetailRoute = byOperation('CMS-03B-12');
const entryListRoute = byOperation('CMS-03B-13');
const authoringContextRoute = byOperation('CMS-03B-14');

const readErrorShape = {
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

const forbiddenOwnership = [
  'ownerId',
  'partyId',
  'actingPartyId',
  'createdByPersonId',
] as const;

describe('supplemental cms editorial route registry', () => {
  it('registers exactly the nine locked operations in order', () => {
    expect(
      cmsEditorialRoutePolicies.map(({ operationId, method, path }) => [
        operationId,
        method,
        path,
      ]),
    ).toEqual(expectedOrder);
  });

  it('keeps every row method+path unique and operation id unique', () => {
    expect(assertCmsEditorialRouteRegistry(cmsEditorialRoutePolicies)).toBe(
      cmsEditorialRoutePolicies,
    );
    const methodPaths = cmsEditorialRoutePolicies.map(
      ({ method, path }) => method + ' ' + path,
    );
    expect(new Set(methodPaths).size).toBe(methodPaths.length);
    const operationIds = cmsEditorialRoutePolicies.map(
      ({ operationId }) => operationId,
    );
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it('binds CMS-03B-12 to the conflict-detail read contracts', () => {
    expect(conflictDetailRoute.method).toBe('GET');
    expect(conflictDetailRoute.path).toBe(
      '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}',
    );
    expect(conflictDetailRoute.requestSchema).toBe('ConflictDetailQuerySchema');
    expect(conflictDetailRoute.pathParamsSchema).toBe(
      'ConflictDetailPathParamsSchema',
    );
    expect(conflictDetailRoute.querySchema).toBe('ConflictDetailQuerySchema');
    expect(conflictDetailRoute.successSchema).toBe(
      'ConflictDetailResourceSchema',
    );
  });

  it('binds CMS-03B-13 to the entry-list read contracts without path params', () => {
    expect(entryListRoute.method).toBe('GET');
    expect(entryListRoute.path).toBe('/api/v1/cms/entries');
    expect(entryListRoute.requestSchema).toBe('EntryListQuerySchema');
    expect(entryListRoute.querySchema).toBe('EntryListQuerySchema');
    expect(entryListRoute.successSchema).toBe('EntryListPageSchema');
    expect('pathParamsSchema' in entryListRoute).toBe(false);
  });

  it('binds CMS-03B-14 to the authoring-context read without path params', () => {
    expect(authoringContextRoute.method).toBe('GET');
    expect(authoringContextRoute.path).toBe(
      '/api/v1/cms/entries/authoring-context',
    );
    expect(authoringContextRoute.requestSchema).toBe(
      'AuthoringContextQuerySchema',
    );
    expect(authoringContextRoute.querySchema).toBe(
      'AuthoringContextQuerySchema',
    );
    expect(authoringContextRoute.successSchema).toBe(
      'AuthoringContextResourceSchema',
    );
    expect('pathParamsSchema' in authoringContextRoute).toBe(false);
  });

  it('gives all three reads the exact locked read policy fields', () => {
    for (const route of [
      conflictDetailRoute,
      entryListRoute,
      authoringContextRoute,
    ]) {
      expect(route.successStatus).toBe(200);
      expect(route.outcome).toBe('read');
      expect(route.etag).toBe('strong');
      expect(route.location).toBe('none');
      expect(route.auth).toBe('editorial_reader');
      expect(route.capabilities).toEqual(['cms.author', 'cms.editor']);
      expect(route.capabilityMode).toBe('any_of');
      expect(route.audience).toBe('browser');
      expect(route.cors).toBe('cms-console');
      expect(route.csrf).toBe('none');
      expect(route.rawBodySignature).toBe('none');
      expect(route.idempotency).toBe('none');
      expect(route.ifMatch).toBe('none');
      expect(route.maxBodyBytes).toBe(262_144);
      expect(route.rateClass).toBe('cms-entry-read');
      expect(route.rateLimit).toBe(300);
      expect(route.partyRateLimit).toBe(600);
      expect(route.rateWindowSeconds).toBe(60);
      expect(route.rateScope).toBe('user');
      expect(route.timeoutMs).toBe(8_000);
      expect(route.responseTargetMs).toBe(750);
      expect(route.cacheControl).toBe('no-store');
      expect(route.slo).toEqual(tier1Slo);
      expect(route.eventType).toBe('none');
      expect(route).not.toHaveProperty('capability');
      expect(route).not.toHaveProperty('headersSchema');
    }
  });

  it('uses bounded safe read errors with no CONFLICT on every new row', () => {
    expect(conflictDetailRoute.errors).toBe(editorialConflictDetailErrors);
    expect(entryListRoute.errors).toBe(editorialEntryListErrors);
    expect(authoringContextRoute.errors).toBe(editorialAuthoringContextErrors);
    for (const errors of [
      editorialConflictDetailErrors,
      editorialEntryListErrors,
      editorialAuthoringContextErrors,
    ]) {
      expect(errors).toEqual(readErrorShape);
      expect(errors).toEqual(editorialDraftDetailErrors);
      expect(errors).not.toHaveProperty('CONFLICT');
      expect(Object.keys(errors)).toHaveLength(11);
      expect(errors.UNSUPPORTED_MEDIA_TYPE).toBe(415);
    }
  });

  it('passes the read discriminants and the full policy shape guard', () => {
    for (const route of [
      conflictDetailRoute,
      entryListRoute,
      authoringContextRoute,
    ])
      expect(policyShapeSchema.safeParse(route).success).toBe(true);
  });

  it('accepts no ownership authority anywhere on the new rows', () => {
    for (const route of [
      conflictDetailRoute,
      entryListRoute,
      authoringContextRoute,
    ]) {
      for (const key of forbiddenOwnership)
        expect(route).not.toHaveProperty(key);
      // The read gate is a capability, never an ownership assertion.
      expect(route.capabilities).toEqual(['cms.author', 'cms.editor']);
      expect(JSON.stringify(route)).not.toMatch(/ownerId|actingPartyId/iu);
    }
  });
});

describe('supplemental read ApiRequest wrappers', () => {
  it('accepts the canonical conflict-detail request envelope', () => {
    expect(
      ConflictDetailApiRequestSchema.safeParse({
        entryId: uuid,
        conflictId: uuid2,
        query: {},
      }).success,
    ).toBe(true);
  });

  it('requires both conflict-detail path UUIDs and an explicit empty query', () => {
    expect(
      ConflictDetailApiRequestSchema.safeParse({ query: {} }).success,
    ).toBe(false);
    expect(
      ConflictDetailApiRequestSchema.safeParse({
        entryId: uuid,
        query: {},
      }).success,
    ).toBe(false);
    expect(
      ConflictDetailApiRequestSchema.safeParse({
        entryId: 'not-a-uuid',
        conflictId: uuid2,
        query: {},
      }).success,
    ).toBe(false);
    expect(
      ConflictDetailApiRequestSchema.safeParse({
        entryId: uuid,
        conflictId: uuid2,
      }).success,
    ).toBe(false);
  });

  it('refuses unknown keys and query selectors on the conflict-detail wrapper', () => {
    expect(
      ConflictDetailApiRequestSchema.safeParse({
        entryId: uuid,
        conflictId: uuid2,
        query: {},
        extra: 1,
      }).success,
    ).toBe(false);
    expect(
      ConflictDetailApiRequestSchema.safeParse({
        entryId: uuid,
        conflictId: uuid2,
        query: { include: 'values' },
      }).success,
    ).toBe(false);
  });

  it('accepts the canonical entry-list request envelope', () => {
    expect(EntryListApiRequestSchema.safeParse({ query: {} }).success).toBe(
      true,
    );
    expect(
      EntryListApiRequestSchema.safeParse({
        query: { limit: 25, state: 'draft', contentTypeId: uuid },
      }).success,
    ).toBe(true);
  });

  it('refuses unknown keys and ownership selectors on the entry-list wrapper', () => {
    expect(EntryListApiRequestSchema.safeParse({}).success).toBe(false);
    expect(
      EntryListApiRequestSchema.safeParse({ query: {}, extra: 1 }).success,
    ).toBe(false);
    for (const key of forbiddenOwnership)
      expect(
        EntryListApiRequestSchema.safeParse({
          query: { [key]: uuid },
        }).success,
      ).toBe(false);
  });

  it('accepts the canonical authoring-context request envelope', () => {
    expect(
      AuthoringContextApiRequestSchema.safeParse({ query: {} }).success,
    ).toBe(true);
    expect(
      AuthoringContextApiRequestSchema.safeParse({
        query: { contentTypeVersionId: uuid },
      }).success,
    ).toBe(true);
  });

  it('refuses unknown keys and ownership selectors on the authoring-context wrapper', () => {
    expect(AuthoringContextApiRequestSchema.safeParse({}).success).toBe(false);
    expect(
      AuthoringContextApiRequestSchema.safeParse({ query: {}, extra: 1 })
        .success,
    ).toBe(false);
    for (const key of forbiddenOwnership)
      expect(
        AuthoringContextApiRequestSchema.safeParse({
          query: { [key]: uuid },
        }).success,
      ).toBe(false);
  });
});

describe('supplemental platformRegistrySet rows', () => {
  it('adds the three supplemental reads in order after CMS-03B-11', () => {
    const operationIds = platformRegistrySet.routes.map(
      ({ operationId }) => operationId,
    );
    const start = operationIds.indexOf('CMS-03B-11');
    expect(operationIds.slice(start, start + 4)).toEqual([
      'CMS-03B-11',
      'CMS-03B-12',
      'CMS-03B-13',
      'CMS-03B-14',
    ]);
  });

  it('keeps the platform route registry method+path and operation ids unique', () => {
    const methodPaths = platformRegistrySet.routes.map(
      ({ method, path }) => method + ' ' + path,
    );
    expect(new Set(methodPaths).size).toBe(methodPaths.length);
    const operationIds = platformRegistrySet.routes.map(
      ({ operationId }) => operationId,
    );
    expect(new Set(operationIds).size).toBe(operationIds.length);
  });

  it('registers the CMS-03B-12 platform row with editorial read defaults', () => {
    const row = platformRegistrySet.routes.find(
      ({ operationId }) => operationId === 'CMS-03B-12',
    );
    expect(row).toEqual(
      expect.objectContaining({
        method: 'GET',
        path: '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}',
        authClass: 'editorial_reader',
        capabilities: ['cms.author', 'cms.editor'],
        capabilityMode: 'any_of',
        corsClass: 'cms-console',
        audience: 'browser',
        csrf: 'none',
        rawBodySignature: 'none',
        idempotency: 'none',
        ifMatch: 'none',
        rateClass: 'cms-entry-read',
        rateLimit: 300,
        partyRateLimit: 600,
        rateWindowSeconds: 60,
        rateScope: 'user',
        timeoutMs: 8_000,
        sloTier: 'tier_1',
        owner: 'Editorial',
        cacheControl: 'no-store',
        requestSchema: 'ConflictDetailApiRequestSchema',
        successSchema: 'ConflictDetailResourceSchema',
      }),
    );
    expect(row?.bolaTest).toMatch(/conflict/i);
  });

  it('registers the CMS-03B-13 platform row with editorial read defaults', () => {
    const row = platformRegistrySet.routes.find(
      ({ operationId }) => operationId === 'CMS-03B-13',
    );
    expect(row).toEqual(
      expect.objectContaining({
        method: 'GET',
        path: '/api/v1/cms/entries',
        authClass: 'editorial_reader',
        capabilities: ['cms.author', 'cms.editor'],
        capabilityMode: 'any_of',
        corsClass: 'cms-console',
        audience: 'browser',
        csrf: 'none',
        rawBodySignature: 'none',
        idempotency: 'none',
        ifMatch: 'none',
        rateClass: 'cms-entry-read',
        rateLimit: 300,
        partyRateLimit: 600,
        rateWindowSeconds: 60,
        rateScope: 'user',
        timeoutMs: 8_000,
        sloTier: 'tier_1',
        owner: 'Editorial',
        cacheControl: 'no-store',
        requestSchema: 'EntryListApiRequestSchema',
        successSchema: 'EntryListPageSchema',
      }),
    );
    expect(row?.bolaTest).toMatch(/assigned|owns/i);
  });

  it('registers the CMS-03B-14 platform row with editorial read defaults', () => {
    const row = platformRegistrySet.routes.find(
      ({ operationId }) => operationId === 'CMS-03B-14',
    );
    expect(row).toEqual(
      expect.objectContaining({
        method: 'GET',
        path: '/api/v1/cms/entries/authoring-context',
        authClass: 'editorial_reader',
        capabilities: ['cms.author', 'cms.editor'],
        capabilityMode: 'any_of',
        corsClass: 'cms-console',
        audience: 'browser',
        csrf: 'none',
        rawBodySignature: 'none',
        idempotency: 'none',
        ifMatch: 'none',
        rateClass: 'cms-entry-read',
        rateLimit: 300,
        partyRateLimit: 600,
        rateWindowSeconds: 60,
        rateScope: 'user',
        timeoutMs: 8_000,
        sloTier: 'tier_1',
        owner: 'Editorial',
        cacheControl: 'no-store',
        requestSchema: 'AuthoringContextApiRequestSchema',
        successSchema: 'AuthoringContextResourceSchema',
      }),
    );
    expect(row?.bolaTest).toMatch(/schema|author|acting/i);
  });
});
