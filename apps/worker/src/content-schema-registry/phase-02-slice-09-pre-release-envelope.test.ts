import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  ISSUED_AT,
  KEY_ID,
  NOW,
  PATH,
  makeSignedHarness,
  makeSigning,
  releaseHttp,
  type Signing,
} from './phase-02-slice-09-pre-release-support';
import { createContentSchemaRegistryProductionApp } from './phase-02-slice-09-pre-release-production';
import { digestHex } from './release-crypto';
import { releaseSigningBytes } from './release-verifier';
import {
  API_ORIGIN,
  CMS_ORIGIN,
  NONCE,
  RELEASE_ORIGIN,
  block,
  validBlock,
  validLifecycle,
} from './phase-02-slice-09-test-values';

let signing: Signing;
beforeAll(async () => {
  signing = await makeSigning({
    aliasKeyId: 'release-key-2',
    revokedKeyId: 'release-key-9',
  });
});
const A05 = 'CMS-03A-05' as const;
const A08 = 'CMS-03A-08' as const;
const BODY = { [A05]: validBlock, [A08]: validLifecycle } as const;
const harnessOf = () => makeSignedHarness({ signing });
const PORT = {
  [A05]: 'registerBlock',
  [A08]: 'advanceBlockLifecycle',
} as const;
const wire = async (response: Response) =>
  (await response.json()) as { code: string; details: Record<string, unknown> };

