import { CmsFieldKeySchema, CmsTypeKeySchema } from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import { TAG_LIMIT, addTags, tagPattern } from './taxonomy-tags';

describe('tag grammar mirrors the contract', () => {
  const samples = [
    'ab',
    'a1',
    'a_b',
    'a-b',
    'A',
    '1a',
    '_a',
    'a',
    'a'.repeat(64),
    'a'.repeat(65),
    'é1',
    'a b',
  ];
  it.each(samples)(
    'agrees with the type and field key schemas on %j',
    (sample) => {
      expect(tagPattern('type').test(sample)).toBe(
        CmsTypeKeySchema.safeParse(sample).success,
      );
      expect(tagPattern('field').test(sample)).toBe(
        CmsFieldKeySchema.safeParse(sample).success,
      );
    },
  );
});

describe('addTags', () => {
  it('adds valid keys in entry order, splitting on commas and whitespace', () => {
    expect(addTags('article, profile\nrelease', [], 'type')).toEqual({
      tags: ['article', 'profile', 'release'],
      problems: [],
    });
  });

  it('keeps existing tags first and reports an existing key as a duplicate without adding it', () => {
    expect(addTags('profile article', ['profile'], 'type')).toEqual({
      tags: ['profile', 'article'],
      problems: [{ code: 'tag_duplicate', value: 'profile' }],
    });
  });

  it('reports a key repeated within the input once and adds it once', () => {
    expect(addTags('a1 a1 a1', [], 'field')).toEqual({
      tags: ['a1'],
      problems: [{ code: 'tag_duplicate', value: 'a1' }],
    });
  });

  it('reports a key outside the grammar and still adds the valid ones', () => {
    expect(addTags('Good article 9x', [], 'type')).toEqual({
      tags: ['article'],
      problems: [
        { code: 'tag_invalid', value: 'Good' },
        { code: 'tag_invalid', value: '9x' },
      ],
    });
  });

  it('ignores empty input and separators', () => {
    expect(addTags('  ,, \n ', ['ab'], 'type')).toEqual({
      tags: ['ab'],
      problems: [],
    });
  });

  it('stops at 64 keys and says which keys did not fit', () => {
    const existing = Array.from(
      { length: TAG_LIMIT - 1 },
      (_, index) => `type_${index}`,
    );
    const result = addTags('first second', existing, 'type');
    expect(result.tags).toHaveLength(TAG_LIMIT);
    expect(result.tags.at(-1)).toBe('first');
    expect(result.problems).toEqual([{ code: 'tag_limit', value: 'second' }]);
  });

  it('truncates a very long token in the report', () => {
    const long = 'A'.repeat(500);
    const result = addTags(long, [], 'type');
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]?.value.length).toBeLessThanOrEqual(65);
  });
});
