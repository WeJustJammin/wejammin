import { beforeAll, describe, expect, it, vi } from 'vitest';

import { createContentSchemaRegistryProductionApp } from './phase-02-slice-09-pre-release-production';
import {
  KEY_ID,
  NOW,
  PATH,
  makeSignedHarness,
  makeSigning,
  releaseHttp,
  type SignedHarness,
  type Signing,
} from './phase-02-slice-09-pre-release-support';
import { digestHex } from './release-crypto';
import {
  BLOCK_ID,
  EVENT_ID,
  HASH,
  NONCE,
  error,
  lifecycleEvent,
  ok,
  validLifecycle,
} from './phase-02-slice-09-test-values';

const A05 = 'CMS-03A-05' as const;
const A08 = 'CMS-03A-08' as const;
let signing: Signing;
beforeAll(async () => {
  signing = await makeSigning();
});
const harnessOf = (): Promise<SignedHarness> => makeSignedHarness({ signing });
const life = (patch: Record<string, unknown>) => ({
  ...validLifecycle,
  ...patch,
});
const without = (member: string): Record<string, unknown> => {
  const rest: Record<string, unknown> = { ...validLifecycle };
  delete rest[member];
  return rest;
};
type Violation = { path?: string };
const refuse = async (
  body: unknown,
  pathPrefix?: string,
  extra: Record<string, string> = {},
): Promise<void> => {
  const harness = await harnessOf();
  const response = await harness.send(A08, body, { extra });
  expect(response.status).toBe(422);
  const parsed = (await response.json()) as {
    code: string;
    details: { violations?: Violation[] };
  };
  expect(parsed.code).toBe('VALIDATION_FAILED');
  const paths = (parsed.details.violations ?? []).map((v) => v.path ?? '');
  expect(paths.length).toBeGreaterThan(0);
  if (pathPrefix !== undefined)
    expect(
      paths.some((p) => p === pathPrefix || p.startsWith(`${pathPrefix}/`)),
      paths.join(),
    ).toBe(true);
  expect(harness.advanceBlockLifecycle).not.toHaveBeenCalled();
};
const accept = async (
  body: unknown,
): Promise<{ harness: SignedHarness; input: Record<string, unknown> }> => {
  const harness = await harnessOf();
  const response = await harness.send(A08, body);
  expect(response.status).toBe(201);
  expect(harness.advanceBlockLifecycle).toHaveBeenCalledTimes(1);
  return {
    harness,
    input: harness.advanceBlockLifecycle.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >,
  };
};

