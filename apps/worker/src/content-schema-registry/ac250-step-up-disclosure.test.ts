import { describe, expect, it, vi } from 'vitest';
import * as contracts from '@wejammin/contracts';

import { normalizeAuthProductionOptions } from '../authentication/production-configuration';
import { RequestContextSchema } from '@wejammin/contracts';
import type { WorkerBindings } from '../index';
import type { AuthenticationSession } from '../authentication/types';
import { createSessionResolver } from './production-auth';
import { createContentSchemaRegistryApp } from './index';
import {
  DEFAULT_DEADLINE_MS,
  MAX_DEFAULT_RESPONSE_BYTES,
  type ProductionConfiguration,
  type ServerSessionContext,
} from './production-types';
import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistrySession,
} from './types';

const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const STEP_UP_AT = '2026-10-01T11:55:00.000Z';
const STEP_UP_FRESH_UNTIL = '2026-10-01T12:05:00.000Z';
const USER_ID = '10000000-0000-4000-8000-000000000001';
const PARTY_ID = '20000000-0000-4000-8000-000000000002';
const SESSION_ID = '30000000-0000-4000-8000-000000000003';
const PERSON_ID = '40000000-0000-4000-8000-000000000004';
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CORRELATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CMS_ORIGIN = 'https://cms-console.example.test';
const PRIVATE_HOST = 'platform-api.internal';
const STEP_UP_HEADER =
  contracts.CONTENT_SCHEMA_REGISTRY_STEP_UP_FRESH_UNTIL_HEADER;

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'ac250-step-up-disclosure',
  SUPABASE_SECRET_KEY: 'sb_secret_ac250_step_up_disclosure',
  SUPABASE_URL: 'https://supabase.example.test',
};

const requestContext = RequestContextSchema.parse({
  requestId: REQUEST_ID,
  correlationId: CORRELATION_ID,
  causationId: null,
  traceId: `worker-${REQUEST_ID}`,
  userId: USER_ID,
  actingPartyId: PARTY_ID,
  capabilities: ['cms.schema_registry.read'],
  locale: 'en-US',
  clientVersion: 'ac250-step-up-disclosure',
});

