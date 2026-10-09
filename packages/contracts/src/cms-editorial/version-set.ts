import { compareValidatorRefs, sortedBytewise } from './canonical-order.ts';
import type {
  DependencyManifest,
  VersionSet,
} from './publication-contracts.ts';

/*
 * BE03b "Frozen dependency manifest build and version set (E1, E7)": the
 * `VersionSet` is the pure projection `versionSetOf(manifest, revision)`.
 * CMS-03B-15 serves both so the forms echo them unmodified into CMS-03B-05,
 * CMS-03B-08 and CMS-03B-09, and the server never accepts a manifest or version
 * set it cannot rebuild bit-for-bit.
 */

/** Order-independent structural equality of two JSON-shaped values. */
export const cmsJsonEqual = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    left === null ||
    right === null
  )
    return false;
  if (Array.isArray(left) || Array.isArray(right))
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => cmsJsonEqual(item, right[index]))
    );
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        cmsJsonEqual(
          (left as Record<string, unknown>)[key],
          (right as Record<string, unknown>)[key],
        ),
    )
  );
};

/**
 * `versionSetOf(manifest, revision)`: `schemaVersionId`, `schemaHash`,
 * `schemaArtifact`, `validatorRefs`, `workflowPolicy` and `activationEvidence`
 * are copied from `manifest.schema`; `templateVersionId` and `templateHash` from
 * `manifest.template` (both `null` when absent); `taxonomyVersionIds` is the
 * revision's taxonomy ids sorted bytewise; `blockVersionIds` and
 * `patternVersionIds` are the manifest ids; `settingsVersion` is
 * `manifest.settings.version`; `compilerVersion` is the schema artifact's.
 * Every list of the result is in canonical ascending order (BE03b E1), so one
 * dependency set has one serialization even when a caller hands over an
 * unsorted hand-built manifest; a parsed manifest is already canonical, so the
 * sort leaves it unchanged.
 */
export const versionSetOf = (
  manifest: DependencyManifest,
  revisionTaxonomyVersionIds: readonly string[],
): VersionSet => ({
  schemaVersionId: manifest.schema.id,
  schemaHash: manifest.schema.hash,
  schemaArtifact: manifest.schema.schemaArtifact,
  validatorRefs: [...manifest.schema.validatorRefs].sort(compareValidatorRefs),
  workflowPolicy: manifest.schema.workflowPolicy,
  activationEvidence: manifest.schema.activationEvidence,
  templateVersionId: manifest.template === null ? null : manifest.template.id,
  templateHash: manifest.template === null ? null : manifest.template.hash,
  taxonomyVersionIds: sortedBytewise(revisionTaxonomyVersionIds),
  blockVersionIds: sortedBytewise(manifest.blocks.map((block) => block.id)),
  patternVersionIds: sortedBytewise(
    manifest.patterns.map((pattern) => pattern.id),
  ),
  settingsVersion: manifest.settings.version,
  compilerVersion: manifest.schema.schemaArtifact.compilerVersion,
});

/**
 * True when every manifest-derived member of `versionSet` equals the manifest
 * projection. The taxonomy ids come from the revision, not the manifest, so they
 * are the one member this check cannot bind.
 */
export const versionSetMatchesManifest = (
  versionSet: VersionSet,
  manifest: DependencyManifest,
): boolean => {
  const projected = versionSetOf(manifest, versionSet.taxonomyVersionIds);
  return cmsJsonEqual(versionSet, projected);
};
