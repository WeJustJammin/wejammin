import { describe, expect, it } from 'vitest';

import { MemoryStorage } from '../../lib/test-support/memory-storage';
import { CMS_EDITORIAL_RESULT_SCOPE } from './cms-editorial-result-scope';
import {
  saveCmsEditorialResult,
  takeCmsEditorialResult,
} from './cms-editorial-result-handoff';

/*
 * The editor reads the result a command left for it without asking first (a read of an empty tab
 * store is a no-op), so the scope must be exactly what the writer stores under.
 */
const ENTRY = '11111111-1111-4111-8111-111111111111';
const summary = {
  kind: 'created',
  entryId: ENTRY,
  revisionNumber: '1',
  entryVersion: '1',
  state: 'draft',
  parentRevisionIds: [],
  migrationChainId: null,
  edgeCount: null,
} as const;

describe('the result scope', () => {
  it('is what the writer stores under, and the reader finds it', () => {
    const storage = new MemoryStorage();
    saveCmsEditorialResult(storage, summary);
    expect(
      [...Array(storage.length).keys()].some((index) =>
        storage.key(index)?.endsWith(CMS_EDITORIAL_RESULT_SCOPE),
      ),
    ).toBe(true);
    expect(takeCmsEditorialResult(storage, ENTRY)).not.toBeNull();
    expect(takeCmsEditorialResult(storage, ENTRY)).toBeNull();
  });

  it('reads nothing from an empty store or without storage', () => {
    expect(takeCmsEditorialResult(new MemoryStorage(), ENTRY)).toBeNull();
    expect(takeCmsEditorialResult(null, ENTRY)).toBeNull();
  });

  it('names the scope the handoff stores under', () => {
    expect(CMS_EDITORIAL_RESULT_SCOPE).toBe('cms-editorial-result');
  });
});
