import { createProductionCmsRelatedContentDependencies } from './cms-composition-production-related';
import type { CmsRelatedContentPortInput } from './cms-composition/related-content-routes';
import {
  environment,
  PARTY_ID,
  REQUEST_ID,
  USER_ID,
} from './cms-editorial-production.test-support';

export const entryId = '10000000-0000-4000-8000-000000000001';
export const pinA = '20000000-0000-4000-8000-000000000002';
export const pinB = '20000000-0000-4000-8000-000000000003';
export const excluded = '30000000-0000-4000-8000-000000000004';
export const path = `/api/v1/cms/entries/${entryId}/related-content`;
export const RPC =
  'https://supabase.example.test/rest/v1/rpc/cms_curate_related_content';

export const portInput = (
  overrides: Partial<CmsRelatedContentPortInput> = {},
): CmsRelatedContentPortInput => ({
  operationId: 'CMS-03C-05',
  request: new Request(`https://api.example.test${path}`, {
    headers: { 'x-correlation-id': REQUEST_ID },
  }),
  requestId: REQUEST_ID,
  session: {
    userId: USER_ID,
    actingPartyId: PARTY_ID,
    capabilities: ['cms.author'],
    mfaFresh: false,
  },
  path: { entryId },
  body: {
    entryId,
    pins: [pinA, pinB],
    exclusions: [excluded],
    derivedRule: {
      key: 'shared-terms',
      version: '1',
      reasonCode: 'shared_terms',
      maxCandidates: 8,
    },
    expectedVersion: '1',
  },
  idempotencyKey: 'related-content-0001',
  ifMatch: '1',
  ...overrides,
});

export const resource = {
  id: entryId,
  version: '2',
  contentHash: 'b'.repeat(64),
  createdAt: '2026-10-14T12:00:00Z',
  updatedAt: '2026-10-14T12:00:00Z',
  state: 'active',
  sourceEntryId: entryId,
  pins: [pinA, pinB],
  exclusions: [excluded],
  derivedRule: { key: 'shared-terms', version: '1' },
  eligibleCount: 9,
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
export const raised = (
  message: string,
  details: string | null = null,
  status = 400,
  code = 'P0001',
) => json({ code, message, details, hint: null }, status);

export const create = (fetchImpl: typeof fetch, extra: object = {}) =>
  createProductionCmsRelatedContentDependencies({
    environment,
    fetchImpl,
    humanOrigins: ['https://cms.example.test'],
    now: () => 1_000,
    resolveSession: async () => ({ ok: true, value: portInput().session }),
    rateLimit: async (input) => ({
      ok: true,
      value: {
        allowed: true,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: 2_000,
      },
    }),
    ...extra,
  });
export const routeRequest = () =>
  new Request(`https://api.example.test${path}`, {
    method: 'POST',
    headers: {
      origin: 'https://cms.example.test',
      'content-type': 'application/json',
      'idempotency-key': 'related-content-0001',
      'if-match': '"1"',
      'x-request-id': REQUEST_ID,
    },
    body: JSON.stringify(portInput().body),
  });
export const signal = () => new AbortController().signal;
export const act = (
  fetchImpl: typeof fetch,
  overrides: Partial<CmsRelatedContentPortInput> = {},
) => create(fetchImpl).actRelatedContent(portInput(overrides), signal());
