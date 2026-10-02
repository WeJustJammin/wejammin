import { RequestContextSchema } from '@wejammin/contracts';

import type { WorkerBindings } from '../index';
import { normalizeAuthProductionOptions } from '../authentication/production-configuration';
import type { AuthenticationSession } from '../authentication/types';
import type { ReleasePrincipal } from './types';
import {
  DEFAULT_DEADLINE_MS,
  MAX_DEFAULT_RESPONSE_BYTES,
  type ProductionConfiguration,
} from './production-types';

export const USER_ID = '10000000-0000-4000-8000-000000000001';
export const PARTY_ID = '20000000-0000-4000-8000-000000000002';
export const SESSION_ID = '30000000-0000-4000-8000-000000000003';
export const PERSON_ID = '40000000-0000-4000-8000-000000000004';
export const ACTING_CONTEXT_ID = '90000000-0000-4000-8000-000000000009';
export const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const CORRELATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const NONCE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const HASH = 'a'.repeat(64);
export const STEP_UP_AT = '2026-09-02T11:55:00.000Z';
export const NOW = Date.parse('2026-09-02T12:00:00.000Z');

export const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'private-context-coverage',
  SUPABASE_SECRET_KEY: 'sb_secret_private_context_coverage',
  SUPABASE_URL: 'https://supabase.example.test',
};

export const newRequest = (): Request =>
  new Request('https://api.example.test/api/v1/cms/content-types', {
    headers: {
      'x-request-id': REQUEST_ID,
      'x-correlation-id': CORRELATION_ID,
    },
  });

export const requestContext = RequestContextSchema.parse({
  requestId: REQUEST_ID,
  correlationId: CORRELATION_ID,
  causationId: null,
  traceId: `worker-${REQUEST_ID}`,
  userId: USER_ID,
  actingPartyId: PARTY_ID,
  capabilities: ['cms.schema_registry.read'],
  locale: 'en-US',
  clientVersion: 'private-context-coverage',
});

export const authSession = (
  overrides: Partial<AuthenticationSession> = {},
): AuthenticationSession =>
  ({
    authUserId: USER_ID,
    sessionId: SESSION_ID,
    accountState: 'active',
    personId: PERSON_ID,
    actingPartyId: PARTY_ID,
    expiresAt: '2099-01-01T00:00:00.000Z',
    stepUpAt: STEP_UP_AT,
    ...overrides,
  }) as AuthenticationSession;

export const withoutPrivateBinding = (
  session: AuthenticationSession,
): AuthenticationSession => {
  const copy = { ...session } as unknown as Record<string, unknown>;
  delete copy.actingContextId;
  return copy as unknown as AuthenticationSession;
};

export const configuration: ProductionConfiguration = {
  auth: normalizeAuthProductionOptions({ environment }),
  deadlineMs: DEFAULT_DEADLINE_MS,
  maxResponseBytes: MAX_DEFAULT_RESPONSE_BYTES,
  now: () => NOW,
};

export const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const releasePrincipal: ReleasePrincipal = {
  principalId: 'release-worker-01',
  keyId: 'release-key-01',
  capabilities: ['release.block_registry.write'],
  verifiedAt: '2026-09-02T12:00:00.000Z',
  rawBodyHash: HASH,
  signatureHash: HASH,
  nonceHash: HASH,
};

export const releaseHeaders = {
  keyId: releasePrincipal.keyId,
  issuedAt: '2026-09-02T12:00:00.000Z',
  nonce: NONCE,
  signature: 'A'.repeat(86) + '==',
} as const;

export const rpcName = (input: string | URL | Request): string =>
  new URL(String(input)).pathname.split('/').at(-1) ?? '';
