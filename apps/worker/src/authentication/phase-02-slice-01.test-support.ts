import { type ProviderCatalog } from '@wejammin/contracts';
import { createLogger } from '@wejammin/observability/logging';
import { vi } from 'vitest';

import {
  createWorkerApp,
  type WorkerBindings,
  type WorkerDependencies,
} from '../index';
import type {
  AuthBootstrapResult,
  AuthenticationDependencies,
  AuthenticationResult,
} from './types';

export const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
export const AUTH_USER_ID = '22222222-2222-4222-8222-222222222222';
export const SESSION_ID = '33333333-3333-4333-8333-333333333333';
export const PERSON_ID = '44444444-4444-4444-8444-444444444444';
export const INTENT_ID = '55555555-5555-4555-8555-555555555555';

export const bindings: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'phase-02-slice-01-test',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://staging.example.supabase.co',
};

export const success = <T>(value: T): AuthenticationResult<T> => ({
  ok: true,
  value,
});
export const unavailable = (): AuthenticationResult<never> => ({
  ok: false,
  status: 503,
  code: 'DEPENDENCY_UNAVAILABLE',
  message: 'Authentication is temporarily unavailable.',
  retryAfterSeconds: 5,
});

export const session = {
  authUserId: AUTH_USER_ID,
  sessionId: SESSION_ID,
  accountState: 'active',
  personId: PERSON_ID,
  actingPartyId: PERSON_ID,
  expiresAt: '2026-09-01T05:00:00Z',
  stepUpAt: new Date(Date.now() - 60_000).toISOString(),
} as const;

export const resource = {
  authenticated: true,
  accountState: 'active',
  bootstrapState: 'complete',
  personId: PERSON_ID,
  actingPartyId: PERSON_ID,
  sessionExpiresAt: '2026-09-01T05:00:00Z',
} as const;

export const createAuth = (
  overrides: Partial<AuthenticationDependencies> = {},
): AuthenticationDependencies => ({
  loadProviderCatalog: vi.fn(async () =>
    success<ProviderCatalog>({
      providers: [{ code: 'google', label: 'Google', state: 'enabled' }],
      emailRecoveryEnabled: true,
      version: '1',
    }),
  ),
  startEmail: vi.fn(async () =>
    success({ resource: { accepted: true as const }, cookies: [] }),
  ),
  startOAuth: vi.fn(async () =>
    success({
      resource: {
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        expiresAt: '2026-09-01T05:00:00Z',
        intentId: INTENT_ID,
      },
      cookies: [],
    }),
  ),
  startLoginMethodLink: vi.fn(async () =>
    success({
      resource: {
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        expiresAt: '2026-09-01T05:00:00Z',
        intentId: INTENT_ID,
      },
      cookies: [],
    }),
  ),
  completeCallback: vi.fn(async () =>
    success({
      location: '/app',
      cookies: ['wj_session=opaque; HttpOnly; Secure; SameSite=Lax; Path=/'],
    }),
  ),
  resolveSession: vi.fn(async () => success(session)),
  readSession: vi.fn(async () => success(resource)),
  refreshSession: vi.fn(async () =>
    success({
      resource,
      cookies: ['wj_session=rotated; HttpOnly; Secure; SameSite=Lax; Path=/'],
    }),
  ),
  bootstrap: vi.fn(async () =>
    success<AuthBootstrapResult>({
      created: true,
      resource: {
        personId: PERSON_ID,
        actingPartyId: PERSON_ID,
        contextKind: 'self',
        accountState: 'active',
        bindingVersion: '1',
      },
    }),
  ),
  logout: vi.fn(async () =>
    success({
      cookies: [
        'wj_session=; Max-Age=0; HttpOnly; Secure; SameSite=Lax; Path=/',
      ],
    }),
  ),
  rateLimit: vi.fn(async (input) =>
    success({
      allowed: true,
      limit: input.limit,
      remaining: input.limit - 1,
      resetAt: 1_788_236_460,
    }),
  ),
  ...overrides,
});

export const createApp = (auth = createAuth()) => {
  const dependencies: WorkerDependencies & {
    auth: AuthenticationDependencies;
  } = {
    auth,
    captureException: vi.fn(),
    createLogger: () =>
      createLogger({
        environment: 'staging',
        release: 'phase-02-slice-01-test',
        service: 'wejammin-api',
      }),
    now: () => 1_788_236_400_000,
  };
  return { app: createWorkerApp(dependencies), auth };
};

export const jsonHeaders = {
  'content-type': 'application/json',
  origin: 'https://api.example.test',
  cookie:
    'wj_session_ref=slice01-session-ref; wj_csrf=slice01-csrf-random.4c581cbb65100a702593c678609c3761a3a7f0f2577a3349325bcf06c0213ae4; wj_refresh=opaque',
  'x-csrf-token':
    'slice01-csrf-random.4c581cbb65100a702593c678609c3761a3a7f0f2577a3349325bcf06c0213ae4',
  'x-request-id': REQUEST_ID,
};

export type OperationCase = Readonly<{
  id: string;
  path: string;
  method: 'GET' | 'POST';
  body?: string;
  successStatus: number;
}>;

export const operations: readonly OperationCase[] = [
  {
    id: 'AUTH-API-01',
    path: '/api/v1/auth/providers',
    method: 'GET',
    successStatus: 200,
  },
  {
    id: 'AUTH-API-02',
    path: '/api/v1/auth/email/start',
    method: 'POST',
    body: JSON.stringify({
      email: 'artist@example.com',
      intent: 'recovery',
      returnTo: '/account/recover',
    }),
    successStatus: 202,
  },
  {
    id: 'AUTH-API-03',
    path: '/api/v1/auth/oauth/start',
    method: 'POST',
    body: JSON.stringify({
      provider: 'google',
      intent: 'sign_in',
      returnTo: '/app',
    }),
    successStatus: 201,
  },
  {
    id: 'AUTH-API-04',
    path: '/auth/callback?state=opaque&code=opaque',
    method: 'GET',
    successStatus: 303,
  },
  {
    id: 'AUTH-API-05',
    path: '/api/v1/auth/session',
    method: 'GET',
    successStatus: 200,
  },
  {
    id: 'AUTH-API-06',
    path: '/api/v1/auth/session/refresh',
    method: 'POST',
    body: '{}',
    successStatus: 200,
  },
  {
    id: 'AUTH-API-07',
    path: '/api/v1/auth/bootstrap',
    method: 'POST',
    body: '{}',
    successStatus: 201,
  },
  {
    id: 'AUTH-API-08',
    path: '/api/v1/auth/logout',
    method: 'POST',
    body: '{"scope":"current"}',
    successStatus: 204,
  },
];

export const requestFor = (
  operation: OperationCase,
  invalid = false,
): Request => {
  const needsKey =
    operation.id === 'AUTH-API-07' || operation.id === 'AUTH-API-08';
  const path = invalid
    ? operation.method === 'GET'
      ? `${operation.path}${operation.path.includes('?') ? '&' : '?'}unknown=1`
      : operation.path
    : operation.path;
  return new Request(`https://api.example.test${path}`, {
    method: operation.method,
    headers: {
      ...jsonHeaders,
      ...(needsKey ? { 'idempotency-key': 'slice01-key' } : {}),
    },
    ...(operation.method === 'POST'
      ? { body: invalid ? '{"unknown":true}' : operation.body }
      : {}),
  });
};