const authSession = (
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

const configuration: ProductionConfiguration = {
  auth: normalizeAuthProductionOptions({ environment }),
  deadlineMs: DEFAULT_DEADLINE_MS,
  maxResponseBytes: MAX_DEFAULT_RESPONSE_BYTES,
  now: () => NOW,
};

const portInput = {
  environment,
  auth: {
    resolveSession: vi.fn(async () => ({
      ok: true as const,
      value: authSession(),
    })),
  },
  resolveRequestContext: vi.fn(async () => requestContext),
} as const;

const resolverFor = (stepUpAt: string | null, now: number) =>
  createSessionResolver(
    {
      ...portInput,
      auth: {
        resolveSession: vi.fn(async () => ({
          ok: true as const,
          value: authSession({ stepUpAt }),
        })),
      },
    },
    { ...configuration, now: () => now },
    new WeakMap<Request, ServerSessionContext>(),
  );

const session = (
  patch: Partial<ContentSchemaRegistrySession> = {},
): ContentSchemaRegistrySession => ({
  userId: USER_ID,
  actingPartyId: PARTY_ID,
  capabilities: ['cms.schema_registry.read'],
  mfaFresh: true,
  ...patch,
});

const makeApp = (value: ContentSchemaRegistrySession) => {
  const ports = {
    listContentTypes: vi.fn(async () => ({
      ok: true as const,
      value: { items: [], nextCursor: null },
    })),
    getContentTypeVersion: vi.fn(async () => ({
      ok: true as const,
      value: {},
    })),
  };
  return createContentSchemaRegistryApp({
    ports: ports as unknown as ContentSchemaRegistryDependencies['ports'],
    resolveSession: vi.fn(async () => ({ ok: true as const, value })),
    verifyRelease: vi.fn(async () => ({
      ok: false as const,
      status: 401 as const,
      code: 'WEBHOOK_REJECTED',
      message: 'Release verification is not used by human reads.',
      details: {},
    })),
    rateLimit: vi.fn(async () => ({
      ok: true as const,
      value: { allowed: true, limit: 60, remaining: 59, resetAt: NOW + 60_000 },
    })),
    humanOrigins: [CMS_ORIGIN],
    releaseOrigins: [],
    now: () => NOW,
  });
};

const privateListRequest = (extraHeaders: Record<string, string> = {}) =>
  new Request(`https://${PRIVATE_HOST}/api/v1/cms/content-types`, {
    method: 'GET',
    headers: {
      origin: CMS_ORIGIN,
      'x-request-id': REQUEST_ID,
      ...extraHeaders,
    },
  });

const browserListRequest = (extraHeaders: Record<string, string> = {}) =>
  new Request(`${CMS_ORIGIN}/api/v1/cms/content-types`, {
    method: 'GET',
    headers: {
      origin: CMS_ORIGIN,
      'x-request-id': REQUEST_ID,
      ...extraHeaders,
    },
  });

describe('AC250 step-up disclosure on the private read projection', () => {
  it('emits the server-derived freshness expiry only to the private service host', async () => {
    const app = makeApp(session({ stepUpFreshUntil: STEP_UP_FRESH_UNTIL }));
    const privateResponse = await app.request(privateListRequest());
    expect(privateResponse.status).toBe(200);
    expect(privateResponse.headers.get(STEP_UP_HEADER)).toBe(
      STEP_UP_FRESH_UNTIL,
    );

    const browserResponse = await app.request(browserListRequest());
    expect(browserResponse.status).toBe(200);
    expect(browserResponse.headers.get(STEP_UP_HEADER)).toBeNull();
  });

  it('never forwards a caller-supplied freshness header from the browser host', async () => {
    const app = makeApp(session({ stepUpFreshUntil: STEP_UP_FRESH_UNTIL }));
    const response = await app.request(
      browserListRequest({ [STEP_UP_HEADER]: '2026-10-01T12:09:00.000Z' }),
    );
    expect(response.headers.get(STEP_UP_HEADER)).toBeNull();
  });

  it('drops malformed or fabricated session expiry instead of forwarding it', async () => {
    for (const fabricated of [
      'not-a-timestamp',
      '2026-10-01T12:05:00Z',
      '2026-10-01T12:05:00.000+00:00',
      '',
      '2026-10-01T12:05:00.000Z ',
    ]) {
      const app = makeApp(session({ stepUpFreshUntil: fabricated }));
      const response = await app.request(privateListRequest());
      expect(response.status).toBe(200);
      expect(response.headers.get(STEP_UP_HEADER), fabricated).toBeNull();
    }
  });

  it('omits the freshness header rather than guessing when the session has none', async () => {
    const app = makeApp(session({ mfaFresh: false }));
    const response = await app.request(privateListRequest());
    expect(response.headers.get(STEP_UP_HEADER)).toBeNull();
  });
});

describe('AC250 session step-up freshness projection', () => {
  it('derives an explicit freshness expiry from verified step-up time', async () => {
    const result = await resolverFor(STEP_UP_AT, NOW)(
      new Request('https://api.example.test/api/v1/cms/content-types'),
      new AbortController().signal,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      mfaFresh: true,
      stepUpFreshUntil: STEP_UP_FRESH_UNTIL,
    });
  });

  it('never emits a freshness expiry when step-up is absent or stale', async () => {
    for (const [stepUpAt, now] of [
      [null, NOW],
      ['2026-10-01T11:40:00.000Z', NOW],
      ['2026-10-01T12:05:00.000Z', NOW],
      ['2026-10-01T12:06:00.000Z', NOW],
    ] as const) {
      const result = await resolverFor(stepUpAt, now)(
        new Request('https://api.example.test/api/v1/cms/content-types'),
        new AbortController().signal,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value.mfaFresh).toBe(false);
      expect(result.value).not.toHaveProperty('stepUpFreshUntil');
    }
  });
});
