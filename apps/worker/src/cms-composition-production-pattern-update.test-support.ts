import { Hono } from 'hono';
import { vi } from 'vitest';

import type { AuthenticationSession } from './authentication/types';
import { createProductionCmsPatternUpdateDependencies } from './cms-composition-production-pattern-update';
import { registerCmsPatternUpdateRoutes } from './cms-composition/pattern-update-routes';
import type { CmsEditorialProductionOptions } from './cms-editorial-production-types';
import type { WorkerBindings } from './index';
import {
  PU_ORIGIN,
  PU_REQUEST_ID,
  PU_PARTY_ID,
  PU_USER_ID,
  puId,
} from './cms-composition/pattern-update.test-support';

/** Production adapter harness for CMS-03C-13/14/15: real session resolver and route, stubbed Supabase transport. */
export const pupEnvironment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-12-pattern-update-worker',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://supabase.example.test',
};

export const pupAuthentication: AuthenticationSession = {
  authUserId: PU_USER_ID,
  sessionId: puId(7),
  accountState: 'active',
  personId: puId(8),
  actingPartyId: PU_PARTY_ID,
  expiresAt: '2026-10-16T00:00:00Z',
  stepUpAt: null,
};

export const PUP_NOW = Date.parse('2026-10-15T08:00:00Z');

export const createPupHarness = (
  fetchImpl: typeof fetch,
  overrides: Partial<CmsEditorialProductionOptions> = {},
) => {
  const auth = {
    resolveSession: vi.fn(async () => ({
      ok: true as const,
      value: pupAuthentication,
    })),
  };
  const options: CmsEditorialProductionOptions = {
    environment: pupEnvironment,
    fetchImpl,
    auth,
    resolveCapabilities: ['cms.author'],
    humanOrigins: [PU_ORIGIN],
    now: () => PUP_NOW,
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
  const dependencies = createProductionCmsPatternUpdateDependencies(options);
  const app = new Hono();
  registerCmsPatternUpdateRoutes(app, dependencies);
  return {
    auth,
    options,
    dependencies,
    request: (path: string, init: RequestInit = {}) =>
      app.request(`https://api.example.test${path}`, {
        ...init,
        headers: {
          origin: PU_ORIGIN,
          'x-request-id': PU_REQUEST_ID,
          ...(init.headers as Record<string, string> | undefined),
        },
      }),
  };
};

/** A PostgREST error body for a platform raise (`RAISE EXCEPTION '<token>' USING ERRCODE = 'P0001'`). */
export const pgRaise = (
  message: string,
  details: string | null = null,
  status = 400,
): Response =>
  new Response(
    JSON.stringify({ code: 'P0001', message, details, hint: null }),
    { status, headers: { 'content-type': 'application/json' } },
  );

export const sentOf = (
  fetchImpl: { mock: { calls: unknown[][] } },
  index = 0,
): { url: string; init: RequestInit; p_request: Record<string, unknown> } => {
  const [url, init] = fetchImpl.mock.calls[index] as [string, RequestInit];
  return {
    url,
    init,
    p_request: (
      JSON.parse(String(init.body)) as { p_request: Record<string, unknown> }
    ).p_request,
  };
};

/** PostgreSQL `jsonb::text`: a space after every `:` and `,` outside strings, as PostgREST relays an RPC answer. */
export const jsonbText = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(jsonbText).join(', ')}]`;
  if (typeof value === 'object' && value !== null)
    return `{${Object.entries(value)
      .map(([key, member]) => `${JSON.stringify(key)}: ${jsonbText(member)}`)
      .join(', ')}}`;
  return JSON.stringify(value);
};
