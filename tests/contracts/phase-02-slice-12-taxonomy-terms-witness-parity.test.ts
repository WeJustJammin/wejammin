import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * [P2-S12-AC-003] [P2-S12-AC-016] The populated-table witness
 * (supabase/tests/phase_02_slice_12_taxonomy_terms/populated-terms-lineage.sql) replays the DDL of the forward
 * migration that keys the term store to the vocabulary lineage (cms_terms.taxonomy_id, BE03c 1371). A replay of
 * a COPY proves nothing if the copy drifts, so the text between the BEGIN/END TERMS-LINEAGE-DDL markers must be
 * identical in both files. The migration is read from supabase/migrations (promoted).
 */
const BEGIN = '-- BEGIN TERMS-LINEAGE-DDL';
const END = '-- END TERMS-LINEAGE-DDL';
const MIGRATION = '20261014120000_cms_terms_lineage_columns.sql';

const path = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

const migrationPath = (): string =>
  path(`../../supabase/migrations/${MIGRATION}`);

const region = (source: string): string => {
  const begin = source.indexOf(BEGIN);
  const end = source.indexOf(END);
  expect(begin).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(begin);
  expect(source.indexOf(BEGIN, begin + 1)).toBe(-1);
  return source.slice(begin, end + END.length);
};

const migration = (): string => region(readFileSync(migrationPath(), 'utf8'));
const witness = (): string =>
  region(
    readFileSync(
      path(
        '../../supabase/tests/phase_02_slice_12_taxonomy_terms/populated-terms-lineage.sql',
      ),
      'utf8',
    ),
  );

describe('term lineage migration witness', () => {
  it('replays exactly the DDL of 20261014120000_cms_terms_lineage_columns.sql', () => {
    expect(witness()).toBe(migration());
  });

  it('compares the whole transform, not a stub', () => {
    const ddl = migration();
    for (const needle of [
      'add column taxonomy_id uuid',
      'cms_terms_version_lineage_fkey',
      'cms_terms_taxonomy_stable_key_key',
      'cms_terms_vocabulary_keyset_idx',
      'cms_terms_00_lineage_fill',
      'repeat across the versions of one vocabulary',
      "errcode = '55000'",
    ])
      expect(ddl).toContain(needle);
    expect(ddl.length).toBeGreaterThan(3500);
  });

  it('detects drift: one changed byte in the witness copy is not equal', () => {
    const drifted = witness().replace('unique', 'uniqu3');
    expect(drifted).not.toBe(witness());
    expect(drifted).not.toBe(migration());
  });
});
