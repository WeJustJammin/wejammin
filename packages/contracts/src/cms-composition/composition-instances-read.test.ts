import { describe, expect, it } from 'vitest';

import {
  isRefused,
  issuePaths,
  without,
} from './composition-fixtures.test-support';
import {
  CMS_COMPOSITION_INSTANCES_PAGE_MAX,
  compositionInstancesPageHonours,
  CompositionInstancePageSchema,
  CompositionInstancesQuerySchema,
  CompositionInstancesReadApiRequestSchema,
} from './composition-instances-read';

const ENTRY_ID = '10000000-0000-4000-8000-000000000001';
const REVISION_ID = '20000000-0000-4000-8000-000000000002';
const HASH = 'a'.repeat(64);

const row = (index: number, patch: Record<string, unknown> = {}) => ({
  id: `30000000-0000-4000-8000-${String(100000 + index).padStart(12, '0')}`,
  version: '1',
  contentHash: HASH,
  createdAt: '2026-10-22T12:00:00Z',
  updatedAt: '2026-10-22T12:00:00Z',
  state: 'active',
  revisionId: REVISION_ID,
  path: `/main/root${index}`,
  position: index,
  blockKey: 'profile.header',
  blockVersion: 2,
  patternId: '40000000-0000-4000-8000-000000000004',
  patternVersion: 1,
  blockRegistryDigest: HASH,
  linkMode: 'linked',
  conflictState: 'none',
  ...patch,
});
const page = (items: readonly unknown[], nextCursor: string | null = null) => ({
  revisionId: REVISION_ID,
  items,
  nextCursor,
});

