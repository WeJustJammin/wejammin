import { describe, expect, it } from 'vitest';

import {
  STEP_UP_STATE_TTL_MS,
  type StepUpStateContext,
} from '../../identity-authority/step-up-mfa/step-up-binding';
import type { DraftStorage } from '../../identity-authority/step-up-mfa/step-up-draft';
import { initialResetState, markInterrupted } from './admin-mfa-reset-state';

const memoryStorage = (): DraftStorage & { size: () => number } => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    size: () => map.size,
  };
};

const NOW = Date.parse('2026-10-03T12:00:00.000Z');
const ALICE: StepUpStateContext = { binding: 'binding-alice', now: NOW };

/**
 * Review r14 finding 2: the "entries were not saved" marker is step-up detour
 * state too, so another user never sees it and it expires with the window.
 */
describe('admin MFA reset interruption marker binding', () => {
  it('[P2-S09-AC-911] announces once for the same scope inside the window', () => {
    const storage = memoryStorage();
    markInterrupted(storage, ALICE);
    expect(
      initialResetState(storage, { binding: 'binding-alice', now: NOW + 1_000 })
        .announcement,
    ).not.toBe('');
    expect(storage.size()).toBe(0);
  });

  it('[P2-S09-AC-911] a different user sees no announcement and the marker is cleared', () => {
    const storage = memoryStorage();
    markInterrupted(storage, ALICE);
    expect(
      initialResetState(storage, { binding: 'binding-bob', now: NOW + 1_000 })
        .announcement,
    ).toBe('');
    expect(storage.size()).toBe(0);
  });

  it('[P2-S09-AC-911] an expired marker announces nothing and is cleared', () => {
    const storage = memoryStorage();
    markInterrupted(storage, ALICE);
    expect(
      initialResetState(storage, {
        binding: 'binding-alice',
        now: NOW + STEP_UP_STATE_TTL_MS + 1,
      }).announcement,
    ).toBe('');
    expect(storage.size()).toBe(0);
  });
});
