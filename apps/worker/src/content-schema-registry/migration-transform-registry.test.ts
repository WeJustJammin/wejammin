/** BE03a transform registry: digests, pure members, resolution and JCS hashing. */
import { describe, expect, it } from 'vitest';

import {
  canonicalHash,
  canonicalJson,
  sha256Hex,
} from './migration-transform-jcs';
import {
  DEFAULT_FILL_LITERAL_KEY,
  DEFAULT_TRANSFORM_REGISTRY,
  digestPreimage,
  IDENTITY_REVALIDATE_KEY,
  resolveTransform,
  TRANSFORM_BEHAVIOR,
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

const field = (overrides: Partial<TargetFieldSpec> = {}): TargetFieldSpec => ({
  fieldKey: 'title',
  kind: 'short_text',
  required: true,
  defaultMode: 'literal',
  defaultValue: 'untitled',
  constraints: {},
  ...overrides,
});

const ctx = (...fields: readonly TargetFieldSpec[]): TransformContext => ({
  targetFields: fields,
  retiredFields: [],
});

const rowCode = (run: () => unknown): string | null => {
  try {
    run();
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? 'NO_CODE';
  }
};

describe('code-owned registry membership and digests', () => {
  it('contains exactly the two evidenced members, both version 1', () => {
    expect(
      DEFAULT_TRANSFORM_REGISTRY.map((entry) => [entry.key, entry.version]),
    ).toEqual([
      [IDENTITY_REVALIDATE_KEY, 1],
      [DEFAULT_FILL_LITERAL_KEY, 1],
    ]);
  });

  it.each([IDENTITY_REVALIDATE_KEY, DEFAULT_FILL_LITERAL_KEY])(
    'digest of %s is SHA-256 of the JCS of its definition',
    async (key) => {
      const entry = member(key);
      const behavior =
        TRANSFORM_BEHAVIOR[key as keyof typeof TRANSFORM_BEHAVIOR];
      expect(entry.digest).toBe(
        await sha256Hex(canonicalJson(digestPreimage(entry, behavior))),
      );
      expect(entry.digest).toMatch(/^[a-f0-9]{64}$/u);
    },
  );

  it('keeps the two digests distinct and the field kinds non-empty', () => {
    const [first, second] = DEFAULT_TRANSFORM_REGISTRY;
    expect(first?.digest).not.toBe(second?.digest);
    expect(first?.acceptedFieldKinds.length).toBeGreaterThan(0);
    expect(second?.acceptedFieldKinds).toEqual([
      'short_text',
      'long_text',
      'boolean',
      'integer',
      'decimal',
      'date',
      'datetime',
      'enum',
    ]);
  });
});

describe('identity.revalidate', () => {
  const apply = member(IDENTITY_REVALIDATE_KEY).apply;
  const document = { title: 'a', rank: 2 };

  it('refuses to seal a row when no target field was supplied', () => {
    expect(
      rowCode(() => apply(document, { targetFields: [], retiredFields: [] })),
    ).toBe('TRANSFORM_TARGET_CONSTRAINTS_MISSING');
  });

  it('passes a present value of the right kind', () => {
    expect(apply(document, ctx(field()))).toBe(document);
  });

  it.each([
    ['an absent required value', { rank: 2 }, field()],
    ['a null required value', { title: null }, field()],
    ['a value of the wrong kind', { title: 7 }, field()],
    [
      'a non-integer for an integer field',
      { n: 1.5 },
      field({ fieldKey: 'n', kind: 'integer' }),
    ],
  ])('records TRANSFORM_TARGET_VIOLATION for %s', (_label, source, target) => {
    expect(rowCode(() => apply(source, ctx(target)))).toBe(
      'TRANSFORM_TARGET_VIOLATION',
    );
  });

  it('accepts an absent value for an optional target field', () => {
    const source = { rank: 1 };
    expect(apply(source, ctx(field({ required: false })))).toBe(source);
  });
});

describe('default.fill_literal', () => {
  const apply = member(DEFAULT_FILL_LITERAL_KEY).apply;

  it('writes the declared literal default when the value is absent or null', () => {
    expect(apply({ rank: 1 }, ctx(field()))).toEqual({
      rank: 1,
      title: 'untitled',
    });
    expect(apply({ title: null }, ctx(field()))).toEqual({
      title: 'untitled',
    });
  });

  it('passes a row that already holds a value unchanged and never mutates input', () => {
    const source = { title: 'kept' };
    expect(apply(source, ctx(field()))).toBe(source);
    const sparse = { rank: 1 };
    apply(sparse, ctx(field()));
    expect(sparse).toEqual({ rank: 1 });
  });

  it.each([
    ['no target fields', []],
    ['a non-literal default mode', [field({ defaultMode: 'computed' })]],
    ['a literal mode without a value', [field({ defaultValue: null })]],
  ])('records TRANSFORM_DEFAULT_UNAVAILABLE for %s', (_label, targets) => {
    expect(rowCode(() => apply({ rank: 1 }, ctx(...targets)))).toBe(
      'TRANSFORM_DEFAULT_UNAVAILABLE',
    );
  });
});

describe('resolveTransform', () => {
  const registry = DEFAULT_TRANSFORM_REGISTRY;

  it('resolves registered members and the additive no-transform pair', () => {
    expect(resolveTransform(registry, 'identity.revalidate', '1').kind).toBe(
      'entry',
    );
    expect(resolveTransform(registry, null, null)).toEqual({ kind: 'none' });
  });

  it.each([
    ['an unknown key', 'nope.key', '1'],
    ['an unknown version', 'identity.revalidate', '2'],
    ['a half pair (key only)', 'identity.revalidate', null],
    ['a half pair (version only)', null, '1'],
    ['a zero version', 'identity.revalidate', '0'],
    ['a non-numeric version', 'identity.revalidate', '1.0'],
  ])('refuses %s', (_label, key, version) => {
    expect(resolveTransform(registry, key, version)).toEqual({
      kind: 'unregistered',
    });
  });
});

describe('RFC 8785 canonical JSON and hashing', () => {
  it('sorts members, drops whitespace and is key-order independent', () => {
    expect(canonicalJson({ b: [1, { z: null, a: true }], a: 'x' })).toBe(
      '{"a":"x","b":[1,{"a":true,"z":null}]}',
    );
  });

  it('hashes equal documents equally and different ones differently', async () => {
    expect(await canonicalHash({ a: 1, b: 2 })).toBe(
      await canonicalHash({ b: 2, a: 1 }),
    );
    expect(await canonicalHash({ a: 1 })).not.toBe(
      await canonicalHash({ a: 2 }),
    );
    expect(await sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it.each([
    ['undefined', { a: undefined }],
    ['a non-finite number', { a: Number.POSITIVE_INFINITY }],
    ['a function', { a: () => 1 }],
  ])('refuses %s', (_label, value) => {
    expect(() => canonicalJson(value)).toThrow();
  });

  it('refuses nesting past the bound', () => {
    let nested: unknown = 1;
    for (let depth = 0; depth < 40; depth += 1) nested = { n: nested };
    expect(() => canonicalJson(nested)).toThrow('nesting');
  });
});
