import type {
  RelatedContentResource,
  RelatedContentRuleRequest,
} from '@wejammin/contracts';

import {
  type CmsRelatedContentResult,
  type CmsRelatedContentDependencies,
} from './related-content-routes';

export type CmsRelatedContentPortResult =
  CmsRelatedContentResult<RelatedContentResource>;

import {
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from '../cms-editorial-production.test-support';

export { PARTY_ID, REQUEST_ID, USER_ID };

export const ENTRY_ID = '10000000-0000-4000-8000-000000000001';
export const TARGET_A = '20000000-0000-4000-8000-000000000002';
export const TARGET_B = '30000000-0000-4000-8000-000000000003';
export const PATH = `/api/v1/cms/entries/${ENTRY_ID}/related-content`;
export const body: RelatedContentRuleRequest = {
  entryId: ENTRY_ID,
  pins: [TARGET_A],
  exclusions: [TARGET_B],
  derivedRule: {
    key: 'similar-genre',
    version: '2',
    reasonCode: 'genre_match',
    maxCandidates: 20,
  },
  expectedVersion: '1',
};

export const dependencies = (
  overrides: Partial<CmsRelatedContentDependencies> = {},
): CmsRelatedContentDependencies => ({
  humanOrigins: ['https://cms.example.test'],
  now: () => 1_000,
  resolveSession: async () => ({
    ok: true,
    value: {
      userId: USER_ID,
      actingPartyId: PARTY_ID,
      capabilities: ['cms.author'],
      mfaFresh: true,
    },
  }),
  rateLimit: async (input) => ({
    ok: true,
    value: {
      allowed: true,
      limit: input.limit,
      remaining: input.limit - 1,
      resetAt: 2_000,
    },
  }),
  actRelatedContent: async () => ({
    ok: false,
    status: 503,
    code: 'DEPENDENCY_UNAVAILABLE',
    message: 'curated authority unavailable',
  }),
  telemetry: () => {},
  ...overrides,
});

export const request = (
  headers: Record<string, string> = {},
  payload: RelatedContentRuleRequest | string = body,
) =>
  new Request(`https://api.example.test${PATH}`, {
    method: 'POST',
    headers: {
      origin: 'https://cms.example.test',
      'content-type': 'application/json',
      'idempotency-key': 'related-content-0001',
      'if-match': '"1"',
      'x-request-id': REQUEST_ID,
      ...headers,
    },
    body: JSON.stringify(payload),
  });

/** A contract-valid resource for `body`; pass overrides to mutate fields. */
export const validResource = (
  overrides: Partial<RelatedContentResource> = {},
): RelatedContentResource => ({
  id: ENTRY_ID,
  version: '2',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-09-27T12:00:00Z',
  updatedAt: '2026-09-27T12:00:00Z',
  state: 'active',
  sourceEntryId: ENTRY_ID,
  pins: body.pins,
  exclusions: body.exclusions,
  derivedRule: body.derivedRule
    ? { key: body.derivedRule.key, version: '2' }
    : null,
  eligibleCount: 11,
  ...overrides,
});
