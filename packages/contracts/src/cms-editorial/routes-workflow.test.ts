import { describe, expect, it } from 'vitest';

import {
  cmsEditorialCapabilitiesSatisfied,
  cmsEditorialRoutePolicies,
  editorialConflictResolutionErrors,
  editorialRestoreErrors,
  editorialRevisionHistoryErrors,
} from './index';

const [, conflictRoute, historyRoute, restoreRoute] = cmsEditorialRoutePolicies;

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

describe('CMS-03B-02 conflict resolution route row', () => {
  it('binds its resolve schemas, 201, a strong ETag, and Location', () => {
    expect(conflictRoute.method).toBe('POST');
    expect(conflictRoute.path).toBe(
      '/api/v1/cms/entries/{entryId}/conflicts/{conflictId}/resolve',
    );
    expect(conflictRoute.requestSchema).toBe('ConflictResolutionRequestSchema');
    expect(conflictRoute.pathParamsSchema).toBe(
      'ConflictResolutionPathParamsSchema',
    );
    expect(conflictRoute.headersSchema).toBe('ConflictResolutionHeadersSchema');
    expect(conflictRoute.successSchema).toBe('EntryRevisionResourceSchema');
    expect(conflictRoute.successStatus).toBe(201);
    expect(conflictRoute.outcome).toBe('created');
    expect(conflictRoute.etag).toBe('strong');
    expect(conflictRoute.location).toBe('required');
  });

  it('keeps the author-or-editor any-of gate and both CAS guards', () => {
    expect(conflictRoute.auth).toBe('editorial_author');
    expect(conflictRoute.capabilities).toEqual(['cms.author', 'cms.editor']);
    expect(conflictRoute.capabilityMode).toBe('any_of');
    expect(conflictRoute.csrf).toBe('required');
    expect(conflictRoute.idempotency).toBe('required');
    expect(conflictRoute.ifMatch).toBe('required');
    expect(conflictRoute.timeoutMs).toBe(15_000);
    expect(conflictRoute.responseTargetMs).toBe(2_000);
    expect(conflictRoute.slo).toEqual(tier2Slo);
    expect(conflictRoute.eventType).toBe('cms.entry.revision-created.v1');
  });

  it('uses the distinct conflict rate class and keeps the 409 envelope', () => {
    expect(conflictRoute.rateClass).toBe('cms-entry-conflict');
    expect(conflictRoute.rateLimit).toBe(60);
    expect(conflictRoute.partyRateLimit).toBe(120);
    expect(conflictRoute.rateWindowSeconds).toBe(60);
    expect(conflictRoute.rateScope).toBe('user');
    expect(conflictRoute.cacheControl).toBe('no-store');
    expect(conflictRoute.errors).toEqual(editorialConflictResolutionErrors);
    expect(Object.keys(conflictRoute.errors)).toHaveLength(12);
    expect(editorialConflictResolutionErrors.CONFLICT).toBe(409);
    expect(editorialConflictResolutionErrors.UNSUPPORTED_MEDIA_TYPE).toBe(415);
  });
});

