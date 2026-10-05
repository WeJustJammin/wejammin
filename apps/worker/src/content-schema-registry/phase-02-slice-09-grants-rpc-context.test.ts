import { describe, expect, it, vi } from 'vitest';

import { RequestContextSchema } from '@wejammin/contracts';
import type { Logger } from '@wejammin/observability/logging';

import type { WorkerBindings } from '../index';
import type { AuthenticationSession } from '../authentication/types';
import {
  CMS_SCHEMA_REGISTRY_RPC,
  createProductionContentSchemaRegistryDependencies,
} from './production';
import { createContentSchemaRegistryPortRunner } from './runtime-port';
import type {
  ContentSchemaRegistryDependencies,
  ContentSchemaRegistryPortInput,
  TelemetryEvent,
} from './types';
import { PARTY_ID, REQUEST_ID, USER_ID } from './phase-02-slice-09-test-values';
import {
  ACTING_CONTEXT_ID,
  SESSION_ID,
} from './phase-02-slice-09-dec108-test-values';
import {
  GRANT_OPERATIONS,
  SUBJECT_PERSON_ID,
  grantRequestFor,
  makeGrantHarness,
} from './phase-02-slice-09-grants-test-support';

const CORRELATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PERSON_ID = '40000000-0000-4000-8000-000000000004';
const NOW = Date.parse('2026-09-02T12:00:00.000Z');
const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-09-grants-rpc',
  SUPABASE_SECRET_KEY: 'sb_secret_slice_09_grants_rpc',
  SUPABASE_URL: 'https://supabase.example.test',
};

describe('grant RPC name map (BE03a SQL API)', () => {
  it('names the four grant ports after the spec RPCs', () => {
    expect(CMS_SCHEMA_REGISTRY_RPC).toMatchObject({
      grantCapability: 'cms_grant_capability',
      renewCapabilityGrant: 'cms_renew_capability_grant',
      revokeCapabilityGrant: 'cms_revoke_capability_grant',
      listCapabilityGrants: 'cms_list_capability_grants',
    });
    expect(Object.keys(CMS_SCHEMA_REGISTRY_RPC)).toHaveLength(18);
  });
});

describe('grant port runner routes each operation to its named port and schema', () => {
  const runnerFor = (outputs: Readonly<Record<string, unknown>>) => {
    const ports = Object.fromEntries(
      Object.entries(outputs).map(([name, value]) => [
        name,
        vi.fn(async () => ({ ok: true as const, value })),
      ]),
    );
    const runner = createContentSchemaRegistryPortRunner({
      ports,
    } as unknown as ContentSchemaRegistryDependencies);
    return { run: runner.run, ports };
  };
  const inputFor = (operationId: string): ContentSchemaRegistryPortInput =>
    ({
      operationId,
      requestId: REQUEST_ID,
      request: new Request('https://api.example.test/x'),
    }) as unknown as ContentSchemaRegistryPortInput;

  it.each(GRANT_OPERATIONS)(
    '$operationId invokes $portName and returns its parsed contract resource',
    async (spec) => {
      const { run, ports } = runnerFor({ [spec.portName]: spec.output });
      await expect(run(inputFor(spec.operationId))).resolves.toEqual({
        ok: true,
        value: spec.output,
      });
      expect(ports[spec.portName]).toHaveBeenCalledTimes(1);
    },
  );

  it.each(GRANT_OPERATIONS)(
    '$operationId rejects a malformed resource with 502 and reports 503 when unwired',
    async (spec) => {
      const malformed = runnerFor({
        [spec.portName]: { ...(spec.output as object), unexpected: true },
      });
      await expect(
        malformed.run(inputFor(spec.operationId)),
      ).resolves.toMatchObject({ ok: false, status: 502 });
      await expect(
        runnerFor({}).run(inputFor(spec.operationId)),
      ).resolves.toMatchObject({ ok: false, status: 503 });
    },
  );
});