describe('release envelope verification on A05 and A08 (real Ed25519 verifier)', () => {
  it.each([A05, A08] as const)(
    '[P2-S09-AC-028] binds the Ed25519 signing input of %s to the operation, the exact header values and the lowercase body hash in the locked order',
    async (operationId) => {
      const raw = JSON.stringify(BODY[operationId]);
      const rawBodyHash = await digestHex(new TextEncoder().encode(raw));
      expect(rawBodyHash).toMatch(/^[a-f0-9]{64}$/u);
      const bytes = new TextDecoder().decode(
        releaseSigningBytes({
          operationId,
          headers: { keyId: KEY_ID, issuedAt: ISSUED_AT, nonce: NONCE },
          rawBodyHash,
        }),
      );
      expect(bytes).toBe(
        [
          `WEJAMMIN-${operationId}-RELEASE-V1`,
          KEY_ID,
          ISSUED_AT,
          NONCE,
          rawBodyHash,
        ].join('\n'),
      );
      const harness = await harnessOf();
      expect((await harness.send(operationId, BODY[operationId])).status).toBe(
        201,
      );
      const other = operationId === A05 ? A08 : A05;
      const crossOperation = await harness.send(
        operationId,
        BODY[operationId],
        { signWith: other },
      );
      expect(crossOperation.status).toBe(401);
      expect((await wire(crossOperation)).code).toBe('WEBHOOK_REJECTED');
      const nonceTamper = await harness.send(operationId, BODY[operationId], {
        extra: {
          'X-WeJammin-Release-Nonce': 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        },
      });
      expect(nonceTamper.status).toBe(401);
      const issuedTamper = await harness.send(operationId, BODY[operationId], {
        extra: { 'X-WeJammin-Release-Issued-At': '2026-09-02T12:00:01.000Z' },
      });
      expect(issuedTamper.status).toBe(401);
      const keyTamper = await harness.send(operationId, BODY[operationId], {
        extra: { 'X-WeJammin-Release-Key-Id': 'release-key-2' },
      });
      expect(keyTamper.status).toBe(401);
      const bodyTamper = await harness.send(operationId, BODY[operationId], {
        raw: `${raw} `,
        signRaw: raw,
      });
      expect(bodyTamper.status).toBe(401);
      const reorderedRaw = JSON.stringify(
        Object.fromEntries(Object.entries(BODY[operationId]).reverse()),
      );
      const reordered = await harness.send(operationId, BODY[operationId], {
        raw: reorderedRaw,
        signRaw: raw,
      });
      expect(reordered.status).toBe(401);
      const port = harness[PORT[operationId]];
      expect(port).toHaveBeenCalledTimes(1);
      const swapped = new TextDecoder().decode(
        releaseSigningBytes({
          operationId,
          headers: { keyId: ISSUED_AT, issuedAt: KEY_ID, nonce: NONCE },
          rawBodyHash,
        }),
      );
      expect(swapped).not.toBe(bytes);
    },
  );

  it('[P2-S09-AC-027] verifies raw bytes and the four headers before JSON parsing and serves release requests only to the signed non-browser principal and release CORS policy', async () => {
    const harness = await harnessOf();
    const garbage = '{ this is not json';
    const unsigned = await harness.send(A05, null, {
      raw: garbage,
      signRaw: '{}',
    });
    expect(unsigned.status).toBe(401);
    expect((await wire(unsigned)).code).toBe('WEBHOOK_REJECTED');
    const signedGarbage = await harness.send(A05, null, { raw: garbage });
    expect(signedGarbage.status).toBe(400);
    expect(harness.registerBlock).not.toHaveBeenCalled();
    const browser = await harness.app.request(
      releaseHttp(
        A05,
        JSON.stringify(validBlock),
        await signing.sign(A05, JSON.stringify(validBlock)),
        { origin: CMS_ORIGIN, authorization: 'Bearer verified-session' },
      ),
    );
    expect(browser.status).toBe(403);
    expect(harness.resolveSession).not.toHaveBeenCalled();
    const preflight = await harness.app.request(
      new Request(`${API_ORIGIN}${PATH[A05]}`, {
        method: 'OPTIONS',
        headers: { origin: RELEASE_ORIGIN },
      }),
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-methods')).toBe(
      'POST, OPTIONS',
    );
    expect(
      preflight.headers.get('access-control-allow-credentials'),
    ).toBeNull();
    expect(preflight.headers.get('access-control-allow-headers')).toContain(
      'X-WeJammin-Release-Signature',
    );
    const humanPreflight = await harness.app.request(
      new Request(`${API_ORIGIN}${PATH[A05]}`, {
        method: 'OPTIONS',
        headers: { origin: CMS_ORIGIN },
      }),
    );
    expect(humanPreflight.status).toBe(403);
    const releaseOnHuman = await harness.app.request(
      new Request(`${API_ORIGIN}/api/v1/cms/content-types`, {
        method: 'OPTIONS',
        headers: { origin: RELEASE_ORIGIN },
      }),
    );
    expect(releaseOnHuman.status).toBe(403);
    const accepted = await harness.send(A05, validBlock);
    expect(accepted.status).toBe(201);
    expect(accepted.headers.get('access-control-allow-origin')).toBe(
      RELEASE_ORIGIN,
    );
    expect(accepted.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it.each([A05, A08] as const)(
    '[P2-S09-AC-119] verifies the raw body and exact release headers against a trusted non-revoked Ed25519 key before parsing %s',
    async (operationId) => {
      const harness = await harnessOf();
      expect((await harness.send(operationId, BODY[operationId])).status).toBe(
        201,
      );
      const refused = async (options: Parameters<typeof harness.send>[2]) => {
        const response = await harness.send(
          operationId,
          { not: 'valid' },
          options,
        );
        expect(response.status).toBe(401);
        expect((await wire(response)).code).toBe('WEBHOOK_REJECTED');
      };
      await refused({ headers: { keyId: 'release-key-unknown' } });
      await refused({ headers: { keyId: 'release-key-9' } });
      await refused({ signRaw: '{}' });
      const expired = await makeSignedHarness({
        signing: await makeSigning({ validUntil: '2026-09-02T11:00:00.000Z' }),
      });
      expect((await expired.send(operationId, BODY[operationId])).status).toBe(
        401,
      );
      const revoked = await makeSignedHarness({
        signing: await makeSigning({ revokedAt: '2026-09-02T11:00:00.000Z' }),
      });
      expect((await revoked.send(operationId, BODY[operationId])).status).toBe(
        401,
      );
      for (const h of [harness, expired, revoked])
        expect(h[PORT[operationId]]).toHaveBeenCalledTimes(
          h === harness ? 1 : 0,
        );
    },
  );

  it.each([A05, A08] as const)(
    '[P2-S09-AC-120] rejects more than five minutes of clock skew and unknown or revoked keys and relays nonce replay and digest conflicts for %s',
    async (operationId) => {
      const harness = await harnessOf();
      const at = (deltaMs: number) => ({
        issuedAt: new Date(NOW + deltaMs).toISOString(),
      });
      for (const delta of [-300_000, 300_000, 0])
        expect(
          (
            await harness.send(operationId, BODY[operationId], {
              headers: at(delta),
            })
          ).status,
          `${delta}`,
        ).toBe(201);
      for (const delta of [-300_001, 300_001, 3_600_000, -86_400_000])
        expect(
          (
            await harness.send(operationId, BODY[operationId], {
              headers: at(delta),
            })
          ).status,
          `${delta}`,
        ).toBe(401);
      expect(
        (
          await harness.send(operationId, BODY[operationId], {
            headers: { keyId: 'release-key-9' },
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await harness.send(operationId, BODY[operationId], {
            headers: { keyId: 'nope-key' },
          })
        ).status,
      ).toBe(401);
      for (const conflict of ['INVALID_TRANSITION', 'IDEMPOTENCY_MISMATCH']) {
        const replay = await harnessOf();
        replay[PORT[operationId]].mockResolvedValueOnce({
          ok: false,
          status: 409,
          code: 'CONFLICT',
          message: 'duplicate nonce or digest',
          details: { conflict },
        });
        const response = await replay.send(operationId, BODY[operationId]);
        expect(response.status).toBe(409);
        expect((await wire(response)).details.conflict).toBe(conflict);
        expect(response.headers.get('etag')).toBeNull();
      }
    },
  );
});

describe('release registration evidence on the production composition', () => {
  const rpcResource = { ...block, id: '70000000-0000-4000-8000-000000000077' };
  it('[P2-S09-AC-121] [P2-S09-AC-122] forwards the full release evidence to cms_register_block and returns only a complete 201 resource, never a success for a failed commit', async () => {
    const raw = JSON.stringify(validBlock);
    const headers = await signing.sign(A05, raw);
    const fetchImpl = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify(rpcResource), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const app = createContentSchemaRegistryProductionApp(
      signing.registry,
      fetchImpl,
      () => NOW,
    );
    const response = await app.request(releaseHttp(A05, raw, headers));
    expect(response.status).toBe(201);
    const body = (await response.json()) as Record<string, unknown>;
    for (const member of [
      'releaseKeyId',
      'releaseRawBodyHash',
      'releaseSignatureHash',
      'releaseNonceHash',
      'releaseVerifiedAt',
      'propsSnapshotAttestation',
      'propsSchemaSnapshot',
    ])
      expect(body, member).toHaveProperty(member);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://supabase.example.test/rest/v1/rpc/cms_register_block',
    );
    expect((init.headers as Record<string, string>)['Content-Profile']).toBe(
      'platform_api',
    );
    const sent = (
      JSON.parse(String(init.body)) as { p_request: Record<string, unknown> }
    ).p_request;
    expect(sent).toMatchObject({
      releaseKeyId: KEY_ID,
      releaseNonce: NONCE,
      releaseIssuedAt: ISSUED_AT,
      releaseRawBodyHash: await digestHex(new TextEncoder().encode(raw)),
      releaseSignature: headers['X-WeJammin-Release-Signature'],
      releaseVerifiedAt: ISSUED_AT,
      idempotencyKey: 'release-pre-key-0001',
    });
    expect(sent.releaseSignatureHash).toMatch(/^[a-f0-9]{64}$/u);
    const incomplete = { ...rpcResource } as Record<string, unknown>;
    delete incomplete.releaseNonceHash;
    const partialFetch = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify(incomplete), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const partial = await createContentSchemaRegistryProductionApp(
      signing.registry,
      partialFetch,
      () => NOW,
    ).request(releaseHttp(A05, raw, await signing.sign(A05, raw)));
    expect(partial.status).toBe(502);
    const failing = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({ message: 'audit insert failed', code: 'XX000' }),
          { status: 500, headers: { 'content-type': 'application/json' } },
        ),
    );
    const failed = await createContentSchemaRegistryProductionApp(
      signing.registry,
      failing,
      () => NOW,
    ).request(releaseHttp(A05, raw, await signing.sign(A05, raw)));
    expect(failed.status).toBeGreaterThanOrEqual(500);
    expect(failed.headers.get('etag')).toBeNull();
    expect(failed.headers.get('location')).toBeNull();
    expect(await failed.text()).not.toMatch(
      /audit insert failed|XX000|resourceKind/u,
    );
  });
});
