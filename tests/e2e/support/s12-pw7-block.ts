/**
 * A pattern block REGISTERED BY THE WORLD OWNER, so the pattern designer's block chooser lists it.
 *
 * Why this exists (pw7 fix round): the designer's chooser is `registeredBlocks` of the template context read
 * (`platform_private.cms_template_context`), which until DEC-243 (`20261029150000`) listed only blocks whose `owner_id` is
 * the acting party; it now lists every registered, supported block, and a run-unique block keeps the spec independent of
 * what other suites registered. The block registry is unique globally by (block_key, block_version) (20260902080000 line 1463), and
 * `registerLatencyBlock` registers one fixed pair once per DATABASE and returns early when any owner already holds it. In a
 * database where another suite's isolated owner registered `s12lat.block@1` first, the pattern CAN be saved through the
 * API (CMS-03C-12 resolves the block globally) but the chooser of this world's designer never lists it, so a form-driven
 * save has nothing to choose and an edit of that pattern shows its block as "no longer registered".
 *
 * This is the twin of `tests/postgrest/support/phase-02-slice-12-latency-blocks.ts` (a shared helper this lane may not
 * edit) with a key unique to the run and the registrant being the world owner. Not type-checked by `pnpm type-check`.
 */
import {
  createHash,
  generateKeyPairSync,
  randomUUID,
  sign,
  type KeyObject,
} from 'node:crypto';

import { releaseSigningBytes } from '../../../apps/worker/src/content-schema-registry/release-crypto';
import {
  CMS_TEST_RELEASE_ORIGIN,
  createCmsApp,
  ownerSession,
} from '../../postgrest/support/cms-app';
import {
  createAuthUser,
  psql,
  type CmsOwner,
} from '../../postgrest/support/stack';
import type { S10Client } from './s10-real-api';
import type { S10World } from './s10-real-world';

export type OwnedBlock = Readonly<{
  blockKey: string;
  blockVersion: number;
  /** The chooser option value: `key@version`. */
  ref: string;
}>;

const sha256Hex = (value: string | Buffer): string =>
  createHash('sha256').update(value).digest('hex');
const rawPublicKey = (key: KeyObject): Buffer =>
  Buffer.from(String(key.export({ format: 'jwk' }).x), 'base64url');

/** CMS-03A-05 through the production signed release route, as `owner`, for a fresh key. */
const registerOwnedBlock = async (owner: CmsOwner): Promise<OwnedBlock> => {
  const blockKey = `s12pw7.b${randomUUID().slice(0, 8).replaceAll('-', '')}`;
  const blockVersion = 1;
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const keyId = `release.pw7.${randomUUID().slice(0, 8)}`;
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
    blockKey,
    blockVersion,
    propsSchemaRef: 'cms/blocks/hero/1',
    propsSchemaHash: 'a'.repeat(64),
    propsSchemaSnapshot: snapshot,
    propsSnapshotHash,
    rendererRef: 'cms/renderers/hero/1',
    allowedChildren: [blockKey],
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
  return { blockKey, blockVersion, ref: `${blockKey}@${String(blockVersion)}` };
};

const registered = new Map<string, Promise<OwnedBlock>>();

/** One block per acting party and process, owned by the world owner (so the designer's chooser lists it). */
export const ownedPatternBlock = (world: S10World): Promise<OwnedBlock> => {
  const key = world.owner.organizationId;
  const known = registered.get(key);
  if (known !== undefined) return known;
  const created = registerOwnedBlock(world.owner);
  registered.set(key, created);
  return created;
};

export type SavedPattern = Readonly<{
  patternKey: string;
  patternId: string;
  versionId: string;
  contentHash: string;
  version: string;
}>;

/** CMS-03C-12 as a template designer over `block`: a first `draft` version with one top-level node. */
export const definePatternWithBlock = async (
  designer: S10Client,
  world: S10World,
  block: OwnedBlock,
  title: string,
): Promise<SavedPattern> => {
  const patternKey = `s12-pw7-${randomUUID().slice(0, 8).replaceAll('-', '')}`;
  const created = await designer.post('/api/v1/cms/patterns/versions', {
    patternKey,
    compatibleTypeIds: [world.contentTypeId],
    blockTree: [
      {
        kind: 'block',
        key: 'root1',
        blockKey: block.blockKey,
        blockVersion: block.blockVersion,
        props: { title },
        children: [],
      },
    ],
    expectedVersion: null,
  });
  if (created.status !== 201)
    throw new Error(`CMS-03C-12 refused: ${created.status} ${created.text}`);
  return {
    patternKey,
    patternId: String(created.body.patternId),
    versionId: String(created.body.id),
    contentHash: String(created.body.contentHash),
    version: String(created.body.version),
  };
};