describe('CMS-03A-08 lifecycle request through the real signed route', () => {
  it('[P2-S09-AC-149] is a strict object of fromLifecycle, toLifecycle, expectedVersion and releaseDigest', async () => {
    const { input } = await accept(validLifecycle);
    expect(Object.keys(input.body as object).sort()).toEqual([
      'expectedVersion',
      'fromLifecycle',
      'releaseDigest',
      'toLifecycle',
    ]);
    for (const member of Object.keys(validLifecycle))
      await refuse(without(member), `/${member}`);
    await refuse(life({ extra: true }), '/extra');
    await refuse(
      life({ blockKey: 'hero.banner', blockVersion: 9 }),
      '/blockKey',
    );
  });

  it('[P2-S09-AC-150] addresses an existing block by UUID path and can create no new key or version', async () => {
    const harness = await harnessOf();
    const response = await harness.app.request(
      releaseHttp(
        A08,
        JSON.stringify(validLifecycle),
        await signing.sign(A08, JSON.stringify(validLifecycle)),
        {},
      ),
    );
    expect(response.status).toBe(201);
    const input = harness.advanceBlockLifecycle.mock.calls[0]?.[0] as {
      path: Record<string, string>;
    };
    expect(input.path).toEqual({ blockDefinitionVersionId: BLOCK_ID });
    for (const bad of ['not-a-uuid', '42', `${BLOCK_ID}x`, 'hero.banner']) {
      const raw = JSON.stringify(validLifecycle);
      const refused = await harness.app.request(
        new Request(
          `https://api.example.test/api/v1/cms/blocks/versions/${bad}/lifecycle`,
          {
            ...{ method: 'POST', body: raw },
            headers: {
              origin: 'https://release-worker.example.test',
              'content-type': 'application/json',
              'idempotency-key': 'release-pre-key-0001',
              'if-match': '"1"',
              ...(await signing.sign(A08, raw)),
            },
          },
        ),
      );
      expect(refused.status, bad).toBe(400);
    }
    expect(harness.advanceBlockLifecycle).toHaveBeenCalledTimes(1);
    await refuse(life({ blockKey: 'new.block', blockVersion: 1 }), '/blockKey');
    await refuse(
      life({ blockDefinitionVersionId: BLOCK_ID }),
      '/blockDefinitionVersionId',
    );
    const missing = await harnessOf();
    missing.advanceBlockLifecycle.mockResolvedValueOnce(
      error(404, 'NOT_FOUND'),
    );
    const notFound = await missing.send(A08, validLifecycle);
    expect(notFound.status).toBe(404);
    expect(((await notFound.json()) as { details: object }).details).toEqual(
      {},
    );
  });

  it('[P2-S09-AC-151] accepts fromLifecycle supported or deprecated and relays a mismatch with the server-derived current lifecycle as a conflict', async () => {
    for (const [fromLifecycle, toLifecycle] of [
      ['supported', 'deprecated'],
      ['deprecated', 'withdrawn'],
    ]) {
      const { input } = await accept(life({ fromLifecycle, toLifecycle }));
      expect((input.body as { fromLifecycle: string }).fromLifecycle).toBe(
        fromLifecycle,
      );
    }
    for (const fromLifecycle of ['withdrawn', 'Supported', '', null, 3])
      await refuse(life({ fromLifecycle }), '/fromLifecycle');
    const harness = await harnessOf();
    harness.advanceBlockLifecycle.mockResolvedValueOnce(
      error(409, 'CONFLICT', 'current lifecycle differs', {
        conflict: 'INVALID_TRANSITION',
      }),
    );
    const response = await harness.send(
      A08,
      life({ fromLifecycle: 'supported', toLifecycle: 'deprecated' }),
    );
    expect(response.status).toBe(409);
    expect(response.headers.get('etag')).toBeNull();
    expect(harness.advanceBlockLifecycle).toHaveBeenCalledTimes(1);
  });

  it('[P2-S09-AC-152] admits only supported to deprecated and deprecated to withdrawn', async () => {
    const lifecycles = ['supported', 'deprecated', 'withdrawn'];
    const admitted: string[] = [];
    for (const fromLifecycle of lifecycles)
      for (const toLifecycle of lifecycles) {
        const harness = await harnessOf();
        const response = await harness.send(
          A08,
          life({ fromLifecycle, toLifecycle }),
        );
        if (response.status === 201)
          admitted.push(`${fromLifecycle}>${toLifecycle}`);
        else {
          expect(response.status, `${fromLifecycle}>${toLifecycle}`).toBe(422);
          expect(harness.advanceBlockLifecycle).not.toHaveBeenCalled();
        }
      }
    expect(admitted).toEqual(['supported>deprecated', 'deprecated>withdrawn']);
    await refuse(life({ toLifecycle: 'supported' }), '/toLifecycle');
  });

  it('[P2-S09-AC-153] requires expectedVersion as a positive decimal string equal to the exact strong If-Match', async () => {
    const { input } = await accept(validLifecycle);
    expect((input as { ifMatch: string }).ifMatch).toBe('1');
    for (const expectedVersion of ['0', '01', '-1', '1.5', 'v1', '', 1, null])
      await refuse(life({ expectedVersion }), '/expectedVersion');
    const harness = await harnessOf();
    for (const header of ['"2"', 'W/"1"', '1', '"0"']) {
      const response = await harness.send(A08, validLifecycle, {
        extra: { 'if-match': header },
      });
      expect(response.status, header).toBe(400);
    }
    const raw = JSON.stringify(validLifecycle);
    const headers = await signing.sign(A08, raw);
    const noMatch = new Request(`https://api.example.test${PATH[A08]}`, {
      method: 'POST',
      body: raw,
      headers: {
        origin: 'https://release-worker.example.test',
        'content-type': 'application/json',
        'idempotency-key': 'release-pre-key-0001',
        ...headers,
      },
    });
    expect((await harness.app.request(noMatch)).status).toBe(400);
    expect(harness.advanceBlockLifecycle).not.toHaveBeenCalled();
  });

  it('[P2-S09-AC-154] requires releaseDigest as lowercase 64-hex and relays a digest that differs from the registered release as a conflict', async () => {
    await accept(life({ releaseDigest: 'ab'.repeat(32) }));
    for (const releaseDigest of [
      'A'.repeat(64),
      'a'.repeat(63),
      'a'.repeat(65),
      'g'.repeat(64),
      '',
      null,
    ])
      await refuse(life({ releaseDigest }), '/releaseDigest');
    const harness = await harnessOf();
    harness.advanceBlockLifecycle.mockResolvedValueOnce(
      error(409, 'CONFLICT', 'digest differs', {
        conflict: 'INVALID_TRANSITION',
      }),
    );
    expect(
      (await harness.send(A08, life({ releaseDigest: 'cd'.repeat(32) })))
        .status,
    ).toBe(409);
  });

  it('[P2-S09-AC-155] verifies the operation-specific raw body and exact release headers before parsing or any state lookup', async () => {
    const harness = await harnessOf();
    const unsigned = await harness.send(A08, null, {
      raw: '{ not json',
      signRaw: '{}',
    });
    expect(unsigned.status).toBe(401);
    expect(((await unsigned.json()) as { code: string }).code).toBe(
      'WEBHOOK_REJECTED',
    );
    const wrongOperation = await harness.send(A08, validLifecycle, {
      signWith: A05,
    });
    expect(wrongOperation.status).toBe(401);
    const aliases = await harness.send(A08, validLifecycle, {
      extra: { 'x-release-signature': 'forged' },
    });
    expect(aliases.status).toBe(400);
    expect(harness.advanceBlockLifecycle).not.toHaveBeenCalled();
    expect(harness.rateLimit).not.toHaveBeenCalled();
    const accepted = await harness.send(A08, validLifecycle);
    expect(accepted.status).toBe(201);
    expect(harness.rateLimit.mock.invocationCallOrder[0]).toBeLessThan(
      harness.advanceBlockLifecycle.mock.invocationCallOrder[0] as number,
    );
  });

  it('[P2-S09-AC-157] [P2-S09-AC-161] hands stale and duplicate transitions and nonce or digest replays to the RPC and never turns a refusal into a success or an event', async () => {
    for (const [conflict, extra] of [
      ['VERSION_MISMATCH', { expectedVersion: '1', currentVersion: '4' }],
      ['INVALID_TRANSITION', {}],
      ['IDEMPOTENCY_MISMATCH', {}],
    ] as const) {
      const harness = await harnessOf();
      harness.advanceBlockLifecycle.mockResolvedValueOnce(
        error(409, 'CONFLICT', 'refused', { conflict, ...extra }),
      );
      const response = await harness.send(A08, validLifecycle);
      expect(response.status).toBe(409);
      const body = (await response.json()) as {
        details: Record<string, unknown>;
      };
      expect(body.details.conflict).toBe(conflict);
      expect(response.headers.get('etag')).toBeNull();
      expect(response.headers.get('location')).toBeNull();
      expect(JSON.stringify(body)).not.toContain(
        'block_definition_lifecycle_event',
      );
      expect(harness.advanceBlockLifecycle).toHaveBeenCalledTimes(1);
    }
    const twice = await harnessOf();
    expect((await twice.send(A08, validLifecycle)).status).toBe(201);
    expect((await twice.send(A08, validLifecycle)).status).toBe(201);
    expect(twice.advanceBlockLifecycle).toHaveBeenCalledTimes(2);
    const first = twice.advanceBlockLifecycle.mock.calls[0]?.[0] as {
      idempotencyKey: string;
      rawBody: Uint8Array;
      principal: { nonceHash: string };
    };
    const second = twice.advanceBlockLifecycle.mock
      .calls[1]?.[0] as typeof first;
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(new TextDecoder().decode(second.rawBody)).toBe(
      new TextDecoder().decode(first.rawBody),
    );
  });

  it('[P2-S09-AC-158] [P2-S09-AC-160] [P2-S09-AC-163] returns one strict 201 BlockLifecycleEventResource that names the event, the transition, the digest, the release verification and the changed event type without raw release material', async () => {
    const harness = await harnessOf();
    const response = await harness.send(A08, validLifecycle);
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = (await response.json()) as Record<string, unknown>;
    for (const member of [
      'id',
      'blockDefinitionVersionId',
      'blockKey',
      'blockVersion',
      'fromLifecycle',
      'toLifecycle',
      'releaseDigest',
      'releaseKeyId',
      'releaseNonceHash',
      'releaseVerifiedAt',
      'eventType',
    ])
      expect(body, member).toHaveProperty(member);
    expect(body.eventType).toBe('cms.block.lifecycle.changed.v1');
    expect(body.id).toBe(EVENT_ID);
    expect(body.blockDefinitionVersionId).toBe(BLOCK_ID);
    expect(JSON.stringify(body)).not.toMatch(
      /signature|rawBody|ownerId|"nonce"/iu,
    );
    expect(harness.advanceBlockLifecycle).toHaveBeenCalledTimes(1);
    expect(harness.registerBlock).not.toHaveBeenCalled();
    for (const patch of [
      { eventType: 'cms.block.registered.v1' },
      { ownerId: BLOCK_ID },
      { releaseSignature: 'x' },
      { toLifecycle: 'supported' },
      { releaseDigest: 'F'.repeat(64) },
    ]) {
      const bad = await harnessOf();
      bad.advanceBlockLifecycle.mockResolvedValueOnce(
        ok({ ...lifecycleEvent, ...patch }),
      );
      expect(
        (await bad.send(A08, validLifecycle)).status,
        JSON.stringify(patch),
      ).toBe(502);
    }
    const missing = await harnessOf();
    const incomplete = Object.fromEntries(
      Object.entries(lifecycleEvent).filter(([key]) => key !== 'eventType'),
    );
    missing.advanceBlockLifecycle.mockResolvedValueOnce(ok(incomplete));
    expect((await missing.send(A08, validLifecycle)).status).toBe(502);
  });

  it('[P2-S09-AC-159] [P2-S09-AC-213] returns no success, ETag, Location or event when the RPC rolls back, even for a replayed idempotency key', async () => {
    for (const result of [
      error(500, 'INTERNAL_ERROR'),
      error(503, 'DEPENDENCY_UNAVAILABLE'),
      error(504, 'DEPENDENCY_UNAVAILABLE'),
      error(409, 'CONFLICT', 'x', { conflict: 'IDEMPOTENCY_MISMATCH' }),
    ]) {
      const harness = await harnessOf();
      harness.advanceBlockLifecycle.mockResolvedValueOnce(result);
      const response = await harness.send(A08, validLifecycle);
      expect(response.status).toBe(result.ok ? 201 : result.status);
      expect(response.headers.get('etag')).toBeNull();
      expect(response.headers.get('location')).toBeNull();
      expect(await response.text()).not.toContain(
        'block_definition_lifecycle_event',
      );
      expect(harness.advanceBlockLifecycle).toHaveBeenCalledTimes(1);
    }
    const crashing = await harnessOf();
    crashing.advanceBlockLifecycle.mockRejectedValueOnce(
      new Error('outbox insert failed'),
    );
    const crashed = await crashing.send(A08, validLifecycle);
    expect(crashed.status).toBe(500);
    expect(await crashed.text()).not.toContain('outbox insert failed');
    const replayed = await harnessOf();
    replayed.advanceBlockLifecycle.mockResolvedValueOnce(
      error(409, 'CONFLICT', 'duplicate nonce', {
        conflict: 'INVALID_TRANSITION',
      }),
    );
    const sameKey = await replayed.send(A08, validLifecycle, {
      extra: { 'idempotency-key': 'release-pre-key-0001' },
    });
    expect(sameKey.status).toBe(409);
  });
});

