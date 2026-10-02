/**
 * identity.revalidate must validate every row against the compiled target
 * constraints carried on `targetFields[].constraints` (migration worker <-> DB
 * protocol). The canonical admission semantics are
 * `platform_private.cms_draft_field_value_valid`; a successor stricter than
 * the source must never seal clean evidence.
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TRANSFORM_REGISTRY,
  IDENTITY_REVALIDATE_KEY,
} from './migration-transform-registry';
import { parseSourcePage } from './migration-source-read';
import { scanSourcePage } from './migration-scan-executor';
import type {
  SourcePage,
  TargetFieldSpec,
  TransformContext,
  TransformRegistryEntry,
} from './migration-transform-types';

const identity = (): TransformRegistryEntry => {
  const found = DEFAULT_TRANSFORM_REGISTRY.find(
    (entry) => entry.key === IDENTITY_REVALIDATE_KEY,
  );
  if (found === undefined) throw new Error('identity member missing');
  return found;
};

const field = (
  kind: string,
  constraints: Readonly<Record<string, unknown>> | null,
  overrides: Partial<TargetFieldSpec> = {},
): TargetFieldSpec =>
  ({
    fieldKey: 'f',
    kind,
    required: false,
    defaultMode: 'none',
    defaultValue: null,
    constraints,
    ...overrides,
  }) as TargetFieldSpec;

const ctx = (...fields: readonly TargetFieldSpec[]): TransformContext => ({
  targetFields: fields,
  retiredFields: [],
});

const codeOf = (value: unknown, target: TargetFieldSpec): string | null => {
  try {
    identity().apply({ f: value }, ctx(target));
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? 'NO_CODE';
  }
};

const VIOLATION = 'TRANSFORM_TARGET_VIOLATION';

const binding = (
  cardinality: 'one' | 'many',
  min: number,
  max: number,
): Record<string, unknown> => ({
  fieldId: '0195b6f0-0000-7000-8000-0000000000aa',
  targetKind: 'content',
  targetType: 'article',
  projectionKey: 'summary',
  cardinality,
  min,
  max,
  ordered: false,
  onUnavailable: 'omit',
});

describe('identity.revalidate target constraints', () => {
  it.each([
    ['maxLength exceeded', 'short_text', { maxLength: 3 }, 'abcd'],
    ['minLength not met', 'long_text', { minLength: 2 }, 'a'],
    ['enum non-member', 'enum', { enumValues: ['a', 'b'] }, 'c'],
    ['integer below minimum', 'integer', { minimum: 5 }, 4],
    ['integer above maximum', 'integer', { maximum: 5 }, 6],
    ['decimal above maximum', 'decimal', { maximum: 1.5 }, 1.6],
    ['list over maxLength', 'list', { maxLength: 2 }, [1, 2, 3]],
    ['non-array list', 'list', {}, 'x'],
    ['array object', 'object', {}, []],
    ['malformed date', 'date', {}, '2026-02-31'],
    ['taxonomy over maxLength', 'taxonomy', { maxLength: 2 }, 'abc'],
  ])(
    'refuses a successor violating: %s',
    (_label, kind, constraints, value) => {
      expect(codeOf(value, field(kind, constraints))).toBe(VIOLATION);
    },
  );

  it.each([
    ['maxLength met', 'short_text', { maxLength: 3 }, 'abc'],
    ['enum member', 'enum', { enumValues: ['a', 'b'] }, 'b'],
    ['integer in bounds', 'integer', { minimum: 1, maximum: 5 }, 5],
    ['list within bound', 'list', { maxLength: 2 }, [1, 2]],
    ['object', 'object', {}, { a: 1 }],
    ['date', 'date', {}, '2026-02-28'],
  ])('accepts a conforming value: %s', (_label, kind, constraints, value) => {
    expect(codeOf(value, field(kind, constraints))).toBeNull();
  });

  it('counts string length in characters, not UTF-16 units', () => {
    expect(
      codeOf('\u{1F3B5}\u{1F3B5}', field('short_text', { maxLength: 2 })),
    ).toBeNull();
    expect(
      codeOf(
        '\u{1F3B5}\u{1F3B5}\u{1F3B5}',
        field('short_text', { maxLength: 2 }),
      ),
    ).toBe(VIOLATION);
  });

  it('enforces relation cardinality from the compiled relation constraints', () => {
    const one = field('relation', {
      relation: binding('one', 1, 1),
    });
    expect(codeOf(['a', 'b'], one)).toBe(VIOLATION);
    expect(codeOf('a', one)).toBeNull();
    const many = field('relation', {
      relation: binding('many', 2, 3),
    });
    expect(codeOf(['a'], many)).toBe(VIOLATION);
    expect(codeOf(['a', 'b', 'c', 'd'], many)).toBe(VIOLATION);
    expect(codeOf(['a', 'b'], many)).toBeNull();
  });

  it('validates list items against itemKind', () => {
    const target = field('list', { itemKind: 'integer' });
    expect(codeOf([1, 'x'], target)).toBe(VIOLATION);
    expect(codeOf([1, 2], target)).toBeNull();
  });

  it.each([
    ['null constraints', null],
    ['an enum without enumValues', {}],
    ['a relation without a binding', {}],
  ])('refuses missing constraint data: %s', (_label, constraints) => {
    const kind = _label.includes('enum')
      ? 'enum'
      : _label.includes('relation')
        ? 'relation'
        : 'short_text';
    expect(codeOf('a', field(kind, constraints))).toBe(
      'TRANSFORM_TARGET_CONSTRAINTS_MISSING',
    );
  });

  it('refuses a missing target field instead of sealing the row', () => {
    expect(() => identity().apply({ f: 'a' }, ctx())).toThrowError(
      expect.objectContaining({ code: 'TRANSFORM_TARGET_CONSTRAINTS_MISSING' }),
    );
  });

  it.each([
    ['unknown keys', { surprise: 1 }],
    ['a contradictory range', { minLength: 5, maxLength: 1 }],
    ['a non-object', 'maxLength'],
    ['a malformed relation binding', { relation: { cardinality: 'one' } }],
  ])('refuses malformed constraint data: %s', (_label, constraints) => {
    expect(
      codeOf(
        'abc',
        field('short_text', constraints as Record<string, unknown>),
      ),
    ).toBe('TRANSFORM_TARGET_CONSTRAINTS_INVALID');
  });

  it.each([
    ['rich_text', field('rich_text', {})],
    ['an unknown kind', field('hologram', {})],
    [
      'a validator ref',
      field('short_text', { validatorKey: 'cms.slug', validatorVersion: '1' }),
    ],
  ])(
    'refuses unsupported %s even for an absent optional value',
    (label, target) => {
      expect(
        (() => {
          try {
            identity().apply({}, ctx(target));
            return null;
          } catch (error) {
            return (error as { code?: string }).code;
          }
        })(),
      ).toBe(
        label === 'a validator ref'
          ? 'TRANSFORM_TARGET_VALIDATOR_UNSUPPORTED'
          : 'TRANSFORM_TARGET_KIND_UNSUPPORTED',
      );
    },
  );
});

describe('scan evidence for a stricter successor', () => {
  it('records a row error and no output hash instead of carrying the source hash', async () => {
    const page: SourcePage = {
      rows: [
        {
          sourceTable: 'cms_entry_field_values',
          sourceRowId: '0195b6f0-0000-7000-8000-000000000001',
          sourceHash: 'a'.repeat(64),
          document: { f: 'abcdef' },
        },
      ],
      nextCursor: '1',
      done: true,
      targetFields: [field('short_text', { maxLength: 3 })],
      retiredFields: [],
    };
    const [entry] = await scanSourcePage(page, identity());
    expect(entry).toMatchObject({ outputHash: null, errorCode: VIOLATION });
  });
});

describe('read page targetFields[].constraints', () => {
  const page = (targetField: unknown) => ({
    rows: [],
    nextCursor: '0',
    done: true,
    targetFields: [targetField],
    retiredFields: [],
  });
  const base = {
    fieldKey: 'f',
    kind: 'short_text',
    required: false,
    defaultMode: 'none',
    defaultValue: null,
  };

  it('carries compiled constraints through to the transform context', () => {
    const parsed = parseSourcePage(
      page({ ...base, constraints: { maxLength: 3 } }),
      128,
    );
    expect(parsed.targetFields[0]?.constraints).toEqual({ maxLength: 3 });
  });

  it('keeps absent constraints as null so the transform refuses the row', () => {
    expect(
      parseSourcePage(page(base), 128).targetFields[0]?.constraints,
    ).toBeNull();
  });

  it('refuses a non-object constraints payload on the page', () => {
    expect(() =>
      parseSourcePage(page({ ...base, constraints: 'maxLength' }), 128),
    ).toThrowError(
      expect.objectContaining({ code: 'DEPENDENCY_INVALID_RESPONSE' }),
    );
  });
});
