import { describe, expect, it } from 'vitest';

import { ContentSchemaRegistryRecordSchema } from './resources-aggregates.ts';
import { SchemaArtifactResourceSchema } from './resources-artifacts.ts';

const INSTANT = '2026-09-02T12:00:00.000Z';
const artifact = {
  resourceKind: 'schema_artifact',
  id: '60000000-0000-4000-8000-000000000006',
  version: '1',
  state: 'compiled',
  contentTypeVersionId: '40000000-0000-4000-8000-000000000004',
  compilerVersion: 'cms-compiler-1',
  zodContractRef: 'zod/content-type/v1',
  artifactHash: 'a'.repeat(64),
  createdAt: INSTANT,
  updatedAt: INSTANT,
  compiledAt: INSTANT,
} as const;

describe('[P2-S09-AC-007] the compiled artifact resource is strict and carries only references and a hash', () => {
  it('accepts the exact artifact reference shape', () => {
    expect(SchemaArtifactResourceSchema.safeParse(artifact).success).toBe(true);
    expect(ContentSchemaRegistryRecordSchema.safeParse(artifact).success).toBe(
      true,
    );
  });

  it.each([
    ['zodManifest', {}],
    ['openapiManifest', {}],
    ['editorManifest', {}],
    ['rendererManifest', {}],
    ['databaseManifest', {}],
    ['ownerId', '10000000-0000-4000-8000-000000000001'],
    ['surprise', true],
  ])('rejects the unknown member %s', (member, value) => {
    const polluted = { ...artifact, [member]: value };
    expect(SchemaArtifactResourceSchema.safeParse(polluted).success).toBe(
      false,
    );
    expect(ContentSchemaRegistryRecordSchema.safeParse(polluted).success).toBe(
      false,
    );
  });

  it.each([
    ['artifactHash', 'A'.repeat(64)],
    ['artifactHash', 'a'.repeat(63)],
    ['state', 'draft'],
    ['compilerVersion', ''],
  ])('rejects a malformed %s', (member, value) => {
    expect(
      SchemaArtifactResourceSchema.safeParse({ ...artifact, [member]: value })
        .success,
    ).toBe(false);
  });
});
