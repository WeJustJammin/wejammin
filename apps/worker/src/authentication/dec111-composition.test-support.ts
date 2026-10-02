import { expect, vi } from 'vitest';

import { createProductionWorkerApp, type WorkerBindings } from '../index';
import { sessionCookies } from './production-cookie';
import {
  base64UrlEncode,
  normalizeAuthProductionOptions,
} from './production-support';

/**
 * Real production composition for AUTH-API-16..21: `createProductionWorkerApp`
 * wires the Hono routes, the production authentication dependencies, the MFA
 * service, the production persistence adapter and the production Supabase MFA
 * provider. Only the two external systems (the PostgREST RPC endpoint and
 * Supabase Auth) are replaced, through the injected `fetch`.
 */
const originalStringify = JSON.stringify.bind(JSON);

export const NOW = Date.parse('2026-10-02T14:00:00Z');
export const ORIGIN = 'https://api.example.test';
export const AUTH_USER_ID = '22222222-2222-4222-8222-222222222222';
export const SESSION_ID = '33333333-3333-4333-8333-333333333333';
export const NEW_SESSION_ID = '34343434-3434-4434-8434-343434343434';
export const PERSON_ID = '44444444-4444-4444-8444-444444444444';
export const FACTOR_ID = '55555555-5555-4555-8555-555555555555';
export const OTHER_FACTOR_ID = '56565656-5656-4656-8656-565656565656';
export const PROVIDER_FACTOR_ID = '66666666-6666-4666-8666-666666666666';
export const CHALLENGE_ID = '77777777-7777-4777-8777-777777777777';
export const PROVIDER_CHALLENGE_ID = '88888888-8888-4888-8888-888888888888';
export const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
export const MANUAL_KEY = 'JBSWY3DPEHPK3PXPJBSWY3DPEH';
export const OTPAUTH_URI = `otpauth://totp/WeJammin:rob?secret=${MANUAL_KEY}&issuer=WeJammin`;

export const bindings: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'dec-111-composition',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://staging.example.supabase.co',
};

export const iso = (offsetSeconds: number): string =>
  new Date(NOW + offsetSeconds * 1000).toISOString();

const second = (offset: number): number => Math.floor(NOW / 1000) + offset;
const encode = (value: unknown): string =>
  base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));

export const jwt = (
  claims: Readonly<Record<string, unknown>> = {},
  sessionId: string = SESSION_ID,
): string =>
  `${encode({ alg: 'RS256' })}.${encode({
    sub: AUTH_USER_ID,
    session_id: sessionId,
    iss: `${bindings.SUPABASE_URL}/auth/v1`,
    aud: 'authenticated',
    exp: second(3600),
    aal: 'aal2',
    amr: [{ method: 'totp', timestamp: second(0) }],
    ...claims,
  })}.signature`;

