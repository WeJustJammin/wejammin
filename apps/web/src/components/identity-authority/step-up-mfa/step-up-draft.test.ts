import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearStepUpDraft,
  hasStepUpDraftWithPrefix,
  loadStepUpDraft,
  saveStepUpDraft,
  type DraftStorage,
} from './step-up-draft';
import {
  STEP_UP_STATE_TTL_MS,
  clearAllStepUpState,
  type StepUpStateContext,
} from './step-up-binding';

const memoryStorage = (): DraftStorage &
  Pick<Storage, 'key' | 'length'> & { dump: () => string } => {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
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

const NOW = Date.parse('2026-10-03T12:00:00.000Z');
const ALICE: StepUpStateContext = { binding: 'binding-alice', now: NOW };
const BOB: StepUpStateContext = { binding: 'binding-bob', now: NOW + 5_000 };
const DRAFT = {
  values: { reason: 'tidy up' },
  idempotencyKey: 'key-0000000001',
  expectedVersion: '"7"',
} as const;

/**
 * Review r14 finding 2: a draft is bound to the server-issued session scope it
 * was saved under and expires with the DEC-111 600 s step-up window, so a later
 * user in the same tab restores nothing.
 */
describe('step-up draft binding and expiry', () => {
  let storage: ReturnType<typeof memoryStorage>;
  beforeEach(() => {
    storage = memoryStorage();
  });

  it('[P2-S09-AC-911][P2-S09-AC-1069] restores for the same binding inside the window', () => {
    saveStepUpDraft(storage, '/a', DRAFT, ALICE);
    expect(
      loadStepUpDraft(storage, '/a', {
        binding: 'binding-alice',
        now: NOW + STEP_UP_STATE_TTL_MS,
      }),
    ).toEqual(DRAFT);
  });

  it('[P2-S09-AC-911] a different user in the same tab restores nothing and the draft is cleared', () => {
    saveStepUpDraft(storage, '/a', DRAFT, ALICE);
    expect(loadStepUpDraft(storage, '/a', BOB)).toBeNull();
    expect(storage.dump()).toBe('[]');
  });

  it('[P2-S09-AC-911] a logged-out tab (no scope) restores nothing for a draft saved while signed in', () => {
    saveStepUpDraft(storage, '/a', DRAFT, ALICE);
    expect(
      loadStepUpDraft(storage, '/a', { binding: null, now: NOW }),
    ).toBeNull();
    expect(storage.dump()).toBe('[]');
  });

  it('[P2-S09-AC-911] a draft older than the 600 s window restores nothing and is cleared', () => {
    saveStepUpDraft(storage, '/a', DRAFT, ALICE);
    expect(
      loadStepUpDraft(storage, '/a', {
        binding: 'binding-alice',
        now: NOW + STEP_UP_STATE_TTL_MS + 1,
      }),
    ).toBeNull();
    expect(storage.dump()).toBe('[]');
  });

  it('rejects a draft stamped in the future or with no stamp at all', () => {
    saveStepUpDraft(storage, '/a', DRAFT, { binding: 'x', now: NOW + 60_000 });
    expect(
      loadStepUpDraft(storage, '/a', { binding: 'x', now: NOW }),
    ).toBeNull();
    storage.setItem(
      'wj-step-up-draft:/b',
      JSON.stringify({ ...DRAFT, createdAt: undefined }),
    );
    expect(loadStepUpDraft(storage, '/b', ALICE)).toBeNull();
  });

  it('hasStepUpDraftWithPrefix purges a draft that could never restore and reports only live ones', () => {
    saveStepUpDraft(storage, '/app/x/1', DRAFT, ALICE);
    expect(hasStepUpDraftWithPrefix(storage, '/app/x', BOB)).toBe(false);
    expect(storage.dump()).not.toContain('/app/x/1');
  });

  it('[P2-S09-AC-911] clearAllStepUpState removes every draft and envelope, nothing else', () => {
    saveStepUpDraft(storage, '/a', DRAFT, ALICE);
    saveStepUpDraft(storage, '/b', DRAFT, ALICE);
    storage.setItem('wj:cms-grants:step-up-return', '{}');
    storage.setItem('wj-admin-mfa-reset-interrupted', '{}');
    storage.setItem('wj_client_binding_id_v1', 'tab-id');
    clearAllStepUpState(storage);
    expect(JSON.parse(storage.dump())).toEqual([
      ['wj_client_binding_id_v1', 'tab-id'],
    ]);
  });
});