describe('CMS-03A-08 on the production composition', () => {
  it('[P2-S09-AC-156] [P2-S09-AC-161] sends the verified key id, nonce, issue time, body and signature hashes with the path, version and idempotency key to cms_advance_block_lifecycle', async () => {
    const raw = JSON.stringify(validLifecycle);
    const headers = await signing.sign(A08, raw);
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify(lifecycleEvent), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const app = createContentSchemaRegistryProductionApp(
      signing.registry,
      fetchImpl,
      () => NOW,
    );
    const response = await app.request(releaseHttp(A08, raw, headers));
    expect(response.status).toBe(201);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_advance_block_lifecycle',
    );
    const sent = (
      JSON.parse(String(init.body)) as { p_request: Record<string, unknown> }
    ).p_request;
    expect(sent).toMatchObject({
      blockDefinitionVersionId: BLOCK_ID,
      fromLifecycle: 'supported',
      toLifecycle: 'deprecated',
      expectedVersion: '1',
      releaseDigest: HASH,
      releaseKeyId: KEY_ID,
      releaseNonce: NONCE,
      releaseRawBodyHash: await digestHex(new TextEncoder().encode(raw)),
      releaseSignature: headers['X-WeJammin-Release-Signature'],
      idempotencyKey: 'release-pre-key-0001',
    });
    expect(sent.releaseSignatureHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const duplicate = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            code: 'P0001',
            message: 'duplicate nonce',
            details: 'CONFLICT',
          }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        ),
    );
    const replay = await createContentSchemaRegistryProductionApp(
      signing.registry,
      duplicate,
      () => NOW,
    ).request(releaseHttp(A08, raw, headers));
    expect(replay.status).toBe(409);
    expect(replay.headers.get('etag')).toBeNull();
  });
});
