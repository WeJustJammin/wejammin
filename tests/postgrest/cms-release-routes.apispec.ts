/**
 * The signed release routes (CMS-03A-05 and CMS-03A-08) through the production Worker
 * against the real database: nonce replay evidence (SEC-3) and the denial rows (SEC-5).
 *
 * A real Ed25519 release key is registered with the Worker and with the database, and
 * every request is signed over its untouched bytes, so the request passes the Worker's
 * own verification, the database's second verification and the nonce claim exactly as a
 * release pipeline's would. Only the session and rate limiter seams are supplied.
 *
 * Commits fixtures (a release principal, the owner, registered blocks): run right after
 * `pnpm db:reset`.
 */
import { randomUUID } from 'node:crypto';

import { beforeAll, describe, expect, it } from 'vitest';

import { buildContentSchemaRegistryOperationalSnapshot } from '../../apps/worker/src/content-schema-registry/operational-alert-metrics';
import { createProductionContentSchemaRegistryDependencies } from '../../apps/worker/src/content-schema-registry/production';
import { mapRpcFailure } from '../../apps/worker/src/content-schema-registry/production-errors';
import { productionTelemetry } from '../../apps/worker/src/content-schema-registry/production-telemetry';
import { safeDetails } from '../../apps/worker/src/content-schema-registry/route-response-details';
import type {
  ContentSchemaRegistryPortInput,
  TelemetryEvent,
} from '../../apps/worker/src/content-schema-registry/types';
import {
  CMS_TEST_ORIGIN,
  type CmsApp,
  createCmsApp,
  ownerSession,
} from './support/cms-app';
import { createReleaseSigner, type ReleaseSigner } from './support/cms-release';
import {
  API_URL,
  callRpc,
  type CmsOwner,
  ensureCmsOwner,
  userToken,
  workerServiceCredential,
} from './support/stack';

const REJECTED = 'cms_release_nonce_claim_total{outcome="rejected"}';
const CLAIMED = 'cms_release_nonce_claim_total{outcome="claimed"}';

let owner: CmsOwner;
let signer: ReleaseSigner;
let app: CmsApp;

const send = (release: {
  path: string;
  rawBody: string;
  headers: Readonly<Record<string, string>>;
}) => app.sendRaw('POST', release.path, release.headers, release.rawBody);

const lastEvent = (): TelemetryEvent =>
  app.telemetry().at(-1) as TelemetryEvent;

beforeAll(() => {
  owner = ensureCmsOwner();
  signer = createReleaseSigner();
  app = createCmsApp(
    ownerSession(owner.authUserId, owner.organizationId, [
      'cms.schema_designer',
    ]),
    { releaseRegistry: signer.registry },
  );
});

describe('SEC-3 a replayed release nonce is a counted, alertable rejection', () => {
  it('[P2-S09-AC-120] [P2-S09-AC-122] [P2-S09-AC-208] a fresh signed registration commits, answers the strict 201 resource and counts a claimed nonce', async () => {
    const response = await send(signer.registration());
    expect(response.status).toBe(201);
    // AC122: the strict BlockDefinitionVersionResource, produced by the database and accepted by
    // the Worker's own strict response validation: exactly these 21 members.
    expect(Object.keys(response.body).sort()).toEqual([
      'blockKey',
      'blockVersion',
      'contentHash',
      'createdAt',
      'id',
      'lifecycle',
      'propsSchemaHash',
      'propsSchemaRef',
      'propsSchemaSnapshot',
      'propsSnapshotAttestation',
      'propsSnapshotHash',
      'releaseDigest',
      'releaseKeyId',
      'releaseNonceHash',
      'releaseRawBodyHash',
      'releaseSignatureHash',
      'releaseVerifiedAt',
      'rendererRef',
      'resourceKind',
      'updatedAt',
      'version',
    ]);
    expect(lastEvent()).toMatchObject({
      operationId: 'CMS-03A-05',
      outcome: 'success',
      metrics: { [CLAIMED]: 1 },
    });
  });

  it('[P2-S09-AC-120] [P2-S09-AC-208] the same nonce under a new signed request is 409 CONFLICT and counts a rejected nonce claim, which nonce_rejection_spike reads', async () => {
    const nonce = randomUUID();
    expect((await send(signer.registration({ nonce }))).status).toBe(201);
    app.clearObserved();
    const replay = await send(signer.registration({ nonce }));
    // the database's own answer: a CONFLICT whose detail names the replay ...
    expect(app.observed()).toEqual([
      { rpc: 'cms_register_block', status: 400, message: 'CONFLICT' },
    ]);
    // ... the unchanged BE00 wire shape ...
    expect(replay.status).toBe(409);
    expect(replay.body).toMatchObject({
      code: 'CONFLICT',
      details: { conflict: 'INVALID_TRANSITION', recoveryAction: 'refresh' },
    });
    expect(JSON.stringify(replay.body)).not.toContain('REPLAY');
    // ... and the telemetry the alert reads.
    const event = lastEvent();
    expect(event).toMatchObject({
      operationId: 'CMS-03A-05',
      outcome: 'rejected',
      status: 409,
      errorCode: 'RELEASE_NONCE_REPLAY_CONFLICT',
      metrics: { [REJECTED]: 1 },
    });
    expect(event.metrics).not.toHaveProperty([CLAIMED]);
    const now = Date.now();
    const logged: Array<{ source: Record<string, unknown> }> = [];
    productionTelemetry({
      info: (details: Record<string, unknown>) =>
        logged.push({
          source: {
            ...details,
            timestamp: new Date(now - 5_000).toISOString(),
          },
        }),
    } as never)(event);
    // The logger writes the request, command, rpc and acceptance lines of one request; the
    // alert counts the lines whose error code names the nonce.
    const naming = logged.filter(
      (line) => line.source.errorCode === 'RELEASE_NONCE_REPLAY_CONFLICT',
    ).length;
    expect(naming).toBeGreaterThan(0);
    expect(
      buildContentSchemaRegistryOperationalSnapshot({
        database: {},
        events: logged,
        now,
      }).nonceRejectionRate,
    ).toBe(naming);
  });

  it('[P2-S09-AC-208] a conflict that is not a replay (the registered pair) is a 409 without the rejected-nonce count', async () => {
    const blockKey = `apipair${randomUUID().slice(0, 8)}`;
    const first = signer.registration({ blockKey, blockVersion: 7 });
    expect((await send(first)).status).toBe(201);
    const again = await send(
      signer.registration({ blockKey, blockVersion: 7 }),
    );
    expect(again.status).toBe(409);
    expect(lastEvent()).toMatchObject({
      status: 409,
      errorCode: 'CONFLICT',
    });
    expect(lastEvent().metrics).not.toHaveProperty([REJECTED]);
  });
});

