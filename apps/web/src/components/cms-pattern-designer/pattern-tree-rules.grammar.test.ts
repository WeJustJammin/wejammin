import {
  CMS_BLOCK_KEY_PATTERN,
  CmsBlockKeySchema,
  CmsPatternKeySchema,
  JSON_VALUE_MAX_ARRAY_ITEMS,
  JSON_VALUE_MAX_BYTES,
  JSON_VALUE_MAX_DEPTH,
  JSON_VALUE_MAX_KEYS,
  PatternBlockTreeSchema,
  PatternNodeKeySchema,
  type PatternNode,
} from '@wejammin/contracts';
import { describe, expect, it } from 'vitest';

import {
  BLOCK_KEY_REGEX,
  NODE_KEY_REGEX,
  PATTERN_JSON_LIMITS,
  PATTERN_KEY_REGEX,
  PATTERN_LIMITS,
  isBlockKey,
  isPatternNodeKey,
  patternKeyIssue,
  validatePatternTree,
} from './pattern-tree-rules';

/**
 * Drift guards for the grammars and JSON bounds the designer writes out zod-free
 * (FE03 AC261). The contract is the oracle: the regexes must be the contract's own
 * (source and flags), and the accept/refuse decision must equal the schema over every
 * character class, position and length boundary, so a changed contract fails here
 * instead of surfacing as an unpointed 422.
 */
type Bagged = { _zod: { bag: { patterns?: Set<RegExp> } } };
const contractPattern = (schema: unknown): RegExp => {
  const patterns = [...((schema as Bagged)._zod.bag.patterns ?? [])];
  expect(patterns).toHaveLength(1);
  return patterns[0] as RegExp;
};

/** Every printable ASCII character, controls, and look-alikes that a loose class would admit. */
const CHARACTERS = [
  ...Array.from({ length: 0x7f }, (_, code) => String.fromCharCode(code)),
  'é',
  'İ',
  'ａ',
  '٣',
  ' ',
  '\u{1F600}',
];

/** `c` first, second, in the middle, last, and followed by a newline (an `$` anchor trap). */
const probes = (character: string): string[] => [
  character,
  `a${character}`,
  `a${character}b`,
  `ab${character}`,
  `a${character}\n`,
  `${character}\na`,
];
const lengths = (limit: number): string[] =>
  Array.from({ length: limit + 3 }, (_, length) => 'a'.repeat(length));

describe('grammar regexes are the contract regexes', () => {
  it('pattern key, node key and block key', () => {
    for (const [mine, theirs] of [
      [PATTERN_KEY_REGEX, contractPattern(CmsPatternKeySchema)],
      [NODE_KEY_REGEX, contractPattern(PatternNodeKeySchema)],
      [BLOCK_KEY_REGEX, CMS_BLOCK_KEY_PATTERN],
      [BLOCK_KEY_REGEX, contractPattern(CmsBlockKeySchema)],
    ] as const) {
      expect(mine.source).toBe(theirs.source);
      expect(mine.flags).toBe(theirs.flags);
    }
  });
});

