import { expect, vi } from 'vitest';

import type { WorkerBindings } from './index';
import { createProductionCmsEditorialDependencies } from './cms-editorial-production';
import type { CmsEditorialPortInput } from './cms-editorial-production-session';

/** Shared fixtures for the CMS-03B editorial production adapter tests. */
export const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-10-production',
  SUPABASE_SECRET_KEY: 'sb_secret_slice_10_production',
  SUPABASE_URL: 'https://supabase.example.test///',
};

export const USER_ID = '10000000-0000-4000-8000-000000000001';
export const PARTY_ID = '20000000-0000-4000-8000-000000000002';
export const ENTRY_ID = '30000000-0000-4000-8000-000000000003';
export const REVISION_ID = '40000000-0000-4000-8000-000000000004';
export const SCHEMA_VERSION_ID = '50000000-0000-4000-8000-000000000005';
export const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const CORRELATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const HASH = 'a'.repeat(64);

/** A payload that satisfies the strict `EntryRevisionResourceSchema`. */
export const revisionResource = {
  id: REVISION_ID,
  version: '1',
  entryVersion: '2',
  createdAt: '2026-09-26T00:00:00Z',
  updatedAt: '2026-09-26T00:00:00Z',
  state: 'draft',
  entryId: ENTRY_ID,
  revisionNumber: '1',
  schemaVersionId: SCHEMA_VERSION_ID,
  templateVersionId: null,
  taxonomyVersionIds: [],
  locale: 'en-US',
  contentHash: HASH,
  parentRevisionIds: [],
  validationState: 'valid',
  conflictId: null,
};

export const request = (): Request =>
  new Request('https://api.example.test/api/v1/cms/entries/' + ENTRY_ID, {
    headers: {
      'x-request-id': REQUEST_ID,
      'x-correlation-id': CORRELATION_ID,
    },
  });

export const json = (
  value: unknown,
  status = 200,
  headers?: HeadersInit,
): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

export const portInput = (
  overrides: Record<string, unknown> = {},
): CmsEditorialPortInput => ({
  operationId: 'CMS-03B-01',
  requestId: REQUEST_ID,
  request: request(),
  session: {
    userId: USER_ID,
    actingPartyId: PARTY_ID,
    capabilities: ['cms.author'],
    mfaFresh: true,
  },
  path: { entryId: ENTRY_ID },
  body: {
    entryId: ENTRY_ID,
    baseRevision: '1',
    changedPaths: [`/fields/${SCHEMA_VERSION_ID}`],
    values: { [SCHEMA_VERSION_ID]: 'hello' },
    locale: 'en-US',
    expectedVersion: '1',
  },
  idempotencyKey: 'idem-'.padEnd(24, 'x'),
  // The route strips the strong-ETag quotes and hands the port a bare decimal.
  ifMatch: '1',
  ...overrides,
});

export const compose = (
  fetchImpl: typeof fetch,
  overrides: Record<string, unknown> = {},
) =>
  createProductionCmsEditorialDependencies({
    environment,
    fetchImpl,
    humanOrigins: ['https://cms.example.test'],
    ...overrides,
  });

/** Capture the single request the adapter issued to the RPC transport. */
export const captureInit = (
  mock: ReturnType<typeof vi.fn>,
): Readonly<{ url: string; init: RequestInit }> => {
  const call = mock.mock.calls[0] as unknown as
    readonly [string, RequestInit] | undefined;
  if (call === undefined) throw new Error('no captured RPC request');
  return { url: call[0], init: call[1] };
};

export { expect, vi };
