/**
 * The Slice 11 request chain for the real-API suites (lane S11-4R):
 *
 *   browser request -> production Hono Worker app (nine CMS-03B-05..09 / 15..18 routes)
 *     -> production editorial dependencies (session resolver, RPC adapter, quality gate)
 *     -> Kong -> PostgREST -> the newest SQL.
 *
 * The composition is the one the deployed Worker mounts
 * (`createProductionCmsEditorialDependencies`, session through `options.auth` +
 * `resolveCapabilities`, so the server session context the RPC receives carries the
 * same `sessionId`, `actorPersonId` and `stepUpAt` members as in production). Only the
 * pieces that never produce an RPC outcome are supplied: the verified authentication
 * session (cookie authentication is not under test) and an always-allow rate limiter.
 * No database answer is rewritten on the way back, and every RPC the adapter issues is
 * recorded (name, status, request members, response replay header) for the suites.
 */
import { createHash, randomUUID } from 'node:crypto';

import type { ServerEnvironment } from '@wejammin/config/environment';

import { createCmsEditorialApp } from '../../../apps/worker/src/cms-editorial';
import type { CmsEditorialDependencies } from '../../../apps/worker/src/cms-editorial';
import { createProductionCmsEditorialDependencies } from '../../../apps/worker/src/cms-editorial-production';
import type { CmsEditorialTelemetryEvent } from '../../../apps/worker/src/cms-editorial-production-types';
import { API_URL, workerServiceCredential } from './stack';

export const S11_ORIGIN = 'https://app.example.test';
const CSRF = 'csrf-token-slice-11-0001';

/** A person the verified session can stand for. */
export type S11Actor = Readonly<{
  authUserId: string;
  personId: string;
  organizationId: string;
  capabilities: readonly string[];
}>;

/** How fresh the step-up proof of the next requests is. */
export type StepUp = 'fresh' | 'stale' | 'future' | 'none';

export type S11Response = Readonly<{
  status: number;
  headers: Headers;
  body: Record<string, unknown>;
  text: string;
}>;

export type S11Rpc = Readonly<{
  rpc: string;
  status: number;
  message: string;
  replayHeader: string | null;
  request: Record<string, unknown>;
  response: unknown;
}>;

export type S11SendOptions = Readonly<{
  body?: unknown;
  /** Defaults to a fresh key on POST. `null` omits the header. */
  idempotencyKey?: string | null;
  /** The bare version the caller read: becomes the strong If-Match. `null` omits it. */
  ifMatch?: string | null;
  headers?: Readonly<Record<string, string>>;
  signal?: AbortSignal;
}>;

const stepUpAt = (stepUp: StepUp): string | null => {
  const now = Date.now();
  if (stepUp === 'fresh') return new Date(now - 1_000).toISOString();
  if (stepUp === 'stale') return new Date(now - 3_600_000).toISOString();
  if (stepUp === 'future') return new Date(now + 3_600_000).toISOString();
  return null;
};

