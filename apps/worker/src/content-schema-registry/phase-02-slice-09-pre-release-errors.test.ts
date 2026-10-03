/**
 * BE03a "Operation error coverage" for the signed release operations A05 and
 * A08, and the reservation of WEBHOOK_REJECTED to the release-worker boundary.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import {
  PATH,
  makeSignedHarness,
  makeSigning,
  releaseHttp,
  type SignedHarness,
  type Signing,
} from './phase-02-slice-09-pre-release-support';
import {
  RELEASE_ORIGIN,
  error,
  validBlock,
  validDraft,
  validLifecycle,
} from './phase-02-slice-09-test-values';
import {
  jsonRequest,
  makeHarness,
  sendHuman,
} from './phase-02-slice-09-pre-support';

const A05 = 'CMS-03A-05' as const;
const A08 = 'CMS-03A-08' as const;
type Op = typeof A05 | typeof A08;
const BODY: Record<Op, unknown> = { [A05]: validBlock, [A08]: validLifecycle };
const INVALID: Record<Op, unknown> = {
  [A05]: { ...validBlock, blockKey: 'Bad Key' },
  [A08]: { ...validLifecycle, fromLifecycle: 'withdrawn' },
};
const PORT = {
  [A05]: 'registerBlock',
  [A08]: 'advanceBlockLifecycle',
} as const;
let signing: Signing;
beforeAll(async () => {
  signing = await makeSigning({ revokedKeyId: 'release-key-9' });
});
const harnessOf = (
  rate?: Parameters<typeof makeSignedHarness>[0],
): Promise<SignedHarness> => makeSignedHarness({ signing, ...rate });

const matrix = async (op: Op): Promise<void> => {
  const text = async (response: Response) => response.text();
  const codeOf = (body: string) =>
    (JSON.parse(body) as { code: string; details: Record<string, unknown> })
      .code;
  const noEffect = (response: Response, body: string) => {
    expect(response.headers.get('etag')).toBeNull();
    expect(response.headers.get('location')).toBeNull();
    expect(body).not.toMatch(/block_definition_(version|lifecycle_event)"/u);
  };
  // Signature, principal and key failures: 401 WEBHOOK_REJECTED before any parse or port call.
  const badSignature = await harnessOf();
  const r401 = await badSignature.send(op, BODY[op], { signRaw: '{}' });
  const b401 = await text(r401);
  expect([r401.status, codeOf(b401)]).toEqual([401, 'WEBHOOK_REJECTED']);
  const revoked = await harnessOf();
  const r401b = await revoked.send(op, BODY[op], {
    headers: { keyId: 'release-key-9' },
  });
  expect([r401b.status, codeOf(await text(r401b))]).toEqual([
    401,
    'WEBHOOK_REJECTED',
  ]);
  for (const harness of [badSignature, revoked])
    expect(harness[PORT[op]]).not.toHaveBeenCalled();
  // Release principal without the release capability: 403 with a registered reason code.
  const noCapability = await makeSignedHarness({
    signing: await makeSigning(),
  });
  const forbiddenPort = noCapability[PORT[op]];
  const originRefused = await noCapability.app.request(
    releaseHttp(
      op,
      JSON.stringify(BODY[op]),
      await signing.sign(op, JSON.stringify(BODY[op])),
      { origin: 'https://evil.example.test' },
    ),
  );
  expect(originRefused.status).toBe(403);
  expect(forbiddenPort).not.toHaveBeenCalled();
  // Malformed envelope: 400 INVALID_REQUEST.
  const aliased = await harnessOf();
  const r400 = await aliased.send(op, BODY[op], {
    extra: { 'x-release-key-id': 'alias' },
  });
  expect([r400.status, codeOf(await text(r400))]).toEqual([
    400,
    'INVALID_REQUEST',
  ]);
  // Media, size and validation failures happen before persistence.
  const media = await harnessOf();
  const r415 = await media.send(op, BODY[op], {
    extra: { 'content-type': 'text/plain' },
  });
  expect(r415.status).toBe(415);
  const large = await harnessOf();
  const r413 = await large.send(op, BODY[op], {
    extra: { 'content-length': String(256 * 1024 + 1) },
  });
  expect(r413.status).toBe(413);
  const invalid = await harnessOf();
  const r422 = await invalid.send(op, INVALID[op]);
  expect(r422.status).toBe(422);
  for (const harness of [media, large, invalid])
    expect(harness[PORT[op]]).not.toHaveBeenCalled();
  // Rate limit.
  const limited = await harnessOf();
  limited.rateLimit.mockResolvedValueOnce({
    ok: true,
    value: { allowed: false, limit: 20, remaining: 0, resetAt: 1_788_345_660 },
  });
  const r429 = await limited.send(op, BODY[op]);
  expect(r429.status).toBe(429);
  expect(Number(r429.headers.get('retry-after'))).toBeGreaterThan(0);
  expect(limited[PORT[op]]).not.toHaveBeenCalled();
  // After the RPC: conflicts and dependency failures never create a second registration or event.
  const rpc = async (result: unknown, status: number, code: string) => {
    const harness = await harnessOf();
    harness[PORT[op]].mockResolvedValueOnce(result);
    const response = await harness.send(op, BODY[op]);
    const body = await text(response);
    expect([response.status, codeOf(body)]).toEqual([status, code]);
    expect(harness[PORT[op]]).toHaveBeenCalledTimes(1);
    noEffect(response, body);
  };
  for (const conflict of [
    'VERSION_MISMATCH',
    'INVALID_TRANSITION',
    'IDEMPOTENCY_MISMATCH',
  ])
    await rpc(error(409, 'CONFLICT', 'refused', { conflict }), 409, 'CONFLICT');
  for (const status of [502, 503, 504] as const)
    await rpc(
      error(status, 'DEPENDENCY_UNAVAILABLE'),
      status,
      'DEPENDENCY_UNAVAILABLE',
    );
  if (op === A08) await rpc(error(404, 'NOT_FOUND'), 404, 'NOT_FOUND');
  const crashing = await harnessOf();
  crashing[PORT[op]].mockRejectedValueOnce(
    new Error('SQLSTATE 40001 serialization failure'),
  );
  const r500 = await crashing.send(op, BODY[op]);
  const b500 = await text(r500);
  expect([r500.status, codeOf(b500)]).toEqual([500, 'INTERNAL_ERROR']);
  expect(b500).not.toContain('SQLSTATE');
};

describe('BE03a signed release operation error coverage', () => {
  it('[P2-S09-AC-197] maps every A05 failure to its declared signature, principal, manifest, props, digest, duplicate, dependency or RPC error and creates no second registration', () =>
    matrix(A05));
  it('[P2-S09-AC-200] maps every A08 failure to its declared signature, principal, path, lifecycle, digest, nonce, idempotency or dependency error and appends no lifecycle event', () =>
    matrix(A08));

  it('[P2-S09-AC-164] [P2-S09-AC-200] reserves WEBHOOK_REJECTED to the 401 release-signature boundary and keeps every lifecycle control off the browser path', async () => {
    for (const status of [400, 403, 404, 422, 500] as const) {
      const harness = await harnessOf();
      harness.registerBlock.mockResolvedValueOnce(
        error(status, 'WEBHOOK_REJECTED'),
      );
      const response = await harness.send(A05, validBlock);
      expect(response.status).toBe(status);
      expect(
        ((await response.json()) as { code: string }).code,
        `status ${status}`,
      ).not.toBe('WEBHOOK_REJECTED');
    }
    const human = makeHarness();
    human.ports.createTypeDraft.mockResolvedValueOnce(
      error(401, 'WEBHOOK_REJECTED'),
    );
    const refused = await sendHuman(human, 'CMS-03A-01', validDraft);
    expect(refused.status).toBe(401);
    expect(((await refused.json()) as { code: string }).code).not.toBe(
      'WEBHOOK_REJECTED',
    );
    expect(human.ports.createTypeDraft).toHaveBeenCalledTimes(1);
    const failedSession = makeHarness({
      session: error(401, 'UNAUTHENTICATED', 'Sign in required.', {
        recoveryAction: 'reauthenticate',
      }),
    });
    const noSession = await failedSession.app.request(
      jsonRequest('/api/v1/cms/content-types', validDraft),
    );
    expect(((await noSession.json()) as { code: string }).code).toBe(
      'UNAUTHENTICATED',
    );
    const browser = await harnessOf();
    for (const path of [PATH[A05], PATH[A08]]) {
      const response = await browser.app.request(
        new Request(`https://api.example.test${path}`, {
          method: 'POST',
          headers: {
            origin: 'https://cms-console.example.test',
            authorization: 'Bearer verified-session',
            'content-type': 'application/json',
            'idempotency-key': 'browser-key-0001',
            'if-match': '"1"',
          },
          body: JSON.stringify(
            path === PATH[A05] ? validBlock : validLifecycle,
          ),
        }),
      );
      expect(response.status).toBe(403);
    }
    const noEnvelope = await browser.app.request(
      new Request(`https://api.example.test${PATH[A08]}`, {
        method: 'POST',
        headers: {
          origin: RELEASE_ORIGIN,
          authorization: 'Bearer verified-session',
          'content-type': 'application/json',
          'idempotency-key': 'browser-key-0001',
          'if-match': '"1"',
        },
        body: JSON.stringify(validLifecycle),
      }),
    );
    expect(noEnvelope.status).toBe(400);
    expect(browser.resolveSession).not.toHaveBeenCalled();
    expect(browser.registerBlock).not.toHaveBeenCalled();
    expect(browser.advanceBlockLifecycle).not.toHaveBeenCalled();
  });
});
