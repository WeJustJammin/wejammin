import { describe, expect, it } from 'vitest';

import {
  CMS_KEY_RESERVED_REASON,
  CMS_RESERVED_PATTERN_KEYS,
  CMS_RESERVED_TEMPLATE_KEYS,
  CmsLineageIdSchema,
  CmsPatternKeySchema,
  CmsTaxonomyKeySchema,
  CmsTemplateKeySchema,
  PatternNodeKeySchema,
  PatternNodePathSchema,
  isReservedPatternKey,
  isReservedTemplateKey,
} from './key-grammar';

const messages = (
  schema: { safeParse: (v: unknown) => unknown },
  v: unknown,
) => {
  const parsed = schema.safeParse(v) as {
    success: boolean;
    error?: { issues: { message: string }[] };
  };
  return parsed.success ? null : parsed.error!.issues.map((i) => i.message);
};

describe('BE03c key grammar (E13, E14, lineage ids)', () => {
  it('[P2-S12-AC-189] reserves exactly the template and pattern keys that collide with fixed routes', () => {
    expect([...CMS_RESERVED_TEMPLATE_KEYS]).toEqual([
      'context',
      'versions',
      'new',
    ]);
    expect([...CMS_RESERVED_PATTERN_KEYS]).toEqual([
      'context',
      'versions',
      'selector',
      'nestable',
      'new',
    ]);
    expect(CMS_KEY_RESERVED_REASON).toBe('key_reserved');
    for (const key of CMS_RESERVED_TEMPLATE_KEYS)
      expect(isReservedTemplateKey(key)).toBe(true);
    for (const key of CMS_RESERVED_PATTERN_KEYS)
      expect(isReservedPatternKey(key)).toBe(true);
    // `selector` is reserved for patterns only; `new` and `context` for both.
    expect(isReservedTemplateKey('selector')).toBe(false);
    expect(isReservedPatternKey('selector')).toBe(true);
    // `nestable` (cmsPatternNestableRead, DEC-232) is reserved for patterns only: a template may use it.
    expect(isReservedTemplateKey('nestable')).toBe(false);
    expect(isReservedPatternKey('nestable')).toBe(true);
  });

  it('[P2-S12-AC-189] refuses a reserved template key with the key_reserved reason and keeps near-misses valid', () => {
    for (const key of ['context', 'versions', 'new'])
      expect(messages(CmsTemplateKeySchema, key)).toEqual([
        CMS_KEY_RESERVED_REASON,
      ]);
    for (const key of ['selector', 'contexts', 'new-page', 'newt', 've'])
      expect(CmsTemplateKeySchema.safeParse(key).success).toBe(true);
    // Case matters: the grammar is lowercase, so a capitalised reserved word
    // is a grammar failure, not a reserved-key failure.
    expect(messages(CmsTemplateKeySchema, 'Context')).toEqual([
      'template_key_invalid',
    ]);
  });

  it('[P2-S12-AC-189] refuses a reserved pattern key with the key_reserved reason', () => {
    for (const key of ['context', 'versions', 'selector', 'nestable', 'new'])
      expect(messages(CmsPatternKeySchema, key)).toEqual([
        CMS_KEY_RESERVED_REASON,
      ]);
    expect(CmsPatternKeySchema.safeParse('hero-pattern').success).toBe(true);
    expect(CmsPatternKeySchema.safeParse('selectors').success).toBe(true);
  });

  it('[P2-S12-AC-101] bounds the template and pattern key grammar at 2 to 64 characters', () => {
    for (const schema of [CmsTemplateKeySchema, CmsPatternKeySchema]) {
      expect(schema.safeParse('a').success).toBe(false);
      expect(schema.safeParse('ab').success).toBe(true);
      expect(schema.safeParse(`a${'b'.repeat(63)}`).success).toBe(true);
      expect(schema.safeParse(`a${'b'.repeat(64)}`).success).toBe(false);
      expect(schema.safeParse('').success).toBe(false);
      expect(schema.safeParse('1abc').success).toBe(false);
      expect(schema.safeParse('has_underscore').success).toBe(false);
      expect(schema.safeParse('Upper').success).toBe(false);
      expect(schema.safeParse(' abc').success).toBe(false);
      expect(schema.safeParse('abc\n').success).toBe(false);
    }
  });

  it('[P2-S12-AC-125] bounds the taxonomy key grammar and reserves nothing', () => {
    expect(CmsTaxonomyKeySchema.safeParse('genre-tags').success).toBe(true);
    for (const key of ['context', 'versions', 'selector', 'new'])
      expect(CmsTaxonomyKeySchema.safeParse(key).success).toBe(true);
    expect(CmsTaxonomyKeySchema.safeParse('a').success).toBe(false);
    expect(CmsTaxonomyKeySchema.safeParse('has_underscore').success).toBe(
      false,
    );
    expect(CmsTaxonomyKeySchema.safeParse(`a${'b'.repeat(64)}`).success).toBe(
      false,
    );
  });

  it('[P2-S12-AC-191] types a lineage id as a UUID, the id of the first version row', () => {
    expect(
      CmsLineageIdSchema.safeParse('123e4567-e89b-42d3-a456-426614174000')
        .success,
    ).toBe(true);
    expect(CmsLineageIdSchema.safeParse('template-1').success).toBe(false);
    expect(CmsLineageIdSchema.safeParse('').success).toBe(false);
  });

  it('[P2-S12-AC-101] accepts a node key of 1 to 64 characters and refuses off-grammar keys', () => {
    for (const key of ['a', 'hero', 'row_1', 'a-b', `a${'b'.repeat(63)}`])
      expect(PatternNodeKeySchema.safeParse(key).success).toBe(true);
    for (const key of ['', '1a', 'A', 'a b', 'a/b', '_a', `a${'b'.repeat(64)}`])
      expect(PatternNodeKeySchema.safeParse(key).success).toBe(false);
  });

  it('[P2-S12-AC-101] accepts a normalized node path of at most 512 characters and refuses every other form', () => {
    for (const path of ['/hero', '/hero/title', '/a/b/c/d/e/f/g/h'])
      expect(PatternNodePathSchema.safeParse(path).success).toBe(true);
    for (const path of [
      '',
      '/',
      'hero',
      '/hero/',
      '//hero',
      '/hero//title',
      '/Hero',
      '/hero title',
      '/hero\n/title',
      '/hero/../title',
      '/./hero',
      '/1hero',
    ])
      expect(PatternNodePathSchema.safeParse(path).success).toBe(false);
    // 512 characters is the ceiling: eight 64-character segments reach it
    // exactly, and a ninth character in the last key crosses it.
    const segment = `/${'a'.repeat(63)}`;
    expect(segment.repeat(8)).toHaveLength(512);
    expect(PatternNodePathSchema.safeParse(segment.repeat(8)).success).toBe(
      true,
    );
    const oneOver = `${segment.repeat(7)}/${'a'.repeat(64)}`;
    expect(oneOver).toHaveLength(513);
    expect(PatternNodePathSchema.safeParse(oneOver).success).toBe(false);
  });
});
