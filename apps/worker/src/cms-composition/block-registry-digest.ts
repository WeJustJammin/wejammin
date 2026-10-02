import {
  BlockDefinitionRegistryRecordSchema,
  CmsHashSchema,
  RegisteredBlockSchema,
} from '@wejammin/contracts';

import { digestHex } from '../content-schema-registry/release-crypto';

type RegistryRecord = ReturnType<
  typeof BlockDefinitionRegistryRecordSchema.parse
>;

export type BlockRegistryDigestErrorCode =
  | 'block_registry_ref_invalid'
  | 'block_registry_record_invalid'
  | 'block_registry_ref_missing'
  | 'block_registry_ref_duplicate'
  | 'block_registry_ref_withdrawn'
  | 'block_registry_ref_incompatible'
  | 'block_registry_compatibility_policy_missing'
  | 'block_registry_digest_invalid'
  | 'block_registry_digest_mismatch';

export class BlockRegistryDigestError extends Error {
  constructor(readonly code: BlockRegistryDigestErrorCode) {
    super(code);
    this.name = 'BlockRegistryDigestError';
  }
}

const refKey = (blockKey: string, blockVersion: number): string =>
  `${blockKey}\u0000${blockVersion}`;

/**
 * Recompute the BE03c digest from records resolved by the server from 03a's
 * capability-safe registry. Never pass client-supplied block records here.
 * Compatibility includes the caller's content-type and lifecycle policy.
 */
export const computeBlockRegistryDigest = async (input: {
  reachableRefs: readonly unknown[];
  registryRecords: readonly unknown[];
  isCompatible: (record: RegistryRecord) => boolean;
  expectedDigest?: string;
}): Promise<string> => {
  if (!Array.isArray(input.reachableRefs))
    throw new BlockRegistryDigestError('block_registry_ref_invalid');
  if (!Array.isArray(input.registryRecords))
    throw new BlockRegistryDigestError('block_registry_record_invalid');
  if (typeof input.isCompatible !== 'function')
    throw new BlockRegistryDigestError(
      'block_registry_compatibility_policy_missing',
    );
  if (
    input.expectedDigest !== undefined &&
    !CmsHashSchema.safeParse(input.expectedDigest).success
  )
    throw new BlockRegistryDigestError('block_registry_digest_invalid');

  const reachable = new Set<string>();
  for (const candidate of input.reachableRefs) {
    const parsed = RegisteredBlockSchema.safeParse(candidate);
    if (!parsed.success)
      throw new BlockRegistryDigestError('block_registry_ref_invalid');
    reachable.add(refKey(parsed.data.blockKey, parsed.data.blockVersion));
  }

  const resolved = new Map<string, RegistryRecord>();
  for (const candidate of input.registryRecords) {
    const parsed = BlockDefinitionRegistryRecordSchema.safeParse(candidate);
    if (!parsed.success)
      throw new BlockRegistryDigestError('block_registry_record_invalid');
    const record = parsed.data;
    const key = refKey(record.blockKey, record.blockVersion);
    if (!reachable.has(key)) continue;
    if (resolved.has(key))
      throw new BlockRegistryDigestError('block_registry_ref_duplicate');
    resolved.set(key, record);
  }

  const tuples: Array<{
    blockKey: string;
    blockVersion: number;
    lifecycle: RegistryRecord['lifecycle'];
    propsSchemaHash: string;
    releaseDigest: string;
    rendererRef: string;
  }> = [];
  for (const key of reachable) {
    const record = resolved.get(key);
    if (!record)
      throw new BlockRegistryDigestError('block_registry_ref_missing');
    if (record.lifecycle === 'withdrawn')
      throw new BlockRegistryDigestError('block_registry_ref_withdrawn');
    if (!input.isCompatible(record))
      throw new BlockRegistryDigestError('block_registry_ref_incompatible');
    tuples.push({
      blockKey: record.blockKey,
      blockVersion: record.blockVersion,
      lifecycle: record.lifecycle,
      propsSchemaHash: record.propsSchemaHash,
      releaseDigest: record.releaseDigest,
      rendererRef: record.rendererRef,
    });
  }
  // The parsed tuple values are ASCII-only strings and bounded integers.
  // Thus these JCS-ordered members plus JSON.stringify are RFC 8785 exact;
  // JS string order also equals UTF-8 byte order for parsed block keys.
  tuples.sort((left, right) =>
    left.blockKey < right.blockKey
      ? -1
      : left.blockKey > right.blockKey
        ? 1
        : left.blockVersion - right.blockVersion,
  );
  const digest = await digestHex(
    new TextEncoder().encode(JSON.stringify(tuples)),
  );
  if (input.expectedDigest !== undefined && input.expectedDigest !== digest)
    throw new BlockRegistryDigestError('block_registry_digest_mismatch');
  return digest;
};