describe('key grammars agree with the contract over every character and length', () => {
  const nodeSchema = PatternNodeKeySchema;
  const blockSchema = CmsBlockKeySchema;
  const keyCases = (limit: number): string[] => [
    ...CHARACTERS.flatMap(probes),
    ...lengths(limit),
    ...['a_b', 'a-b', 'a.b', 'a0', '9a', '-a', '_a', '.a', 'A', 'aB', ''],
    'a' + '_-0'.repeat(30),
    'a.' + 'b'.repeat(94),
    'a.' + 'b'.repeat(95),
    'a.' + 'b'.repeat(96),
  ];

  it('node keys: 1 to 64 characters of [a-z0-9_-] starting with a letter', () => {
    for (const key of keyCases(64))
      expect(isPatternNodeKey(key), JSON.stringify(key)).toBe(
        nodeSchema.safeParse(key).success,
      );
    expect(isPatternNodeKey('a'.repeat(64))).toBe(true);
    expect(isPatternNodeKey('a'.repeat(65))).toBe(false);
    expect(isPatternNodeKey('a_b-9')).toBe(true);
  });

  it('block keys: 1 to 96 characters of [a-z0-9._-] starting with a letter', () => {
    for (const key of keyCases(96))
      expect(isBlockKey(key), JSON.stringify(key)).toBe(
        blockSchema.safeParse(key).success,
      );
    expect(isBlockKey('a'.repeat(96))).toBe(true);
    expect(isBlockKey('a'.repeat(97))).toBe(false);
    expect(isBlockKey('profile.header')).toBe(true);
  });

  it('pattern keys: 2 to 64 characters of [a-z0-9-] starting with a letter, minus the reserved', () => {
    for (const key of [
      ...CHARACTERS.flatMap(probes),
      ...lengths(64),
      'a_b',
      'a.b',
      'ab',
      'a-',
    ]) {
      const parsed = CmsPatternKeySchema.safeParse(key);
      const issue = patternKeyIssue(key);
      expect(issue === null, JSON.stringify(key)).toBe(parsed.success);
    }
    expect(patternKeyIssue('a'.repeat(64))).toBeNull();
    expect(patternKeyIssue('ab')).toBeNull();
    expect(patternKeyIssue('a')).toBe('pattern_key_invalid');
  });
});

describe('JSON bounds are the contract bounds', () => {
  it('has the contract constants', () => {
    expect(PATTERN_JSON_LIMITS.containerItems).toBe(JSON_VALUE_MAX_KEYS);
    expect(PATTERN_JSON_LIMITS.containerItems).toBe(JSON_VALUE_MAX_ARRAY_ITEMS);
    expect(PATTERN_JSON_LIMITS.bytes).toBe(JSON_VALUE_MAX_BYTES);
    expect(PATTERN_JSON_LIMITS.propsKeyLength).toBe(128);
    expect(PATTERN_LIMITS.propsDepth).toBe(JSON_VALUE_MAX_DEPTH);
  });

  const withProps = (props: Record<string, unknown>): PatternNode[] => [
    {
      kind: 'block',
      key: 'a',
      blockKey: 'profile.header',
      blockVersion: 1,
      props: props as never,
      children: [],
    },
  ];
  const keys = (count: number): Record<string, number> =>
    Object.fromEntries(Array.from({ length: count }, (_, i) => [`k${i}`, 1]));
  const stringOfJsonBytes = (bytes: number): string => 'x'.repeat(bytes - 2);

  it.each([
    ['a nested object of 128 keys', { o: keys(128) }],
    ['a nested object of 129 keys', { o: keys(129) }],
    ['an array of 128 items', { l: Array(128).fill(0) }],
    ['an array of 129 items', { l: Array(129).fill(0) }],
    [
      'a value of exactly the byte limit',
      { s: stringOfJsonBytes(JSON_VALUE_MAX_BYTES) },
    ],
    [
      'a value one byte over the limit',
      { s: stringOfJsonBytes(JSON_VALUE_MAX_BYTES + 1) },
    ],
    [
      'a multi-byte value on the limit',
      { s: 'é'.repeat((JSON_VALUE_MAX_BYTES - 2) / 2) },
    ],
    [
      'a multi-byte value one byte over',
      { s: 'é'.repeat((JSON_VALUE_MAX_BYTES - 2) / 2) + 'x' },
    ],
    ['a key of 128 characters', { ['k'.repeat(128)]: 1 }],
    ['a key of 129 characters', { ['k'.repeat(129)]: 1 }],
    ['a non-finite number', { n: Number.POSITIVE_INFINITY }],
    ['null and booleans', { a: null, b: true, c: false }],
  ])('decides %s as the contract does', (_name, props) => {
    const tree = withProps(props);
    expect(validatePatternTree(tree).length === 0).toBe(
      PatternBlockTreeSchema.safeParse(tree).success,
    );
  });
});
