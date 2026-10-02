import { describe, expect, it, vi } from 'vitest';

import { RequestContextSchema } from '@wejammin/contracts';

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
} from './types';
import { PARTY_ID, REQUEST_ID, USER_ID } from './phase-02-slice-09-test-values';
import {
  ACTING_CONTEXT_ID,
  REVIEWER_PERSON_ID,
  SESSION_ID,
} from './phase-02-slice-09-dec108-test-values';
import {
  NEW_OPERATION_IDS,
  OPERATIONS,
  specFor,
} from './phase-02-slice-09-dec108-test-support';

const CORRELATION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PERSON_ID = '40000000-0000-4000-8000-000000000004';
const NOW = Date.parse('2026-09-02T12:00:00.000Z');
const environment: WorkerBindings = {
  APP_ENVIRONMENT: 'staging',
  APP_RELEASE: 'slice-09-dec108-rpc',
  SUPABASE_SECRET_KEY: 'sb_secret_slice_09_dec108_rpc',
  SUPABASE_URL: 'https://supabase.example.test',
};

const ALL_PORTS = {
  'CMS-03A-01': 'createTypeDraft',
  'CMS-03A-02': 'addFieldDefinition',
  'CMS-03A-03': 'bindRelation',
  'CMS-03A-04': 'activateSchema',
  'CMS-03A-05': 'registerBlock',
  'CMS-03A-06': 'listContentTypes',
  'CMS-03A-07': 'getContentTypeVersion',
  'CMS-03A-08': 'advanceBlockLifecycle',
  ...Object.fromEntries(OPERATIONS.map((s) => [s.operationId, s.portName])),
} as const satisfies Readonly<Record<string, string>>;

const READ_OPS = new Set(['CMS-03A-06', 'CMS-03A-07', 'CMS-03A-13']);

/** The private binding is projected for activation, submission, decision, assignment only. */
const PRIVATE_BINDING_OPS = new Set([
  'CMS-03A-04',
  'CMS-03A-11',
  'CMS-03A-12',
  'CMS-03A-14',
]);

describe('DEC-108 RPC name map (BE03a SQL API: eighteen cms_* RPCs)', () => {
  it('maps every review and grant port to the spec-named RPCs and keeps the original eight', () => {
    expect(CMS_SCHEMA_REGISTRY_RPC).toEqual({
      createTypeDraft: 'cms_create_type_draft',
      addFieldDefinition: 'cms_add_field_definition',
      bindRelation: 'cms_bind_relation',
      activateSchema: 'cms_activate_schema',
      registerBlock: 'cms_register_block',
      listContentTypes: 'cms_list_content_types',
      getContentTypeVersion: 'cms_get_content_type_version',
      advanceBlockLifecycle: 'cms_advance_block_lifecycle',
      createSchemaSuccessor: 'cms_create_schema_successor',
      startSchemaDryRun: 'cms_start_schema_dry_run',
      submitSchemaReview: 'cms_submit_schema_review',
      decideSchemaReview: 'cms_decide_schema_review',
      getSchemaReview: 'cms_get_schema_review',
      assignSchemaReview: 'cms_assign_schema_review',
      grantCapability: 'cms_grant_capability',
      renewCapabilityGrant: 'cms_renew_capability_grant',
      revokeCapabilityGrant: 'cms_revoke_capability_grant',
      listCapabilityGrants: 'cms_list_capability_grants',
    });
  });
});

describe('DEC-108 port runner routes each operation to its named port and schema', () => {
  const runnerFor = (
    outputs: Readonly<Record<string, unknown>>,
  ): Readonly<{
    run: ReturnType<typeof createContentSchemaRegistryPortRunner>['run'];
    ports: Record<string, ReturnType<typeof vi.fn>>;
  }> => {
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

  it.each(OPERATIONS)(
    '$operationId invokes $portName and returns its parsed contract resource',
    async (spec) => {
      const { run, ports } = runnerFor({ [spec.portName]: spec.output });
      const result = await run(inputFor(spec.operationId));
      expect(ports[spec.portName]).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ ok: true, value: spec.output });
    },
  );

  it.each(OPERATIONS)(
    '$operationId rejects a malformed port resource with 502 DEPENDENCY_INVALID_RESPONSE',
    async (spec) => {
      const { run } = runnerFor({
        [spec.portName]: { ...(spec.output as object), unexpected: true },
      });
      await expect(run(inputFor(spec.operationId))).resolves.toMatchObject({
        ok: false,
        status: 502,
        code: 'DEPENDENCY_INVALID_RESPONSE',
      });
    },
  );

  it.each(OPERATIONS)(
    '$operationId reports 503 DEPENDENCY_UNAVAILABLE when its port is not wired',
    async (spec) => {
      const { run } = runnerFor({});
      await expect(run(inputFor(spec.operationId))).resolves.toMatchObject({
        ok: false,
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
      });
    },
  );
});