describe('grant production adapter RPC calls and private binding projection', () => {
  const authSession = {
    authUserId: USER_ID,
    sessionId: SESSION_ID,
    accountState: 'active',
    personId: PERSON_ID,
    actingPartyId: PARTY_ID,
    actingContextId: ACTING_CONTEXT_ID,
    expiresAt: '2099-01-01T00:00:00.000Z',
    stepUpAt: '2026-09-02T11:55:00.000Z',
  } as unknown as AuthenticationSession;
  const requestContext = RequestContextSchema.parse({
    requestId: REQUEST_ID,
    correlationId: CORRELATION_ID,
    causationId: null,
    traceId: `worker-${REQUEST_ID}`,
    userId: USER_ID,
    actingPartyId: PARTY_ID,
    capabilities: [],
    locale: 'en-US',
    clientVersion: 'grants',
  });

  const callGrantPorts = async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response('{}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const dependencies = createProductionContentSchemaRegistryDependencies({
      environment,
      fetchImpl,
      auth: {
        resolveSession: vi.fn(async () => ({
          ok: true as const,
          value: authSession,
        })),
      },
      resolveRequestContext: vi.fn(async () => requestContext),
      humanOrigins: ['https://cms.example.test'],
      releaseOrigins: ['https://release.example.test'],
      now: () => NOW,
    });
    const request = new Request(
      'https://api.example.test/api/v1/cms/capability-grants',
      {
        headers: {
          'x-request-id': REQUEST_ID,
          'x-correlation-id': CORRELATION_ID,
        },
      },
    );
    const signal = new AbortController().signal;
    await dependencies.resolveSession(request, signal);
    const ports = dependencies.ports as unknown as Record<
      string,
      (
        input: ContentSchemaRegistryPortInput,
        signal: AbortSignal,
      ) => Promise<unknown>
    >;
    const results: Record<
      string,
      { rpc: string; headers: Headers; body: Record<string, unknown> }
    > = {};
    for (const spec of GRANT_OPERATIONS) {
      const port = ports[spec.portName];
      expect(typeof port).toBe('function');
      const before = fetchImpl.mock.calls.length;
      await port?.(
        {
          operationId: spec.operationId,
          request,
          requestId: REQUEST_ID,
          session: {
            userId: USER_ID,
            actingPartyId: PARTY_ID,
            capabilities: [],
            mfaFresh: true,
          },
          path: spec.pathParams,
          ...(spec.method === 'GET'
            ? { query: { limit: 25, sort: 'updatedAt', direction: 'desc' } }
            : {
                body: {
                  ...(spec.body ?? {}),
                  context: { actingContextId: 'forged', authUserId: 'forged' },
                },
                idempotencyKey: 'cms-grant-key-0001',
                ...(spec.ifMatch ? { ifMatch: '7' } : {}),
              }),
        } as unknown as ContentSchemaRegistryPortInput,
        signal,
      );
      const call = fetchImpl.mock.calls[before];
      if (call === undefined) continue;
      results[spec.operationId] = {
        rpc: new URL(String(call[0])).pathname.split('/').at(-1) ?? '',
        headers: new Headers(call[1]?.headers),
        body: (
          JSON.parse(String(call[1]?.body)) as {
            p_request: Record<string, unknown>;
          }
        ).p_request,
      };
    }
    return results;
  };

  it.each(GRANT_OPERATIONS)(
    '$operationId posts to $rpc in platform_api with server context and the headers it needs',
    async (spec) => {
      const call = (await callGrantPorts())[spec.operationId];
      expect(call?.rpc).toBe(spec.rpc);
      expect(call?.headers.get('content-profile')).toBe('platform_api');
      expect(call?.headers.get('x-operation-id')).toBe(spec.operationId);
      expect(call?.headers.get('x-request-id')).toBe(REQUEST_ID);
      expect(call?.body).toMatchObject({
        ...spec.pathParams,
        context: {
          authUserId: USER_ID,
          actingPartyId: PARTY_ID,
          sessionId: SESSION_ID,
        },
      });
      if (spec.method === 'POST') {
        expect(call?.headers.get('x-idempotency-key')).toBe(
          'cms-grant-key-0001',
        );
        expect(call?.body.idempotencyKey).toBe('cms-grant-key-0001');
        if (spec.ifMatch) {
          expect(call?.headers.get('if-match')).toBe('"7"');
          expect(call?.body.expectedVersion).toBe('7');
        }
      } else {
        expect(call?.headers.has('x-idempotency-key')).toBe(false);
        expect(call?.headers.has('if-match')).toBe(false);
        expect(call?.body).toMatchObject({ limit: 25, sort: 'updatedAt' });
      }
    },
  );

  it('projects the private acting-context binding into every owner grant RPC, once, and nowhere else', async () => {
    const results = await callGrantPorts();
    expect(Object.keys(results)).toHaveLength(4);
    for (const [operationId, call] of Object.entries(results)) {
      const context = call.body.context as Record<string, unknown>;
      expect(context.actingContextId, operationId).toBe(ACTING_CONTEXT_ID);
      expect(
        JSON.stringify(call.body).split(ACTING_CONTEXT_ID).length - 1,
        operationId,
      ).toBe(1);
      expect([...call.headers.values()].join(' ')).not.toContain(
        ACTING_CONTEXT_ID,
      );
      expect(call.rpc).not.toContain(ACTING_CONTEXT_ID);
    }
  });

  it('replaces a caller-forged context object with the server-derived context', async () => {
    for (const [operationId, call] of Object.entries(await callGrantPorts())) {
      const context = call.body.context as Record<string, unknown>;
      expect(context.authUserId, operationId).toBe(USER_ID);
      expect(JSON.stringify(call.body), operationId).not.toContain('forged');
    }
  });
});