describe('CMS-03B-03 revision history route row', () => {
  it('binds the query read, 200, and a strong no-store ETag without Location', () => {
    expect(historyRoute.method).toBe('GET');
    expect(historyRoute.path).toBe('/api/v1/cms/entries/{entryId}/revisions');
    expect(historyRoute.requestSchema).toBe('RevisionHistoryQuerySchema');
    expect(historyRoute.querySchema).toBe('RevisionHistoryQuerySchema');
    expect(historyRoute.pathParamsSchema).toBe(
      'RevisionHistoryPathParamsSchema',
    );
    expect(historyRoute.successSchema).toBe('RevisionHistoryPageSchema');
    expect(historyRoute.successStatus).toBe(200);
    expect(historyRoute.outcome).toBe('read');
    expect(historyRoute.etag).toBe('strong');
    expect(historyRoute.location).toBe('none');
    expect(historyRoute.cacheControl).toBe('no-store');
  });

  it('adds reviewer read scope and no mutation guard on a safe read', () => {
    expect(historyRoute.auth).toBe('editorial_reader');
    expect(historyRoute.capabilities).toEqual([
      'cms.author',
      'cms.editor',
      'cms.reviewer',
    ]);
    expect(historyRoute.capabilityMode).toBe('any_of');
    expect(
      cmsEditorialCapabilitiesSatisfied(
        historyRoute.capabilities,
        historyRoute.capabilityMode,
        ['cms.reviewer'],
      ),
    ).toBe(true);
    expect(
      cmsEditorialCapabilitiesSatisfied(
        historyRoute.capabilities,
        historyRoute.capabilityMode,
        ['cms.reviewer', 'cms.editor'],
      ),
    ).toBe(true);
    expect(historyRoute.csrf).toBe('none');
    expect(historyRoute.idempotency).toBe('none');
    expect(historyRoute.ifMatch).toBe('none');
  });

  it('uses the read class and Tier 1 SLO while keeping the cursor 409', () => {
    expect(historyRoute.rateClass).toBe('cms-entry-read');
    expect(historyRoute.rateLimit).toBe(300);
    expect(historyRoute.partyRateLimit).toBe(600);
    expect(historyRoute.timeoutMs).toBe(8_000);
    expect(historyRoute.responseTargetMs).toBe(750);
    expect(historyRoute.slo).toEqual(tier1Slo);
    expect(historyRoute.eventType).toBe('none');
    expect(historyRoute.errors).toEqual(editorialRevisionHistoryErrors);
    expect(editorialRevisionHistoryErrors.CONFLICT).toBe(409);
  });
});

describe('CMS-03B-04 revision restore route row', () => {
  it('binds the source revision, 201, a strong ETag, and Location', () => {
    expect(restoreRoute.method).toBe('POST');
    expect(restoreRoute.path).toBe(
      '/api/v1/cms/entries/{entryId}/revisions/{revisionId}/restore',
    );
    expect(restoreRoute.requestSchema).toBe('RevisionRestoreRequestSchema');
    expect(restoreRoute.pathParamsSchema).toBe(
      'RevisionRestorePathParamsSchema',
    );
    expect(restoreRoute.headersSchema).toBe('RevisionRestoreHeadersSchema');
    expect(restoreRoute.successSchema).toBe('EntryRevisionResourceSchema');
    expect(restoreRoute.successStatus).toBe(201);
    expect(restoreRoute.outcome).toBe('created');
    expect(restoreRoute.etag).toBe('strong');
    expect(restoreRoute.location).toBe('required');
  });

  it('shares the command guards and SLO while using the slower write budget', () => {
    expect(restoreRoute.auth).toBe('editorial_author');
    expect(restoreRoute.capabilities).toEqual(['cms.author', 'cms.editor']);
    expect(restoreRoute.capabilityMode).toBe('any_of');
    expect(restoreRoute.csrf).toBe('required');
    expect(restoreRoute.idempotency).toBe('required');
    expect(restoreRoute.ifMatch).toBe('required');
    expect(restoreRoute.rateClass).toBe('cms-entry-write');
    expect(restoreRoute.rateLimit).toBe(30);
    expect(restoreRoute.partyRateLimit).toBe(60);
    expect(restoreRoute.timeoutMs).toBe(15_000);
    expect(restoreRoute.responseTargetMs).toBe(2_000);
    expect(restoreRoute.slo).toEqual(tier2Slo);
    expect(restoreRoute.eventType).toBe('cms.entry.revision-created.v1');
    expect(restoreRoute.errors).toEqual(editorialRestoreErrors);
    expect(Object.keys(restoreRoute.errors)).toHaveLength(12);
    expect(editorialRestoreErrors.CONFLICT).toBe(409);
  });
});
