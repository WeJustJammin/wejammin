import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  ObjectPropertySchema,
  ObjectStructureSchema,
  isObjectValueForStructure,
} from './structured-values.ts';

/**
 * DEC-144 (P2-S10-AC-078 / AC-080, audit D-7): the closed per-kind
 * object-property constraint vocabulary and the value checks against it, held
 * identically by this TypeScript contract and by
 * `platform_private.cms_object_structure_valid` / `cms_object_value_valid`.
 *
 * The single corpus is the pgTAP file
 * `supabase/tests/phase_02_slice_10_object_property_constraints.sql`; its VALUES
 * list is parsed here and every row is run through the TypeScript contract, so
 * the two implementations cannot drift apart without a failing test.
 */

const CORPUS_FILE = new URL(
  '../../../../supabase/tests/phase_02_slice_10_object_property_constraints.sql',
  import.meta.url,
);

type CorpusRow = Readonly<{
  label: string;
  kind: 'structure' | 'value';
  property: string;
  value: string;
  expected: boolean;
}>;

const ROW_PATTERN =
  /\(\s*'([^']*)'\s*,\s*'(structure|value)'\s*,\s*\$j\$([\s\S]*?)\$j\$\s*,\s*\$j\$([\s\S]*?)\$j\$\s*,\s*(true|false)\s*\)/g;

const readCorpus = (): readonly CorpusRow[] =>
  [...readFileSync(CORPUS_FILE, 'utf8').matchAll(ROW_PATTERN)].map((match) => ({
    label: match[1]!,
    kind: match[2] as 'structure' | 'value',
    property: match[3]!,
    value: match[4]!,
    expected: match[5] === 'true',
  }));

describe('[P2-S10-AC-078] DEC-144 object-property constraints: shared corpus parity with PostgreSQL', () => {
  const corpus = readCorpus();

  it('parses the shared corpus', () => {
    expect(corpus.length).toBeGreaterThanOrEqual(59);
    expect(new Set(corpus.map((row) => row.label)).size).toBe(corpus.length);
  });

  for (const row of corpus.filter((entry) => entry.kind === 'structure'))
    it('structure: ' + row.label, () => {
      const property: unknown = JSON.parse(row.property);
      expect(ObjectPropertySchema.safeParse(property).success).toBe(
        row.expected,
      );
      expect(
        ObjectStructureSchema.safeParse({ properties: [property] }).success,
      ).toBe(row.expected);
    });

  for (const row of corpus.filter((entry) => entry.kind === 'value'))
    it('value: ' + row.label, () => {
      const property: unknown = JSON.parse(row.property);
      const structure = ObjectStructureSchema.safeParse({
        properties: [property],
      });
      expect(structure.success).toBe(true);
      if (!structure.success) return;
      const value: unknown = JSON.parse(row.value);
      expect(isObjectValueForStructure(structure.data, value)).toBe(
        row.expected,
      );
    });
});
