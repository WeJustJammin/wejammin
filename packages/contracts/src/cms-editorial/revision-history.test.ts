import { describe, expect, it } from 'vitest';

import {
  RevisionHistoryChangeSchema,
  RevisionHistoryCompareSchema,
  RevisionHistoryPageSchema,
  RevisionHistoryPathParamsSchema,
  RevisionHistoryQuerySchema,
  RevisionSummarySchema,
} from './index';

const uuid = '123e4567-e89b-42d3-a456-426614174000';
const uuid2 = '123e4567-e89b-42d3-a456-426614174001';
const uuid3 = '123e4567-e89b-42d3-a456-426614174002';
const hash = 'a'.repeat(64);
const instant = '2026-09-26T00:00:00Z';
const pointer = '/fields/' + uuid3;
const fieldPointer = (index: number): string =>
  `/fields/123e4567-e89b-42d3-a456-${String(index).padStart(12, '0')}`;
const relationPointer = `/relations/${uuid3}/${'b'.repeat(64)}`;
const blockPointer = '/blocks/hero/0/body';
const pointerOf = {
  field: pointer,
  block: blockPointer,
  relation: relationPointer,
} as const;

const validSummary = {
  id: uuid,
  revisionNumber: '4',
  locale: 'en-US',
  state: 'draft',
  contentHash: hash,
  createdAt: instant,
  authorClass: 'human-author',
} as const;

const validPage = {
  items: [validSummary],
  nextCursor: null,
  pageVersion: '4',
  compare: null,
} as const;

const validCompare = {
  leftRevisionId: uuid,
  rightRevisionId: uuid2,
  changes: [
    {
      path: pointer,
      kind: 'changed',
      domain: 'field',
      leftHash: hash,
      rightHash: hash,
    },
  ],
  restore: null,
} as const;

// BE03b `restore`: the migration chain that would reconcile the two sides,
// plus the closed availability verdict a reader may act on.
const validRestore = {
  migrationChainId: uuid3,
  edgeCount: 2,
  chainHash: hash,
  availability: 'available',
} as const;

