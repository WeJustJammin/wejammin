import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearStepUpDraft,
  loadStepUpDraft,
  saveStepUpDraft,
  type DraftStorage,
} from './step-up-draft';

const memoryStorage = (): DraftStorage & { dump: () => string } => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    dump: () => JSON.stringify([...map]),
  };
};

/** FE01 "Consumption by protected forms": tab-scoped draft, no codes, no replay. */
describe('step-up draft persistence', () => {
  let storage: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it('round-trips the values, the original idempotency key and the expected version', () => {
    const saved = saveStepUpDraft(storage, '/app/forms/1', {
      values: { reason: 'tidy up', mode: 'a' },
      idempotencyKey: 'key-0000000001',
      expectedVersion: '"7"',
    });
    expect(saved).toBe(true);
    expect(loadStepUpDraft(storage, '/app/forms/1')).toEqual({
      values: { reason: 'tidy up', mode: 'a' },
      idempotencyKey: 'key-0000000001',
      expectedVersion: '"7"',
    });
  });

  it('is scoped to the form path', () => {
    saveStepUpDraft(storage, '/app/forms/1', {
      values: { a: 'b' },
      idempotencyKey: 'key-0000000001',
      expectedVersion: null,
    });
    expect(loadStepUpDraft(storage, '/app/forms/2')).toBeNull();
  });

  it('never stores one-time codes or enrollment secrets', () => {
    const saved = saveStepUpDraft(storage, '/app/forms/1', {
      values: {
        code: '123456',
        otpauthUri: 'otpauth://totp/x?secret=ABC',
        manualEntryKey: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        keep: 'yes',
      },
      idempotencyKey: 'key-0000000001',
      expectedVersion: null,
    });
    expect(saved).toBe(true);
    expect(storage.dump()).not.toContain('123456');
    expect(storage.dump()).not.toContain('otpauth');
    expect(storage.dump()).not.toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(loadStepUpDraft(storage, '/app/forms/1')?.values).toEqual({
      keep: 'yes',
    });
  });

  it('consumes the draft once: a second load finds nothing so nothing is replayed', () => {
    saveStepUpDraft(storage, '/app/forms/1', {
      values: { a: 'b' },
      idempotencyKey: 'key-0000000001',
      expectedVersion: null,
    });
    expect(loadStepUpDraft(storage, '/app/forms/1')).not.toBeNull();
    expect(loadStepUpDraft(storage, '/app/forms/1')).toBeNull();
  });

  it('clears on demand', () => {
    saveStepUpDraft(storage, '/app/forms/1', {
      values: {},
      idempotencyKey: 'key-0000000001',
      expectedVersion: null,
    });
    clearStepUpDraft(storage, '/app/forms/1');
    expect(loadStepUpDraft(storage, '/app/forms/1')).toBeNull();
  });

  it('treats unavailable or throwing storage as no draft', () => {
    const throwing: DraftStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(
      saveStepUpDraft(throwing, '/app/x', {
        values: {},
        idempotencyKey: 'key-0000000001',
        expectedVersion: null,
      }),
    ).toBe(false);
    expect(loadStepUpDraft(throwing, '/app/x')).toBeNull();
    expect(loadStepUpDraft(null, '/app/x')).toBeNull();
    expect(() => clearStepUpDraft(throwing, '/app/x')).not.toThrow();
  });

  it('ignores a malformed stored value', () => {
    storage.setItem('wj-step-up-draft:/app/x', '{not json');
    expect(loadStepUpDraft(storage, '/app/x')).toBeNull();
    storage.setItem('wj-step-up-draft:/app/x', JSON.stringify({ values: 3 }));
    expect(loadStepUpDraft(storage, '/app/x')).toBeNull();
  });
});
