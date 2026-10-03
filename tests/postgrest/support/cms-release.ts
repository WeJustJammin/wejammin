/**
 * A real signed release worker for the real-API suites.
 *
 * One Ed25519 key is registered in both places the production system trusts it: the
 * Worker's release key registry (the first verification, over the untouched request
 * bytes) and `cfg_release_principals` (the database's second verification of the same
 * signature and of the nested props attestation). Requests are signed exactly as the
 * production signing payloads define them, so a request that passes here is one the
 * release pipeline could send.
 */
import {
  createHash,
  generateKeyPairSync,
  randomUUID,
  sign,
  type KeyObject,
} from 'node:crypto';

import { releaseSigningBytes } from '../../../apps/worker/src/content-schema-registry/release-crypto';
import { CMS_TEST_RELEASE_ORIGIN } from './cms-app';
import { createAuthUser, psql } from './stack';

export type ReleaseSigner = Readonly<{
  keyId: string;
  principalId: string;
  /** The value of the Worker's CMS_RELEASE_KEY_REGISTRY. */
  registry: string;
  /** A signed CMS-03A-05 registration of a fresh block (key and version unique per call). */
  registration: (
    overrides?: Readonly<{
      blockKey?: string;
      blockVersion?: number;
      nonce?: string;
    }>,
  ) => SignedRelease;
  /** A signed CMS-03A-08 lifecycle advance of the named block version. */
  lifecycle: (
    blockDefinitionVersionId: string,
    overrides?: Readonly<{ nonce?: string }>,
  ) => SignedRelease;
}>;

export type SignedRelease = Readonly<{
  path: string;
  rawBody: string;
  headers: Readonly<Record<string, string>>;
  nonce: string;
}>;

const rawPublicKey = (key: KeyObject): Buffer =>
  Buffer.from(String(key.export({ format: 'jwk' }).x), 'base64url');

const sha256Hex = (value: string | Buffer): string =>
  createHash('sha256').update(value).digest('hex');

/** The same canonical hash the database computes (`cms_jcs_sha256`), asked of the database. */
const snapshotHash = (snapshot: unknown): string =>
  psql(
    `select platform_private.cms_jcs_sha256('${JSON.stringify(snapshot)}'::jsonb)`,
  );

export const createReleaseSigner = (): ReleaseSigner => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const keyId = `release.api.${randomUUID().slice(0, 8)}`;
  const principalId = createAuthUser();
  const raw = rawPublicKey(publicKey);
  psql(
    `insert into platform_private.cfg_release_principals(principal_id, key_id, scope, active, public_key)
     values ('${principalId}', '${keyId}', 'registry-release', true, decode('${raw.toString('hex')}', 'hex'))`,
  );
  const registry = JSON.stringify({
    version: 1,
    keys: [
      {
        keyId,
        principalId,
        publicKey: raw.toString('base64'),
        validFrom: new Date(Date.now() - 3_600_000).toISOString(),
        validUntil: new Date(Date.now() + 3_600_000).toISOString(),
        revokedAt: null,
        capabilities: ['release.block_registry.write'],
      },
    ],
  });

  const envelope = (
    operationId: 'CMS-03A-05' | 'CMS-03A-08',
    path: string,
    body: Record<string, unknown>,
    nonce: string,
    extraHeaders: Readonly<Record<string, string>> = {},
  ): SignedRelease => {
    const rawBody = JSON.stringify(body);
    const issuedAt = new Date().toISOString();
    const signature = sign(
      null,
      Buffer.from(
        releaseSigningBytes({
          operationId,
          headers: { keyId, issuedAt, nonce },
          rawBodyHash: sha256Hex(rawBody),
        }),
      ),
      privateKey,
    );
    return {
      path,
      rawBody,
      nonce,
      headers: {
        origin: CMS_TEST_RELEASE_ORIGIN,
        'content-type': 'application/json',
        'idempotency-key': `release-${randomUUID()}`,
        'x-wejammin-release-key-id': keyId,
        'x-wejammin-release-issued-at': issuedAt,
        'x-wejammin-release-nonce': nonce,
        'x-wejammin-release-signature': signature.toString('base64'),
        ...extraHeaders,
      },
    };
  };

  return {
    keyId,
    principalId,
    registry,
    registration: (overrides = {}) => {
      const blockKey =
        overrides.blockKey ?? `apiblock${randomUUID().slice(0, 8)}`;
      const blockVersion = overrides.blockVersion ?? 1;
      const snapshot = {
        schemaVersion: '1',
        fields: [
          { name: 'title', kind: 'string', required: true, constraints: {} },
        ],
        additionalProperties: false,
      };
      const base = {
        blockKey,
        blockVersion,
        propsSchemaRef: 'cms/blocks/hero/1',
        propsSchemaHash: 'a'.repeat(64),
        propsSchemaSnapshot: snapshot,
        propsSnapshotHash: snapshotHash(snapshot),
        rendererRef: 'cms/renderers/hero/1',
        allowedChildren: [],
        slotRules: { maxDepth: 1, maxNodes: 1 },
        dataSourcePermissions: [],
        accessibility: {
          nameRequired: true,
          keyboard: true,
          focusOrder: 'document',
          statusAnnouncement: true,
        },
        compatibility: { minSchemaCompiler: '1', maxSchemaCompiler: '1' },
        lifecycle: 'supported',
        releaseDigest: 'e'.repeat(64),
      };
      const attestationPayload = [
        'WEJAMMIN-CMS-03A-05-PROPS-V1',
        base.blockKey,
        String(base.blockVersion),
        base.propsSchemaRef,
        base.propsSchemaHash,
        base.propsSnapshotHash,
        base.releaseDigest,
      ].join('\n');
      const body = {
        ...base,
        propsSnapshotAttestation: {
          algorithm: 'Ed25519',
          keyId,
          signature: sign(
            null,
            Buffer.from(attestationPayload),
            privateKey,
          ).toString('base64'),
        },
      };
      return envelope(
        'CMS-03A-05',
        '/api/v1/cms/blocks/versions',
        body,
        overrides.nonce ?? randomUUID(),
      );
    },
    lifecycle: (blockDefinitionVersionId, overrides = {}) =>
      envelope(
        'CMS-03A-08',
        `/api/v1/cms/blocks/versions/${blockDefinitionVersionId}/lifecycle`,
        {
          fromLifecycle: 'supported',
          toLifecycle: 'deprecated',
          expectedVersion: '1',
          releaseDigest: 'e'.repeat(64),
        },
        overrides.nonce ?? randomUUID(),
        { 'if-match': '"1"' },
      ),
  };
};
