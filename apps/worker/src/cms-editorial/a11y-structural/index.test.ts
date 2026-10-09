import { describe, expect, it } from 'vitest';

import * as surface from './index';

/** The public surface Slice 11 routes and Slice 16 import; changing it is a deliberate act. */

describe('cms.a11y.structural public surface', () => {
  it('exports exactly the documented values', () => {
    expect(Object.keys(surface).sort()).toEqual(
      [
        'ACCESSIBILITY_FINDINGS_STORED_MAX',
        'ACCESSIBILITY_GATE_RETRY_DELAY_MS',
        'ACCESSIBILITY_GATE_TIMEOUT_MIN_MS',
        'ACCESSIBILITY_NODES_MAX',
        'ACCESSIBILITY_RULE_CATALOG',
        'ACCESSIBILITY_RULE_IDS',
        'AccessibilityCheckerInputSchema',
        'accessibilityBindingHash',
        'accessibilityInputHash',
        'auditRecordOf',
        'evaluateAccessibilityGate',
        'runAccessibilityChecker',
        'toPreflightEvidence',
      ].sort(),
    );
  });
});
