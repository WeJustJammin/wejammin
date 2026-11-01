import {
  CMS_A11Y_CHECKER_KEY,
  CMS_A11Y_CHECKER_VERSION,
} from '@wejammin/contracts';

import { canonicalHash } from '../../content-schema-registry/migration-transform-jcs';
import type { AccessibilityCheckerInput } from './input-schema';

/*
 * The two digests of the checker, both lowercase SHA-256 of an RFC 8785 (JCS)
 * canonical JSON document (shared with the registry digests; not re-implemented).
 */

/**
 * BE05c `inputHash`: the checker key and version, the revision content hash,
 * the block record hashes in render order, the accessibility row identifiers
 * (always empty in Phase 2: no media reference can exist before Slice 14, and
 * the member stays so Slice 14 extends it without changing the shape) and the
 * render-plan hash. It does not cover the revision id, the dependency hash or
 * the locale: those are bound by the revision content and the evidence binding.
 */
export const accessibilityInputHash = (
  input: AccessibilityCheckerInput,
): Promise<string> =>
  canonicalHash({
    checkerKey: CMS_A11Y_CHECKER_KEY,
    checkerVersion: CMS_A11Y_CHECKER_VERSION,
    revisionContentHash: input.revisionContentHash,
    blockRecordHashes: input.nodes.flatMap((node) =>
      node.kind === 'block' ? [node.recordHash] : [],
    ),
    accessibilityRows: [],
    renderPlanHash: input.renderPlanHash,
  });

export type AccessibilityBindingInput = Readonly<{
  revisionId: string;
  revisionContentHash: string;
  dependencyHash: string;
}>;

/**
 * BE03b `PreflightEvidence.bindingHash`: SHA-256 of the JCS
 * `{ checkerKey, checkerVersion, revisionId, revisionContentHash,
 * dependencyHash }`. PostgreSQL `cms_accessibility_binding_hash` recomputes
 * the same digest from canonical rows; a pinned vector test keeps both sides
 * identical.
 */
export const accessibilityBindingHash = (
  binding: AccessibilityBindingInput,
): Promise<string> =>
  canonicalHash({
    checkerKey: CMS_A11Y_CHECKER_KEY,
    checkerVersion: CMS_A11Y_CHECKER_VERSION,
    revisionId: binding.revisionId,
    revisionContentHash: binding.revisionContentHash,
    dependencyHash: binding.dependencyHash,
  });
