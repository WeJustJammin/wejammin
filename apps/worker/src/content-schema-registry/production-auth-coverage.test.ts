import { describe, expect, it, vi } from 'vitest';

import {
  CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS,
  RequestContextSchema,
} from '@wejammin/contracts';

import type { WorkerBindings } from '../index';
import type { AuthenticationSession } from '../authentication/types';
import { createProductionContentSchemaRegistryDependencies } from './production';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const PARTY_ID = '20000000-0000-4000-8000-000000000002';
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CORRELATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'production-auth-coverage',
  SUPABASE_SECRET_KEY: 'sb_secret_production_auth_coverage',
  SUPABASE_URL: 'https://supabase.example.test',
};
const request = new Request('https://api.example.test/cms', {
  headers: {
    'x-request-id': REQUEST_ID,
    'x-correlation-id': CORRELATION_ID,
  },
});
const session: AuthenticationSession = {
  authUserId: USER_ID,
  sessionId: '30000000-0000-4000-8000-000000000003',
  accountState: 'active',
  personId: '40000000-0000-4000-8000-000000000004',
  actingPartyId: PARTY_ID,
  expiresAt: '2099-01-01T00:00:00.000Z',
  stepUpAt: '2026-09-02T11:55:00.000Z',
};
const context = RequestContextSchema.parse({
  requestId: REQUEST_ID,
  correlationId: CORRELATION_ID,
  causationId: null,
  traceId: `worker-${REQUEST_ID}`,
  userId: USER_ID,
  actingPartyId: PARTY_ID,
  capabilities: ['cms.schema_registry.read'],
  locale: 'en-US',
  clientVersion: 'production-auth-coverage',
});

const dependenciesFor = (resolvePresentationVariant: unknown) =>
  createProductionContentSchemaRegistryDependencies({
    environment,
    fetchImpl: vi.fn<typeof fetch>(
      async () =>
        new Response('[]', { headers: { 'content-type': 'application/json' } }),
    ),
    auth: {
      resolveSession: vi.fn(async () => ({
        ok: true as const,
        value: session,
      })),
    },
    resolveRequestContext: vi.fn(async () => context),
    resolvePresentationVariant: resolvePresentationVariant as never,
    humanOrigins: ['https://cms.example.test'],
    releaseOrigins: ['https://release.example.test'],
    now: () => Date.parse('2026-09-02T12:00:00.000Z'),
  });

describe('content schema registry production authentication boundaries', () => {
  it('accepts a server resolver null and omits presentation scope', async () => {
    const dependencies = dependenciesFor(vi.fn(async () => null));

    await expect(
      dependencies.resolveSession(request, new AbortController().signal),
    ).resolves.toEqual({
      ok: true,
      value: {
        userId: USER_ID,
        actingPartyId: PARTY_ID,
        capabilities: ['cms.schema_registry.read'],
        mfaFresh: true,
        stepUpFreshUntil: '2026-09-02T12:05:00.000Z',
      },
    });
  });

  it('rejects a resolver presentation value outside the trusted enum', async () => {
    const dependencies = dependenciesFor(
      vi.fn(async () => 'not-a-presentation-scope'),
    );

    await expect(
      dependencies.resolveSession(request, new AbortController().signal),
    ).resolves.toMatchObject({
      ok: false,
      status: 401,
      code: 'UNAUTHENTICATED',
    });
  });

  it.each([
    {
      name: 'normal resolver failure',
      error: new Error('resolver unavailable'),
      signal: new AbortController().signal,
      status: 503,
    },
    {
      name: 'abort error resolver failure',
      error: new DOMException('resolver aborted', 'AbortError'),
      signal: new AbortController().signal,
      status: 504,
    },
    {
      name: 'aborted signal with normal resolver failure',
      error: new Error('resolver interrupted'),
      signal: (() => {
        const controller = new AbortController();
        controller.abort();
        return controller.signal;
      })(),
      status: 504,
    },
  ])(
    'maps $name to a safe dependency result',
    async ({ error, signal, status }) => {
      const dependencies = dependenciesFor(
        vi.fn(async () => {
          throw error;
        }),
      );

      await expect(
        dependencies.resolveSession(request, signal),
      ).resolves.toMatchObject({
        ok: false,
        status,
      });
    },
  );

  it('keeps the trusted variant list as the source for valid values', async () => {
    const variant = CONTENT_SCHEMA_REGISTRY_PRESENTATION_VARIANTS[0];
    const dependencies = dependenciesFor(vi.fn(async () => variant));

    await expect(
      dependencies.resolveSession(request, new AbortController().signal),
    ).resolves.toMatchObject({
      ok: true,
      value: { presentationVariant: variant },
    });
  });
});
