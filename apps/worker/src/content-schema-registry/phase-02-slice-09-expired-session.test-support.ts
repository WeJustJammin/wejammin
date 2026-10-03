import { vi } from 'vitest';

import { RequestContextSchema } from '@wejammin/contracts';

import type { WorkerBindings } from '../index';
import { createProductionAuthenticationDependencies } from '../authentication/production';
import {
  base64UrlEncode,
  normalizeAuthProductionOptions,
  sealFlowCookie,
} from '../authentication/production-support';
import {
  createContentSchemaRegistryApp,
  createProductionContentSchemaRegistryDependencies,
} from './index';
import { CMS_ORIGIN } from './phase-02-slice-09-dec108-test-values';
import { REQUEST_ID } from './phase-02-slice-09-test-values';

/**
 * The full production session path for the CMS registry: production
 * authentication -> CMS session resolver -> app. Only the PostgREST and
 * Supabase Auth HTTP boundary is faked, so an expired session is produced the
 * way production sees it (token expiry, provider refusal, resolved expiry),
 * never by a stub that answers 401 on request.
 */
export const USER = '22222222-2222-4222-8222-222222222222';
export const PARTY = '20000000-0000-4000-8000-000000000002';
export const SESSION = '33333333-3333-4333-8333-333333333333';
export const PERSON = '40000000-0000-4000-8000-000000000004';
export const NOW = Date.parse('2026-09-01T04:00:00Z');
export const env: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'r12-expired-session',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://staging.example.supabase.co',
};
export const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
export const encoded = (value: unknown) =>
  base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
export const jwt = (overrides: Readonly<Record<string, unknown>> = {}) =>
  `${encoded({ alg: 'RS256' })}.${encoded({
    sub: USER,
    session_id: SESSION,
    iss: `${env.SUPABASE_URL}/auth/v1`,
    aud: 'authenticated',
    exp: Math.floor(NOW / 1000) + 3600,
    ...overrides,
  })}.signature`;
export const reference = (verifier = '') =>
  sealFlowCookie(
    {
      state: SESSION,
      nonce: USER,
      verifier,
      provider: 'session',
      intent: 'session',
      expiresAt: new Date(NOW + 86_400_000).toISOString(),
    },
    normalizeAuthProductionOptions({
      environment: env,
      fetchImpl: vi.fn(),
      now: () => NOW,
      randomBytes: (length) => new Uint8Array(length).fill(4),
    }),
  );
export const context = RequestContextSchema.parse({
  requestId: REQUEST_ID,
  correlationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  causationId: null,
  traceId: `worker-${REQUEST_ID}`,
  userId: USER,
  actingPartyId: PARTY,
  capabilities: ['cms.schema_review'],
  locale: 'en-US',
  clientVersion: 'r12-expired-session',
});

export type Provider = 'valid' | 'jwt-expired-401';

export const build = (
  provider: Provider = 'valid',
  capabilities: readonly string[] = context.capabilities,
) => {
  const fetchImpl = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('/auth/v1/user'))
      return provider === 'valid'
        ? json({ id: USER })
        : json({ msg: 'JWT expired', code: 401 }, 401);
    if (url.includes('/rpc/auth_session_read'))
      return json({
        accountState: 'active',
        bootstrapState: 'complete',
        personId: PERSON,
        actingPartyId: PARTY,
      });
    return json({ unexpected: url }, 500);
  });
  const auth = createProductionAuthenticationDependencies({
    environment: env,
    fetchImpl: fetchImpl as typeof fetch,
    now: () => NOW,
  });
  const dependencies = createProductionContentSchemaRegistryDependencies({
    environment: env,
    fetchImpl: fetchImpl as typeof fetch,
    auth,
    resolveRequestContext: vi.fn(async () => ({
      ...context,
      capabilities: [...capabilities],
    })),
    humanOrigins: [CMS_ORIGIN],
    releaseOrigins: ['https://release-worker.example.test'],
    now: () => NOW,
  });
  return { fetchImpl, app: createContentSchemaRegistryApp(dependencies) };
};
