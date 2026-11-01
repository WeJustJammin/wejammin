import { describe, expect, it } from 'vitest';

import {
  hash,
  isRefused,
  uid,
  without,
} from './composition-fixtures.test-support';
import {
  PatternSelectorApiRequestSchema,
  PatternSelectorItemSchema,
  PatternSelectorPageSchema,
  PatternSelectorQuerySchema,
} from './pattern-selector';

const item = {
  patternId: uid(100),
  patternVersionId: uid(101),
  patternKey: 'hero-banner',
  patternVersion: 3,
  nodeCount: 7,
  blockRegistryDigest: hash,
} as const;

describe('CMS-03C-13 pattern selector contract', () => {
  it('[P2-S12-AC-106] takes a content type id, an optional cursor and a limit defaulting to 25', () => {
    expect(PatternSelectorQuerySchema.parse({ contentTypeId: uid(1) })).toEqual(
      {
        contentTypeId: uid(1),
        limit: 25,
      },
    );
    const full = { contentTypeId: uid(1), cursor: 'opaque', limit: 50 };
    expect(PatternSelectorQuerySchema.parse(full)).toEqual(full);
    expect(
      PatternSelectorQuerySchema.safeParse({
        contentTypeId: uid(1),
        cursor: null,
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-107] refuses a missing or malformed content type, limit outside 1 to 50, an oversize cursor and any other key', () => {
    for (const candidate of [
      {},
      { contentTypeId: 'profile' },
      { contentTypeId: uid(1), limit: 0 },
      { contentTypeId: uid(1), limit: 51 },
      { contentTypeId: uid(1), limit: 1.5 },
      { contentTypeId: uid(1), limit: '25' },
      { contentTypeId: uid(1), cursor: 'c'.repeat(513) },
      { contentTypeId: uid(1), ownerId: uid(2) },
      { contentTypeId: uid(1), patternKey: 'hero' },
      { contentTypeId: uid(1), state: 'active' },
    ])
      expect(isRefused(PatternSelectorQuerySchema, candidate)).toBe(true);
    for (const limit of [1, 50])
      expect(
        PatternSelectorQuerySchema.safeParse({ contentTypeId: uid(1), limit })
          .success,
      ).toBe(true);
    expect(
      PatternSelectorQuerySchema.safeParse({
        contentTypeId: uid(1),
        cursor: 'c'.repeat(512),
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-106] exposes the query as the sole member of the OpenAPI transport view', () => {
    expect(
      PatternSelectorApiRequestSchema.parse({
        query: { contentTypeId: uid(1) },
      }),
    ).toEqual({ query: { contentTypeId: uid(1), limit: 25 } });
    for (const candidate of [
      {},
      { query: {} },
      { query: { contentTypeId: uid(1) }, body: {} },
      { contentTypeId: uid(1) },
    ])
      expect(isRefused(PatternSelectorApiRequestSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-106] accepts the six-member selector item and refuses a hidden or malformed member', () => {
    expect(PatternSelectorItemSchema.parse(item)).toEqual(item);
    for (const nodeCount of [1, 512])
      expect(
        PatternSelectorItemSchema.safeParse({ ...item, nodeCount }).success,
      ).toBe(true);
    for (const candidate of [
      { ...item, nodeCount: 0 },
      { ...item, nodeCount: 513 },
      { ...item, patternVersion: 0 },
      { ...item, patternKey: 'context' },
      { ...item, patternKey: 'Bad' },
      { ...item, patternId: 'x' },
      { ...item, patternVersionId: 'x' },
      { ...item, blockRegistryDigest: 'A'.repeat(64) },
      { ...item, state: 'active' },
      { ...item, ownerId: uid(1) },
      { ...item, blockTree: [] },
      without(item, 'patternVersionId'),
      without(item, 'blockRegistryDigest'),
    ])
      expect(isRefused(PatternSelectorItemSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-106] bounds a page at 50 items with an opaque cursor of at most 512 and a page version', () => {
    const page = (count: number, nextCursor: string | null = null) => ({
      items: Array.from({ length: count }, (_, index) => ({
        ...item,
        patternVersionId: uid(700 + index),
      })),
      nextCursor,
      pageVersion: '9',
    });
    expect(PatternSelectorPageSchema.safeParse(page(0)).success).toBe(true);
    expect(PatternSelectorPageSchema.safeParse(page(50, 'next')).success).toBe(
      true,
    );
    for (const candidate of [
      page(51),
      page(1, 'c'.repeat(513)),
      { ...page(1), pageVersion: '0' },
      { ...page(1), pageVersion: 9 },
      without(page(1), 'nextCursor'),
      without(page(1), 'pageVersion'),
      { ...page(1), total: 1 },
    ])
      expect(isRefused(PatternSelectorPageSchema, candidate)).toBe(true);
  });
});
