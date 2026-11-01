import {
  TaxonomyVersionApiRequestSchema,
  TaxonomyVersionsApiRequestSchema,
  TaxonomyVersionsPageSchema,
  type TaxonomyVersionRequest,
  type TaxonomyVersionResource,
} from '@wejammin/contracts';
import { createLogger } from '@wejammin/observability/logging';
import { vi } from 'vitest';

import { createWorkerApp, type WorkerBindings } from '../index';
import { createProductionWorkerAppRuntime } from '../production-worker-runtime';
import type { CmsEditorialSession } from '../cms-editorial/types';
import type { CmsEditorialProductionOptions } from '../cms-editorial-production-types';
import type { AuthenticationSession } from '../authentication/types';
import { Hono } from 'hono';
import { registerCmsTaxonomyDefinitionRoutes } from './taxonomy-definition-routes';
import { createProductionCmsTaxonomyDefinitionDependencies } from '../cms-composition-production-taxonomy-definition';

export const taxonomyDefinitionOrigin = 'https://cms.example.test';
export const taxonomyDefinitionRequestId =
  '11111111-1111-4111-8111-111111111111';
export const taxonomyDefinitionId = '22222222-2222-4222-8222-222222222222';

const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-12-taxonomy-transport-red',
  SUPABASE_SECRET_KEY: 'sb_secret_test_only',
  SUPABASE_URL: 'https://supabase.example.test',
};

/** Existing production composition only: no invented taxonomy-definition port. */
export const createTaxonomyDefinitionAdmissionHarness = () => {
  const lines: string[] = [];
  const captureException = vi.fn();
  const fetchImpl = vi.fn(async (): Promise<Response> => {
    throw new Error('Admission must not call an outbound dependency');
  });
  // A stray global fetch must fail locally, never reach a live service.
  vi.stubGlobal('fetch', fetchImpl);
  const app = createProductionWorkerAppRuntime(
    (dependencies) =>
      createWorkerApp({
        ...dependencies,
        captureException,
        createLogger: () =>
          createLogger(
            {
              environment: environment.APP_ENVIRONMENT,
              release: environment.APP_RELEASE,
              service: 'wejammin-api',
            },
            { sink: (line) => lines.push(line) },
          ),
      }),
    environment,
    fetchImpl,
    undefined,
    undefined,
    undefined,
    undefined,
    { humanOrigins: [taxonomyDefinitionOrigin] },
  );
  return {
    captureException,
    fetchImpl,
    lines,
    request: (path: string, init: RequestInit = {}) =>
      app.request(path, init, environment),
  };
};

export const taxonomyDefinitionWriteRequest = (
  expectedVersion: TaxonomyVersionRequest['expectedVersion'] = null,
): RequestInit => {
  const parsed = TaxonomyVersionApiRequestSchema.parse({
    headers: {
      contentType: 'application/json',
      idempotencyKey: 'taxonomy-definition-red-001',
      ...(expectedVersion === null ? {} : { ifMatch: `"${expectedVersion}"` }),
    },
    body: {
      taxonomyKey: 'instrument-tags',
      shape: 'flat',
      allowedTypeKeys: ['article'],
      allowedFieldKeys: ['instruments'],
      // Declared domains are legal at create even before their provider exists.
      canonicalOverlapDomains: ['instrument'],
      expectedVersion,
    },
  });
  return {
    method: 'POST',
    headers: {
      'content-type': parsed.headers.contentType,
      'idempotency-key': parsed.headers.idempotencyKey,
      origin: taxonomyDefinitionOrigin,
      'x-request-id': taxonomyDefinitionRequestId,
      ...(parsed.headers.ifMatch === undefined
        ? {}
        : { 'if-match': parsed.headers.ifMatch }),
    },
    body: JSON.stringify(parsed.body),
  };
};

export const taxonomyDefinitionVersionsPath = (): string => {
  const { taxonomyId } = TaxonomyVersionsApiRequestSchema.parse({
    taxonomyId: taxonomyDefinitionId,
  });
  return `/api/v1/cms/taxonomies/${taxonomyId}/versions`;
};