describe('cmsCompositionInstancesRead query and transport (DEC-206)', () => {
  it('[P2-S12-AC-269] accepts an optional opaque cursor of at most 512 characters and a limit of 1-50 defaulting to 25, and no other key', () => {
    expect(CompositionInstancesQuerySchema.parse({})).toEqual({ limit: 25 });
    expect(
      CompositionInstancesQuerySchema.parse({ cursor: 'a'.repeat(512) }),
    ).toEqual({ cursor: 'a'.repeat(512), limit: 25 });
    expect(CompositionInstancesQuerySchema.parse({ cursor: null })).toEqual({
      cursor: null,
      limit: 25,
    });
    for (const limit of [1, 25, 50])
      expect(CompositionInstancesQuerySchema.parse({ limit })).toEqual({
        limit,
      });
    for (const candidate of [
      { cursor: 'a'.repeat(513) },
      { cursor: 5 },
      { limit: 0 },
      { limit: 51 },
      { limit: 100 },
      { limit: -1 },
      { limit: 2.5 },
      { limit: '25' },
      { limit: null },
      { cursor: 'abc', revisionId: REVISION_ID },
    ])
      expect(isRefused(CompositionInstancesQuerySchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-269] addresses the entry by path and the cursor and limit by query, strictly', () => {
    expect(
      CompositionInstancesReadApiRequestSchema.parse({
        entryId: ENTRY_ID,
        query: {},
      }),
    ).toEqual({ entryId: ENTRY_ID, query: { limit: 25 } });
    expect(
      CompositionInstancesReadApiRequestSchema.parse({
        entryId: ENTRY_ID,
        query: { cursor: 'opaque', limit: 50 },
      }),
    ).toEqual({ entryId: ENTRY_ID, query: { cursor: 'opaque', limit: 50 } });
    for (const candidate of [
      { entryId: 'not-a-uuid', query: {} },
      { query: {} },
      { entryId: ENTRY_ID, query: { cursor: 'x'.repeat(513) } },
      { entryId: ENTRY_ID, query: { limit: 51 } },
      { entryId: ENTRY_ID, query: {}, body: {} },
      { entryId: ENTRY_ID, query: { revisionId: REVISION_ID } },
    ])
      expect(
        isRefused(CompositionInstancesReadApiRequestSchema, candidate),
      ).toBe(true);
  });
});

describe('CompositionInstancePage (DEC-206)', () => {
  it('[P2-S12-AC-269] accepts a page of live rows of one revision with a cursor, and an empty page', () => {
    const rows = [
      row(0),
      row(1, {
        state: 'draft',
        conflictState: null,
        patternId: null,
        patternVersion: null,
        linkMode: 'detached',
      }),
      row(2, { state: 'pending_diff', conflictState: 'pending_diff' }),
    ];
    expect(
      CompositionInstancePageSchema.parse(page(rows, 'opaque-cursor')),
    ).toEqual(page(rows, 'opaque-cursor'));
    expect(CompositionInstancePageSchema.parse(page([]))).toEqual(page([]));
  });

  it('[P2-S12-AC-269] answers an entry without a current draft revision as an empty page with a null revision', () => {
    const empty = { revisionId: null, items: [], nextCursor: null };
    expect(CompositionInstancePageSchema.parse(empty)).toEqual(empty);
    expect(
      isRefused(CompositionInstancePageSchema, {
        revisionId: null,
        items: [row(0)],
        nextCursor: null,
      }),
    ).toBe(true);
    expect(
      isRefused(CompositionInstancePageSchema, {
        revisionId: null,
        items: [],
        nextCursor: 'opaque',
      }),
    ).toBe(true);
  });

  it('[P2-S12-AC-269] bounds a page at 50 rows (BE00) and the cursor at 512 characters', () => {
    const fifty = Array.from({ length: 50 }, (_, index) => row(index));
    expect(
      CompositionInstancePageSchema.safeParse(page(fifty, 'next')).success,
    ).toBe(true);
    expect(
      isRefused(
        CompositionInstancePageSchema,
        page([...fifty, row(50)], 'next'),
      ),
    ).toBe(true);
    expect(CMS_COMPOSITION_INSTANCES_PAGE_MAX).toBe(50);
    expect(
      isRefused(CompositionInstancePageSchema, page([], 'c'.repeat(513))),
    ).toBe(true);
  });

  it('[P2-S12-AC-269] lists only the live heads: never a superseded or retired row', () => {
    for (const state of ['superseded', 'retired'])
      expect(
        issuePaths(CompositionInstancePageSchema, page([row(0, { state })])),
      ).toEqual(['items.0.state']);
  });

  it('[P2-S12-AC-269] holds every row to the page revision and to one row per path and id', () => {
    expect(
      issuePaths(
        CompositionInstancePageSchema,
        page([
          row(0),
          row(1, { revisionId: '50000000-0000-4000-8000-000000000005' }),
        ]),
      ),
    ).toEqual(['items.1.revisionId']);
    expect(
      issuePaths(
        CompositionInstancePageSchema,
        page([row(0), row(1, { path: '/main/root0' })]),
      ),
    ).toEqual(['items.1.path']);
    expect(
      issuePaths(CompositionInstancePageSchema, page([row(0), row(0)])).sort(),
    ).toEqual(['items.1.id', 'items.1.path'].sort());
  });

  it('[P2-S12-AC-269] is closed: no extra member, and the three members are required', () => {
    expect(
      isRefused(CompositionInstancePageSchema, {
        ...page([]),
        pageVersion: '1',
      }),
    ).toBe(true);
    for (const key of ['revisionId', 'items', 'nextCursor'] as const)
      expect(
        isRefused(CompositionInstancePageSchema, without(page([]), key)),
      ).toBe(true);
  });
});

describe('compositionInstancesPageHonours (DEC-206): an answer must honour its request', () => {
  const full = Array.from({ length: 25 }, (_, index) => row(index));
  it('[P2-S12-AC-269] accepts a cursor only after a full page of the requested size (default 25)', () => {
    expect(compositionInstancesPageHonours(page(full, 'next'), {})).toBe(true);
    expect(
      compositionInstancesPageHonours(page(full.slice(0, 24), 'next'), {}),
    ).toBe(false);
    expect(compositionInstancesPageHonours(page(full, ''), {})).toBe(false);
    expect(compositionInstancesPageHonours(page(full.slice(0, 3)), {})).toBe(
      true,
    );
    expect(
      compositionInstancesPageHonours(page(full.slice(0, 3), 'next'), {
        limit: 3,
      }),
    ).toBe(true);
    expect(
      compositionInstancesPageHonours(page(full.slice(0, 3), 'next'), {
        limit: 4,
      }),
    ).toBe(false);
  });

  it('[P2-S12-AC-269] never answers more items than the requested limit', () => {
    expect(compositionInstancesPageHonours(page(full), { limit: 24 })).toBe(
      false,
    );
    expect(compositionInstancesPageHonours(page(full), { limit: 25 })).toBe(
      true,
    );
    expect(
      compositionInstancesPageHonours(page(full, 'next'), { limit: 24 }),
    ).toBe(false);
    const fifty = Array.from({ length: 50 }, (_, index) => row(index));
    expect(
      compositionInstancesPageHonours(page(fifty, 'next'), { limit: 50 }),
    ).toBe(true);
    expect(compositionInstancesPageHonours(page(fifty), {})).toBe(false);
  });

  it('[P2-S12-AC-269] answers a request that carried a cursor with a page of a revision, never the no-revision page', () => {
    const none = { revisionId: null, items: [], nextCursor: null };
    expect(compositionInstancesPageHonours(none, {})).toBe(true);
    expect(compositionInstancesPageHonours(none, { cursor: 'opaque' })).toBe(
      false,
    );
    expect(
      compositionInstancesPageHonours(page([row(0)]), { cursor: 'opaque' }),
    ).toBe(true);
    expect(compositionInstancesPageHonours(none, { cursor: null })).toBe(true);
  });
});