export const json = (value: unknown, status = 200): Response =>
  new Response(originalStringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export const factorRow = (overrides: Record<string, unknown> = {}) => ({
  id: FACTOR_ID,
  method: 'totp',
  friendlyName: 'Phone authenticator',
  state: 'verified',
  verifiedAt: iso(-86_400),
  lastUsedAt: iso(-3_600),
  pendingExpiresAt: null,
  ...overrides,
});

export const pendingRow = (overrides: Record<string, unknown> = {}) =>
  factorRow({
    id: OTHER_FACTOR_ID,
    friendlyName: 'Spare authenticator',
    state: 'pending',
    verifiedAt: null,
    lastUsedAt: null,
    pendingExpiresAt: iso(480),
    ...overrides,
  });

export type Call = Readonly<{
  url: string;
  path: string;
  rpc: string | null;
  method: string;
  body: Record<string, unknown> | null;
  headers: Headers;
  signal: AbortSignal | null;
}>;

export type Handler = (call: Call) => Response | Promise<Response>;

/** Postgres-style RPC refusal: the adapter reads `message` for the code. */
export const rpcRefusal = (message: string, status = 400): Response =>
  json({ message }, status);

const rateAllowed = (call: Call): Response =>
  json({
    allowed: true,
    limit: Number(call.body?.p_limit ?? 1),
    remaining: 1,
    resetAt: second(900),
  });

export const defaultHandlers: Readonly<Record<string, Handler>> = {
  auth_rate_limit: rateAllowed,
  auth_session_read: () =>
    json({
      accountState: 'active',
      bootstrapState: 'complete',
      personId: PERSON_ID,
      actingPartyId: PERSON_ID,
    }),
  auth_mfa_factors_read: () => json({ factors: [factorRow()], version: '3' }),
  auth_mfa_enrollment_begin: () =>
    json({ supersededProviderFactorId: null, version: '4' }),
  auth_mfa_enrollment_finish: () =>
    json({ factorId: OTHER_FACTOR_ID, expiresAt: iso(600), version: '5' }),
  auth_mfa_enrollment_verify_prepare: () =>
    json({ providerFactorId: PROVIDER_FACTOR_ID }),
  auth_mfa_enrollment_verify_settle: () =>
    json({
      factors: [factorRow(), pendingRow({ state: 'verified' })],
      version: '6',
    }),
  auth_mfa_factor_mark_reconciling: () => json(null),
  auth_mfa_removal_begin: () =>
    json({ providerFactorId: PROVIDER_FACTOR_ID, replay: null }),
  auth_mfa_removal_finish: () => json({ factors: [], version: '7' }),
  auth_step_up_challenge_begin: () =>
    json({
      factorId: FACTOR_ID,
      providerFactorId: PROVIDER_FACTOR_ID,
      friendlyName: 'Phone authenticator',
    }),
  auth_step_up_challenge_finish: () =>
    json({ challengeId: CHALLENGE_ID, expiresAt: iso(300) }),
  auth_step_up_challenge_verify_prepare: () =>
    json({
      factorId: FACTOR_ID,
      providerFactorId: PROVIDER_FACTOR_ID,
      providerChallengeId: PROVIDER_CHALLENGE_ID,
      expiresAt: iso(300),
    }),
  auth_step_up_challenge_failure_record: () => json(null),
  auth_step_up_challenge_verify_settle: () => json(null),
};

const providerAuth = (call: Call): Response | null => {
  if (call.path === '/auth/v1/user') return json({ id: AUTH_USER_ID });
  if (call.path === '/auth/v1/factors' && call.method === 'POST')
    return json({
      id: PROVIDER_FACTOR_ID,
      totp: { secret: MANUAL_KEY, uri: OTPAUTH_URI },
    });
  if (call.path.endsWith('/challenge'))
    return json({ id: PROVIDER_CHALLENGE_ID, expires_at: second(300) });
  if (call.path.endsWith('/verify'))
    return json({ access_token: jwt({}, NEW_SESSION_ID), refresh_token: 'r2' });
  if (call.method === 'DELETE') return json({ id: PROVIDER_FACTOR_ID });
  return null;
};

export type World = Readonly<{
  /** Overrides keyed by RPC name or by `METHOD /auth/v1/path` for the provider. */
  handlers?: Readonly<Record<string, Handler>>;
}>;

export const createWorld = (world: World = {}) => {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const rpc = url.pathname.startsWith('/rest/v1/rpc/')
        ? url.pathname.slice('/rest/v1/rpc/'.length)
        : null;
      const call: Call = {
        url: url.toString(),
        path: url.pathname,
        rpc,
        method: init?.method ?? 'GET',
        body:
          typeof init?.body === 'string'
            ? (JSON.parse(init.body) as Record<string, unknown>)
            : null,
        headers: new Headers(init?.headers),
        signal: init?.signal ?? null,
      };
      calls.push(call);
      const key = rpc ?? `${call.method} ${call.path}`;
      const override = world.handlers?.[key];
      if (override !== undefined) return override(call);
      if (rpc !== null) {
        const handler = defaultHandlers[rpc];
        if (handler !== undefined) return handler(call);
        return rpcRefusal(`unexpected rpc ${rpc}`, 500);
      }
      return providerAuth(call) ?? json({ message: 'unexpected' }, 500);
    },
  );
  const app = createProductionWorkerApp(
    bindings,
    fetchImpl as unknown as typeof fetch,
  );
  return { app, calls, fetchImpl };
};

type Jar = Readonly<{ cookie: string; csrf: string }>;

