/**
 * Shared harness of the lane-EA editorial evidence tests (`phase-02-slice-10-ev-ea-*.test.ts`):
 * the four CMS-03B operations under test, and the PRODUCTION Hono app wired to the PRODUCTION RPC
 * adapter with only the PostgREST transport, the verified session and the rate limiter supplied.
 */
import type { ServerEnvironment } from '@wejammin/config/environment';

import {
  createCmsEditorialApp,
  type CmsEditorialDependencies,
} from '../../../apps/worker/src/cms-editorial';
import { createProductionCmsEditorialDependencies } from '../../../apps/worker/src/cms-editorial-production';

export const ORIGIN = 'https://cms-console.example.test';
export const USER = '10000000-0000-4000-8000-000000000001';
export const PARTY = '20000000-0000-4000-8000-000000000002';
export const ENTRY = '30000000-0000-4000-8000-000000000003';
export const CONFLICT = '30000000-0000-4000-8000-0000000000c1';
export const REVISION = '40000000-0000-4000-8000-000000000004';
export const CHAIN = '40000000-0000-4000-8000-0000000000c4';
export const FIELD = '60000000-0000-4000-8000-000000000006';
export const LEAK = 'LEAK-secret-dependency-detail';

export type Operation = Readonly<{
  id: string;
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, unknown>;
  ifMatch?: string;
  rpc: string;
}>;

export const OPERATIONS: readonly Operation[] = [
  {
    id: 'CMS-03B-01',
    method: 'POST',
    path: `/api/v1/cms/entries/${ENTRY}/revisions`,
    body: {
      entryId: ENTRY,
      baseRevision: '1',
      changedPaths: [`/fields/${FIELD}`],
      values: { [FIELD]: 'Hello' },
      locale: 'en-US',
      expectedVersion: '1',
    },
    ifMatch: '"1"',
    rpc: 'cms_create_revision',
  },
  {
    id: 'CMS-03B-02',
    method: 'POST',
    path: `/api/v1/cms/entries/${ENTRY}/conflicts/${CONFLICT}/resolve`,
    body: {
      entryId: ENTRY,
      conflictId: CONFLICT,
      baseRevision: '1',
      choices: [{ path: `/fields/${FIELD}`, choice: 'theirs' }],
      expectedVersion: '2',
    },
    ifMatch: '"2"',
    rpc: 'cms_resolve_conflict',
  },
  {
    id: 'CMS-03B-03',
    method: 'GET',
    path: `/api/v1/cms/entries/${ENTRY}/revisions`,
    rpc: 'cms_list_revisions',
  },
  {
    id: 'CMS-03B-04',
    method: 'POST',
    path: `/api/v1/cms/entries/${ENTRY}/revisions/${REVISION}/restore`,
    body: {
      entryId: ENTRY,
      revisionId: REVISION,
      migrationChainId: CHAIN,
      expectedVersion: '2',
    },
    ifMatch: '"2"',
    rpc: 'cms_restore_revision',
  },
];

export const session = {
  userId: USER,
  actingPartyId: PARTY,
  capabilities: ['cms.author', 'cms.editor'],
  mfaFresh: true,
};

export const allow = async (input: { limit: number }) => ({
  ok: true as const,
  value: {
    allowed: true,
    limit: input.limit,
    remaining: input.limit - 1,
    resetAt: Math.floor(Date.now() / 1000) + 60,
  },
});

export const rpcError = (message: string, status = 400): Response =>
  new Response(
    JSON.stringify({ code: 'P0001', message, details: null, hint: null }),
    { status, headers: { 'content-type': 'application/json' } },
  );

export const build = (
  fetchImpl: typeof fetch,
  options: Readonly<{
    rateLimit?: (input: { limit: number }) => Promise<unknown>;
    deadlineMs?: number;
    telemetry?: (event: unknown) => void;
  }> = {},
) => {
  const production = createProductionCmsEditorialDependencies({
    environment: {
      SUPABASE_URL: 'https://supabase.example.test',
      SUPABASE_SECRET_KEY: 'sb_secret_slice_10_production',
      APP_ENVIRONMENT: 'staging',
      APP_RELEASE: 'slice-10-production',
    } as unknown as ServerEnvironment,
    fetchImpl,
    humanOrigins: [ORIGIN],
    resolveSession: async () => ({ ok: true as const, value: session }),
    rateLimit: (options.rateLimit ?? allow) as never,
    ...(options.deadlineMs === undefined
      ? {}
      : { deadlineMs: options.deadlineMs }),
    ...(options.telemetry === undefined
      ? {}
      : { telemetry: options.telemetry as never }),
  });
  return createCmsEditorialApp(
    production as unknown as CmsEditorialDependencies,
  );
};

export const send = (app: ReturnType<typeof build>, operation: Operation) =>
  Promise.resolve(
    app.request(operation.path, {
      method: operation.method,
      headers: {
        origin: ORIGIN,
        'x-request-id': 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        ...(operation.method === 'POST'
          ? {
              'content-type': 'application/json',
              'idempotency-key': 'ev-ea-idempotency-0001',
              'if-match': operation.ifMatch ?? '"1"',
            }
          : {}),
      },
      ...(operation.body === undefined
        ? {}
        : { body: JSON.stringify(operation.body) }),
    }),
  );

export type ErrorBody = Readonly<{
  code: string;
  message: string;
  requestId: string;
  details: Record<string, unknown>;
}>;

export const read = async (response: Response): Promise<ErrorBody> =>
  (await response.json()) as ErrorBody;
