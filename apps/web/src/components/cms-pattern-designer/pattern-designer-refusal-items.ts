import type { PatternSummaryItem } from './CmsPatternStatus';
import { PATTERN_ISSUE_COPY } from './pattern-designer-copy';
import { PATTERN_REFUSAL_COPY } from './pattern-designer-reasons';
import type { PatternSubmitResult } from './pattern-designer-submit';
import { isNodePointerReason } from './pattern-designer-node-pointer';
import {
  nestedPatternUiIds,
  nodeAt,
  type EditableTree,
} from './pattern-tree-state';

/** Refusals about the state of a nested pattern; the server names the reason but not the node. */
const NESTED_REASONS: ReadonlySet<string> = new Set([
  'pattern_cycle',
  'nested_pattern_not_active',
  'pattern_incompatible',
  'pattern_version_not_active',
]);

/**
 * A refusal as linked summary items. A cycle, depth or node-count refusal names the offending node (DEC-228) and is
 * linked there. Any other tree refusal carries no node pointer, so the form never invents one: an expansion bound and a
 * registry change are tree-level, and a nested-pattern refusal is tree-level plus one honest "may be the cause" item for
 * every nested pattern node the tree holds. A pointer that names no node of the tree on screen falls back to the tree.
 */
export const refusalItems = (
  result: PatternSubmitResult,
  tree: EditableTree,
): PatternSummaryItem[] => {
  if (result.kind !== 'refused' || result.reason === 'capability_missing')
    return [];
  if (result.reason === 'key_reserved')
    return [
      {
        message: PATTERN_ISSUE_COPY.key_reserved,
        target: { kind: 'field', field: 'patternKey' },
      },
    ];
  // DEC-228: a cycle, depth or node-count refusal that names a node of the tree on screen is linked at that node.
  if (isNodePointerReason(result.reason) && result.nodePath !== undefined) {
    const offending = nodeAt(tree, result.nodePath);
    if (offending !== null)
      return [
        {
          message: PATTERN_ISSUE_COPY[result.reason],
          target: { kind: 'node', uiId: offending.uiId, member: null },
        },
      ];
  }
  const treeItem: PatternSummaryItem = {
    message: PATTERN_REFUSAL_COPY[result.reason],
    target: { kind: 'field', field: 'tree' },
  };
  if (!NESTED_REASONS.has(result.reason)) return [treeItem];
  return [
    treeItem,
    ...nestedPatternUiIds(tree).map((uiId): PatternSummaryItem => ({
      message: PATTERN_ISSUE_COPY.nested_pattern_suspect,
      target: { kind: 'node', uiId, member: null },
    })),
  ];
};
