import { describe, expect, it, vi } from 'vitest';

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
import { requestFor, specFor } from './phase-02-slice-09-dec108-test-support';
import { CMS_ORIGIN } from './phase-02-slice-09-dec108-test-values';
import { REQUEST_ID } from './phase-02-slice-09-test-values';

/**
 * AC430: CMS-03A-12 answers 401 UNAUTHENTICATED for a missing or EXPIRED
 * session with the BE00 ApiError envelope and only the allowlisted details for
 * that status. The session here is resolved by the production resolver
 * (production authentication -> CMS session resolver -> app), not by a stub
 * that answers 401 on request: the expired condition is produced in the token,
 * the provider answer and the resolved session expiry.
 */
const USER = '22222222-2222-4222-8222-222222222222';
const PARTY = '20000000-0000-4000-8000-000000000002';
const SESSION = '33333333-3333-4333-8333-333333333333';
const PERSON = '40000000-0000-4000-8000-000000000004';
const NOW = Date.parse('2026-09-01T04:00:00Z');
const env: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'r12-expired-session',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://staging.example.supabase.co',
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
const encoded = (value: unknown) =>
  base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
const jwt = (overrides: Readonly<Record<string, unknown>> = {}) =>
  `${encoded({ alg: 'RS256' })}.${encoded({
    sub: USER,
    session_id: SESSION,
    iss: `${env.SUPABASE_URL}/auth/v1`,
    aud: 'authenticated',
    exp: Math.floor(NOW / 1000) + 3600,
    ...overrides,
  })}.signature`;
const reference = () =>
  sealFlowCookie(
    {
      state: SESSION,
      nonce: USER,
      verifier: '',
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
const context = RequestContextSchema.parse({
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

type Provider = 'valid' | 'jwt-expired-401';

const build = (provider: Provider = 'valid') => {
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
    resolveRequestContext: vi.fn(async () => context),
    humanOrigins: [CMS_ORIGIN],
    releaseOrigins: ['https://release-worker.example.test'],
    now: () => NOW,
  });
  return { fetchImpl, app: createContentSchemaRegistryApp(dependencies) };
};

const decisionRequest = async (cookie: string | null): Promise<Request> => {
  const request = requestFor(specFor('CMS-03A-12'), {
    headers: { authorization: null, ...(cookie === null ? {} : { cookie }) },
  });
  return request;
};

const cmsCalls = (fetchImpl: ReturnType<typeof vi.fn>): readonly string[] =>
  fetchImpl.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/rpc/cms_') || url.includes('rate'));

const expectUnauthenticated = async (response: Response): Promise<void> => {
  expect(response.status).toBe(401);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const body = (await response.json()) as Record<string, unknown>;
  expect(Object.keys(body).sort()).toEqual([
    'code',
    'details',
    'message',
    'requestId',
  ]);
  expect(body.code).toBe('UNAUTHENTICATED');
  expect(body.details).toEqual({ recoveryAction: 'reauthenticate' });
  expect(body.requestId).toBe(REQUEST_ID);
  expect(JSON.stringify(body)).not.toMatch(
    new RegExp(`${USER}|${SESSION}|jwt|token|expired`, 'iu'),
  );
};

describe('[P2-S09-AC-430] CMS-03A-12 through the production session resolver', () => {
  it('answers 401 UNAUTHENTICATED for an access token whose exp has passed, with no CMS RPC and no rate bucket', async () => {
    const { app, fetchImpl } = build();
    const cookie = `wj_access=${jwt({ exp: Math.floor(NOW / 1000) - 60 })}; wj_session_ref=${await reference()}`;
    await expectUnauthenticated(
      await app.request(await decisionRequest(cookie)),
    );
    expect(cmsCalls(fetchImpl)).toEqual([]);
  });

  it('answers 401 UNAUTHENTICATED when the provider rejects the expired token', async () => {
    const { app, fetchImpl } = build('jwt-expired-401');
    const cookie = `wj_access=${jwt()}; wj_session_ref=${await reference()}`;
    await expectUnauthenticated(
      await app.request(await decisionRequest(cookie)),
    );
    expect(cmsCalls(fetchImpl)).toEqual([]);
  });

  it('answers 401 UNAUTHENTICATED for a missing session cookie', async () => {
    const { app, fetchImpl } = build();
    await expectUnauthenticated(await app.request(await decisionRequest(null)));
    expect(cmsCalls(fetchImpl)).toEqual([]);
  });

  it('answers 401 UNAUTHENTICATED for a session whose resolved expiry has passed', async () => {
    const fetchImpl = vi.fn(async () => json({}, 500));
    const dependencies = createProductionContentSchemaRegistryDependencies({
      environment: env,
      fetchImpl: fetchImpl as typeof fetch,
      auth: {
        resolveSession: vi.fn(async () => ({
          ok: true as const,
          value: {
            authUserId: USER,
            sessionId: SESSION,
            accountState: 'active' as const,
            personId: PERSON,
            actingPartyId: PARTY,
            expiresAt: new Date(NOW - 1_000).toISOString(),
            stepUpAt: null,
          },
        })),
      },
      resolveRequestContext: vi.fn(async () => context),
      humanOrigins: [CMS_ORIGIN],
      releaseOrigins: ['https://release-worker.example.test'],
      now: () => NOW,
    });
    const app = createContentSchemaRegistryApp(dependencies);
    await expectUnauthenticated(
      await app.request(await decisionRequest('x=1')),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('control: the same request with an unexpired token passes the session stage and is stopped only by step-up, so the 401 above is the expiry', async () => {
    const { app } = build();
    const cookie = `wj_access=${jwt()}; wj_session_ref=${await reference()}`;
    const response = await app.request(await decisionRequest(cookie));
    expect(response.status).toBe(401);
    const body = (await response.json()) as { code: string };
    expect(body.code).toBe('STEP_UP_REQUIRED');
  });
});
