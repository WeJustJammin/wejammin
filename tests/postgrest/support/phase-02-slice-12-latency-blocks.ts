/**
 * Registers the one block the pattern latency world composes, through the production CMS-03A-05 release route.
 *
 * A pattern tree may nest a block only if the block's registered `allowedChildren` and `slotRules` admit it (DEC-210), so the
 * block of this world lists itself as an allowed child and allows the 512-node, depth-8 bounds the latency suites measure.
 * `createReleaseSigner` (cms-release.ts) fixes both members to the empty rule, so this is its twin with those two members set:
 * one Ed25519 key registered in the Worker's release key registry AND in `cfg_release_principals`, the request signed over its
 * untouched bytes, and the props attestation signed over the same payload the database verifies.
 */
import {
  createHash,
  generateKeyPairSync,
  randomUUID,
  sign,
  type KeyObject,
} from 'node:crypto';

import { releaseSigningBytes } from '../../../apps/worker/src/content-schema-registry/release-crypto';
import { CMS_TEST_RELEASE_ORIGIN, createCmsApp, ownerSession } from './cms-app';
import { createAuthUser, psql, type CmsOwner } from './stack';

export const LATENCY_BLOCK_KEY = 's12lat.block';
export const LATENCY_BLOCK_VERSION = 1;

const sha256Hex = (value: string | Buffer): string =>
  createHash('sha256').update(value).digest('hex');
const rawPublicKey = (key: KeyObject): Buffer =>
  Buffer.from(String(key.export({ format: 'jwk' }).x), 'base64url');

/**
 * Registers the block once per database and returns its block version id. The block registry is global by
 * (block_key, block_version) and no 03c reader scopes a block by owner, so a later spec in the same `pnpm db:api-test`
 * run (compose and patterns both need the block) reuses the registered row instead of meeting the 409 a second
 * registration of the same pair answers.
 */
export const registerLatencyBlock = async (
  owner: CmsOwner,
): Promise<string> => {
  const registered = psql(
    `select id from platform_private.cms_block_definition_versions where block_key = '${LATENCY_BLOCK_KEY}' and block_version = ${String(LATENCY_BLOCK_VERSION)}`,
  );
  if (registered !== '') return registered;
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const keyId = `release.lat.${randomUUID().slice(0, 8)}`;
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
  const snapshot = {
    schemaVersion: '1',
    fields: [
      { name: 'title', kind: 'string', required: false, constraints: {} },
    ],
    additionalProperties: false,
  };
  const propsSnapshotHash = psql(
    `select platform_private.cms_jcs_sha256('${JSON.stringify(snapshot)}'::jsonb)`,
  );
  const base = {
    blockKey: LATENCY_BLOCK_KEY,
    blockVersion: LATENCY_BLOCK_VERSION,
    propsSchemaRef: 'cms/blocks/hero/1',
    propsSchemaHash: 'a'.repeat(64),
    propsSchemaSnapshot: snapshot,
    propsSnapshotHash,
    rendererRef: 'cms/renderers/hero/1',
    allowedChildren: [LATENCY_BLOCK_KEY],
    slotRules: { maxDepth: 8, maxNodes: 512 },
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
  const attestation = [
    'WEJAMMIN-CMS-03A-05-PROPS-V1',
    base.blockKey,
    String(base.blockVersion),
    base.propsSchemaRef,
    base.propsSchemaHash,
    base.propsSnapshotHash,
    base.releaseDigest,
  ].join('\n');
  const rawBody = JSON.stringify({
    ...base,
    propsSnapshotAttestation: {
      algorithm: 'Ed25519',
      keyId,
      signature: sign(null, Buffer.from(attestation), privateKey).toString(
        'base64',
      ),
    },
  });
  const nonce = randomUUID();
  const issuedAt = new Date().toISOString();
  const signature = sign(
    null,
    Buffer.from(
      releaseSigningBytes({
        operationId: 'CMS-03A-05',
        headers: { keyId, issuedAt, nonce },
        rawBodyHash: sha256Hex(rawBody),
      }),
    ),
    privateKey,
  );
  const app = createCmsApp(
    ownerSession(owner.authUserId, owner.organizationId, [
      'cms.schema_designer',
    ]),
    { releaseRegistry: registry },
  );
  const answer = await app.sendRaw(
    'POST',
    '/api/v1/cms/blocks/versions',
    {
      origin: CMS_TEST_RELEASE_ORIGIN,
      'content-type': 'application/json',
      'idempotency-key': `release-${randomUUID()}`,
      'x-wejammin-release-key-id': keyId,
      'x-wejammin-release-issued-at': issuedAt,
      'x-wejammin-release-nonce': nonce,
      'x-wejammin-release-signature': signature.toString('base64'),
    },
    rawBody,
  );
  if (answer.status !== 201)
    throw new Error(
      `block registration answered ${answer.status}: ${JSON.stringify(answer.body).slice(0, 300)}`,
    );
  return String(answer.body.id);
};