describe('DEC-108 production adapter RPC calls and private acting-context projection', () => {
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
    capabilities: ['cms.schema_registry.read'],
    locale: 'en-US',
    clientVersion: 'dec108',
  });

  const callAllPorts = async () => {
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
      'https://api.example.test/api/v1/cms/content-types',
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
      | ((
          input: ContentSchemaRegistryPortInput,
          signal: AbortSignal,
        ) => Promise<unknown>)
      | undefined
    >;
    const session = {
      userId: USER_ID,
      actingPartyId: PARTY_ID,
      capabilities: ['cms.schema_designer'],
      mfaFresh: true,
    };
    const results: Record<
      string,
      { rpc: string; headers: Headers; body: Record<string, unknown> }
    > = {};
    for (const [operationId, portName] of Object.entries(ALL_PORTS)) {
      const port = ports[portName];
      if (port === undefined) continue;
      const before = fetchImpl.mock.calls.length;
      const spec = OPERATIONS.find(
        (candidate) => candidate.operationId === operationId,
      );
      await port(
        {
          operationId,
          request,
          requestId: REQUEST_ID,
          session,
          path: spec?.pathParams ?? {
            contentTypeId: USER_ID,
            versionId: PARTY_ID,
          },
          body: {
            ...(spec?.body ?? {}),
            context: { actingContextId: 'forged', authUserId: 'forged' },
          },
          ...(READ_OPS.has(operationId)
            ? {}
            : { idempotencyKey: 'cms-dec108-key-001', ifMatch: '7' }),
        } as unknown as ContentSchemaRegistryPortInput,
        signal,
      );
      const call = fetchImpl.mock.calls[before];
      if (call === undefined) continue;
      results[operationId] = {
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

  it('exposes one production port per operation for all fourteen operations', async () => {
    const results = await callAllPorts();
    expect(Object.keys(results).sort()).toEqual(Object.keys(ALL_PORTS).sort());
  });

  it.each(NEW_OPERATION_IDS)(
    '%s posts to its named RPC in platform_api with server context and the mutation headers it needs',
    async (operationId) => {
      const spec = specFor(operationId);
      const call = (await callAllPorts())[operationId];
      const rpcKey = spec.portName as keyof typeof CMS_SCHEMA_REGISTRY_RPC;
      expect(call?.rpc).toBe(CMS_SCHEMA_REGISTRY_RPC[rpcKey]);
      expect(call?.headers.get('content-profile')).toBe('platform_api');
      expect(call?.headers.get('x-operation-id')).toBe(operationId);
      expect(call?.headers.get('x-request-id')).toBe(REQUEST_ID);
      expect(call?.headers.get('x-correlation-id')).toBe(CORRELATION_ID);
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
          'cms-dec108-key-001',
        );
        expect(call?.headers.get('if-match')).toBe('"7"');
        expect(call?.body).toMatchObject({
          idempotencyKey: 'cms-dec108-key-001',
          expectedVersion: '7',
        });
      }
    },
  );

  it('CMS-03A-13 sends no mutation header and no mutation field (zero-side-effect read)', async () => {
    const call = (await callAllPorts())['CMS-03A-13'];
    expect(call?.headers.has('x-idempotency-key')).toBe(false);
    expect(call?.headers.has('if-match')).toBe(false);
    expect(call?.body).not.toHaveProperty('idempotencyKey');
    expect(call?.body).not.toHaveProperty('expectedVersion');
  });

  it('projects the private acting-context binding into CMS-03A-04, -11, -12 and -14 only', async () => {
    const results = await callAllPorts();
    for (const [operationId, call] of Object.entries(results)) {
      const context = call.body.context as Record<string, unknown>;
      if (PRIVATE_BINDING_OPS.has(operationId))
        expect(context.actingContextId, operationId).toBe(ACTING_CONTEXT_ID);
      else expect(context, operationId).not.toHaveProperty('actingContextId');
    }
    expect(Object.keys(results)).toHaveLength(Object.keys(ALL_PORTS).length);
  });

  it('never places the binding id in a header, the URL, or anywhere but the RPC context', async () => {
    const results = await callAllPorts();
    for (const [operationId, call] of Object.entries(results)) {
      const occurrences =
        JSON.stringify(call.body).split(ACTING_CONTEXT_ID).length - 1;
      expect(occurrences, operationId).toBe(
        PRIVATE_BINDING_OPS.has(operationId) ? 1 : 0,
      );
      expect([...call.headers.values()].join(' ')).not.toContain(
        ACTING_CONTEXT_ID,
      );
      expect(call.rpc).not.toContain(ACTING_CONTEXT_ID);
    }
    expect(Object.keys(results)).toHaveLength(Object.keys(ALL_PORTS).length);
  });

  it('overrides a caller-forged context object with the server-derived context for every operation', async () => {
    const results = await callAllPorts();
    for (const [operationId, call] of Object.entries(results)) {
      const context = call.body.context as Record<string, unknown>;
      expect(context.authUserId, operationId).toBe(USER_ID);
      expect(JSON.stringify(call.body), operationId).not.toContain('forged');
    }
    expect(Object.keys(results)).toHaveLength(Object.keys(ALL_PORTS).length);
  });

  it('does not project the reviewer person id or any actor id into CMS-03A-13', async () => {
    const call = (await callAllPorts())['CMS-03A-13'];
    expect(JSON.stringify(call?.body)).not.toContain(REVIEWER_PERSON_ID);
  });
});