describe('CMS-03B-03 revision summary and page', () => {
  it('accepts a strict summary row and rejects leakage or bad states', () => {
    expect(RevisionSummarySchema.safeParse(validSummary).success).toBe(true);
    expect(
      RevisionSummarySchema.safeParse({ ...validSummary, ownerId: uuid })
        .success,
    ).toBe(false);
    expect(
      RevisionSummarySchema.safeParse({ ...validSummary, state: 'archived' })
        .success,
    ).toBe(false);
    expect(
      RevisionSummarySchema.safeParse({ ...validSummary, contentHash: 'short' })
        .success,
    ).toBe(false);
    expect(
      RevisionSummarySchema.safeParse({ ...validSummary, authorClass: '' })
        .success,
    ).toBe(false);
  });

  it('accepts a nullable cursor and compare block and rejects unknown keys', () => {
    expect(RevisionHistoryPageSchema.safeParse(validPage).success).toBe(true);
    expect(
      RevisionHistoryPageSchema.safeParse({
        ...validPage,
        compare: validCompare,
      }).success,
    ).toBe(true);
    expect(
      RevisionHistoryPageSchema.safeParse({ ...validPage, nextCursor: null })
        .success,
    ).toBe(true);
    expect(
      RevisionHistoryPageSchema.safeParse({
        ...validPage,
        items: Array.from({ length: 51 }, () => validSummary),
      }).success,
    ).toBe(false);
    expect(
      RevisionHistoryPageSchema.safeParse({ ...validPage, extra: 1 }).success,
    ).toBe(false);
  });

  it('accepts a populated compare block and its closed change kinds', () => {
    expect(RevisionHistoryCompareSchema.safeParse(validCompare).success).toBe(
      true,
    );
    for (const kind of ['added', 'removed', 'changed', 'unchanged'] as const) {
      expect(
        RevisionHistoryChangeSchema.safeParse({
          path: pointer,
          kind,
          domain: 'field',
          leftHash: null,
          rightHash: null,
        }).success,
      ).toBe(true);
    }
    expect(
      RevisionHistoryChangeSchema.safeParse({ path: pointer, kind: 'moved' })
        .success,
    ).toBe(false);
    expect(
      RevisionHistoryCompareSchema.safeParse({
        ...validCompare,
        changes: Array.from({ length: 513 }, (_, index) => ({
          path: fieldPointer(index),
          kind: 'unchanged',
          domain: 'field',
        })),
      }).success,
    ).toBe(false);
  });

  it('requires a closed comparison domain on every change and rejects the unknown one', () => {
    for (const domain of ['field', 'block', 'relation'] as const) {
      expect(
        RevisionHistoryChangeSchema.safeParse({
          path: pointerOf[domain],
          kind: 'changed',
          domain,
          leftHash: hash,
          rightHash: hash,
        }).success,
      ).toBe(true);
    }
    for (const domain of ['value', 'entry', 'taxonomy', '']) {
      expect(
        RevisionHistoryChangeSchema.safeParse({
          path: pointer,
          kind: 'changed',
          domain,
          leftHash: hash,
          rightHash: hash,
        }).success,
      ).toBe(false);
    }
    expect(
      RevisionHistoryChangeSchema.safeParse({
        path: pointer,
        kind: 'changed',
        leftHash: hash,
        rightHash: hash,
      }).success,
    ).toBe(false);
    expect(
      RevisionHistoryChangeSchema.safeParse({
        path: pointer,
        kind: 'changed',
        domain: 'field',
        leftHash: hash,
        rightHash: hash,
        extra: 1,
      }).success,
    ).toBe(false);
  });

  it('keeps the 512-change bound while accepting the exact boundary', () => {
    const changes = Array.from({ length: 512 }, (_, index) => ({
      path: fieldPointer(index),
      kind: 'unchanged' as const,
      domain: 'field' as const,
      leftHash: hash,
      rightHash: hash,
    }));
    expect(
      RevisionHistoryCompareSchema.safeParse({ ...validCompare, changes })
        .success,
    ).toBe(true);
    expect(
      RevisionHistoryCompareSchema.safeParse({
        ...validCompare,
        changes: [...changes, changes[0]!],
      }).success,
    ).toBe(false);
  });

  it('requires a strict nullable restore block with bounded edges and a closed availability verdict', () => {
    expect(validCompare.restore).toBeNull();
    expect(
      RevisionHistoryCompareSchema.safeParse({
        ...validCompare,
        restore: validRestore,
      }).success,
    ).toBe(true);
    expect(
      Object.keys(
        RevisionHistoryCompareSchema.parse({
          ...validCompare,
          restore: validRestore,
        }).restore as object,
      ).sort(),
    ).toEqual(['availability', 'chainHash', 'edgeCount', 'migrationChainId']);

    expect(
      RevisionHistoryCompareSchema.safeParse({
        ...validCompare,
        restore: undefined,
      }).success,
    ).toBe(false);

    for (const availability of [
      'available',
      'chain_unavailable',
      'transform_missing',
    ] as const) {
      expect(
        RevisionHistoryCompareSchema.safeParse({
          ...validCompare,
          restore: { ...validRestore, availability },
        }).success,
      ).toBe(true);
    }

    for (const edgeCount of [0, 64]) {
      expect(
        RevisionHistoryCompareSchema.safeParse({
          ...validCompare,
          restore: { ...validRestore, edgeCount },
        }).success,
      ).toBe(true);
    }
    for (const restore of [
      { ...validRestore, edgeCount: -1 },
      { ...validRestore, edgeCount: 65 },
      { ...validRestore, edgeCount: 1.5 },
      { ...validRestore, availability: 'pending' },
      { ...validRestore, migrationChainId: 'not-a-uuid' },
      { ...validRestore, chainHash: 'short' },
      { migrationChainId: uuid3, edgeCount: 1, chainHash: hash },
      { ...validRestore, extra: 1 },
      {},
    ])
      expect(
        RevisionHistoryCompareSchema.safeParse({
          ...validCompare,
          restore,
        }).success,
      ).toBe(false);
  });
});

