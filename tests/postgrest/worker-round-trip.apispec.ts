/**
 * SEC-1: the Worker's PRODUCTION PostgREST adapters, driven against the real
 * Kong -> PostgREST -> database stack with the Worker's own credential form
 * (the apikey-only opaque service key Kong maps to service_role).
 *
 * Only `fetch` is wrapped, to record each RPC's real HTTP status and database
 * error message; every request still goes to the live API. The owner and the
 * person come from the production bootstrap functions. The suite COMMITS its
 * fixtures: run it right after `pnpm db:reset` (`pnpm db:api-test`).
 */
import { randomUUID } from 'node:crypto';

import type { ServerEnvironment } from '@wejammin/config/environment';
import { beforeAll, describe, expect, it } from 'vitest';

import { createSupabaseRpc } from '../../apps/worker/src/async-runtime-support';
import { normalizeAuthProductionOptions } from '../../apps/worker/src/authentication/production-configuration';
import type { AuthenticationSession } from '../../apps/worker/src/authentication/types';
import { SCHEMA_MIGRATION_RPC } from '../../apps/worker/src/content-schema-registry/migration-worker-constants';
import { createProductionContentSchemaRegistryDependencies } from '../../apps/worker/src/content-schema-registry/production';
import { createProductionPlatformConfigurationDependencies } from '../../apps/worker/src/platform-configuration/production';
import { createProductionSchemaMigrationWorker } from '../../apps/worker/src/production-worker-runtime-cms';
import { callProfileRpc } from '../../apps/worker/src/profile-ownership/production-http';
import {
  API_URL,
  type CmsOwner,
  callRpc,
  createAuthUser,
  createPerson,
  ensureCmsOwner,
  psql,
  userToken,
  workerServiceCredential,
} from './support/stack';

const RELEASE_KEY = 'apigate-worker-key';

type Observed = { rpc: string; status: number; message: string };
let observed: Observed[] = [];

const spyFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const response = await fetch(input, init);
  const rpc =
    /\/rpc\/([a-z0-9_]+)$/u.exec(
      String(input instanceof Request ? input.url : input),
    )?.[1] ?? '';
  let message = '';
  try {
    const body = (await response.clone().json()) as { message?: unknown };
    if (typeof body.message === 'string') message = body.message;
  } catch {
    // a successful RPC body is not an error object
  }
  observed.push({ rpc, status: response.status, message });
  return response;
}) as typeof fetch;

const environment = (): ServerEnvironment =>
  ({
    SUPABASE_URL: API_URL,
    SUPABASE_SECRET_KEY: workerServiceCredential(),
    APP_ENVIRONMENT: 'development',
    APP_RELEASE: 'api-gate',
  }) as unknown as ServerEnvironment;

const request = (): Request => new Request('http://127.0.0.1/api-gate');

let owner: CmsOwner;
let stranger = '';

beforeAll(() => {
  owner = ensureCmsOwner();
  stranger = createAuthUser(randomUUID());
  psql(`insert into platform_private.cfg_release_principals(principal_id, key_id)
        values ('${createAuthUser(randomUUID())}', '${RELEASE_KEY}') on conflict do nothing`);
});

const session = (
  userId: string,
  personId: string,
  actingPartyId: string,
): AuthenticationSession => ({
  authUserId: userId,
  sessionId: randomUUID(),
  accountState: 'active',
  personId,
  actingPartyId,
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
  stepUpAt: null,
});

