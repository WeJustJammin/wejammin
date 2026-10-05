import { describe, expect, it, vi } from 'vitest';

import { RequestContextSchema } from '@wejammin/contracts';

import type { WorkerBindings } from '../index';
import type { AuthenticationSession } from '../authentication/types';
import { cmsEditorialContextFor } from '../cms-editorial-production-session';
import { configurationDatabaseContext } from '../platform-configuration/production-request';
import { databaseContext as profileDatabaseContext } from '../profile-ownership/production-request';
import { contextFor, rpcBodyFor } from './production-context';
import { createProductionContentSchemaRegistryDependencies } from './production';
import type { ServerSessionContext } from './production-types';
import type { ContentSchemaRegistryPortInput } from './types';

const NOW = Date.parse('2026-09-02T12:00:00.000Z');
const USER_ID = '10000000-0000-4000-8000-000000000001';
const PARTY_ID = '20000000-0000-4000-8000-000000000002';
const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'step-up-skew',
  SUPABASE_SECRET_KEY: 'sb_secret_step_up_skew',
  SUPABASE_URL: 'https://supabase.example.test',
};
const request = new Request('https://api.example.test/cms', {
  headers: { 'x-request-id': REQUEST_ID },
});
const context = RequestContextSchema.parse({
  requestId: REQUEST_ID,
  correlationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  causationId: null,
  traceId: `worker-${REQUEST_ID}`,
  userId: USER_ID,
  actingPartyId: PARTY_ID,
  capabilities: ['cms.schema_registry.read'],
  locale: 'en-US',
  clientVersion: 'step-up-skew',
});

const at = (offsetSeconds: number): string =>
  new Date(NOW + offsetSeconds * 1000).toISOString();
const sessionAt = (stepUpAt: string | null): AuthenticationSession => ({
  authUserId: USER_ID,
  sessionId: '30000000-0000-4000-8000-000000000003',
  accountState: 'active',
  personId: '40000000-0000-4000-8000-000000000004',
  actingPartyId: PARTY_ID,
  expiresAt: '2099-01-01T00:00:00.000Z',
  stepUpAt,
});

/** BE01a DEC-111 window: -30 s <= now - stepUpAt <= 600 s; offsets are stepUpAt - now. */
const WINDOW = [
  { offset: 30, fresh: true },
  { offset: 0, fresh: true },
  { offset: -600, fresh: true },
  { offset: 31, fresh: false },
  { offset: -601, fresh: false },
] as const;

describe('[P2-S09-AC-602] [P2-S09-AC-628] one step-up freshness window in every Worker projection', () => {
  it.each(WINDOW)(
    'CMS registry session: stepUpAt at %j',
    async ({ offset, fresh }) => {
      const dependencies = createProductionContentSchemaRegistryDependencies({
        environment,
        fetchImpl: vi.fn<typeof fetch>(),
        auth: {
          resolveSession: vi.fn(async () => ({
            ok: true as const,
            value: sessionAt(at(offset)),
          })),
        },
        resolveRequestContext: vi.fn(async () => context),
        humanOrigins: ['https://cms.example.test'],
        releaseOrigins: ['https://release.example.test'],
        now: () => NOW,
      });
      const result = await dependencies.resolveSession(
        request,
        new AbortController().signal,
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.mfaFresh).toBe(fresh);
      expect(result.value.stepUpFreshUntil).toBe(
        fresh ? at(offset + 600) : undefined,
      );
    },
  );

  it.each(WINDOW)(
    'CMS registry RPC context stepUpVerified: stepUpAt at %j',
    ({ offset, fresh }) => {
      const server: ServerSessionContext = {
        authUserId: USER_ID,
        sessionId: '30000000-0000-4000-8000-000000000003',
        actorPersonId: '40000000-0000-4000-8000-000000000004',
        actingPartyId: PARTY_ID,
        stepUpAt: at(offset),
      } as ServerSessionContext;
      const contexts = new WeakMap<Request, ServerSessionContext>([
        [request, server],
      ]);
      const input = {
        request,
        requestId: REQUEST_ID,
        operationId: 'CMS-03A-04',
      } as unknown as ContentSchemaRegistryPortInput;
      expect(contextFor(input, contexts, () => NOW).stepUpVerified).toBe(fresh);
      const body = rpcBodyFor(input, contexts, () => NOW) as {
        context: { stepUpVerified: boolean };
      };
      expect(body.context.stepUpVerified).toBe(fresh);
    },
  );

  it.each(WINDOW)(
    'CMS editorial RPC context stepUpVerified: stepUpAt at %j',
    ({ offset, fresh }) => {
      const contexts = new WeakMap([
        [
          request,
          {
            authUserId: USER_ID,
            sessionId: '30000000-0000-4000-8000-000000000003',
            actorPersonId: '40000000-0000-4000-8000-000000000004',
            actingPartyId: PARTY_ID,
            stepUpAt: at(offset),
          },
        ],
      ]);
      expect(
        cmsEditorialContextFor(
          { request, requestId: REQUEST_ID },
          contexts,
          () => NOW,
        ).stepUpVerified,
      ).toBe(fresh);
    },
  );

  it.each(WINDOW)(
    'platform-configuration and profile-ownership RPC contexts: stepUpAt at %j',
    ({ offset, fresh }) => {
      const session = sessionAt(at(offset));
      expect(
        configurationDatabaseContext({ request, session }, () => NOW)
          .stepUpVerified,
      ).toBe(fresh);
      expect(
        profileDatabaseContext({ request, session } as never, () => NOW)
          .stepUpVerified,
      ).toBe(fresh);
    },
  );

  it('a missing proof is never verified in any projection', () => {
    const session = sessionAt(null);
    expect(
      configurationDatabaseContext({ request, session }, () => NOW)
        .stepUpVerified,
    ).toBe(false);
    expect(
      profileDatabaseContext({ request, session } as never, () => NOW)
        .stepUpVerified,
    ).toBe(false);
  });
});
