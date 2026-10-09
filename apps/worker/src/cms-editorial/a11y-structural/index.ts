/*
 * `cms.a11y.structural` version 1 (BE05c, D25, DEC-134). This barrel is the
 * only import path for callers outside this directory; see README.md.
 */
export {
  ACCESSIBILITY_FINDINGS_STORED_MAX,
  ACCESSIBILITY_RULE_CATALOG,
  ACCESSIBILITY_RULE_IDS,
  type AccessibilityRuleId,
  type AccessibilitySeverity,
} from './catalog';
export {
  runAccessibilityChecker,
  type AccessibilityCheckerOptions,
  type AccessibilityCheckerRun,
  type AccessibilityCheckerStopped,
} from './checker';
export {
  auditRecordOf,
  toPreflightEvidence,
  type AccessibilityAuditRecord,
} from './evidence';
export type { AccessibilityFinding, FindingLocation } from './findings';
export {
  ACCESSIBILITY_GATE_RETRY_DELAY_MS,
  ACCESSIBILITY_GATE_TIMEOUT_MIN_MS,
  evaluateAccessibilityGate,
  type AccessibilityGateArgs,
  type AccessibilityGateCompleted,
  type AccessibilityGateFailed,
  type AccessibilityGateFailureCode,
  type AccessibilityGateRun,
  type AccessibilityLoadResult,
} from './gate';
export {
  accessibilityBindingHash,
  accessibilityInputHash,
  type AccessibilityBindingInput,
} from './hashes';
export {
  ACCESSIBILITY_NODES_MAX,
  AccessibilityCheckerInputSchema,
  type AccessibilityCheckerInput,
  type AccessibilityNode,
  type BlockNode,
  type FieldNode,
} from './input-schema';