describe('SEC-5 the release routes refuse a human with 403 end to end', () => {
  const browser = (release: { headers: Readonly<Record<string, string>> }) => ({
    ...release.headers,
    origin: CMS_TEST_ORIGIN,
  });

  it('[P2-S09-AC-034] a browser (human console origin) on CMS-03A-05 and CMS-03A-08 is 403 at the Worker, never reaches the database, and is reported as a refusal', async () => {
    for (const [operationId, release] of [
      ['CMS-03A-05', signer.registration()],
      ['CMS-03A-08', signer.lifecycle(randomUUID())],
    ] as const) {
      app.clearObserved();
      const response = await app.sendRaw(
        'POST',
        release.path,
        browser(release),
        release.rawBody,
      );
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        code: 'FORBIDDEN',
        details: { reasonCode: 'POLICY_NOT_MET' },
      });
      expect(app.observed()).toEqual([]);
      expect(lastEvent()).toMatchObject({
        operationId,
        outcome: 'rejected',
        status: 403,
        errorCode: 'FORBIDDEN',
        actorClass: 'anonymous',
      });
    }
  });

  it('[P2-S09-AC-034] a human actor identity on a release call reaches the database and is refused FORBIDDEN, which the production adapter maps to 403 with the release reason code', async () => {
    const dependencies = createProductionContentSchemaRegistryDependencies({
      environment: {
        SUPABASE_URL: API_URL,
        SUPABASE_SECRET_KEY: workerServiceCredential(),
        APP_ENVIRONMENT: 'development',
        APP_RELEASE: 'api-gate',
      } as never,
    });
    for (const [operationId, port] of [
      ['CMS-03A-05', dependencies.ports.registerBlock],
      ['CMS-03A-08', dependencies.ports.advanceBlockLifecycle],
    ] as const) {
      const result = await port(
        {
          operationId,
          requestId: randomUUID(),
          request: new Request('https://api.example.test/release'),
          session: {
            userId: owner.authUserId,
            actingPartyId: owner.organizationId,
            capabilities: ['cms.schema_designer'],
            mfaFresh: false,
          },
          principal: {
            principalId: signer.principalId,
            keyId: signer.keyId,
            capabilities: ['release.block_registry.write'],
            verifiedAt: new Date().toISOString(),
            rawBodyHash: 'a'.repeat(64),
            signatureHash: 'b'.repeat(64),
            nonceHash: 'c'.repeat(64),
          },
          path: { blockDefinitionVersionId: randomUUID() },
        } as unknown as ContentSchemaRegistryPortInput,
        new AbortController().signal,
      );
      expect(result).toMatchObject({
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
      });
      expect(safeDetails(result as never, operationId)).toEqual({
        reasonCode: 'POLICY_NOT_MET',
      });
    }
  });

  it('[P2-S09-AC-034] a human JWT calling the release RPC directly is refused by the API layer with 403, and the production error mapper keeps it 403', async () => {
    const outcome = await callRpc(
      'cms_register_block',
      userToken(owner.authUserId),
      { p_request: {} },
    );
    expect(outcome.status).toBe(403);
    expect(mapRpcFailure(outcome.status, outcome.body)).toMatchObject({
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
    });
  });

  it('[P2-S09-AC-034] CMS-03A-08 for an unknown block version is 404 with the concealed body and no detail', async () => {
    app.clearObserved();
    const response = await send(signer.lifecycle(randomUUID()));
    expect(app.observed()).toEqual([
      { rpc: 'cms_advance_block_lifecycle', status: 400, message: 'NOT_FOUND' },
    ]);
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      code: 'NOT_FOUND',
      message: 'The requested CMS registry resource was not found.',
      details: {},
    });
  });
});
