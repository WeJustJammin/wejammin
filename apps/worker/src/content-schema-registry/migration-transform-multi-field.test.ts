/**
 * Multi-field scan protocol (DB stage 3 follow-ups): the source-read page
 * carries `targetFields[]` and `retiredFields[]`; identity.revalidate and
 * default.fill_literal apply per field; retired values are carried
 * unvalidated; read and batch share one page limit and the Worker asserts the
 * DB's evidence-count expectation.
 */
import { describe, expect, it } from 'vitest';

import { parseSourcePage } from './migration-source-read';
import {
  DEFAULT_FILL_LITERAL_KEY,
  DEFAULT_TRANSFORM_REGISTRY,
  IDENTITY_REVALIDATE_KEY,
} from './migration-transform-registry';
import type {
  TargetFieldSpec,
  TransformContext,
  TransformRegistryEntry,
} from './migration-transform-types';

const member = (key: string): TransformRegistryEntry => {
  const found = DEFAULT_TRANSFORM_REGISTRY.find((entry) => entry.key === key);
  if (found === undefined) throw new Error(`missing registry member ${key}`);
  return found;
};

const field = (
  fieldKey: string,
  overrides: Partial<TargetFieldSpec> = {},
): TargetFieldSpec => ({
  fieldKey,
  kind: 'short_text',
  required: true,
  defaultMode: 'literal',
  defaultValue: `${fieldKey}-default`,
  constraints: { maxLength: 5 },
  ...overrides,
});

const context = (
  targetFields: readonly TargetFieldSpec[],
  retiredFields: readonly string[] = [],
): TransformContext => ({ targetFields, retiredFields });

const codeOf = (run: () => unknown): string | null => {
  try {
    run();
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? 'NO_CODE';
  }
};

const identity = member(IDENTITY_REVALIDATE_KEY).apply;
const fill = member(DEFAULT_FILL_LITERAL_KEY).apply;

describe('identity.revalidate with several changed fields', () => {
  const targets = [
    field('title'),
    field('rank', { kind: 'integer', constraints: { minimum: 1 } }),
  ];

  it('validates every changed field and carries the row unchanged', () => {
    const document = { title: 'abc', rank: 3, extra: 'kept' };
    expect(identity(document, context(targets))).toBe(document);
  });

  it.each([
    ['the first field violating', { title: 'toolong', rank: 3 }],
    ['the second field violating', { title: 'abc', rank: 0 }],
    ['both fields violating', { title: 'toolong', rank: 0 }],
    ['the second field absent but required', { title: 'abc' }],
  ])('records TRANSFORM_TARGET_VIOLATION for %s', (_label, document) => {
    expect(codeOf(() => identity(document, context(targets)))).toBe(
      'TRANSFORM_TARGET_VIOLATION',
    );
  });

  it('refuses when any one field has unprovable constraints', () => {
    const broken = [field('title'), field('rank', { constraints: null })];
    expect(
      codeOf(() => identity({ title: 'a', rank: 1 }, context(broken))),
    ).toBe('TRANSFORM_TARGET_CONSTRAINTS_MISSING');
  });
});

describe('retired fields', () => {
  it('carries retired values unvalidated and unchanged', () => {
    const document = { title: 'abc', legacy: { anything: [1, 'x', null] } };
    expect(identity(document, context([field('title')], ['legacy']))).toBe(
      document,
    );
  });

  it('seals a retire-only plan (no changed fields) by carrying the row', () => {
    const document = { legacy: 12345, other: 'x' };
    expect(identity(document, context([], ['legacy']))).toBe(document);
    expect(fill(document, context([], ['legacy']))).toBe(document);
  });

  it('still refuses when there is nothing at all to prove against', () => {
    expect(codeOf(() => identity({ a: 1 }, context([], [])))).toBe(
      'TRANSFORM_TARGET_CONSTRAINTS_MISSING',
    );
    expect(codeOf(() => fill({ a: 1 }, context([], [])))).toBe(
      'TRANSFORM_DEFAULT_UNAVAILABLE',
    );
  });

  it('never fills or touches a retired key during default.fill_literal', () => {
    const output = fill(
      { legacy: null },
      context([field('title')], ['legacy']),
    );
    expect(output).toEqual({ legacy: null, title: 'title-default' });
  });
});

