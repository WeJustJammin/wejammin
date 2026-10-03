/**
 * Signed-release harness for the A05/A08 acceptance-evidence suites. The Ed25519
 * key pair is generated per run and the real production release verifier checks
 * every request; only the persistence ports (and, for the production variant,
 * the platform RPC transport) are faked.
 */
import { vi } from 'vitest';

import {
  createContentSchemaRegistryApp,
  type ContentSchemaRegistryDependencies,
} from './index';
import { digestHex } from './release-crypto';
import { createReleaseVerifier, releaseSigningBytes } from './release-verifier';
import {
  API_ORIGIN,
  BLOCK_ID,
  CMS_ORIGIN,
  NONCE,
  RELEASE_ORIGIN,
  REQUEST_ID,
  block,
  lifecycleEvent,
  ok,
  resource,
  session,
} from './phase-02-slice-09-test-values';

export const KEY_ID = 'release-key-1';
export const NOW = Date.parse('2026-09-02T12:00:00.000Z');
export const ISSUED_AT = '2026-09-02T12:00:00.000Z';
export const PRINCIPAL_ID = 'a9090000-0000-0000-0000-000000000002';

type Operation = 'CMS-03A-05' | 'CMS-03A-08';
export const PATH: Record<Operation, string> = {
  'CMS-03A-05': '/api/v1/cms/blocks/versions',
  'CMS-03A-08': `/api/v1/cms/blocks/versions/${BLOCK_ID}/lifecycle`,
};

const toBase64 = (bytes: ArrayBuffer): string =>
  Buffer.from(new Uint8Array(bytes)).toString('base64');

export type Signing = Readonly<{
  registry: string;
  publicKey: string;
  sign: (
    operationId: Operation,
    rawBody: string,
    headers?: Partial<{ keyId: string; issuedAt: string; nonce: string }>,
  ) => Promise<Record<string, string>>;
}>;

export const makeSigning = async (
  keys: Readonly<{
    revokedAt?: string | null;
    validUntil?: string;
    /** A second, valid key id that shares the public key (tests exact keyId binding). */
    aliasKeyId?: string;
    /** A revoked key id that shares the public key. */
    revokedKeyId?: string;
  }> = {},
): Promise<Signing> => {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const publicKey = toBase64(
    (await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer,
  );
  const entry = (keyId: string, revokedAt: string | null) => ({
    keyId,
    principalId: PRINCIPAL_ID,
    publicKey,
    validFrom: '2026-09-01T00:00:00.000Z',
    validUntil: keys.validUntil ?? '2026-12-01T00:00:00.000Z',
    revokedAt,
    capabilities: ['release.block_registry.write'],
  });
  const registry = JSON.stringify({
    version: 1,
    keys: [
      entry(KEY_ID, keys.revokedAt ?? null),
      ...(keys.aliasKeyId === undefined ? [] : [entry(keys.aliasKeyId, null)]),
      ...(keys.revokedKeyId === undefined
        ? []
        : [entry(keys.revokedKeyId, '2026-09-01T12:00:00.000Z')]),
    ],
  });
  const sign: Signing['sign'] = async (operationId, rawBody, headers = {}) => {
    const keyId = headers.keyId ?? KEY_ID;
    const issuedAt = headers.issuedAt ?? ISSUED_AT;
    const nonce = headers.nonce ?? NONCE;
    const rawBodyHash = await digestHex(new TextEncoder().encode(rawBody));
    const signature = await crypto.subtle.sign(
      { name: 'Ed25519' },
      pair.privateKey,
      releaseSigningBytes({
        operationId,
        headers: { keyId, issuedAt, nonce },
        rawBodyHash,
      }),
    );
    return {
      'X-WeJammin-Release-Key-Id': keyId,
      'X-WeJammin-Release-Issued-At': issuedAt,
      'X-WeJammin-Release-Nonce': nonce,
      'X-WeJammin-Release-Signature': toBase64(signature),
    };
  };
  return { registry, publicKey, sign };
};

export const releaseHttp = (
  operationId: Operation,
  rawBody: string,
  headers: Record<string, string>,
  extra: Record<string, string> = {},
): Request =>
  new Request(`${API_ORIGIN}${PATH[operationId]}`, {
    method: 'POST',
    headers: {
      origin: RELEASE_ORIGIN,
      'content-type': 'application/json',
      'idempotency-key': 'release-pre-key-0001',
      'x-request-id': REQUEST_ID,
      ...(operationId === 'CMS-03A-08' ? { 'if-match': '"1"' } : {}),
      ...headers,
      ...extra,
    },
    body: rawBody,
  });

export type SignedHarness = Readonly<{
  app: ReturnType<typeof createContentSchemaRegistryApp>;
  signing: Signing;
  registerBlock: ReturnType<typeof vi.fn>;
  advanceBlockLifecycle: ReturnType<typeof vi.fn>;
  rateLimit: ReturnType<typeof vi.fn>;
  resolveSession: ReturnType<typeof vi.fn>;
  telemetry: ReturnType<typeof vi.fn>;
  send: (
    operationId: Operation,
    body: unknown,
    options?: Readonly<{
      raw?: string;
      headers?: Partial<{ keyId: string; issuedAt: string; nonce: string }>;
      extra?: Record<string, string>;
      signWith?: Operation;
      signRaw?: string;
    }>,
  ) => Promise<Response>;
}>;

export const makeSignedHarness = async (
  options: Readonly<{ signing?: Signing; now?: () => number }> = {},
): Promise<SignedHarness> => {
  const signing = options.signing ?? (await makeSigning());
  const registerBlock = vi.fn(async () => ok(block));
  const advanceBlockLifecycle = vi.fn(async () => ok(lifecycleEvent));
  // No release operation reaches these ports or the session resolver; a
  // resolved value (not a function body) keeps them inert and truthful.
  const unused = vi.fn().mockResolvedValue(ok(resource));
  const rateLimit = vi.fn(async () =>
    ok({ allowed: true, limit: 20, remaining: 19, resetAt: 1_788_345_600 }),
  );
  const resolveSession = vi.fn().mockResolvedValue(ok(session));
  const telemetry = vi.fn();
  const dependencies: ContentSchemaRegistryDependencies = {
    ports: {
      createTypeDraft: unused,
      addFieldDefinition: unused,
      bindRelation: unused,
      activateSchema: unused,
      registerBlock,
      advanceBlockLifecycle,
      listContentTypes: unused,
      getContentTypeVersion: unused,
    } as unknown as ContentSchemaRegistryDependencies['ports'],
    resolveSession,
    verifyRelease: createReleaseVerifier(
      signing.registry,
      options.now ?? (() => NOW),
    ),
    rateLimit,
    humanOrigins: [CMS_ORIGIN],
    releaseOrigins: [RELEASE_ORIGIN],
    now: options.now ?? (() => NOW),
    telemetry,
  };
  const app = createContentSchemaRegistryApp(dependencies);
  const send: SignedHarness['send'] = async (
    operationId,
    body,
    sendOptions = {},
  ) => {
    const raw = sendOptions.raw ?? JSON.stringify(body);
    const signed = await signing.sign(
      sendOptions.signWith ?? operationId,
      sendOptions.signRaw ?? raw,
      sendOptions.headers,
    );
    return app.request(
      releaseHttp(operationId, raw, signed, sendOptions.extra),
    );
  };
  return {
    app,
    signing,
    registerBlock,
    advanceBlockLifecycle,
    rateLimit,
    resolveSession,
    telemetry,
    send,
  };
};
