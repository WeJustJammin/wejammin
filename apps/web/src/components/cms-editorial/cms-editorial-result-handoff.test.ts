import { describe, expect, it } from 'vitest';

import {
  CMS_EDITORIAL_RESULT_TTL_MS,
  saveCmsEditorialResult,
  takeCmsEditorialResult,
  type CmsEditorialResultSummary,
} from './cms-editorial-result-handoff';

const ENTRY = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
const OTHER = '018f0c45-73fe-7dc2-9c09-68f7ecf132ff';
const KEY = 'wj-step-up-draft:cms-editorial-result';

const summary = (entryId = ENTRY): CmsEditorialResultSummary => ({
  kind: 'created',
  entryId,
  revisionNumber: '1',
  entryVersion: '1',
  state: 'draft',
  parentRevisionIds: [],
  migrationChainId: null,
  edgeCount: null,
});

const memory = () => {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
};

describe('takeCmsEditorialResult: a record is shown once and never lingers', () => {
  it('returns a fresh record for this entry exactly once', () => {
    const storage = memory();
    saveCmsEditorialResult(storage, summary(), 1_000);
    expect(takeCmsEditorialResult(storage, ENTRY, 1_500)).toEqual(summary());
    expect(takeCmsEditorialResult(storage, ENTRY, 1_600)).toBeNull();
    expect(storage.items.has(KEY)).toBe(false);
  });

  it('clears a FRESH record that belongs to another entry, without showing it', () => {
    const storage = memory();
    saveCmsEditorialResult(storage, summary(OTHER), 1_000);
    expect(takeCmsEditorialResult(storage, ENTRY, 1_100)).toBeNull();
    expect(storage.items.has(KEY)).toBe(false);
  });

  it('clears an expired record and a record from the future', () => {
    for (const now of [1_000 + CMS_EDITORIAL_RESULT_TTL_MS + 1, 500]) {
      const storage = memory();
      saveCmsEditorialResult(storage, summary(), 1_000);
      expect(takeCmsEditorialResult(storage, ENTRY, now)).toBeNull();
      expect(storage.items.has(KEY)).toBe(false);
    }
  });

  it('clears malformed and unparsable records', () => {
    const stamp = { binding: null, createdAt: Date.now() };
    for (const raw of [
      'not json',
      JSON.stringify({ at: 1 }),
      JSON.stringify({
        values: { kind: 'x' },
        idempotencyKey: '',
        expectedVersion: null,
        ...stamp,
      }),
      JSON.stringify({
        values: {
          at: '1000',
          kind: 'created',
          entryId: ENTRY,
          revisionNumber: 'nope',
          entryVersion: '1',
          state: 'draft',
        },
        idempotencyKey: '',
        expectedVersion: null,
        ...stamp,
      }),
    ]) {
      const storage = memory();
      storage.items.set(KEY, raw);
      expect(takeCmsEditorialResult(storage, ENTRY, 1_100)).toBeNull();
      expect(storage.items.has(KEY)).toBe(false);
    }
  });

  it('reads blocked storage as no result', () => {
    expect(takeCmsEditorialResult(null, ENTRY)).toBeNull();
  });
});
