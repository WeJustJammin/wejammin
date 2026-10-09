import { describe, expect, it } from 'vitest';

import {
  DependencyManifestSchema,
  VersionSetSchema,
  versionSetMatchesManifest,
  versionSetOf,
} from './index';
import {
  hash2,
  uid,
  uuid3,
  validDependencyManifest,
  validVersionSet,
} from './workflow-fixtures.test-support';

describe('[P2-S11-AC-089] versionSetOf(manifest, revision): the pure projection', () => {
  it('copies the schema, template, settings and compiler members from the manifest', () => {
    const manifest = DependencyManifestSchema.parse(validDependencyManifest);
    const versionSet = versionSetOf(
      manifest,
      validVersionSet.taxonomyVersionIds,
    );
    expect(versionSet).toEqual(validVersionSet);
    expect(VersionSetSchema.safeParse(versionSet).success).toBe(true);
  });

  it('sets template id and hash to null together when the manifest has no template', () => {
    const manifest = DependencyManifestSchema.parse({
      ...validDependencyManifest,
      template: null,
    });
    const versionSet = versionSetOf(manifest, []);
    expect(versionSet.templateVersionId).toBeNull();
    expect(versionSet.templateHash).toBeNull();
    expect(VersionSetSchema.safeParse(versionSet).success).toBe(true);
  });

  it('takes block and pattern ids from the manifest and the revision taxonomy ids sorted bytewise', () => {
    const manifest = DependencyManifestSchema.parse({
      ...validDependencyManifest,
      blocks: [uid(1), uid(2)].map((id) => ({ id, hash: hash2 })),
      patterns: [uid(3)].map((id) => ({ id, hash: hash2 })),
    });
    const versionSet = versionSetOf(manifest, [uid(9), uid(4), uid(7)]);
    expect(versionSet.blockVersionIds).toEqual([uid(1), uid(2)]);
    expect(versionSet.patternVersionIds).toEqual([uid(3)]);
    expect(versionSet.taxonomyVersionIds).toEqual([uid(4), uid(7), uid(9)]);
    expect(versionSet.settingsVersion).toBe(manifest.settings.version);
    expect(versionSet.compilerVersion).toBe(
      manifest.schema.schemaArtifact.compilerVersion,
    );
  });

  it('does not mutate its inputs and returns a fresh taxonomy list', () => {
    const manifest = DependencyManifestSchema.parse(validDependencyManifest);
    const taxonomy = [uid(9), uid(4)];
    const versionSet = versionSetOf(manifest, taxonomy);
    expect(taxonomy).toEqual([uid(9), uid(4)]);
    expect(versionSet.taxonomyVersionIds).not.toBe(taxonomy);
  });

  it('recognizes a version set that projects its manifest (taxonomy aside) and refuses any drift', () => {
    const manifest = DependencyManifestSchema.parse(validDependencyManifest);
    const set = VersionSetSchema.parse(validVersionSet);
    expect(versionSetMatchesManifest(set, manifest)).toBe(true);
    expect(
      versionSetMatchesManifest(
        { ...set, taxonomyVersionIds: [uuid3] },
        manifest,
      ),
    ).toBe(true);
    expect(
      versionSetMatchesManifest({ ...set, schemaHash: hash2 }, manifest),
    ).toBe(false);
    expect(
      versionSetMatchesManifest({ ...set, settingsVersion: '9' }, manifest),
    ).toBe(false);
    expect(
      versionSetMatchesManifest({ ...set, blockVersionIds: [] }, manifest),
    ).toBe(false);
    expect(
      versionSetMatchesManifest(
        { ...set, patternVersionIds: [uuid3] },
        manifest,
      ),
    ).toBe(false);
    expect(
      versionSetMatchesManifest(
        { ...set, templateVersionId: null, templateHash: null },
        manifest,
      ),
    ).toBe(false);
    expect(
      versionSetMatchesManifest(
        {
          ...set,
          workflowPolicy: { ...set.workflowPolicy, key: 'other.policy' },
        },
        manifest,
      ),
    ).toBe(false);
    expect(
      versionSetMatchesManifest(
        {
          ...set,
          activationEvidence: { ...set.activationEvidence, policyHash: hash2 },
        },
        manifest,
      ),
    ).toBe(false);
    expect(
      versionSetMatchesManifest({ ...set, validatorRefs: [] }, manifest),
    ).toBe(false);
  });
});