const sessionIdOf = (actor: S11Actor): string => {
  const hex = createHash('sha256')
    .update(`s11-session:${actor.authUserId}`)
    .digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

const parseJson = (text: string): unknown => {
  try {
    return text === '' ? null : (JSON.parse(text) as unknown);
  } catch {
    return null;
  }
};

const toResponse = async (response: Response): Promise<S11Response> => {
  const text = await response.text();
  const parsed = parseJson(text);
  const body =
    typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  return { status: response.status, headers: response.headers, body, text };
};

export type S11Stack = ReturnType<typeof createS11Stack>;

export const createS11Stack = (initial: S11Actor) => {
  let actor: S11Actor | null = initial;
  let stepUp: StepUp = 'none';
  const rpcs: S11Rpc[] = [];
  const events: CmsEditorialTelemetryEvent[] = [];
  let brokenRpc: string | null = null;
  let brokenRpcBody = '{"message":"upstream unavailable"}';

  const spyFetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input instanceof Request ? input.url : input);
    const rpc = /\/rpc\/([a-z0-9_]+)$/u.exec(url)?.[1] ?? '';
    // Fault injection (transport only): the named RPC answers a gateway 503.
    const response =
      brokenRpc !== null && rpc === brokenRpc
        ? new Response(brokenRpcBody, {
            status: 503,
            headers: { 'content-type': 'application/json' },
          })
        : await fetch(input, init);
    const text = await response.clone().text();
    const parsed = parseJson(text);
    const requestBody = parseJson(String(init?.body ?? ''));
    const request =
      typeof requestBody === 'object' && requestBody !== null
        ? ((requestBody as { p_request?: Record<string, unknown> }).p_request ??
          (requestBody as Record<string, unknown>))
        : {};
    // One run-log line per RPC: only SAFE metadata (status, byte length, body
    // digest). The raw wire body is never echoed, so a preview token, manifest or
    // person identifier inside a failing PostgREST body can never reach the test
    // output; the digest still lets a failure be correlated.
    console.info(
      `[s11-rpc] ${rpc} ${response.status} bytes=${text.length} bodySha256=${createHash(
        'sha256',
      )
        .update(text)
        .digest('hex')
        .slice(0, 16)} <- ${Object.keys(request).join(',')}`,
    );
    rpcs.push({
      rpc,
      status: response.status,
      message:
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof (parsed as { message?: unknown }).message === 'string'
          ? (parsed as { message: string }).message
          : '',
      replayHeader: response.headers.get('x-cms-idempotent-replay'),
      request,
      response: parsed,
    });
    return response;
  }) as typeof fetch;

  const production = createProductionCmsEditorialDependencies({
    environment: {
      SUPABASE_URL: API_URL,
      SUPABASE_SECRET_KEY: workerServiceCredential(),
      APP_ENVIRONMENT: 'development',
      APP_RELEASE: 'slice-11-api',
    } as unknown as ServerEnvironment,
    fetchImpl: spyFetch,
    humanOrigins: [S11_ORIGIN],
    auth: {
      resolveSession: async () =>
        actor === null
          ? {
              ok: false as const,
              status: 401 as const,
              code: 'UNAUTHENTICATED',
              message: 'No session.',
              details: { recoveryAction: 'reauthenticate' },
            }
          : {
              ok: true as const,
              value: {
                authUserId: actor.authUserId,
                sessionId: sessionIdOf(actor),
                accountState: 'active' as const,
                personId: actor.personId,
                actingPartyId: actor.organizationId,
                expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
                stepUpAt: stepUpAt(stepUp),
              },
            },
    },
    resolveCapabilities: () => actor?.capabilities ?? [],
    rateLimit: async (input) => ({
      ok: true as const,
      value: {
        allowed: true,
        limit: input.limit,
        remaining: input.limit - 1,
        resetAt: Math.floor(Date.now() / 1000) + 60,
      },
    }),
    telemetry: (event) => {
      events.push(event);
    },
  });
  const worker = createCmsEditorialApp(
    production as unknown as CmsEditorialDependencies,
  );

  const send = async (
    method: 'GET' | 'POST',
    path: string,
    options: S11SendOptions = {},
  ): Promise<S11Response> => {
    const headers: Record<string, string> = {
      origin: S11_ORIGIN,
      cookie: `wj_csrf=${CSRF}`,
    };
    if (method === 'POST') {
      headers['x-csrf-token'] = CSRF;
      headers['content-type'] = 'application/json';
      if (options.idempotencyKey !== null)
        headers['idempotency-key'] =
          options.idempotencyKey ?? `key-${randomUUID()}`;
      if (options.ifMatch !== undefined && options.ifMatch !== null)
        headers['if-match'] = `"${options.ifMatch}"`;
    }
    const raw =
      options.body === undefined
        ? undefined
        : typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body);
    const result = await toResponse(
      await worker.request(
        new Request(`${S11_ORIGIN}${path}`, {
          method,
          headers: { ...headers, ...options.headers },
          ...(raw === undefined || method === 'GET' ? {} : { body: raw }),
          ...(options.signal === undefined ? {} : { signal: options.signal }),
        }),
      ),
    );
    if (result.status >= 400)
      console.info(
        `[s11-http] ${method} ${result.status} pathSha256=${createHash('sha256')
          .update(path)
          .digest('hex')
          .slice(0, 16)} bytes=${result.text.length} bodySha256=${createHash(
          'sha256',
        )
          .update(result.text)
          .digest('hex')
          .slice(0, 16)}`,
      );
    return result;
  };

  return {
    /** Switch the verified session (null = no session) and its step-up proof. */
    as: (next: S11Actor | null, proof: StepUp = 'none'): void => {
      actor = next;
      stepUp = proof;
    },
    /**
     * Make one RPC (e.g. cms_load_quality_gate_input) answer a transport 503;
     * null heals it. The optional `body` is the injected upstream text, used by
     * the diagnostics control to prove the run-log never echoes a sensitive body.
     */
    breakRpc: (name: string | null, body?: string): void => {
      brokenRpc = name;
      brokenRpcBody = body ?? '{"message":"upstream unavailable"}';
    },
    rpcs: (): readonly S11Rpc[] => rpcs,
    clearRpcs: (): void => {
      rpcs.length = 0;
    },
    events: (): readonly CmsEditorialTelemetryEvent[] => events,
    get: (path: string, options: S11SendOptions = {}) =>
      send('GET', path, options),
    post: (path: string, options: S11SendOptions = {}) =>
      send('POST', path, options),
    send,
  };
};
