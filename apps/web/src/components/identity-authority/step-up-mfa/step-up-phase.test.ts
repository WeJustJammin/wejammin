import { describe, expect, it } from 'vitest';

import {
  initialStepUpPhase,
  verifiedFactors,
  type MfaFactorSummary,
} from './step-up-phase';

const factor = (
  id: string,
  state: MfaFactorSummary['state'],
): MfaFactorSummary => ({
  id,
  method: 'totp',
  friendlyName: `Factor ${id}`,
  state,
  verifiedAt: state === 'verified' ? '2026-10-02T10:00:00Z' : null,
  lastUsedAt: null,
  pendingExpiresAt: state === 'pending' ? '2026-10-02T10:10:00Z' : null,
});

/** FE01 phases: no-factor, one factor creates a challenge, many choose first. */
describe('initialStepUpPhase', () => {
  it('has no factor when nothing is verified', () => {
    expect(initialStepUpPhase([])).toBe('no-factor');
    expect(
      initialStepUpPhase([
        factor('a', 'pending'),
        factor('b', 'reconciling'),
      ]),
    ).toBe('no-factor');
  });

  it('creates the challenge on mount for exactly one verified factor', () => {
    expect(
      initialStepUpPhase([factor('a', 'verified'), factor('b', 'pending')]),
    ).toBe('creating-challenge');
  });

  it('asks the person to choose when more than one is verified', () => {
    expect(
      initialStepUpPhase([factor('a', 'verified'), factor('b', 'verified')]),
    ).toBe('choosing-factor');
  });

  it('lists only verified factors for the page', () => {
    expect(
      verifiedFactors([
        factor('a', 'verified'),
        factor('b', 'pending'),
        factor('c', 'reconciling'),
      ]).map((entry) => entry.id),
    ).toEqual(['a']);
  });

  it('projects only id and friendly name for the island', () => {
    expect(verifiedFactors([factor('a', 'verified')])).toEqual([
      { id: 'a', friendlyName: 'Factor a' },
    ]);
  });
});
