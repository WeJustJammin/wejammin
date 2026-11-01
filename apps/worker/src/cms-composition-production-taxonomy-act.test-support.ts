import type { TaxonomyTermActionRequest } from '@wejammin/contracts';
import { vi } from 'vitest';

import type { AuthenticationSession } from './authentication/types';
import type { CmsEditorialProductionOptions } from './cms-editorial-production-types';
import { createProductionCmsTaxonomyDependencies } from './cms-composition-production-taxonomy';
import { createCmsTaxonomyApp } from './cms-composition/taxonomy-routes';
import type { WorkerBindings } from './index';

/** CMS-03C-03 production adapter harness: real session resolver, real route, stubbed transport. */
export const ACT_ORIGIN = 'https://cms.example.test';
export const ACT_REQUEST_ID = '11111111-1111-4111-8111-111111111111';
export const ACT_TAXONOMY_ID = '22222222-2222-4222-8222-222222222222';
export const ACT_TERM_ID = '55555555-5555-4555-8555-555555555555';
export const ACT_PARENT_ID = '66666666-6666-4666-8666-666666666666';
export const ACT_PATH = `/api/v1/cms/taxonomies/${ACT_TAXONOMY_ID}/terms/actions`;

export const actEnvironment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-12-taxonomy-terms-worker',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://supabase.example.test',
};

export const actAuthentication: AuthenticationSession = {
  authUserId: '33333333-3333-4333-8333-333333333333',
  sessionId: '77777777-7777-4777-8777-777777777777',
  accountState: 'active',
  personId: '88888888-8888-4888-8888-888888888888',
  actingPartyId: '44444444-4444-4444-8444-444444444444',
  expiresAt: '2026-10-13T00:00:00Z',
  stepUpAt: null,
};

export const actBody = (
  overrides: Partial<TaxonomyTermActionRequest> = {},
): TaxonomyTermActionRequest => ({
  taxonomyId: ACT_TAXONOMY_ID,
  action: 'create',
  termKey: 'jazz-fusion',
  parentId: null,
  survivorId: null,
  labels: [{ locale: 'en-US', label: 'Jazz fusion' }],
  aliases: ['fusion'],
  expectedVersion: '7',
  ...overrides,
});

export const actRequest = (
  body: TaxonomyTermActionRequest = actBody(),
  headers: Record<string, string> = {},
): RequestInit => ({
  method: 'POST',
  headers: {
    origin: ACT_ORIGIN,
    'content-type': 'application/json',
    'idempotency-key': 'taxonomy-action-0001',
    'if-match': `"${body.expectedVersion}"`,
    'x-request-id': ACT_REQUEST_ID,
    ...headers,
  },
  body: JSON.stringify(body),
});

/** The strict `TaxonomyTermResource` the term producer answers for a create. */
export const termAnswer = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id: ACT_TERM_ID,
  version: '1',
  contentHash: 'a'.repeat(64),
  createdAt: '2026-10-14T04:00:00.000Z',
  updatedAt: '2026-10-14T04:00:00.000Z',
  lifecycle: 'active',
  taxonomyId: ACT_TAXONOMY_ID,
  termId: ACT_TERM_ID,
  termKey: 'jazz-fusion',
  parentId: null,
  successorId: null,
  ...overrides,
});

export const createActHarness = (
  fetchImpl: typeof fetch,
  overrides: Partial<CmsEditorialProductionOptions> = {},
) => {
  const auth = {
    resolveSession: vi.fn(async () => ({
      ok: true as const,
      value: actAuthentication,
    })),
  };
  const options: CmsEditorialProductionOptions = {
    environment: actEnvironment,
    fetchImpl,
    auth,
    resolveCapabilities: ['cms.taxonomy_curator'],
    humanOrigins: [ACT_ORIGIN],
    now: () => Date.parse('2026-10-12T00:00:00Z'),
    rateLimit: async (input) => ({
      ok: true,
      value: {
        allowed: true,
        limit: input.limit,
        remaining: 1,
        resetAt: 1791763260,
      },
    }),
    ...overrides,
  };
  const dependencies = createProductionCmsTaxonomyDependencies(options);
  const app = createCmsTaxonomyApp(dependencies);
  return {
    auth,
    options,
    dependencies,
    request: (init: RequestInit = actRequest(), path = ACT_PATH) =>
      app.request(`https://api.example.test${path}`, init),
  };
};
