// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import {
  STEP_UP_STATE_TTL_MS,
  type StepUpStateContext,
} from '../identity-authority/step-up-mfa/step-up-binding';
import {
  consumeStepUpDetour,
  markStepUpDetour,
  type PendingGrantCommand,
} from './cms-capability-grant-navigation';

const NOW = Date.parse('2026-10-03T12:00:00.000Z');
const ALICE: StepUpStateContext = { binding: 'binding-alice', now: NOW };
const PENDING: PendingGrantCommand = {
  kind: 'renew',
  grantId: '018f0c45-73fe-7dc2-9c09-68f7ecf132d4',
  idempotencyKey: 'grant-renew-key-0001',
};

afterEach(() => window.sessionStorage.clear());

/**
 * Review r14 finding 2: the grant console's pending-command envelope carries an
 * Idempotency-Key, so it is bound to the session scope that wrote it and
 * expires with the DEC-111 600 s window.
 */
describe('CMS capability grant step-up envelope binding', () => {
  it('[P2-S09-AC-911] restores the original key for the same scope inside the window', () => {
    markStepUpDetour(PENDING, ALICE);
    expect(
      consumeStepUpDetour({
        binding: 'binding-alice',
        now: NOW + STEP_UP_STATE_TTL_MS,
      }),
    ).toEqual({ found: true, pending: PENDING });
  });

  it('[P2-S09-AC-911] a different user in the same tab finds nothing and the envelope is cleared', () => {
    markStepUpDetour(PENDING, ALICE);
    expect(
      consumeStepUpDetour({ binding: 'binding-bob', now: NOW + 1_000 }),
    ).toEqual({ found: false, pending: null });
    expect(window.sessionStorage.length).toBe(0);
  });

  it('[P2-S09-AC-911] an envelope past the 600 s window finds nothing and is cleared', () => {
    markStepUpDetour(PENDING, ALICE);
    expect(
      consumeStepUpDetour({
        binding: 'binding-alice',
        now: NOW + STEP_UP_STATE_TTL_MS + 1,
      }),
    ).toEqual({ found: false, pending: null });
    expect(window.sessionStorage.length).toBe(0);
  });

  it('an unstamped legacy envelope is refused and cleared', () => {
    window.sessionStorage.setItem(
      'wj:cms-grants:step-up-return',
      JSON.stringify(PENDING),
    );
    expect(consumeStepUpDetour(ALICE)).toEqual({ found: false, pending: null });
    expect(window.sessionStorage.length).toBe(0);
  });
});
