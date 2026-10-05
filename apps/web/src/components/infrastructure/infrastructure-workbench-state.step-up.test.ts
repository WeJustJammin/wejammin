import { describe, expect, it } from 'vitest';

import {
  parseContractState,
  recordsForState,
  stateAnnouncement,
  stepUpRecoveryHref,
} from './infrastructure-workbench-state';

/**
 * FE00 error-per-class mapping (DEC-111): the workbench consumes the
 * infrastructure view state with 401 STEP_UP_REQUIRED as a step-up navigation,
 * never a capability gate.
 */
const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const RETURN_TO = '/app/infrastructure?tab=history';
const stepUp = {
  status: 'step_up_required',
  returnTo: RETURN_TO,
  allowedMethods: ['totp'],
} as const;

describe('workbench infrastructure step-up state', () => {
  it('[P2-S09-AC-1127] parses step_up_required and holds no records', () => {
    const parsed = parseContractState(stepUp);
    expect(parsed.success).toBe(true);
    expect(recordsForState(stepUp)).toEqual([]);
  });

  it('[P2-S09-AC-1127] no longer accepts a capability gate that claims the step_up recovery', () => {
    expect(
      parseContractState({
        status: 'capability_gate',
        recovery: 'step_up',
        requiredCapability: 'infrastructure.write',
      } as never).success,
    ).toBe(false);
  });

  it('[P2-S09-AC-1127] builds the step-up recovery href from the safe relative return path', () => {
    expect(stepUpRecoveryHref(stepUp)).toBe(
      `/step-up?returnTo=${encodeURIComponent(RETURN_TO)}`,
    );
  });

  it('[P2-S09-AC-1127] announces verification instead of the 403 capability copy', () => {
    const announcement = stateAnnouncement(stepUp, REQUEST_ID);
    expect(announcement).toContain('Verification is required');
    expect(announcement).not.toContain('server capability');
  });

  it('[P2-S09-AC-1127] keeps the 403 gate announcement for capability_gate', () => {
    expect(
      stateAnnouncement(
        {
          status: 'capability_gate',
          recovery: 'request_capability',
          requiredCapability: 'infrastructure.write',
        },
        REQUEST_ID,
      ),
    ).toBe('This action is unavailable for the current server capability.');
  });
});
