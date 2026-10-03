import { vi } from 'vitest';

import { RequestContextSchema } from '@wejammin/contracts';

import type { WorkerBindings } from '../index';
import type { AuthenticationDependencies } from '../authentication/types';

export const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-09-production',
  SUPABASE_SECRET_KEY: 'sb_secret_slice_09_production',
  SUPABASE_URL: 'https://supabase.example.test///',
};

export const USER_ID = '10000000-0000-4000-8000-000000000001';
export const PARTY_ID = '20000000-0000-4000-8000-000000000002';
export const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const CORRELATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const NONCE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const HASH = 'a'.repeat(64);

export const request = new Request(
  'https://api.example.test/api/v1/cms/content-types',
  {
    headers: {
      'x-request-id': REQUEST_ID,
      'x-correlation-id': CORRELATION_ID,
    },
  },
);

export const json = (
  value: unknown,
  status = 200,
  headers?: HeadersInit,
): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

export const rpcName = (input: string | URL | Request): string =>
  new URL(String(input)).pathname.replace(/^.*\//u, '');

export const session = {
  userId: USER_ID,
  actingPartyId: PARTY_ID,
  capabilities: ['cms.schema_designer', 'cms.schema_registry.read'],
  mfaFresh: true,
  stepUpFreshUntil: '2026-09-02T12:05:00.000Z',
} as const;

export const releasePrincipal = {
  principalId: 'release-worker-01',
  keyId: 'release-key-01',
  capabilities: ['release.block_registry.write'],
  verifiedAt: '2026-09-02T12:00:00.000Z',
  rawBodyHash: HASH,
  signatureHash: HASH,
  nonceHash: HASH,
} as const;

export const releaseHeaders = {
  keyId: releasePrincipal.keyId,
  issuedAt: '2026-09-02T12:00:00.000Z',
  nonce: NONCE,
  signature: 'A'.repeat(86) + '==',
} as const;

export const auth = (): Pick<AuthenticationDependencies, 'resolveSession'> => ({
  resolveSession: vi.fn(async () => ({
    ok: true as const,
    value: {
      authUserId: USER_ID,
      sessionId: '30000000-0000-4000-8000-000000000003',
      accountState: 'active' as const,
      personId: '40000000-0000-4000-8000-000000000004',
      actingPartyId: PARTY_ID,
      expiresAt: '2099-09-02T12:00:00.000Z',
      stepUpAt: '2026-09-02T11:55:00.000Z',
    },
  })),
});

export const requestContext = RequestContextSchema.parse({
  requestId: REQUEST_ID,
  correlationId: CORRELATION_ID,
  causationId: null,
  traceId: `worker-${REQUEST_ID}`,
  userId: USER_ID,
  actingPartyId: PARTY_ID,
  capabilities: ['cms.schema_designer', 'cms.schema_registry.read'],
  locale: 'en-US',
  clientVersion: 'worker',
});

export const options = (
  fetchImpl: typeof fetch,
  overrides: Readonly<Record<string, unknown>> = {},
) => ({
  environment,
  fetchImpl,
  auth: auth(),
  resolveRequestContext: vi.fn(async () => requestContext),
  verifyRelease: vi.fn(async () => ({
    ok: true as const,
    value: releasePrincipal,
  })),
  rateLimit: vi.fn(async () => ({
    ok: true as const,
    value: { allowed: true, limit: 20, remaining: 19, resetAt: 1_757_000_000 },
  })),
  humanOrigins: ['https://cms.example.test'],
  releaseOrigins: ['https://release.example.test'],
  ...overrides,
});