const authConfig = normalizeAuthProductionOptions({
  environment: bindings,
  now: () => NOW,
  randomBytes: (length) => new Uint8Array(length).fill(7),
});

/** A valid first-party cookie jar for the session, minted by the real sealer. */
export const mintJar = async (
  options: Readonly<{
    stepUpAt?: string | null;
    sessionId?: string;
    accessClaims?: Readonly<Record<string, unknown>>;
  }> = {},
): Promise<Jar> => {
  const sessionId = options.sessionId ?? SESSION_ID;
  const set = await sessionCookies(
    {
      accessToken: jwt(options.accessClaims ?? {}, sessionId),
      refreshToken: 'caller-refresh-token-secret',
      authUserId: AUTH_USER_ID,
      sessionId,
      expiresAt: iso(3600),
      stepUpAt: options.stepUpAt === undefined ? iso(-60) : options.stepUpAt,
      primaryAuthAt: iso(-120),
      aal: 'aal2',
      providerSubjectDigest: null,
    },
    authConfig,
  );
  const pairs = set
    .map((line) => line.split(';')[0] ?? '')
    .filter((pair) => !pair.endsWith('='));
  const csrf = pairs
    .find((pair) => pair.startsWith('wj_csrf='))
    ?.slice('wj_csrf='.length);
  return { cookie: pairs.join('; '), csrf: csrf ?? '' };
};

export type Send = Readonly<{
  method: 'DELETE' | 'GET' | 'POST';
  path: string;
  body?: unknown;
  rawBody?: string;
  jar?: Jar | null;
  headers?: Readonly<Record<string, string | null>>;
}>;

/** Browser-shaped request: origin, cookie jar, CSRF header and JSON body. */
export const request = (spec: Send): Request => {
  const headers = new Headers({
    accept: 'application/json',
    origin: ORIGIN,
    'x-request-id': REQUEST_ID,
  });
  if (spec.jar !== null && spec.jar !== undefined) {
    headers.set('cookie', spec.jar.cookie);
    headers.set('x-csrf-token', spec.jar.csrf);
  }
  if (spec.method !== 'GET') headers.set('content-type', 'application/json');
  for (const [name, value] of Object.entries(spec.headers ?? {})) {
    if (value === null) headers.delete(name);
    else headers.set(name, value);
  }
  return new Request(`${ORIGIN}${spec.path}`, {
    method: spec.method,
    headers,
    ...(spec.method === 'GET'
      ? {}
      : { body: spec.rawBody ?? JSON.stringify(spec.body ?? {}) }),
  });
};

export const send = (app: ReturnType<typeof createWorld>['app'], spec: Send) =>
  app.request(request(spec), undefined, bindings);

export const bodyOf = async (
  response: Response,
): Promise<Record<string, unknown>> =>
  (await response.json()) as Record<string, unknown>;

/** Fault injection: the handler throws while serializing its own success body. */
export const crashOnSuccessBody = () =>
  vi.spyOn(JSON, 'stringify').mockImplementation(((
    value: unknown,
    ...rest: unknown[]
  ) => {
    if (
      typeof value === 'object' &&
      value !== null &&
      ['factors', 'otpauthUri', 'challengeId', 'verified'].some(
        (key) => key in value,
      ) &&
      !('code' in value && 'details' in value)
    )
      throw new TypeError('unexpected serializer fault');
    return (originalStringify as (...args: unknown[]) => string)(
      value,
      ...rest,
    );
  }) as typeof JSON.stringify);

type Details = Record<string, unknown>;
export type DetailsShape =
  | Readonly<{ exact: Details }>
  | Readonly<{ keys: readonly string[]; optional?: readonly string[] }>;

const assertDetails = (details: Details, shape: DetailsShape): void => {
  if ('exact' in shape) {
    expect(details).toStrictEqual(shape.exact);
    return;
  }
  const allowed = new Set([...shape.keys, ...(shape.optional ?? [])]);
  for (const key of Object.keys(details)) expect(allowed.has(key)).toBe(true);
  for (const key of shape.keys) expect(key in details).toBe(true);
};