describe('CMS-03B-03 revision history query', () => {
  it('defaults the window to 25 and rejects out-of-range limits', () => {
    expect(RevisionHistoryQuerySchema.parse({ entryId: uuid }).limit).toBe(25);
    expect(
      RevisionHistoryQuerySchema.safeParse({ entryId: uuid, limit: 1 }).success,
    ).toBe(true);
    expect(
      RevisionHistoryQuerySchema.safeParse({ entryId: uuid, limit: 50 })
        .success,
    ).toBe(true);
    expect(
      RevisionHistoryQuerySchema.safeParse({ entryId: uuid, limit: 0 }).success,
    ).toBe(false);
    expect(
      RevisionHistoryQuerySchema.safeParse({ entryId: uuid, limit: 51 })
        .success,
    ).toBe(false);
    expect(
      RevisionHistoryQuerySchema.safeParse({ entryId: uuid, limit: 1.5 })
        .success,
    ).toBe(false);
  });

  it('bounds the signed cursor at 512 characters and allows null', () => {
    expect(
      RevisionHistoryQuerySchema.safeParse({
        entryId: uuid,
        cursor: 'a'.repeat(512),
      }).success,
    ).toBe(true);
    expect(
      RevisionHistoryQuerySchema.safeParse({
        entryId: uuid,
        cursor: 'a'.repeat(513),
      }).success,
    ).toBe(false);
    expect(
      RevisionHistoryQuerySchema.safeParse({ entryId: uuid, cursor: null })
        .success,
    ).toBe(true);
  });

  it('allowlists only state, locale, and compareRevisionId filters', () => {
    expect(
      RevisionHistoryQuerySchema.safeParse({
        entryId: uuid,
        state: 'published',
        locale: 'zh-Hant',
        compareRevisionId: uuid2,
      }).success,
    ).toBe(true);
    expect(
      RevisionHistoryQuerySchema.safeParse({
        entryId: uuid,
        state: 'archived',
      }).success,
    ).toBe(false);
    expect(
      RevisionHistoryQuerySchema.safeParse({ entryId: uuid, ownerId: uuid })
        .success,
    ).toBe(false);
    expect(
      RevisionHistoryQuerySchema.safeParse({
        entryId: uuid,
        compareRevisionId: 'nope',
      }).success,
    ).toBe(false);
  });

  it('binds exactly one UUID path parameter', () => {
    expect(
      RevisionHistoryPathParamsSchema.safeParse({ entryId: uuid }).success,
    ).toBe(true);
    expect(
      RevisionHistoryPathParamsSchema.safeParse({ entryId: 'nope' }).success,
    ).toBe(false);
    expect(
      RevisionHistoryPathParamsSchema.safeParse({ entryId: uuid, extra: 1 })
        .success,
    ).toBe(false);
  });
});

describe('[P2-S10-AC-016] CMS-03B-03 change pointers follow the D5 grammar of their domain', () => {
  const change = (domain: string, path: string) => ({
    path,
    kind: 'changed',
    domain,
    leftHash: hash,
    rightHash: hash,
  });
  const accepts = (domain: string, path: string): boolean =>
    RevisionHistoryChangeSchema.safeParse(change(domain, path)).success;

  it('accepts exactly the three D5 pointer grammars for their own domain', () => {
    expect(accepts('field', `/fields/${uuid3}`)).toBe(true);
    expect(accepts('block', '/blocks/hero/0/body')).toBe(true);
    expect(accepts('block', '/blocks/a')).toBe(true);
    expect(accepts('relation', `/relations/${uuid3}/${'0'.repeat(64)}`)).toBe(
      true,
    );
  });

  it('refuses a path that belongs to another domain', () => {
    expect(accepts('field', blockPointer)).toBe(false);
    expect(accepts('field', relationPointer)).toBe(false);
    expect(accepts('block', pointer)).toBe(false);
    expect(accepts('block', relationPointer)).toBe(false);
    expect(accepts('relation', pointer)).toBe(false);
    expect(accepts('relation', blockPointer)).toBe(false);
  });

  it('refuses a malformed field pointer', () => {
    for (const path of [
      '/fields/title',
      '/fields/',
      `/fields/${uuid3.toUpperCase()}`,
      `/fields/${uuid3}/extra`,
      '/p/1',
    ])
      expect(accepts('field', path), path).toBe(false);
  });

  it('refuses a relation pointer that is not a keyed token or a field uuid', () => {
    for (const path of [
      `/relations/${uuid3}`,
      `/relations/${uuid3}/`,
      `/relations/${uuid3}/${'b'.repeat(63)}`,
      `/relations/${uuid3}/${'b'.repeat(65)}`,
      `/relations/${uuid3}/${'B'.repeat(64)}`,
      `/relations/${uuid3}/${'g'.repeat(64)}`,
      // a bare target id would let a reader confirm a guessed hidden target
      `/relations/${uuid3}/${uuid}`,
      `/relations/not-a-uuid/${'b'.repeat(64)}`,
      `/relations/${uuid3}/${'b'.repeat(64)}/extra`,
    ])
      expect(accepts('relation', path), path).toBe(false);
  });

  it('refuses an empty, control-bearing, query, fragment or backslash block path', () => {
    for (const path of [
      '/blocks/',
      '/blocks',
      '/blocks/a?b',
      '/blocks/a#b',
      '/blocks/a\\b',
      '/blocks/a\u0000b',
    ])
      expect(accepts('block', path), JSON.stringify(path)).toBe(false);
  });
});
