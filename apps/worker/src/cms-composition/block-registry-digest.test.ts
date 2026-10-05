import { describe, expect, it } from 'vitest';

import { computeBlockRegistryDigest } from './block-registry-digest';

const alphaHash = 'a'.repeat(64);
const betaHash = 'b'.repeat(64);
const alpha = {
  resourceKind: 'block_definition_registry_record',
  id: '123e4567-e89b-42d3-a456-426614174001',
  version: '1',
  blockKey: 'profile.header',
  blockVersion: 2,
  propsSchemaRef: 'schemas/profile-header-v2',
  propsSchemaHash: alphaHash,
  rendererRef: 'renderers/profile-header-v2',
  releaseDigest: betaHash,
  lifecycle: 'supported',
} as const;
const beta = {
  ...alpha,
  id: '123e4567-e89b-42d3-a456-426614174002',
  blockKey: 'profile.body',
  blockVersion: 1,
  propsSchemaRef: 'schemas/profile-body-v1',
  propsSchemaHash: betaHash,
  rendererRef: 'renderers/profile-body-v1',
  releaseDigest: alphaHash,
  lifecycle: 'deprecated',
} as const;
const refs = [
  { blockKey: alpha.blockKey, blockVersion: alpha.blockVersion },
  { blockKey: beta.blockKey, blockVersion: beta.blockVersion },
];
const permitted = () => true;

const canonical =
  '[{"blockKey":"profile.body","blockVersion":1,"lifecycle":"deprecated","propsSchemaHash":"' +
  betaHash +
  '","releaseDigest":"' +
  alphaHash +
  '","rendererRef":"renderers/profile-body-v1"},{"blockKey":"profile.header","blockVersion":2,"lifecycle":"supported","propsSchemaHash":"' +
  alphaHash +
  '","releaseDigest":"' +
  betaHash +
  '","rendererRef":"renderers/profile-header-v2"}]';
const sha256 = async (value: string): Promise<string> =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

describe('BE03c server-authoritative block registry digest', () => {
  it('hashes only reachable safe tuples in UTF-8 key and numeric version order', async () => {
    const digest = await computeBlockRegistryDigest({
      reachableRefs: [refs[0], refs[1], refs[0]],
      registryRecords: [alpha, beta],
      isCompatible: permitted,
    });
    expect(digest).toBe(await sha256(canonical));
    expect(
      await computeBlockRegistryDigest({
        reachableRefs: [refs[1], refs[0]],
        registryRecords: [beta, alpha],
        isCompatible: permitted,
      }),
    ).toBe(await sha256(canonical));
  });

  it('orders two versions of one key numerically and ignores unrelated safe records', async () => {
    const later = {
      ...alpha,
      id: '123e4567-e89b-42d3-a456-426614174003',
      blockVersion: 10,
    };
    const unrelated = {
      ...alpha,
      id: '123e4567-e89b-42d3-a456-426614174004',
      blockKey: 'unrelated.block',
    };
    const tuple = (version: number) =>
      '{"blockKey":"profile.header","blockVersion":' +
      version +
      ',"lifecycle":"supported","propsSchemaHash":"' +
      alphaHash +
      '","releaseDigest":"' +
      betaHash +
      '","rendererRef":"renderers/profile-header-v2"}';
    const ordered = `[${tuple(2)},${tuple(10)}]`;
    expect(
      await computeBlockRegistryDigest({
        reachableRefs: [
          { blockKey: alpha.blockKey, blockVersion: 10 },
          refs[0],
        ],
        registryRecords: [later, unrelated, alpha],
        isCompatible: permitted,
      }),
    ).toBe(await sha256(ordered));
  });

  it('compares a caller digest only as an expectation', async () => {
    const expected = await sha256(canonical);
    expect(
      await computeBlockRegistryDigest({
        reachableRefs: refs,
        registryRecords: [alpha, beta],
        isCompatible: permitted,
        expectedDigest: expected,
      }),
    ).toBe(expected);
    await expect(
      computeBlockRegistryDigest({
        reachableRefs: refs,
        registryRecords: [alpha, beta],
        isCompatible: permitted,
        expectedDigest: alphaHash,
      }),
    ).rejects.toMatchObject({ code: 'block_registry_digest_mismatch' });
  });

  it('rejects missing, withdrawn, duplicate, or incompatible reachable blocks', async () => {
    const cases = [
      { registryRecords: [alpha], code: 'block_registry_ref_missing' },
      {
        registryRecords: [alpha, { ...beta, lifecycle: 'withdrawn' }],
        code: 'block_registry_ref_withdrawn',
      },
      {
        registryRecords: [alpha, beta, beta],
        code: 'block_registry_ref_duplicate',
      },
    ];
    for (const candidate of cases)
      await expect(
        computeBlockRegistryDigest({
          reachableRefs: refs,
          registryRecords: candidate.registryRecords,
          isCompatible: permitted,
        }),
      ).rejects.toMatchObject({ code: candidate.code });
    await expect(
      computeBlockRegistryDigest({
        reachableRefs: refs,
        registryRecords: [alpha, beta],
        isCompatible: (record) => record.blockKey !== beta.blockKey,
      }),
    ).rejects.toMatchObject({ code: 'block_registry_ref_incompatible' });
  });

  it('rejects malformed references and unsafe registry projections', async () => {
    await expect(
      computeBlockRegistryDigest({
        reachableRefs: [{ blockKey: 'Bad', blockVersion: 1 }],
        registryRecords: [alpha],
        isCompatible: permitted,
      }),
    ).rejects.toMatchObject({ code: 'block_registry_ref_invalid' });
    await expect(
      computeBlockRegistryDigest({
        reachableRefs: [refs[0]],
        registryRecords: [{ ...alpha, releaseKeyId: 'private-key-id' }],
        isCompatible: permitted,
      }),
    ).rejects.toMatchObject({ code: 'block_registry_record_invalid' });
    await expect(
      computeBlockRegistryDigest({
        reachableRefs: [refs[0]],
        registryRecords: [alpha],
        isCompatible: permitted,
        expectedDigest: 'A'.repeat(64),
      }),
    ).rejects.toMatchObject({ code: 'block_registry_digest_invalid' });
  });

  it('fails closed when runtime inputs omit record arrays or compatibility policy', async () => {
    const base = {
      reachableRefs: [refs[0]],
      registryRecords: [alpha],
      isCompatible: permitted,
    };
    const malformed = [
      { ...base, reachableRefs: null },
      { ...base, registryRecords: null },
      { ...base, isCompatible: null },
    ];
    const codes = [
      'block_registry_ref_invalid',
      'block_registry_record_invalid',
      'block_registry_compatibility_policy_missing',
    ];
    for (const [index, candidate] of malformed.entries())
      await expect(
        computeBlockRegistryDigest(
          candidate as unknown as Parameters<
            typeof computeBlockRegistryDigest
          >[0],
        ),
      ).rejects.toMatchObject({ code: codes[index] });
  });
});