/** Asserts the BE00 ApiError envelope and one strict details row. */
export const expectApiError = async (
  response: Response,
  expectation: Readonly<{ status: number; code: string; shape: DetailsShape }>,
): Promise<Record<string, unknown>> => {
  const body = await bodyOf(response);
  expect(response.status).toBe(expectation.status);
  expect(Object.keys(body).sort()).toStrictEqual([
    'code',
    'details',
    'message',
    'requestId',
  ]);
  expect(body.code).toBe(expectation.code);
  expect(body.requestId).toBe(REQUEST_ID);
  expect(typeof body.message).toBe('string');
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
  assertDetails(body.details as Details, expectation.shape);
  return body;
};

export const SHAPES = {
  reauthenticate: { exact: { recoveryAction: 'reauthenticate' } },
  stepUp: { exact: { recoveryAction: 'step_up', allowedMethods: ['totp'] } },
  forbidden: { keys: ['reasonCode'], optional: ['recoveryAction'] },
  empty: { exact: {} },
  invalidRequest: { keys: [], optional: ['violations'] },
  conflict: {
    keys: ['conflict', 'reasonCode', 'recoveryAction'],
    optional: ['expectedVersion', 'currentVersion'],
  },
  tooLarge: { exact: { maxBytes: 262_144 } },
  unsupported: { exact: { allowedMediaTypes: ['application/json'] } },
  validation: { keys: ['violations'] },
  rate: { keys: ['retryAfterSeconds', 'limit', 'resetAt'] },
  dependency: {
    keys: ['dependencyClass', 'retryable'],
    optional: ['retryAfterSeconds'],
  },
} as const satisfies Record<string, DetailsShape>;

/** A dependency that never answers until its caller aborts (deadline tests). */
export const hangUntilAborted: Handler = (call) =>
  new Promise<Response>((_resolve, reject) => {
    call.signal?.addEventListener('abort', () =>
      reject(new DOMException('aborted', 'AbortError')),
    );
  });

/** Names of the RPCs the production composition called, in order. */
export const rpcNames = (calls: readonly Call[]): string[] =>
  calls.flatMap((call) => (call.rpc === null ? [] : [call.rpc]));

/** Provider requests (`METHOD /auth/v1/...`) the composition made, in order. */
export const providerCalls = (calls: readonly Call[]): string[] =>
  calls.flatMap((call) =>
    call.rpc === null && call.path !== '/auth/v1/user'
      ? [`${call.method} ${call.path}`]
      : [],
  );

/** Every Set-Cookie header of a response, split into name and attributes. */
export const setCookies = (
  response: Response,
): ReadonlyArray<Readonly<{ name: string; value: string; attrs: string[] }>> =>
  response.headers.getSetCookie().map((line) => {
    const [pair = '', ...attrs] = line.split('; ');
    const index = pair.indexOf('=');
    return {
      name: pair.slice(0, index),
      value: pair.slice(index + 1),
      attrs,
    };
  });

/** A jar whose access token carries the given `amr` claim (primary sign-in). */
export const primaryAuthAmr = (offsetSeconds: number) => [
  { method: 'password', timestamp: second(offsetSeconds) },
];

/**
 * Runs the one timer registered at `deadlineMs` immediately, so a registered
 * deadline can be proven without waiting for it. Every registered delay is
 * recorded, so a test also proves the deadline value itself.
 */
export const collapseDeadline = (deadlineMs: number): number[] => {
  const delays: number[] = [];
  const original = globalThis.setTimeout;
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
    callback: () => void,
    delay?: number,
    ...rest: unknown[]
  ) => {
    delays.push(Number(delay));
    return (original as (...args: unknown[]) => unknown)(
      callback,
      delay === deadlineMs ? 0 : delay,
      ...rest,
    );
  }) as unknown as typeof setTimeout);
  return delays;
};

/** A real counting rate limiter behind the `auth_rate_limit` RPC. */
export const countingRateLimiter = (): Handler => {
  const counts = new Map<string, number>();
  return (call) => {
    const digest = String(call.body?.p_bucket_digest);
    const limit = Number(call.body?.p_limit);
    const used = (counts.get(digest) ?? 0) + 1;
    counts.set(digest, used);
    return json({
      allowed: used <= limit,
      limit,
      remaining: Math.max(0, limit - used),
      resetAt: Math.floor(NOW / 1000) + Number(call.body?.p_window_seconds),
    });
  };
};
