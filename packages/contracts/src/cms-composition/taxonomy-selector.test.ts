import { describe, expect, it } from 'vitest';

import {
  isRefused,
  issuePaths,
  uid,
  without,
} from './composition-fixtures.test-support';
import {
  TaxonomySelectorApiRequestSchema,
  TaxonomySelectorPageSchema,
  TaxonomySelectorQuerySchema,
  TaxonomySelectorTermSchema,
} from './taxonomy-selector';

const query = {
  typeKey: 'profile',
  fieldKey: 'genres',
  locale: 'en-US',
} as const;
const term = {
  taxonomyId: uid(140),
  taxonomyVersionId: uid(141),
  taxonomyKey: 'genre-tags',
  shape: 'hierarchical',
  termId: uid(142),
  termKey: 'post-rock',
  parentId: uid(143),
  label: 'Post-rock',
} as const;

describe('CMS-03C-17 taxonomy selector contract', () => {
  it('[P2-S12-AC-130] takes a type key, a field key and a locale with an optional cursor and a limit defaulting to 50', () => {
    expect(TaxonomySelectorQuerySchema.parse(query)).toEqual({
      ...query,
      limit: 50,
    });
    const full = { ...query, cursor: 'opaque', limit: 100 };
    expect(TaxonomySelectorQuerySchema.parse(full)).toEqual(full);
    expect(
      TaxonomySelectorQuerySchema.safeParse({ ...query, cursor: null }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-131] bounds the keys to ^[a-z][a-z0-9_]{1,63}$, the locale to BCP 47, the cursor at 512 and the limit 1 to 100', () => {
    for (const typeKey of ['ab', `a${'b'.repeat(63)}`, 'profile_type'])
      expect(
        TaxonomySelectorQuerySchema.safeParse({ ...query, typeKey }).success,
      ).toBe(true);
    for (const member of ['typeKey', 'fieldKey'] as const)
      for (const value of [
        '',
        'a',
        'Bad',
        'has-dash',
        '1ab',
        `a${'b'.repeat(64)}`,
      ])
        expect(
          issuePaths(TaxonomySelectorQuerySchema, {
            ...query,
            [member]: value,
          }),
          `${member} ${value}`,
        ).toEqual([member]);
    for (const locale of ['', 'e', 'en_US', 'en-', 'englishlanguage', '12'])
      expect(
        issuePaths(TaxonomySelectorQuerySchema, { ...query, locale }),
      ).toEqual(['locale']);
    for (const limit of [1, 100])
      expect(
        TaxonomySelectorQuerySchema.safeParse({ ...query, limit }).success,
      ).toBe(true);
    for (const limit of [0, 101, 1.5, '50', null])
      expect(isRefused(TaxonomySelectorQuerySchema, { ...query, limit })).toBe(
        true,
      );
    expect(
      isRefused(TaxonomySelectorQuerySchema, {
        ...query,
        cursor: 'c'.repeat(513),
      }),
    ).toBe(true);
    expect(
      TaxonomySelectorQuerySchema.safeParse({
        ...query,
        cursor: 'c'.repeat(512),
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-131] requires all three of typeKey, fieldKey and locale and rejects every other query key', () => {
    for (const candidate of [
      without(query, 'typeKey'),
      without(query, 'fieldKey'),
      without(query, 'locale'),
      { ...query, taxonomyId: uid(1) },
      { ...query, ownerId: uid(1) },
      { ...query, lifecycle: 'active' },
    ])
      expect(isRefused(TaxonomySelectorQuerySchema, candidate)).toBe(true);
    expect(TaxonomySelectorApiRequestSchema.parse({ query })).toEqual({
      query: { ...query, limit: 50 },
    });
    for (const candidate of [{}, { query: {} }, { query, body: {} }, query])
      expect(isRefused(TaxonomySelectorApiRequestSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-130] returns the eight-member term with a nullable label and no fallback label', () => {
    expect(TaxonomySelectorTermSchema.parse(term)).toEqual(term);
    expect(
      TaxonomySelectorTermSchema.safeParse({ ...term, label: null }).success,
    ).toBe(true);
    expect(
      TaxonomySelectorTermSchema.safeParse({ ...term, label: 'x'.repeat(160) })
        .success,
    ).toBe(true);
    for (const candidate of [
      { ...term, label: '' },
      { ...term, label: 'x'.repeat(161) },
      { ...term, label: undefined },
      { ...term, labels: [] },
      { ...term, shape: 'graph' },
      { ...term, termKey: 'Bad' },
      { ...term, taxonomyKey: 'a_b' },
      { ...term, termId: 'x' },
      { ...term, parentId: 'x' },
      { ...term, lifecycle: 'active' },
      { ...term, ownerId: uid(1) },
      without(term, 'taxonomyVersionId'),
      without(term, 'parentId'),
    ])
      expect(isRefused(TaxonomySelectorTermSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-130] gives a flat vocabulary no parent, since a parent needs the hierarchical shape', () => {
    expect(
      issuePaths(TaxonomySelectorTermSchema, { ...term, shape: 'flat' }),
    ).toEqual(['parentId']);
    expect(
      TaxonomySelectorTermSchema.safeParse({
        ...term,
        shape: 'flat',
        parentId: null,
      }).success,
    ).toBe(true);
    expect(
      TaxonomySelectorTermSchema.safeParse({ ...term, parentId: null }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-130] bounds a page at 100 terms with an opaque cursor of at most 512 and a page version', () => {
    const page = (count: number, nextCursor: string | null = null) => ({
      items: Array.from({ length: count }, (_, index) => ({
        ...term,
        termId: uid(2000 + index),
      })),
      nextCursor,
      pageVersion: '4',
    });
    expect(TaxonomySelectorPageSchema.safeParse(page(0)).success).toBe(true);
    expect(
      TaxonomySelectorPageSchema.safeParse(page(100, 'next')).success,
    ).toBe(true);
    for (const candidate of [
      page(101),
      page(1, 'c'.repeat(513)),
      { ...page(1), pageVersion: '0' },
      without(page(1), 'nextCursor'),
      without(page(1), 'pageVersion'),
      { ...page(1), total: 1 },
    ])
      expect(isRefused(TaxonomySelectorPageSchema, candidate)).toBe(true);
  });
});
