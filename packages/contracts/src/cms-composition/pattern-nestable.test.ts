import { describe, expect, it } from 'vitest';

import { isRefused, uid } from './composition-fixtures.test-support';
import {
  CMS_PATTERN_NESTABLE_TYPES_MAX,
  PatternNestableApiRequestSchema,
  PatternNestableQuerySchema,
} from './pattern-nestable';
import { PatternSelectorPageSchema } from './pattern-selector';

describe('cmsPatternNestableRead contract (DEC-196, BE03c PatternNestableQuery)', () => {
  it('[P2-S12-AC-105] takes 1 to 64 repeated content type ids, an optional cursor and a limit defaulting to 25', () => {
    expect(
      PatternNestableQuerySchema.parse({ contentTypeId: [uid(1)] }),
    ).toEqual({ contentTypeId: [uid(1)], limit: 25 });
    const full = {
      contentTypeId: [uid(1), uid(2), uid(3)],
      cursor: 'opaque',
      limit: 50,
    };
    expect(PatternNestableQuerySchema.parse(full)).toEqual(full);
    expect(
      PatternNestableQuerySchema.safeParse({
        contentTypeId: [uid(1)],
        cursor: null,
      }).success,
    ).toBe(true);
    expect(CMS_PATTERN_NESTABLE_TYPES_MAX).toBe(64);
  });

  it('[P2-S12-AC-105] accepts exactly 64 types and refuses none, 65, a single string, a duplicate and a non-UUID member', () => {
    const types = (count: number) =>
      Array.from({ length: count }, (_unused, index) => uid(1000 + index));
    expect(
      PatternNestableQuerySchema.safeParse({ contentTypeId: types(64) })
        .success,
    ).toBe(true);
    for (const candidate of [
      {},
      { contentTypeId: [] },
      { contentTypeId: types(65) },
      { contentTypeId: uid(1) },
      { contentTypeId: [uid(1), uid(1)] },
      { contentTypeId: [uid(1), uid(1).toUpperCase()] },
      { contentTypeId: ['profile'] },
      { contentTypeId: [uid(1), 5] },
      { contentTypeId: [null] },
    ])
      expect(isRefused(PatternNestableQuerySchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-105] refuses a limit outside 1 to 50, an oversize cursor and any other key', () => {
    const base = { contentTypeId: [uid(1)] };
    for (const extra of [
      { limit: 0 },
      { limit: 51 },
      { limit: 1.5 },
      { limit: '25' },
      { cursor: 'c'.repeat(513) },
      { ownerId: uid(2) },
      { patternKey: 'hero' },
      { state: 'active' },
      { contentTypeIds: [uid(2)] },
    ])
      expect(isRefused(PatternNestableQuerySchema, { ...base, ...extra })).toBe(
        true,
      );
    for (const limit of [1, 50])
      expect(
        PatternNestableQuerySchema.safeParse({ ...base, limit }).success,
      ).toBe(true);
    expect(
      PatternNestableQuerySchema.safeParse({
        ...base,
        cursor: 'c'.repeat(512),
      }).success,
    ).toBe(true);
  });

  it('[P2-S12-AC-275] exposes the query as the sole member of the OpenAPI transport view', () => {
    expect(
      PatternNestableApiRequestSchema.parse({
        query: { contentTypeId: [uid(1), uid(2)] },
      }),
    ).toEqual({ query: { contentTypeId: [uid(1), uid(2)], limit: 25 } });
    for (const candidate of [
      {},
      { query: {} },
      { query: { contentTypeId: [uid(1)] }, body: {} },
      { contentTypeId: [uid(1)] },
    ])
      expect(isRefused(PatternNestableApiRequestSchema, candidate)).toBe(true);
  });

  it('[P2-S12-AC-105] answers the same PatternSelectorPage as CMS-03C-13 (BE03c 184)', () => {
    expect(
      PatternSelectorPageSchema.safeParse({
        items: [],
        nextCursor: null,
        pageVersion: '1',
      }).success,
    ).toBe(true);
  });
});
