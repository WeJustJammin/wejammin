import {
  RevisionHistoryPageSchema,
  type RevisionHistoryPage,
} from '@wejammin/contracts';

import { fieldUuid } from '../cms-editorial-fields/cms-field-fixtures.test-support';

export const HISTORY_ENTRY_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132dc';
export const LEFT_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d1';
export const RIGHT_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d2';
export const CHAIN_ID = '018f0c45-73fe-7dc2-9c09-68f7ecf132d3';
export const HISTORY_ROUTE = `/app/cms-content-modeling/entries/${HISTORY_ENTRY_ID}/revisions`;
export const HASH_A = 'a'.repeat(64);
export const HASH_B = 'b'.repeat(64);
export const TOKEN = 'c'.repeat(64);
export const FIELD = fieldUuid(0x10);

export const summary = (overrides: Record<string, unknown> = {}) => ({
  id: RIGHT_ID,
  revisionNumber: '2',
  locale: 'en-US',
  state: 'draft',
  contentHash: HASH_A,
  createdAt: '2026-09-26T12:00:00+00:00',
  authorClass: 'author',
  ...overrides,
});

export const change = (
  domain: 'field' | 'block' | 'relation',
  overrides: Record<string, unknown> = {},
) => ({
  path:
    domain === 'field'
      ? `/fields/${FIELD}`
      : domain === 'relation'
        ? `/relations/${FIELD}/${TOKEN}`
        : '/blocks/hero',
  kind: 'changed',
  domain,
  leftHash: HASH_A,
  rightHash: HASH_B,
  ...overrides,
});

export const restore = (availability = 'available', edgeCount = 3) => ({
  migrationChainId: CHAIN_ID,
  edgeCount,
  chainHash: HASH_B,
  availability,
});

export const compareWith = (
  changes: readonly Record<string, unknown>[],
  restoreValue: Record<string, unknown> | null = restore(),
) => ({
  leftRevisionId: LEFT_ID,
  rightRevisionId: RIGHT_ID,
  changes,
  restore: restoreValue,
});

export const historyPage = (
  overrides: Record<string, unknown> = {},
): RevisionHistoryPage =>
  RevisionHistoryPageSchema.parse({
    items: [summary()],
    nextCursor: null,
    pageVersion: '1',
    compare: null,
    ...overrides,
  });