describe('SEC-1 Worker production adapters against the real API', () => {
  it('migration worker: the production transport claims through the service_role gate', async () => {
    observed = [];
    const rpc = createSupabaseRpc(spyFetch);
    await expect(
      rpc(
        environment(),
        SCHEMA_MIGRATION_RPC.claimLease,
        { p_request: { context: {}, workerId: 'api-gate-worker' } },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ reason: 'http_error' });
    // The gate passed: the database answered its own request validation.
    expect(observed).toEqual([
      {
        rpc: SCHEMA_MIGRATION_RPC.claimLease,
        status: 400,
        message: 'INVALID_REQUEST',
      },
    ]);
  });

  it('migration worker: process() reads its plan through the gate and never meets UNAUTHENTICATED', async () => {
    observed = [];
    const worker = createProductionSchemaMigrationWorker(
      environment(),
      spyFetch,
    );
    await worker.process({
      schemaVersionId: randomUUID(),
      migrationPlanId: randomUUID(),
      expectedVersion: '1',
      correlationId: randomUUID(),
      causationId: null,
    });
    expect(observed.length).toBeGreaterThan(0);
    expect(
      observed.filter((entry) => entry.message === 'UNAUTHENTICATED'),
    ).toEqual([]);
  });

  it('release worker: registerBlock reaches its own validation with a registered release principal', async () => {
    const dependencies = createProductionContentSchemaRegistryDependencies({
      environment: environment(),
      fetchImpl: spyFetch,
    });
    observed = [];
    const result = await dependencies.ports.registerBlock(
      {
        operationId: 'CMS-03A-05',
        requestId: randomUUID(),
        request: request(),
        principal: {
          principalId: randomUUID(),
          keyId: RELEASE_KEY,
          capabilities: [],
          verifiedAt: new Date().toISOString(),
          rawBodyHash: 'a'.repeat(64),
          signatureHash: 'b'.repeat(64),
          nonceHash: 'c'.repeat(64),
        },
      } as never,
      new AbortController().signal,
    );
    expect(observed.map((entry) => entry.message)).toEqual(['INVALID_REQUEST']);
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      code: 'INVALID_REQUEST',
    });
  });

  it('release worker: an unregistered release key is still refused', async () => {
    const dependencies = createProductionContentSchemaRegistryDependencies({
      environment: environment(),
      fetchImpl: spyFetch,
    });
    observed = [];
    await dependencies.ports.registerBlock(
      {
        operationId: 'CMS-03A-05',
        requestId: randomUUID(),
        request: request(),
        principal: {
          principalId: randomUUID(),
          keyId: 'unregistered-release-key',
          capabilities: [],
          verifiedAt: new Date().toISOString(),
          rawBodyHash: 'a'.repeat(64),
          signatureHash: 'b'.repeat(64),
          nonceHash: 'c'.repeat(64),
        },
      } as never,
      new AbortController().signal,
    );
    expect(observed.map((entry) => entry.message)).toEqual(['UNAUTHENTICATED']);
  });

  it('human CMS read: the owner lists content types through the production adapter', async () => {
    const dependencies = createProductionContentSchemaRegistryDependencies({
      environment: environment(),
      fetchImpl: spyFetch,
    });
    const result = await dependencies.ports.listContentTypes(
      {
        operationId: 'CMS-03A-06',
        requestId: randomUUID(),
        request: request(),
        session: {
          userId: owner.authUserId,
          actingPartyId: owner.organizationId,
          capabilities: [],
          mfaFresh: false,
        },
        query: {},
      } as never,
      new AbortController().signal,
    );
    expect(result).toEqual({
      ok: true,
      value: { items: [], nextCursor: null },
    });
  });

  it('human CMS read: the same read as the owner directly (authenticated JWT) succeeds, and a stranger forging the owner does not', async () => {
    const own = await callRpc(
      'cms_list_content_types',
      userToken(owner.authUserId),
      {
        p_request: {
          context: {
            authUserId: owner.authUserId,
            actingPartyId: owner.organizationId,
          },
        },
      },
    );
    expect(own).toMatchObject({
      status: 200,
      body: { items: [], nextCursor: null },
    });
    createPerson(stranger);
    const forged = await callRpc(
      'cms_list_content_types',
      userToken(stranger),
      {
        p_request: {
          context: {
            authUserId: owner.authUserId,
            actingPartyId: owner.organizationId,
          },
        },
      },
    );
    expect(forged.message).toBe('UNAUTHENTICATED');
    const forgedOrganization = await callRpc(
      'cms_list_content_types',
      userToken(stranger),
      {
        p_request: {
          context: {
            authUserId: stranger,
            actingPartyId: owner.organizationId,
          },
        },
      },
    );
    expect(forgedOrganization.message).toBe('FORBIDDEN');
  });

  it('platform configuration: the production capability reader answers for the owner person context', async () => {
    const dependencies = createProductionPlatformConfigurationDependencies({
      environment: environment(),
      fetchImpl: spyFetch,
    });
    observed = [];
    const keys = await dependencies.readCapabilityKeys(
      session(owner.authUserId, owner.personId, owner.personId),
      request(),
      environment() as never,
      new AbortController().signal,
    );
    // The owner's admin grants are scoped to the owner organization, so the
    // person context holds none; the point is that the gate answered.
    expect(keys).toEqual([]);
    expect(observed).toEqual([
      { rpc: 'admin_context_capabilities', status: 200, message: '' },
    ]);
  });

  it('profile ownership: the production transport enforces step-up from the Worker context', async () => {
    const config = normalizeAuthProductionOptions({
      environment: environment(),
      fetchImpl: spyFetch,
    });
    const convert = (stepUpVerified: boolean) =>
      callProfileRpc(
        config,
        'rpc_convert_claim',
        {
          p_request: {
            context: {
              actorPersonId: owner.personId,
              actingPartyId: owner.personId,
              stepUpVerified,
            },
            claimId: randomUUID(),
            headers: {
              idempotencyKey: `step-up-${randomUUID()}`,
              ifMatch: '"1"',
            },
            body: { reasonCode: 'claim_conversion' },
          },
        },
        new AbortController().signal,
      );
    await expect(convert(false)).rejects.toMatchObject({
      status: 401,
      code: 'STEP_UP_REQUIRED',
    });
    await expect(convert(true)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });
});