describe('grant privacy and telemetry (BE03a observability)', () => {
  const PRIVATE = [
    USER_ID,
    PARTY_ID,
    ACTING_CONTEXT_ID,
    SESSION_ID,
    'verified-session',
    'cms-grant-key-0001',
  ] as const;

  it.each(GRANT_OPERATIONS)(
    '$operationId keeps actor, party, binding and session ids out of body, headers and telemetry',
    async (spec) => {
      const harness = makeGrantHarness();
      const response = await harness.app.request(grantRequestFor(spec));
      expect(response.status).toBe(spec.status);
      const text = [
        await response.text(),
        [...response.headers.entries()]
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n'),
        JSON.stringify(harness.telemetry.mock.calls),
      ].join('\n');
      for (const value of PRIVATE) expect(text).not.toContain(value);
    },
  );

  it.each(GRANT_OPERATIONS)(
    '$operationId keeps the subject person id out of headers and telemetry',
    async (spec) => {
      const harness = makeGrantHarness();
      const response = await harness.app.request(grantRequestFor(spec));
      const text = [
        [...response.headers.entries()]
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n'),
        JSON.stringify(harness.telemetry.mock.calls),
      ].join('\n');
      expect(text).not.toContain(SUBJECT_PERSON_ID);
    },
  );

  it.each(GRANT_OPERATIONS)(
    '$operationId emits exactly one allowlisted event with its class and status',
    async (spec) => {
      const harness = makeGrantHarness();
      await harness.app.request(grantRequestFor(spec));
      expect(harness.telemetry).toHaveBeenCalledTimes(1);
      const event = harness.telemetry.mock.calls[0]?.[0] as TelemetryEvent;
      expect(event).toMatchObject({
        operationId: spec.operationId,
        outcome: 'success',
        status: spec.status,
        actorClass: 'human',
        rateClass: spec.rateClass,
        rateLimit: spec.limit,
        rateWindowSeconds: 60,
      });
    },
  );

  const logged = (operationId: string) => {
    const info = vi.fn();
    const dependencies = createProductionContentSchemaRegistryDependencies({
      environment,
      fetchImpl: vi.fn<typeof fetch>(),
      logger: { info } as unknown as Logger,
    });
    dependencies.telemetry?.({
      operationId,
      requestId: REQUEST_ID,
      outcome: 'success',
      status: 200,
      durationMs: 3,
      actorClass: 'human',
    } as unknown as TelemetryEvent);
    return info.mock.calls.map(
      ([details]) => (details as { eventName: string }).eventName,
    );
  };

  it.each(['CMS-03A-15', 'CMS-03A-16', 'CMS-03A-17'])(
    '%s is measured as a command',
    (operationId) => {
      expect(logged(operationId)).toContain('cms.registry.command');
    },
  );

  it('CMS-03A-18 is a protected read: measured as rpc and acceptance, never as a command', () => {
    const names = logged('CMS-03A-18');
    expect(names).toContain('cms.registry.rpc');
    expect(names).toContain('cms.registry.acceptance');
    expect(names).not.toContain('cms.registry.command');
  });
});
