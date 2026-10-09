import {
  ACCESSIBILITY_FINDINGS_STORED_MAX,
  catalogEntry,
  type AccessibilityRuleId,
  type AccessibilitySeverity,
} from './catalog';

/*
 * BE05c QualityFinding (version 1 subset): ruleId, severity, a location
 * (kind, RFC 6901 pointer into the revision values by stable field id and
 * index, fieldId, blockPath), the catalog message and the constant
 * humanReview `required`. Location kind `route` is reserved for registered
 * route checkers and no version-1 rule produces it.
 */

export type FindingLocation = Readonly<{
  kind: 'field' | 'block';
  pointer: string;
  fieldId: string | null;
  blockPath: string | null;
}>;

export type AccessibilityFinding = Readonly<{
  ruleId: AccessibilityRuleId;
  severity: AccessibilitySeverity;
  location: FindingLocation;
  message: string;
  humanReview: 'required';
}>;

/**
 * Render position `[node, block, span]`: the node's index in the render-order
 * input, then the block and span indexes inside a rich-text value. `-1` marks
 * a level the finding does not address. The checker never re-derives order.
 */
export type RenderPosition = readonly [
  node: number,
  block: number,
  span: number,
];

export const NO_POSITION = -1;

type HeldFinding = Readonly<{
  finding: AccessibilityFinding;
  position: RenderPosition;
}>;

/** Compaction keeps memory at O(FINDINGS_STORED_MAX) however many findings a run produces. */
const COMPACT_AT = ACCESSIBILITY_FINDINGS_STORED_MAX * 2;

const severityRank = (severity: AccessibilitySeverity): number =>
  severity === 'blocking' ? 0 : 1;

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/** Total order: blocking first, render position, ruleId, pointer (UTF-16 code units). */
const compareHeld = (left: HeldFinding, right: HeldFinding): number =>
  severityRank(left.finding.severity) - severityRank(right.finding.severity) ||
  left.position[0] - right.position[0] ||
  left.position[1] - right.position[1] ||
  left.position[2] - right.position[2] ||
  compareText(left.finding.ruleId, right.finding.ruleId) ||
  compareText(left.finding.location.pointer, right.finding.location.pointer);

export type FindingCollection = Readonly<{
  findings: readonly AccessibilityFinding[];
  blockingCount: number;
  warningCount: number;
  truncated: boolean;
}>;

export type FindingCollector = Readonly<{
  add: (
    ruleId: AccessibilityRuleId,
    location: FindingLocation,
    position: RenderPosition,
  ) => void;
  result: () => FindingCollection;
}>;

export const createFindingCollector = (): FindingCollector => {
  let held: HeldFinding[] = [];
  let blockingCount = 0;
  let warningCount = 0;

  const keepBest = (): void => {
    held = held.sort(compareHeld).slice(0, ACCESSIBILITY_FINDINGS_STORED_MAX);
  };

  return {
    add: (ruleId, location, position) => {
      const { severity, message } = catalogEntry(ruleId);
      if (severity === 'blocking') blockingCount += 1;
      else warningCount += 1;
      held.push({
        finding: {
          ruleId,
          severity,
          location,
          message,
          humanReview: 'required',
        },
        position,
      });
      if (held.length >= COMPACT_AT) keepBest();
    },
    result: () => {
      keepBest();
      return {
        findings: held.map((entry) => entry.finding),
        blockingCount,
        warningCount,
        truncated: blockingCount + warningCount > held.length,
      };
    },
  };
};
