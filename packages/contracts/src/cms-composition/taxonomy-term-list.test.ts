import { describe, expect, it } from 'vitest';

import {
  isRefused,
  issuePaths,
  uid,
  without,
} from './composition-fixtures.test-support';
import {
  TaxonomyTermListApiRequestSchema,
  TaxonomyTermListItemSchema,
  TaxonomyTermListPageSchema,
  TaxonomyTermListQuerySchema,
} from './taxonomy-term-list';

const taxonomyId = uid(150);
const item = {
  termId: uid(151),
  termKey: 'post-rock',
  lifecycle: 'active',
  version: '2',
  parentId: null,
  successorId: null,
  labels: [{ locale: 'en', label: 'Post-rock' }],
  aliases: ['postrock'],
} as const;

describe('cmsTaxonomyTermsRead contract', () => {
  it('[P2-S12-AC-184] takes the vocabulary path with an optional lifecycle, cursor and a limit defaulting to 25', () => {
    expect(TaxonomyTermListQuerySchema.parse({})).toEqual({ limit: 25 });
    const full = { lifecycle: 'merged', cursor: 'opaque', limit: 50 };
    expect(TaxonomyTermListQuerySchema.parse(full)).toEqual(full);
    expect(
      TaxonomyTermListApiRequestSchema.parse({ taxonomyId, query: {} }),
    ).toEqual({
      taxonomyId,
      query: { limit: 25 },
    });
    for (const lifecycle of ['active', 'deprecated', 'merged'])
      expect(TaxonomyTermListQuerySchema.safeParse({ lifecycle }).success).toBe(
        true,
      );
  });

  it('[P2-S12-AC-184] bounds the limit 1 to 50, the cursor at 512 and closes lifecycle and every other key', () => {
    for (const limit of [1, 50])
      expect(TaxonomyTermListQuerySchema.safeParse({ limit }).success).toBe(
        true,
      );
    for (const query of [
      { limit: 0 },
      { limit: 51 },
      { limit: 1.5 },
      { limit: '25' },
      { cursor: 'c'.repeat(513) },
      { lifecycle: 'retired' },
      { lifecycle: 'Active' },
      { taxonomyId },
      { termKey: 'x' },
      { q: 'rock' },
    ])
      expect(isRefused(TaxonomyTermListQuerySchema, query)).toBe(true);
    expect(
      TaxonomyTermListQuerySchema.safeParse({ cursor: 'c'.repeat(512) })
        .success,
    ).toBe(true);
    for (const candidate of [
      { query: {} },
      { taxonomyId: 'genre-tags', query: {} },
      { taxonomyId },
      { taxonomyId, query: { limit: 0 } },
      { taxonomyId, query: {}, body: {} },
    ])
      expect(isRefused(TaxonomyTermListApiRequestSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-183] returns the eight-member term item with at most 64 labels and 64 aliases', () => {
    expect(TaxonomyTermListItemSchema.parse(item)).toEqual(item);
    const labels = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        locale: `x${String.fromCharCode(97 + (index % 26))}${String.fromCharCode(97 + Math.floor(index / 26))}`,
        label: `Label ${index}`,
      }));
    expect(
      TaxonomyTermListItemSchema.safeParse({ ...item, labels: labels(64) })
        .success,
    ).toBe(true);
    expect(
      isRefused(TaxonomyTermListItemSchema, { ...item, labels: labels(65) }),
    ).toBe(true);
    expect(
      TaxonomyTermListItemSchema.safeParse({
        ...item,
        aliases: Array.from({ length: 64 }, (_, index) => `alias ${index}`),
      }).success,
    ).toBe(true);
    for (const aliases of [
      Array.from({ length: 65 }, (_, index) => `alias ${index}`),
      [''],
      ['x'.repeat(161)],
    ])
      expect(isRefused(TaxonomyTermListItemSchema, { ...item, aliases })).toBe(
        true,
      );
    expect(
      TaxonomyTermListItemSchema.safeParse({
        ...item,
        aliases: ['x'.repeat(160)],
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-183] bounds each label to 1 to 160 NFC characters under a BCP 47 locale', () => {
    for (const label of ['x', 'x'.repeat(160)])
      expect(
        TaxonomyTermListItemSchema.safeParse({
          ...item,
          labels: [{ locale: 'en', label }],
        }).success,
      ).toBe(true);
    for (const labels of [
      [{ locale: 'en', label: '' }],
      [{ locale: 'en', label: 'x'.repeat(161) }],
      [{ locale: 'en', label: 'café' }],
      [{ locale: 'en_US', label: 'x' }],
      [{ locale: 'en', label: 'x', extra: 1 }],
      [{ label: 'x' }],
    ])
      expect(isRefused(TaxonomyTermListItemSchema, { ...item, labels })).toBe(
        true,
      );
  });

  it('[P2-S12-AC-183] shows a merged term with its surviving successor and no other lifecycle with one', () => {
    expect(
      TaxonomyTermListItemSchema.safeParse({
        ...item,
        lifecycle: 'merged',
        successorId: uid(152),
      }).success,
    ).toBe(true);
    expect(
      issuePaths(TaxonomyTermListItemSchema, { ...item, lifecycle: 'merged' }),
    ).toEqual(['successorId']);
    for (const lifecycle of ['active', 'deprecated'])
      expect(
        issuePaths(TaxonomyTermListItemSchema, {
          ...item,
          lifecycle,
          successorId: uid(152),
        }),
      ).toEqual(['successorId']);
    for (const candidate of [
      { ...item, lifecycle: 'retired' },
      { ...item, termKey: 'Bad' },
      { ...item, termKey: 'has_underscore' },
      { ...item, version: '0' },
      { ...item, parentId: 'x' },
      { ...item, ownerId: uid(1) },
      without(item, 'successorId'),
      without(item, 'aliases'),
      without(item, 'labels'),
    ])
      expect(isRefused(TaxonomyTermListItemSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-183] bounds a page at 50 items with an opaque cursor of at most 512, a page version and 256 KiB', () => {
    const page = (count: number, nextCursor: string | null = null) => ({
      items: Array.from({ length: count }, (_, index) => ({
        ...item,
        termId: uid(3000 + index),
      })),
      nextCursor,
      pageVersion: '8',
    });
    expect(TaxonomyTermListPageSchema.safeParse(page(0)).success).toBe(true);
    expect(TaxonomyTermListPageSchema.safeParse(page(50, 'n')).success).toBe(
      true,
    );
    for (const candidate of [
      page(51),
      page(1, 'c'.repeat(513)),
      { ...page(1), pageVersion: '0' },
      without(page(1), 'nextCursor'),
      { ...page(1), total: 1 },
    ])
      expect(isRefused(TaxonomyTermListPageSchema, candidate)).toBe(true);
    // 50 items of 64 labels at 160 characters is far over 256 KiB.
    const heavy = {
      ...item,
      labels: Array.from({ length: 64 }, (_, index) => ({
        locale: `l${String.fromCharCode(97 + (index % 26))}${String.fromCharCode(97 + Math.floor(index / 26))}`,
        label: 'x'.repeat(160),
      })),
    };
    expect(
      issuePaths(TaxonomyTermListPageSchema, {
        items: Array.from({ length: 50 }, (_, index) => ({
          ...heavy,
          termId: uid(4000 + index),
        })),
        nextCursor: null,
        pageVersion: '8',
      }),
    ).toEqual(['']);
  });
});