describe('default.fill_literal with several changed fields', () => {
  const targets = [field('title'), field('rank', { defaultValue: 7 })];

  it('fills each absent or null field with its own literal default', () => {
    expect(fill({ rank: null, extra: 1 }, context(targets))).toEqual({
      extra: 1,
      rank: 7,
      title: 'title-default',
    });
  });

  it('keeps present values and returns the same row when nothing is absent', () => {
    const document = { title: 't', rank: 1 };
    expect(fill(document, context(targets))).toBe(document);
    expect(fill({ title: 't' }, context(targets))).toEqual({
      title: 't',
      rank: 7,
    });
  });

  it('refuses the row when any changed field has no declared literal default', () => {
    const mixed = [field('title'), field('rank', { defaultMode: 'none' })];
    expect(codeOf(() => fill({ title: 't', rank: 1 }, context(mixed)))).toBe(
      'TRANSFORM_DEFAULT_UNAVAILABLE',
    );
  });
});

describe('read page parsing', () => {
  const entry = (fieldKey: string): Record<string, unknown> => ({
    fieldKey,
    kind: 'short_text',
    required: false,
    defaultMode: 'none',
    defaultValue: null,
    constraints: { maxLength: 9 },
  });
  const page = (overrides: Record<string, unknown> = {}) => ({
    rows: [],
    nextCursor: '0',
    done: true,
    targetFields: [entry('a'), entry('b')],
    retiredFields: ['old_one'],
    ...overrides,
  });
  const invalid = (value: unknown, limit = 128): string | null =>
    codeOf(() => parseSourcePage(value, limit));

  it('exposes every target field and every retired key', () => {
    const parsed = parseSourcePage(page(), 128);
    expect(parsed.targetFields.map((item) => item.fieldKey)).toEqual([
      'a',
      'b',
    ]);
    expect(parsed.retiredFields).toEqual(['old_one']);
    expect(parsed.targetFields[1]?.constraints).toEqual({ maxLength: 9 });
  });

  it('accepts empty targetFields and retiredFields', () => {
    const parsed = parseSourcePage(
      page({ targetFields: [], retiredFields: [] }),
      128,
    );
    expect(parsed.targetFields).toEqual([]);
    expect(parsed.retiredFields).toEqual([]);
  });

  it.each([
    ['the removed single targetField member', { targetField: entry('a') }],
    ['a missing targetFields member', { targetFields: undefined }],
    ['a missing retiredFields member', { retiredFields: undefined }],
    ['a non-array targetFields', { targetFields: entry('a') }],
    ['a null targetFields', { targetFields: null }],
    ['a non-array retiredFields', { retiredFields: 'old_one' }],
    [
      'a duplicated target fieldKey',
      { targetFields: [entry('a'), entry('a')] },
    ],
    ['a duplicated retired key', { retiredFields: ['x', 'x'] }],
    ['a key both changed and retired', { retiredFields: ['a'] }],
    ['a malformed retired key', { retiredFields: ['Bad-Key'] }],
    ['a non-string retired key', { retiredFields: [7] }],
    ['a malformed target entry', { targetFields: [{ fieldKey: 'a' }] }],
    [
      'more than 128 target fields',
      {
        targetFields: Array.from({ length: 129 }, (_, i) => entry(`f${i}`)),
      },
    ],
    [
      'more than 128 retired keys',
      { retiredFields: Array.from({ length: 129 }, (_, i) => `r${i}`) },
    ],
  ])('refuses %s', (_label, overrides) => {
    const raw = { ...page(), ...overrides };
    for (const key of Object.keys(overrides))
      if (overrides[key as keyof typeof overrides] === undefined)
        delete (raw as Record<string, unknown>)[key];
    expect(invalid(raw)).toBe('DEPENDENCY_INVALID_RESPONSE');
  });

  it('refuses a short page that is not the last (evidence-count expectation)', () => {
    const rows = [
      {
        sourceTable: 'cms_entry_revisions',
        sourceRowId: 'b0000000-0000-4000-8000-000000000001',
        sourceHash: '1'.repeat(64),
        document: {},
      },
    ];
    expect(invalid(page({ rows, nextCursor: '1', done: false }), 2)).toBe(
      'DEPENDENCY_INVALID_RESPONSE',
    );
    expect(
      codeOf(() => parseSourcePage(page({ rows, nextCursor: '1' }), 2)),
    ).toBeNull();
  });
});