export const taxonomySession: CmsEditorialSession = {
  userId: '33333333-3333-4333-8333-333333333333',
  actingPartyId: '44444444-4444-4444-8444-444444444444',
  capabilities: ['cms.taxonomy_curator'],
  mfaFresh: false,
};
export const taxonomyResource = (version = 1): TaxonomyVersionResource => ({
  id: '55555555-5555-4555-8555-555555555555',
  taxonomyId: taxonomyDefinitionId,
  taxonomyKey: 'instrument-tags',
  taxonomyVersion: version,
  version: String(version),
  state: 'draft',
  shape: 'flat',
  allowedTypeKeys: ['article'],
  allowedFieldKeys: ['instruments'],
  canonicalOverlapDomains: ['instrument'],
  contentHash: 'a'.repeat(64),
  createdAt: '2026-10-12T00:00:00Z',
  updatedAt: '2026-10-12T00:00:00Z',
});

/** Isolated registrar: shared Worker integration remains a separate gate. */
export const createTaxonomyRouteHarness = () => {
  const resolveSession = vi.fn(async () => ({
    ok: true as const,
    value: taxonomySession,
  }));
  const rateLimit = vi.fn(async (input: { limit: number }) => ({
    ok: true as const,
    value: {
      allowed: true,
      limit: input.limit,
      remaining: input.limit - 1,
      resetAt: 60,
    },
  }));
  const createVersion = vi.fn(async () => ({
    ok: true as const,
    value: taxonomyResource(),
  }));
  const readVersions = vi.fn(async () => ({
    ok: true as const,
    value: { items: [taxonomyResource()], pageVersion: '9' },
  }));
  const readTerms = vi.fn(async () => ({
    ok: true as const,
    value: { items: [], nextCursor: null, pageVersion: '1' },
  }));
  const readSelector = vi.fn(async () => ({
    ok: true as const,
    value: { items: [], nextCursor: null, pageVersion: '1' },
  }));
  const dependencies = {
    humanOrigins: [taxonomyDefinitionOrigin],
    now: () => 0,
    resolveSession,
    rateLimit,
    createVersion,
    readVersions,
    readTerms,
    readSelector,
    telemetry: vi.fn(),
  };
  const app = new Hono();
  registerCmsTaxonomyDefinitionRoutes(app, dependencies);
  return {
    ...dependencies,
    dependencies,
    request: (path: string, init?: RequestInit) => app.request(path, init),
  };
};

export const taxonomyAuthentication: AuthenticationSession = {
  authUserId: taxonomySession.userId,
  sessionId: '77777777-7777-4777-8777-777777777777',
  accountState: 'active',
  personId: taxonomySession.userId,
  actingPartyId: taxonomySession.actingPartyId,
  expiresAt: '2026-10-13T00:00:00Z',
  stepUpAt: null,
};
export const createTaxonomyProductionHarness = (
  fetchImpl: typeof fetch,
  overrides: Partial<CmsEditorialProductionOptions> = {},
) => {
  const auth = {
    resolveSession: vi.fn(async () => ({
      ok: true as const,
      value: taxonomyAuthentication,
    })),
  };
  const options: CmsEditorialProductionOptions = {
    environment,
    fetchImpl,
    auth,
    resolveCapabilities: ['cms.taxonomy_curator'],
    humanOrigins: [taxonomyDefinitionOrigin],
    now: () => Date.parse('2026-10-12T00:00:00Z'),
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
  const dependencies =
    createProductionCmsTaxonomyDefinitionDependencies(options);
  const app = new Hono();
  registerCmsTaxonomyDefinitionRoutes(app, dependencies);
  return {
    auth,
    options,
    dependencies,
    request: (path: string, init?: RequestInit) => app.request(path, init),
  };
};

/** Schema-valid page/envelope with exact serialized byte size, never padding outside JSON. */
export const taxonomyPageAtBytes = (target: number, witness = false) => {
  const page = {
    items: Array.from({ length: 50 }, (_, i) => ({
      ...taxonomyResource(50 - i),
      allowedTypeKeys: Array.from({ length: 64 }, (_, k) => `type${k}`),
      allowedFieldKeys: Array.from({ length: 64 }, (_, k) => `field${k}`),
    })),
    pageVersion: '50',
  };
  const value = witness ? { taxonomyId: taxonomyDefinitionId, page } : page;
  let remaining =
    target - new TextEncoder().encode(JSON.stringify(value)).byteLength;
  for (const row of page.items)
    for (const keys of [row.allowedTypeKeys, row.allowedFieldKeys]) {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i]!;
        const growth = Math.min(Math.max(0, remaining), 63 - key.length);
        keys[i] = key + 'x'.repeat(growth);
        remaining -= growth;
      }
    }
  TaxonomyVersionsPageSchema.parse(page);
  if (remaining !== 0)
    throw new Error('Exact byte fixture cannot satisfy target');
  return { page, value };
};
