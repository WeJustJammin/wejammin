/** Kind, constraint-reference and non-serialisable-output edges of the scan. */
import { describe, expect, it } from 'vitest';

import { canonicalJson } from './migration-transform-jcs';
import { scanSourcePage } from './migration-scan-executor';
import { kindAccepts, validateTargetValue } from './migration-target-validator';
import type {
  SourcePage,
  TargetFieldSpec,
  TransformRegistryEntry,
} from './migration-transform-types';

const target = (
  kind: string,
  constraints: Record<string, unknown> | null = {},
  required = false,
): TargetFieldSpec => ({
  fieldKey: 'f',
  kind,
  required,
  defaultMode: 'none',
  defaultValue: null,
  constraints,
});

const codeOf = (field: TargetFieldSpec, value: unknown): string | null => {
  try {
    validateTargetValue(field, value);
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? 'NO_CODE';
  }
};

const VIOLATION = 'TRANSFORM_TARGET_VIOLATION';

describe('kind acceptance', () => {
  it.each([
    ['taxonomy', 'a', 7],
    ['boolean', true, 'true'],
    ['integer', 3, 1.5],
    ['decimal', 1.5, Number.NaN],
    ['date', '2026-02-28', '2026-02-30'],
    ['datetime', '2026-02-28T10:00:00Z', '2026-02-30T10:00:00Z'],
    ['object', { a: 1 }, [1]],
    ['list', [1], 'x'],
    ['media', 'asset', 3],
    ['relation', ['a'], 3],
  ])(
    '%s accepts a conforming value and refuses a wrong one',
    (kind, good, bad) => {
      const constraints =
        kind === 'relation'
          ? {
              relation: {
                fieldId: '0195b6f0-0000-7000-8000-0000000000aa',
                targetKind: 'content',
                targetType: 'article',
                projectionKey: 'summary',
                cardinality: 'many',
                min: 0,
                max: 5,
                ordered: false,
                onUnavailable: 'omit',
              },
            }
          : {};
      expect(codeOf(target(kind, constraints), good)).toBeNull();
      expect(codeOf(target(kind, constraints), bad)).toBe(VIOLATION);
    },
  );

  it('refuses a kind it does not know', () => {
    expect(kindAccepts('hologram', 'x')).toBe(false);
  });

  it('refuses a malformed calendar prefix', () => {
    expect(kindAccepts('date', '2026-13-01')).toBe(false);
    expect(kindAccepts('datetime', '0000-00-00T00:00:00Z')).toBe(false);
  });
});

describe('constraint references', () => {
  it.each([
    [
      'an invalid validator key',
      { validatorKey: 'BAD KEY', validatorVersion: '1' },
    ],
    [
      'an invalid validator version',
      { validatorKey: 'cms.slug', validatorVersion: 'x' },
    ],
    ['a validator key without a version', { validatorKey: 'cms.slug' }],
    ['a version without a key', { validatorVersion: '1' }],
  ])('refuses %s as invalid constraints', (_label, constraints) => {
    expect(codeOf(target('short_text', constraints), 'a')).toBe(
      'TRANSFORM_TARGET_CONSTRAINTS_INVALID',
    );
  });

  it('refuses a rich_text list itemKind as unsupported', () => {
    expect(codeOf(target('list', { itemKind: 'rich_text' }), [])).toBe(
      'TRANSFORM_TARGET_KIND_UNSUPPORTED',
    );
  });

  it('refuses a missing relation binding and an enum without values', () => {
    expect(codeOf(target('relation', {}), 'a')).toBe(
      'TRANSFORM_TARGET_CONSTRAINTS_MISSING',
    );
    expect(codeOf(target('enum', {}), 'a')).toBe(
      'TRANSFORM_TARGET_CONSTRAINTS_MISSING',
    );
  });
});

describe('scan evidence for an output that cannot be hashed', () => {
  it('records TRANSFORM_OUTPUT_INVALID with no output hash', async () => {
    const entry: TransformRegistryEntry = {
      key: 'x.y',
      version: 1,
      digest: 'e'.repeat(64),
      sourceConstraints: {},
      targetConstraints: {},
      acceptedFieldKinds: ['short_text'],
      apply: () => ({ bad: undefined }),
    };
    const page: SourcePage = {
      rows: [
        {
          sourceTable: 'cms_entry_revisions',
          sourceRowId: '0195b6f0-0000-7000-8000-000000000001',
          sourceHash: 'a'.repeat(64),
          document: {},
        },
      ],
      nextCursor: '1',
      done: true,
      targetFields: [],
      retiredFields: [],
    };
    const [evidence] = await scanSourcePage(page, entry);
    expect(evidence).toMatchObject({
      outputHash: null,
      errorCode: 'TRANSFORM_OUTPUT_INVALID',
    });
  });
});

describe('scan and canonical edges', () => {
  const page = (): SourcePage => ({
    rows: [
      {
        sourceTable: 'cms_entry_revisions',
        sourceRowId: '0195b6f0-0000-7000-8000-000000000001',
        sourceHash: 'a'.repeat(64),
        document: {},
      },
    ],
    nextCursor: '1',
    done: true,
    targetFields: [],
    retiredFields: [],
  });
  const entry = (
    apply: TransformRegistryEntry['apply'],
  ): TransformRegistryEntry => ({
    key: 'x.y',
    version: 1,
    digest: 'e'.repeat(64),
    sourceConstraints: {},
    targetConstraints: {},
    acceptedFieldKinds: ['short_text'],
    apply,
  });

  it('maps a thrown non-object and an uncoded error to TRANSFORM_ROW_FAILED', async () => {
    for (const thrown of ['boom', new Error('no code'), null]) {
      const [evidence] = await scanSourcePage(
        page(),
        entry(() => {
          throw thrown;
        }),
      );
      expect(evidence).toMatchObject({
        outputHash: null,
        errorCode: 'TRANSFORM_ROW_FAILED',
      });
    }
  });

  it('serialises booleans canonically', () => {
    expect(canonicalJson([true, false])).toBe('[true,false]');
  });
});
